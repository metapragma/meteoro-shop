import { expect, test, type Page } from '@playwright/test'
import WebSocket from 'ws'

test.describe('app', () => {
  test.describe.configure({ mode: 'serial' })

  function getWsUrl() {
    if (process.env.E2E_WS_URL) return process.env.E2E_WS_URL
    const host = process.env.E2E_HOST || '127.0.0.1'
    const port = process.env.E2E_WS_PORT || '3001'
    return `ws://${host}:${port}`
  }

  async function login(page: Page) {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Войти' }).click()
    await expect(page).toHaveURL(/\/catalog/)
  }

  async function addFirstInStockProductFromCatalog(page: Page) {
    await page.goto('/catalog')
    await page.getByLabel('Только в наличии').check()

    const addBtn = page.locator('button[aria-label="В корзину"]:not([disabled])').first()
    const card = addBtn.locator('xpath=ancestor::article[1]')

    const addTestId = await addBtn.getAttribute('data-testid')
    const fromTestId = addTestId?.startsWith('catalog-add-to-cart-')
      ? addTestId.replace('catalog-add-to-cart-', '')
      : null

    const productId =
      fromTestId ??
      (
        await card
          .getByText(/knife_\d+/)
          .first()
          .textContent()
      )?.trim()
    if (!productId) throw new Error('Failed to detect product id from catalog card')

    await addBtn.click()
    return productId
  }

  test('core flow: login → catalog → cart → checkout', async ({ page }) => {
    await login(page)

    await expect(page.getByRole('heading', { name: 'Каталог' })).toBeVisible()
    await expect(page.getByText(/Найдено товаров:/)).toBeVisible()

    await addFirstInStockProductFromCatalog(page)

    await page.getByRole('link', { name: 'Корзина' }).click()
    await expect(page.getByRole('heading', { name: 'Корзина' })).toBeVisible()
    await expect(page.getByText('Корзина пуста.')).not.toBeVisible()

    await page.getByRole('link', { name: 'Оформление' }).click()
    await expect(page.getByRole('heading', { name: 'Оформление заказа' })).toBeVisible()

    await page.getByLabel('Имя').fill('John Doe')
    await page.getByRole('button', { name: 'Оформить заказ' }).click()

    await expect(page.getByText(/Заказ/)).toBeVisible()
    await expect(page.getByText(/оформлен/)).toBeVisible()
  })

  test('WS update: product page reacts to product.updated', async ({ page }) => {
    await login(page)

    await page.goto('/product/knife_001')
    await expect(page.getByRole('heading', { name: 'Товар' })).toBeVisible()

    const before = await page.getByTestId('product-price').textContent()

    const ws = new WebSocket(getWsUrl())
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve())
      ws.addEventListener('error', () => reject(new Error('WS connect failed')))
    })

    ws.send(
      JSON.stringify({
        type: 'debug.product.update',
        data: { id: 'knife_001', changes: { price: 999.99, inStock: false } },
      })
    )
    ws.close()

    await expect(page.getByTestId('product-price')).not.toHaveText(before ?? '')
    await expect(page.getByTestId('product-price')).toHaveText('$999.99')
    await expect(page.getByTestId('live-updated-at')).not.toHaveText('—')
  })

  test('WS update: cart shows price-change confirmation', async ({ page }) => {
    await login(page)
    const productId = await addFirstInStockProductFromCatalog(page)

    await page.goto('/cart')
    await expect(page.getByRole('heading', { name: 'Корзина' })).toBeVisible()

    const ws = new WebSocket(getWsUrl())
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve())
      ws.addEventListener('error', () => reject(new Error('WS connect failed')))
    })

    ws.send(
      JSON.stringify({
        type: 'debug.product.update',
        data: { id: productId, changes: { price: 999.99 } },
      })
    )
    ws.close()

    await expect(page.getByText(/Цена изменилась/)).toBeVisible()
    await page.getByRole('button', { name: 'Подтвердить' }).click()
    await expect(page.getByText(/Цена изменилась/)).not.toBeVisible()
    await expect(page.getByTestId(`cart-item-price-${productId}`)).toHaveText('$999.99')
  })

  test('WS update: cart.synced shows toast', async ({ page }) => {
    await login(page)
    await addFirstInStockProductFromCatalog(page)

    const ws = new WebSocket(getWsUrl())
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve())
      ws.addEventListener('error', () => reject(new Error('WS connect failed')))
    })

    ws.send(JSON.stringify({ type: 'debug.cart.sync' }))
    ws.close()

    await expect(page.getByText('Корзина обновлена')).toBeVisible()
  })
})
