'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Mail, LayoutDashboard, FileText, BookOpen, Settings, Mic, CreditCard, X } from 'lucide-react'

interface Command {
  id: string
  label: string
  icon: React.ElementType
  action: () => void
  category: string
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
        setQuery('')
        setSelected(0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const navigate = useCallback((path: string) => {
    router.push(path)
    setOpen(false)
  }, [router])

  const commands: Command[] = [
    { id: 'dashboard', label: 'Gå til Dashboard', icon: LayoutDashboard, action: () => navigate('/'), category: 'Navigation' },
    { id: 'inbox', label: 'Gå til Indbakke', icon: Mail, action: () => navigate('/inbox'), category: 'Navigation' },
    { id: 'meetings', label: 'Gå til Mødenotater', icon: Mic, action: () => navigate('/meetings'), category: 'Navigation' },
    { id: 'templates', label: 'Gå til Skabeloner', icon: FileText, action: () => navigate('/templates'), category: 'Navigation' },
    { id: 'knowledge', label: 'Gå til Videnbase', icon: BookOpen, action: () => navigate('/knowledge'), category: 'Navigation' },
    { id: 'settings', label: 'Gå til Indstillinger', icon: Settings, action: () => navigate('/settings'), category: 'Navigation' },
    { id: 'billing', label: 'Gå til Abonnement', icon: CreditCard, action: () => navigate('/billing'), category: 'Navigation' },
    { id: 'new-meeting', label: 'Start møde-optagelse', icon: Mic, action: () => navigate('/meetings'), category: 'Handlinger' },
  ]

  const filtered = query.trim()
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter' && filtered[selected]) { filtered[selected].action() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, filtered, selected])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl mx-4 rounded-2xl bg-[var(--surface)] shadow-2xl border border-[var(--border)] overflow-hidden animate-[fadeSlideIn_0.15s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)]">
          <Search className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            placeholder="Søg eller skriv en kommando..."
            className="flex-1 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-sm outline-none"
          />
          <button onClick={() => setOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resultater */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-[var(--text-muted)] py-8">Ingen resultater</p>
          ) : (
            filtered.map((cmd, i) => {
              const Icon = cmd.icon
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    i === selected
                      ? 'bg-[#0CA9BA]/10 text-[#122B4A] dark:text-[#0CA9BA]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${i === selected ? 'text-[#0CA9BA]' : 'text-[var(--text-muted)]'}`} />
                  <span className="text-sm font-medium">{cmd.label}</span>
                  <span className="ml-auto text-xs text-[var(--text-muted)]">{cmd.category}</span>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--border)] flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span><kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-hover)] font-mono text-[10px]">↑↓</kbd> navigér</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-hover)] font-mono text-[10px]">↵</kbd> vælg</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-hover)] font-mono text-[10px]">Esc</kbd> luk</span>
          <span className="ml-auto"><kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-hover)] font-mono text-[10px]">⌘K</kbd></span>
        </div>
      </div>
    </div>
  )
}
