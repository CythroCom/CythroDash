#!/usr/bin/env node
/**
 * CythroDash Setup CLI
 * Interactive script to collect configuration and store it in the database.
 */

const readline = require('readline')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { MongoClient } = require('mongodb')

const { _helpers } = require('../database/config-manager.js')

function prompt(question, opts = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    const ask = () => {
      if (!opts.mask) {
        rl.question(question, answer => { rl.close(); resolve(answer) })
        return
      }
      // Mask user input but still show the question label
      const originalWrite = rl._writeToOutput
      rl._writeToOutput = function (str) {
        // Allow the question prompt itself to render
        if (typeof str === 'string' && str.includes(question)) {
          originalWrite.call(rl, str)
          return
        }
        // Replace typed characters with '*'
        if (typeof str === 'string' && str.length > 0) {
          const masked = str.replace(/./g, '*')
          originalWrite.call(rl, masked)
        } else {
          originalWrite.call(rl, str)
        }
      }
      rl.question(question, answer => {
        rl._writeToOutput = originalWrite
        rl.close()
        resolve(answer)
      })
    }
    ask()
  })
}

function generateSecret(bytes = 32) { return crypto.randomBytes(bytes).toString('hex') }

async function ensureMasterKey() {
  const file = _helpers.SECRET_KEY_FILE
  try {
    if (!fs.existsSync(file)) {
      const key = crypto.randomBytes(32)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, key)
      console.log(`Created encryption key: ${file}`)
    } else {
      console.log(`Using existing encryption key: ${file}`)
    }
  } catch (e) {
    console.warn('Warning: failed to create secure key file, secrets may be stored plaintext.', e)
  }
}

async function main() {
  console.log('Welcome to CythroDash setup! Answer the following prompts.')

  // Database connection (ask for full URI directly)
  const defaultUri = 'mongodb://localhost:27017/cythrodash'
  const mongoUriInput = await prompt(`MongoDB connection URI (default: ${defaultUri}): `)
  const mongoUri = (mongoUriInput && mongoUriInput.trim()) ? mongoUriInput.trim() : defaultUri

  // Write bootstrap file so runtime can connect without env
  try {
    const cfgDir = path.join(process.cwd(), 'config')
    fs.mkdirSync(cfgDir, { recursive: true })
    fs.writeFileSync(path.join(cfgDir, 'db.uri'), mongoUri)
    console.log(`Wrote bootstrap DB URI to ${path.join(cfgDir, 'db.uri')}`)
  } catch (e) {
    console.warn('Warning: could not write bootstrap db.uri file', e)
  }

  console.log(`\nConnecting to MongoDB: ${mongoUri}`)
  const client = new MongoClient(mongoUri)
  await client.connect()
  const db = client.db()

  await ensureMasterKey()

  const col = db.collection('cythro_dash_config')
  await col.createIndex({ key: 1 }, { unique: true, name: 'key_unique' })
  await col.createIndex({ category: 1 }, { name: 'by_category' })

  // Public settings collection for NEXT_PUBLIC_* flags
  const pub = db.collection('cythro_dash_settings')
  try {
    await pub.createIndex({ key: 1 }, { unique: true, name: 'key_unique' })
  } catch {}

  // Application settings
  const appName = (await prompt('App Name (default: CythroDash): ')) || 'CythroDash'
  const appUrl = await prompt('Public Site URL (optional, e.g. https://dash.example.com): ')
  const panelUrl = await prompt('Panel URL (e.g. https://panel.example.com): ')
  const jwtSecret = (await prompt('JWT secret (leave blank to auto-generate): ')) || generateSecret(32)
  const sessionSecret = (await prompt('Session secret (leave blank to auto-generate): ')) || generateSecret(32)
  const cronSecret = generateSecret(32)

  // Integration settings
  console.log('\nDiscord Integration')
  const discordEnabled = ((await prompt('Enable Discord (Y/n): ')) || 'y').toLowerCase().startsWith('y')
  const discordLogin = ((await prompt('Enable Discord Login (Y/n): ')) || 'y').toLowerCase().startsWith('y')
  const discordClientId = await prompt('Discord Client ID: ')
  const discordClientSecret = await prompt('Discord Client Secret: ', { mask: true })
  const discordBotToken = await prompt('Discord Bot Token (optional): ', { mask: true })
  const discordRedirectUri = await prompt('Discord Redirect URI (optional): ')

  console.log('\nGitHub Integration')
  const githubEnabled = ((await prompt('Enable GitHub (Y/n): ')) || 'y').toLowerCase().startsWith('y')
  const githubLogin = ((await prompt('Enable GitHub Login (Y/n): ')) || 'y').toLowerCase().startsWith('y')
  const githubClientId = await prompt('GitHub Client ID: ')
  const githubClientSecret = await prompt('GitHub Client Secret: ', { mask: true })
  const githubRedirectUri = await prompt('GitHub Redirect URI (optional): ')

  console.log('\nPterodactyl Integration')
  const panelUrlPtero = await prompt('Pterodactyl Panel URL: ')
  const panelApiKey = await prompt('Pterodactyl API Key (Application API): ', { mask: true })
  const panelClientApiKey = await prompt('Pterodactyl Client API Key (for power controls): ', { mask: true })

  // Security / Admin
  console.log('\nAdmin Security')
  const adminEmail = await prompt('Admin email (for initial admin account): ')
  const adminPassword = await prompt('Admin password (for initial admin account): ', { mask: true })

  const encrypt = (val) => {
    const { stored, encrypted } = _helpers.encryptValue(val)
    return { value: stored, encrypted }
  }

  const upserts = [
    // database
    { key: 'database.uri', category: 'database', value: mongoUri, encrypted: false },
    // app
    { key: 'app.name', category: 'app', value: appName, encrypted: false },
    { key: 'app.panel_url', category: 'app', value: panelUrl, encrypted: false },
    { key: 'app.jwt_secret', category: 'app', ...encrypt(jwtSecret) },
    { key: 'app.session_secret', category: 'app', ...encrypt(sessionSecret) },
    // security
    { key: 'security.cron_secret', category: 'security', ...encrypt(cronSecret) },
    { key: 'security.admin_email', category: 'security', value: adminEmail, encrypted: false },
    { key: 'security.admin_password', category: 'security', ...encrypt(adminPassword) },
    // integrations.discord
    { key: 'integrations.discord.enabled', category: 'integrations', value: String(discordEnabled), encrypted: false },
    { key: 'integrations.discord.login', category: 'integrations', value: String(discordLogin), encrypted: false },
    { key: 'integrations.discord.client_id', category: 'integrations', value: discordClientId, encrypted: false },
    { key: 'integrations.discord.client_secret', category: 'integrations', ...encrypt(discordClientSecret) },
    { key: 'integrations.discord.bot_token', category: 'integrations', ...encrypt(discordBotToken) },
    { key: 'integrations.discord.redirect_uri', category: 'integrations', value: discordRedirectUri, encrypted: false },
    // integrations.github
    { key: 'integrations.github.enabled', category: 'integrations', value: String(githubEnabled), encrypted: false },
    { key: 'integrations.github.login', category: 'integrations', value: String(githubLogin), encrypted: false },
    { key: 'integrations.github.client_id', category: 'integrations', value: githubClientId, encrypted: false },
    { key: 'integrations.github.client_secret', category: 'integrations', ...encrypt(githubClientSecret) },
    { key: 'integrations.github.redirect_uri', category: 'integrations', value: githubRedirectUri, encrypted: false },
    // integrations.pterodactyl
    { key: 'integrations.pterodactyl.panel_url', category: 'integrations', value: panelUrlPtero, encrypted: false },
    { key: 'integrations.pterodactyl.api_key', category: 'integrations', ...encrypt(panelApiKey) },
    { key: 'integrations.pterodactyl.client_api_key', category: 'integrations', ...encrypt(panelClientApiKey) },
  ]

  for (const u of upserts) {
    await col.updateOne(
      { key: u.key },
      { $set: { key: u.key, value: u.value, encrypted: !!u.encrypted, category: u.category, updated_at: new Date(), updated_by_admin_id: 0 } },
      { upsert: true }
    )
  }

  // Initialize public settings (enable features by default; admin can change later)
  const bool = (v) => (v ? 'true' : 'false')
  const publicUpserts = [
    // General (branding & URLs)
    { key: 'NEXT_PUBLIC_NAME', value: appName, category: 'general', data_type: 'string' },
    { key: 'NEXT_PUBLIC_DESCRIPTION', value: 'Advanced Game Server Management Dashboard', category: 'general', data_type: 'string' },
    { key: 'NEXT_PUBLIC_URL', value: appUrl || '', category: 'general', data_type: 'string' },
    { key: 'NEXT_PUBLIC_PANEL_URL', value: panelUrl || '', category: 'general', data_type: 'string' },
    // Feature flags (enabled by default except maintenance and verification)
    { key: 'NEXT_PUBLIC_SERVER_CREATION', value: bool(true), category: 'features', data_type: 'boolean' },
    { key: 'NEXT_PUBLIC_ACCOUNT_CREATION', value: bool(true), category: 'features', data_type: 'boolean' },
    { key: 'NEXT_PUBLIC_ACCOUNT_LOGIN', value: bool(true), category: 'features', data_type: 'boolean' },
    { key: 'NEXT_PUBLIC_AFK_PAGE', value: bool(true), category: 'features', data_type: 'boolean' },
    { key: 'NEXT_PUBLIC_REFERRAL_PROGRAM', value: bool(true), category: 'features', data_type: 'boolean' },
    { key: 'NEXT_PUBLIC_TRANSFERS', value: bool(true), category: 'features', data_type: 'boolean' },
    { key: 'NEXT_PUBLIC_REDEEM_CODES', value: bool(true), category: 'features', data_type: 'boolean' },
    { key: 'NEXT_PUBLIC_DAILY_LOGIN_BONUS', value: bool(true), category: 'features', data_type: 'boolean' },
    { key: 'NEXT_PUBLIC_OAUTH_ENABLED', value: bool(true), category: 'oauth', data_type: 'boolean' },
    { key: 'NEXT_PUBLIC_ANNOUNCEMENT', value: bool(true), category: 'features', data_type: 'boolean' },
    { key: 'NEXT_PUBLIC_MAINTENANCE_MODE', value: bool(false), category: 'features', data_type: 'boolean' },
    { key: 'NEXT_PUBLIC_ACCOUNT_VERIFICATION', value: bool(false), category: 'features', data_type: 'boolean' },
  ]
  for (const s of publicUpserts) {
    await pub.updateOne(
      { key: s.key },
      { $set: { key: s.key, value: s.value, category: s.category, updated_at: new Date(), updated_by_admin_id: 0, data_type: s.data_type } },
      { upsert: true }
    )
  }


  await client.close()

  console.log("\nSetup complete! Run 'cythrodash build' then 'cythrodash start' to launch the application.")
}

main().catch(err => {
  console.error('Setup failed:', err)
  process.exit(1)
})

