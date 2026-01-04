"use client";

import { useState, useEffect } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/auth";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") {
      setState({ user: null, loading: false, error: null });
      return;
    }

    try {
      const authInstance = auth();
      const unsubscribe = onAuthStateChanged(
        authInstance,
        (user) => {
          setState({ user, loading: false, error: null });
        },
        (error) => {
          setState({ user: null, loading: false, error });
        }
      );

      return () => unsubscribe();
    } catch (error) {
      setState({ user: null, loading: false, error: error as Error });
    }
  }, []);

  return state;
}
