"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Loading } from "@/components/Loading";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  createOutboundOrder,
  getInventoryProducts,
  InventoryApiError,
} from "@/lib/inventory";
import type { Asset, ExitType } from "@/types/inventory";

export default function OutboundOrderPage() {
  return (
    <ProtectedRoute>
      <OutboundOrderForm />
    </ProtectedRoute>
  );
}

function OutboundOrderForm() {
  const [products, setProducts] = useState<Asset[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [exitType, setExitType] = useState<ExitType>("allocation");
  const [assignedTo, setAssignedTo] = useState("");
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const submittingRef = useRef(false);

  async function retryLoadProducts() {
    setIsLoadingProducts(true);
    setLoadError(null);
    try {
      const data = await getInventoryProducts();
      setProducts(data);
      setProductId((currentId) =>
        data.some((asset) => String(asset.id) === currentId) ? currentId : "",
      );
    } catch (requestError: unknown) {
      setLoadError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudieron cargar los activos. Intentá nuevamente.",
      );
    } finally {
      setIsLoadingProducts(false);
    }
  }

  useEffect(() => {
    let isActive = true;

    getInventoryProducts()
      .then((data) => {
        if (!isActive) return;
        setProducts(data);
        setProductId((currentId) =>
          data.some((asset) => String(asset.id) === currentId) ? currentId : "",
        );
      })
      .catch((requestError: unknown) => {
        if (!isActive) return;
        setLoadError(
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

  const selectedAsset = products.find((asset) => String(asset.id) === productId) ?? null;
  const parsedQuantity = Number(quantity);
  const hasValidQuantity = Number.isSafeInteger(parsedQuantity) && parsedQuantity > 0;
  const exceedsStock =
    selectedAsset !== null &&
    hasValidQuantity &&
    parsedQuantity > selectedAsset.current_stock;
  const assignedToIsRequired = exitType === "allocation";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    setSubmitError(null);
    setQuantityError(null);
    setSuccess(null);

    if (!selectedAsset) {
      setSubmitError("Seleccioná un activo de la lista.");
      return;
    }
    if (!hasValidQuantity) {
      setQuantityError("Ingresá una cantidad entera mayor que cero.");
      return;
    }
    if (assignedToIsRequired && !assignedTo.trim()) {
      setSubmitError("Indicá a quién se asignará el activo.");
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      await createOutboundOrder({
        asset_id: selectedAsset.id,
        quantity: parsedQuantity,
        exit_type: exitType,
        assigned_to: assignedToIsRequired ? assignedTo.trim() : null,
        office: selectedAsset.office,
      });

      const newStock = Math.max(0, selectedAsset.current_stock - parsedQuantity);
      setProducts((currentProducts) =>
        currentProducts.map((asset) =>
          asset.id === selectedAsset.id ? { ...asset, current_stock: newStock } : asset,
        ),
      );
      setSuccess(
        `Salida registrada: ${parsedQuantity} unidad${parsedQuantity === 1 ? "" : "es"} de ${selectedAsset.name}. Stock disponible actualizado: ${newStock}.`,
      );
      setQuantity("");
      setAssignedTo("");

    } catch (requestError: unknown) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "No se pudo registrar la salida. Revisá los datos e intentá nuevamente.";

      if (requestError instanceof InventoryApiError && requestError.status === 400) {
        setQuantityError(message);
      } else {
        setSubmitError(message);
      }
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
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Registrar salida de activos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Revisá el stock disponible antes de registrar una asignación o un consumo.
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
            href="/backoffice/inventory/orders/inbound"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-cyan-700 hover:text-cyan-800"
          >
            Registrar entrada
          </Link>
          <Link
            href="/backoffice/inventory/orders"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-cyan-700 hover:text-cyan-800"
          >
            Historial
          </Link>
        </nav>

        {submitError && (
          <div className="mb-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <p className="font-semibold">No se pudo registrar la salida</p>
            <p className="mt-1">{submitError}</p>
          </div>
        )}
        {success && (
          <div className="mb-5 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900" role="status" aria-live="polite">
            <p className="font-semibold">Salida registrada correctamente</p>
            <p className="mt-1">{success}</p>
          </div>
        )}

        {isLoadingProducts ? (
          <div role="status" aria-live="polite">
            <Loading />
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => void retryLoadProducts()}
              className="mt-3 rounded-lg border border-red-400 px-3 py-2 font-semibold hover:bg-red-100"
            >
              Reintentar carga
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="status">
            No hay activos disponibles para registrar una salida.
          </div>
        ) : (
          <form className="grid max-w-xl gap-5" onSubmit={handleSubmit} noValidate>
            <label className="grid gap-2 text-sm font-semibold text-slate-800" htmlFor="assetId">
              Activo
              <select
                id="assetId"
                name="asset_id"
                required
                value={productId}
                onChange={(event) => {
                  setProductId(event.target.value);
                  setQuantityError(null);
                  setSubmitError(null);
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

            {selectedAsset && (
              <div
                className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950"
                aria-live="polite"
                data-testid="available-stock"
              >
                Stock disponible: <strong>{selectedAsset.current_stock}</strong>
                <span className="ml-1">· {selectedAsset.office}</span>
              </div>
            )}

            <label className="grid gap-2 text-sm font-semibold text-slate-800" htmlFor="quantity">
              Cantidad a retirar
              <input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                step="1"
                required
                value={quantity}
                aria-invalid={Boolean(quantityError)}
                aria-describedby={quantityError ? "quantity-error" : exceedsStock ? "stock-warning" : undefined}
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setQuantityError(null);
                  setSubmitError(null);
                  setSuccess(null);
                }}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-300 bg-white px-3 py-3 font-normal text-slate-950 shadow-sm focus:border-cyan-700 focus:outline-2 focus:outline-cyan-700 disabled:bg-slate-100"
              />
            </label>

            {quantityError && (
              <div
                id="quantity-error"
                className="-mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900"
                role="alert"
              >
                <span className="font-semibold">No se aceptó la cantidad:</span> {quantityError}
              </div>
            )}
            {exceedsStock && (
              <div
                id="stock-warning"
                className="-mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
                role="status"
              >
                La cantidad solicitada supera el stock disponible. La API realizará la validación definitiva.
              </div>
            )}

            <label className="grid gap-2 text-sm font-semibold text-slate-800" htmlFor="exitType">
              Tipo de salida
              <select
                id="exitType"
                name="exit_type"
                value={exitType}
                onChange={(event) => {
                  const nextExitType = event.target.value as ExitType;
                  setExitType(nextExitType);
                  if (nextExitType === "consumption") setAssignedTo("");
                  setSubmitError(null);
                  setSuccess(null);
                }}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-300 bg-white px-3 py-3 font-normal text-slate-950 shadow-sm focus:border-cyan-700 focus:outline-2 focus:outline-cyan-700 disabled:bg-slate-100"
              >
                <option value="allocation">Asignación a una persona</option>
                <option value="consumption">Consumo</option>
              </select>
            </label>

            {assignedToIsRequired && (
              <label className="grid gap-2 text-sm font-semibold text-slate-800" htmlFor="assignedTo">
                Asignado a
                <input
                  id="assignedTo"
                  name="assigned_to"
                  type="text"
                  required
                  maxLength={200}
                  value={assignedTo}
                  onChange={(event) => {
                    setAssignedTo(event.target.value);
                    setSubmitError(null);
                    setSuccess(null);
                  }}
                  disabled={isSubmitting}
                  placeholder="Nombre o ID del empleado"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-3 font-normal text-slate-950 shadow-sm focus:border-cyan-700 focus:outline-2 focus:outline-cyan-700 disabled:bg-slate-100"
                />
              </label>
            )}

            <button
              type="submit"
              disabled={
                isSubmitting ||
                !productId ||
                !hasValidQuantity ||
                (assignedToIsRequired && !assignedTo.trim())
              }
              className="inline-flex w-fit items-center justify-center rounded-lg bg-cyan-800 px-5 py-3 text-sm font-bold text-white hover:bg-cyan-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Registrando salida…" : "Registrar salida"}
            </button>
            {isSubmitting && (
              <p className="text-sm text-cyan-900" role="status" aria-live="polite">
                Procesando la salida. No cierres esta página.
              </p>
            )}
          </form>
        )}
      </section>
    </main>
  );
}