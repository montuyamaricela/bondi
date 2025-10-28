export class FetchError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: unknown
  ) {
    super(`HTTP ${status}: ${statusText}`)
    this.name = "FetchError"
  }
}

interface FetchOptions extends RequestInit {
  baseURL?: string
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type")
  const isJSON = contentType?.includes("application/json")

  const data = isJSON ? await response.json() : await response.text()

  if (!response.ok) {
    throw new FetchError(response.status, response.statusText, data)
  }

  return data as T
}

export async function fetchWrapper<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { baseURL = "", ...fetchOptions } = options

  const fullURL = baseURL ? `${baseURL}${url}` : url

  const defaultHeaders: HeadersInit = {
    "Content-Type": "application/json",
  }

  const config: RequestInit = {
    ...fetchOptions,
    headers: {
      ...defaultHeaders,
      ...fetchOptions.headers,
    },
  }

  try {
    const response = await fetch(fullURL, config)
    return await handleResponse<T>(response)
  } catch (error) {
    if (error instanceof FetchError) {
      throw error
    }
    throw new Error(error instanceof Error ? error.message : "Network error")
  }
}

export const api = {
  get: <T = unknown>(url: string, options?: FetchOptions) =>
    fetchWrapper<T>(url, { ...options, method: "GET" }),

  post: <T = unknown>(url: string, body?: unknown, options?: FetchOptions) =>
    fetchWrapper<T>(url, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = unknown>(url: string, body?: unknown, options?: FetchOptions) =>
    fetchWrapper<T>(url, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = unknown>(url: string, body?: unknown, options?: FetchOptions) =>
    fetchWrapper<T>(url, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(url: string, options?: FetchOptions) =>
    fetchWrapper<T>(url, { ...options, method: "DELETE" }),
}
