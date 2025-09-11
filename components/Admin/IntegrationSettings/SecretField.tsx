/**
 * CythroDash - Secret Field Component
 * 
 * Input field with visibility toggle for sensitive data like API keys, tokens, etc.
 */

import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'

interface SecretFieldProps {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export function SecretField({ 
  label, 
  value, 
  placeholder, 
  onChange, 
  disabled = false,
  className = ''
}: SecretFieldProps) {
  const [isVisible, setIsVisible] = useState(false)

  const toggleVisibility = () => {
    setIsVisible(!isVisible)
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-medium text-neutral-300">
        {label}
      </label>
      <div className="relative">
        <Input
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-10 bg-neutral-800 border-neutral-600 text-white placeholder:text-neutral-400 focus:border-neutral-500"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleVisibility}
          disabled={disabled}
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-neutral-400 hover:text-neutral-300"
        >
          {isVisible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
