/** 轻量键值存储：确定性计算中间态（指标/诊断/策略/编排任务）的暂存介质 */
export declare class Storage {
    private store;
    set(key: string, value: unknown): void;
    get<T>(key: string): T | undefined;
    has(key: string): boolean;
    delete(key: string): boolean;
}
