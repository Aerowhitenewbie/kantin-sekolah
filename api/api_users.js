const { connectToDatabase } = require('./helpers/db');
const { ObjectId } = require('mongodb');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await connectToDatabase();
    const users = db.collection('users');
    const topups = db.collection('topups');

    // GET all users
    if (req.method === 'GET') {
      const allUsers = await users.find({}).toArray();
      const formatted = allUsers.map(u => ({
        _id: u._id.toString(),
        name: u.name,
        pin: u.pin.startsWith('$2') ? '******' : u.pin,
        kelas: u.kelas,
        saldo: u.saldo,
        created: u.created
      }));
      return res.status(200).json(formatted);
    }

    // POST - topup / delete
    if (req.method === 'POST') {
      const { action, userId, amount, adminName } = req.body;

      if (action === 'topup') {
        const user = await users.findOne({ _id: new ObjectId(userId) });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const newSaldo = user.saldo + amount;
        await users.updateOne({ _id: new ObjectId(userId) }, { $set: { saldo: newSaldo } });

        await topups.insertOne({
          userId: new ObjectId(userId),
          user_name: user.name,
          kelas: user.kelas,
          amount,
          saldo_akhir: newSaldo,
          type: 'topup',
          date: new Date().toLocaleString('id-ID'),
          admin: adminName || 'Admin'
        });

        return res.status(200).json({ success: true, newSaldo });
      }

      if (action === 'delete') {
        await users.deleteOne({ _id: new ObjectId(userId) });
        return res.status(200).json({ success: true });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Users error:', err);
    return res.status(500).json({ error: err.message });
  }
}
