// 经营分析路由：KPI看板、营收趋势、成本结构分析（需登录）
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { success, fail } = require('../utils/respond');
const { auth } = require('../middleware/auth');
const { monthToRange, last12Months, currentMonth } = require('../utils/monthRange');

router.use(auth);

async function getMonthSummary(userId, start, end) {
  const [incomeRows] = await pool.query(
    'SELECT SUM(amount) AS total FROM transactions WHERE user_id = ? AND type = ? AND happened_at >= ? AND happened_at < ?',
    [userId, 'income', start, end]
  );
  const [expenseRows] = await pool.query(
    'SELECT SUM(amount) AS total FROM transactions WHERE user_id = ? AND type = ? AND happened_at >= ? AND happened_at < ?',
    [userId, 'expense', start, end]
  );
  return {
    income: Number(incomeRows[0].total) || 0,
    expense: Number(expenseRows[0].total) || 0
  };
}

function calcRate(current, compare) {
  if (compare === 0) return 0;
  return Math.round(((current - compare) / compare) * 10000) / 100;
}

// KPI看板：GET /api/analysis/kpi?month=YYYY-MM
router.get('/kpi', async (req, res) => {
  const month = req.query.month || currentMonth();
  const range = monthToRange(month);
  if (!range) {
    return fail(res, '月份参数格式错误，应为 YYYY-MM');
  }
  try {
    const [year, mon] = month.split('-').map(Number);
    const yoyMonth = `${year - 1}-${String(mon).padStart(2, '0')}`;
    const prevMon = mon === 1 ? 12 : mon - 1;
    const prevYear = mon === 1 ? year - 1 : year;
    const momMonth = `${prevYear}-${String(prevMon).padStart(2, '0')}`;

    const cur = await getMonthSummary(req.user.id, range.start, range.end);
    const yoy = await getMonthSummary(req.user.id, monthToRange(yoyMonth).start, monthToRange(yoyMonth).end);
    const mom = await getMonthSummary(req.user.id, monthToRange(momMonth).start, monthToRange(momMonth).end);

    const revenue = cur.income;
    const cost = cur.expense;
    const profit = revenue - cost;
    const profitRate = revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0;

    return success(res, {
      revenue, cost, profit, profitRate,
      yoy: {
        revenue: calcRate(revenue, yoy.income),
        cost: calcRate(cost, yoy.expense),
        profit: calcRate(profit, yoy.income - yoy.expense)
      },
      mom: {
        revenue: calcRate(revenue, mom.income),
        cost: calcRate(cost, mom.expense),
        profit: calcRate(profit, mom.income - mom.expense)
      }
    }, '查询成功');
  } catch (err) {
    console.error(err);
    return fail(res, '查询失败', 500);
  }
});

// 营收趋势：GET /api/analysis/trend
router.get('/trend', async (req, res) => {
  try {
    const months = last12Months();
    const result = [];
    for (const m of months) {
      const range = monthToRange(m);
      const summary = await getMonthSummary(req.user.id, range.start, range.end);
      result.push({
        month: m,
        revenue: summary.income,
        cost: summary.expense,
        profit: summary.income - summary.expense
      });
    }
    return success(res, result, '查询成功');
  } catch (err) {
    console.error(err);
    return fail(res, '查询失败', 500);
  }
});

// 成本结构分析：GET /api/analysis/cost-structure?month=YYYY-MM
router.get('/cost-structure', async (req, res) => {
  const month = req.query.month || currentMonth();
  const range = monthToRange(month);
  if (!range) {
    return fail(res, '月份参数格式错误，应为 YYYY-MM');
  }
  try {
    const [rows] = await pool.query(
      'SELECT category, SUM(amount) AS total FROM transactions WHERE user_id = ? AND type = ? AND happened_at >= ? AND happened_at < ? GROUP BY category',
      [req.user.id, 'expense', range.start, range.end]
    );
    const totalExpense = rows.reduce((sum, r) => sum + Number(r.total), 0);
    const data = rows.map(r => ({
      category: r.category || '未分类',
      amount: Number(r.total),
      ratio: totalExpense > 0 ? Math.round((Number(r.total) / totalExpense) * 10000) / 100 : 0
    }));
    return success(res, data, '查询成功');
  } catch (err) {
    console.error(err);
    return fail(res, '查询失败', 500);
  }
});

module.exports = router;