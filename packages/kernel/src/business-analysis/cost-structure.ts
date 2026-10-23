import type { CostSlice } from "../types/business-analysis.js";
import type { UnifiedData } from "../types/domain.js";
import { Decimal } from "../types/decimal.js";

const ZERO = Decimal.zero(2);

function firstDimension(dims: Record<string, string>): string | null {
  const keys = Object.keys(dims);
  if (keys.length === 0) return null;
  const k = keys[0];
  const v = k === undefined ? undefined : dims[k];
  return v ?? null;
}

/** 成本结构分解（饼图数据）：按指定维度聚合 cost 类记录，未指定时取第一个维度 */
export function buildCostStructure(unified: UnifiedData, dimension?: string): CostSlice[] {
  const costRecords = unified.records.filter((r) => r.category === "cost");
  const total = costRecords.reduce((acc, r) => acc.add(r.amount), ZERO);

  const buckets = new Map<string, Decimal>();
  for (const r of costRecords) {
    const key = dimension ? (r.dimensions[dimension] ?? "未分类") : (firstDimension(r.dimensions) ?? "全部成本");
    buckets.set(key, (buckets.get(key) ?? ZERO).add(r.amount));
  }

  return [...buckets.entries()]
    .map(([name, amount]) => ({
      name,
      amount: amount.toString(),
      ratio: total.isZero() ? "0" : amount.div(total, 6).toString(),
    }))
    .sort((a, b) => Decimal.fromString(b.amount).cmp(Decimal.fromString(a.amount)));
}