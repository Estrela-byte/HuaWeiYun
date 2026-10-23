/** 定时调度：周期性体检、对账、异常巡检触发 */
export class Scheduler {
  private timers: NodeJS.Timeout[] = [];

  schedule(intervalMs: number, fn: () => void): NodeJS.Timeout {
    const timer = setInterval(fn, intervalMs);
    // 防止定时器阻止进程退出（测试环境友好）
    timer.unref?.();
    this.timers.push(timer);
    return timer;
  }

  stopAll(): void {
    this.timers.forEach((t) => clearInterval(t));
    this.timers = [];
  }
}