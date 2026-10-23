'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../lib/auth');

const router = express.Router();
router.use(requireAuth);

/** GET /api/alerts —— 预警列表（?status=open） */
router.get('/', (req, res) => {
  const status = req.query.status || 'open';
  const rows = db
    .prepare('SELECT * FROM alerts WHERE user_id=? AND status=? ORDER BY CASE level WHEN \'high\' THEN 0 WHEN \'medium\' THEN 1 ELSE 2 END, id DESC')
    .all(req.user.id, status);
  const open = Number(db.prepare(`SELECT COUNT(*) c FROM alerts WHERE user_id=? AND status='open'`).get(req.user.id).c);
  res.json({ items: rows, openCount: open });
});

/** GET /api/alerts/settings —— ⚠️ 必须写在 /:id 之前 */
router.get('/settings', (req, res) => {
  const s = db.prepare('SELECT * FROM alert_settings WHERE user_id=?').get(req.user.id);
  res.json(s || { user_id: req.user.id, cost_ratio: 40, revenue_volatility: 5, margin_floor: 30 });
});

/** PUT /api/alerts/settings  { cost_ratio, revenue_volatility, margin_floor } */
router.put('/settings', (req, res) => {
  const { cost_ratio, revenue_volatility, margin_floor } = req.body || {};
  const cur = db.prepare('SELECT * FROM alert_settings WHERE user_id=?').get(req.user.id);
  if (!cur) {
    db.prepare('INSERT INTO alert_settings(user_id,cost_ratio,revenue_volatility,margin_floor) VALUES(?,?,?,?)')
      .run(req.user.id, cost_ratio ?? 40, revenue_volatility ?? 5, margin_floor ?? 30);
  } else {
    db.prepare('UPDATE alert_settings SET cost_ratio=?, revenue_volatility=?, margin_floor=? WHERE user_id=?')
      .run(cost_ratio ?? cur.cost_ratio, revenue_volatility ?? cur.revenue_volatility, margin_floor ?? cur.margin_floor, req.user.id);
  }
  res.json(db.prepare('SELECT * FROM alert_settings WHERE user_id=?').get(req.user.id));
});

/** POST /api/alerts/:id/ignore */
router.post('/:id/ignore', (req, res) => {
  const info = db.prepare(`UPDATE alerts SET status='ignored' WHERE id=? AND user_id=?`).run(Number(req.params.id), req.user.id);
  if (!info.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

/** GET /api/alerts/unread-count —— 侧边栏小红点 */
router.get('/unread-count', (req, res) => {
  const c = Number(db.prepare(`SELECT COUNT(*) c FROM alerts WHERE user_id=? AND status='open'`).get(req.user.id).c);
  res.json({ count: c });
});

module.exports = router;
