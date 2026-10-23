// 预警提醒路由：阈值查询/保存、预警检查、预警记录列表/状态更新（需登录）
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { success, fail } = require('../utils/respond');
const { auth } = require('../middleware/auth');
const { monthToRange, currentMonth } = require('../utils/monthRange');

router.use(auth);

const DEFAULT_THRESHOLDS = { costRatio: 70, incomeDrop: 30, profitMin: 0 };

// 阈值查询：GET /api/alerts/threshold
router.get('/threshold', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM alert_thresholds WHERE user_id = ?', [req.user.id]);
    if (rows.length === 0) {
      return success(res, DEFAULT_THRESHOLDS, '查询成功');
    }
    const r = rows[0];
    return success(res, {
      costRatio: Number(r.cost_ratio_threshold),
      incomeDrop: Number(r.income_drop_threshold),
      profitMin: Number(r.profit_min_threshold)
    }, '查询成功');
  } catch (err) {
    console.error(err);
    return fail(res, '查询失败', 500);
  }
});

// 阈值保存：PUT /api/alerts/threshold
router.put('/threshold', async (req, res) => {
  const { costRatio, incomeDrop, profitMin } = req.body;
  if (costRatio < 0 || costRatio > 100 || incomeDrop < 0 || incomeDrop > 100 || profitMin < 0) {
    return fail(res, '阈值必须为非负数值且占比类阈值不超过100');
  }
  try {
    await pool.query(
      `INSERT INTO alert_thresholds (user_id, cost_ratio_threshold, income_drop_threshold, profit_min_threshold)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE cost_ratio_threshold = VALUES(cost_ratio_threshold), income_drop_threshold = VALUES(income_drop_threshold), profit_min_threshold = VALUES(profit_min_threshold)`,
      [req.user.id, costRatio, incomeDrop, profitMin]
    );
    return success(res, null, '保存成功');
  } catch (err) {
    console.error(err);
    return fail(res, '保存失败', 500);
  }
});

// 预警检查：POST /api/alerts/check
router.post('/check', async (req, res) => {
  try {
    const [thresholdRows] = await pool.query('SELECT * FROM alert_thresholds WHERE user_id = ?', [req.user.id]);
    const thresholds = thresholdRows.length > 0 ? {
      costRatio: Number(thresholdRows[0].cost_ratio_threshold),
      incomeDrop: Number(thresholdRows[0].income_drop_threshold),
      profitMin: Number(thresholdRows[0].profit_min_threshold)
    } : DEFAULT_THRESHOLDS;

    const month = currentMonth();
    const range = monthToRange(month);
    const [year, mon] = month.split('-').map(Number);
    const prevMon = mon === 1 ? 12 : mon - 1;
    const prevYear = mon === 1 ? year - 1 : year;
    const prevMonthStr = `${prevYear}-${String(prevMon).padStart(2, '0')}`;
    const prevRange = monthToRange(prevMonthStr);

    const [curInc] = await pool.query('SELECT SUM(amount) AS total FROM transactions WHERE user_id = ? AND type = ? AND happened_at >= ? AND happened_at < ?', [req.user.id, 'income', range.start, range.end]);
    const [curExp] = await pool.query('SELECT SUM(amount) AS total FROM transactions WHERE user_id = ? AND type = ? AND happened_at >= ? AND happened_at < ?', [req.user.id, 'expense', range.start, range.end]);
    const [prevInc] = await pool.query('SELECT SUM(amount) AS total FROM transactions WHERE user_id = ? AND type = ? AND happened_at >= ? AND happened_at < ?', [req.user.id, 'income', prevRange.start, prevRange.end]);

    const revenue = Number(curInc[0].total) || 0;
    const cost = Number(curExp[0].total) || 0;
    const prevRevenue = Number(prevInc[0].total) || 0;
    const profit = revenue - cost;

    const alerts = [];

    if (revenue === 0 && cost === 0) {
      alerts.push({ type: 'no_transaction', title: '本月无流水', content: `本月(${month})没有任何收支记录，可能漏记` });
    }
    if (revenue > 0 && (cost / revenue * 100) > thresholds.costRatio) {
      alerts.push({ type: 'cost_ratio', title: '成本占比超标', content: `本月成本占比 ${(cost / revenue * 100).toFixed(1)}%，超过阈值 ${thresholds.costRatio}%` });
    }
    if (prevRevenue > 0 && ((prevRevenue - revenue) / prevRevenue * 100) > thresholds.incomeDrop) {
      alerts.push({ type: 'income_drop', title: '营业额下降', content: `本月营业额 ${revenue}，较上月 ${prevRevenue} 下降 ${((prevRevenue - revenue) / prevRevenue * 100).toFixed(1)}%` });
    }
    if (profit < thresholds.profitMin) {
      alerts.push({ type: 'profit_low', title: '毛利低于下限', content: `本月毛利 ${profit}，低于下限 ${thresholds.profitMin}` });
    }

    if (alerts.length > 0) {
      const values = alerts.map(a => [req.user.id, a.type, a.title, a.content]);
      await pool.query('INSERT INTO alert_records (user_id, type, title, content) VALUES ?', [values]);
    }

    return success(res, alerts, '检查完成');
  } catch (err) {
    console.error(err);
    return fail(res, '检查失败', 500);
  }
});

// 预警记录列表：GET /api/alerts/records
router.get('/records', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM alert_records WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    return success(res, rows, '查询成功');
  } catch (err) {
    console.error(err);
    return fail(res, '查询失败', 500);
  }
});

// 预警状态更新：PUT /api/alerts/records/:id/status
router.put('/records/:id/status', async (req, res) => {
  const { status } = req.body;
  if (status !== 'pending' && status !== 'ignored') {
    return fail(res, '预警状态不合法');
  }
  try {
    const [result] = await pool.query('UPDATE alert_records SET status = ? WHERE id = ? AND user_id = ?', [status, req.params.id, req.user.id]);
    if (result.affectedRows === 0) {
      return fail(res, '预警记录不存在或无权操作');
    }
    return success(res, null, '更新成功');
  } catch (err) {
    console.error(err);
    return fail(res, '更新失败', 500);
  }
});

module.exports = router;