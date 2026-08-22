import { createAuthClient } from "better-auth/react";
import { twoFactorClient, phoneNumberClient } from "better-auth/client/plugins";

const getBaseUrl = () => {
    if (typeof window !== "undefined") return window.location.origin;
    // Server-side fallback for SSR
    return process.env.NEXT_PUBLIC_WEB_URL || process.env.WEB_URL || "http://localhost:3000";
};

export const authClient = createAuthClient({
    baseURL: `${getBaseUrl()}/auth`,
    plugins: [
        twoFactorClient({
            twoFactorPage: "/admin/security/challenge",
        }),
        phoneNumberClient(),
    ],
});

export const {
    signIn,
    signUp,
    signOut,
    useSession,
    twoFactor,
    phoneNumber,
    changeEmail,
} = authClient;
