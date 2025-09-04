"use client"

import React, { memo, useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { showError, showSuccess } from "@/lib/toast"
import { InputField, CheckboxField } from "@/components/forms/FormField"
import { useAuthStore, type LoginCredentials } from "@/stores/user-store"
import { usePerformanceMonitor } from "@/hooks/usePerformance"
import { useIntersectionAnimation } from "@/hooks/useAnimations"
import Icon from "@/components/IconProvider"

// Validation schema
const loginSchema = z.object({
  identifier: z.string()
    .min(1, "Email or username is required")
    .refine(
      (value) => {
        // Check if it's a valid email or username (3+ chars)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const usernameRegex = /^[a-zA-Z0-9_]{3,}$/
        return emailRegex.test(value) || usernameRegex.test(value)
      },
      "Please enter a valid email address or username (3+ characters)"
    ),
  password: z.string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password is too long"),
  remember_me: z.boolean().optional()
})

type LoginFormData = z.infer<typeof loginSchema>

interface LoginFormProps {
  onSuccess?: () => void
  onRegisterClick?: () => void
  className?: string
}

const LoginForm = memo(({ onSuccess, onRegisterClick, className = "" }: LoginFormProps) => {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  
  // Performance monitoring
  usePerformanceMonitor("LoginForm")
  
  // Animation on scroll into view
  const { elementRef } = useIntersectionAnimation({}, 'animate-fade-in')
  
  // Auth store
  const { login, isLoading } = useAuthStore()
  
  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch,
    reset
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: {
      identifier: "",
      password: "",
      remember_me: false
    }
  })

  const watchedValues = watch()

  // Memoized submit handler
  const onSubmit = useCallback(async (data: LoginFormData) => {
    if (isSubmitting || isLoading) return

    setIsSubmitting(true)
    setServerError(null)

    try {
      const credentials: LoginCredentials = {
        identifier: data.identifier.trim(),
        password: data.password,
        remember_me: data.remember_me
      }

      const result = await login(credentials)

      if (result.success) {
        reset()
        showSuccess('Signed in successfully')
        if (onSuccess) {
          onSuccess()
        } else {
          router.push("/")
        }
      } else {
        const msg = result.errors && Array.isArray(result.errors)
          ? result.errors.join(", ")
          : (result.message || "Login failed. Please try again.")
        setServerError(msg)
        showError('Login failed', msg)
      }
    } catch (error) {
      console.error("Login error:", error)
      setServerError("An unexpected error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, isLoading, login, reset, onSuccess, router])

  // Memoized field change handlers
  const handleIdentifierChange = useCallback((value: string) => {
    setValue("identifier", value, { shouldValidate: true })
    if (serverError) setServerError(null)
  }, [setValue, serverError])

  const handlePasswordChange = useCallback((value: string) => {
    setValue("password", value, { shouldValidate: true })
    if (serverError) setServerError(null)
  }, [setValue, serverError])

  const handleRememberMeChange = useCallback((checked: boolean) => {
    setValue("remember_me", checked)
  }, [setValue])

  const handleRegisterClick = useCallback(() => {
    onRegisterClick?.()
  }, [onRegisterClick])

  const isFormDisabled = isSubmitting || isLoading

  return (
    <Card
      ref={elementRef as any}
      className={`w-full max-w-md mx-auto card-optimized bg-neutral-800/40 border border-neutral-700/50 backdrop-blur ${className}`}
    >
      <CardHeader className="space-y-1 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-neutral-700 to-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-neutral-600/40 shadow-lg">
          <Icon name="Lock" className="h-8 w-8 text-neutral-200" />
        </div>
        <CardTitle className="text-2xl font-bold text-white">Welcome Back</CardTitle>
        <CardDescription className="text-neutral-400">
          Sign in to your Pterodactyl Dashboard account
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {serverError && (
          <Alert className="border-neutral-600/40 bg-neutral-800/60">
            <Icon name="AlertCircle" className="h-4 w-4 text-neutral-300" />
            <AlertDescription className="text-neutral-300">
              {serverError}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <InputField
            {...register("identifier")}
            label="Email or Username"
            type="text"
            placeholder="Enter your email or username"
            value={watchedValues.identifier}
            onChange={handleIdentifierChange}
            error={errors.identifier?.message}
            disabled={isFormDisabled}
            autoComplete="username"
            icon={<Icon name="User" className="h-4 w-4" />}
            required
          />

          <InputField
            {...register("password")}
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={watchedValues.password}
            onChange={handlePasswordChange}
            error={errors.password?.message}
            disabled={isFormDisabled}
            autoComplete="current-password"
            icon={<Icon name="Lock" className="h-4 w-4" />}
            showPasswordToggle
            required
          />

          <div className="flex items-center justify-between">
            <CheckboxField
              {...register("remember_me")}
              checked={watchedValues.remember_me}
              onChange={handleRememberMeChange}
              disabled={isFormDisabled}
              label="Remember me"
            />
            
            <Button
              type="button"
              variant="link"
              className="text-neutral-300 hover:text-white p-0 h-auto text-sm"
              disabled={isFormDisabled}
            >
              Forgot password?
            </Button>
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-neutral-700 hover:bg-neutral-600 text-white font-medium rounded-xl transition-colors-fast shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-600/40"
            disabled={!isValid || isFormDisabled}
          >
            {isSubmitting || isLoading ? (
              <>
                <Icon name="Loader" className="h-4 w-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <Icon name="LogIn" className="h-4 w-4 mr-2" />
                Sign In
              </>
            )}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-neutral-400 text-sm">
            Don't have an account?{" "}
            <Button
              type="button"
              variant="link"
              className="text-neutral-300 hover:text-white p-0 h-auto text-sm font-medium"
              onClick={handleRegisterClick}
              disabled={isFormDisabled}
            >
              Create one here
            </Button>
          </p>
        </div>
      </CardContent>
    </Card>
  )
})

LoginForm.displayName = "LoginForm"

export default LoginForm
