import { create } from 'zustand'

export type PublicConfig = Record<string, any>

type State = {
  config: PublicConfig
  loaded: boolean
  error?: string
  load: () => Promise<void>
  get: (key: string, fallback?: any) => any
}

export const usePublicSettingsStore = create<State>((set, get) => ({
  config: {},
  loaded: false,
  load: async () => {
    try {
      const res = await fetch('/api/config', { cache: 'no-store' })
      const json = await res.json()
      if (json?.success && json?.config) set({ config: json.config, loaded: true })
      else set({ config: {}, loaded: true })
    } catch (e: any) {
      set({ config: {}, loaded: true, error: e?.message || 'Failed to load public config' })
    }
  },
  get: (key, fallback) => {
    const cfg = get().config
    if (key in cfg) return cfg[key]
    // env fallback
    // @ts-ignore
    const envVal = process.env?.[key]
    return envVal !== undefined ? envVal : fallback
  }
}))

