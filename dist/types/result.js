export function ok(value) {
    return { ok: true, value };
}
export function err(error) {
    return { ok: false, error };
}
export function isOk(r) {
    return r.ok;
}
export function isErr(r) {
    return !r.ok;
}
//# sourceMappingURL=result.js.map