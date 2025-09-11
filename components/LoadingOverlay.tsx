"use client"

import React from "react"

export default function LoadingOverlay({ message = "Preparing your dashboard..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-neutral-900/95">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-neutral-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-neutral-300 text-sm">{message}</p>
      </div>
    </div>
  )
}

