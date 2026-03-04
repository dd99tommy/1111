// ============================================================
// HeartSync — Answers Module
// Save answers to Supabase, manage secret messages
// ============================================================
import supabase from './supabase.js';

// ── Save a single answer ─────────────────────────────────────
export async function saveAnswer(roomId, userId, questionId, answerValue) {
    const { error } = await supabase.from('answers').upsert({
        room_id: roomId,
        user_id: userId,
        question_id: questionId,
        answer_value: String(answerValue),
    }, { onConflict: 'room_id,user_id,question_id' });
    if (error) throw error;
}

// ── Get answers for a user in a room ─────────────────────────
export async function getUserAnswers(roomId, userId) {
    const { data, error } = await supabase
        .from('answers')
        .select('*, question:question_id(text, type, weight)')
        .eq('room_id', roomId)
        .eq('user_id', userId);
    if (error) throw error;
    return data || [];
}

// ── Get ALL answers in a room (only after completion) ────────
export async function getRoomAnswers(roomId) {
    const { data, error } = await supabase
        .from('answers')
        .select('*, question:question_id(id, text, type, weight)')
        .eq('room_id', roomId);
    if (error) throw error;
    return data || [];
}

// ── How many questions answered so far ──────────────────────
export async function getAnswerCount(roomId, userId) {
    const { count } = await supabase
        .from('answers')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', roomId)
        .eq('user_id', userId);
    return count || 0;
}
