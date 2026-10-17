import type { AgentName } from "../types/domain.js";

export interface ToolDefinition {
  name: string;
  agent: AgentName;
  description: string;
  module: string;
}

/**
 * 工具注册表：将确定性内核接口以工具形式指派给对应专家智能体，
 * 严守"数据管家不下经营结论、诊断师不开方、主智能体不产专业结论"边界。
 */
export const TOOLS: ToolDefinition[] = [
  { name: "ingest", agent: "data-steward", description: "多来源经营数据统一接入", module: "data-ingestion" },
  { name: "govern", agent: "data-steward", description: "数据校验、口径统一、质量分级与溯源", module: "data-governance" },
  { name: "analyze", agent: "financial-analyst", description: "财务指标计算", module: "financial-analysis" },
  { name: "scenario", agent: "financial-analyst", description: "情景测算", module: "financial-analysis" },
  { name: "diagnose", agent: "business-diagnostician", description: "经营健康度诊断", module: "diagnosis-engine" },
  { name: "strategize", agent: "strategy-consultant", description: "策略建议与优先级排序", module: "strategy-engine" },
  { name: "orchestrate", agent: "business-advisor", description: "任务编排与 DAG 调度", module: "orchestration" },
  { name: "clarify", agent: "business-advisor", description: "需求澄清", module: "orchestration" },
  { name: "route", agent: "business-advisor", description: "任务路由", module: "orchestration" },
];

export function toolsOf(agent: AgentName): ToolDefinition[] {
  return TOOLS.filter((t) => t.agent === agent);
}