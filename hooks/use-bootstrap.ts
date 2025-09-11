"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuthStore } from "@/stores/user-store"
import { usePublicSettingsStore } from "@/stores/public-settings-store"

export function useAppBootstrap() {
  const checkSession = useAuthStore(s => s.checkSession)
  const settingsLoading = usePublicSettingsStore(s => s.loading)
  const loadSettings = usePublicSettingsStore(s => s.load)
  const [bootstrapping, setBootstrapping] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Kick both in parallel
        await Promise.all([
          (async () => { try { await checkSession() } catch (_) {} })(),
          (async () => { try { await loadSettings(true) } catch (_) {} })(),
        ])
      } finally {
        if (!cancelled) setBootstrapping(false)
      }
    })()
    return () => { cancelled = true }
  }, [checkSession, loadSettings])

  const isLoading = bootstrapping || settingsLoading
  return useMemo(() => ({ isLoading }), [isLoading])
}

