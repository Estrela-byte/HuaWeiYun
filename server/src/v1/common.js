import { ok, fail } from './envelope.js';
const TYPE_MAP = {
  sale:      { direction: 'in',    kind: 'sales_revenue' },
  refund:    { direction: 'out',   kind: 'sales_refund' },
  expense:   { direction: 'out',   kind: 'operating_expense' },
  income:    { direction: 'in',    kind: 'other_income' },
};

export function transformTransactionInput(input) {
  const { amount_cents, type, description, ...rest } = input;
  const amountMinor = amount_cents;
  const mapping = TYPE_MAP[type];
  if (!mapping) {
    throw new Error(`Unsupported transaction type: ${type}`);
  }
  return {
    amountMinor,
    direction: mapping.direction,
    kind: mapping.kind,
    description: description || '',
    ...rest,    revision: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function validateTransactionBody(body) {
  const errors = [];
  if (body.amount_cents === undefined || body.amount_cents === null) {
    errors.push({ field: 'amount_cents', message: 'amount_cents is required' });
  } else if (typeof body.amount_cents !== 'number' || body.amount_cents < 0) {
    errors.push({ field: 'amount_cents', message: 'amount_cents must be a non-negative number' });
  }
  if (!body.type) {
    errors.push({ field: 'type', message: 'type is required' });
  } else if (!Object.keys(TYPE_MAP).includes(body.type)) {
    errors.push({ field: 'type', message: `Invalid type. Allowed: ${Object.keys(TYPE_MAP).join(', ')}` });
  }
  return errors;
}

export function getIdempotencyKey(req) {
  return (
    req.headers['idempotency-key'] ||
    req.headers['Idempotency-Key'] ||
    req.headers['x-idempotency-key'] ||
    null
  );
}

export function getIfMatch(req) {
  return req.headers['if-match'] || null;
}

export { ok, fail };