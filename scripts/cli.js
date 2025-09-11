#!/usr/bin/env node
/**
 * CythroDash CLI: cythrodash [setup|newadmin|build|start|setup:all|install]
 */

const { spawn } = require('child_process')
const { getLocalVersionInfo, fetchRemoteVersionInfo, cmpVersions, colorize } = require('./lib/version')

function run(cmd, args) {
  const p = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  p.on('close', code => process.exit(code ?? 0))
}

async function checkForUpdates() {
  try {
    const channel = process.env.CYTHRO_CHANNEL || 'stable'
    const local = getLocalVersionInfo()
    const remote = await fetchRemoteVersionInfo(channel)
    if (cmpVersions(local.version, remote.version) < 0) {
      console.log(colorize(`\nA newer version is available: ${remote.version} (current ${local.version}). Run: npx cythrodash upgrade`, 'yellow'))
    }
  } catch {}
}

async function main() {
  const [, , sub, ...rest] = process.argv
  await checkForUpdates().catch(() => {})
  switch (sub) {
    case undefined:
    case 'status':
      run('node', ['scripts/status.js', ...rest])
      break
    case 'setup':
      run('node', ['scripts/setup.js', ...rest])
      break
    case 'newadmin':
      run('node', ['scripts/newadmin.js', ...rest])
      break
    case 'build':
      run('npx', ['next', 'build', ...rest])
      break
    case 'start':
      run('npx', ['next', 'start', ...rest])
      break
    case 'setup:all':
    case 'bootstrap':
      run('node', ['scripts/setup-all.js', ...rest])
      break
    case 'install':
      run('node', ['scripts/install.js', ...rest])
      break
    case 'upgrade':
      run('node', ['scripts/upgrade.js', ...rest])
      break
    default:
      console.log('Usage: cythrodash <status|setup|newadmin|build|start|setup:all|install|upgrade>')
      process.exit(1)
  }
}

main()

