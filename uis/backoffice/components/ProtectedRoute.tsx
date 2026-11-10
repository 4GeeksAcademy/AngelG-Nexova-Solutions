"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Loading } from "@/components/Loading";
import { useAuth } from "@/lib/auth-context";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Guard de rutas del lado cliente.
 *
 * - Si no hay token → redirige a /login.
 * - Mientras se lee localStorage muestra un spinner.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const auth = useAuth();
  const { isAuthenticated, isReady, retryAuthentication } = auth;
  const authState = auth.authState ?? {
    status: !isReady ? "initializing" : isAuthenticated ? "authenticated" : "anonymous",
    user: auth.user,
  };
  const router = useRouter();

  useEffect(() => {
    if (authState.status === "anonymous") {
      router.replace("/login");
    }
  }, [authState.status, router]);

  if (!isReady) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-10">
        <section className="mx-auto w-full max-w-6xl rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur md:p-8">
          <Loading />
        </section>
      </main>
    );
  }

  if (authState.status === "error") {
    return (
      <main className="min-h-screen px-4 py-8 md:px-10">
        <section className="mx-auto w-full max-w-6xl rounded-3xl border border-amber-200 bg-white/90 p-6 shadow-xl md:p-8">
          <p role="alert" className="text-sm text-amber-900">
            No se pudo verificar tu sesión. {authState.message}
          </p>
          <button
            type="button"
            onClick={retryAuthentication}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Reintentar
          </button>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}