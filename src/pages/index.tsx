import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Pie } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
Chart.register(ArcElement, Tooltip, Legend);

// Simple client-side carbon calc (match server calculation)
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
  const [elecFactor, setElecFactor] = useState(0.475);

  useEffect(() => {
    fetchActivities();
    // subscribe can be added with supabase realtime for live updates
  }, []);

  async function fetchActivities() {
    const res = await fetch('/api/activities');
    const json = await res.json();
    setActivities(json || []);
  }

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
    const res = await fetch('/api/activities', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (res.ok) {
      setAmount('');
      fetchActivities();
    } else {
      const j = await res.json();
      alert('Error: ' + (j.error || 'unknown'));
    }
  }

  // compute positive contributions per category
  const totals: Record<string, number> = {};
  activities.forEach(a => {
    const k = parseFloat(a.kg) || 0;
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
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1 }}>
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
              <input type="number" step="0.01" value={elecFactor} onChange={e=>setElecFactor(parseFloat(e.target.value))} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={addActivity}>Add</button>
          </div>

          <h3 style={{ marginTop: 24}}>History</h3>
          <table border={1} cellPadding={6}>
            <thead><tr><th>Date</th><th>Type</th><th>Detail</th><th>Amount</th><th>kg CO2</th></tr></thead>
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

        <div style={{ width: 420 }}>
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
