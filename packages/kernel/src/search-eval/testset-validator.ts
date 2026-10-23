import type { AppError } from "../types/errors.js";
import { appError } from "../types/errors.js";
import type { Result } from "../types/result.js";
import { err, ok } from "../types/result.js";
import type { EvalTestSet } from "./types.js";

interface ValidationProblem {
  readonly id: string;
  readonly reason: string;
}

/**
 * 校验评估测试集：须同时含正/负样本，正样本标注集非空、负样本标注集为空、查询文本非空。
 * 校验通过原样返回，失败返回 E_EVAL_INVALID_TESTSET 并附问题明细。
 */
export function validateTestSet(testSet: EvalTestSet): Result<EvalTestSet, AppError> {
  const problems: ValidationProblem[] = [];
  const queries = testSet.queries;

  if (queries.length === 0) {
    return err(appError("E_EVAL_INVALID_TESTSET", "测试集为空", { problems: [{ id: "<testSet>", reason: "测试集无任何查询" }] }));
  }

  const hasPositive = queries.some((q) => q.sampleType === "positive");
  const hasNegative = queries.some((q) => q.sampleType === "negative");
  if (!hasPositive) {
    problems.push({ id: "<testSet>", reason: "缺少正样本查询" });
  }
  if (!hasNegative) {
    problems.push({ id: "<testSet>", reason: "缺少负样本查询" });
  }

  for (const q of queries) {
    if (q.query.trim().length === 0) {
      problems.push({ id: q.id, reason: "查询文本为空" });
    }
    if (q.sampleType === "positive" && q.relevantDocIds.length === 0) {
      problems.push({ id: q.id, reason: "正样本缺少相关文档标注" });
    }
    if (q.sampleType === "negative" && q.relevantDocIds.length !== 0) {
      problems.push({ id: q.id, reason: "负样本不应有相关文档标注" });
    }
  }

  if (problems.length > 0) {
    return err(appError("E_EVAL_INVALID_TESTSET", "测试集校验失败", { problems }));
  }
  return ok(testSet);
}