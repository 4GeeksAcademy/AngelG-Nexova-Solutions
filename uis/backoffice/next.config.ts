import type { NextConfig } from "next";

function getInventoryApiOrigin(): string {
  // Docker/deployments must use their server-side upstream, never localhost.
  const configuredUrl =
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_INVENTORY_API_URL ??
    "http://backend:8000";
  const normalizedUrl = configuredUrl.replace(/\/+$/, "");

  // The rewrite source already consumes /api; retain it in the destination
  // only when the configured base URL explicitly includes that prefix.
  return normalizedUrl.endsWith("/api")
    ? normalizedUrl.slice(0, -4)
    : normalizedUrl;
}

const inventoryApiOrigin = getInventoryApiOrigin();

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      fallback: [
        {
          source: "/api/:path*",
          // The browser-facing /api prefix is only a proxy namespace. The
          // FastAPI routes themselves are mounted at /auth, /users, etc.
          destination: `${inventoryApiOrigin}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
