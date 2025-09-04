"use client"

import React, { useEffect, useState } from "react"
import { useServiceWorker } from "@/lib/serviceWorker"

interface ServiceWorkerProviderProps {
  children: React.ReactNode
}

const ServiceWorkerProvider: React.FC<ServiceWorkerProviderProps> = ({ children }) => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)

  const {
    updateAvailable,
    isInstallable,
    isStandalone,
    skipWaiting,
    showInstallPrompt: triggerInstallPrompt
  } = useServiceWorker({
    onUpdate: () => {
      setShowUpdatePrompt(true)
    },
    onSuccess: () => {
      console.log("Service Worker registered successfully")
    },
    onError: (error) => {
      console.error("Service Worker registration failed:", error)
    }
  })

  // Show install prompt for PWA
  useEffect(() => {
    if (isInstallable && !isStandalone) {
      // Delay showing install prompt to avoid being intrusive
      const timer = setTimeout(() => {
        setShowInstallPrompt(true)
      }, 10000) // Show after 10 seconds

      return () => clearTimeout(timer)
    }
  }, [isInstallable, isStandalone])

  const handleUpdate = async () => {
    await skipWaiting()
    setShowUpdatePrompt(false)
    window.location.reload()
  }

  const handleInstall = async () => {
    const installed = await triggerInstallPrompt()
    if (installed) {
      setShowInstallPrompt(false)
    }
  }

  return (
    <>
      {children}
      
      {/* Update Available Notification */}
      {showUpdatePrompt && (
        <div className="fixed bottom-4 right-4 z-50 bg-neutral-800 border border-neutral-600 rounded-lg p-4 shadow-lg max-w-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-white font-medium">Update Available</h4>
              <p className="text-neutral-400 text-sm mt-1">
                A new version of the app is available. Update now for the latest features and improvements.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleUpdate}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                >
                  Update
                </button>
                <button
                  onClick={() => setShowUpdatePrompt(false)}
                  className="px-3 py-1 bg-neutral-600 text-white text-sm rounded hover:bg-neutral-700 transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowUpdatePrompt(false)}
              className="text-neutral-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Install PWA Prompt */}
      {showInstallPrompt && (
        <div className="fixed bottom-4 left-4 z-50 bg-neutral-800 border border-neutral-600 rounded-lg p-4 shadow-lg max-w-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-white font-medium">Install App</h4>
              <p className="text-neutral-400 text-sm mt-1">
                Install Pterodactyl Dashboard for quick access and offline functionality.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleInstall}
                  className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                >
                  Install
                </button>
                <button
                  onClick={() => setShowInstallPrompt(false)}
                  className="px-3 py-1 bg-neutral-600 text-white text-sm rounded hover:bg-neutral-700 transition-colors"
                >
                  Not Now
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowInstallPrompt(false)}
              className="text-neutral-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default ServiceWorkerProvider
