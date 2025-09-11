#!/usr/bin/env node
/**
 * cythrodash upgrade
 */
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { MongoClient } = require('mongodb')
const { getLocalVersionInfo, fetchRemoteVersionInfo, cmpVersions, colorize } = require('./lib/version')

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...options })
    p.on('close', code => (code === 0 || code === null) ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`)))
    p.on('error', reject)
  })
}

async function promptConfirm(message) {
  return new Promise(resolve => {
    process.stdout.write(`${message} [y/N]: `)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    process.stdin.once('data', data => {
      const v = String(data || '').trim().toLowerCase()
      resolve(v === 'y' || v === 'yes')
    })
  })
}

function parseArgs() {
  const args = process.argv.slice(2)
  const out = { force: false, dryRun: false, channel: process.env.CYTHRO_CHANNEL || 'stable' }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--force' || a === '-f') out.force = true
    else if (a === '--dry-run' || a === '-n') out.dryRun = true
    else if (a === '--channel' && args[i+1]) { out.channel = args[++i] }
  }
  return out
}

function ensureDir(fp) { try { fs.mkdirSync(fp, { recursive: true }) } catch {} }

async function dumpDbBackup(dir) {
  try {
    const uri = require('../database/config-manager.js').getConfigSync('database.uri')
    if (!uri) return { ok: false, message: 'No DB URI' }
    const client = new MongoClient(uri)
    await client.connect()
    const db = client.db()
    const configDocs = await db.collection('cythro_dash_config').find({}).toArray()
    const settingsDocs = await db.collection('cythro_dash_settings').find({}).toArray()
    await client.close()
    fs.writeFileSync(path.join(dir, 'cythro_dash_config.json'), JSON.stringify(configDocs, null, 2))
    fs.writeFileSync(path.join(dir, 'cythro_dash_settings.json'), JSON.stringify(settingsDocs, null, 2))
    return { ok: true }
  } catch (e) {
    return { ok: false, message: e?.message || 'DB backup failed' }
  }
}

async function ensureGit() {
  await run('git', ['--version']).catch(() => { throw new Error('Git is required for upgrade.') })
}

async function upgradeWithGit(branch) {
  // Save current commit
  let oldCommit = null
  try {
    const buf = await new Promise((resolve) => {
      const p = spawn('git', ['rev-parse', 'HEAD'], { shell: process.platform === 'win32' })
      let data = ''
      p.stdout.on('data', d => data += d.toString())
      p.on('close', () => resolve(data.trim()))
    })
    oldCommit = buf || null
  } catch {}

  await run('git', ['fetch', 'origin', branch])
  await run('git', ['checkout', branch])
  await run('git', ['pull', '--ff-only', 'origin', branch])

  return oldCommit
}

async function rollbackGit(oldCommit) {
  if (!oldCommit) return
  try {
    await run('git', ['reset', '--hard', oldCommit])
  } catch {}
}

async function main() {
  const { force, dryRun, channel } = parseArgs()
  const local = getLocalVersionInfo()
  const remote = await fetchRemoteVersionInfo(channel)

  console.log(`Local version: ${local.version}`)
  console.log(`Remote version (${channel}/${remote.branch}): ${remote.version}`)

  const cmp = cmpVersions(local.version, remote.version)
  if (cmp >= 0) {
    console.log(colorize('Already up to date.', 'green'))
    return
  }

  console.log('Release notes:')
  console.log(remote.notes || '(none)')

  if (dryRun) {
    console.log(colorize('\nDry run: no changes applied.', 'yellow'))
    return
  }

  if (!force) {
    const ok = await promptConfirm('Proceed with upgrade?')
    if (!ok) return
  }

  // Pre-upgrade hook
  const preHook = path.join(process.cwd(), 'scripts', 'hooks', 'pre-upgrade.js')
  if (fs.existsSync(preHook)) {
    console.log('Running pre-upgrade hook...')
    await run('node', [preHook])
  }

  // Backups
  const backupsDir = path.join(process.cwd(), 'backups', new Date().toISOString().replace(/[:.]/g, '-'))
  ensureDir(backupsDir)
  ensureDir(path.join(process.cwd(), 'config'))

  // copy config dir
  try {
    const cfgSrc = path.join(process.cwd(), 'config')
    const cfgDst = path.join(backupsDir, 'config')
    fs.cpSync(cfgSrc, cfgDst, { recursive: true, force: true, errorOnExist: false })
    console.log(`Backed up config/ to ${path.relative(process.cwd(), cfgDst)}`)
  } catch (e) {
    console.warn('Config backup failed:', e?.message || e)
  }

  const dbDump = await dumpDbBackup(backupsDir)
  if (!dbDump.ok) console.warn('DB backup warning:', dbDump.message)

  // Perform upgrade using git
  await ensureGit()
  let oldCommit = null
  try {
    oldCommit = await upgradeWithGit(remote.branch)
  } catch (e) {
    console.error(colorize(`Upgrade failed during git operations: ${e?.message || e}`, 'red'))
    console.error('No changes were applied.')
    process.exit(1)
  }

  // Restore config to ensure upgrades never override local secrets
  try {
    const cfgBackup = path.join(backupsDir, 'config')
    const cfgDest = path.join(process.cwd(), 'config')
    if (fs.existsSync(cfgBackup)) {
      fs.cpSync(cfgBackup, cfgDest, { recursive: true, force: true, errorOnExist: false })
      console.log('Preserved local config/ (restored from backup)')
    }
  } catch (e) {
    console.warn('Warning: could not restore config/:', e?.message || e)
  }

  // Migrations (placeholder)
  const migrate = path.join(process.cwd(), 'scripts', 'migrate.js')
  if (fs.existsSync(migrate)) {
    console.log('Running migrations...')
    await run('node', [migrate])
  } else {
    console.log('No migrations to run.')
  }

  // Build
  try {
    console.log('Building application...')
    await run('npx', ['next', 'build'])
  } catch (e) {
    console.error(colorize('Build failed. Attempting rollback...', 'red'))
    await rollbackGit(oldCommit)
    process.exit(1)
  }

  // Post-upgrade hook
  const postHook = path.join(process.cwd(), 'scripts', 'hooks', 'post-upgrade.js')
  if (fs.existsSync(postHook)) {
    console.log('Running post-upgrade hook...')
    await run('node', [postHook])
  }

  console.log(colorize('Upgrade successful.', 'green'))
  console.log('You can now start the app with: npx cythrodash start')
}

main().catch(e => { console.error(e?.message || e); process.exit(1) })

