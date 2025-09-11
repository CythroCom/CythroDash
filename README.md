# CythroDash

Advanced, modern dashboard for game server management built around Pterodactyl — with a clean UI, useful features, security, and a safe upgrade flow.

## Features
- Neutral, responsive UI
- Server management with plans, locations, server types, and software
- OAuth integrations (Discord/GitHub) with connect and login flows
- Referral system
- Earn system
- Redeem Code system
- Transfers system
- Robust setup scripts (interactive) and unified installer
- CLI utilities: status, install, setup:all, upgrade, build, start
- Safe upgrades that back up DB settings and preserve local config/


## Requirements
- Node.js >= 18
- Git
- MongoDB 6+

## Quick Install
The fastest way to get running is with the installer (clones repo, installs deps, runs setup-all, builds, and starts):

```bash
npx cythrodash install my-cythrodash
```

This will:
1) Clone https://github.com/CythroCom/CythroDash.git into my-cythrodash folder
2) Run `npm install`
3) Run the comprehensive setup (generate secrets, configure DB, create admin)
4) Build and start the application

## Manual Setup
```bash
# Clone and install
git clone https://github.com/CythroCom/CythroDash.git
cd CythroDash
npm install

# Guided setup and admin creation (end-to-end)
npx cythrodash setup:all

# Or step-by-step
npx cythrodash setup
npx cythrodash newadmin
npx cythrodash build
npx cythrodash start
```

## CLI Overview
- Status (default):
  ```bash
  npx cythrodash
  # or
  npx cythrodash status
  ```
  Shows local vs. remote version, DB connectivity, public URL, and health.

- Upgrade:
  ```bash
  npx cythrodash upgrade [--force] [--dry-run] [--channel stable|beta|dev]
  ```
  Backs up config/ and DB settings, fetches latest from GitHub, restores local config, runs migrations (if any), builds, and supports rollback on build failure.

- Install:
  ```bash
  npx cythrodash install [targetDir]
  ```
  Clones the repo, installs dependencies, and performs full setup.

## Configuration & Secrets
- Local runtime configuration lives under `config/` (gitignored).
  - `config/secure.key` – encryption key for at-rest secrets in DB
  - `config/db.uri` – bootstrap file for DB connectivity
- The setup scripts generate and/or update configuration as needed.
- Upgrades always preserve and restore your local `config/` directory.

## Version Management
- The repository ships with `version.json`:
  - `version`, `releaseDate`, `notes`, `minNode`, `breakingChanges`, and `channels`
- CLI automatically checks for newer versions and notifies on any command.
- `status` shows local vs latest; `upgrade` compares semver and applies changes.

## Development
```bash
npm run dev
```
- Lint & types: `npm run lint:all`
- Build: `npx next build`

## Contributing
Contributions are welcome!
- Fork the repository and create a feature branch
- Follow the neutral design and established patterns
- Add or update tests where appropriate
- Run lint/build before submitting PRs

## Contributors
- Cythro Team
- Community contributors — thank you for your support!

## License
Licensed under the Cythro License.

© Cythro. All rights reserved.

