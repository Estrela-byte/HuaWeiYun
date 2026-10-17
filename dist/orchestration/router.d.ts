import type { AgentName, TaskType } from "../types/domain.js";
export declare const AGENT_BY_TASK: Record<TaskType, AgentName>;
/** 将诉求归类为任务类型集合（可复合） */
export declare function classifyTaskTypes(requirement: string): TaskType[];
/** 判断诉求是否模糊（未命中任何明确任务类型） */
export declare function needsClarification(requirement: string, taskTypes?: TaskType[]): boolean;
export declare function clarifyQuestions(): string[];
