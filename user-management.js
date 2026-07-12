// ============================================================
//  user-management.js  —  نظام المستخدمين (الموظفين) وتتبّع التحصيل
//  ------------------------------------------------------------
//  يضيف طبقة "هوية الموظف" فوق نظام كلمات المرور العام (RBAC)
//  الموجود مسبقًا، بدون تغيير أي منطق قديم:
//
//   • كل مستخدم = { id, name, password, active, createdAt }
//   • تُحفظ القائمة داخل db._settings.employees (نفس مكان بقية
//     الإعدادات، فتُحفظ وتُحمَّل تلقائيًا مع باقي النظام)
//   • بعد إدخال كلمة مرور الدخول العامة (مشرف/موظف) بنجاح، إذا
//     كان هناك مستخدمون معرَّفون، تظهر شاشة "من أنت؟" لاختيار
//     الاسم قبل الدخول للنظام — تمامًا كصورة WhatsApp Web البسيطة.
//   • اسم المستخدم الحالي يُحفظ في sessionStorage ويُستخدم تلقائيًا
//     كحقل collectedBy في أي عملية تحصيل مالي (اشتراك / ملزمة /
//     منصة / إيراد آخر) بدون أي تدخل يدوي من الموظف.
// ============================================================

const EmployeeAuth = (() => {

    const SESSION_ID_KEY   = 'current_employee_id';
    const SESSION_NAME_KEY = 'current_employee_name';

    // ── قراءة/تهيئة قائمة المستخدمين من db._settings ──────────
    function _ensureStore() {
        if (!db._settings) db._settings = {};
        if (!Array.isArray(db._settings.employees)) db._settings.employees = [];
        return db._settings.employees;
    }

    function list(includeInactive = true) {
        const all = _ensureStore();
        return includeInactive ? all : all.filter(e => e.active !== false);
    }

    function getById(id) {
        return _ensureStore().find(e => String(e.id) === String(id)) || null;
    }

    // ── حفظ الإعدادات فقط (بدون إعادة كتابة جداول الطلاب الضخمة) ──
    function _persistSettingsOnly() {
        try {
            localStorage.setItem('edu_master_settings', JSON.stringify(db._settings));
        } catch (e) { console.warn('[EmployeeAuth] failed to persist settings', e); }
        // محاولة أفضل جهد لحفظها أيضاً داخل IndexedDB في الخلفية دون انتظار
        if (typeof db.save === 'function') {
            db.save('shifts').catch(() => {});
        }
    }

    function add(name, password) {
        name = String(name || '').trim();
        password = String(password || '').trim();
        if (!name) throw new Error('اسم المستخدم مطلوب');
        if (!password || password.length < 3) throw new Error('كلمة المرور يجب أن تكون 3 أحرف على الأقل');

        const store = _ensureStore();
        if (store.some(e => e.name === name)) throw new Error('يوجد مستخدم بنفس الاسم بالفعل');

        const entry = {
            id: Date.now(),
            name,
            password,
            active: true,
            createdAt: new Date().toISOString()
        };
        store.push(entry);
        _persistSettingsOnly();
        return entry;
    }

    function update(id, { name, password, active } = {}) {
        const entry = getById(id);
        if (!entry) throw new Error('المستخدم غير موجود');
        if (name !== undefined && String(name).trim()) entry.name = String(name).trim();
        if (password !== undefined && String(password).trim()) entry.password = String(password).trim();
        if (active !== undefined) entry.active = !!active;
        _persistSettingsOnly();

        // لو ده المستخدم الحالي بنفس الجلسة، حدّث اسمه المعروض فوراً
        if (String(getCurrentId()) === String(id)) {
            sessionStorage.setItem(SESSION_NAME_KEY, entry.name);
        }
        return entry;
    }

    function remove(id) {
        const store = _ensureStore();
        const idx = store.findIndex(e => String(e.id) === String(id));
        if (idx === -1) return false;
        store.splice(idx, 1);
        _persistSettingsOnly();
        if (String(getCurrentId()) === String(id)) clearCurrent();
        return true;
    }

    function verify(id, password) {
        const entry = getById(id);
        return !!entry && entry.password === String(password || '').trim();
    }

    // ── الجلسة الحالية ───────────────────────────────────────
    function setCurrent(id) {
        const entry = getById(id);
        if (!entry) return false;
        sessionStorage.setItem(SESSION_ID_KEY, String(entry.id));
        sessionStorage.setItem(SESSION_NAME_KEY, entry.name);
        return true;
    }

    // دخول بدون اختيار مستخدم محدد (مثلاً عند عدم وجود أي مستخدمين مُعرَّفين)
    function setCurrentGeneric(label) {
        sessionStorage.removeItem(SESSION_ID_KEY);
        sessionStorage.setItem(SESSION_NAME_KEY, label || 'غير محدد');
    }

    function clearCurrent() {
        sessionStorage.removeItem(SESSION_ID_KEY);
        sessionStorage.removeItem(SESSION_NAME_KEY);
    }

    function getCurrentId() {
        return sessionStorage.getItem(SESSION_ID_KEY);
    }

    // يُستخدم في أي مكان بالنظام لمعرفة "مين اللي بيحصّل دلوقتي"
    function getCurrentName() {
        const saved = sessionStorage.getItem(SESSION_NAME_KEY);
        if (saved) return saved;
        // fallback لأي شاشة قديمة أو لو لسه ملحقتش تختار هوية
        if (typeof RBAC !== 'undefined' && RBAC.isAdmin && RBAC.isAdmin()) return 'المشرف';
        return 'الموظف';
    }

    return {
        list, getById, add, update, remove, verify,
        setCurrent, setCurrentGeneric, clearCurrent,
        getCurrentId, getCurrentName,
    };
})();

window.EmployeeAuth = EmployeeAuth;

// ============================================================
//  شاشة اختيار الهوية عند الدخول (بعد كلمة المرور العامة مباشرة)
// ============================================================

// يُستدعى من app.js بعد نجاح checkAppPassword، بدلاً من الانتقال
// مباشرة لشاشة التحميل. لو مفيش مستخدمين مُعرَّفين، يكمل تلقائياً.
function proceedAfterPasswordSuccess(role) {
    const employees = EmployeeAuth.list(false); // النشطون فقط

    if (!employees.length) {
        // لا يوجد نظام مستخدمين مُفعَّل بعد — كمّل بالسلوك القديم تمامًا
        EmployeeAuth.setCurrentGeneric(role === 'admin' ? 'المشرف' : 'الموظف');
        finishLoginFlow(role);
        return;
    }

    // أظهر شاشة "من أنت؟"
    renderEmployeeSelectScreen(employees, role);

    const passwordScreen = document.getElementById('password-screen');
    const selectScreen   = document.getElementById('employee-select-screen');
    if (passwordScreen) passwordScreen.style.display = 'none';
    if (selectScreen)   selectScreen.style.display = 'block';
}

function renderEmployeeSelectScreen(employees, role) {
    const wrap = document.getElementById('employee-select-list');
    if (!wrap) return;

    wrap.innerHTML = employees.map(emp => `
        <button type="button" class="btn settings-choice employee-pick-btn"
            style="width:100%; text-align:right; margin-bottom:.6rem; padding:.9rem 1.2rem; border-radius:14px;"
            onclick="openEmployeePinPrompt('${emp.id}', '${role}')">
            <i class="fas fa-user-circle"></i> ${emp.name}
        </button>
    `).join('') || '<p class="settings-note">لا يوجد مستخدمون نشطون حالياً.</p>';

    // زر تخطي (متاح دائمًا) — للدخول بدون تحديد هوية موظف بعينه
    const skipBtn = document.getElementById('employee-select-skip-btn');
    if (skipBtn) {
        skipBtn.onclick = () => {
            EmployeeAuth.setCurrentGeneric(role === 'admin' ? 'المشرف' : 'الموظف');
            finishLoginFlow(role);
        };
    }
}

// كل مستخدم له كلمة مرور خاصة به لتأكيد الهوية قبل الدخول
function openEmployeePinPrompt(employeeId, role) {
    const emp = EmployeeAuth.getById(employeeId);
    if (!emp) return;
    const pin = prompt(`أدخل كلمة مرور "${emp.name}":`);
    if (pin === null) return; // إلغاء
    if (!EmployeeAuth.verify(employeeId, pin)) {
        showNotification('❌ كلمة المرور غير صحيحة', 'error');
        return;
    }
    EmployeeAuth.setCurrent(employeeId);
    finishLoginFlow(role);
}

// ============================================================
//  واجهة إدارة المستخدمين (داخل الإعدادات)
// ============================================================

function openEmployeeManagement() {
    renderEmployeeManagementList();
    toggleModal('employee-management-modal', true);
}

function renderEmployeeManagementList() {
    const container = document.getElementById('employee-management-list');
    if (!container) return;

    const employees = EmployeeAuth.list(true);

    container.innerHTML = (employees.length ? employees.map(emp => `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:.75rem; padding:.9rem 1rem; background:var(--bg-light); border-radius:14px; ${emp.active === false ? 'opacity:.55;' : ''}">
            <div style="display:flex; align-items:center; gap:.6rem;">
                <i class="fas fa-user-circle" style="font-size:1.4rem; color:var(--primary);"></i>
                <div>
                    <div style="font-weight:800;">${emp.name} ${emp.active === false ? '<span style="font-size:.75rem; color:var(--danger);">(معطّل)</span>' : ''}</div>
                    <div style="font-size:.8rem; color:var(--text-muted);">كلمة المرور: •••• (${String(emp.password).length} أحرف)</div>
                </div>
            </div>
            <div style="display:flex; gap:.4rem;">
                <button class="btn" style="padding:.5rem .7rem;" onclick="openEditEmployeeModal('${emp.id}')" title="تعديل">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn" style="padding:.5rem .7rem; background:${emp.active === false ? 'var(--accent)' : '#f59e0b'}; color:#fff;"
                    onclick="toggleEmployeeActive('${emp.id}')" title="${emp.active === false ? 'تفعيل' : 'تعطيل'}">
                    <i class="fas fa-power-off"></i>
                </button>
                <button class="btn" style="padding:.5rem .7rem; color:var(--danger); border:1px solid var(--danger);" onclick="deleteEmployeeConfirm('${emp.id}')" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('') : '<p class="settings-note" style="text-align:center;">لا يوجد مستخدمون بعد. أضف أول مستخدم من الزر أدناه.</p>');
}

function toggleEmployeeActive(id) {
    const emp = EmployeeAuth.getById(id);
    if (!emp) return;
    EmployeeAuth.update(id, { active: emp.active === false });
    renderEmployeeManagementList();
}

function deleteEmployeeConfirm(id) {
    const emp = EmployeeAuth.getById(id);
    if (!emp) return;
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${emp.name}"؟ لن يؤثر هذا على السجلات المالية السابقة المسجلة باسمه.`)) return;
    EmployeeAuth.remove(id);
    renderEmployeeManagementList();
    showNotification('تم حذف المستخدم', 'warning');
}

function openAddEmployeeModal() {
    document.getElementById('employee-form-title').innerText = 'إضافة مستخدم جديد';
    document.getElementById('employee-form-id').value = '';
    document.getElementById('employee-form-name').value = '';
    document.getElementById('employee-form-password').value = '';
    toggleModal('employee-form-modal', true);
}

function openEditEmployeeModal(id) {
    const emp = EmployeeAuth.getById(id);
    if (!emp) return;
    document.getElementById('employee-form-title').innerText = `تعديل بيانات ${emp.name}`;
    document.getElementById('employee-form-id').value = emp.id;
    document.getElementById('employee-form-name').value = emp.name;
    document.getElementById('employee-form-password').value = emp.password;
    toggleModal('employee-form-modal', true);
}

function saveEmployeeForm() {
    const id = document.getElementById('employee-form-id').value;
    const name = document.getElementById('employee-form-name').value;
    const password = document.getElementById('employee-form-password').value;

    try {
        if (id) {
            EmployeeAuth.update(id, { name, password });
            showNotification('✅ تم تحديث بيانات المستخدم', 'success');
        } else {
            EmployeeAuth.add(name, password);
            showNotification('✅ تم إضافة المستخدم بنجاح', 'success');
        }
        toggleModal('employee-form-modal', false);
        renderEmployeeManagementList();
    } catch (e) {
        showNotification(`⚠️ ${e.message}`, 'warning');
    }
}

window.openEmployeeManagement    = openEmployeeManagement;
window.renderEmployeeManagementList = renderEmployeeManagementList;
window.toggleEmployeeActive      = toggleEmployeeActive;
window.deleteEmployeeConfirm     = deleteEmployeeConfirm;
window.openAddEmployeeModal      = openAddEmployeeModal;
window.openEditEmployeeModal     = openEditEmployeeModal;
window.saveEmployeeForm          = saveEmployeeForm;
window.proceedAfterPasswordSuccess = proceedAfterPasswordSuccess;
window.renderEmployeeSelectScreen  = renderEmployeeSelectScreen;
window.openEmployeePinPrompt       = openEmployeePinPrompt;
