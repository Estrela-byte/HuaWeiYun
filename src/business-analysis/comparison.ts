import type { ComparisonRow } from "../types/business-analysis.js";
import type { UnifiedData } from "../types/domain.js";
import { Decimal } from "../types/decimal.js";
import { grossProfitOf, monthlyAggregate, type MonthBucket } from "./trend.js";

const ZERO = Decimal.zero(2);

function marginOf(b: MonthBucket): Decimal {
  return b.revenue.isZero() ? ZERO : grossProfitOf(b).div(b.revenue, 6);
}

/** 同环比对比（表格数据）：取最近两个自然月，逐项计算环比变化幅度 */
export function buildComparison(unified: UnifiedData): ComparisonRow[] {
  const buckets = monthlyAggregate(unified);
  const keys = [...buckets.keys()].sort();
  if (keys.length < 2) return [];

  const prevKey = keys[keys.length - 2];
  const currKey = keys[keys.length - 1];
  if (prevKey === undefined || currKey === undefined) return [];
  const prev = buckets.get(prevKey);
  const curr = buckets.get(currKey);
  if (!prev || !curr) return [];

  const rows: ComparisonRow[] = [];
  const push = (metric: string, current: Decimal, previous: Decimal) => {
    const change = previous.isZero() ? "0" : current.sub(previous).div(previous, 6).toString();
    rows.push({ metric, current: current.toString(), previous: previous.toString(), change });
  };

  push("营业额", curr.revenue, prev.revenue);
  push("成本", curr.cost, prev.cost);
  push("毛利", grossProfitOf(curr), grossProfitOf(prev));
  push("毛利率", marginOf(curr), marginOf(prev));

  return rows;
}