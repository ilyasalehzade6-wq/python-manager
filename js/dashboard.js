/**
 * 📊 منطق داشبورد
 */

let supabaseClient = null;
let currentUser = null;

// ═══════════════════════════════════════════════════════════
//  🔤 تبدیل تاریخ شمسی به میلادی
// ═══════════════════════════════════════════════════════════
function shamsiToGregorian(shamsiStr) {
    if (!shamsiStr) return null;
    const parts = String(shamsiStr).replace(/-/g, '/').split('/').map(s => parseInt(s.trim(), 10));
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    const [jy, jm, jd] = parts;

    let gy, gm, gd;
    const jy2 = jy - 979, jm2 = jm - 1, jd2 = jd - 1;

    let jDayNo = 365 * jy2 + Math.floor(jy2 / 33) * 8 + Math.floor((jy2 % 33 + 3) / 4);
    const mArr = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
    for (let i = 0; i < jm2; i++) jDayNo += mArr[i];
    jDayNo += jd2;

    let gDayNo = jDayNo + 79;
    gy = 1600 + 400 * Math.floor(gDayNo / 146097);
    gDayNo %= 146097;

    let leap = true;
    if (gDayNo >= 36525) {
        gDayNo--;
        gy += 100 * Math.floor(gDayNo / 36524);
        gDayNo %= 36524;
        if (gDayNo >= 365) gDayNo++;
        else leap = false;
    }
    gy += 4 * Math.floor(gDayNo / 1461);
    gDayNo %= 1461;
    if (gDayNo >= 366) {
        leap = false;
        gDayNo--;
        gy += Math.floor(gDayNo / 365);
        gDayNo %= 365;
    }
    const gMonths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (let i = 0; i < 12; i++) {
        if (gDayNo < gMonths[i]) { gm = i + 1; gd = gDayNo + 1; break; }
        gDayNo -= gMonths[i];
    }
    return new Date(gy, gm - 1, gd);
}

function parseAnyDate(str) {
    if (!str) return null;
    const parts = String(str).replace(/-/g, '/').split('/').map(s => parseInt(s.trim(), 10));
    if (parts.length === 3 && !parts.some(isNaN)) {
        const y = parts[0];
        if (y >= 1300 && y <= 1500) return shamsiToGregorian(str);
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

function toShamsi(date) {
    if (!date || isNaN(date.getTime())) return '—';
    let gy = date.getFullYear();
    const gm = date.getMonth() + 1;
    const gd = date.getDate();
    let g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    let gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    let jm, jd;
    if (days < 186) { jm = 1 + Math.floor(days / 31); jd = 1 + (days % 31); }
    else { jm = 7 + Math.floor((days - 186) / 30); jd = 1 + ((days - 186) % 30); }
    const result = `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
    // 🔤 تبدیل به اعداد فارسی
    return result.replace(/[0-9]/g, d => {
        const map = {'0':'۰','1':'۱','2':'۲','3':'۳','4':'۴',
                     '5':'۵','6':'۶','7':'۷','8':'۸','9':'۹'};
        return map[d];
    });
}
// ═══════════════════════════════════════════════════════════

// 🔤 نسخه‌ی محلی toShamsiDisplay (بدون وابستگی به license-utils)
function toShamsiDisplay(dateInput) {
    if (!dateInput) return '—';

    // اگه از قبل شمسی هست
    if (typeof dateInput === 'string') {
        const m = dateInput.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
        if (m) {
            const year = parseInt(m[1]);
            if (year >= 1300 && year <= 1500) {
                return `${m[1]}/${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}`;
            }
        }
    }

    // تبدیل میلادی به شمسی
    const parsed = parseAnyDate(dateInput);
    if (!parsed) return String(dateInput);

    return toShamsi(parsed);
}


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
    // ─── هدر ───
    document.getElementById('userName').textContent = currentUser.full_name || 'عضو';
    document.getElementById('userCode').textContent = currentUser.member_code || '—';
    document.getElementById('userAvatar').textContent = (currentUser.full_name || 'ع')[0];

    // ─── کارت عضویت ───
    document.getElementById('cardName').textContent = currentUser.full_name || '—';
    document.getElementById('cardClass').textContent = currentUser.class_name || '—';
    document.getElementById('cardCode').textContent = currentUser.member_code || '—';

    // ─── تاریخ عضویت ───
    const rawJoinDate = currentUser.join_date;
    console.log('📅 join_date خام:', rawJoinDate);

    if (rawJoinDate) {
        // 🔤 پشتیبانی از فرمت‌های مختلف: 1405/07/16 یا 1405-07-16 یا ISO
        const joinDate = parseAnyDate(rawJoinDate);
        console.log('📅 join_date پارس شده:', joinDate);

        if (joinDate) {
            // نمایش تاریخ به شمسی
            const shamsiStr = toShamsi(joinDate);
            document.getElementById('cardJoinDate').textContent =
                shamsiStr !== '—' ? shamsiStr : String(rawJoinDate);

            // روزهای عضویت
            const diffMs = Date.now() - joinDate.getTime();
            const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
            document.getElementById('memberDays').textContent =
                days.toLocaleString('fa-IR') + ' روز';
            console.log('📅 روزهای عضویت:', days);
        } else {
            // fallback: نمایش مستقیم
            document.getElementById('cardJoinDate').textContent = String(rawJoinDate);
            document.getElementById('memberDays').textContent = '—';
        }
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

        console.log('📥 RPC response:', data);

        const payments = data?.payments || [];
        const installments = data?.installments || [];
        const attendances = data?.attendances || [];

        console.log(`📊 دریافت شد: ${payments.length} پرداخت، ${installments.length} قسط، ${attendances.length} حضور`);

        // ─── بارگذاری اعلان‌ها ───
        try {
            const { data: notifsData, error: notifsError } = await supabaseClient.rpc(
                'get_member_notifications',
                { p_member_id: currentUser.id }
            );

            if (notifsError) {
                console.warn('notifications error:', notifsError);
                renderNotifications([], 0);
            } else {
                const notifications = notifsData?.notifications || [];
                const unread = notifsData?.unread_count || 0;
                console.log(`🔔 ${notifications.length} اعلان (${unread} نخوانده)`);
                renderNotifications(notifications, unread);
            }
        } catch (err) {
            console.warn('notifications load exception:', err);
            renderNotifications([], 0);
        }

        // ─── بارگذاری شهریه‌ها (RPC جداگانه) ───
        try {
            const { data: tuitionsData, error: tuitionsError } = await supabaseClient.rpc(
                'get_member_tuitions',
                { p_member_id: currentUser.id }
            );

            if (tuitionsError) {
                console.warn('tuitions error:', tuitionsError);
                renderTuitions([]);
            } else {
                const tuitions = tuitionsData?.tuitions || [];
                console.log(`💰 ${tuitions.length} شهریه دریافت شد`);
                renderTuitions(tuitions);
            }
        } catch (err) {
            console.warn('tuitions load exception:', err);
            renderTuitions([]);
        }

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
        const d = parseAnyDate(a.attendance_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;
    
    document.getElementById('attendanceCount').textContent = thisMonthAttendance;
}



// ═══════════════════════════════════════════════════════
//  🔔 رندر اعلان‌ها
// ═══════════════════════════════════════════════════════
function renderNotifications(notifications, unreadCount) {
    const container = document.getElementById('notificationsList');
    const badge = document.getElementById('notifBadge');
    const markAllBtn = document.getElementById('markAllBtn');

    if (!container) return;

    // ─── بج ───
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = toPersianDigits(unreadCount);
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    // ─── دکمه خواندن همه ───
    if (markAllBtn) {
        markAllBtn.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }

    // ─── لیست ───
    if (!notifications || notifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔔</div>
                <div class="empty-text">هیچ اعلانی برای شما وجود ندارد</div>
            </div>
        `;
        return;
    }

    container.innerHTML = notifications.map(n => {
        const borderColor = n.color || '#3498db';
        const isUnread = !n.is_read;

        return `
            <div class="notif-item ${isUnread ? 'unread' : ''}"
                 style="border-right-color: ${borderColor};"
                 onclick="markNotifRead('${n.id}')">
                <div class="notif-icon">${n.icon || '🔔'}</div>
                <div class="notif-content">
                    <div class="notif-title">${n.title || ''}</div>
                    <div class="notif-message">${n.message || ''}</div>
                    <div class="notif-date">${formatAnyDate(n.created_date)}</div>
                </div>
            </div>
        `;
    }).join('');
}


// ─── Mark one read ───
async function markNotifRead(notifId) {
    try {
        // به سرور اطلاع بده (اختیاری — فعلاً فقط local)
        // در آینده می‌تونه RPC mark_notification_read رو صدا بزنه
        const item = event.target.closest('.notif-item');
        if (item && item.classList.contains('unread')) {
            item.classList.remove('unread');
            // آپدیت بج
            const badge = document.getElementById('notifBadge');
            if (badge) {
                const current = parseInt(badge.textContent.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) || 0;
                const newCount = Math.max(0, current - 1);
                if (newCount > 0) {
                    badge.textContent = toPersianDigits(newCount);
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    } catch (e) {
        console.warn('markNotifRead:', e);
    }
}


// ─── Mark all read ───
async function markAllNotifsRead() {
    try {
        const items = document.querySelectorAll('.notif-item.unread');
        items.forEach(item => item.classList.remove('unread'));

        const badge = document.getElementById('notifBadge');
        if (badge) badge.style.display = 'none';

        const markAllBtn = document.getElementById('markAllBtn');
        if (markAllBtn) markAllBtn.style.display = 'none';

        // RPC برای sync
        try {
            await supabaseClient.rpc('mark_all_notifications_read', {
                p_member_id: currentUser.id
            });
        } catch (e) {
            console.warn('mark_all RPC:', e);
        }
    } catch (e) {
        console.error('markAllNotifsRead:', e);
    }
}


// ─── Toggle panel ───
function toggleNotifsPanel() {
    const section = document.getElementById('notificationsSection');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}



// ═══════════════════════════════════════════════════════
//  📅 نمایش برنامه‌ی کلاس
// ═══════════════════════════════════════════════════════
const DAY_NAMES_FA = {
    'saturday':  'شنبه',
    'sunday':    'یکشنبه',
    'monday':    'دوشنبه',
    'tuesday':   'سه‌شنبه',
    'wednesday': 'چهارشنبه',
    'thursday':  'پنجشنبه',
    'friday':    'جمعه',
};

const DAY_ORDER = ['saturday', 'sunday', 'monday', 'tuesday',
                   'wednesday', 'thursday', 'friday'];

const PY_WEEKDAY_JS = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
};


function renderClassSchedule(schedules, className) {
    const section = document.getElementById('classScheduleSection');
    const daysContainer = document.getElementById('scheduleDays');
    const classNameEl = document.getElementById('scheduleClassName');

    if (!section || !daysContainer) return;

    // اگه کلاس نداره
    if (!className) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    if (classNameEl) classNameEl.textContent = className;

    // اگه برنامه نداره
    if (!schedules || schedules.length === 0) {
        daysContainer.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; padding:20px;">
                <div class="empty-icon">📅</div>
                <div class="empty-text">برنامه‌ی هفتگی برای این کلاس تعریف نشده است</div>
            </div>
        `;
        return;
    }

    // روز امروز
    const today = PY_WEEKDAY_JS[new Date().getDay()];

    // مرتب‌سازی بر اساس ترتیب هفته
    const sorted = [...schedules].sort((a, b) => {
        return DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
    });

    daysContainer.innerHTML = sorted.map(s => {
        const dayName = DAY_NAMES_FA[s.day] || s.day;
        const isToday = s.day === today;
        const timeRange = (s.start_time && s.end_time)
            ? `${s.start_time} - ${s.end_time}`
            : (s.start_time || '—');

        return `
            <div class="schedule-day ${isToday ? 'today' : ''}">
                <div class="schedule-day-name">${dayName}</div>
                <div class="schedule-day-time">⏰ ${timeRange}</div>
            </div>
        `;
    }).join('');
}


// ─── بارگذاری برنامه‌ی کلاس ───
async function loadClassSchedule() {
    try {
        if (!currentUser || !currentUser.class_name) {
            // عضو کلاس نداره
            const section = document.getElementById('classScheduleSection');
            if (section) section.style.display = 'none';
            return;
        }

        const className = currentUser.class_name;
        const gymId = currentUser.gym_id || '';

        // RPC
        const { data, error } = await supabaseClient.rpc('get_class_schedule', {
            p_class_name: className,
            p_gym_id: gymId
        });

        if (error) {
            console.warn('class schedule RPC error:', error);
            renderClassSchedule([], className);
            return;
        }

        const schedules = data?.schedules || [];
        console.log(`📅 برنامه‌ی ${className}:`, schedules);
        renderClassSchedule(schedules, className);

    } catch (err) {
        console.warn('loadClassSchedule exception:', err);
    }
}


// ============================================================
// 💰 رندر شهریه‌ها
// ============================================================
function renderTuitions(items) {
    // 🔔 بنر هشدار معوق
    renderOverdueBanner(items);
    
    const container = document.getElementById('tuitionsList');
    const summary = document.getElementById('tuitionSummary');

    if (!container) return;

    // ─── خلاصه ───
    if (summary) {
        if (items && items.length > 0) {
            const unpaid = items.filter(t => !t.is_paid);
            const paid = items.filter(t => t.is_paid);

            const unpaidTotal = unpaid.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
            const paidTotal = paid.reduce((sum, t) => sum + (Number(t.paid_amount) || Number(t.amount) || 0), 0);

            document.getElementById('tuitionUnpaidAmount').textContent = formatMoney(unpaidTotal);
            document.getElementById('tuitionUnpaidCount').textContent = toPersianDigits(unpaid.length) + ' مورد';

            document.getElementById('tuitionPaidAmount').textContent = formatMoney(paidTotal);
            document.getElementById('tuitionPaidCount').textContent = toPersianDigits(paid.length) + ' مورد';

            summary.style.display = 'grid';
        } else {
            summary.style.display = 'none';
        }
    }

    // ─── لیست ───
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💰</div>
                <div class="empty-text">هیچ شهریه‌ای برای شما ثبت نشده است</div>
            </div>
        `;
        return;
    }

    // مرتب‌سازی: پرداخت‌نشده‌ها بالا
    const sorted = [...items].sort((a, b) => {
        if (a.is_paid === b.is_paid) return 0;
        return a.is_paid ? 1 : -1;
    });

    container.innerHTML = sorted.map(item => {
        const isPaid = !!item.is_paid;

        // ─── تبدیل ماه به فارسی ───
        const monthDisplay = formatShamsiMonth(item.month);

        // ─── وضعیت ───
        let badgeHtml = '';
        let dateInfo = '';

        if (isPaid) {
            badgeHtml = '<div class="list-item-badge badge-success">✅ پرداخت‌شده</div>';
            dateInfo = `پرداخت: ${formatAnyDate(item.paid_at)}`;
        } else {
            // چک کن معوقه یا در انتظار
            const isOverdue = isOverdueDate(item.due_date);
            if (isOverdue) {
                badgeHtml = '<div class="list-item-badge badge-danger">⚠️ معوق</div>';
            } else {
                badgeHtml = '<div class="list-item-badge badge-warning">⏳ در انتظار</div>';
            }
            dateInfo = `سررسید: ${formatAnyDate(item.due_date)}`;
        }

        return `
            <div class="list-item">
                <div class="list-item-left">
                    <div class="list-item-title">📅 ${monthDisplay}</div>
                    <div class="list-item-subtitle">${item.class_name || '—'} • ${dateInfo}</div>
                </div>
                <div class="list-item-right">
                    <div class="list-item-amount">${formatMoney(item.amount)}</div>
                    ${badgeHtml}
                </div>
            </div>
        `;
    }).join('');
}


// ─── تبدیل ماه شمسی "1405/07" به "مهر ۱۴۰۵" ───
function formatShamsiMonth(month) {
    if (!month) return '—';
    const parts = String(month).split('/');
    if (parts.length !== 2) return month;

    const year = parts[0];
    const mon = parseInt(parts[1], 10);
    const names = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
                   'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    const name = names[mon] || '?';
    return `${name} ${toPersianDigits(year)}`;
}


// ─── چک معوق ───
function isOverdueDate(dueDate) {
    if (!dueDate) return false;
    const m = String(dueDate).match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (!m) return false;

    const today = toShamsi(new Date());
    return dueDate < today;
}


// ─── فرمت هر تاریخ ───
function formatAnyDate(d) {
    if (!d) return '—';
    // 🔤 از toShamsi استفاده کن (توی همین فایل تعریف شده)
    // اگه toShamsiDisplay بود ازش استفاده کن
    if (typeof toShamsiDisplay === 'function') {
        return toShamsiDisplay(d);
    }
    // fallback: parseAnyDate + toShamsi
    const parsed = parseAnyDate(d);
    if (parsed) {
        return toShamsi(parsed);
    }
    // اگه از قبل شمسی هست
    return String(d);
}


// ─── تبدیل اعداد به فارسی ───
function toPersianDigits(str) {
    const map = {'0':'۰','1':'۱','2':'۲','3':'۳','4':'۴','5':'۵','6':'۶','7':'۷','8':'۸','9':'۹'};
    return String(str).replace(/[0-9]/g, d => map[d]);
}

// 🔧 alias: هر جا formatNumber صدا زده شد، بره به toPersianDigits
const formatNumber = toPersianDigits;



// ═══════════════════════════════════════════════════════
//  🔔 نمایش بنر شهریه‌ی معوق
// ═══════════════════════════════════════════════════════
function renderOverdueBanner(tuitions) {
    const banner = document.getElementById('overdueBanner');
    if (!banner) return;

    const unpaid = (tuitions || []).filter(t => !t.is_paid);

    if (unpaid.length === 0) {
        banner.style.display = 'none';
        return;
    }

    const total = unpaid.reduce((s, t) => s + (Number(t.amount) || 0), 0);

    document.getElementById('overdueTitle').textContent =
        unpaid.length === 1 ? 'شهریه‌ی معوق' : `${toPersianDigits(unpaid.length)} شهریه‌ی معوق`;

    document.getElementById('overdueText').textContent =
        unpaid.length === 1
            ? 'شما یک شهریه‌ی پرداخت‌نشده دارید'
            : `شما ${toPersianDigits(unpaid.length)} شهریه‌ی پرداخت‌نشده دارید`;

    document.getElementById('overdueAmount').textContent =
        toPersianDigits(total.toLocaleString('en-US')) + ' تومان';

    banner.style.display = 'flex';
}


// ─── تبدیل اعداد به فارسی ───
function toPersianDigits(input) {
    const map = {'0':'۰','1':'۱','2':'۲','3':'۳','4':'۴',
                 '5':'۵','6':'۶','7':'۷','8':'۸','9':'۹'};
    return String(input).replace(/[0-9]/g, d => map[d]);
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
        const dueDate = parseAnyDate(item.due_date);
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
        const payDate = parseAnyDate(item.payment_date);
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
        const date = parseAnyDate(item.attendance_date);
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
    // 🔤 نمایش شمسی
    return toShamsi(date);
}

function formatMoney(amount) {
    if (!amount) return '۰';
    return toPersianDigits(Number(amount).toLocaleString('en-US'));
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
