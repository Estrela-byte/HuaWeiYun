// 经营汇总路由：统计当前用户的总收入、总支出、净利润、商品数、流水数（需登录）
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { success, fail } = require('../utils/respond');
const { auth } = require('../middleware/auth');

router.use(auth);

// 汇总查询：GET /api/summary
router.get('/', async (req, res) => {
  try {
    const [incomeRows] = await pool.query(
      'SELECT SUM(amount) AS total FROM transactions WHERE user_id = ? AND type = ?',
      [req.user.id, 'income']
    );
    const [expenseRows] = await pool.query(
      'SELECT SUM(amount) AS total FROM transactions WHERE user_id = ? AND type = ?',
      [req.user.id, 'expense']
    );
    const [productRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM products WHERE user_id = ?',
      [req.user.id]
    );
    const [transactionRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM transactions WHERE user_id = ?',
      [req.user.id]
    );

    const totalIncome = Number(incomeRows[0].total) || 0;
    const totalExpense = Number(expenseRows[0].total) || 0;
    const netProfit = totalIncome - totalExpense;
    const productCount = productRows[0].total;
    const transactionCount = transactionRows[0].total;

    return success(res, { totalIncome, totalExpense, netProfit, productCount, transactionCount }, '查询成功');
  } catch (err) {
    console.error(err);
    return fail(res, '查询失败', 500);
  }
});

// 月度汇总查询：GET /api/summary/monthly?month=YYYY-MM
router.get('/monthly', async (req, res) => {
  const month = req.query.month;
  if (!month) {
    return fail(res, '月份参数缺失');
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return fail(res, '月份参数格式错误，应为 YYYY-MM');
  }
  const [year, mon] = month.split('-').map(Number);
  const startDate = `${year}-${String(mon).padStart(2, '0')}-01 00:00:00`;
  const nextYear = mon === 12 ? year + 1 : year;
  const nextMonth = mon === 12 ? 1 : mon + 1;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01 00:00:00`;
  try {
    const [incomeRows] = await pool.query(
      'SELECT SUM(amount) AS total FROM transactions WHERE user_id = ? AND type = ? AND happened_at >= ? AND happened_at < ?',
      [req.user.id, 'income', startDate, endDate]
    );
    const [expenseRows] = await pool.query(
      'SELECT SUM(amount) AS total FROM transactions WHERE user_id = ? AND type = ? AND happened_at >= ? AND happened_at < ?',
      [req.user.id, 'expense', startDate, endDate]
    );
    const totalIncome = Number(incomeRows[0].total) || 0;
    const totalExpense = Number(expenseRows[0].total) || 0;
    return success(res, { totalIncome, totalExpense }, '查询成功');
  } catch (err) {
    console.error(err);
    return fail(res, '查询失败', 500);
  }
});

module.exports = router;