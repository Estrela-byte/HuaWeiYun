/** 轻量键值存储：确定性计算中间态（指标/诊断/策略/编排任务）的暂存介质 */
export class Storage {
    store = new Map();
    set(key, value) {
        this.store.set(key, value);
    }
    get(key) {
        return this.store.get(key);
    }
    has(key) {
        return this.store.has(key);
    }
    delete(key) {
        return this.store.delete(key);
    }
}
//# sourceMappingURL=storage.js.map