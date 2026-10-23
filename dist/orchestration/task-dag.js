import { AGENT_BY_TASK } from "./router.js";
const ORDER = ["ingest", "analyze", "diagnose", "strategize"];
/**
 * 声明式 DAG 引擎：按硬依赖链生成 TaskNode[] 并执行状态机。
 * 依赖前置任务全部成功才进入执行中；上游失败即中止传播，绝不越级出结论。
 */
export function buildDag(taskTypes) {
    const ordered = ORDER.filter((t) => taskTypes.includes(t));
    return ordered.map((type, i) => ({
        id: `${type}-${i + 1}`,
        taskType: type,
        routeTarget: AGENT_BY_TASK[type],
        dependsOn: ordered.slice(0, i).map((_, j) => `${ordered[j]}-${j + 1}`),
        status: "pending",
    }));
}
/** 执行状态机：success 才传播，失败则下游 aborted */
export function executeDag(dag, executor) {
    const result = dag.map((n) => ({ ...n }));
    for (const node of result) {
        const deps = node.dependsOn.map((id) => result.find((n) => n.id === id));
        const anyAborted = deps.some((d) => d?.status === "aborted");
        const anyFailed = deps.some((d) => d?.status === "failed");
        if (anyAborted || anyFailed) {
            node.status = "aborted";
            continue;
        }
        node.status = "running";
        node.status = executor(node) ? "success" : "failed";
    }
    return result;
}
//# sourceMappingURL=task-dag.js.map