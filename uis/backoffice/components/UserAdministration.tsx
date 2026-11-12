"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  deleteManagedUser,
  getManagedUsers,
  updateManagedUserPassword,
  updateManagedUserRole,
  type ManagedUser,
  type ManagedUserRole,
  type UserRole,
} from "@/lib/api-client";

const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  manager: "Manager",
  supervisor: "Supervisor (rol anterior)",
  user: "Usuario",
};

const roles: ManagedUserRole[] = ["user", "manager", "admin"];

export function UserAdministration() {
  const router = useRouter();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, ManagedUserRole>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [passwordUser, setPasswordUser] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  function openPasswordForm(user: ManagedUser) {
    setPasswordUser(user);
    setNewPassword("");
    setConfirmPassword("");
    setFormError(null);
    setFeedback(null);
  }

  function closePasswordForm() {
    setPasswordUser(null);
    setNewPassword("");
    setConfirmPassword("");
    setFormError(null);
  }

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordUser) return;
    setFormError(null);
    setFeedback(null);
    if (newPassword.length < 8) {
      setFormError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("Las contraseñas no coinciden.");
      return;
    }
    if (!window.confirm(`¿Guardar la nueva contraseña para ${passwordUser.email}? La contraseña actual dejará de funcionar.`)) return;

    setBusyUserId(passwordUser.id);
    try {
      await updateManagedUserPassword(passwordUser.id, newPassword);
      setFeedback(`Contraseña actualizada para ${passwordUser.email}.`);
      closePasswordForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No se pudo actualizar la contraseña.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleRoleChange(user: ManagedUser) {
    const role = selectedRoles[user.id] ?? (user.role === "supervisor" ? "manager" : user.role);
    if (!role || role === user.role) return;
    if (!window.confirm(`¿Cambiar el rol de ${user.email} a ${roleLabels[role]}?`)) return;
    setBusyUserId(user.id);
    setFeedback(null);
    try {
      await updateManagedUserRole(user.id, role);
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, role } : item));
      setSelectedRoles((current) => ({ ...current, [user.id]: role }));
      setFeedback(`Rol de ${user.email} actualizado a ${roleLabels[role]}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No se pudo cambiar el rol.");
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
      {passwordUser ? (
        <div className="mt-5">
          <button type="button" onClick={closePasswordForm} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800 hover:text-cyan-950">
            <span aria-hidden="true">←</span> Volver a administración de usuarios
          </button>
          <h3 className="text-lg font-semibold text-slate-900">Establecer contraseña para {passwordUser.email}</h3>
          <p className="mt-1 text-sm text-slate-600">Define directamente una nueva contraseña. No se enviará ningún correo.</p>
          <form onSubmit={(event) => void handlePasswordUpdate(event)} className="mt-4 grid max-w-xl gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <label htmlFor="managed-user-new-password" className="mb-1 block text-sm font-medium text-slate-700">Nueva contraseña</label>
              <input id="managed-user-new-password" type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200" />
            </div>
            <div>
              <label htmlFor="managed-user-confirm-password" className="mb-1 block text-sm font-medium text-slate-700">Confirmar nueva contraseña</label>
              <input id="managed-user-confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200" />
            </div>
            {formError ? <p role="alert" className="text-sm text-red-700">{formError}</p> : null}
            <button type="submit" disabled={busyUserId === passwordUser.id} className="w-fit rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
              {busyUserId === passwordUser.id ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        </div>
      ) : <>
      <button
        type="button"
        onClick={() => router.push("/account/users/new")}
        className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
      >
        Crear cuenta
      </button>
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
                  <label className="sr-only" htmlFor={`managed-role-${user.id}`}>Rol de {user.email}</label>
                  <select
                    id={`managed-role-${user.id}`}
                    aria-label={`Rol de ${user.email}`}
                    value={selectedRoles[user.id] ?? (user.role === "supervisor" ? "manager" : user.role)}
                    onChange={(event) => setSelectedRoles((current) => ({ ...current, [user.id]: event.target.value as ManagedUserRole }))}
                    disabled={busyUserId === user.id}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    {roles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}
                  </select>
                  <button type="button" disabled={busyUserId === user.id || (selectedRoles[user.id] ?? (user.role === "supervisor" ? "manager" : user.role)) === user.role} onClick={() => void handleRoleChange(user)} className="rounded-lg border border-cyan-700 px-3 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50">Cambiar rol</button>
                  <button type="button" disabled={busyUserId === user.id} onClick={() => openPasswordForm(user)} className="rounded-lg border border-cyan-700 px-3 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50">Forzar cambio de contraseña</button>
                  <button type="button" disabled={busyUserId === user.id} onClick={() => void handleDelete(user)} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      </>}
    </section>
  );
}