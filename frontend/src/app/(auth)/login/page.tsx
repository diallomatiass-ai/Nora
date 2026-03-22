'use client'

import { useState } from 'react'
import Image from 'next/image'
import { api } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'

const COUNTRY_CODES = [
  { code: '+45', flag: '🇩🇰', name: 'Danmark' },
  { code: '+46', flag: '🇸🇪', name: 'Sverige' },
  { code: '+47', flag: '🇳🇴', name: 'Norge' },
  { code: '+49', flag: '🇩🇪', name: 'Tyskland' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+1',  flag: '🇺🇸', name: 'USA' },
  { code: '+31', flag: '🇳🇱', name: 'Holland' },
  { code: '+33', flag: '🇫🇷', name: 'Frankrig' },
  { code: '+34', flag: '🇪🇸', name: 'Spanien' },
  { code: '+39', flag: '🇮🇹', name: 'Italien' },
  { code: '+41', flag: '🇨🇭', name: 'Schweiz' },
  { code: '+358', flag: '🇫🇮', name: 'Finland' },
  { code: '+48', flag: '🇵🇱', name: 'Polen' },
]

const COUNTRIES = [
  'Danmark', 'Sverige', 'Norge', 'Finland', 'Tyskland', 'Holland',
  'Belgien', 'Frankrig', 'Spanien', 'Italien', 'Schweiz', 'Østrig',
  'Polen', 'UK', 'USA', 'Canada', 'Australien', 'Andet',
]

export default function LoginPage() {
  const { t, theme } = useTranslation()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phoneCode, setPhoneCode] = useState('+45')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [country, setCountry] = useState('Danmark')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isLogin) {
        const data = await api.login(email, password)
        localStorage.setItem('token', data.access_token)
        window.location.href = '/'
      } else {
        const phone = phoneNumber ? `${phoneCode}${phoneNumber.replace(/^0/, '')}` : undefined
        await api.register({
          email, name, password,
          company_name: companyName || undefined,
          phone,
          country,
        })
        const data = await api.login(email, password)
        localStorage.setItem('token', data.access_token)
        window.location.href = '/'
      }
    } catch (err: any) {
      setError(err.message || t('somethingWrong'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#09090b] px-4 relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(100,100,100,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(100,100,100,0.15) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* Gradient orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[#42D1B9]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] rounded-full bg-[#162249]/20 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-slideUp">
        <div className="flex flex-col items-center mb-8">
          <Image
            src={theme === 'dark' ? '/logo-dark.png' : '/logo.png'}
            alt="Nora"
            width={240}
            height={144}
            className="object-contain"
            priority
          />
        </div>

        <div className="bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-lg dark:shadow-none backdrop-blur-xl p-8">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-zinc-100 mb-6">
            {isLogin ? t('signIn') : t('signUp')}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1.5">{t('name')}</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="input-dark" placeholder="Dit fulde navn" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1.5">{t('companyName')}</label>
                  <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="input-dark" placeholder="Firmanavn (valgfrit)" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1.5">Telefonnummer</label>
                  <div className="flex gap-2">
                    <select
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value)}
                      className="input-dark w-28 flex-shrink-0"
                    >
                      {COUNTRY_CODES.map(c => (
                        <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="input-dark flex-1"
                      placeholder="20 12 34 56"
                    />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">Bruges til kontogendannelse og 2-trins login</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1.5">Land</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="input-dark"
                  >
                    {COUNTRIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1.5">{t('email')}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-dark" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1.5">{t('password')}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="input-dark" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 btn-primary font-medium rounded-lg">
              {loading ? t('signingIn') : isLogin ? t('signIn') : t('signUp')}
            </button>
          </form>

          <p className="mt-5 text-sm text-center text-slate-500 dark:text-zinc-500">
            {isLogin ? t('noAccount') : t('hasAccount')}{' '}
            <button
              onClick={() => { setIsLogin(!isLogin); setError('') }}
              className="text-[#42D1B9] hover:text-[#56DEC8] font-medium transition-colors"
            >
              {isLogin ? t('signUp') : t('signIn')}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
