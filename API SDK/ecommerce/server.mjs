import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MoMoClient } from '../dist/esm/index.js';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const publicRoot = resolve(projectRoot, 'ecommerce', 'public');
const products = [
  { id: 'nomad-bag', name: 'Nomad carryall', category: 'Travel', price: 185000, description: 'A sturdy everyday bag with room for wherever the day takes you.', accent: 'sand', badge: 'Bestseller' },
  { id: 'studio-bottle', name: 'Studio bottle', category: 'Daily essentials', price: 68000, description: 'Double-wall stainless steel to keep your drink just right.', accent: 'blue', badge: 'New' },
  { id: 'weekend-knit', name: 'Weekend knit', category: 'Apparel', price: 142000, description: 'A soft, breathable layer made for slower mornings.', accent: 'pink', badge: '' },
  { id: 'everyday-tote', name: 'Everyday tote', category: 'Accessories', price: 79000, description: 'Lightweight, easy to carry, and ready for the market run.', accent: 'green', badge: '' },
];
const productById = new Map(products.map((product) => [product.id, product]));
const orders = new Map();
const idempotencyKeys = new Map();
const orderLifetimeMs = 2 * 60 * 60 * 1000;
const currency = process.env.SHOP_CURRENCY || 'UGX';
const deliveryFee = 5000;
const freeDeliveryThreshold = 200000;

function loadDotEnv() {
  const envPath = resolve(projectRoot, '.env');
  return readFile(envPath, 'utf8')
    .then((contents) => {
      for (const rawLine of contents.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const equalsIndex = line.indexOf('=');
        if (equalsIndex < 1) continue;
        const key = line.slice(0, equalsIndex).trim();
        const value = line.slice(equalsIndex + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
        if (process.env[key] === undefined) process.env[key] = value;
      }
    })
    .catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
}

function createMoMoClient() {
  const required = [
    process.env.MOMO_BASE_URL,
    process.env.MOMO_API_USER,
    process.env.MOMO_API_KEY,
    process.env.MOMO_COLLECTION_KEY,
    process.env.MOMO_DISBURSEMENT_KEY,
  ];
  const environment = process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox';
  if (required.some((value) => !value || /^your[-_ ]/i.test(value)) ||
      !['sandbox', 'production'].includes(environment)) {
    return null;
  }

  return new MoMoClient({
    baseUrl: process.env.MOMO_BASE_URL,
    apiUser: process.env.MOMO_API_USER,
    apiKey: process.env.MOMO_API_KEY,
    subscriptionKey: process.env.MOMO_COLLECTION_KEY,
    disbursementSubscriptionKey: process.env.MOMO_DISBURSEMENT_KEY,
    targetEnvironment: environment,
  });
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  if (!request.headers['content-type']?.includes('application/json')) {
    const error = new Error('Send checkout details as JSON.');
    error.statusCode = 415;
    throw error;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16 * 1024) {
      const error = new Error('Checkout request is too large.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Checkout request must contain valid JSON.');
    error.statusCode = 400;
    throw error;
  }
}

function validateCheckout(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Enter your checkout details and try again.';
  }
  const { customer, items, idempotencyKey } = body;
  if (!customer || typeof customer !== 'object' || Array.isArray(customer)) {
    return 'Enter your contact and delivery details.';
  }
  const { name, email, phone, address, city } = customer;
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    return 'Enter your name (2–100 characters).';
  }
  if (typeof email !== 'string' || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return 'Enter a valid email address.';
  }
  if (typeof phone !== 'string' || !/^\+?\d{8,15}$/.test(phone.replace(/[\s()-]/g, ''))) {
    return 'Enter a valid mobile number including its country code.';
  }
  if (typeof address !== 'string' || address.trim().length < 5 || address.trim().length > 200) {
    return 'Enter a delivery address (5–200 characters).';
  }
  if (typeof city !== 'string' || city.trim().length < 2 || city.trim().length > 80) {
    return 'Enter your town or city.';
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > products.length) {
    return 'Your cart is empty or invalid.';
  }
  if (typeof idempotencyKey !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return 'Refresh the checkout and try again.';
  }

  const seen = new Set();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || !productById.has(item.id) ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 20 ||
        seen.has(item.id)) {
      return 'Your cart contains an invalid item or quantity.';
    }
    seen.add(item.id);
  }
  return null;
}

function pruneExpiredOrders() {
  const cutoff = Date.now() - orderLifetimeMs;
  for (const [requestId, order] of orders) {
    if (order.createdAt < cutoff) orders.delete(requestId);
  }
  for (const [key, entry] of idempotencyKeys) {
    if (entry.createdAt < cutoff) idempotencyKeys.delete(key);
  }
}

async function handleApi(request, response, url, momoClient) {
  if (request.method === 'GET' && url.pathname === '/api/products') {
    sendJson(response, 200, { currency, products });
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/status') {
    sendJson(response, 200, {
      paymentsEnabled: momoClient !== null,
      environment: process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox',
    });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/checkout') {
    const body = await readJson(request);
    const validationError = validateCheckout(body);
    if (validationError) {
      sendJson(response, 400, { error: validationError });
      return;
    }
    if (!momoClient) {
      sendJson(response, 503, { error: 'Mobile Money checkout is not configured yet.' });
      return;
    }

    pruneExpiredOrders();
    const previous = idempotencyKeys.get(body.idempotencyKey);
    if (previous) {
      sendJson(response, 200, previous.result);
      return;
    }

    const subtotal = body.items.reduce((total, item) =>
      total + productById.get(item.id).price * item.quantity, 0);
    const shipping = subtotal >= freeDeliveryThreshold ? 0 : deliveryFee;
    const amount = subtotal + shipping;
    const externalId = `SHOP-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const requestId = body.idempotencyKey;
    const result = { orderId: externalId, requestId, subtotal, shipping, amount, currency };
    orders.set(requestId, { createdAt: Date.now(), orderId: externalId });
    idempotencyKeys.set(body.idempotencyKey, { createdAt: Date.now(), result });
    try {
      await momoClient.requestToPay({
        amount: String(amount),
        currency,
        externalId,
        requestId,
        payer: {
          partyIdType: 'MSISDN',
          partyId: body.customer.phone.replace(/\D/g, ''),
        },
        payerMessage: `Moyo Market order ${externalId}`,
        payeeNote: `Online order ${externalId}`,
      });
      sendJson(response, 201, result);
    } catch (error) {
      if (error.statusCode && error.statusCode < 500 && error.statusCode !== 409) {
        orders.delete(requestId);
        idempotencyKeys.delete(body.idempotencyKey);
      }
      console.error('MoMo checkout could not be started:', error.message);
      sendJson(response, 502, {
        error: 'We could not start the payment. Check your details and try again.',
      });
    }
    return;
  }

  const statusMatch = url.pathname.match(/^\/api\/orders\/([0-9a-f-]{36})$/i);
  if (request.method === 'GET' && statusMatch) {
    const order = orders.get(statusMatch[1]);
    if (!order) {
      sendJson(response, 404, { error: 'This order could not be found. Start checkout again.' });
      return;
    }
    if (!momoClient) {
      sendJson(response, 503, { error: 'Mobile Money checkout is not configured yet.' });
      return;
    }
    try {
      const status = await momoClient.getRequestToPayStatus(statusMatch[1]);
      sendJson(response, 200, { orderId: order.orderId, status: status.status, reason: status.reason });
    } catch (error) {
      console.error('MoMo order status could not be retrieved:', error.message);
      sendJson(response, 502, { error: 'Payment status is temporarily unavailable. Try again shortly.' });
    }
    return;
  }

  sendJson(response, 404, { error: 'Not found.' });
}

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
]);

async function serveStatic(response, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = resolve(publicRoot, relativePath);
  if (!filePath.startsWith(`${publicRoot}${sep}`)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentTypes.get(extname(filePath)) || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(file);
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error;
    response.writeHead(404);
    response.end('Not found');
  }
}

await loadDotEnv();
const momoClient = createMoMoClient();
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");

  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url, momoClient);
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end('Method not allowed');
      return;
    }
    await serveStatic(response, url.pathname);
  } catch (error) {
    if (!response.headersSent) {
      sendJson(response, error.statusCode || 500, {
        error: error.statusCode ? error.message : 'An unexpected server error occurred.',
      });
    } else {
      response.destroy(error);
    }
    if (!error.statusCode) console.error('Shop request failed:', error);
  }
});

server.listen(port, () => {
  console.log(`Moyo Market is ready at http://localhost:${port}`);
  if (!momoClient) {
    console.warn('MoMo checkout is disabled. Configure the MOMO_* values in .env to enable payments.');
  }
});
