// ============================================================
// HeartSync — Admin Module
// Questions CRUD, stats, user & room management
// ============================================================
import supabase from './supabase.js';
import { showToast } from './auth.js';
import { escapeHtml } from './questions.js';
import { statusLabel, statusBadgeClass } from './rooms.js';

// ==============================
// QUESTIONS CRUD
// ==============================

export async function getAllQuestions() {
    const { data, error } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function saveQuestion(q) {
    // q: { id?, text, type, options, weight, active }
    let options = null;
    if (q.type === 'multiple_choice' && q.options) {
        if (typeof q.options === 'string') {
            options = q.options.split('\n').map(s => s.trim()).filter(Boolean);
        } else {
            options = q.options;
        }
    }
    const payload = { text: q.text, type: q.type, options, weight: Number(q.weight), active: q.active };
    if (q.id) {
        const { error } = await supabase.from('questions').update(payload).eq('id', q.id);
        if (error) throw error;
    } else {
        const { error } = await supabase.from('questions').insert(payload);
        if (error) throw error;
    }
}

export async function deleteQuestion(id) {
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) throw error;
}

export async function toggleQuestion(id, active) {
    const { error } = await supabase.from('questions').update({ active }).eq('id', id);
    if (error) throw error;
}

// ==============================
// USERS
// ==============================

export async function getAllUsers() {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function setUserRole(userId, role) {
    const { error } = await supabase
        .from('users')
        .update({ role })
        .eq('id', userId);
    if (error) throw error;
}

// ==============================
// ROOMS (admin view)
// ==============================

export async function getAllRooms() {
    const { data, error } = await supabase
        .from('rooms')
        .select(`*, creator:created_by(name), partner:partner_id(name)`)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function deleteRoom(id) {
    const { error } = await supabase.from('rooms').delete().eq('id', id);
    if (error) throw error;
}

// ==============================
// STATISTICS
// ==============================

export async function getStats() {
    const { data: rooms } = await supabase
        .from('rooms')
        .select('compatibility_score, status');

    const completed = (rooms || []).filter(r => r.status === 'completed' && r.compatibility_score != null);
    const avgScore = completed.length
        ? (completed.reduce((s, r) => s + Number(r.compatibility_score), 0) / completed.length).toFixed(1)
        : '—';

    const { count: totalUsers } = await supabase
        .from('users').select('id', { count: 'exact', head: true });

    const { count: totalRooms } = await supabase
        .from('rooms').select('id', { count: 'exact', head: true });

    const { count: completedRooms } = await supabase
        .from('rooms').select('id', { count: 'exact', head: true }).eq('status', 'completed');

    // Most matched / mismatched question
    const { data: answers } = await supabase
        .from('answers')
        .select('question_id, answer_value, room_id, user_id')
        .limit(2000);

    let mostMatched = '—', mostMismatched = '—';

    if (answers) {
        // Group answers by room → question
        const byRoomQ = {};
        for (const a of answers) {
            const key = `${a.room_id}__${a.question_id}`;
            if (!byRoomQ[key]) byRoomQ[key] = [];
            byRoomQ[key].push(a.answer_value);
        }
        const qMatchCount = {}, qMismatchCount = {};
        for (const [key, vals] of Object.entries(byRoomQ)) {
            if (vals.length < 2) continue;
            const qid = key.split('__')[1];
            const match = vals[0]?.toLowerCase().trim() === vals[1]?.toLowerCase().trim();
            if (match) qMatchCount[qid] = (qMatchCount[qid] || 0) + 1;
            else qMismatchCount[qid] = (qMismatchCount[qid] || 0) + 1;
        }

        const topMatchId = Object.entries(qMatchCount).sort((a, b) => b[1] - a[1])[0]?.[0];
        const topMismatchId = Object.entries(qMismatchCount).sort((a, b) => b[1] - a[1])[0]?.[0];

        if (topMatchId) {
            const { data: q } = await supabase.from('questions').select('text').eq('id', topMatchId).single();
            if (q) mostMatched = q.text;
        }
        if (topMismatchId) {
            const { data: q } = await supabase.from('questions').select('text').eq('id', topMismatchId).single();
            if (q) mostMismatched = q.text;
        }
    }

    return { avgScore, totalUsers, totalRooms, completedRooms, mostMatched, mostMismatched };
}

// ==============================
// RENDER HELPERS
// ==============================

export function renderQuestionsTable(questions, container, onEdit, onDelete, onToggle) {
    if (!questions.length) {
        container.innerHTML = '<p class="text-muted text-center" style="padding:40px">لا توجد أسئلة بعد</p>';
        return;
    }
    const typeLabel = { text: 'نصي', multiple_choice: 'متعدد', scale: 'مقياس' };
    container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>السؤال</th><th>النوع</th><th>الوزن</th><th>الحالة</th><th>الإجراءات</th>
        </tr></thead>
        <tbody>
          ${questions.map(q => `
            <tr data-id="${q.id}">
              <td style="max-width:320px;word-break:break-word">${escapeHtml(q.text)}</td>
              <td><span class="badge badge-active">${typeLabel[q.type] || q.type}</span></td>
              <td>${q.weight}</td>
              <td>
                <label class="toggle-switch" title="تفعيل/إيقاف">
                  <input type="checkbox" class="toggle-active" data-id="${q.id}" ${q.active ? 'checked' : ''}>
                  <span class="toggle-label">${q.active ? 'نشط' : 'موقوف'}</span>
                </label>
              </td>
              <td>
                <div class="flex gap-8">
                  <button class="btn btn-sm btn-outline edit-btn" data-id="${q.id}">تعديل</button>
                  <button class="btn btn-sm btn-danger delete-btn" data-id="${q.id}">حذف</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

    container.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const q = questions.find(x => x.id === btn.dataset.id);
            if (q) onEdit(q);
        });
    });
    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => onDelete(btn.dataset.id));
    });
    container.querySelectorAll('.toggle-active').forEach(cb => {
        cb.addEventListener('change', () => onToggle(cb.dataset.id, cb.checked));
    });
}

export function renderUsersTable(users, container, onRoleChange) {
    if (!users.length) {
        container.innerHTML = '<p class="text-muted text-center" style="padding:40px">لا يوجد مستخدمون</p>';
        return;
    }
    container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>الاسم</th><th>البريد الإلكتروني</th><th>الدور</th><th>تاريخ الانضمام</th><th>الإجراءات</th>
        </tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>
                <div class="flex items-center gap-8">
                  ${u.avatar_url ? `<img src="${escapeHtml(u.avatar_url)}" style="width:30px;height:30px;border-radius:50%;object-fit:cover">` : ''}
                  ${escapeHtml(u.name || '—')}
                </div>
              </td>
              <td style="direction:ltr;text-align:right">${escapeHtml(u.email || '—')}</td>
              <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-active'}">${u.role === 'admin' ? 'مدير' : 'مستخدم'}</span></td>
              <td>${new Date(u.created_at).toLocaleDateString('ar-SA')}</td>
              <td>
                <button class="btn btn-sm btn-outline role-btn" data-id="${u.id}" data-role="${u.role}">
                  ${u.role === 'admin' ? 'إلغاء الإدارة' : 'جعله مديراً'}
                </button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

    container.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const newRole = btn.dataset.role === 'admin' ? 'user' : 'admin';
            onRoleChange(btn.dataset.id, newRole);
        });
    });
}

export function renderRoomsTable(rooms, container, onDelete) {
    if (!rooms.length) {
        container.innerHTML = '<p class="text-muted text-center" style="padding:40px">لا توجد غرف</p>';
        return;
    }
    const statusMap = { waiting: 'في الانتظار', active: 'نشطة', completed: 'مكتملة' };
    const badgeMap = { waiting: 'badge-waiting', active: 'badge-active', completed: 'badge-completed' };
    container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>المنشئ</th><th>الشريك</th><th>الحالة</th><th>نسبة التوافق</th><th>التاريخ</th><th>حذف</th>
        </tr></thead>
        <tbody>
          ${rooms.map(r => `
            <tr>
              <td>${escapeHtml(r.creator?.name || '—')}</td>
              <td>${escapeHtml(r.partner?.name || 'لم ينضم بعد')}</td>
              <td><span class="badge ${badgeMap[r.status] || ''}">${statusMap[r.status] || r.status}</span></td>
              <td>${r.compatibility_score != null ? r.compatibility_score + '٪' : '—'}</td>
              <td>${new Date(r.created_at).toLocaleDateString('ar-SA')}</td>
              <td><button class="btn btn-sm btn-danger del-room-btn" data-id="${r.id}">حذف</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

    container.querySelectorAll('.del-room-btn').forEach(btn => {
        btn.addEventListener('click', () => onDelete(btn.dataset.id));
    });
}
