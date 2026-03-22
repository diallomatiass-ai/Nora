'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { api } from '@/lib/api'

export default function ResetPasswordPage() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Adgangskoden skal være mindst 6 tegn'); return }
    if (password !== confirm) { setError('Adgangskoderne matcher ikke'); return }
    setLoading(true)
    try {
      await api.resetPassword(token, password)
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (err: any) {
      if (err.message.includes('TOKEN_EXPIRED')) setError('Linket er udløbet — anmod om et nyt.')
      else setError(err.message || 'Noget gik galt')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="Nora" width={140} height={84} className="object-contain" />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          {!done ? (
            <>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Ny adgangskode</h1>
              <p className="text-slate-500 mb-6">Vælg en ny adgangskode til din Nora-konto.</p>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Ny adgangskode</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0CA9BA]/30"
                    placeholder="Mindst 6 tegn" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Bekræft adgangskode</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={6}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0CA9BA]/30"
                    placeholder="Gentag adgangskode" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 font-bold text-white bg-[#122B4A] rounded-lg hover:bg-[#1a3660] transition-colors disabled:opacity-60">
                  {loading ? 'Gemmer…' : 'Gem ny adgangskode'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">Adgangskode opdateret!</h1>
              <p className="text-slate-500 text-center">Du sendes til login om et øjeblik…</p>
            </>
          )}

          {!done && (
            <p className="mt-6 text-sm text-center text-slate-400">
              <Link href="/forgot-password" className="text-[#0CA9BA] hover:underline">Anmod om nyt link</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
