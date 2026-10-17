import type { Decimal } from "./decimal.js";
export type DataSourceType = "erp" | "file" | "manual";
/** 口径类型：含税 / 不含税 */
export type CaliberType = "tax_inclusive" | "tax_exclusive";
export type Currency = "CNY" | "USD" | "EUR" | "JPY" | (string & {});
/** 数据质量分级：A=完整可追溯，B=少量异常缺失，C=残缺口径混乱 */
export type QualityLevel = "A" | "B" | "C";
export interface Period {
    start: string;
    end: string;
}
export interface ProvenanceRecord {
    id: string;
    source: DataSourceType;
    timestamp: string;
    processSteps: string[];
    batchId: string;
}
/** 经营数据类别，用于财务分析阶段的收入/成本/费用/现金流汇总 */
export type RecordCategory = "revenue" | "cost" | "expense" | "receivable" | "inventory" | "cashflow_operating" | "cashflow_investing" | "cashflow_financing";
/** 原始记录：来自上游数据源，未归一 */
export interface RawRecord {
    source: DataSourceType;
    bizDate: string;
    amount: Decimal;
    caliber: CaliberType;
    currency: Currency;
    category: RecordCategory;
    dimensions: Record<string, string>;
}
/** 统一记录：口径归一化后的标准记录 */
export interface UnifiedRecord {
    amount: Decimal;
    caliberNormalized: CaliberType;
    convertedCurrency: Currency;
    provenanceRef: string;
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
export type IndicatorName = "revenue" | "grossProfit" | "grossMargin" | "netMargin" | "expenseRatio" | "receivableTurnover" | "inventoryTurnover" | "operatingCashflow" | "breakEvenPoint";
/** 异常识别通道标识：真实指标 + 数据不足类占位 */
export type AnomalyIndicator = IndicatorName | "trend" | "benchmark";
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
    magnitude: Decimal;
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
export type HealthDimension = "profitability" | "growth" | "solvency" | "efficiency" | "cashflow";
export type Score = number;
export interface DimensionScore {
    dimension: HealthDimension;
    score: Score;
}
export interface DiagnosticAnomaly {
    indicator: AnomalyIndicator;
    deviation: string;
    basis: string;
}
export interface RootCause {
    anomalyIndicator: AnomalyIndicator;
    description: string;
    evidenceIndicator: IndicatorName;
    layer: "market" | "product" | "price" | "channel" | "cost_structure" | "funding_chain";
}
export interface IssueGrade {
    issue: string;
    severity: Score;
    urgency: Score;
    controllability: Score;
    rank: Score;
}
export interface HealthReport {
    dimensionScores: DimensionScore[];
    totalScore: Score;
    anomalies: DiagnosticAnomaly[];
    rootCauses: RootCause[];
    issueGrades: IssueGrade[];
}
export type StrategyDirection = "growth" | "cost" | "efficiency" | "risk";
export interface PriorityBasis {
    roi: Score;
    speed: Score;
    resource: Score;
    risk: Score;
}
export interface ActionItem {
    owner: string;
    when: string;
    action: string;
    target: string;
}
export interface VerifyMetric {
    name: string;
    targetValue: string;
    verifyMethod: string;
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
export type TaskType = "ingest" | "analyze" | "diagnose" | "strategize";
export type AgentName = "data-steward" | "financial-analyst" | "business-diagnostician" | "strategy-consultant" | "business-advisor";
export type TaskStatus = "pending" | "running" | "success" | "failed" | "aborted";
export interface TaskNode {
    id: string;
    taskType: TaskType;
    routeTarget: AgentName;
    dependsOn: string[];
    status: TaskStatus;
}
export interface FinalReply {
    summary: string;
    assumptions: string[];
    dataDependencies: string[];
    failures: string[];
}
