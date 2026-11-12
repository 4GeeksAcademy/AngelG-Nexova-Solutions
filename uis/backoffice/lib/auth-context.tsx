"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  advanceAuthSessionRevision,
  ApiRequestError,
  getAuthSessionRevision,
  getMe,
  getToken,
  handleUnauthorizedToken,
  loginRequest,
  setOnUnauthorized,
} from "@/lib/api-client";

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export type AuthState =
  | { status: "initializing"; user: null }
  | { status: "anonymous"; user: null }
  | { status: "authenticated"; user: User }
  | { status: "error"; user: null; message: string };

interface AuthContextValue {
  user: User | null;
  updateProfileName: (name: string | null) => void;
  isReady: boolean;
  isAuthenticated: boolean;
  authState: AuthState;
  retryAuthentication: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL_STATE: AuthState = { status: "initializing", user: null };

function parseUser(payload: unknown): User {
  if (!payload || typeof payload !== "object") {
    throw new Error("La respuesta de autenticación no tiene un formato válido.");
  }

  const candidate = payload as Record<string, unknown>;
  const profile = candidate.profile;
  if (
    typeof candidate.id !== "string" || !candidate.id.trim() ||
    typeof candidate.email !== "string" || !candidate.email.trim() ||
    typeof candidate.role !== "string" || !candidate.role.trim() ||
    !(profile === null || (
      typeof profile === "object" && profile !== null &&
      (typeof (profile as Record<string, unknown>).name === "string" ||
        (profile as Record<string, unknown>).name === null)
    ))
  ) {
    throw new Error("La respuesta de autenticación no tiene un formato válido.");
  }

  const profileName = profile === null
    ? null
    : (profile as Record<string, unknown>).name as string | null;
  return {
    id: candidate.id,
    email: candidate.email,
    name: profileName?.trim() || null,
    role: candidate.role,
  };
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 401;
}

function isRecoverableAuthError(error: unknown): boolean {
  if (error instanceof ApiRequestError) return error.status >= 500;
  return error instanceof Error;
}

let bootstrapInFlight: Promise<User> | null = null;
let bootstrapToken: string | null = null;

function getOrStartBootstrap(token: string): Promise<User> {
  if (bootstrapInFlight && bootstrapToken === token) return bootstrapInFlight;
  bootstrapToken = token;
  bootstrapInFlight = getMe().then(parseUser);
  return bootstrapInFlight;
}

function clearBootstrap(promise?: Promise<User>) {
  if (!promise || bootstrapInFlight === promise) {
    bootstrapInFlight = null;
    bootstrapToken = null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>(INITIAL_STATE);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    const revision = getAuthSessionRevision();
    const token = getToken();

    if (!token) {
      // Promise continuation avoids a synchronous state update in the effect.
      void Promise.resolve().then(() => {
        if (active && revision === getAuthSessionRevision()) {
          setAuthState({ status: "anonymous", user: null });
        }
      });
      return () => {
        active = false;
      };
    }

    const request = getOrStartBootstrap(token);
    request
      .then((user) => {
        if (active && revision === getAuthSessionRevision() && getToken() === token) {
          setAuthState({ status: "authenticated", user });
        }
      })
      .catch((error: unknown) => {
        if (!active || revision !== getAuthSessionRevision() || getToken() !== token) return;
        if (isUnauthorized(error)) {
          handleUnauthorizedToken(token);
          // Without a mounted callback (e.g. effect ordering), settle anonymously.
          if (getToken() === null) setAuthState({ status: "anonymous", user: null });
        } else if (isRecoverableAuthError(error)) {
          setAuthState({
            status: "error",
            user: null,
            message: error instanceof Error
              ? error.message
              : "No se pudo verificar la sesión. Inténtalo de nuevo.",
          });
        } else {
          setAuthState({
            status: "error",
            user: null,
            message: "No se pudo verificar la sesión. Inténtalo de nuevo.",
          });
        }
      })
      .finally(() => clearBootstrap(request));

    return () => {
      active = false;
    };
  }, [retryKey]);

  useEffect(() => {
    const handler = () => {
      advanceAuthSessionRevision();
      setAuthState({ status: "anonymous", user: null });
    };
    const unsubscribe = setOnUnauthorized(handler);
    return unsubscribe;
  }, []);

  const retryAuthentication = useCallback(() => {
    if (authState.status !== "error") return;
    setAuthState({ status: "initializing", user: null });
    setRetryKey((current) => current + 1);
  }, [authState.status]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    if (typeof response.access_token !== "string" || !response.access_token.trim()) {
      throw new Error("El servidor no devolvió un token válido.");
    }

    advanceAuthSessionRevision();
    const revision = getAuthSessionRevision();
    localStorage.setItem("token", response.access_token);
    setAuthState({ status: "initializing", user: null });

    try {
      const me = parseUser(await getMe());
      if (revision !== getAuthSessionRevision() || getToken() !== response.access_token) return;
      setAuthState({ status: "authenticated", user: me });
    } catch {
      if (revision === getAuthSessionRevision() && getToken() === response.access_token) {
        advanceAuthSessionRevision();
        localStorage.removeItem("token");
        setAuthState({ status: "anonymous", user: null });
      }
      throw new Error("Error al obtener datos del usuario. Intente nuevamente.");
    }
  }, []);

  const updateProfileName = useCallback((name: string | null) => {
    setAuthState((current) => current.status === "authenticated"
      ? { status: "authenticated", user: { ...current.user, name: name?.trim() || null } }
      : current);
  }, []);

  const logout = useCallback(() => {
    advanceAuthSessionRevision();
    localStorage.removeItem("token");
    setAuthState({ status: "anonymous", user: null });
    router.push("/login");
  }, [router]);

  const user = authState.status === "authenticated" ? authState.user : null;
  const isReady = authState.status !== "initializing";
  const isAuthenticated = authState.status === "authenticated" && user !== null;

  const value = useMemo<AuthContextValue>(() => ({
    user,
    updateProfileName,
    isReady,
    isAuthenticated,
    authState,
    retryAuthentication,
    login,
    logout,
  }), [authState, user, updateProfileName, isReady, isAuthenticated, retryAuthentication, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de un <AuthProvider>");
  return context;
}
