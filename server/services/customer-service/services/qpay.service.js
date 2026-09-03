import qrcode from "./vendor/qrcode-generator.js";

const qpayTokenCache = {
  accessToken: "",
  expiresAt: 0,
};

// When the live QPay API is unreachable (e.g. the merchant IP allowlist rejects
// our hosting provider), we still want checkout to complete. Set QPAY_STRICT=1
// to opt out and surface the raw 502 instead.
function qpayStrictMode() {
  return /^(1|true|yes)$/i.test(String(process.env.QPAY_STRICT ?? "").trim());
}

// Render an EMVCo / demo payload string as a scannable SVG QR so the checkout UI
// always has something to show even without QPay's own qr_image.
export function qrSvgFromText(text) {
  try {
    const qr = qrcode(0, "M");
    qr.addData(String(text ?? ""));
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  } catch {
    return "";
  }
}

function buildDemoQpayInvoice({ orderId, amountMnt, description, customerCode, reason = "" }) {
  const invoiceId = `DEMO-QPAY-${orderId}`;
  const qrText = `deliverhub-demo-qpay:${orderId}:${amountMnt}`;

  return {
    providerInvoiceId: invoiceId,
    senderInvoiceNo: orderId,
    qrText,
    qrImage: qrSvgFromText(qrText),
    shortUrl: "",
    urls: [],
    mode: "demo",
    degraded: Boolean(reason),
    warning: reason
      ? "QPay түр боломжгүй тул төлбөрийг демо горимоор баталгаажуулж байна."
      : "",
    raw: {
      invoice_id: invoiceId,
      sender_invoice_no: orderId,
      amount: Number(amountMnt),
      description,
      customerCode,
      mode: "demo",
      reason: reason || undefined,
    },
  };
}

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
  if (!isQpayConfigured()) {
    return buildDemoQpayInvoice({ orderId, amountMnt, description, customerCode });
  }

  try {
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
      mode: "live",
      degraded: false,
      warning: "",
      raw: payload,
    };
  } catch (error) {
    if (qpayStrictMode()) throw error;

    console.warn(
      `[qpay] invoice creation failed, falling back to demo mode for order ${orderId}:`,
      error?.payload ?? error?.message ?? error,
    );

    return buildDemoQpayInvoice({
      orderId,
      amountMnt,
      description,
      customerCode,
      reason: error?.message || "qpay-unavailable",
    });
  }
}

export async function checkQpayInvoice(providerInvoiceId) {
  if (String(providerInvoiceId ?? "").startsWith("DEMO-QPAY-")) {
    return {
      paid: true,
      paidAmount: 0,
      rows: [{ payment_status: "PAID", payment_amount: 0, mode: "local-demo" }],
      raw: { mode: "local-demo", invoice_id: providerInvoiceId },
    };
  }

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
