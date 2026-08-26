import { betterAuth, BetterAuthOptions, APIError } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor, customSession, phoneNumber } from "better-auth/plugins";
import { randomUUID, randomBytes } from "crypto";
import { eq, and, ne } from "drizzle-orm";
import { db } from "./db";
import * as schema from "./db-schema";
import { firebaseVerifyOTP } from "./phone-verify";

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const generateId = (length: number = 12) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  // Crypto-random public identifier (never Math.random — predictable IDs leak
  // nothing on their own but make enumeration easier).
  const bytes = randomBytes(length);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars.charAt(bytes[i] % chars.length);
  }
  return id;
};

// One Resend sender and one template for every transactional auth email.
// Previously the verification mail carried its own inline copy of this markup,
// which is why the password-reset mail never got written at all.
async function sendAuthEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error(`RESEND_API_KEY not set; cannot send "${subject}"`);
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${process.env.RESEND_FROM_NAME || "At-Tayyibun"} <${process.env.RESEND_FROM_EMAIL || "noreply@attayyibun.com"}>`,
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
}

function actionEmailHtml(opts: {
  title: string;
  heading: string;
  firstName: string;
  intro: string;
  cta: string;
  url: string;
  note: string;
}): string {
  const firstName = escapeHtml(opts.firstName);
  const safeUrl = escapeHtml(opts.url);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f1eb;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1eb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

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

          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:40px 40px 32px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a2e;">${escapeHtml(opts.heading)}</h1>
              <p style="margin:0 0 28px;font-size:15px;color:#5a5a6e;line-height:1.6;">
                Assalamu Alaikum ${firstName},<br/>
                ${escapeHtml(opts.intro)}
              </p>

              <div style="text-align:center;margin:0 0 28px;">
                <a href="${safeUrl}"
                   style="display:inline-block;background:#c9a84c;color:#1a1a2e;font-weight:700;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:10px;">
                  ${escapeHtml(opts.cta)}
                </a>
              </div>

              <p style="margin:0 0 24px;font-size:13px;color:#7a7a8a;line-height:1.6;">
                Or paste this link into your browser:<br/>
                <a href="${safeUrl}" style="color:#8a7a5a;word-break:break-all;">${safeUrl}</a>
              </p>

              <div style="background:#fff8f0;border-left:3px solid #e07b39;border-radius:4px;padding:12px 16px;">
                <p style="margin:0;font-size:13px;color:#7a4a2a;line-height:1.5;">
                  <strong>Note:</strong> ${escapeHtml(opts.note)}
                </p>
              </div>

            </td>
          </tr>

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
}

const firstNameOf = (name?: string | null) => name?.split(" ")[0] || "there";

// Domain of the transient address minted for phone-first signups. RFC 2606
// reserves .invalid, so it can never resolve — a stray send fails loudly
// instead of quietly burning the sending domain's reputation.
export const PLACEHOLDER_EMAIL_DOMAIN = "@phone.attayyibun.invalid";

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
    phoneNumber({
      // Firebase sends and checks the SMS code on the client; the token that
      // comes back is what reaches us. See ./phone-verify.ts for the bridge.
      //
      // The plugin still registers /phone-number/send-otp, so make calling it
      // an explicit error rather than a silent no-op.
      sendOTP: async () => {
        throw new APIError("BAD_REQUEST", {
          message:
            "Verification codes are sent by Firebase from the client. This endpoint is not used.",
        });
      },
      verifyOTP: firebaseVerifyOTP,
      // E.164 only. The client normalises before asking Firebase for a code, so
      // anything else here means a caller skipped the client path.
      phoneNumberValidator: (value) => /^\+[1-9]\d{6,14}$/.test(value),
      signUpOnVerification: {
        // better-auth requires an email on every user, but a phone-first signup
        // has none yet. .invalid is RFC 2606 reserved and can never resolve, so
        // a stray send fails loudly instead of quietly burning domain
        // reputation. users.email_is_placeholder tracks these rows; the profile
        // wizard will not let the user through until a real address replaces it.
        getTempEmail: (value) => `${value}${PLACEHOLDER_EMAIL_DOMAIN}`,
        // The wizard collects the real name; an empty string keeps the row from
        // displaying a phone number as someone's name in the meantime.
        getTempName: () => "",
      },
      async callbackOnVerification({ user }) {
        // The create path above hardcodes email/name, so the placeholder flag
        // cannot ride in on it — set it here, right after the row exists.
        const isPlaceholder = user.email.endsWith(PLACEHOLDER_EMAIL_DOMAIN);
        if (isPlaceholder && !(user as { emailIsPlaceholder?: boolean }).emailIsPlaceholder) {
          await db
            .update(schema.users)
            .set({ emailIsPlaceholder: true })
            .where(eq(schema.users.id, user.id));
        }
      },
      // Point the plugin at the columns that already exist.
      schema: {
        user: {
          fields: {
            phoneNumber: "phone",
            phoneNumberVerified: "isPhoneVerified",
          },
        },
      },
    }),
    twoFactor({
      otpOptions: {
        // Better Auth 1.6.27 interprets `period` in minutes: (period || 3) * 60 * 1000.
        // 5 minutes (300 seconds) matches the email copy.
        period: 5,
        async sendOTP({ user, otp }) {
          if (!process.env.RESEND_API_KEY) {
            throw new Error("RESEND_API_KEY not set; cannot send 2FA email");
          }
          const firstName = escapeHtml(user.name?.split(" ")[0] || "there");
          const safeOtp = escapeHtml(otp);
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
                <div style="font-size:42px;font-weight:800;letter-spacing:14px;color:#1a1a2e;font-family:'Courier New',monospace;">${safeOtp}</div>
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
    level: "error",
    log(level: string, message: string, error?: unknown) {
      if (level === "error" && error) {
        // Sentry temporarily disabled.
        // import("@sentry/nextjs").then((Sentry) => {
        //   Sentry.captureException(error, {
        //     extra: { message, level },
        //   });
        // });
        console.error("[auth]", message);
      }
    },
  },
  rateLimit: {
    // Enabled explicitly (better-auth defaults to enabled only in production,
    // which silently disables protection in non-prod environments).
    enabled: true,
    // Be permissive on the global window and tighten per-path below.
    window: 10,
    max: 100,
    storage: "memory",
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 10 },
      "/sign-in/social": { window: 60, max: 20 },
      "/request-password-reset": { window: 60, max: 3 },
      "/forget-password": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
      "/two-factor/send-otp": { window: 60, max: 5 },
      "/two-factor/verify-otp": { window: 60, max: 10 },
      "/two-factor/verify-totp": { window: 60, max: 10 },
      "/two-factor/verify-backup-code": { window: 60, max: 10 },
      // The phoneNumber plugin self-registers a default here; spell it out so
      // it is visible and tunable. Firebase enforces its own per-number SMS
      // quota, this caps how fast tokens can be thrown at our verifier.
      "/phone-number/verify": { window: 60, max: 8 },
      // Never legitimately called — Firebase sends the SMS from the client.
      "/phone-number/send-otp": { window: 60, max: 1 },
      // Registered by the plugin but inert without sendPasswordResetOTP.
      "/phone-number/request-password-reset": { window: 60, max: 1 },
      "/phone-number/reset-password": { window: 60, max: 1 },
      "/change-email": { window: 60, max: 5 },
    },
  },
  advanced: {
    database: {
      generateId: () => randomUUID(),
    },
    // Rate limiting keys off the client IP. `x-forwarded-for` is trivially
    // spoofable, so prefer Cloudflare's header (set by Cloudflare, cannot be
    // overridden by clients) and only fall back when it's absent (local dev).
    ipAddress: {
      ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
    },
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          try {
            const [user] = await db
              .select({ role: schema.users.role })
              .from(schema.users)
              .where(eq(schema.users.id, session.userId))
              .limit(1);
            if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
              await db
                .delete(schema.session)
                .where(
                  and(
                    eq(schema.session.userId, session.userId),
                    ne(schema.session.id, session.id)
                  )
                );
            }
          } catch (e) {
            console.error("[auth] failed to revoke previous admin sessions:", e);
          }
        },
      },
    },
    user: {
      create: {
        before: async (user) => ({
          data: { ...user, publicId: generateId(12) },
        }),
      },
      update: {
        // Clear the placeholder flag the moment a real address replaces the
        // +<e164>@phone.attayyibun.invalid one. Doing it here catches every
        // write path — /change-email, /verify-email, an admin edit — instead of
        // only the one the wizard happens to call.
        before: async (user) => {
          const email = (user as { email?: string }).email;
          if (typeof email !== "string") return { data: user };
          return {
            data: {
              ...user,
              emailIsPlaceholder: email.endsWith(PLACEHOLDER_EMAIL_DOMAIN),
            },
          };
        },
      },
    },
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID.replace(/^["']|["']$/g, '').trim(),
            clientSecret: process.env.GOOGLE_CLIENT_SECRET.replace(/^["']|["']$/g, '').trim(),
          },
        }
      : {}),
    ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
      ? {
          apple: {
            clientId: process.env.APPLE_CLIENT_ID.replace(/^["']|["']$/g, '').trim(),
            clientSecret: process.env.APPLE_CLIENT_SECRET.replace(/^["']|["']$/g, '').trim(),
            appBundleIdentifier:
              process.env.APPLE_APP_BUNDLE_ID?.replace(/^["']|["']$/g, '').trim() ||
              "com.attayyibun.attayyibun",
          },
        }
      : {}),
  },
  account: {
    accountLinking: {
      // Without this, someone who registered with a password and later taps
      // "Continue with Google" on the same address ends up with two accounts —
      // the one duplicate class social login can actually prevent.
      enabled: true,
      // Google and Apple both verify email ownership, so their assertions are
      // safe to link on.
      trustedProviders: ["google", "apple"],
      // Only ever link when the addresses match. Linking across different
      // emails would let a Google account attach itself to someone else's
      // profile.
      allowDifferentEmails: false,
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    // Without this callback better-auth accepts /request-password-reset and
    // then delivers nothing, so the forgot-password page has been silently
    // doing nothing. Phone-first accounts have no password at all — the reset
    // page tells those users to sign in by phone instead.
    async sendResetPassword({ user, url }) {
      await sendAuthEmail(
        user.email,
        "Reset your password – At-Tayyibun",
        actionEmailHtml({
          title: "Reset your password – At-Tayyibun",
          heading: "Reset your password",
          firstName: firstNameOf(user.name),
          intro:
            "We received a request to reset your At-Tayyibun password. Tap the button below to choose a new one.",
          cta: "Reset password",
          url,
          note:
            "this link expires in 1 hour. If you didn't ask to reset your password, you can safely ignore this email — your password will not change.",
        }),
      );
    },
  },
  emailVerification: {
    sendOnSignUp: false,
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60, // 1 hour
    async sendVerificationEmail({ user, url }) {
      await sendAuthEmail(
        user.email,
        "Confirm your email – At-Tayyibun",
        actionEmailHtml({
          title: "Verify your email – At-Tayyibun",
          heading: "Confirm your email",
          firstName: firstNameOf(user.name),
          intro:
            "Welcome to At-Tayyibun. Tap the button below to confirm your email and finish setting up your profile.",
          cta: "Verify email",
          url,
          note:
            "this link expires in 1 hour. If you didn't sign up at At-Tayyibun, you can safely ignore this email.",
        }),
      );
    },
  },
  user: {
    additionalFields: {
      publicId: { type: "string", required: false, input: false },
      role: { type: "string", required: false, input: false },
      // NOTE: there is deliberately no `phone` field here. The phoneNumber
      // plugin owns users.phone (mapped below); declaring both would point two
      // model fields at one column and confuse the drizzle adapter.
      //
      // Both flags are read by the phone/email gate, so they must ride on the
      // session. Neither is client-writable.
      emailIsPlaceholder: { type: "boolean", required: false, input: false },
      phoneGateExempt: { type: "boolean", required: false, input: false },
      // EULA acknowledgement (Guideline 1.2 for UGC apps). Set by the client
      // at sign-up; evidences acceptance if review asks.
      termsAcceptedAt: { type: "date", required: false, input: true },
    },
    changeEmail: {
      // How a phone-first user swaps their +<e164>@phone.attayyibun.invalid
      // placeholder for a real address.
      enabled: true,
      // Placeholder accounts always have emailVerified=false, and the address
      // they are replacing is one nobody could ever have received mail at, so
      // there is no prior owner to ask for permission. better-auth swaps the
      // address in place and then sends the usual verification link to the new
      // one. Accounts with a *verified* email do not take this path — they get
      // the confirmation mail below, at their existing address.
      updateEmailWithoutVerification: true,
      async sendChangeEmailConfirmation({ user, newEmail, url }) {
        await sendAuthEmail(
          user.email,
          "Approve your new email – At-Tayyibun",
          actionEmailHtml({
            title: "Approve your new email – At-Tayyibun",
            heading: "Approve your new email",
            firstName: firstNameOf(user.name),
            intro: `Someone asked to change this account's email to ${newEmail}. Tap below to approve it.`,
            cta: "Approve change",
            url,
            note:
              "this link expires in 1 hour. If you didn't request this change, ignore this email and your address stays as it is.",
          }),
        );
      },
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
