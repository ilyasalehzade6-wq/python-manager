/**
 * 📊 داشبورد ادمین — مدیریت مشتری‌ها
 */

let allGyms = [];
let currentFilter = "all";

// ═══════════════════════════════════════════════════════
// راه‌اندازی
// ═══════════════════════════════════════════════════════
async function initDashboard() {
    const session = await checkAdminSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const nameEl = document.getElementById("admin-name");
    if (nameEl) nameEl.textContent = session.full_name;

    await loadGyms();
}

// ═══════════════════════════════════════════════════════
// بارگذاری مشتری‌ها
// ═══════════════════════════════════════════════════════
async function loadGyms() {
    showLoading(true);

    try {
        const client = getSupabase();
        let gyms = [];

        // ─── مستقیم از جدول gyms (چون RLS برای ادمین همه رو میده) ───
        const { data, error } = await client
            .from("gyms")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;
        gyms = data || [];
        console.log("✅ مشتری‌ها لود شدند:", gyms.length);

        allGyms = gyms;
        updateStats();
        renderGyms();

    } catch (e) {
        console.error("❌ خطا در بارگذاری:", e);
        showError("خطا: " + e.message);
    } finally {
        showLoading(false);
    }
}

// ═══════════════════════════════════════════════════════
// آمار
// ═══════════════════════════════════════════════════════
function updateStats() {
    const total = allGyms.length;
    const active = allGyms.filter(g => g.is_active && !g.is_blocked).length;
    const trial = allGyms.filter(g => g.subscription_plan === "trial").length;
    const expired = allGyms.filter(g => {
        if (!g.subscription_end) return false;
        return new Date(g.subscription_end) < new Date();
    }).length;

    const el = (id) => document.getElementById(id);
    if (el("stat-total")) el("stat-total").textContent = total;
    if (el("stat-active")) el("stat-active").textContent = active;
    if (el("stat-trial")) el("stat-trial").textContent = trial;
    if (el("stat-expired")) el("stat-expired").textContent = expired;
}

// ═══════════════════════════════════════════════════════
// رندر جدول
// ═══════════════════════════════════════════════════════
function renderGyms() {
    const tbody = document.getElementById("gyms-tbody");
    if (!tbody) return;

    const search = (document.getElementById("search-input")?.value || "").toLowerCase();

    let filtered = allGyms;

    if (currentFilter === "active") {
        filtered = filtered.filter(g => g.is_active && !g.is_blocked);
    } else if (currentFilter === "trial") {
        filtered = filtered.filter(g => g.subscription_plan === "trial");
    } else if (currentFilter === "expired") {
        filtered = filtered.filter(g => {
            if (!g.subscription_end) return false;
            return new Date(g.subscription_end) < new Date();
        });
    }

    if (search) {
        filtered = filtered.filter(g =>
            (g.name || "").toLowerCase().includes(search) ||
            (g.owner_name || "").toLowerCase().includes(search) ||
            (g.phone || "").includes(search) ||
            (g.customer_code || "").toLowerCase().includes(search)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty">هیچ مشتری‌ای پیدا نشد</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(g => {
        const status = getStatusBadge(g);
        const created = formatDate(g.created_at);
        const plan = g.subscription_plan || "trial";
        const phone = g.phone || "-";
        const owner = g.owner_name || "-";
        const customerCode = g.customer_code || "-";
        const actions = renderActions(g);

        return `
            <tr ${g.is_blocked ? 'style="opacity: 0.6;"' : ''}>
                <td><code style="color: #f39c12; font-size: 11px;">${escapeHtml(customerCode)}</code></td>
                <td><strong>${escapeHtml(g.name || "بی‌نام")}</strong></td>
                <td>${escapeHtml(owner)}</td>
                <td dir="ltr" style="text-align: right;">${escapeHtml(phone)}</td>
                <td>${plan}</td>
                <td>${formatRemaining(g)}</td>
                <td>${created}</td>
                <td>${status}</td>
                <td class="actions-cell">${actions}</td>
            </tr>
        `;
    }).join("");
    if (window.lucide) lucide.createIcons();
}

// ═══════════════════════════════════════════════════════
// دکمه‌های عملیات
// ═══════════════════════════════════════════════════════
function renderActions(g) {
    const isBlocked = g.is_blocked === true;
    const isArchived = g.archived_at !== null && g.archived_at !== undefined;
    const isDeleted = g.deleted_at !== null && g.deleted_at !== undefined;

    // دکمه مشاهده (همیشه هست)
    const viewBtn = `<button onclick="viewGymCredentials('${g.id}', '${escapeHtml(g.name || "")}')" class="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors" title="مشاهده اطلاعات ورود"><i data-lucide="eye" class="w-4 h-4"></i></button>`;

    if (isDeleted || isArchived) {
        return viewBtn + `<button onclick="restoreGym('${g.id}')" class="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors" title="بازگردانی"><i data-lucide="rotate-ccw" class="w-4 h-4"></i></button>`;
    }

    if (isBlocked) {
        return viewBtn + `
            <button onclick="unblockGym('${g.id}')" class="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors" title="رفع مسدودی"><i data-lucide="unlock" class="w-4 h-4"></i></button>
            <button onclick="deleteGym('${g.id}')" class="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors" title="حذف"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        `;
    }

    return viewBtn + `
        <button onclick="archiveGym('${g.id}')" class="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors" title="آرشیو"><i data-lucide="archive" class="w-4 h-4"></i></button>
        <button onclick="blockGym('${g.id}')" class="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-md transition-colors" title="مسدود کردن"><i data-lucide="lock" class="w-4 h-4"></i></button>
        <button onclick="deleteGym('${g.id}')" class="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors" title="حذف"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    `;
}

// ═══════════════════════════════════════════════════════
// Badge وضعیت
// ═══════════════════════════════════════════════════════
function getStatusBadge(g) {
    if (g.is_blocked) return '<span class="badge badge-red">🚫 مسدود</span>';
    if (g.deleted_at) return '<span class="badge badge-gray">🗑 حذف</span>';
    if (g.archived_at) return '<span class="badge badge-gray">📦 آرشیو</span>';
    if (!g.is_active) return '<span class="badge badge-gray">غیرفعال</span>';
    if (g.subscription_end && new Date(g.subscription_end) < new Date()) {
        return '<span class="badge badge-red">منقضی</span>';
    }
    if (g.subscription_plan === "trial") {
        return '<span class="badge badge-orange">آزمایشی</span>';
    }
    return '<span class="badge badge-green">فعال</span>';
}

// ═══════════════════════════════════════════════════════
// نمایش اعتبار
// ═══════════════════════════════════════════════════════
function formatRemaining(g) {
    const days = getRemainingDays(g);
    if (days === null) return '<span style="color:#95a5a6;">—</span>';
    if (days < 0) return '<span style="color:#e74c3c; font-weight:bold;">منقضی</span>';
    if (days === 0) return '<span style="color:#e74c3c; font-weight:bold;">امروز</span>';
    if (days <= 7) return `<span style="color:#f39c12; font-weight:bold;">${days} روز ⚠️</span>`;
    if (days <= 30) return `<span style="color:#3498db; font-weight:bold;">${days} روز</span>`;
    return `<span style="color:#2ecc71; font-weight:bold;">${days} روز</span>`;
}

function getRemainingDays(g) {
    if (!g.subscription_end) return null;
    const end = new Date(g.subscription_end);
    const now = new Date();
    const diffMs = end - now;
    if (diffMs < 0) return -1;
    return Math.ceil(diffMs / 86400000);
}

// ═══════════════════════════════════════════════════════
// فیلتر
// ═══════════════════════════════════════════════════════
function setFilter(filter) {
    currentFilter = filter;

    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.filter === filter);
    });

    renderGyms();
}

// ═══════════════════════════════════════════════════════
// ابزارها
// ═══════════════════════════════════════════════════════
function formatDate(iso) {
    if (!iso) return "-";
    try {
        return new Date(iso).toLocaleDateString("fa-IR");
    } catch {
        return "-";
    }
}

function escapeHtml(s) {
    if (!s) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function showLoading(show) {
    const el = document.getElementById("loading");
    if (el) el.style.display = show ? "block" : "none";
}

function showError(msg) {
    const el = document.getElementById("error-msg");
    if (el) {
        el.textContent = msg;
        el.style.display = "block";
        setTimeout(() => { el.style.display = "none"; }, 5000);
    }
}

// ═══════════════════════════════════════════════════════
// شروع
// ═══════════════════════════════════════════════════════
window.addEventListener("DOMContentLoaded", initDashboard);

// ═══════════════════════════════════════════════════════
//  👁️ مشاهده‌ی اطلاعات مشتری (فقط خواندنی)
//  نام کاربری + رمز عبور فعلی
// ═══════════════════════════════════════════════════════
async function viewGymCredentials(gymId, gymName) {
    try {
        const client = getSupabase();

        // نمایش loading
        const loading = document.createElement("div");
        loading.id = "cred-loading";
        loading.className = "fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] backdrop-blur-sm";
        loading.innerHTML = '<div class="bg-[#121215] border border-zinc-800 p-6 rounded-2xl flex flex-col items-center gap-3"><i data-lucide="loader-2" class="w-8 h-8 text-amber-500 animate-spin"></i><span class="text-zinc-300 text-sm">در حال دریافت اطلاعات...</span></div>';
        document.body.appendChild(loading);
        if (window.lucide) lucide.createIcons();

        // RPC
        const { data, error } = await client.rpc("admin_get_gym_credentials", { p_gym_id: gymId });

        loading.remove();

        if (error) throw error;
        if (!data?.success) {
            alert("❌ " + (data?.error || "خطا"));
            return;
        }

        // ─── نمایش modal ───
        const modal = document.createElement("div");
        modal.className = "fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm transition-opacity";
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        const hasPassword = !!data.password;
        const hasUsername = !!data.username;

        modal.innerHTML = `
            <div class="bg-[#121215] border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
                
                <!-- Header -->
                <div class="flex items-center justify-between p-5 border-b border-zinc-800 bg-[#111111]">
                    <h3 class="text-base font-bold text-white flex items-center gap-2">
                        <i data-lucide="key-round" class="w-5 h-5 text-amber-500"></i>
                        اطلاعات ورود مشتری
                    </h3>
                    <button onclick="this.closest('div[class*=\'fixed\']').remove()" class="p-1.5 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <!-- Content -->
                <div class="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    
                    <!-- Gym Name -->
                    <div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                        <div class="text-xs text-amber-500/70 mb-1 flex items-center gap-1.5"><i data-lucide="building" class="w-3.5 h-3.5"></i> نام مجموعه</div>
                        <div class="text-base font-bold text-amber-500">${escapeHtml(data.gym?.name || gymName)}</div>
                    </div>

                    <!-- Username -->
                    <div class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-xs text-blue-400 mb-1 flex items-center gap-1.5"><i data-lucide="user" class="w-3.5 h-3.5"></i> نام کاربری</div>
                                ${hasUsername 
                                    ? `<code class="text-base font-bold text-blue-400 font-mono tracking-wider" dir="ltr">${escapeHtml(data.username)}</code>`
                                    : `<div class="text-sm text-zinc-500 italic">ذخیره نشده</div>`
                                }
                            </div>
                            ${hasUsername ? `
                                <button onclick="copyText('${escapeHtml(data.username)}')" class="p-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors" title="کپی">
                                    <i data-lucide="copy" class="w-4 h-4"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Password -->
                    <div class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-xs text-emerald-400 mb-1 flex items-center gap-1.5"><i data-lucide="lock" class="w-3.5 h-3.5"></i> رمز عبور</div>
                                ${hasPassword 
                                    ? `<code class="text-base font-bold text-emerald-400 font-mono tracking-wider" dir="ltr">${escapeHtml(data.password)}</code>`
                                    : `<div class="text-xs text-amber-500">⚠️ رمز ذخیره نشده (مشتری قبل از این قابلیت ثبت‌نام کرده)</div>`
                                }
                            </div>
                            ${hasPassword ? `
                                <button onclick="copyText('${escapeHtml(data.password)}')" class="p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg transition-colors" title="کپی">
                                    <i data-lucide="copy" class="w-4 h-4"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Phone -->
                    <div class="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 flex items-center justify-between">
                        <div>
                            <div class="text-xs text-zinc-400 mb-1 flex items-center gap-1.5"><i data-lucide="phone" class="w-3.5 h-3.5"></i> شماره موبایل</div>
                            <code class="text-sm font-bold text-zinc-200 font-mono" dir="ltr">${escapeHtml(data.gym?.phone || "-")}</code>
                        </div>
                        <button onclick="copyText('${escapeHtml(data.gym?.phone || "")}')" class="p-2 bg-zinc-700 text-zinc-300 hover:bg-zinc-600 rounded-lg transition-colors" title="کپی">
                            <i data-lucide="copy" class="w-4 h-4"></i>
                        </button>
                    </div>

                </div>

                <!-- Footer -->
                <div class="p-4 border-t border-zinc-800 bg-[#111111] flex gap-3">
                    <button onclick="copyText('باشگاه: ${escapeHtml(data.gym?.name || "")}\nنام کاربری: ${escapeHtml(data.username || "")}\nرمز: ${escapeHtml(data.password || "")}\nشماره: ${escapeHtml(data.gym?.phone || "")}'); this.innerHTML = '<i data-lucide=\'check\' class=\'w-4 h-4\'></i> کپی شد'; setTimeout(()=>this.innerHTML='<i data-lucide=\'copy\' class=\'w-4 h-4\'></i> کپی همه', 2000); if(window.lucide) lucide.createIcons();" 
                            class="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
                        <i data-lucide="copy" class="w-4 h-4"></i> کپی همه
                    </button>
                    <button onclick="this.closest('div[class*=\'fixed\']').remove()" 
                            class="flex-1 bg-transparent border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-bold py-2.5 rounded-xl transition-colors">
                        بستن
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        if (window.lucide) lucide.createIcons();

    } catch (e) {
        console.error(e);
        const loading = document.getElementById("cred-loading");
        if (loading) loading.remove();
        alert("❌ خطا: " + e.message);
    }
}



// ==========================================
// 🚀 نسخه جدید و پریمیوم مودال اطلاعات مشتری
// ==========================================
async function viewGymCredentials(gymId, gymName) {
    try {
        const client = getSupabase();

        // نمایش loading
        const loading = document.createElement("div");
        loading.id = "cred-loading";
        loading.className = "fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] backdrop-blur-sm";
        loading.innerHTML = '<div class="bg-[#121215] border border-zinc-800 p-6 rounded-2xl flex flex-col items-center gap-3"><i data-lucide="loader-2" class="w-8 h-8 text-amber-500 animate-spin"></i><span class="text-zinc-300 text-sm">در حال دریافت اطلاعات...</span></div>';
        document.body.appendChild(loading);
        if (window.lucide) lucide.createIcons();

        // RPC
        const { data, error } = await client.rpc("admin_get_gym_credentials", { p_gym_id: gymId });

        loading.remove();

        if (error) throw error;
        if (!data?.success) {
            alert("❌ " + (data?.error || "خطا"));
            return;
        }

        // ─── نمایش modal ───
        const modal = document.createElement("div");
        modal.className = "fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm transition-opacity";
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        const hasPassword = !!data.password;
        const hasUsername = !!data.username;

        modal.innerHTML = `
            <div class="bg-[#121215] border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
                
                <!-- Header -->
                <div class="flex items-center justify-between p-5 border-b border-zinc-800 bg-[#111111]">
                    <h3 class="text-base font-bold text-white flex items-center gap-2">
                        <i data-lucide="key-round" class="w-5 h-5 text-amber-500"></i>
                        اطلاعات ورود مشتری
                    </h3>
                    <button onclick="this.closest('div[class*=\'fixed\']').remove()" class="p-1.5 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <!-- Content -->
                <div class="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    
                    <!-- Gym Name -->
                    <div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 relative overflow-hidden">
                        <div class="text-xs text-amber-500/70 mb-1 flex items-center gap-1.5"><i data-lucide="building" class="w-3.5 h-3.5"></i> نام مجموعه</div>
                        <div class="text-base font-bold text-amber-500">${escapeHtml(data.gym?.name || gymName)}</div>
                    </div>

                    <!-- Username -->
                    <div class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-xs text-blue-400 mb-1 flex items-center gap-1.5"><i data-lucide="user" class="w-3.5 h-3.5"></i> نام کاربری</div>
                                ${hasUsername 
                                    ? `<code class="text-base font-bold text-blue-400 font-mono tracking-wider" dir="ltr">${escapeHtml(data.username)}</code>`
                                    : `<div class="text-sm text-zinc-500 italic">ذخیره نشده</div>`
                                }
                            </div>
                            ${hasUsername ? `
                                <button onclick="copyText('${escapeHtml(data.username)}')" class="p-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors" title="کپی">
                                    <i data-lucide="copy" class="w-4 h-4"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Password -->
                    <div class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-xs text-emerald-400 mb-1 flex items-center gap-1.5"><i data-lucide="lock" class="w-3.5 h-3.5"></i> رمز عبور</div>
                                ${hasPassword 
                                    ? `<code class="text-base font-bold text-emerald-400 font-mono tracking-wider" dir="ltr">${escapeHtml(data.password)}</code>`
                                    : `<div class="text-xs text-amber-500">⚠️ رمز ذخیره نشده</div>`
                                }
                            </div>
                            ${hasPassword ? `
                                <button onclick="copyText('${escapeHtml(data.password)}')" class="p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg transition-colors" title="کپی">
                                    <i data-lucide="copy" class="w-4 h-4"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Phone -->
                    <div class="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 flex items-center justify-between">
                        <div>
                            <div class="text-xs text-zinc-400 mb-1 flex items-center gap-1.5"><i data-lucide="phone" class="w-3.5 h-3.5"></i> شماره موبایل</div>
                            <code class="text-sm font-bold text-zinc-200 font-mono" dir="ltr">${escapeHtml(data.gym?.phone || "-")}</code>
                        </div>
                        <button onclick="copyText('${escapeHtml(data.gym?.phone || "")}')" class="p-2 bg-zinc-700 text-zinc-300 hover:bg-zinc-600 rounded-lg transition-colors" title="کپی">
                            <i data-lucide="copy" class="w-4 h-4"></i>
                        </button>
                    </div>

                </div>

                <!-- Footer -->
                <div class="p-4 border-t border-zinc-800 bg-[#111111] flex gap-3">
                    <button onclick="copyText('باشگاه: ${escapeHtml(data.gym?.name || "")}\nنام کاربری: ${escapeHtml(data.username || "")}\nرمز: ${escapeHtml(data.password || "")}\nشماره: ${escapeHtml(data.gym?.phone || "")}'); this.innerHTML = '<i data-lucide=\'check\' class=\'w-4 h-4\'></i> کپی شد'; setTimeout(()=>this.innerHTML='<i data-lucide=\'copy\' class=\'w-4 h-4\'></i> کپی همه', 2000); if(window.lucide) lucide.createIcons();" 
                            class="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
                        <i data-lucide="copy" class="w-4 h-4"></i> کپی همه
                    </button>
                    <button onclick="this.closest('div[class*=\'fixed\']').remove()" 
                            class="flex-1 bg-transparent border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-bold py-2.5 rounded-xl transition-colors">
                        بستن
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        if (window.lucide) lucide.createIcons();

    } catch (e) {
        console.error(e);
        const loading = document.getElementById("cred-loading");
        if (loading) loading.remove();
        alert("❌ خطا: " + e.message);
    }
}

// بازنویسی دکمه‌های جدول برای استفاده از آیکون‌های SVG
function renderActions(g) {
    const isBlocked = g.is_blocked === true;
    const isArchived = g.archived_at !== null && g.archived_at !== undefined;
    const isDeleted = g.deleted_at !== null && g.deleted_at !== undefined;

    const viewBtn = `<button onclick="viewGymCredentials('${g.id}', '${escapeHtml(g.name || "")}')" class="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors" title="مشاهده اطلاعات ورود"><i data-lucide="eye" class="w-4 h-4"></i></button>`;

    if (isDeleted || isArchived) {
        return viewBtn + `<button onclick="restoreGym('${g.id}')" class="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors" title="بازگردانی"><i data-lucide="rotate-ccw" class="w-4 h-4"></i></button>`;
    }

    if (isBlocked) {
        return viewBtn + `
            <button onclick="unblockGym('${g.id}')" class="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors" title="رفع مسدودی"><i data-lucide="unlock" class="w-4 h-4"></i></button>
            <button onclick="deleteGym('${g.id}')" class="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors" title="حذف"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        `;
    }

    return viewBtn + `
        <button onclick="archiveGym('${g.id}')" class="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors" title="آرشیو"><i data-lucide="archive" class="w-4 h-4"></i></button>
        <button onclick="blockGym('${g.id}')" class="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-md transition-colors" title="مسدود کردن"><i data-lucide="lock" class="w-4 h-4"></i></button>
        <button onclick="deleteGym('${g.id}')" class="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors" title="حذف"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    `;
}



// ==========================================
// 🚀 نسخه اصلاح شده مودال اطلاعات مشتری (بدون خطای سینتکس)
// ==========================================

// بازنویسی تابع escapeHtml برای امن کردن نقل‌قول تک
window.escapeHtml = function(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

async function viewGymCredentials(gymId, gymName) {
    try {
        const client = getSupabase();

        const loading = document.createElement("div");
        loading.id = "cred-loading";
        loading.className = "fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] backdrop-blur-sm";
        loading.innerHTML = '<div class="bg-[#121215] border border-zinc-800 p-6 rounded-2xl flex flex-col items-center gap-3"><i data-lucide="loader-2" class="w-8 h-8 text-amber-500 animate-spin"></i><span class="text-zinc-300 text-sm">در حال دریافت اطلاعات...</span></div>';
        document.body.appendChild(loading);
        if (window.lucide) lucide.createIcons();

        const { data, error } = await client.rpc("admin_get_gym_credentials", { p_gym_id: gymId });
        loading.remove();

        if (error) throw error;
        if (!data?.success) {
            alert("❌ " + (data?.error || "خطا"));
            return;
        }

        const hasPassword = !!data.password;
        const hasUsername = !!data.username;
        
        // ساخت متن برای دکمه کپی همه (با JSON.stringify برای جلوگیری از خطای نقل‌قول)
        const copyAllText = `باشگاه: ${data.gym?.name || ''}\nنام کاربری: ${data.username || ''}\nرمز: ${data.password || ''}\nشماره: ${data.gym?.phone || ''}`;
        const copyAllJson = JSON.stringify(copyAllText);
        
        const copyUsernameJson = JSON.stringify(data.username || '');
        const copyPasswordJson = JSON.stringify(data.password || '');
        const copyPhoneJson = JSON.stringify(data.gym?.phone || '');

        const modal = document.createElement("div");
        modal.className = "fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm transition-opacity";
        
        // بستن مودال با کلیک روی پس‌زمینه
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        modal.innerHTML = `
            <div class="bg-[#121215] border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
                
                <!-- Header -->
                <div class="flex items-center justify-between p-5 border-b border-zinc-800 bg-[#111111]">
                    <h3 class="text-base font-bold text-white flex items-center gap-2">
                        <i data-lucide="key-round" class="w-5 h-5 text-amber-500"></i>
                        اطلاعات ورود مشتری
                    </h3>
                    <button onclick="this.closest('.fixed').remove()" class="p-1.5 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <!-- Content -->
                <div class="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    
                    <!-- Gym Name -->
                    <div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 relative overflow-hidden">
                        <div class="text-xs text-amber-500/70 mb-1 flex items-center gap-1.5"><i data-lucide="building" class="w-3.5 h-3.5"></i> نام مجموعه</div>
                        <div class="text-base font-bold text-amber-500">${escapeHtml(data.gym?.name || gymName)}</div>
                    </div>

                    <!-- Username -->
                    <div class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-xs text-blue-400 mb-1 flex items-center gap-1.5"><i data-lucide="user" class="w-3.5 h-3.5"></i> نام کاربری</div>
                                ${hasUsername 
                                    ? `<code class="text-base font-bold text-blue-400 font-mono tracking-wider" dir="ltr">${escapeHtml(data.username)}</code>`
                                    : `<div class="text-sm text-zinc-500 italic">ذخیره نشده</div>`
                                }
                            </div>
                            ${hasUsername ? `
                                <button onclick='copyText(${copyUsernameJson})' class="p-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors" title="کپی">
                                    <i data-lucide="copy" class="w-4 h-4"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Password -->
                    <div class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="text-xs text-emerald-400 mb-1 flex items-center gap-1.5"><i data-lucide="lock" class="w-3.5 h-3.5"></i> رمز عبور</div>
                                ${hasPassword 
                                    ? `<code class="text-base font-bold text-emerald-400 font-mono tracking-wider" dir="ltr">${escapeHtml(data.password)}</code>`
                                    : `<div class="text-xs text-amber-500">⚠️ رمز ذخیره نشده</div>`
                                }
                            </div>
                            ${hasPassword ? `
                                <button onclick='copyText(${copyPasswordJson})' class="p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg transition-colors" title="کپی">
                                    <i data-lucide="copy" class="w-4 h-4"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Phone -->
                    <div class="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 flex items-center justify-between">
                        <div>
                            <div class="text-xs text-zinc-400 mb-1 flex items-center gap-1.5"><i data-lucide="phone" class="w-3.5 h-3.5"></i> شماره موبایل</div>
                            <code class="text-sm font-bold text-zinc-200 font-mono" dir="ltr">${escapeHtml(data.gym?.phone || "-")}</code>
                        </div>
                        <button onclick='copyText(${copyPhoneJson})' class="p-2 bg-zinc-700 text-zinc-300 hover:bg-zinc-600 rounded-lg transition-colors" title="کپی">
                            <i data-lucide="copy" class="w-4 h-4"></i>
                        </button>
                    </div>

                </div>

                <!-- Footer -->
                <div class="p-4 border-t border-zinc-800 bg-[#111111] flex gap-3">
                    <button onclick='copyText(${copyAllJson})' 
                            class="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
                        <i data-lucide="copy" class="w-4 h-4"></i> کپی همه
                    </button>
                    <button onclick="this.closest('.fixed').remove()" 
                            class="flex-1 bg-transparent border border-zinc-700 hover:bg-zinc-800 text-zinc-300 font-bold py-2.5 rounded-xl transition-colors">
                        بستن
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        if (window.lucide) lucide.createIcons();

    } catch (e) {
        console.error(e);
        const loading = document.getElementById("cred-loading");
        if (loading) loading.remove();
        alert("❌ خطا: " + e.message);
    }
}

// بازنویسی تابع دکمه‌های جدول (بدون تغییر نسبت به قبل، فقط برای اطمینان)
function renderActions(g) {
    const isBlocked = g.is_blocked === true;
    const isArchived = g.archived_at !== null && g.archived_at !== undefined;
    const isDeleted = g.deleted_at !== null && g.deleted_at !== undefined;

    const viewBtn = `<button onclick="viewGymCredentials('${g.id}', '${escapeHtml(g.name || "")}')" class="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors" title="مشاهده اطلاعات ورود"><i data-lucide="eye" class="w-4 h-4"></i></button>`;

    if (isDeleted || isArchived) {
        return viewBtn + `<button onclick="restoreGym('${g.id}')" class="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors" title="بازگردانی"><i data-lucide="rotate-ccw" class="w-4 h-4"></i></button>`;
    }

    if (isBlocked) {
        return viewBtn + `
            <button onclick="unblockGym('${g.id}')" class="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors" title="رفع مسدودی"><i data-lucide="unlock" class="w-4 h-4"></i></button>
            <button onclick="deleteGym('${g.id}')" class="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors" title="حذف"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        `;
    }

    return viewBtn + `
        <button onclick="archiveGym('${g.id}')" class="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors" title="آرشیو"><i data-lucide="archive" class="w-4 h-4"></i></button>
        <button onclick="blockGym('${g.id}')" class="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-md transition-colors" title="مسدود کردن"><i data-lucide="lock" class="w-4 h-4"></i></button>
        <button onclick="deleteGym('${g.id}')" class="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors" title="حذف"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    `;
}
