import test from 'node:test';
import assert from 'node:assert/strict';

const apiBase = process.env.API_BASE_URL || 'http://localhost:3000';
const webBase = process.env.WEB_BASE_URL || 'http://localhost:5173';

async function getJson(path) {
  const response = await fetch(new URL(path, apiBase));
  return { response, body: await response.json() };
}

test('API and database health endpoint is ready', async () => {
  const { response, body } = await getJson('/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: 'ok', database: 'connected' });
});

test('public catalog contains only customer-safe product fields', async () => {
  const { response, body } = await getJson('/api/products');
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body));
  assert.ok(body.length > 0, 'the starter catalog should be seeded');
  for (const product of body) {
    assert.match(product.id, /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i);
    assert.equal(typeof product.name, 'string');
    assert.ok(Number.isFinite(product.price) && product.price > 0);
    assert.equal(product.published, true);
    assert.equal(typeof product.inStock, 'boolean');
    for (const privateField of ['stockOnHand', 'reservedQuantity', 'availableQuantity', 'inventoryTrackingEnabled', 'reorderLevel']) {
      assert.equal(Object.hasOwn(product, privateField), false, `${privateField} must not be exposed publicly`);
    }
  }
});

test('payment options disclose availability without exposing provider secrets', async () => {
  const { response, body } = await getJson('/api/payment-options');
  assert.equal(response.status, 200);
  assert.equal(typeof body.razorpayEnabled, 'boolean');
  assert.equal(typeof body.demoEnabled, 'boolean');
  assert.ok(!Object.keys(body).some((key) => /secret|credential/i.test(key)));
});

test('public tax readiness exposes only a safe checkout flag', async () => {
  const { response, body } = await getJson('/api/tax-options');
  assert.equal(response.status, 200);
  assert.equal(typeof body.checkoutReady, 'boolean');
  assert.equal(typeof body.message, 'string');
  assert.equal(Object.hasOwn(body, 'gstin'), false);
  assert.equal(Object.hasOwn(body, 'legalName'), false);
});

test('anonymous session endpoints do not establish privileged accounts', async () => {
  const endpoints = [
    ['/api/admin/session', (body) => assert.equal(body.authenticated, false)],
    ['/api/account/session', (body) => {
      assert.equal(body.authenticated, false);
      assert.equal(body.customer, null);
    }],
    ['/api/delivery/session', (body) => assert.equal(body.authenticated, false)],
    ['/api/employee/session', (body) => {
      assert.equal(body.authenticated, false);
      assert.equal(body.employee, null);
    }],
  ];

  for (const [path, verify] of endpoints) {
    const { response, body } = await getJson(path);
    assert.equal(response.status, 200, path);
    verify(body);
  }
});

test('owner, customer, and delivery data APIs deny anonymous access', async () => {
  const endpoints = [
    '/api/admin/payment-settings',
    '/api/admin/tax-profile',
    '/api/admin/employees',
    '/api/admin/products',
    '/api/admin/orders',
    '/api/admin/analytics',
    '/api/admin/finance',
    '/api/admin/finance/orders',
    '/api/admin/crm/status',
    '/api/admin/delivery/agents',
    '/api/admin/deliveries',
    '/api/admin/support/tickets',
    '/api/admin/feedback',
    '/api/account/orders',
    '/api/account/feedback',
    '/api/support/tickets',
    '/api/delivery/assignments',
  ];

  for (const path of endpoints) {
    const { response, body } = await getJson(path);
    assert.equal(response.status, 401, path);
    assert.equal(typeof body.error, 'string', path);
  }
});

test('anonymous checkout and payment routes do not place or verify orders', async () => {
  for (const path of [
    '/api/orders',
    '/api/payments/razorpay/orders',
    '/api/payments/razorpay/verify',
    '/api/admin/finance/entries',
    '/api/admin/crm/sync',
  ]) {
    const response = await fetch(new URL(path, apiBase), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 401, path);
    assert.equal(typeof (await response.json()).error, 'string', path);
  }
});

test('account registration and login validate bad input without creating records', async () => {
  for (const path of ['/api/account/register', '/api/account/login']) {
    const response = await fetch(new URL(path, apiBase), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'short' }),
    });
    assert.equal(response.status, 400, path);
    assert.equal(typeof (await response.json()).error, 'string', path);
  }
});

test('unknown API routes return JSON not the SPA document', async () => {
  const response = await fetch(new URL('/api/not-a-real-route', apiBase));
  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type') || '', /application\/json/);
  assert.equal(typeof (await response.json()).error, 'string');
});

test('API sends security headers and disables its framework fingerprint', async () => {
  const response = await fetch(new URL('/api/payment-options', apiBase));
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.ok(response.headers.get('content-security-policy'));
  assert.ok(response.headers.get('x-content-type-options'));
  assert.ok(response.headers.get('cross-origin-opener-policy'));
});

test('storefront deep links return the application shell', async () => {
  for (const path of ['/', '/account', '/admin', '/delivery', '/employee']) {
    const response = await fetch(new URL(path, webBase));
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type') || '', /text\/html/);
    assert.match(await response.text(), /SSTE Studio/);
  }
});
