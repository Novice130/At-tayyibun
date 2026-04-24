import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
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

export const auth = betterAuth({
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
          if (!process.env.RESEND_API_KEY) return;
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: `${process.env.RESEND_FROM_NAME || "At-Tayyibun"} <${process.env.RESEND_FROM_EMAIL || "noreply@attayyibun.com"}>`,
              to: [user.email],
              subject: "Your Authentication Code - At-Tayyibun",
              html: `<p>Your code is <strong>${otp}</strong>. It is valid for 5 minutes. Do not share this code.</p>`,
            }),
          }).catch(console.error);
        },
      },
    }),
  ],
  logger: {
    level: "debug",
    onLog(level: string, message: string, error?: unknown) {
      if (level === "error" && error) {
        import("@sentry/nextjs").then((Sentry) => {
          Sentry.captureException(error, {
            extra: { message, level },
          });
        });
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
});
