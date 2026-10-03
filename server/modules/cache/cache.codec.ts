import { Prisma } from '#generated/client/client.ts'

type Path = string[]

export function encodeCacheValue(value: unknown): string {
  const bigints: Path[] = []
  const decimals: Path[] = []
  const dates: Path[] = []
  function encode(item: unknown, path: Path): unknown {
    if (typeof item === 'bigint') {
      bigints.push(path)
      return item.toString()
    }
    if (Prisma.Decimal.isDecimal(item)) {
      decimals.push(path)
      return item.toString()
    }
    if (item instanceof Date) {
      dates.push(path)
      return item.toISOString()
    }
    if (item === null || typeof item !== 'object') return item
    if (Array.isArray(item)) return item.map((child, index) => encode(child, [...path, String(index)]))
    return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, encode(child, [...path, key])]))
  }
  const data = encode(value, [])
  return JSON.stringify({ version: 2, data, bigints, decimals, dates })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function paths(value: unknown): Path[] {
  if (!Array.isArray(value) || !value.every((path) => Array.isArray(path) && path.every((key) => typeof key === 'string'))) throw new Error('Invalid cache type metadata')
  return value
}

export function decodeCacheValue(raw: string): unknown {
  const envelope: unknown = JSON.parse(raw)
  if (!isRecord(envelope) || envelope['version'] !== 2) throw new Error('Unsupported cache version')
  let data = envelope['data']
  function restore(path: Path, convert: (value: string) => unknown): void {
    if (path.length === 0) {
      if (typeof data !== 'string') throw new Error('Invalid cache scalar')
      data = convert(data)
      return
    }
    let parent: unknown = data
    for (const key of path.slice(0, -1)) {
      if (Array.isArray(parent)) parent = parent[Number(key)]
      else if (isRecord(parent) && Object.hasOwn(parent, key)) parent = parent[key]
      else throw new Error('Invalid cache path')
    }
    const key = path.at(-1)!
    const child = Array.isArray(parent) ? parent[Number(key)] : isRecord(parent) && Object.hasOwn(parent, key) ? parent[key] : undefined
    if (typeof child !== 'string') throw new Error('Invalid cache scalar')
    if (Array.isArray(parent)) parent[Number(key)] = convert(child)
    else if (isRecord(parent)) Object.defineProperty(parent, key, { value: convert(child), writable: true, enumerable: true, configurable: true })
  }
  for (const path of paths(envelope['bigints'])) restore(path, (value) => {
    if (!/^(0|[1-9][0-9]*|-[1-9][0-9]*)$/.test(value)) throw new Error('Invalid cached integer')
    return BigInt(value)
  })
  for (const path of paths(envelope['decimals'])) restore(path, (value) => new Prisma.Decimal(value))
  for (const path of paths(envelope['dates'])) restore(path, (value) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) throw new Error('Invalid cached date')
    return date
  })
  return data
}
