const fs = require('fs')
const path = require('path')
const https = require('https')


function readJsonSafe(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'))
  } catch { return null }
}

function getLocalVersionInfo(rootDir = process.cwd()) {
  const versionPath = path.join(rootDir, 'version.json')
  const pkgPath = path.join(rootDir, 'package.json')
  const v = readJsonSafe(versionPath) || {}
  const pkg = readJsonSafe(pkgPath) || {}
  return {
    version: v.version || pkg.version || '0.0.0',
    releaseDate: v.releaseDate || null,
    notes: v.notes || '',
    minNode: v.minNode || '>=18.0.0',
    breakingChanges: !!v.breakingChanges,
    channels: v.channels || { stable: { branch: 'main' } },
    raw: v
  }
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // follow redirects
        return resolve(fetchUrl(res.headers.location))
      }
      if (!res.statusCode || res.statusCode >= 400) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      }
      let data = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

async function fetchRemoteVersionInfo(channel = 'stable') {
  const local = getLocalVersionInfo()
  const branch = (local.channels?.[channel]?.branch) || (channel === 'stable' ? 'main' : channel)
  const rawUrl = `https://raw.githubusercontent.com/CythroCom/CythroDash/refs/heads/main/version.json`
  const text = await fetchUrl(rawUrl)
  const json = JSON.parse(text)
  return { ...json, channel, branch }
}

function parseSemver(v) {
  const m = String(v || '').trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/)
  if (!m) return { major: 0, minor: 0, patch: 0 }
  return { major: +m[1], minor: +m[2], patch: +m[3] }
}

function cmpVersions(a, b) {
  const A = parseSemver(a), B = parseSemver(b)
  if (A.major !== B.major) return A.major - B.major
  if (A.minor !== B.minor) return A.minor - B.minor
  return A.patch - B.patch
}

function colorize(text, color) {
  const map = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' }
  return `${map[color] || ''}${text}${map.reset}`
}

module.exports = {
  getLocalVersionInfo,
  fetchRemoteVersionInfo,
  cmpVersions,
  colorize,
}

