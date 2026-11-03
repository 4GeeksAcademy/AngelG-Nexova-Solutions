"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  createManagedUser,
  deleteManagedUser,
  forceManagedUserPasswordReset,
  getManagedUsers,
  type ManagedUser,
  type UserRole,
} from "@/lib/api-client";

const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  manager: "Manager",
  supervisor: "Supervisor",
  user: "Usuario",
};

const roles: UserRole[] = ["user", "supervisor", "manager", "admin"];

export function UserAdministration() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [isCreating, setIsCreating] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoadError(null);
    try {
      setUsers(await getManagedUsers());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No se pudieron cargar los usuarios.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    getManagedUsers()
      .then((data) => {
        if (isMounted) setUsers(data);
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : "No se pudieron cargar los usuarios.");
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFeedback(null);
    setIsCreating(true);
    try {
      const created = await createManagedUser({
        email: email.trim(),
        role,
        name: name.trim() || null,
      });
      setUsers((current) => [...current, created]);
      setEmail("");
      setName("");
      setFeedback(
        created.password_setup_email_sent
          ? "Usuario creado. Se envió un enlace de un solo uso para establecer su contraseña."
          : "Usuario creado, pero no se pudo enviar el enlace. Usa «Forzar cambio de contraseña» cuando el correo esté disponible.",
      );
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No se pudo crear el usuario.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleForceReset(user: ManagedUser) {
    if (!window.confirm(`¿Forzar un cambio de contraseña para ${user.email}? La contraseña actual dejará de funcionar.`)) return;
    setBusyUserId(user.id);
    setFeedback(null);
    try {
      const result = await forceManagedUserPasswordReset(user.id);
      setFeedback(result.message);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No se pudo enviar el enlace.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleDelete(user: ManagedUser) {
    if (!window.confirm(`¿Eliminar definitivamente a ${user.email}? Esta acción no se puede deshacer.`)) return;
    setBusyUserId(user.id);
    setFeedback(null);
    try {
      await deleteManagedUser(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setFeedback("Usuario eliminado correctamente.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No se pudo eliminar el usuario.");
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <section aria-labelledby="user-administration-heading" className="mt-8 border-t border-slate-200 pt-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Administración</p>
      <h2 id="user-administration-heading" className="mt-2 text-xl font-bold text-slate-900">
        Administración de usuarios
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Las cuentas nuevas reciben un enlace de un solo uso para establecer su contraseña; nunca se muestra una contraseña temporal.
      </p>

      <form onSubmit={handleCreate} className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
        <div>
          <label htmlFor="managed-user-email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input id="managed-user-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200" />
        </div>
        <div>
          <label htmlFor="managed-user-name" className="mb-1 block text-sm font-medium text-slate-700">Nombre (opcional)</label>
          <input id="managed-user-name" value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200" />
        </div>
        <div>
          <label htmlFor="managed-user-role" className="mb-1 block text-sm font-medium text-slate-700">Rol</label>
          <select id="managed-user-role" value={role} onChange={(event) => setRole(event.target.value as UserRole)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200">
            {roles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}
          </select>
        </div>
        {formError ? <p role="alert" className="text-sm text-red-700 md:col-span-3">{formError}</p> : null}
        <div className="md:col-span-3">
          <button type="submit" disabled={isCreating} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
            {isCreating ? "Creando…" : "Crear usuario"}
          </button>
        </div>
      </form>

      {feedback ? <p role="status" className="mt-4 rounded-xl bg-cyan-50 px-3 py-2 text-sm text-cyan-900">{feedback}</p> : null}

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Usuarios existentes</h3>
          <button type="button" onClick={() => void loadUsers()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">Actualizar lista</button>
        </div>
        {isLoading ? <p className="text-sm text-slate-600">Cargando usuarios…</p> : null}
        {loadError ? <div role="alert" className="space-y-2 text-sm text-red-700"><p>{loadError}</p><button type="button" onClick={() => void loadUsers()} className="rounded-lg border border-red-300 px-3 py-2 font-medium transition hover:bg-red-50">Reintentar</button></div> : null}
        {!isLoading && !loadError && users.length === 0 ? <p className="text-sm text-slate-600">No hay usuarios registrados.</p> : null}
        {!isLoading && !loadError && users.length > 0 ? (
          <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200">
            {users.map((user) => (
              <li key={user.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{user.name || user.email}</p>
                  {user.name ? <p className="truncate text-sm text-slate-600">{user.email}</p> : null}
                  <p className="mt-1 text-xs text-slate-500">{roleLabels[user.role]} · {user.is_active ? "Activo" : "Inactivo"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busyUserId === user.id} onClick={() => void handleForceReset(user)} className="rounded-lg border border-cyan-700 px-3 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50">Forzar cambio de contraseña</button>
                  <button type="button" disabled={busyUserId === user.id} onClick={() => void handleDelete(user)} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}