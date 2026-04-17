// api/topups.js
import { connectToDatabase } from './helpers/db';

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
        user: t.user_name,
        kelas: t.kelas,
        amount: t.amount,
        saldoAfter: t.saldo_akhir,
        type: t.type,
        date: t.date,
        adminName: t.admin
      }));
      return res.status(200).json(formatted);
    }

    if (req.method === 'POST') {
      const body = req.body;

      // Bulk import
      if (body.action === 'bulkImport' && Array.isArray(body.data)) {
        await topups.insertMany(body.data);
        return res.status(200).json({ success: true });
      }

      // ✅ Normal topup — ini yang hilang sebelumnya
      const { userId, amount, adminName, date } = body;
      if (!userId || !amount) {
        return res.status(400).json({ error: 'userId dan amount wajib diisi' });
      }

      const users = db.collection('users');
      const { ObjectId } = await import('mongodb');

      // Cari user
      let user = null;
      try { user = await users.findOne({ _id: new ObjectId(userId) }); } catch {}
      if (!user) user = await users.findOne({ id: userId });
      if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

      // Update saldo user
      const saldoBaru = (user.saldo || 0) + Number(amount);
      await users.updateOne(
        { _id: user._id },
        { $set: { saldo: saldoBaru } }
      );

      // Simpan record topup
      const record = {
        userId: user._id.toString(),
        user_name: user.name,
        kelas: user.kelas,
        amount: Number(amount),
        saldo_akhir: saldoBaru,
        admin: adminName || 'Admin',
        date: date || new Date().toISOString(),
        type: 'topup'
      };
      const inserted = await topups.insertOne(record);

      return res.status(200).json({
        success: true,
        _id: inserted.insertedId.toString(),
        userName: user.name,
        saldoAfter: saldoBaru,
        ...record
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Topups error:', err);
    return res.status(500).json({ error: err.message });
  }
}
