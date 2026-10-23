import type { PriorityBasis, Strategy } from "../types/domain.js";

interface Rankable {
  direction: Strategy["direction"];
  priorityBasis: PriorityBasis;
}

/** 优先级排序器：四因素加权（投入产出比/见效速度/资源占用/风险），先高杠杆 */
export class StrategyRanker {
  score(basis: PriorityBasis): number {
    const w = { roi: 0.35, speed: 0.25, resource: 0.2, risk: 0.2 };
    // resource/risk 越低越好，故取其补数
    return Math.round(
      (basis.roi * w.roi + basis.speed * w.speed + (10 - basis.resource) * w.resource + (10 - basis.risk) * w.risk) * 10,
    ) / 10;
  }

  rank<T extends Rankable>(items: T[]): T[] {
    return items
      .map((it) => ({ ...it, priorityScore: this.score(it.priorityBasis) }))
      .sort((a, b) => (b as T & { priorityScore: number }).priorityScore - (a as T & { priorityScore: number }).priorityScore);
  }
}