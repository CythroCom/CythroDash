"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ArrowRight, Check, Server, MapPin, Package, CreditCard } from 'lucide-react'
import { showSuccess, showError } from '@/lib/toast'
import { useServerManagementStore } from '@/stores/server-management-store'
import type { ServerType, ServerSoftware, ServerLocation, ServerPlan } from '@/stores/server-management-store'
import { Sidebar, Header } from '@/components/LazyComponents'
import { useAuthStore } from '@/stores/user-store'
import { ServerCreationProtectedRoute } from '@/components/FeatureProtectedRoute'
import { Skeleton } from '@/components/ui/skeleton'

import { useCreditsStore } from '@/stores/credits-store'

interface WizardState {
  currentStep: number
  selectedServerType: ServerType | null
  selectedSoftware: ServerSoftware | null
  selectedLocation: ServerLocation | null
  selectedPlan: ServerPlan | null
  serverName: string
}

const STEPS = [
  { id: 1, title: 'Server Type', icon: Server },
  { id: 2, title: 'Software', icon: Package },
  { id: 3, title: 'Location', icon: MapPin },
  { id: 4, title: 'Plan', icon: CreditCard },
  { id: 5, title: 'Summary', icon: Check },
]

export default function CreateServerPage() {
  const router = useRouter()

  // Layout state
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const { isAuthenticated, currentUser, checkSession } = useAuthStore()

  useEffect(() => {
    void checkSession()
  }, [checkSession])

  const handleSidebarToggle = () => setSidebarOpen((s) => !s)
  const handleMenuClick = () => setSidebarOpen(true)
  const handleSearchChange = (q: string) => setSearchQuery(q)

  const [wizardState, setWizardState] = useState<WizardState>({
    currentStep: 1,
    selectedServerType: null,
    selectedSoftware: null,
    selectedLocation: null,
    selectedPlan: null,
    serverName: '',
  })

  const {
    serverTypes,
    serverSoftware,
    locations,
    plans,
    userPermissions,
    isLoading,
    isCreatingServer,
    fetchServerTypes,
    fetchServerSoftware,
    fetchLocations,
    fetchPlans,
    createServer,
  } = useServerManagementStore()


  const { credits, lastFetch: creditsLastFetch, fetchCredits } = useCreditsStore()

  // Load initial data
  useEffect(() => {
    void fetchServerTypes()
    void fetchLocations()
  }, [fetchServerTypes, fetchLocations])

  // Load software when server type is selected
  useEffect(() => {
    if (wizardState.selectedServerType) {
      void fetchServerSoftware(wizardState.selectedServerType.id)
    }
  }, [wizardState.selectedServerType, fetchServerSoftware])

  // Reset dependent selections when earlier choices change
  useEffect(() => {
    // If server type changes, clear software and plan selections
    setWizardState(prev => ({ ...prev, selectedSoftware: null, selectedPlan: null }))
  }, [wizardState.selectedServerType?.id])

  useEffect(() => {
    // If location changes, clear plan selection and fetch plans filtered by server type
    if (wizardState.selectedLocation) {
      setWizardState(prev => ({ ...prev, selectedPlan: null }))
      const serverTypeId = wizardState.selectedServerType?.id
      void fetchPlans(wizardState.selectedLocation.id, serverTypeId ? { server_type_id: serverTypeId } : {})
    }
  }, [wizardState.selectedLocation, wizardState.selectedServerType?.id, fetchPlans])

  // Ensure credits are fresh on Summary step
  useEffect(() => {
    if (isAuthenticated && wizardState.currentStep === 5) {
      void fetchCredits()
    }
  }, [isAuthenticated, wizardState.currentStep, fetchCredits])


  const nextStep = () => {
    if (wizardState.currentStep < STEPS.length) {
      setWizardState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }))
    }
  }

  const prevStep = () => {
    if (wizardState.currentStep > 1) {
      setWizardState(prev => ({ ...prev, currentStep: prev.currentStep - 1 }))
    }
  }

  const canProceed = () => {
    switch (wizardState.currentStep) {
      case 1: return wizardState.selectedServerType !== null
      case 2: return wizardState.selectedSoftware !== null
      case 3: return wizardState.selectedLocation !== null
      case 4: return wizardState.selectedPlan !== null
      case 5: return wizardState.serverName.trim().length > 0
      default: return false
    }
  }

  const handleCreateServer = async () => {
    if (!canProceed() || !wizardState.selectedServerType || !wizardState.selectedSoftware ||
        !wizardState.selectedLocation || !wizardState.selectedPlan) return

    try {
      const result = await createServer({
        name: wizardState.serverName,
        server_type_id: wizardState.selectedServerType.id,
        server_software_id: wizardState.selectedSoftware.id,
        location_id: wizardState.selectedLocation.id,
        plan_id: wizardState.selectedPlan.id,
      })

      if (result.success) {
        showSuccess(result.message || 'Server created successfully!')
        router.push('/')
      } else {
        showError(result.message || 'Failed to create server. Please try again.')
      }
    } catch (error) {
      showError('Failed to create server. Please try again.')
    }
  }

  const progressPercentage = (wizardState.currentStep / STEPS.length) * 100
  const totalDueNow = (wizardState.selectedPlan?.setup_fee || 0)
  const knownCredits = creditsLastFetch > 0 ? credits : undefined
  const availableCredits = (knownCredits ?? userPermissions?.current_balance ?? currentUser?.coins ?? 0)
  const hasSufficientCredits = availableCredits >= totalDueNow

  // If not authenticated, show the standard layout with a prompt (still gated by feature flag)
  if (!isAuthenticated || !currentUser) {
    return (
      <ServerCreationProtectedRoute>
        <div className="min-h-screen bg-neutral-900">
          <Sidebar isOpen={sidebarOpen} onToggle={handleSidebarToggle} />
          <div className={`transition-all duration-200 ${sidebarOpen ? 'lg:ml-72' : 'lg:ml-16'}`}>
            <Header
              title="Create Server"
              subtitle="Follow the steps below to create your server"
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              onMenuClick={handleMenuClick}
            />
            <main className="p-6">
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="max-w-md text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">Authentication required</h2>
                  <p className="text-neutral-400">Please log in to create a server.</p>
                </div>
              </div>
            </main>
          </div>
        </div>
      </ServerCreationProtectedRoute>
    )
  }

  return (
    <ServerCreationProtectedRoute>
      <div className="min-h-screen bg-neutral-900">
      <Sidebar isOpen={sidebarOpen} onToggle={handleSidebarToggle} />
      <div className={`transition-all duration-200 ${sidebarOpen ? 'lg:ml-72' : 'lg:ml-16'}`}>
        <Header
          title="Create Server"
          subtitle="Follow the steps below to create your server"
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onMenuClick={handleMenuClick}
        />

        <main className="p-6">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {STEPS.map((step, index) => {
                const Icon = step.icon
                const isActive = wizardState.currentStep === step.id
                const isCompleted = wizardState.currentStep > step.id

                return (
                  <div key={step.id} className="flex items-center">
                    <div className={`
                      flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                      ${isCompleted ? 'bg-green-500 border-green-500 text-white' :
                        isActive ? 'bg-blue-500 border-blue-500 text-white' :
                        'bg-neutral-700 border-neutral-600 text-neutral-400'}
                   `}>
                      {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    <span className={`ml-2 text-sm font-medium ${
                      isActive ? 'text-white' : isCompleted ? 'text-green-400' : 'text-neutral-400'
                    }`}>
                      {step.title}
                    </span>
                    {index < STEPS.length - 1 && (
                      <div className={`w-16 h-0.5 mx-4 ${
                        isCompleted ? 'bg-green-500' : 'bg-neutral-600'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="w-full bg-neutral-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Step Content */}
          <Card className="border-neutral-700 bg-neutral-800/50 mb-8">
            <CardContent className="p-8">
              {wizardState.currentStep === 1 && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Select Server Type</h2>
                  <p className="text-neutral-400 mb-6">Choose the type of server you want to create</p>

                  {serverTypes.length === 0 ? (
                    isLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <Skeleton key={i} className="h-36 w-full bg-neutral-800" />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-neutral-400">No server types available</p>
                      </div>
                    )
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {serverTypes.map((type) => (
                        <Card
                          key={type.id}
                          className={`cursor-pointer transition-all border-2 ${
                            wizardState.selectedServerType?.id === type.id
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-neutral-600 hover:border-neutral-500 bg-neutral-700/50'
                          }`}
                          onClick={() => setWizardState(prev => ({ ...prev, selectedServerType: type }))}
                        >
                          <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-3">
                              {type.icon && (
                                <img src={type.icon} alt={type.name} className="w-8 h-8" />
                              )}
                              <h3 className="text-lg font-semibold text-white">{type.name}</h3>
                              {type.popular && <Badge className="bg-orange-500/20 text-orange-400">Popular</Badge>}
                              {type.featured && <Badge className="bg-yellow-500/20 text-yellow-400">Featured</Badge>}
                            </div>
                            <p className="text-neutral-400 text-sm mb-3">{type.short_description}</p>
                            <div className="text-xs text-neutral-500">
                              Min: {type.min_resources.memory}MB RAM, {type.min_resources.disk}MB Disk
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {wizardState.currentStep === 2 && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Select Server Software</h2>
                  <p className="text-neutral-400 mb-6">Choose the software for your {wizardState.selectedServerType?.name} server</p>

                  {serverSoftware.length === 0 ? (
                    isLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-28 w-full bg-neutral-800" />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-neutral-400">No software available for this server type</p>
                      </div>
                    )
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {serverSoftware.map((software) => (
                        <Card
                          key={software.id}
                          className={`cursor-pointer transition-all border-2 ${
                            wizardState.selectedSoftware?.id === software.id
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-neutral-600 hover:border-neutral-500 bg-neutral-700/50'
                          }`}
                          onClick={() => setWizardState(prev => ({ ...prev, selectedSoftware: software }))}
                        >
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg font-semibold text-white">{software.name}</h3>
                              <div className="flex gap-2">
                                {software.recommended && <Badge className="bg-green-500/20 text-green-400">Recommended</Badge>}
                                {software.latest && <Badge className="bg-blue-500/20 text-blue-400">Latest</Badge>}
                              </div>
                            </div>
                            <p className="text-neutral-400 text-sm mb-2">Version: {software.version}</p>
                            {software.short_description && (
                              <p className="text-neutral-400 text-sm mb-3">{software.short_description}</p>
                            )}
                            <div className="text-xs text-neutral-500">
                              Stability: {software.stability}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {wizardState.currentStep === 3 && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Select Location</h2>
                  <p className="text-neutral-400 mb-6">Choose where your server will be hosted</p>

                  {locations.length === 0 ? (
                    isLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <Skeleton key={i} className="h-28 w-full bg-neutral-800" />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-neutral-400">No locations available</p>
                      </div>
                    )
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {locations.map((location) => (
                        <Card
                          key={location.id}
                          className={`cursor-pointer transition-all border-2 ${
                            wizardState.selectedLocation?.id === location.id
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-neutral-600 hover:border-neutral-500 bg-neutral-700/50'
                          }`}
                          onClick={() => setWizardState(prev => ({ ...prev, selectedLocation: location }))}
                        >
                          <CardContent className="p-6">
                            <h3 className="text-lg font-semibold text-white mb-2">{location.name}</h3>
                            {(location.city || location.country) && (
                              <p className="text-neutral-400 text-sm mb-3">
                                {location.city}{location.city && location.country ? ', ' : ''}{location.country}
                              </p>
                            )}
                            <div className="space-y-1">
                              {location.features?.ddos_protection && (
                                <Badge variant="outline" className="text-xs mr-1">DDoS Protection</Badge>
                              )}
                              {location.features?.ssd_storage && (
                                <Badge variant="outline" className="text-xs mr-1">SSD Storage</Badge>
                              )}
                              {location.features?.backup_storage && (
                                <Badge variant="outline" className="text-xs mr-1">Backup Storage</Badge>
                              )}
                              {location.features?.high_availability && (
                                <Badge variant="outline" className="text-xs">High Availability</Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {wizardState.currentStep === 4 && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Select Plan</h2>
                  <p className="text-neutral-400 mb-6">Choose a hosting plan that fits your needs</p>

                  {plans.length === 0 ? (
                    isLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <Skeleton key={i} className="h-40 w-full bg-neutral-800" />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-neutral-400">No plans available for the selected location</p>
                      </div>
                    )
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {plans.map((plan) => (
                        <Card
                          key={plan.id}
                          className={`cursor-pointer transition-all border-2 ${
                            wizardState.selectedPlan?.id === plan.id
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-neutral-600 hover:border-neutral-500 bg-neutral-700/50'
                          }`}
                          onClick={() => setWizardState(prev => ({ ...prev, selectedPlan: plan }))}
                        >
                          <CardContent className="p-6">
                            <div className="text-center mb-4">
                              <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                              {plan.description && <p className="text-neutral-400 text-sm">{plan.description}</p>}
                              <div className="mt-2">
                                <span className="text-3xl font-bold text-white">${(plan.effective_price ?? plan.original_price ?? 0).toFixed(2)}</span>
                                <span className="text-neutral-400">/{plan.billing_cycle}</span>
                              </div>
                              {plan.setup_fee && plan.setup_fee > 0 && (
                                <p className="text-xs text-neutral-500">Setup fee: ${plan.setup_fee}</p>
                              )}
                            </div>

                            <div className="space-y-2 mb-4">
                              <div className="flex justify-between text-sm">
                                <span className="text-neutral-400">Memory:</span>
                                <span className="text-white">{plan.resources.memory}MB</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-neutral-400">Disk:</span>
                                <span className="text-white">{plan.resources.disk}MB</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-neutral-400">CPU:</span>
                                <span className="text-white">{plan.resources.cpu} Core(s)</span>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1">
                              {Array.isArray(plan.features) && plan.features.slice(0, 6).map((f) => (
                                <Badge key={f} variant="outline" className="text-xs mr-1">{f}</Badge>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {wizardState.currentStep === 5 && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Summary & Purchase</h2>
                  <p className="text-neutral-400 mb-6">Review your selections and complete the purchase</p>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="serverName" className="text-neutral-200">Server Name *</Label>
                        <Input
                          id="serverName"
                          value={wizardState.serverName}
                          onChange={(e) => setWizardState(prev => ({ ...prev, serverName: e.target.value }))}
                          placeholder="Enter server name"
                          className="bg-neutral-700/50 border-neutral-600/50"
                          required
                        />
                      </div>

                      <Card className="border-neutral-600 bg-neutral-700/30">
                        <CardHeader>
                          <CardTitle className="text-white">Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Server Type:</span>
                            <span className="text-white">{wizardState.selectedServerType?.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Software:</span>
                            <span className="text-white">{wizardState.selectedSoftware?.name} {wizardState.selectedSoftware?.version}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Location:</span>
                            <span className="text-white">{wizardState.selectedLocation?.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Plan:</span>
                            <span className="text-white">{wizardState.selectedPlan?.name}</span>
                          </div>
                          <hr className="border-neutral-600" />
                          <div className="flex justify-between">
                            <span className="text-neutral-400">Due now:</span>
                            <span className="text-white">
                              ${ (wizardState.selectedPlan?.setup_fee || 0).toFixed(2) }
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-neutral-500">Recurring:</span>
                            <span className="text-neutral-300">
                              ${ (wizardState.selectedPlan?.effective_price ?? 0).toFixed(2) }/{wizardState.selectedPlan?.billing_cycle}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-4">
                      <Card className="border-neutral-600 bg-neutral-700/30">
                        <CardHeader>
                          <CardTitle className="text-white">Your Balance</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between text-lg">
                            <span className="text-neutral-400">Credits:</span>
                            <span className="text-white">${availableCredits.toFixed(2)}</span>
                          </div>
                          <div className="text-sm text-neutral-400">
                            You need at least the setup fee available to proceed.
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={wizardState.currentStep === 1}
              className="border-neutral-600 hover:bg-neutral-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            {wizardState.currentStep === STEPS.length ? (
              <Button
                onClick={handleCreateServer}
                disabled={!canProceed() || isCreatingServer || !hasSufficientCredits}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isCreatingServer ? 'Creating...' : 'Create Server'}
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </main>
      </div>
      </div>

    </ServerCreationProtectedRoute>
  )
}
