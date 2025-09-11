#!/usr/bin/env node
/**
 * CythroDash Installer
 * Usage: npx cythrodash install [targetDir]
 * - Clones https://github.com/CythroCom/CythroDash.git
 * - cd into targetDir
 * - Installs dependencies
 * - Runs setup-all (which replaces secure.key/db.uri, runs setup, creates admin, builds, starts)
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const REPO_URL = 'https://github.com/CythroCom/CythroDash.git'

function log(msg) { console.log(`[install] ${msg}`) }
function warn(msg) { console.warn(`[install] ${msg}`) }
function err(msg) { console.error(`[install] ${msg}`) }

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

async function ensureGit() {
  try {
    await run('git', ['--version'])
  } catch (e) {
    throw new Error('Git is required but not found in PATH. Please install Git and try again.')
  }
}

function resolveTargetDir(inputArg) {
  let target = inputArg || 'CythroDash'
  let full = path.resolve(process.cwd(), target)
  if (fs.existsSync(full)) {
    try {
      const entries = fs.readdirSync(full)
      if (entries && entries.length > 0) {
        const suffix = new Date().toISOString().replace(/[:.]/g, '-')
        const alt = `${target}-install-${suffix}`
        warn(`Target directory '${target}' already exists and is not empty. Using '${alt}' instead.`)
        target = alt
        full = path.resolve(process.cwd(), target)
      }
    } catch {}
  }
  return { target, full }
}

async function main() {
  const [, , , targetDirArg] = process.argv
  log('Starting installation...')

  await ensureGit()

  const { target, full } = resolveTargetDir(targetDirArg)
  log(`Cloning ${REPO_URL} into ${target} ...`)
  await run('git', ['clone', REPO_URL, target])

  // Install dependencies
  log('Installing dependencies (npm install)...')
  await run('npm', ['install'], { cwd: full })

  // Run comprehensive setup and start
  log('Running comprehensive setup (setup-all)...')
  await run('node', ['scripts/setup-all.js'], { cwd: full })
}

main().catch(e => {
  err(e?.message || e)
  process.exit(1)
})

