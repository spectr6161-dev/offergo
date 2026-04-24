import nodemailer from "nodemailer";
import { env } from "@offergo/shared";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: env.SMTP_USER
    ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
    : undefined,
});

export async function sendTransactionalEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  } catch (error) {
    console.error("[auth/email] failed to send transactional email", {
      to: options.to,
      subject: options.subject,
      error,
    });

    if (env.NODE_ENV === "production") {
      throw error;
    }
  }
}
