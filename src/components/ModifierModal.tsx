import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { Product } from '../api/types'
import { formatRupiah } from '../utils/format'
import {
  modifiersPriceDelta,
  parseModifiers,
  type ModifierGroup,
  type SelectedModifier,
} from '../utils/modifiers'
import { Modal } from './ProtectedRoute'

interface Props {
  product: Product
  open: boolean
  onClose: () => void
  /** Dipanggil saat pelanggan menekan "Tambah ke Keranjang" di modal. */
  onConfirm: (selected: SelectedModifier[]) => void
}

function optionLabel(priceDelta: number): string {
  return priceDelta > 0 ? `+${formatRupiah(priceDelta)}` : 'Gratis'
}

export default function ModifierModal({ product, open, onClose, onConfirm }: Props) {
  const groups: ModifierGroup[] = useMemo(() => parseModifiers(product), [product])
  // Default: opsi pertama tiap grup single; multi kosong.
  const [selected, setSelected] = useState<Record<string, string[]>>({})

  // Reset pilihan saat modal dibuka / produk berganti: opsi pertama tiap
  // grup single terpilih, grup multi kosong.
  useEffect(() => {
    if (!open) return
    const init: Record<string, string[]> = {}
    for (const g of groups) {
      init[g.name] = g.type === 'single' && g.options.length > 0 ? [g.options[0].name] : []
    }
    setSelected(init)
  }, [open, groups])

  const toggleOption = (group: ModifierGroup, optionName: string) => {
    setSelected((prev) => {
      const current = prev[group.name] ?? []
      if (group.type === 'single') return { ...prev, [group.name]: [optionName] }
      const next = current.includes(optionName)
        ? current.filter((n) => n !== optionName)
        : [...current, optionName]
      return { ...prev, [group.name]: next }
    })
  }

  const selectedModifiers: SelectedModifier[] = groups.flatMap((g) =>
    (selected[g.name] ?? []).flatMap((name) => {
      const opt = g.options.find((o) => o.name === name)
      return opt ? [{ name: opt.name, price_delta: opt.price_delta, cost_delta: opt.cost_delta }] : []
    }),
  )
  const delta = modifiersPriceDelta(selectedModifiers)
  const totalPrice = product.price + delta

  return (
    <Modal open={open} onClose={onClose} title={`Kustomisasi — ${product.name}`}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Harga dasar {formatRupiah(product.price)}
          {delta > 0 && <> + add-on {formatRupiah(delta)}</>}
        </p>
        {groups.map((g) => (
          <fieldset key={g.name}>
            <legend className="label">{g.name}</legend>
            <div className="flex flex-wrap gap-2">
              {g.options.map((opt) => {
                const active = (selected[g.name] ?? []).includes(opt.name)
                return (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => toggleOption(g, opt.name)}
                    aria-pressed={active}
                    className={`border-2 px-3 py-2 font-display text-xs font-black uppercase transition-all ${
                      active
                        ? 'border-black bg-yolk text-black shadow-[3px_3px_0px_0px_#000] dark:border-white dark:shadow-[3px_3px_0px_0px_#fff]'
                        : 'border-zinc-300 hover:border-black dark:border-zinc-700 dark:hover:border-white'
                    }`}
                  >
                    {opt.name}
                    <span className="ml-1 normal-case">{optionLabel(opt.price_delta)}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        ))}
        <div className="flex items-center justify-between border-t-2 border-black pt-3 dark:border-white">
          <span className="font-display text-sm font-black uppercase">Total per porsi</span>
          <span className="font-display text-lg font-black">{formatRupiah(totalPrice)}</span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
            <X className="h-4 w-4" /> Batal
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(selectedModifiers)
              onClose()
            }}
            className="btn btn-accent flex-1"
          >
            + Tambah • {formatRupiah(totalPrice)}
          </button>
        </div>
      </div>
    </Modal>
  )
}
