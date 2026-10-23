// 成员管理路由：成员列表、邀请成员、编辑角色、移除成员（需登录）
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { success, fail } = require('../utils/respond');
const { auth } = require('../middleware/auth');

router.use(auth);

// 成员列表：GET /api/members
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT m.id, m.member_user_id AS userId, u.username, m.role, m.created_at AS createdAt FROM members m JOIN users u ON m.member_user_id = u.id WHERE m.owner_id = ? ORDER BY m.id DESC',
      [req.user.id]
    );
    return success(res, rows, '查询成功');
  } catch (err) {
    console.error(err);
    return fail(res, '查询失败', 500);
  }
});

// 邀请成员：POST /api/members
router.post('/', async (req, res) => {
  const { username, role } = req.body;
  if (role !== 'boss' && role !== 'staff') {
    return fail(res, '角色必须为 boss 或 staff');
  }
  try {
    const [userRows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (userRows.length === 0) {
      return fail(res, '用户不存在');
    }
    const memberUserId = userRows[0].id;
    if (memberUserId === req.user.id) {
      return fail(res, '不能邀请自己');
    }
    try {
      await pool.query('INSERT INTO members (owner_id, member_user_id, role) VALUES (?, ?, ?)', [req.user.id, memberUserId, role]);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        return fail(res, '该用户已是店铺成员');
      }
      throw e;
    }
    return success(res, null, '邀请成功');
  } catch (err) {
    console.error(err);
    return fail(res, '邀请失败', 500);
  }
});

// 编辑角色：PUT /api/members/:id
router.put('/:id', async (req, res) => {
  const { role } = req.body;
  if (role !== 'boss' && role !== 'staff') {
    return fail(res, '角色必须为 boss 或 staff');
  }
  try {
    const [result] = await pool.query('UPDATE members SET role = ? WHERE id = ? AND owner_id = ?', [role, req.params.id, req.user.id]);
    if (result.affectedRows === 0) {
      return fail(res, '成员不存在或无权操作');
    }
    return success(res, null, '修改成功');
  } catch (err) {
    console.error(err);
    return fail(res, '修改失败', 500);
  }
});

// 移除成员：DELETE /api/members/:id
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM members WHERE id = ? AND owner_id = ?', [req.params.id, req.user.id]);
    if (result.affectedRows === 0) {
      return fail(res, '成员不存在或无权操作');
    }
    return success(res, null, '删除成功');
  } catch (err) {
    console.error(err);
    return fail(res, '删除失败', 500);
  }
});

module.exports = router;