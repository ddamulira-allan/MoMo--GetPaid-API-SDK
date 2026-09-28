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
import { MoMoClientConfig, AccessTokenResponse, CheckAccountResponse, BasicUserInfo, RequestToPayParams, RequestToPayResult, RequestToPayStatus, DeliveryNotificationParams, RefundParams, RefundResult, RefundStatus, MoMoErrorDetails } from './types.js';
/** Structured error thrown by all MoMoClient methods. */
export declare class MoMoError extends Error {
    readonly statusCode?: number | undefined;
    readonly body?: unknown;
    readonly cause?: Error | undefined;
    constructor(message: string, details?: MoMoErrorDetails);
}
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
export declare class MoMoClient {
    private readonly baseUrl;
    private readonly apiUser;
    private readonly apiKey;
    private readonly subscriptionKey;
    private readonly disbursementSubscriptionKey;
    private readonly targetEnvironment;
    /** Token cache — refreshed automatically 60 s before expiry. */
    private tokenCache;
    /** Buffer (ms) before token expiry to trigger a refresh. */
    private static readonly TOKEN_BUFFER_MS;
    constructor(config: MoMoClientConfig);
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
    generateAccessToken(): Promise<AccessTokenResponse>;
    /**
     * Returns a valid Bearer token string, refreshing it automatically when
     * it is missing or within 60 seconds of expiry.
     *
     * @private
     */
    getAccessToken(): Promise<string>;
    /**
     * Check whether a mobile money account (MSISDN) is active.
     *
     * **Endpoint:** `GET /disbursement/v1_0/accountholder/msisdn/{msisdn}/active`
     *
     * @param msisdn - The mobile number to check (e.g. `"256771234567"`).
     * @returns `{ result: true }` if active, `{ result: false }` otherwise.
     */
    checkAccount(msisdn: string): Promise<CheckAccountResponse>;
    /**
     * Retrieve basic profile information for an MSISDN holder.
     *
     * **Endpoint:** `GET /disbursement/v1_0/accountholder/msisdn/{msisdn}/basicuserinfo`
     *
     * @param msisdn - The mobile number to look up.
     * @returns User info including `given_name`, `family_name`, `gender`, etc.
     */
    checkNames(msisdn: string): Promise<BasicUserInfo>;
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
    requestToPay(params: RequestToPayParams): Promise<RequestToPayResult>;
    /**
     * Get the status of a previously initiated Request-to-Pay transaction.
     *
     * **Endpoint:** `GET /collection/v1_0/requesttopay/{requestId}`
     *
     * @param requestId - The UUID returned by `requestToPay()`.
     * @returns Full payment status object. Check `status` for `"PENDING"`,
     *          `"SUCCESSFUL"`, or `"FAILED"`.
     */
    getRequestToPayStatus(requestId: string): Promise<RequestToPayStatus>;
    /**
     * Send a delivery notification to the payer after a completed transaction.
     *
     * **Endpoint:** `POST /collection/v1_0/requesttopay/{requestId}/deliverynotification`
     *
     * @param params.requestId - The UUID from the original `requestToPay()` call.
     * @param params.notificationMessage - Message to deliver. Max 160 characters.
     */
    sendDeliveryNotification(params: DeliveryNotificationParams): Promise<void>;
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
    refund(params: RefundParams): Promise<RefundResult>;
    /**
     * Get the status of a previously initiated refund.
     *
     * **Endpoint:** `GET /disbursement/v1_0/refund/{requestIdRefund}`
     *
     * @param requestIdRefund - The UUID returned by `refund()`.
     * @returns Full refund status object. Check `status` for `"PENDING"`,
     *          `"SUCCESSFUL"`, or `"FAILED"`.
     */
    getRefundStatus(requestIdRefund: string): Promise<RefundStatus>;
}
//# sourceMappingURL=MoMoClient.d.ts.map