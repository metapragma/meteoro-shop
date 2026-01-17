export const RARITIES = [
  'consumer',
  'industrial',
  'mil-spec',
  'restricted',
  'classified',
  'covert',
] as const

export type Rarity = (typeof RARITIES)[number]

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

type CartEntry = {
  productId: string
  qty: number
  price: number
}

export type State = {
  products: Product[]
  cartItemsByProductId: Map<string, CartEntry>
  cartUpdatedAt: string
  generatedAt: string
  orderDayKey: string
  orderSeq: number
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

export function isoNow() {
  return new Date().toISOString()
}

const KNIFE_IMAGE_URL =
  'https://wusthof.de/cdn/shop/products/1030100126.png?v=1722880307&width=1920'

export function generateProducts(): Product[] {
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
    const image = KNIFE_IMAGE_URL
    const updatedAt = isoNow()

    return { id, name, price, rarity, inStock, tags, image, updatedAt }
  })
}

export function createState(): State {
  return {
    products: generateProducts(),
    cartItemsByProductId: new Map(),
    cartUpdatedAt: isoNow(),
    generatedAt: isoNow(),
    orderDayKey: '',
    orderSeq: 0,
  }
}

export function getProductById(state: State, productId: string): Product | null {
  return state.products.find((p) => p.id === productId) ?? null
}

export function updateCartTimestamp(state: State) {
  state.cartUpdatedAt = isoNow()
}

export function getCart(state: State): Cart {
  const currency: Cart['currency'] = 'USD'
  const items: CartItem[] = []

  for (const entry of state.cartItemsByProductId.values()) {
    const product = getProductById(state, entry.productId)
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
    updatedAt: state.cartUpdatedAt,
  }
}

export function nextOrderId(state: State): string {
  const now = new Date()
  const y = String(now.getUTCFullYear())
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  const dayKey = `${y}${m}${d}`

  if (state.orderDayKey !== dayKey) {
    state.orderDayKey = dayKey
    state.orderSeq = 0
  }

  state.orderSeq += 1
  const seq = String(state.orderSeq).padStart(4, '0')
  return `ORD-${dayKey}-${seq}`
}

export type ProductChanges = Partial<Pick<Product, 'price' | 'inStock' | 'updatedAt'>>

export function applyProductChanges(
  state: State,
  productId: string,
  changes: ProductChanges
): Product | null {
  const product = getProductById(state, productId)
  if (!product) return null

  if (typeof changes.price === 'number') product.price = changes.price
  if (typeof changes.inStock === 'boolean') product.inStock = changes.inStock
  if (typeof changes.updatedAt === 'string') product.updatedAt = changes.updatedAt

  return product
}

export function pickRandomProduct(state: State): Product | null {
  if (state.products.length === 0) return null
  return state.products[randomInt(0, state.products.length - 1)]!
}
