export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Nem sikerült elérni a szervert.', 0)
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : null
    const fallback =
      res.status >= 500 ? 'A szerver hibát jelzett vagy nem érhető el.' : 'Hibás kérés.'
    throw new ApiError(detail ?? fallback, res.status)
  }
  return data
}