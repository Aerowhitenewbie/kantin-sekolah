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

    // GET all transactions
    if (req.method === 'GET') {
      const txs = await transactions.find({}).sort({ _id: -1 }).toArray();
      const formatted = txs.map(t => ({
        _id: t._id.toString(),
        userId: t.userId?.toString(),
        user: t.user,
        userName: t.user,        // alias for frontend compatibility
        kelas: t.kelas,
        items: t.items,
        subtotal: t.subtotal,
        tax: t.tax || 0,
        total: t.total,
        type: t.type,
        date: t.date,
        status: t.status
      }));
      return res.status(200).json(formatted);
    }

    // POST - checkout or bulk import
    if (req.method === 'POST') {
      const body = req.body;

      // Bulk import
      if (body.action === 'bulkImport' && Array.isArray(body.data)) {
        await transactions.insertMany(body.data);
        return res.status(200).json({ success: true });
      }

      // Normal checkout
      const { userId, items, subtotal, tax, total, type } = body;

      const user = await users.findOne({ _id: new ObjectId(userId) });
      if (!user) return res.status(404).json({ error: 'User not found' });

      const isGuest = user.kelas === 'guest';
      const finalTax   = isGuest ? Math.round(subtotal * 0.10) : (tax || 0);
      const finalTotal = subtotal + finalTax;

      if (user.saldo < finalTotal) {
        return res.status(400).json({ error: 'Saldo tidak cukup' });
      }

      // Kurangi stok
      for (const item of items) {
        const isMongoId = item.id && /^[a-f\d]{24}$/i.test(String(item.id));
        if (isMongoId) {
          await menu.updateOne({ _id: new ObjectId(item.id) }, { $inc: { stock: -item.qty } });
        }
      }

      // Kurangi saldo
      await users.updateOne({ _id: new ObjectId(userId) }, { $inc: { saldo: -finalTotal } });

      // Simpan transaksi
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
        date: new Date().toLocaleString('id-ID'),
        status: 'success'
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
