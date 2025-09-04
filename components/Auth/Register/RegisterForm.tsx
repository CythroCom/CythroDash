"use client"

import React, { memo, useCallback, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InputField, CheckboxField } from "@/components/forms/FormField"
import { useAuthStore, type RegisterData } from "@/stores/user-store"
import { usePerformanceMonitor } from "@/hooks/usePerformance"
import { useIntersectionAnimation } from "@/hooks/useAnimations"
import Icon from "@/components/IconProvider"
import { showError, showSuccess } from "@/lib/toast"

// Validation schema
const registerSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be less than 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  first_name: z.string()
    .min(1, "First name is required")
    .max(50, "First name is too long"),
  last_name: z.string()
    .min(1, "Last name is required")
    .max(50, "Last name is too long"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
  password_confirmation: z.string()
    .min(1, "Please confirm your password"),
  terms: z.boolean()
    .refine(val => val === true, "You must accept the terms and conditions"),
  referral_code: z.string().optional()
}).refine((data) => data.password === data.password_confirmation, {
  message: "Passwords don't match",
  path: ["password_confirmation"]
})

type RegisterFormData = z.infer<typeof registerSchema>

interface RegisterFormProps {
  onSuccess?: () => void
  onLoginClick?: () => void
  className?: string
  defaultReferralCode?: string
}

const RegisterForm = memo(({ onSuccess, onLoginClick, className = "", defaultReferralCode }: RegisterFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Performance monitoring
  usePerformanceMonitor("RegisterForm")

  // Animation on scroll into view
  const { elementRef } = useIntersectionAnimation({}, 'animate-fade-in')

  // Auth store
  const { register: registerUser, isLoading } = useAuthStore()

  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch,
    reset
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      username: "",
      email: "",
      first_name: "",
      last_name: "",
      password: "",
      password_confirmation: "",
      terms: false,
      referral_code: defaultReferralCode || ""
    }
  })

  // Prefill referral code if provided via props later (e.g., async param parsing)
  React.useEffect(() => {
    if (defaultReferralCode) {
      setValue('referral_code' as any, defaultReferralCode, { shouldValidate: true })
    }
  }, [defaultReferralCode, setValue])

  const watchedValues = watch()

  // Memoized submit handler
  const onSubmit = useCallback(async (data: RegisterFormData) => {
    if (isSubmitting || isLoading) return

    setIsSubmitting(true)
    setServerError(null)
    setSuccessMessage(null)

    try {
      const registerData: RegisterData = {
        username: data.username.trim(),
        email: data.email.trim().toLowerCase(),
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        password: data.password,
        password_confirmation: data.password_confirmation,
        referral_code: data.referral_code || undefined
      }

      const result = await registerUser(registerData)

      if (result.success) {
        setSuccessMessage(result.message || "Registration successful! You can now sign in.")
        reset()
        showSuccess('Registration successful')

        setTimeout(() => {
          if (onSuccess) {
            onSuccess()
          } else {
            onLoginClick?.()
          }
        }, 1200)
      } else {
        const msg = result.errors && Array.isArray(result.errors)
          ? result.errors.join(", ")
          : (result.message || "Registration failed. Please try again.")
        setServerError(msg)
        showError('Registration failed', msg)
      }
    } catch (error) {
      console.error("Registration error:", error)
      setServerError("An unexpected error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, isLoading, registerUser, reset, onSuccess, onLoginClick])

  // Memoized field change handlers
  const createFieldHandler = useCallback((fieldName: keyof RegisterFormData) => {
    return (value: string | boolean) => {
      setValue(fieldName, value as any, { shouldValidate: true })
      if (serverError) setServerError(null)
    }
  }, [setValue, serverError])

  const handleLoginClick = useCallback(() => {
    onLoginClick?.()
  }, [onLoginClick])

  const isFormDisabled = isSubmitting || isLoading || !!successMessage

  return (
    <Card
      ref={elementRef as any}
      className={`w-full max-w-md mx-auto card-optimized bg-neutral-800/40 border border-neutral-700/50 backdrop-blur ${className}`}
    >
      <CardHeader className="space-y-1 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-neutral-700 to-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-neutral-600/40 shadow-lg">
          <Icon name="UserPlus" className="h-8 w-8 text-neutral-200" />
        </div>
        <CardTitle className="text-2xl font-bold text-white">Create Account</CardTitle>
        <CardDescription className="text-neutral-400">
          Join Pterodactyl Dashboard today
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

        {successMessage && (
          <Alert className="border-neutral-600/40 bg-neutral-800/60">
            <Icon name="CheckCircle" className="h-4 w-4 text-neutral-300" />
            <AlertDescription className="text-neutral-300">
              {successMessage}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <InputField
              {...register("first_name")}
              label="First Name"
              type="text"
              placeholder="John"
              value={watchedValues.first_name}
              onChange={createFieldHandler("first_name")}
              error={errors.first_name?.message}
              disabled={isFormDisabled}
              autoComplete="given-name"
              required
            />

            <InputField
              {...register("last_name")}
              label="Last Name"
              type="text"
              placeholder="Doe"
              value={watchedValues.last_name}
              onChange={createFieldHandler("last_name")}
              error={errors.last_name?.message}
              disabled={isFormDisabled}
              autoComplete="family-name"
              required
            />
          </div>

          <InputField
            {...register("username")}
            label="Username"
            type="text"
            placeholder="johndoe"
            value={watchedValues.username}
            onChange={createFieldHandler("username")}
            error={errors.username?.message}
            disabled={isFormDisabled}
            autoComplete="username"
            icon={<Icon name="User" className="h-4 w-4" />}
            description="3-20 characters, letters, numbers, and underscores only"
            required
          />

          <InputField
            {...register("email")}
            label="Email Address"
            type="email"
            placeholder="john@example.com"
            value={watchedValues.email}
            onChange={createFieldHandler("email")}
            error={errors.email?.message}
            disabled={isFormDisabled}
            autoComplete="email"
            icon={<Icon name="Mail" className="h-4 w-4" />}
            required
          />

          <InputField
            {...register("password")}
            label="Password"
            type="password"
            placeholder="Create a strong password"
            value={watchedValues.password}
            onChange={createFieldHandler("password")}
            error={errors.password?.message}
            disabled={isFormDisabled}
            autoComplete="new-password"
            icon={<Icon name="Lock" className="h-4 w-4" />}
            showPasswordToggle
            description="At least 8 characters with uppercase, lowercase, and number"
            required
          />

          <InputField
            {...register("password_confirmation")}
            label="Confirm Password"
            type="password"
            placeholder="Confirm your password"
            value={watchedValues.password_confirmation}
            onChange={createFieldHandler("password_confirmation")}
            error={errors.password_confirmation?.message}
            disabled={isFormDisabled}
            autoComplete="new-password"
            icon={<Icon name="Lock" className="h-4 w-4" />}
            showPasswordToggle
            required
          />

          <CheckboxField
            {...register("terms")}
            checked={watchedValues.terms}
            onChange={createFieldHandler("terms")}
            disabled={isFormDisabled}
            error={errors.terms?.message}
            required
          >
            I agree to the{" "}
            <Button
              type="button"
              variant="link"
              className="text-neutral-300 hover:text-white p-0 h-auto text-sm underline"
              disabled={isFormDisabled}
            >
              Terms of Service
            </Button>
            {" "}and{" "}
            <Button
              type="button"
              variant="link"
              className="text-neutral-300 hover:text-white p-0 h-auto text-sm underline"
              disabled={isFormDisabled}
            >
              Privacy Policy
            </Button>
          </CheckboxField>

          <Button
            type="submit"
            className="w-full h-12 bg-neutral-700 hover:bg-neutral-600 text-white font-medium rounded-xl transition-colors-fast shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-600/40"
            disabled={!isValid || isFormDisabled}
          >
            {isSubmitting || isLoading ? (
              <>
                <Icon name="Loader" className="h-4 w-4 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                <Icon name="UserPlus" className="h-4 w-4 mr-2" />
                Create Account
              </>
            )}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-neutral-400 text-sm">
            Already have an account?{" "}
            <Button
              type="button"
              variant="link"
              className="text-neutral-300 hover:text-white p-0 h-auto text-sm font-medium"
              onClick={handleLoginClick}
              disabled={isFormDisabled}
            >
              Sign in here
            </Button>
          </p>
        </div>
      </CardContent>
    </Card>
  )
})

RegisterForm.displayName = "RegisterForm"

export default RegisterForm
