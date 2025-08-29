import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabaseClient';

// Simple API route proxying to Supabase for demo purposes (no server-side secret here).
// For production, move create/update operations to serverless functions using service role key.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('date', { ascending: false })
      .limit(100);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;
      // Expect: { date, type, detail, amount, kg }
      const { data, error } = await supabase.from('activities').insert([body]).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data[0]);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'unknown' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).end('Method Not Allowed');
}
