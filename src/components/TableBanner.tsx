import { useEffect, useState } from 'react'
import { MapPin, Pencil, X } from 'lucide-react'
import { clearTable, getSavedTable, saveTable, tableLabel } from '../utils/table'

export const TABLE_CHANGED_EVENT = 'slaras:table-changed'

/** Beri tahu TableBanner (dan halaman lain) bahwa meja berubah. */
export function notifyTableChanged(): void {
  window.dispatchEvent(new Event(TABLE_CHANGED_EVENT))
}

/**
 * Banner mode dine-in dari QR meja (?table=XX). Tampil di atas semua halaman
 * selama nomor meja tersimpan di localStorage. Tombol ubah meja membuka
 * editor inline; "Keluar" menghapus meja tersimpan.
 */
export default function TableBanner() {
  const [table, setTable] = useState<string | null>(() => getSavedTable())
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')

  // Meja bisa disimpan halaman lain (mis. Home saat membaca ?table=XX) —
  // dengarkan event perubahan agar banner muncul tanpa reload.
  useEffect(() => {
    const sync = () => setTable(getSavedTable())
    window.addEventListener(TABLE_CHANGED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(TABLE_CHANGED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const current = table
  if (!current) return null

  const applyTable = () => {
    const digits = input.replace(/\D/g, '')
    if (!digits) return
    const normalized = String(Number(digits)).padStart(2, '0')
    saveTable(normalized)
    setTable(normalized)
    notifyTableChanged()
    setEditing(false)
    setInput('')
  }

  return (
    <div
      data-testid="table-banner"
      className="border-b-4 border-black bg-yolk text-black dark:border-white"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 px-4 py-2 text-center">
        <span className="flex items-center gap-2 font-display text-sm font-black uppercase sm:text-base">
          <MapPin className="h-5 w-5" strokeWidth={2.5} />
          [ 📍 MODE DINE-IN — {tableLabel(current).toUpperCase()} ]
        </span>
        {editing ? (
          <span className="flex items-center gap-2">
            <input
              className="w-20 border-2 border-black bg-white px-2 py-1 text-sm font-bold text-black"
              inputMode="numeric"
              placeholder="05"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyTable()}
              aria-label="Nomor meja baru"
              autoFocus
            />
            <button onClick={applyTable} className="border-2 border-black bg-black px-2 py-1 font-display text-xs font-black uppercase text-white">
              Simpan
            </button>
            <button onClick={() => setEditing(false)} className="border-2 border-black bg-white px-2 py-1 font-display text-xs font-black uppercase">
              Batal
            </button>
          </span>
        ) : (
          <>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 border-2 border-black bg-white px-2 py-1 font-display text-xs font-black uppercase hover:bg-zinc-100"
            >
              <Pencil className="h-3 w-3" /> Ubah Meja
            </button>
            <button
              onClick={() => {
                clearTable()
                setTable(null)
                notifyTableChanged()
              }}
              className="flex items-center gap-1 border-2 border-black bg-white px-2 py-1 font-display text-xs font-black uppercase hover:bg-zinc-100"
              aria-label="Keluar dari mode dine-in"
            >
              <X className="h-3 w-3" /> Keluar
            </button>
          </>
        )}
      </div>
    </div>
  )
}
