/**
 * CythroDash - Database Configuration Manager
 * Centralized config retrieval with caching, encryption at rest for secrets,
 * and environment fallback during migration/development.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// Lazy import to avoid circular dependency with database/index.ts
let _db = null
async function getDbDirect(mongoUri) {
  const { MongoClient } = require('mongodb')
  const client = new MongoClient(mongoUri)
  await client.connect()
  return client.db()
}

const COLLECTION = 'cythro_dash_config'
const CACHE_TTL_MS = 60_000
const SECRET_KEY_FILE = path.join(process.cwd(), 'config', 'secure.key')

// Ensure config dir
try { fs.mkdirSync(path.dirname(SECRET_KEY_FILE), { recursive: true }) } catch {}

const cache = new Map() // key -> { value, at }

function now() { return Date.now() }

function loadMasterKey() {
  try {
    if (fs.existsSync(SECRET_KEY_FILE)) {
      const key = fs.readFileSync(SECRET_KEY_FILE)
      if (key.length >= 32) return key.slice(0, 32)
      // pad if shorter
      return Buffer.concat([key, Buffer.alloc(32 - key.length, 0)])
    }
  } catch {}
  return null
}

function encryptValue(plain) {
  const key = loadMasterKey()
  if (!key) {
    // No key; store plaintext with marker
    return { stored: String(plain), encrypted: false }
  }
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const packed = Buffer.concat([iv, tag, enc]).toString('base64')
  return { stored: packed, encrypted: true }
}

function decryptValue(stored, encrypted) {
  if (!encrypted) return stored
  const key = loadMasterKey()
  if (!key) {
    // Cannot decrypt without key; return masked
    return undefined
  }
  const raw = Buffer.from(stored, 'base64')
  const iv = raw.slice(0, 12)
  const tag = raw.slice(12, 28)
  const data = raw.slice(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(data), decipher.final()])
  return dec.toString('utf8')
}

function envFallbackFor(key, defVal) {
  // Dotted keys -> ENV_FRIENDLY
  const envKeyCandidates = []
  if (key.includes('.')) envKeyCandidates.push(key.toUpperCase().replace(/\./g, '_'))
  envKeyCandidates.push(key)
  // Specific known mappings
  const map = {
    'database.uri': 'MONGODB_URI',
    'integrations.discord.client_id': 'DISCORD_CLIENT_ID',
    'integrations.discord.client_secret': 'DISCORD_CLIENT_SECRET',
    'integrations.discord.bot_token': 'DISCORD_BOT_TOKEN',
    'integrations.discord.redirect_uri': 'DISCORD_REDIRECT_URI',
    'integrations.github.client_id': 'GITHUB_CLIENT_ID',
    'integrations.github.client_secret': 'GITHUB_CLIENT_SECRET',
    'integrations.github.redirect_uri': 'GITHUB_REDIRECT_URI',
    'integrations.pterodactyl.panel_url': 'PANEL_URL',
    'integrations.pterodactyl.api_key': 'PANEL_API_KEY',
    'integrations.pterodactyl.client_api_key': 'PANEL_CLIENT_API_KEY',
    'app.jwt_secret': 'JWT_SECRET',
    'app.session_secret': 'SESSION_SECRET',
    'security.cron_secret': 'CRON_SECRET'
  }
  if (map[key]) envKeyCandidates.unshift(map[key])
  for (const k of envKeyCandidates) {
    const v = process.env[k]
    if (v !== undefined && v !== null && v !== '') return v
  }
  // As a bootstrap fallback for database.uri, also check a local file written by setup
  if (key === 'database.uri') {
    try {
      const fp = path.join(process.cwd(), 'config', 'db.uri')
      if (fs.existsSync(fp)) {
        const fileVal = (fs.readFileSync(fp, 'utf8') || '').trim()
        if (fileVal) return fileVal
      }
    } catch {}
  }
  return defVal
}

async function getCollection(db) {
  const col = db.collection(COLLECTION)
  try {
    await col.createIndex({ key: 1 }, { unique: true, name: 'key_unique' })
    await col.createIndex({ category: 1 }, { name: 'by_category' })
  } catch {}
  return col
}

async function getConfig(key, defVal = undefined) {
  try {
    const c = cache.get(key)
    if (c && now() - c.at < CACHE_TTL_MS) return c.value

    // Bootstrap path: database.uri must not require DB connection
    if (key === 'database.uri') {
      const fallback = envFallbackFor(key, defVal)
      cache.set(key, { value: fallback, at: now() })
      return fallback
    }

    // Get DB
    if (!_db) {
      const bootstrapUri = envFallbackFor('database.uri')
      if (!bootstrapUri) return envFallbackFor(key, defVal)
      _db = await getDbDirect(bootstrapUri)
    }

    const col = await getCollection(_db)
    const doc = await col.findOne({ key })
    if (!doc) {
      const fallback = envFallbackFor(key, defVal)
      cache.set(key, { value: fallback, at: now() })
      return fallback
    }

    const value = doc.encrypted ? decryptValue(doc.value, true) : doc.value
    const finalVal = value !== undefined ? value : envFallbackFor(key, defVal)
    cache.set(key, { value: finalVal, at: now() })
    return finalVal
  } catch (e) {
    return envFallbackFor(key, defVal)
  }
}

async function setConfig(key, value, options = {}) {
  const { category = 'general', secret = false, updated_by_admin_id = 0 } = options
  // Ensure DB connection (use env bootstrap)
  if (!_db) {
    const bootstrapUri = envFallbackFor('database.uri')
    if (!bootstrapUri) throw new Error('Database URI not configured')
    _db = await getDbDirect(bootstrapUri)
  }
  const col = await getCollection(_db)
  const toStore = secret ? encryptValue(value) : { stored: String(value ?? ''), encrypted: false }
  const res = await col.updateOne(
    { key },
    { $set: { key, value: toStore.stored, encrypted: toStore.encrypted, category, updated_at: new Date(), updated_by_admin_id } },
    { upsert: true }
  )
  cache.delete(key)
  return res.acknowledged === true
}

async function getAllConfig() {
  try {
    if (!_db) {
      const bootstrapUri = envFallbackFor('database.uri')
      if (!bootstrapUri) return {}
      _db = await getDbDirect(bootstrapUri)
    }
    const col = await getCollection(_db)
    const docs = await col.find({}).toArray()
    const result = {}
    for (const d of docs) {
      result[d.key] = d.encrypted ? decryptValue(d.value, true) : d.value
    }
    return result
  } catch {
    return {}
  }
}

function getConfigSync(key, defVal = undefined) {
  const c = cache.get(key)
  if (c && now() - c.at < CACHE_TTL_MS) return c.value
  return envFallbackFor(key, defVal)
}

async function primeEnvFromDb() {
  try {
    if (!_db) {
      const bootstrapUri = envFallbackFor('database.uri')
      if (!bootstrapUri) return
      _db = await getDbDirect(bootstrapUri)
    }
    const col = await getCollection(_db)
    const docs = await col.find({}).toArray()
    const keyToEnv = {
      'database.uri': 'MONGODB_URI',
      'integrations.discord.client_id': 'DISCORD_CLIENT_ID',
      'integrations.discord.client_secret': 'DISCORD_CLIENT_SECRET',
      'integrations.discord.bot_token': 'DISCORD_BOT_TOKEN',
      'integrations.discord.redirect_uri': 'DISCORD_REDIRECT_URI',
      'integrations.github.client_id': 'GITHUB_CLIENT_ID',
      'integrations.github.client_secret': 'GITHUB_CLIENT_SECRET',
      'integrations.github.redirect_uri': 'GITHUB_REDIRECT_URI',
      'integrations.pterodactyl.panel_url': 'PANEL_URL',
      'integrations.pterodactyl.api_key': 'PANEL_API_KEY',
      'integrations.pterodactyl.client_api_key': 'PANEL_CLIENT_API_KEY',
      'app.jwt_secret': 'JWT_SECRET',
      'app.session_secret': 'SESSION_SECRET',
      'security.cron_secret': 'CRON_SECRET'
    }
    for (const d of docs) {
      const envName = keyToEnv[d.key]
      if (!envName) continue
      const val = d.encrypted ? decryptValue(d.value, true) : d.value
      if (val !== undefined) process.env[envName] = String(val)
    }
  } catch {}
}

module.exports = {
  getConfig,
  setConfig,
  getAllConfig,
  getConfigSync,
  primeEnvFromDb,
  // helpers exposed for setup script
  _helpers: { loadMasterKey, encryptValue, decryptValue, SECRET_KEY_FILE }
}

