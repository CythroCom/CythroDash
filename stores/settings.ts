"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

// Theme types
export type ThemeName =
  | "dark"
  | "light"
  | "midnight"
  | "ocean"
  | "forest"
  | "sunset"
  | "purple"
  | "cyberpunk"

export type ThemeConfig = {
  name: ThemeName
  displayName: string
  description: string
  colors: {
    background: string
    foreground: string
    primary: string
    secondary: string
    accent: string
    muted: string
    border: string
    brandFrom: string
    brandTo: string
  }
}

// Predefined themes
export const THEMES: Record<ThemeName, ThemeConfig> = {
  dark: {
    name: "dark",
    displayName: "Dark",
    description: "Classic dark theme",
    colors: {
      background: "hsl(222.2 84% 4.9%)",
      foreground: "hsl(210 40% 98%)",
      primary: "hsl(210 40% 98%)",
      secondary: "hsl(217.2 32.6% 17.5%)",
      accent: "hsl(217.2 32.6% 17.5%)",
      muted: "hsl(217.2 32.6% 17.5%)",
      border: "hsl(217.2 32.6% 17.5%)",
      brandFrom: "rgb(20,136,204)",
      brandTo: "rgb(43,50,178)"
    }
  },
  light: {
    name: "light",
    displayName: "Light",
    description: "Clean light theme",
    colors: {
      background: "hsl(0 0% 100%)",
      foreground: "hsl(222.2 84% 4.9%)",
      primary: "hsl(222.2 84% 4.9%)",
      secondary: "hsl(210 40% 96%)",
      accent: "hsl(210 40% 96%)",
      muted: "hsl(210 40% 96%)",
      border: "hsl(214.3 31.8% 91.4%)",
      brandFrom: "rgb(20,136,204)",
      brandTo: "rgb(43,50,178)"
    }
  },
  midnight: {
    name: "midnight",
    displayName: "Midnight",
    description: "Deep blue midnight theme",
    colors: {
      background: "hsl(220 27% 8%)",
      foreground: "hsl(210 40% 98%)",
      primary: "hsl(210 40% 98%)",
      secondary: "hsl(220 27% 12%)",
      accent: "hsl(220 27% 12%)",
      muted: "hsl(220 27% 12%)",
      border: "hsl(220 27% 12%)",
      brandFrom: "rgb(59,130,246)",
      brandTo: "rgb(147,51,234)"
    }
  },
  ocean: {
    name: "ocean",
    displayName: "Ocean",
    description: "Deep ocean blue theme",
    colors: {
      background: "hsl(200 50% 6%)",
      foreground: "hsl(200 20% 98%)",
      primary: "hsl(200 20% 98%)",
      secondary: "hsl(200 50% 10%)",
      accent: "hsl(200 50% 10%)",
      muted: "hsl(200 50% 10%)",
      border: "hsl(200 50% 10%)",
      brandFrom: "rgb(6,182,212)",
      brandTo: "rgb(59,130,246)"
    }
  },
  forest: {
    name: "forest",
    displayName: "Forest",
    description: "Natural green forest theme",
    colors: {
      background: "hsl(120 20% 8%)",
      foreground: "hsl(120 10% 98%)",
      primary: "hsl(120 10% 98%)",
      secondary: "hsl(120 20% 12%)",
      accent: "hsl(120 20% 12%)",
      muted: "hsl(120 20% 12%)",
      border: "hsl(120 20% 12%)",
      brandFrom: "rgb(34,197,94)",
      brandTo: "rgb(16,185,129)"
    }
  },
  sunset: {
    name: "sunset",
    displayName: "Sunset",
    description: "Warm sunset orange theme",
    colors: {
      background: "hsl(20 30% 8%)",
      foreground: "hsl(20 10% 98%)",
      primary: "hsl(20 10% 98%)",
      secondary: "hsl(20 30% 12%)",
      accent: "hsl(20 30% 12%)",
      muted: "hsl(20 30% 12%)",
      border: "hsl(20 30% 12%)",
      brandFrom: "rgb(251,146,60)",
      brandTo: "rgb(239,68,68)"
    }
  },
  purple: {
    name: "purple",
    displayName: "Purple",
    description: "Royal purple theme",
    colors: {
      background: "hsl(270 30% 8%)",
      foreground: "hsl(270 10% 98%)",
      primary: "hsl(270 10% 98%)",
      secondary: "hsl(270 30% 12%)",
      accent: "hsl(270 30% 12%)",
      muted: "hsl(270 30% 12%)",
      border: "hsl(270 30% 12%)",
      brandFrom: "rgb(147,51,234)",
      brandTo: "rgb(168,85,247)"
    }
  },
  cyberpunk: {
    name: "cyberpunk",
    displayName: "Cyberpunk",
    description: "Neon cyberpunk theme",
    colors: {
      background: "hsl(300 20% 6%)",
      foreground: "hsl(300 10% 98%)",
      primary: "hsl(300 10% 98%)",
      secondary: "hsl(300 20% 10%)",
      accent: "hsl(300 20% 10%)",
      muted: "hsl(300 20% 10%)",
      border: "hsl(300 20% 10%)",
      brandFrom: "rgb(236,72,153)",
      brandTo: "rgb(168,85,247)"
    }
  }
}

type AppSettings = {
  // Panel settings
  panelUrl: string
  setPanelUrl: (url: string) => void
  logoDataUrl?: string | null
  setLogo: (dataUrl: string | null) => void

  // Theme settings
  currentTheme: ThemeName
  setTheme: (theme: ThemeName) => void
  applyTheme: (theme: ThemeName) => void

  // User preferences
  language: string
  setLanguage: (lang: string) => void
  timezone: string
  setTimezone: (tz: string) => void

  // Notification settings
  emailNotifications: boolean
  setEmailNotifications: (enabled: boolean) => void
  pushNotifications: boolean
  setPushNotifications: (enabled: boolean) => void
}

export const useAppSettings = create<AppSettings>()(
  persist(
    (set, get) => ({
      // Panel settings (public config with env fallback)
      panelUrl: (() => { try { const { usePublicSettingsStore } = require('@/stores/public-settings-store'); return usePublicSettingsStore.getState().get('NEXT_PUBLIC_PANEL_URL', process.env.NEXT_PUBLIC_PANEL_URL) || '' } catch { return process.env.NEXT_PUBLIC_PANEL_URL ?? '' } })(),
      setPanelUrl: (url) => set({ panelUrl: url }),
      logoDataUrl: null,
      setLogo: (dataUrl) => set({ logoDataUrl: dataUrl }),

      // Theme settings
      currentTheme: "dark",
      setTheme: async (theme: ThemeName) => {
        const { applyTheme } = get()

        // Apply theme to UI immediately for better UX
        applyTheme(theme)

        // Update store immediately
        set({ currentTheme: theme })

        // Update user preference in database with proper user ID
        try {
          // Get current user from auth store
          const { useAuthStore } = await import('./user-store')
          const currentUser = useAuthStore.getState().currentUser

          if (!currentUser) {
            console.error('No user logged in, cannot save theme preference')
            return
          }

          console.log('Saving theme preference to database:', theme)

          const response = await fetch('/api/user/preferences', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              user_id: currentUser.id,
              theme
            })
          })

          const result = await response.json()
          console.log('Theme preference save result:', result)

          if (!response.ok || !result.success) {
            console.error('Failed to update theme preference in database:', result.message)
          } else {
            console.log('Theme preference saved successfully to database')
          }
        } catch (error) {
          console.error('Failed to update theme preference:', error)
        }
      },

      applyTheme: (theme: ThemeName) => {
        const themeConfig = THEMES[theme]
        if (!themeConfig) return

        const root = document.documentElement

        // Apply CSS custom properties
        Object.entries(themeConfig.colors).forEach(([key, value]) => {
          const cssVar = key.replace(/([A-Z])/g, '-$1').toLowerCase()
          root.style.setProperty(`--${cssVar}`, value)
        })

        // Apply theme class
        root.classList.remove(...Object.keys(THEMES))
        root.classList.add(theme)

        // Store in localStorage for immediate persistence
        localStorage.setItem('app-theme', theme)
      },

      // User preferences
      language: "en",
      setLanguage: (lang) => set({ language: lang }),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      setTimezone: (tz) => set({ timezone: tz }),

      // Notification settings
      emailNotifications: true,
      setEmailNotifications: (enabled) => set({ emailNotifications: enabled }),
      pushNotifications: true,
      setPushNotifications: (enabled) => set({ pushNotifications: enabled }),
    }),
    {
      name: "app-settings",
      onRehydrateStorage: () => (state) => {
        if (state?.currentTheme) {
          state.applyTheme(state.currentTheme)
        }
      }
    }
  )
)