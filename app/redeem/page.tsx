"use client"

import React from "react"
import { Sidebar, Header } from "@/components/LazyComponents"
import RedeemCodeCard from "@/components/redeem/RedeemCodeCard"
import LoadingOverlay from "@/components/LoadingOverlay"
import { useAppBootstrap } from "@/hooks/use-bootstrap"

export default function RedeemPage() {
  const { isLoading: bootLoading } = useAppBootstrap()
  return (
    <div className="min-h-screen bg-neutral-900">
      {bootLoading && <LoadingOverlay message="Preparing your dashboard..." />}
      <Sidebar isOpen={true} onToggle={() => {}} />
      <div className={`transition-all duration-200 lg:ml-72`}>
        <Header searchQuery={""} onSearchChange={() => {}} onMenuClick={() => {}} />
        <main className="p-8 max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white">Redeem Codes</h1>
            <p className="text-neutral-400 text-lg mt-1">Enter special codes to claim coin rewards and view your redemption history</p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <RedeemCodeCard />
          </div>
        </main>
      </div>
    </div>
  )
}

