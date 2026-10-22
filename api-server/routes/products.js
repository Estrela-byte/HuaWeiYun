// 商品路由：增删改查（需登录）
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { success, fail } = require('../utils/respond');
const { auth } = require('../middleware/auth');

// 所有商品接口都需登录
router.use(auth);

// 查询当前用户全部商品：GET /api/products
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
    return success(res, rows, '查询成功');
  } catch (err) {
    console.error(err);
    return fail(res, '查询失败', 500);
  }
});

// 新增商品：POST /api/products
router.post('/', async (req, res) => {
  const { name, unit, purchase_price, sell_price, stock_qty, remark } = req.body;
  if (!name) {
    return fail(res, '商品名称不能为空');
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO products (user_id, name, unit, purchase_price, sell_price, stock_qty, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, name, unit || null, purchase_price || 0, sell_price || 0, stock_qty || 0, remark || null]
    );
    return success(res, { id: result.insertId }, '新增成功');
  } catch (err) {
    console.error(err);
    return fail(res, '新增失败', 500);
  }
});

// 修改商品：PUT /api/products/:id
router.put('/:id', async (req, res) => {
  const { name, unit, purchase_price, sell_price, stock_qty, remark } = req.body;
  try {
    const [result] = await pool.query(
      'UPDATE products SET name = ?, unit = ?, purchase_price = ?, sell_price = ?, stock_qty = ?, remark = ? WHERE id = ? AND user_id = ?',
      [name, unit || null, purchase_price || 0, sell_price || 0, stock_qty || 0, remark || null, req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return fail(res, '商品不存在或无权操作');
    }
    return success(res, null, '修改成功');
  } catch (err) {
    console.error(err);
    return fail(res, '修改失败', 500);
  }
});

// 删除商品：DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM products WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (result.affectedRows === 0) {
      return fail(res, '商品不存在或无权操作');
    }
    return success(res, null, '删除成功');
  } catch (err) {
    console.error(err);
    return fail(res, '删除失败', 500);
  }
});

module.exports = router;