"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/user-store"
import { showError, showSuccess } from "@/lib/toast"

export default function SecuritySection() {
  const changePassword = useAuthStore(s => s.changePassword)
  const [pwd, setPwd] = React.useState({ current_password: "", new_password: "", confirm_password: "" })
  const [loading, setLoading] = React.useState(false)

  const onChangePassword = async () => {
    if (!pwd.new_password || pwd.new_password.length < 8) {
      showError("Password too short", "Use at least 8 characters"); return
    }
    if (pwd.new_password !== pwd.confirm_password) {
      showError("Passwords don't match", "Confirm your new password"); return
    }
    setLoading(true)
    const res = await changePassword(pwd)
    setLoading(false)
    if (res.success) {
      showSuccess("Password changed", res.message)
      setPwd({ current_password: "", new_password: "", confirm_password: "" })
    } else {
      showError("Failed to change password", res.message)
    }
  }

  return (
    <Card className="bg-neutral-900/40 border-neutral-700/40">
      <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Current password</Label>
          <Input type="password" value={pwd.current_password} onChange={e => setPwd(p => ({ ...p, current_password: e.target.value }))} />
        </div>
        <div>
          <Label>New password</Label>
          <Input type="password" value={pwd.new_password} onChange={e => setPwd(p => ({ ...p, new_password: e.target.value }))} />
        </div>
        <div>
          <Label>Confirm password</Label>
          <Input type="password" value={pwd.confirm_password} onChange={e => setPwd(p => ({ ...p, confirm_password: e.target.value }))} />
        </div>
        <div className="md:col-span-3 flex justify-end"><Button onClick={onChangePassword} disabled={loading}>{loading?"Updating...":"Update password"}</Button></div>
      </CardContent>
    </Card>
  )
}

