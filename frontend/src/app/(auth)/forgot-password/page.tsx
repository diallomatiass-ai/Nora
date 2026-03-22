'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { api } from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await api.forgotPassword(email).catch(() => null)
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="Nora" width={140} height={84} className="object-contain" />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          {!sent ? (
            <>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Glemt adgangskode?</h1>
              <p className="text-slate-500 mb-6">Indtast din emailadresse, og vi sender dig et link til at nulstille din adgangskode.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0CA9BA]/30"
                    placeholder="din@email.dk"
                  />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 font-bold text-white bg-[#122B4A] rounded-lg hover:bg-[#1a3660] transition-colors disabled:opacity-60">
                  {loading ? 'Sender…' : 'Send nulstillingslink'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-[#0CA9BA]/10 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-[#0CA9BA]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">Tjek din email</h1>
              <p className="text-slate-500 text-center">Hvis der findes en konto med den emailadresse, har vi sendt et nulstillingslink. Det udløber om 1 time.</p>
            </>
          )}

          <p className="mt-6 text-sm text-center text-slate-400">
            <Link href="/login" className="text-[#0CA9BA] hover:underline">← Tilbage til login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
