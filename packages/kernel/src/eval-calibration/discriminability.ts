import { Decimal } from "../types/decimal.js";

/** 区分度校验结论 */
export interface DiscriminabilityResult {
  readonly discriminable: boolean;
  readonly reason: "ok" | "incomputable" | "perfect_score" | "all_zero";
}

/**
 * 区分度校验：判定指标是否具备区分度。
 * - recall 不可计算 → incomputable
 * - recall == 1 且 precision == 1 → perfect_score（理想化满分，区分度不足）
 * - recall == 0 → all_zero（全漏检/过难，区分度不足）
 * - 否则 → ok
 * 全程 Decimal 比较禁浮点，纯函数不抛错。
 */
export function checkDiscriminability(
  recall: Decimal | undefined,
  precision: Decimal | undefined,
): DiscriminabilityResult {
  if (recall === undefined) {
    return { discriminable: false, reason: "incomputable" };
  }
  if (recall.eq(Decimal.fromInt(1)) && precision !== undefined && precision.eq(Decimal.fromInt(1))) {
    return { discriminable: false, reason: "perfect_score" };
  }
  if (recall.eq(Decimal.fromInt(0))) {
    return { discriminable: false, reason: "all_zero" };
  }
  return { discriminable: true, reason: "ok" };
}