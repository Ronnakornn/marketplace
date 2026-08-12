const staticAssetCacheControl = 'public, max-age=31536000, immutable'
const publicImageCacheControl = 'public, max-age=604800, stale-while-revalidate=86400'
const noStoreCacheControl = 'no-store'
const isProduction = process.env.NODE_ENV === 'production'
const enforceHttps = isProduction && process.env.ALLOW_INSECURE_HTTP !== 'true'
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss: ws:",
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(enforceHttps ? ['upgrade-insecure-requests'] : []),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
  ...(enforceHttps
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
]

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

export function allowedDevOrigins() {
  const configuredOrigins = process.env.NEXT_ALLOWED_DEV_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return configuredOrigins?.length ? configuredOrigins : ['localhost:3000', '127.0.0.1:3000']
}

const assetPrefix = getAssetPrefix()

/** @type {import('next').NextConfig} */
const nextConfig = {
  assetPrefix,
  allowedDevOrigins: allowedDevOrigins(),
  images: {
    remotePatterns: imageRemotePatterns(),
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    const productionStaticHeaders = isProduction
      ? [
          {
            source: '/:path*.:ext(js|css|woff|woff2|ttf|otf|ico|png|jpg|jpeg|gif|webp|avif|svg)',
            headers: [{ key: 'Cache-Control', value: staticAssetCacheControl }],
          },
        ]
      : []

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      ...productionStaticHeaders,
      {
        source: '/uploads/:path*',
        headers: [{ key: 'Cache-Control', value: publicImageCacheControl }],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: noStoreCacheControl }],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
      {
        source: '/:locale(en|th)/admin/:path*',
        headers: [{ key: 'Cache-Control', value: noStoreCacheControl }],
      },
      {
        source: '/:locale(en|th)/seller/:path*',
        headers: [{ key: 'Cache-Control', value: noStoreCacheControl }],
      },
      {
        source: '/:locale(en|th)/cart',
        headers: [{ key: 'Cache-Control', value: noStoreCacheControl }],
      },
      {
        source: '/:locale(en|th)/checkout',
        headers: [{ key: 'Cache-Control', value: noStoreCacheControl }],
      },
      {
        source: '/:locale(en|th)/payment/:path*',
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
