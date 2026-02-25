'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { Phone, PhoneIncoming, CheckCircle2, Settings2 } from 'lucide-react'
import SetupWizard from '@/components/secretary/SetupWizard'
import ScriptEditor from '@/components/secretary/ScriptEditor'
import CallLog from '@/components/secretary/CallLog'

interface Secretary {
  id: string
  business_name: string
  industry: string
  phone_number: string | null
  greeting_text: string
  system_prompt: string
  required_fields: string[]
  knowledge_items: Record<string, string>
  is_active: boolean
  confirmation_enabled: boolean
  confirmation_template: string | null
  response_deadline_hours: number
}

interface Call {
  id: string
  caller_name: string | null
  caller_phone: string | null
  caller_address: string | null
  summary: string
  transcript: string | null
  urgency: string
  status: string
  notes: string | null
  called_at: string
  customer_id?: string | null
  confirmation_sent_at?: string | null
}

export default function AiSecretaryPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [secretary, setSecretary] = useState<Secretary | null>(null)
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    try {
      const sec = await api.getSecretary()
      setSecretary(sec)
      if (sec) {
        const callData = await api.getCalls()
        setCalls(callData)
      }
    } catch (err) {
      console.error('Failed to load secretary:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSetupComplete = () => {
    fetchData()
  }

  const handleUpdateSettings = async (updates: Partial<Secretary>) => {
    setSaving(true)
    try {
      const updated = await api.updateSecretary(updates)
      setSecretary(updated)
      setShowSettings(false)
    } catch (err) {
      console.error('Failed to update secretary:', err)
    } finally {
      setSaving(false)
    }
  }

  const handlePushOrdrestyring = useCallback(async (customerId: string) => {
    try {
      await api.pushToOrdrestyring(customerId)
      alert(t('ordrestyringSuccess'))
      fetchData()
    } catch (e: any) {
      alert(e.message || t('ordrestyringError'))
    }
  }, [t])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[var(--text-muted)]">{t('loading')}</div>
      </div>
    )
  }

  // Not configured — show setup wizard
  if (!secretary) {
    return (
      <div className="p-4 md:p-6 animate-fadeIn max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">
            {t('aiSecretary')}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {t('setupWizardDesc')}
          </p>
        </div>
        <SetupWizard onComplete={handleSetupComplete} />
      </div>
    )
  }

  // Configured — show dashboard
  const newCallsList = calls.filter((c) => c.status === 'new').sort((a, b) => new Date(b.called_at).getTime() - new Date(a.called_at).getTime())
  const contactedCallsList = calls.filter((c) => c.status === 'contacted').sort((a, b) => new Date(b.called_at).getTime() - new Date(a.called_at).getTime())
  const resolvedCallsList = calls.filter((c) => c.status === 'resolved').sort((a, b) => new Date(b.called_at).getTime() - new Date(a.called_at).getTime())

  return (
    <div className="p-4 md:p-6 animate-fadeIn space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">
            {t('secretaryDashboard')}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-[var(--text-muted)]">
              {secretary.business_name}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
              secretary.is_active
                ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                : 'bg-[var(--surface-hover)] text-[var(--text-muted)]'
            }`}>
              {secretary.is_active ? t('active') : t('inactive')}
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--border)] transition-colors min-h-[44px]"
        >
          <Settings2 className="w-5 h-5" />
          {t('editSettings')}
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="card p-5 space-y-6">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            {t('editSettings')}
          </h2>
          <ScriptEditor
            greetingText={secretary.greeting_text}
            onGreetingChange={(v) => setSecretary({ ...secretary, greeting_text: v })}
            requiredFields={secretary.required_fields}
            onFieldsChange={(v) => setSecretary({ ...secretary, required_fields: v })}
            knowledgeItems={secretary.knowledge_items}
            onKnowledgeChange={(v) => setSecretary({ ...secretary, knowledge_items: v })}
            businessName={secretary.business_name}
          />

          {/* Bekræftelsesmail sektion */}
          <div className="pt-5 border-t border-[var(--border)]">
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-4">
              {t('confirmationMail')}
            </h3>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setSecretary({ ...secretary, confirmation_enabled: !secretary.confirmation_enabled })}
                  className={`w-12 h-7 rounded-full transition-all flex items-center px-0.5 cursor-pointer ${
                    secretary.confirmation_enabled
                      ? 'bg-blue-600 justify-end'
                      : 'bg-gray-300 dark:bg-zinc-600 justify-start'
                  }`}
                >
                  <div className="w-6 h-6 bg-white rounded-full shadow-sm" />
                </div>
                <span className="text-sm text-[var(--text-primary)]">
                  {t('confirmationEnabled')}
                </span>
              </label>

              {secretary.confirmation_enabled && (
                <>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1 block">
                      {t('responseDeadlineHours')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={secretary.response_deadline_hours}
                      onChange={(e) => setSecretary({ ...secretary, response_deadline_hours: parseInt(e.target.value) || 24 })}
                      className="w-24 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1 block">
                      {t('confirmationTemplate')}
                    </label>
                    <textarea
                      value={secretary.confirmation_template || 'Tak for din henvendelse til {business_name}.\n\nVi har modtaget din forespørgsel om: {summary}\n\nVi vender tilbage inden {response_deadline}.\n\nVenlig hilsen\n{business_name}'}
                      onChange={(e) => setSecretary({ ...secretary, confirmation_template: e.target.value })}
                      rows={6}
                      className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 resize-none font-mono min-h-[44px]"
                    />
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Variabler: {'{business_name}'}, {'{summary}'}, {'{response_deadline}'}, {'{caller_name}'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowSettings(false)
                fetchData()
              }}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--border)] transition-colors min-h-[44px]"
            >
              {t('cancel')}
            </button>
            <button
              onClick={() => handleUpdateSettings({
                greeting_text: secretary.greeting_text,
                required_fields: secretary.required_fields,
                knowledge_items: secretary.knowledge_items,
                confirmation_enabled: secretary.confirmation_enabled,
                confirmation_template: secretary.confirmation_template,
                response_deadline_hours: secretary.response_deadline_hours,
              } as any)}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? t('loading') : t('save')}
            </button>
          </div>
        </div>
      )}

      {/* 3 Kanban-kolonner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* ── Kolonne 1: Nye opkald ── */}
        <section className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] bg-blue-50 dark:bg-blue-500/10">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                <PhoneIncoming className="w-4 h-4" />
                Nye opkald
              </h2>
              <span className="text-2xl font-bold text-blue-700 dark:text-blue-400">{newCallsList.length}</span>
            </div>
          </div>
          {newCallsList.length > 0 ? (
            <CallLog calls={newCallsList} onCallUpdated={fetchData} onPushOrdrestyring={handlePushOrdrestyring} />
          ) : (
            <div className="py-10 text-center">
              <Phone className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] opacity-30" />
              <p className="text-sm text-[var(--text-muted)]">Ingen nye opkald</p>
            </div>
          )}
        </section>

        {/* ── Kolonne 2: Under behandling ── */}
        <section className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] bg-amber-50 dark:bg-amber-500/10">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Phone className="w-4 h-4" />
                Under behandling
              </h2>
              <span className="text-2xl font-bold text-amber-700 dark:text-amber-400">{contactedCallsList.length}</span>
            </div>
          </div>
          {contactedCallsList.length > 0 ? (
            <CallLog calls={contactedCallsList} onCallUpdated={fetchData} onPushOrdrestyring={handlePushOrdrestyring} />
          ) : (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] opacity-30" />
              <p className="text-sm text-[var(--text-muted)]">Ingen under behandling</p>
            </div>
          )}
        </section>

        {/* ── Kolonne 3: Færdiggjort ── */}
        <section className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] bg-green-50 dark:bg-green-500/10">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-green-700 dark:text-green-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Færdiggjort
              </h2>
              <span className="text-2xl font-bold text-green-700 dark:text-green-400">{resolvedCallsList.length}</span>
            </div>
          </div>
          {resolvedCallsList.length > 0 ? (
            <CallLog calls={resolvedCallsList} onCallUpdated={fetchData} onPushOrdrestyring={handlePushOrdrestyring} />
          ) : (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] opacity-30" />
              <p className="text-sm text-[var(--text-muted)]">Ingen færdiggjorte</p>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
