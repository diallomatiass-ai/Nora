'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import {
  ShieldCheck, Clock, Mail, Mic, Zap, Globe,
  ArrowRight, Check, Star, ChevronDown,
  ThumbsUp, Pencil, X, Send, Calendar, FileText,
} from 'lucide-react'

// ─── Data ─────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Zap,
    title: 'AI svarer på 2 minutter',
    desc: 'Nora læser, klassificerer og udarbejder et svarforslag i din tone — du godkender med ét klik.',
  },
  {
    icon: ShieldCheck,
    title: '100% EU-data. Fuldt GDPR-compliant.',
    desc: 'Al AI-processering sker inden for EU. Dine data forlader aldrig EU og deles aldrig med tredjepart.',
  },
  {
    icon: Mic,
    title: 'Møde-agent',
    desc: 'Nora transkriberer dine møder live, skriver referat og sender det til deltagerne automatisk.',
  },
  {
    icon: Clock,
    title: 'Spar 2-3 timer om dagen',
    desc: 'Professionelle bruger i snit 2,8 timer dagligt på mails. Nora håndterer 80% af dem — uden at du mister kontrollen.',
  },
  {
    icon: Globe,
    title: 'Dansk, engelsk og mere',
    desc: 'Nora forstår og svarer på tværs af sprog — og tilpasser sig præcis din faglige tone og terminologi.',
  },
  {
    icon: Mail,
    title: 'Kobles til Gmail & Outlook',
    desc: 'Ingen ny indbakke at lære. Nora arbejder direkte med de konti du allerede bruger.',
  },
]

const steps = [
  { num: '01', title: 'Forbind din mailkonto', desc: 'Gmail eller Outlook. Tager under 2 minutter.' },
  { num: '02', title: 'Nora lærer din stil', desc: 'Fortæl Nora om din rolle, dine fagtermer og den tone du ønsker.' },
  { num: '03', title: 'Godkend med ét klik', desc: 'Nora foreslår — du beslutter. Altid.' },
]

const plans = [
  {
    name: 'Starter',
    price: '199',
    desc: 'Til dig der vil have kontrol over indbakken',
    features: ['1 indbakke og kalender', 'AI-svarforslag i din tone', 'Møde-notetaker', 'AI processeret i EU · GDPR-compliant', 'E-mail support'],
    cta: 'Start gratis',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '399',
    desc: 'Til travle professionelle og teams',
    features: ['Flere indbakker og kalendre', 'AI-svarforslag i din tone', 'Møde-notetaker', 'Skabeloner og videnbase', 'Flersproget (da/en/sv/no)', 'AI processeret i EU · GDPR-compliant', 'Chat support'],
    cta: 'Start gratis',
    highlight: true,
  },
  {
    name: 'Business',
    price: '999',
    desc: 'Til teams og organisationer',
    features: ['Alt i Pro', 'Dedikeret onboarding', 'SLA 99,9%', 'GDPR DPA-aftale', 'API-adgang', 'Telefon support'],
    cta: 'Kontakt os',
    highlight: false,
  },
]

const faqs = [
  {
    q: 'Er fortrolig korrespondance sikker?',
    a: 'Ja. Al AI-processering sker inden for EU. Dine data forlader aldrig EU og deles aldrig med tredjepart. Vi har en DPA (Data Processing Agreement) og er fuldt GDPR-compliant — også ved behandling af fortrolige klient- og forretningsoplysninger.',
  },
  {
    q: 'Sender Nora mails automatisk?',
    a: 'Nej — medmindre du eksplicit beder om det. Standard-flowet er: Nora foreslår, du godkender, Nora sender. Du har altid det sidste ord.',
  },
  {
    q: 'Virker det med min branches fagsprog?',
    a: 'Ja. Du kan tilpasse Noras videnbase med din organisations fagtermer, standardformuleringer og ønskede tone — uanset om du er advokat, receptionist, leder eller noget helt andet.',
  },
  {
    q: 'Hvad sker der efter de 7 dage?',
    a: 'Du vælger selv et abonnement eller stopper — ingen automatisk betaling. Vi sender en påmindelse 3 dage før prøveperioden udløber.',
  },
]

// ─── Demo Showcase ─────────────────────────────────────────────────────────────

const demoTabs = [
  { id: 'email', label: 'AI-svarforslag', icon: Mail },
  { id: 'meeting', label: 'Mødereferat', icon: Mic },
  { id: 'booking', label: 'Booking-svar', icon: Calendar },
]

function DemoShowcase() {
  const [active, setActive] = useState('email')
  const [approved, setApproved] = useState(false)

  return (
    <div className="bg-white border border-[#E4E7EE] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-[#E4E7EE] bg-[#F8F9FB]">
        {demoTabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => { setActive(tab.id); setApproved(false) }}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-all border-b-2 ${
                active === tab.id
                  ? 'border-[#0CA9BA] text-[#0CA9BA] bg-white'
                  : 'border-transparent text-[#8896A4] hover:text-[#4A5568]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Panel */}
      <div className="p-6 md:p-8">
        {active === 'email' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Indgående mail */}
            <div>
              <p className="text-xs font-semibold text-[#8896A4] uppercase tracking-wider mb-3">Indgående mail</p>
              <div className="bg-[#F8F9FB] rounded-xl p-5 border border-[#E4E7EE]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-[#122B4A] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">SM</div>
                  <div>
                    <p className="text-sm font-semibold text-[#0D1321]">Sofie Mathiesen</p>
                    <p className="text-xs text-[#8896A4]">sofie@mathiesen-advokater.dk</p>
                  </div>
                  <div className="ml-auto flex gap-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Haster</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0CA9BA]/10 text-[#0CA9BA]">Forespørgsel</span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-[#0D1321] mb-2">Tilbud på HR-rådgivning</p>
                <p className="text-sm text-[#4A5568] leading-relaxed">
                  Hej, vi er et advokatkontor med 12 ansatte og søger rådgivning om vores HR-processer. Kan I sende et tilbud med priser og hvornår I kan starte?
                </p>
              </div>
            </div>

            {/* Noras forslag */}
            <div>
              <p className="text-xs font-semibold text-[#8896A4] uppercase tracking-wider mb-3">Noras svarforslag</p>
              <div className={`rounded-xl p-5 border transition-all duration-300 ${approved ? 'bg-green-50 border-green-200' : 'bg-white border-[#0CA9BA]/30'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded-md bg-[#0CA9BA]/10 flex items-center justify-center">
                    <Zap className="w-3 h-3 text-[#0CA9BA]" />
                  </div>
                  <span className="text-xs font-semibold text-[#0CA9BA]">Genereret af Nora · 2 sek</span>
                  {approved && <span className="ml-auto text-xs font-semibold text-green-600">✓ Sendt</span>}
                </div>
                <p className="text-sm text-[#0D1321] leading-relaxed mb-4">
                  Kære Sofie,<br /><br />
                  Tak for din henvendelse. Vi har god erfaring med at rådgive advokatvirksomheder om HR-processer.<br /><br />
                  Jeg sender et tilbud inden for 24 timer. Vi kan tidligst starte op i uge 16.
                  <br /><br />
                  Med venlig hilsen
                </p>
                {!approved ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setApproved(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0CA9BA] rounded-lg hover:bg-[#3DBFCC] transition-colors"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" /> Godkend og send
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#4A5568] bg-[#F8F9FB] border border-[#E4E7EE] rounded-lg hover:bg-slate-100 transition-colors">
                      <Pencil className="w-3.5 h-3.5" /> Rediger
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors">
                      <X className="w-3.5 h-3.5" /> Afvis
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-green-600 font-semibold">
                    <Send className="w-4 h-4" /> Svar sendt — du sparede 4 minutter
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {active === 'meeting' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Transskript */}
            <div>
              <p className="text-xs font-semibold text-[#8896A4] uppercase tracking-wider mb-3">Live transskript</p>
              <div className="bg-[#F8F9FB] rounded-xl p-5 border border-[#E4E7EE] space-y-3">
                {[
                  { speaker: 'Lars', text: 'Vi skal have styr på Q2-budgettet inden fredag.' },
                  { speaker: 'Mette', text: 'Jeg tager ansvar for marketingdelen. Sender det senest torsdag.' },
                  { speaker: 'Lars', text: 'Godt. IT-infrastruktur — hvornår kan vi forvente tilbud fra leverandøren?' },
                  { speaker: 'Kasper', text: 'Jeg følger op i dag og vender tilbage i morgen formiddag.' },
                ].map((line, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-[10px] font-bold text-[#0CA9BA] w-12 flex-shrink-0 mt-0.5">{line.speaker}</span>
                    <p className="text-sm text-[#4A5568] leading-relaxed">{line.text}</p>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-[#8896A4]">Optager…</span>
                </div>
              </div>
            </div>

            {/* Noras referat */}
            <div>
              <p className="text-xs font-semibold text-[#8896A4] uppercase tracking-wider mb-3">Noras referat — klar til afsendelse</p>
              <div className="bg-white rounded-xl p-5 border border-[#0CA9BA]/30">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-5 h-5 rounded-md bg-[#0CA9BA]/10 flex items-center justify-center">
                    <FileText className="w-3 h-3 text-[#0CA9BA]" />
                  </div>
                  <span className="text-xs font-semibold text-[#0CA9BA]">Referat genereret · 3 sek</span>
                </div>
                <p className="text-xs font-semibold text-[#0D1321] mb-2">Beslutninger</p>
                <ul className="text-sm text-[#4A5568] space-y-1 mb-4">
                  <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-[#0CA9BA] flex-shrink-0 mt-0.5" /> Q2-budget færdigt inden fredag</li>
                </ul>
                <p className="text-xs font-semibold text-[#0D1321] mb-2">Handlingspunkter</p>
                <ul className="text-sm text-[#4A5568] space-y-1.5">
                  <li className="flex gap-2"><span className="w-4 h-4 rounded-full bg-[#0CA9BA]/10 text-[#0CA9BA] text-[9px] font-bold flex items-center justify-center flex-shrink-0">M</span> Mette sender marketingbudget — torsdag</li>
                  <li className="flex gap-2"><span className="w-4 h-4 rounded-full bg-[#0CA9BA]/10 text-[#0CA9BA] text-[9px] font-bold flex items-center justify-center flex-shrink-0">K</span> Kasper følger op på IT-tilbud — i morgen</li>
                </ul>
                <button className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0CA9BA] rounded-lg hover:bg-[#3DBFCC] transition-colors">
                  <Send className="w-3.5 h-3.5" /> Send referat til deltagerne
                </button>
              </div>
            </div>
          </div>
        )}

        {active === 'booking' && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Indgående mail */}
            <div>
              <p className="text-xs font-semibold text-[#8896A4] uppercase tracking-wider mb-3">Indgående mail</p>
              <div className="bg-[#F8F9FB] rounded-xl p-5 border border-[#E4E7EE]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full bg-[#122B4A] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">TK</div>
                  <div>
                    <p className="text-sm font-semibold text-[#0D1321]">Thomas Koch</p>
                    <p className="text-xs text-[#8896A4]">thomas@koch-holding.dk</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-[#0D1321] mb-2">Møde om samarbejde</p>
                <p className="text-sm text-[#4A5568] leading-relaxed">
                  Hej, vi er interesserede i et indledende møde for at høre mere om hvad I tilbyder. Hvornår har I tid i næste uge?
                </p>
              </div>
            </div>

            {/* Noras forslag */}
            <div>
              <p className="text-xs font-semibold text-[#8896A4] uppercase tracking-wider mb-3">Noras svarforslag</p>
              <div className="bg-white rounded-xl p-5 border border-[#0CA9BA]/30">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 rounded-md bg-[#0CA9BA]/10 flex items-center justify-center">
                    <Calendar className="w-3 h-3 text-[#0CA9BA]" />
                  </div>
                  <span className="text-xs font-semibold text-[#0CA9BA]">Tjekket din kalender · 1 sek</span>
                </div>
                <p className="text-sm text-[#0D1321] leading-relaxed mb-4">
                  Kære Thomas,<br /><br />
                  Tak for din henvendelse — vi ser frem til at høre mere om jeres behov.<br /><br />
                  Jeg har ledige tider næste uge:
                </p>
                <div className="space-y-2 mb-4">
                  {['Mandag 28. april · 10:00–11:00', 'Tirsdag 29. april · 14:00–15:00', 'Torsdag 1. maj · 09:00–10:00'].map(slot => (
                    <div key={slot} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F8F9FB] border border-[#E4E7EE] text-sm text-[#4A5568]">
                      <Calendar className="w-3.5 h-3.5 text-[#0CA9BA] flex-shrink-0" />
                      {slot}
                    </div>
                  ))}
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0CA9BA] rounded-lg hover:bg-[#3DBFCC] transition-colors">
                  <ThumbsUp className="w-3.5 h-3.5" /> Godkend og send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── FAQ accordion ─────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-[#E4E7EE] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left bg-white hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-[#0D1321]">{q}</span>
        <ChevronDown className={`w-5 h-5 text-[#0CA9BA] flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-6 pb-5 text-[#4A5568] text-sm leading-relaxed bg-white border-t border-[#E4E7EE]">
          {a}
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#0D1321]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#E4E7EE]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Image src="/logo.png" alt="Nora" width={100} height={54} className="object-contain" />
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-[#4A5568] hover:text-[#0D1321] transition-colors">
              Log ind
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-semibold text-white bg-[#122B4A] rounded-lg hover:bg-[#1a3660] transition-colors"
            >
              Prøv gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">

          {/* Trust badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0CA9BA]/10 border border-[#0CA9BA]/25 mb-6">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0CA9BA]" />
            <span className="text-xs font-semibold text-[#0CA9BA]">GDPR-compliant · Data i EU · Ingen deling med tredjepart</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight mb-6">
            Du svarer hurtigere.
            <br />
            <span className="text-[#0CA9BA]">Nora gør arbejdet.</span>
          </h1>

          <p className="text-xl text-[#4A5568] max-w-2xl mx-auto mb-10 leading-relaxed">
            Nora er en AI-mailassistent til alle der bruger for meget tid foran indbakken.
            Læser dine mails, foreslår svar i din tone og sender — kun når du godkender.
            Al data forbliver i EU.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-white bg-[#122B4A] rounded-xl hover:bg-[#1a3660] transition-colors shadow-lg"
            >
              Start med Gmail
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-[#4A5568] bg-white border border-[#E4E7EE] rounded-xl hover:bg-slate-50 transition-colors"
            >
              Start med Outlook
            </Link>
          </div>

          <p className="text-sm text-[#8896A4] mt-4">
            7 dages gratis prøve · Opsig når som helst
          </p>
        </div>

        {/* Dashboard preview */}
        <div className="max-w-5xl mx-auto mt-16">
          <div className="relative rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.12)] border border-[#E4E7EE]">
            {/* Fake browser chrome */}
            <div className="bg-[#F8F9FB] border-b border-[#E4E7EE] px-4 py-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="flex-1 mx-4 bg-white border border-[#E4E7EE] rounded-md px-3 py-1 text-xs text-[#8896A4]">
                app.nora.dk
              </div>
            </div>
            {/* Mock UI */}
            <div className="bg-[#F8F9FB] p-4 md:p-8 min-h-[340px] flex gap-6">
              {/* Sidebar mock */}
              <div className="hidden md:flex w-44 bg-white border border-[#E4E7EE] rounded-xl p-3 flex-col gap-1 flex-shrink-0">
                {['Dashboard', 'Indbakke', 'Mødenotater', 'Skabeloner', 'Videnbase'].map((item, i) => (
                  <div key={item} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium ${i === 1 ? 'bg-[#122B4A] text-white' : 'text-[#4A5568]'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${i === 1 ? 'bg-[#0CA9BA]' : 'bg-[#E4E7EE]'}`} />
                    {item}
                    {i === 1 && <span className="ml-auto bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">5</span>}
                  </div>
                ))}
              </div>
              {/* Content mock */}
              <div className="flex-1 flex flex-col gap-3">
                {/* AI summary */}
                <div className="bg-white border border-[#0CA9BA]/25 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#0CA9BA]/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-3.5 h-3.5 text-[#0CA9BA]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#0D1321] mb-0.5">Noras opsummering</p>
                    <p className="text-xs text-[#4A5568]">Du har 3 mails der haster og 2 der venter på svar. Nora har klargjort forslag til dem alle.</p>
                  </div>
                </div>
                {/* Email rows */}
                <div className="bg-white border border-[#E4E7EE] rounded-xl overflow-hidden">
                  {[
                    { name: 'Sofie Mathiesen', subj: 'Kontraktgennemgang — svar haster', badge: 'Haster', urgent: true },
                    { name: 'Board of Directors', subj: 'Referat fra Q1-møde', badge: 'Møde', urgent: false },
                    { name: 'Lars Winther', subj: 'Tilbud på konsulentopgave', badge: 'Tilbud', urgent: true },
                  ].map((email, i) => (
                    <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < 2 ? 'border-b border-[#E4E7EE]' : ''} ${email.urgent ? 'border-l-2 border-l-[#0CA9BA]' : ''}`}>
                      <div className="w-8 h-8 rounded-full bg-[#122B4A] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {email.name.split(' ').map(p => p[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#0D1321] truncate">{email.name}</p>
                        <p className="text-xs text-[#4A5568] truncate">{email.subj}</p>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#0CA9BA]/10 text-[#0CA9BA] flex-shrink-0">
                        {email.badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 px-6 bg-[#F8F9FB]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Sådan virker det</h2>
            <p className="text-[#4A5568] text-lg">Sat op på under 5 minutter. Fungerer med det samme.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.num} className="relative">
                <div className="text-5xl font-black text-[#0CA9BA]/15 mb-3">{step.num}</div>
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-[#4A5568] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interaktiv demo */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Se Nora i aktion</h2>
            <p className="text-[#4A5568] text-lg">Klik på et scenarie og se hvad Nora gør.</p>
          </div>
          <DemoShowcase />
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Alt hvad en travl professionel har brug for</h2>
            <p className="text-[#4A5568] text-lg">Uanset om du er advokat, receptionist, leder eller projektchef.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.title} className="bg-white border border-[#E4E7EE] rounded-2xl p-6 hover:border-[#0CA9BA]/40 hover:shadow-[0_4px_20px_rgba(12,169,186,0.08)] transition-all duration-200">
                  <div className="w-10 h-10 rounded-xl bg-[#0CA9BA]/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-[#0CA9BA]" />
                  </div>
                  <h3 className="font-bold text-[#0D1321] mb-2">{f.title}</h3>
                  <p className="text-sm text-[#4A5568] leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* GDPR strip */}
      <section className="py-16 px-6 bg-[#122B4A]">
        <div className="max-w-4xl mx-auto text-center text-white">
          <ShieldCheck className="w-10 h-10 text-[#0CA9BA] mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Fortrolig korrespondance forbliver i EU
          </h2>
          <p className="text-white/70 text-lg max-w-2xl mx-auto leading-relaxed">
            Noras AI processerer alt inden for EU. Dine data forlader aldrig EU og deles aldrig med tredjepart.
            Vi opfylder fuldt ud GDPR og Datatilsynets retningslinjer — kritisk for advokater, læger, HR og alle der håndterer følsomme oplysninger.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-white/60">
            {['AI processeret i EU', 'DPA-aftale', 'GDPR Art. 28', 'Ingen deling med tredjepart', 'Dansk support'].map(t => (
              <div key={t} className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-[#0CA9BA]" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sammenligning — generisk */}
      <section className="py-20 px-6 bg-[#F8F9FB]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#0D1321] mb-4">
              Nora vs. traditionelle løsninger
            </h2>
            <p className="text-lg text-[#4A5568]">
              De fleste AI-mailassistenter er bygget til at imponere i en demo. Nora er bygget til at virke i hverdagen.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E4E7EE] shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#122B4A]">
                  <th className="text-left px-6 py-4 text-slate-400 font-medium w-2/5">Funktion</th>
                  <th className="px-6 py-4 text-center">
                    <span className="text-white font-bold text-base">Nora</span>
                  </th>
                  <th className="px-6 py-4 text-center">
                    <span className="text-slate-400 font-medium">Typiske alternativer</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EE]">
                {[
                  ['AI-processering i EU (GDPR)', true, false],
                  ['Du godkender altid før afsendelse', true, false],
                  ['Tilpasset din tone og fagterminologi', true, false],
                  ['Mødenotetager med AI-referat', true, false],
                  ['Gennemsigtig fast pris', true, false],
                  ['Fungerer med Gmail og Outlook', true, true],
                  ['Dansk support', true, false],
                  ['Nem opsigelse — ingen binding', true, false],
                ].map(([feature, nora, other], i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F8F9FB]'}>
                    <td className="px-6 py-3.5 text-[#374151] font-medium">{feature as string}</td>
                    <td className="px-6 py-3.5 text-center">
                      {nora ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#0CA9BA]/10">
                          <svg className="w-3.5 h-3.5 text-[#0CA9BA]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100">
                          <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {other ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#0CA9BA]/10">
                          <svg className="w-3.5 h-3.5 text-[#0CA9BA]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100">
                          <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="priser" className="py-24 px-6 bg-[#F8F9FB]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Enkle priser. Ingen overraskelser.</h2>
            <p className="text-[#4A5568] text-lg mb-3">Alle planer inkluderer en 7-dages gratis prøve · Opsig når som helst</p>
            <p className="text-sm text-[#8896A4]">Ingen kreditkort krævet</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 flex flex-col ${
                  plan.highlight
                    ? 'bg-[#122B4A] text-white shadow-[0_8px_40px_rgba(18,43,74,0.25)] scale-[1.02]'
                    : 'bg-white border border-[#E4E7EE]'
                }`}
              >
                {plan.highlight && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0CA9BA]/20 text-[#0CA9BA] text-xs font-bold mb-3 self-start">
                    <Star className="w-3 h-3" /> Mest populær
                  </div>
                )}
                <h3 className={`text-lg font-bold mb-1 ${plan.highlight ? 'text-white' : 'text-[#0D1321]'}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-4 ${plan.highlight ? 'text-white/60' : 'text-[#8896A4]'}`}>
                  {plan.desc}
                </p>
                <div className="mb-2">
                  <span className={`text-4xl font-black ${plan.highlight ? 'text-white' : 'text-[#0D1321]'}`}>
                    {plan.price} kr
                  </span>
                  <span className={`text-sm ${plan.highlight ? 'text-white/60' : 'text-[#8896A4]'}`}>/md</span>
                </div>
                <p className={`text-xs mb-4 ${plan.highlight ? 'text-white/50' : 'text-[#8896A4]'}`}>
                  7 dages gratis prøve · Opsig når som helst
                </p>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-[#0CA9BA]' : 'text-green-500'}`} />
                      <span className={plan.highlight ? 'text-white/80' : 'text-[#4A5568]'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`w-full text-center py-3 rounded-xl font-bold text-sm transition-colors ${
                    plan.highlight
                      ? 'bg-[#0CA9BA] text-white hover:bg-[#3DBFCC]'
                      : 'bg-[#F8F9FB] border border-[#E4E7EE] text-[#0D1321] hover:bg-slate-100'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Ofte stillede spørgsmål</h2>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 bg-gradient-to-br from-[#122B4A] to-[#0a1f38]">
        <div className="max-w-3xl mx-auto text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Klar til at genvinde din tid?
          </h2>
          <p className="text-white/70 text-lg mb-10">
            Prøv Nora gratis i 7 dage. Ingen kreditkort. Ingen binding.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-10 py-4 text-base font-bold text-[#122B4A] bg-white rounded-xl hover:bg-slate-100 transition-colors shadow-lg"
          >
            Start din gratis prøve
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-white/40 text-sm mt-4">Opsig når som helst · Support på dansk</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E4E7EE] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#8896A4]">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Nora" width={70} height={38} className="object-contain opacity-60" />
            <span>© {new Date().getFullYear()} Nora. Alle rettigheder forbeholdes.</span>
          </div>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-[#0D1321] transition-colors">Privatlivspolitik</Link>
            <Link href="#" className="hover:text-[#0D1321] transition-colors">Vilkår</Link>
            <Link href="/login" className="hover:text-[#0D1321] transition-colors">Log ind</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
