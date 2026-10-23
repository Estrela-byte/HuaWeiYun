import { Decimal } from "../types/decimal.js";

/** 校准目标区间：召回率/精准度各自的下限与上限（闭区间，Decimal 禁浮点） */
export interface CalibrationTarget {
  readonly recallLower: Decimal;
  readonly recallUpper: Decimal;
  readonly precisionLower: Decimal;
  readonly precisionUpper: Decimal;
}

/** 默认目标区间 [0.7, 0.9] 闭区间 */
export const DEFAULT_CALIBRATION_TARGET: CalibrationTarget = {
  recallLower: Decimal.fromString("0.7"),
  recallUpper: Decimal.fromString("0.9"),
  precisionLower: Decimal.fromString("0.7"),
  precisionUpper: Decimal.fromString("0.9"),
};

/**
 * 区间判定：recall 与 precision 是否均落入 [lower, upper] 闭区间。
 * 任一指标不可计算（undefined）时返回 false；纯函数不抛错。
 */
export function inTargetRange(
  recall: Decimal | undefined,
  precision: Decimal | undefined,
  target: CalibrationTarget,
): boolean {
  if (recall === undefined || precision === undefined) {
    return false;
  }
  return (
    recall.gte(target.recallLower) &&
    recall.lte(target.recallUpper) &&
    precision.gte(target.precisionLower) &&
    precision.lte(target.precisionUpper)
  );
}