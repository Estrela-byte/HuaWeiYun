export function ok(req, res, data) {
  return res.json({
    data: data,
    meta: {
      requestId: req.id || 'req_' + Date.now(),
      dataVersion: '1'
    }
  });
}

export function fail(req, res, status, code, message, fieldErrors) {
  return res.status(status).json({
    error: {
      code: code,
      message: message,
      fieldErrors: fieldErrors || {}
    },
    meta: {
      requestId: req.id || 'req_' + Date.now()
    }
  });
}