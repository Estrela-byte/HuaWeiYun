import type { FinalReply, TaskNode } from "../types/domain.js";
import type { AppError } from "../types/errors.js";
import { type Result } from "../types/result.js";
export { buildDag, executeDag } from "./task-dag.js";
export { classifyTaskTypes, needsClarification, clarifyQuestions, AGENT_BY_TASK } from "./router.js";
export { ConclusionMerger } from "./conclusion-merger.js";
export interface OrchestrationResult {
    dag: TaskNode[];
    output: FinalReply;
}
/**
 * 任务编排主入口：澄清 → 归类 → 生成 DAG →（执行由调用方注入）→ 结论整合。
 */
export declare function orchestrate(requirement: string): Result<OrchestrationResult, AppError>;
export type { TaskNode, FinalReply } from "../types/domain.js";
