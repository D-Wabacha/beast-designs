// Thin wrapper around the order API served by server.py.

export class ApiError extends Error {
  constructor(message, { status = 0, fields = null } = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export async function api(path, { method = "GET", body, timeout = 15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(path, {
      method,
      signal: ctrl.signal,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json", "X-Requested-With": "lck" } : { "X-Requested-With": "lck" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(
      err.name === "AbortError"
        ? "The request took too long. Please check your connection and try again."
        : "We couldn't reach our order system. Please check your connection and try again.",
    );
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON response */ }
  if (!res.ok) {
    throw new ApiError(data?.error || `Something went wrong (error ${res.status}).`, { status: res.status, fields: data?.fields || null });
  }
  return data;
}
