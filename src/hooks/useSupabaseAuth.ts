import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

const ALLOWED_EMAIL = import.meta.env.VITE_ALLOWED_EMAIL?.trim().toLowerCase() || null;

export type SupabaseAuthState = {
  configured: boolean;
  allowedEmail: string | null;
  isLoading: boolean;
  isSendingMagicLink: boolean;
  user: User | null;
  error: string | null;
  info: string | null;
  sendMagicLink: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

export function useSupabaseAuth(): SupabaseAuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(() => isSupabaseConfigured());
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function isAllowedEmail(email: string | null | undefined): boolean {
    if (!ALLOWED_EMAIL) return true;
    return Boolean(email && email.trim().toLowerCase() === ALLOWED_EMAIL);
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const errorDescription = hashParams.get("error_description");
      const errorCode = hashParams.get("error_code");
      if (errorDescription || errorCode) {
        setError(errorDescription || errorCode || "Authentication failed.");
        const cleanedUrl = new URL(window.location.href);
        cleanedUrl.hash = "";
        window.history.replaceState({}, document.title, cleanedUrl.toString());
      }
    }

    const client = getSupabaseClient();
    if (!client) {
      setIsLoading(false);
      return;
    }

    let active = true;

    client.auth.getUser()
      .then(({ data, error: authError }) => {
        if (!active) return;
        if (authError) {
          setError(authError.message);
          setUser(null);
        } else {
          const nextUser = data.user ?? null;
          if (nextUser && !isAllowedEmail(nextUser.email)) {
            void client.auth.signOut();
            setUser(null);
            setError(ALLOWED_EMAIL ? `Only ${ALLOWED_EMAIL} is allowed to sign in.` : "This email is not allowed.");
            return;
          }
          setUser(nextUser);
        }
      })
      .catch((authError: unknown) => {
        if (!active) return;
        setError(authError instanceof Error ? authError.message : "Unable to load auth state.");
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      if (nextUser && !isAllowedEmail(nextUser.email)) {
        void client.auth.signOut();
        setUser(null);
        setError(ALLOWED_EMAIL ? `Only ${ALLOWED_EMAIL} is allowed to sign in.` : "This email is not allowed.");
        setIsLoading(false);
        return;
      }
      setUser(nextUser);
      setIsLoading(false);
      setError(null);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function sendMagicLink(email: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    const normalizedEmail = email.trim().toLowerCase();
    setError(null);
    setInfo(null);
    setIsSendingMagicLink(true);

    if (!isAllowedEmail(normalizedEmail)) {
      setError(ALLOWED_EMAIL ? `Only ${ALLOWED_EMAIL} can sign in here.` : "This email is not allowed.");
      setIsSendingMagicLink(false);
      return false;
    }

    const redirectTo = typeof window === "undefined"
      ? undefined
      : new URL("/time/", window.location.origin).toString();

    try {
      const { error: authError } = await client.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: false
        }
      });

      if (authError) {
        setError(authError.message);
        return false;
      }

      setInfo(`Magic link sent to ${normalizedEmail}.`);
      return true;
    } finally {
      setIsSendingMagicLink(false);
    }
  }

  async function signOut(): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    const { error: authError } = await client.auth.signOut();
    if (authError) {
      setError(authError.message);
      return;
    }

    setUser(null);
    setInfo("Signed out.");
  }

  return {
    configured: isSupabaseConfigured(),
    allowedEmail: ALLOWED_EMAIL,
    isLoading,
    isSendingMagicLink,
    user,
    error,
    info,
    sendMagicLink,
    signOut
  };
}
