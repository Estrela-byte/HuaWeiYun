import type { AgentName, TaskType } from "../types/domain.js";

const TYPE_KEYWORDS: Record<TaskType, string[]> = {
  ingest: ["导入", "数据", "采集", "口径", "录入", "上传", "取数"],
  analyze: ["利润", "成本", "现金流", "财务", "收入", "毛利率", "费用", "毛利", "净利率"],
  diagnose: ["体检", "诊断", "健康", "异常", "问题", "状况", "亏损"],
  strategize: ["提高", "改善", "策略", "建议", "怎么办", "增长", "降本", "增效", "风控", "优化"],
};

export const AGENT_BY_TASK: Record<TaskType, AgentName> = {
  ingest: "data-steward",
  analyze: "financial-analyst",
  diagnose: "business-diagnostician",
  strategize: "strategy-consultant",
};

const CLARIFY_QUESTIONS = [
  "企业规模与主营业务是什么？",
  "所属行业是？",
  "关注哪个经营周期（本月/本季/本年）？",
  "当前最关心的核心痛点是什么（利润/现金流/增长）？",
];

/** 将诉求归类为任务类型集合（可复合） */
export function classifyTaskTypes(requirement: string): TaskType[] {
  const found = new Set<TaskType>();
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some((k) => requirement.includes(k))) {
      found.add(type as TaskType);
    }
  }
  return [...found];
}

/** 判断诉求是否模糊（未命中任何明确任务类型） */
export function needsClarification(requirement: string, taskTypes: TaskType[] = classifyTaskTypes(requirement)): boolean {
  return taskTypes.length === 0;
}

export function clarifyQuestions(): string[] {
  return CLARIFY_QUESTIONS;
}