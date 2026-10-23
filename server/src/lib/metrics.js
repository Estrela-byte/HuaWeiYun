'use strict';
/**
 * 指标计算层 —— 本项目的核心，对应 PRD「系统算数、模型解释」里的「系统算数」。
 * 所有数字都在这里算出来，大模型只负责解释，绝不让它算数。
 *
 * 口径（已与效果图数字核对）：
 *   收入   = SUM(income, 已确认)
 *   成本   = SUM(expense, 已确认)
 *   毛利   = 收入 - 成本
 *   毛利率 = 毛利 / 收入
 *   环比   = (本月 - 上月) / 上月
 *   同比   = (本月 - 去年同月) / 去年同月
 *   待归类 = status='pending' 的笔数（不计入指标）
 */
const { toYuan, pct, growth } = require('./money');

/** '2026-06' -> ['2026-06-01','2026-07-01') */
function monthRange(month) {
  const [y, m] = String(month).split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return [`${y}-${String(m).padStart(2, '0')}-01`, `${ny}-${String(nm).padStart(2, '0')}-01`];
}

/** 月份偏移：shiftMonth('2026-01', -1) -> '2025-12' */
function shiftMonth(month, delta) {
  const [y, m] = String(month).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function sumType(db, userId, from, to, type) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount_cents),0) AS s FROM transactions
        WHERE user_id=? AND status='confirmed' AND type=? AND date>=? AND date<?`
    )
    .get(userId, type, from, to);
  return Number(row.s || 0);
}

function pendingCount(db, userId, month) {
  const [from, to] = monthRange(month);
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM transactions
        WHERE user_id=? AND status='pending' AND date>=? AND date<?`
    )
    .get(userId, from, to);
  return Number(row.c || 0);
}

/** 某个月的原始指标（分） */
function monthMetrics(db, userId, month) {
  const [from, to] = monthRange(month);
  const revenue = sumType(db, userId, from, to, 'income');
  const cost = sumType(db, userId, from, to, 'expense');
  return { month, revenue, cost, profit: revenue - cost };
}

/** GET /api/analytics/overview */
function overview(db, userId, month) {
  const cur = monthMetrics(db, userId, month);
  const prev = monthMetrics(db, userId, shiftMonth(month, -1));
  const lastYear = monthMetrics(db, userId, shiftMonth(month, -12));

  const wrap = (m) => ({
    revenue: toYuan(m.revenue),
    cost: toYuan(m.cost),
    profit: toYuan(m.profit),
    margin: pct(m.profit, m.revenue),
  });

  const c = wrap(cur), p = wrap(prev), ly = wrap(lastYear);

  return {
    month,
    ...c,
    mom: {
      revenue: growth(c.revenue, p.revenue),
      cost: growth(c.cost, p.cost),
      profit: growth(c.profit, p.profit),
      margin: Number((c.margin - p.margin).toFixed(1)), // 百分点差，不是百分比
    },
    yoy: {
      revenue: growth(c.revenue, ly.revenue),
      cost: growth(c.cost, ly.cost),
      profit: growth(c.profit, ly.profit),
      margin: Number((c.margin - ly.margin).toFixed(1)),
    },
    prev: { month: prev.month, ...p },
    pendingCount: pendingCount(db, userId, month),
  };
}

/** GET /api/analytics/trend?from=2026-01&to=2026-06 */
function trend(db, userId, fromMonth, toMonth) {
  const out = [];
  let m = fromMonth;
  for (let i = 0; i < 36; i++) {
    const r = monthMetrics(db, userId, m);
    out.push({
      month: m,
      revenue: toYuan(r.revenue),
      cost: toYuan(r.cost),
      profit: toYuan(r.profit),
    });
    if (m === toMonth) break;
    m = shiftMonth(m, 1);
  }
  return out;
}

/** GET /api/analytics/cost-structure */
function costStructure(db, userId, month) {
  const [from, to] = monthRange(month);
  const rows = db
    .prepare(
      `SELECT COALESCE(c.name,'其他') AS name, SUM(t.amount_cents) AS s
         FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.user_id=? AND t.status='confirmed' AND t.type='expense'
          AND t.date>=? AND t.date<?
        GROUP BY name ORDER BY s DESC`
    )
    .all(userId, from, to);

  const total = rows.reduce((a, r) => a + Number(r.s), 0);
  return {
    month,
    total: toYuan(total),
    items: rows.map((r) => ({
      name: r.name,
      amount: toYuan(r.s),
      ratio: pct(Number(r.s), total),
    })),
  };
}

/** GET /api/analytics/product-margin */
function productMargin(db, userId) {
  const rows = db.prepare(`SELECT * FROM products WHERE user_id=? ORDER BY id`).all(userId);
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    price: toYuan(p.price_cents),
    cost: toYuan(p.cost_cents),
    margin: pct(p.price_cents - p.cost_cents, p.price_cents),
  }));
}

/** 分类级环比 —— 用于「原材料成本上涨 12%」这类归因（不是总成本） */
function categorySeries(db, userId, month, prevMonth) {
  const one = (m) => {
    const [from, to] = monthRange(m);
    const rows = db
      .prepare(
        `SELECT COALESCE(c.name,'其他') AS name, SUM(t.amount_cents) AS s
           FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
          WHERE t.user_id=? AND t.status='confirmed' AND t.type='expense'
            AND t.date>=? AND t.date<?
          GROUP BY name`
      )
      .all(userId, from, to);
    return Object.fromEntries(rows.map((r) => [r.name, Number(r.s)]));
  };
  const cur = one(month);
  const prev = one(prevMonth);
  const names = [...new Set([...Object.keys(cur), ...Object.keys(prev)])];
  return names
    .map((n) => ({
      name: n,
      current: toYuan(cur[n] || 0),
      prev: toYuan(prev[n] || 0),
      mom: growth(cur[n] || 0, prev[n] || 0),
    }))
    .sort((a, b) => b.current - a.current);
}

module.exports = {
  monthRange, shiftMonth, monthMetrics, overview, trend, costStructure, productMargin,
  pendingCount, categorySeries,
};
