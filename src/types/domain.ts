import type { Decimal } from "./decimal.js";

// ============ 基础枚举类型 ============

export type DataSourceType = "erp" | "file" | "manual";

/** 口径类型：含税 / 不含税 */
export type CaliberType = "tax_inclusive" | "tax_exclusive";

export type Currency = "CNY" | "USD" | "EUR" | "JPY" | (string & {});

/** 数据质量分级：A=完整可追溯，B=少量异常缺失，C=残缺口径混乱 */
export type QualityLevel = "A" | "B" | "C";

export interface Period {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

// ============ 溯源 ============

export interface ProvenanceRecord {
  id: string;
  source: DataSourceType;
  timestamp: string; // ISO 8601
  processSteps: string[];
  batchId: string;
}

// ============ 经营数据记录 ============

/** 经营数据类别，用于财务分析阶段的收入/成本/费用/现金流汇总 */
export type RecordCategory =
  | "revenue"
  | "cost"
  | "expense"
  | "receivable"
  | "inventory"
  | "cashflow_operating"
  | "cashflow_investing"
  | "cashflow_financing";

/** 原始记录：来自上游数据源，未归一 */
export interface RawRecord {
  source: DataSourceType;
  bizDate: string; // YYYY-MM-DD，必填
  amount: Decimal; // 必填；成本/费用类可负向计量
  caliber: CaliberType; // 必填：含税/不含税
  currency: Currency; // 必填
  category: RecordCategory; // 必填
  dimensions: Record<string, string>; // 可选维度：product/customer/channel 等
}

/** 统一记录：口径归一化后的标准记录 */
export interface UnifiedRecord {
  amount: Decimal; // 单位统一到基准币种 CNY
  caliberNormalized: CaliberType;
  convertedCurrency: Currency;
  provenanceRef: string; // ProvenanceRecord.id
  bizDate: string;
  category: RecordCategory;
  dimensions: Record<string, string>;
}

export interface ConflictItem {
  recordIndex: number;
  message: string;
  caliber?: CaliberType;
}

export interface UnifiedData {
  records: UnifiedRecord[];
  conflicts: ConflictItem[];
}

// ============ 数据校验 ============

export interface ValidationIssue {
  recordIndex: number;
  field: string;
  message: string;
}

export interface ValidationReport {
  completeness: ValidationIssue[];
  consistency: ValidationIssue[];
  reasonableness: ValidationIssue[];
}

// ============ 质量分级 ============

export interface MissingField {
  recordIndex: number;
  field: string;
}

export interface Assumption {
  description: string;
}

export interface DataAnomaly {
  recordIndex: number;
  message: string;
  severity: "low" | "medium" | "high";
}

export interface QualityGrade {
  level: QualityLevel;
  anomalies: DataAnomaly[];
  missing: MissingField[];
  assumptions: Assumption[];
}

// ============ 指标字典 ============

export type IndicatorName =
  | "revenue"
  | "grossProfit"
  | "grossMargin"
  | "netMargin"
  | "expenseRatio"
  | "receivableTurnover"
  | "inventoryTurnover"
  | "operatingCashflow"
  | "breakEvenPoint";

export interface MetricCaliber {
  tax: CaliberType;
  includeDepreciation: boolean;
  description: string;
}

export interface MetricDictionaryEntry {
  name: IndicatorName;
  caliber: MetricCaliber;
  version: number;
  effectivePeriod: Period;
}

export type MetricDictionary = Record<IndicatorName, MetricDictionaryEntry>;

// ============ 财务指标 ============

export interface IndicatorResult {
  name: IndicatorName;
  value: Decimal;
  unit: string;
  formula: string;
  caliber: MetricCaliber;
  period: Period;
  credibility: QualityLevel;
}

export interface SkippedIndicator {
  name: IndicatorName;
  reason: string;
}

export interface IndicatorSet {
  indicators: IndicatorResult[];
  skipped: SkippedIndicator[];
}

export interface ScenarioParams {
  lever: "price" | "cost" | "customer";
  magnitude: Decimal; // 变动幅度（百分比，如 0.05 表 5%）
}

export interface ScenarioWarning {
  message: string;
  level: "info" | "warning";
}

export interface ScenarioResult {
  projected: IndicatorSet;
  isAssumption: true;
  warnings: ScenarioWarning[];
}

// ============ 经营诊断 ============

export type HealthDimension =
  | "profitability"
  | "growth"
  | "solvency"
  | "efficiency"
  | "cashflow";

export type Score = number;

export interface DimensionScore {
  dimension: HealthDimension;
  score: Score;
}

export interface DiagnosticAnomaly {
  indicator: IndicatorName;
  deviation: string; // 偏离幅度描述
  basis: string; // 识别依据
}

export interface RootCause {
  anomalyIndicator: IndicatorName;
  description: string;
  evidenceIndicator: IndicatorName; // 可回溯的具体指标
  layer: "market" | "product" | "price" | "channel" | "cost_structure" | "funding_chain";
}

export interface IssueGrade {
  issue: string;
  severity: Score; // 严重度
  urgency: Score; // 紧急度
  controllability: Score; // 可控度
  rank: Score; // 综合分级
}

export interface HealthReport {
  dimensionScores: DimensionScore[];
  totalScore: Score;
  anomalies: DiagnosticAnomaly[];
  rootCauses: RootCause[];
  issueGrades: IssueGrade[];
}

// ============ 策略建议 ============

export type StrategyDirection = "growth" | "cost" | "efficiency" | "risk";

export interface PriorityBasis {
  roi: Score; // 投入产出比
  speed: Score; // 见效速度
  resource: Score; // 资源占用（越低越好）
  risk: Score; // 风险（越低越好）
}

export interface ActionItem {
  owner: string;
  when: string;
  action: string;
  target: string;
}

export interface VerifyMetric {
  name: string;
  targetValue: string; // 可衡量目标值
  verifyMethod: string; // 验证方式
}

export interface StopLoss {
  trigger: string;
  fallback: string;
}

export interface Strategy {
  direction: StrategyDirection;
  title: string;
  priorityScore: Score;
  priorityBasis: PriorityBasis;
  quantified: {
    benefit: Decimal;
    cost: Decimal;
    breakEven: Period;
  };
  actionItems: ActionItem[];
  verifyMetric: VerifyMetric;
  stopLoss?: StopLoss;
  assumptionNote?: string;
}

export interface StrategyPlan {
  directions: StrategyDirection[];
  strategies: Strategy[];
}

// ============ 任务编排 ============

export type TaskType = "ingest" | "analyze" | "diagnose" | "strategize";

export type AgentName =
  | "data-steward"
  | "financial-analyst"
  | "business-diagnostician"
  | "strategy-consultant"
  | "business-advisor";

export type TaskStatus = "pending" | "running" | "success" | "failed" | "aborted";

export interface TaskNode {
  id: string;
  taskType: TaskType;
  routeTarget: AgentName;
  dependsOn: string[]; // 依赖的任务 id
  status: TaskStatus;
}

export interface FinalReply {
  summary: string;
  assumptions: string[];
  dataDependencies: string[];
  failures: string[];
}