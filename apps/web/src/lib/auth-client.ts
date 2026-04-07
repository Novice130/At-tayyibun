import { createAuthClient } from "better-auth/react";

const getBaseUrl = () => {
    if (typeof window !== "undefined") return window.location.origin;
    // Server-side fallback for SSR
    return process.env.NEXT_PUBLIC_WEB_URL || process.env.WEB_URL || "http://localhost:3000";
};

export const authClient = createAuthClient({
    baseURL: `${getBaseUrl()}/auth`,
});

export const {
    signIn,
    signUp,
    signOut,
    useSession
} = authClient;
