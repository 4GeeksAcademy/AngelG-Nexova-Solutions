"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ApiRequestError } from "@/lib/api-client";
import {
  createInventoryLot, createInventoryMovement, deleteInventoryItem, deleteInventoryItemPermanently,
  getInventoryItem, getInventoryItems, getInventoryLots, getInventoryMovements, saveInventoryItem,
} from "@/lib/managed-inventory-api";
import {
  inventoryCategories, inventoryMovementTypes, inventoryOffices, inventoryUnits,
  type InventoryItem, type InventoryLot, type InventoryMovement,
} from "@/types/managed-inventory";
import { NumberedPagination } from "@/components/NumberedPagination";
import { getSuppliers, type Supplier } from "@/lib/suppliers-api";
import { telemetryCategories, writableMovementTypes } from "@/types/managed-inventory";

const buttonClass = "rounded-lg border border-cyan-700 px-3 py-2 font-semibold text-cyan-900 disabled:opacity-50";
const inputClass = "w-full rounded border border-slate-300 bg-white px-3 py-2 text-slate-950";

function message(error: unknown): string {
  if (error instanceof ApiRequestError && error.fields) {
    return `${error.message} ${Object.entries(error.fields).map(([field, value]) => `${field}: ${value}`).join("; ")}`;
  }
  return error instanceof Error ? error.message : "No se pudo completar la operación.";
}

function text(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function catalogKey<T extends object>(catalog: T, value: string): keyof T {
  if (!Object.prototype.hasOwnProperty.call(catalog, value)) {
    throw new Error("Selecciona un valor válido del catálogo.");
  }
  return value as keyof T;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-sm font-medium">{label}{children}</label>;
}

function Options({ values }: { values: Record<string, string> }) {
  return Object.entries(values).map(([value, label]) => <option key={value} value={value}>{label}</option>);
}

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function ItemForm({ item, onSaved }: { item?: InventoryItem; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      await saveInventoryItem({
        name: text(data, "name"),
        ...(text(data, "sku") ? { sku: text(data, "sku") } : {}),
        office: catalogKey(inventoryOffices, text(data, "office")),
        category: catalogKey(inventoryCategories, text(data, "category")),
        unit_of_measure: catalogKey(inventoryUnits, text(data, "unit")),
        reorder_point: text(data, "reorder"),
        lot_tracked: data.has("tracked"),
        telemetry_category: text(data, "telemetryCategory") ? catalogKey(telemetryCategories, text(data, "telemetryCategory")) : null,
        programme_id: text(data, "programme") || null,
      }, item?.id);
      if (!item) form.reset();
      onSaved();
    } catch (cause) { setError(message(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-slate-200 p-4">
      <h2 className="text-lg font-bold">{item ? "Editar artículo" : "Nuevo artículo"}</h2>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre"><input className={inputClass} name="name" required maxLength={200} defaultValue={item?.name} /></Field>
        <Field label="SKU (automático si se deja vacío)"><input className={inputClass} name="sku" maxLength={200} defaultValue={item?.sku} /></Field>
        <Field label="Oficina"><select className={inputClass} name="office" defaultValue={item?.office}><Options values={inventoryOffices} /></select></Field>
        <Field label="Categoría"><select className={inputClass} name="category" defaultValue={item?.category}><Options values={inventoryCategories} /></select></Field>
        <Field label="Unidad"><select className={inputClass} name="unit" defaultValue={item?.unit_of_measure}><Options values={inventoryUnits} /></select></Field>
        <Field label="Punto de reorden"><input className={inputClass} name="reorder" type="number" required min="0" step="0.01" max="9999999999.99" defaultValue={item?.reorder_point ?? "0"} /></Field>
        <Field label="Categoría formativa (Hito 6)"><select className={inputClass} name="telemetryCategory" defaultValue={item?.telemetry_category ?? ""}><option value="">Sin clasificar para telemetría</option><Options values={telemetryCategories} /></select></Field>
        <Field label="Programa (ID estable, junto a categoría formativa)"><input className={inputClass} name="programme" maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="leadership" defaultValue={item?.programme_id ?? ""} /></Field>
        <label className="flex items-center gap-2"><input name="tracked" type="checkbox" defaultChecked={item?.lot_tracked} />Control de lotes en cada movimiento</label>
      </fieldset>
      <p className="text-sm text-slate-600">El stock se calcula desde movimientos. Cambiar oficina o unidad corrige la ficha sin transferir ni convertir cantidades. El control de lotes se aplica a movimientos nuevos; no asigna a lotes el stock anterior.</p>
      {error && <p role="alert" className="text-red-800">{error}</p>}
      <button className={buttonClass} disabled={busy}>{busy ? "Guardando…" : "Guardar artículo"}</button>
    </form>
  );
}

function ItemDetail({ item, onChanged, onDeleted, creation }: {
  item: InventoryItem; onChanged: () => void; onDeleted: () => void; creation?: "lot" | "movement";
}) {
  const [details, setDetails] = useState<{ lots: InventoryLot[]; movements: InventoryMovement[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [kind, setKind] = useState<keyof typeof writableMovementTypes>("inbound");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const pending = useRef(false);
  const [editing, setEditing] = useState(false);
  const [exitType, setExitType] = useState<"allocation" | "consumption">("consumption");
  const [movementOffice, setMovementOffice] = useState(item.office);
  useEffect(() => {
    let active = true;
    Promise.all([getInventoryLots(item.id), getInventoryMovements(item.id)])
      .then(([lots, movements]) => { if (active) setDetails({ lots, movements }); })
      .catch((cause: unknown) => { if (active) setError(message(cause)); });
    return () => { active = false; };
  }, [item.id, attempt]);
  useEffect(() => {
    if (creation !== "movement") return;
    let active = true;
    getSuppliers().then((values) => { if (active) { setSuppliers(values); setSupplierError(null); } })
      .catch((cause: unknown) => { if (active) setSupplierError(message(cause)); });
    return () => { active = false; };
  }, [creation, attempt]);

  function refresh() {
    setDetails(null);
    setError(null);
    setAttempt((value) => value + 1);
    onChanged();
  }
  async function submit(event: FormEvent<HTMLFormElement>, operation: "lot" | "movement") {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      if (operation === "lot") {
        await createInventoryLot({ item_id: item.id, lot_code: text(data, "code"), expiry_date: text(data, "expiry") || null });
      } else {
        const lotId = text(data, "lot");
        const lot = details?.lots.find((value) => String(value.id) === lotId);
        if (kind === "outbound" && lot?.expiry_date && lot.expiry_date < localToday()) {
          throw new Error("No se puede emitir desde un lote caducado.");
        }
        await createInventoryMovement({
          item_id: item.id, lot_id: lotId ? Number(lotId) : null,
          movement_type: kind, quantity: text(data, "quantity"),
          office: catalogKey(inventoryOffices, text(data, "movementOffice")),
          reason: null,
          ...(kind === "inbound" ? {
            supplier: text(data, "supplier") || null,
            supplier_id: text(data, "supplierId") ? Number(text(data, "supplierId")) : null,
            unit_cost: text(data, "unitCost") || null,
          } : {}),
          ...(kind === "outbound" ? {
            exit_type: exitType,
            assigned_to: exitType === "allocation" ? text(data, "assigned") : null,
          } : {}),
        });
      }
      form.reset();
      setNotice(operation === "lot" ? "Lote registrado." : "Movimiento registrado.");
      refresh();
    } catch (cause) { setError(message(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  async function remove() {
    if (pending.current) return;
    if (!window.confirm(`¿Eliminar el artículo sin historial "${item.name}"?`)) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try { await deleteInventoryItem(item.id); onDeleted(); }
    catch (cause) { setError(message(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  return (
    <section aria-label={`Detalle de ${item.name}`} className="grid gap-5">
      {!creation && <header>
        <h2 className="text-xl font-bold">{item.name} · {inventoryOffices[item.office]}</h2>
        <p>Stock calculado: {item.current_stock} · Punto de reorden: {item.reorder_point}</p>
        <p className={item.reorder_alert ? "font-bold text-amber-900" : "text-emerald-800"}>{item.reorder_alert ? "Reabastecimiento necesario" : "Por encima del punto de reorden"}</p>
        <p>Categoría: {inventoryCategories[item.category]} · Unidad: {inventoryUnits[item.unit_of_measure]}</p>
        <p>Control de lotes: {item.lot_tracked ? "Sí" : "No"}</p>
        <p>SKU: {item.sku ?? "Sin SKU registrado"}</p>
        <p>Telemetría: {item.telemetry_category ? telemetryCategories[item.telemetry_category] : "Sin clasificar"} · Programa: {item.programme_id ?? "Sin asignar"}</p>
        {item.source_asset_id != null && <p>ID anterior del Hito 5: {item.source_asset_id}</p>}
      </header>}
      {!creation && <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} onClick={() => setEditing((value) => !value)}>{editing ? "Cancelar edición" : "Editar artículo"}</button>
        <Link className={buttonClass} href={`/backoffice/inventory/${item.id}/lots/new`}>Nuevo lote</Link>
        <Link className={buttonClass} href={`/backoffice/inventory/${item.id}/movements/new`}>Nuevo movimiento</Link>
      </div>}
      {!creation && editing && <>
        <ItemForm key={`${item.id}-${item.updated_at}`} item={item} onSaved={() => { setEditing(false); setNotice("Artículo actualizado."); onChanged(); }} />
      </>}
      {notice && <p role="status">{notice}</p>}
      {error && <div role="alert" className="text-red-800"><p>{error}</p><button type="button" className={buttonClass} onClick={refresh} disabled={busy}>Recargar detalle</button></div>}
      {!details && !error && <p role="status">Cargando lotes y movimientos…</p>}
      {details && <>
        {creation === "lot" && <form onSubmit={(event) => submit(event, "lot")} className="grid gap-3 rounded-xl border p-4">
          <h3 className="font-bold">Nuevo lote</h3>
          <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
            <Field label="Código de lote"><input className={inputClass} name="code" required maxLength={100} /></Field>
            <Field label="Caducidad (opcional)"><input className={inputClass} name="expiry" type="date" /></Field>
          </fieldset>
          <button className={buttonClass} disabled={busy}>Registrar lote</button>
        </form>}
        {!creation && <><h3 className="font-bold">Lotes</h3>
        {details.lots.length === 0 ? <p>No hay lotes registrados.</p> : <ul className="grid gap-2">{details.lots.map((lot) => <li key={lot.id}>
          {lot.lot_code} · {lot.expiry_date ? `Caducidad: ${lot.expiry_date}` : "Sin caducidad"} · Recibido: {new Date(lot.received_at).toLocaleString("es")}
          {lot.expiry_date && lot.expiry_date < localToday() && <strong className="ml-2 text-red-800">Caducado: no admite salidas</strong>}
        </li>)}</ul>}</>}
        {creation === "movement" && <form onSubmit={(event) => submit(event, "movement")} className="grid gap-3 rounded-xl border p-4">
          <h3 className="font-bold">Nuevo movimiento</h3>
          <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo de movimiento"><select className={inputClass} value={kind} onChange={(event) => setKind(catalogKey(writableMovementTypes, event.target.value))}><Options values={writableMovementTypes} /></select></Field>
            <Field label="Oficina del movimiento"><select className={inputClass} name="movementOffice" value={movementOffice} onChange={(event) => setMovementOffice(catalogKey(inventoryOffices, event.target.value))}><Options values={inventoryOffices} /></select></Field>
            <Field label="Cantidad"><input className={inputClass} name="quantity" type="number" step="0.01" min="0.01" max="9999999999.99" required /></Field>
            <Field label={item.lot_tracked ? "Lote (obligatorio)" : "Lote (opcional)"}><select className={inputClass} name="lot" required={item.lot_tracked} defaultValue="">
              <option value="">Seleccionar lote</option>
              {details.lots.map((lot) => <option key={lot.id} value={lot.id} disabled={kind === "outbound" && !!lot.expiry_date && lot.expiry_date < localToday()}>
                {lot.lot_code}{lot.expiry_date && lot.expiry_date < localToday() ? " — Caducado" : ""}
              </option>)}
            </select></Field>
            {kind === "inbound" && <>
              <Field label={item.telemetry_category ? "Proveedor registrado (obligatorio)" : "Proveedor registrado (opcional)"}><select className={inputClass} name="supplierId" required={!!item.telemetry_category} defaultValue=""><option value="">Seleccionar proveedor</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field>
              {!item.telemetry_category && <Field label="Proveedor libre (si no seleccionas uno registrado)"><input className={inputClass} name="supplier" maxLength={200} /></Field>}
              <Field label={`Costo unitario ${movementOffice === "valencia" ? "EUR" : "USD"}`}><input className={inputClass} name="unitCost" type="number" min="0" max="9999999999.99" step="0.01" required={!!item.telemetry_category} /></Field>
            </>}
            {kind === "outbound" && <>
              <Field label="Finalidad de la salida"><select className={inputClass} value={exitType} onChange={(event) => setExitType(event.target.value === "allocation" ? "allocation" : "consumption")}><option value="consumption">Consumo</option><option value="allocation">Asignación a empleado</option></select></Field>
              {exitType === "allocation" && <Field label="Asignado a"><input className={inputClass} name="assigned" required maxLength={200} /></Field>}
            </>}
          </fieldset>
          <p className="text-sm text-slate-600">El Hito 6 permite cambiar stock solo mediante entradas y salidas. Los ajustes históricos se conservan. Valencia usa EUR y Miami USD, sin conversión.</p>
          {supplierError && <p role="alert" className="text-red-800">{supplierError} <Link href="/backoffice/suppliers" className="underline">Abrir proveedores</Link></p>}
          <button className={buttonClass} disabled={busy || (item.lot_tracked && details.lots.length === 0)}>Registrar movimiento</button>
        </form>}
        {!creation && <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-2 text-left font-bold">Historial de movimientos</caption>
            <thead><tr>{["Fecha", "Tipo", "Cantidad", "Motivo", "Lote", "Proveedor", "Costo unitario", "Finalidad", "Asignado a", "Oficina", "Autor"].map((label) => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
            <tbody>{details.movements.map((movement) => <tr key={movement.id} className="border-t">
              <td className="p-2">{new Date(movement.created_at).toLocaleString("es")}</td>
              <td className="p-2">{inventoryMovementTypes[movement.movement_type]}</td><td className="p-2">{movement.quantity}</td>
              <td className="p-2">{movement.reason ?? "—"}</td><td className="p-2">{details.lots.find((lot) => lot.id === movement.lot_id)?.lot_code ?? "—"}</td>
              <td className="p-2">{movement.supplier ?? "—"}</td>
              <td className="p-2">{movement.unit_cost != null ? `${movement.unit_cost} ${movement.currency ?? ""}` : "No registrado"}</td>
              <td className="p-2">{movement.exit_type === "allocation" ? "Asignación" : movement.exit_type === "consumption" ? "Consumo" : "—"}</td>
              <td className="p-2">{movement.assigned_to ?? "—"}</td>
              <td className="p-2">{movement.office ? inventoryOffices[movement.office] : "No registrada"}</td>
              <td className="p-2">{movement.user_uuid ?? "No registrado"}</td>
            </tr>)}</tbody>
          </table>
          {details.movements.length === 0 && <p>No hay movimientos registrados.</p>}
        </div>}
        {!creation && details.lots.length === 0 && details.movements.length === 0 && <button type="button" className={buttonClass} disabled={busy} onClick={remove}>Eliminar artículo sin historial</button>}
      </>}
    </section>
  );
}

export function ManagedInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(1);
  const [office, setOffice] = useState("");
  const [category, setCategory] = useState("");
  const [reorderOnly, setReorderOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteMode, setDeleteMode] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const pendingDelete = useRef(false);
  useEffect(() => {
    let active = true;
    getInventoryItems().then((data) => { if (active) setItems(data); })
      .catch((cause: unknown) => { if (active) setError(message(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  function reload() { setError(null); setLoading(true); setAttempt((value) => value + 1); }
  const term = search.trim().toLocaleLowerCase("es");
  const visible = items.filter((item) => (!office || item.office === office) && (!category || item.category === category) && (!reorderOnly || item.reorder_alert) && (
    !term || [String(item.id), item.sku ?? "", item.name, inventoryOffices[item.office], inventoryCategories[item.category], inventoryUnits[item.unit_of_measure]].some((value) => value.toLocaleLowerCase("es").includes(term))
  ));
  async function removeItem(item: InventoryItem) {
    if (pendingDelete.current) return;
    if (!window.confirm(`¿Eliminar definitivamente "${item.name}" en ${inventoryOffices[item.office]}, incluidos todos sus lotes y movimientos? Esta acción no se puede deshacer.`)) return;
    pendingDelete.current = true;
    setDeletingId(item.id); setActionError(null);
    try {
      await deleteInventoryItemPermanently(item.id);
      setItems((current) => current.filter((value) => value.id !== item.id));
      reload();
    } catch (cause) { setActionError(message(cause)); }
    finally { pendingDelete.current = false; setDeletingId(null); }
  }
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visible.length / 10)));
  const pageItems = visible.slice((currentPage - 1) * 10, currentPage * 10);
  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <section className="mx-auto grid max-w-6xl gap-6 rounded-2xl border border-white/70 bg-white/90 p-5 shadow-lg md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-cyan-800">Nexova · Backoffice</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Inventario de activos</h1><p className="text-sm text-slate-600">Consulta el stock por artículo y oficina, calculado desde movimientos.</p></div>
        <Link className={buttonClass} href="/">Volver al inicio</Link>
      </header>
      <div className="flex flex-wrap gap-3 text-xs font-medium" aria-label="Estados del stock">
        <span className="rounded-full border border-red-300 bg-red-100 px-3 py-1 text-red-900">Sin stock: 0</span>
        <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-amber-900">Reabastecer: stock ≤ punto de reorden</span>
        <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-emerald-900">Disponible: stock superior al punto de reorden</span>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link className={`${buttonClass} w-fit`} href="/backoffice/inventory/new">Nuevo artículo</Link>
        <Link className={`${buttonClass} w-fit`} href="/backoffice/suppliers">Proveedores</Link>
        <Link className={`${buttonClass} w-fit`} href="/backoffice/inventory/reporting">Reporte semanal</Link>
        <Link className={`${buttonClass} w-fit`} href="/backoffice/inventory/telemetry">Telemetría técnica</Link>
        <button type="button" className={`rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
          deleteMode
            ? "border-red-500 bg-red-600 text-white shadow-sm hover:bg-red-700 dark:border-red-400 dark:bg-red-500 dark:text-red-950 dark:hover:bg-red-400"
            : "border-red-400 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-400 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-900"
        }`} aria-pressed={deleteMode} disabled={deletingId !== null} onClick={() => setDeleteMode((value) => !value)}>{deleteMode ? "Cancelar eliminación" : "Eliminar artículos"}</button>
      </div>
      <section className="grid gap-4 rounded-xl border bg-white p-4" aria-label="Listado de artículos">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Buscar artículos"><input className={inputClass} type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nombre, SKU, ID, oficina, categoría o unidad" /></Field>
          <Field label="Filtrar por oficina"><select className={inputClass} value={office} onChange={(event) => { setOffice(event.target.value); setPage(1); }}><option value="">Todas las oficinas</option><Options values={inventoryOffices} /></select></Field>
          <Field label="Filtrar por categoría"><select className={inputClass} value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="">Todas las categorías</option><Options values={inventoryCategories} /></select></Field>
          <label className="flex items-center gap-2"><input type="checkbox" checked={reorderOnly} onChange={(event) => { setReorderOnly(event.target.checked); setPage(1); }} />Solo alertas de reorden</label>
        </div>
        <button type="button" className={buttonClass} onClick={reload} disabled={loading || deletingId !== null}>Actualizar inventario</button>
        {actionError && <p role="alert" className="text-red-800">{actionError}</p>}
        {loading && <p role="status">Cargando inventario…</p>}
        {error && <p role="alert" className="text-red-800">{error}</p>}
        {!loading && !error && <>
          <p role="status">{visible.length} artículos · {visible.filter((item) => item.reorder_alert).length} alertas en esta vista</p>
          {!visible.length ? <p>No hay artículos que coincidan con los filtros.</p> : <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[850px] border-collapse text-left text-sm">
            <caption className="sr-only">Artículos por oficina y stock calculado</caption>
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700"><tr>{["Artículo", "Oficina", "Categoría", "Unidad", "Stock", "Reorden", "Estado", "Acción"].map((label) => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-200">{pageItems.map((item) => <tr key={item.id} className="hover:bg-cyan-50/50">
              <td className="p-2">{item.name}<span className="block text-xs text-slate-500">{item.sku}</span></td><td className="p-2">{inventoryOffices[item.office]}</td><td className="p-2">{inventoryCategories[item.category]}</td><td className="p-2">{inventoryUnits[item.unit_of_measure]}</td>
              <td className="p-2">{item.current_stock}</td><td className="p-2">{item.reorder_point}</td>
              <td className="p-2"><span className={`inline-flex rounded-full border px-3 py-1 font-semibold ${item.reorder_alert ? "border-amber-300 bg-amber-100 text-amber-900" : "border-emerald-300 bg-emerald-100 text-emerald-900"}`}>{Number(item.current_stock) === 0 ? "Sin stock" : item.reorder_alert ? "Reabastecer" : "Disponible"}</span></td>
              <td className="p-2"><div className="flex flex-wrap gap-2"><Link className={buttonClass} aria-label={`Ver ${item.name} en ${inventoryOffices[item.office]}`} href={`/backoffice/inventory/${item.id}`}>Ver detalle</Link>
                {deleteMode && <button type="button" className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-sm font-semibold text-red-800 shadow-sm transition hover:bg-red-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-300 dark:bg-red-400 dark:text-red-950 dark:hover:bg-red-300" disabled={deletingId !== null} aria-label={`Eliminar ${item.name} en ${inventoryOffices[item.office]}`} onClick={() => void removeItem(item)}>Eliminar definitivamente</button>}
              </div></td>
            </tr>)}</tbody>
          </table></div>}
          <NumberedPagination page={currentPage} total={visible.length} onChange={setPage} />
        </>}
      </section>
      </section>
    </main>
  );
}

export function ManagedInventoryDetail({ itemId, creation }: { itemId: number; creation?: "lot" | "movement" }) {
  const router = useRouter();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getInventoryItem(itemId).then((value) => { if (active) setItem(value); })
      .catch((cause: unknown) => { if (active) setError(message(cause)); });
    return () => { active = false; };
  }, [itemId, attempt]);
  function reload() { setError(null); setAttempt((value) => value + 1); }
  return <main className="min-h-screen px-4 py-8 md:px-10">
    <section className="mx-auto grid max-w-5xl gap-6 rounded-2xl border border-white/70 bg-white/90 p-5 shadow-lg md:p-8">
      <header className="border-b border-slate-200 pb-5"><Link href={creation ? `/backoffice/inventory/${itemId}` : "/backoffice/inventory"} className="font-semibold text-cyan-800">{creation ? "← Volver al artículo" : "← Volver al inventario"}</Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">{creation === "lot" ? "Registrar lote" : creation === "movement" ? "Registrar movimiento" : "Detalle del artículo"}</h1></header>
      {error && <div role="alert"><p className="text-red-900">{error}</p><button type="button" className={buttonClass} onClick={reload}>Reintentar</button></div>}
      {!error && !item && <p role="status">Cargando artículo…</p>}
      {!error && item && <ItemDetail item={item} creation={creation} onChanged={creation ? () => router.push(`/backoffice/inventory/${itemId}`) : reload} onDeleted={() => router.push("/backoffice/inventory")} />}
    </section>
  </main>;
}

export function ManagedInventoryCreate() {
  const router = useRouter();
  return <main className="min-h-screen px-4 py-8 md:px-10">
    <section className="mx-auto grid max-w-3xl gap-6 rounded-2xl border bg-white/90 p-6">
      <Link href="/backoffice/inventory" className="font-semibold text-cyan-800">← Volver al inventario</Link>
      <h1 className="text-2xl font-bold">Registrar artículo</h1>
      <ItemForm onSaved={() => router.push("/backoffice/inventory")} />
    </section>
  </main>;
}
