/** Nomor meja dine-in dari QR (?table=XX / ?meja=XX), tersimpan di localStorage. */

export const TABLE_KEY = 'slaras_table'

/** Normalisasi nomor meja: "5" -> "05", "Meja 5" -> "05". */
export function normalizeTable(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  const n = Number(digits)
  if (!Number.isFinite(n) || n < 1 || n > 99) return null
  return String(n).padStart(2, '0')
}

export function getSavedTable(): string | null {
  try {
    return normalizeTable(localStorage.getItem(TABLE_KEY))
  } catch {
    return null
  }
}

export function saveTable(table: string): void {
  try {
    localStorage.setItem(TABLE_KEY, normalizeTable(table) ?? table)
  } catch {
    // localStorage tidak tersedia — abaikan.
  }
}

export function clearTable(): void {
  try {
    localStorage.removeItem(TABLE_KEY)
  } catch {
    // abaikan
  }
}

/** Baca ?table=XX / ?meja=XX dari query string saat ini. */
export function tableFromSearch(search: string): string | null {
  try {
    const params = new URLSearchParams(search)
    return normalizeTable(params.get('table') ?? params.get('meja'))
  } catch {
    return null
  }
}

/** Label tampilan: "05" -> "Meja 05". */
export function tableLabel(table: string): string {
  return `Meja ${table}`
}
