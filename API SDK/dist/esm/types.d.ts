/**
 * types.ts
 * All request and response interfaces for the MoMo Get Paid TypeScript SDK.
 * Derived from the MoMo Get Paid Postman collection.
 */
/** Configuration required to instantiate the MoMoClient. */
export interface MoMoClientConfig {
    /** MoMo API base URL. Default: https://sandbox.momodeveloper.mtn.com */
    baseUrl: string;
    /** API user UUID — from the MoMo Developer Portal. */
    apiUser: string;
    /** API key secret — from the MoMo Developer Portal. */
    apiKey: string;
    /** Ocp-Apim-Subscription-Key for the Collection product. */
    subscriptionKey: string;
    /** Ocp-Apim-Subscription-Key for the Disbursement product. */
    disbursementSubscriptionKey: string;
    /** Target environment: "sandbox" or "production". */
    targetEnvironment: 'sandbox' | 'production';
}
/** Response from POST /collection/token/ */
export interface AccessTokenResponse {
    /** Bearer token string. */
    access_token: string;
    /** Always "access_token". */
    token_type: string;
    /** Token lifetime in seconds. */
    expires_in: number;
}
/** Internal token cache entry. */
export interface TokenCache {
    token: string | null;
    /** Unix timestamp (ms) when the token expires. */
    expiresAt: number | null;
}
/** Response from GET /disbursement/v1_0/accountholder/msisdn/{msisdn}/active */
export interface CheckAccountResponse {
    /** true if the account is active and can transact, false otherwise. */
    result: boolean;
}
/** Response from GET /disbursement/v1_0/accountholder/msisdn/{msisdn}/basicuserinfo */
export interface BasicUserInfo {
    /** Subject identifier. */
    sub: string;
    /** Full display name. */
    name?: string;
    /** Given (first) name. */
    given_name?: string;
    /** Family (last) name. */
    family_name?: string;
    /** Date of birth (YYYY-MM-DD). */
    birthdate?: string;
    /** Locale code (e.g. "sv_SE"). */
    locale?: string;
    /** Gender: "MALE" | "FEMALE" | "UNKNOWN". */
    gender?: 'MALE' | 'FEMALE' | 'UNKNOWN';
    /** Unix timestamp of last profile update. */
    updated_at?: number;
}
/** Party identifier used in payer/payee fields. */
export interface Party {
    /** Always "MSISDN" for mobile money. */
    partyIdType: 'MSISDN';
    /** Mobile number (e.g. "256771234567"). */
    partyId: string;
}
/** Parameters for POST /collection/v1_0/requesttopay */
export interface RequestToPayParams {
    /** Amount to charge (as a string, e.g. "100"). */
    amount: string;
    /** ISO 4217 currency code (e.g. "EUR", "UGX"). */
    currency: string;
    /** Your own unique transaction reference. */
    externalId: string;
    /** Payer's party details. */
    payer: Party;
    /** Message shown to the payer on their phone. */
    payerMessage: string;
    /** Internal note for the payee. */
    payeeNote: string;
    /**
     * UUID to use as X-Reference-Id.
     * Auto-generated with crypto.randomUUID() if omitted.
     */
    requestId?: string;
    /** Optional webhook URL for async payment notification. */
    callbackUrl?: string;
}
/** Return value of requestToPay() — the reference ID used for polling. */
export interface RequestToPayResult {
    /** The UUID sent as X-Reference-Id. Use this to poll getRequestToPayStatus(). */
    requestId: string;
}
/** Transaction status enum. */
export type TransactionStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED';
/** Response from GET /collection/v1_0/requesttopay/{requestId} */
export interface RequestToPayStatus {
    /** MoMo's internal financial transaction ID (present when SUCCESSFUL). */
    financialTransactionId?: string;
    /** Your externalId from the original request. */
    externalId: string;
    /** Charged amount. */
    amount: string;
    /** ISO 4217 currency code. */
    currency: string;
    /** Payer details. */
    payer: Party;
    /** Message shown to the payer. */
    payerMessage: string;
    /** Internal note for the payee. */
    payeeNote: string;
    /** Current transaction status. */
    status: TransactionStatus;
    /** Error reason if status is FAILED. */
    reason?: string;
}
/** Parameters for POST /collection/v1_0/requesttopay/{requestId}/deliverynotification */
export interface DeliveryNotificationParams {
    /** The requestId from the original requestToPay() call. */
    requestId: string;
    /** Message to deliver to the payer. Max 160 characters. */
    notificationMessage: string;
}
/** Parameters for POST /disbursement/v1_0/refund */
export interface RefundParams {
    /** Amount to refund (as a string). */
    amount: string;
    /** ISO 4217 currency code. */
    currency: string;
    /** Your own unique refund reference. */
    externalId: string;
    /** Message shown to the payer. */
    payerMessage: string;
    /** Internal note for the payee. */
    payeeNote: string;
    /** The original requestId (X-Reference-Id) from the requestToPay() call. */
    referenceIdToRefund: string;
    /**
     * UUID to use as X-Reference-Id for this refund.
     * Auto-generated with crypto.randomUUID() if omitted.
     */
    requestId?: string;
    /** Optional webhook URL for async refund notification. */
    callbackUrl?: string;
}
/** Return value of refund() — the reference ID used for polling. */
export interface RefundResult {
    /** The UUID sent as X-Reference-Id. Use this to poll getRefundStatus(). */
    requestIdRefund: string;
}
/** Response from GET /disbursement/v1_0/refund/{requestIdRefund} */
export interface RefundStatus {
    /** MoMo's internal financial transaction ID (present when SUCCESSFUL). */
    financialTransactionId?: string;
    /** Your externalId from the original refund request. */
    externalId: string;
    /** Refunded amount. */
    amount: string;
    /** ISO 4217 currency code. */
    currency: string;
    /** Payee details. */
    payee?: Party;
    /** Message shown to the payer. */
    payerMessage: string;
    /** Internal note for the payee. */
    payeeNote: string;
    /** Current refund status. */
    status: TransactionStatus;
    /** Error reason if status is FAILED. */
    reason?: string;
}
/** Structured error thrown by MoMoClient methods. */
export interface MoMoErrorDetails {
    /** HTTP status code, or undefined for network errors. */
    statusCode?: number;
    /** Raw error body from the API. */
    body?: unknown;
    /** Original Error object. */
    cause?: Error;
}
//# sourceMappingURL=types.d.ts.map