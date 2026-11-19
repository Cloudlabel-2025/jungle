import nodemailer from "nodemailer";
import { validMailAddress } from "./mail-address.js";

export function recoveryMailStatus() {
  const mode = process.env.SMTP_AUTH_MODE || "oauth2";
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "CMS_EMAIL_FROM", "CMS_PUBLIC_ORIGIN", "SESSION_SECRET",
    ...(mode === "password" ? ["SMTP_PASS"] : ["SMTP_TENANT_ID", "SMTP_CLIENT_ID", "SMTP_CLIENT_SECRET"])];
  const missing = required.filter(k => !process.env[k]);
  let origin;
  try {
    const url = new URL(process.env.CMS_PUBLIC_ORIGIN);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw Error();
    origin = url.origin;
  } catch { if (!missing.includes("CMS_PUBLIC_ORIGIN")) missing.push("CMS_PUBLIC_ORIGIN"); }
  if (!["password", "oauth2"].includes(mode)) missing.push("SMTP_AUTH_MODE");
  if (mode === "oauth2") for (const key of ["SMTP_TENANT_ID", "SMTP_CLIENT_ID"])
    if (process.env[key] && !/^[a-f0-9-]{36}$/i.test(process.env[key])) missing.push(key);
  if (!validMailAddress(process.env.CMS_EMAIL_FROM) && !missing.includes("CMS_EMAIL_FROM")) missing.push("CMS_EMAIL_FROM");
  if (process.env.SESSION_SECRET?.length < 32 && !missing.includes("SESSION_SECRET")) missing.push("SESSION_SECRET");
  if (![465, 587, 2525].includes(Number(process.env.SMTP_PORT)) && !missing.includes("SMTP_PORT")) missing.push("SMTP_PORT");
  return { ready: missing.length === 0, missing, mode, sender: process.env.CMS_EMAIL_FROM || "", origin: origin || "" };
}
export async function sendRecoveryMail(message) {
  const status = recoveryMailStatus();
  if (!status.ready) throw Object.assign(new Error("Email recovery needs mailbox configuration."), { code: "CONFIGURATION" });
  let auth;
  if (status.mode === "oauth2") {
    const tenant = process.env.SMTP_TENANT_ID, client = process.env.SMTP_CLIENT_ID;
    if (![tenant, client].every(v => /^[a-f0-9-]{36}$/i.test(v || ""))) throw Object.assign(new Error("Invalid Microsoft app configuration."), { code: "CONFIGURATION" });
    const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(15000),
      body: new URLSearchParams({ client_id: client, client_secret: process.env.SMTP_CLIENT_SECRET,
        scope: "https://outlook.office365.com/.default", grant_type: "client_credentials" }),
    });
    if (!response.ok) throw Object.assign(new Error("Microsoft mailbox authorization failed."), { code: "AUTHORIZATION" });
    const data = await response.json();
    if (typeof data.access_token !== "string") throw Object.assign(new Error("Microsoft mailbox authorization failed."), { code: "AUTHORIZATION" });
    auth = { type: "OAuth2", user: process.env.SMTP_USER, accessToken: data.access_token };
  } else auth = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465, requireTLS: true, auth,
    tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" }, logger: false, debug: false,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    disableFileAccess: true, disableUrlAccess: true });
  try {
    if (!validMailAddress(message.to)) throw Object.assign(new Error("Invalid recovery recipient."), { code: "DELIVERY" });
    const result = await transport.sendMail({ from: { address: process.env.CMS_EMAIL_FROM }, to: { address: message.to },
      subject: "Reset your Jungle password", text: message.text, messageId: message.messageId });
    if (!result.accepted?.length) throw Object.assign(new Error("The mailbox did not accept this recovery message."), { code: "DELIVERY" });
    return { accepted: true };
  } finally { transport.close(); }
}
