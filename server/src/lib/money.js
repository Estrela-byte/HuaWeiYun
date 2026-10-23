'use strict';
/**
 * 金额工具：数据库里永远是「整数分」，只在输出给前端时才转「元」。
 * 这是新手第一大坑 —— 用浮点数存钱，算着算着就多了 0.01。
 */
const toCents = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error('金额不合法: ' + v);
  return Math.round(n * 100);
};

const toYuan = (cents) => Number((Number(cents || 0) / 100).toFixed(2));

const pct = (num, den, digits = 1) =>
  den ? Number(((num / den) * 100).toFixed(digits)) : 0;

/** 环比/同比：分母为 0 时返回 null，前端显示 "—" */
const growth = (cur, prev, digits = 1) =>
  prev ? Number((((cur - prev) / prev) * 100).toFixed(digits)) : null;

module.exports = { toCents, toYuan, pct, growth };
