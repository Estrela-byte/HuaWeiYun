// 统一响应封装工具
// 成功：{ code: 0, message, data }
// 失败：{ code: 1(默认), message }

function success(res, data, message) {
  return res.json({ code: 0, message: message || '操作成功', data: data || null });
}

function fail(res, message, code) {
  return res.json({ code: code || 1, message: message || '操作失败' });
}

module.exports = { success, fail };