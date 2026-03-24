const { connectToDatabase } = require('./helpers/db');
const { ObjectId } = require('mongodb');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await connectToDatabase();
    const transactions = db.collection('transactions');
    const users = db.collection('users');
    const menu = db.collection('menu');

    // =========================
    // GET ALL TRANSACTIONS
    // =========================
    if (req.method === 'GET') {
      const txs = await transactions
        .find({})
        .sort({ createdAt: -1 }) // ✅ pakai timestamp
        .toArray();

      const formatted = txs.map(t => ({
        _id: t._id.toString(),
        userId: t.userId?.toString(),
        user: t.user,
        userName: t.user,
        kelas: t.kelas,
        items: t.items,
        subtotal: t.subtotal,
        tax: t.tax || 0,
        total: t.total,
        type: t.type,
        status: t.status,
        createdAt: t.createdAt || null // ✅ kirim raw ISO
      }));

      return res.status(200).json(formatted);
    }

    // =========================
    // POST TRANSACTION
    // =========================
    if (req.method === 'POST') {
      const body = req.body;

      // BULK IMPORT
      if (body.action === 'bulkImport' && Array.isArray(body.data)) {
        const dataWithDate = body.data.map(item => ({
          ...item,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date()
        }));

        await transactions.insertMany(dataWithDate);
        return res.status(200).json({ success: true });
      }

      // NORMAL CHECKOUT
      const { userId, items, subtotal, tax, total, type } = body;

      const user = await users.findOne({ _id: new ObjectId(userId) });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const isGuest = user.kelas === 'guest';
      const finalTax = isGuest ? Math.round(subtotal * 0.10) : (tax || 0);
      const finalTotal = subtotal + finalTax;

      if (user.saldo < finalTotal) {
        return res.status(400).json({ error: 'Saldo tidak cukup' });
      }

      // =========================
      // KURANGI STOK
      // =========================
      for (const item of items) {
        const isMongoId = item.id && /^[a-f\d]{24}$/i.test(String(item.id));
        if (isMongoId) {
          await menu.updateOne(
            { _id: new ObjectId(item.id) },
            { $inc: { stock: -item.qty } }
          );
        }
      }

      // =========================
      // KURANGI SALDO
      // =========================
      await users.updateOne(
        { _id: new ObjectId(userId) },
        { $inc: { saldo: -finalTotal } }
      );

      // =========================
      // SIMPAN TRANSAKSI (FIXED)
      // =========================
      const now = new Date();

      const tx = await transactions.insertOne({
        userId: new ObjectId(userId),
        user: user.name,
        kelas: user.kelas,
        isGuest,
        items,
        subtotal,
        tax: finalTax,
        total: finalTotal,
        type: type || 'buy',
        status: 'success',

        // ✅ FIX UTAMA DI SINI
        createdAt: now,
        updatedAt: now
      });

      return res.status(200).json({
        success: true,
        transactionId: tx.insertedId.toString(),
        total: finalTotal,
        tax: finalTax
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Transaction error:', err);
    return res.status(500).json({ error: err.message });
  }
}
