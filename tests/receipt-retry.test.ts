import assert from 'node:assert/strict';
import test from 'node:test';
import { getReceiptRetryDelay, isRetryableReceiptStatus } from '../lib/chat/receiptRetry';

test('only transient receipt failures are retryable', () => {
  for (const status of [400, 401, 403, 404, 409, 422]) {
    assert.equal(isRetryableReceiptStatus(status), false);
    assert.equal(getReceiptRetryDelay(status, null, 8_000), null);
  }

  for (const status of [429, 500, 502, 503, 599]) {
    assert.equal(isRetryableReceiptStatus(status), true);
    assert.equal(getReceiptRetryDelay(status, null, 8_000), 8_000);
  }
});

test('a valid Retry-After header controls transient backoff', () => {
  assert.equal(getReceiptRetryDelay(429, '3', 8_000), 3_000);
  assert.equal(getReceiptRetryDelay(503, '0', 8_000), 8_000);
  assert.equal(getReceiptRetryDelay(503, 'invalid', 8_000), 8_000);
});
