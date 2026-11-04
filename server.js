'use strict';
const express = require('express');
const path = require('path');
const products = require('./products.json');
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const productById = new Map(products.map(product => [product.id, product]));

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'Aduz Model Kart' }));
app.get('/api/products', (req, res) => {
  const query = String(req.query.search || '').trim().toLocaleLowerCase();
  const category = String(req.query.category || 'All');
  const allowedCategories = new Set(['All', ...new Set(products.map(p => p.category))]);
  if (!allowedCategories.has(category)) return res.status(400).json({ error: 'Invalid category.' });
  const result = products.filter(p => {
    const matchesCategory = category === 'All' || p.category === category;
    const matchesSearch = !query || `${p.name} ${p.desc} ${p.tag}`.toLocaleLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });
  res.set('Cache-Control', 'public, max-age=60');
  res.json(result);
});

// Demonstration COD checkout. Prices are always recalculated from server data.
app.post('/api/checkout', (req, res) => {
  const { name, phone, address, cart } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    return res.status(400).json({ success: false, error: 'Enter a valid student name.' });
  }
  if (typeof phone !== 'string' || !/^\d{10}$/.test(phone)) {
    return res.status(400).json({ success: false, error: 'Enter a valid 10-digit phone number.' });
  }
  if (typeof address !== 'string' || address.trim().length < 8 || address.trim().length > 500) {
    return res.status(400).json({ success: false, error: 'Enter a complete delivery address.' });
  }
  if (!Array.isArray(cart) || cart.length < 1 || cart.length > 30) {
    return res.status(400).json({ success: false, error: 'Your cart is empty or invalid.' });
  }
  const items = [];
  for (const entry of cart) {
    const product = productById.get(Number(entry && entry.id));
    const quantity = Number(entry && entry.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return res.status(400).json({ success: false, error: 'One or more cart items are invalid.' });
    }
    items.push({ id: product.id, name: product.name, price: product.price, quantity });
  }
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const orderId = `AMK-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  console.log('[DEMO ORDER]', JSON.stringify({ orderId, name: name.trim(), phone, items, total }));
  return res.status(201).json({ success: true, orderId, total, message: 'Demo order recorded by the server.' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'Unexpected server error.' });
});
app.listen(PORT, () => console.log(`Aduz Model Kart running at http://localhost:${PORT}`));
