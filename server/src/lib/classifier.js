'use strict';
/**
 * 自动分类：关键词 -> 科目。
 * 对应效果图「自动分类 452 笔 / 待确认 34 笔」——
 * 命中的入 confirmed，没命中的入 pending 等人工确认。
 *
 * 上线后建议：把用户的人工确认结果回流成样本，再换成模型分类。
 */
const RULES = [
  {
    name: '原材料',
    keywords: ['原料', '奶茶', '茶包', '茶叶', '咖啡豆', '咖啡粉', '牛奶', '奶精', '果酱', '糖浆',
      '珍珠', '椰果', '杯子', '杯盖', '吸管', '打包', '包材', '食材', '面粉', '奶油', '水果', '冰块'],
  },
  {
    name: '人工',
    keywords: ['工资', '薪资', '社保', '公积金', '兼职', '小时工', '提成', '奖金', '劳务'],
  },
  {
    name: '房租',
    keywords: ['房租', '租金', '物业', '水电', '电费', '水费', '燃气'],
  },
  {
    name: '其他',
    keywords: ['维修', '装修', '快递', '运费', '广告', '推广', '团建', '办公', '话费', '宽带', '保险'],
  },
];

/** 收入侧关键词 */
const INCOME_RULES = [
  { name: '营业收入', keywords: ['营业额', '收款', '收款到账', '二维码收款', '销售'] },
  { name: '退款', keywords: ['退款', '退货'] },
];

function classify(row) {
  const text = `${row.summary || ''} ${row.counterparty || ''}`;
  const table = row.type === 'income' ? INCOME_RULES : RULES;
  for (const r of table) {
    if (r.keywords.some((k) => text.includes(k))) {
      return { category: r.name, matched: true };
    }
  }
  return { category: row.type === 'income' ? '营业收入' : '其他', matched: false };
}

module.exports = { classify, RULES, INCOME_RULES };
