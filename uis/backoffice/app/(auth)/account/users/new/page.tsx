"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Loading } from "@/components/Loading";
import { useAuth } from "@/lib/auth-context";
import { createManagedUser, type ManagedUserRole } from "@/lib/api-client";

const roleLabels: Record<ManagedUserRole, string> = {
  user: "Usuario",
  manager: "Manager",
  admin: "Administrador",
};

const roles: ManagedUserRole[] = ["user", "manager", "admin"];

export default function NewManagedUserPage() {
  const { authState, isReady, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<ManagedUserRole>("user");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isReady || authState.status === "initializing") {
    return <Loading />;
  }

  if (authState.status === "error") {
    return (
      <main className="min-h-screen px-4 py-8 md:px-10">
        <section className="mx-auto w-full max-w-xl rounded-3xl border border-amber-200 bg-white/90 p-6 shadow-xl md:p-8">
          <p role="alert" className="text-sm text-amber-900">No se pudo verificar tu sesión. {authState.message}</p>
        </section>
      </main>
    );
  }

  if (user?.role !== "admin") {
    return (
      <main className="min-h-screen px-4 py-8 md:px-10">
        <section className="mx-auto w-full max-w-xl rounded-3xl border border-white/60 bg-white/90 p-6 shadow-xl md:p-8">
          <p className="text-sm text-slate-700">No tienes permisos para crear cuentas.</p>
          <Link href="/account/profile?section=users" className="mt-4 inline-flex text-sm font-semibold text-cyan-800 hover:text-cyan-950">Volver a administración de usuarios</Link>
        </section>
      </main>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsCreating(true);

    try {
      const created = await createManagedUser({
        email: email.trim(),
        role,
        name: name.trim() || null,
      });
      setSuccess(
        created.password_setup_email_sent
          ? "Cuenta creada. Se envió un enlace de un solo uso para establecer la contraseña."
          : "Cuenta creada, pero no se pudo enviar el enlace de contraseña. Podrás forzar el cambio desde la administración de usuarios.",
      );
      setEmail("");
      setName("");
      setRole("user");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No se pudo crear la cuenta.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <section className="mx-auto w-full max-w-2xl rounded-3xl border border-white/60 bg-white/85 p-6 shadow-xl backdrop-blur md:p-9">
        <header className="mb-8">
          <Link href="/account/profile?section=users" className="text-sm font-semibold text-cyan-700 hover:text-cyan-900">← Volver a administración de usuarios</Link>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Nexova · Administración</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Crear cuenta</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Registra una cuenta para un integrante del equipo. Recibirá un enlace de un solo uso para establecer su contraseña.</p>
        </header>

        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-5">
          <div>
            <label htmlFor="managed-user-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
            <input id="managed-user-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200" />
          </div>
          <div>
            <label htmlFor="managed-user-name" className="mb-1.5 block text-sm font-medium text-slate-700">Nombre <span className="font-normal text-slate-500">(opcional)</span></label>
            <input id="managed-user-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200" />
          </div>
          <div>
            <label htmlFor="managed-user-role" className="mb-1.5 block text-sm font-medium text-slate-700">Rol</label>
            <select id="managed-user-role" value={role} onChange={(event) => setRole(event.target.value as ManagedUserRole)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200">
              {roles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}
            </select>
          </div>
          {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {success ? <p role="status" className="rounded-xl bg-cyan-50 px-3 py-2 text-sm text-cyan-900">{success}</p> : null}
          <div className="flex flex-wrap gap-3 pt-1">
            <button type="submit" disabled={isCreating} className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
              {isCreating ? "Creando…" : "Crear usuario"}
            </button>
            <button type="button" disabled={isCreating} onClick={() => router.push("/account/profile?section=users")} className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Cancelar</button>
          </div>
        </form>
      </section>
    </main>
  );
}
