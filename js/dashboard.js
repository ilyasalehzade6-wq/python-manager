
let supabaseClient = null;
let currentUser = null;

function parseAnyDate(str) {
    if (!str) return null;
    const parts = String(str).replace(/-/g, '/').split('/').map(s => parseInt(s.trim(), 10));
    if (parts.length === 3 && !parts.some(isNaN)) {
        const y = parts[0];
        if (y >= 1300 && y <= 1500) return new Date(y + 621, parts[1] - 1, parts[2]);
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
    return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`.replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

function toPersianDigits(input) {
    const map = {'0':'۰','1':'۱','2':'۲','3':'۳','4':'۴','5':'۵','6':'۶','7':'۷','8':'۸','9':'۹'};
    return String(input).replace(/[0-9]/g, d => map[d]);
}

function formatMoney(amount) {
    if (!amount) return '۰';
    return toPersianDigits(Number(amount).toLocaleString('en-US'));
}

document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('pulse_user');
    if (!savedUser) { window.location.href = 'index.html'; return; }
    
    try { currentUser = JSON.parse(savedUser); } catch (e) { window.location.href = 'index.html'; return; }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Theme Logic (بدون updateThemeIcon)
    if (localStorage.getItem('pulse_theme') === 'light') document.documentElement.classList.remove('dark');
    else document.documentElement.classList.add('dark');

    // Render User Data
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
            s('memberDays', Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))).toLocaleString('fa-IR') + ' روز');
        }
    }

    // Load Finance Data
    supabaseClient.rpc('get_member_finance', { p_member_id: currentUser.id }).then(({data}) => {
        if (!data) return;
        const installments = data.installments || [];
        const payments = data.payments || [];
        const attendances = data.attendances || [];
        
        // Update Summary
        const unpaid = installments.filter(i => !i.is_paid).length;
        const menuBadge = document.getElementById('menuTuitionBadge');
        if (menuBadge) { if (unpaid > 0) menuBadge.classList.remove('hidden'); else menuBadge.classList.add('hidden'); }
        
        s('attendanceCount', toPersianDigits(attendances.length));
        s('totalAttendanceCount', toPersianDigits(attendances.length));

        // Render Lists
        const instEl = document.getElementById('installmentsList');
        if (instEl && installments.length > 0) {
            instEl.innerHTML = installments.map(i => `
                <div class="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                    <div class="flex flex-col min-w-0">
                        <div class="text-sm font-bold text-white mb-1">قسط ${toShamsi(parseAnyDate(i.due_date))}</div>
                    </div>
                    <div class="text-left shrink-0"><div class="text-sm font-bold text-amber-500 font-mono">${formatMoney(i.amount)}</div></div>
                </div>
            `).join('');
        }
    });

    // Load Tuitions
    supabaseClient.rpc('get_member_tuitions', { p_member_id: currentUser.id }).then(({data}) => {
        if (!data) return;
        const tuitions = data.tuitions || [];
        const el = document.getElementById('tuitionsList');
        if (el && tuitions.length > 0) {
            el.innerHTML = tuitions.map(t => `
                <div class="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                    <div class="flex flex-col min-w-0"><div class="text-sm font-bold text-white mb-1">${t.month}</div></div>
                    <div class="text-left shrink-0"><div class="text-sm font-bold text-amber-500 font-mono">${formatMoney(t.amount)}</div></div>
                </div>
            `).join('');
        }
    });

    if (window.lucide) lucide.createIcons();
});

// Navigation Functions (Global)
window.openSection = function(sectionName) {
    document.getElementById('mainMenu')?.classList.add('hidden');
    document.getElementById('backBtnContainer')?.classList.remove('hidden');
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('view-' + sectionName);
    if (target) { target.classList.remove('hidden'); target.classList.add('fade-in'); }
    window.scrollTo(0, 0);
};

window.closeSection = function() {
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById('backBtnContainer')?.classList.add('hidden');
    document.getElementById('mainMenu')?.classList.remove('hidden');
    document.getElementById('mainMenu')?.classList.add('fade-in');
    window.scrollTo(0, 0);
};

window.toggleTheme = function() {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) { document.documentElement.classList.remove('dark'); localStorage.setItem('pulse_theme', 'light'); }
    else { document.documentElement.classList.add('dark'); localStorage.setItem('pulse_theme', 'dark'); }
};

window.logout = function() {
    if (confirm('از حساب خارج می‌شوید؟')) { localStorage.removeItem('pulse_user'); window.location.href = 'index.html'; }
};

window.contactSupport = function() {
    window.open(RUBIKA_URL, '_blank');
};

// Chat Dummy Functions (برای جلوگیری از خطا)
window.openFullChat = function() { document.getElementById('chatFullScreen')?.classList.remove('hidden'); };
window.closeFullChat = function() { document.getElementById('chatFullScreen')?.classList.add('hidden'); };
window.sendMemberChatMessage = function() {};
