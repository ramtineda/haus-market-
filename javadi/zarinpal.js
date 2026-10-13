// ============================================================
// JAVADI 2.0 – درگاه پرداخت زرین‌پال
// ============================================================
const SANDBOX = process.env.ZARINPAL_SANDBOX === 'true';
const MERCHANT_ID = process.env.ZARINPAL_MERCHANT_ID || '';

const BASE = SANDBOX
  ? 'https://sandbox.zarinpal.com'
  : 'https://payment.zarinpal.com';

const START_PAY_BASE = SANDBOX
  ? 'https://sandbox.zarinpal.com/pg/StartPay/'
  : 'https://payment.zarinpal.com/pg/StartPay/';

async function requestPayment(amountInRial, description, callbackUrl) {
  if (!MERCHANT_ID || MERCHANT_ID.startsWith('00000000')) {
    const fakeAuthority = 'DEMO-' + Date.now();
    console.log('⚠️  زرین‌پال در حالت آزمایشی – پرداخت واقعی انجام نمی‌شود');
    return {
      authority: fakeAuthority,
      paymentUrl: callbackUrl + '?Authority=' + fakeAuthority + '&Status=OK&demo=1',
    };
  }

  const res = await fetch(`${BASE}/pg/v4/payment/request.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      merchant_id: MERCHANT_ID,
      amount: Math.round(amountInRial),
      description: description,
      callback_url: callbackUrl,
    }),
  });

  const json = await res.json();
  if (json.data && json.data.code === 100) {
    return {
      authority: json.data.authority,
      paymentUrl: START_PAY_BASE + json.data.authority,
    };
  }
  throw new Error('خطای درخواست زرین‌پال: ' + JSON.stringify(json.errors || json));
}

async function verifyPayment(amountInRial, authority) {
  if (!MERCHANT_ID || MERCHANT_ID.startsWith('00000000') || authority.startsWith('DEMO-')) {
    return { refId: 'DEMO-REF-' + Date.now(), cardPan: '****-****-****-0000' };
  }

  const res = await fetch(`${BASE}/pg/v4/payment/verify.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      merchant_id: MERCHANT_ID,
      amount: Math.round(amountInRial),
      authority: authority,
    }),
  });

  const json = await res.json();
  if (json.data && (json.data.code === 100 || json.data.code === 101)) {
    return {
      refId: String(json.data.ref_id),
      cardPan: json.data.card_pan || '',
    };
  }
  throw new Error('خطای تایید زرین‌پال: ' + JSON.stringify(json.errors || json));
}

module.exports = { requestPayment, verifyPayment };