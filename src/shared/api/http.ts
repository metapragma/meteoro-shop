export type ApiErrorBody = {
  error?: string
  message?: string
  [key: string]: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly body: ApiErrorBody | null

  constructor(status: number, message: string, body: ApiErrorBody | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim().replace(/\/$/, '')
  return '/api'
}

async function readJsonSafely(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function apiRequest<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  const base = getApiBaseUrl()
  const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`

  const res = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const json = (await readJsonSafely(res)) as ApiErrorBody | null
    const message = json?.message || json?.error || `HTTP ${res.status}`
    throw new ApiError(res.status, message, json)
  }

  if (res.status === 204) {
    return undefined as TResponse
  }

  const json = await readJsonSafely(res)
  return json as TResponse
}
