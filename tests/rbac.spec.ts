/**
 * E2E RBAC: admin toko vs superadmin di /admin, melawan API lokal
 * (http://localhost:8080/api/v1). Dev server dijalankan otomatis oleh
 * playwright.config.ts (port 5173, VITE_API_URL ke API lokal).
 *
 * (a) login admin: tab Manajemen User TIDAK ada, tab Dashboard Profit ada,
 *     badge [ STORE ADMIN ] tampil.
 * (b) login superadmin: tab Manajemen User ada + badge [ SUPERADMIN ];
 *     buat user baru (email unik ber-timestamp) -> muncul di tabel;
 *     ubah role user itu -> berhasil; lalu hapus user itu (bersih-bersih).
 */
import { expect, test, type Page } from '@playwright/test'

const ADMIN = { email: 'admin@ecommerce.local', password: 'Admin123!' }
const SUPERADMIN = { email: 'superadmin@slaras.local', password: 'SuperAdmin123!' }

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  // Login sukses -> redirect dari /login (default ke beranda).
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 })
}

test('admin toko: tab Manajemen User disembunyikan, Dashboard Profit ada', async ({ page }) => {
  await loginAs(page, ADMIN.email, ADMIN.password)
  await page.goto('/admin')

  await expect(page.getByText('[ STORE ADMIN ]')).toBeVisible()
  await expect(page.getByText('[ SUPERADMIN ]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Dashboard Profit' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Manajemen User/ })).toHaveCount(0)
  // Tab toko lain tetap ada.
  await expect(page.getByRole('button', { name: /Produk/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Kategori/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Pesanan/ })).toBeVisible()
})

test('superadmin: tab Manajemen User ada, buat + ubah role + hapus user', async ({ page }) => {
  await loginAs(page, SUPERADMIN.email, SUPERADMIN.password)
  await page.goto('/admin')

  await expect(page.getByText('[ SUPERADMIN ]')).toBeVisible()
  await expect(page.getByText('[ STORE ADMIN ]')).toHaveCount(0)

  // Buka tab Manajemen User.
  await page.getByRole('button', { name: /Manajemen User/ }).click()
  await expect(page.getByText('Total Pengguna')).toBeVisible()
  await expect(page.getByText('Admin Toko', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Akun Nonaktif')).toBeVisible()
  // Akun superadmin seed tampil di tabel (sel tabel, bukan teks header).
  await expect(page.getByRole('cell', { name: SUPERADMIN.email, exact: true })).toBeVisible()

  // Buat user baru (email unik ber-timestamp).
  const stamp = Date.now()
  const newEmail = `rbac-test-${stamp}@test.local`
  await page.getByRole('button', { name: /Tambah User \/ Admin Baru/ }).click()
  await page.locator('#new-user-name').fill('RBAC Test User')
  await page.locator('#new-user-email').fill(newEmail)
  await page.locator('#new-user-password').fill('RbacTest123!')
  await page.locator('#new-user-role').selectOption('admin')
  await page.getByRole('button', { name: 'Buat User', exact: true }).click()

  const row = page.locator('tr', { hasText: newEmail })
  await expect(row).toBeVisible({ timeout: 15_000 })
  // Badge role (span) — bukan <option> di dropdown baris yang sama.
  await expect(row.locator('span', { hasText: 'Admin Toko' })).toBeVisible()

  // Ubah role user itu: Admin Toko -> Customer.
  await row.locator('select[aria-label^="Ubah role"]').selectOption('customer')
  await expect(page.getByText(/diubah ke Customer/)).toBeVisible()
  await expect(row.locator('span', { hasText: 'Customer' })).toBeVisible()

  // Hapus user itu (bersih-bersih) — confirm dialog browser.
  page.once('dialog', (d) => d.accept())
  await row.getByRole('button', { name: `Hapus ${newEmail}` }).click()
  await expect(page.locator('tr', { hasText: newEmail })).toHaveCount(0, { timeout: 15_000 })
})
