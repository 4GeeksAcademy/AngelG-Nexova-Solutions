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
  const { isAuthenticated, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isReady, isAuthenticated, router]);

  if (!isReady) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-10">
        <section className="mx-auto w-full max-w-6xl rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur md:p-8">
          <Loading />
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}