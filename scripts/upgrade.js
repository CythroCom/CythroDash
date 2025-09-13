#!/usr/bin/env node
/**
 * cythrodash upgrade
 */

const { spawn } = require('child_process')

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

  // Perform upgrade only (no hooks, backups, migrations, or build)
  await ensureGit()
  try {
    await upgradeWithGit(remote.branch)
  } catch (e) {
    console.error(colorize(`Upgrade failed during git operations: ${e?.message || e}`, 'red'))
    console.error('No changes were applied.')
    process.exit(1)
  }

  console.log(colorize('Upgrade successful.', 'green'))
  console.log('You can now start the app with: npx cythrodash start')
}

main().catch(e => { console.error(e?.message || e); process.exit(1) })

