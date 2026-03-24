const { connectToDatabase } = require('./helpers/db');
const { ObjectId } = require('mongodb');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await connectToDatabase();
    const menu = db.collection('menu');

    // GET all menu
    if (req.method === 'GET') {
      const items = await menu.find({}).toArray();
      const formatted = items.map(item => ({
        _id: item._id.toString(),
        id: item._id.toString(),
        name: item.name,
        price: item.price,
        category: item.category,
        icon: item.icon,
        stock: item.stock
      }));
      return res.status(200).json(formatted);
    }

    // POST - save/update menu array
    if (req.method === 'POST') {
      const items = req.body;

      for (const item of items) {
        const itemData = {
          name: item.name,
          price: item.price,
          category: item.category,
          icon: item.icon || '🍽️',
          stock: item.stock || 0
        };

        const rawId = item._id || item.id;
        // Only use ObjectId if it looks like a valid MongoDB ObjectId (24 hex chars)
        const isMongoId = rawId && /^[a-f\d]{24}$/i.test(String(rawId));

        if (isMongoId) {
          await menu.updateOne(
            { _id: new ObjectId(rawId) },
            { $set: itemData },
            { upsert: true }
          );
        } else {
          await menu.insertOne(itemData);
        }
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Menu error:', err);
    return res.status(500).json({ error: err.message });
  }
}
