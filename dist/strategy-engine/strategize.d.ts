import type { AppError } from "../types/errors.js";
import type { HealthReport, IndicatorSet, Strategy, StrategyPlan } from "../types/domain.js";
import { type Result } from "../types/result.js";
/**
 * 策略生成：有诊断才有处方。
 * 基于诊断结论的问题分级生成四大方向策略，四因素排序，量化测算联动。
 */
export declare function strategize(diagnosis: HealthReport, scenarioBase: IndicatorSet): Result<StrategyPlan, AppError>;
export declare function rankStrategies(strategies: Strategy[]): Strategy[];
