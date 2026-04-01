import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
    baseURL: "/auth",
});

export const {
    signIn,
    signUp,
    signOut,
    useSession
} = authClient;
