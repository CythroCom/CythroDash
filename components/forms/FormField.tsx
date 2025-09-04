"use client"

import React, { memo, forwardRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import Icon from "@/components/IconProvider"

// Base form field props
interface BaseFieldProps {
  label?: string
  error?: string
  required?: boolean
  disabled?: boolean
  className?: string
  description?: string
}

// Input field component
interface InputFieldProps extends BaseFieldProps {
  type?: "text" | "email" | "password" | "number" | "tel" | "url"
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  onBlur?: (e?: any) => void
  autoComplete?: string
  maxLength?: number
  minLength?: number
  pattern?: string
  icon?: React.ReactNode
  showPasswordToggle?: boolean
}

const InputField = memo(forwardRef<HTMLInputElement, InputFieldProps>(({
  label,
  error,
  required,
  disabled,
  className = "",
  description,
  type = "text",
  placeholder,
  value,
  onChange,
  onBlur,
  autoComplete,
  maxLength,
  minLength,
  pattern,
  icon,
  showPasswordToggle = false,
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = React.useState(false)
  const [isFocused, setIsFocused] = React.useState(false)

  const inputType = type === "password" && showPassword ? "text" : type
  const hasError = !!error

  const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value)
  }, [onChange])

  const handleFocus = React.useCallback(() => {
    setIsFocused(true)
  }, [])

  const handleBlur = React.useCallback(() => {
    setIsFocused(false)
    onBlur?.()
  }, [onBlur])

  const togglePassword = React.useCallback(() => {
    setShowPassword(prev => !prev)
  }, [])

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label
          className={`text-sm font-medium ${hasError ? 'text-red-400' : 'text-neutral-200'} ${required ? 'after:content-["*"] after:ml-1 after:text-red-400' : ''}`}
        >
          {label}
        </Label>
      )}
      
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            {icon}
          </div>
        )}
        
        <Input
          ref={ref}
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          autoComplete={autoComplete}
          maxLength={maxLength}
          minLength={minLength}
          pattern={pattern}
          className={`
            transition-colors-fast
            ${icon ? 'pl-10' : ''}
            ${showPasswordToggle ? 'pr-10' : ''}
            ${hasError 
              ? 'border-red-500 focus:border-red-400 focus:ring-red-400/20' 
              : isFocused 
                ? 'border-blue-500 focus:border-blue-400 focus:ring-blue-400/20'
                : 'border-neutral-600 hover:border-neutral-500'
            }
            bg-neutral-800/50 text-white placeholder:text-neutral-500
          `}
          {...props}
        />
        
        {showPasswordToggle && type === "password" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-neutral-700/50"
            onClick={togglePassword}
            tabIndex={-1}
          >
            <Icon 
              name={showPassword ? "EyeOff" : "Eye"} 
              className="h-4 w-4 text-neutral-400" 
            />
          </Button>
        )}
      </div>
      
      {description && !error && (
        <p className="text-xs text-neutral-400">{description}</p>
      )}
      
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <Icon name="AlertCircle" className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  )
}))

InputField.displayName = "InputField"

// Textarea field component
interface TextareaFieldProps extends BaseFieldProps {
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  rows?: number
  maxLength?: number
  minLength?: number
  resize?: boolean
}

const TextareaField = memo(forwardRef<HTMLTextAreaElement, TextareaFieldProps>(({
  label,
  error,
  required,
  disabled,
  className = "",
  description,
  placeholder,
  value,
  onChange,
  onBlur,
  rows = 4,
  maxLength,
  minLength,
  resize = true,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = React.useState(false)
  const hasError = !!error

  const handleChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e.target.value)
  }, [onChange])

  const handleFocus = React.useCallback(() => {
    setIsFocused(true)
  }, [])

  const handleBlur = React.useCallback(() => {
    setIsFocused(false)
    onBlur?.()
  }, [onBlur])

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label
          className={`text-sm font-medium ${hasError ? 'text-red-400' : 'text-neutral-200'} ${required ? 'after:content-["*"] after:ml-1 after:text-red-400' : ''}`}
        >
          {label}
        </Label>
      )}
      
      <Textarea
        ref={ref}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        rows={rows}
        maxLength={maxLength}
        minLength={minLength}
        className={`
          transition-colors-fast
          ${!resize ? 'resize-none' : ''}
          ${hasError 
            ? 'border-red-500 focus:border-red-400 focus:ring-red-400/20' 
            : isFocused 
              ? 'border-blue-500 focus:border-blue-400 focus:ring-blue-400/20'
              : 'border-neutral-600 hover:border-neutral-500'
          }
          bg-neutral-800/50 text-white placeholder:text-neutral-500
        `}
        {...props}
      />
      
      {description && !error && (
        <p className="text-xs text-neutral-400">{description}</p>
      )}
      
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <Icon name="AlertCircle" className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  )
}))

TextareaField.displayName = "TextareaField"

// Checkbox field component
interface CheckboxFieldProps extends BaseFieldProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  children?: React.ReactNode
}

const CheckboxField = memo(forwardRef<HTMLButtonElement, CheckboxFieldProps>(({
  label,
  error,
  required,
  disabled,
  className = "",
  description,
  checked,
  onChange,
  children,
  ...props
}, ref) => {
  const hasError = !!error

  const handleChange = React.useCallback((checked: boolean) => {
    onChange?.(checked)
  }, [onChange])

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-start space-x-3">
        <Checkbox
          ref={ref}
          checked={checked}
          onCheckedChange={handleChange}
          disabled={disabled}
          className={`
            mt-0.5
            ${hasError ? 'border-red-500' : 'border-neutral-600'}
          `}
          {...props}
        />
        
        <div className="flex-1 space-y-1">
          {(label || children) && (
            <Label 
              className={`text-sm ${hasError ? 'text-red-400' : 'text-neutral-200'} ${required ? 'after:content-["*"] after:ml-1 after:text-red-400' : ''} cursor-pointer`}
            >
              {label || children}
            </Label>
          )}
          
          {description && !error && (
            <p className="text-xs text-neutral-400">{description}</p>
          )}
        </div>
      </div>
      
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1 ml-6">
          <Icon name="AlertCircle" className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  )
}))

CheckboxField.displayName = "CheckboxField"

export { InputField, TextareaField, CheckboxField }
export type { InputFieldProps, TextareaFieldProps, CheckboxFieldProps }
