// ============================================================
// HeartSync — Questions Module
// Fetch and render question cards by type
// ============================================================
import supabase from './supabase.js';

// ── Fetch active questions ───────────────────────────────────
export async function getActiveQuestions() {
    const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
}

// ── Render a single question card ───────────────────────────
export function renderQuestion(question, index, total, container) {
    container.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'card question-card-enter';
    card.innerHTML = `
    <div class="progress-wrap">
      <div class="progress-labels">
        <span>السؤال ${index + 1} من ${total}</span>
        <span>${Math.round(((index) / total) * 100)}٪</span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width:${(index / total) * 100}%"></div>
      </div>
    </div>
    <h3 class="mb-24" style="font-size:1.2rem;font-weight:700;line-height:1.5">
      ${escapeHtml(question.text)}
    </h3>
    <div id="answer-input"></div>
  `;
    container.appendChild(card);

    const answerInput = card.querySelector('#answer-input');

    if (question.type === 'scale') {
        renderScale(answerInput);
    } else if (question.type === 'multiple_choice' && question.options) {
        const opts = typeof question.options === 'string'
            ? JSON.parse(question.options)
            : question.options;
        renderMultipleChoice(answerInput, opts);
    } else {
        renderText(answerInput);
    }

    // Next button
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-block mt-24';
    btn.id = 'next-btn';
    btn.disabled = true;
    btn.textContent = index === total - 1 ? 'إنهاء الإجابات ✓' : 'السؤال التالي ←';
    card.appendChild(btn);

    // Enable next when answered
    answerInput.addEventListener('answer-selected', () => { btn.disabled = false; });

    return btn;
}

// ── Sub-renderers ────────────────────────────────────────────
function renderText(container) {
    const ta = document.createElement('textarea');
    ta.className = 'form-control';
    ta.placeholder = 'اكتب إجابتك هنا...';
    ta.rows = 4;
    container.appendChild(ta);
    ta.addEventListener('input', () => {
        if (ta.value.trim().length > 0) {
            container.dispatchEvent(new CustomEvent('answer-selected'));
        }
    });
    container.getValue = () => ta.value.trim();
}

function renderMultipleChoice(container, options) {
    const grid = document.createElement('div');
    grid.className = 'options-grid';
    let selected = null;
    options.forEach((opt, i) => {
        const card = document.createElement('div');
        card.className = 'option-card';
        card.textContent = opt;
        card.dataset.value = opt;
        card.addEventListener('click', () => {
            grid.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selected = opt;
            container.dispatchEvent(new CustomEvent('answer-selected'));
        });
        grid.appendChild(card);
    });
    container.appendChild(grid);
    container.getValue = () => selected;
}

function renderScale(container) {
    const row = document.createElement('div');
    row.className = 'scale-row';
    let selected = null;

    const labels = ['😞', '😕', '😐', '😊', '😍'];
    for (let i = 1; i <= 5; i++) {
        const btn = document.createElement('div');
        btn.className = 'scale-btn';
        btn.innerHTML = `<div style="font-size:1.4rem">${labels[i - 1]}</div><div style="font-size:0.7rem;margin-top:2px">${i}</div>`;
        btn.addEventListener('click', () => {
            row.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selected = String(i);
            container.dispatchEvent(new CustomEvent('answer-selected'));
        });
        row.appendChild(btn);
    }

    const hint = document.createElement('p');
    hint.className = 'text-center text-sm text-muted mt-16';
    hint.textContent = '١ = أقل درجة  |  ٥ = أعلى درجة';

    container.appendChild(row);
    container.appendChild(hint);
    container.getValue = () => selected;
}

// ── Utility ─────────────────────────────────────────────────
export function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}
