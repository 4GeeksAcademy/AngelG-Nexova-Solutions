"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  clearOnUnauthorized,
  getMe,
  loginRequest,
  registerRequest,
  setOnUnauthorized,
  type RegisterPayload,
} from "@/lib/api-client";

// ─── Tipos ───

export interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  /** Usuario autenticado (null si no hay sesión). */
  user: User | null;
  /** Indica si ya se verificó localStorage. */
  isReady: boolean;
  /** Login: recibe email + password, guarda token y actualiza estado. */
  login: (email: string, password: string) => Promise<void>;
  /** Registro + login automático. */
  register: (payload: RegisterPayload) => Promise<void>;
  /** Logout: elimina token, limpia estado y redirige a /login. */
  logout: () => void;
  /** Indica si hay un token guardado. */
  isAuthenticated: boolean;
}

// ─── Contexto ───

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ───

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const fetchedMe = useRef(false);

  // Al montar, si hay token, obtener datos del usuario desde /auth/me
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setIsReady(true);
      return;
    }

    if (fetchedMe.current) return;
    fetchedMe.current = true;

    getMe()
      .then((me) => {
        setUser({
          id: me.id,
          email: me.email,
          role: me.role,
        });
      })
      .catch(() => {
        // Token inválido o expirado → limpiar
        localStorage.removeItem("token");
      })
      .finally(() => {
        setIsReady(true);
      });
  }, []);

  // Registrar el callback de 401
  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
      localStorage.removeItem("token");
      router.push("/login");
    });

    return () => {
      clearOnUnauthorized();
    };
  }, [router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await loginRequest(email, password);
      localStorage.setItem("token", response.access_token);

      try {
        // Obtener datos completos del usuario
        const me = await getMe();
        setUser({
          id: me.id,
          email: me.email,
          role: me.role,
        });
      } catch {
        // Si getMe() falla, no podemos dejar el token guardado
        localStorage.removeItem("token");
        throw new Error("Error al obtener datos del usuario. Intente nuevamente.");
      }
    },
    [],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      // 1. Crear usuario → POST /users
      await registerRequest(payload);
      // 2. Login automático
      await login(payload.email, payload.password);
    },
    [login],
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
    router.push("/login");
  }, [router]);

  const isAuthenticated = !!user;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isReady,
      login,
      register,
      logout,
      isAuthenticated,
    }),
    [user, isReady, login, register, logout, isAuthenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ───

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un <AuthProvider>");
  }
  return context;
}