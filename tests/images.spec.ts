/**
 * E2E TUGAS 3: gambar produk + audit trail, melawan API lokal
 * (http://localhost:8080/api/v1). Dev server dijalankan otomatis oleh
 * playwright.config.ts (port 5173, VITE_API_URL ke API lokal).
 *
 * CATATAN EGRESS SANDBOX (hasil forensik, bukan bug aplikasi): Chromium di VM
 * ini TIDAK bisa mencapai images.unsplash.com langsung — egress proxy
 * mengembalikan `403 Forbidden` (JSON) pada CONNECT dari Chromium, padahal
 * CONNECT byte-identik via curl/python lolos 200 (terbukti via net-log
 * Chromium + CONNECT mentah). Jadi test ini mencegat request gambar dan
 * memenuhinya dengan byte JPEG ASLI yang diunduh Node (jalur proxy yang
 * berfungsi), sehingga naturalWidth mengukur gambar sungguhan. Di browser
 * pengguna (tanpa egress ini) gambar dimuat langsung dari Unsplash CDN.
 *
 * (a) katalog: SEMUA gambar produk termuat (naturalWidth > 0), tanpa fallback.
 * (a2) fallback: satu URL gambar digagalkan -> kartu itu tampil placeholder
 *     SVG BoldKit (onError), kartu lain tetap gambar asli.
 * (b) detail produk: gambar utama termuat.
 * (c) admin: Dashboard Profit KPI omzet > 0, grafik 30 hari punya >= 14 hari
 *     beromzet, dan "Diproses oleh:" tampil di Transaksi Terbaru — sesudah
 *     admin mengubah status satu order lewat tab Pesanan (jalur audit trail
 *     E2E: PATCH status -> processed_by_name tercatat -> tampil di dashboard).
 */
import { expect, test, type Page } from '@playwright/test'

const ADMIN = { email: 'admin@ecommerce.local', password: 'Admin123!' }

/** Penuhi request Unsplash dengan byte asli via Node (proxy env berfungsi). */
async function routeUnsplashViaNode(page: Page, failSubstrings: string[] = []) {
  await page.route('**/images.unsplash.com/**', async (route) => {
    if (failSubstrings.some((s) => route.request().url().includes(s))) {
      return route.abort()
    }
    try {
      const res = await fetch(route.request().url())
      if (!res.ok) return route.abort()
      const buf = Buffer.from(await res.arrayBuffer())
      await route.fulfill({
        status: res.status,
        contentType: res.headers.get('content-type') ?? 'image/jpeg',
        body: buf,
      })
    } catch {
      await route.abort()
    }
  })
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 })
}

test('katalog: semua gambar produk termuat (naturalWidth > 0), tanpa fallback', async ({ page }) => {
  await routeUnsplashViaNode(page)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('#katalog article').first()).toBeVisible({ timeout: 15_000 })

  const imgs = page.locator('#katalog article img')
  const count = await imgs.count()
  expect(count).toBeGreaterThanOrEqual(12)

  // loading="lazy": gulir tiap gambar ke viewport lalu tunggu termuat.
  const widths = await page.evaluate(async () => {
    const els = Array.from(document.querySelectorAll('#katalog article img')) as HTMLImageElement[]
    const out: number[] = []
    for (const el of els) {
      el.scrollIntoView({ block: 'center' })
      if (!el.complete) {
        await Promise.race([
          new Promise((res) => el.addEventListener('load', res, { once: true })),
          new Promise((res) => el.addEventListener('error', res, { once: true })),
          new Promise((res) => setTimeout(res, 10_000)),
        ])
      }
      out.push(el.naturalWidth)
    }
    return out
  })
  const failed = widths.filter((w) => w === 0).length
  expect(failed, `gambar gagal muat: ${failed}/${widths.length}`).toBe(0)
  await expect(page.locator('#katalog [data-testid="product-image-fallback"]')).toHaveCount(0)
})

test('katalog: gambar gagal -> placeholder SVG BoldKit (onError fallback)', async ({ page }) => {
  // Gagalkan SATU foto (Tumbler Hitam Matte Slaras) -> kartu itu fallback.
  await routeUnsplashViaNode(page, ['photo-1509042239860'])
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('#katalog article').first()).toBeVisible({ timeout: 15_000 })
  const fallbacks = page.locator('#katalog [data-testid="product-image-fallback"]')
  await expect(fallbacks).toHaveCount(1, { timeout: 15_000 })
  await expect(fallbacks.first()).toHaveAttribute('aria-label', 'Tumbler Hitam Matte Slaras')
  // Kartu lain tetap gambar asli.
  expect(await page.locator('#katalog article img').count()).toBeGreaterThanOrEqual(11)
})

test('detail produk: gambar utama termuat', async ({ page }) => {
  await routeUnsplashViaNode(page)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.locator('#katalog article a').first().click()
  await expect(page).toHaveURL(/\/products\//)
  const img = page.locator('img[alt]').first()
  await expect(img).toBeVisible()
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 15_000 })
    .toBeGreaterThan(0)
})

test('admin: profit terisi 14 hari + "Diproses oleh" tampil sesudah ubah status', async ({ page }) => {
  await loginAs(page, ADMIN.email, ADMIN.password)
  await page.goto('/admin')
  await expect(page.getByTestId('profit-dashboard')).toBeVisible()

  // KPI omzet > 0 (ambil baris nilai "Rp..." saja, bukan sub-teks).
  const kpiText = await page.getByTestId('kpi-gross-revenue').innerText()
  const valueLine = kpiText.split('\n').find((l) => l.includes('Rp')) ?? ''
  const omzet = Number(valueLine.replace(/[^\d]/g, ''))
  expect(omzet).toBeGreaterThan(0)

  // Grafik 30 hari: hitung bar omzet dengan tinggi > 0.
  const revenueDays = await page
    .locator('[data-testid="chart-bar-revenue"]')
    .evaluateAll((els) => els.filter((el) => Number(el.getAttribute('height')) > 0).length)
  expect(revenueDays).toBeGreaterThanOrEqual(14)

  // Jalur audit trail E2E: ubah status order pertama di tab Pesanan.
  await page.getByRole('button', { name: /Pesanan/ }).click()
  const statusSelect = page.locator('section select').first()
  await expect(statusSelect).toBeVisible()
  const nextValue = await statusSelect
    .locator('option:not([value=""])')
    .first()
    .getAttribute('value')
  expect(nextValue, 'order pertama tidak punya transisi status').not.toBeNull()
  await statusSelect.selectOption(nextValue as string)
  await expect(page.getByText(/Status order diubah ke/)).toBeVisible({ timeout: 15_000 })

  // Kembali ke Dashboard Profit (remount -> refetch) dan cek audit trail.
  await page.getByRole('button', { name: 'Dashboard Profit' }).click()
  await expect(page.getByTestId('profit-dashboard')).toBeVisible()
  const table = page.getByTestId('recent-transactions-table')
  await expect(table.getByText(/Diproses oleh:/).first()).toBeVisible({ timeout: 15_000 })
})
