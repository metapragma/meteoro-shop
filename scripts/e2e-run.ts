import net from 'node:net'
import { spawn } from 'node:child_process'
import path from 'node:path'

function ensureNoProxyForLocalhost() {
  const additions = ['127.0.0.1', 'localhost']
  const current = process.env.NO_PROXY || process.env.no_proxy || ''
  const parts = new Set(
    current
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
  for (const a of additions) parts.add(a)
  const next = [...parts].join(',')
  process.env.NO_PROXY = next
  process.env.no_proxy = next
}

type LoggedProcess = {
  name: string
  proc: ReturnType<typeof spawn>
  tail: string[]
  error: Error | null
}

async function getFreePort(host: string): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, host, () => {
      const address = server.address()
      server.close(() => {
        if (!address || typeof address === 'string') {
          reject(new Error('Failed to allocate a TCP port'))
          return
        }
        resolve(address.port)
      })
    })
  })
}

async function pickDistinctPorts(host: string) {
  const ports = new Set<number>()
  while (ports.size < 3) {
    ports.add(await getFreePort(host))
  }
  const [restPort, wsPort, appPort] = [...ports]
  return { restPort, wsPort, appPort }
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return spawn(command, args, {
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
}

function runLogged(
  name: string,
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv
): LoggedProcess {
  const proc = spawn(command, args, {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })

  const tail: string[] = []
  const max = 200
  const state: LoggedProcess = { name, proc, tail, error: null }

  function push(line: string) {
    tail.push(line)
    if (tail.length > max) tail.splice(0, tail.length - max)
  }

  function handle(chunk: unknown, stream: NodeJS.WriteStream) {
    const text =
      typeof chunk === 'string'
        ? chunk
        : chunk instanceof Uint8Array
          ? Buffer.from(chunk).toString('utf8')
          : String(chunk)
    for (const line of text.split(/\r?\n/)) {
      if (!line) continue
      push(`[${name}] ${line}`)
      stream.write(`[${name}] ${line}\n`)
    }
  }

  proc.stdout?.on('data', (d) => handle(d, process.stdout))
  proc.stderr?.on('data', (d) => handle(d, process.stderr))
  proc.on('error', (e) => {
    state.error = e
    push(`[${name}] spawn error: ${String(e)}`)
    process.stderr.write(`[${name}] spawn error: ${String(e)}\n`)
  })

  return state
}

async function sleep(ms: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function describeFetchError(e: unknown) {
  if (e && typeof e === 'object') {
    const err = e as { message?: unknown; cause?: unknown }
    const message = typeof err.message === 'string' ? err.message : String(e)
    const cause = err.cause
    if (cause && typeof cause === 'object') {
      const c = cause as { code?: unknown; errno?: unknown; syscall?: unknown }
      const code = typeof c.code === 'string' ? c.code : null
      const errno = typeof c.errno === 'number' ? c.errno : null
      const syscall = typeof c.syscall === 'string' ? c.syscall : null
      const bits = [code, syscall, errno !== null ? String(errno) : null].filter(Boolean).join(' ')
      if (bits) return `${message} (${bits})`
    }
    return message
  }
  return String(e)
}

async function waitForUrl(url: string, timeoutMs: number, deps?: LoggedProcess[]) {
  const start = Date.now()
  let lastError: unknown = null
  while (Date.now() - start < timeoutMs) {
    if (deps) {
      for (const p of deps) {
        if (p.error) {
          const tail = p.tail.slice(-50).join('\n')
          throw new Error(
            `${p.name} failed to start while waiting for ${url}.\n\nError: ${String(p.error)}\n\nLast output:\n${tail}`
          )
        }
        if (p.proc.exitCode !== null) {
          const tail = p.tail.slice(-50).join('\n')
          throw new Error(
            `${p.name} exited early with code ${p.proc.exitCode} while waiting for ${url}.\n\nLast output:\n${tail}`
          )
        }
      }
    }
    try {
      const res = await fetch(url)
      if (res.ok) return
      lastError = new Error(`HTTP ${res.status}`)
    } catch (e) {
      lastError = e
    }
    await sleep(250)
  }
  const depsTail = deps?.length
    ? `\n\nLast output:\n${deps
        .map((p) => p.tail.slice(-30).join('\n'))
        .filter(Boolean)
        .join('\n')}`
    : ''
  throw new Error(
    `Timed out waiting for ${url}. Last error: ${describeFetchError(lastError)}${depsTail}`
  )
}

function terminate(child: ReturnType<typeof spawn> | LoggedProcess, name: string) {
  const proc = 'proc' in child ? child.proc : child
  if (proc.killed) return
  if (process.platform === 'win32') {
    proc.kill()
    return
  }
  proc.kill('SIGTERM')
  setTimeout(() => {
    if (!proc.killed) proc.kill('SIGKILL')
  }, 4_000).unref()
  proc.on('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      console.warn(`[e2e] ${name} exited with code ${code}`)
    } else if (signal) {
      console.warn(`[e2e] ${name} exited with signal ${signal}`)
    }
  })
}

async function main() {
  ensureNoProxyForLocalhost()
  const host = process.env.E2E_HOST || '127.0.0.1'
  const bindHost = process.env.E2E_BIND_HOST || host

  const { restPort, wsPort, appPort } = await pickDistinctPorts(bindHost)
  const resolvedRestPort = Number(process.env.E2E_REST_PORT) || restPort
  const resolvedWsPort = Number(process.env.E2E_WS_PORT) || wsPort
  const resolvedAppPort = Number(process.env.E2E_APP_PORT) || appPort

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    E2E_MANAGED_SERVERS: '1',
    E2E_HOST: host,
    E2E_REST_PORT: String(resolvedRestPort),
    E2E_WS_PORT: String(resolvedWsPort),
    E2E_APP_PORT: String(resolvedAppPort),
    E2E_WS_URL: `ws://${host}:${resolvedWsPort}`,
  }

  console.log(
    `[e2e] host=${host} app=${env.E2E_APP_PORT} rest=${env.E2E_REST_PORT} ws=${env.E2E_WS_PORT}`
  )

  const restUrl = `http://${host}:${resolvedRestPort}/api/health`
  const appUrl = `http://${host}:${resolvedAppPort}`

  const mockLogged = runLogged(
    'mock',
    process.execPath,
    ['--experimental-strip-types', 'server/mock.ts'],
    {
      ...env,
      REST_PORT: String(resolvedRestPort),
      WS_PORT: String(resolvedWsPort),
      REST_HOST: bindHost,
      WS_HOST: bindHost,
      WS_DEBUG: '1',
      WS_PRODUCT_UPDATE_INTERVAL_MS: '60000',
      WS_CART_SYNC_INTERVAL_MS: '60000',
      MOCK_API_DELAY_MS_MIN: '0',
      MOCK_API_DELAY_MS_MAX: '0',
      MOCK_API_FAIL_RATE: '0',
    }
  )

  try {
    await waitForUrl(restUrl, 30_000, [mockLogged])
  } catch (e) {
    terminate(mockLogged, 'mock')
    throw e
  }

  const viteCli = path.resolve(process.cwd(), 'node_modules/vite/bin/vite.js')
  const viteLogged = runLogged(
    'vite',
    process.execPath,
    [
      viteCli,
      '--host',
      bindHost,
      '--port',
      String(resolvedAppPort),
      '--strictPort',
      '--clearScreen',
      'false',
    ],
    {
      ...env,
      VITE_PROXY_TARGET: `http://${host}:${resolvedRestPort}`,
      VITE_WS_URL: `ws://${host}:${resolvedWsPort}`,
    }
  )

  try {
    await waitForUrl(appUrl, 60_000, [viteLogged, mockLogged])
  } catch (e) {
    terminate(viteLogged, 'vite')
    terminate(mockLogged, 'mock')
    throw e
  }

  const args = process.argv.slice(2)
  const playwrightCli = path.resolve(process.cwd(), 'node_modules/@playwright/test/cli.js')
  const child = run(process.execPath, [playwrightCli, 'test', ...args], env)

  child.on('exit', (code, signal) => {
    terminate(viteLogged, 'vite')
    terminate(mockLogged, 'mock')
    if (signal) process.exit(1)
    process.exit(code ?? 1)
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
