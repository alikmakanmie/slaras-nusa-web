import { Link } from 'react-router-dom'
import { Minus, Plus, Settings2 } from 'lucide-react'
import type { Product } from '../api/types'
import { formatRupiah } from '../utils/format'
import { ProductVisual } from './ProductVisual'
import ModifierModal from './ModifierModal'
import { useCart } from '../context/CartContext'
import { isProductAvailable } from '../utils/modifiers'
import { useState } from 'react'

export default function ProductCard({ product }: { product: Product }) {
  const { addItem, busy, productQty, decrementProduct } = useCart()
  const [added, setAdded] = useState(false)
  const [error, setError] = useState('')
  const [customizeOpen, setCustomizeOpen] = useState(false)

  const available = isProductAvailable(product)
  const qty = productQty(product.id)

  const handleAdd = async () => {
    setError('')
    try {
      await addItem(product.id, 1, product)
      setAdded(true)
      window.setTimeout(() => setAdded(false), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menambah')
    }
  }

  const handlePlus = async () => {
    setError('')
    try {
      await addItem(product.id, 1, product)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menambah')
    }
  }

  const handleMinus = async () => {
    setError('')
    try {
      await decrementProduct(product.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengurangi')
    }
  }

  return (
    <article className="card flex flex-col overflow-hidden" data-testid="product-card">
      <Link to={`/products/${product.id}`} className="block h-44 border-b-2 border-black dark:border-white">
        <ProductVisual product={product} />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/products/${product.id}`}>
            <h3 className="font-display text-base font-black uppercase leading-tight hover:underline">
              {product.name}
            </h3>
          </Link>
          {product.category && (
            <span className="chip shrink-0 bg-bone dark:bg-carbon">{product.category.name}</span>
          )}
        </div>
        <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{product.description}</p>
        {!available && (
          <p className="border-2 border-black bg-red-500 px-2 py-1 font-display text-xs font-black uppercase text-white dark:border-white">
            [ HABIS HARI INI / SOLD OUT ]
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <p className="font-display text-lg font-black leading-none">{formatRupiah(product.price)}</p>
            <p className={`mt-1 text-xs font-semibold ${available ? 'text-green-700 dark:text-green-400' : 'text-red-600'}`}>
              {available ? `Stok: ${product.stock}` : 'Stok habis'}
            </p>
          </div>
          {qty === 0 ? (
            <button
              onClick={handleAdd}
              disabled={busy || !available}
              className="btn btn-primary btn-sm"
              title="Tambah ke keranjang"
            >
              {added ? (
                <>✓ Ditambah</>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> TAMBAH
                </>
              )}
            </button>
          ) : (
            <div
              className="flex items-center border-2 border-black bg-yolk text-black shadow-[3px_3px_0px_0px_#000] dark:border-white dark:shadow-[3px_3px_0px_0px_#fff]"
              data-testid="card-stepper"
            >
              <button
                onClick={handleMinus}
                disabled={busy}
                className="px-3 py-2 hover:bg-yellow-300 disabled:opacity-40"
                aria-label="Kurangi"
                title="Kurangi"
              >
                <Minus className="h-4 w-4" strokeWidth={3} />
              </button>
              <span className="w-8 text-center font-display text-base font-black" data-testid="card-qty">
                {qty}
              </span>
              <button
                onClick={handlePlus}
                disabled={busy || !available}
                className="px-3 py-2 hover:bg-yellow-300 disabled:opacity-40"
                aria-label="Tambah"
                title="Tambah jumlah"
              >
                <Plus className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => setCustomizeOpen(true)}
          disabled={!available}
          className="btn btn-ghost btn-sm w-full"
        >
          <Settings2 className="h-4 w-4" /> Kustomisasi / Varian
        </button>
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
      </div>
      <ModifierModal
        product={product}
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        onConfirm={async (selected) => {
          setError('')
          try {
            await addItem(product.id, 1, product, selected)
            setAdded(true)
            window.setTimeout(() => setAdded(false), 1500)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Gagal menambah')
          }
        }}
      />
    </article>
  )
}
