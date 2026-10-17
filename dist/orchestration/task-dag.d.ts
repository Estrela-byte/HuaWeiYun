import type { TaskNode, TaskType } from "../types/domain.js";
/**
 * 声明式 DAG 引擎：按硬依赖链生成 TaskNode[] 并执行状态机。
 * 依赖前置任务全部成功才进入执行中；上游失败即中止传播，绝不越级出结论。
 */
export declare function buildDag(taskTypes: TaskType[]): TaskNode[];
/** 执行状态机：success 才传播，失败则下游 aborted */
export declare function executeDag(dag: TaskNode[], executor: (node: TaskNode) => boolean): TaskNode[];
