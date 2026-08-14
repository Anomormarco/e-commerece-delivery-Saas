const qpayTokenCache = {
  accessToken: "",
  expiresAt: 0,
};

function qpayConfig() {
  return {
    baseUrl: (process.env.QPAY_BASE_URL ?? "https://merchant.qpay.mn").replace(/\/+$/, ""),
    clientId: process.env.QPAY_CLIENT_ID ?? "",
    clientSecret: process.env.QPAY_CLIENT_SECRET ?? "",
    invoiceCode: process.env.QPAY_INVOICE_CODE ?? "",
    callbackUrl: process.env.QPAY_CALLBACK_URL ?? "",
  };
}

export function isQpayConfigured() {
  const config = qpayConfig();
  return Boolean(config.clientId && config.clientSecret && config.invoiceCode && config.callbackUrl);
}

async function qpayRequest(path, { method = "POST", body, authenticated = true } = {}) {
  const config = qpayConfig();
  const headers = new Headers({ Accept: "application/json" });

  if (body) headers.set("Content-Type", "application/json");

  if (authenticated) {
    headers.set("Authorization", `Bearer ${await qpayAccessToken()}`);
  } else {
    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    headers.set("Authorization", `Basic ${basic}`);
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message ?? payload?.error ?? `QPay API алдаа: ${response.status}`;
    const error = new Error(message);
    error.statusCode = 502;
    error.code = "QPAY_ERROR";
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function qpayAccessToken() {
  const now = Date.now();
  if (qpayTokenCache.accessToken && qpayTokenCache.expiresAt > now + 30_000) {
    return qpayTokenCache.accessToken;
  }

  const config = qpayConfig();
  if (!isQpayConfigured()) {
    const error = new Error("QPay тохиргоо дутуу байна. Render customer-service env-ээ шалгана уу.");
    error.statusCode = 500;
    error.code = "QPAY_NOT_CONFIGURED";
    throw error;
  }

  const payload = await qpayRequest("/v2/auth/token", { authenticated: false });
  const token = payload?.access_token;
  if (!token) {
    const error = new Error("QPay access token ирсэнгүй.");
    error.statusCode = 502;
    error.code = "QPAY_TOKEN_MISSING";
    error.payload = payload;
    throw error;
  }

  qpayTokenCache.accessToken = token;
  qpayTokenCache.expiresAt = now + Math.max(60, Number(payload.expires_in ?? 3600) - 60) * 1000;
  return token;
}

export async function createQpayInvoice({ orderId, amountMnt, description, customerCode }) {
  const config = qpayConfig();
  const payload = await qpayRequest("/v2/invoice", {
    body: {
      invoice_code: config.invoiceCode,
      sender_invoice_no: orderId,
      invoice_receiver_code: customerCode || orderId,
      invoice_description: description,
      amount: Number(amountMnt),
      callback_url: config.callbackUrl,
    },
  });

  if (!payload?.invoice_id) {
    const error = new Error("QPay invoice_id ирсэнгүй.");
    error.statusCode = 502;
    error.code = "QPAY_INVOICE_ID_MISSING";
    error.payload = payload;
    throw error;
  }

  return {
    providerInvoiceId: payload.invoice_id,
    senderInvoiceNo: orderId,
    qrText: payload.qr_text ?? "",
    qrImage: payload.qr_image ?? "",
    shortUrl: payload.qPay_shortUrl ?? payload.qpay_shorturl ?? payload.short_url ?? "",
    urls: Array.isArray(payload.urls) ? payload.urls : [],
    raw: payload,
  };
}

export async function checkQpayInvoice(providerInvoiceId) {
  const payload = await qpayRequest("/v2/payment/check", {
    body: {
      object_type: "INVOICE",
      object_id: providerInvoiceId,
      offset: {
        page_number: 1,
        page_limit: 100,
      },
    },
  });

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const paidRows = rows.filter((row) => String(row.payment_status ?? "").toUpperCase() === "PAID");
  const paidAmount = Number(payload.paid_amount ?? paidRows.reduce((sum, row) => sum + Number(row.payment_amount ?? 0), 0));

  return {
    paid: paidAmount > 0 || paidRows.length > 0,
    paidAmount,
    rows,
    raw: payload,
  };
}
