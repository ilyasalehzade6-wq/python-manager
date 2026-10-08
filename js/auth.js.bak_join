/**
 * 🔐 منطق ورود
 */

let supabaseClient = null;

// ============================================================
// راه‌اندازی
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // بررسی ورود قبلی
    const savedUser = localStorage.getItem('pulse_user');
    if (savedUser) {
        // اگه کمتر از ۷ روز گذشته
        try {
            const data = JSON.parse(savedUser);
            const savedTime = new Date(data.savedAt);
            const daysPassed = (Date.now() - savedTime.getTime()) / (1000 * 60 * 60 * 24);
            
            if (daysPassed < 7) {
                window.location.href = 'dashboard.html';
                return;
            } else {
                localStorage.removeItem('pulse_user');
            }
        } catch (e) {
            localStorage.removeItem('pulse_user');
        }
    }

    // شروع Supabase
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // راه‌اندازی فرم
    setupLoginForm();
    setupPhoneInput();
});

// ============================================================
// راه‌اندازی فرم
// ============================================================
function setupLoginForm() {
    const form = document.getElementById('loginForm');
    form.addEventListener('submit', handleLogin);
}

// ============================================================
// ورودی شماره موبایل
// ============================================================
function setupPhoneInput() {
    const phoneInput = document.getElementById('phone');
    
    phoneInput.addEventListener('input', function(e) {
        let value = this.value;
        // تبدیل اعداد فارسی به انگلیسی
        value = value.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
        // فقط اعداد
        value = value.replace(/[^0-9]/g, '');
        // حداکثر ۱۱ رقم
        if (value.length > 11) value = value.slice(0, 11);
        this.value = value;
    });

}

// ============================================================
// ورود
// ============================================================
async function handleLogin(event) {
    event.preventDefault();

    const phoneInput = document.getElementById('phone');
    const nameInput = document.getElementById('fullName');
    const clubInput = document.getElementById('clubName');
    const loginBtn = document.getElementById('loginBtn');
    const btnText = loginBtn.querySelector('.btn-text');
    const spinner = loginBtn.querySelector('.spinner');
    const errorMsg = document.getElementById('errorMsg');

    const phone = phoneInput.value.trim();
    const fullName = nameInput ? nameInput.value.trim() : '';
    const clubName = clubInput ? clubInput.value.trim() : '';

    // پاک کردن خطای قبلی
    errorMsg.textContent = '';
    errorMsg.classList.remove('show');

    // اعتبارسنجی
    if (!phone || phone.length !== 11) {
        showError('شماره موبایل باید ۱۱ رقم باشد');
        return;
    }
    if (!fullName || fullName.length < 3) {
        showError('نام و نام خانوادگی را وارد کنید');
        return;
    }
    if (!clubName || clubName.length < 2) {
        showError('نام آموزشگاه را وارد کنید');
        return;
    }

    // نمایش loading
    loginBtn.disabled = true;
    btnText.textContent = 'در حال بررسی...';
    spinner.style.display = 'inline-block';

    try {
        // فراخوانی Supabase function
        const { data, error } = await supabaseClient.rpc('verify_member_login_v2', {
            p_phone: phone,
            p_full_name: fullName,
            p_club_name: clubName
        });

        if (error) {
            console.error('Supabase error:', error);
            showError('خطا در اتصال. لطفاً دوباره تلاش کنید.');
            return;
        }

        // ─── چک نتیجه ───
        if (!data || !data.success) {
            const errorText = (data && data.error) || 'اطلاعات وارد شده اشتباه است';
            showError(errorText);
            return;
        }

        // ─── ذخیره اطلاعات ───
        const userData = {
            ...data.member,
            gym_id: data.gym.id,
            gym_name: data.gym.name,
            gym_phone: data.gym.phone,
            savedAt: new Date().toISOString()
        };
        localStorage.setItem('pulse_user', JSON.stringify(userData));

        // پیام موفقیت
        btnText.textContent = '✅ خوش آمدید!';
        
        // انتقال به داشبورد
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 500);

    } catch (err) {
        console.error('Login error:', err);
        showError('خطای غیرمنتظره. لطفاً دوباره تلاش کنید.');
    } finally {
        loginBtn.disabled = false;
        btnText.textContent = 'ورود به پورتال';
        spinner.style.display = 'none';
    }
}

// ============================================================
// نمایش خطا
// ============================================================
function showError(message) {
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.textContent = '⚠️ ' + message;
    errorMsg.classList.add('show');
    
    // انیمیشن لرزش
    const card = document.querySelector('.auth-card');
    card.classList.add('shake');
    setTimeout(() => card.classList.remove('shake'), 500);
}

// ============================================================
// تماس با پشتیبانی
// ============================================================
function contactSupport() {
    const msg = 'سلام 👋\nدر ورود به پورتال اعضا مشکل دارم و نیاز به کمک دارم.';
    copyToClipboard(msg).then(() => {
        window.open(RUBIKA_URL, '_blank');
    });
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        return navigator.clipboard.writeText(text).catch(() => {});
    }
    return Promise.resolve();
}
