import { judgePass } from "./judgement.js";
import type {
  EvalMetrics,
  EvalReport,
  EvalScope,
  EvalThresholds,
  PassJudgement,
  QueryEvalDetail,
} from "./types.js";

function conclusionOf(judgement: PassJudgement): string {
  switch (judgement.overall) {
    case "pass":
      return "检索质量达标";
    case "fail":
      return "检索质量不达标";
    case "partial":
      return "检索质量部分达标";
    case "incomputable":
      return "指标不可计算，无法判定";
  }
}

/**
 * 组装评估报告：整体指标 + 逐查询明细 + 达标判定 + 结论 + 范围/版本 + 时间戳。
 * 仅作为结论交付，不回写被评估对象/知识库/检索配置。
 */
export function buildReport(
  metrics: EvalMetrics,
  details: readonly QueryEvalDetail[],
  thresholds: EvalThresholds,
  scope: EvalScope,
): EvalReport {
  const judgement = judgePass(metrics, thresholds);
  return {
    metrics,
    details,
    judgement,
    conclusion: conclusionOf(judgement),
    scope,
    generatedAt: new Date().toISOString(),
  };
}