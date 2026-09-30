Empresa: Nexova
00. Qué vamos a construir
Partimos del punto exacto en el que terminó el milestone anterior: la API de inventario ya existe dentro de services/, los datos semilla están cargados y los endpoints /inventory funcionan.

No vamos a crear otro proyecto ni otra API. Ahora vamos a construir la interfaz que consume ese backend desde uis/backoffice.

Al terminar vas a tener cuatro vistas:

/backoffice/inventory/products
/backoffice/inventory/orders/inbound
/backoffice/inventory/orders/outbound
/backoffice/inventory/orders
Y una sola capa para hablar con la API:

lib/inventory.ts
La regla es simple: ningún componente hace fetch directamente. Toda llamada pasa por lib/inventory.ts, con el token actual y con errores legibles.

El frontend va a consumir exactamente este contrato que dejaste funcionando en el hito anterior:

Acción	Endpoint
Listar inventario	GET /inventory/products
Consultar stock de una selección	GET /inventory/products/<built-in function id>
Registrar entrada	POST /inventory/orders/inbound
Registrar salida	POST /inventory/orders/outbound
Ver historial	GET /inventory/orders
Punto de partida de Nexova
Entidad visible en la UI: Asset.
Campo de FK que ya espera tu backend: asset_id.
Historial del endpoint anterior: el objeto anidado se llama asset, no product.
Cada Asset ya pertenece a Valencia o Miami. En esta guía la oficina del movimiento se completa automáticamente desde el activo seleccionado para no mandar una oficina contradictoria.
Ojo con esto último: el README general usa palabras como “Product” o product_id, pero vos ya construiste un backend específico de empresa. No renombres la API para hacerla coincidir con el ejemplo genérico. El frontend tiene que mandar los campos reales de Nexova.

office solo puede ser Valencia o Miami.
Si exit_type="allocation", assigned_to es obligatorio.
Si exit_type="consumption", assigned_to debe enviarse como null.
01. Abrí el mismo monorepo
Entrá al fork que venís usando. No clones otro proyecto para este hito.

Desde la raíz del repo, comprobá que existen estas dos zonas:

services/
uis/
El backend que terminaste en la guía anterior queda en services/.

Para este trabajo entramos al frontend:

Set-Location "uis\backoffice"
Si uis\backoffice no existe en tu copia, no lo inventes a mano: revisá que estés en el fork/branch correcto del proyecto que venís usando.

En esta guía uso app/, que es la estructura pedida por la solución de referencia. Si tu Next.js ya está organizado con src/app/, hacé exactamente los mismos archivos dentro de src/app/. No mantengas app/ y src/app/ a la vez porque después Next hace origami con tus rutas y nadie lo invitó.

02. Instalá y prepará el frontend
Parado dentro de uis\backoffice:

npm install
Creá o abrí .env.local y agregá:

NEXT_PUBLIC_INVENTORY_API_URL=http://localhost:8000
Verificá que .env.local no se suba a Git:

Get-Content ".gitignore"
Tu .gitignore debe cubrir .env.local o .env*.local.

03. Levantá backend y frontend en dos terminales
Terminal 1 — API
Desde la raíz del monorepo:

Set-Location "services"
& "$HOME\.local\bin\uv.exe" run uvicorn main:app --reload
La API debería quedar en:

http://127.0.0.1:8000
Terminal 2 — Next.js
Set-Location "uis\backoffice"
npm run dev
Normalmente el frontend queda en:

http://localhost:3000
Antes de seguir, comprobá que el login existente sigue funcionando. No toques inventario si primero rompiste auth. Es una manera particularmente eficiente de perder una tarde.

04. Si el navegador muestra un error de CORS
Esto solo hace falta si tu main.py todavía no habilita al frontend a llamar al backend desde otro puerto.

En services/main.py, conservando todo lo que ya tenés, podés agregar:

from fastapi.middleware.cors import CORSMiddleware
Y después de crear app = FastAPI(...):

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
Si trabajás con Codespaces, agregá también la URL pública del puerto 3000 como origen permitido.

No reemplaces main.py. Sumá el middleware y dejá intactos auth, SQLModel e inventory_router.

05. Creá la estructura de inventario
Desde uis\backoffice:

New-Item -ItemType Directory -Force -Path "lib"
New-Item -ItemType Directory -Force -Path "types"
New-Item -ItemType Directory -Force -Path "components\inventory"
New-Item -ItemType Directory -Force -Path "app\backoffice\inventory\products"
New-Item -ItemType Directory -Force -Path "app\backoffice\inventory\orders\inbound"
New-Item -ItemType Directory -Force -Path "app\backoffice\inventory\orders\outbound"
New-Item -ItemType Directory -Force -Path "app\backoffice\inventory\orders"
La parte nueva va a quedar así:

uis/backoffice/
├── app/
│   └── backoffice/
│       └── inventory/
│           ├── inventory.module.css
│           ├── products/
│           │   └── page.tsx
│           └── orders/
│               ├── page.tsx
│               ├── inbound/
│               │   └── page.tsx
│               └── outbound/
│                   └── page.tsx
├── components/
│   └── inventory/
│       ├── InventoryNav.tsx
│       └── RequireAuth.tsx
├── lib/
│   ├── auth.ts
│   └── inventory.ts
└── types/
    └── inventory.ts
06. Conectá el token existente, sin inventar otra autenticación
Primero fijate cómo tu login actual guarda el JWT. En la mayoría de los proyectos de este curso el backend devuelve access_token.

Creá lib/auth.ts:

// lib/auth.ts
// IMPORTANTE: no estamos creando otro sistema de auth.
// Este helper solamente lee el token que YA guarda tu login actual.
// Si tu proyecto usa otro nombre de key, cambiá solamente TOKEN_STORAGE_KEY.

export const TOKEN_STORAGE_KEY = "access_token";
export const LOGIN_PATH = "/login";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}
Si tu auth actual usa otra cosa
Si el token está en otra key de localStorage, cambiá TOKEN_STORAGE_KEY.
Si tu backoffice ya tiene un useAuth, middleware o layout guard, reutilizalo. No armes un segundo sistema en paralelo.
Si tu ruta de login no es /login, cambiá solamente LOGIN_PATH.
El resto de la guía asume que getAuthToken() devuelve el JWT correcto.

07. Protegé las cuatro páginas
Si tu backoffice ya tiene un guard reutilizable, usalo y podés saltar este archivo.

Si no lo tiene, creá components/inventory/RequireAuth.tsx:

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { getAuthToken, LOGIN_PATH } from "@/lib/auth";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      router.replace(LOGIN_PATH);
      return;
    }

    setReady(true);
  }, [router]);

  if (!ready) {
    return <p>Verificando sesión...</p>;
  }

  return <>{children}</>;
}
Esto hace que una persona sin token vaya al login antes de montar el contenido de inventario.

08. Definí los tipos reales de Nexova
Creá types/inventory.ts:

export type Office = "Valencia" | "Miami";

export type Asset = {
  id: number;
  name: string;
  sku: string;
  category: "hardware" | "peripherals" | "office_supplies" | "training_materials";
  office: Office;
  current_stock: number;
};

export type AssetEntryCreate = {
  asset_id: number;
  quantity: number;
  supplier: string;
  office: Office;
};

export type AssetExitCreate = {
  asset_id: number;
  quantity: number;
  exit_type: "allocation" | "consumption";
  assigned_to: string | null;
  office: Office;
};

export type AssetEntryResponse = AssetEntryCreate & {
  id: number;
  created_at: string;
  user_uuid: string;
};

export type AssetExitResponse = AssetExitCreate & {
  id: number;
  created_at: string;
  user_uuid: string;
};

export type AssetMovement = {
  id: number;
  movement_type: "inbound" | "outbound";
  quantity: number;
  created_at: string;
  user_uuid: string;
  asset: Omit<Asset, "current_stock">;
};
Fijate que el historial usa la clave anidada asset porque eso es lo que devuelve el endpoint que construiste en la guía anterior.

09. Centralizá todas las llamadas en lib/inventory.ts
Creá lib/inventory.ts:

// lib/inventory.ts
import { getAuthToken } from "@/lib/auth";
import type {
  Asset,
  AssetEntryCreate,
  AssetExitCreate,
  AssetEntryResponse,
  AssetExitResponse,
  AssetMovement,
} from "@/types/inventory";

type FastApiError = {
  detail?: string | Array<{ msg?: string }>;
  message?: string;
};

export class InventoryApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "InventoryApiError";
    this.status = status;
  }
}

function getApiBase(): string {
  const value = process.env.NEXT_PUBLIC_INVENTORY_API_URL;

  if (!value) {
    throw new Error("Falta NEXT_PUBLIC_INVENTORY_API_URL en .env.local");
  }

  return value.replace(/\/$/, "");
}

function extractMessage(body: FastApiError | null, fallback: string): string {
  if (!body) return fallback;

  if (typeof body.detail === "string") return body.detail;

  if (Array.isArray(body.detail)) {
    const messages = body.detail
      .map((item) => item?.msg)
      .filter((item): item is string => Boolean(item));

    if (messages.length > 0) return messages.join(" | ");
  }

  return body.message ?? fallback;
}

async function inventoryFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    cache: "no-store",
    headers,
  });

  if (!response.ok) {
    let body: FastApiError | null = null;

    try {
      body = (await response.json()) as FastApiError;
    } catch {
      body = null;
    }

    throw new InventoryApiError(
      response.status,
      extractMessage(body, `Error ${response.status}: ${response.statusText}`)
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function listProducts() {
  return inventoryFetch<Asset[]>("/inventory/products");
}

export function getProduct(id: number) {
  return inventoryFetch<Asset>(`/inventory/products/${id}`);
}

export function createInboundOrder(body: AssetEntryCreate) {
  return inventoryFetch<AssetEntryResponse>("/inventory/orders/inbound", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createOutboundOrder(body: AssetExitCreate) {
  return inventoryFetch<AssetExitResponse>("/inventory/orders/outbound", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listOrders() {
  return inventoryFetch<AssetMovement[]>("/inventory/orders");
}
Acá quedan resueltas tres cosas que el evaluador mira explícitamente:

fetch vive en un solo módulo.
El JWT viaja como Authorization: Bearer <token>.
Un 400, 404, 422 o 500 termina convertido en un mensaje que la UI puede mostrar.
No hagas otro fetch dentro de page.tsx “porque era más rápido”. Es más rápido hasta que tenés cinco lugares distintos interpretando errores de FastAPI como si fuera astrología.

10. Agregá una navegación mínima
Creá components/inventory/InventoryNav.tsx:

import Link from "next/link";

import styles from "@/app/backoffice/inventory/inventory.module.css";

export default function InventoryNav() {
  return (
    <nav className={styles.nav}>
      <Link href="/backoffice/inventory/products">Productos</Link>
      <Link href="/backoffice/inventory/orders/inbound">Nueva entrada</Link>
      <Link href="/backoffice/inventory/orders/outbound">Nueva salida</Link>
      <Link href="/backoffice/inventory/orders">Historial</Link>
    </nav>
  );
}
No estamos diseñando una landing. Es una herramienta interna: que se entienda y que funcione.

11. Agregá estilos simples para stock, formularios y errores
Creá app/backoffice/inventory/inventory.module.css:

/* app/backoffice/inventory/inventory.module.css */
.page {
  max-width: 1180px;
  margin: 0 auto;
  padding: 32px 20px 64px;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.nav {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 16px 0 28px;
}

.nav a,
.actionLink {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 12px;
  text-decoration: none;
  color: inherit;
}

.tableWrap {
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  vertical-align: top;
}

.badge,
.tag {
  display: inline-block;
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 0.85rem;
  font-weight: 700;
}

.low {
  background: #fee2e2;
  color: #991b1b;
}

.warning {
  background: #fef3c7;
  color: #92400e;
}

.healthy {
  background: #dcfce7;
  color: #166534;
}

.inbound {
  background: #dbeafe;
  color: #1e40af;
}

.outbound {
  background: #ffedd5;
  color: #9a3412;
}

.form {
  display: grid;
  gap: 16px;
  max-width: 680px;
}

.field {
  display: grid;
  gap: 6px;
}

.field input,
.field select {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 10px 12px;
  background: white;
  color: inherit;
}

.button {
  width: fit-content;
  border: 0;
  border-radius: 8px;
  padding: 10px 16px;
  font-weight: 700;
  cursor: pointer;
}

.button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.error,
.success,
.stockBox,
.inlineWarning {
  border-radius: 8px;
  padding: 12px 14px;
  margin: 12px 0;
}

.error {
  background: #fee2e2;
  color: #991b1b;
}

.success {
  background: #dcfce7;
  color: #166534;
}

.stockBox {
  background: #f1f5f9;
}

.inlineWarning {
  background: #fef3c7;
  color: #92400e;
}

.muted {
  color: #64748b;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
Con esto ya tenés distinción visual de stock, entrada/salida, errores y confirmaciones sin sumar una librería nueva.

12. Página de activos — /backoffice/inventory/products
Creá app/backoffice/inventory/products/page.tsx:

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import InventoryNav from "@/components/inventory/InventoryNav";
import RequireAuth from "@/components/inventory/RequireAuth";
import { listProducts } from "@/lib/inventory";
import type { Asset } from "@/types/inventory";
import styles from "@/app/backoffice/inventory/inventory.module.css";

// Umbrales visuales del hito.
// <= 5: bajo | <= 15: atención | > 15: saludable.
// Son indicadores de UI, no reglas de negocio del backend.
function stockClass(stock: number) {
  if (stock <= 5) return `${styles.badge} ${styles.low}`;
  if (stock <= 15) return `${styles.badge} ${styles.warning}`;
  return `${styles.badge} ${styles.healthy}`;
}

export default function ProductsPage() {
  return (
    <RequireAuth>
      <ProductsContent />
    </RequireAuth>
  );
}

function ProductsContent() {
  const [products, setProducts] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    listProducts()
      .then((data) => {
        if (active) setProducts(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "No se pudo cargar el inventario");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Activos</h1>
          <p className={styles.muted}>Inventario actual de Nexova.</p>
        </div>
      </div>

      <InventoryNav />

      {loading && <p>Cargando...</p>}
      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Activo</th>
      <th>SKU</th>
      <th>Categoría</th>
      <th>Oficina</th>
                <th>Stock actual</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
          <td>{product.sku}</td>
          <td>{product.category}</td>
          <td>{product.office}</td>
                  <td>
                    <span className={stockClass(product.current_stock)}>
                      {product.current_stock}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <Link
                        className={styles.actionLink}
                        href={`/backoffice/inventory/orders/inbound?productId=${product.id}`}
                      >
                        Entrada
                      </Link>
                      <Link
                        className={styles.actionLink}
                        href={`/backoffice/inventory/orders/outbound?productId=${product.id}`}
                      >
                        Salida
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
Qué tiene que pasar acá:

Carga datos reales desde GET /inventory/products.
Muestra current_stock.
Muestra los campos propios de Nexova.
El stock tiene indicador visual.
Cada fila tiene acceso directo a Entrada y Salida.
13. Formulario de entrada — /backoffice/inventory/orders/inbound
Creá app/backoffice/inventory/orders/inbound/page.tsx:

"use client";

import { useEffect, useState, type FormEvent } from "react";

import InventoryNav from "@/components/inventory/InventoryNav";
import RequireAuth from "@/components/inventory/RequireAuth";
import { createInboundOrder, listProducts } from "@/lib/inventory";
import type { Asset } from "@/types/inventory";
import styles from "@/app/backoffice/inventory/inventory.module.css";

export default function InboundPage() {
  return (
    <RequireAuth>
      <InboundContent />
    </RequireAuth>
  );
}

function InboundContent() {
  const [products, setProducts] = useState<Asset[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [supplier, setSupplier] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedProduct = products.find((item) => String(item.id) === productId) ?? null;
  useEffect(() => {
    listProducts()
      .then((data) => {
        setProducts(data);

        const preselected = new URLSearchParams(window.location.search).get(
          "productId"
        );

        if (preselected && data.some((item) => String(item.id) === preselected)) {
          setProductId(preselected);
        }
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "No se pudieron cargar los productos")
      );
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedProduct) {
      setError("Seleccioná un producto válido.");
      return;
    }
    setSubmitting(true);

    try {
      await createInboundOrder({
        asset_id: selectedProduct.id,
        quantity: Number(quantity),
        supplier: supplier.trim(),
        office: selectedProduct.office,
      });

      setSuccess("Entrada registrada correctamente.");
      setProductId("");
      setQuantity("");
      setSupplier("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la entrada");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <h1>Nueva entrada</h1>
      <p className={styles.muted}>Registrá una entrada real de Nexova.</p>
      <InventoryNav />

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span>Activo</span>
          <select
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            required
          >
            <option value="">Seleccioná...</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku})
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Cantidad</span>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
          />
        </label>

        <label className={styles.field}>
          <span>Proveedor</span>
          <input
            value={supplier}
            onChange={(event) => setSupplier(event.target.value)}
            required
          />
        </label>

        <label className={styles.field}>
          <span>Oficina</span>
          <input value={selectedProduct?.office ?? ""} disabled />
        </label>
        <button className={styles.button} disabled={submitting} type="submit">
          {submitting ? "Guardando..." : "Registrar entrada"}
        </button>
      </form>
    </main>
  );
}
La parte importante no es el formulario bonito. Es que el usuario elige el activo por nombre y el frontend manda el ID correcto sin pedirle que memorice claves primarias como si fueran números de documento ajenos.

14. Formulario de salida — /backoffice/inventory/orders/outbound
Creá app/backoffice/inventory/orders/outbound/page.tsx:

"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import InventoryNav from "@/components/inventory/InventoryNav";
import RequireAuth from "@/components/inventory/RequireAuth";
import {
  createOutboundOrder,
  getProduct,
  InventoryApiError,
  listProducts,
} from "@/lib/inventory";
import type { Asset } from "@/types/inventory";
import styles from "@/app/backoffice/inventory/inventory.module.css";

export default function OutboundPage() {
  return (
    <RequireAuth>
      <OutboundContent />
    </RequireAuth>
  );
}

function OutboundContent() {
  const [products, setProducts] = useState<Asset[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [exitType, setExitType] = useState<"allocation" | "consumption">(
    "allocation"
  );
  const [assignedTo, setAssignedTo] = useState("");
  const [error, setError] = useState("");
  const [quantityError, setQuantityError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedProduct = products.find((item) => String(item.id) === productId) ?? null;
  useEffect(() => {
    listProducts()
      .then((data) => {
        setProducts(data);

        const preselected = new URLSearchParams(window.location.search).get(
          "productId"
        );

        if (preselected && data.some((item) => String(item.id) === preselected)) {
          setProductId(preselected);
        }
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "No se pudieron cargar los productos")
      );
  }, []);

  useEffect(() => {
    if (!productId) {
      setCurrentStock(null);
      return;
    }

    let active = true;
    setQuantityError("");

    getProduct(Number(productId))
      .then((product) => {
        if (active) setCurrentStock(product.current_stock);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setCurrentStock(null);
        setError(err instanceof Error ? err.message : "No se pudo obtener el stock");
      });

    return () => {
      active = false;
    };
  }, [productId]);

  const exceedsStock = useMemo(() => {
    if (quantity === "" || currentStock === null) return false;
    return Number(quantity) > currentStock;
  }, [quantity, currentStock]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setQuantityError("");
    setSuccess("");

    if (!selectedProduct) {
      setError("Seleccioná un producto válido.");
      return;
    }
    setSubmitting(true);

    try {
      await createOutboundOrder({
        asset_id: selectedProduct.id,
        quantity: Number(quantity),
        exit_type: exitType,
        assigned_to: exitType === "allocation" ? assignedTo.trim() : null,
        office: selectedProduct.office,
      });

      setSuccess("Salida registrada correctamente.");
      setProductId("");
      setQuantity("");
      setCurrentStock(null);
      setExitType("allocation");
      setAssignedTo("");
    } catch (err: unknown) {
      if (err instanceof InventoryApiError && err.status === 400) {
        setQuantityError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "No se pudo registrar la salida");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <h1>Nueva salida</h1>
      <p className={styles.muted}>El stock se consulta antes de enviar el formulario.</p>
      <InventoryNav />

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span>Activo</span>
          <select
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            required
          >
            <option value="">Seleccioná...</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku})
              </option>
            ))}
          </select>
        </label>

        {productId && (
          <div className={styles.stockBox}>
            Stock disponible: <strong>{currentStock ?? "consultando..."}</strong>
          </div>
        )}

        <label className={styles.field}>
          <span>Cantidad</span>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
          />
        </label>

        {exceedsStock && (
          <div className={styles.inlineWarning}>
            La cantidad supera el stock mostrado. La API tiene la validación definitiva.
          </div>
        )}

        {quantityError && <div className={styles.error}>{quantityError}</div>}

        <label className={styles.field}>
          <span>Tipo de salida</span>
          <select
            value={exitType}
            onChange={(event) => {
              const next = event.target.value as "allocation" | "consumption";
              setExitType(next);
              if (next === "consumption") setAssignedTo("");
            }}
          >
            <option value="allocation">Asignación</option>
            <option value="consumption">Consumo</option>
          </select>
        </label>

        {exitType === "allocation" && (
          <label className={styles.field}>
            <span>Asignado a</span>
            <input
              value={assignedTo}
              onChange={(event) => setAssignedTo(event.target.value)}
              required
            />
          </label>
        )}

        <label className={styles.field}>
          <span>Oficina</span>
          <input value={selectedProduct?.office ?? ""} disabled />
        </label>
        <button className={styles.button} disabled={submitting} type="submit">
          {submitting ? "Guardando..." : "Registrar salida"}
        </button>
      </form>
    </main>
  );
}
Acá están los dos requisitos que más fácil se pierden:

cuando cambia el producto, se consulta GET /inventory/products/{id} y se actualiza el stock mostrado;
si la API responde 400, el mensaje aparece inline junto a la cantidad, no enterrado en la consola.
La advertencia del cliente no reemplaza la validación del backend. Entre que el usuario vio el stock y apretó el botón otra operación podría haberlo cambiado. Por eso la API sigue teniendo la última palabra.

15. Historial — /backoffice/inventory/orders
Creá app/backoffice/inventory/orders/page.tsx:

"use client";

import { useEffect, useState } from "react";

import InventoryNav from "@/components/inventory/InventoryNav";
import RequireAuth from "@/components/inventory/RequireAuth";
import { listOrders } from "@/lib/inventory";
import type { AssetMovement } from "@/types/inventory";
import styles from "@/app/backoffice/inventory/inventory.module.css";

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersContent />
    </RequireAuth>
  );
}

function OrdersContent() {
  const [orders, setOrders] = useState<AssetMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    listOrders()
      .then((data) => {
        if (active) setOrders(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "No se pudo cargar el historial");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className={styles.page}>
      <h1>Historial de órdenes</h1>
      <p className={styles.muted}>Vista de solo lectura.</p>
      <InventoryNav />

      {loading && <p>Cargando...</p>}
      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Activo</th>
                <th>Cantidad</th>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>user_uuid</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={`${order.movement_type}-${order.id}`}>
                  <td>{order.asset.name}</td>
                  <td>{order.quantity}</td>
                  <td>
                    <span
                      className={`${styles.tag} ${
                        order.movement_type === "inbound"
                          ? styles.inbound
                          : styles.outbound
                      }`}
                    >
                      {order.movement_type === "inbound" ? "Entrada" : "Salida"}
                    </span>
                  </td>
                  <td>{new Date(order.created_at).toLocaleString("es-AR")}</td>
                  <td>{order.user_uuid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
Esta vista es deliberadamente de solo lectura. Nada de editar ni borrar movimientos desde acá.

16. Prueba completa del flujo
Con backend y frontend levantados, hacé estas pruebas en este orden:

Abrí /backoffice/inventory/products sin sesión: debe redirigir al login.
Iniciá sesión y volvé a productos: deben aparecer los datos del seed.
Confirmá que cada fila muestra current_stock y los campos propios de Nexova.
Entrá a Nueva entrada, elegí un activo por nombre y registrá una cantidad válida.
Confirmá el mensaje de éxito y que el formulario se limpia.
Abrí Nueva salida, cambiá de producto varias veces y verificá que el stock se actualiza de forma reactiva.
Escribí una cantidad mayor al stock: debe aparecer la advertencia antes de enviar.
Enviá esa cantidad: el backend debe devolver HTTP 400 y el mensaje debe verse junto al campo de cantidad.
Registrá una salida válida y volvé a productos: el stock debe reflejar el nuevo movimiento.
Abrí Historial: deben verse entradas y salidas, nombre, cantidad, tipo, fecha y user_uuid.
Confirmá que el historial no tiene botones de editar ni borrar.
Buscá fetch dentro de componentes/páginas:
Get-ChildItem -Recurse -Include *.tsx,*.ts | Select-String -Pattern "fetch\("
El fetch de inventario debe aparecer en lib\inventory.ts, no desperdigado por las páginas.

17. Checklist de evaluación
Antes de entregar:

[ ] Existe lib/inventory.ts como capa dedicada de API.
[ ] No hay fetch directo en las páginas de inventario.
[ ] Las llamadas protegidas mandan Authorization: Bearer <token>.
[ ] Los errores 4xx/5xx se transforman en mensajes visibles.
[ ] /backoffice/inventory/products usa datos reales y muestra current_stock con indicador visual.
[ ] El formulario de entrada usa un selector por nombre, no un ID escrito a mano.
[ ] El formulario de entrada muestra confirmación o error visible.
[ ] El formulario de salida muestra stock reactivo al cambiar de producto.
[ ] Una cantidad mayor al stock muestra advertencia antes del submit.
[ ] Un HTTP 400 del outbound se ve inline junto a cantidad.
[ ] El historial muestra entrada/salida, nombre, cantidad, fecha y user_uuid.
[ ] El historial es solo lectura.
[ ] Las cuatro rutas de inventario requieren sesión.
[ ] Los nombres y campos usados son los de Nexova, no los genéricos del README.
Checklist específico de Nexova
office solo puede ser Valencia o Miami.
Si exit_type="allocation", assigned_to es obligatorio.
Si exit_type="consumption", assigned_to debe enviarse como null.
18. Entrega
Desde la raíz del monorepo:

git status
git add .
git commit -m "feat: add Nexova inventory backoffice"
git push
Antes del git add ., confirmá una vez más que .env.local está ignorado.

La entrega sigue siendo el mismo fork. Este proyecto no arranca una historia nueva: simplemente le pusimos una interfaz usable a la API que ya construiste.