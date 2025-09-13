#!/usr/bin/env node
/**
 * cythrodash status
 */
const path = require('path')
const os = require('os')
const { MongoClient } = require('mongodb')
const { getLocalVersionInfo, fetchRemoteVersionInfo, cmpVersions, colorize } = require('./lib/version')
const { getConfigSync } = require('../database/config-manager.js')

async function checkDb() {
  try {
    const uri = getConfigSync('database.uri')
    if (!uri) return { ok: false, message: 'Database URI not configured' }
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 2000 })
    await client.connect()
    await client.db().command({ ping: 1 })
    await client.close()
    return { ok: true, message: 'Connected' }
  } catch (e) {
    return { ok: false, message: e?.message || 'DB error' }
  }
}

async function getPublicSettings() {
  try {
    const uri = getConfigSync('database.uri')
    if (!uri) return {}
    const client = new MongoClient(uri)
    await client.connect()
    const db = client.db()
    const items = await db.collection('cythro_dash_settings').find({}).toArray()
    await client.close()
    const map = {}
    for (const it of items) map[it.key] = it.value
    return map
  } catch {
    return {}
  }
}

async function main() {
  const local = getLocalVersionInfo()
  const channel = 'stable'
  let remote
  try {
    remote = await fetchRemoteVersionInfo(channel)
  } catch {
    remote = null
  }

  const dbStatus = await checkDb()
  const pub = await getPublicSettings()
  const appName = pub.NEXT_PUBLIC_NAME || 'CythroDash'
  const description = pub.NEXT_PUBLIC_DESCRIPTION || 'Advanced Game Server Management Dashboard'
  const publicUrl = pub.NEXT_PUBLIC_URL || ''

  const latest = remote?.version || 'unknown'
  const isOutdated = remote ? cmpVersions(local.version, remote.version) < 0 : false

  const installDir = process.cwd()

  // Health color
  let health = 'healthy'
  let color = 'green'
  if (!dbStatus.ok) { health = 'errors'; color = 'red' }

  console.log(colorize(`\n${appName}`, 'cyan'))
  console.log(description)
  console.log('')
  console.log(`Local Version: ${local.version}`)
  console.log(`Latest Version (${channel}): ${latest}${isOutdated ? ' ' + colorize('(update available)', 'yellow') : ''}`)
  console.log(`Node Required: ${local.minNode}`)
  if (local.breakingChanges) console.log(colorize('Breaking changes in this release', 'yellow'))
  console.log('')
  console.log(`Database: ${dbStatus.ok ? colorize('OK', 'green') : colorize('ERROR', 'red')} ${dbStatus.message ? `- ${dbStatus.message}` : ''}`)
  console.log(`Public URL: ${publicUrl || '(not set)'}`)
  console.log(`Install Dir: ${installDir}`)
  console.log(`Uptime: (unavailable)`) // not tracked by CLI
  console.log('')
  console.log(`Health: ${colorize(health.toUpperCase(), color)}`)
  console.log('')
}

main().catch(e => { console.error(e?.message || e); process.exit(1) })

