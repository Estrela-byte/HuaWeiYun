import type { AlertThresholds } from "../types/alert.js";
/** 外置化配置加载：口径/权重/阈值以 JSON 维护，支持调整后回算 */
export declare function loadConfig<T>(filename: string): T;
export interface WeightsConfig {
    profitability: number;
    growth: number;
    solvency: number;
    efficiency: number;
    cashflow: number;
}
export interface RiskConfig {
    marginRed: number;
    marginYellow: number;
    expenseRed: number;
    expenseYellow: number;
    turnoverRed: number;
    turnoverYellow: number;
    netMarginRed: number;
}
export declare function loadWeights(): WeightsConfig;
export declare function loadRisk(): RiskConfig;
export declare function loadAlertThresholds(): AlertThresholds;
