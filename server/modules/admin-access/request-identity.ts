import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto'
import { isIP } from 'node:net'
import { AdminAccessError } from './admin-access.errors.ts'

function ipNumber(input: string) {
  const value =
    input.startsWith('::ffff:') && isIP(input.slice(7)) === 4
      ? input.slice(7)
      : input
  const family = isIP(value)
  if (family === 4)
    return {
      bits: 32,
      value: value
        .split('.')
        .reduce((result, part) => result * 256n + BigInt(part), 0n),
    }
  if (family !== 6)
    throw new AdminAccessError('Invalid IP address', 400, 'INVALID_IP_CIDR')
  let normalized = value
  const lastColon = value.lastIndexOf(':')
  if (value.includes('.')) {
    const v4 = ipNumber(value.slice(lastColon + 1)).value
    normalized = `${value.slice(0, lastColon + 1)}${(v4 >> 16n).toString(16)}:${(v4 & 65535n).toString(16)}`
  }
  const halves = normalized.split('::')
  const left = halves[0] ? halves[0].split(':') : []
  const right = halves[1] ? halves[1].split(':') : []
  const parts =
    halves.length > 1
      ? [
          ...left,
          ...Array<string>(8 - left.length - right.length).fill('0'),
          ...right,
        ]
      : left
  return {
    bits: 128,
    value: parts.reduce(
      (result, part) => (result << 16n) + BigInt(`0x${part}`),
      0n,
    ),
  }
}

export function normalizeCidr(input: string) {
  if (input.trim().split('/').length > 2)
    throw new AdminAccessError('Invalid CIDR notation', 400, 'INVALID_IP_CIDR')
  const [address = '', prefix] = input.trim().split('/')
  const parsed = ipNumber(address)
  const bits = prefix === undefined ? parsed.bits : Number(prefix)
  if (
    !Number.isInteger(bits) ||
    bits < 0 ||
    bits > parsed.bits ||
    (prefix !== undefined && !/^\d+$/.test(prefix))
  )
    throw new AdminAccessError('Invalid CIDR prefix', 400, 'INVALID_IP_CIDR')
  const network =
    (parsed.value >> BigInt(parsed.bits - bits)) << BigInt(parsed.bits - bits)
  const canonical =
    parsed.bits === 32
      ? [24n, 16n, 8n, 0n]
          .map((shift) => String((network >> shift) & 255n))
          .join('.')
      : [112n, 96n, 80n, 64n, 48n, 32n, 16n, 0n]
          .map((shift) => ((network >> shift) & 65535n).toString(16))
          .join(':')
  return `${canonical}/${bits}`
}

export function matchesCidr(ip: string, cidr: string) {
  try {
    const [address = '', prefix] = normalizeCidr(cidr).split('/')
    const parsed = ipNumber(ip)
    const network = ipNumber(address)
    if (parsed.bits !== network.bits) return false
    const shift = BigInt(parsed.bits - Number(prefix))
    return parsed.value >> shift === network.value >> shift
  } catch {
    return false
  }
}

export function trustedRequestIp(
  request: Request,
  remoteAddress: string | undefined,
  trustedProxyCidrs: string[],
) {
  if (!remoteAddress || !isIP(remoteAddress)) return undefined
  const trusted = (address: string) =>
    trustedProxyCidrs.some((cidr) => matchesCidr(address, cidr))
  if (!trusted(remoteAddress)) return remoteAddress
  const chain =
    request.headers
      .get('x-forwarded-for')
      ?.split(',')
      .map((value) => value.trim()) ?? []
  if (chain.length > 16 || chain.some((address) => !isIP(address)))
    return remoteAddress
  let current = remoteAddress
  for (const address of chain.reverse()) {
    if (!trusted(current)) break
    current = address
  }
  return current
}

const cookieName = 'marketplace_access_device'
export function signedDeviceIdentity(
  request: Request,
  secret: string | undefined,
) {
  if (!secret || secret.length < 32)
    return { deviceHash: undefined, setCookie: undefined }
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1)
  const [id, signature] = token?.split('.') ?? []
  const sign = (value: string) =>
    createHmac('sha256', secret).update(`access-device:${value}`).digest('hex')
  if (
    id &&
    /^[a-f0-9-]{36}$/.test(id) &&
    signature &&
    /^[a-f0-9]{64}$/.test(signature) &&
    timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(sign(id), 'hex'))
  )
    return {
      deviceHash: createHash('sha256').update(id).digest('hex'),
      setCookie: undefined,
    }
  const newId = randomUUID()
  return {
    deviceHash: undefined,
    setCookie: `${cookieName}=${newId}.${sign(newId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`,
  }
}
