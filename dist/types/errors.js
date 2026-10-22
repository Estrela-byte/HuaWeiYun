export function appError(code, message, details) {
    return { code, message, details };
}
export const ERROR_LABELS = {
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
};
//# sourceMappingURL=errors.js.map