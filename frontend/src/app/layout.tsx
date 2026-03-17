import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { I18nProvider } from '@/lib/i18n'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Nora - AI Mailassistent',
  description: 'AI-drevet mailassistent til danske virksomheder',
  icons: {
    icon: '/logo.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`} style={{ backgroundColor: 'var(--bg)', color: 'var(--text-primary)' }}>
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
