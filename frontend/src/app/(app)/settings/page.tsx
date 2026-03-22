'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import {
  User, Mail, Trash2, LogOut, Globe, Moon, Sun,
  Calendar, CheckCircle2, Bot, Bell, Settings,
  KeyRound, Loader2, Tag, Plus, CalendarClock,
} from 'lucide-react'
import { useTranslation, Locale } from '@/lib/i18n'

interface Account { id: string; provider: string; email_address: string; is_active: boolean }
interface CalendarAccount { id: string; provider: string; calendar_email: string; is_active: boolean }

type Tab = 'profil' | 'mailkonti' | 'ai' | 'notifikationer' | 'kategorier' | 'booking'

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profil',        label: 'Profil',        icon: User },
  { id: 'mailkonti',     label: 'Mailkonti',      icon: Mail },
  { id: 'ai',            label: 'AI',             icon: Bot },
  { id: 'notifikationer',label: 'Notifikationer', icon: Bell },
  { id: 'kategorier',    label: 'Kategorier',     icon: Tag },
  { id: 'booking',       label: 'Booking',        icon: CalendarClock },
]

export default function SettingsPage() {
  const { t, locale, setLocale, theme, setTheme } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('profil')

  // Profil
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null)
  const [name, setName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Mailkonti
  const [accounts, setAccounts] = useState<Account[]>([])
  const [calendarAccounts, setCalendarAccounts] = useState<CalendarAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [connectingCalendar, setConnectingCalendar] = useState(false)

  // AI
  const [aiTone, setAiTone] = useState('professional')
  const [aiLang, setAiLang] = useState('auto')
  const [learningStyle, setLearningStyle] = useState(false)
  const [styleResult, setStyleResult] = useState<any>(null)

  // Kategorier
  const [categories, setCategories] = useState<any[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [newCatId, setNewCatId] = useState('')
  const [newCatLabel, setNewCatLabel] = useState('')
  const [newCatColor, setNewCatColor] = useState('#42D1B9')
  const [savingCat, setSavingCat] = useState(false)

  // Booking
  const [bookingRules, setBookingRules] = useState<any>(null)
  const [savingBooking, setSavingBooking] = useState(false)
  const [bookingSaved, setBookingSaved] = useState(false)

  useEffect(() => {
    api.getMe().then((u: any) => {
      setProfile(u)
      setName(u.name || '')
    }).catch(() => null)
    fetchAccounts()
    fetchCalendarAccounts()
    fetchCategories()
    api.getBookingRules().then(setBookingRules).catch(() => null)
  }, [])

  const fetchAccounts = async () => {
    try { setAccounts(await api.listAccounts()) }
    catch { /* ignore */ } finally { setLoading(false) }
  }

  const fetchCalendarAccounts = async () => {
    try { setCalendarAccounts((await api.listCalendarAccounts()) || []) }
    catch { /* ignore */ }
  }

  const fetchCategories = async () => {
    setCategoriesLoading(true)
    try { setCategories(await api.listCategories()) }
    catch { /* ignore */ } finally { setCategoriesLoading(false) }
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      await api.updateMe({ name })
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2500)
    } catch { /* ignore */ } finally { setSavingProfile(false) }
  }

  const handleConnect = async (provider: 'gmail' | 'outlook') => {
    setConnecting(true)
    try {
      const fn = provider === 'gmail' ? api.connectGmail : api.connectOutlook
      const data = await fn()
      window.open(data.auth_url, '_blank')
    } catch { /* ignore */ } finally { setConnecting(false) }
  }

  const handleConnectCalendar = async (provider: 'google' | 'outlook') => {
    setConnectingCalendar(true)
    try {
      const fn = provider === 'google' ? api.connectGoogleCalendar : api.connectOutlookCalendar
      const data = await fn()
      window.open(data.auth_url, '_blank')
    } catch { /* ignore */ } finally { setConnectingCalendar(false) }
  }

  const handleDisconnect = async (id: string) => {
    if (!confirm(t('disconnectAccount'))) return
    await api.disconnectAccount(id)
    fetchAccounts()
  }

  const handleDisconnectCalendar = async (id: string) => {
    if (!confirm(t('disconnectCalendar'))) return
    await api.deleteCalendarAccount(id)
    fetchCalendarAccounts()
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  return (
    <div className="p-6 max-w-3xl animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-6">
        <div className="p-1.5 rounded-lg bg-[#0CA9BA]/10">
          <Settings className="w-5 h-5 text-[#0CA9BA]" />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('settings')}</h1>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-[var(--border)] mb-6">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === id
                ? 'border-[#0CA9BA] text-[#0CA9BA]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── PROFIL ────────────────────────────────────────────────── */}
      {activeTab === 'profil' && (
        <div className="space-y-4">
          {/* Navn + email */}
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-[var(--text-primary)]">Brugeroplysninger</h2>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Navn</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="input w-full"
                placeholder="Dit navn"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Email</label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="input w-full opacity-50 cursor-not-allowed"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">Email kan ikke ændres her.</p>
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#122B4A] dark:bg-[#0CA9BA] rounded-lg hover:bg-[#1a3660] dark:hover:bg-[#3DBFCC] disabled:opacity-50 transition-colors"
            >
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {profileSaved ? '✓ Gemt' : 'Gem ændringer'}
            </button>
          </div>

          {/* Tema + sprog */}
          <div className="card p-6 space-y-5">
            <h2 className="font-semibold text-[var(--text-primary)]">Udseende & sprog</h2>

            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{t('theme')}</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-lg transition-all ${
                    theme === 'light'
                      ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 border-amber-300'
                      : 'text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  <Sun className="w-4 h-4" /> {t('themeDay')}
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-lg transition-all ${
                    theme === 'dark'
                      ? 'bg-[#0CA9BA]/10 text-[#0CA9BA] border-[#0CA9BA]/30'
                      : 'text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  <Moon className="w-4 h-4" /> {t('themeNight')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{t('language')}</label>
              <div className="flex gap-2">
                {([['da', '🇩🇰', 'Dansk'], ['en', '🇬🇧', 'English']] as const).map(([loc, flag, label]) => (
                  <button
                    key={loc}
                    onClick={() => setLocale(loc as Locale)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-lg transition-all ${
                      locale === loc
                        ? 'bg-[#0CA9BA]/10 text-[#0CA9BA] border-[#0CA9BA]/30'
                        : 'text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-muted)]'
                    }`}
                  >
                    <span>{flag}</span> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Log ud */}
          <div className="card p-4">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 border border-red-200 dark:border-red-500/20 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-4 h-4" /> {t('signOut')}
            </button>
          </div>
        </div>
      )}

      {/* ── MAILKONTI ─────────────────────────────────────────────── */}
      {activeTab === 'mailkonti' && (
        <div className="space-y-4">
          {/* Mail */}
          <div className="card p-6">
            <h2 className="font-semibold text-[var(--text-primary)] mb-1">{t('emailAccounts')}</h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">{t('emailAccountsDesc')}</p>

            {loading ? <p className="text-sm text-[var(--text-muted)]">{t('loading')}</p> : (
              <>
                {accounts.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {accounts.map((acc) => (
                      <div key={acc.id} className="bg-[var(--surface-hover)] rounded-lg border border-[var(--border)]">
                        <div className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3">
                            <Mail className="w-4 h-4 text-[var(--text-muted)]" />
                            <div>
                              <p className="text-sm font-medium text-[var(--text-primary)]">{acc.email_address}</p>
                              <p className="text-xs text-[var(--text-muted)] capitalize">{acc.provider}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${acc.is_active ? 'bg-green-500' : 'bg-slate-300'}`} />
                            <button onClick={() => handleDisconnect(acc.id)} className="p-1.5 text-[var(--text-muted)] hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {acc.provider === 'gmail' && (
                          <div className="mt-0 mx-3 mb-3 flex items-center justify-between px-3 py-2 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                            <div>
                              <p className="text-xs font-medium text-[var(--text-primary)]">Nora-labels i Gmail</p>
                              <p className="text-xs text-[var(--text-muted)]">Opret automatisk "Nora/Kategori" labels i Gmail</p>
                            </div>
                            <button
                              onClick={async () => {
                                const current = (acc as any).nora_label_sync
                                await api.updateAccount(acc.id, { nora_label_sync: !current })
                                fetchAccounts()
                              }}
                              className={`relative w-10 h-5 rounded-full transition-colors ml-3 flex-shrink-0 ${(acc as any).nora_label_sync ? 'bg-[#0CA9BA]' : 'bg-[var(--border)]'}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${(acc as any).nora_label_sync ? 'translate-x-5' : ''}`} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-3 flex-wrap">
                  <button onClick={() => handleConnect('gmail')} disabled={connecting}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 text-[var(--text-secondary)] transition-all">
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/><path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/><path fill="#4A90D9" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/><path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/></svg>
                    {t('connectGmail')}
                  </button>
                  <button onClick={() => handleConnect('outlook')} disabled={connecting}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 text-[var(--text-secondary)] transition-all">
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#0078D4" d="M24 7.387v10.478c0 .23-.08.424-.238.58a.782.782 0 0 1-.578.236h-8.307v-8.16l1.87 1.358a.327.327 0 0 0 .39 0l6.863-4.973V7.387Zm-9.123-1.39h8.307c.224 0 .414.076.57.228.155.152.236.34.246.564l-7.286 5.282-1.837-1.334V5.997ZM13.543 3v18L0 18.246V2.754L13.543 3Z"/></svg>
                    {t('connectOutlook')}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Kalender */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-[#0CA9BA]" />
              <h2 className="font-semibold text-[var(--text-primary)]">{t('calendarIntegration')}</h2>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-4">{t('calendarIntegrationDesc')}</p>

            {calendarAccounts.length > 0 && (
              <div className="space-y-2 mb-4">
                {calendarAccounts.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-500/10 rounded-lg border border-green-200 dark:border-green-500/20">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{acc.calendar_email}</p>
                        <p className="text-xs text-[var(--text-muted)] capitalize">{acc.provider === 'google' ? 'Google Kalender' : 'Outlook Kalender'}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDisconnectCalendar(acc.id)} className="p-1.5 text-[var(--text-muted)] hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              <button onClick={() => handleConnectCalendar('google')} disabled={connectingCalendar}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 text-[var(--text-secondary)] transition-all">
                <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/><path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/><path fill="#4A90D9" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/><path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/></svg>
                {t('connectGoogleCalendar')}
              </button>
              <button onClick={() => handleConnectCalendar('outlook')} disabled={connectingCalendar}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] disabled:opacity-50 text-[var(--text-secondary)] transition-all">
                <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#0078D4" d="M24 7.387v10.478c0 .23-.08.424-.238.58a.782.782 0 0 1-.578.236h-8.307v-8.16l1.87 1.358a.327.327 0 0 0 .39 0l6.863-4.973V7.387Zm-9.123-1.39h8.307c.224 0 .414.076.57.228.155.152.236.34.246.564l-7.286 5.282-1.837-1.334V5.997ZM13.543 3v18L0 18.246V2.754L13.543 3Z"/></svg>
                {t('connectOutlookCalendar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI ────────────────────────────────────────────────────── */}
      {activeTab === 'ai' && (
        <div className="space-y-4">
          <div className="card p-6 space-y-5">
            <h2 className="font-semibold text-[var(--text-primary)]">AI-indstillinger</h2>

            {/* Tone */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">Tone i svar</label>
              <div className="flex gap-2 flex-wrap">
                {[['professional','Professionel'],['friendly','Venlig'],['neutral','Neutral'],['formal','Formel']].map(([val, label]) => (
                  <button key={val} onClick={() => setAiTone(val)}
                    className={`px-3 py-2 text-sm font-medium border rounded-lg transition-all ${
                      aiTone === val
                        ? 'bg-[#0CA9BA]/10 text-[#0CA9BA] border-[#0CA9BA]/30'
                        : 'text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-muted)]'
                    }`}
                  >{label}</button>
                ))}
              </div>
            </div>

            {/* Sprog */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">AI svarer på</label>
              <div className="flex gap-2 flex-wrap">
                {[['auto','🌐 Samme sprog som afsender'],['da','🇩🇰 Altid dansk'],['en','🇬🇧 Altid engelsk']].map(([val, label]) => (
                  <button key={val} onClick={() => setAiLang(val)}
                    className={`px-3 py-2 text-sm font-medium border rounded-lg transition-all ${
                      aiLang === val
                        ? 'bg-[#0CA9BA]/10 text-[#0CA9BA] border-[#0CA9BA]/30'
                        : 'text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-muted)]'
                    }`}
                  >{label}</button>
                ))}
              </div>
            </div>

            {/* Infoboks */}
            <div className="bg-[#0CA9BA]/5 border border-[#0CA9BA]/20 rounded-xl p-4 text-sm text-[var(--text-secondary)]">
              <p className="font-medium text-[var(--text-primary)] mb-1">GDPR-compliant AI</p>
              <p>Al AI-processering sker inden for EU. Dine data forlader aldrig EU og deles aldrig med tredjepart.</p>
            </div>

            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#122B4A] dark:bg-[#0CA9BA] rounded-lg hover:bg-[#1a3660] dark:hover:bg-[#3DBFCC] transition-colors">
              Gem AI-indstillinger
            </button>
          </div>

          {/* Skrivestil-læring */}
          <div className="card p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-[var(--text-primary)]">Skrivestil-læring</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Nora analyserer dine sendte emails og lærer at skrive præcis som dig — samme tone, hilsener og afslutninger.
                Kræver mindst 3 sendte emails.
              </p>
            </div>

            {styleResult && styleResult.status === 'ok' && (
              <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl p-4 text-sm space-y-2">
                <p className="font-medium text-green-700 dark:text-green-400">✓ Skrivestil lært fra {styleResult.emails_analyzed} emails</p>
                {styleResult.style && (
                  <div className="text-[var(--text-secondary)] space-y-1">
                    {styleResult.style.tone && <p><span className="font-medium">Tone:</span> {styleResult.style.tone}</p>}
                    {styleResult.style.greeting && <p><span className="font-medium">Hilsen:</span> {styleResult.style.greeting}</p>}
                    {styleResult.style.signoff && <p><span className="font-medium">Afslutning:</span> {styleResult.style.signoff}</p>}
                  </div>
                )}
              </div>
            )}

            {styleResult && styleResult.status !== 'ok' && (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-400">
                {styleResult.message}
              </div>
            )}

            <button
              onClick={async () => {
                setLearningStyle(true)
                setStyleResult(null)
                try { setStyleResult(await api.learnStyle()) }
                catch { setStyleResult({ status: 'error', message: 'Noget gik galt — prøv igen.' }) }
                finally { setLearningStyle(false) }
              }}
              disabled={learningStyle}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-[#0CA9BA]/30 text-[#0CA9BA] rounded-lg hover:bg-[#0CA9BA]/10 disabled:opacity-50 transition-colors"
            >
              {learningStyle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
              {learningStyle ? 'Analyserer emails...' : 'Lær min skrivestil'}
            </button>
          </div>
        </div>
      )}

      {/* ── NOTIFIKATIONER ────────────────────────────────────────── */}
      {activeTab === 'notifikationer' && (
        <div className="space-y-4">
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-[var(--text-primary)]">Notifikationer</h2>
            <p className="text-sm text-[var(--text-muted)]">Vælg hvornår Nora skal give dig besked.</p>

            {[
              { label: 'Ny email modtaget', desc: 'Besked når en ny email ankommer til indbakken', def: true },
              { label: 'AI-forslag klar', desc: 'Besked når Nora har genereret et svarforslag', def: true },
              { label: 'Påmindelser', desc: 'Besked ved aktive påmindelser på emails', def: true },
              { label: 'Mødereferat klar', desc: 'Besked når Nora har genereret et mødereferat', def: false },
              { label: 'Ugentlig opsummering', desc: 'Samlet oversigt over ugens mailaktivitet', def: false },
            ].map(({ label, desc, def }) => {
              const [checked, setChecked] = useState(def)
              return (
                <div key={label} className="flex items-start justify-between gap-4 py-3 border-b border-[var(--border)] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{desc}</p>
                  </div>
                  <button
                    onClick={() => setChecked(!checked)}
                    className={`relative w-10 h-5.5 rounded-full flex-shrink-0 transition-colors mt-0.5 ${checked ? 'bg-[#0CA9BA]' : 'bg-[var(--border)]'}`}
                    style={{ minWidth: '2.5rem', height: '1.375rem' }}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              )
            })}

            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#122B4A] dark:bg-[#0CA9BA] rounded-lg hover:bg-[#1a3660] dark:hover:bg-[#3DBFCC] transition-colors">
              Gem notifikationer
            </button>
          </div>
        </div>
      )}

      {/* ── BOOKING ───────────────────────────────────────────────── */}
      {activeTab === 'booking' && bookingRules && (
        <div className="space-y-4">
          <div className="card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-[var(--text-primary)]">Booking-regler</h2>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">Definer hvornår kunder kan booke tid hos dig.</p>
              </div>
              <button
                onClick={() => setBookingRules((r: any) => ({ ...r, enabled: !r.enabled }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${bookingRules.enabled ? 'bg-[#0CA9BA]' : 'bg-[var(--border)]'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${bookingRules.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            {bookingRules.enabled && (
              <div className="space-y-4 pt-2 border-t border-[var(--border)]">
                {/* Arbejdsdage */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-2 uppercase tracking-wide">Arbejdsdage</label>
                  <div className="flex gap-2 flex-wrap">
                    {['Man','Tir','Ons','Tor','Fre','Lør','Søn'].map((d, i) => {
                      const day = i + 1
                      const active = bookingRules.work_days?.includes(day)
                      return (
                        <button
                          key={d}
                          onClick={() => setBookingRules((r: any) => ({
                            ...r,
                            work_days: active
                              ? r.work_days.filter((x: number) => x !== day)
                              : [...(r.work_days || []), day].sort()
                          }))}
                          className={`w-10 h-10 rounded-lg text-xs font-semibold transition-colors ${active ? 'bg-[#0CA9BA] text-white' : 'bg-[var(--surface-hover)] text-[var(--text-muted)]'}`}
                        >
                          {d}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Arbejdstimer */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-wide">Åbner</label>
                    <input
                      type="time"
                      value={bookingRules.work_hours?.start || '09:00'}
                      onChange={e => setBookingRules((r: any) => ({ ...r, work_hours: { ...r.work_hours, start: e.target.value } }))}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[#42D1B9]/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-wide">Lukker</label>
                    <input
                      type="time"
                      value={bookingRules.work_hours?.end || '17:00'}
                      onChange={e => setBookingRules((r: any) => ({ ...r, work_hours: { ...r.work_hours, end: e.target.value } }))}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[#42D1B9]/40"
                    />
                  </div>
                </div>

                {/* Slots & buffer */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-wide">Slot-varighed (min)</label>
                    <input
                      type="number"
                      min={15} max={240} step={15}
                      value={bookingRules.slot_duration_minutes || 60}
                      onChange={e => setBookingRules((r: any) => ({ ...r, slot_duration_minutes: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[#42D1B9]/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-wide">Buffer (min)</label>
                    <input
                      type="number"
                      min={0} max={60} step={5}
                      value={bookingRules.buffer_minutes || 0}
                      onChange={e => setBookingRules((r: any) => ({ ...r, buffer_minutes: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[#42D1B9]/40"
                    />
                  </div>
                </div>

                {/* Maks. bookinger & min. varsel */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-wide">Maks. bookinger/dag</label>
                    <input
                      type="number" min={1} max={20}
                      value={bookingRules.max_bookings_per_day || 8}
                      onChange={e => setBookingRules((r: any) => ({ ...r, max_bookings_per_day: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[#42D1B9]/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-wide">Min. varsel (timer)</label>
                    <input
                      type="number" min={0} max={168}
                      value={bookingRules.min_notice_hours || 24}
                      onChange={e => setBookingRules((r: any) => ({ ...r, min_notice_hours: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[#42D1B9]/40"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={async () => {
                setSavingBooking(true)
                try {
                  await api.updateBookingRules(bookingRules)
                  setBookingSaved(true)
                  setTimeout(() => setBookingSaved(false), 3000)
                } catch { /* ignore */ } finally { setSavingBooking(false) }
              }}
              disabled={savingBooking}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[#122B4A] dark:bg-[#0CA9BA] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {savingBooking ? <Loader2 className="w-4 h-4 animate-spin" /> : bookingSaved ? <CheckCircle2 className="w-4 h-4" /> : null}
              {bookingSaved ? 'Gemt!' : 'Gem booking-regler'}
            </button>
          </div>
        </div>
      )}

      {/* ── KATEGORIER ────────────────────────────────────────────── */}
      {activeTab === 'kategorier' && (
        <div className="space-y-4">
          <div className="card p-6">
            <h2 className="font-semibold text-[var(--text-primary)] mb-1">Email-kategorier</h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Nora bruger disse kategorier til at sortere og prioritere dine emails.
              Standardkategorier kan slås til/fra. Du kan også oprette egne.
            </p>

            {categoriesLoading ? (
              <div className="text-sm text-[var(--text-muted)]">Indlæser...</div>
            ) : (
              <div className="space-y-2 mb-6">
                {categories.map((cat: any) => (
                  <div key={cat.category_id} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)]">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || '#42D1B9' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{cat.label}</p>
                      {cat.description && <p className="text-xs text-[var(--text-muted)] truncate">{cat.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {cat.is_default && <span className="text-[10px] text-[var(--text-muted)] border border-[var(--border)] px-1.5 py-0.5 rounded">Standard</span>}
                      <button
                        onClick={async () => {
                          await api.updateCategory(cat.category_id, { is_active: !cat.is_active })
                          fetchCategories()
                        }}
                        className={`relative w-10 h-5 rounded-full transition-colors ${cat.is_active ? 'bg-[#0CA9BA]' : 'bg-[var(--border)]'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${cat.is_active ? 'translate-x-5' : ''}`} />
                      </button>
                      {!cat.is_default && (
                        <button
                          onClick={async () => {
                            if (!confirm('Slet kategori?')) return
                            await api.deleteCategory(cat.category_id)
                            fetchCategories()
                          }}
                          className="p-1.5 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-[var(--border)] pt-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Opret ny kategori</h3>
              <div className="flex gap-2 flex-wrap">
                <input
                  value={newCatId}
                  onChange={e => setNewCatId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="id (fx: vip_kunde)"
                  className="input flex-1 min-w-[140px]"
                />
                <input
                  value={newCatLabel}
                  onChange={e => setNewCatLabel(e.target.value)}
                  placeholder="Visningsnavn (fx: VIP Kunde)"
                  className="input flex-1 min-w-[160px]"
                />
                <input
                  type="color"
                  value={newCatColor}
                  onChange={e => setNewCatColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-[var(--border)] cursor-pointer p-0.5"
                />
                <button
                  onClick={async () => {
                    if (!newCatId || !newCatLabel) return
                    setSavingCat(true)
                    try {
                      await api.createCategory({ category_id: newCatId, label: newCatLabel, color: newCatColor })
                      setNewCatId(''); setNewCatLabel(''); setNewCatColor('#42D1B9')
                      fetchCategories()
                    } catch { /* ignore */ } finally { setSavingCat(false) }
                  }}
                  disabled={savingCat || !newCatId || !newCatLabel}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#122B4A] dark:bg-[#0CA9BA] rounded-lg hover:bg-[#1a3660] dark:hover:bg-[#3DBFCC] disabled:opacity-50 transition-colors"
                >
                  {savingCat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Opret
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
