import { useEffect, useRef, useState } from 'react'
import { TicketPercent } from 'lucide-react'
import { voucherApi } from '../api/endpoints'
import { apiErrorMessage } from '../api/client'
import { formatRupiah } from '../utils/format'
import type { VoucherValidation } from '../api/types'

export const VOUCHER_SUGGESTIONS = ['SLARASHEMAT', 'KOPIPAGI', 'FOODLAB50']
export const VOUCHER_CODE_KEY = 'slaras_voucher_code'

export function saveVoucherCode(code: string): void {
  try {
    localStorage.setItem(VOUCHER_CODE_KEY, code)
  } catch {
    // abaikan
  }
}

export function loadVoucherCode(): string {
  try {
    return localStorage.getItem(VOUCHER_CODE_KEY) ?? ''
  } catch {
    return ''
  }
}

interface Props {
  subtotal: number
  /** Voucher yang sedang aktif (null = belum ada). */
  applied: VoucherValidation | null
  onApplied: (v: VoucherValidation | null) => void
  /** Bila true, kode tersimpan juga ke localStorage agar Checkout membacanya. */
  persistCode?: boolean
  /** Kode awal (mis. dari Floating Cart) yang langsung divalidasi sekali. */
  initialCode?: string
}

/**
 * Input kode promo + tombol PAKAI + chip rekomendasi. Memanggil
 * POST /vouchers/validate dan melaporkan hasil lewat onApplied.
 */
export default function VoucherBox({ subtotal, applied, onApplied, persistCode, initialCode }: Props) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const autoAppliedRef = useRef(false)

  // Kode dari Floating Cart langsung divalidasi sekali saat Checkout dibuka.
  useEffect(() => {
    if (!initialCode || autoAppliedRef.current) return
    autoAppliedRef.current = true
    setCode(initialCode)
    void apply(initialCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode])

  const apply = async (rawCode: string) => {
    const clean = rawCode.trim().toUpperCase()
    if (!clean) {
      setError('Masukkan kode voucher dulu')
      return
    }
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const result = await voucherApi.validate(clean, subtotal)
      if (!result.valid) {
        setError(result.message || 'Voucher tidak valid')
        onApplied(null)
        return
      }
      const appliedVoucher: VoucherValidation = {
        valid: true,
        discount_amount: result.discount_amount,
        message: result.message || 'Voucher dipakai',
        code: clean,
      }
      onApplied(appliedVoucher)
      setNotice(`Voucher ${clean} dipakai — hemat ${formatRupiah(result.discount_amount)}`)
      if (persistCode) saveVoucherCode(clean)
    } catch (err) {
      setError(apiErrorMessage(err, 'Voucher tidak valid'))
      onApplied(null)
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    onApplied(null)
    setCode('')
    setNotice('')
    setError('')
    if (persistCode) {
      try {
        localStorage.removeItem(VOUCHER_CODE_KEY)
      } catch {
        // abaikan
      }
    }
  }

  return (
    <div data-testid="voucher-box" className="border-2 border-dashed border-zinc-400 p-3">
      <p className="flex items-center gap-2 font-display text-xs font-black uppercase">
        <TicketPercent className="h-4 w-4" /> Kode Promo / Voucher
      </p>
      {applied ? (
        <div className="mt-3">
          <p className="border-2 border-black bg-yolk px-3 py-2 text-sm font-bold text-black" data-testid="voucher-applied">
            ✓ {applied.code} — potongan {formatRupiah(applied.discount_amount)}
          </p>
          <button type="button" onClick={remove} className="btn btn-ghost btn-sm mt-2">
            Hapus Voucher
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            <input
              className="input !py-2 uppercase"
              placeholder="Contoh: SLARASHEMAT"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), apply(code))}
              aria-label="Kode Promo / Voucher"
            />
            <button
              type="button"
              onClick={() => apply(code)}
              disabled={busy}
              className="btn btn-accent btn-sm shrink-0"
            >
              {busy ? '...' : '[ PAKAI ]'}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {VOUCHER_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setCode(s)
                  apply(s)
                }}
                className="chip cursor-pointer bg-bone hover:bg-yolk dark:bg-carbon dark:hover:bg-yolk dark:hover:text-black"
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}
      {error && (
        <p className="mt-2 text-xs font-semibold text-red-600" data-testid="voucher-error">
          {error}
        </p>
      )}
      {notice && <p className="mt-2 text-xs font-semibold text-green-700 dark:text-green-400">{notice}</p>}
    </div>
  )
}
