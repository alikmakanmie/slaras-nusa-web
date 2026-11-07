/**
 * E2E upgrade pelanggan (mock API — tidak butuh backend lokal):
 * stepper +/- di card menu, QR meja ?table=, voucher checkout,
 * modal kustomisasi varian, dan layar antrean /queue.
 */
import { expect, test, type Page } from '@playwright/test'

const PRODUCTS = [
  {
    id: 'p-kopi',
    category_id: 'c-kopi',
    category: { id: 'c-kopi', name: 'Kopi', slug: 'kopi', description: '', image_url: '', created_at: '', updated_at: '' },
    name: 'Kopi Susu Gula Aren',
    slug: 'kopi-susu-gula-aren',
    description: 'Kopi susu gula aren.',
    price: 18000,
    cost_price: 9000,
    stock: 10,
    sku: 'SNF-KOPI-01',
    image_url: '',
    weight_gram: 200,
    is_active: true,
    is_available: true,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'p-nasgor',
    category_id: 'c-makan',
    category: { id: 'c-makan', name: 'Makanan', slug: 'makanan', description: '', image_url: '', created_at: '', updated_at: '' },
    name: 'Nasi Goreng Slaras',
    slug: 'nasi-goreng-slaras',
    description: 'Nasi goreng spesial.',
    price: 25000,
    cost_price: 12000,
    stock: 5,
    sku: 'SNF-NASGOR-01',
    image_url: '',
    weight_gram: 300,
    is_active: true,
    is_available: true,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'p-teh',
    category_id: 'c-kopi',
    category: { id: 'c-kopi', name: 'Kopi', slug: 'kopi', description: '', image_url: '', created_at: '', updated_at: '' },
    name: 'Es Teh Melati',
    slug: 'es-teh-melati',
    description: 'Es teh melati.',
    price: 8000,
    cost_price: 3000,
    stock: 20,
    sku: 'SNF-TEH-01',
    image_url: '',
    weight_gram: 200,
    is_active: true,
    is_available: false,
    created_at: '',
    updated_at: '',
  },
]

const CATEGORIES = [
  { id: 'c-kopi', name: 'Kopi', slug: 'kopi', description: '', image_url: '', created_at: '', updated_at: '' },
  { id: 'c-makan', name: 'Makanan', slug: 'makanan', description: '', image_url: '', created_at: '', updated_at: '' },
]

async function mockCatalog(page: Page) {
  await page.route('**/api/v1/categories', (route) =>
    route.fulfill({ json: { success: true, data: CATEGORIES } }),
  )
  await page.route('**/api/v1/products*', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: PRODUCTS,
        meta: { page: 1, limit: 12, total: 3, total_pages: 1 },
      },
    }),
  )
}

function firstCard(page: Page) {
  return page.locator('[data-testid="product-card"]').first()
}

test.describe('Upgrade pelanggan (mock)', () => {
  test.beforeEach(async ({ page }) => {
    await mockCatalog(page)
    // Bersihkan state lokal antar test.
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('(a) stepper +/- di card menu + badge sold out', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#katalog article').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid="product-card"]')).toHaveCount(3)

    // Kartu sold out: badge tegas + tombol tambah disabled.
    const soldOut = page.locator('[data-testid="product-card"]').nth(2)
    await expect(soldOut.getByText('[ HABIS HARI INI / SOLD OUT ]')).toBeVisible()
    await expect(soldOut.getByRole('button', { name: 'TAMBAH', exact: true })).toBeDisabled()

    // + TAMBAH -> stepper muncul qty 1.
    const card = firstCard(page)
    await card.getByRole('button', { name: 'TAMBAH', exact: true }).click()
    await expect(card.getByTestId('card-stepper')).toBeVisible()
    await expect(card.getByTestId('card-qty')).toHaveText('1')
    await expect(page.getByTestId('floating-cart-count')).toHaveText(/\[ 1 ITEM \]/)

    // + -> 2, - -> 1, - -> 0 (kembali jadi + TAMBAH, bar hilang).
    await card.getByRole('button', { name: 'Tambah', exact: true }).click()
    await expect(card.getByTestId('card-qty')).toHaveText('2')
    await expect(page.getByTestId('floating-cart-count')).toHaveText(/\[ 2 ITEM \]/)
    await card.getByRole('button', { name: 'Kurangi', exact: true }).click()
    await expect(card.getByTestId('card-qty')).toHaveText('1')
    await card.getByRole('button', { name: 'Kurangi', exact: true }).click()
    await expect(card.getByRole('button', { name: 'TAMBAH', exact: true })).toBeVisible()
    await expect(page.getByTestId('floating-cart-bar')).toHaveCount(0)
  })

  test('(b) ?table=05 mengunci Dine-In Meja 05', async ({ page }) => {
    await page.goto('/?table=05')
    await expect(page.locator('#katalog article').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('table-banner')).toContainText('MEJA 05')

    await firstCard(page).getByRole('button', { name: 'TAMBAH', exact: true }).click()
    await page.goto('/checkout')
    await expect(page.getByRole('tab', { name: /dine-in/i })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('button', { name: 'Meja 5' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('(c) voucher SLARASHEMAT memotong total + badge loyalitas WA', async ({ page }) => {
    let checkoutBody: Record<string, unknown> = {}
    await page.route('**/api/v1/vouchers/validate', (route) =>
      route.fulfill({
        json: { success: true, data: { valid: true, discount_amount: 15000, message: 'Voucher dipakai', code: 'SLARASHEMAT' } },
      }),
    )
    await page.route('**/api/v1/loyalty/*', (route) =>
      route.fulfill({
        json: { success: true, data: { phone: '081234567890', points: 4, reward_eligible: false } },
      }),
    )
    const mockOrder = {
      id: 'ord-1',
      order_number: 'ORD-20261107-000001',
      customer_name: 'Budi Voucher',
      customer_phone: '081234567890',
      order_type: 'dine_in',
      table_number: 'Meja 5',
      status: 'pending',
      subtotal: 36000,
      shipping_cost: 0,
      discount_amount: 15000,
      voucher_code: 'SLARASHEMAT',
      total: 21000,
      payment_method: 'qris',
      notes: '',
      items: [
        { id: 'oi-1', order_id: 'ord-1', product_id: 'p-kopi', product_name: 'Kopi Susu Gula Aren', price: 18000, quantity: 2, subtotal: 36000 },
      ],
      payment: { transaction_id: 'TX1', gateway: 'mock', method: 'qris', amount: 21000, status: 'pending', qr_string: 'QRDATA' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    await page.route('**/api/v1/orders/guest-checkout', async (route) => {
      checkoutBody = (route.request().postDataJSON() ?? {}) as Record<string, unknown>
      await route.fulfill({ json: { success: true, data: mockOrder } })
    })
    await page.route('**/api/v1/orders/track/*', (route) =>
      route.fulfill({ json: { success: true, data: mockOrder } }),
    )

    await page.goto('/')
    await expect(page.locator('#katalog article').first()).toBeVisible({ timeout: 15_000 })
    const card = firstCard(page)
    await card.getByRole('button', { name: 'TAMBAH', exact: true }).click()
    await card.getByRole('button', { name: 'Tambah', exact: true }).click()
    await expect(card.getByTestId('card-qty')).toHaveText('2')

    await page.goto('/checkout')
    await page.getByLabel(/Nama Pemesan/).fill('Budi Voucher')
    await page.getByRole('button', { name: 'Meja 5' }).click()

    // Badge loyalitas muncul saat mengetik nomor WA.
    await page.getByLabel(/No. WhatsApp/).fill('081234567890')
    await expect(page.getByTestId('loyalty-badge')).toContainText('4/10 Stamp SLARAS')

    // Chip voucher SLARASHEMAT langsung memotong total 36000 -> 21000.
    await page.getByRole('button', { name: 'SLARASHEMAT', exact: true }).click()
    await expect(page.getByTestId('voucher-applied')).toContainText('SLARASHEMAT')
    await expect(page.getByTestId('voucher-discount')).toContainText(/15\.000/)
    await expect(page.getByTestId('checkout-total')).toContainText(/21\.000/)

    await page.getByRole('button', { name: /Bayar Sekarang/ }).click()
    await expect(page.getByText('Scan kode QRIS')).toBeVisible()
    expect(checkoutBody.voucher_code).toBe('SLARASHEMAT')
    expect(checkoutBody.customer_name).toBe('Budi Voucher')
  })

  test('(d) /queue menampilkan antrean aktif', async ({ page }) => {
    await page.route('**/api/v1/orders/queue', (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            preparing: [
              { order_number: 'ORD-20261107-000001', customer_name: 'Budi', order_type: 'dine_in', table_number: 'Meja 05', status: 'processing' },
            ],
            ready: [
              { order_number: 'ORD-20261107-000002', customer_name: 'Sari', order_type: 'takeaway', table_number: '', status: 'completed' },
            ],
          },
        },
      }),
    )
    await page.goto('/queue')
    await expect(page.getByTestId('queue-page')).toBeVisible()
    await expect(page.getByText('[ 🔥 SEDANG DISIAPKAN (KITCHEN/BAR) ]')).toBeVisible()
    await expect(page.getByText('[ ✅ SIAP DINIKMATI / DIAMBIL ]')).toBeVisible()
    await expect(page.getByTestId('queue-preparing')).toContainText('ORD-20261107-000001')
    await expect(page.getByTestId('queue-preparing')).toContainText('Budi')
    await expect(page.getByTestId('queue-preparing')).toContainText('Meja 05')
    await expect(page.getByTestId('queue-ready')).toContainText('ORD-20261107-000002')
    await expect(page.getByTestId('queue-ready')).toContainText('Sari')
  })

  test('(e) modal kustomisasi: add-on menaikkan harga item', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#katalog article').first()).toBeVisible({ timeout: 15_000 })
    const card = firstCard(page)
    await card.getByRole('button', { name: 'Kustomisasi / Varian' }).click()
    await expect(page.getByText('Temperature')).toBeVisible()
    await page.getByRole('button', { name: /Extra Espresso Shot/ }).click()
    await page.getByRole('button', { name: /Tambah • Rp ?23\.000/ }).click()
    await expect(page.getByTestId('floating-cart-total')).toContainText(/23\.000/)
    await expect(card.getByTestId('card-qty')).toHaveText('1')
  })
})
