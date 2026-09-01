import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  changePasswordRequest,
  forgotPasswordRequest,
  resetPasswordRequest,
} from "@/lib/api-client";

const originalEnv = process.env;

describe("lib/api-client - password reset/change", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_API_URL: "https://api.nexova.local",
    };
  });

  it("forgotPasswordRequest hace POST /auth/forgot-password con el email", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: "Si esa dirección está registrada..." }),
    } as Response);

    const result = await forgotPasswordRequest("user@example.com");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.nexova.local/auth/forgot-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "user@example.com" }),
      }),
    );
    expect(result.message).toContain("registrada");
  });

  it("resetPasswordRequest hace POST /auth/reset-password con token y new_password", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: "Contraseña actualizada correctamente" }),
    } as Response);

    await resetPasswordRequest("token-123", "NewPassword123!");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.nexova.local/auth/reset-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          token: "token-123",
          new_password: "NewPassword123!",
        }),
      }),
    );
  });

  it("resetPasswordRequest lanza error con el detail del backend si el token es inválido", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ detail: "Token inválido" }),
    } as Response);

    await expect(
      resetPasswordRequest("bad-token", "NewPassword123!"),
    ).rejects.toThrow("Token inválido");
  });

  it("changePasswordRequest envía Authorization con el token guardado", async () => {
    localStorage.setItem("token", "stored-token");

    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: "Contraseña actualizada correctamente" }),
    } as Response);

    await changePasswordRequest("OldPassword123!", "NewPassword123!");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.nexova.local/auth/change-password",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer stored-token",
        }),
        body: JSON.stringify({
          current_password: "OldPassword123!",
          new_password: "NewPassword123!",
        }),
      }),
    );
  });

  it("changePasswordRequest lanza error si la contraseña actual es incorrecta", async () => {
    localStorage.setItem("token", "stored-token");

    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({ detail: "La contraseña actual es incorrecta" }),
    } as Response);

    await expect(
      changePasswordRequest("WrongPassword123!", "NewPassword123!"),
    ).rejects.toThrow("La contraseña actual es incorrecta");
  });
});
