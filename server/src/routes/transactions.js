'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../lib/auth');
const { toCents, toYuan } = require('../lib/money');
const { monthRange, pendingCount } = require('../lib/metrics');

const router = express.Router();
router.use(requireAuth);

const rowToApi = (r) => ({
  id: r.id,
  date: r.date,
  type: r.type,
  amount: toYuan(r.amount_cents),
  category: r.category_name || null,
  categoryId: r.category_id,
  summary: r.summary,
  note: r.note,
  source: r.source,
  status: r.status,
});

/* ⚠️ 注意顺序：具体路径必须写在 /:id 前面，否则 'summary' 会被当成 id */

/** GET /api/transactions/summary?month=2026-06 —— 记账管理页顶部四张卡 */
router.get('/summary', (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const [from, to] = monthRange(month);
  const base = `FROM transactions WHERE user_id=? AND status='confirmed' AND date>=? AND date<?`;
  const inc = db.prepare(`SELECT COALESCE(SUM(amount_cents),0) s ${base} AND type='income'`).get(req.user.id, from, to);
  const exp = db.prepare(`SELECT COALESCE(SUM(amount_cents),0) s ${base} AND type='expense'`).get(req.user.id, from, to);

  const revenue = Number(inc.s), cost = Number(exp.s);
  res.json({
    month,
    revenue: toYuan(revenue),
    cost: toYuan(cost),
    profit: toYuan(revenue - cost),
    margin: revenue ? Number(((revenue - cost) / revenue * 100).toFixed(1)) : 0,
    pendingCount: pendingCount(db, req.user.id, month),
  });
});

/** GET /api/transactions/pending —— 待确认列表 */
router.get('/pending', (req, res) => {
  const limit = Math.min(Number(req.query.size) || 50, 200);
  const rows = db
    .prepare(
      `SELECT t.*, c.name AS category_name FROM transactions t
         LEFT JOIN categories c ON c.id=t.category_id
        WHERE t.user_id=? AND t.status='pending'
        ORDER BY t.date DESC, t.id DESC LIMIT ?`
    )
    .all(req.user.id, limit);
  res.json({ items: rows.map(rowToApi) });
});

/** GET /api/transactions?month=&type=&category=&source=&page=&size= */
router.get('/', (req, res) => {
  const { month, type, category, source } = req.query;
  const page = Math.max(Number(req.query.page) || 1, 1);
  const size = Math.min(Math.max(Number(req.query.size) || 20, 1), 200);

  const where = ['t.user_id=?'];
  const args = [req.user.id];
  // 默认只返回已确认的记录；?status=all 看全部，?status=pending 看待确认
  const status = req.query.status || 'confirmed';
  if (status !== 'all') { where.push('t.status=?'); args.push(status); }
  if (month) { const [f, t] = monthRange(month); where.push('t.date>=?', 't.date<?'); args.push(f, t); }
  if (type) { where.push('t.type=?'); args.push(type); }
  if (source) { where.push('t.source=?'); args.push(source); }
  if (category) { where.push('c.name=?'); args.push(category); }

  const w = where.join(' AND ');
  const total = Number(
    db.prepare(`SELECT COUNT(*) c FROM transactions t LEFT JOIN categories c ON c.id=t.category_id WHERE ${w}`).get(...args).c
  );
  const rows = db
    .prepare(
      `SELECT t.*, c.name AS category_name FROM transactions t
         LEFT JOIN categories c ON c.id=t.category_id
        WHERE ${w} ORDER BY t.date DESC, t.id DESC LIMIT ? OFFSET ?`
    )
    .all(...args, size, (page - 1) * size);

  res.json({ items: rows.map(rowToApi), total, page, size });
});

/** POST /api/transactions —— 手工录入 */
router.post('/', (req, res) => {
  const { date, type, amount, category, summary, note, source } = req.body || {};
  if (!date || !type || amount === undefined) {
    return res.status(400).json({ error: 'bad_request', message: 'date / type / amount 必填' });
  }
  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: 'bad_request', message: 'type 只能是 income 或 expense' });
  }

  let categoryId = null;
  if (category) {
    const c = db.prepare('SELECT id FROM categories WHERE user_id=? AND name=?').get(req.user.id, category);
    categoryId = c ? c.id : null;
    if (!categoryId) {
      const info = db.prepare('INSERT INTO categories(user_id,name,kind) VALUES(?,?,?)').run(req.user.id, category, type);
      categoryId = Number(info.lastInsertRowid);
    }
  }

  const info = db
    .prepare(
      `INSERT INTO transactions(user_id,date,type,amount_cents,category_id,summary,note,source,status)
       VALUES(?,?,?,?,?,?,?,?,'confirmed')`
    )
    .run(req.user.id, date, type, toCents(amount), categoryId, summary || null, note || null, source || 'manual');

  const row = db.prepare('SELECT * FROM transactions WHERE id=?').get(Number(info.lastInsertRowid));
  res.status(201).json(rowToApi(row));
});

/** POST /api/transactions/:id/confirm —— 人工确认归类 */
router.post('/:id/confirm', (req, res) => {
  const id = Number(req.params.id);
  const { category } = req.body || {};
  const row = db.prepare('SELECT * FROM transactions WHERE id=? AND user_id=?').get(id, req.user.id);
  if (!row) return res.status(404).json({ error: 'not_found' });

  let categoryId = row.category_id;
  if (category) {
    let c = db.prepare('SELECT id FROM categories WHERE user_id=? AND name=?').get(req.user.id, category);
    if (!c) {
      const info = db.prepare('INSERT INTO categories(user_id,name,kind) VALUES(?,?,?)').run(req.user.id, category, row.type);
      categoryId = Number(info.lastInsertRowid);
    } else categoryId = c.id;
  }
  db.prepare(`UPDATE transactions SET status='confirmed', category_id=? WHERE id=?`).run(categoryId, id);
  const updated = db.prepare('SELECT * FROM transactions WHERE id=?').get(id);
  res.json(rowToApi(updated));
});

/** PUT /api/transactions/:id */
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM transactions WHERE id=? AND user_id=?').get(id, req.user.id);
  if (!row) return res.status(404).json({ error: 'not_found' });

  const { date, type, amount, summary, note } = req.body || {};
  db.prepare(
    `UPDATE transactions SET date=?, type=?, amount_cents=?, summary=?, note=? WHERE id=?`
  ).run(
    date ?? row.date,
    type ?? row.type,
    amount !== undefined ? toCents(amount) : row.amount_cents,
    summary ?? row.summary,
    note ?? row.note,
    id
  );
  res.json(rowToApi(db.prepare('SELECT * FROM transactions WHERE id=?').get(id)));
});

/** DELETE /api/transactions/:id */
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare('DELETE FROM transactions WHERE id=? AND user_id=?').run(id, req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true, deleted: id });
});

module.exports = router;
