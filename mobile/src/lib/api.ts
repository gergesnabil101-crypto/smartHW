import { auth } from './firebase';
import { API_BASE_URL, assertApiConfigured } from '../config';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function newIdempotencyKey(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Attach Firebase ID token (default true). Set false for student endpoints. */
  auth?: boolean;
  /** Attach an idempotency key header for mutation endpoints. */
  idempotent?: boolean;
  timeoutMs?: number;
}

async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  assertApiConfigured();
  const { method = 'GET', body, auth: useAuth = true, idempotent, timeoutMs = 30000 } = opts;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useAuth) {
    const token = await getIdToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  if (idempotent) headers['Idempotency-Key'] = newIdempotencyKey();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === 'AbortError') throw new ApiError('انتهت مهلة الاتصال بالخادم. تحقق من الإنترنت.', 0);
    throw new ApiError('تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.', 0);
  }
  clearTimeout(timer);

  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    // Retry once with a refreshed token on 401
    if (res.status === 401 && useAuth) {
      const fresh = await getIdToken(true);
      if (fresh) {
        headers['Authorization'] = `Bearer ${fresh}`;
        const retry = await fetch(`${API_BASE_URL}${path}`, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const retryText = await retry.text();
        const retryData = retryText ? JSON.parse(retryText) : null;
        if (retry.ok) return retryData as T;
        throw new ApiError(retryData?.error || 'غير مصرح — سجل الدخول مرة أخرى.', retry.status);
      }
    }
    throw new ApiError(data?.error || `خطأ في الخادم (${res.status})`, res.status);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};
