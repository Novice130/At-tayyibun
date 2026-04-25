import { betterAuth, BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor, customSession } from "better-auth/plugins";
import { randomUUID } from "crypto";
import { db } from "./db";
import * as schema from "./db-schema";

const generateId = (length: number = 12) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

const options = {
  basePath: "/auth",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      twoFactor: schema.twoFactor,
    },
    usePlural: false,
  }),
  plugins: [
    twoFactor({
      otpOptions: {
        async sendOTP({ user, otp }) {
          if (!process.env.RESEND_API_KEY) {
            throw new Error("RESEND_API_KEY not set; cannot send 2FA email");
          }
          const firstName = user.name?.split(" ")[0] || "there";
          const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verification Code – At-Tayyibun</title>
</head>
<body style="margin:0;padding:0;background:#f4f1eb;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1eb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <img 
                src="${process.env.WEB_URL || 'https://attayyibun.com'}/at-tayyibun-logo.png" 
                alt="At-Tayyibun Logo" 
                style="width: 80px; height: 80px; object-fit: contain;" 
              />
              <div style="color:#1a1a2e;font-size:22px;font-weight:700;letter-spacing:0.5px;margin-top:12px;">At-Tayyibun</div>
              <div style="color:#8a7a5a;font-size:13px;margin-top:2px;">Muslim Matrimony</div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:40px 40px 32px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;">Security Verification</h1>
              <p style="margin:0 0 28px;font-size:15px;color:#5a5a6e;line-height:1.5;">
                Assalamu Alaikum ${firstName},<br/>
                Use the code below to complete your sign-in to the At-Tayyibun admin panel.
              </p>

              <!-- OTP Block -->
              <div style="background:#faf6ee;border:2px solid #c9a84c;border-radius:12px;padding:28px 24px;text-align:center;margin-bottom:28px;">
                <div style="font-size:13px;font-weight:600;color:#8a7a5a;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Your verification code</div>
                <div style="font-size:42px;font-weight:800;letter-spacing:14px;color:#1a1a2e;font-family:'Courier New',monospace;">${otp}</div>
                <div style="margin-top:12px;font-size:13px;color:#8a7a5a;">
                  ⏱ Valid for <strong>5 minutes</strong>
                </div>
              </div>

              <!-- Security Note -->
              <div style="background:#fff8f0;border-left:3px solid #e07b39;border-radius:4px;padding:12px 16px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#7a4a2a;line-height:1.5;">
                  <strong>Security notice:</strong> At-Tayyibun will never ask for this code. If you did not request this, please ignore this email and your account remains secure.
                </p>
              </div>

              <p style="margin:0;font-size:13px;color:#9a9aaa;line-height:1.5;">
                This code was requested from the IP address associated with your current session.<br/>
                If this wasn't you, you can safely ignore this email.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:28px;">
              <div style="font-size:12px;color:#aaa098;line-height:1.8;">
                © 2025 At-Tayyibun · Muslim Matrimony<br/>
                <a href="https://attayyibun.com" style="color:#c9a84c;text-decoration:none;">attayyibun.com</a>
                &nbsp;·&nbsp;
                <span>Do not reply to this email</span>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: `${process.env.RESEND_FROM_NAME || "At-Tayyibun"} <${process.env.RESEND_FROM_EMAIL || "noreply@attayyibun.com"}>`,
              to: [user.email],
              subject: "Your verification code – At-Tayyibun",
              html,
            }),
          });
          if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
          }
        },
      },
    }),
  ],
  logger: {
    level: "debug",
    log(level: string, message: string, error?: unknown) {
      if (level === "error" && error) {
        // Sentry temporarily disabled.
        // import("@sentry/nextjs").then((Sentry) => {
        //   Sentry.captureException(error, {
        //     extra: { message, level },
        //   });
        // });
        console.error("[auth]", message, error);
      }
    },
  },
  advanced: {
    database: {
      generateId: () => randomUUID(),
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({
          data: { ...user, publicId: generateId(12) },
        }),
      },
    },
  },
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      publicId: { type: "string", required: false, input: false },
      role: { type: "string", required: false, input: false },
    },
  },
} satisfies BetterAuthOptions;

export const auth = betterAuth({
  ...options,
  plugins: [
    ...(options.plugins ?? []),
    customSession(async ({ user, session }) => {
      return { user, session };
    }, options),
  ],
});
