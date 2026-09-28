const fs = require('fs');
const path = require('path');

function loadDotEnv() {
  const envPath = path.resolve(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  const contents = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();
    if (!key) continue;

    process.env[key] = value.replace(/^['"]|['"]$/g, '');
  }
}

loadDotEnv();

const sdkPath = path.resolve(__dirname, 'dist/cjs/index.cjs');
let MoMoClient;

try {
  ({ MoMoClient } = require(sdkPath));
} catch (error) {
  console.error('Build the SDK first before running this demo: npm run build');
  console.error(error.message);
  process.exit(1);
}

const config = {
  baseUrl: process.env.MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com',
  apiUser: process.env.MOMO_API_USER,
  apiKey: process.env.MOMO_API_KEY,
  subscriptionKey: process.env.MOMO_COLLECTION_KEY,
  disbursementSubscriptionKey: process.env.MOMO_DISBURSEMENT_KEY,
  targetEnvironment: process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox',
};

const msisdn = process.env.MOMO_MSISDN || '256771234567';
const amount = process.env.MOMO_DEMO_AMOUNT || '100';
const currency = process.env.MOMO_DEMO_CURRENCY || 'EUR';
const shouldRunLivePayments = (process.env.MOMO_RUN_LIVE_PAYMENTS || 'false').toLowerCase() === 'true';

function assertRequiredConfig() {
  const missing = [];
  for (const [key, value] of Object.entries(config)) {
    if (!value && key !== 'targetEnvironment') {
      missing.push(key);
    }
  }

  if (missing.length) {
    console.error('Missing required configuration values for the MoMo SDK.');
    console.error('Set the following environment variables in a .env file:');
    console.error(missing.join(', '));
    console.error('Example: copy .env.example to .env and fill in your values.');
    process.exit(1);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollRequestStatus(client, requestId) {
  let status = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    status = await client.getRequestToPayStatus(requestId);
    console.log(`Polling status (${attempt + 1}/20):`, status.status);

    if (status.status !== 'PENDING') {
      return status;
    }

    await sleep(3000);
  }

  return status;
}

async function runDemo() {
  assertRequiredConfig();
  const client = new MoMoClient(config);

  console.log('=== MoMo Get Paid SDK Demo ===');
  console.log('Using environment:', config.targetEnvironment);
  console.log('Checking account status...');

  try {
    const account = await client.checkAccount(msisdn);
    console.log('Account check result:', account);

    const profile = await client.checkNames(msisdn);
    console.log('Customer profile:', profile);
  } catch (error) {
    console.error('Account/profile lookup failed. Check your credentials and environment.');
    console.error(error.message);
    process.exit(1);
  }

  if (!shouldRunLivePayments) {
    console.log('Live payment mode is disabled. Set MOMO_RUN_LIVE_PAYMENTS=true to submit a real payment request.');
    console.log('Demo complete.');
    return;
  }

  console.log('Submitting payment request...');
  const paymentRequest = {
    amount,
    currency,
    externalId: `sdk-demo-${Date.now()}`,
    payer: {
      partyIdType: 'MSISDN',
      partyId: msisdn,
    },
    payerMessage: 'SDK demo payment',
    payeeNote: 'Demo transaction from MoMo SDK',
  };

  try {
    const { requestId } = await client.requestToPay(paymentRequest);
    console.log('Payment request created with requestId:', requestId);

    const finalStatus = await pollRequestStatus(client, requestId);
    console.log('Final payment status:', finalStatus);

    if (finalStatus && finalStatus.status === 'SUCCESSFUL') {
      console.log('Sending delivery notification...');
      const notification = await client.sendDeliveryNotification({
        requestId,
        notificationMessage: 'Your payment was received successfully.',
      });
      console.log('Delivery notification response:', notification);
    }

    console.log('Submitting refund request...');
    const refundRequest = {
      amount,
      currency,
      externalId: `sdk-demo-refund-${Date.now()}`,
      payerMessage: 'Refund for SDK demo',
      payeeNote: 'Refund created by SDK demo',
      referenceIdToRefund: requestId,
    };

    const { requestId: refundRequestId } = await client.refund(refundRequest);
    console.log('Refund request created with requestId:', refundRequestId);

    const refundStatus = await client.getRefundStatus(refundRequestId);
    console.log('Refund status:', refundStatus);
  } catch (error) {
    console.error('Live MoMo transaction failed.');
    console.error(error.message);
    process.exit(1);
  }
}

runDemo();
