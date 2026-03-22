import Sidebar from '@/components/Sidebar'
import CommandChat from '@/components/CommandChat'
import CommandPalette from '@/components/CommandPalette'
import { ToastProvider } from '@/components/Toast'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
        <CommandChat />
        <CommandPalette />
      </div>
    </ToastProvider>
  )
}
