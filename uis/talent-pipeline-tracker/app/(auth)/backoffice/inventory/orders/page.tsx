"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Loading } from "@/components/Loading";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getInventoryOrders } from "@/lib/inventory";
import type { InventoryOrderResponse } from "@/types/inventory";

export default function OrdersPage() {
  return (
    <ProtectedRoute>
      <OrdersHistory />
    </ProtectedRoute>
  );
}

function OrdersHistory() {
  const [orders, setOrders] = useState<InventoryOrderResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    getInventoryOrders()
      .then((data) => {
        if (isActive) setOrders(data);
      })
      .catch((requestError: unknown) => {
        if (!isActive) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudo cargar el historial de órdenes. Intentá nuevamente.",
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
        <header className="mb-6 border-b border-slate-200 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">
            Nexova · Operaciones
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Historial de órdenes</h1>
          <p className="mt-1 text-sm text-slate-600">
            Consulta de solo lectura de entradas y salidas de activos.
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
            href="/backoffice/inventory/orders/outbound"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-cyan-700 hover:text-cyan-800"
          >
            Registrar salida
          </Link>
        </nav>

        {isLoading ? (
          <div role="status" aria-live="polite">
            <Loading />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900" role="alert">
            <p className="font-semibold">No se pudo cargar el historial</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-700" role="status">
            Todavía no hay órdenes de inventario para mostrar.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <caption className="sr-only">Órdenes de inventario registradas en Nexova</caption>
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Activo</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Cantidad</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Tipo</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Fecha de creación</th>
                  <th scope="col" className="px-4 py-3 font-semibold">user_uuid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {orders.map((order) => {
                  const isInbound = order.order_type === "inbound";
                  const createdAt = new Date(order.created_at);
                  const formattedDate = Number.isNaN(createdAt.getTime())
                    ? order.created_at
                    : new Intl.DateTimeFormat("es-ES", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(createdAt);

                  return (
                    <tr key={`${order.order_type}-${order.id}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-950">
                        <span className="block">{order.asset.name}</span>
                        <span className="mt-0.5 block text-xs font-normal text-slate-500">
                          {order.asset.sku} · {order.office}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-800">{order.quantity}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                            isInbound
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-900"
                          }`}
                          aria-label={isInbound ? "Entrada" : "Salida"}
                        >
                          <span aria-hidden="true">{isInbound ? "↓" : "↑"}</span>
                          {isInbound ? "Entrada" : "Salida"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        <time dateTime={order.created_at}>{formattedDate}</time>
                      </td>
                      <td className="break-all px-4 py-3 font-mono text-xs text-slate-700">
                        {order.user_uuid}
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
