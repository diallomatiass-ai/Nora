'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Phone, Mail, MapPin, Tag, DollarSign, Clock,
  CheckCircle, AlertTriangle, MessageSquare, PhoneIncoming,
  ClipboardList, Trash2, FileText, Send, ChevronRight,
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { api } from '@/lib/api'

interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  address_street: string | null
  address_zip: string | null
  address_city: string | null
  source: string
  status: string
  tags: string[] | null
  estimated_value: number | null
  notes: string | null
  external_id: string | null
  pushed_at: string | null
  created_at: string
  updated_at: string
}

interface TimelineItem {
  type: string
  id: string
  timestamp: string
  summary: string
  details: Record<string, any> | null
}

interface ActionItem {
  id: string
  customer_id: string
  source_type: string
  action: string
  description: string | null
  deadline: string | null
  status: string
  created_at: string
  completed_at: string | null
}

const STATUS_FLOW = [
  'ny_henvendelse',
  'kontaktet',
  'tilbud_sendt',
  'tilbud_accepteret',
  'afsluttet',
]

const STATUS_LABELS: Record<string, string> = {
  ny_henvendelse: 'statusNyHenvendelse',
  kontaktet: 'statusKontaktet',
  tilbud_sendt: 'statusTilbudSendt',
  tilbud_accepteret: 'statusTilbudAccepteret',
  afsluttet: 'statusAfsluttet',
  tilbud_afvist: 'statusTilbudAfvist',
  arkiveret: 'statusArkiveret',
}

const STATUS_COLORS: Record<string, string> = {
  ny_henvendelse: 'bg-[#42D1B9]',
  kontaktet: 'bg-amber-500',
  tilbud_sendt: 'bg-[#162249]',
  tilbud_accepteret: 'bg-green-500',
  afsluttet: 'bg-slate-400',
  tilbud_afvist: 'bg-red-500',
  arkiveret: 'bg-slate-300',
}

const ACTION_LABELS: Record<string, string> = {
  send_tilbud: 'sendTilbud',
  ring_tilbage: 'ringTilbage',
  send_info: 'sendInfo',
  book_tid: 'bookTid',
  andet: 'other',
}

const ACTION_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  done: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
}

export default function CustomerDetailPage() {
  const { t } = useTranslation()
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [editingStatus, setEditingStatus] = useState(false)
  const [draftModal, setDraftModal] = useState<{ subject: string; body: string } | null>(null)
  const [pushingOrdrestyring, setPushingOrdrestyring] = useState(false)
  const [ordrestyringMsg, setOrdrestyringMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [cust, tl, items] = await Promise.all([
        api.getCustomer(id),
        api.getCustomerTimeline(id),
        api.listActionItems({ customer_id: id }),
      ])
      setCustomer(cust)
      setTimeline(tl)
      setActionItems(items)
      setNotes(cust.notes || '')
    } catch (e) {
      console.error('Failed to load customer:', e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateStatus = async (newStatus: string) => {
    if (!customer) return
    try {
      const updated = await api.updateCustomer(id, { status: newStatus })
      setCustomer(updated)
    } catch (e) {
      console.error('Failed to update status:', e)
    }
  }

  const saveNotes = async () => {
    if (!customer) return
    try {
      await api.updateCustomer(id, { notes })
    } catch (e) {
      console.error('Failed to save notes:', e)
    }
  }

  const markDone = async (itemId: string) => {
    try {
      await api.updateActionItem(itemId, { status: 'done' })
      await loadData()
    } catch (e) {
      console.error('Failed to mark done:', e)
    }
  }

  const generateDraft = async (itemId: string) => {
    try {
      const draft = await api.generateFollowupDraft(itemId)
      setDraftModal(draft)
    } catch (e) {
      console.error('Failed to generate draft:', e)
    }
  }

  const deleteCustomer = async () => {
    if (!confirm('Slet denne kunde? Alle tilknyttede data bevares.')) return
    try {
      await api.deleteCustomer(id)
      router.push('/customers')
    } catch (e) {
      console.error('Failed to delete:', e)
    }
  }

  const handlePushOrdrestyring = async () => {
    if (!customer || customer.external_id) return
    setPushingOrdrestyring(true)
    setOrdrestyringMsg(null)
    try {
      await api.pushToOrdrestyring(id)
      setOrdrestyringMsg({ type: 'success', text: t('ordrestyringSuccess') })
      await loadData()
    } catch (e: any) {
      setOrdrestyringMsg({ type: 'error', text: e.message || t('ordrestyringError') })
    } finally {
      setPushingOrdrestyring(false)
    }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('da-DK', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  if (loading) {
    return <div className="p-6 text-center text-dim">{t('loading')}</div>
  }

  if (!customer) {
    return (
      <div className="p-6 text-center">
        <p className="text-dim">Kunde ikke fundet</p>
        <Link href="/customers" className="text-[#42D1B9] text-sm mt-2 inline-block">{t('back')}</Link>
      </div>
    )
  }

  const currentStatusIndex = STATUS_FLOW.indexOf(customer.status)

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/customers" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-all">
          <ArrowLeft className="w-5 h-5 text-dim" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-heading">{customer.name}</h1>
          <p className="text-xs text-dim mt-0.5">
            {customer.source === 'secretary_call' ? 'Via opkald' : customer.source === 'email' ? 'Via email' : 'Manuel'} &middot; {formatDate(customer.created_at)}
          </p>
        </div>
        <button onClick={deleteCustomer} className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Status pipeline */}
      <div className="glass-card p-4 mb-6">
        <div className="flex items-center gap-1">
          {STATUS_FLOW.map((status, i) => {
            const isActive = customer.status === status
            const isPast = currentStatusIndex >= 0 && i <= currentStatusIndex
            return (
              <div key={status} className="flex items-center flex-1">
                <button
                  onClick={() => updateStatus(status)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium text-center transition-all ${
                    isActive
                      ? `${STATUS_COLORS[status]} text-white shadow-sm`
                      : isPast
                        ? 'bg-slate-200 dark:bg-white/[0.1] text-body'
                        : 'bg-slate-100 dark:bg-white/[0.04] text-dim hover:bg-slate-200 dark:hover:bg-white/[0.08]'
                  }`}
                >
                  {t(STATUS_LABELS[status] as any)}
                </button>
                {i < STATUS_FLOW.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-dim flex-shrink-0 mx-0.5" />
                )}
              </div>
            )
          })}
        </div>
        {/* Alternative statuses */}
        {(customer.status === 'tilbud_afvist' || customer.status === 'arkiveret') && (
          <div className="mt-2 text-center">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              customer.status === 'tilbud_afvist'
                ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-500/10 dark:text-slate-500'
            }`}>
              {t(STATUS_LABELS[customer.status] as any)}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column — kontaktinfo + notes */}
        <div className="space-y-4">
          {/* Contact info */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-heading mb-3">{t('contactInfo')}</h3>
            <div className="space-y-2.5">
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-dim" />
                  <a href={`tel:${customer.phone}`} className="text-[#42D1B9] hover:underline">{customer.phone}</a>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-dim" />
                  <a href={`mailto:${customer.email}`} className="text-[#42D1B9] hover:underline">{customer.email}</a>
                </div>
              )}
              {(customer.address_street || customer.address_city) && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-dim mt-0.5" />
                  <div className="text-body">
                    {customer.address_street && <div>{customer.address_street}</div>}
                    {(customer.address_zip || customer.address_city) && (
                      <div>{[customer.address_zip, customer.address_city].filter(Boolean).join(' ')}</div>
                    )}
                  </div>
                </div>
              )}
              {customer.estimated_value && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-dim" />
                  <span className="text-body font-medium">{customer.estimated_value.toLocaleString('da-DK')} kr</span>
                </div>
              )}
              {customer.tags && customer.tags.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Tag className="w-4 h-4 text-dim" />
                  <div className="flex flex-wrap gap-1">
                    {customer.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-slate-100 dark:bg-white/[0.06] rounded-full text-xs text-dim">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ordrestyring */}
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/[0.06]">
              {customer.external_id ? (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <div>
                    <span className="text-green-600 dark:text-green-400 font-medium">{t('pushedToOrdrestyring')}</span>
                    {customer.pushed_at && (
                      <p className="text-xs text-dim">{formatDate(customer.pushed_at)}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <button
                    onClick={handlePushOrdrestyring}
                    disabled={pushingOrdrestyring}
                    className="btn-primary w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
                  >
                    {pushingOrdrestyring ? (
                      t('pushingToOrdrestyring')
                    ) : (
                      <>
                        {t('pushToOrdrestyring')}
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  {ordrestyringMsg && (
                    <p className={`text-xs mt-1.5 ${ordrestyringMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                      {ordrestyringMsg.text}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-heading mb-3">{t('notes')}</h3>
            <textarea
              className="input-field w-full h-32 resize-none text-sm"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={saveNotes}
              placeholder="Tilføj noter..."
            />
          </div>
        </div>

        {/* Middle column — timeline */}
        <div className="col-span-2 space-y-4">
          {/* Action items */}
          {actionItems.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-heading mb-3 flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                {t('actionItems')} ({actionItems.filter(i => i.status !== 'done').length})
              </h3>
              <div className="space-y-2">
                {actionItems.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      item.status === 'done'
                        ? 'border-green-200 dark:border-green-500/20 bg-green-50/50 dark:bg-green-500/5 opacity-60'
                        : item.status === 'overdue'
                          ? 'border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5'
                          : 'border-slate-200 dark:border-white/[0.06]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-heading">
                          {t(ACTION_LABELS[item.action] as any || 'other')}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_STATUS_COLORS[item.status] || ''}`}>
                          {item.status === 'pending' ? t('pending') : item.status === 'overdue' ? t('overdue') : t('done')}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-xs text-dim mt-0.5 truncate">{item.description}</p>
                      )}
                      {item.deadline && (
                        <p className="text-xs text-dim mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(item.deadline)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {item.status !== 'done' && (
                        <>
                          <button
                            onClick={() => markDone(item.id)}
                            className="p-1.5 rounded-lg text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 transition-all"
                            title={t('markDone')}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => generateDraft(item.id)}
                            className="p-1.5 rounded-lg text-[#42D1B9] hover:bg-[#42D1B9]/10 transition-all"
                            title={t('generateFollowup')}
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-heading mb-4">{t('customerTimeline')}</h3>
            {timeline.length === 0 ? (
              <p className="text-sm text-dim text-center py-4">{t('noData')}</p>
            ) : (
              <div className="space-y-0">
                {timeline.map((item, i) => (
                  <div key={`${item.type}-${item.id}`} className="flex gap-3">
                    {/* Timeline line + dot */}
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        item.type === 'email'
                          ? 'bg-[#42D1B9]/15 dark:bg-[#42D1B9]/20 text-[#42D1B9]'
                          : item.type === 'call'
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-500'
                            : 'bg-amber-100 dark:bg-amber-500/20 text-amber-500'
                      }`}>
                        {item.type === 'email' ? <MessageSquare className="w-4 h-4" /> :
                         item.type === 'call' ? <PhoneIncoming className="w-4 h-4" /> :
                         <ClipboardList className="w-4 h-4" />}
                      </div>
                      {i < timeline.length - 1 && (
                        <div className="w-px flex-1 bg-slate-200 dark:bg-white/[0.06] my-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="pb-4 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-heading truncate">{item.summary}</span>
                        {item.details?.urgency && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            item.details.urgency === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                            item.details.urgency === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                            'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                          }`}>
                            {item.details.urgency}
                          </span>
                        )}
                        {item.details?.confirmation_sent && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400">
                            {t('confirmationSent')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-dim mt-0.5">{formatDate(item.timestamp)}</p>
                      {item.details?.from && (
                        <p className="text-xs text-dim">Fra: {item.details.from}</p>
                      )}
                      {item.details?.caller_phone && (
                        <p className="text-xs text-dim">Tlf: {item.details.caller_phone}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Draft modal */}
      {draftModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn" onClick={() => setDraftModal(null)}>
          <div className="glass-card p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-heading mb-3">{t('generateFollowup')}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-dim font-medium">Emne</label>
                <p className="text-sm text-heading font-medium mt-1">{draftModal.draft_subject}</p>
              </div>
              <div>
                <label className="text-xs text-dim font-medium">Brødtekst</label>
                <pre className="text-sm text-body mt-1 whitespace-pre-wrap font-sans bg-slate-50 dark:bg-white/[0.04] p-3 rounded-lg">
                  {draftModal.draft_body}
                </pre>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setDraftModal(null)}
                className="px-4 py-2 text-sm font-medium text-dim hover:text-body rounded-lg"
              >
                Luk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
