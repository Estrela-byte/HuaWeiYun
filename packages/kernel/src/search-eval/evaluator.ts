import { AuditLogger } from "../shared/audit.js";
import type { AppError } from "../types/errors.js";
import { appError } from "../types/errors.js";
import type { Result } from "../types/result.js";
import { err, ok } from "../types/result.js";
import { computeMetrics, statConfusion } from "./metrics.js";
import { buildReport } from "./report.js";
import { validateTestSet } from "./testset-validator.js";
import type {
  EvalReport,
  EvalScope,
  EvalTestSet,
  EvalThresholds,
  IReadonlySearch,
  QueryEvalDetail,
} from "./types.js";

/**
 * 只读契约守卫：检测被评估检索对象是否暴露 search 之外的方法。
 * 一旦发现可写方法，即判定违反只读约束并阻断，防止评估流程引入写操作路径。
 */
function assertReadonlySearch(search: IReadonlySearch): Result<void, AppError> {
  const methodNames = new Set<string>();
  const obj = search as unknown as Record<string, unknown>;

  for (const name of Object.getOwnPropertyNames(obj)) {
    if (typeof obj[name] === "function") {
      methodNames.add(name);
    }
  }
  let proto = Object.getPrototypeOf(obj);
  while (proto !== null && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === "constructor") {
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(proto, name);
      if (descriptor && typeof descriptor.value === "function") {
        methodNames.add(name);
      }
    }
    proto = Object.getPrototypeOf(proto);
  }

  const violations = [...methodNames].filter((m) => m !== "search");
  if (violations.length > 0) {
    return err(
      appError("E_EVAL_READONLY_VIOLATION", `检测到只读契约之外的可写方法: ${violations.join(", ")}`, {
        methods: violations,
      }),
    );
  }
  return ok(undefined);
}

function collectKnowledgeIds(testSet: EvalTestSet): string[] {
  const ids = new Set<string>();
  for (const q of testSet.queries) {
    for (const id of q.knowledgeIds ?? []) {
      ids.add(id);
    }
  }
  return [...ids];
}

function collectVersion(testSet: EvalTestSet): string {
  for (const q of testSet.queries) {
    if (q.version !== undefined && q.version.length > 0) {
      return q.version;
    }
  }
  return "";
}

/**
 * 评估编排入口：校验 → 逐查询只读检索 → 原样采集 → 混淆统计 → 指标计算 → 达标判定 → 报告。
 * 全程仅依赖 IReadonlySearch 只读契约，不调用任何可写方法，不修改被评估对象。
 * 单条检索失败标记 failed 继续；检测到写方法即阻断返回 E_EVAL_READONLY_VIOLATION。
 */
export async function evaluate(
  testSet: EvalTestSet,
  thresholds: EvalThresholds,
  search: IReadonlySearch,
): Promise<Result<EvalReport, AppError>> {
  const audit = new AuditLogger();

  const valid = validateTestSet(testSet);
  if (!valid.ok) {
    return err(valid.error);
  }

  const guard = assertReadonlySearch(search);
  if (!guard.ok) {
    audit.log("search_eval.readonly_violation", "failed", "default", guard.error.message);
    return err(guard.error);
  }

  const details: QueryEvalDetail[] = [];
  for (const query of testSet.queries) {
    try {
      const result = await search.search({
        query: query.query,
        ...(query.knowledgeIds !== undefined ? { knowledgeIds: query.knowledgeIds } : {}),
      });
      audit.log(
        "search_eval.readonly_query",
        "success",
        "default",
        `query=${query.id} hits=${result.hits.length} source=readonly`,
      );
      details.push(
        statConfusion({
          queryId: query.id,
          sampleType: query.sampleType,
          relevantDocIds: query.relevantDocIds,
          hits: result.hits,
          failed: false,
        }),
      );
    } catch {
      audit.log(
        "search_eval.readonly_query",
        "failed",
        "default",
        `query=${query.id} code=E_EVAL_RETRIEVAL_FAILED`,
      );
      details.push({
        queryId: query.id,
        sampleType: query.sampleType,
        relevantCount: query.relevantDocIds.length,
        returnedCount: 0,
        returnedRelevantCount: 0,
        falsePositive: false,
        falseNegative: query.relevantDocIds.length > 0,
        failed: true,
      });
    }
  }

  const metrics = computeMetrics(details);
  const scope: EvalScope = {
    knowledgeIds: collectKnowledgeIds(testSet),
    version: collectVersion(testSet),
  };
  const report = buildReport(metrics, details, thresholds, scope);

  audit.log(
    "search_eval.complete",
    "success",
    "default",
    `queries=${testSet.queries.length} recall=${report.metrics.recall?.toString() ?? "N/A"} precision=${
      report.metrics.precision?.toString() ?? "N/A"
    }`,
  );

  return ok(report);
}