import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { catalogApi, orderApi, voucherAdminApi } from '../api/endpoints'
import { apiErrorMessage, uploadImage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { Category, CategoryInput, Order, OrderStatus, Product, ProductInput, Voucher, VoucherInput } from '../api/types'
import { formatDate, formatRupiah } from '../utils/format'
import { Modal, Spinner } from '../components/ProtectedRoute'
import { NEXT_STATUS, StatusBadge } from '../components/StatusBadge'
import ProductImage from '../components/ProductImage'
import ProfitDashboard from './ProfitDashboard'
import UserManagement from './UserManagement'

type Tab = 'profit' | 'products' | 'categories' | 'orders' | 'vouchers' | 'users'

const EMPTY_VOUCHER: VoucherInput = {
  code: '',
  discount_type: 'percentage',
  discount_value: 0,
  min_order_amount: 0,
  max_discount: 0,
  quota: 0,
  is_active: true,
  expires_at: null,
}

const EMPTY_PRODUCT: ProductInput = {
  category_id: '',
  name: '',
  slug: '',
  description: '',
  price: 0,
  cost_price: undefined,
  stock: 0,
  sku: '',
  image_url: '',
  weight_gram: 0,
  is_active: true,
}

const EMPTY_CATEGORY: CategoryInput = { name: '', description: '', image_url: '' }

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function Admin() {
  const { user, isSuperAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>('profit')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)

  const [productModal, setProductModal] = useState<{ open: boolean; editing: Product | null }>({
    open: false,
    editing: null,
  })
  const [productForm, setProductForm] = useState<ProductInput>(EMPTY_PRODUCT)
  const [savingProduct, setSavingProduct] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  const [categoryModal, setCategoryModal] = useState<{ open: boolean; editing: Category | null }>({
    open: false,
    editing: null,
  })
  const [categoryForm, setCategoryForm] = useState<CategoryInput>(EMPTY_CATEGORY)
  const [savingCategory, setSavingCategory] = useState(false)

  const [busyId, setBusyId] = useState<string | null>(null)

  const [voucherModal, setVoucherModal] = useState<{ open: boolean; editing: Voucher | null }>({
    open: false,
    editing: null,
  })
  const [voucherForm, setVoucherForm] = useState<VoucherInput>(EMPTY_VOUCHER)
  const [savingVoucher, setSavingVoucher] = useState(false)

  // Voucher dimuat terpisah & non-blocking: bila endpoint belum tersedia di
  // backend, panel admin tetap jalan (daftar voucher kosong).
  const fetchVouchers = useCallback(async () => {
    try {
      setVouchers(await voucherAdminApi.list())
    } catch {
      setVouchers([])
    }
  }, [])

  useEffect(() => {
    fetchVouchers()
  }, [fetchVouchers])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [cats, prods, ords] = await Promise.all([
        catalogApi.listCategories(),
        catalogApi.listProducts({ limit: 100 }),
        orderApi.listAll(1, 50),
      ])
      setCategories(cats)
      setProducts(prods.products)
      setOrders(ords.orders)
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal memuat data admin'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const flash = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(''), 4000)
  }

  // ---------- Produk ----------
  const openProductForm = (p: Product | null) => {
    if (p) {
      setProductForm({
        category_id: p.category_id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        cost_price: p.cost_price ?? undefined,
        stock: p.stock,
        sku: p.sku,
        image_url: p.image_url,
        weight_gram: p.weight_gram,
        is_active: p.is_active,
      })
    } else {
      setProductForm({ ...EMPTY_PRODUCT, category_id: categories[0]?.id ?? '' })
    }
    setProductModal({ open: true, editing: p })
  }

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran file maksimal 5MB')
      return
    }
    setError('')
    setUploadingImage(true)
    try {
      const url = await uploadImage(file)
      setProductForm({ ...productForm, image_url: url })
      flash('Foto berhasil diunggah')
    } catch (err) {
      setError(apiErrorMessage(err, 'Upload foto gagal'))
    } finally {
      setUploadingImage(false)
    }
  }

  const saveProduct = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSavingProduct(true)
    try {
      const input: ProductInput = {
        ...productForm,
        slug: (productForm.slug ?? '').trim() || slugify(productForm.name),
        price: Number(productForm.price),
        // Kosong/0 = backend default 60% dari harga (create) / tidak diubah (update).
        cost_price:
          productForm.cost_price === undefined || Number.isNaN(Number(productForm.cost_price))
            ? 0
            : Number(productForm.cost_price),
        stock: Number(productForm.stock),
        weight_gram: Number(productForm.weight_gram) || 0,
      }
      if (productModal.editing) {
        await catalogApi.updateProduct(productModal.editing.id, input)
        flash('Produk diperbarui')
      } else {
        await catalogApi.createProduct(input)
        flash('Produk dibuat')
      }
      setProductModal({ open: false, editing: null })
      await fetchAll()
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal menyimpan produk'))
    } finally {
      setSavingProduct(false)
    }
  }

  const deleteProduct = async (p: Product) => {
    if (!window.confirm(`Hapus produk "${p.name}"?`)) return
    setBusyId(p.id)
    try {
      await catalogApi.deleteProduct(p.id)
      flash('Produk dihapus')
      await fetchAll()
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal menghapus produk'))
    } finally {
      setBusyId(null)
    }
  }

  /** 1-Click Sold Out: toggle is_available tanpa mengubah stok. */
  const toggleAvailability = async (p: Product) => {
    const next = !(p.is_available ?? true)
    setBusyId(p.id)
    try {
      await catalogApi.setAvailability(p.id, next)
      setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, is_available: next } : x)))
      flash(next ? `"${p.name}" kembali TERSEDIA` : `"${p.name}" ditandai HABIS HARI INI`)
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal mengubah ketersediaan produk'))
    } finally {
      setBusyId(null)
    }
  }

  /** Kontrol stok cepat +/- langsung dari kartu produk admin. */
  const adjustStock = async (p: Product, delta: number) => {
    const nextStock = Math.max(0, p.stock + delta)
    if (nextStock === p.stock) return
    setBusyId(p.id)
    try {
      await catalogApi.updateProduct(p.id, {
        category_id: p.category_id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        cost_price: p.cost_price ?? 0,
        stock: nextStock,
        sku: p.sku,
        image_url: p.image_url,
        weight_gram: p.weight_gram,
        is_active: p.is_active,
      })
      setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, stock: nextStock } : x)))
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal mengubah stok'))
    } finally {
      setBusyId(null)
    }
  }

  // ---------- Voucher ----------
  const openVoucherForm = (v: Voucher | null) => {
    if (v) {
      setVoucherForm({
        code: v.code,
        discount_type: v.discount_type,
        discount_value: v.discount_value,
        min_order_amount: v.min_order_amount,
        max_discount: v.max_discount,
        quota: v.quota,
        is_active: v.is_active,
        expires_at: v.expires_at ? String(v.expires_at).slice(0, 10) : null,
      })
    } else {
      setVoucherForm(EMPTY_VOUCHER)
    }
    setVoucherModal({ open: true, editing: v })
  }

  const saveVoucher = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSavingVoucher(true)
    try {
      const input: VoucherInput = {
        ...voucherForm,
        code: voucherForm.code.trim().toUpperCase(),
        discount_value: Number(voucherForm.discount_value),
        min_order_amount: Number(voucherForm.min_order_amount) || 0,
        max_discount: Number(voucherForm.max_discount) || 0,
        quota: Number(voucherForm.quota) || 0,
        expires_at: voucherForm.expires_at ? `${voucherForm.expires_at}T23:59:59Z` : null,
      }
      if (voucherModal.editing) {
        await voucherAdminApi.update(voucherModal.editing.id, input)
        flash('Voucher diperbarui')
      } else {
        await voucherAdminApi.create(input)
        flash('Voucher dibuat')
      }
      setVoucherModal({ open: false, editing: null })
      await fetchVouchers()
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal menyimpan voucher'))
    } finally {
      setSavingVoucher(false)
    }
  }

  const deleteVoucher = async (v: Voucher) => {
    if (!window.confirm(`Hapus voucher "${v.code}"?`)) return
    setBusyId(v.id)
    try {
      await voucherAdminApi.remove(v.id)
      flash('Voucher dihapus')
      await fetchVouchers()
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal menghapus voucher'))
    } finally {
      setBusyId(null)
    }
  }

  // ---------- Kategori ----------
  const openCategoryForm = (c: Category | null) => {
    setCategoryForm(c ? { name: c.name, description: c.description, image_url: c.image_url } : EMPTY_CATEGORY)
    setCategoryModal({ open: true, editing: c })
  }

  const saveCategory = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSavingCategory(true)
    try {
      if (categoryModal.editing) {
        await catalogApi.updateCategory(categoryModal.editing.id, categoryForm)
        flash('Kategori diperbarui')
      } else {
        await catalogApi.createCategory(categoryForm)
        flash('Kategori dibuat')
      }
      setCategoryModal({ open: false, editing: null })
      await fetchAll()
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal menyimpan kategori'))
    } finally {
      setSavingCategory(false)
    }
  }

  const deleteCategory = async (c: Category) => {
    if (!window.confirm(`Hapus kategori "${c.name}"? Produk di dalamnya bisa ikut bermasalah.`)) return
    setBusyId(c.id)
    try {
      await catalogApi.deleteCategory(c.id)
      flash('Kategori dihapus')
      await fetchAll()
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal menghapus kategori'))
    } finally {
      setBusyId(null)
    }
  }

  // ---------- Pesanan ----------
  const changeOrderStatus = async (orderId: string, status: OrderStatus) => {
    setBusyId(orderId)
    try {
      await orderApi.updateStatus(orderId, status)
      flash(`Status order diubah ke ${status}`)
      const res = await orderApi.listAll(1, 50)
      setOrders(res.orders)
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal mengubah status order'))
    } finally {
      setBusyId(null)
    }
  }

  const tabCls = (t: Tab) =>
    `btn btn-sm ${tab === t ? 'btn-primary' : 'btn-ghost'}`

  if (loading) return <Spinner label="Memuat panel admin..." />

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="title">Admin Panel</h1>
        {isSuperAdmin ? (
          <span className="border-2 border-black bg-black px-2 py-1 font-display text-sm font-black uppercase text-yolk shadow-[4px_4px_0px_0px_#000] dark:border-white">
            [ SUPERADMIN ]
          </span>
        ) : (
          <span className="border-2 border-black bg-yolk px-2 py-1 font-display text-sm font-black uppercase text-black shadow-[4px_4px_0px_0px_#000] dark:border-white">
            [ STORE ADMIN ]
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Kelola produk, kategori, dan pesanan SLARAS NUSA FOODLAB.
        {user && <> Masuk sebagai <span className="font-bold">{user.name}</span> ({user.email}).</>}
      </p>

      {error && (
        <p className="mt-4 border-2 border-red-500 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-4 border-2 border-green-600 bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-950 dark:text-green-300">
          {notice}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <button className={tabCls('profit')} onClick={() => setTab('profit')}>
          Dashboard Profit
        </button>
        <button className={tabCls('products')} onClick={() => setTab('products')}>
          Produk ({products.length})
        </button>
        <button className={tabCls('categories')} onClick={() => setTab('categories')}>
          Kategori ({categories.length})
        </button>
        <button className={tabCls('orders')} onClick={() => setTab('orders')}>
          Pesanan ({orders.length})
        </button>
        <button className={tabCls('vouchers')} onClick={() => setTab('vouchers')}>
          Kelola Voucher ({vouchers.length})
        </button>
        {isSuperAdmin && (
          <button className={tabCls('users')} onClick={() => setTab('users')}>
            Manajemen User &amp; Akses
          </button>
        )}
      </div>

      {tab === 'profit' && <ProfitDashboard />}

      {tab === 'users' && isSuperAdmin && <UserManagement />}

      {tab === 'products' && (
        <section className="mt-6">
          <button onClick={() => openProductForm(null)} className="btn btn-accent btn-sm">
            <Plus className="h-4 w-4" /> Tambah Produk
          </button>
          <div className="mt-4 flex flex-col gap-3">
            {products.map((p) => (
              <article key={p.id} className="card flex flex-wrap items-center gap-3 p-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden border-2 border-black dark:border-white">
                  <ProductImage src={p.image_url} name={p.name} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-black uppercase">{p.name}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {p.category?.name ?? '-'} • {p.sku} •{' '}
                    {p.is_active ? 'Aktif' : 'Nonaktif'}
                    {p.cost_price !== undefined && p.cost_price > 0 && (
                      <> • HPP {formatRupiah(p.cost_price)}</>
                    )}
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {(p.is_available ?? true) ? (
                      <span className="text-green-700 dark:text-green-400">[ TERSEDIA ]</span>
                    ) : (
                      <span className="text-red-600">[ HABIS HARI INI ]</span>
                    )}
                  </p>
                </div>
                <span className="font-display text-lg font-black">{formatRupiah(p.price)}</span>
                {/* Kontrol stok cepat +/- */}
                <span className="flex items-center border-2 border-black dark:border-white" title="Stok cepat">
                  <button
                    onClick={() => adjustStock(p, -1)}
                    disabled={busyId === p.id || p.stock <= 0}
                    className="px-2.5 py-1.5 font-display text-base font-black hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800"
                    aria-label={`Kurangi stok ${p.name}`}
                  >
                    −
                  </button>
                  <span className="w-10 text-center font-display text-sm font-black">Stok {p.stock}</span>
                  <button
                    onClick={() => adjustStock(p, 1)}
                    disabled={busyId === p.id}
                    className="px-2.5 py-1.5 font-display text-base font-black hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800"
                    aria-label={`Tambah stok ${p.name}`}
                  >
                    +
                  </button>
                </span>
                <button
                  onClick={() => toggleAvailability(p)}
                  disabled={busyId === p.id}
                  className={`btn btn-sm ${(p.is_available ?? true) ? 'btn-ghost' : 'btn-danger'}`}
                  title="Toggle Sold Out 1-klik"
                >
                  {(p.is_available ?? true) ? 'Tandai Habis' : 'Tandai Tersedia'}
                </button>
                <button onClick={() => openProductForm(p)} className="btn btn-ghost btn-sm">
                  <Pencil className="h-4 w-4" /> Ubah
                </button>
                <button
                  onClick={() => deleteProduct(p)}
                  disabled={busyId === p.id}
                  className="btn btn-danger btn-sm"
                >
                  <Trash2 className="h-4 w-4" /> Hapus
                </button>
              </article>
            ))}
            {products.length === 0 && <p className="card p-6 text-center">Belum ada produk.</p>}
          </div>
        </section>
      )}

      {tab === 'categories' && (
        <section className="mt-6">
          <button onClick={() => openCategoryForm(null)} className="btn btn-accent btn-sm">
            <Plus className="h-4 w-4" /> Tambah Kategori
          </button>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {categories.map((c) => (
              <article key={c.id} className="card p-4">
                <p className="font-display text-base font-black uppercase">{c.name}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  slug: {c.slug} • {c.description || 'tanpa deskripsi'}
                </p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => openCategoryForm(c)} className="btn btn-ghost btn-sm">
                    <Pencil className="h-4 w-4" /> Ubah
                  </button>
                  <button
                    onClick={() => deleteCategory(c)}
                    disabled={busyId === c.id}
                    className="btn btn-danger btn-sm"
                  >
                    <Trash2 className="h-4 w-4" /> Hapus
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'orders' && (
        <section className="mt-6 flex flex-col gap-3">
          {orders.map((o) => (
            <article key={o.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    to={`/orders/${o.id}`}
                    className="font-display text-base font-black uppercase hover:underline"
                  >
                    {o.order_number}
                  </Link>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {formatDate(o.created_at)} • {o.shipping_name} • {o.payment_method.toUpperCase()} •{' '}
                    {o.items.length} item
                  </p>
                  {o.processed_by_name && (
                    <p className="mt-1 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      Diproses oleh: {o.processed_by_name}
                    </p>
                  )}
                </div>
                <StatusBadge status={o.status} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="font-display font-black">{formatRupiah(o.total)}</span>
                {NEXT_STATUS[o.status].length > 0 ? (
                  <select
                    className="input !w-auto !py-1.5 text-sm"
                    value=""
                    disabled={busyId === o.id}
                    onChange={(e) => {
                      if (e.target.value) changeOrderStatus(o.id, e.target.value as OrderStatus)
                    }}
                  >
                    <option value="">Ubah status...</option>
                    {NEXT_STATUS[o.status].map((s) => (
                      <option key={s} value={s}>
                        → {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-zinc-500">Tidak ada transisi status lagi</span>
                )}
              </div>
            </article>
          ))}
          {orders.length === 0 && <p className="card p-6 text-center">Belum ada pesanan masuk.</p>}
        </section>
      )}

      {tab === 'vouchers' && (
        <section className="mt-6">
          <button onClick={() => openVoucherForm(null)} className="btn btn-accent btn-sm">
            <Plus className="h-4 w-4" /> Buat Voucher
          </button>
          <div className="mt-4 flex flex-col gap-3">
            {vouchers.map((v) => (
              <article key={v.id} className="card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-black uppercase">{v.code}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {v.discount_type === 'percentage'
                      ? `Diskon ${v.discount_value}%`
                      : `Potongan ${formatRupiah(v.discount_value)}`}
                    {v.max_discount > 0 && ` • maks ${formatRupiah(v.max_discount)}`}
                    {v.min_order_amount > 0 && ` • min belanja ${formatRupiah(v.min_order_amount)}`}
                    {` • dipakai ${v.used_count}/${v.quota > 0 ? v.quota : '∞'}`}
                    {v.expires_at ? ` • s.d. ${String(v.expires_at).slice(0, 10)}` : ''}
                  </p>
                </div>
                <span
                  className={`chip ${v.is_active ? 'bg-yolk !text-black' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                >
                  {v.is_active ? 'AKTIF' : 'NONAKTIF'}
                </span>
                <button onClick={() => openVoucherForm(v)} className="btn btn-ghost btn-sm">
                  <Pencil className="h-4 w-4" /> Ubah
                </button>
                <button
                  onClick={() => deleteVoucher(v)}
                  disabled={busyId === v.id}
                  className="btn btn-danger btn-sm"
                >
                  <Trash2 className="h-4 w-4" /> Hapus
                </button>
              </article>
            ))}
            {vouchers.length === 0 && (
              <p className="card p-6 text-center">
                Belum ada voucher. Buat kode promo pertama, mis. SLARASHEMAT (20%, maks Rp15.000).
              </p>
            )}
          </div>
        </section>
      )}

      {/* Modal form produk */}
      <Modal
        open={productModal.open}
        onClose={() => setProductModal({ open: false, editing: null })}
        title={productModal.editing ? 'Ubah Produk' : 'Tambah Produk'}
      >
        <form onSubmit={saveProduct} className="flex flex-col gap-3">
          <div>
            <label className="label">Kategori</label>
            <select
              className="input"
              value={productForm.category_id}
              onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
              required
            >
              <option value="">— Pilih kategori —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Nama Produk</label>
            <input
              className="input"
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              required
              minLength={2}
              maxLength={150}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Harga (Rp)</label>
              <input
                className="input"
                type="number"
                min={0}
                value={productForm.price}
                onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <label className="label">Stok</label>
              <input
                className="input"
                type="number"
                min={0}
                value={productForm.stock}
                onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })}
                required
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="product-cost-price">
              Harga Modal / HPP (Rp)
            </label>
            <input
              id="product-cost-price"
              className="input"
              type="number"
              min={0}
              placeholder="Kosong = 60% dari harga jual"
              value={productForm.cost_price ?? ''}
              onChange={(e) =>
                setProductForm({
                  ...productForm,
                  cost_price: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
            <p className="mt-1 text-xs text-zinc-500">
              Dipakai menghitung laba di Dashboard Profit. Kosong saat tambah produk = otomatis 60%
              dari harga; kosong saat ubah = HPP lama dipertahankan.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">SKU</label>
              <input
                className="input"
                value={productForm.sku}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                required
                maxLength={50}
              />
            </div>
            <div>
              <label className="label">Berat (gram)</label>
              <input
                className="input"
                type="number"
                min={0}
                value={productForm.weight_gram}
                onChange={(e) => setProductForm({ ...productForm, weight_gram: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <label className="label">Deskripsi</label>
            <textarea
              className="input"
              rows={2}
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
            />
          </div>
          <div>
            <label className="label">URL Gambar</label>
            <input
              className="input"
              placeholder="https://... (kosong = tile kategori)"
              value={productForm.image_url}
              onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
            />
            <label className="btn btn-outline mt-2 w-full cursor-pointer">
              {uploadingImage ? 'Mengunggah...' : 'UPLOAD FOTO DARI PERANGKAT'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploadingImage}
                onChange={handleUploadImage}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="h-4 w-4 accent-black"
              checked={productForm.is_active}
              onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
            />
            Produk aktif (tampil di katalog)
          </label>
          <button type="submit" disabled={savingProduct} className="btn btn-accent w-full">
            {savingProduct ? 'Menyimpan...' : productModal.editing ? 'Simpan Perubahan' : 'Buat Produk'}
          </button>
        </form>
      </Modal>

      {/* Modal form voucher */}
      <Modal
        open={voucherModal.open}
        onClose={() => setVoucherModal({ open: false, editing: null })}
        title={voucherModal.editing ? 'Ubah Voucher' : 'Buat Voucher'}
      >
        <form onSubmit={saveVoucher} className="flex flex-col gap-3">
          <div>
            <label className="label">Kode Voucher</label>
            <input
              className="input uppercase"
              placeholder="Contoh: SLARASHEMAT"
              value={voucherForm.code}
              onChange={(e) => setVoucherForm({ ...voucherForm, code: e.target.value.toUpperCase() })}
              required
              maxLength={30}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Jenis Diskon</label>
              <select
                className="input"
                value={voucherForm.discount_type}
                onChange={(e) =>
                  setVoucherForm({
                    ...voucherForm,
                    discount_type: e.target.value as 'percentage' | 'fixed',
                  })
                }
              >
                <option value="percentage">Persentase (%)</option>
                <option value="fixed">Potongan tetap (Rp)</option>
              </select>
            </div>
            <div>
              <label className="label">
                Nilai Diskon {voucherForm.discount_type === 'percentage' ? '(%)' : '(Rp)'}
              </label>
              <input
                className="input"
                type="number"
                min={0}
                value={voucherForm.discount_value}
                onChange={(e) =>
                  setVoucherForm({ ...voucherForm, discount_value: Number(e.target.value) })
                }
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Min. Belanja (Rp)</label>
              <input
                className="input"
                type="number"
                min={0}
                value={voucherForm.min_order_amount}
                onChange={(e) =>
                  setVoucherForm({ ...voucherForm, min_order_amount: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <label className="label">Maks. Diskon (Rp, 0 = tanpa batas)</label>
              <input
                className="input"
                type="number"
                min={0}
                value={voucherForm.max_discount}
                onChange={(e) =>
                  setVoucherForm({ ...voucherForm, max_discount: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Kuota (0 = tanpa batas)</label>
              <input
                className="input"
                type="number"
                min={0}
                value={voucherForm.quota}
                onChange={(e) => setVoucherForm({ ...voucherForm, quota: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Berlaku s.d. (opsional)</label>
              <input
                className="input"
                type="date"
                value={voucherForm.expires_at ? String(voucherForm.expires_at).slice(0, 10) : ''}
                onChange={(e) =>
                  setVoucherForm({ ...voucherForm, expires_at: e.target.value || null })
                }
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="h-4 w-4 accent-black"
              checked={voucherForm.is_active}
              onChange={(e) => setVoucherForm({ ...voucherForm, is_active: e.target.checked })}
            />
            Voucher aktif
          </label>
          <button type="submit" disabled={savingVoucher} className="btn btn-accent w-full">
            {savingVoucher ? 'Menyimpan...' : voucherModal.editing ? 'Simpan Perubahan' : 'Buat Voucher'}
          </button>
        </form>
      </Modal>

      {/* Modal form kategori */}
      <Modal
        open={categoryModal.open}
        onClose={() => setCategoryModal({ open: false, editing: null })}
        title={categoryModal.editing ? 'Ubah Kategori' : 'Tambah Kategori'}
      >
        <form onSubmit={saveCategory} className="flex flex-col gap-3">
          <div>
            <label className="label">Nama Kategori</label>
            <input
              className="input"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              required
              minLength={2}
              maxLength={100}
            />
          </div>
          <div>
            <label className="label">Deskripsi</label>
            <textarea
              className="input"
              rows={2}
              value={categoryForm.description}
              onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
            />
          </div>
          <div>
            <label className="label">URL Gambar</label>
            <input
              className="input"
              value={categoryForm.image_url}
              onChange={(e) => setCategoryForm({ ...categoryForm, image_url: e.target.value })}
            />
          </div>
          <button type="submit" disabled={savingCategory} className="btn btn-accent w-full">
            {savingCategory ? 'Menyimpan...' : 'Simpan Kategori'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
