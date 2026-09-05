/**
 * BillCraft Pro — Authentication Service
 * Dual-Engine Architecture:
 * 1. Cloud Engine: Powered by Supabase Auth (when connected to an active project).
 * 2. Local Fallback Engine: Seamless local dev authentication with instant account creation,
 *    password verification, and zero network bottlenecks if Supabase is offline or not configured.
 */

window.BillCraftAuth = (() => {
  'use strict';

  const SESSION_KEY = 'billcraft_user';
  const LOCAL_ACCOUNTS_KEY = 'billcraft_local_accounts';
  const authListeners = [];
  let currentUser = null;
  let isReady = false;
  let readyResolve = null;

  const readyPromise = new Promise((resolve) => {
    readyResolve = resolve;
  });

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    return (
      (parts[0] ? parts[0][0] : '') +
      (parts[1] ? parts[1][0] : '')
    ).toUpperCase() || name.slice(0, 2).toUpperCase();
  };

  const mapSupabaseUser = (sbUser) => {
    if (!sbUser) return null;
    const meta = sbUser.user_metadata || {};
    const name = meta.name || meta.full_name || (sbUser.email ? sbUser.email.split('@')[0] : 'User');
    const businessName = meta.business_name || '';

    return {
      id: sbUser.id,
      email: sbUser.email || '',
      name: name,
      businessName: businessName,
      initials: getInitials(name),
      emailConfirmed: Boolean(sbUser.email_confirmed_at || sbUser.confirmed_at),
      createdAt: sbUser.created_at,
      rawUser: sbUser
    };
  };

  const getSupabase = () => {
    if (window.BillCraftDB && typeof window.BillCraftDB.getClient === 'function') {
      return window.BillCraftDB.getClient();
    }
    return null;
  };

  // Local Accounts Storage Helpers
  const getLocalAccounts = () => {
    try {
      const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveLocalAccounts = (accounts) => {
    try {
      localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts || []));
    } catch (e) {
      console.warn('[BillCraft Auth] Failed to save local accounts:', e);
    }
  };

  const saveLocalSession = (user) => {
    try {
      if (user) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch (e) {
      console.warn('[BillCraft Auth] LocalStorage session save error:', e);
    }
  };

  const loadLocalSession = () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const notifyAuthChange = (user) => {
    currentUser = user;
    saveLocalSession(user);
    authListeners.forEach(cb => {
      try {
        cb(user);
      } catch (err) {
        console.error('[BillCraft Auth] Listener error:', err);
      }
    });
  };

  const isNetworkOrFetchError = (err) => {
    if (!err) return false;
    const msg = String(err.message || err).toLowerCase();
    return (
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('load failed') ||
      msg.includes('err_name_not_resolved') ||
      msg.includes('enotfound')
    );
  };

  // ==========================================================================
  // INITIALIZATION & SESSION RESTORE
  // ==========================================================================

  const initAuth = async () => {
    // 1. Quick load from local cache so UI does not flicker
    const cached = loadLocalSession();
    if (cached) {
      currentUser = cached;
    }

    const sb = getSupabase();
    if (!sb) {
      isReady = true;
      if (readyResolve) readyResolve();
      return;
    }

    try {
      // Test Supabase session with 2s timeout
      const getSessionPromise = sb.auth.getSession();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Supabase session timeout')), 2000)
      );

      const { data: { session } = {}, error } = await Promise.race([getSessionPromise, timeoutPromise]);
      if (session && session.user) {
        currentUser = mapSupabaseUser(session.user);
        notifyAuthChange(currentUser);
      } else if (!session && cached && !cached.isLocalDev) {
        // If Supabase has no active session and cache wasn't local dev, clear
        currentUser = null;
        notifyAuthChange(null);
      }

      // Setup real-time listener if available
      sb.auth.onAuthStateChange(async (event, newSession) => {
        if (newSession && newSession.user) {
          currentUser = mapSupabaseUser(newSession.user);
          notifyAuthChange(currentUser);
        } else if (event === 'SIGNED_OUT') {
          currentUser = null;
          notifyAuthChange(null);
        }
      });
    } catch (err) {
      console.info('[BillCraft Auth] Supabase connection inactive or offline. Using local session mode.');
    } finally {
      isReady = true;
      if (readyResolve) readyResolve();
    }
  };

  // ==========================================================================
  // PUBLIC AUTH METHODS
  // ==========================================================================

  /**
   * Register a new user with Email and Password
   * Automatically attempts Supabase cloud first; if unavailable/offline,
   * creates an instant local account so you can develop and test immediately.
   */
  const signUp = async (email, password, { name, businessName } = {}) => {
    const cleanEmail = email.trim().toLowerCase();
    const displayName = name ? name.trim() : cleanEmail.split('@')[0];
    const cleanBusiness = businessName ? businessName.trim() : '';

    // 1. Check if an active account with this email already exists in local accounts
    const localAccounts = getLocalAccounts();
    const existingLocal = localAccounts.find(a => a.email.toLowerCase() === cleanEmail);
    if (existingLocal) {
      return {
        success: false,
        isAlreadyRegistered: true,
        error: 'An account with this email address already exists. Please sign in instead.'
      };
    }

    // 2. Generate a fresh, unique User ID for this newly created account
    const newUserId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    let finalUserId = newUserId;
    let registeredUserSession = null;
    let isCloudUser = false;
    let isCloudRateLimited = false;

    // 3. Attempt Supabase registration if configured
    const sb = getSupabase();
    if (sb) {
      try {
        const redirectUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'login.html';
        const sbPromise = sb.auth.signUp({
          email: cleanEmail,
          password: password,
          options: {
            data: {
              name: displayName,
              full_name: displayName,
              business_name: cleanBusiness
            },
            emailRedirectTo: redirectUrl
          }
        });

        const { data, error } = await Promise.race([sbPromise, timeoutPromise]);

        let isServerAutoConfirmed = false;
        if (error) {
          const errMsg = (error.message || error.msg || '').toLowerCase();
          if (errMsg.includes('rate limit') || error.code === 429 || error.status === 429) {
            isCloudRateLimited = true;
          }
        } else if (data?.user) {
          const isIdentitiesEmpty = Array.isArray(data.user.identities) && data.user.identities.length === 0;
          if (!isIdentitiesEmpty) {
            // Brand-new user created in Supabase cloud!
            finalUserId = data.user.id;
            registeredUserSession = data.session || null;
            isCloudUser = true;

            // Check if email confirmation is turned off in Supabase server
            if (
              Boolean(data.session && data.session.access_token) ||
              Boolean(data.user.email_confirmed_at) ||
              Boolean(data.user.confirmed_at) ||
              data.user.user_metadata?.email_verified === true
            ) {
              isServerAutoConfirmed = true;
            }
          }
        }

        // Also verify with server settings if available
        if (!isServerAutoConfirmed && window.BillCraftDB && typeof window.BillCraftDB.isEmailConfirmationDisabled === 'function') {
          try {
            isServerAutoConfirmed = await window.BillCraftDB.isEmailConfirmationDisabled();
          } catch {}
        }
      } catch (err) {
        const errMsg = (err?.message || '').toLowerCase();
        if (errMsg.includes('rate limit')) {
          isCloudRateLimited = true;
        }
        console.info('[BillCraft Auth] Cloud signup notice, proceeding with fresh user account ID:', err);
      }
    }

    // Check if confirm email feature is turned off on server
    let isConfirmEmailOff = isCloudUser && isServerAutoConfirmed;
    if (!isConfirmEmailOff && window.BillCraftDB && typeof window.BillCraftDB.isEmailConfirmationDisabled === 'function') {
      try {
        isConfirmEmailOff = await window.BillCraftDB.isEmailConfirmationDisabled();
      } catch {}
    }

    // 4. Create and save the new user account with its fresh User ID & credentials
    const newAccount = {
      id: finalUserId,
      email: cleanEmail,
      password: password,
      name: displayName,
      businessName: cleanBusiness,
      initials: getInitials(displayName),
      createdAt: new Date().toISOString(),
      emailConfirmed: Boolean(isConfirmEmailOff),
      isLocalDev: !isCloudUser
    };

    localAccounts.push(newAccount);
    saveLocalAccounts(localAccounts);

    // 5. Save user profile to Supabase database so profile record is created
    if (window.BillCraftDB && typeof window.BillCraftDB.saveProfile === 'function') {
      try {
        await window.BillCraftDB.saveProfile(finalUserId, {
          name: displayName,
          businessName: cleanBusiness,
          email: cleanEmail
        });
      } catch (e) {
        console.warn('[BillCraft Auth] Error saving new user profile to Supabase:', e);
      }
    }

    // If confirm email feature is turned off in Supabase server,
    // skip email verification part and directly create & activate the user account
    if (isConfirmEmailOff) {
      if (isCloudUser && data?.user) {
        currentUser = mapSupabaseUser(data.user);
      } else {
        currentUser = {
          id: finalUserId,
          email: cleanEmail,
          name: displayName,
          businessName: cleanBusiness,
          initials: getInitials(displayName),
          emailConfirmed: true,
          createdAt: newAccount.createdAt,
          isLocalDev: !isCloudUser
        };
      }
      notifyAuthChange(currentUser);

      return {
        success: true,
        user: currentUser,
        session: registeredUserSession,
        needsEmailConfirmation: false,
        isRateLimit: false
      };
    }

    // Do NOT automatically set currentUser or persist logged-in session until verified
    return {
      success: true,
      user: newAccount,
      session: registeredUserSession,
      needsEmailConfirmation: true,
      isRateLimit: Boolean(isCloudRateLimited)
    };
  };

  /**
   * Sign In with Email and Password
   * Automatically validates against both Supabase Cloud and Local Accounts.
   */
  const signIn = async (email, password) => {
    const cleanEmail = email.trim().toLowerCase();
    const sb = getSupabase();
    let supabaseError = null;

    if (sb) {
      try {
        const sbPromise = sb.auth.signInWithPassword({
          email: cleanEmail,
          password: password
        });

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Supabase network timeout')), 15000)
        );

        const { data, error } = await Promise.race([sbPromise, timeoutPromise]);

        if (error) {
          supabaseError = error;
        } else if (data && data.session && data.user) {
          const localAccounts = getLocalAccounts();
          const match = localAccounts.find(a => a.email.toLowerCase() === cleanEmail);
          if (match && match.id && match.id.startsWith('usr_') && match.id !== data.user.id) {
            currentUser = {
              ...mapSupabaseUser(data.user),
              id: match.id
            };
          } else {
            currentUser = mapSupabaseUser(data.user);
          }
          notifyAuthChange(currentUser);
          return {
            success: true,
            user: currentUser,
            session: data.session
          };
        }
      } catch (err) {
        supabaseError = err;
      }
    }

    // Check Local Accounts store
    const localAccounts = getLocalAccounts();
    const match = localAccounts.find(a => a.email.toLowerCase() === cleanEmail);

    if (match) {
      if (match.password === password) {
        if (!match.emailConfirmed) {
          let serverConfirmDisabled = false;
          if (window.BillCraftDB && typeof window.BillCraftDB.isEmailConfirmationDisabled === 'function') {
            try {
              serverConfirmDisabled = await window.BillCraftDB.isEmailConfirmationDisabled();
            } catch {}
          }
          if (serverConfirmDisabled) {
            match.emailConfirmed = true;
            saveLocalAccounts(localAccounts);
          } else {
            return {
              success: false,
              error: 'Your email address is not verified yet. Please check your inbox and verify your email.',
              isEmailNotConfirmed: true,
              email: cleanEmail
            };
          }
        }

        currentUser = {
          id: match.id,
          email: match.email,
          name: match.name,
          businessName: match.businessName,
          initials: getInitials(match.name),
          emailConfirmed: true,
          createdAt: match.createdAt,
          isLocalDev: true
        };
        notifyAuthChange(currentUser);
        return {
          success: true,
          user: currentUser,
          session: null,
          isLocalMode: true
        };
      } else {
        return {
          success: false,
          error: 'Incorrect password. Please try again.'
        };
      }
    }

    // If Supabase returned an explicit auth error (e.g. Email not confirmed)
    if (supabaseError && !isNetworkOrFetchError(supabaseError)) {
      return {
        success: false,
        error: supabaseError.message,
        isEmailNotConfirmed: supabaseError.message.toLowerCase().includes('not confirmed')
      };
    }

    // If no account found anywhere
    return {
      success: false,
      error: 'No account found with this email. Please switch to the Sign Up tab to create one.'
    };
  };

  /**
   * Verify 6-digit email confirmation code (OTP)
   */
  const verifyOtp = async (email, token, type = 'signup') => {
    const sb = getSupabase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();

    if (sb) {
      try {
        let { data, error } = await sb.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: type
        });

        if (error && type === 'signup') {
          const retry = await sb.auth.verifyOtp({
            email: cleanEmail,
            token: cleanToken,
            type: 'email'
          });
          if (!retry.error) {
            data = retry.data;
            error = null;
          }
        }

        if (error && !isNetworkOrFetchError(error)) {
          return { success: false, error: error.message };
        }

        if (data && data.session && data.user) {
          currentUser = mapSupabaseUser(data.user);
          notifyAuthChange(currentUser);
          return {
            success: true,
            user: currentUser,
            session: data.session
          };
        }
      } catch (e) {
        if (!isNetworkOrFetchError(e)) {
          return { success: false, error: e.message };
        }
      }
    }

    // Local / Offline fallback: check local accounts
    const localAccounts = getLocalAccounts();
    const accountIndex = localAccounts.findIndex(acc => acc.email.toLowerCase() === cleanEmail);
    if (accountIndex !== -1) {
      if (!cleanToken || cleanToken.length < 6) {
        return { success: false, error: 'Please enter the 6-digit confirmation code.' };
      }
      localAccounts[accountIndex].emailConfirmed = true;
      saveLocalAccounts(localAccounts);
      const verifiedUser = {
        id: localAccounts[accountIndex].id,
        email: localAccounts[accountIndex].email,
        name: localAccounts[accountIndex].name,
        businessName: localAccounts[accountIndex].businessName,
        initials: getInitials(localAccounts[accountIndex].name),
        emailConfirmed: true,
        createdAt: localAccounts[accountIndex].createdAt,
        isLocalDev: true
      };
      currentUser = verifiedUser;
      notifyAuthChange(currentUser);
      return {
        success: true,
        user: verifiedUser,
        session: null,
        isLocalMode: true
      };
    }

    return { success: false, error: 'No account found with this email to verify.' };
  };

  /**
   * Resend signup verification email
   */
  const resendVerification = async (email) => {
    const sb = getSupabase();
    const cleanEmail = email.trim().toLowerCase();
    const redirectUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'login.html';

    if (sb) {
      try {
        const { error } = await sb.auth.resend({
          type: 'signup',
          email: cleanEmail,
          options: { emailRedirectTo: redirectUrl }
        });
        if (error) {
          if (error.message && error.message.toLowerCase().includes('rate limit')) {
            return { success: false, error: 'Supabase email authentication limit is exceeded. Please try again later.', isRateLimit: true };
          }
          if (!isNetworkOrFetchError(error)) {
            return { success: false, error: error.message };
          }
        } else {
          return { success: true };
        }
      } catch (e) {
        if (!isNetworkOrFetchError(e)) {
          return { success: false, error: e.message };
        }
      }
    }

    return {
      success: false,
      isConnectionError: true,
      error: 'Cannot reach Supabase project to resend verification email. Please verify your Supabase settings.'
    };
  };

  /**
   * Check if user's session or email has been confirmed in Supabase or local accounts
   */
  const checkEmailVerified = async (email) => {
    const cleanEmail = email.trim().toLowerCase();
    const sb = getSupabase();
    if (sb) {
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (session && session.user && session.user.email?.toLowerCase() === cleanEmail) {
          const isConfirmed = Boolean(session.user.email_confirmed_at || session.user.confirmed_at);
          if (isConfirmed) {
            currentUser = mapSupabaseUser(session.user);
            notifyAuthChange(currentUser);
            const localAccs = getLocalAccounts();
            const localIdx = localAccs.findIndex(acc => acc.email.toLowerCase() === cleanEmail);
            if (localIdx !== -1) {
              localAccs[localIdx].emailConfirmed = true;
              saveLocalAccounts(localAccs);
            }
            return { verified: true, user: currentUser };
          }
        }
      } catch {}
    }

    const localAccounts = getLocalAccounts();
    const local = localAccounts.find(acc => acc.email.toLowerCase() === cleanEmail);
    if (local && local.emailConfirmed) {
      const user = {
        id: local.id,
        email: local.email,
        name: local.name,
        businessName: local.businessName,
        initials: getInitials(local.name),
        emailConfirmed: true,
        createdAt: local.createdAt,
        isLocalDev: true
      };
      return { verified: true, user: user };
    }

    return { verified: false };
  };

  /**
   * Sign In using Magic Link / OTP sent to email
   */
  const signInWithOtp = async (email) => {
    const sb = getSupabase();
    if (!sb) return { success: false, error: 'Supabase is offline. Please use password sign-in.' };

    const cleanEmail = email.trim().toLowerCase();
    const redirectUrl = window.location.origin + window.location.pathname;

    try {
      const { error } = await sb.auth.signInWithOtp({
        email: cleanEmail,
        options: { emailRedirectTo: redirectUrl }
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  /**
   * Completely delete all saved accounts, cached sessions, and local user data
   */
  const clearAllAccounts = async () => {
    try {
      // 1. Clear local accounts table
      localStorage.removeItem(LOCAL_ACCOUNTS_KEY);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem('billcraft_supabase_auth');

      // 2. Wipe all user invoices and drafts
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('billcraft_') || k.startsWith('sb-') || k.includes('invoice') || k.includes('supabase'))) {
          localStorage.removeItem(k);
        }
      }
      sessionStorage.clear();

      // 3. Reset active user
      currentUser = null;
      notifyAuthChange(null);

      // 4. Try cloud sign out if available
      const sb = getSupabase();
      if (sb) {
        try {
          await Promise.race([
            sb.auth.signOut(),
            new Promise(res => setTimeout(res, 500))
          ]);
        } catch {}
      }

      console.info('[BillCraft Auth] All accounts and stored data wiped clean.');
      return { success: true };
    } catch (err) {
      console.error('[BillCraft Auth] Failed to clear accounts:', err);
      return { success: false, error: err.message };
    }
  };

  /**
   * Sign out the current user
   */
  const signOut = async () => {
    currentUser = null;
    saveLocalSession(null);

    try {
      const explicitKeys = ['billcraft_user', 'billcraft_supabase_auth'];
      explicitKeys.forEach(k => {
        try { localStorage.removeItem(k); } catch {}
        try { sessionStorage.removeItem(k); } catch {}
      });
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('sb-') || k.includes('supabase') || k.includes('billcraft_user') || k.includes('billcraft_supabase'))) {
          localStorage.removeItem(k);
        }
      }
    } catch (e) {
      console.warn('[BillCraft Auth] Storage cleanup error:', e);
    }

    notifyAuthChange(null);

    const sb = getSupabase();
    if (sb) {
      try {
        await Promise.race([
          sb.auth.signOut(),
          new Promise((resolve) => setTimeout(resolve, 600))
        ]);
      } catch (e) {}
    }

    return { success: true };
  };

  /**
   * Permanently delete user account, all invoices, and profile from Supabase and local storage
   */
  const deleteAccount = async (targetUser) => {
    const userToDelete = targetUser || currentUser;
    if (!userToDelete) return { success: false, error: 'No user to delete' };

    const userId = userToDelete.id;
    const userEmail = (userToDelete.email || '').toLowerCase();

    console.info('[BillCraft Auth] Deleting account for user:', userId, userEmail);

    // 1. Delete all invoices, profile records, and storage from Supabase
    if (window.BillCraftDB && typeof window.BillCraftDB.deleteUserData === 'function') {
      try {
        await window.BillCraftDB.deleteUserData(userId, userEmail);
      } catch (err) {
        console.warn('[BillCraft Auth] Error deleting Supabase data:', err);
      }
    }

    // 2. Invalidate/destroy credentials in Supabase Auth if session active
    const sb = getSupabase();
    if (sb) {
      try {
        const sessionRes = await Promise.race([
          sb.auth.getSession(),
          new Promise(r => setTimeout(() => r(null), 1000))
        ]);
        const token = sessionRes?.data?.session?.access_token;
        if (token) {
          try {
            const destroyedPassword = 'DEL_' + Math.random().toString(36) + Math.random().toString(36) + '!9#';
            await sb.auth.updateUser({ password: destroyedPassword });
          } catch (e) {}

          try {
            const url = window.BillCraftDB ? window.BillCraftDB.getUrl() : '';
            const anonKey = window.BillCraftDB ? window.BillCraftDB.getAnonKey() : '';
            if (url && anonKey) {
              await fetch(`${url}/auth/v1/user`, {
                method: 'DELETE',
                headers: {
                  'apikey': anonKey,
                  'Authorization': `Bearer ${token}`
                }
              });
            }
          } catch (e) {}
        }
      } catch (err) {
        console.warn('[BillCraft Auth] Supabase auth credential cleanup error:', err);
      }
    }

    // 3. Remove user-scoped localStorage records
    try {
      if (userId) {
        localStorage.removeItem(`billcraft_invoices_${userId}`);
        localStorage.removeItem(`billcraft_draft_${userId}`);
      }
      if (userEmail) {
        localStorage.removeItem(`billcraft_invoices_${userEmail}`);
        localStorage.removeItem(`billcraft_draft_${userEmail}`);
      }
    } catch (e) {}

    // 4. Completely delete user ID and password from local accounts
    try {
      const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
      if (raw) {
        const accounts = JSON.parse(raw);
        const filtered = accounts.filter(a => {
          const aId = a.id || a.userId;
          const aEmail = (a.email || '').toLowerCase();
          if (userId && aId === userId) return false;
          if (userEmail && aEmail === userEmail) return false;
          return true;
        });
        localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(filtered));
      }
    } catch (e) {
      console.warn('[BillCraft Auth] Failed to delete user credentials from local accounts:', e);
    }

    // 5. Sign out and clear active session
    await signOut();

    return { success: true };
  };

  /**
   * Directly confirm a user's email address and activate their session
   */
  const confirmUserEmail = async (email) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const localAccounts = getLocalAccounts();
    const accountIndex = localAccounts.findIndex(acc => acc.email.toLowerCase() === cleanEmail);
    if (accountIndex !== -1) {
      localAccounts[accountIndex].emailConfirmed = true;
      saveLocalAccounts(localAccounts);
      const verifiedUser = {
        id: localAccounts[accountIndex].id,
        email: localAccounts[accountIndex].email,
        name: localAccounts[accountIndex].name,
        businessName: localAccounts[accountIndex].businessName,
        initials: getInitials(localAccounts[accountIndex].name),
        emailConfirmed: true,
        createdAt: localAccounts[accountIndex].createdAt,
        isLocalDev: true
      };
      currentUser = verifiedUser;
      notifyAuthChange(currentUser);
      return { success: true, user: verifiedUser };
    }
    return { success: false, error: 'No account found with this email to confirm.' };
  };

  const getCurrentUser = () => currentUser;
  const isSignedIn = () => currentUser !== null;

  const onAuthStateChanged = (callback) => {
    authListeners.push(callback);
    callback(currentUser);
    return () => {
      const idx = authListeners.indexOf(callback);
      if (idx >= 0) authListeners.splice(idx, 1);
    };
  };

  const whenReady = () => readyPromise;

  // Auto-init on script load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
  } else {
    initAuth();
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================
  return {
    signUp,
    verifyOtp,
    confirmUserEmail,
    resendVerification,
    checkEmailVerified,
    signIn,
    signInWithOtp,
    signOut,
    deleteAccount,
    clearAllAccounts,
    getLocalAccounts,
    getCurrentUser,
    isSignedIn,
    onAuthStateChanged,
    whenReady,
    isReady: () => isReady
  };
})();
