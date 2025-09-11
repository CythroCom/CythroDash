#!/usr/bin/env node
/**
 * CythroDash Setup-All CLI
 * One-shot command to:
 *  1) Replace config/secure.key and config/db.uri (if exist)
 *  2) Run interactive setup
 *  3) Create an admin user
 *  4) Build the application
 *  5) Start the application
 */

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

function log(msg) { console.log(`[setup:all] ${msg}`) }
function warn(msg) { console.warn(`[setup:all] ${msg}`) }
function err(msg) { console.error(`[setup:all] ${msg}`) }

function rmIfExists(fp) {
  try {
    if (fs.existsSync(fp)) {
      fs.rmSync(fp, { force: true })
      log(`Removed existing ${path.relative(process.cwd(), fp)}`)
    }
  } catch (e) {
    warn(`Could not remove ${fp}: ${e?.message || e}`)
  }
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...options })
    p.on('close', code => {
      if (code === 0 || code === null) return resolve()
      reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`))
    })
    p.on('error', reject)
  })
}

async function main() {
  log('Starting comprehensive setup...')

  const configDir = path.join(process.cwd(), 'config')
  try { fs.mkdirSync(configDir, { recursive: true }) } catch {}

  // 1) Replace existing bootstrap/encryption files without prompts
  rmIfExists(path.join(configDir, 'secure.key'))
  rmIfExists(path.join(configDir, 'db.uri'))

  // 2) Run interactive setup
  log('Running setup script...')
  await run('node', ['scripts/setup.js'])

  // 3) Create admin user
  log('Creating admin user...')
  await run('node', ['scripts/newadmin.js'])

  // 4) Build the application
  log('Building application...')
  await run('npx', ['next', 'build'])

  // 5) Start the application (foreground)
  log('Starting application...')
  await run('npx', ['next', 'start'])
}

main().catch(e => {
  err(e?.message || e)
  process.exit(1)
})

