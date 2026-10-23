'use strict';
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../lib/auth');
const metrics = require('../lib/metrics');

const router = express.Router();
router.use(requireAuth);

const curMonth = () => new Date().toISOString().slice(0, 7);

/** GET /api/analytics/overview?month=2026-06 —— 四张卡 + 环比 + 同比 */
router.get('/overview', (req, res) => {
  res.json(metrics.overview(db, req.user.id, req.query.month || curMonth()));
});

/** GET /api/analytics/trend?from=2026-01&to=2026-06 —— 营收趋势折线 */
router.get('/trend', (req, res) => {
  const to = req.query.to || curMonth();
  const from = req.query.from || metrics.shiftMonth(to, -5);
  res.json({ from, to, items: metrics.trend(db, req.user.id, from, to) });
});

/** GET /api/analytics/cost-structure?month=2026-06 —— 成本结构饼图 */
router.get('/cost-structure', (req, res) => {
  res.json(metrics.costStructure(db, req.user.id, req.query.month || curMonth()));
});

/** GET /api/analytics/product-margin —— 商品毛利条 */
router.get('/product-margin', (req, res) => {
  res.json({ items: metrics.productMargin(db, req.user.id) });
});

/** GET /api/analytics/compare?month=2026-06 —— 同环比表格 */
router.get('/compare', (req, res) => {
  const o = metrics.overview(db, req.user.id, req.query.month || curMonth());
  const rows = [
    { metric: '营业额', current: o.revenue, prev: o.prev.revenue },
    { metric: '成本', current: o.cost, prev: o.prev.cost },
    { metric: '利润', current: o.profit, prev: o.prev.profit },
  ].map((r) => ({
    ...r,
    mom: r.prev ? Number(((r.current - r.prev) / r.prev * 100).toFixed(1)) : null,
  }));
  res.json({ month: o.month, prevMonth: o.prev.month, items: rows, yoy: o.yoy });
});

module.exports = router;
