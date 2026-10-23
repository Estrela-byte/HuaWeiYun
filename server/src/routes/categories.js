'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../lib/auth');

const router = express.Router();
router.use(requireAuth);

/** GET /api/categories?kind=expense */
router.get('/', (req, res) => {
  const { kind } = req.query;
  const rows = kind
    ? db.prepare('SELECT * FROM categories WHERE user_id=? AND kind=? ORDER BY id').all(req.user.id, kind)
    : db.prepare('SELECT * FROM categories WHERE user_id=? ORDER BY kind, id').all(req.user.id);
  res.json({ items: rows });
});

/** POST /api/categories  { name, kind } */
router.post('/', (req, res) => {
  const { name, kind = 'expense', color } = req.body || {};
  if (!name) return res.status(400).json({ error: 'bad_request', message: 'name 必填' });
  if (!['income', 'expense'].includes(kind)) {
    return res.status(400).json({ error: 'bad_request', message: 'kind 只能是 income 或 expense' });
  }
  const exist = db.prepare('SELECT * FROM categories WHERE user_id=? AND name=?').get(req.user.id, name);
  if (exist) return res.status(409).json({ error: 'conflict', message: '分类已存在', item: exist });

  const info = db
    .prepare('INSERT INTO categories(user_id,name,kind,color) VALUES(?,?,?,?)')
    .run(req.user.id, name, kind, color || null);
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id=?').get(Number(info.lastInsertRowid)));
});

module.exports = router;
