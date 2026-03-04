// ============================================================
// HeartSync — Results Module
// Render compatibility results, matched/mismatched answers,
// animated circular progress, and secret messages
// ============================================================
import supabase from './supabase.js';
import { getRoomAnswers } from './answers.js';
import { escapeHtml } from './questions.js';

// ── Load & render all results ────────────────────────────────
export async function renderResults(roomId, currentUserId) {
    // Fetch room
    const { data: room, error: roomErr } = await supabase
        .from('rooms')
        .select(`*, creator:created_by(id, name, avatar_url), partner:partner_id(id, name, avatar_url)`)
        .eq('id', roomId)
        .single();
    if (roomErr || !room) throw new Error('غرفة غير موجودة');
    if (room.status !== 'completed') throw new Error('لم تكتمل الإجابات بعد');

    // Determine my/partner side
    const isCreator = room.created_by === currentUserId;
    const myInfo = isCreator ? room.creator : room.partner;
    const partnerInfo = isCreator ? room.partner : room.creator;

    // Fetch all answers
    const allAnswers = await getRoomAnswers(roomId);

    // Group by question
    const byQuestion = {};
    allAnswers.forEach(ans => {
        const qid = ans.question_id;
        if (!byQuestion[qid]) byQuestion[qid] = { question: ans.question, answers: {} };
        byQuestion[qid].answers[ans.user_id] = ans.answer_value;
    });

    const matched = [];
    const mismatched = [];

    Object.values(byQuestion).forEach(({ question, answers }) => {
        const myAns = answers[currentUserId];
        const partnerAns = answers[partnerInfo?.id] || answers[isCreator ? room.partner_id : room.created_by];

        let isMatch = false;
        if (question.type === 'scale') {
            isMatch = Math.abs(Number(myAns) - Number(partnerAns)) <= 1;
        } else {
            isMatch = myAns?.toLowerCase().trim() === partnerAns?.toLowerCase().trim();
        }

        const entry = { question, myAns, partnerAns };
        if (isMatch) matched.push(entry);
        else mismatched.push(entry);
    });

    return { room, myInfo, partnerInfo, matched, mismatched, score: room.compatibility_score };
}

// ── Animate the compatibility circle ────────────────────────
export function animateCircle(score) {
    const fill = document.querySelector('.compat-fill');
    const pct = document.querySelector('.compat-percent');
    if (!fill || !pct) return;

    const circumference = 628; // 2π × 100
    const targetDash = circumference - (score / 100) * circumference;

    // Animate number count
    let current = 0;
    const step = score / 60;
    const counter = setInterval(() => {
        current = Math.min(current + step, score);
        pct.textContent = `${Math.round(current)}٪`;
        if (current >= score) clearInterval(counter);
    }, 25);

    // Animate circle
    setTimeout(() => {
        fill.style.strokeDashoffset = targetDash;
    }, 300);

    // Color based on score
    let color;
    if (score >= 80) color = '#34d399';
    else if (score >= 60) color = '#a855f7';
    else if (score >= 40) color = '#fbbf24';
    else color = '#f87171';
    pct.style.color = color;
}

// ── Render an answer pair row ────────────────────────────────
export function renderAnswerPair(entry, myName, partnerName, matchClass = '') {
    const { question, myAns, partnerAns } = entry;
    const div = document.createElement('div');
    div.className = `card card-sm mb-16 ${matchClass}`;
    div.style.cssText = 'padding:20px;';
    div.innerHTML = `
    <p class="fw-bold mb-8" style="font-size:0.95rem">${escapeHtml(question?.text || '')}</p>
    <div class="answer-pair">
      <div class="answer-col">
        <div class="answer-col-label">💜 ${escapeHtml(myName || 'أنت')}</div>
        <div class="answer-col-val">${formatAnswer(myAns, question?.type)}</div>
      </div>
      <div class="answer-col">
        <div class="answer-col-label">💗 ${escapeHtml(partnerName || 'الشريك')}</div>
        <div class="answer-col-val">${formatAnswer(partnerAns, question?.type)}</div>
      </div>
    </div>
  `;
    return div;
}

// ── Format answer for display ─────────────────────────────────
function formatAnswer(val, type) {
    if (!val) return '<em style="color:var(--text-faint)">—</em>';
    if (type === 'scale') {
        const hearts = '❤️'.repeat(Number(val)) + '🤍'.repeat(5 - Number(val));
        return `${hearts} (${val}/5)`;
    }
    return escapeHtml(String(val));
}

// ── Compatibility message label ───────────────────────────────
export function compatibilityMessage(score) {
    if (score >= 90) return { emoji: '💘', text: 'توافق مذهل! أنتما مصنوعان لبعض' };
    if (score >= 75) return { emoji: '💜', text: 'توافق رائع! العلاقة واعدة جداً' };
    if (score >= 60) return { emoji: '💛', text: 'توافق جيد! مع الحوار تزدهر العلاقة' };
    if (score >= 45) return { emoji: '🧡', text: 'توافق متوسط! التفاهم يبني الجسور' };
    return { emoji: '💙', text: 'الاختلاف ليس عائقاً، بل فرصة للتعلم' };
}
