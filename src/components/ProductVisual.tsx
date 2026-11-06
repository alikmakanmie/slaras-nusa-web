import { Coffee, Cookie, Croissant, CupSoda, Gift, Package, ShoppingBag, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import type { Product } from '../api/types'
import ProductImage from './ProductImage'

const CATEGORY_STYLE: Record<string, { icon: LucideIcon; bg: string; label: string }> = {
  'makanan-utama': { icon: UtensilsCrossed, bg: 'bg-yolk', label: 'Makanan Utama' },
  'camilan-roti': { icon: Cookie, bg: 'bg-orange-400', label: 'Camilan & Roti' },
  minuman: { icon: Coffee, bg: 'bg-sky-400', label: 'Minuman' },
  'paket-hampers': { icon: Gift, bg: 'bg-lime-400', label: 'Paket & Hampers' },
  'signature-coffee': { icon: Coffee, bg: 'bg-yolk', label: 'Signature Coffee' },
  'non-coffee-tea': { icon: CupSoda, bg: 'bg-lime-400', label: 'Non-Coffee & Tea' },
  'pastry-croissant': { icon: Croissant, bg: 'bg-orange-400', label: 'Pastry & Croissant' },
  'main-course': { icon: UtensilsCrossed, bg: 'bg-sky-400', label: 'Main Course' },
  'beans-merch': { icon: Package, bg: 'bg-zinc-300', label: 'Beans & Merch' },
}

const FALLBACK = { icon: ShoppingBag, bg: 'bg-zinc-300', label: 'Slaras' }

/** Visual produk: foto asli (dengan onError fallback BoldKit) bila ada, bila tidak — tile neobrutalis per kategori. */
export function ProductVisual({ product, size = 'md' }: { product: Product; size?: 'sm' | 'md' | 'lg' }) {
  const style = CATEGORY_STYLE[product.category?.slug ?? ''] ?? FALLBACK
  const Icon = style.icon
  const textSize = size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-8 w-8' : 'h-12 w-12'

  if (product.image_url) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <ProductImage src={product.image_url} name={product.name} />
      </div>
    )
  }
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-2 ${style.bg} p-4 text-black`}>
      <Icon className={textSize} strokeWidth={2.5} />
      <span className="text-center font-display text-[10px] font-black uppercase tracking-widest">
        {style.label}
      </span>
    </div>
  )
}

/** Ikon kecil kategori (untuk chip filter). */
export function CategoryIcon({ slug, className = 'h-4 w-4' }: { slug: string; className?: string }) {
  const style = CATEGORY_STYLE[slug]
  if (!style) return <Package className={className} />
  const Icon = style.icon
  return <Icon className={className} />
}
