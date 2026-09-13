/**
 * Backend API client. Base URL from PUBLIC_API_URL (Astro exposes PUBLIC_* env vars), default local uvicorn.
 */
// PUBLIC_API_URL unset -> local dev server; set to "" (production container) -> same-origin relative URLs.
const _raw = import.meta.env.PUBLIC_API_URL;
export const API_BASE = (_raw === undefined ? "http://localhost:8000" : _raw).replace(/\/$/, "");

async function request(path, init) {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(`${init?.method || "GET"} ${path} -> ${res.status}`);
  return res.json();
}

export const api = {
  health: () => request("/api/health"),
  listStudies: (limit = 50) => request(`/api/studies?limit=${limit}`),
  getStudy: (accNum) => request(`/api/studies/${encodeURIComponent(accNum)}`),
  inferStudy: (accNum) => request(`/api/studies/${encodeURIComponent(accNum)}/infer`, { method: "POST" }),
  absolute: (path) => (path ? `${API_BASE}${path}` : null),
};
