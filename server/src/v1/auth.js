import { Router } from 'express';
import { ok, fail } from './envelope.js';

const router = Router();

router.post('/v1/auth/session', (req, res) => {
  const { provider } = req.body || {};
  if (provider !== 'phone') {
    return fail(req, res, 501, 'UNSUPPORTED_PROVIDER', '暂不支持的登录方式');
  }
  return ok(req, res, { user: { id: 1 }, expiresAt: '2026-12-31' });
});

router.get('/v1/auth/me', (req, res) => {
  return ok(req, res, {
    id: 1,
    displayName: '测试用户',
    businessIds: ['biz_123'],
    permissions: ['*']
  });
});

router.get('/v1/auth/session', (req, res) => {
  return ok(req, res, { user: { id: 1 }, expiresAt: '2026-12-31' });
});

router.delete('/v1/auth/session', (req, res) => {
  return ok(req, res, null);
});

export default router;