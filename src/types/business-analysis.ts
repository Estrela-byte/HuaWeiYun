// ============ 经营分析 ============

/** KPI 摘要：对应经营分析看板顶部的四项核心指标 */
export interface KpiSummary {
  revenue: string; // 营业额
  cost: string; // 成本
  grossProfit: string; // 利润（毛利）
  grossMargin: string; // 毛利率
}

/** 营收趋势序列点（供折线图），按自然月聚合 */
export interface TrendPoint {
  period: string; // YYYY-MM
  revenue: string;
  cost: string;
  grossProfit: string;
}

/** 成本结构切片（供饼图），按维度值聚合 */
export interface CostSlice {
  name: string;
  amount: string;
  ratio: string; // 占比，如 "0.45"
}

/** 同环比对比行（供表格） */
export interface ComparisonRow {
  metric: string;
  current: string; // 当期值
  previous: string; // 上期值
  change: string; // 环比变化幅度，如 "-0.05"（负号表示下降）
}

/** 经营优势/问题归纳条目，evidence 可回溯到具体指标或记录 */
export interface Insight {
  type: "strength" | "problem";
  title: string;
  detail: string;
  evidence: string;
}

export interface BusinessAnalysisReport {
  kpi: KpiSummary;
  trend: TrendPoint[];
  costStructure: CostSlice[];
  comparison: ComparisonRow[];
  insights: Insight[];
}