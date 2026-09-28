/**
 * MoMoGetPaidSDK.js
 * Production-ready Node.js SDK for the MoMo Get Paid API.
 *
 * Endpoints covered:
 *   1. generateAccessToken   – POST /collection/token/
 *   2. checkAccount          – GET  /disbursement/v1_0/accountholder/msisdn/{msisdn}/active
 *   3. checkNames            – GET  /disbursement/v1_0/accountholder/msisdn/{msisdn}/basicuserinfo
 *   4. requestToPay          – POST /collection/v1_0/requesttopay
 *   5. getRequestToPayStatus – GET  /collection/v1_0/requesttopay/{requestId}
 *   6. sendDeliveryNotification – POST /collection/v1_0/requesttopay/{requestId}/deliverynotification
 *   7. refund                – POST /disbursement/v1_0/refund
 *   8. getRefundStatus       – GET  /disbursement/v1_0/refund/{requestIdRefund}
 *
 * Install dependencies:
 *   npm install axios uuid
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build a human-readable error from an Axios error response
// ─────────────────────────────────────────────────────────────────────────────
function buildError(context, err) {
  const status = err.response?.status;
  const data   = err.response?.data;
  const msg    = data?.message || data?.error || err.message || 'Unknown error';
  const error  = new Error(`[MoMoSDK] ${context} failed (HTTP ${status ?? 'N/A'}): ${msg}`);
  error.status   = status;
  error.response = data;
  throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main SDK Class
// ─────────────────────────────────────────────────────────────────────────────
class MoMoGetPaidSDK {

  /**
   * Create a new MoMoGetPaidSDK instance.
   *
   * @param {object} config
   * @param {string} config.baseUrl                    - MoMo API base URL (e.g. https://sandbox.momodeveloper.mtn.com)
   * @param {string} config.subscriptionKey            - Ocp-Apim-Subscription-Key for Collection endpoints
   * @param {string} config.targetEnvironment          - "sandbox" or "production"
   * @param {string} config.disbursementSubscriptionKey - Ocp-Apim-Subscription-Key for Disbursement/Refund endpoints
   * @param {string} [config.apiUser]                  - API user UUID (can also be passed per-call)
   * @param {string} [config.apiKey]                   - API key secret (can also be passed per-call)
   */
  constructor({
    baseUrl,
    subscriptionKey,
    targetEnvironment,
    disbursementSubscriptionKey,
    apiUser,
    apiKey,
  }) {
    if (!baseUrl)                    throw new Error('[MoMoSDK] config.baseUrl is required');
    if (!subscriptionKey)            throw new Error('[MoMoSDK] config.subscriptionKey is required');
    if (!targetEnvironment)          throw new Error('[MoMoSDK] config.targetEnvironment is required');
    if (!disbursementSubscriptionKey) throw new Error('[MoMoSDK] config.disbursementSubscriptionKey is required');

    this.baseUrl                     = baseUrl.replace(/\/$/, ''); // strip trailing slash
    this.subscriptionKey             = subscriptionKey;
    this.targetEnvironment           = targetEnvironment;
    this.disbursementSubscriptionKey = disbursementSubscriptionKey;
    this._apiUser                    = apiUser;
    this._apiKey                     = apiKey;

    /** @private Token cache */
    this._tokenCache = { token: null, expiresAt: null };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. generateAccessToken
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Generate a Bearer access token using Basic Auth (apiUser:apiKey).
   * Tokens are valid for the duration returned in `expires_in` (seconds).
   *
   * @param {string} [apiUser] - Override instance apiUser
   * @param {string} [apiKey]  - Override instance apiKey
   * @returns {Promise<{ access_token: string, token_type: string, expires_in: number }>}
   */
  async generateAccessToken(apiUser, apiKey) {
    const user = apiUser || this._apiUser;
    const key  = apiKey  || this._apiKey;
    if (!user || !key) throw new Error('[MoMoSDK] apiUser and apiKey are required to generate a token');

    try {
      const response = await axios.post(
        `${this.baseUrl}/collection/token/`,
        {},
        {
          auth: { username: user, password: key },
          headers: {
            'Ocp-Apim-Subscription-Key': this.subscriptionKey,
          },
        }
      );
      return response.data;
    } catch (err) {
      buildError('generateAccessToken', err);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Internal: _getAccessToken  (with caching + auto-refresh)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Returns a valid Bearer token, refreshing it if expired or missing.
   * Uses a 60-second buffer before the actual expiry to avoid edge cases.
   *
   * @private
   * @returns {Promise<string>} The raw access_token string
   */
  async _getAccessToken() {
    const now = Date.now();
    const BUFFER_MS = 60 * 1000; // 60-second safety buffer

    if (
      this._tokenCache.token &&
      this._tokenCache.expiresAt &&
      now < this._tokenCache.expiresAt - BUFFER_MS
    ) {
      return this._tokenCache.token;
    }

    // Token missing or about to expire — fetch a fresh one
    const tokenData = await this.generateAccessToken();
    this._tokenCache.token     = tokenData.access_token;
    this._tokenCache.expiresAt = now + tokenData.expires_in * 1000;
    return this._tokenCache.token;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. checkAccount
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Check whether a mobile money account (MSISDN) is active.
   *
   * @param {string} msisdn - The mobile number to check (e.g. "256771234567")
   * @returns {Promise<{ result: boolean }>}
   */
  async checkAccount(msisdn) {
    if (!msisdn) throw new Error('[MoMoSDK] msisdn is required for checkAccount');
    const token = await this._getAccessToken();

    try {
      const response = await axios.get(
        `${this.baseUrl}/disbursement/v1_0/accountholder/msisdn/${msisdn}/active`,
        {
          headers: {
            'Authorization':              `Bearer ${token}`,
            'X-Target-Environment':        this.targetEnvironment,
            'Ocp-Apim-Subscription-Key':   this.disbursementSubscriptionKey,
          },
        }
      );
      return response.data;
    } catch (err) {
      buildError('checkAccount', err);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. checkNames
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Retrieve basic user info (name, gender, locale, etc.) for an MSISDN.
   *
   * @param {string} msisdn - The mobile number to look up
   * @returns {Promise<{ sub, name, given_name, family_name, birthdate, locale, gender, updated_at }>}
   */
  async checkNames(msisdn) {
    if (!msisdn) throw new Error('[MoMoSDK] msisdn is required for checkNames');
    const token = await this._getAccessToken();

    try {
      const response = await axios.get(
        `${this.baseUrl}/disbursement/v1_0/accountholder/msisdn/${msisdn}/basicuserinfo`,
        {
          headers: {
            'Authorization':              `Bearer ${token}`,
            'X-Target-Environment':        this.targetEnvironment,
            'Ocp-Apim-Subscription-Key':   this.disbursementSubscriptionKey,
          },
        }
      );
      return response.data;
    } catch (err) {
      buildError('checkNames', err);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. requestToPay
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Initiate a Request-to-Pay transaction.
   * Returns 202 Accepted on success (no response body).
   * Poll getRequestToPayStatus() with the same requestId to track the outcome.
   *
   * @param {object} params
   * @param {string}  params.amount        - Amount to charge
   * @param {string}  params.currency      - ISO currency code (e.g. "EUR", "UGX")
   * @param {string}  params.externalId    - Your own transaction reference
   * @param {object}  params.payer         - { partyIdType: "MSISDN", partyId: "256771234567" }
   * @param {string}  params.payerMessage  - Message shown to the payer
   * @param {string}  params.payeeNote     - Internal note for the payee
   * @param {string}  [params.requestId]   - UUID for X-Reference-Id (auto-generated if omitted)
   * @param {string}  [params.callbackUrl] - Optional webhook URL for async notification
   * @returns {Promise<{ requestId: string }>} The requestId used (for status polling)
   */
  async requestToPay({
    amount,
    currency,
    externalId,
    payer,
    payerMessage,
    payeeNote,
    requestId,
    callbackUrl,
  }) {
    if (!amount || !currency || !externalId || !payer)
      throw new Error('[MoMoSDK] amount, currency, externalId, and payer are required for requestToPay');

    const token = await this._getAccessToken();
    const refId  = requestId || uuidv4();

    const headers = {
      'Authorization':              `Bearer ${token}`,
      'X-Reference-Id':             refId,
      'X-Target-Environment':        this.targetEnvironment,
      'Ocp-Apim-Subscription-Key':   this.subscriptionKey,
      'Content-Type':               'application/json',
    };
    if (callbackUrl) headers['X-Callback-Url'] = callbackUrl;

    try {
      await axios.post(
        `${this.baseUrl}/collection/v1_0/requesttopay`,
        { amount, currency, externalId, payer, payerMessage, payeeNote },
        { headers }
      );
      return { requestId: refId };
    } catch (err) {
      buildError('requestToPay', err);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. getRequestToPayStatus
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get the status of a previously initiated Request-to-Pay transaction.
   *
   * @param {string} requestId - The UUID returned by requestToPay()
   * @returns {Promise<object>} Payment status object (status, amount, currency, payer, …)
   */
  async getRequestToPayStatus(requestId) {
    if (!requestId) throw new Error('[MoMoSDK] requestId is required for getRequestToPayStatus');
    const token = await this._getAccessToken();

    try {
      const response = await axios.get(
        `${this.baseUrl}/collection/v1_0/requesttopay/${requestId}`,
        {
          headers: {
            'Authorization':              `Bearer ${token}`,
            'X-Target-Environment':        this.targetEnvironment,
            'Ocp-Apim-Subscription-Key':   this.subscriptionKey,
          },
        }
      );
      return response.data;
    } catch (err) {
      buildError('getRequestToPayStatus', err);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 6. sendDeliveryNotification
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Send a delivery notification for a completed Request-to-Pay transaction.
   *
   * @param {string} requestId           - The UUID of the original requestToPay
   * @param {string} notificationMessage - Message to deliver (max 160 chars)
   * @returns {Promise<object>} Notification response
   */
  async sendDeliveryNotification(requestId, notificationMessage) {
    if (!requestId || !notificationMessage)
      throw new Error('[MoMoSDK] requestId and notificationMessage are required for sendDeliveryNotification');
    const token = await this._getAccessToken();

    try {
      const response = await axios.post(
        `${this.baseUrl}/collection/v1_0/requesttopay/${requestId}/deliverynotification`,
        { notificationMessage },
        {
          headers: {
            'Authorization':              `Bearer ${token}`,
            'X-Target-Environment':        this.targetEnvironment,
            'Ocp-Apim-Subscription-Key':   this.subscriptionKey,
            'Content-Type':               'application/json',
          },
        }
      );
      return response.data;
    } catch (err) {
      buildError('sendDeliveryNotification', err);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 7. refund
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Initiate a refund for a previously completed collection transaction.
   * Returns 202 Accepted on success (no response body).
   *
   * @param {object} params
   * @param {string}  params.amount               - Amount to refund
   * @param {string}  params.currency             - ISO currency code
   * @param {string}  params.externalId           - Your own refund reference
   * @param {string}  params.payerMessage         - Message shown to the payer
   * @param {string}  params.payeeNote            - Internal note for the payee
   * @param {string}  params.referenceIdToRefund  - The original requestToPay UUID to refund
   * @param {string}  [params.requestId]          - UUID for X-Reference-Id (auto-generated if omitted)
   * @param {string}  [params.callbackUrl]        - Optional webhook URL for async notification
   * @returns {Promise<{ requestId: string }>} The requestId used (for refund status polling)
   */
  async refund({
    amount,
    currency,
    externalId,
    payerMessage,
    payeeNote,
    referenceIdToRefund,
    requestId,
    callbackUrl,
  }) {
    if (!amount || !currency || !externalId || !referenceIdToRefund)
      throw new Error('[MoMoSDK] amount, currency, externalId, and referenceIdToRefund are required for refund');

    const token = await this._getAccessToken();
    const refId  = requestId || uuidv4();

    const headers = {
      'Authorization':              `Bearer ${token}`,
      'X-Reference-Id':             refId,
      'X-Target-Environment':        this.targetEnvironment,
      'Ocp-Apim-Subscription-Key':   this.disbursementSubscriptionKey,
      'Content-Type':               'application/json',
    };
    if (callbackUrl) headers['X-Callback-Url'] = callbackUrl;

    try {
      await axios.post(
        `${this.baseUrl}/disbursement/v1_0/refund`,
        { amount, currency, externalId, payerMessage, payeeNote, referenceIdToRefund },
        { headers }
      );
      return { requestId: refId };
    } catch (err) {
      buildError('refund', err);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 8. getRefundStatus
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get the status of a previously initiated refund.
   *
   * @param {string} requestIdRefund - The UUID returned by refund()
   * @returns {Promise<object>} Refund status object
   */
  async getRefundStatus(requestIdRefund) {
    if (!requestIdRefund) throw new Error('[MoMoSDK] requestIdRefund is required for getRefundStatus');
    const token = await this._getAccessToken();

    try {
      const response = await axios.get(
        `${this.baseUrl}/disbursement/v1_0/refund/${requestIdRefund}`,
        {
          headers: {
            'Authorization':              `Bearer ${token}`,
            'X-Target-Environment':        this.targetEnvironment,
            'Ocp-Apim-Subscription-Key':   this.disbursementSubscriptionKey,
          },
        }
      );
      return response.data;
    } catch (err) {
      buildError('getRefundStatus', err);
    }
  }

} // end class MoMoGetPaidSDK

module.exports = MoMoGetPaidSDK;