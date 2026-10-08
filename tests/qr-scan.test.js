import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQrPayload, unitShortCode } from '../src/qr-scan.js';

const id = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';

test('QR parser reads owner and driver deep links', () => {
  assert.deepEqual(parseQrPayload(`https://shop.example/admin?unit=${id}`), { type: 'unit', id });
  assert.deepEqual(parseQrPayload(`http://localhost:5173/admin?product=${id.toUpperCase()}`), { type: 'product', id });
  assert.deepEqual(parseQrPayload(`https://shop.example/admin?order=${id}`), { type: 'order', id });
  assert.deepEqual(parseQrPayload(`https://shop.example/delivery?unit=${id}`), { type: 'unit', id });
  assert.deepEqual(parseQrPayload(`/delivery?order=${id}`), { type: 'order', id });
});

test('QR parser accepts bare unit IDs and printed short codes', () => {
  assert.deepEqual(parseQrPayload(` ${id} `), { type: 'unit', id });
  assert.deepEqual(parseQrPayload('3F2B8C1E'), { type: 'short', id: '3f2b8c1e' });
  assert.equal(unitShortCode(id), '3F2B8C1E');
});

test('QR parser rejects unrelated or malformed content', () => {
  for (const value of [
    '', '   ', null, undefined, 42, 'hello world', 'https://evil.example/other?unit=' + id,
    'https://shop.example/admin?unit=not-a-uuid', 'https://shop.example/admin', 'x'.repeat(3000),
  ]) {
    assert.equal(parseQrPayload(value), null, String(value).slice(0, 40));
  }
});
