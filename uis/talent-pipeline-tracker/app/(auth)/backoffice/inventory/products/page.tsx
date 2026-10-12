"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Loading } from "@/components/Loading";
import { getInventoryProducts } from "@/lib/inventory";
import type { Asset } from "@/types/inventory";

function getStockStatus(stock: number): {
  label: string;
  className: string;
} {
  if (stock <= 0) {
    return {
      label: "Sin stock",
      className: "border-red-300 bg-red-100 text-red-900",
    };
  }

  if (stock <= 5) {
    return {
      label: "Stock bajo",
      className: "border-amber-300 bg-amber-100 text-amber-900",
    };
  }

  if (stock <= 15) {
    return {
      label: "Revisar stock",
      className: "border-orange-300 bg-orange-100 text-orange-900",
    };
  }

  return {
    label: "Stock saludable",
    className: "border-emerald-300 bg-emerald-100 text-emerald-900",
  };
}

export default function InventoryProductsPage() {
  const [products, setProducts] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    getInventoryProducts()
      .then((data) => {
        if (isActive) setProducts(data);
      })
      .catch((requestError: unknown) => {
        if (!isActive) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudo cargar el inventario. Intentá nuevamente.",
        );
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main className="min-h-screen px-4 py-8 md:px-10">
      <section className="mx-auto w-full max-w-6xl rounded-2xl border border-white/70 bg-white/90 p-5 shadow-lg md:p-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">
              Nexova · Backoffice
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Inventario de activos</h1>
            <p className="mt-1 text-sm text-slate-600">
              Consulta el stock actual por activo y oficina.
            </p>
          </div>
          <Link
            href="/"
            className="w-fit rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-cyan-700 hover:text-cyan-800"
          >
            Volver al inicio
          </Link>
        </header>

        <div className="mb-5 flex flex-wrap gap-3 text-xs font-medium" aria-label="Estados del stock">
          <span className="rounded-full border border-red-300 bg-red-100 px-3 py-1 text-red-900">Sin stock: 0</span>
          <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-amber-900">Stock bajo: 1–5</span>
          <span className="rounded-full border border-orange-300 bg-orange-100 px-3 py-1 text-orange-900">Revisar stock: 6–15</span>
          <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-emerald-900">Stock saludable: más de 15</span>
        </div>

        {isLoading && (
          <div role="status" aria-live="polite">
            <Loading />
          </div>
        )}

        {!isLoading && error && (
          <div
            className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900"
            role="alert"
          >
            <p className="font-semibold">No se pudo cargar el inventario</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {!isLoading && !error && products.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <h2 className="font-semibold text-slate-900">No hay activos registrados</h2>
            <p className="mt-1 text-sm text-slate-600">
              Cuando existan activos en inventario, aparecerán en esta lista.
            </p>
          </div>
        )}

        {!isLoading && !error && products.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[850px] border-collapse text-left text-sm">
              <caption className="sr-only">Activos de Nexova y stock actual</caption>
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
                <tr>
                  <th className="px-4 py-3" scope="col">Activo</th>
                  <th className="px-4 py-3" scope="col">SKU</th>
                  <th className="px-4 py-3" scope="col">Categoría</th>
                  <th className="px-4 py-3" scope="col">Oficina</th>
                  <th className="px-4 py-3" scope="col">Stock actual</th>
                  <th className="px-4 py-3" scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {products.map((asset) => {
                  const stockStatus = getStockStatus(asset.current_stock);
                  // Las páginas de órdenes de la guía leen `productId` para preseleccionar.
                  const selectedAssetQuery = `?productId=${asset.id}`;

                  return (
                    <tr key={asset.id} className="hover:bg-cyan-50/50">
                      <th className="px-4 py-3 font-semibold text-slate-900" scope="row">
                        {asset.name}
                      </th>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{asset.sku}</td>
                      <td className="px-4 py-3 text-slate-700">{asset.category}</td>
                      <td className="px-4 py-3 text-slate-700">{asset.office}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold ${stockStatus.className}`}
                          aria-label={`${asset.current_stock} unidades, ${stockStatus.label}`}
                        >
                          <span aria-hidden="true">{asset.current_stock}</span>
                          <span>{stockStatus.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/backoffice/inventory/orders/inbound${selectedAssetQuery}`}
                            className="rounded-lg bg-cyan-800 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-800"
                            aria-label={`Registrar entrada para ${asset.name}`}
                          >
                            Nueva entrada
                          </Link>
                          <Link
                            href={`/backoffice/inventory/orders/outbound${selectedAssetQuery}`}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                            aria-label={`Registrar salida para ${asset.name}`}
                          >
                            Nueva salida
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
