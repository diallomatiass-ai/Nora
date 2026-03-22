'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { api } from '@/lib/api'

export default function VerifyEmailPage() {
  const params = useSearchParams()
  const token = params.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'expired' | 'invalid' | 'pending'>('pending')
  const [resent, setResent] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (!token) return
    setStatus('loading')
    api.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err: Error) => {
        if (err.message.includes('TOKEN_EXPIRED')) setStatus('expired')
        else setStatus('invalid')
      })
  }, [token])

  const handleResend = async () => {
    if (!email) return
    await api.resendVerify(email).catch(() => null)
    setResent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="Nora" width={140} height={84} className="object-contain" />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          {!token && (
            <>
              <div className="w-16 h-16 rounded-full bg-[#0CA9BA]/10 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-[#0CA9BA]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Tjek din email</h1>
              <p className="text-slate-500 mb-6">Vi har sendt et bekræftelseslink til din emailadresse. Klik på linket for at aktivere din konto.</p>
              <p className="text-sm text-slate-400 mb-4">Ikke modtaget noget? Tjek spam-mappen eller send et nyt link:</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="din@email.dk"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0CA9BA]/30"
                />
                <button onClick={handleResend} className="px-4 py-2 text-sm font-semibold text-white bg-[#122B4A] rounded-lg hover:bg-[#1a3660] transition-colors">
                  Send
                </button>
              </div>
              {resent && <p className="text-sm text-green-600 mt-3">Nyt link er sendt!</p>}
            </>
          )}

          {status === 'loading' && (
            <>
              <div className="w-12 h-12 border-4 border-[#0CA9BA] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
              <p className="text-slate-600">Bekræfter din email…</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Email bekræftet!</h1>
              <p className="text-slate-500 mb-6">Din konto er nu aktiv. Du kan logge ind og begynde at bruge Nora.</p>
              <Link href="/login" className="block w-full py-3 text-center font-bold text-white bg-[#0CA9BA] rounded-xl hover:bg-[#3DBFCC] transition-colors">
                Log ind
              </Link>
            </>
          )}

          {(status === 'expired' || status === 'invalid') && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">{status === 'expired' ? 'Linket er udløbet' : 'Ugyldigt link'}</h1>
              <p className="text-slate-500 mb-6">Indtast din email for at få et nyt bekræftelseslink.</p>
              <div className="flex gap-2">
                <input type="email" placeholder="din@email.dk" value={email} onChange={e => setEmail(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0CA9BA]/30" />
                <button onClick={handleResend} className="px-4 py-2 text-sm font-semibold text-white bg-[#122B4A] rounded-lg hover:bg-[#1a3660] transition-colors">Send</button>
              </div>
              {resent && <p className="text-sm text-green-600 mt-3">Nyt link er sendt!</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
