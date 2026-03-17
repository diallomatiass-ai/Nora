'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type Locale = 'da' | 'en'
export type Theme = 'light' | 'dark'

const translations = {
  da: {
    // App
    appName: 'Nora',
    appDesc: 'AI-drevet email assistent',
    version: 'v1.0',

    // Nav
    dashboard: 'Dashboard',
    inbox: 'Indbakke',
    templates: 'Skabeloner',
    knowledgeBase: 'Videnbase',
    settings: 'Indstillinger',

    // Common
    loading: 'Indlæser...',
    save: 'Gem',
    create: 'Opret',
    cancel: 'Annuller',
    delete: 'Slet',
    edit: 'Rediger',
    back: 'Tilbage',
    name: 'Navn',
    email: 'Email',
    password: 'Adgangskode',
    noData: 'Ingen data endnu',
    all: 'Alle',

    // Auth
    signIn: 'Log ind',
    signUp: 'Opret konto',
    signingIn: 'Vent...',
    noAccount: 'Har du ikke en konto?',
    hasAccount: 'Har du allerede en konto?',
    companyName: 'Virksomhedsnavn',
    somethingWrong: 'Noget gik galt',

    // Dashboard
    totalEmails: 'Total emails',
    unread: 'Ulæste',
    processed: 'Behandlede',
    categories: 'Kategorier',
    priority: 'Prioritet',
    high: 'Høj',
    medium: 'Medium',
    low: 'Lav',

    // Inbox
    noEmails: 'Ingen emails fundet',
    noSubject: '(Intet emne)',
    replied: 'Besvaret',
    now: 'Nu',

    // Categories
    inquiry: 'Foresp.',
    complaint: 'Klage',
    order: 'Ordre',
    support: 'Support',
    spam: 'Spam',
    other: 'Andet',

    // Email detail
    emailNotFound: 'Email ikke fundet',
    backToInbox: 'Tilbage til indbakke',
    aiSuggestions: 'AI-forslag',
    noSuggestions: 'Ingen forslag genereret',
    awaitingAi: 'Afventer AI-behandling...',
    classification: 'Klassificering',
    category: 'Kategori',
    topic: 'Emne',
    confidence: 'Sikkerhed',
    from: 'Fra:',
    to: 'Til:',
    date: 'Dato:',
    noContent: 'Ingen indhold',

    // AI Suggestion
    aiSuggestion: 'AI-forslag',
    pending: 'Afventer',
    approved: 'Godkendt',
    edited: 'Redigeret',
    rejected: 'Afvist',
    approve: 'Godkend',
    reject: 'Afvis',
    sendReply: 'Send svar',
    refineWithAi: 'Juster med AI',
    refineTitle: 'Juster AI-forslaget',
    apply: 'Anvend',
    discard: 'Kassér',
    refinePlaceholder: 'f.eks. gør det mere formelt, kortere, tilføj pris...',
    refineHint: 'Tryk Enter for at sende. AI justerer forslaget efter din instruktion.',
    sent: 'Sendt',

    // Reply editor
    words: 'ord',
    chars: 'tegn',

    // Templates
    newTemplate: 'Ny skabelon',
    editTemplate: 'Rediger skabelon',
    none: 'Ingen',
    content: 'Indhold',
    noTemplates: 'Ingen skabeloner endnu. Opret din første skabelon ovenfor.',
    deleteTemplate: 'Slet denne skabelon?',
    used: 'Brugt',

    // Knowledge
    newEntry: 'Ny post',
    editEntry: 'Rediger post',
    type: 'Type',
    title: 'Titel',
    knowledgeDesc: 'Tilføj virksomhedsinfo som AI\'en bruger til at generere bedre svar.',
    noEntries: 'poster endnu.',
    deleteEntry: 'Slet denne post?',
    faq: 'FAQ',
    pricing: 'Priser',
    hours: 'Åbn.tider',
    tone: 'Tone',


    // Dashboard redesign
    requiresAction: 'Kræver din handling',
    canWait: 'Kan vente',
    urgent: 'Akutte',
    newItems: 'Nye',
    handled: 'Håndteret',
    callBack: 'Ring op',
    markedContacted: 'Markér som ringet op',
    viewAll: 'Se alle',
    noUrgentItems: 'Ingen akutte sager lige nu',
    noPendingItems: 'Ingen ventende sager',

    // Customers
    customers: 'Kunder',
    newCustomer: 'Ny kunde',
    customerDetail: 'Kundedetaljer',
    customerTimeline: 'Tidslinje',
    statusNyHenvendelse: 'Ny henvendelse',
    statusKontaktet: 'Kontaktet',
    statusTilbudSendt: 'Tilbud sendt',
    statusTilbudAccepteret: 'Tilbud accepteret',
    statusAfsluttet: 'Afsluttet',
    statusTilbudAfvist: 'Tilbud afvist',
    statusArkiveret: 'Arkiveret',
    actionItems: 'Opgaver',
    tasks: 'Opgaver',
    sendTilbud: 'Send tilbud',
    ringTilbage: 'Ring tilbage',
    sendInfo: 'Send info',
    bookTid: 'Book tid',
    overdue: 'Forsinket',
    dueToday: 'Forfalder i dag',
    done: 'Udført',
    markDone: 'Marker udført',
    pipelineValue: 'Pipeline-værdi',
    noCustomers: 'Ingen kunder endnu',
    totalCustomers: 'Samlet kunder',
    newThisWeek: 'Nye denne uge',
    overdueTasks: 'Forsinkede opgaver',
    notes: 'Noter',
    estimatedValue: 'Estimeret værdi',
    address: 'Adresse',
    viewCustomer: 'Se kunde',

    // Inbox redesign
    searchPlaceholder: 'Søg kunde, emne, afsender...',
    conversationThread: 'Samtale',
    customerHistory: 'Kundehistorik',
    noThread: 'Ingen tråd fundet',
    noHistory: 'Ingen tidligere korrespondance',
    newEmail: 'Ny email',
    toField: 'Til',
    subjectField: 'Emne',
    sendEmail: 'Send',
    emailSent: 'Email sendt!',
    selectAccount: 'Vælg konto',
    sending: 'Sender...',
    sentEmails: 'Sendt',
    noSentEmails: 'Ingen sendte emails',
    sentTo: 'Til',
    reminders: 'Påmindelser',
    noReminders: 'Ingen påmindelser',
    dismiss: 'Afvis',
    aiDraft: 'AI skriv',
    aiDraftPlaceholder: 'Beskriv hvad du vil skrive, f.eks. "Skriv et tilbud på tagarbejde til 45.000 kr"',
    aiDraftGenerating: 'AI skriver udkast...',

    // Settings
    emailAccounts: 'Mailkonti',
    emailAccountsDesc: 'Forbind dine mailkonti for at modtage og sende emails.',
    connectGmail: 'Forbind Gmail',
    connectOutlook: 'Forbind Outlook',
    disconnectAccount: 'Fjern denne mailkonto?',
    signOut: 'Log ud',
    language: 'Sprog',
    languageDesc: 'Vælg sprog for dashboard og AI-forslag.',
    theme: 'Tema',
    themeDesc: 'Skift mellem dag og nat tilstand.',
    themeDay: 'Dag',
    themeNight: 'Nat',

    // Calendar integration
    calendarIntegration: 'Kalender-integration',
    calendarIntegrationDesc: 'Forbind din kalender så Nora kan booke aftaler direkte.',
    connectGoogleCalendar: 'Forbind Google Kalender',
    connectOutlookCalendar: 'Forbind Outlook Kalender',
    calendarConnected: 'Forbundet',
    calendarNotConnected: 'Ingen kalender tilsluttet',
    calendarNotConnectedDesc: 'Forbind en kalender for at aktivere automatisk booking via Nora.',
    disconnectCalendar: 'Fjern denne kalenderkonto?',
    calendarProvider: 'Udbyder',

    // Booking rules
    bookingSettings: 'Booking-indstillinger',
    bookingSettingsDesc: 'Konfigurer hvordan Nora booker aftaler i din kalender.',
    bookingEnabled: 'Aktivér automatisk booking',
    bookingEnabledDesc: 'Lad Nora booke aftaler direkte i din kalender under opkald.',
    workDays: 'Arbejdsdage',
    workHours: 'Arbejdstider',
    workHoursStart: 'Fra',
    workHoursEnd: 'Til',
    slotDuration: 'Aftalelængde (min)',
    bufferMinutes: 'Buffer mellem aftaler (min)',
    maxBookingsPerDay: 'Maks bookinger per dag',
    advanceBookingDays: 'Booking-horisont (dage frem)',
    minNoticeHours: 'Minimum varsel (timer)',
    blockedDates: 'Blokerede datoer',
    blockedDatesDesc: 'Dage hvor der ikke kan bookes (ferie, kurser osv.)',
    addBlockedDate: 'Tilføj dato',
    noBlockedDates: 'Ingen blokerede datoer',
    previewAvailability: 'Forhåndsvis ledige tider',
    previewAvailabilityDesc: 'Se ledige tider de næste 7 dage.',
    noAvailableSlots: 'Ingen ledige tider i perioden',
    monday: 'Mandag',
    tuesday: 'Tirsdag',
    wednesday: 'Onsdag',
    thursday: 'Torsdag',
    friday: 'Fredag',
    saturday: 'Lørdag',
    sunday: 'Søndag',
    calendarRequired: 'Tilslut en kalender under Indstillinger for at aktivere booking.',
  },
  en: {
    // App
    appName: 'Nora',
    appDesc: 'AI-powered email assistant',
    version: 'v1.0',

    // Nav
    dashboard: 'Dashboard',
    inbox: 'Inbox',
    templates: 'Templates',
    knowledgeBase: 'Knowledge Base',
    settings: 'Settings',

    // Common
    loading: 'Loading...',
    save: 'Save',
    create: 'Create',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    back: 'Back',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    noData: 'No data yet',
    all: 'All',

    // Auth
    signIn: 'Sign in',
    signUp: 'Create account',
    signingIn: 'Wait...',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    companyName: 'Company name',
    somethingWrong: 'Something went wrong',

    // Dashboard
    totalEmails: 'Total emails',
    unread: 'Unread',
    processed: 'Processed',
    categories: 'Categories',
    priority: 'Priority',
    high: 'High',
    medium: 'Medium',
    low: 'Low',

    // Inbox
    noEmails: 'No emails found',
    noSubject: '(No subject)',
    replied: 'Replied',
    now: 'Now',

    // Categories
    inquiry: 'Inquiry',
    complaint: 'Complaint',
    order: 'Order',
    support: 'Support',
    spam: 'Spam',
    other: 'Other',

    // Email detail
    emailNotFound: 'Email not found',
    backToInbox: 'Back to inbox',
    aiSuggestions: 'AI Suggestions',
    noSuggestions: 'No suggestions generated',
    awaitingAi: 'Awaiting AI processing...',
    classification: 'Classification',
    category: 'Category',
    topic: 'Topic',
    confidence: 'Confidence',
    from: 'From:',
    to: 'To:',
    date: 'Date:',
    noContent: 'No content',

    // AI Suggestion
    aiSuggestion: 'AI Suggestion',
    pending: 'Pending',
    approved: 'Approved',
    edited: 'Edited',
    rejected: 'Rejected',
    approve: 'Approve',
    reject: 'Reject',
    sendReply: 'Send reply',
    refineWithAi: 'Refine with AI',
    refineTitle: 'Refine AI suggestion',
    apply: 'Apply',
    discard: 'Discard',
    refinePlaceholder: 'e.g. make it more formal, shorter, add price...',
    refineHint: 'Press Enter to send. AI refines the suggestion based on your instructions.',
    sent: 'Sent',

    // Reply editor
    words: 'words',
    chars: 'chars',

    // Templates
    newTemplate: 'New template',
    editTemplate: 'Edit template',
    none: 'None',
    content: 'Content',
    noTemplates: 'No templates yet. Create your first template above.',
    deleteTemplate: 'Delete this template?',
    used: 'Used',

    // Knowledge
    newEntry: 'New entry',
    editEntry: 'Edit entry',
    type: 'Type',
    title: 'Title',
    knowledgeDesc: 'Add company information that AI uses to generate better responses.',
    noEntries: 'entries yet.',
    deleteEntry: 'Delete this entry?',
    faq: 'FAQ',
    pricing: 'Pricing',
    hours: 'Hours',
    tone: 'Tone',


    // Dashboard redesign
    requiresAction: 'Requires your action',
    canWait: 'Can wait',
    urgent: 'Urgent',
    newItems: 'New',
    handled: 'Handled',
    callBack: 'Call',
    markedContacted: 'Mark as contacted',
    viewAll: 'View all',
    noUrgentItems: 'No urgent items right now',
    noPendingItems: 'No pending items',

    // Customers
    customers: 'Customers',
    newCustomer: 'New customer',
    customerDetail: 'Customer details',
    customerTimeline: 'Timeline',
    statusNyHenvendelse: 'New inquiry',
    statusKontaktet: 'Contacted',
    statusTilbudSendt: 'Quote sent',
    statusTilbudAccepteret: 'Quote accepted',
    statusAfsluttet: 'Completed',
    statusTilbudAfvist: 'Quote declined',
    statusArkiveret: 'Archived',
    actionItems: 'Tasks',
    tasks: 'Tasks',
    sendTilbud: 'Send quote',
    ringTilbage: 'Call back',
    sendInfo: 'Send info',
    bookTid: 'Book appointment',
    overdue: 'Overdue',
    dueToday: 'Due today',
    done: 'Done',
    markDone: 'Mark done',
    pipelineValue: 'Pipeline value',
    noCustomers: 'No customers yet',
    totalCustomers: 'Total customers',
    newThisWeek: 'New this week',
    overdueTasks: 'Overdue tasks',
    notes: 'Notes',
    estimatedValue: 'Estimated value',
    address: 'Address',
    viewCustomer: 'View customer',

    // Inbox redesign
    searchPlaceholder: 'Search customer, subject, sender...',
    conversationThread: 'Conversation',
    customerHistory: 'Customer history',
    noThread: 'No thread found',
    noHistory: 'No previous correspondence',
    newEmail: 'New email',
    toField: 'To',
    subjectField: 'Subject',
    sendEmail: 'Send',
    emailSent: 'Email sent!',
    selectAccount: 'Select account',
    sending: 'Sending...',
    sentEmails: 'Sent',
    noSentEmails: 'No sent emails',
    sentTo: 'To',
    reminders: 'Reminders',
    noReminders: 'No reminders',
    dismiss: 'Dismiss',
    aiDraft: 'AI draft',
    aiDraftPlaceholder: 'Describe what you want to write, e.g. "Write a quote for roof work at 45,000 kr"',
    aiDraftGenerating: 'AI is drafting...',

    // Settings
    emailAccounts: 'Email Accounts',
    emailAccountsDesc: 'Connect your email accounts to receive and send emails.',
    connectGmail: 'Connect Gmail',
    connectOutlook: 'Connect Outlook',
    disconnectAccount: 'Remove this email account?',
    signOut: 'Sign out',
    language: 'Language',
    languageDesc: 'Choose language for dashboard and AI suggestions.',
    theme: 'Theme',
    themeDesc: 'Switch between day and night mode.',
    themeDay: 'Day',
    themeNight: 'Night',

    // Calendar integration
    calendarIntegration: 'Calendar integration',
    calendarIntegrationDesc: 'Connect your calendar so Nora can book appointments directly.',
    connectGoogleCalendar: 'Connect Google Calendar',
    connectOutlookCalendar: 'Connect Outlook Calendar',
    calendarConnected: 'Connected',
    calendarNotConnected: 'No calendar connected',
    calendarNotConnectedDesc: 'Connect a calendar to enable automatic booking via Nora.',
    disconnectCalendar: 'Remove this calendar account?',
    calendarProvider: 'Provider',

    // Booking rules
    bookingSettings: 'Booking settings',
    bookingSettingsDesc: 'Configure how Nora books appointments in your calendar.',
    bookingEnabled: 'Enable automatic booking',
    bookingEnabledDesc: 'Let Nora book appointments directly in your calendar.',
    workDays: 'Work days',
    workHours: 'Work hours',
    workHoursStart: 'From',
    workHoursEnd: 'To',
    slotDuration: 'Appointment length (min)',
    bufferMinutes: 'Buffer between appointments (min)',
    maxBookingsPerDay: 'Max bookings per day',
    advanceBookingDays: 'Booking horizon (days ahead)',
    minNoticeHours: 'Minimum notice (hours)',
    blockedDates: 'Blocked dates',
    blockedDatesDesc: 'Days that cannot be booked (holidays, courses, etc.)',
    addBlockedDate: 'Add date',
    noBlockedDates: 'No blocked dates',
    previewAvailability: 'Preview available times',
    previewAvailabilityDesc: 'See available times for the next 7 days.',
    noAvailableSlots: 'No available times in this period',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
    calendarRequired: 'Connect a calendar in Settings to enable booking.',
  },
} as const

export type TranslationKey = keyof typeof translations.da

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  theme: Theme
  setTheme: (theme: Theme) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextType>({
  locale: 'da',
  setLocale: () => {},
  theme: 'light',
  setTheme: () => {},
  t: (key) => key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('da')
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    const savedLocale = localStorage.getItem('ahmes-locale') as Locale | null
    if (savedLocale && (savedLocale === 'da' || savedLocale === 'en')) {
      setLocaleState(savedLocale)
    }
    const savedTheme = localStorage.getItem('ahmes-theme') as Theme | null
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      setThemeState(savedTheme)
      document.documentElement.classList.toggle('dark', savedTheme === 'dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('ahmes-locale', newLocale)
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('ahmes-theme', newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  const t = (key: TranslationKey): string => {
    return translations[locale][key] || translations.da[key] || key
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, theme, setTheme, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  return useContext(I18nContext)
}
