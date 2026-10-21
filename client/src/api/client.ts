export interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || 'https://task-tracker-backend-0tp6.onrender.com/api/v1').replace(/\/+$/, '')
const apiUrl = (path: string) => `${apiBase}${path}`
let csrfToken: string | null = null
let csrfRequest: Promise<string> | null = null
let refreshRequest: Promise<boolean> | null = null
let onSessionExpired: (() => void) | null = null

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler
}

function updateCsrfToken(value: unknown) {
  if (typeof value === 'string' && value.length > 0) csrfToken = value
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken
  if (!csrfRequest) {
    csrfRequest = fetch(apiUrl('/auth/csrf'), { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok)
          throw new ApiError(response.status, 'CSRF_INIT_FAILED', 'Could not initialize request security.')
        const body = (await response.json()) as { data?: { csrfToken?: string } }
        updateCsrfToken(body.data?.csrfToken)
        if (!csrfToken) throw new ApiError(500, 'CSRF_INIT_FAILED', 'Could not initialize request security.')
        return csrfToken
      })
      .finally(() => {
        csrfRequest = null
      })
  }
  return csrfRequest
}

function skipsRefresh(path: string) {
  return ['/auth/login', '/auth/logout', '/auth/refresh', '/auth/csrf'].includes(path)
}

function isUnsafe(method: string) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())
}

function errorFromResponse(status: number, body: ApiErrorBody): ApiError {
  return new ApiError(
    status,
    body.error?.code ?? 'REQUEST_FAILED',
    body.error?.message ?? 'The request could not be completed.',
    body.error?.details,
  )
}

async function refreshSession(): Promise<boolean> {
  if (!refreshRequest) {
    refreshRequest = (async () => {
      try {
        const token = await getCsrfToken()
        const response = await fetch(apiUrl('/auth/refresh'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRF-Token': token },
        })
        if (!response.ok) {
          csrfToken = null
          onSessionExpired?.()
          return false
        }
        const body = (await response.json()) as { data?: { csrfToken?: string } }
        updateCsrfToken(body.data?.csrfToken)
        return true
      } catch {
        onSessionExpired?.()
        return false
      } finally {
        refreshRequest = null
      }
    })()
  }
  return refreshRequest
}

async function fetchWithAuth(path: string, init: RequestInit, retried = false): Promise<Response> {
  const method = init.method ?? 'GET'
  const headers = new Headers(init.headers)
  if (isUnsafe(method)) headers.set('X-CSRF-Token', await getCsrfToken())
  const response = await fetch(apiUrl(path), { ...init, headers, credentials: 'include' })
  if (response.status === 401 && !retried && !skipsRefresh(path)) {
    const refreshed = await refreshSession()
    if (refreshed) {
      const retriedResponse = await fetchWithAuth(path, init, true)
      if (retriedResponse.status === 401) onSessionExpired?.()
      return retriedResponse
    }
    onSessionExpired?.()
  }
  return response
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (typeof init.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetchWithAuth(path, { ...init, headers })
  if (!response.ok) {
    let errorBody: ApiErrorBody = {}
    try {
      errorBody = (await response.json()) as ApiErrorBody
    } catch {
      throw new ApiError(response.status, 'REQUEST_FAILED', 'The request could not be completed.')
    }
    throw errorFromResponse(response.status, errorBody)
  }
  if (response.status === 204) return undefined as T
  const body = (await response.json()) as { data?: T }
  return body.data as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'DELETE',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  async download(path: string): Promise<Blob> {
    const response = await fetchWithAuth(path, {})
    if (!response.ok) {
      let body: ApiErrorBody = {}
      try {
        body = (await response.json()) as ApiErrorBody
      } catch {
        throw new ApiError(response.status, 'DOWNLOAD_FAILED', 'The export could not be downloaded.')
      }
      throw errorFromResponse(response.status, body)
    }
    return response.blob()
  },
  setCsrfToken: updateCsrfToken,
  resetCsrfToken() {
    csrfToken = null
  },
}
