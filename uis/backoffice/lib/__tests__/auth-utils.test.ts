import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiRequestError,
  authRequest,
  clearOnUnauthorized,
  loginRequest,
  setOnUnauthorized,
} from "@/lib/api-client";

function responseWithJson(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("authentication utility functions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    clearOnUnauthorized();
  });

  describe("authRequest", () => {
    it("reads the stored token and sends it as a Bearer header", async () => {
      localStorage.setItem("token", "token-123");
      const fetchMock = vi
        .spyOn(global, "fetch")
        .mockResolvedValue(responseWithJson({ id: "user-1" }));

      const result = await authRequest<{ id: string }>("/auth/me");

      expect(result).toEqual({ id: "user-1" });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/me",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer token-123",
          }),
          cache: "no-store",
        }),
      );
    });

    it("removes the token, notifies the callback, and fails on 401", async () => {
      localStorage.setItem("token", "expired-token");
      const unauthorized = vi.fn();
      setOnUnauthorized(unauthorized);
      vi.spyOn(global, "fetch").mockResolvedValue(responseWithJson({}, 401));

      await expect(authRequest("/auth/me")).rejects.toThrow(
        "Sesión expirada. Redirigiendo al inicio de sesión…",
      );

      expect(localStorage.getItem("token")).toBeNull();
      expect(unauthorized).toHaveBeenCalledOnce();
    });

    it("returns an undefined value for a successful 204 response", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue(responseWithJson({}, 204));

      await expect(authRequest<void>("/auth/logout")).resolves.toBeUndefined();
    });

    it("parses structured backend errors and exposes field messages", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        responseWithJson(
          {
            detail: {
              message: "Datos inválidos",
              fields: {
                email: ["Formato inválido", "Campo requerido"],
              },
            },
          },
          422,
        ),
      );

      const request = authRequest("/users");

      await expect(request).rejects.toMatchObject({
        message: "Datos inválidos",
        fields: { email: "Formato inválido Campo requerido" },
      });
      await expect(request).rejects.toBeInstanceOf(ApiRequestError);
    });

    it("returns a connection error when fetch rejects", async () => {
      vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));

      await expect(authRequest("/auth/me")).rejects.toThrow(
        "No se pudo conectar con el servidor",
      );
    });
  });

  describe("loginRequest", () => {
    it("sends form-urlencoded credentials and returns the access token", async () => {
      const fetchMock = vi
        .spyOn(global, "fetch")
        .mockResolvedValue(
          responseWithJson({ access_token: "access-123", token_type: "bearer" }),
        );

      const result = await loginRequest("user@example.com", "Password123!");

      expect(result).toEqual({
        access_token: "access-123",
        token_type: "bearer",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "username=user%40example.com&password=Password123%21",
        }),
      );
    });

    it("uses the backend detail as the error message for rejected credentials", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        responseWithJson({ detail: "Credenciales inválidas" }, 401),
      );

      await expect(
        loginRequest("user@example.com", "wrong-password"),
      ).rejects.toThrow("Credenciales inválidas");
    });

    it("returns a connection error when the login request cannot reach the server", async () => {
      vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));

      await expect(
        loginRequest("user@example.com", "Password123!"),
      ).rejects.toThrow("No se pudo conectar con el servidor");
    });
  });
});
