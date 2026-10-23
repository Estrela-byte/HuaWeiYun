'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../lib/auth');
const { toCents, toYuan, pct } = require('../lib/money');

const router = express.Router();
router.use(requireAuth);

const api = (p) => ({
  id: p.id,
  name: p.name,
  price: toYuan(p.price_cents),
  cost: toYuan(p.cost_cents),
  margin: pct(p.price_cents - p.cost_cents, p.price_cents),
});

/** GET /api/products */
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM products WHERE user_id=? ORDER BY id').all(req.user.id);
  res.json({ items: rows.map(api) });
});

/** POST /api/products  { name, price, cost } */
router.post('/', (req, res) => {
  const { name, price, cost } = req.body || {};
  if (!name || price === undefined || cost === undefined) {
    return res.status(400).json({ error: 'bad_request', message: 'name / price / cost 必填' });
  }
  const info = db
    .prepare('INSERT INTO products(user_id,name,price_cents,cost_cents) VALUES(?,?,?,?)')
    .run(req.user.id, name, toCents(price), toCents(cost));
  res.status(201).json(api(db.prepare('SELECT * FROM products WHERE id=?').get(Number(info.lastInsertRowid))));
});

/** PUT /api/products/:id */
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM products WHERE id=? AND user_id=?').get(id, req.user.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  const { name, price, cost } = req.body || {};
  db.prepare('UPDATE products SET name=?, price_cents=?, cost_cents=? WHERE id=?').run(
    name ?? row.name,
    price !== undefined ? toCents(price) : row.price_cents,
    cost !== undefined ? toCents(cost) : row.cost_cents,
    id
  );
  res.json(api(db.prepare('SELECT * FROM products WHERE id=?').get(id)));
});

/** DELETE /api/products/:id */
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id=? AND user_id=?').run(Number(req.params.id), req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

module.exports = router;
