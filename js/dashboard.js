/**
 * 📊 منطق داشبورد
 */

let supabaseClient = null;
let currentUser = null;

// ============================================================
// راه‌اندازی
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // چک لاگین
    const savedUser = localStorage.getItem('pulse_user');
    if (!savedUser) {
        window.location.href = 'index.html';
        return;
    }

    try {
        currentUser = JSON.parse(savedUser);
    } catch (e) {
        localStorage.removeItem('pulse_user');
        window.location.href = 'index.html';
        return;
    }

    // راه‌اندازی Supabase
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // راه‌اندازی تم
    initTheme();

    // نسخه
    document.getElementById('version').textContent = APP_VERSION;

    // نمایش اطلاعات
    renderUserInfo();

    // بارگذاری داده‌ها
    loadData();
});

// ============================================================
// نمایش اطلاعات کاربر
// ============================================================
function renderUserInfo() {
    document.getElementById('userName').textContent = currentUser.full_name || 'عضو';
    document.getElementById('userCode').textContent = currentUser.member_code || '—';
    document.getElementById('userAvatar').textContent = (currentUser.full_name || 'ع')[0];

    // کارت عضویت
    document.getElementById('cardName').textContent = currentUser.full_name || '—';
    document.getElementById('cardClass').textContent = currentUser.class_name || '—';
    document.getElementById('cardCode').textContent = currentUser.member_code || '—';

    // تاریخ عضویت
    if (currentUser.join_date) {
        const joinDate = new Date(currentUser.join_date);
        document.getElementById('cardJoinDate').textContent = formatDate(joinDate);

        // روزهای عضویت
        const days = Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
        document.getElementById('memberDays').textContent = days + ' روز';
    } else {
        document.getElementById('cardJoinDate').textContent = '—';
        document.getElementById('memberDays').textContent = '—';
    }
}

// ============================================================
// بارگذاری داده‌ها
// ============================================================
async function loadData() {
    try {
        const { data, error } = await supabaseClient.rpc('get_member_finance', {
            p_member_id: currentUser.id
        });

        if (error) {
            console.error('Load error:', error);
            showEmptyStates('خطا در بارگذاری اطلاعات');
            return;
        }

        const payments = data?.payments || [];
        const installments = data?.installments || [];
        const attendances = data?.attendances || [];

        renderInstallments(installments);
        renderPayments(payments);
        renderAttendances(attendances);

        // خلاصه‌ها
        updateSummary(payments, installments, attendances);

    } catch (err) {
        console.error('Load exception:', err);
        showEmptyStates('خطا در بارگذاری اطلاعات');
    }
}

// ============================================================
// خلاصه‌ها
// ============================================================
function updateSummary(payments, installments, attendances) {
    // اقساط پرداخت‌نشده
    const unpaid = installments.filter(i => !i.is_paid).length;
    document.getElementById('unpaidCount').textContent = unpaid;

    // حضور این ماه
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const thisMonthAttendance = attendances.filter(a => {
        const d = new Date(a.attendance_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;
    
    document.getElementById('attendanceCount').textContent = thisMonthAttendance;
}

// ============================================================
// رندر اقساط
// ============================================================
function renderInstallments(items) {
    const container = document.getElementById('installmentsList');

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✅</div>
                <div class="empty-text">هیچ قسطی برای شما ثبت نشده است</div>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => {
        const dueDate = new Date(item.due_date);
        const isOverdue = !item.is_paid && dueDate < new Date();

        let badge = '';
        let badgeClass = '';

        if (item.is_paid) {
            badge = '✅ پرداخت شده';
            badgeClass = 'badge-success';
        } else if (isOverdue) {
            badge = '⚠️ معوق';
            badgeClass = 'badge-danger';
        } else {
            badge = '⏳ در انتظار';
            badgeClass = 'badge-warning';
        }

        return `
            <div class="list-item">
                <div class="list-item-left">
                    <div class="list-item-title">قسط ${formatDate(dueDate)}</div>
                    <div class="list-item-subtitle">سررسید: ${formatDate(dueDate)}</div>
                </div>
                <div class="list-item-right">
                    <div class="list-item-amount">${formatMoney(item.amount)}</div>
                    <div class="list-item-badge ${badgeClass}">${badge}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================
// رندر پرداخت‌ها
// ============================================================
function renderPayments(items) {
    const container = document.getElementById('paymentsList');

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <div class="empty-text">هیچ پرداختی ثبت نشده است</div>
            </div>
        `;
        return;
    }

    container.innerHTML = items.slice(0, 10).map(item => {
        const payDate = new Date(item.payment_date);
        return `
            <div class="list-item">
                <div class="list-item-left">
                    <div class="list-item-title">${item.payment_type || 'پرداخت'}</div>
                    <div class="list-item-subtitle">${item.description || '—'} • ${formatDate(payDate)}</div>
                </div>
                <div class="list-item-right">
                    <div class="list-item-amount">${formatMoney(item.amount)}</div>
                    <div class="list-item-badge badge-success">✅ موفق</div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================
// رندر حضور و غیاب
// ============================================================
function renderAttendances(items) {
    const container = document.getElementById('attendanceGrid');

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-icon">📭</div>
                <div class="empty-text">سابقه‌ی حضوری ثبت نشده است</div>
            </div>
        `;
        return;
    }

    container.innerHTML = items.slice(0, 30).map(item => {
        const date = new Date(item.attendance_date);
        const isPresent = item.status === 'present';
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');

        return `
            <div class="attendance-day ${isPresent ? 'present' : 'absent'}">
                <div class="attendance-day-date">${month}/${day}</div>
                <div class="attendance-day-status">${isPresent ? '✅' : '❌'}</div>
            </div>
        `;
    }).join('');
}

// ============================================================
// Empty states
// ============================================================
function showEmptyStates(message) {
    const html = `
        <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <div class="empty-text">${message}</div>
        </div>
    `;
    document.getElementById('installmentsList').innerHTML = html;
    document.getElementById('paymentsList').innerHTML = html;
    document.getElementById('attendanceGrid').innerHTML = html;
}

// ============================================================
// Helper: تاریخ
// ============================================================
function formatDate(date) {
    if (!date || isNaN(date.getTime())) return '—';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
}

function formatMoney(amount) {
    if (!amount) return '۰';
    return Number(amount).toLocaleString('fa-IR');
}

// ============================================================
// Theme
// ============================================================
function initTheme() {
    const saved = localStorage.getItem('pulse_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('pulse_theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    document.getElementById('themeBtn').textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ============================================================
// Logout
// ============================================================
function logout() {
    if (confirm('آیا از خروج مطمئن هستید؟')) {
        localStorage.removeItem('pulse_user');
        window.location.href = 'index.html';
    }
}

// ============================================================
// Support
// ============================================================
function contactSupport() {
    const msg = `سلام 👋\nمن ${currentUser.full_name} هستم.\nکد عضویت: ${currentUser.member_code}\n\nنیاز به کمک دارم.`;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(msg).catch(() => {});
    }
    
    window.open(RUBIKA_URL, '_blank');
}
