const { connectToDatabase } = require('./helpers/db');
const bcrypt = require('bcryptjs');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await connectToDatabase();
    const users = db.collection('users');

    if (req.method === 'POST') {
      const { action, name, pin, kelas, saldo } = req.body;

      // LOGIN
      if (action === 'login') {
        const user = await users.findOne({
          name: { $regex: new RegExp(`^${name}$`, 'i') }
        });

        if (!user) return res.status(401).json({ error: 'User tidak ditemukan' });

        let pinMatch = false;
        if (user.pin.startsWith('$2')) {
          pinMatch = await bcrypt.compare(pin, user.pin);
        } else {
          pinMatch = pin === user.pin;
        }

        if (!pinMatch) return res.status(401).json({ error: 'PIN salah' });

        return res.status(200).json({
          success: true,
          user: {
            id: user._id.toString(),
            name: user.name,
            kelas: user.kelas,
            saldo: user.saldo,
            role: user.kelas === 'admin' ? 'admin' : 'customer'
          }
        });
      }

      // REGISTER
      if (action === 'register') {
        const existing = await users.findOne({
          name: { $regex: new RegExp(`^${name}$`, 'i') }
        });

        if (existing) return res.status(409).json({ error: 'Nama sudah digunakan' });

        const hashedPin = await bcrypt.hash(String(pin), 10);
        const result = await users.insertOne({
          name,
          pin: hashedPin,
          kelas,
          saldo: parseInt(saldo) || 0,
          created: new Date().toLocaleDateString('id-ID')
        });

        return res.status(201).json({ success: true, userId: result.insertedId.toString() });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: err.message });
  }
}
