import net from "node:net";
import tls from "node:tls";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { logger } from "../observability/logger.js";

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(serverRoot, ".env"), override: false });

function readResponse(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines.at(-1);
      if (last && /^\d{3} /.test(last)) {
        cleanup();
        resolve(buffer);
      }
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onTimeout = () => {
      cleanup();
      reject(new Error("SMTP request timed out"));
    };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("timeout", onTimeout);
    };
    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("timeout", onTimeout);
  });
}

async function command(socket, line, expected = /^[23]/) {
  socket.write(`${line}\r\n`);
  const response = await readResponse(socket);
  if (!expected.test(response)) {
    throw new Error(`SMTP command failed: ${response.trim()}`);
  }
  return response;
}

function connectSocket({ host, port, secure }) {
  return new Promise((resolve, reject) => {
    const rejectUnauthorized = process.env.SMTP_REJECT_UNAUTHORIZED !== "false";
    const socket = secure ? tls.connect({ host, port, servername: host, rejectUnauthorized }) : net.connect({ host, port });
    socket.setTimeout(Number(process.env.SMTP_TIMEOUT_MS ?? 10_000));
    socket.once("connect", () => resolve(socket));
    socket.once("secureConnect", () => resolve(socket));
    socket.once("error", reject);
  });
}

function sanitizeHeader(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

function envelopeAddress(value) {
  const match = String(value ?? "").match(/<([^>]+)>/);
  return sanitizeHeader(match?.[1] ?? value);
}

function buildMessage({ from, to, subject, text }) {
  const safeSubject = sanitizeHeader(subject);
  return [
    `From: ${sanitizeHeader(from)}`,
    `To: ${sanitizeHeader(to)}`,
    `Subject: ${safeSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    String(text ?? "").replace(/\r?\n/g, "\r\n"),
  ].join("\r\n");
}

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

async function sendViaResend({ to, subject, text }) {
  const from = process.env.RESEND_FROM ?? process.env.SMTP_FROM ?? "DeliverHub <onboarding@resend.dev>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sanitizeHeader(from),
        to: [envelopeAddress(to)],
        subject: sanitizeHeader(subject),
        text: String(text ?? ""),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.error("resend_send_failed", { status: response.status, body, to: envelopeAddress(to) });
      return false;
    }

    return true;
  } catch (error) {
    logger.error("resend_send_failed", { message: error.message, to: envelopeAddress(to) });
    return false;
  }
}

async function sendViaSmtp({ to, subject, text }) {
  if (!isSmtpConfigured()) {
    logger.warn("smtp_not_configured", { to: envelopeAddress(to) });
    return false;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user;
  let socket;

  try {
    socket = await connectSocket({ host, port, secure });
    await readResponse(socket);
    await command(socket, `EHLO ${process.env.SMTP_HELO_HOST ?? "deliverhub.local"}`);

    if (!secure) {
      await command(socket, "STARTTLS", /^220/);
      socket = tls.connect({
        socket,
        servername: host,
        rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== "false",
      });
      await new Promise((resolve, reject) => {
        socket.once("secureConnect", resolve);
        socket.once("error", reject);
      });
      socket.setTimeout(Number(process.env.SMTP_TIMEOUT_MS ?? 10_000));
      await command(socket, `EHLO ${process.env.SMTP_HELO_HOST ?? "deliverhub.local"}`);
    }

    await command(socket, "AUTH LOGIN", /^334/);
    await command(socket, Buffer.from(user).toString("base64"), /^334/);
    await command(socket, Buffer.from(pass).toString("base64"), /^235/);
    await command(socket, `MAIL FROM:<${envelopeAddress(from)}>`);
    await command(socket, `RCPT TO:<${envelopeAddress(to)}>`);
    await command(socket, "DATA", /^354/);
    socket.write(`${buildMessage({ from, to, subject, text })}\r\n.\r\n`);
    await readResponse(socket);
    await command(socket, "QUIT", /^221/).catch(() => undefined);
    return true;
  } catch (error) {
    logger.error("smtp_send_failed", { message: error.message, to: envelopeAddress(to) });
    return false;
  } finally {
    socket?.end();
  }
}

// Resend (HTTP API) is preferred when configured: it's sent from Render's own
// servers with proper DKIM/SPF on a dedicated domain, so it lands in the inbox
// far more reliably than raw Gmail SMTP. If Resend fails (e.g. sandbox mode
// rejecting an unverified recipient before a domain is verified), fall back
// to Gmail SMTP so mail still goes out instead of silently disappearing.
export async function sendMail({ to, subject, text }) {
  if (isResendConfigured()) {
    const sent = await sendViaResend({ to, subject, text });
    if (sent) return true;
    if (!isSmtpConfigured()) return false;
    logger.warn("resend_fallback_to_smtp", { to: envelopeAddress(to) });
  }

  return sendViaSmtp({ to, subject, text });
}
