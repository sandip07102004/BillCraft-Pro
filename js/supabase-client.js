/**
 * BillCraft Pro — Supabase Client Configuration & Database Utilities
 * Connected to project: ewtauqolrcqrbiriritu (BillCraft)
 */

(() => {
  'use strict';

  const DEFAULT_SUPABASE_URL = 'https://ewtauqolrcqrbiriritu.supabase.co';
  const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dGF1cW9scmNxcmJpcmlyaXR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MTAxNzAsImV4cCI6MjEwNDE4NjE3MH0.fk79UdsVGM67n-zQ2GTK1uFKkY1TflH_Qaz8eqapI_s';

  let client = null;

  const getEffectiveUrl = () => {
    try {
      const saved = localStorage.getItem('billcraft_supabase_url');
      // Clean up dead/unreachable project references automatically
      if (saved && (saved.includes('snedvooiypefpfbmvlku') || !saved.trim())) {
        localStorage.removeItem('billcraft_supabase_url');
        localStorage.removeItem('billcraft_supabase_anon_key');
        return DEFAULT_SUPABASE_URL;
      }
      if (saved && saved.trim()) return saved.trim();
    } catch {}
    return DEFAULT_SUPABASE_URL;
  };

  const getEffectiveAnonKey = () => {
    try {
      const savedUrl = localStorage.getItem('billcraft_supabase_url');
      if (savedUrl && (savedUrl.includes('snedvooiypefpfbmvlku') || !savedUrl.trim())) {
        return DEFAULT_SUPABASE_ANON_KEY;
      }
      const savedKey = localStorage.getItem('billcraft_supabase_anon_key');
      if (savedKey && (savedKey.includes('KWRkwB6iVRxqF6hOwpIjBg_QJoPTpF1') || !savedKey.trim())) {
        localStorage.removeItem('billcraft_supabase_anon_key');
        return DEFAULT_SUPABASE_ANON_KEY;
      }
      if (savedKey && savedKey.trim()) return savedKey.trim();
    } catch {}
    return DEFAULT_SUPABASE_ANON_KEY;
  };

  const getSupabaseLib = () => {
    if (typeof window !== 'undefined') {
      if (window.supabase && typeof window.supabase.createClient === 'function') return window.supabase;
      if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') return supabase;
    }
    return null;
  };

  /**
   * Lightweight native fetch-based Supabase fallback client
   * Ensures auth and queries succeed even if CDN is offline, blocked by adblockers, or running under file://
   */
  const createNativeSupabaseClient = (url, anonKey) => {
    const cleanUrl = (url || '').trim().replace(/\/+$/, '');
    const cleanKey = (anonKey || '').trim();
    const STORAGE_KEY = 'billcraft_supabase_auth';

    const getStoredSession = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    };

    const saveStoredSession = (session) => {
      try {
        if (session) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {}
    };

    const authHeaders = (token) => ({
      'apikey': cleanKey,
      'Authorization': `Bearer ${token || cleanKey}`,
      'Content-Type': 'application/json'
    });

    const listeners = [];

    const auth = {
      async getSession() {
        const s = getStoredSession();
        return { data: { session: s }, error: null };
      },

      async getUser() {
        const s = getStoredSession();
        return { data: { user: s ? s.user : null }, error: null };
      },

      onAuthStateChange(callback) {
        listeners.push(callback);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                const idx = listeners.indexOf(callback);
                if (idx !== -1) listeners.splice(idx, 1);
              }
            }
          }
        };
      },

      async signUp({ email, password, options = {} }) {
        try {
          const res = await fetch(`${cleanUrl}/auth/v1/signup`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
              email: email.trim(),
              password: password,
              data: options.data || {},
              gotrue_meta_security: {}
            })
          });
          const data = await res.json();
          if (!res.ok) {
            return { data: null, error: new Error(data.msg || data.message || data.error_description || 'Signup failed') };
          }
          if (data.session) {
            saveStoredSession(data.session);
            listeners.forEach(cb => { try { cb('SIGNED_IN', data.session); } catch {} });
          }
          return { data: { user: data.user || data, session: data.session || null }, error: null };
        } catch (e) {
          return { data: null, error: e };
        }
      },

      async signInWithPassword({ email, password }) {
        try {
          const res = await fetch(`${cleanUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
              email: email.trim(),
              password: password
            })
          });
          const data = await res.json();
          if (!res.ok) {
            return { data: null, error: new Error(data.msg || data.message || data.error_description || 'Sign in failed') };
          }
          const session = {
            access_token: data.access_token,
            token_type: data.token_type,
            expires_in: data.expires_in,
            refresh_token: data.refresh_token,
            user: data.user
          };
          saveStoredSession(session);
          listeners.forEach(cb => { try { cb('SIGNED_IN', session); } catch {} });
          return { data: { user: data.user, session: session }, error: null };
        } catch (e) {
          return { data: null, error: e };
        }
      },

      async verifyOtp(params) {
        try {
          const res = await fetch(`${cleanUrl}/auth/v1/verify`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(params)
          });
          const data = await res.json();
          if (!res.ok) {
            return { data: null, error: new Error(data.msg || data.message || 'Verification failed') };
          }
          const session = data.session || (data.access_token ? {
            access_token: data.access_token,
            token_type: data.token_type,
            expires_in: data.expires_in,
            refresh_token: data.refresh_token,
            user: data.user
          } : null);
          if (session) {
            saveStoredSession(session);
            listeners.forEach(cb => { try { cb('SIGNED_IN', session); } catch {} });
          }
          return { data: { user: data.user, session: session }, error: null };
        } catch (e) {
          return { data: null, error: e };
        }
      },

      async exchangeCodeForSession(authCode) {
        try {
          const res = await fetch(`${cleanUrl}/auth/v1/token?grant_type=pkce`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ auth_code: authCode })
          });
          const data = await res.json();
          if (!res.ok) {
            return { data: null, error: new Error(data.msg || data.message || 'Token exchange failed') };
          }
          const session = {
            access_token: data.access_token,
            token_type: data.token_type,
            expires_in: data.expires_in,
            refresh_token: data.refresh_token,
            user: data.user
          };
          saveStoredSession(session);
          listeners.forEach(cb => { try { cb('SIGNED_IN', session); } catch {} });
          return { data: { user: data.user, session: session }, error: null };
        } catch (e) {
          return { data: null, error: e };
        }
      },

      async resend({ type = 'signup', email, options = {} }) {
        try {
          const res = await fetch(`${cleanUrl}/auth/v1/resend`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
              type: type,
              email: email.trim(),
              options: options
            })
          });
          const data = await res.json();
          if (!res.ok) {
            return { error: new Error(data.msg || data.message || 'Failed to resend confirmation email') };
          }
          return { error: null };
        } catch (e) {
          return { error: e };
        }
      },

      async signOut() {
        saveStoredSession(null);
        listeners.forEach(cb => { try { cb('SIGNED_OUT', null); } catch {} });
        return { error: null };
      }
    };

    const from = (table) => {
      let queryParams = [];
      let currentMethod = 'GET';
      let requestBody = null;
      let headers = authHeaders(getStoredSession()?.access_token);

      const builder = {
        select(columns = '*') {
          queryParams.push(`select=${encodeURIComponent(columns)}`);
          return builder;
        },
        eq(col, val) {
          queryParams.push(`${encodeURIComponent(col)}=eq.${encodeURIComponent(val)}`);
          return builder;
        },
        order(col, { ascending = true } = {}) {
          queryParams.push(`order=${encodeURIComponent(col)}.${ascending ? 'asc' : 'desc'}`);
          return builder;
        },
        single() {
          headers['Accept'] = 'application/vnd.pgrst.object+json';
          return builder;
        },
        upsert(data) {
          currentMethod = 'POST';
          headers['Prefer'] = 'resolution=merge-duplicates,return=representation';
          requestBody = JSON.stringify(data);
          return builder;
        },
        delete() {
          currentMethod = 'DELETE';
          headers['Prefer'] = 'return=representation';
          return builder;
        },
        then(onFulfilled, onRejected) {
          const queryString = queryParams.length ? '?' + queryParams.join('&') : '';
          const url = `${cleanUrl}/rest/v1/${table}${queryString}`;
          return fetch(url, {
            method: currentMethod,
            headers: headers,
            body: requestBody
          }).then(async (res) => {
            const text = await res.text();
            let json = null;
            try { json = JSON.parse(text); } catch {}
            if (!res.ok) {
              return { data: null, error: new Error(json?.message || json?.error || text || `Error ${res.status}`) };
            }
            return { data: json, error: null };
          }).catch(err => {
            return { data: null, error: err };
          }).then(onFulfilled, onRejected);
        }
      };
      return builder;
    };

    return { auth, from };
  };

  const initSupabase = (forceNew = false) => {
    if (client && !forceNew) return client;

    const currentUrl = getEffectiveUrl();
    const currentKey = getEffectiveAnonKey();
    const sbLib = getSupabaseLib();

    if (sbLib) {
      try {
        client = sbLib.createClient(currentUrl, currentKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'billcraft_supabase_auth'
          }
        });
        console.info('[BillCraft] Supabase client initialized with SDK:', currentUrl);
        return client;
      } catch (err) {
        console.warn('[BillCraft] SDK createClient warning, using native client:', err);
      }
    }

    // Direct native client fallback
    client = createNativeSupabaseClient(currentUrl, currentKey);
    console.info('[BillCraft] Supabase native fetch client active:', currentUrl);
    return client;
  };

  window.BillCraftDB = {
    get config() {
      return {
        url: getEffectiveUrl(),
        anonKey: getEffectiveAnonKey()
      };
    },
    getUrl: () => getEffectiveUrl(),
    getAnonKey: () => getEffectiveAnonKey(),
    getClient: () => client || initSupabase(),

    /**
     * Update project credentials dynamically and re-create client
     */
    setCredentials(url, key) {
      if (url && key) {
        localStorage.setItem('billcraft_supabase_url', url.trim());
        localStorage.setItem('billcraft_supabase_anon_key', key.trim());
      } else {
        localStorage.removeItem('billcraft_supabase_url');
        localStorage.removeItem('billcraft_supabase_anon_key');
      }
      client = null;
      return Boolean(initSupabase(true));
    },

    /**
     * Test whether the configured Supabase project is active and reachable
     */
    async testConnection(testUrl, testKey) {
      const url = (testUrl || getEffectiveUrl() || '').trim().replace(/\/+$/, '');
      const key = (testKey || getEffectiveAnonKey() || '').trim();

      if (!url || !key) {
        return { connected: false, ok: false, error: 'Project URL and API Key are required' };
      }

      // Check using direct HTTP fetch to Supabase Auth settings endpoint
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);
        const endpoint = `${url}/auth/v1/settings`;

        const res = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          return { connected: true, ok: true };
        } else if (res.status === 401 || res.status === 403) {
          return { connected: false, ok: false, error: 'Invalid API Key for this Supabase Project (HTTP 401).' };
        } else if (res.status === 404) {
          return { connected: false, ok: false, error: 'Supabase endpoint not found. Please verify your Project URL.' };
        } else {
          return { connected: false, ok: false, error: `Supabase server returned status ${res.status}` };
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          return { connected: false, ok: false, error: 'Connection timed out. Check your project URL and network.' };
        }
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('failed to fetch') || msg.includes('fetch failed') || msg.includes('network') || msg.includes('enotfound')) {
          return { connected: false, ok: false, error: 'Cannot connect to Supabase project URL. Please verify your Project URL.' };
        }
        return { connected: false, ok: false, error: err.message || 'Connection failed' };
      }
    },

    /**
     * Fetch user profile metadata from public.profiles
     */
    async getProfile(userId) {
      const sb = window.BillCraftDB.getClient();
      if (!sb || !userId) return null;
      try {
        const { data, error } = await sb
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (error && error.code !== 'PGRST116') {
          console.warn('[BillCraft] Failed to fetch profile:', error);
        }
        return data || null;
      } catch (e) {
        console.warn('[BillCraft] Profile fetch exception:', e);
        return null;
      }
    },

    /**
     * Upsert user profile & business information
     */
    async updateProfile(userId, profileData = {}) {
      const sb = window.BillCraftDB.getClient();
      if (!sb || !userId) return false;
      try {
        const name = profileData.name || '';
        const businessName = profileData.businessName || profileData.business_name || '';
        const email = profileData.email || '';
        const phone = profileData.phone || '';
        const address = profileData.address || '';
        const cityStateZip = profileData.cityStateZip || profileData.city_state_zip || '';
        const country = profileData.country || '';
        const taxId = profileData.taxId || profileData.tax_id || '';

        const { error } = await sb.from('profiles').upsert({
          id: userId,
          name: name,
          business_name: businessName,
          email: email,
          phone: phone,
          address: address,
          city_state_zip: cityStateZip,
          country: country,
          tax_id: taxId,
          profile_data: profileData,
          updated_at: new Date().toISOString()
        });
        if (error) console.warn('[BillCraft] Failed to upsert profile in Supabase:', error);
        return !error;
      } catch (e) {
        console.warn('[BillCraft] Profile update exception:', e);
        return false;
      }
    },

    /**
     * Upload an Invoice PDF blob to Supabase Storage ('invoice-pdfs' bucket)
     * Returns the public URL string or null
     */
    async uploadInvoicePdf(pdfBlob, fileName, userId) {
      if (!pdfBlob) return null;
      const url = getEffectiveUrl();
      const key = getEffectiveAnonKey();
      const safeUser = (userId || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeName = (fileName || `invoice_${Date.now()}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${safeUser}/${safeName}`;

      try {
        const sb = window.BillCraftDB.getClient();
        // Try SDK storage upload if available
        if (sb && sb.storage) {
          try {
            const { data, error } = await sb.storage
              .from('invoice-pdfs')
              .upload(storagePath, pdfBlob, {
                contentType: 'application/pdf',
                upsert: true
              });
            if (!error) {
              const { data: pubData } = sb.storage.from('invoice-pdfs').getPublicUrl(storagePath);
              if (pubData && pubData.publicUrl) {
                console.info('[BillCraft] PDF uploaded via SDK Storage:', pubData.publicUrl);
                return pubData.publicUrl;
              }
            }
          } catch (sdkErr) {
            console.warn('[BillCraft] SDK Storage upload warning, attempting REST fallback:', sdkErr);
          }
        }

        // Direct HTTP fetch upload fallback to Supabase Storage API
        const uploadEndpoint = `${url}/storage/v1/object/invoice-pdfs/${storagePath}`;
        const res = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/pdf',
            'x-upsert': 'true'
          },
          body: pdfBlob
        });

        if (res.ok) {
          const publicUrl = `${url}/storage/v1/object/public/invoice-pdfs/${storagePath}`;
          console.info('[BillCraft] PDF uploaded via REST Storage API:', publicUrl);
          return publicUrl;
        } else {
          const errBody = await res.text();
          console.warn('[BillCraft] Storage REST upload failed:', res.status, errBody);
        }
      } catch (err) {
        console.warn('[BillCraft] PDF storage upload exception:', err);
      }
      return null;
    },

    /**
     * Fetch all invoices for the user from Supabase
     */
    async fetchInvoices(userId) {
      const sb = window.BillCraftDB.getClient();
      if (!sb || !userId) return [];
      try {
        const { data, error } = await sb
          .from('invoices')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });

        if (error) {
          console.warn('[BillCraft] Failed to fetch invoices from Supabase:', error);
          return [];
        }
        return (data || []).map(row => {
          const inv = row.invoice_data || {};
          inv.id = row.id;
          inv.userId = row.user_id;
          inv.savedAt = row.updated_at;
          inv.pdfUrl = row.pdf_url || inv.pdfUrl || null;
          return inv;
        });
      } catch (e) {
        console.warn('[BillCraft] Invoices fetch exception:', e);
        return [];
      }
    },

    /**
     * Save/upsert an invoice with all user form data & PDF URL into Supabase
     */
    async saveInvoice(invoice, userId, pdfUrl = null) {
      const sb = window.BillCraftDB.getClient();
      if (!sb || !invoice) return false;
      try {
        const invoiceId = invoice.id || ('inv_' + Date.now());
        const invNum = invoice.metadata?.number || 'INV-001';
        const clientName = invoice.client?.name || 'Valued Client';
        const clientEmail = invoice.client?.email || '';
        const totalAmount = invoice.summary?.grandTotal ?? invoice.totals?.grandTotal ?? 0;
        const issueDate = invoice.metadata?.date || invoice.metadata?.issueDate || '';
        const dueDate = invoice.metadata?.dueDate || '';
        const status = invoice.metadata?.status || invoice.status || 'saved';
        const resolvedPdfUrl = pdfUrl || invoice.pdfUrl || invoice.pdf_url || null;

        if (resolvedPdfUrl) {
          invoice.pdfUrl = resolvedPdfUrl;
        }

        const payload = {
          id: invoiceId,
          user_id: userId || 'anonymous',
          invoice_number: invNum,
          client_name: clientName,
          client_email: clientEmail,
          total_amount: totalAmount,
          issue_date: issueDate,
          due_date: dueDate,
          status: status,
          pdf_url: resolvedPdfUrl,
          invoice_data: invoice,
          updated_at: new Date().toISOString()
        };

        const { error } = await sb.from('invoices').upsert(payload);

        if (error) {
          console.warn('[BillCraft] Failed to save invoice to Supabase:', error);
          return false;
        }
        console.info('[BillCraft] Invoice record & form data saved to Supabase:', invNum);
        return true;
      } catch (e) {
        console.warn('[BillCraft] Invoices save exception:', e);
        return false;
      }
    },

    /**
     * Delete an invoice from Supabase
     */
    async deleteInvoice(invoiceId, userId) {
      const sb = window.BillCraftDB.getClient();
      if (!sb || !invoiceId) return false;
      try {
        let query = sb.from('invoices').delete().eq('id', invoiceId);
        if (userId) {
          query = query.eq('user_id', userId);
        }
        const { error } = await query;

        if (error) {
          console.warn('[BillCraft] Failed to delete invoice from Supabase:', error);
          return false;
        }
        return true;
      } catch (e) {
        console.warn('[BillCraft] Invoices delete exception:', e);
        return false;
      }
    },

    /**
     * Delete all invoices for a specific user from Supabase database
     */
    async deleteAllInvoices(userId, userEmail) {
      const sb = window.BillCraftDB.getClient();
      if (!sb || (!userId && !userEmail)) return false;
      try {
        if (userId) {
          const { error } = await sb.from('invoices').delete().eq('user_id', userId);
          if (error) console.warn('[BillCraft] Failed to delete invoices by userId:', userId, error);
        }
        if (userEmail) {
          const { error } = await sb.from('invoices').delete().eq('user_id', userEmail);
          if (error) console.warn('[BillCraft] Failed to delete invoices by userEmail:', userEmail, error);
        }
        console.info('[BillCraft] Successfully deleted all invoices from Supabase for user:', userId || userEmail);
        return true;
      } catch (e) {
        console.warn('[BillCraft] Delete all invoices exception:', e);
        return false;
      }
    },

    /**
     * Delete user profile & metadata from public.profiles in Supabase
     */
    async deleteProfile(userId, userEmail) {
      const sb = window.BillCraftDB.getClient();
      if (!sb || (!userId && !userEmail)) return false;
      try {
        let query = sb.from('profiles').delete();
        if (userId) {
          query = query.eq('id', userId);
        } else if (userEmail) {
          query = query.eq('email', userEmail);
        }
        const { error } = await query;
        if (error) {
          console.warn('[BillCraft] Failed to delete profile for user:', userId || userEmail, error);
          return false;
        }
        console.info('[BillCraft] Successfully deleted profile for user from Supabase:', userId || userEmail);
        return true;
      } catch (e) {
        console.warn('[BillCraft] Delete profile exception:', e);
        return false;
      }
    },

    /**
     * Delete all invoice PDFs stored for this user in Supabase Storage
     */
    async deleteUserStorage(userId) {
      const sb = window.BillCraftDB.getClient();
      if (!sb || !sb.storage || !userId) return false;
      try {
        const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
        const { data: files, error: listErr } = await sb.storage.from('invoice-pdfs').list(safeUser);
        if (!listErr && files && files.length > 0) {
          const filePaths = files.map(f => `${safeUser}/${f.name}`);
          await sb.storage.from('invoice-pdfs').remove(filePaths);
          console.info('[BillCraft] Cleaned up storage files for user:', safeUser);
        }
        return true;
      } catch (e) {
        console.warn('[BillCraft] User storage deletion exception:', e);
        return false;
      }
    },

    /**
     * Complete deletion of user data, invoices, and storage from Supabase
     */
    async deleteUserData(userId, userEmail) {
      console.info('[BillCraft] Initiating complete Supabase deletion for user:', userId, userEmail);
      const results = await Promise.allSettled([
        this.deleteAllInvoices(userId, userEmail),
        this.deleteProfile(userId, userEmail),
        this.deleteUserStorage(userId)
      ]);
      return results;
    },

    /**
     * Check if email confirmation is turned off in Supabase server settings
     * Returns true if email confirmation is disabled (mailer_autoconfirm = true)
     */
    async isEmailConfirmationDisabled() {
      const url = getEffectiveUrl();
      const key = getEffectiveAnonKey();
      if (!url || !key) return false;
      try {
        const res = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/settings`, {
          headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });
        if (res.ok) {
          const settings = await res.json();
          return Boolean(settings && settings.mailer_autoconfirm === true);
        }
      } catch (e) {
        console.warn('[BillCraft] Error checking auth settings:', e);
      }
      return false;
    }
  };

  // Attempt initial setup if library is already present
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
  } else {
    initSupabase();
  }
})();
