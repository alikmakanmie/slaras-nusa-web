import type { Product } from '../api/types'

export interface ModifierOption {
  name: string
  price_delta: number
  cost_delta: number
}

export interface ModifierGroup {
  name: string
  type: 'single' | 'multi'
  options: ModifierOption[]
}

export interface SelectedModifier {
  name: string
  price_delta: number
  cost_delta: number
}

/** Opsi bawaan bila produk tidak punya modifiers_json dari backend. */
export const DEFAULT_MODIFIER_GROUPS: ModifierGroup[] = [
  {
    name: 'Temperature',
    type: 'single',
    options: [
      { name: 'Iced', price_delta: 0, cost_delta: 0 },
      { name: 'Hot', price_delta: 0, cost_delta: 0 },
    ],
  },
  {
    name: 'Sugar Level',
    type: 'single',
    options: [
      { name: 'Normal Sugar', price_delta: 0, cost_delta: 0 },
      { name: 'Less Sugar', price_delta: 0, cost_delta: 0 },
      { name: 'No Sugar', price_delta: 0, cost_delta: 0 },
    ],
  },
  {
    name: 'Ice Level',
    type: 'single',
    options: [
      { name: 'Normal Ice', price_delta: 0, cost_delta: 0 },
      { name: 'Less Ice', price_delta: 0, cost_delta: 0 },
    ],
  },
  {
    name: 'Add-Ons',
    type: 'multi',
    options: [
      { name: 'Extra Espresso Shot', price_delta: 5000, cost_delta: 2500 },
      { name: 'Upgrade Oat Milk', price_delta: 8000, cost_delta: 4500 },
      { name: 'Extra Cheese / Sambal', price_delta: 4000, cost_delta: 2000 },
    ],
  },
]

/** Parse modifiers_json produk (string JSON / objek / kosong) -> grup opsi. */
export function parseModifiers(product: Product): ModifierGroup[] {
  const raw = product.modifiers_json
  if (!raw) return DEFAULT_MODIFIER_GROUPS
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const groups = (parsed?.groups ?? []) as ModifierGroup[]
    if (!Array.isArray(groups) || groups.length === 0) return DEFAULT_MODIFIER_GROUPS
    return groups
      .filter((g) => g && Array.isArray(g.options) && g.options.length > 0)
      .map((g) => ({
        name: g.name,
        type: g.type === 'multi' ? 'multi' : 'single',
        options: g.options.map((o) => ({
          name: o.name,
          price_delta: Number(o.price_delta) || 0,
          cost_delta: Number(o.cost_delta) || 0,
        })),
      }))
  } catch {
    return DEFAULT_MODIFIER_GROUPS
  }
}

/** Kunci unik baris keranjang: product_id + kombinasi modifier terurut. */
export function cartLineKey(productId: string, selected: SelectedModifier[]): string {
  if (selected.length === 0) return productId
  return `${productId}|${[...selected].map((m) => m.name).sort().join('+')}`
}

/** Ringkasan teks modifier, mis. "Iced, Less Sugar, +Extra Espresso Shot". */
export function modifiersSummary(selected: SelectedModifier[]): string {
  return selected.map((m) => m.name).join(', ')
}

export function modifiersPriceDelta(selected: SelectedModifier[]): number {
  return selected.reduce((s, m) => s + (m.price_delta || 0), 0)
}

/** Apakah produk bisa dipesan (tidak sold out & stok ada). */
export function isProductAvailable(product: Product): boolean {
  if (product.is_available === false) return false
  return product.stock > 0
}
