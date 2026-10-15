import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

it('parses chat messages and preserves bounded parser errors over native Bun HTTP', () => {
  const output = execFileSync('bun', ['run', 'scripts/chat-native-http-regression.mjs'], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    encoding: 'utf8', timeout: 30_000,
  })
  expect(output).toContain('Native Bun HTTP chat parser regression passed')
}, 35_000)
