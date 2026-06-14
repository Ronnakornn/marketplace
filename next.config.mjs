const staticAssetCacheControl = 'public, max-age=31536000, immutable'
const publicImageCacheControl = 'public, max-age=604800, stale-while-revalidate=86400'
const noStoreCacheControl = 'no-store'
const isProduction = process.env.NODE_ENV === 'production'

function toUrl(value) {
  if (!value) return null
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export function imageRemotePatterns() {
  const urls = [
    process.env.NEXT_PUBLIC_CDN_URL,
    process.env.NEXT_PUBLIC_ASSET_BASE_URL,
    process.env.S3_PUBLIC_BASE_URL,
  ]

  const patterns = []
  const seen = new Set()
  for (const url of urls.map(toUrl).filter(Boolean)) {
    const key = `${url.protocol}//${url.hostname}:${url.port}`
    if (seen.has(key)) continue
    seen.add(key)
    patterns.push({
      protocol: url.protocol.replace(':', ''),
      hostname: url.hostname,
      port: url.port,
      pathname: '/**',
    })
  }

  return patterns
}

export function getAssetPrefix() {
  return process.env.NEXT_PUBLIC_ASSET_BASE_URL || process.env.NEXT_PUBLIC_CDN_URL || undefined
}

const assetPrefix = getAssetPrefix()

/** @type {import('next').NextConfig} */
const nextConfig = {
  assetPrefix,
  allowedDevOrigins: ['192.168.1.103'],
  images: {
    remotePatterns: imageRemotePatterns(),
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    const productionStaticHeaders = isProduction
      ? [
          {
            source: '/_next/static/:path*',
            headers: [{ key: 'Cache-Control', value: staticAssetCacheControl }],
          },
        ]
      : []

    return [
      ...productionStaticHeaders,
      {
        source: '/:path*.:ext(js|css|woff|woff2|ttf|otf|ico|png|jpg|jpeg|gif|webp|avif|svg)',
        headers: [{ key: 'Cache-Control', value: staticAssetCacheControl }],
      },
      {
        source: '/uploads/:path*',
        headers: [{ key: 'Cache-Control', value: publicImageCacheControl }],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: noStoreCacheControl }],
      },
      {
        source: '/admin/:path*',
        headers: [{ key: 'Cache-Control', value: noStoreCacheControl }],
      },
      {
        source: '/seller/:path*',
        headers: [{ key: 'Cache-Control', value: noStoreCacheControl }],
      },
      {
        source: '/cart',
        headers: [{ key: 'Cache-Control', value: noStoreCacheControl }],
      },
      {
        source: '/checkout',
        headers: [{ key: 'Cache-Control', value: noStoreCacheControl }],
      },
      {
        source: '/payment/:path*',
        headers: [{ key: 'Cache-Control', value: noStoreCacheControl }],
      },
    ]
  },
  async rewrites() {
    const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001'

    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
