"use client"

import { create } from "zustand"
import { nanoid } from "nanoid"

type Notification = { id: string; title: string; message: string; read?: boolean }

type NotificationStore = {
  notifications: Notification[]
  push: (n: Omit<Notification, "id">) => void
  markAllRead: () => void
  clear: () => void
}

export const useNotificationStore = create<NotificationStore>()((set) => ({
  notifications: [],
  push: (n) => set(s => ({ notifications: [{ id: nanoid(), ...n }, ...s.notifications].slice(0, 30) })),
  markAllRead: () => set(s => ({ notifications: s.notifications.map(n => ({ ...n, read: true })) })),
  clear: () => set({ notifications: [] }),
}))
