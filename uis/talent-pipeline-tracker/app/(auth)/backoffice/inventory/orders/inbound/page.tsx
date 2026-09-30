"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Loading } from "@/components/Loading";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getInventoryProducts, createInboundOrder } from "@/lib/inventory";
import type { Asset } from "@/types/inventory";

function getInitialProductId(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("productId") ?? "";
}

export default function InboundOrderPage() {
  return (
    <ProtectedRoute>
      <InboundOrderForm />
    </ProtectedRoute>
  );
}

function InboundOrderForm() {
  const [products, setProducts] = useState<Asset[]>([]);
  const [productId, setProductId] = useState(getInitialProductId);
  const [quantity, setQuantity] = useState("");
  const [supplier, setSupplier] = useState("");
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    let isActive = true;

    getInventoryProducts()
      .then((data) => {
        if (!isActive) return;
        setProducts(data);
        setProductId((selectedId) =>
          data.some((asset) => String(asset.id) === selectedId) ? selectedId : "",
        );
      })
      .catch((requestError: unknown) => {
        if (!isActive) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudieron cargar los activos. Intentá nuevamente.",
        );
      })
      .finally(() => {
        if (isActive) setIsLoadingProducts(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    setError(null);
    setSuccess(null);

    const selectedAsset = products.find((asset) => String(asset.id) === productId);
    const parsedQuantity = Number(quantity);
    if (!selectedAsset) {
      setError("Seleccioná un activo de la lista.");
      return;
    }
    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity <= 0) {
      setError("Ingresá una cantidad entera mayor que cero.");
      return;
    }
    if (!supplier.trim()) {
      setError("Ingresá el proveedor o vendedor de la entrega.");
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      await createInboundOrder({
        asset_id: selectedAsset.id,
        quantity: parsedQuantity,
        supplier: supplier.trim(),
        office: selectedAsset.office,
      });
      setSuccess(
        `Entrada registrada: ${parsedQuantity} unidad${parsedQuantity === 1 ? "" : "es"} de ${selectedAsset.name} para ${selectedAsset.office}.`,
      );
      setProductId("");
      setQuantity("");
      setSupplier("");
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo registrar la entrada. Revisá los datos e intentá nuevamente.",
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-white/70 bg-white/90 p-5 shadow-lg md:p-8">
        <header className="mb-6 border-b border-slate-200 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">
            Nexova · Operaciones
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Registrar entrada de activos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Registra una compra o entrega de proveedor recibida por Nexova.
          </p>
        </header>

        <nav aria-label="Navegación de inventario" className="mb-6 flex flex-wrap gap-2">
          <Link
            href="/backoffice/inventory/products"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-cyan-700 hover:text-cyan-800"
          >
            Ver inventario
          </Link>
          <Link
            href="/backoffice/inventory/orders/outbound"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-cyan-700 hover:text-cyan-800"
          >
            Registrar salida
          </Link>
          <Link
            href="/backoffice/inventory/orders"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-cyan-700 hover:text-cyan-800"
          >
            Historial
          </Link>
        </nav>

        {error && (
          <div className="mb-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <p className="font-semibold">No se pudo completar la operación</p>
            <p className="mt-1">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-5 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900" role="status" aria-live="polite">
            <p className="font-semibold">Entrada registrada correctamente</p>
            <p className="mt-1">{success}</p>
          </div>
        )}

        {isLoadingProducts ? (
          <div role="status" aria-live="polite">
            <Loading />
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="status">
            No hay activos disponibles para registrar una entrada.
          </div>
        ) : (
          <form className="grid max-w-xl gap-5" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm font-semibold text-slate-800" htmlFor="assetId">
              Activo recibido
              <select
                id="assetId"
                name="asset_id"
                required
                value={productId}
                onChange={(event) => {
                  setProductId(event.target.value);
                  setError(null);
                  setSuccess(null);
                }}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-300 bg-white px-3 py-3 font-normal text-slate-950 shadow-sm focus:border-cyan-700 focus:outline-2 focus:outline-cyan-700 disabled:bg-slate-100"
              >
                <option value="">Seleccioná un activo</option>
                {products.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} ({asset.sku}) · {asset.office}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-800" htmlFor="quantity">
                Cantidad recibida
                <input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={quantity}
                  onChange={(event) => {
                    setQuantity(event.target.value);
                    setError(null);
                    setSuccess(null);
                  }}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-3 font-normal text-slate-950 shadow-sm focus:border-cyan-700 focus:outline-2 focus:outline-cyan-700 disabled:bg-slate-100"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-800" htmlFor="supplier">
                Proveedor o vendedor
                <input
                  id="supplier"
                  name="supplier"
                  type="text"
                  autoComplete="organization"
                  required
                  maxLength={200}
                  value={supplier}
                  onChange={(event) => {
                    setSupplier(event.target.value);
                    setError(null);
                    setSuccess(null);
                  }}
                  disabled={isSubmitting}
                  placeholder="Ej.: TechDistrib Valencia S.L."
                  className="rounded-lg border border-slate-300 bg-white px-3 py-3 font-normal text-slate-950 shadow-sm focus:border-cyan-700 focus:outline-2 focus:outline-cyan-700 disabled:bg-slate-100"
                />
              </label>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Oficina receptora: </span>
              {products.find((asset) => String(asset.id) === productId)?.office ??
                "Se determina al seleccionar el activo"}
              <p className="mt-1 text-xs text-slate-500">
                La oficina se completa desde el activo seleccionado para mantener los datos coherentes.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !productId || !quantity || !supplier.trim()}
              className="inline-flex w-fit items-center justify-center rounded-lg bg-cyan-800 px-5 py-3 text-sm font-bold text-white hover:bg-cyan-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Registrando entrada…" : "Registrar entrada"}
            </button>
            {isSubmitting && (
              <p className="text-sm text-cyan-900" role="status" aria-live="polite">
                Procesando la entrada. No cierres esta página.
              </p>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
