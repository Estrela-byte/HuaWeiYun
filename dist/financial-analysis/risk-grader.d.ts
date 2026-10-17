import type { IndicatorSet } from "../types/domain.js";
import { Decimal } from "../types/decimal.js";
export type RiskLevel = "red" | "yellow" | "green";
export interface RiskSignal {
    type: string;
    level: RiskLevel;
    indicator?: string;
    message: string;
}
export interface RiskReport {
    signals: RiskSignal[];
}
/** 默认阈值（可被覆盖） */
export declare const DEFAULT_RISK_THRESHOLDS: {
    marginRed: Decimal;
    marginYellow: Decimal;
    expenseRed: Decimal;
    expenseYellow: Decimal;
    turnoverRed: Decimal;
    turnoverYellow: Decimal;
    netMarginRed: Decimal;
};
export interface RiskThresholds {
    marginRed: Decimal;
    marginYellow: Decimal;
    expenseRed: Decimal;
    expenseYellow: Decimal;
    turnoverRed: Decimal;
    turnoverYellow: Decimal;
    netMarginRed: Decimal;
}
/** 风险分级器：红/黄/绿三级确定性阈值映射 */
export declare class RiskGrader {
    private t;
    constructor(thresholds?: RiskThresholds);
    grade(indicators: IndicatorSet): RiskReport;
}
