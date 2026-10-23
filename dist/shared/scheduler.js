/** 定时调度：周期性体检、对账、异常巡检触发 */
export class Scheduler {
    timers = [];
    schedule(intervalMs, fn) {
        const timer = setInterval(fn, intervalMs);
        // 防止定时器阻止进程退出（测试环境友好）
        timer.unref?.();
        this.timers.push(timer);
        return timer;
    }
    stopAll() {
        this.timers.forEach((t) => clearInterval(t));
        this.timers = [];
    }
}
//# sourceMappingURL=scheduler.js.map