import type { QaAnswer, QaBasisItem } from "../types/knowledge.js";
import type { IndicatorSet, UnifiedData } from "../types/domain.js";
import { Decimal } from "../types/decimal.js";
import { buildComparison } from "../business-analysis/comparison.js";
import type { KnowledgeBase } from "./knowledge-base.js";

const MARGIN_FLOOR = new Decimal(30n, 2); // 30%

type Intent = "profit" | "cost" | "cashflow" | "general";

function classifyIntent(question: string): Intent {
  if (/现金|现金流|资金|周转/.test(question)) return "cashflow";
  if (/成本|费用|支出|采购/.test(question)) return "cost";
  if (/利润|毛利|盈利|赚钱|亏|损益/.test(question)) return "profit";
  return "general";
}

function pct(d: Decimal): string {
  return `${d.mul(Decimal.fromInt(100)).round(1).toString()}%`;
}

/**
 * 确定性智能问答：知识库检索提供概念/规则解释，
 * 计算内核（同环比对比 + 指标阈值）产出原因分析与计算依据，不依赖外部大模型。
 */
export function answerQuestion(
  question: string,
  unified: UnifiedData,
  indicators: IndicatorSet,
  kb: KnowledgeBase,
): QaAnswer {
  const hits = kb.search(question, 3);
  const comparison = buildComparison(unified);
  const basis: QaBasisItem[] = comparison.map((r) => ({
    metric: r.metric,
    current: r.current,
    previous: r.previous,
  }));

  const intent = classifyIntent(question);
  const reasons: string[] = [];
  const suggestions: string[] = [];

  const chg = (metric: string): Decimal => {
    const c = comparison.find((r) => r.metric === metric)?.change;
    return c ? Decimal.fromString(c) : Decimal.zero(2);
  };

  const revChg = chg("营业额");
  const costChg = chg("成本");
  const marginChg = chg("毛利率");

  if (revChg.isNegative()) {
    reasons.push(`营业额环比下降 ${pct(revChg)}`);
    suggestions.push("拓展获客渠道、优化定价或挽回流失客户");
  }
  if (costChg.gt(Decimal.zero(2))) {
    reasons.push(`成本环比上升 ${pct(costChg)}`);
    suggestions.push("优化采购、控制原材料成本占比");
  }
  if (marginChg.isNegative()) {
    reasons.push(`毛利率环比下降 ${pct(marginChg)}，毛利空间收窄`);
    suggestions.push("提升产品毛利、调整产品结构");
  }

  // 无历史环比数据时，退化为指标阈值判断
  if (reasons.length === 0) {
    const grossMargin = indicators.indicators.find((i) => i.name === "grossMargin")?.value;
    if (grossMargin && grossMargin.lt(MARGIN_FLOOR)) {
      reasons.push(`当期毛利率 ${grossMargin.toString()} 低于 30% 健康下限`);
      suggestions.push("重新核算定价、压缩直接成本");
    }
  }

  if (intent === "cashflow") {
    const cf = indicators.indicators.find((i) => i.name === "operatingCashflow")?.value;
    if (cf && cf.isNegative()) {
      reasons.push(`经营现金流为负（${cf.toString()}）`);
      suggestions.push("加速回款、压缩库存、合理安排付款节奏");
    }
  }

  return {
    question,
    summary: buildSummary(intent, reasons),
    reasons: reasons.length ? reasons : ["当前数据不足以定位明显异常，建议补充历史期间数据"],
    suggestions: suggestions.length ? suggestions : ["请补充更多经营数据后进一步分析"],
    basis,
    knowledgeHits: hits.map((h) => h.doc.title),
  };
}

function buildSummary(intent: Intent, reasons: string[]): string {
  const body = reasons.join("；");
  switch (intent) {
    case "profit":
      return reasons.length ? `本期利润变动主要受：${body}。` : "未发现明显利润异常。";
    case "cost":
      return reasons.length ? `成本相关要点：${body}。` : "成本未发现明显异常。";
    case "cashflow":
      return reasons.length ? `现金流相关要点：${body}。` : "现金流未发现明显异常。";
    default:
      return reasons.length ? `分析要点：${body}。` : "当前数据未显示明显异常。";
  }
}