'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Search, Plus, Users, TrendingUp, AlertTriangle, X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { api } from '@/lib/api'

interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  status: string
  source: string
  estimated_value: number | null
  created_at: string
  _email_count?: number
  _call_count?: number
}

interface CustomerDashboard {
  total_customers: number
  new_this_week: number
  pipeline_value: number
  overdue_tasks: number
}

const STATUS_COLORS: Record<string, string> = {
  ny_henvendelse: 'bg-[#42D1B9]/15 text-[#162249] dark:bg-[#42D1B9]/20 dark:text-[#42D1B9]',
  kontaktet: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  tilbud_sendt: 'bg-[#162249]/10 text-[#162249] dark:bg-[#42D1B9]/10 dark:text-[#a8bdd6]',
  tilbud_accepteret: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
  afsluttet: 'bg-slate-100 text-slate-500 dark:bg-slate-500/20 dark:text-slate-400',
  tilbud_afvist: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  arkiveret: 'bg-slate-100 text-slate-400 dark:bg-slate-500/10 dark:text-slate-500',
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  ny_henvendelse: 'statusNyHenvendelse',
  kontaktet: 'statusKontaktet',
  tilbud_sendt: 'statusTilbudSendt',
  tilbud_accepteret: 'statusTilbudAccepteret',
  afsluttet: 'statusAfsluttet',
  tilbud_afvist: 'statusTilbudAfvist',
  arkiveret: 'statusArkiveret',
}

const STATUS_OPTIONS = [
  { value: '', label: 'Alle statuser' },
  { value: 'ny_henvendelse', label: 'Ny henvendelse' },
  { value: 'kontaktet', label: 'Kontaktet' },
  { value: 'tilbud_sendt', label: 'Tilbud sendt' },
  { value: 'tilbud_accepteret', label: 'Tilbud accepteret' },
  { value: 'afsluttet', label: 'Afsluttet' },
  { value: 'tilbud_afvist', label: 'Tilbud afvist' },
  { value: 'arkiveret', label: 'Arkiveret' },
]

export default function CustomersPage() {
  const { t } = useTranslation()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [dashboard, setDashboard] = useState<CustomerDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)

  // Søg + filter
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Opret ny kunde modal
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Debounce søgning
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [searchQuery])

  const loadCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params: { search?: string; status?: string } = {}
      if (debouncedSearch) params.search = debouncedSearch
      if (statusFilter) params.status = statusFilter
      const data = await api.listCustomers(params)
      setCustomers(data || [])
    } catch (e) {
      console.error('Failed to load customers:', e)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, statusFilter])

  const loadDashboard = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data = await api.getCustomerDashboard()
      setDashboard(data)
    } catch (e) {
      console.error('Failed to load customer dashboard:', e)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) {
      setCreateError('Navn er påkrævet')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      await api.createCustomer({
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
      })
      setShowModal(false)
      setNewName('')
      setNewPhone('')
      setNewEmail('')
      await Promise.all([loadCustomers(), loadDashboard()])
    } catch (e: any) {
      setCreateError(e.message || 'Kunne ikke oprette kunde')
    } finally {
      setCreating(false)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setNewName('')
    setNewPhone('')
    setNewEmail('')
    setCreateError('')
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('da-DK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })

  const formatCurrency = (val: number) =>
    val.toLocaleString('da-DK') + ' kr'

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('customers')}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Administrer dine kunder og pipeline
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
        >
          <Plus className="w-4 h-4" />
          {t('newCustomer')}
        </button>
      </div>

      {/* Stats-bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Total kunder */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#42D1B9]/10">
              <Users className="w-4 h-4 text-[#42D1B9]" />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {t('totalCustomers')}
              </p>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {statsLoading ? '—' : (dashboard?.total_customers ?? 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Nye denne uge */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-500/20">
              <Plus className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {t('newThisWeek')}
              </p>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {statsLoading ? '—' : (dashboard?.new_this_week ?? 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Pipeline-værdi */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#162249]/10 dark:bg-[#42D1B9]/10">
              <TrendingUp className="w-4 h-4 text-[#162249] dark:text-[#42D1B9]" />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {t('pipelineValue')}
              </p>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {statsLoading
                  ? '—'
                  : dashboard?.pipeline_value
                  ? formatCurrency(dashboard.pipeline_value)
                  : '0 kr'}
              </p>
            </div>
          </div>
        </div>

        {/* Forfaldne opgaver */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {t('overdueTasks')}
              </p>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {statsLoading ? '—' : (dashboard?.overdue_tasks ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Søg + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Søg navn, telefon eller email..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--surface)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--surface)',
            color: 'var(--text-primary)',
          }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Kundeliste */}
      {loading ? (
        <div
          className="text-center py-16 text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          {t('loading')}
        </div>
      ) : customers.length === 0 ? (
        <div className="card p-12 text-center">
          <Users
            className="w-12 h-12 mx-auto mb-3 opacity-30"
            style={{ color: 'var(--text-muted)' }}
          />
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            {debouncedSearch || statusFilter
              ? 'Ingen kunder matcher dine filtre'
              : t('noCustomers')}
          </p>
          {!debouncedSearch && !statusFilter && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 text-sm text-[#42D1B9] hover:text-[#56DEC8] hover:underline"
            >
              Opret din første kunde
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b text-xs font-semibold uppercase tracking-wider"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--surface)',
                  }}
                >
                  <th className="px-4 py-3 text-left">Navn</th>
                  <th className="px-4 py-3 text-left">Telefon</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-center">Emails</th>
                  <th className="px-4 py-3 text-center">Opkald</th>
                  <th className="px-4 py-3 text-left">Oprettet</th>
                  <th className="px-4 py-3 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = '')
                    }
                  >
                    {/* Navn */}
                    <td className="px-4 py-3">
                      <span className="font-medium">{customer.name}</span>
                      {customer.estimated_value ? (
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {formatCurrency(customer.estimated_value)}
                        </p>
                      ) : null}
                    </td>

                    {/* Telefon */}
                    <td className="px-4 py-3">
                      {customer.phone ? (
                        <a
                          href={`tel:${customer.phone}`}
                          className="text-[#42D1B9] hover:text-[#56DEC8] hover:underline"
                        >
                          {customer.phone}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3">
                      {customer.email ? (
                        <a
                          href={`mailto:${customer.email}`}
                          className="text-[#42D1B9] hover:text-[#56DEC8] hover:underline truncate max-w-[180px] block"
                        >
                          {customer.email}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          STATUS_COLORS[customer.status] ||
                          'bg-slate-100 text-slate-500 dark:bg-slate-500/20 dark:text-slate-400'
                        }`}
                      >
                        {t(
                          (STATUS_LABEL_KEYS[customer.status] as any) ||
                            customer.status
                        )}
                      </span>
                    </td>

                    {/* Emails */}
                    <td
                      className="px-4 py-3 text-center"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {customer._email_count ?? 0}
                    </td>

                    {/* Opkald */}
                    <td
                      className="px-4 py-3 text-center"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {customer._call_count ?? 0}
                    </td>

                    {/* Oprettet */}
                    <td
                      className="px-4 py-3 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {formatDate(customer.created_at)}
                    </td>

                    {/* Link */}
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="text-xs font-medium text-[#42D1B9] hover:text-[#56DEC8] hover:underline whitespace-nowrap"
                      >
                        Se detaljer →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Opret ny kunde */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div
            className="card p-6 w-full max-w-md mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-lg font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('newCustomer')}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label
                  className="block text-xs font-semibold mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Navn <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Fulde navn eller virksomhedsnavn"
                  className="w-full px-3 py-2 text-sm rounded-lg border"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--bg)',
                    color: 'var(--text-primary)',
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label
                  className="block text-xs font-semibold mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('phone')}
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+45 12 34 56 78"
                  className="w-full px-3 py-2 text-sm rounded-lg border"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--bg)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div>
                <label
                  className="block text-xs font-semibold mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {t('email')}
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="kunde@eksempel.dk"
                  className="w-full px-3 py-2 text-sm rounded-lg border"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--bg)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {createError && (
                <p className="text-xs text-red-500">{createError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg disabled:opacity-50"
                >
                  {creating ? 'Opretter...' : t('create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
