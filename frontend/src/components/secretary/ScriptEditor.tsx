'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'
import { Plus, Trash2, MessageSquare, ClipboardList, BookOpen } from 'lucide-react'

interface ScriptEditorProps {
  greetingText: string
  onGreetingChange: (v: string) => void
  requiredFields: string[]
  onFieldsChange: (v: string[]) => void
  knowledgeItems: Record<string, string>
  onKnowledgeChange: (v: Record<string, string>) => void
  businessName: string
}

const AVAILABLE_FIELDS = [
  { key: 'name', labelKey: 'fieldName' },
  { key: 'phone', labelKey: 'fieldPhone' },
  { key: 'address', labelKey: 'fieldAddress' },
  { key: 'description', labelKey: 'fieldDescription' },
  { key: 'urgency', labelKey: 'fieldUrgency' },
] as const

export default function ScriptEditor({
  greetingText,
  onGreetingChange,
  requiredFields,
  onFieldsChange,
  knowledgeItems,
  onKnowledgeChange,
  businessName,
}: ScriptEditorProps) {
  const { t } = useTranslation()

  // State til ny knowledge-post
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  const toggleField = (fieldKey: string) => {
    if (requiredFields.includes(fieldKey)) {
      onFieldsChange(requiredFields.filter((f) => f !== fieldKey))
    } else {
      onFieldsChange([...requiredFields, fieldKey])
    }
  }

  const addKnowledgeItem = () => {
    const trimmedKey = newKey.trim()
    const trimmedValue = newValue.trim()
    if (!trimmedKey || !trimmedValue) return
    onKnowledgeChange({ ...knowledgeItems, [trimmedKey]: trimmedValue })
    setNewKey('')
    setNewValue('')
  }

  const updateKnowledgeKey = (oldKey: string, newKeyValue: string) => {
    const entries = Object.entries(knowledgeItems)
    const updated: Record<string, string> = {}
    for (const [k, v] of entries) {
      updated[k === oldKey ? newKeyValue : k] = v
    }
    onKnowledgeChange(updated)
  }

  const updateKnowledgeValue = (key: string, value: string) => {
    onKnowledgeChange({ ...knowledgeItems, [key]: value })
  }

  const removeKnowledgeItem = (key: string) => {
    const updated = { ...knowledgeItems }
    delete updated[key]
    onKnowledgeChange(updated)
  }

  const knowledgeEntries = Object.entries(knowledgeItems)

  return (
    <div className="space-y-6">
      {/* ── Velkomsthilsen ── */}
      <div>
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-blue-500" />
          {t('greeting')}
        </h3>
        <textarea
          value={greetingText}
          onChange={(e) => onGreetingChange(e.target.value)}
          rows={4}
          placeholder={businessName ? `Hej! Du har ringet til ${businessName}...` : 'Hej! Du har ringet til...'}
          className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Velkomstteksten AI'en bruger når den svarer opkald.
        </p>
      </div>

      {/* ── Påkrævede felter ── */}
      <div>
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 mb-3">
          <ClipboardList className="w-4 h-4 text-blue-500" />
          {t('requiredFieldsLabel')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AVAILABLE_FIELDS.map(({ key, labelKey }) => {
            const isChecked = requiredFields.includes(key)
            return (
              <label
                key={key}
                onClick={() => toggleField(key)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer transition-all select-none min-h-[48px] ${
                  isChecked
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                    : 'border-[var(--border)] bg-[var(--surface)] hover:border-blue-300 hover:bg-[var(--surface-hover)]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all ${
                    isChecked ? 'bg-blue-600' : 'border-2 border-[var(--border)] bg-[var(--surface)]'
                  }`}
                >
                  {isChecked && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    isChecked ? 'text-blue-700 dark:text-blue-300' : 'text-[var(--text-primary)]'
                  }`}
                >
                  {t(labelKey as any)}
                </span>
              </label>
            )
          })}
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          AI'en vil spørge kunden om de valgte oplysninger under opkaldet.
        </p>
      </div>

      {/* ── Vidensbase (FAQ) ── */}
      <div>
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-blue-500" />
          {t('knowledgeItemsLabel')}
        </h3>

        {knowledgeEntries.length > 0 && (
          <div className="space-y-2 mb-3">
            {knowledgeEntries.map(([key, value]) => (
              <div
                key={key}
                className="flex items-start gap-2 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]"
              >
                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => updateKnowledgeKey(key, e.target.value)}
                    placeholder={t('key')}
                    className="px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-blue-500 focus:border-transparent min-h-[36px]"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => updateKnowledgeValue(key, e.target.value)}
                    placeholder={t('value')}
                    className="px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-blue-500 focus:border-transparent min-h-[36px]"
                  />
                </div>
                <button
                  onClick={() => removeKnowledgeItem(key)}
                  className="p-1.5 rounded text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0 mt-0.5"
                  aria-label="Fjern"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tilføj ny post */}
        <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg)]">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addKnowledgeItem()
              }}
              placeholder={t('key') + ' (f.eks. Åbningstider)'}
              className="px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-blue-500 focus:border-transparent min-h-[36px]"
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addKnowledgeItem()
              }}
              placeholder={t('value') + ' (f.eks. Man-fre 8-17)'}
              className="px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] focus:ring-1 focus:ring-blue-500 focus:border-transparent min-h-[36px]"
            />
          </div>
          <button
            onClick={addKnowledgeItem}
            disabled={!newKey.trim() || !newValue.trim()}
            className="p-1.5 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            aria-label={t('addKnowledge')}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[var(--text-muted)] mt-2">
          AI'en bruger denne information til at besvare kunders spørgsmål (åbningstider, priser, services osv.).
        </p>
      </div>
    </div>
  )
}
