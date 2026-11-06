import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { superadminApi } from '../api/endpoints'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { CreateUserInput, User, UserRole, UserStats } from '../api/types'
import { formatDate } from '../utils/format'
import { Modal, Spinner } from '../components/ProtectedRoute'

const ROLE_LABEL: Record<UserRole, string> = {
  customer: 'Customer',
  admin: 'Admin Toko',
  superadmin: 'Superadmin',
}

const ROLE_BADGE: Record<UserRole, string> = {
  customer: 'bg-white text-black',
  admin: 'bg-yolk text-black',
  superadmin: 'bg-black text-yolk',
}

const EMPTY_FORM: CreateUserInput = {
  name: '',
  email: '',
  password: '',
  phone: '',
  role: 'admin',
}

export default function UserManagement() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<CreateUserInput>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Debounce pencarian 400ms.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 400)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, st] = await Promise.all([
        superadminApi.listUsers({
          page,
          per_page: 10,
          search: search || undefined,
          role: roleFilter || undefined,
          is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
        }),
        superadminApi.getStats(),
      ])
      setUsers(list.users)
      setTotalPages(list.meta.total_pages)
      setTotal(list.meta.total)
      setStats(st)
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal memuat daftar user'))
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter, statusFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const flash = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(''), 4000)
  }

  const createUser = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await superadminApi.createUser({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone?.trim() || undefined,
      })
      flash(`User ${form.email} dibuat`)
      setCreateOpen(false)
      setForm(EMPTY_FORM)
      setPage(1)
      await fetchUsers()
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal membuat user'))
    } finally {
      setSaving(false)
    }
  }

  const changeRole = async (u: User, role: UserRole) => {
    if (role === u.role) return
    setError('')
    setBusyId(u.id)
    try {
      await superadminApi.updateRole(u.id, role)
      flash(`Role ${u.email} diubah ke ${ROLE_LABEL[role]}`)
      await fetchUsers()
    } catch (err) {
      // Termasuk 403 saat superadmin mencoba menurunkan role dirinya sendiri.
      setError(apiErrorMessage(err, 'Gagal mengubah role'))
    } finally {
      setBusyId(null)
    }
  }

  const toggleStatus = async (u: User) => {
    const next = !u.is_active
    if (!next && !window.confirm(`Suspend akun "${u.name}" (${u.email})? User tidak bisa login lagi.`)) return
    setError('')
    setBusyId(u.id)
    try {
      await superadminApi.updateStatus(u.id, next)
      flash(next ? `Akun ${u.email} diaktifkan` : `Akun ${u.email} di-suspend`)
      await fetchUsers()
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal mengubah status akun'))
    } finally {
      setBusyId(null)
    }
  }

  const deleteUser = async (u: User) => {
    if (!window.confirm(`Hapus akun "${u.name}" (${u.email})? Tindakan ini tidak bisa dibatalkan.`)) return
    setError('')
    setBusyId(u.id)
    try {
      await superadminApi.deleteUser(u.id)
      flash(`Akun ${u.email} dihapus`)
      await fetchUsers()
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal menghapus user'))
    } finally {
      setBusyId(null)
    }
  }

  const statCards: { label: string; value: number; cls: string }[] = [
    { label: 'Total Pengguna', value: stats?.total ?? 0, cls: 'bg-yolk' },
    { label: 'Admin Toko', value: stats?.admin ?? 0, cls: 'bg-white' },
    { label: 'Superadmin', value: stats?.superadmin ?? 0, cls: 'bg-black text-yolk' },
    { label: 'Akun Nonaktif', value: stats?.inactive ?? 0, cls: 'bg-red-500 text-white' },
  ]

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-black uppercase">Manajemen User &amp; Akses</h2>
        <button onClick={() => setCreateOpen(true)} className="btn btn-accent btn-sm">
          <Plus className="h-4 w-4" /> Tambah User / Admin Baru
        </button>
      </div>

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

      {/* Kartu ringkasan */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((s) => (
          <article
            key={s.label}
            className={`border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000] dark:border-white dark:shadow-[4px_4px_0px_0px_#fff] ${s.cls}`}
          >
            <p className="font-display text-3xl font-black">{s.value}</p>
            <p className="font-display text-xs font-black uppercase tracking-wider">{s.label}</p>
          </article>
        ))}
      </div>

      {/* Filter */}
      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            className="input !pl-9"
            placeholder="Cari nama / email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Cari user"
          />
        </div>
        <select
          className="input !w-auto"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value as UserRole | '')
            setPage(1)
          }}
          aria-label="Filter role"
        >
          <option value="">Semua Role</option>
          <option value="customer">Customer</option>
          <option value="admin">Admin Toko</option>
          <option value="superadmin">Superadmin</option>
        </select>
        <select
          className="input !w-auto"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
            setPage(1)
          }}
          aria-label="Filter status"
        >
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
      </div>

      {loading ? (
        <Spinner label="Memuat daftar user..." />
      ) : (
        <>
          <div className="mt-4 overflow-x-auto border-4 border-black bg-white shadow-[4px_4px_0px_0px_#000] dark:border-white dark:bg-coal dark:shadow-[4px_4px_0px_0px_#fff]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b-4 border-black bg-yolk text-black dark:border-white">
                  <th className="p-3 font-display font-black uppercase">Nama</th>
                  <th className="p-3 font-display font-black uppercase">Email</th>
                  <th className="p-3 font-display font-black uppercase">Role</th>
                  <th className="p-3 font-display font-black uppercase">Status</th>
                  <th className="p-3 font-display font-black uppercase">Dibuat</th>
                  <th className="p-3 font-display font-black uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b-2 border-zinc-200 dark:border-zinc-700">
                    <td className="p-3 font-bold">
                      {u.name}
                      {me?.id === u.id && (
                        <span className="ml-2 border-2 border-black bg-black px-1 text-[10px] font-black uppercase text-yolk">
                          Anda
                        </span>
                      )}
                    </td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">
                      <span
                        className={`border-2 border-black px-2 py-0.5 font-display text-xs font-black uppercase ${ROLE_BADGE[u.role]}`}
                      >
                        {ROLE_LABEL[u.role]}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`border-2 border-black px-2 py-0.5 font-display text-xs font-black uppercase ${
                          u.is_active ? 'bg-green-400 text-black' : 'bg-red-500 text-white'
                        }`}
                      >
                        {u.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="p-3 text-zinc-600 dark:text-zinc-400">{formatDate(u.created_at)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className="input !w-auto !py-1 !text-xs"
                          value={u.role}
                          disabled={busyId === u.id}
                          onChange={(e) => changeRole(u, e.target.value as UserRole)}
                          aria-label={`Ubah role ${u.email}`}
                        >
                          <option value="customer">Customer</option>
                          <option value="admin">Admin Toko</option>
                          <option value="superadmin">Superadmin</option>
                        </select>
                        <button
                          onClick={() => toggleStatus(u)}
                          disabled={busyId === u.id}
                          className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-accent'}`}
                        >
                          {u.is_active ? 'Suspend' : 'Aktifkan'}
                        </button>
                        <button
                          onClick={() => deleteUser(u)}
                          disabled={busyId === u.id}
                          className="btn btn-danger btn-sm"
                          aria-label={`Hapus ${u.email}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center font-semibold text-zinc-500">
                      Tidak ada user yang cocok dengan filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginasi */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">
              Total {total} user • Halaman {page} dari {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Sebelumnya
              </button>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Berikutnya →
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal tambah user */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tambah User / Admin Baru">
        <form onSubmit={createUser} className="flex flex-col gap-3">
          <div>
            <label className="label" htmlFor="new-user-name">
              Nama Lengkap
            </label>
            <input
              id="new-user-name"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              minLength={2}
              maxLength={100}
            />
          </div>
          <div>
            <label className="label" htmlFor="new-user-email">
              Email
            </label>
            <input
              id="new-user-email"
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="new-user-password">
              Kata Sandi
            </label>
            <input
              id="new-user-password"
              type="password"
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="label" htmlFor="new-user-phone">
              Telepon (opsional)
            </label>
            <input
              id="new-user-phone"
              className="input"
              value={form.phone ?? ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="new-user-role">
              Role
            </label>
            <select
              id="new-user-role"
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            >
              <option value="customer">Customer</option>
              <option value="admin">Admin Toko</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>
          <button type="submit" disabled={saving} className="btn btn-accent w-full">
            {saving ? 'Membuat...' : 'Buat User'}
          </button>
        </form>
      </Modal>
    </section>
  )
}
