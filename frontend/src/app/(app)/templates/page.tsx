'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Plus, Pencil, Trash2, Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from '@/lib/i18n'

interface Template {
  id: string
  name: string
  category: string | null
  body: string
  usage_count: number
}

const TONES = [
  { value: 'professionel', label: 'Professionel' },
  { value: 'venlig', label: 'Venlig' },
  { value: 'formel', label: 'Formel' },
  { value: 'kortfattet', label: 'Kortfattet' },
]

export default function TemplatesPage() {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', category: '', body: '' })

  // AI-generator state
  const [aiOpen, setAiOpen] = useState(false)
  const [aiDescription, setAiDescription] = useState('')
  const [aiTone, setAiTone] = useState('professionel')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const categoryLabels: Record<string, string> = {
    inquiry: t('inquiry'),
    complaint: t('complaint'),
    order: t('order'),
    support: t('support'),
    other: t('other'),
  }

  const fetchTemplates = async () => {
    try {
      const data = await api.listTemplates()
      setTemplates(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTemplates() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editId) {
        await api.updateTemplate(editId, { name: form.name, category: form.category || undefined, body: form.body })
      } else {
        await api.createTemplate({ name: form.name, category: form.category || undefined, body: form.body })
      }
      setForm({ name: '', category: '', body: '' })
      setShowForm(false)
      setEditId(null)
      setAiOpen(false)
      setAiDescription('')
      fetchTemplates()
    } catch (err) {
      console.error(err)
    }
  }

  const handleEdit = (tmpl: Template) => {
    setForm({ name: tmpl.name, category: tmpl.category || '', body: tmpl.body })
    setEditId(tmpl.id)
    setShowForm(true)
    setAiOpen(false)
    setAiDescription('')
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteTemplate'))) return
    await api.deleteTemplate(id)
    fetchTemplates()
  }

  const handleGenerate = async () => {
    if (!aiDescription.trim()) return
    setAiLoading(true)
    setAiError('')
    try {
      const result = await api.generateTemplate({
        description: aiDescription,
        category: form.category || undefined,
        tone: aiTone,
      }) as { body: string }
      setForm(prev => ({ ...prev, body: result.body }))
      setAiOpen(false)
    } catch {
      setAiError('Noget gik galt — prøv igen.')
    } finally {
      setAiLoading(false)
    }
  }

  const openNew = () => {
    setForm({ name: '', category: '', body: '' })
    setEditId(null)
    setAiOpen(false)
    setAiDescription('')
    setShowForm(true)
  }

  return (
    <div className="p-8 max-w-4xl animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('templates')}</h1>
        <button onClick={openNew} className="flex items-center gap-1.5 btn-primary px-4 py-2 text-sm">
          <Plus className="w-4 h-4" /> {t('newTemplate')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card p-6 mb-6 space-y-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {editId ? t('editTemplate') : t('newTemplate')}
          </h2>

          {/* Navn + kategori */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">{t('name')}</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="F.eks. Velkomstmail ny kunde"
                className="input-dark w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">{t('category')}</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input-dark w-full"
              >
                <option value="">{t('none')}</option>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* AI-generator sektion */}
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <button
              type="button"
              onClick={() => setAiOpen(!aiOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[var(--brand-teal,#0CA9BA)]/8 hover:bg-[var(--brand-teal,#0CA9BA)]/12 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-[#0CA9BA]">
                <Sparkles className="w-4 h-4" />
                Skriv med AI — beskriv hvad skabelonen skal bruges til
              </span>
              {aiOpen ? <ChevronUp className="w-4 h-4 text-[#0CA9BA]" /> : <ChevronDown className="w-4 h-4 text-[#0CA9BA]" />}
            </button>

            {aiOpen && (
              <div className="p-4 space-y-3 border-t border-[var(--border)] bg-[var(--surface)]">
                <textarea
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  placeholder="F.eks. &quot;En venlig velkomstmail til nye kunder der lige har købt hos os. Tak dem for købet og fortæl dem hvad der sker næste skridt.&quot;"
                  rows={3}
                  className="input-dark w-full resize-none"
                  autoFocus
                />
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-muted)] font-medium">Tone:</span>
                    {TONES.map(tone => (
                      <button
                        key={tone.value}
                        type="button"
                        onClick={() => setAiTone(tone.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          aiTone === tone.value
                            ? 'bg-[#0CA9BA] text-white'
                            : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {tone.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={aiLoading || !aiDescription.trim()}
                    className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-[#0CA9BA] hover:bg-[#0A95A6] text-white transition-colors disabled:opacity-50"
                  >
                    {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {aiLoading ? 'Genererer...' : 'Generer'}
                  </button>
                </div>
                {aiError && <p className="text-xs text-red-500">{aiError}</p>}
              </div>
            )}
          </div>

          {/* Indhold */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">{t('content')}</label>
              {form.body && (
                <span className="text-xs text-[var(--text-muted)]">
                  Pladsholdere: [NAVN] [VIRKSOMHED] [MEDARBEJDER]
                </span>
              )}
            </div>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              required
              rows={10}
              placeholder="Skriv skabelonen selv, eller brug AI-generatoren ovenfor..."
              className="input-dark w-full resize-y font-mono text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn-primary px-4 py-2 text-sm">
              {editId ? t('save') : t('create')}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditId(null); setAiOpen(false); setAiDescription('') }}
              className="px-4 py-2 text-sm text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-[var(--text-muted)]">{t('loading')}</p>
      ) : templates.length === 0 ? (
        <div className="glass-card p-8 text-center text-[var(--text-muted)]">
          {t('noTemplates')}
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="glass-card p-4 group hover:border-[var(--border)] transition-all duration-200">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-[var(--text-primary)]">{tmpl.name}</h3>
                    {tmpl.category && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--surface-hover)] text-[var(--text-muted)]">
                        {categoryLabels[tmpl.category] || tmpl.category}
                      </span>
                    )}
                    <span className="text-xs text-[var(--text-muted)]">{t('used')} {tmpl.usage_count}x</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2 whitespace-pre-line">{tmpl.body}</p>
                </div>
                <div className="flex gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => handleEdit(tmpl)} className="p-1.5 text-[var(--text-muted)] hover:text-[#0CA9BA] transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(tmpl.id)} className="p-1.5 text-[var(--text-muted)] hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
