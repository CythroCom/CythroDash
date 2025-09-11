"use client"

import React from 'react'

type Props = { children: React.ReactNode; fallback?: React.ReactNode }

export default class UserTabErrorBoundary extends React.Component<Props, { hasError: boolean; error?: any }> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }
  componentDidCatch(error: any, info: any) {
    console.error('User tab error:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div className="text-sm text-red-400">Something went wrong. Please try again.</div>
    }
    return this.props.children
  }
}

