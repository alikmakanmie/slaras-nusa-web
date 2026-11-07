import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { queueApi } from '../api/endpoints'
import type { QueueItem, QueueResponse } from '../api/types'
import { orderTypeLabel } from '../utils/format'
import { Spinner } from '../components/ProtectedRoute'

const EMPTY: QueueResponse = { preparing: [], ready: [] }

function QueueCard({ item, ready }: { item: QueueItem; ready?: boolean }) {
  return (
    <article
      data-testid={ready ? 'queue-ready-item' : 'queue-preparing-item'}
      className={`border-4 p-4 sm:p-5 ${
        ready
          ? 'border-black bg-yolk text-black shadow-[6px_6px_0px_0px_#fff]'
          : 'border-white bg-white text-black shadow-[6px_6px_0px_0px_rgba(255,255,255,0.35)]'
      }`}
    >
      <p className="font-display text-2xl font-black uppercase leading-none sm:text-3xl">
        {item.order_number}
      </p>
      <p className="mt-2 truncate font-display text-lg font-black uppercase sm:text-xl">
        {item.customer_name}
      </p>
      <p className="mt-1 text-sm font-bold sm:text-base">
        {item.table_number
          ? `📍 ${item.table_number}`
          : item.order_type
            ? orderTypeLabel(item.order_type)
            : 'Takeaway'}
      </p>
    </article>
  )
}

/**
 * Layar TV antrean publik — fullscreen hitam-putih BoldKit, auto-refresh
 * tiap 5 detik dari GET /orders/queue.
 */
export default function Queue() {
  const [data, setData] = useState<QueueResponse>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const fetchQueue = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await queueApi.get()
      setData(res)
      setError('')
      setUpdatedAt(new Date())
    } catch {
      if (!silent) setError('Gagal memuat antrean')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
    const t = window.setInterval(() => fetchQueue(true), 5000)
    return () => window.clearInterval(t)
  }, [fetchQueue])

  return (
    <div className="min-h-screen bg-black text-white" data-testid="queue-page">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b-4 border-white pb-4">
          <div>
            <h1 className="font-display text-3xl font-black uppercase leading-none sm:text-5xl">
              Antrean Pesanan
            </h1>
            <p className="mt-2 text-sm font-bold text-zinc-300 sm:text-base">
              SLARAS NUSA FOODLAB • Diperbarui otomatis tiap 5 detik
              {updatedAt && <> • {updatedAt.toLocaleTimeString('id-ID')}</>}
            </p>
          </div>
          <Link
            to="/"
            className="border-2 border-white bg-white px-4 py-2 font-display text-xs font-black uppercase text-black shadow-[4px_4px_0px_0px_#fff]"
          >
            ← Kembali ke Menu
          </Link>
        </header>

        {loading ? (
          <div className="py-16 text-white">
            <Spinner label="Memuat antrean..." />
          </div>
        ) : error ? (
          <div className="mt-8 border-4 border-white p-8 text-center">
            <p className="font-display text-2xl font-black uppercase">{error}</p>
            <button
              onClick={() => fetchQueue()}
              className="mt-4 border-2 border-white bg-white px-4 py-2 font-display text-sm font-black uppercase text-black"
            >
              Coba Lagi
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section data-testid="queue-preparing">
              <h2 className="border-4 border-white bg-white px-4 py-3 font-display text-xl font-black uppercase text-black shadow-[6px_6px_0px_0px_rgba(255,255,255,0.35)] sm:text-2xl">
                [ 🔥 SEDANG DISIAPKAN (KITCHEN/BAR) ]
              </h2>
              <div className="mt-4 flex flex-col gap-4">
                {data.preparing.length === 0 && (
                  <p className="border-2 border-dashed border-white p-6 text-center font-display text-lg font-black uppercase text-zinc-400">
                    Belum ada pesanan disiapkan
                  </p>
                )}
                {data.preparing.map((item) => (
                  <QueueCard key={item.order_number} item={item} />
                ))}
              </div>
            </section>

            <section data-testid="queue-ready">
              <h2 className="border-4 border-yolk bg-yolk px-4 py-3 font-display text-xl font-black uppercase text-black shadow-[6px_6px_0px_0px_#fff] sm:text-2xl">
                [ ✅ SIAP DINIKMATI / DIAMBIL ]
              </h2>
              <div className="mt-4 flex flex-col gap-4">
                {data.ready.length === 0 && (
                  <p className="border-2 border-dashed border-white p-6 text-center font-display text-lg font-black uppercase text-zinc-400">
                    Belum ada pesanan siap
                  </p>
                )}
                {data.ready.map((item) => (
                  <QueueCard key={item.order_number} item={item} ready />
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
