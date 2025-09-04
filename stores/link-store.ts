"use client"

import { create } from "zustand"

type Link = { slug: string; target: string }

type LinkStore = {
  links: Link[]
  add: (l: Link) => void
  remove: (slug: string) => void
}

export const useLinkStore = create<LinkStore>()((set) => ({
  links: [],
  add: (l) => set(s => ({ links: [l, ...s.links] })),
  remove: (slug) => set(s => ({ links: s.links.filter(x => x.slug !== slug) })),
}))
