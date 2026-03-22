'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import {
  Inbox, LayoutDashboard, FileText, BookOpen, Settings,
  Sun, Moon, ShieldCheck, CreditCard, Mic, LogOut, Users, CalendarDays,
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n'
import { api } from '@/lib/api'

interface BadgeCounts { unread: number }
interface CurrentUser { id: string; role: string; name: string; email: string }

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { t, theme, setTheme } = useTranslation()
  const [badges, setBadges] = useState<BadgeCounts>({ unread: 0 })
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    api.getMe().then((u: CurrentUser) => setCurrentUser(u)).catch(() => null)
  }, [])

  useEffect(() => {
    Promise.all([
      api.getDashboardSummary().catch(() => null),
      api.getReminderCount().catch(() => null),
    ]).then(([dash, reminderData]) => {
      const reminderCount = reminderData?.count ?? 0
      setBadges({ unread: (dash?.unread ?? 0) + reminderCount })
    })
  }, [pathname])

  function handleLogout() {
    localStorage.clear()
    router.push('/login')
  }

  const mainItems = [
    { href: '/', label: t('dashboard'), icon: LayoutDashboard, badge: 0 },
    { href: '/inbox', label: t('inbox'), icon: Inbox, badge: badges.unread },
    { href: '/calendar', label: 'Kalender', icon: CalendarDays, badge: 0 },
    { href: '/meetings', label: 'Mødenotater', icon: Mic, badge: 0 },
  ]

  const toolItems = [
    { href: '/customers', label: 'Kunder', icon: Users, badge: 0 },
    { href: '/templates', label: t('templates'), icon: FileText, badge: 0 },
    { href: '/knowledge', label: t('knowledgeBase'), icon: BookOpen, badge: 0 },
  ]

  const systemItems = [
    { href: '/billing', label: 'Abonnement', icon: CreditCard, badge: 0 },
    { href: '/settings', label: t('settings'), icon: Settings, badge: 0 },
    ...(currentUser?.role === 'admin'
      ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck, badge: 0 }]
      : []),
  ]

  const mobileItems = [...mainItems, toolItems[0]]

  function NavItem({ href, label, icon: Icon, badge }: { href: string; label: string; icon: React.ElementType; badge: number }) {
    const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
    return (
      <Link
        href={href}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-[120ms] ${
          isActive
            ? 'bg-[#122B4A] text-white dark:bg-[#0CA9BA]/15 dark:text-[#0CA9BA]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
        }`}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? '' : 'opacity-70'}`} />
        <span className="flex-1 truncate">{label}</span>
        {badge > 0 && (
          <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold px-1">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </Link>
    )
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 border-r border-[var(--border)] bg-[var(--surface)] flex-col flex-shrink-0">

        {/* Logo */}
        <div className="px-4 py-4 border-b border-[var(--border)]">
          <Image
            src={theme === 'dark' ? '/logo-dark.png' : '/logo.png'}
            alt="Nora"
            width={120}
            height={65}
            className="object-contain"
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
          {/* Gruppe 1 */}
          {mainItems.map(item => <NavItem key={item.href} {...item} />)}

          <hr className="my-2 border-[var(--border)]" />

          {/* Gruppe 2 */}
          {toolItems.map(item => <NavItem key={item.href} {...item} />)}

          <hr className="my-2 border-[var(--border)]" />

          {/* Gruppe 3 */}
          {systemItems.map(item => <NavItem key={item.href} {...item} />)}
        </nav>

        {/* Bund: bruger-widget + theme-toggle */}
        <div className="p-2.5 border-t border-[var(--border)] space-y-1">
          {/* Bruger-widget */}
          {currentUser && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#0CA9BA] to-[#122B4A] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                {getInitials(currentUser.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{currentUser.name}</p>
                <p className="text-[10px] text-[var(--text-muted)] truncate">{currentUser.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-[var(--text-muted)] hover:text-red-500 transition-colors"
                title="Log ud"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Theme-toggle */}
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {theme === 'light' ? t('themeNight') : t('themeDay')}
          </button>
        </div>
      </aside>

      {/* Mobil bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--surface)] border-t border-[var(--border)] safe-area-bottom">
        <div className="flex justify-around items-center h-16">
          {mobileItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full ${
                  isActive ? 'text-[#0CA9BA]' : 'text-[var(--text-muted)]'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-bold px-0.5">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
