import { afterEach, describe, expect, it, vi } from "vitest";

const originalInternalUrl = process.env.API_INTERNAL_URL;
const originalPublicInventoryUrl = process.env.NEXT_PUBLIC_INVENTORY_API_URL;

async function getInventoryRewriteDestination(): Promise<string> {
  vi.resetModules();
  const { default: nextConfig } = await import("../../next.config");
  const rewrites = await nextConfig.rewrites?.();

  if (!rewrites || Array.isArray(rewrites) || !rewrites.fallback?.[0]) {
    throw new Error("No se encontró el rewrite fallback de inventario.");
  }

  return rewrites.fallback[0].destination;
}

afterEach(() => {
  if (originalInternalUrl === undefined) {
    delete process.env.API_INTERNAL_URL;
  } else {
    process.env.API_INTERNAL_URL = originalInternalUrl;
  }

  if (originalPublicInventoryUrl === undefined) {
    delete process.env.NEXT_PUBLIC_INVENTORY_API_URL;
  } else {
    process.env.NEXT_PUBLIC_INVENTORY_API_URL = originalPublicInventoryUrl;
  }
  vi.resetModules();
});

describe("Next.js inventory API rewrite", () => {
  it("usa NEXT_PUBLIC_INVENTORY_API_URL en desarrollo local sin duplicar /api", async () => {
    delete process.env.API_INTERNAL_URL;
    process.env.NEXT_PUBLIC_INVENTORY_API_URL = "http://localhost:8000/api/";

    await expect(getInventoryRewriteDestination()).resolves.toBe(
      "http://localhost:8000/api/:path*",
    );
  });

  it("prioriza API_INTERNAL_URL sobre la URL pública para Docker", async () => {
    process.env.API_INTERNAL_URL = "http://host.docker.internal:8000";
    process.env.NEXT_PUBLIC_INVENTORY_API_URL = "http://localhost:8000";

    await expect(getInventoryRewriteDestination()).resolves.toBe(
      "http://host.docker.internal:8000/api/:path*",
    );
  });

  it("conserva un destino de backend predeterminado sin variables configuradas", async () => {
    delete process.env.API_INTERNAL_URL;
    delete process.env.NEXT_PUBLIC_INVENTORY_API_URL;

    await expect(getInventoryRewriteDestination()).resolves.toBe(
      "http://backend:8000/api/:path*",
    );
  });
});
