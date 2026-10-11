const path = require('node:path')

module.exports = {
  apps: [{
    name: 'marketplace',
    cwd: path.resolve(__dirname, '..'),
    script: 'scripts/start-production.ts',
    interpreter: 'bun',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    restart_delay: 2000,
    kill_timeout: 60000,
    env: { NODE_ENV: 'production' },
  }],
}
