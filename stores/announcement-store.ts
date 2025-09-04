"use client"

import { create } from "zustand"
import { nanoid } from "nanoid"

type Announcement = { id: string; title: string; body: string; createdAt: string }

type AnnouncementStore = {
  announcements: Announcement[]
  add: (a: Omit<Announcement, "id" | "createdAt">) => void
  remove: (id: string) => void
}

export const useAnnouncementStore = create<AnnouncementStore>()((set) => ({
  announcements: [],
  add: (a) => set(s => ({ announcements: [{ id: nanoid(), title: a.title, body: a.body, createdAt: new Date().toISOString() }, ...s.announcements] })),
  remove: (id) => set(s => ({ announcements: s.announcements.filter(x => x.id !== id) })),
}))
