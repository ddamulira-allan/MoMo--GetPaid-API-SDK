# MoMo API GetPaid SDK

This repository contains the MTN MoMo Get Paid SDK and supporting examples for integrating MoMo Collection and Disbursement flows in Node.js and TypeScript projects.

It includes:

- A TypeScript SDK package under [API SDK](API%20SDK)
- A demo e-commerce checkout app
- Postman collection files and API documentation
- Generated source and build output for the SDK

---

## Repository structure

```text
MoMo--GetPaid-API-SDK/
├── README.md
├── API SDK/
│   ├── README.md
│   ├── package.json
│   ├── src/
│   ├── ecommerce/
│   ├── postman/
│   ├── demo-app.js
│   ├── demo-app.mjs
│   └── MoMoGetPaidSDK.js
└── .git/
```

---

## About the SDK

The SDK provides helper methods for the most common MTN MoMo Get Paid API actions, including:

- generating an access token
- checking account status
- retrieving account holder info
- initiating a Request to Pay
- polling payment status
- sending notification messages
- processing refunds

The main client is exported from the SDK package as `MoMoClient`.

---

## Getting started

From the project root:

```bash
cd "API SDK"
npm install
npm run build
```

This builds the SDK output into the `dist/` folder so it can be imported in Node or TypeScript projects.

> Node.js 18 or later is required.

---

## Quick example

```ts
import { MoMoClient } from './dist/esm/index.js';

const client = new MoMoClient({
  baseUrl: 'https://sandbox.momodeveloper.mtn.com',
  apiUser: 'your-api-user-uuid',
  apiKey: 'your-api-key',
  subscriptionKey: 'your-collection-subscription-key',
  disbursementSubscriptionKey: 'your-disbursement-subscription-key',
  targetEnvironment: 'sandbox',
});

const { requestId } = await client.requestToPay({
  amount: '100',
  currency: 'EUR',
  externalId: 'order-001',
  payer: { partyIdType: 'MSISDN', partyId: '256771234567' },
  payerMessage: 'Payment for order #001',
  payeeNote: 'Order #001',
});

const status = await client.getRequestToPayStatus(requestId);
console.log(status.status);
```

---

## Demo application

The repository includes a local storefront sample under [API SDK/ecommerce](API%20SDK/ecommerce) that uses the SDK to process MoMo payments from a server-side checkout flow.

To run it:

```bash
cd "API SDK"
npm run build
npm run start:shop
```

Then open:

```text
http://localhost:3000
```

The demo is intended for sandbox testing and local development.

---

## Environment variables

For production or sandbox examples, keep credentials in a private environment file such as `.env` and do not expose them in frontend code.

Typical values used by the SDK are:

- `MOMO_API_USER`
- `MOMO_API_KEY`
- `MOMO_COLLECTION_KEY`
- `MOMO_DISBURSEMENT_KEY`

---

## Documentation

The SDK package also contains a detailed package-level README in [API SDK/README.md](API%20SDK/README.md), which includes further API examples and usage notes.

The Postman collection under [API SDK/postman](API%20SDK/postman) can be used as a reference for the underlying MTN MoMo Get Paid endpoints.

---

## Notes

- This project is for MTN MoMo Get Paid API integration.
- Use sandbox credentials for testing before moving to production.
- Follow the official MoMo developer documentation for live environment setup and security requirements.


