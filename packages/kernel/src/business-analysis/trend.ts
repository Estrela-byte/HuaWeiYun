import type { UnifiedData } from "../types/domain.js";
import { Decimal } from "../types/decimal.js";

export interface MonthBucket {
  revenue: Decimal;
  cost: Decimal;
  expense: Decimal;
}

const ZERO = Decimal.zero(2);

/** 按自然月（YYYY-MM）聚合收入/成本/费用，供趋势与同环比复用 */
export function monthlyAggregate(unified: UnifiedData): Map<string, MonthBucket> {
  const buckets = new Map<string, MonthBucket>();
  for (const r of unified.records) {
    const period = r.bizDate.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(period)) continue;
    const b = buckets.get(period) ?? { revenue: ZERO, cost: ZERO, expense: ZERO };
    if (r.category === "revenue") b.revenue = b.revenue.add(r.amount);
    else if (r.category === "cost") b.cost = b.cost.add(r.amount);
    else if (r.category === "expense") b.expense = b.expense.add(r.amount);
    buckets.set(period, b);
  }
  return buckets;
}

export function grossProfitOf(b: MonthBucket): Decimal {
  return b.revenue.sub(b.cost);
}

/** 营收趋势序列（折线图数据），按月份升序 */
export function buildTrend(unified: UnifiedData): { period: string; revenue: string; cost: string; grossProfit: string }[] {
  const buckets = monthlyAggregate(unified);
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, b]) => ({
      period,
      revenue: b.revenue.toString(),
      cost: b.cost.toString(),
      grossProfit: grossProfitOf(b).toString(),
    }));
}