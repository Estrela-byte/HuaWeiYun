/** 优先级排序器：四因素加权（投入产出比/见效速度/资源占用/风险），先高杠杆 */
export class StrategyRanker {
    score(basis) {
        const w = { roi: 0.35, speed: 0.25, resource: 0.2, risk: 0.2 };
        // resource/risk 越低越好，故取其补数
        return Math.round((basis.roi * w.roi + basis.speed * w.speed + (10 - basis.resource) * w.resource + (10 - basis.risk) * w.risk) * 10) / 10;
    }
    rank(items) {
        return items
            .map((it) => ({ ...it, priorityScore: this.score(it.priorityBasis) }))
            .sort((a, b) => b.priorityScore - a.priorityScore);
    }
}
//# sourceMappingURL=ranker.js.map