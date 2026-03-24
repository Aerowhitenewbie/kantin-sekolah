const { connectToDatabase } = require('./helpers/db');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await connectToDatabase();
    const topups = db.collection('topups');

    if (req.method === 'GET') {
      const all = await topups.find({}).sort({ _id: -1 }).toArray();
      const formatted = all.map(t => ({
        _id: t._id.toString(),
        userId: t.userId?.toString(),
        userName: t.user_name,
        user: t.user_name,       // alias for frontend compatibility
        kelas: t.kelas,
        amount: t.amount,
        saldoAkhir: t.saldo_akhir,
        type: t.type,
        date: t.date,
        admin: t.admin
      }));
      return res.status(200).json(formatted);
    }

    // POST - bulk import (for importData)
    if (req.method === 'POST') {
      const { action, data } = req.body;
      if (action === 'bulkImport' && Array.isArray(data)) {
        await topups.insertMany(data);
        return res.status(200).json({ success: true });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Topups error:', err);
    return res.status(500).json({ error: err.message });
  }
}
