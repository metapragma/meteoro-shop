import cors from 'cors'
import express from 'express'
import {
  RARITIES,
  applyProductChanges,
  getCart,
  getProductById,
  isoNow,
  nextOrderId,
  type Product,
  type Rarity,
  type State,
  updateCartTimestamp,
} from './state.ts'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return null
}

function parseNumber(value: unknown): number | null {
  const s = asString(value)
  if (s === null) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function parsePositiveInt(value: unknown): number | null {
  const n = parseNumber(value)
  if (n === null) return null
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

function parseBoolean(value: unknown): boolean | null {
  const s = asString(value)
  if (s === null) return null
  if (s === 'true') return true
  if (s === 'false') return false
  return null
}

function isRarity(value: string): value is Rarity {
  return (RARITIES as readonly string[]).includes(value)
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function mockDelayMs(): number {
  const min = Number(process.env.MOCK_API_DELAY_MS_MIN ?? 0)
  const max = Number(process.env.MOCK_API_DELAY_MS_MAX ?? 0)
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0) return 0
  if (max <= min) return Math.floor(min)
  return Math.floor(min + Math.random() * (max - min))
}

function mockFailRate(): number {
  const rate = Number(process.env.MOCK_API_FAIL_RATE ?? 0)
  if (!Number.isFinite(rate) || rate <= 0) return 0
  return Math.min(rate, 1)
}

export function createRestApp(state: State) {
  const app = express()

  app.disable('x-powered-by')

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  )
  app.use(express.json({ limit: '1mb' }))

  // Latency/failure injection for testing UI states (disabled by default).
  app.use('/api', async (req, res, next) => {
    if (req.path === '/health') {
      next()
      return
    }

    const forcedFail = req.header('x-mock-fail') === '1'
    const rate = mockFailRate()
    const shouldFail = forcedFail || (rate > 0 && Math.random() < rate)

    const ms = mockDelayMs()
    if (ms > 0) await delay(ms)

    if (shouldFail) {
      res.status(500).json({ error: 'MOCK_FAILURE', message: 'Simulated failure' })
      return
    }

    next()
  })

  app.post('/api/auth/login', (req, res) => {
    const body = req.body as unknown
    const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : null

    const provider = record?.provider
    const nickname = record?.nickname
    const avatar = record?.avatar

    if (provider !== 'mock') {
      res.status(400).json({ error: 'INVALID_PROVIDER', message: 'provider must be "mock"' })
      return
    }

    if (typeof nickname !== 'string' || nickname.trim().length === 0) {
      res.status(422).json({ error: 'INVALID_NICKNAME', message: 'nickname is required' })
      return
    }

    if (typeof avatar !== 'string' || avatar.trim().length === 0) {
      res.status(422).json({ error: 'INVALID_AVATAR', message: 'avatar is required' })
      return
    }

    res.status(200).json({
      token: 'fake-jwt-token',
      user: {
        id: 'u_123',
        nickname,
        avatar,
      },
    })
  })

  app.post('/api/auth/logout', (_req, res) => {
    res.status(204).end()
  })

  app.get('/api/products', (req, res) => {
    const q = asString(req.query.q)?.trim().toLowerCase() ?? null
    const min = parseNumber(req.query.min)
    const max = parseNumber(req.query.max)
    const inStock = parseBoolean(req.query.inStock)
    const rarityRaw = asString(req.query.rarity)
    const sortRaw = asString(req.query.sort)

    const page = parsePositiveInt(req.query.page) ?? 1
    const limit = parsePositiveInt(req.query.limit) ?? 20

    if (min !== null && min < 0) {
      res.status(400).json({ error: 'BAD_QUERY', message: 'min must be >= 0' })
      return
    }
    if (max !== null && max < 0) {
      res.status(400).json({ error: 'BAD_QUERY', message: 'max must be >= 0' })
      return
    }
    if (min !== null && max !== null && min > max) {
      res.status(400).json({ error: 'BAD_QUERY', message: 'min must be <= max' })
      return
    }
    if (rarityRaw !== null && !isRarity(rarityRaw)) {
      res.status(400).json({ error: 'BAD_QUERY', message: 'rarity is invalid' })
      return
    }
    if (sortRaw !== null && sortRaw !== 'price_asc' && sortRaw !== 'price_desc') {
      res.status(400).json({ error: 'BAD_QUERY', message: 'sort is invalid' })
      return
    }

    let items = [...state.products]

    if (q) {
      items = items.filter((p) => p.name.toLowerCase().includes(q))
    }
    if (min !== null) {
      items = items.filter((p) => p.price >= min)
    }
    if (max !== null) {
      items = items.filter((p) => p.price <= max)
    }
    if (inStock !== null) {
      items = items.filter((p) => p.inStock === inStock)
    }
    if (rarityRaw !== null) {
      items = items.filter((p) => p.rarity === rarityRaw)
    }

    items.sort((a, b) => {
      if (sortRaw === 'price_asc') {
        if (a.price !== b.price) return a.price - b.price
      } else if (sortRaw === 'price_desc') {
        if (a.price !== b.price) return b.price - a.price
      }
      return a.id.localeCompare(b.id)
    })

    const total = items.length
    const safeLimit = Math.min(Math.max(limit, 1), 100)
    const safePage = Math.max(page, 1)
    const offset = (safePage - 1) * safeLimit
    const paged = items.slice(offset, offset + safeLimit)

    res.status(200).json({
      items: paged,
      total,
      page: safePage,
      limit: safeLimit,
    })
  })

  app.get('/api/products/:id', (req, res) => {
    const product = getProductById(state, req.params.id)
    if (!product) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND', message: 'Product not found' })
      return
    }
    res.status(200).json(product)
  })

  app.get('/api/cart', (_req, res) => {
    res.status(200).json(getCart(state))
  })

  app.post('/api/cart/add', (req, res) => {
    const body = asRecord(req.body)
    const productId = asString(body?.productId)?.trim() ?? ''
    const qtyRaw = body?.qty
    const qty = typeof qtyRaw === 'number' ? qtyRaw : Number.NaN

    if (!productId) {
      res.status(400).json({ error: 'BAD_REQUEST' })
      return
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      res.status(400).json({ error: 'BAD_QTY' })
      return
    }

    const product = getProductById(state, productId)
    if (!product) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND', message: 'Product not found' })
      return
    }

    if (!product.inStock) {
      res.status(409).json({ error: 'OUT_OF_STOCK' })
      return
    }

    const existing = state.cartItemsByProductId.get(productId)
    if (existing) {
      existing.qty += qty
    } else {
      state.cartItemsByProductId.set(productId, { productId, qty, price: product.price })
    }

    updateCartTimestamp(state)
    res.status(200).json(getCart(state))
  })

  app.post('/api/cart/update', (req, res) => {
    const body = asRecord(req.body)
    const productId = asString(body?.productId)?.trim() ?? ''
    const qtyRaw = body?.qty
    const qty = typeof qtyRaw === 'number' ? qtyRaw : Number.NaN

    if (!productId) {
      res.status(400).json({ error: 'BAD_REQUEST' })
      return
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      res.status(400).json({ error: 'BAD_QTY' })
      return
    }

    const product = getProductById(state, productId)
    if (!product) {
      res.status(404).json({ error: 'PRODUCT_NOT_FOUND', message: 'Product not found' })
      return
    }

    const existing = state.cartItemsByProductId.get(productId)
    if (!existing) {
      state.cartItemsByProductId.set(productId, { productId, qty, price: product.price })
      updateCartTimestamp(state)
      res.status(200).json(getCart(state))
      return
    }

    if (existing.price !== product.price) {
      // Update server-side cart price to the latest product price, but require client confirmation.
      existing.price = product.price
      updateCartTimestamp(state)
      res.status(409).json({ error: 'PRICE_CHANGED', newPrice: product.price })
      return
    }

    existing.qty = qty
    updateCartTimestamp(state)
    res.status(200).json(getCart(state))
  })

  app.post('/api/cart/remove', (req, res) => {
    const body = asRecord(req.body)
    const productId = asString(body?.productId)?.trim() ?? ''

    if (!productId) {
      res.status(400).json({ error: 'BAD_REQUEST' })
      return
    }

    state.cartItemsByProductId.delete(productId)
    updateCartTimestamp(state)
    res.status(200).json(getCart(state))
  })

  function isCartOutdated(clientCart: unknown): boolean {
    const record = asRecord(clientCart)
    const updatedAt = asString(record?.updatedAt)
    if (updatedAt === null) return true
    return updatedAt !== state.cartUpdatedAt
  }

  app.post('/api/checkout', (req, res) => {
    const body = asRecord(req.body)
    const customer = asRecord(body?.customer)

    const name = asString(customer?.name)?.trim() ?? ''
    const comment = customer?.comment

    if (!name) {
      res.status(422).json({ error: 'INVALID_CUSTOMER' })
      return
    }

    if (comment !== undefined && typeof comment !== 'string') {
      res.status(422).json({ error: 'INVALID_CUSTOMER' })
      return
    }

    if (isCartOutdated(body?.cart)) {
      res.status(409).json({ error: 'CART_OUTDATED', serverCart: getCart(state) })
      return
    }

    const orderId = nextOrderId(state)

    state.cartItemsByProductId.clear()
    updateCartTimestamp(state)

    res.status(200).json({ orderId })
  })

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      products: state.products.length,
      generatedAt: state.generatedAt,
    })
  })

  // Placeholder routes (implemented in later tasks).
  app.use('/api', (_req, res) => {
    res.status(501).json({
      error: 'NOT_IMPLEMENTED',
      message: 'Mock API endpoint is not implemented yet',
    })
  })

  // Not found handler (non-/api routes)
  app.use((_req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Not found' })
  })

  // Error handler
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) => {
      console.error(err)
      res.status(500).json({ error: 'INTERNAL', message: 'Internal server error' })
    }
  )

  return app
}

// Used by WS simulation to produce realistic cart error scenarios.
export function bumpRandomProductPrice(state: State): Product | null {
  const product = state.products[Math.floor(Math.random() * state.products.length)] ?? null
  if (!product) return null

  const delta = 1 + (Math.random() * 0.2 - 0.1) // -10%..+10%
  const newPrice = Number(Math.max(0.99, product.price * delta).toFixed(2))
  const updatedAt = isoNow()
  return applyProductChanges(state, product.id, { price: newPrice, updatedAt })
}
