import { appError } from "../types/errors.js";
import { err, ok } from "../types/result.js";
import { buildDag } from "./task-dag.js";
import { classifyTaskTypes, clarifyQuestions, needsClarification } from "./router.js";
import { ConclusionMerger } from "./conclusion-merger.js";
export { buildDag, executeDag } from "./task-dag.js";
export { classifyTaskTypes, needsClarification, clarifyQuestions, AGENT_BY_TASK } from "./router.js";
export { ConclusionMerger } from "./conclusion-merger.js";
/**
 * 任务编排主入口：澄清 → 归类 → 生成 DAG →（执行由调用方注入）→ 结论整合。
 */
export function orchestrate(requirement) {
    const taskTypes = classifyTaskTypes(requirement);
    if (needsClarification(requirement, taskTypes)) {
        return err(appError("E_UNCLASSIFIABLE", "诉求无法归类，请补充背景信息", {
            questions: clarifyQuestions(),
        }));
    }
    const dag = buildDag(taskTypes);
    const merger = new ConclusionMerger();
    const output = merger.merge([
        {
            summary: `已编排 ${dag.map((n) => n.routeTarget).join(" → ")} 协同链路，共 ${dag.length} 个环节`,
            dataDependencies: dag.length > 0 && dag[0]?.taskType === "ingest" ? undefined : ["缺少数据采集环节，结论依赖已有标准化数据"],
        },
    ]);
    return ok({ dag, output });
}
//# sourceMappingURL=index.js.map