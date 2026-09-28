# MoMo Get Paid SDK

TypeScript SDK for the **MTN MoMo Get Paid API** — Collection & Disbursement products.

Generated from the [MoMo Get Paid Postman collection](postman/collections/MoMo%20Get%20Paid).

---

## Installation

```bash
npm install
npm run build
```

> **Requirements:** Node.js ≥ 18 (uses the built-in `fetch` and `crypto.randomUUID()`).

---

## Quick Start

```ts
import { MoMoClient } from './dist/index.js';

const client = new MoMoClient({
  baseUrl: 'https://sandbox.momodeveloper.mtn.com',
  apiUser: 'your-api-user-uuid',
  apiKey: 'your-api-key',
  subscriptionKey: 'your-collection-subscription-key',
  disbursementSubscriptionKey: 'your-disbursement-subscription-key',
  targetEnvironment: 'sandbox',
});

// 1. Initiate a payment
const { requestId } = await client.requestToPay({
  amount: '100',
  currency: 'EUR',
  externalId: 'order-001',
  payer: { partyIdType: 'MSISDN', partyId: '256771234567' },
  payerMessage: 'Payment for order #001',
  payeeNote: 'Order #001',
});

// 2. Poll for the result
const status = await client.getRequestToPayStatus(requestId);
console.log(status.status); // 'PENDING' | 'SUCCESSFUL' | 'FAILED'

// 3. Notify the payer
await client.sendDeliveryNotification({
  requestId,
  notificationMessage: 'Your payment has been received. Thank you!',
});

// 4. Refund if needed
const { requestIdRefund } = await client.refund({
  amount: '100',
  currency: 'EUR',
  externalId: 'refund-001',
  payerMessage: 'Refund for order #001',
  payeeNote: 'Order #001 refund',
  referenceIdToRefund: requestId,
});

const refundStatus = await client.getRefundStatus(requestIdRefund);
console.log(refundStatus.status); // 'SUCCESSFUL'
```

---

## Usage Examples

### Try the e-commerce checkout demo

The repository includes a small storefront that uses the SDK on the server to
create and check MTN Mobile Money payments. The browser never receives MoMo
credentials. The demo catalog and checkout are for local development; orders
are kept in memory and disappear when the server restarts.

1. Copy `ecommerce/.env.example` to the repository root as `.env` and add your
   MoMo sandbox credentials. Keep `.env` private; never put credentials in
   browser code or commit them.
2. Build the SDK and start the storefront:

   ```bash
   npm run build
   npm run start:shop
   ```

3. Open [http://localhost:3000](http://localhost:3000), add an item to your
   bag, enter delivery and mobile number details, then approve the MoMo payment
   prompt on your phone. The page checks the SDK payment status until it is
   successful or failed.

The server defaults to the sandbox environment. It adds a UGX 5,000 delivery
fee, waived on orders of UGX 200,000 or more. Orders are held in memory for
checkout-status polling. Do not use this in production without adding persistent
order storage, shipping and tax rules, customer-data handling, and appropriate
operational controls.

### ESM / modern import

```ts
import { MoMoClient } from 'momo-get-paid-sdk';

const client = new MoMoClient({
  baseUrl: 'https://sandbox.momodeveloper.mtn.com',
  apiUser: process.env.MOMO_API_USER!,
  apiKey: process.env.MOMO_API_KEY!,
  subscriptionKey: process.env.MOMO_COLLECTION_KEY!,
  disbursementSubscriptionKey: process.env.MOMO_DISBURSEMENT_KEY!,
  targetEnvironment: 'sandbox',
});

const token = await client.generateAccessToken();
console.log(token.access_token);

const { result } = await client.checkAccount('256771234567');
console.log(result);
```

### CommonJS / require

```js
const { MoMoClient } = require('momo-get-paid-sdk');

const client = new MoMoClient({
  baseUrl: 'https://sandbox.momodeveloper.mtn.com',
  apiUser: process.env.MOMO_API_USER,
  apiKey: process.env.MOMO_API_KEY,
  subscriptionKey: process.env.MOMO_COLLECTION_KEY,
  disbursementSubscriptionKey: process.env.MOMO_DISBURSEMENT_KEY,
  targetEnvironment: 'sandbox',
});

(async () => {
  const { requestId } = await client.requestToPay({
    amount: '100',
    currency: 'EUR',
    externalId: 'order-101',
    payer: { partyIdType: 'MSISDN', partyId: '256771234567' },
    payerMessage: 'Payment for order 101',
    payeeNote: 'Order 101',
  });

  const status = await client.getRequestToPayStatus(requestId);
  console.log(status);
})();
```

### Check a user and get profile data

```ts
const info = await client.checkNames('256771234567');
console.log(info.name, info.gender, info.locale);
```

### Full payment flow

```ts
const { requestId } = await client.requestToPay({
  amount: '250',
  currency: 'UGX',
  externalId: 'invoice-42',
  payer: { partyIdType: 'MSISDN', partyId: '256771234567' },
  payerMessage: 'Invoice payment for #42',
  payeeNote: 'Invoice #42',
});

let status = await client.getRequestToPayStatus(requestId);
while (status.status === 'PENDING') {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  status = await client.getRequestToPayStatus(requestId);
}

if (status.status === 'SUCCESSFUL') {
  await client.sendDeliveryNotification({
    requestId,
    notificationMessage: 'Payment received successfully.',
  });
}
```

---

## API Reference

### `new MoMoClient(config)`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `baseUrl` | `string` | ✅ | MoMo API base URL |
| `apiUser` | `string` | ✅ | API user UUID |
| `apiKey` | `string` | ✅ | API key secret |
| `subscriptionKey` | `string` | ✅ | Collection product subscription key |
| `disbursementSubscriptionKey` | `string` | ✅ | Disbursement product subscription key |
| `targetEnvironment` | `'sandbox' \| 'production'` | ✅ | Target environment |

---

### `generateAccessToken()`
`POST /collection/token/`

Generates a Bearer token. Tokens are cached and auto-refreshed 60 s before expiry. You rarely need to call this directly.

---

### `checkAccount(msisdn)`
`GET /disbursement/v1_0/accountholder/msisdn/{msisdn}/active`

Checks whether a mobile money account is active.

```ts
const { result } = await client.checkAccount('256771234567');
// result: true | false
```

---

### `checkNames(msisdn)`
`GET /disbursement/v1_0/accountholder/msisdn/{msisdn}/basicuserinfo`

Retrieves basic profile info for an MSISDN holder.

```ts
const info = await client.checkNames('256771234567');
// info.given_name, info.family_name, info.gender, ...
```

---

### `requestToPay(params)`
`POST /collection/v1_0/requesttopay`

Initiates a Request-to-Pay. Returns `202 Accepted` — poll `getRequestToPayStatus()` for the outcome.

| Param | Type | Required | Description |
|---|---|---|---|
| `amount` | `string` | ✅ | Amount to charge |
| `currency` | `string` | ✅ | ISO 4217 code (e.g. `"EUR"`) |
| `externalId` | `string` | ✅ | Your transaction reference |
| `payer` | `Party` | ✅ | `{ partyIdType: 'MSISDN', partyId: '...' }` |
| `payerMessage` | `string` | ✅ | Message shown to payer |
| `payeeNote` | `string` | ✅ | Internal note |
| `requestId` | `string` | — | Custom UUID (auto-generated if omitted) |
| `callbackUrl` | `string` | — | Webhook for async notification |

---

### `getRequestToPayStatus(requestId)`
`GET /collection/v1_0/requesttopay/{requestId}`

Polls the status of a Request-to-Pay. Status values: `PENDING` · `SUCCESSFUL` · `FAILED`.

---

### `sendDeliveryNotification(params)`
`POST /collection/v1_0/requesttopay/{requestId}/deliverynotification`

Sends a delivery notification to the payer. `notificationMessage` must be ≤ 160 characters.

---

### `refund(params)`
`POST /disbursement/v1_0/refund`

Initiates a refund. Returns `202 Accepted` — poll `getRefundStatus()` for the outcome.

| Param | Type | Required | Description |
|---|---|---|---|
| `amount` | `string` | ✅ | Amount to refund |
| `currency` | `string` | ✅ | ISO 4217 code |
| `externalId` | `string` | ✅ | Your refund reference |
| `payerMessage` | `string` | ✅ | Message shown to payer |
| `payeeNote` | `string` | ✅ | Internal note |
| `referenceIdToRefund` | `string` | ✅ | The original `requestId` from `requestToPay()` |
| `requestId` | `string` | — | Custom UUID (auto-generated if omitted) |
| `callbackUrl` | `string` | — | Webhook for async notification |

---

### `getRefundStatus(requestIdRefund)`
`GET /disbursement/v1_0/refund/{requestIdRefund}`

Polls the status of a refund. Status values: `PENDING` · `SUCCESSFUL` · `FAILED`.

---

## Error Handling

All methods throw `MoMoError` on failure:

```ts
import { MoMoClient, MoMoError } from './dist/index.js';

try {
  const status = await client.getRequestToPayStatus('invalid-id');
} catch (err) {
  if (err instanceof MoMoError) {
    console.error(err.message);      // '[MoMo] getRequestToPayStatus failed (HTTP 404)'
    console.error(err.statusCode);   // 404
    console.error(err.body);         // Raw API error body
  }
}
```

| HTTP Status | Meaning |
|---|---|
| `400` | Bad Request — invalid parameters |
| `401` | Unauthorized — invalid or expired token |
| `404` | Not Found — requestId or MSISDN does not exist |
| `409` | Conflict — duplicate X-Reference-Id |
| `500` | Internal Server Error |

---

## Project Structure

```
src/
  types.ts        — All TypeScript interfaces and types
  MoMoClient.ts   — Main SDK class (8 methods)
  index.ts        — Public barrel export
dist/             — Compiled output (after npm run build)
postman/
  collections/    — MoMo Get Paid Postman collection
  environments/   — MoMo Get Paid environment
  documents/      — API documentation
```

---

*Generated from the MoMo Get Paid Postman collection · MTN Mobile Money*
