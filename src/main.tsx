import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";

document.documentElement.classList.add("dark");
document.documentElement.setAttribute("dir", "rtl");
document.documentElement.setAttribute("lang", "ar");

// ─── Token helpers ────────────────────────────────────────────────────────────

function decodeExp(token: string): number | null {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    const payload = JSON.parse(json);
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function getStoredState(): { accessToken: string; refreshToken: string } | null {
  try {
    const raw = localStorage.getItem("gym-auth-storage");
    if (!raw) return null;
    const state = JSON.parse(raw)?.state;
    if (!state?.accessToken || !state?.refreshToken) return null;
    return state;
  } catch {
    return null;
  }
}

function updateStoredTokens(accessToken: string, refreshToken: string): void {
  try {
    const raw = localStorage.getItem("gym-auth-storage");
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj?.state) {
      obj.state.accessToken = accessToken;
      obj.state.refreshToken = refreshToken;
      localStorage.setItem("gym-auth-storage", JSON.stringify(obj));
    }
  } catch {
    /* ignore */
  }
}

function clearAndRedirect(): void {
  localStorage.removeItem("gym-auth-storage");
  window.location.replace("/login");
}

// ─── Auto-refresh coordination ────────────────────────────────────────────────

let isRefreshing = false;
let pendingRefresh: Promise<string | null> | null = null;

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.accessToken && data?.refreshToken) {
      updateStoredTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Auth token getter (called before every API request) ─────────────────────

setAuthTokenGetter(async () => {
  const state = getStoredState();
  if (!state) return null;

  const { accessToken, refreshToken } = state;
  const exp = decodeExp(accessToken);

  // Token is still valid with > 60s remaining — use it as-is
  if (exp !== null && exp * 1000 > Date.now() + 60_000) {
    return accessToken;
  }

  // Token missing expiry info or has expired — try to refresh
  if (isRefreshing && pendingRefresh) {
    return pendingRefresh;
  }

  isRefreshing = true;
  pendingRefresh = refreshAccessToken(refreshToken).then((token) => {
    if (!token) clearAndRedirect();
    return token;
  }).finally(() => {
    isRefreshing = false;
    pendingRefresh = null;
  });

  return pendingRefresh;
});

createRoot(document.getElementById("root")!).render(<App />);
