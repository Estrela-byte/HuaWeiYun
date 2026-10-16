import type { HealthReport, IndicatorSet, StrategyPlan } from "../types/domain.js";
import type { AppError } from "../types/errors.js";
import type { Result } from "../types/result.js";
import { strategize as build, rankStrategies } from "./strategize.js";

export { Quantifier } from "./quantifier.js";
export { StrategyRanker } from "./ranker.js";
export { rankStrategies } from "./strategize.js";

export function strategize(diagnosis: HealthReport, scenarioBase: IndicatorSet): Result<StrategyPlan, AppError> {
  const plan = build(diagnosis, scenarioBase);
  if (!plan.ok) {
    return plan;
  }
  return { ok: true, value: { directions: plan.value.directions, strategies: rankStrategies(plan.value.strategies) } };
}