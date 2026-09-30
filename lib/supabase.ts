"use client";

type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string };
};

const sessionKey = "print-desk-session";
const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let refreshPromise: Promise<Session | null> | null = null;

export function isConfigured() {
  return Boolean(projectUrl && publishableKey && !projectUrl.includes("your-project-id"));
}

function requireConfig() {
  if (!projectUrl || !publishableKey || !isConfigured()) {
    throw new Error("Add your Supabase project URL and publishable key to the environment settings first.");
  }
  return { projectUrl, publishableKey };
}

export function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(sessionKey);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null) {
  if (typeof window === "undefined") return;
  if (session) window.localStorage.setItem(sessionKey, JSON.stringify(session));
  else window.localStorage.removeItem(sessionKey);
  window.dispatchEvent(new Event("print-desk-session"));
}

function sessionFrom(payload: Record<string, unknown>): Session | null {
  const user = payload.user as Session["user"] | undefined;
  const accessToken = payload.access_token;
  const refreshToken = payload.refresh_token;
  if (!user || typeof accessToken !== "string" || typeof refreshToken !== "string") return null;
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + Number(payload.expires_in ?? 3600),
    user,
  };
}

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (data as { msg?: string; message?: string; error_description?: string; error?: string }).msg ??
      (data as { message?: string }).message ??
      (data as { error_description?: string }).error_description ??
      (data as { error?: string }).error ??
      "Request failed. Please try again.";
    throw new Error(message);
  }
  return data;
}

export async function signIn(email: string, password: string) {
  const { projectUrl: url, publishableKey: key } = requireConfig();
  const response = await fetch(url + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = (await parseResponse(response)) as Record<string, unknown>;
  const session = sessionFrom(payload);
  if (!session) throw new Error("Sign in succeeded, but the session was not returned. Please try again.");
  saveSession(session);
  return session;
}

export async function signUp(email: string, password: string) {
  const { projectUrl: url, publishableKey: key } = requireConfig();
  const response = await fetch(url + "/auth/v1/signup", {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = (await parseResponse(response)) as Record<string, unknown>;
  const session = sessionFrom(payload);
  if (session) saveSession(session);
  return { session, confirmationRequired: !session };
}

export async function signOut() {
  const current = readSession();
  if (current && isConfigured()) {
    const { projectUrl: url, publishableKey: key } = requireConfig();
    await fetch(url + "/auth/v1/logout", {
      method: "POST",
      headers: { apikey: key, Authorization: "Bearer " + current.access_token },
    }).catch(() => undefined);
  }
  saveSession(null);
}

async function freshSession(force = false) {
  const current = readSession();
  if (!current) return null;
  if (!force && current.expires_at > Math.floor(Date.now() / 1000) + 60) return current;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const { projectUrl: url, publishableKey: key } = requireConfig();
        const response = await fetch(url + "/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          headers: { apikey: key, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: current.refresh_token }),
        });
        const payload = (await parseResponse(response)) as Record<string, unknown>;
        const next = sessionFrom(payload);
        if (next) saveSession(next);
        else saveSession(null);
        return next;
      } catch {
        saveSession(null);
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function api(path: string, init: RequestInit = {}, authenticated = true) {
  const { projectUrl: url, publishableKey: key } = requireConfig();
  let session = authenticated ? await freshSession() : null;
  const send = (token?: string) =>
    fetch(url + "/rest/v1/" + path.replace(/^\//, ""), {
      ...init,
      headers: {
        apikey: key,
        Authorization: "Bearer " + (token ?? key),
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  let response = await send(session?.access_token);
  if (response.status === 401 && authenticated && session) {
    const refreshed = await freshSession(true);
    if (refreshed) response = await send(refreshed.access_token);
    else saveSession(null);
  }
  return parseResponse(response);
}

export async function apiAll<T>(path: string): Promise<T[]> {
  const pageSize = 1000;
  const results: T[] = [];
  let offset = 0;
  while (true) {
    const separator = path.includes("?") ? "&" : "?";
    const page = await api(path + separator + "limit=" + pageSize + "&offset=" + offset) as T[];
    if (!Array.isArray(page)) throw new Error("The database returned an unexpected list response.");
    results.push(...page);
    if (page.length < pageSize) return results;
    offset += page.length;
  }
}

export async function rpc<T = unknown>(name: string, body: Record<string, unknown>, authenticated = true): Promise<T> {
  return (await api("rpc/" + name, { method: "POST", body: JSON.stringify(body) }, authenticated)) as T;
}

export function signInRedirect() {
  if (typeof window !== "undefined") window.location.assign("/login");
}
