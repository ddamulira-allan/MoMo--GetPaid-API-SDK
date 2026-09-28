# Changelog

All notable changes to `momo-get-paid-sdk` are documented here.

This project follows [Semantic Versioning](https://semver.org/) and
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/) conventions.

---

## [1.0.0] — 2026-09-26

### Added

- **`MoMoClient`** — main SDK class covering all 8 MTN MoMo Get Paid endpoints:
  - `generateAccessToken()` — `POST /collection/token/`
  - `checkAccount(msisdn)` — `GET /disbursement/v1_0/accountholder/msisdn/{msisdn}/active`
  - `checkNames(msisdn)` — `GET /disbursement/v1_0/accountholder/msisdn/{msisdn}/basicuserinfo`
  - `requestToPay(params)` — `POST /collection/v1_0/requesttopay`
  - `getRequestToPayStatus(requestId)` — `GET /collection/v1_0/requesttopay/{requestId}`
  - `sendDeliveryNotification(params)` — `POST /collection/v1_0/requesttopay/{requestId}/deliverynotification`
  - `refund(params)` — `POST /disbursement/v1_0/refund`
  - `getRefundStatus(requestIdRefund)` — `GET /disbursement/v1_0/refund/{requestIdRefund}`
- **`MoMoError`** — structured error class with `statusCode`, `body`, and `cause` fields.
- **Full TypeScript types** — `MoMoClientConfig`, `RequestToPayParams`, `RequestToPayStatus`,
  `RefundParams`, `RefundStatus`, `BasicUserInfo`, `TransactionStatus`, and more.
- **Automatic token caching** — tokens are refreshed 60 seconds before expiry with no manual intervention required.
- **Zero runtime dependencies** — uses Node.js built-in `fetch` (≥ 18) and `crypto.randomUUID()`.
- **Dual ESM + CJS build** — works with both `import` and `require()`.
- **npm provenance** — published with `--provenance` for supply-chain transparency.
- **GitHub Actions CI pipeline** — automated build, type-check, and publish on version tag push.

---

[1.0.0]: https://github.com/your-org/momo-get-paid-sdk/releases/tag/v1.0.0
