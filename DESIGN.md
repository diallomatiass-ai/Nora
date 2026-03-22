# Nora — Design Plan
> Målet: Et interface der føles som en dybt intelligent assistent — ikke et mailprogram.
> Motto: *"Livet er nemmere med Nora."*

---

## 1. Design-identitet

### Filosofi
Nora er ikke et redskab — det er en kollega. Designet skal afspejle det.
Tre ord der styrer alle designbeslutninger: **Klar. Rolig. Intelligent.**

- **Klar:** Du ved altid hvad der kræver din opmærksomhed. Ingenting er støj.
- **Rolig:** Ingen alarmer, ingen aggression. Farver og bevægelse bruges med omtanke.
- **Intelligent:** AI-interaktioner føles naturlige og magiske — ikke som en knap du trykker på.

### Reference-produkter (stil, ikke kopi)
- Linear — tæthed, tastatur-first, mørkhed
- Notion — luft, typografi, hierarki
- Superhuman — email-flow, split-view, AI-feel
- Vercel Dashboard — stats, monospace, precision

---

## 2. Design System

### Logo

**Fil:** `public/logo.png` (lys tilstand — transparent baggrund)
**Fil:** `public/logo-dark.png` (mørk tilstand — navy erstattet med hvid)
**Original:** `Gemini_Generated_Image_ds6u99ds6u99ds6u.png` (1408×768px)

**Logo-element:** Konvolut formet som et N + 4-punktet stjerne (AI/magi) + "Nora" tekst
**Gradient på låg:** `#0CA9BA` (cyan top) → `#09A9B9` (teal bund)

**Sidebar-mål:** `width={160} height={87}` med `object-contain`

---

### Farvepalette

#### Primær — hentet direkte fra logoet
| Token | Hex | RGB | Brug |
|---|---|---|---|
| `--brand-navy` | `#122B4A` | rgb(18,43,74) | Primær knap, aktiv nav, logo-navy |
| `--brand-teal` | `#0CA9BA` | rgb(12,169,186) | Accent, AI, links, badges, logo-teal |
| `--brand-teal-light` | `#3DBFCC` | — | Hover på teal-elementer |
| `--brand-teal-soft` | `rgba(12,169,186,0.10)` | — | Baggrund på AI-elementer |
| `--brand-teal-gradient` | `linear-gradient(135deg, #0CA9BA, #09A9B9)` | — | Logo-gradient, badges, AI-card header |

> **Opdatering fra tidligere:** `#162249` → `#122B4A` og `#42D1B9` → `#0CA9BA` baseret på histogram-analyse af det nye logo. Begge er mere blå/cyan end de gamle værdier.

#### Neutral (opdateres — nuanceres)
| Token | Lys | Mørk | Brug |
|---|---|---|---|
| `--bg` | `#F8F9FB` | `#0E1117` | App-baggrund |
| `--surface` | `#FFFFFF` | `#161B27` | Kort, sidebar |
| `--surface-raised` | `#FFFFFF` | `#1E2535` | Hover, modals |
| `--border` | `#E4E7EE` | `#232B3E` | Alle borders |
| `--text-primary` | `#0D1321` | `#EDF2F7` | Overskrifter, vigtig tekst |
| `--text-secondary` | `#4A5568` | `#94A3B8` | Brødtekst |
| `--text-muted` | `#8896A4` | `#4B5A6E` | Labels, tidsstempler |

#### Semantisk
| Token | Farve | Brug |
|---|---|---|
| `--urgent` | `#E53E3E` | Høj prioritet |
| `--warning` | `#D97706` | Påmindelser, deadlines |
| `--success` | `#38A169` | Sendt, godkendt |
| `--ai` | `#0CA9BA` | Alt AI-relateret |

### Typografi

**Font:** `Inter` (allerede Tailwind default) — skift til `Inter var` for variable weight

| Scale | Size | Weight | Line-height | Brug |
|---|---|---|---|---|
| `display` | 28px | 700 | 1.2 | Side-titel (kun dashboard) |
| `heading` | 18px | 600 | 1.3 | Sektion-overskrifter |
| `body` | 14px | 400 | 1.6 | Al brødtekst |
| `small` | 12px | 500 | 1.4 | Labels, badges, metadata |
| `micro` | 11px | 600 | 1.2 | Timestamps, uppercase labels |
| `mono` | 13px | 400 | 1.5 | Email-adresser, kode |

### Spacing (8px grid)
```
2px  — mikro-gaps (inden i badges)
4px  — tæt (icon + label)
8px  — standard indre padding
12px — kort padding
16px — section gaps
24px — store gaps
32px — side-padding desktop
```

### Border-radius
```
4px  — badges, pills
8px  — knapper, inputs
12px — kort, paneler
16px — modals, drawers
24px — store flader
```

### Skygger
```css
--shadow-sm:  0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
--shadow-md:  0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
--shadow-lg:  0 12px 32px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06);
--shadow-ai:  0 0 0 1px rgba(66,209,185,0.2), 0 4px 16px rgba(66,209,185,0.1);
```

### Animationer
```css
--ease-out:     cubic-bezier(0.16, 1, 0.3, 1)   /* Spring-feel */
--ease-in-out:  cubic-bezier(0.4, 0, 0.2, 1)     /* Glat */
--duration-fast: 120ms   /* Hover, focus */
--duration-med:  220ms   /* Slides, fades */
--duration-slow: 380ms   /* Modals, drawers */
```

---

## 3. App Shell

### Sidebar (redesign)

**Nuværende problem:** For bred (w-64), ikoner for store, ingen visuel hierarki.

**Ny sidebar:**
```
┌─────────────────┐
│  [Logo]         │  px-5 py-4, logo 120px bred
├─────────────────┤
│                 │
│  ◉ Dashboard    │  Aktiv: navy bg, teal tekst
│  ✉ Indbakke  3  │  Badge: rød, bold
│  🎙 Møder       │
│  ─────          │  Separator
│  📄 Skabeloner  │
│  📚 Videnbase   │
│  ─────          │
│  💳 Abonnement  │
│  ⚙  Indstillinger│
│                 │
├─────────────────┤
│  [Avatar] Navn  │  Bruger-widget nederst
│  [🌙 Mørkt]     │
└─────────────────┘
```

**Styling:**
- Bredde: `w-56` (224px) — smalere, mere plads til content
- Nav-items: `px-3 py-2.5`, `rounded-lg`, `text-sm`
- Aktiv state: `bg-[#162249] text-white` (lys) / `bg-[#42D1B9]/15 text-[#42D1B9]` (mørk)
- Hover: `bg-[--surface-raised]` med 120ms transition
- Ikoner: `w-4 h-4` (ikke 6 — det er for store)
- Bruger-widget: Avatar (initialer) + navn + email, lille dropdown

### Command Palette (Cmd+K)
Tastatur-first navigation. Søg emails, skift side, kør handlinger.
```
┌────────────────────────────────────┐
│ 🔍 Søg eller skriv kommando...     │
├────────────────────────────────────┤
│ → Gå til Indbakke                  │
│ → Generer AI-forslag               │
│ → Nyt møde                         │
│ → Send referatmail                 │
└────────────────────────────────────┘
```

---

## 4. Skærme

---

### 4.1 Dashboard

**Nuværende problem:** Stat-boksene er for dominerende. Tomme states mangler. Ingen "god dag"-følelse.

**Ny struktur:**
```
┌─────────────────────────────────────────────────────┐
│ God morgen, Diallo ☀️                               │
│ Du har 3 mails der haster og 2 åbne opgaver        │ ← AI-genereret opsummering
├───────────┬───────────┬─────────────────────────────┤
│     3     │     12    │          2                  │
│  Haster   │  Ulæste   │  Opgaver                   │  ← Kompakte stat-chips
├───────────┴───────────┴─────────────────────────────┤
│                                                     │
│  📬 MAILS DER HASTER          📋 ÅBNE OPGAVER      │
│  ─────────────────────        ───────────────────   │
│  [mail row]                   [opgave row]          │
│  [mail row]                   [opgave row]          │
│  [mail row]                   [opgave row]          │
│                                                     │
├─────────────────────────────────────────────────────┤
│  📅 I DAG (fra kalender)                            │
│  10:00 Møde med Mads — [Optag] knap                 │
│  14:00 Demo call                                    │
└─────────────────────────────────────────────────────┘
```

**Nøgle-forbedringer:**
- AI-genereret daglig opsummering (1 sætning) øverst
- Stat-chips er kompakte (`h-16`) — tal er store men chips er små
- Kalender-widget nederst (dagens møder med "Optag"-knap → møde-agent)
- Onboarding-checklist kun når ikke færdig (eksisterer allerede)
- Hover-preview på emails (eksisterer allerede — beholdes)

---

### 4.2 Indbakke

**Nuværende:** Godt grundlag — split view virker. Mangler: luft, hierarki, AI-feel.

**Layout (beholdes men poleres):**
```
┌──────────────┬────────────────────────────────────┐
│ INDBAKKE  3  │  [Email detalje]                  │
│              │                                    │
│ 🔴 HASTER   │  Fra: Mads Hansen                  │
│  [mail]      │  "Tilbud på nyt projekt"           │
│  [mail]      │  ────────────────────              │
│              │  [Email body]                      │
│ ALLE         │                                    │
│  [mail]      │  ✨ AI FORSLAG                     │
│  [mail]      │  ┌──────────────────────────────┐  │
│  [mail]      │  │ Hej Mads,                    │  │
│              │  │ Tak for din henvendelse...   │  │
│              │  │                              │  │
│              │  │ [Rediger] [Godkend & Send]   │  │
│              │  └──────────────────────────────┘  │
└──────────────┴────────────────────────────────────┘
```

**Forbedringer:**
- Email-rækker: Avatar (initialer farvet efter afsender), federe afsendernavn
- AI-forslag-kortet: Teal venstre-border, subtil glow (`--shadow-ai`), aldrig blot et `<div>`
- "Godkend & Send" knap: Stor, grøn, primær handling — umulig at overse
- Tastatur: `j/k` = næste/forrige mail, `a` = godkend, `g` = generer, `e` = arkivér
- Tomt state: Illustration + "Indbakken er tom — god dag!"

**AI-forslag kort (ny design):**
```
┌────────────────────────────────────────┐
│ ✨ Noras forslag                   97% │  ← Confidence score
├────────────────────────────────────────┤
│                                        │
│  Hej Mads,                            │
│                                        │
│  Tak for din henvendelse om...        │
│  [redigerbar tekst-editor]            │
│                                        │
├────────────────────────────────────────┤
│  [Afvis]  [Rediger]  [✓ Godkend & Send]│
└────────────────────────────────────────┘
```

---

### 4.3 Møde-agent (ny skærm)

Den mest interessante skærm at designe.

**Tre tilstande:**

**Tilstand A: Intet møde i gang**
```
┌─────────────────────────────────────────────┐
│                                             │
│         🎙                                  │
│   Start møde-optagelse                     │
│                                             │
│   Virker med Teams, Zoom, Google Meet      │
│   — alt der kører på din computer          │
│                                             │
│   [▶ Start optagelse]                       │
│                                             │
│   ── Tidligere møder ──                    │
│   📝 Møde med Mads — 18. mar               │
│   📝 Demo call — 15. mar                   │
│                                             │
└─────────────────────────────────────────────┘
```

**Tilstand B: Møde i gang (live)**
```
┌──────────────────┬──────────────────────────┐
│ 🔴 OPTAGER  4:32 │  ACTION ITEMS (live)     │
│ [■ Stop]         │  • Mads sender tilbud    │
├──────────────────┤    inden fredag          │
│ TRANSCRIPT       │  • Opfølgning næste uge  │
│                  │                          │
│ [Mads]  09:32    │                          │
│ "Vi skal se på   │                          │
│ prisen igen..."  │                          │
│                  │  NØGLEORD               │
│ [Dig]   09:35    │  • Pris                 │
│ "Ja, det giver   │  • Tilbud               │
│ mening..."       │  • Fredag               │
│                  │                          │
│ [Mads]  09:37    │                          │
│ "Super, jeg      │                          │
│ sender det..."   │                          │
└──────────────────┴──────────────────────────┘
```

**Tilstand C: Møde slut — referat klar**
```
┌─────────────────────────────────────────────┐
│ ✅ Møde afsluttet — 18. marts, 42 min      │
├─────────────────────────────────────────────┤
│ OPSUMMERING                                 │
│ Drøftede prissætning på nyt projekt.       │
│ Mads sender tilbud inden fredag.           │
│                                             │
├─────────────────────────────────────────────┤
│ ACTION ITEMS                                │
│ ☐ Mads → Send tilbud (frist: 21. mar)     │
│ ☐ Dig → Review og svar (frist: 24. mar)   │
│                                             │
├─────────────────────────────────────────────┤
│ REFERAT (redigerbart)                       │
│ [tekst-editor med fuld transcript]          │
│                                             │
│ Send til:  mads@firma.dk, dig@nora.dk      │
│                                             │
│ [Gem kun]        [📧 Send referatmail]     │
└─────────────────────────────────────────────┘
```

**Design-noter for møde-skærm:**
- Rød pulserende cirkel mens der optages (✦ animation)
- Live transcript scroller automatisk til bunden
- Speaker-labels i teal (kendte) eller grå (ukendte)
- Action items highlightes med gult i live transcript
- "Send referatmail" = stor, primær knap — det er den vigtigste handling

---

### 4.4 Kunder / CRM (let redesign)

Simpel liste-visning. Fokus på seneste aktivitet.
```
┌─────────────────────────────────────────────┐
│ KUNDER                          [+ Ny]      │
│                                             │
│ [🔍 Søg...]                                │
│                                             │
│ Mads Hansen          Sendte tilbud i går   │
│ mads@firma.dk                   [Se →]     │
│                                             │
│ Trine Olsen          Ingen aktivitet 14d   │
│ trine@shop.dk                   [Se →]     │
└─────────────────────────────────────────────┘
```

---

### 4.5 Indstillinger

**Tabbed layout — 4 faner:**
1. **Profil** — navn, email, adgangskode
2. **Mailkonti** — Gmail/Outlook forbind/fjern (med store OAuth-knapper)
3. **AI** — tone (formel/venlig/neutral), sprog, auto-svar grænse
4. **Notifikationer** — hvornår og hvordan

---

## 5. Komponenter

### Email-række (InboxList)
```
┌───────────────────────────────────────────────────┐
│ [MH]  Mads Hansen           Tilbud — nyt projekt │
│       mads@firma.dk         "Hej, jeg har set..." │
│                             2t siden    [⚡ Hast] │
└───────────────────────────────────────────────────┘
```
- Avatar: 2 initialer, farve genereret fra email-hash (konsistent)
- Uulæst: fed afsender + emne, `border-l-2 border-[--brand-teal]`
- Tid: relativ (`2t siden`), absolut på hover
- Badge: `⚡ Hast` i rød, `📋 Ordre` i blå osv.

### AI-statusindikator
Når Nora processerer: Lille animated teal dot i sidebar ved "Indbakke":
```
✉ Indbakke  ● (pulserende teal)
```

### Toast-notifikationer (erstatter `alert()`)
```
┌──────────────────────────────────────┐
│ ✅  Svar sendt til Mads Hansen       │  → 3 sek, øverst til højre
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ ✨  Nora har genereret 3 nye forslag │  → klikbar
└──────────────────────────────────────┘
```

### Tom-tilstande (erstatter tomme `<div>`)
Hver sektion har sin egen illustration og tekst:
- Indbakke tom: `"Indbakken er ryddet — nyd det 🎉"`
- Ingen opgaver: `"Ingen åbne opgaver — du er helt foran 🌟"`
- Ingen møder: `"Ingen møder i dag"`

---

## 6. Micro-interaktioner

| Interaktion | Animation |
|---|---|
| Vælg email | Slide-in fra højre (220ms ease-out) |
| Godkend AI-forslag | Kort grøn flash + fade-out kort |
| Send mail | Kort animation (papirfly) → toast |
| Start møde-optagelse | Rød cirkel popper ind, pulserer |
| Ny email ankommer | Indbakke-badge bumper (scale 1→1.2→1) |
| Sidebar nav-skift | 120ms fade på active-state |
| Hover på email-række | `translateX(2px)` — subtil |

---

## 7. Prioriteret implementeringsrækkefølge

| # | Ændring | Effekt | Tid |
|---|---|---|---|
| 1 | Sidebar smalere + bruger-widget | Umiddelbart mere poleret | 1t |
| 2 | Farve-tokens i globals.css (mørk baggrund opdateres) | Hele appen løftes | 2t |
| 3 | AI-forslag kort redesign (teal border, shadow-ai, store knapper) | Kerneflow føles bedre | 2t |
| 4 | Email-række med initialer-avatar | Mere levende | 1t |
| 5 | Toast-system (erstatter alert()) | Professionelt | 2t |
| 6 | Tom-tilstande med tekst | Venligt og poleret | 1t |
| 7 | Dashboard: AI-opsummering + kalender-widget | Wow-faktor | 3t |
| 8 | Møde-agent UI (ny skærm, 3 tilstande) | Ny feature | 4t |
| 9 | Cmd+K command palette | Power-user delight | 3t |
| 10 | Micro-animationer (slide-in, bumps) | Lækker oplevelse | 2t |

**Total estimat: ~21 timer fordelt over 3-4 dage.**

---

## 8. Hvad der IKKE ændres

- Split-view layout i indbakken — det virker
- Hover-preview på dashboard-emails — det virker
- WebSocket realtidsopdateringer — det virker
- Mobil bottom-nav — den er ok
- Farveidentitet (navy + teal) — det er stærkt

Designet bygger på det eksisterende — det poleres, ikke rives ned.
