// 数据导出路由：导出Excel、导出PDF（需登录）
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { fail } = require('../utils/respond');
const { auth } = require('../middleware/auth');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

router.use(auth);

function timestamp() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
}

// 导出Excel：GET /api/export/excel
router.get('/excel', async (req, res) => {
  try {
    const [products] = await pool.query('SELECT id, name, unit, purchase_price, sell_price, stock_qty, remark FROM products WHERE user_id = ?', [req.user.id]);
    const [transactions] = await pool.query('SELECT id, type, amount, category, note, happened_at FROM transactions WHERE user_id = ? ORDER BY happened_at DESC', [req.user.id]);

    const workbook = new ExcelJS.Workbook();
    const productSheet = workbook.addWorksheet('商品');
    productSheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: '名称', key: 'name', width: 20 },
      { header: '单位', key: 'unit', width: 10 },
      { header: '进价', key: 'purchase_price', width: 12 },
      { header: '售价', key: 'sell_price', width: 12 },
      { header: '库存', key: 'stock_qty', width: 12 },
      { header: '备注', key: 'remark', width: 20 }
    ];
    products.forEach(p => productSheet.addRow(p));

    const txnSheet = workbook.addWorksheet('流水');
    txnSheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: '类型', key: 'type', width: 10 },
      { header: '金额', key: 'amount', width: 12 },
      { header: '分类', key: 'category', width: 15 },
      { header: '备注', key: 'note', width: 20 },
      { header: '发生时间', key: 'happened_at', width: 22 }
    ];
    transactions.forEach(t => txnSheet.addRow(t));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="data_${req.user.id}_${timestamp()}.xlsx"`);
    await workbook.xlsx.write(res);
  } catch (err) {
    console.error(err);
    return fail(res, '导出失败，请重试');
  }
});

// 导出PDF：GET /api/export/pdf
router.get('/pdf', async (req, res) => {
  try {
    const [incomeRows] = await pool.query('SELECT SUM(amount) AS total FROM transactions WHERE user_id = ? AND type = ?', [req.user.id, 'income']);
    const [expenseRows] = await pool.query('SELECT SUM(amount) AS total FROM transactions WHERE user_id = ? AND type = ?', [req.user.id, 'expense']);
    const [transactions] = await pool.query('SELECT * FROM transactions WHERE user_id = ? ORDER BY happened_at DESC LIMIT 50', [req.user.id]);

    const totalIncome = Number(incomeRows[0].total) || 0;
    const totalExpense = Number(expenseRows[0].total) || 0;
    const netProfit = totalIncome - totalExpense;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="summary_${req.user.id}_${timestamp()}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);
    doc.fontSize(20).text('经营汇总报告', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`总收入：¥${totalIncome}`);
    doc.text(`总支出：¥${totalExpense}`);
    doc.text(`净利润：¥${netProfit}`);
    doc.moveDown();
    doc.fontSize(14).text('流水明细（最近50条）');
    doc.moveDown();
    doc.fontSize(9);
    transactions.forEach(t => {
      const time = t.happened_at ? new Date(t.happened_at).toLocaleString('zh-CN') : '';
      const typeLabel = t.type === 'income' ? '收入' : '支出';
      doc.text(`${time}  ${typeLabel}  ¥${t.amount}  ${t.category || ''}  ${t.note || ''}`);
    });
    doc.end();
  } catch (err) {
    console.error(err);
    return fail(res, '导出失败，请重试');
  }
});

module.exports = router;