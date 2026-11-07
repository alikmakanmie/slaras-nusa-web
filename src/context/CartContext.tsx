import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { cartApi, catalogApi } from '../api/endpoints'
import { apiErrorMessage } from '../api/client'
import { useAuth } from './AuthContext'
import type { CartData, CartItem, GuestCartItem, Product } from '../api/types'
import { cartLineKey, modifiersSummary, type SelectedModifier } from '../utils/modifiers'

const GUEST_CART_KEY = 'snf_guest_cart'

/** Migrasi item lama (tanpa key/modifier) ke bentuk baru. */
function normalizeGuestItem(it: Partial<GuestCartItem>): GuestCartItem | null {
  if (!it.product_id || !it.product) return null
  const selected = Array.isArray(it.selected_modifiers) ? it.selected_modifiers : []
  const key = it.key || cartLineKey(it.product_id, selected)
  const unitPrice = it.unit_price ?? it.product.price
  return {
    key,
    product_id: it.product_id,
    quantity: it.quantity ?? 1,
    notes: it.notes ?? '',
    selected_modifiers: selected,
    unit_price: unitPrice,
    product: it.product,
  }
}

function loadGuestItems(): GuestCartItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<GuestCartItem>[]
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeGuestItem).filter((x): x is GuestCartItem => x !== null)
  } catch {
    return []
  }
}

function persistGuestItems(items: GuestCartItem[]): void {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items))
  } catch {
    // localStorage tidak tersedia — keranjang tamu sekadar tidak tersimpan.
  }
}

/** Bentuk CartData yang sama dengan API, disintesis dari keranjang tamu lokal. */
function guestItemsToCartData(items: GuestCartItem[]): CartData {
  const cartItems: CartItem[] = items.map((it) => ({
    id: `guest-${it.key}`,
    cart_id: 'guest',
    product_id: it.product_id,
    product: {
      id: it.product.id,
      category_id: '',
      name: it.product.name,
      slug: '',
      description: '',
      price: it.product.price,
      stock: 0,
      sku: '',
      image_url: it.product.image_url,
      weight_gram: 0,
      is_active: true,
      created_at: '',
      updated_at: '',
    },
    quantity: it.quantity,
    price: it.unit_price,
    notes:
      it.notes ||
      (it.selected_modifiers.length > 0 ? modifiersSummary(it.selected_modifiers) : undefined),
    selected_modifiers: it.selected_modifiers,
    created_at: '',
    updated_at: '',
  }))
  return {
    cart: { id: 'guest', user_id: '', items: cartItems },
    subtotal: cartItems.reduce((s, i) => s + i.price * i.quantity, 0),
    total_items: cartItems.reduce((s, i) => s + i.quantity, 0),
  }
}

interface CartCtx {
  cart: CartData | null
  loading: boolean
  busy: boolean
  /** true bila keranjang saat ini adalah keranjang tamu (localStorage). */
  isGuestCart: boolean
  refresh: () => Promise<void>
  addItem: (
    productId: string,
    quantity?: number,
    product?: Product,
    modifiers?: SelectedModifier[],
  ) => Promise<void>
  updateQty: (itemId: string, quantity: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  /** Total kuantitas produk di keranjang (semua varian). */
  productQty: (productId: string) => number
  /** Kurangi 1 porsi produk (baris default dulu, lalu varian). */
  decrementProduct: (productId: string) => Promise<void>
  /** Catatan per item — hanya berlaku untuk keranjang tamu. */
  setItemNotes: (itemId: string, notes: string) => void
  clearLocal: () => void
}

const Ctx = createContext<CartCtx>({
  cart: null,
  loading: false,
  busy: false,
  isGuestCart: true,
  refresh: async () => {},
  addItem: async () => {},
  updateQty: async () => {},
  removeItem: async () => {},
  productQty: () => 0,
  decrementProduct: async () => {},
  setItemNotes: () => {},
  clearLocal: () => {},
})

/** Ambil kunci baris dari id item keranjang tamu (`guest-<key>`). */
function lineKeyOf(itemId: string): string {
  return itemId.replace(/^guest-/, '')
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [cart, setCart] = useState<CartData | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const mergedForUserRef = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setCart(guestItemsToCartData(loadGuestItems()))
      return
    }
    setLoading(true)
    try {
      const data = await cartApi.get()
      setCart(data)
    } catch {
      setCart(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Saat user login, pindahkan isi keranjang tamu (localStorage) ke /cart API.
  // Item yang gagal dipindah (mis. stok habis) tetap tersimpan sebagai tamu.
  // Catatan: /cart member belum mendukung modifier — varian tamu dipindah
  // sebagai produk dasarnya saja.
  useEffect(() => {
    if (!user) {
      mergedForUserRef.current = null
      return
    }
    if (mergedForUserRef.current === user.id) return
    mergedForUserRef.current = user.id
    const pending = loadGuestItems()
    if (pending.length === 0) return
    ;(async () => {
      const remaining: GuestCartItem[] = []
      for (const it of pending) {
        try {
          await cartApi.add(it.product_id, it.quantity)
        } catch {
          remaining.push(it)
        }
      }
      persistGuestItems(remaining)
      await refresh()
    })()
  }, [user, refresh])

  const addItem = useCallback(
    async (productId: string, quantity = 1, product?: Product, modifiers: SelectedModifier[] = []) => {
      setBusy(true)
      try {
        if (user) {
          await cartApi.add(productId, quantity)
          await refresh()
          return
        }
        const snap = product ?? (await catalogApi.getProduct(productId))
        const unitPrice =
          snap.price + modifiers.reduce((s, m) => s + (m.price_delta || 0), 0)
        const key = cartLineKey(productId, modifiers)
        const items = loadGuestItems()
        const idx = items.findIndex((i) => i.key === key)
        if (idx >= 0) {
          items[idx] = { ...items[idx], quantity: Math.min(items[idx].quantity + quantity, 99) }
        } else {
          items.push({
            key,
            product_id: productId,
            quantity,
            notes: '',
            selected_modifiers: modifiers,
            unit_price: unitPrice,
            product: {
              id: snap.id,
              name: snap.name,
              price: snap.price,
              image_url: snap.image_url,
            },
          })
        }
        persistGuestItems(items)
        setCart(guestItemsToCartData(items))
      } catch (err) {
        throw new Error(apiErrorMessage(err, 'Gagal menambah ke keranjang'))
      } finally {
        setBusy(false)
      }
    },
    [user, refresh],
  )

  const updateQty = useCallback(
    async (itemId: string, quantity: number) => {
      setBusy(true)
      try {
        if (user) {
          await cartApi.updateQty(itemId, quantity)
          await refresh()
          return
        }
        const key = lineKeyOf(itemId)
        const items = loadGuestItems()
        const idx = items.findIndex((i) => i.key === key)
        if (idx < 0) return
        if (quantity < 1) {
          items.splice(idx, 1)
        } else {
          items[idx] = { ...items[idx], quantity }
        }
        persistGuestItems(items)
        setCart(guestItemsToCartData(items))
      } catch (err) {
        throw new Error(apiErrorMessage(err, 'Gagal mengubah kuantitas'))
      } finally {
        setBusy(false)
      }
    },
    [user, refresh],
  )

  const removeItem = useCallback(
    async (itemId: string) => {
      setBusy(true)
      try {
        if (user) {
          await cartApi.remove(itemId)
          await refresh()
          return
        }
        const key = lineKeyOf(itemId)
        const items = loadGuestItems().filter((i) => i.key !== key)
        persistGuestItems(items)
        setCart(guestItemsToCartData(items))
      } catch (err) {
        throw new Error(apiErrorMessage(err, 'Gagal menghapus item'))
      } finally {
        setBusy(false)
      }
    },
    [user, refresh],
  )

  const productQty = useCallback(
    (productId: string) => {
      if (user) {
        return (cart?.cart.items ?? [])
          .filter((i) => i.product_id === productId)
          .reduce((s, i) => s + i.quantity, 0)
      }
      return loadGuestItems()
        .filter((i) => i.product_id === productId)
        .reduce((s, i) => s + i.quantity, 0)
    },
    [user, cart],
  )

  const decrementProduct = useCallback(
    async (productId: string) => {
      if (user) {
        const line =
          cart?.cart.items.find((i) => i.product_id === productId) ?? null
        if (!line) return
        if (line.quantity <= 1) await removeItem(line.id)
        else await updateQty(line.id, line.quantity - 1)
        return
      }
      const items = loadGuestItems()
      // Baris default (tanpa modifier) dulu, lalu varian terakhir.
      const idx =
        items.findIndex((i) => i.product_id === productId && i.selected_modifiers.length === 0) >= 0
          ? items.findIndex((i) => i.product_id === productId && i.selected_modifiers.length === 0)
          : items.map((i) => i.product_id).lastIndexOf(productId)
      if (idx < 0) return
      if (items[idx].quantity <= 1) items.splice(idx, 1)
      else items[idx] = { ...items[idx], quantity: items[idx].quantity - 1 }
      persistGuestItems(items)
      setCart(guestItemsToCartData(items))
    },
    [user, cart, removeItem, updateQty],
  )

  const setItemNotes = useCallback((itemId: string, notes: string) => {
    const key = lineKeyOf(itemId)
    const items = loadGuestItems()
    const idx = items.findIndex((i) => i.key === key)
    if (idx < 0) return
    items[idx] = { ...items[idx], notes }
    persistGuestItems(items)
    setCart(guestItemsToCartData(items))
  }, [])

  const clearLocal = useCallback(() => {
    persistGuestItems([])
    if (!user) setCart(guestItemsToCartData([]))
    else setCart(null)
  }, [user])

  return (
    <Ctx.Provider
      value={{
        cart,
        loading,
        busy,
        isGuestCart: !user,
        refresh,
        addItem,
        updateQty,
        removeItem,
        productQty,
        decrementProduct,
        setItemNotes,
        clearLocal,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export const useCart = () => useContext(Ctx)
