import type { PriorityBasis, Strategy } from "../types/domain.js";
interface Rankable {
    direction: Strategy["direction"];
    priorityBasis: PriorityBasis;
}
/** 优先级排序器：四因素加权（投入产出比/见效速度/资源占用/风险），先高杠杆 */
export declare class StrategyRanker {
    score(basis: PriorityBasis): number;
    rank<T extends Rankable>(items: T[]): T[];
}
export {};
