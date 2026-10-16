const path = require('node:path')

const cwd = process.env.MARKETPLACE_RELEASE_DIR || path.resolve(__dirname, '..')
module.exports = {
  apps: ['frontend', 'server'].map((target) => ({
    name: target === 'frontend' ? 'marketplace-web' : 'marketplace-api',
    cwd,
    script: '/bin/bash',
    args: ['-c', `bun run start:${target}`],
    interpreter: 'none',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    restart_delay: 2000,
    kill_timeout: 60000,
    env: { NODE_ENV: 'production' },
  })),
}
