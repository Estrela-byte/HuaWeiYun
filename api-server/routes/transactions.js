// 收支流水路由：增删改查（需登录）
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { success, fail } = require('../utils/respond');
const { auth } = require('../middleware/auth');

// 所有流水接口都需登录
router.use(auth);

// 查询当前用户全部流水：GET /api/transactions
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM transactions WHERE user_id = ? ORDER BY happened_at DESC, id DESC', [req.user.id]);
    return success(res, rows, '查询成功');
  } catch (err) {
    console.error(err);
    return fail(res, '查询失败', 500);
  }
});

// 新增流水：POST /api/transactions
router.post('/', async (req, res) => {
  const { type, amount, category, note, happened_at } = req.body;
  if (type !== 'income' && type !== 'expense') {
    return fail(res, '流水类型必须为 income 或 expense');
  }
  if (amount === undefined || amount === null || Number(amount) <= 0) {
    return fail(res, '金额必须为大于 0 的数值');
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO transactions (user_id, type, amount, category, note, happened_at) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, type, amount, category || null, note || null, happened_at || null]
    );
    return success(res, { id: result.insertId }, '新增成功');
  } catch (err) {
    console.error(err);
    return fail(res, '新增失败', 500);
  }
});

// 修改流水：PUT /api/transactions/:id
router.put('/:id', async (req, res) => {
  const { type, amount, category, note, happened_at } = req.body;
  if (type !== 'income' && type !== 'expense') {
    return fail(res, '流水类型必须为 income 或 expense');
  }
  if (amount === undefined || amount === null || Number(amount) <= 0) {
    return fail(res, '金额必须为大于 0 的数值');
  }
  try {
    const [result] = await pool.query(
      'UPDATE transactions SET type = ?, amount = ?, category = ?, note = ?, happened_at = ? WHERE id = ? AND user_id = ?',
      [type, amount, category || null, note || null, happened_at || null, req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return fail(res, '流水不存在或无权操作');
    }
    return success(res, null, '修改成功');
  } catch (err) {
    console.error(err);
    return fail(res, '修改失败', 500);
  }
});

// 删除流水：DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM transactions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (result.affectedRows === 0) {
      return fail(res, '流水不存在或无权操作');
    }
    return success(res, null, '删除成功');
  } catch (err) {
    console.error(err);
    return fail(res, '删除失败', 500);
  }
});

module.exports = router;