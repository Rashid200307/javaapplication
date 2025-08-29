import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// Load Pie chart only on client (no SSR)
const Pie = dynamic(() => import('react-chartjs-2').then(mod => mod.Pie), { ssr: false });

// Safe client-side Chart.js registration inside useEffect
function registerChartJs() {
  // import dynamically so Node build doesn't load chart.js on server
  return import('chart.js').then((mod) => {
    const { Chart, ArcElement, Tooltip, Legend } = mod as any;
    try {
      // register only if not already registered
      Chart.register(ArcElement, Tooltip, Legend);
    } catch (err) {
      // ignore already-registered errors
      // console.warn('Chart register:', err);
    }
  }).catch((err) => {
    // if Chart.js isn't installed, don't crash the whole page build/runtime
    console.warn('Chart.js not available:', err);
  });
}

// Simple carbon calc (client-side)
function carbonForActivity(type: string, detail: string, amount: number, electricityFactor = 0.475) {
  const d = (detail || '').toLowerCase();
  switch (type) {
    case 'TRANSPORT':
      if (d.includes('car')) return amount * 0.21;
      if (d.includes('bus')) return amount * 0.089;
      if (d.includes('train')) return amount * 0.041;
      if (d.includes('bike') || d.includes('walk')) return 0;
      return amount * 0.18;
    case 'ELECTRICITY':
      return amount * electricityFactor;
    case 'WATER':
      return amount * 0.001;
    case 'RECYCLING':
      if (d.includes('plastic')) return amount * -0.02;
      if (d.includes('paper')) return amount * -0.03;
      if (d.includes('glass')) return amount * -0.01;
      return amount * -0.015;
    case 'FOOD':
      if (d.includes('beef')) return amount * 27.0;
      if (d.includes('lamb')) return amount * 39.2;
      if (d.includes('chicken')) return amount * 6.9;
      if (d.includes('veg')) return amount * 2.0;
      return amount * 4.0;
    default:
      return amount * 1.0;
  }
}

export default function Home() {
  const [activities, setActivities] = useState<any[]>([]);
  const [type, setType] = useState('TRANSPORT');
  const [detail, setDetail] = useState('Car');
  const [amount, setAmount] = useState('');
  const [elecFactor, setElecFactor] = useState<number>(Number(process.env.NEXT_PUBLIC_DEFAULT_ELEC_FACTOR ?? 0.475));

  useEffect(() => {
    // register Chart.js client-side only
    registerChartJs();

    // fetch activities from API (if API not ready, handle gracefully)
    fetch('/api/activities').then(async (r) => {
      if (!r.ok) return;
      const json = await r.json();
      setActivities(json || []);
    }).catch((err) => {
      console.warn('Failed to fetch activities:', err);
      setActivities([]);
    });
  }, []);

  async function addActivity() {
    const amt = parseFloat(amount);
    if (isNaN(amt)) return alert('Enter a valid number');
    const kg = carbonForActivity(type, detail, amt, elecFactor);
    const body = {
      date: new Date().toISOString().slice(0,10),
      type,
      detail,
      amount: amt,
      kg
    };
    try {
      const res = await fetch('/api/activities', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (!res.ok) {
        const j = await res.json().catch(()=>({ error: 'unknown' }));
        return alert('Error saving: ' + (j?.error || 'unknown'));
      }
      setAmount('');
      // refresh
      const data = await (await fetch('/api/activities')).json();
      setActivities(data || []);
    } catch (err: any) {
      alert('Network error: ' + err?.message);
    }
  }

  // compute positive contributions per category
  const totals: Record<string, number> = {};
  activities.forEach(a => {
    const k = Number(a.kg) || 0;
    if (k <= 0) return;
    totals[a.type] = (totals[a.type] || 0) + k;
  });
  const labels = Object.keys(totals);
  const data = labels.map(l => totals[l]);

  const pieData = {
    labels,
    datasets: [{
      data,
      backgroundColor: ['#4CAF50','#2196F3','#FFC107','#F44336','#9C27B0','#607D8B']
    }]
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>EcoTracker — Web</h1>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 520px', minWidth: 320 }}>
          <h3>Log activity</h3>
          <div style={{ display:'grid', gridTemplateColumns: '1fr 1fr', gap:8 }}>
            <select value={type} onChange={e=>setType(e.target.value)}>
              <option value="TRANSPORT">Transport</option>
              <option value="ELECTRICITY">Electricity</option>
              <option value="WATER">Water</option>
              <option value="RECYCLING">Recycling</option>
              <option value="FOOD">Food</option>
              <option value="OTHER">Other</option>
            </select>
            <input value={detail} onChange={e=>setDetail(e.target.value)} placeholder="Detail (e.g., Car)" />
            <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Amount (km, kWh, kg)" />
            <div>
              <label>Electricity factor (kg/kWh)</label>
              <input type="number" step="0.01" value={elecFactor} onChange={e=>setElecFactor(Number(e.target.value))} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={addActivity}>Add</button>
          </div>

          <h3 style={{ marginTop: 24}}>History</h3>
          <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #ddd', padding: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                  <th>Date</th><th>Type</th><th>Detail</th><th style={{textAlign:'right'}}>Amount</th><th style={{textAlign:'right'}}>kg CO2</th>
                </tr>
              </thead>
              <tbody>
                {activities.map(a=>(
                  <tr key={a.id}>
                    <td>{a.date}</td>
                    <td>{a.type}</td>
                    <td>{a.detail}</td>
                    <td style={{ textAlign:'right' }}>{Number(a.amount).toFixed(2)}</td>
                    <td style={{ textAlign:'right' }}>{Number(a.kg).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ width: 420, minWidth: 320 }}>
          <h3>Emissions by category</h3>
          {labels.length ? <Pie data={pieData} /> : <p>No positive emissions recorded yet.</p>}
          <div style={{ marginTop: 12 }}>
            <strong>Total (positive emissions): </strong> {activities.reduce((s,a)=>s + Math.max(0, Number(a.kg)||0), 0).toFixed(2)} kg
          </div>
          <div style={{ marginTop: 12 }}>
            <small>Negative values (recycling savings) are stored but shown separately in the data table.</small>
          </div>
        </div>
      </div>
    </div>
  );
}
