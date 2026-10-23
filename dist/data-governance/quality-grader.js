const CRITICAL_FIELDS = new Set(["bizDate", "amount", "source", "caliber"]);
/**
 * 质量分级器：A/B/C 三级确定性判定。
 * - C 级：存在无法归一口径冲突，或关键字段（金额/日期/来源/口径）缺失；
 * - B 级：存在少量异常、缺失或一致性问题；
 * - A 级：完整、口径明确、可追溯。
 */
export function gradeQuality(unified, validation) {
    const anomalies = validation.reasonableness.map((i) => ({
        recordIndex: i.recordIndex,
        message: i.message,
        severity: "medium",
    }));
    const missing = validation.completeness
        .filter((i) => CRITICAL_FIELDS.has(i.field))
        .map((i) => ({ recordIndex: i.recordIndex, field: i.field }));
    const assumptions = [];
    const hasConflict = unified.conflicts.length > 0;
    const hasCriticalMissing = missing.length > 0;
    const hasMinorIssue = anomalies.length > 0 ||
        validation.completeness.length > 0 ||
        validation.consistency.length > 0;
    let level;
    if (hasConflict || hasCriticalMissing) {
        level = "C";
    }
    else if (hasMinorIssue) {
        level = "B";
        if (anomalies.length > 0) {
            assumptions.push({ description: "存在异常波动/合理性异常，下游分析须附带本假设说明" });
        }
        if (validation.consistency.length > 0) {
            assumptions.push({ description: "存在一致性问题，结论可信度受限" });
        }
    }
    else {
        level = "A";
    }
    return { level, anomalies, missing, assumptions };
}
//# sourceMappingURL=quality-grader.js.map