/**
 * Cliente HTTP autenticado.
 *
 * Centraliza:
 *  - lectura del token desde localStorage
 *  - encabezado Authorization: Bearer
 *  - manejo automático de 401 (cierre de sesión)
 */

function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    throw new Error("Falta NEXT_PUBLIC_API_URL en variables de entorno.");
  }

  return baseUrl;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

/**
 * Callback que se invoca automáticamente ante un 401.
 * Lo registra AuthProvider al montarse.
 */
let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(cb: () => void): void {
  onUnauthorized = cb;
}

export function clearOnUnauthorized(): void {
  onUnauthorized = null;
}

type RequestOptions = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

export async function authRequest<T = unknown>(
  path: string,
  init?: RequestOptions,
): Promise<T> {
  const token = getToken();

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    // Limpiar sesión y notificar
    localStorage.removeItem("token");
    if (onUnauthorized) {
      onUnauthorized();
    }
    throw new Error("Sesión expirada. Redirigiendo al inicio de sesión…");
  }

  if (!response.ok) {
    const errorBody = await response.text();
    let detail = `Error HTTP ${response.status}`;

    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.detail) {
        detail = parsed.detail;
      }
    } catch {
      if (errorBody) {
        detail = errorBody;
      }
    }

    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// ─── Helpers tipados para los endpoints de autenticación ───

export interface LoginPayload {
  username: string; // OAuth2PasswordRequestForm usa "username" para el email
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface ProfileData {
  id: string;
  user_id: string;
  name: string | null;
  phone: string | null;
  address: string | null;
}

export interface MeResponse {
  id: string;
  email: string;
  role: string;
  profile: ProfileData | null;
}

export interface ProfileUpdatePayload {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
}

// ─── Funciones de autenticación ───

export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginResponse> {
  // OAuth2PasswordRequestForm espera form-urlencoded
  const formBody = new URLSearchParams({
    username: email,
    password,
  });

  const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    let detail = `Error HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.detail) detail = parsed.detail;
    } catch {
      if (errorText) detail = errorText;
    }
    throw new Error(detail);
  }

  return (await response.json()) as LoginResponse;
}

export async function registerRequest(
  payload: RegisterPayload,
): Promise<{ user: unknown; profile: ProfileData | null }> {
  return authRequest("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMe(): Promise<MeResponse> {
  return authRequest<MeResponse>("/auth/me");
}

export async function updateMyProfile(
  payload: ProfileUpdatePayload,
): Promise<ProfileData> {
  return authRequest<ProfileData>("/profiles/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}