import { useState } from 'react'
import { API_URL } from '../api/client'

/** Samakan dengan ProductVisual lama: URL relatif (mis. /uploads/...) jadi absolut ke origin API. */
export function resolveImageUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) {
    const origin = API_URL.replace(/\/api\/v1\/?$/, '')
    return `${origin}${url}`
  }
  return url
}

/** Bagi nama menu jadi maksimal 2 baris agar muat di placeholder. */
function splitName(name: string): string[] {
  const words = name.trim().split(/\s+/)
  if (words.length <= 2) return [name.trim()]
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

/**
 * Placeholder SVG bergaya BoldKit hitam-putih (dengan aksen kuning khas
 * Slaras) bertuliskan nama menu. Inline SVG — bukan file eksternal, jadi
 * tidak pernah gagal dimuat sendiri.
 */
function BoldKitPlaceholder({ name, className }: { name: string; className?: string }) {
  const lines = splitName(name)
  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label={name}
      data-testid="product-image-fallback"
    >
      <rect width="400" height="300" fill="#000" />
      <rect x="10" y="10" width="380" height="280" fill="none" stroke="#fff" strokeWidth="4" />
      <rect x="10" y="10" width="380" height="36" fill="#facc15" />
      <text x="200" y="35" textAnchor="middle" fontSize="17" fontWeight="900" fill="#000" letterSpacing="2">
        SLARAS NUSA
      </text>
      {lines.map((line, i) => (
        <text
          key={i}
          x="200"
          y={148 + i * 34}
          textAnchor="middle"
          fontSize="26"
          fontWeight="900"
          fill="#fff"
          letterSpacing="1"
        >
          {line}
        </text>
      ))}
      <text x="200" y="270" textAnchor="middle" fontSize="13" fontWeight="700" fill="#facc15" letterSpacing="3">
        FOODLAB
      </text>
    </svg>
  )
}

interface ProductImageProps {
  src: string
  name: string
  /** Diterapkan ke <img> maupun placeholder <svg> (default: isi penuh wadah). */
  className?: string
  loading?: 'lazy' | 'eager'
}

/**
 * Gambar produk dengan onError fallback: bila URL kosong atau gagal dimuat,
 * otomatis tampil placeholder SVG BoldKit bertuliskan nama menu.
 */
export default function ProductImage({
  src,
  name,
  className = 'h-full w-full object-cover',
  loading = 'lazy',
}: ProductImageProps) {
  const [failed, setFailed] = useState(false)
  const url = resolveImageUrl(src)
  if (!url || failed) {
    return <BoldKitPlaceholder name={name || 'Slaras'} className={className} />
  }
  return (
    <img src={url} alt={name} className={className} loading={loading} onError={() => setFailed(true)} />
  )
}
