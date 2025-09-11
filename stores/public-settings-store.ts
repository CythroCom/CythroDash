import { create } from 'zustand'

export type PublicConfig = Record<string, any>

type State = {
  config: PublicConfig
  loaded: boolean
  loading: boolean
  error?: string
  load: (force?: boolean) => Promise<void>
  get: (key: string, fallback?: any) => any
}

let bc: BroadcastChannel | null = null

export const usePublicSettingsStore = create<State>((set, get) => ({
  config: {},
  loaded: false,
  loading: false,
  load: async (force?: boolean) => {
    // Setup broadcast channel once on first load in browser
    if (typeof window !== 'undefined' && !bc) {
      try {
        bc = new BroadcastChannel('public-settings-updated')
        bc.onmessage = () => {
          // Force reload when settings change elsewhere
          void get().load(true)
        }
      } catch {
        // ignore if BroadcastChannel unsupported
      }
    }

    if (get().loaded && !force) return
    set({ loading: true })
    try {
      const res = await fetch('/api/config', { cache: 'no-store' })
      const json = await res.json()
      if (json?.success && json?.config) set({ config: json.config, loaded: true, loading: false })
      else set({ config: {}, loaded: true, loading: false })
    } catch (e: any) {
      set({ config: {}, loaded: true, loading: false, error: e?.message || 'Failed to load public config' })
    }
  },
  get: (key, fallback) => {
    const cfg = get().config
    if (key in cfg) return cfg[key]
    return fallback
  }
}))

