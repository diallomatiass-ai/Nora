'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { api } from '@/lib/api'
import { CheckCircle, ChevronRight, Loader2, Building2, Phone, FileText, Rocket } from 'lucide-react'

interface SetupWizardProps {
  onComplete: () => void
}

interface Industry {
  id: string
  name: string
  icon?: string
}

interface IndustryTemplate {
  greeting_text: string
  system_prompt: string
  required_fields: string[]
  knowledge_items: Record<string, string>
}

const STEP_ICONS = [Building2, Building2, FileText, Rocket]

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const { t } = useTranslation()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Branche
  const [industries, setIndustries] = useState<Industry[]>([])
  const [industriesLoaded, setIndustriesLoaded] = useState(false)
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null)

  // Step 2: Virksomhedsinfo
  const [businessName, setBusinessName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [cvrNumber, setCvrNumber] = useState('')

  // Step 3: Script/hilsen
  const [greetingText, setGreetingText] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [templateLoaded, setTemplateLoaded] = useState(false)

  const steps = [
    t('chooseIndustry'),
    t('confirmBusiness'),
    t('customizeScript'),
    t('confirmAndActivate'),
  ]

  const loadIndustries = async () => {
    if (industriesLoaded) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.getIndustries()
      setIndustries(data)
      setIndustriesLoaded(true)
    } catch (err: any) {
      setError(err.message || t('somethingWrong'))
    } finally {
      setLoading(false)
    }
  }

  const loadTemplate = async () => {
    if (!selectedIndustry || templateLoaded) return
    setLoading(true)
    setError(null)
    try {
      const tmpl: IndustryTemplate = await api.getIndustryTemplate(selectedIndustry, businessName || undefined)
      setGreetingText(tmpl.greeting_text || '')
      setSystemPrompt(tmpl.system_prompt || '')
      setTemplateLoaded(true)
    } catch (err: any) {
      setError(err.message || t('somethingWrong'))
    } finally {
      setLoading(false)
    }
  }

  const handleNext = async () => {
    setError(null)
    if (step === 0) {
      if (!selectedIndustry) return
      setStep(1)
    } else if (step === 1) {
      if (!businessName.trim()) return
      await loadTemplate()
      setStep(2)
    } else if (step === 2) {
      setStep(3)
    }
  }

  const handlePrev = () => {
    setError(null)
    if (step > 0) setStep(step - 1)
  }

  const handleSubmit = async () => {
    if (!selectedIndustry || !businessName.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await api.createSecretary({
        business_name: businessName.trim(),
        industry: selectedIndustry,
        phone_number: phoneNumber.trim() || undefined,
        cvr_number: cvrNumber.trim() || undefined,
        greeting_text: greetingText,
        system_prompt: systemPrompt,
        required_fields: ['name', 'phone', 'description'],
        knowledge_items: {},
      })
      onComplete()
    } catch (err: any) {
      setError(err.message || t('somethingWrong'))
    } finally {
      setSubmitting(false)
    }
  }

  // Indlæs brancher ved første render
  if (!industriesLoaded && step === 0 && !loading) {
    loadIndustries()
  }

  const canGoNext = () => {
    if (step === 0) return !!selectedIndustry
    if (step === 1) return businessName.trim().length > 0
    if (step === 2) return greetingText.trim().length > 0
    return true
  }

  return (
    <div className="space-y-6">
      {/* Step-indikator */}
      <div className="flex items-center gap-0">
        {steps.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  i < step
                    ? 'bg-green-600 text-white'
                    : i === step
                    ? 'bg-[#162249] dark:bg-[#42D1B9] text-white dark:text-[#0D1B3E]'
                    : 'bg-[var(--surface-hover)] text-[var(--text-muted)]'
                }`}
              >
                {i < step ? <CheckCircle className="w-5 h-5" /> : i + 1}
              </div>
              <span
                className={`text-xs mt-1 font-medium whitespace-nowrap hidden sm:block ${
                  i === step ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 transition-all ${
                  i < step ? 'bg-green-600' : 'bg-[var(--border)]'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Fejlbesked */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Step 0: Vælg branche ── */}
      {step === 0 && (
        <div className="card p-5">
          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">
            {t('chooseIndustry')}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-5">
            {t('chooseIndustryDesc')}
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {industries.map((ind) => (
                <button
                  key={ind.id}
                  onClick={() => setSelectedIndustry(ind.id)}
                  className={`px-4 py-4 rounded-xl border-2 text-left transition-all min-h-[64px] ${
                    selectedIndustry === ind.id
                      ? 'border-[#42D1B9] bg-[#42D1B9]/10 text-[#162249] dark:text-[#42D1B9]'
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:border-blue-300 hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {ind.icon && (
                    <span className="text-2xl mb-2 block">{ind.icon}</span>
                  )}
                  <span className="text-sm font-semibold">{ind.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 1: Virksomhedsinfo ── */}
      {step === 1 && (
        <div className="card p-5 space-y-4">
          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">
            {t('confirmBusiness')}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-3">
            {t('setupWizardDesc')}
          </p>

          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1.5 block">
              {t('businessName')} *
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => {
                setBusinessName(e.target.value)
                setTemplateLoaded(false)
              }}
              placeholder="f.eks. Andersens VVS ApS"
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[#42D1B9] focus:border-transparent min-h-[44px]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1.5 block">
              {t('phoneNumber')}
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="f.eks. +45 12 34 56 78"
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[#42D1B9] focus:border-transparent min-h-[44px]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1.5 block">
              CVR-nummer
            </label>
            <input
              type="text"
              value={cvrNumber}
              onChange={(e) => setCvrNumber(e.target.value)}
              placeholder="f.eks. 12345678"
              maxLength={8}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[#42D1B9] focus:border-transparent min-h-[44px]"
            />
          </div>
        </div>
      )}

      {/* ── Step 2: Script/hilsen ── */}
      {step === 2 && (
        <div className="card p-5 space-y-4">
          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">
            {t('customizeScript')}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-3">
            {t('customizeScriptDesc')}
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1.5 block">
                  {t('greeting')}
                </label>
                <textarea
                  value={greetingText}
                  onChange={(e) => setGreetingText(e.target.value)}
                  rows={4}
                  placeholder="Hej! Du har ringet til..."
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[#42D1B9] focus:border-transparent resize-none"
                />
              </div>

              {systemPrompt && (
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1.5 block">
                    {t('systemPrompt')}
                  </label>
                  <div className="px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text-secondary)] max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {systemPrompt}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Step 3: Bekræft og opret ── */}
      {step === 3 && (
        <div className="card p-5 space-y-5">
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Rocket className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">
              {t('confirmAndActivate')}
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              {t('activateDesc')}
            </p>
          </div>

          {/* Opsummering */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)] text-sm">
            <div className="flex items-center gap-3 px-4 py-3">
              <Building2 className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
              <span className="text-[var(--text-muted)] w-32 flex-shrink-0">{t('businessName')}</span>
              <span className="font-semibold text-[var(--text-primary)]">{businessName}</span>
            </div>
            {phoneNumber && (
              <div className="flex items-center gap-3 px-4 py-3">
                <Phone className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                <span className="text-[var(--text-muted)] w-32 flex-shrink-0">{t('phoneNumber')}</span>
                <span className="font-semibold text-[var(--text-primary)]">{phoneNumber}</span>
              </div>
            )}
            <div className="flex items-start gap-3 px-4 py-3">
              <FileText className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
              <span className="text-[var(--text-muted)] w-32 flex-shrink-0">{t('greeting')}</span>
              <span className="text-[var(--text-primary)] line-clamp-3">{greetingText}</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation-knapper */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrev}
          disabled={step === 0}
          className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--border)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
        >
          {t('prevStep')}
        </button>

        {step < steps.length - 1 ? (
          <button
            onClick={handleNext}
            disabled={!canGoNext() || loading}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {t('nextStep')}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                {t('activate')}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
