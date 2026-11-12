import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { hydrateRoot, Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import {
  ApiRequestError,
  authRequest,
} from "@/lib/api-client";
import { getRecords } from "@/lib/api";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const authApiMocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  loginRequest: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  getMe: authApiMocks.getMe,
  loginRequest: authApiMocks.loginRequest,
}));

const validMe = {
  id: "user-1",
  email: "user@example.com",
  role: "admin",
  profile: { id: "profile-1", user_id: "user-1", name: "  User One  ", phone: null, address: null },
};

function AuthProbe() {
  const auth = useAuth();
  return (
    <div>
      <output data-testid="phase">{auth.authState.status}</output>
      <output data-testid="ready">{String(auth.isReady)}</output>
      <output data-testid="authenticated">{String(auth.isAuthenticated)}</output>
      <output data-testid="user">{auth.user?.name ?? "none"}</output>
      {auth.authState.status === "error" && <output role="alert">{auth.authState.message}</output>}
      <button onClick={auth.retryAuthentication}>retry</button>
      <button onClick={() => void auth.login("user@example.com", "password").catch(() => undefined)}>login</button>
      <button onClick={auth.logout}>logout</button>
      <button onClick={() => auth.updateProfileName("Updated")}>update</button>
    </div>
  );
}

function renderProvider(strict = false) {
  const tree = <AuthProvider><AuthProbe /></AuthProvider>;
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("AuthProvider session lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
    router.push.mockReset();
    router.replace.mockReset();
    authApiMocks.getMe.mockReset();
    authApiMocks.loginRequest.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("settles anonymous without requesting /auth/me when there is no token", async () => {
    renderProvider();
    expect(screen.getByTestId("phase")).toHaveTextContent("initializing");
    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("anonymous"));
    expect(authApiMocks.getMe).not.toHaveBeenCalled();
  });

  it("validates token, accepts only a complete user and trims the profile name", async () => {
    localStorage.setItem("token", "valid-token");
    authApiMocks.getMe.mockResolvedValue(validMe);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("User One");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
  });

  it("removes an invalid token and settles anonymous on bootstrap 401", async () => {
    localStorage.setItem("token", "invalid-token");
    authApiMocks.getMe.mockRejectedValue(new ApiRequestError("unauthorized", 401));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("anonymous"));
    expect(localStorage.getItem("token")).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it.each([
    ["connection failure", new Error("network down")],
    ["server failure", new ApiRequestError("server error", 503)],
    ["invalid JSON", new SyntaxError("invalid JSON")],
    ["missing required fields", { id: "", email: "bad", role: "", profile: null }],
  ])("preserves token and locks session for recoverable %s", async (_label, failure) => {
    localStorage.setItem("token", "keep-me");
    authApiMocks.getMe.mockRejectedValue(failure);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("error"));
    expect(localStorage.getItem("token")).toBe("keep-me");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("manually retries a recoverable bootstrap and authenticates after success", async () => {
    localStorage.setItem("token", "retry-token");
    authApiMocks.getMe
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(validMe);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("error"));
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("authenticated"));
    expect(authApiMocks.getMe).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem("token")).toBe("retry-token");
  });

  it("does not let an obsolete bootstrap authenticate after logout", async () => {
    localStorage.setItem("token", "old-token");
    const pending = deferred<typeof validMe>();
    authApiMocks.getMe.mockReturnValue(pending.promise);
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "logout" }));
    await act(async () => pending.resolve(validMe));
    expect(screen.getByTestId("phase")).toHaveTextContent("anonymous");
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("authenticates only after login validation and clears token if /auth/me fails", async () => {
    authApiMocks.loginRequest.mockResolvedValue({ access_token: "login-token", token_type: "bearer" });
    authApiMocks.getMe.mockResolvedValue(validMe);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("anonymous"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "login" })));
    expect(screen.getByTestId("phase")).toHaveTextContent("authenticated");
    expect(localStorage.getItem("token")).toBe("login-token");
  });

  it("removes login token when user validation fails and supports login errors", async () => {
    authApiMocks.loginRequest.mockResolvedValue({ access_token: "login-token", token_type: "bearer" });
    authApiMocks.getMe.mockRejectedValue(new Error("offline"));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("anonymous"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "login" })));
    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("anonymous"));
    expect(localStorage.getItem("token")).toBeNull();
    expect(screen.getByTestId("phase")).toHaveTextContent("anonymous");
  });

  it("updates the profile name after successful authentication", async () => {
    localStorage.setItem("token", "profile-token");
    authApiMocks.getMe.mockResolvedValue(validMe);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("authenticated"));
    fireEvent.click(screen.getByRole("button", { name: "update" }));
    expect(screen.getByTestId("user")).toHaveTextContent("Updated");
  });

  it("invalidates the shared session on 401 from either HTTP client without provider navigation", async () => {
    localStorage.setItem("token", "valid-token");
    authApiMocks.getMe.mockResolvedValue(validMe);
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 401, text: async () => "{}" } as Response);
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("authenticated"));

    await expect(getRecords()).rejects.toThrow("Sesión expirada");
    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("anonymous"));
    expect(localStorage.getItem("token")).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();

    localStorage.setItem("token", "second-token");
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: async () => "{}" } as Response);
    await expect(authRequest("/protected")).rejects.toThrow("Sesión expirada");
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("deduplicates bootstrap under StrictMode and ignores completion after unmount", async () => {
    localStorage.setItem("token", "strict-token");
    const pending = deferred<typeof validMe>();
    authApiMocks.getMe.mockReturnValue(pending.promise);
    const view = renderProvider(true);
    expect(authApiMocks.getMe).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => pending.resolve(validMe));
  });

  it("renders the same neutral initial state for server output and hydrates without mismatch", async () => {
    localStorage.setItem("token", "hydration-token");
    authApiMocks.getMe.mockResolvedValue(validMe);
    const serverHtml = renderToString(<AuthProvider><AuthProbe /></AuthProvider>);
    expect(serverHtml).toContain("initializing");
    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let root: Root;
    await act(async () => {
      root = hydrateRoot(container, <AuthProvider><AuthProbe /></AuthProvider>);
    });
    await waitFor(() => expect(container.querySelector('[data-testid="phase"]')).toHaveTextContent("authenticated"));
    expect(errorSpy).not.toHaveBeenCalled();
    await act(async () => root!.unmount());
  });
});
