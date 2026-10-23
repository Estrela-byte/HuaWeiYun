/** 结论整合器：汇总去重、统一口径、剔除矛盾，产出面向经营者的最终答复 */
export class ConclusionMerger {
    merge(fragments, failures = []) {
        const assumptions = this.dedup(fragments.flatMap((f) => f.assumptions ?? []));
        const dataDependencies = this.dedup(fragments.flatMap((f) => f.dataDependencies ?? []));
        const summary = fragments.map((f) => f.summary).filter(Boolean).join("；");
        return {
            summary: summary || "暂无可用结论",
            assumptions,
            dataDependencies,
            failures,
        };
    }
    dedup(items) {
        return [...new Set(items.filter(Boolean))];
    }
}
//# sourceMappingURL=conclusion-merger.js.map