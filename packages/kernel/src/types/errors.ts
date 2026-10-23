/**
 * 统一错误码枚举与错误对象，与设计 2.2 异常映射表一一对应。
 */
export type ErrorCode =
  | "E_INGEST_FORMAT"
  | "E_INGEST_SOURCE"
  | "E_GOVERN_CONFLICT"
  | "E_FINANCE_INSUFFICIENT"
  | "E_LOW_CREDIBILITY"
  | "E_DIVISION_BY_ZERO"
  | "E_OUT_OF_RANGE"
  | "E_ROOT_CAUSE_UNKNOWN"
  | "E_CONFLICT"
  | "E_NO_DIAGNOSIS"
  | "E_MISSING_ASSUMPTION"
  | "E_UNCLASSIFIABLE"
  | "E_DEPENDENCY_FAILED"
  | "E_TASK_ABORTED"
  | "E_EVAL_INVALID_TESTSET"
  | "E_EVAL_READONLY_VIOLATION"
  | "E_EVAL_RETRIEVAL_FAILED"
  | "E_EVAL_INDICATOR_INCOMPUTABLE"
  | "E_EVAL_ABORTED"
  | "E_SEARCH_WEIGHT_INVALID"
  | "E_SEARCH_THRESHOLD_MISSING"
  | "E_SEARCH_GAP_PARAM_MISSING"
  | "E_SEARCH_RECALL_DEGRADED"
  | "E_SEARCH_NEGATIVE_FP"
  | "E_CALIB_INCOMPLETE_SAMPLE_KINDS"
  | "E_CALIB_INVALID_ANNOTATION"
  | "E_CALIB_DISTRACTOR_CONFLICT"
  | "E_CALIB_NO_FEASIBLE_CONFIG"
  | "E_CALIB_NO_DISCRIMINATION";

export interface AppError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

export function appError(code: ErrorCode, message: string, details?: unknown): AppError {
  return { code, message, details };
}

export const ERROR_LABELS: Record<ErrorCode, string> = {
  E_INGEST_FORMAT: "文件格式无法解析",
  E_INGEST_SOURCE: "数据源不可用",
  E_GOVERN_CONFLICT: "口径冲突无法归一",
  E_FINANCE_INSUFFICIENT: "数据不足无法计算",
  E_LOW_CREDIBILITY: "数据可信度不足",
  E_DIVISION_BY_ZERO: "除零或分母缺失",
  E_OUT_OF_RANGE: "假设参数超出合理区间",
  E_ROOT_CAUSE_UNKNOWN: "根因待补数据",
  E_CONFLICT: "结论冲突",
  E_NO_DIAGNOSIS: "缺少诊断结论",
  E_MISSING_ASSUMPTION: "测算假设缺失",
  E_UNCLASSIFIABLE: "诉求无法归类",
  E_DEPENDENCY_FAILED: "依赖环节失败",
  E_TASK_ABORTED: "任务已中止",
  E_EVAL_INVALID_TESTSET: "测试集校验失败",
  E_EVAL_READONLY_VIOLATION: "检测到写操作已阻断",
  E_EVAL_RETRIEVAL_FAILED: "检索查询失败",
  E_EVAL_INDICATOR_INCOMPUTABLE: "指标无有效样本不可计算",
  E_EVAL_ABORTED: "评估已中止",
  E_SEARCH_WEIGHT_INVALID: "检索权重配置非法",
  E_SEARCH_THRESHOLD_MISSING: "检索阈值配置缺失",
  E_SEARCH_GAP_PARAM_MISSING: "得分断层参数缺失",
  E_SEARCH_RECALL_DEGRADED: "优化导致召回率下降",
  E_SEARCH_NEGATIVE_FP: "优化引入负样本误检",
  E_CALIB_INCOMPLETE_SAMPLE_KINDS: "测试集样本类型不完整",
  E_CALIB_INVALID_ANNOTATION: "标注指向不存在的文档",
  E_CALIB_DISTRACTOR_CONFLICT: "干扰负样本与知识库存在强对应",
  E_CALIB_NO_FEASIBLE_CONFIG: "无可行参数组合",
  E_CALIB_NO_DISCRIMINATION: "指标区分度不足",
};