// ============================================================
// HeartSync — Auth Module
// Handles Google OAuth, session management, route guards
// ============================================================
import supabase from './supabase.js';

// ── Get current session & user ──────────────────────────────
export async function getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
}

export async function getUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
}

// ── Get user profile from public.users ──────────────────────
export async function getProfile(userId) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) return null;
    return data;
}

// ── Upsert profile after OAuth / anonymous login ─────────────
export async function upsertProfile(user) {
    const meta = user.user_metadata || {};
    const isAnon = user.is_anonymous;
    const { error } = await supabase.from('users').upsert({
        id: user.id,
        name: meta.full_name || meta.name || (isAnon ? 'ضيف' : 'مستخدم'),
        email: user.email || null,
        avatar_url: meta.avatar_url || meta.picture || null,
    }, { onConflict: 'id', ignoreDuplicates: false });
    if (error) console.warn('Upsert profile:', error.message);
}

// ── Google OAuth Login ───────────────────────────────────────
export async function signInWithGoogle() {
    const redirectTo = `${location.origin}/dashboard.html`;
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
    });
    if (error) throw error;
}

// ── Anonymous / Guest Login ──────────────────────────────────
export async function signInAsGuest() {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    await upsertProfile(data.user);
    location.href = '/dashboard.html';
}

// ── Sign Out ─────────────────────────────────────────────────
export async function signOut() {
    await supabase.auth.signOut();
    location.href = '/index.html';
}

// ── Route Guard: require login ───────────────────────────────
// Returns profile if logged in, otherwise redirects to login
export async function requireAuth() {
    const session = await getSession();
    if (!session) {
        location.href = '/index.html';
        return null;
    }
    await upsertProfile(session.user);
    const profile = await getProfile(session.user.id);
    return profile;
}

// ── Route Guard: require admin role ─────────────────────────
export async function requireAdmin() {
    const profile = await requireAuth();
    if (!profile) return null;
    if (profile.role !== 'admin') {
        location.href = '/dashboard.html';
        return null;
    }
    return profile;
}

// ── Redirect logged-in users away from index ────────────────
export async function redirectIfLoggedIn(target = '/dashboard.html') {
    const session = await getSession();
    if (session) location.href = target;
}

// ── Render navbar user info ──────────────────────────────────
export function renderNavUser(profile) {
    const nameEls = document.querySelectorAll('.nav-name');
    const avatarEls = document.querySelectorAll('.nav-avatar');
    nameEls.forEach(el => { el.textContent = profile?.name || ''; });
    avatarEls.forEach(el => {
        if (profile?.avatar_url) el.src = profile.avatar_url;
        else el.style.display = 'none';
    });
}

// ── Toast notifications ──────────────────────────────────────
export function showToast(message, type = 'info', duration = 3500) {
    let toast = document.getElementById('global-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'global-toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast ${type}`;
    requestAnimationFrame(() => {
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), duration);
    });
}
