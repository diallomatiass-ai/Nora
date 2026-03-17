const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

async function fetchApi(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data: { email: string; name: string; password: string; company_name?: string }) =>
    fetchApi('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => fetchApi('/auth/me'),

  // Dashboard
  getDashboardSummary: () => fetchApi('/emails/dashboard/summary'),

  // Emails
  generateSuggestion: (id: string) => fetchApi(`/emails/${id}/generate-suggestion`, { method: 'POST' }),
  listEmails: (params?: { category?: string; urgency?: string; is_read?: boolean; search?: string; skip?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) searchParams.set(k, String(v));
      });
    }
    const qs = searchParams.toString();
    return fetchApi(`/emails/${qs ? `?${qs}` : ''}`);
  },
  getEmail: (id: string) => fetchApi(`/emails/${id}`),
  getEmailStats: () => fetchApi('/emails/stats/summary'),
  getEmailThread: (id: string) => fetchApi(`/emails/${id}/thread`),
  getEmailCustomerHistory: (id: string) => fetchApi(`/emails/${id}/customer-history`),
  composeEmail: (data: { to_address: string; subject: string; body: string; account_id: string }) =>
    fetchApi('/emails/compose', { method: 'POST', body: JSON.stringify(data) }),
  generateComposeDraft: (data: { instructions: string; to_address?: string; subject?: string; tones?: string[] }) =>
    fetchApi('/emails/compose/ai-draft', { method: 'POST', body: JSON.stringify(data) }),
  listSentEmails: (params?: { skip?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) searchParams.set(k, String(v));
      });
    }
    const qs = searchParams.toString();
    return fetchApi(`/emails/sent${qs ? `?${qs}` : ''}`);
  },

  // Reminders
  listReminders: () => fetchApi('/reminders/'),
  dismissReminder: (id: string) => fetchApi(`/reminders/${id}/dismiss`, { method: 'POST' }),
  getReminderCount: () => fetchApi('/reminders/count'),

  // Suggestions
  actionSuggestion: (id: string, action: string, editedText?: string) =>
    fetchApi(`/suggestions/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, edited_text: editedText }),
    }),
  sendSuggestion: (id: string) =>
    fetchApi(`/suggestions/${id}/send`, { method: 'POST' }),
  refineSuggestion: (id: string, prompt: string, currentText?: string) =>
    fetchApi(`/suggestions/${id}/refine`, {
      method: 'POST',
      body: JSON.stringify({ prompt, current_text: currentText }),
    }),
  bulkActionSuggestions: (action: 'approve' | 'reject', suggestionIds: string[]) =>
    fetchApi('/suggestions/bulk-action', {
      method: 'POST',
      body: JSON.stringify({ action, suggestion_ids: suggestionIds }),
    }),
  listPendingSuggestions: () => fetchApi('/suggestions/?status=pending&limit=50'),

  // Templates
  listTemplates: () => fetchApi('/templates/'),
  createTemplate: (data: { name: string; category?: string; body: string }) =>
    fetchApi('/templates/', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id: string, data: { name?: string; category?: string; body?: string }) =>
    fetchApi(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTemplate: (id: string) =>
    fetchApi(`/templates/${id}`, { method: 'DELETE' }),

  // Knowledge
  listKnowledge: (entryType?: string) =>
    fetchApi(`/knowledge/${entryType ? `?entry_type=${entryType}` : ''}`),
  createKnowledge: (data: { entry_type: string; title: string; content: string }) =>
    fetchApi('/knowledge/', { method: 'POST', body: JSON.stringify(data) }),
  updateKnowledge: (id: string, data: { entry_type?: string; title?: string; content?: string }) =>
    fetchApi(`/knowledge/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteKnowledge: (id: string) =>
    fetchApi(`/knowledge/${id}`, { method: 'DELETE' }),

  // Chat / AI Command
  sendCommand: (message: string, confirm?: boolean, pendingAction?: Record<string, unknown>) =>
    fetchApi('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, confirm: confirm ?? false, pending_action: pendingAction ?? null }),
    }),

  // Customers
  listCustomers: (params?: { search?: string; status?: string; skip?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) searchParams.set(k, String(v));
      });
    }
    const qs = searchParams.toString();
    return fetchApi(`/customers/${qs ? `?${qs}` : ''}`);
  },
  getCustomer: (id: string) => fetchApi(`/customers/${id}`),
  createCustomer: (data: {
    name: string;
    phone?: string;
    email?: string;
    address_street?: string;
    address_zip?: string;
    address_city?: string;
    source?: string;
    tags?: string[];
    estimated_value?: number;
    notes?: string;
  }) => fetchApi('/customers/', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id: string, data: Record<string, unknown>) =>
    fetchApi(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id: string) =>
    fetchApi(`/customers/${id}`, { method: 'DELETE' }),
  getCustomerTimeline: (id: string) => fetchApi(`/customers/${id}/timeline`),
  mergeCustomers: (primaryId: string, secondaryId: string) =>
    fetchApi(`/customers/${primaryId}/merge/${secondaryId}`, { method: 'POST' }),
  getCustomerDashboard: () => fetchApi('/customers/dashboard'),
  pushToOrdrestyring: (customerId: string, data?: { description?: string }) =>
    fetchApi(`/customers/${customerId}/push-ordrestyring`, { method: 'POST', body: JSON.stringify(data || {}) }),
  getOrdrestyringStatus: () => fetchApi('/customers/ordrestyring-status'),

  // Action Items
  listActionItems: (params?: { status?: string; customer_id?: string; overdue?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) searchParams.set(k, String(v));
      });
    }
    const qs = searchParams.toString();
    return fetchApi(`/action-items/${qs ? `?${qs}` : ''}`);
  },
  getActionItemsDashboard: () => fetchApi('/action-items/dashboard'),
  createActionItem: (data: {
    customer_id: string;
    action: string;
    description?: string;
    deadline?: string;
    source_type?: string;
  }) => fetchApi('/action-items/', { method: 'POST', body: JSON.stringify(data) }),
  updateActionItem: (id: string, data: Record<string, unknown>) =>
    fetchApi(`/action-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteActionItem: (id: string) =>
    fetchApi(`/action-items/${id}`, { method: 'DELETE' }),
  generateFollowupDraft: (id: string) =>
    fetchApi(`/action-items/${id}/generate-draft`, { method: 'POST' }),

  // Kalender
  getCalendarStatus: () => fetchApi('/calendar/status'),
  getCalendarEvents: (start?: string, end?: string) => {
    const params = new URLSearchParams()
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    const qs = params.toString()
    return fetchApi(`/calendar/events${qs ? `?${qs}` : ''}`)
  },
  createCalendarEvent: (data: {
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    action_item_id?: string;
    call_id?: string;
    event_type?: string;
  }) => fetchApi('/calendar/events', { method: 'POST', body: JSON.stringify(data) }),
  updateCalendarEvent: (id: string, data: {
    title?: string;
    description?: string;
    start_time?: string;
    end_time?: string;
  }) => fetchApi(`/calendar/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCalendarEvent: (id: string) =>
    fetchApi(`/calendar/events/${id}`, { method: 'DELETE' }),

  // Accounts (email)
  listAccounts: () => fetchApi('/webhooks/accounts'),
  connectGmail: () => fetchApi('/webhooks/gmail/connect'),
  connectOutlook: () => fetchApi('/webhooks/outlook/connect'),
  disconnectAccount: (id: string) =>
    fetchApi(`/webhooks/accounts/${id}`, { method: 'DELETE' }),

  // Calendar accounts (OAuth)
  connectGoogleCalendar: () => fetchApi('/calendar/oauth/google/connect'),
  connectOutlookCalendar: () => fetchApi('/calendar/oauth/microsoft/connect'),
  listCalendarAccounts: () => fetchApi('/calendar/oauth/accounts'),
  deleteCalendarAccount: (id: string) =>
    fetchApi(`/calendar/oauth/accounts/${id}`, { method: 'DELETE' }),

  // Admin
  getAdminStats: () => fetchApi('/admin/stats'),
  getAdminUsers: () => fetchApi('/admin/users'),
  updateUserRole: (userId: string, role: string) =>
    fetchApi(`/admin/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  deleteAdminUser: (userId: string) =>
    fetchApi(`/admin/users/${userId}`, { method: 'DELETE' }),
  getAdminRecentEmails: () => fetchApi('/admin/emails/recent'),
  getAdminHealth: () => fetchApi('/admin/health'),

  // Booking rules
  getBookingRules: () => fetchApi('/booking-rules'),
  updateBookingRules: (data: {
    enabled?: boolean;
    work_days?: number[];
    work_hours?: { start: string; end: string };
    slot_duration_minutes?: number;
    buffer_minutes?: number;
    max_bookings_per_day?: number;
    advance_booking_days?: number;
    min_notice_hours?: number;
    blocked_dates?: string[];
    custom_slots?: Record<string, unknown>;
  }) => fetchApi('/booking-rules', { method: 'PUT', body: JSON.stringify(data) }),
  addBlockedDate: (date: string) =>
    fetchApi('/booking-rules/blocked-dates', { method: 'POST', body: JSON.stringify({ date }) }),
  removeBlockedDate: (date: string) =>
    fetchApi(`/booking-rules/blocked-dates/${date}`, { method: 'DELETE' }),
  getBookingAvailability: (from: string, to: string) => {
    const params = new URLSearchParams({ from, to })
    return fetchApi(`/booking-rules/availability?${params}`)
  },

  // Billing / Stripe
  getBillingPlans: () => fetchApi('/billing/plans'),
  getSubscription: () => fetchApi('/billing/subscription'),
  createCheckout: (plan: string) =>
    fetchApi('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
  createPortal: () =>
    fetchApi('/billing/portal', { method: 'POST' }),

  // Mødenotater
  listMeetings: () => fetchApi('/meetings'),
  createMeeting: (data: { title?: string; transcript?: string; participants?: string; meeting_date?: string }) =>
    fetchApi('/meetings', { method: 'POST', body: JSON.stringify(data) }),
  getMeeting: (id: string) => fetchApi(`/meetings/${id}`),
  updateMeeting: (id: string, data: Record<string, unknown>) =>
    fetchApi(`/meetings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMeeting: (id: string) =>
    fetchApi(`/meetings/${id}`, { method: 'DELETE' }),
  processMeeting: (id: string) =>
    fetchApi(`/meetings/${id}/process`, { method: 'POST' }),

  // Generisk request (bruges af møde-siden)
  request: (method: string, path: string, body?: unknown) =>
    fetchApi(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) }),
};
