import type { AppError } from "../types/errors.js";
import type { HealthReport, IndicatorSet, IssueGrade, Strategy, StrategyDirection, StrategyPlan } from "../types/domain.js";
import { appError } from "../types/errors.js";
import { err, ok, type Result } from "../types/result.js";
import { Quantifier } from "./quantifier.js";
import { StrategyRanker } from "./ranker.js";

const ranker = new StrategyRanker();

const LAYER_DIRECTION: Record<string, StrategyDirection> = {
  market: "growth",
  product: "efficiency",
  price: "growth",
  channel: "growth",
  cost_structure: "cost",
  funding_chain: "risk",
};

const RESOURCE_BY_DIRECTION: Record<StrategyDirection, number> = {
  growth: 7,
  cost: 5,
  efficiency: 5,
  risk: 4,
};

const RISK_BY_DIRECTION: Record<StrategyDirection, number> = {
  growth: 5,
  cost: 3,
  efficiency: 3,
  risk: 7,
};

/**
 * 策略生成：有诊断才有处方。
 * 基于诊断结论的问题分级生成四大方向策略，四因素排序，量化测算联动。
 */
export function strategize(diagnosis: HealthReport, scenarioBase: IndicatorSet): Result<StrategyPlan, AppError> {
  const issues = diagnosis.issueGrades;
  if (!issues || issues.length === 0 || diagnosis.rootCauses.length === 0) {
    return err(appError("E_NO_DIAGNOSIS", "缺少有效诊断结论，请先完成经营体检"));
  }

  const quantifier = new Quantifier();
  const strategies: Strategy[] = issues.map((issue, index) => {
    const layer = diagnosis.rootCauses[index]?.layer ?? "market";
    const direction = LAYER_DIRECTION[layer] ?? "growth";
    return buildStrategy(direction, issue, scenarioBase, quantifier);
  });

  strategies.forEach((s) => {
    s.priorityScore = ranker.score(s.priorityBasis);
  });
  strategies.sort((a, b) => b.priorityScore - a.priorityScore);

  const directions = [...new Set(strategies.map((s) => s.direction))];
  return ok({ directions, strategies });
}

export function rankStrategies(strategies: Strategy[]): Strategy[] {
  return strategies
    .map((s) => ({ ...s, priorityScore: ranker.score(s.priorityBasis) }))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

function buildStrategy(
  direction: StrategyDirection,
  issue: IssueGrade,
  base: IndicatorSet,
  quantifier: Quantifier,
): Strategy {
  const quantified = quantifier.quantify(direction, base);
  const isKey = direction === "risk" || issue.rank >= 8;
  return {
    direction,
    title: `针对「${issue.issue}」的${directionLabel(direction)}策略`,
    priorityScore: 0,
    priorityBasis: {
      roi: issue.severity,
      speed: issue.urgency,
      resource: RESOURCE_BY_DIRECTION[direction],
      risk: RISK_BY_DIRECTION[direction],
    },
    quantified,
    actionItems: [
      {
        owner: "经营者/业务负责人",
        when: "第 1-30 天",
        action: directionAction(direction),
        target: `使「${issue.issue}」得到缓解（阶段目标）`,
      },
    ],
    verifyMetric: {
      name: directionMetric(direction),
      targetValue: "较当前改善 ≥10%",
      verifyMethod: "按月复盘指标同比变动",
    },
    stopLoss: isKey
      ? {
          trigger: direction === "risk" ? "现金流持续为负超过 3 个月" : "连续 2 个月无改善",
          fallback: "切换为保守方案并收缩非核心投入",
        }
      : undefined,
    assumptionNote: "量化预期基于当前财务指标与公开假设，实测需补充数据",
  };
}

function directionLabel(d: StrategyDirection): string {
  return { growth: "增长（开源）", cost: "降本（节流）", efficiency: "增效（提运营效率）", risk: "风控（防风险）" }[d];
}

function directionAction(d: StrategyDirection): string {
  return {
    growth: "开拓高毛利渠道/客户并提升复购",
    cost: "梳理成本结构，压缩非必要开支",
    efficiency: "优化库存与应收周转，提升运营效率",
    risk: "收紧现金流与回款管理，预留资金安全垫",
  }[d];
}

function directionMetric(d: StrategyDirection): string {
  return { growth: "收入增速/毛利率", cost: "费用率/成本率", efficiency: "应收与库存周转", risk: "经营净现金流" }[d];
}

import { StrategyRanker } from "./ranker.js";
export function rankStrategies(strategies: Strategy[]): Strategy[] {
  const ranker = new StrategyRanker();
  return strategies.map((s) => ({
    ...s,
    priorityScore: ranker.score(s.priorityBasis),
  })).sort((a, b) => b.priorityScore - a.priorityScore);
}