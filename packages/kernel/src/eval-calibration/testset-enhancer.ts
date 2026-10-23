import { tokenize } from "../knowledge/knowledge-base.js";
import type { AppError } from "../types/errors.js";
import { appError } from "../types/errors.js";
import type { KnowledgeDoc } from "../types/knowledge.js";
import type { Result } from "../types/result.js";
import { err, ok } from "../types/result.js";
import type { EnhancedTestSet, SampleKind } from "./types.js";

/** 校验须覆盖的全部样本细分类型 */
const REQUIRED_SAMPLE_KINDS: readonly SampleKind[] = [
  "direct",
  "colloquial",
  "paraphrase",
  "irrelevant",
  "distractor",
  "boundary",
];

interface AnnotationProblem {
  readonly id: string;
  readonly reason: string;
}

/**
 * 增强测试集校验：
 * ① 样本类型完备性——须同时覆盖六类样本，缺失返回 E_CALIB_INCOMPLETE_SAMPLE_KINDS；
 * ② 标注完备性——正样本 relevantDocIds 非空且指向真实文档、负样本为空，违者返回 E_CALIB_INVALID_ANNOTATION；
 * ③ 干扰负样本强对应检测——干扰负样本 query 关键词命中任一文档标题返回 E_CALIB_DISTRACTOR_CONFLICT。
 * 校验通过原样返回 ok(testSet)。
 */
export function validateEnhancedTestSet(
  testSet: EnhancedTestSet,
  knownDocs: readonly KnowledgeDoc[],
): Result<EnhancedTestSet, AppError> {
  const docIds = new Set(knownDocs.map((d) => d.id));

  const presentKinds = new Set<SampleKind>();
  for (const q of testSet.queries) {
    presentKinds.add(q.sampleKind);
  }
  const missingKinds = REQUIRED_SAMPLE_KINDS.filter((k) => !presentKinds.has(k));
  if (missingKinds.length > 0) {
    return err(
      appError("E_CALIB_INCOMPLETE_SAMPLE_KINDS", "测试集样本类型不完整", { missingKinds }),
    );
  }

  const annotationProblems: AnnotationProblem[] = [];
  for (const q of testSet.queries) {
    if (q.query.trim().length === 0) {
      annotationProblems.push({ id: q.id, reason: "查询文本为空" });
    }
    if (q.sampleType === "positive") {
      if (q.relevantDocIds.length === 0) {
        annotationProblems.push({ id: q.id, reason: "正样本缺少相关文档标注" });
      }
      for (const docId of q.relevantDocIds) {
        if (!docIds.has(docId)) {
          annotationProblems.push({ id: q.id, reason: `标注指向不存在的文档: ${docId}` });
        }
      }
    } else if (q.relevantDocIds.length !== 0) {
      annotationProblems.push({ id: q.id, reason: "负样本不应有相关文档标注" });
    }
  }
  if (annotationProblems.length > 0) {
    return err(appError("E_CALIB_INVALID_ANNOTATION", "标注指向不存在的文档", { annotationProblems }));
  }

  for (const q of testSet.queries) {
    if (q.sampleKind !== "distractor") {
      continue;
    }
    const queryTokens = new Set(tokenize(q.query));
    for (const doc of knownDocs) {
      const titleTokens = tokenize(doc.title);
      if (titleTokens.some((t) => queryTokens.has(t))) {
        return err(
          appError("E_CALIB_DISTRACTOR_CONFLICT", "干扰负样本与知识库存在强对应", {
            id: q.id,
            query: q.query,
            title: doc.title,
          }),
        );
      }
    }
  }

  return ok(testSet);
}