import Router from '@koa/router';
import { ok, fail, transformTransactionInput, validateTransactionBody, getIdempotencyKey, getIfMatch } from './common.js';

const router = new Router({ prefix: '/api/v1/transactions' });

router.post('/', async (ctx, next) => {
  const req = ctx.req || ctx;
  const res = ctx.res || ctx;

  try {
    const idempotencyKey = getIdempotencyKey(req);
    if (!idempotencyKey) {
      return fail(req, res, 400, 'MissingIdempotencyKey', 'Idempotency-Key header is required');
    }

    const fieldErrors = validateTransactionBody(req.body);
    if (fieldErrors.length > 0) {
      return fail(req, res, 400, 'ValidationFailed', 'Invalid input', fieldErrors);
    }

    const transactionData = transformTransactionInput(req.body);
    const mockResult = {
      id: 'mock_tx_' + Date.now(),
      ...transactionData,
      idempotencyKey,
      businessId: req.businessId || 'mock_business',
    };

    return ok(req, res, mockResult);
  } catch (err) {
    console.error('POST /transactions error:', err);
    return fail(req, res, 500, 'InternalError', err.message);
  }
});

router.get('/', async (ctx, next) => {
  const req = ctx.req || ctx;
  const res = ctx.res || ctx;

  try {
    const { page = 1, limit = 20, type, startDate, endDate } = req.query;
    const mockTransactions = []; 

    return ok(req, res, {
      data: mockTransactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
      },
    });
  } catch (err) {
    console.error('GET /transactions error:', err);
    return fail(req, res, 500, 'InternalError', err.message);
  }
});

router.get('/:id', async (ctx, next) => {
  const req = ctx.req || ctx;
  const res = ctx.res || ctx;
  try {
    const { id } = ctx.params;
    const mockTransaction = { id, businessId: req.businessId };

    return ok(req, res, mockTransaction);
  } catch (err) {
    console.error('GET /transactions/:id error:', err);
    return fail(req, res, 500, 'InternalError', err.message);
  }
});

router.patch('/:id', async (ctx, next) => {
  const req = ctx.req || ctx;
  const res = ctx.res || ctx;
  try {
    const { id } = ctx.params;

    const ifMatch = getIfMatch(req);
    if (!ifMatch) {
      return fail(req, res, 400, 'MissingIfMatch', 'If-Match header is required for updates');
    }

    const fieldErrors = validateTransactionBody(req.body);
    if (fieldErrors.length > 0) {
      return fail(req, res, 400, 'ValidationFailed', 'Invalid input', fieldErrors);
    }

    const updateData = transformTransactionInput(req.body);
    const mockUpdated = {
      id,
      ...updateData,
      revision: parseInt(ifMatch) + 1,
      updatedAt: new Date(),
    };
    return ok(req, res, mockUpdated);
  } catch (err) {
    console.error('PATCH /transactions/:id error:', err);
    return fail(req, res, 500, 'InternalError', err.message);
  }
});

router.delete('/:id', async (ctx, next) => {
  const req = ctx.req || ctx;
  const res = ctx.res || ctx;

  try {
    const { id } = ctx.params;
    return ok(req, res, { deleted: true, id });
  } catch (err) {
    console.error('DELETE /transactions/:id error:', err);
    return fail(req, res, 500, 'InternalError', err.message);
  }
});

export default router;