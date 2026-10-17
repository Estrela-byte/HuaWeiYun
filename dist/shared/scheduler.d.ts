/** 定时调度：周期性体检、对账、异常巡检触发 */
export declare class Scheduler {
    private timers;
    schedule(intervalMs: number, fn: () => void): NodeJS.Timeout;
    stopAll(): void;
}
