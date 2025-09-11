#!/usr/bin/env node
/**
 * CythroDash New Admin CLI
 * Creates an admin user (role=0) directly in the cythro_dash_users collection.
 */

const readline = require('readline')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const { MongoClient } = require('mongodb')

async function prompt(question, { mask = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    const ask = () => {
      if (!mask) {
        rl.question(question, answer => { rl.close(); resolve(answer) })
        return
      }
      const originalWrite = rl._writeToOutput
      rl._writeToOutput = function (str) {
        if (typeof str === 'string' && str.includes(question)) {
          originalWrite.call(rl, str)
          return
        }
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

function isValidEmail(email) {
  return /.+@.+\..+/.test(email)
}

function generateReferralCode(username) {
  const ts = Date.now().toString(36)
  const rnd = Math.random().toString(36).substring(2, 8)
  return `${(username || '').substring(0,4).toUpperCase()}${ts}${rnd}`.toUpperCase()
}

async function getDbUri() {
  try {
    const cfg = require('../database/config-manager.js')
    if (cfg.getConfigSync) {
      const uri = cfg.getConfigSync('database.uri', process.env.MONGODB_URI)
      if (uri) return uri
    }
    if (cfg.getConfig) {
      const uri = await cfg.getConfig('database.uri', process.env.MONGODB_URI)
      if (uri) return uri
    }
  } catch {}
  const def = 'mongodb://localhost:27017/cythrodash'
  const input = await prompt(`MongoDB connection URI (default: ${def}): `)
  return (input && input.trim()) ? input.trim() : def
}

async function main() {
  console.log('CythroDash: Create Admin User')

  // Collect inputs
  const first_name = (await prompt('First name: ')).trim()
  const last_name = (await prompt('Last name: ')).trim()
  const username = (await prompt('Username: ')).trim()
  const email = (await prompt('Email: ')).trim().toLowerCase()
  const password = await prompt('Password: ', { mask: true })

  if (!first_name || !last_name || !username || !email || !password) {
    console.error('All fields are required. Aborting.')
    process.exit(1)
  }
  if (!isValidEmail(email)) {
    console.error('Invalid email format. Aborting.')
    process.exit(1)
  }

  const uri = await getDbUri()
  const client = new MongoClient(uri)

  try {
    await client.connect()
    const db = client.db()
    const col = db.collection('cythro_dash_users')

    // Ensure uniqueness
    const existing = await col.findOne({ $or: [{ username }, { email }] })
    if (existing) {
      console.error('A user with this username or email already exists. Aborting.')
      process.exit(1)
    }

    // Generate numeric id (next max + 1)
    const maxDoc = await col.find({}, { projection: { id: 1 } }).sort({ id: -1 }).limit(1).toArray()
    const id = (maxDoc[0]?.id ?? 0) + 1

    // Generate UUID for pterodactyl_uuid
    const pterodactyl_uuid = (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'))

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    const now = new Date()
    const userDoc = {
      id,
      pterodactyl_uuid,
      username,
      email,
      first_name,
      last_name,
      password: passwordHash,
      role: 0, // ADMIN
      verified: true,
      verified_at: now,
      two_factor_enabled: false,
      banned: false,
      deleted: false,
      security_pin: undefined,
      last_login: undefined,
      last_login_ip: undefined,
      failed_login_attempts: 0,
      oauth: {},
      coins: 0,
      total_coins_earned: 0,
      total_coins_spent: 0,
      referral_code: generateReferralCode(username),
      referral_earnings: 0,
      total_servers_created: 0,
      theme: 'dark',
      language: 'en',
      notifications_enabled: true,
      email_notifications: true,
      created_at: now,
      updated_at: now
    }

    await col.insertOne(userDoc)
    console.log('\nAdmin user created successfully:')
    console.log(`- id: ${id}`)
    console.log(`- username: ${username}`)
    console.log(`- email: ${email}`)
    console.log('\nYou can now log in with the credentials you provided.')
  } catch (e) {
    console.error('Failed to create admin user:', e)
    process.exit(1)
  } finally {
    try { await client.close() } catch {}
  }
}

main()

