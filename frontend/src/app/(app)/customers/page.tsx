'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { Users, Plus, Search, X, ChevronRight, Phone, Mail, Tag, TrendingUp } from 'lucide-react'

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: string
  estimated_value: number | null
  tags: string[]
  source: string | null
  address_city: string | null
  created_at: string
}

interface CustomerDashboard {
  total: number
  new_this_week: number
  pipeline_value: number
  by_status: Record<string, number>
}

const STATUS_LABELS: Record<string, string> = {
  ny_henvendelse: 'Ny',
  kontaktet: 'Kontaktet',
  tilbud_sendt: 'Tilbud sendt',
  tilbud_accepteret: 'Accepteret',
  afsluttet: 'Afsluttet',
  tilbud_afvist: 'Afvist',
  arkiveret: 'Arkiveret',
}

const STATUS_COLORS: Record<string, string> = {
  ny_henvendelse: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  kontaktet: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  tilbud_sendt: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  tilbud_accepteret: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
  afsluttet: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
  tilbud_afvist: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  arkiveret: 'bg-slate-100 text-slate-500 dark:bg-slate-500/20 dark:text-slate-500',
}

interface CreateForm {
  name: string
  email: string
  phone: string
  address_street: string
  address_zip: string
  address_city: string
  notes: string
  estimated_value: string
}

const emptyForm: CreateForm = {
  name: '',
  email: '',
  phone: '',
  address_street: '',
  address_zip: '',
  address_city: '',
  notes: '',
  estimated_value: '',
}

export default function CustomersPage() {
  const { t } = useTranslation()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [dashboard, setDashboard] = useState<CustomerDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateForm>(emptyForm)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [list, dash] = await Promise.all([
        api.listCustomers({ search: search || undefined, status: statusFilter || undefined, limit: 100 }),
        api.getCustomerDashboard(),
      ])
      setCustomers(list)
      setDashboard(dash)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      await api.createCustomer({
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address_street: form.address_street || undefined,
        address_zip: form.address_zip || undefined,
        address_city: form.address_city || undefined,
        notes: form.notes || undefined,
        estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : undefined,
      })
      setForm(emptyForm)
      setShowCreate(false)
      load()
    } catch {
      // silent
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#42D1B9]" />
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('customers')}</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#42D1B9] hover:bg-[#38C4AD] text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('newCustomer')}
        </button>
      </div>

      {/* Stats */}
      {dashboard && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-[#162249] dark:text-[#42D1B9]">{dashboard.total}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{t('totalCustomers')}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-[#162249] dark:text-[#42D1B9]">{dashboard.new_this_week}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{t('newThisWeek')}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {dashboard.pipeline_value ? `${(dashboard.pipeline_value / 1000).toFixed(0)}k` : '0'}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{t('pipelineValue')}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[#42D1B9]/40"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#42D1B9]/40"
        >
          <option value="">Alle statuser</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse h-20 bg-[var(--surface-hover)]" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-10 h-10 mx-auto mb-3 text-[var(--border)]" />
          <p className="text-[var(--text-muted)]">{t('noCustomers')}</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 px-4 py-2 rounded-lg bg-[#42D1B9]/10 text-[#42D1B9] text-sm font-medium hover:bg-[#42D1B9]/20 transition-colors"
          >
            Opret den første kunde
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map(c => (
            <Link
              key={c.id}
              href={`/customers/${c.id}`}
              className="card p-4 flex items-center gap-4 hover:bg-[var(--surface-hover)] transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-[#42D1B9]/10 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-[#42D1B9]">
                  {c.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-[var(--text-primary)] truncate">{c.name}</p>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${STATUS_COLORS[c.status] || 'bg-slate-100 text-slate-600'}`}>
                    {STATUS_LABELS[c.status] || c.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {c.email && (
                    <span className="flex items-center gap-1 text-xs text-[var(--text-muted)] truncate">
                      <Mail className="w-3 h-3 flex-shrink-0" />{c.email}
                    </span>
                  )}
                  {c.phone && (
                    <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <Phone className="w-3 h-3 flex-shrink-0" />{c.phone}
                    </span>
                  )}
                  {c.address_city && (
                    <span className="text-xs text-[var(--text-muted)]">{c.address_city}</span>
                  )}
                </div>
                {c.tags && c.tags.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Tag className="w-3 h-3 text-[var(--text-muted)]" />
                    {c.tags.map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 rounded bg-[var(--surface-hover)] text-[10px] text-[var(--text-muted)]">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {c.estimated_value ? (
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm font-semibold text-green-600 dark:text-green-400">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {c.estimated_value.toLocaleString('da-DK')} kr
                    </div>
                  </div>
                ) : null}
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[#42D1B9] transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-lg card p-6 space-y-4 animate-fadeIn" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('newCustomer')}</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)]">
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Navn *</label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[#42D1B9]/40"
                  placeholder="Kundens navn"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[#42D1B9]/40"
                    placeholder="kunde@email.dk"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[#42D1B9]/40"
                    placeholder="+45 12 34 56 78"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Adresse</label>
                  <input
                    value={form.address_street}
                    onChange={e => setForm(f => ({ ...f, address_street: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[#42D1B9]/40"
                    placeholder="Gade 1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Postnr.</label>
                  <input
                    value={form.address_zip}
                    onChange={e => setForm(f => ({ ...f, address_zip: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[#42D1B9]/40"
                    placeholder="2100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">By</label>
                  <input
                    value={form.address_city}
                    onChange={e => setForm(f => ({ ...f, address_city: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[#42D1B9]/40"
                    placeholder="København"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Estimeret værdi (kr)</label>
                  <input
                    type="number"
                    value={form.estimated_value}
                    onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[#42D1B9]/40"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Noter</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm focus:outline-none focus:ring-2 focus:ring-[#42D1B9]/40 resize-none"
                  placeholder="Intern note om kunden..."
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-sm font-medium hover:bg-[var(--surface-hover)] transition-colors"
                >
                  Annuller
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#42D1B9] hover:bg-[#38C4AD] disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                >
                  {creating ? 'Opretter...' : 'Opret kunde'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
