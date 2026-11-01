"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { NumberedPagination } from "@/components/NumberedPagination";
import {
  createSupplier, deleteSupplier, getSupplier, getSuppliers, supplierCategories,
  updateSupplierRate, updateSupplierStatus, type Supplier,
} from "@/lib/suppliers-api";

const input = "w-full rounded-xl border border-slate-300 px-3 py-2";
const button = "rounded-xl bg-cyan-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:opacity-50";
const base = "/backoffice/suppliers";
function errorText(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la operación.";
}

export function SupplierDirectory({ supplierId, creation = false }: { supplierId?: number; creation?: boolean }) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(!creation);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [deleteMode, setDeleteMode] = useState(false);

  useEffect(() => {
    if (creation) return;
    let active = true;
    const request = supplierId === undefined ? getSuppliers() : getSupplier(supplierId);
    request.then((data) => {
      if (!active) return;
      if (Array.isArray(data)) setSuppliers(data);
      else setSupplier(data);
      setError(null);
    }).catch((cause) => { if (active) setError(errorText(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [supplierId, creation, version]);

  async function act(operation: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try { await operation(); }
    catch (cause) { setError(errorText(cause)); }
    finally { pending.current = false; setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await act(async () => {
      const selectedCountry = form.get("country") === "USA" ? "USA" : "Spain";
      const created = await createSupplier({
        name: String(form.get("name")).trim(),
        country: selectedCountry,
        categories: Object.keys(supplierCategories).filter((key) => form.has(key))
          .filter((key): key is keyof typeof supplierCategories => key in supplierCategories),
        monthly_rate: Number(form.get("rate")),
        currency: selectedCountry === "Spain" ? "EUR" : "USD",
        status: form.get("status") === "suspended" ? "suspended" : "active",
        contract_renewal_date: String(form.get("renewal") || "") || null,
        contact_email: String(form.get("email") || "").trim() || null,
        notes: String(form.get("notes") || "").trim() || null,
      });
      router.push(`${base}/${created.id}`);
    });
  }

  async function removeSupplier(item: Supplier) {
    if (pending.current) return;
    if (!window.confirm(`¿Eliminar definitivamente a ${item.name}? Se borrará de la base de datos. No se puede deshacer; los movimientos del inventario conservan su historial.`)) return;
    await act(async () => {
      await deleteSupplier(item.id);
      if (supplierId !== undefined) router.push(base);
      else setSuppliers((current) => current.filter((value) => value.id !== item.id));
    });
  }

  const filtered = suppliers.filter((item) =>
    (!country || item.country === country) && (!category || item.categories.some((value) => value === category))
    && `${item.id} ${item.name}`.toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es")));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 10)));

  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <section className="mx-auto grid max-w-6xl gap-5 rounded-2xl bg-white p-6 shadow-lg">
        <Link href={supplierId !== undefined || creation ? base : "/backoffice/inventory"} className="font-semibold text-cyan-800">← {supplierId !== undefined || creation ? "Volver a proveedores" : "Volver al inventario"}</Link>
        <h1 className="text-2xl font-bold">{creation ? "Nuevo proveedor" : supplierId !== undefined ? "Detalle del proveedor" : "Directorio de proveedores"}</h1>
        {error && <div role="alert" className="text-red-800">{error}{!creation && <button className={`${button} ml-3`} onClick={() => setVersion((value) => value + 1)}>Reintentar</button>}</div>}
        {loading && <p role="status">Cargando proveedores…</p>}
        {creation && <form onSubmit={submit} className="grid gap-4">
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            <label>Nombre<input name="name" required maxLength={200} className={input} /></label>
            <label>País<select name="country" className={input}><option value="Spain">España · EUR</option><option value="USA">EE. UU. · USD</option></select></label>
            <label>Tarifa mensual<input name="rate" type="number" required min="0.01" step="0.01" className={input} /></label>
            <label>Estado<select name="status" className={input}><option value="active">Activo</option><option value="suspended">Suspendido</option></select></label>
            <label>Renovación del contrato<input name="renewal" type="date" className={input} /></label>
            <label>Email de contacto<input name="email" type="email" maxLength={254} className={input} /></label>
            <fieldset className="grid gap-2"><legend>Categorías (al menos una)</legend>{Object.entries(supplierCategories).map(([key, label]) => <label key={key}><input name={key} type="checkbox" /> {label}</label>)}</fieldset>
            <label>Notas<textarea name="notes" maxLength={5000} className={input} /></label>
          </fieldset>
          <button disabled={busy} className={button}>{busy ? "Guardando…" : "Crear proveedor"}</button>
        </form>}
        {!creation && supplierId === undefined && !loading && <>
          <div className="flex flex-wrap gap-3">
            <Link href={`${base}/new`} className={`${button} w-fit`}>Nuevo proveedor</Link>
            <button type="button" className={`rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              deleteMode
                ? "border-red-500 bg-red-600 text-white shadow-sm hover:bg-red-700 dark:border-red-400 dark:bg-red-500 dark:text-red-950 dark:hover:bg-red-400"
                : "border-red-400 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-400 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-900"
            }`} aria-pressed={deleteMode} disabled={busy} onClick={() => setDeleteMode((value) => !value)}>{deleteMode ? "Cancelar eliminación" : "Eliminar proveedores"}</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label>Buscar proveedores<input className={input} type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></label>
            <label>País<select className={input} value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }}><option value="">Todos</option><option value="Spain">España</option><option value="USA">EE. UU.</option></select></label>
            <label>Categoría<select className={input} value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}><option value="">Todas</option>{Object.entries(supplierCategories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Nombre", "País", "Categorías", "Tarifa mensual", "Estado", "Acciones"].map((label) => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>
            {filtered.slice((currentPage - 1) * 10, currentPage * 10).map((item) => <tr className="border-t" key={item.id}>
              <td className="p-2">{item.name}</td><td className="p-2">{item.country === "Spain" ? "España" : "EE. UU."}</td><td className="p-2">{item.categories.map((key) => supplierCategories[key]).join(", ")}</td><td className="p-2">{item.monthly_rate} {item.currency}</td><td className="p-2">{item.status === "active" ? "Activo" : "Suspendido"}</td><td className="p-2"><div className="flex flex-wrap items-center gap-2"><Link className="text-cyan-800 underline" href={`${base}/${item.id}`}>Ver detalles de {item.name}</Link>
                {deleteMode && <button type="button" className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-sm font-semibold text-red-800 shadow-sm transition hover:bg-red-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-300 dark:bg-red-400 dark:text-red-950 dark:hover:bg-red-300" disabled={busy} aria-label={`Eliminar ${item.name}`} onClick={() => void removeSupplier(item)}>Eliminar definitivamente</button>}
              </div></td>
            </tr>)}
          </tbody></table></div>
          {!filtered.length && !error && <p>No hay proveedores que coincidan con los filtros.</p>}
          <NumberedPagination page={currentPage} total={filtered.length} onChange={setPage} />
        </>}
        {supplier && supplierId !== undefined && <>
          <h2 className="text-xl font-bold">{supplier.name}</h2>
          <dl className="grid gap-2">
            <div>País: {supplier.country === "Spain" ? "España" : "EE. UU."}</div>
            <div>Categorías: {supplier.categories.map((key) => supplierCategories[key]).join(", ")}</div>
            <div>Tarifa: {supplier.monthly_rate} {supplier.currency}</div>
            <div>Estado: {supplier.status === "active" ? "Activo" : "Suspendido"}</div>
            <div>Renovación: {supplier.contract_renewal_date ?? "No registrada"}</div>
            <div>Contacto: {supplier.contact_email ?? "No registrado"}</div>
            <div>Notas: {supplier.notes ?? "Sin notas"}</div>
            <div>Actualizado: {new Date(supplier.updated_at).toLocaleString("es")}</div>
          </dl>
          <form onSubmit={(event) => {
            event.preventDefault();
            const rate = Number(new FormData(event.currentTarget).get("rate"));
            void act(async () => { setSupplier(await updateSupplierRate(supplier.id, rate)); });
          }} className="flex flex-wrap items-end gap-3">
            <label>Nueva tarifa mensual<input name="rate" type="number" required min="0.01" step="0.01" className={input} disabled={busy} /></label>
            <button disabled={busy} className={button}>Actualizar tarifa</button>
          </form>
          <button disabled={busy} className={`${button} w-fit`} onClick={() => void act(async () => {
            setSupplier(await updateSupplierStatus(supplier.id, supplier.status === "active" ? "suspended" : "active"));
          })}>{supplier.status === "active" ? "Suspender proveedor" : "Activar proveedor"}</button>
          <button disabled={busy} className="w-fit rounded-xl border border-red-400 bg-red-100 px-3 py-2 font-semibold text-red-800 transition hover:bg-red-200 hover:shadow-lg disabled:opacity-50" onClick={() => void removeSupplier(supplier)}>Eliminar proveedor</button>
        </>}
      </section>
    </main>
  );
}
