
/**
 * 📊 منطق پورتال اعضا (نسخه نهایی)
 */

let supabaseClient = null;
let currentUser = null;

function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function parseAnyDate(str) {
    if (!str) return null;
    const parts = String(str).replace(/-/g, '/').split('/').map(s => parseInt(s.trim(), 10));
    if (parts.length === 3 && !parts.some(isNaN)) {
        const y = parts[0];
        if (y >= 1300 && y <= 1500) {
            return new Date(y + 621, parts[1] - 1, parts[2]);
        }
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

function toShamsi(date) {
    if (!date || isNaN(date.getTime())) return '—';
    let gy = date.getFullYear(), gm = date.getMonth() + 1, gd = date.getDate();
    let g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979; gy -= (gy <= 1600) ? 621 : 1600;
    let gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053); days %= 12053;
    jy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    let jm, jd;
    if (days < 186) { jm = 1 + Math.floor(days / 31); jd = 1 + (days % 31); }
    else { jm = 7 + Math.floor((days - 186) / 30); jd = 1 + ((days - 186) % 30); }
    return toPersianDigits(`${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`);
}

function toPersianDigits(input) {
    const map = {'0':'۰','1':'۱','2':'۲','3':'۳','4':'۴','5':'۵','6':'۶','7':'۷','8':'۸','9':'۹'};
    return String(input).replace(/[0-9]/g, d => map[d]);
}

function formatMoney(amount) {
    if (!amount) return '۰';
    return toPersianDigits(Number(amount).toLocaleString('en-US'));
}

function formatShamsiMonth(month) {
    if (!month) return '—';
    const parts = String(month).split('/');
    if (parts.length !== 2) return month;
    const names = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    return `${names[parseInt(parts[1], 10)] || '?'} ${toPersianDigits(parts[0])}`;
}

document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('pulse_user');
    if (!savedUser) { window.location.href = 'index.html'; return; }

    try {
        currentUser = JSON.parse(savedUser);
    } catch (e) {
        localStorage.removeItem('pulse_user');
        window.location.href = 'index.html';
        return;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    if (localStorage.getItem('pulse_theme') === 'light') document.documentElement.classList.remove('dark');
    else document.documentElement.classList.add('dark');

    renderUserInfo();
    loadData();
    
    if (window.lucide) lucide.createIcons();
});

function renderUserInfo() {
    const s = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    
    s('userName', currentUser.full_name || 'عضو');
    s('userCode', currentUser.member_code || '—');
    s('userAvatar', (currentUser.full_name || 'ع')[0]);
    
    s('cardName', currentUser.full_name || '—');
    s('cardClass', currentUser.class_name || '—');
    s('cardCode', currentUser.member_code || '—');

    if (currentUser.join_date) {
        const d = parseAnyDate(currentUser.join_date);
        if (d) {
            s('cardJoinDate', toShamsi(d));
            const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
            s('memberDays', days.toLocaleString('fa-IR') + ' روز');
        } else {
            s('cardJoinDate', String(currentUser.join_date));
        }
    }
}

function updateSummary(payments, installments, attendances) {
    const unpaid = installments.filter(i => !i.is_paid).length;
    
    const menuBadge = document.getElementById('menuTuitionBadge');
    if (menuBadge) {
        if (unpaid > 0) menuBadge.classList.remove('hidden');
        else menuBadge.classList.add('hidden');
    }

    const now = new Date();
    const thisMonthAtt = attendances.filter(a => {
        const d = parseAnyDate(a.attendance_date);
        return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    const s = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    s('attendanceCount', toPersianDigits(thisMonthAtt));
    s('totalAttendanceCount', toPersianDigits(attendances.length));
}

async function loadData() {
    try {
        const { data, error } = await supabaseClient.rpc('get_member_finance', { p_member_id: currentUser.id });
        if (error) throw error;

        const payments = data?.payments || [];
        const installments = data?.installments || [];
        const attendances = data?.attendances || [];

        updateSummary(payments, installments, attendances);
        renderInstallments(installments);
        renderPayments(payments);
        renderAttendances(attendances);

        loadClassSchedule();
        loadTuitions();
    } catch (err) {
        console.error('Load error:', err);
    }
}

function renderInstallments(items) {
    const el = document.getElementById('installmentsList');
    if (!el) return;

    if (!items || items.length === 0) {
        el.innerHTML = '<div class="p-6 text-center text-sm text-zinc-500">هیچ قسطی ثبت نشده است</div>';
        return;
    }

    el.innerHTML = items.map(item => {
        const dueDate = parseAnyDate(item.due_date);
        const isOverdue = !item.is_paid && dueDate < new Date();
        let badge = item.is_paid ? 'پرداخت شده' : (isOverdue ? 'معوق' : 'در انتظار');
        let badgeClass = item.is_paid ? 'text-emerald-500' : (isOverdue ? 'text-red-500' : 'text-amber-500');

        return `
            <div class="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                <div class="flex flex-col min-w-0">
                    <div class="text-sm font-bold text-white mb-1">قسط ${toShamsi(dueDate)}</div>
                    <div class="text-[11px] text-zinc-400">سررسید: ${toShamsi(dueDate)}</div>
                </div>
                <div class="text-left shrink-0">
                    <div class="text-sm font-bold text-amber-500 font-mono">${formatMoney(item.amount)}</div>
                    <div class="text-[10px] font-bold mt-1 ${badgeClass}">${badge}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderPayments(items) {
    const el = document.getElementById('paymentsList');
    if (!el) return;

    if (!items || items.length === 0) {
        el.innerHTML = '<div class="p-6 text-center text-sm text-zinc-500">هیچ پرداختی ثبت نشده است</div>';
        return;
    }

    el.innerHTML = items.slice(0, 10).map(item => `
        <div class="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
            <div class="flex flex-col min-w-0">
                <div class="text-sm font-bold text-white mb-1">${item.payment_type || 'پرداخت'}</div>
                <div class="text-[11px] text-zinc-400">${item.description || '—'} • ${toShamsi(parseAnyDate(item.payment_date))}</div>
            </div>
            <div class="text-left shrink-0">
                <div class="text-sm font-bold text-emerald-500 font-mono">${formatMoney(item.amount)}</div>
            </div>
        </div>
    `).join('');
}

function renderAttendances(items) {
    const el = document.getElementById('attendanceGrid');
    if (!el) return;

    if (!items || items.length === 0) {
        el.innerHTML = '<div class="col-span-5 p-6 text-center text-sm text-zinc-500 bg-[#121215] border border-zinc-800 rounded-xl">سابقه‌ای ثبت نشده</div>';
        return;
    }

    el.innerHTML = items.slice(0, 30).map(item => {
        const date = parseAnyDate(item.attendance_date);
        const isPresent = item.status === 'present';
        const colorClass = isPresent ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-red-500/10 border-red-500/30 text-red-500';
        return `
            <div class="border rounded-xl p-2 text-center flex flex-col items-center justify-center ${colorClass}">
                <div class="text-[10px] font-bold font-mono">${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')}</div>
                <i data-lucide="${isPresent ? 'check' : 'x'}" class="w-4 h-4 mt-1"></i>
            </div>
        `;
    }).join('');
    if (window.lucide) lucide.createIcons();
}

async function loadTuitions() {
    try {
        const { data, error } = await supabaseClient.rpc('get_member_tuitions', { p_member_id: currentUser.id });
        if (error) throw error;
        renderTuitions(data?.tuitions || []);
    } catch (err) {
        console.error('Tuitions error:', err);
        renderTuitions([]);
    }
}

function renderTuitions(items) {
    renderOverdueBanner(items);
    const el = document.getElementById('tuitionsList');
    const summary = document.getElementById('tuitionSummary');
    if (!el) return;

    if (summary) {
        if (items && items.length > 0) {
            const unpaid = items.filter(t => !t.is_paid);
            const paid = items.filter(t => t.is_paid);
            const uAmount = document.getElementById('tuitionUnpaidAmount');
            const pAmount = document.getElementById('tuitionPaidAmount');
            if (uAmount) uAmount.textContent = formatMoney(unpaid.reduce((s, t) => s + (Number(t.amount) || 0), 0));
            if (pAmount) pAmount.textContent = formatMoney(paid.reduce((s, t) => s + (Number(t.paid_amount) || Number(t.amount) || 0), 0));
            summary.classList.remove('hidden');
            summary.classList.add('grid');
        } else {
            summary.classList.add('hidden');
            summary.classList.remove('grid');
        }
    }

    if (!items || items.length === 0) {
        el.innerHTML = '<div class="p-6 text-center text-sm text-zinc-500">هیچ شهریه‌ای ثبت نشده است</div>';
        return;
    }

    el.innerHTML = [...items].sort((a, b) => a.is_paid ? 1 : -1).map(item => {
        const isOverdue = !item.is_paid && item.due_date && item.due_date < toShamsi(new Date());
        let badge = item.is_paid ? 'پرداخت‌شده' : (isOverdue ? 'معوق' : 'در انتظار');
        let badgeClass = item.is_paid ? 'text-emerald-500' : (isOverdue ? 'text-red-500' : 'text-amber-500');

        return `
            <div class="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                <div class="flex flex-col min-w-0">
                    <div class="text-sm font-bold text-white mb-1">${formatShamsiMonth(item.month)}</div>
                    <div class="text-[11px] text-zinc-400">${item.class_name || '—'} • سررسید: ${item.due_date || '—'}</div>
                </div>
                <div class="text-left shrink-0">
                    <div class="text-sm font-bold text-amber-500 font-mono">${formatMoney(item.amount)}</div>
                    <div class="text-[10px] font-bold mt-1 ${badgeClass}">${badge}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderOverdueBanner(tuitions) {
    const banner = document.getElementById('overdueBanner');
    if (!banner) return;
    const unpaid = (tuitions || []).filter(t => !t.is_paid);

    if (unpaid.length === 0) {
        banner.classList.add('hidden');
        banner.classList.remove('flex');
        return;
    }

    const total = unpaid.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const tEl = document.getElementById('overdueTitle');
    if (tEl) tEl.textContent = unpaid.length === 1 ? 'شهریه‌ی معوق' : `${toPersianDigits(unpaid.length)} شهریه‌ی معوق`;
    const txtEl = document.getElementById('overdueText');
    if (txtEl) txtEl.textContent = `شما ${toPersianDigits(unpaid.length)} شهریه پرداخت‌نشده دارید`;
    const aEl = document.getElementById('overdueAmount');
    if (aEl) aEl.textContent = formatMoney(total) + ' تومان';

    banner.classList.remove('hidden');
    banner.classList.add('flex');
}

async function loadClassSchedule() {
    try {
        if (!currentUser.class_name) return;
        const { data, error } = await supabaseClient.rpc('get_class_schedule', { p_class_name: currentUser.class_name, p_gym_id: currentUser.gym_id || '' });
        if (error) throw error;
        renderClassSchedule(data?.schedules || [], currentUser.class_name);
    } catch (err) {
        console.warn('Schedule error:', err);
    }
}

const DAY_NAMES_FA = { 'saturday': 'شنبه', 'sunday': 'یکشنبه', 'monday': 'دوشنبه', 'tuesday': 'سه‌شنبه', 'wednesday': 'چهارشنبه', 'thursday': 'پنجشنبه', 'friday': 'جمعه' };
const DAY_ORDER = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const PY_WEEKDAY_JS = { 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' };

function renderClassSchedule(schedules, className) {
    const el = document.getElementById('scheduleDays');
    const nameEl = document.getElementById('scheduleClassName');
    if (!el) return;
    if (nameEl) nameEl.textContent = className || '—';

    if (!schedules || schedules.length === 0) {
        el.innerHTML = '<div class="col-span-2 p-4 text-center text-sm text-zinc-500">برنامه‌ای ثبت نشده است</div>';
        return;
    }

    const today = PY_WEEKDAY_JS[new Date().getDay()];
    el.innerHTML = [...schedules].sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)).map(s => {
        const isToday = s.day === today;
        return `
            <div class="border rounded-xl p-3 text-center transition-colors ${isToday ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-800 bg-[#121215]'}">
                <div class="text-sm font-bold ${isToday ? 'text-amber-500' : 'text-white'} mb-1">${DAY_NAMES_FA[s.day] || s.day}</div>
                <div class="text-[11px] text-zinc-400 font-mono" dir="ltr">${s.start_time || '—'} - ${s.end_time || '—'}</div>
            </div>
        `;
    }).join('');
}

// ═══ Navigation (Global Scope) ═══
window.openSection = function(sectionName) {
    document.getElementById('mainMenu')?.classList.add('hidden');
    document.getElementById('backBtnContainer')?.classList.remove('hidden');
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    
    const target = document.getElementById('view-' + sectionName);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('fade-in');
    }
    window.scrollTo(0, 0);
    if(window.lucide) lucide.createIcons();
};

window.closeSection = function() {
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById('backBtnContainer')?.classList.add('hidden');
    document.getElementById('mainMenu')?.classList.remove('hidden');
    document.getElementById('mainMenu')?.classList.add('fade-in');
    window.scrollTo(0, 0);
};

function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('pulse_theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('pulse_theme', 'dark');
    }
}

function logout() {
    if (confirm('از حساب خارج می‌شوید؟')) {
        localStorage.removeItem('pulse_user');
        window.location.href = 'index.html';
    }
}

function contactSupport() {
    window.open(RUBIKA_URL, '_blank');
}

// ═══ Chat Logic ═══
let currentChatRoomId = null;
let chatRefreshTimer = null;

function openFullChat() {
    const fs = document.getElementById('chatFullScreen');
    if (fs) { fs.classList.remove('hidden'); fs.classList.add('flex'); }
    loadMemberChatRooms();
}

function closeFullChat() {
    const fs = document.getElementById('chatFullScreen');
    if (fs) { fs.classList.add('hidden'); fs.classList.remove('flex'); }
    stopChatRefresh();
    currentChatRoomId = null;
    
    const list = document.getElementById('chatFsRoomList');
    const conv = document.getElementById('chatFsConversation');
    if(list) list.classList.remove('hidden');
    if(conv) conv.classList.add('hidden');
}

async function loadMemberChatRooms() {
    const list = document.getElementById('chatFsRoomList');
    if (!list) return;
    list.innerHTML = '<div class="text-center py-10 text-zinc-500 text-sm">در حال بارگذاری...</div>';

    try {
        const { data, error } = await supabaseClient.rpc('member_get_chat_rooms', { p_member_id: currentUser.id });
        if (error || !data?.success) throw error;
        
        const rooms = data.rooms || [];
        if (rooms.length === 0) {
            list.innerHTML = '<div class="text-center py-10 text-zinc-500 text-sm">هیچ گفت‌وگویی وجود ندارد</div>';
            return;
        }

        list.innerHTML = rooms.map(r => {
            const isPublic = r.room_type === 'public';
            const name = isPublic ? 'گروه عمومی' : 'گفت‌وگو با مدیر';
            return `
                <div class="flex items-center gap-3 p-3 bg-[#121215] border border-zinc-800 rounded-xl cursor-pointer hover:border-amber-500 transition-colors" onclick="openMemberChatRoom('${r.room_id}', '${name}')">
                    <div class="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                        <i data-lucide="${isPublic ? 'globe' : 'user'}" class="w-5 h-5"></i>
                    </div>
                    <div class="flex-1 min-w-0 text-right">
                        <div class="text-sm font-bold text-white truncate">${name}</div>
                        <div class="text-xs text-zinc-400 truncate mt-1">${r.last_message || 'شروع گفتگو'}</div>
                    </div>
                    ${r.unread > 0 ? `<div class="bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full">${r.unread}</div>` : ''}
                </div>
            `;
        }).join('');
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        list.innerHTML = '<div class="text-center py-10 text-red-500 text-sm">خطا در بارگذاری</div>';
    }
}

async function openMemberChatRoom(roomId, roomName) {
    currentChatRoomId = roomId;
    document.getElementById('chatFsRoomList')?.classList.add('hidden');
    document.getElementById('chatFsConversation')?.classList.remove('hidden');
    document.getElementById('chatFsConversation')?.classList.add('flex');
    document.getElementById('chatFsTitle').textContent = roomName;

    try { await supabaseClient.rpc('member_mark_chat_read', { p_member_id: currentUser.id, p_room_id: roomId }); } catch(e){}
    await loadMemberChatMessages();
    startChatRefresh();
}

async function loadMemberChatMessages() {
    if (!currentChatRoomId) return;
    const list = document.getElementById('chatFsMessages');
    if (!list) return;

    try {
        const { data, error } = await supabaseClient.rpc('member_get_chat_messages', { p_member_id: currentUser.id, p_room_id: currentChatRoomId, p_limit: 100 });
        if (error || !data?.success) return;
        
        const messages = (data.messages || []).reverse();
        if (messages.length === 0) {
            list.innerHTML = '<div class="text-center py-10 text-zinc-500 text-sm">هنوز پیامی وجود ندارد</div>';
            return;
        }

        const wasAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 150;
        
        list.innerHTML = messages.map(m => {
            const isMe = m.sender_type === 'member';
            return `
                <div class="flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}">
                    <span class="text-[10px] text-zinc-500 mb-1 mx-1">${isMe ? 'من' : 'مدیر'}</span>
                    <div class="px-4 py-2 text-sm leading-relaxed ${isMe ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl rounded-tr-sm' : 'bg-zinc-800 text-zinc-200 rounded-2xl rounded-tl-sm'}">
                        ${escapeHtml(m.content)}
                    </div>
                </div>
            `;
        }).join('');

        if (wasAtBottom) setTimeout(() => { list.scrollTop = list.scrollHeight; }, 50);
    } catch (err) { console.error(err); }
}

async function sendMemberChatMessage() {
    if (!currentChatRoomId) return;
    const input = document.getElementById('chatFsInput');
    const btn = document.getElementById('chatFsSend');
    const content = input?.value.trim();
    if (!content) return;

    if (btn) btn.disabled = true;
    try {
        await supabaseClient.rpc('member_send_chat_message', { p_member_id: currentUser.id, p_room_id: currentChatRoomId, p_content: content });
        input.value = '';
        await loadMemberChatMessages();
        const list = document.getElementById('chatFsMessages');
        if (list) setTimeout(() => { list.scrollTop = list.scrollHeight; }, 50);
    } catch (err) { console.error(err); } finally {
        if (btn) btn.disabled = false;
    }
}

function startChatRefresh() {
    stopChatRefresh();
    chatRefreshTimer = setInterval(loadMemberChatMessages, 3000);
}
function stopChatRefresh() {
    if (chatRefreshTimer) { clearInterval(chatRefreshTimer); chatRefreshTimer = null; }
}

document.addEventListener('DOMContentLoaded', () => {
    const inp = document.getElementById('chatFsInput');
    if (inp) {
        inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !/Android|iPhone|iPad/i.test(navigator.userAgent)) {
                e.preventDefault();
                sendMemberChatMessage();
            }
        });
    }
});
