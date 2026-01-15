import cors from 'cors'
import express from 'express'

const PORT = Number(process.env.PORT ?? 3000)

const RARITIES = [
  'consumer',
  'industrial',
  'mil-spec',
  'restricted',
  'classified',
  'covert',
] as const

type Rarity = (typeof RARITIES)[number]

export type Product = {
  id: string
  name: string
  price: number
  rarity: Rarity
  inStock: boolean
  tags: string[]
  image: string
  updatedAt: string
}

export type CartItem = {
  productId: string
  name: string
  price: number
  qty: number
  image: string
  inStock: boolean
}

export type Cart = {
  items: CartItem[]
  subtotal: number
  currency: 'USD'
  updatedAt: string
}

function randomInt(minInclusive: number, maxInclusive: number) {
  return Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive
}

function pickOne<T>(items: readonly T[]): T {
  return items[randomInt(0, items.length - 1)]!
}

function pickManyUnique<T>(items: readonly T[], count: number): T[] {
  const copy = [...items]
  const result: T[] = []
  const capped = Math.min(count, copy.length)
  for (let i = 0; i < capped; i += 1) {
    const idx = randomInt(0, copy.length - 1)
    result.push(copy[idx]!)
    copy.splice(idx, 1)
  }
  return result
}

function pad3(n: number) {
  return String(n).padStart(3, '0')
}

function isoNow() {
  return new Date().toISOString()
}

function generateProducts(): Product[] {
  const count = randomInt(50, 100)
  const adjectives = [
    'Crimson',
    'Frost',
    'Shadow',
    'Solar',
    'Emerald',
    'Obsidian',
    'Ivory',
    'Neon',
    'Azure',
    'Violet',
    'Silent',
    'Iron',
    'Carbon',
    'Royal',
  ] as const
  const nouns = [
    'Edge',
    'Fang',
    'Talon',
    'Dagger',
    'Blade',
    'Claw',
    'Spine',
    'Shard',
    'Whisper',
    'Vortex',
  ] as const
  const tagPool = [
    'knife',
    'limited',
    'new',
    'sale',
    'classic',
    'tactical',
    'rare',
    'utility',
  ] as const

  return Array.from({ length: count }, (_v, i) => {
    const id = `knife_${pad3(i + 1)}`
    const name = `${pickOne(adjectives)} ${pickOne(nouns)}`
    const price = Number((randomInt(1999, 39999) / 100).toFixed(2))
    const rarity = pickOne(RARITIES)
    const inStock = Math.random() < 0.7
    const tags = pickManyUnique(tagPool, randomInt(1, 3))
    const image = `https://picsum.photos/seed/${encodeURIComponent(id)}/640/480`
    const updatedAt = isoNow()

    return { id, name, price, rarity, inStock, tags, image, updatedAt }
  })
}

const db = {
  products: generateProducts(),
  cartItemsByProductId: new Map<string, { productId: string; qty: number; price: number }>(),
  cartUpdatedAt: isoNow(),
  generatedAt: isoNow(),
}

const app = express()

app.disable('x-powered-by')

app.use(
  cors({
    origin: true,
    credentials: true,
  })
)
app.use(express.json({ limit: '1mb' }))

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

function getProductById(productId: string): Product | null {
  return db.products.find((p) => p.id === productId) ?? null
}

function getCart(): Cart {
  const currency: Cart['currency'] = 'USD'
  const items: CartItem[] = []

  for (const entry of db.cartItemsByProductId.values()) {
    const product = getProductById(entry.productId)
    if (!product) continue

    items.push({
      productId: entry.productId,
      name: product.name,
      price: entry.price,
      qty: entry.qty,
      image: product.image,
      inStock: product.inStock,
    })
  }

  const subtotal = Number(items.reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(2))

  return {
    items,
    subtotal,
    currency,
    updatedAt: db.cartUpdatedAt,
  }
}

function updateCartTimestamp() {
  db.cartUpdatedAt = isoNow()
}

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

  let items = [...db.products]

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
  const product = db.products.find((p) => p.id === req.params.id)
  if (!product) {
    res.status(404).json({ error: 'PRODUCT_NOT_FOUND', message: 'Product not found' })
    return
  }
  res.status(200).json(product)
})

app.get('/api/cart', (_req, res) => {
  res.status(200).json(getCart())
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

  const product = getProductById(productId)
  if (!product) {
    res.status(404).json({ error: 'PRODUCT_NOT_FOUND', message: 'Product not found' })
    return
  }

  if (!product.inStock) {
    res.status(409).json({ error: 'OUT_OF_STOCK' })
    return
  }

  const existing = db.cartItemsByProductId.get(productId)
  if (existing) {
    existing.qty += qty
  } else {
    db.cartItemsByProductId.set(productId, { productId, qty, price: product.price })
  }

  updateCartTimestamp()
  res.status(200).json(getCart())
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

  const product = getProductById(productId)
  if (!product) {
    res.status(404).json({ error: 'PRODUCT_NOT_FOUND', message: 'Product not found' })
    return
  }

  const existing = db.cartItemsByProductId.get(productId)
  if (!existing) {
    db.cartItemsByProductId.set(productId, { productId, qty, price: product.price })
    updateCartTimestamp()
    res.status(200).json(getCart())
    return
  }

  if (existing.price !== product.price) {
    res.status(409).json({ error: 'PRICE_CHANGED', newPrice: product.price })
    return
  }

  existing.qty = qty
  updateCartTimestamp()
  res.status(200).json(getCart())
})

app.post('/api/cart/remove', (req, res) => {
  const body = asRecord(req.body)
  const productId = asString(body?.productId)?.trim() ?? ''

  if (!productId) {
    res.status(400).json({ error: 'BAD_REQUEST' })
    return
  }

  db.cartItemsByProductId.delete(productId)
  updateCartTimestamp()
  res.status(200).json(getCart())
})

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    products: db.products.length,
    generatedAt: db.generatedAt,
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

const server = app.listen(PORT, () => {
  console.log(`[mock-rest] listening on http://localhost:${PORT}/api`)
})

function shutdown(signal: string) {
  console.log(`[mock-rest] received ${signal}, shutting down...`)
  server.close(() => process.exit(0))
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
