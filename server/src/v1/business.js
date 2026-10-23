import { Router } from 'express';
import { ok } from './envelope.js';

const router = Router();

router.get('/v1/business/profile', (req, res) => {
  return ok(req, res, {
    id: 'biz_123',
    name: '测试店铺',
    capabilities: {
      billImport: false,
      analytics: true,
      assistant: false,
      ocr: false,
      alerts: false,
      memberManagement: false,
      backup: false,
      export: false
    }
  });
});

router.post('/v1/business/profile', (req, res) => {
  return ok(req, res, { id: 'biz_123', ...req.body });
});

router.patch('/v1/business/profile', (req, res) => {
  return ok(req, res, { id: 'biz_123', ...req.body });
});

export default router;