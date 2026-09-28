/**
 * MoMoClient.ts
 * TypeScript SDK for the MTN MoMo Get Paid API.
 * Generated from the MoMo Get Paid Postman collection.
 *
 * Endpoints:
 *   1. generateAccessToken   – POST /collection/token/
 *   2. checkAccount          – GET  /disbursement/v1_0/accountholder/msisdn/{msisdn}/active
 *   3. checkNames            – GET  /disbursement/v1_0/accountholder/msisdn/{msisdn}/basicuserinfo
 *   4. requestToPay          – POST /collection/v1_0/requesttopay
 *   5. getRequestToPayStatus – GET  /collection/v1_0/requesttopay/{requestId}
 *   6. sendDeliveryNotification – POST /collection/v1_0/requesttopay/{requestId}/deliverynotification
 *   7. refund                – POST /disbursement/v1_0/refund
 *   8. getRefundStatus       – GET  /disbursement/v1_0/refund/{requestIdRefund}
 */

import { randomUUID as nodeRandomUUID } from 'node:crypto';

import {
  MoMoClientConfig,
  AccessTokenResponse,
  TokenCache,
  CheckAccountResponse,
  BasicUserInfo,
  RequestToPayParams,
  RequestToPayResult,
  RequestToPayStatus,
  DeliveryNotificationParams,
  RefundParams,
  RefundResult,
  RefundStatus,
  MoMoErrorDetails,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// MoMoError
// ─────────────────────────────────────────────────────────────────────────────

/** Structured error thrown by all MoMoClient methods. */
export class MoMoError extends Error {
  public readonly statusCode?: number | undefined;
  public readonly body?: unknown;
  public override readonly cause?: Error | undefined;

  constructor(message: string, details: MoMoErrorDetails = {}) {
    super(message);
    this.name = 'MoMoError';
    this.statusCode = details.statusCode;
    this.body = details.body;
    this.cause = details.cause;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a UUID v4 using the built-in crypto module (Node 18+ / browsers). */
function randomUUID(): string {
  // Node 19+ and all modern browsers expose crypto.randomUUID()
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return nodeRandomUUID();
}

/**
 * Perform a fetch request and return the parsed JSON body (or null for empty bodies).
 * Throws MoMoError on non-2xx responses.
 */
async function apiFetch<T>(
  url: string,
  options: RequestInit,
  context: string,
): Promise<T | null> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    throw new MoMoError(`[MoMo] ${context}: network error — ${(err as Error).message}`, {
      cause: err as Error,
    });
  }

  if (!response.ok) {
    let body: unknown;
    try { body = await response.json(); } catch { body = await response.text().catch(() => ''); }
    throw new MoMoError(
      `[MoMo] ${context} failed (HTTP ${response.status})`,
      { statusCode: response.status, body },
    );
  }

  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MoMoClient
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Client for the MTN MoMo Get Paid API.
 *
 * @example
 * ```ts
 * const client = new MoMoClient({
 *   baseUrl: 'https://sandbox.momodeveloper.mtn.com',
 *   apiUser: 'your-api-user-uuid',
 *   apiKey: 'your-api-key',
 *   subscriptionKey: 'your-collection-subscription-key',
 *   disbursementSubscriptionKey: 'your-disbursement-subscription-key',
 *   targetEnvironment: 'sandbox',
 * });
 *
 * const { requestId } = await client.requestToPay({
 *   amount: '100',
 *   currency: 'EUR',
 *   externalId: 'order-001',
 *   payer: { partyIdType: 'MSISDN', partyId: '256771234567' },
 *   payerMessage: 'Payment for order #001',
 *   payeeNote: 'Order #001',
 * });
 *
 * const status = await client.getRequestToPayStatus(requestId);
 * console.log(status.status); // 'SUCCESSFUL'
 * ```
 */
export class MoMoClient {
  private readonly baseUrl: string;
  private readonly apiUser: string;
  private readonly apiKey: string;
  private readonly subscriptionKey: string;
  private readonly disbursementSubscriptionKey: string;
  private readonly targetEnvironment: string;

  /** Token cache — refreshed automatically 60 s before expiry. */
  private tokenCache: TokenCache = { token: null, expiresAt: null };

  /** Buffer (ms) before token expiry to trigger a refresh. */
  private static readonly TOKEN_BUFFER_MS = 60_000;

  constructor(config: MoMoClientConfig) {
    if (!config.baseUrl)                       throw new Error('[MoMo] config.baseUrl is required');
    if (!config.apiUser)                       throw new Error('[MoMo] config.apiUser is required');
    if (!config.apiKey)                        throw new Error('[MoMo] config.apiKey is required');
    if (!config.subscriptionKey)               throw new Error('[MoMo] config.subscriptionKey is required');
    if (!config.disbursementSubscriptionKey)   throw new Error('[MoMo] config.disbursementSubscriptionKey is required');
    if (!config.targetEnvironment)             throw new Error('[MoMo] config.targetEnvironment is required');

    this.baseUrl                     = config.baseUrl.replace(/\/$/, '');
    this.apiUser                     = config.apiUser;
    this.apiKey                      = config.apiKey;
    this.subscriptionKey             = config.subscriptionKey;
    this.disbursementSubscriptionKey = config.disbursementSubscriptionKey;
    this.targetEnvironment           = config.targetEnvironment;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. generateAccessToken
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Generate a Bearer access token using HTTP Basic Auth (apiUser:apiKey).
   *
   * Tokens are valid for `expires_in` seconds. The client caches the token
   * and auto-refreshes it 60 seconds before expiry — you rarely need to call
   * this directly; use `getAccessToken()` instead.
   *
   * **Endpoint:** `POST /collection/token/`
   *
   * @returns The full token response including `access_token` and `expires_in`.
   */
  async generateAccessToken(): Promise<AccessTokenResponse> {
    const credentials = Buffer.from(`${this.apiUser}:${this.apiKey}`).toString('base64');

    const data = await apiFetch<AccessTokenResponse>(
      `${this.baseUrl}/collection/token/`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Ocp-Apim-Subscription-Key': this.subscriptionKey,
          'Content-Length': '0',
        },
      },
      'generateAccessToken',
    );

    if (!data) throw new MoMoError('[MoMo] generateAccessToken: empty response');
    return data;
  }

  /**
   * Returns a valid Bearer token string, refreshing it automatically when
   * it is missing or within 60 seconds of expiry.
   *
   * @private
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (
      this.tokenCache.token &&
      this.tokenCache.expiresAt &&
      now < this.tokenCache.expiresAt - MoMoClient.TOKEN_BUFFER_MS
    ) {
      return this.tokenCache.token;
    }

    const tokenData = await this.generateAccessToken();
    this.tokenCache = {
      token: tokenData.access_token,
      expiresAt: now + tokenData.expires_in * 1_000,
    };
    return this.tokenCache.token!;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. checkAccount
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Check whether a mobile money account (MSISDN) is active.
   *
   * **Endpoint:** `GET /disbursement/v1_0/accountholder/msisdn/{msisdn}/active`
   *
   * @param msisdn - The mobile number to check (e.g. `"256771234567"`).
   * @returns `{ result: true }` if active, `{ result: false }` otherwise.
   */
  async checkAccount(msisdn: string): Promise<CheckAccountResponse> {
    if (!msisdn) throw new MoMoError('[MoMo] checkAccount: msisdn is required');
    const token = await this.getAccessToken();

    const data = await apiFetch<CheckAccountResponse>(
      `${this.baseUrl}/disbursement/v1_0/accountholder/msisdn/${encodeURIComponent(msisdn)}/active`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Target-Environment': this.targetEnvironment,
          'Ocp-Apim-Subscription-Key': this.disbursementSubscriptionKey,
        },
      },
      'checkAccount',
    );

    if (!data) throw new MoMoError('[MoMo] checkAccount: empty response');
    return data;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. checkNames
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Retrieve basic profile information for an MSISDN holder.
   *
   * **Endpoint:** `GET /disbursement/v1_0/accountholder/msisdn/{msisdn}/basicuserinfo`
   *
   * @param msisdn - The mobile number to look up.
   * @returns User info including `given_name`, `family_name`, `gender`, etc.
   */
  async checkNames(msisdn: string): Promise<BasicUserInfo> {
    if (!msisdn) throw new MoMoError('[MoMo] checkNames: msisdn is required');
    const token = await this.getAccessToken();

    const data = await apiFetch<BasicUserInfo>(
      `${this.baseUrl}/disbursement/v1_0/accountholder/msisdn/${encodeURIComponent(msisdn)}/basicuserinfo`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Target-Environment': this.targetEnvironment,
          'Ocp-Apim-Subscription-Key': this.disbursementSubscriptionKey,
        },
      },
      'checkNames',
    );

    if (!data) throw new MoMoError('[MoMo] checkNames: empty response');
    return data;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. requestToPay
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Initiate a Request-to-Pay transaction.
   *
   * Returns `202 Accepted` immediately (async). Poll `getRequestToPayStatus()`
   * with the returned `requestId` to track the final outcome.
   *
   * **Endpoint:** `POST /collection/v1_0/requesttopay`
   *
   * @param params - Payment parameters.
   * @returns `{ requestId }` — the UUID used as `X-Reference-Id`.
   */
  async requestToPay(params: RequestToPayParams): Promise<RequestToPayResult> {
    const { amount, currency, externalId, payer, payerMessage, payeeNote, callbackUrl } = params;

    if (!amount || !currency || !externalId || !payer) {
      throw new MoMoError('[MoMo] requestToPay: amount, currency, externalId, and payer are required');
    }

    const token = await this.getAccessToken();
    const requestId = params.requestId ?? randomUUID();

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'X-Reference-Id': requestId,
      'X-Target-Environment': this.targetEnvironment,
      'Ocp-Apim-Subscription-Key': this.subscriptionKey,
      'Content-Type': 'application/json',
    };
    if (callbackUrl) headers['X-Callback-Url'] = callbackUrl;

    await apiFetch<null>(
      `${this.baseUrl}/collection/v1_0/requesttopay`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount, currency, externalId, payer, payerMessage, payeeNote }),
      },
      'requestToPay',
    );

    return { requestId };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. getRequestToPayStatus
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get the status of a previously initiated Request-to-Pay transaction.
   *
   * **Endpoint:** `GET /collection/v1_0/requesttopay/{requestId}`
   *
   * @param requestId - The UUID returned by `requestToPay()`.
   * @returns Full payment status object. Check `status` for `"PENDING"`,
   *          `"SUCCESSFUL"`, or `"FAILED"`.
   */
  async getRequestToPayStatus(requestId: string): Promise<RequestToPayStatus> {
    if (!requestId) throw new MoMoError('[MoMo] getRequestToPayStatus: requestId is required');
    const token = await this.getAccessToken();

    const data = await apiFetch<RequestToPayStatus>(
      `${this.baseUrl}/collection/v1_0/requesttopay/${encodeURIComponent(requestId)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Target-Environment': this.targetEnvironment,
          'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        },
      },
      'getRequestToPayStatus',
    );

    if (!data) throw new MoMoError('[MoMo] getRequestToPayStatus: empty response');
    return data;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 6. sendDeliveryNotification
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Send a delivery notification to the payer after a completed transaction.
   *
   * **Endpoint:** `POST /collection/v1_0/requesttopay/{requestId}/deliverynotification`
   *
   * @param params.requestId - The UUID from the original `requestToPay()` call.
   * @param params.notificationMessage - Message to deliver. Max 160 characters.
   */
  async sendDeliveryNotification(params: DeliveryNotificationParams): Promise<void> {
    const { requestId, notificationMessage } = params;

    if (!requestId) throw new MoMoError('[MoMo] sendDeliveryNotification: requestId is required');
    if (!notificationMessage) throw new MoMoError('[MoMo] sendDeliveryNotification: notificationMessage is required');
    if (notificationMessage.length > 160) {
      throw new MoMoError('[MoMo] sendDeliveryNotification: notificationMessage must be 160 characters or fewer');
    }

    const token = await this.getAccessToken();

    await apiFetch<null>(
      `${this.baseUrl}/collection/v1_0/requesttopay/${encodeURIComponent(requestId)}/deliverynotification`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Target-Environment': this.targetEnvironment,
          'Ocp-Apim-Subscription-Key': this.subscriptionKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationMessage }),
      },
      'sendDeliveryNotification',
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 7. refund
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Initiate a refund for a previously completed collection transaction.
   *
   * Returns `202 Accepted` immediately (async). Poll `getRefundStatus()`
   * with the returned `requestIdRefund` to track the final outcome.
   *
   * **Endpoint:** `POST /disbursement/v1_0/refund`
   *
   * @param params - Refund parameters. `referenceIdToRefund` must be the
   *                 `requestId` from the original `requestToPay()` call.
   * @returns `{ requestIdRefund }` — the UUID used as `X-Reference-Id`.
   */
  async refund(params: RefundParams): Promise<RefundResult> {
    const {
      amount, currency, externalId, payerMessage, payeeNote,
      referenceIdToRefund, callbackUrl,
    } = params;

    if (!amount || !currency || !externalId || !referenceIdToRefund) {
      throw new MoMoError('[MoMo] refund: amount, currency, externalId, and referenceIdToRefund are required');
    }

    const token = await this.getAccessToken();
    const requestIdRefund = params.requestId ?? randomUUID();

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'X-Reference-Id': requestIdRefund,
      'X-Target-Environment': this.targetEnvironment,
      'Ocp-Apim-Subscription-Key': this.disbursementSubscriptionKey,
      'Content-Type': 'application/json',
    };
    if (callbackUrl) headers['X-Callback-Url'] = callbackUrl;

    await apiFetch<null>(
      `${this.baseUrl}/disbursement/v1_0/refund`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount, currency, externalId, payerMessage, payeeNote, referenceIdToRefund }),
      },
      'refund',
    );

    return { requestIdRefund };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 8. getRefundStatus
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get the status of a previously initiated refund.
   *
   * **Endpoint:** `GET /disbursement/v1_0/refund/{requestIdRefund}`
   *
   * @param requestIdRefund - The UUID returned by `refund()`.
   * @returns Full refund status object. Check `status` for `"PENDING"`,
   *          `"SUCCESSFUL"`, or `"FAILED"`.
   */
  async getRefundStatus(requestIdRefund: string): Promise<RefundStatus> {
    if (!requestIdRefund) throw new MoMoError('[MoMo] getRefundStatus: requestIdRefund is required');
    const token = await this.getAccessToken();

    const data = await apiFetch<RefundStatus>(
      `${this.baseUrl}/disbursement/v1_0/refund/${encodeURIComponent(requestIdRefund)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Target-Environment': this.targetEnvironment,
          'Ocp-Apim-Subscription-Key': this.disbursementSubscriptionKey,
        },
      },
      'getRefundStatus',
    );

    if (!data) throw new MoMoError('[MoMo] getRefundStatus: empty response');
    return data;
  }
}
