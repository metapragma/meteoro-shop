export function getWsUrl(): string {
  const raw = import.meta.env.VITE_WS_URL
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim()
  return 'ws://localhost:3001'
}
