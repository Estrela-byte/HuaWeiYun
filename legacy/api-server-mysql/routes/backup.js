// 数据备份路由：触发备份、备份记录列表（需登录）
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { success, fail } = require('../utils/respond');
const { auth } = require('../middleware/auth');

router.use(auth);

function timestamp() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
}

// 触发备份：POST /api/backup
router.post('/', async (req, res) => {
  try {
    const fileName = `backup_${req.user.id}_${timestamp()}.json`;
    const [result] = await pool.query('INSERT INTO backup_records (user_id, file_name) VALUES (?, ?)', [req.user.id, fileName]);
    return success(res, { id: result.insertId, backupTime: new Date().toISOString(), fileName }, '备份成功');
  } catch (err) {
    console.error(err);
    return fail(res, '备份失败', 500);
  }
});

// 备份记录列表：GET /api/backup/records
router.get('/records', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, backup_time AS backupTime, file_name AS fileName FROM backup_records WHERE user_id = ? ORDER BY backup_time DESC', [req.user.id]);
    return success(res, rows, '查询成功');
  } catch (err) {
    console.error(err);
    return fail(res, '查询失败', 500);
  }
});

module.exports = router;