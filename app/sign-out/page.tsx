'use client'
import { useClerk } from '@clerk/nextjs'
import { useEffect } from 'react'

export default function SignOutPage() {
  const { signOut } = useClerk()
  useEffect(() => { signOut({ redirectUrl: '/' }) }, [])
  return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}><p style={{ color:'#6b7280' }}>Signing out...</p></div>
}
