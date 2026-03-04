// ============================================================
// HeartSync — Rooms Module
// Create, join, list rooms; generate invite links
// ============================================================
import supabase from './supabase.js';

// ── Create a new room ────────────────────────────────────────
export async function createRoom(userId) {
    const { data, error } = await supabase
        .from('rooms')
        .insert({ created_by: userId, status: 'waiting' })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// ── Generate invite link ─────────────────────────────────────
export function getInviteLink(roomId) {
    return `${location.origin}/room.html?join=${roomId}`;
}

// ── Join an existing room as partner ────────────────────────
export async function joinRoom(roomId, userId) {
    // Check room exists and is in 'waiting' state
    const { data: room, error: fetchErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

    if (fetchErr || !room) throw new Error('الغرفة غير موجودة');
    if (room.created_by === userId) {
        // Creator rejoins their own room → go to room page
        return room;
    }
    if (room.partner_id && room.partner_id !== userId) {
        throw new Error('هذه الغرفة ممتلئة بالفعل');
    }
    if (room.status === 'completed') {
        // Redirect to results instead
        location.href = `/results.html?room=${roomId}`;
        return null;
    }

    // Set partner_id if not already set
    if (!room.partner_id) {
        const { error: updateErr } = await supabase
            .from('rooms')
            .update({ partner_id: userId, status: 'active' })
            .eq('id', roomId);
        if (updateErr) throw updateErr;
    }

    // Return updated room
    const { data: updated } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();
    return updated;
}

// ── Get room by ID ───────────────────────────────────────────
export async function getRoom(roomId) {
    const { data, error } = await supabase
        .from('rooms')
        .select(`*, creator:created_by(name, avatar_url), partner:partner_id(name, avatar_url)`)
        .eq('id', roomId)
        .single();
    if (error) throw error;
    return data;
}

// ── Get all rooms for a user ─────────────────────────────────
export async function getUserRooms(userId) {
    const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .or(`created_by.eq.${userId},partner_id.eq.${userId}`)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

// ── Update room secret message ───────────────────────────────
export async function saveSecretMessage(roomId, userId, creatorId, message) {
    const field = userId === creatorId ? 'creator_message' : 'partner_message';
    const { error } = await supabase
        .from('rooms')
        .update({ [field]: message })
        .eq('id', roomId);
    if (error) throw error;
}

// ── Check if user has completed all questions in a room ──────
export async function hasUserFinished(roomId, userId) {
    const { count: questionCount } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('active', true);

    const { count: answerCount } = await supabase
        .from('answers')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .eq('user_id', userId);

    return answerCount >= questionCount;
}

// ── Poll room status (for waiting screen) ───────────────────
export async function pollRoomStatus(roomId, interval = 5000) {
    return new Promise((resolve) => {
        const poll = async () => {
            const { data } = await supabase
                .from('rooms')
                .select('status, creator_done, partner_done')
                .eq('id', roomId)
                .single();
            if (data && data.status === 'completed') {
                resolve(data);
            } else {
                setTimeout(poll, interval);
            }
        };
        poll();
    });
}

// ── Status badge helper ──────────────────────────────────────
export function statusLabel(status) {
    const map = { waiting: 'في الانتظار', active: 'نشط', completed: 'مكتمل' };
    return map[status] || status;
}
export function statusBadgeClass(status) {
    const map = { waiting: 'badge-waiting', active: 'badge-active', completed: 'badge-completed' };
    return `badge ${map[status] || ''}`;
}
