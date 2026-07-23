
// ============================================================
//  RBAC — Role-Based Access Control System
//  نظام الصلاحيات المتكامل للسيستم
//
//  الأدوار:
//    admin    → المشرف  (كلمة المرور: 20062006) — كل الصلاحيات
//    employee → الموظف  (كلمة المرور: 2446)     — صلاحيات محدودة
//
//  الاستخدام:
//    RBAC.getRole()         → 'admin' | 'employee' | null
//    RBAC.isAdmin()         → boolean
//    RBAC.can(permission)   → boolean
//    RBAC.applyToUI()       → يُطبّق الصلاحيات على الـ DOM
// ============================================================

const RBAC = (() => {
  const ROLES = {
    admin:    'admin',
    employee: 'employee',
  };

  const PASSWORDS = {
    admin:    '20062006',
    employee: '2446',
  };

  // الصلاحيات الممنوعة على الموظف
  const EMPLOYEE_FORBIDDEN = [
    'view_treasury', 'view_finance', 'view_payments',
    'view_shifts', 'view_backup', 'view_analytics',
    'view_certificates', 'view_hall', 'view_dashboard',
    'view_platform_codes', 'view_platform_activation',
    'view_daily_treasury',
    'delete_student', 'delete_group', 'delete_exam',
    'delete_payment', 'delete_expense',
    'view_sync_details', 'view_api_data',
    'manage_courses', 'manage_settings', 'manage_users',
  ];

  let _role = sessionStorage.getItem('app_role') || null;

  return {
    PASSWORDS,

    login(role) {
      _role = role;
      sessionStorage.setItem('app_role', role);
    },

    logout() {
      _role = null;
      sessionStorage.removeItem('app_role');
    },

    getRole() { return _role; },

    isAdmin()    { return _role === ROLES.admin; },
    isEmployee() { return _role === ROLES.employee; },
    isLoggedIn() { return _role !== null; },

    can(permission) {
      if (!_role) return false;
      if (_role === ROLES.admin) return true;
      return !EMPLOYEE_FORBIDDEN.includes(permission);
    },

    canDelete() {
      return _role === ROLES.admin;
    },

    // ─── تطبيق الصلاحيات على الـ sidebar ───────────────────
    applyToUI() {
      const role = _role;
      if (!role) return;

      // ── الـ nav items ──
      document.querySelectorAll('.nav-item[data-rbac]').forEach(item => {
        const rbac = item.getAttribute('data-rbac');
        if (rbac === 'all') {
          item.style.display = '';
        } else if (rbac === 'admin') {
          item.style.display = role === 'admin' ? '' : 'none';
        } else if (rbac === 'employee') {
          item.style.display = role === 'employee' ? '' : 'none';
        }
      });

      // ── الـ header badge ──
      const userSpan = document.querySelector('.user-profile span');
      if (userSpan) {
        userSpan.textContent = role === 'admin' ? 'المشرف' : 'الموظف';
      }
      const avatarEl = document.querySelector('.user-profile .avatar');
      if (avatarEl) {
        avatarEl.textContent = role === 'admin' ? 'A' : 'E';
        avatarEl.style.background = role === 'admin'
          ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
          : 'linear-gradient(135deg, #0ea5e9, #0284c7)';
      }

      // ── إخفاء أزرار الحذف للموظف ──
      if (role === 'employee') {
        // أزرار الحذف في جداول الطلاب — يُخفيها CSS hook
        document.body.classList.add('rbac-employee');
        document.body.classList.remove('rbac-admin');
      } else {
        document.body.classList.add('rbac-admin');
        document.body.classList.remove('rbac-employee');
      }
    },

    // ─── الوصول المباشر للـ sections (حماية Backend) ──────
    canViewSection(sectionName) {
      if (!_role) return false;
      if (_role === ROLES.admin) return true;
      // الأقسام المحظورة على الموظف
      const forbidden = [
        'dashboard', 'payments', 'daily-treasury', 'shifts',
        'backup', 'analytics', 'certificates', 'hall',
        'platform-codes', 'platform-activation',
      ];
      return !forbidden.includes(sectionName);
    },

    // ─── تسجيل في Activity Log ──────────────────────────────
    log(action, details = '') {
      const entry = {
        id: Date.now(),
        role: _role,
        action,
        details,
        time: new Date().toISOString(),
      };
      try {
        const logs = JSON.parse(localStorage.getItem('activity_log') || '[]');
        logs.unshift(entry);
        if (logs.length > 500) logs.splice(500);
        localStorage.setItem('activity_log', JSON.stringify(logs));
      } catch(e) {}
    },
  };
})();

// ─── RBAC Guard للحذف ────────────────────────────────────────
function rbacGuardDelete(actionName = 'الحذف') {
  if (!RBAC.canDelete()) {
    showNotification(`⛔ الموظف لا يملك صلاحية ${actionName}. يرجى مراجعة المشرف.`, 'error');
    RBAC.log('delete_denied', actionName);
    return false;
  }
  return true;
}

// تصدير عالمي
window.rbacGuardDelete = rbacGuardDelete;
window.RBAC = RBAC;
// selectLoginRole: removed

// ─── CSS للموظف: إخفاء أزرار الحذف ──────────────────────────
(function injectRBACStyles() {
  const style = document.createElement('style');
  style.id = 'rbac-styles';
  style.textContent = `
    /* إخفاء أزرار الحذف للموظف */
    body.rbac-employee .btn-delete,
    body.rbac-employee [onclick*="deleteStudent"],
    body.rbac-employee [onclick*="deleteGroup"],
    body.rbac-employee [onclick*="deleteExam"],
    body.rbac-employee [onclick*="deletePayment"],
    body.rbac-employee [onclick*="deleteExpense"],
    body.rbac-employee [onclick*="deleteScore"],
    body.rbac-employee [onclick*="clearAllData"],
    body.rbac-employee [onclick*="restoreBackup"],
    body.rbac-employee [onclick*="showPasswordManagement"],
    body.rbac-employee .admin-only-btn { display: none !important; }

    /* Role badge في login screen */
    #role-btn-employee.active-role,
    #role-btn-admin.active-role {
      background: rgba(255,255,255,0.35) !important;
      border-color: rgba(255,255,255,0.8) !important;
      box-shadow: 0 0 0 3px rgba(255,255,255,0.25);
      transform: scale(1.05);
    }
  `;
  document.head.appendChild(style);
})();

// selectLoginRole: محذوفة — النظام يتعرف على الدور من الباسورد تلقائياً

// ─── وظائف مزامنة المنصة للموظف (مبسّطة) ──────────────────

// ✅ تم إلغاء employeeExportStudents / employeeSyncPending / employeeSyncPlatform
// بالكامل — كانت وظائف مساعدة لقسم "مزامنة المنصة للموظف" اللي اعتمد على Firebase

/**
 * نظام إدارة الدروس v2.0 - Core Intelligence Engine
 * Specialized for Mr. Mohamed's Education Center
 */

// --- Database & Persistence ---
// --- Database & Persistence ---
let currentGrade = localStorage.getItem('edu_active_grade') || null;
let currentGroupId = localStorage.getItem('edu_active_group') || null;

/**
 * ✅ إصلاح باج "تغيّر المجموعة تلقائيًا":
 * أي دالة كانت بتعيد بناء innerHTML لـ <select> فلتر مجموعة كانت بتفقد
 * اختيار المستخدم اليدوي وترجع لـ currentGroupId (المجموعة النشطة globally)
 * بمجرد ما أي مزامنة/تايمر خلفي (مزامنة كل 5 دقايق، أرشفة كل دقيقة، ...)
 * يستدعي refreshGroupContexts().
 *
 * الدالة دي بتحفظ قيمة الـ select قبل إعادة البناء، وبعد الرندر بترجّع
 * نفس القيمة القديمة لو لسه موجودة ضمن الخيارات، بدل ما ترجع تلقائيًا
 * لـ currentGroupId. لو مفيش قيمة محفوظة (أول تحميل)، بترجع للسلوك
 * الافتراضي القديم (fallbackValue).
 *
 * @param {HTMLSelectElement} selectEl
 * @param {Function} rebuildFn  - دالة بترجع الـ innerHTML الجديد (string)
 * @param {string} [fallbackValue] - القيمة الافتراضية لو مفيش اختيار سابق
 */
function rebuildSelectPreservingSelection(selectEl, rebuildFn, fallbackValue) {
    if (!selectEl) return;
    const previousValue = selectEl.value; // احفظ اختيار المستخدم الحالي
    selectEl.innerHTML = rebuildFn();

    const hasPrevious = previousValue &&
        Array.from(selectEl.options).some(o => o.value === previousValue);

    if (hasPrevious) {
        selectEl.value = previousValue; // رجّع نفس اختيار المستخدم
    } else if (fallbackValue != null) {
        const hasFallback = Array.from(selectEl.options).some(o => o.value === String(fallbackValue));
        if (hasFallback) selectEl.value = String(fallbackValue);
    }
}

/**
 * ✅ ترتيب أبجدي موحّد للطلاب يُستخدم في كل مكان بالنظام (رصد الدرجات، الطباعة، كشوف
 * المجموعات، ...) بحيث يكون نفس الترتيب دايمًا مهما كانت الشاشة. لا تستخدم .sort()
 * مباشرة على قوائم الطلاب في أي مكان جديد - استخدم الدالة دي بدلاً منها.
 * @param {Array} students
 * @returns {Array} نفس المصفوفة بعد الترتيب (in-place، زي Array.prototype.sort)
 */
function sortStudentsArabic(students) {
    return students.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));
}

/** 
 * --- ULTRA ROYAL STORAGE ENGINE (IndexedDB) ---
 * Optimized for handling 1,000,000+ students without hanging
 */
const StorageEngine = {
    db: null,
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("EduMasterLargeDB", 5);
            request.onerror = (e) => reject("IndexedDB error: " + e.target.errorCode);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("students")) {
                    const store = db.createObjectStore("students", { keyPath: "id" });
                    store.createIndex("qrCode", "qrCode", { unique: true });
                    store.createIndex("grade", "grade", { unique: false });
                    store.createIndex("groupId", "groupId", { unique: false });
                    store.createIndex("name", "name", { unique: false });
                }
                const tables = ['attendance', 'exams', 'scores', 'expenses', 'handouts', 'studentHandouts', 'materials', 'quizzes', 'rewards', 'payments', 'waQueue', 'groups', 'cycles', 'absenceSessions', 'dailyTreasuryArchives', 'staff', 'shifts', 'courseCodes', 'platformCourses', 'platformSubscriptions'];
                tables.forEach(t => {
                    if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: "id" });
                });
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
        });
    },

    async getAll(storeName) {
        return new Promise((resolve) => {
            if (!this.db || !this.db.objectStoreNames.contains(storeName)) {
                console.warn(`Store ${storeName} not found or DB not ready.`);
                return resolve([]);
            }
            const transaction = this.db.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        });
    },

    async getPaged(storeName, filter = {}, page = 0, pageSize = 50, searchTerm = '') {
        return new Promise((resolve) => {
            const transaction = this.db.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.openCursor();
            const results = [];
            let counter = 0;
            const skip = page * pageSize;
            let matchedFoundSoFar = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (!cursor) {
                    resolve({ data: results, hasMore: false });
                    return;
                }

                const val = cursor.value;

                // 1. Structural filtering (grade, group)
                let match = true;
                for (let key in filter) {
                    if (filter[key] && filter[key] !== 'all' && val[key] != filter[key]) {
                        match = false; break;
                    }
                }

                // 2. Search term filtering
                if (match && searchTerm) {
                    const term = searchTerm.toLowerCase();
                    const nameMatch = val.name && val.name.toLowerCase().includes(term);
                    const codeMatch = val.qrCode && val.qrCode.includes(term);
                    const phoneMatch = val.phone && val.phone.includes(term);
                    if (!nameMatch && !codeMatch && !phoneMatch) {
                        match = false;
                    }
                }

                if (match) {
                    if (matchedFoundSoFar >= skip) {
                        results.push(val);
                        counter++;
                        if (counter >= pageSize) {
                            resolve({ data: results, hasMore: true });
                            return;
                        }
                    }
                    matchedFoundSoFar++;
                }

                cursor.continue();
            };
        });
    },

    async save(storeName, data) {
        if (!this.db) await this.init();
        if (!this.db || !this.db.objectStoreNames.contains(storeName)) {
            throw new Error(`قاعدة البيانات غير جاهزة أو جدول ${storeName} غير موجود`);
        }
        if (!Array.isArray(data)) data = [data];
        if (data.length === 0) return;

        // Chunking for massive datasets to prevent transaction timeouts/memory issues
        const CHUNK_SIZE = 5000;
        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
            const chunk = data.slice(i, i + CHUNK_SIZE);
            // ── محاولة 1: إدراج الـ chunk كامل في transaction واحدة ──
            const success = await new Promise((resolve) => {
                const transaction = this.db.transaction([storeName], "readwrite");
                const store = transaction.objectStore(storeName);
                chunk.forEach(item => store.put(item));
                transaction.oncomplete = () => resolve(true);
                transaction.onerror = () => resolve(false);
                transaction.onabort = () => resolve(false);
            });

            // ── محاولة 2 (fallback): إدراج كل سجل منفرداً لتجاوز ConstraintError على unique indexes ──
            if (!success) {
                for (const item of chunk) {
                    await new Promise((resolve) => {
                        const tx = this.db.transaction([storeName], "readwrite");
                        const st = tx.objectStore(storeName);
                        // إذا كان الجدول "students" وفيه unique index على qrCode،
                        // نحذف السجل القديم بنفس الـ qrCode أولاً ثم نُضيف الجديد
                        if (storeName === 'students' && item.qrCode) {
                            const idxReq = st.index('qrCode').getKey(item.qrCode);
                            idxReq.onsuccess = (e) => {
                                const existingKey = e.target.result;
                                if (existingKey !== undefined && existingKey !== item.id) {
                                    // حذف السجل القديم بالـ qrCode المتكرر قبل الإضافة
                                    st.delete(existingKey);
                                }
                                st.put(item);
                            };
                            idxReq.onerror = () => { st.put(item); };
                        } else {
                            st.put(item);
                        }
                        tx.oncomplete = () => resolve();
                        tx.onerror = () => resolve();   // تجاهل الخطأ ومتابعة باقي السجلات
                        tx.onabort = () => resolve();
                    });
                }
            }
        }
        if (typeof CloudSync !== 'undefined' && CloudSync.isReady && CloudSync.isReady()) {
            try { CloudSync.onLocalSave(storeName); } catch (e) { console.warn('[CloudSync] onLocalSave failed', e); }
        }
    },

    async delete(storeName, id) {
        if (!this.db) await this.init();
        if (!this.db || !this.db.objectStoreNames.contains(storeName)) return;
        const transaction = this.db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.delete(id);
        await new Promise((resolve) => transaction.oncomplete = () => resolve());
        if (typeof CloudSync !== 'undefined' && CloudSync.isReady && CloudSync.isReady()) {
            try { CloudSync.onLocalSave(storeName); } catch (e) { console.warn('[CloudSync] onLocalSave failed', e); }
        }
    },

    async clear(storeName) {
        if (!this.db) await this.init();
        if (!this.db || !this.db.objectStoreNames.contains(storeName)) return;
        const transaction = this.db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.clear();
        await new Promise((resolve) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => resolve();
            transaction.onabort = () => resolve();
        });
    },

    async get(storeName, id) {
        return new Promise((resolve) => {
            if (!this.db || !this.db.objectStoreNames.contains(storeName)) return resolve(null);
            const transaction = this.db.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
    },

    async count(storeName, filter = {}) {
        return new Promise((resolve) => {
            if (!this.db || !this.db.objectStoreNames.contains(storeName)) return resolve(0);
            const transaction = this.db.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => {
                let items = request.result || [];
                for (let key in filter) {
                    const val = filter[key];
                    if (val !== 'all' && val !== '' && val !== null && val !== undefined) {
                        items = items.filter(i => String(i[key]) === String(val));
                    }
                }
                resolve(items.length);
            };
            request.onerror = () => resolve(0);
        });
    }
};

const db = {
    students: [],
    attendance: [],
    exams: [],
    scores: [],
    expenses: [],
    handouts: [],
    studentHandouts: [],
    materials: [],
    quizzes: [],
    rewards: [],
    payments: [],
    waQueue: [],
    groups: [],
    cycles: [],
    absenceSessions: [],
    dailyTreasuryArchives: [],
    courseCodes: [],
    platformCourses: [],
    platformSubscriptions: [],
    dailyTreasuryLastArchiveDate: null,
    staff: [],
    shifts: [],
    _settings: {},

    // Dynamic settings getter based on active grade
    get settings() {
        const grade = currentGrade || 'default';
        const group = currentGroupId || 'all';
        const key = group === 'all' ? grade : `${grade}_${group}`;
        
        if (!this._settings[key]) {
            const legacy = this._settings[grade];
            this._settings[key] = legacy ? JSON.parse(JSON.stringify(legacy)) : {
                isMonthlyActive: false,
                monthlyFee: 0,
                centerCommissionPercent: 0,
                monthlyCollected: 0,
                monthlyCycleName: '',
                activeCycle: null,
                treasurySessionResetTime: {},
                platformSubscriptionFee: 100,
                cycleSubscriptionType: 'lesson',
                activePlatformCourse: null
            };
        }
        return this._settings[key];
    },

    async load() {
        await StorageEngine.init();
        // 🔧 إصلاح: كانت هذه القائمة تفتقد 'staff' و 'shifts'، ما يعني أن بيانات
        // الموظفين والورديات كانت تُفقد بصمت عند أول فتح للتطبيق من نسخة data.js
        // على متصفح/جهاز جديد (auto-hydration) وأثناء ترحيل البيانات القديمة.
        // تُبنى القائمة الآن ديناميكياً من كل الجداول المسجّلة فعلياً في IndexedDB
        // حتى تشمل تلقائياً أي جدول يُضاف مستقبلاً دون الحاجة لتعديل هذا الكود.
        const STATIC_TABLES_FALLBACK = ['students', 'attendance', 'exams', 'scores', 'expenses', 'handouts', 'studentHandouts', 'materials', 'quizzes', 'rewards', 'payments', 'waQueue', 'groups', 'cycles', 'absenceSessions', 'dailyTreasuryArchives', 'staff', 'shifts', 'courseCodes', 'platformCourses', 'platformSubscriptions'];
        const tables = (StorageEngine.db && StorageEngine.db.objectStoreNames)
            ? Array.from(new Set([...Array.from(StorageEngine.db.objectStoreNames), ...STATIC_TABLES_FALLBACK]))
            : STATIC_TABLES_FALLBACK;

        // 1. Read active grade/group FIRST
        currentGrade = localStorage.getItem('edu_active_grade') || null;
        currentGroupId = localStorage.getItem('edu_active_group') || null;

        // تطبيع currentGrade: لو محفوظ كـ gradesList ID رقمي (مثل 303) حوّله لـ systemCode (مثل '3')
        if (currentGrade) {
            const TABLE = {'301':'1','302':'2','303':'3','201':'prep1','202':'prep2','203':'prep3','101':'prim1','102':'prim2','103':'prim3','104':'prim4','105':'prim5','106':'prim6'};
            if (TABLE[currentGrade]) {
                currentGrade = TABLE[currentGrade];
                localStorage.setItem('edu_active_grade', currentGrade);
            }
        }

        // 2. Check if DB is completely empty (fresh browser / new device)
        const allGroups = await StorageEngine.getAll('groups');
        const isDbEmpty = allGroups.length === 0;

        // 3. Auto-Hydration from data.js when DB is empty - ONLY on first-ever initialization
        // This flag ensures we only hydrate once, not every time data is cleared
        const hasEverInitialized = localStorage.getItem('edu_app_initialized') === 'true';
        const initialData = window.edu_initial_data || {};
        if (isDbEmpty && !hasEverInitialized && Object.keys(initialData).length > 0) {
            console.log('Fresh DB. Hydrating from data.js...');
            for (const table of tables) {
                if (initialData[table] && Array.isArray(initialData[table]) && initialData[table].length > 0) {
                    await StorageEngine.save(table, initialData[table]);
                }
            }
            if (initialData.settings) {
                localStorage.setItem('edu_master_settings', JSON.stringify(initialData.settings));
            }
            if (initialData.gradesList) {
                localStorage.setItem('edu_grades_list', JSON.stringify(initialData.gradesList));
            }
            // Restore grade/group context
            if (initialData.activeGrade) localStorage.setItem('edu_active_grade', initialData.activeGrade);
            if (initialData.activeGroup) localStorage.setItem('edu_active_group', initialData.activeGroup);
            // 🔧 إصلاح: استعادة كل مفاتيح localStorage الأخرى المحفوظة داخل data.js
            // (الثيمات، قوالب واتساب، جلسات التصحيح النشطة، إلخ) وليس فقط settings/gradesList
            if (initialData.ls && typeof initialData.ls === 'object') {
                Object.entries(initialData.ls).forEach(([k, v]) => {
                    if (v !== null && v !== undefined) localStorage.setItem(k, String(v));
                });
            }
            localStorage.setItem('edu_app_initialized', 'true');
            console.log('Hydration complete. Reloading...');
            setTimeout(() => location.reload(), 300);
            return;
        }
        
        // Mark as initialized even if no hydration happened
        if (!hasEverInitialized) {
            localStorage.setItem('edu_app_initialized', 'true');
        }

        // 4. Migration from old localStorage single-dump
        const raw = localStorage.getItem('edu_master_db');
        if (raw) {
            console.log('Migrating legacy localStorage data to IndexedDB...');
            try {
                const master = JSON.parse(raw);
                for (const table of tables) {
                    if (master[table] && Array.isArray(master[table]) && master[table].length > 0) {
                        await StorageEngine.save(table, master[table]);
                    }
                }
                if (master.settings) {
                    localStorage.setItem('edu_master_settings', JSON.stringify(master.settings));
                }
                if (master.gradesList) {
                    localStorage.setItem('edu_grades_list', JSON.stringify(master.gradesList));
                }
            } catch (e) { console.error('Legacy migration failed', e); }
            localStorage.removeItem('edu_master_db');
        }

        // 5. Load ALL data into memory
        const masterSettings = JSON.parse(localStorage.getItem('edu_master_settings')) || {};
        this._settings = masterSettings;
        this.groups = await StorageEngine.getAll('groups');
        this.cycles = await StorageEngine.getAll('cycles');
        this.students = await StorageEngine.getAll('students');
        this.attendance = await StorageEngine.getAll('attendance');
        this.payments = await StorageEngine.getAll('payments');
        this.expenses = await StorageEngine.getAll('expenses');
        this.exams = await StorageEngine.getAll('exams');
        this.scores = await StorageEngine.getAll('scores');
        this.dailyTreasuryArchives = await StorageEngine.getAll('dailyTreasuryArchives');
        this.courseCodes = await StorageEngine.getAll('courseCodes');
        this.platformCourses = await StorageEngine.getAll('platformCourses');
        this.platformSubscriptions = await StorageEngine.getAll('platformSubscriptions');
        this.dailyTreasuryLastArchiveDate = localStorage.getItem('dailyTreasuryLastArchiveDate');
        this.handouts = await StorageEngine.getAll('handouts');
        this.studentHandouts = await StorageEngine.getAll('studentHandouts');
        this.materials = await StorageEngine.getAll('materials');
        this.quizzes = await StorageEngine.getAll('quizzes');
        this.rewards = await StorageEngine.getAll('rewards');
        this.waQueue = await StorageEngine.getAll('waQueue');
        this.absenceSessions = await StorageEngine.getAll('absenceSessions');
        this.staff = await StorageEngine.getAll('staff');
        this.shifts = await StorageEngine.getAll('shifts');

        // Refresh global gradesList variable from localStorage (مع ضمان الـ 12 الثابتة)
        const storedGrades = localStorage.getItem('edu_grades_list');
        try {
            const parsed = storedGrades ? JSON.parse(storedGrades) : null;
            gradesList = buildGradesList(parsed);
            window.gradesList = gradesList;
            localStorage.setItem('edu_grades_list', JSON.stringify(gradesList));
        } catch (e) {
            gradesList = buildGradesList(null);
            window.gradesList = gradesList;
        }

        // ── إضافة المجاميع الافتراضية مرة واحدة فقط عند أول تشغيل ──
        // ملحوظة: كانت هذه المجاميع (g2a-g2c, g3a-g3c) تُعاد إضافتها في
        // كل تحميل حتى لو حذفها المستخدم عمداً، وهو ما كان يمنع حذفها
        // فعلياً بشكل دائم. الآن تُزرع مرة واحدة فقط لأول تشغيل، وبعد
        // ذلك يبقى قرار حذفها للمستخدم نهائياً دون إعادة إنشائها.
        if (!localStorage.getItem('_defaultGroupsSeeded')) {
            const bookingIds = ['g2a','g2b','g2c','g3a','g3b','g3c'];
            const missingGroups = bookingIds.filter(bid => !this.groups.find(g => String(g.id) === bid));
            if (missingGroups.length > 0) {
                const DEFS = [
                    { id:'g2a', name:'مجموعة A — ثاني ثانوي', days:'السبت والثلاثاء',  time:'٤:٠٠ م — ٦:٠٠ م', grade:'2', price:350 },
                    { id:'g2b', name:'مجموعة B — ثاني ثانوي', days:'الأحد والأربعاء',  time:'٥:٠٠ م — ٧:٠٠ م', grade:'2', price:350 },
                    { id:'g2c', name:'مجموعة C — ثاني ثانوي', days:'الاثنين والخميس', time:'٦:٠٠ م — ٨:٠٠ م', grade:'2', price:350 },
                    { id:'g3a', name:'مجموعة A — ثالث ثانوي', days:'السبت والثلاثاء',  time:'٢:٠٠ م — ٤:٠٠ م', grade:'3', price:400 },
                    { id:'g3b', name:'مجموعة B — ثالث ثانوي', days:'الأحد والأربعاء',  time:'٣:٠٠ م — ٥:٠٠ م', grade:'3', price:400 },
                    { id:'g3c', name:'مجموعة C — ثالث ثانوي', days:'الاثنين والخميس', time:'٧:٠٠ م — ٩:٠٠ م', grade:'3', price:400 },
                ];
                const toAdd = [];
                for (const def of DEFS) {
                    if (!this.groups.find(g => String(g.id) === def.id)) {
                        this.groups.push({ ...def });
                        toAdd.push({ ...def });
                    }
                }
                if (toAdd.length) await StorageEngine.save('groups', toAdd);
            }
            localStorage.setItem('_defaultGroupsSeeded', '1');
        }

        if (typeof renderStudents === 'function') renderStudents();
        if (typeof syncUIWithContext === 'function') syncUIWithContext();
    },

    async save(modifiedTable = null) {
        if (modifiedTable) {
            await StorageEngine.save(modifiedTable, this[modifiedTable]);
        } else {
            // Default: Save all tables including massive students table
            const tables = (StorageEngine.db && StorageEngine.db.objectStoreNames)
                ? Array.from(StorageEngine.db.objectStoreNames)
                : ['students', 'attendance', 'exams', 'scores', 'expenses', 'handouts', 'studentHandouts', 'materials', 'quizzes', 'rewards', 'payments', 'waQueue', 'groups', 'cycles', 'absenceSessions', 'dailyTreasuryArchives', 'staff', 'shifts', 'courseCodes', 'platformCourses', 'platformSubscriptions'];
            for (const table of tables) {
                if (Array.isArray(this[table])) await StorageEngine.save(table, this[table]);
            }
        }

        localStorage.setItem('edu_master_settings', JSON.stringify(this._settings));
        if (currentGrade) localStorage.setItem('edu_active_grade', currentGrade);
        if (currentGroupId) localStorage.setItem('edu_active_group', currentGroupId);
        if (this.dailyTreasuryLastArchiveDate) localStorage.setItem('dailyTreasuryLastArchiveDate', this.dailyTreasuryLastArchiveDate);

        if (typeof updateDataInFile === 'function') updateDataInFile();

        // ── مزامنة سحابية (Firestore) — best effort، لا توقف أي شيء لو فشلت ──
        if (typeof CloudSync !== 'undefined' && CloudSync.isReady && CloudSync.isReady()) {
            try { CloudSync.onLocalSave(modifiedTable); } catch (e) { console.warn('[CloudSync] onLocalSave failed', e); }
        }
    }
};

let appBootPromise = null;

function showStartupError(err) {
    console.error('Application startup failed', err);
    const errorBox = document.getElementById('password-error');
    if (errorBox) {
        errorBox.style.display = 'block';
        errorBox.innerHTML = '<i class="fas fa-exclamation-triangle"></i> تعذر تشغيل قاعدة البيانات. أعد تحميل الصفحة أو افتح البرنامج من المتصفح مرة أخرى.';
    }
    if (typeof showNotification === 'function') {
        showNotification('تعذر تحميل بيانات البرنامج. برجاء إعادة فتح الصفحة.', 'error');
    }
}

function ensureAppLoaded() {
    if (!appBootPromise) {
        appBootPromise = db.load().catch(err => {
            showStartupError(err);
            throw err;
        });
    }
    return appBootPromise;
}

// --- AUTOMATIC FILE SYSTEM SYNC (For Local Portability) ---
let directoryHandle = null;
let examScanner = null;

async function updateDataInFile() {
    if (!directoryHandle) return;
    try {
        const fileHandle = await directoryHandle.getFileHandle('edumaster_data.json', { create: true });
        const writable = await fileHandle.createWritable();

        const snapshot = {};
        const tables = ['students', 'attendance', 'exams', 'scores', 'expenses', 'handouts', 'studentHandouts', 'materials', 'quizzes', 'rewards', 'payments', 'waQueue', 'groups', 'cycles', 'absenceSessions', 'dailyTreasuryArchives', 'staff', 'shifts', 'courseCodes', 'platformCourses', 'platformSubscriptions'];
        tables.forEach(t => snapshot[t] = db[t]);
        snapshot.settings = db._settings;
        snapshot.gradesList = gradesList;
        snapshot.dailyTreasuryLastArchiveDate = db.dailyTreasuryLastArchiveDate;

        await writable.write(JSON.stringify(snapshot, null, 2));
        await writable.close();

        const status = document.getElementById('sync-status');
        const indicator = document.getElementById('sync-indicator');
        if (status) status.innerText = 'متصل - تم الحفظ تلقائياً';
        if (indicator) indicator.style.background = '#22c55e';
    } catch (err) {
        console.error('Auto-save failed', err);
        const status = document.getElementById('sync-status');
        const indicator = document.getElementById('sync-indicator');
        if (status) status.innerText = 'خطأ في الحفظ!';
        if (indicator) indicator.style.background = '#ef4444';
    }
}

function normalizeIdentityValue(value) {
    return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function pickFirstValue(record, keys) {
    for (const key of keys) {
        const value = record?.[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return '';
}

function buildRecordIdentity(table, record) {
    if (!record || typeof record !== 'object') return '';

    // أرشيف العهدة اليومية: تطابق بالتاريخ + المجموعة + اسم الجلسة
    if (table === 'dailyTreasuryArchives') {
        const date    = normalizeIdentityValue(record.date || '');
        const grade   = normalizeIdentityValue(record.grade || '');
        const groupId = normalizeIdentityValue(record.groupId || '');
        const session = normalizeIdentityValue(record.sessionName || '');
        if (date) return `${table}:natural:${date}|${grade}|${groupId}|${session}`;
    }

    if (table === 'students') {
        const nationalId = pickFirstValue(record, ['nationalId', 'nationalID', 'nid', 'studentNationalId']);
        if (nationalId) return `${table}:national:${normalizeIdentityValue(nationalId)}`;

        const code = pickFirstValue(record, ['qrCode', 'code', 'studentCode', 'barcode']);
        if (code) return `${table}:code:${normalizeIdentityValue(code)}`;

        const name = pickFirstValue(record, ['name', 'studentName']);
        const phone = pickFirstValue(record, ['phone', 'parentPhone', 'studentPhone']);
        const grade = pickFirstValue(record, ['grade', 'stage']);
        if (name && (phone || grade)) {
            return `${table}:natural:${normalizeIdentityValue(name)}|${normalizeIdentityValue(phone)}|${normalizeIdentityValue(grade)}`;
        }
    }

    // المجموعات: تطابق بالاسم + الصف + الوقت (بالإضافة للـ id)
    if (table === 'groups') {
        const name = pickFirstValue(record, ['name', 'title']);
        const grade = pickFirstValue(record, ['grade', 'gradeId']);
        const time = pickFirstValue(record, ['time', 'startTime', 'dayTime']);
        if (name && grade) {
            return `${table}:natural:${normalizeIdentityValue(name)}|${normalizeIdentityValue(grade)}|${normalizeIdentityValue(time)}`;
        }
    }

    if (['attendance', 'payments', 'expenses', 'scores', 'studentHandouts', 'rewards'].includes(table)) {
        // 🔧 الإصلاح: للحضور، نضيف التوقيت الدقيق (timestamp) أو ID فريد لتمييز كل حضور عن الآخر
        // هذا يضمن أن حضور الطالب 5 مرات في نفس اليوم سيتم احتسابها كـ 5 حضورات منفصلة
        const studentId = pickFirstValue(record, ['studentId', 'studentID', 'student']);
        const date = pickFirstValue(record, ['date', 'createdAt', 'day']);
        const amount = pickFirstValue(record, ['amount', 'value', 'paid', 'total']);
        const kind = pickFirstValue(record, ['type', 'status', 'examId', 'handoutId', 'description', 'note', 'title', 'reason']);
        const extra = pickFirstValue(record, ['cycleId', 'sessionId', 'month', 'grade', 'groupId']);
        
        // للحضور: أضف التوقيت الدقيق أو الوقت لجعل كل حضور فريد
        if (table === 'attendance') {
            const timestamp = pickFirstValue(record, ['timestamp', 'time', 'checkInTime', 'checkedAt']);
            const uniqueId = pickFirstValue(record, ['id', '_id', 'uniqueId']);
            if (studentId || date) {
                // ⭐ النقطة الحساسة: كل حضور له timestamp/time فريد أو id فريد
                return `${table}:natural:${normalizeIdentityValue(studentId)}|${normalizeIdentityValue(date)}|${normalizeIdentityValue(timestamp || uniqueId)}`;
            }
        }
        
        if (studentId || date || amount || kind || extra) {
            return `${table}:natural:${normalizeIdentityValue(studentId)}|${normalizeIdentityValue(date)}|${normalizeIdentityValue(amount)}|${normalizeIdentityValue(kind)}|${normalizeIdentityValue(extra)}`;
        }
    }

    const id = pickFirstValue(record, ['id', '_id']);
    if (id) return `${table}:id:${normalizeIdentityValue(id)}`;

    const title = pickFirstValue(record, ['name', 'title']);
    const date = pickFirstValue(record, ['date', 'createdAt']);
    const grade = pickFirstValue(record, ['grade', 'groupId']);
    if (title || date || grade) {
        return `${table}:natural:${normalizeIdentityValue(title)}|${normalizeIdentityValue(date)}|${normalizeIdentityValue(grade)}`;
    }

    return `${table}:json:${normalizeIdentityValue(JSON.stringify(record))}`;
}

async function mergeTableWithoutDuplicates(table, incomingRows) {
    if (!Array.isArray(incomingRows) || incomingRows.length === 0) {
        return { added: 0, updated: 0, skipped: 0 };
    }

    const existingRows = await StorageEngine.getAll(table);
    const byIdentity = new Map();
    const byId = new Map();
    // خريطة إعادة ربط IDs المجموعات: oldId → newId (تُستخدم فقط للمجموعات)
    const groupIdRemap = {};
    let added = 0;
    let updated = 0;
    let skipped = 0;

    existingRows.forEach(row => {
        const identity = buildRecordIdentity(table, row);
        if (identity) byIdentity.set(identity, row);
        if (row?.id !== undefined && row?.id !== null) byId.set(String(row.id), row);
    });

    for (const incoming of incomingRows) {
        if (!incoming || typeof incoming !== 'object') {
            skipped++;
            continue;
        }

        const identity = buildRecordIdentity(table, incoming);
        const current = identity ? byIdentity.get(identity) : null;

        if (current) {
            // ── للمجموعات: الموجود يكسب — نحافظ على الـ id المحلي ولا نستبدله ──
            // إذا جاء الـ incoming بـ id مختلف عن الموجود نُسجّل الـ remap
            if (table === 'groups' && current.id !== undefined && incoming.id !== undefined &&
                String(current.id) !== String(incoming.id)) {
                groupIdRemap[String(incoming.id)] = String(current.id);
                // ندمج لكن نحتفظ بالـ id المحلي
                const merged = Object.assign({}, incoming, current); // current يكسب الـ id
                await StorageEngine.save(table, merged);
                byId.set(String(current.id), merged);
                byIdentity.set(identity, merged);
            } else {
                const merged = Object.assign({}, current, incoming);
                await StorageEngine.save(table, merged);
                if (merged.id !== undefined && merged.id !== null) byId.set(String(merged.id), merged);
                if (identity) byIdentity.set(identity, merged);
            }
            updated++;
            continue;
        }

        if (incoming.id === undefined || incoming.id === null || incoming.id === '') {
            incoming.id = `${table}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        }

        const idKey = String(incoming.id);
        if (byId.has(idKey)) {
            const merged = Object.assign({}, byId.get(idKey), incoming);
            await StorageEngine.save(table, merged);
            byId.set(idKey, merged);
            updated++;
        } else {
            await StorageEngine.save(table, incoming);
            byId.set(idKey, incoming);
            added++;
        }

        const newIdentity = buildRecordIdentity(table, incoming);
        if (newIdentity) byIdentity.set(newIdentity, incoming);
    }

    // ── بعد دمج المجموعات: أعد ربط الطلاب إن تغيّرت أي IDs ──────
    if (table === 'groups' && Object.keys(groupIdRemap).length > 0) {
        const allStudents = await StorageEngine.getAll('students');
        const studentsToFix = [];
        allStudents.forEach(s => {
            const remapped = groupIdRemap[String(s.groupId)];
            if (remapped) {
                s.groupId = remapped;
                studentsToFix.push(s);
                // تحديث الذاكرة أيضاً
                const memIdx = (db.students || []).findIndex(ms => ms.id === s.id);
                if (memIdx !== -1) db.students[memIdx].groupId = remapped;
            }
        });
        if (studentsToFix.length > 0) {
            await StorageEngine.save('students', studentsToFix);
            console.log(`[mergeGroups] أُعيد ربط ${studentsToFix.length} طالب بمجموعاتهم الصحيحة بعد الدمج`);
        }
    }

    return { added, updated, skipped };
}

async function hydrateDatabase(dataBlob) {
    if (!dataBlob) {
        console.error('hydrateDatabase: Empty input');
        return false;
    }

    if (!StorageEngine.db) await StorageEngine.init();

    let processedData = null;

    // ── إذا كان dataBlob كائناً مباشراً (من importData الجديد) ──
    if (typeof dataBlob === 'object' && !Array.isArray(dataBlob)) {
        processedData = dataBlob;
    } else if (Array.isArray(dataBlob)) {
        processedData = { students: dataBlob };
    } else if (typeof dataBlob === 'string') {
        const trimmed = dataBlob.trim();
        if (trimmed.length < 10) {
            console.error('hydrateDatabase: String too short');
            return false;
        }

        // Strategy 1: JSON مباشر
        try { processedData = JSON.parse(trimmed); } catch (_) {}

        // Strategy 2: window.edu_initial_data = {...};
        if (!processedData) {
            try {
                const m = trimmed.match(/window\.edu_initial_data\s*=\s*([\s\S]+);/);
                if (m && m[1]) {
                    const jsonStr = m[1].substring(0, m[1].lastIndexOf('}') + 1).trim();
                    processedData = JSON.parse(jsonStr);
                }
            } catch (_) {}
        }

        // Strategy 3: أول { ... } بلوك
        if (!processedData) {
            try {
                const first = trimmed.indexOf('{');
                const last  = trimmed.lastIndexOf('}');
                if (first !== -1 && last > first) {
                    processedData = JSON.parse(trimmed.substring(first, last + 1));
                }
            } catch (_) {}
        }

        // Strategy 4: مصفوفة []
        if (!processedData && trimmed.startsWith('[')) {
            try {
                const arr = JSON.parse(trimmed);
                if (Array.isArray(arr)) processedData = { students: arr };
            } catch (_) {}
        }
    }

    if (!processedData || typeof processedData !== 'object') {
        console.error('hydrateDatabase: All extraction strategies failed.');
        return false;
    }

    // 2. Normalization Strategy
    // Unroll 'db_state' or nested legacy structures
    if (processedData.db_state) {
        let state = processedData.db_state;
        if (typeof state === 'string') { try { state = JSON.parse(state); } catch (e) { } }
        const unrolled = {};
        if (state && typeof state === 'object') {
            Object.keys(state).forEach(key => {
                if (key === 'edu_master_db') {
                    try {
                        const inner = JSON.parse(state[key]);
                        if (typeof inner === 'object') Object.assign(unrolled, inner);
                    } catch (e) { }
                } else {
                    try {
                        unrolled[key] = (typeof state[key] === 'string') ? JSON.parse(state[key]) : state[key];
                    } catch (e) { unrolled[key] = state[key]; }
                }
            });
            processedData = unrolled;
        }
    }

    // ── فك ضغط v3 إذا كان الملف من النظام الجديد ──────────────
    if (processedData.__version__ === 3 && processedData.tables) {
        console.log('[Hydrate] v3 format detected — decompressing...');
        const dict = processedData.__dict__ || [];

        // فك الـ dictionary ثم فك الـ columnar
        const decompressed = {};
        Object.entries(processedData.tables).forEach(([tableName, compressed]) => {
            const withDict = dict.length ? _resolveDict(compressed, dict) : compressed;
            decompressed[tableName] = _decompressTable(tableName, withDict);
        });

        // إعادة بناء processedData بالصيغة العادية لباقي الكود
        Object.assign(processedData, decompressed);

        // استعادة localStorage من ls
        if (processedData.ls && typeof processedData.ls === 'object') {
            const mergedGradesBeforeLS = localStorage.getItem('edu_grades_list');
            Object.entries(processedData.ls).forEach(([k, v]) => {
                if (k === 'edu_grades_list') return; // سيُعالَج أسفله
                if (v !== null && v !== undefined) localStorage.setItem(k, String(v));
            });
            if (mergedGradesBeforeLS) localStorage.setItem('edu_grades_list', mergedGradesBeforeLS);
        }

        console.log('[Hydrate] v3 decompression done. Tables:', Object.keys(decompressed).map(t => `${t}:${decompressed[t].length}`).join(', '));
    }

    // 3. Robust Chunked Table Import
    // 🔧 إصلاح جوهري: القائمة كانت ثابتة (hardcoded) في أكثر من مكان بالكود
    // بدون تزامن بينها؛ أي جدول جديد يُضاف مستقبلاً كان سيُستبعد بصمت من
    // الاستعادة. تُبنى القائمة الآن من (كل الجداول الموجودة فعلياً في IndexedDB)
    // ∪ (كل مفتاح في ملف النسخة الاحتياطية نفسه يحتوي مصفوفة) ∪ (قائمة احتياطية ثابتة)
    const STATIC_FALLBACK_TABLES = ['students', 'attendance', 'exams', 'scores', 'expenses', 'handouts', 'studentHandouts', 'materials', 'quizzes', 'rewards', 'payments', 'waQueue', 'groups', 'cycles', 'absenceSessions', 'dailyTreasuryArchives', 'staff', 'shifts', 'courseCodes', 'platformCourses', 'platformSubscriptions'];
    const dbTableNames = (StorageEngine.db && StorageEngine.db.objectStoreNames) ? Array.from(StorageEngine.db.objectStoreNames) : [];
    const backupTableNames = Object.keys(processedData || {}).filter(k => Array.isArray(processedData[k]));
    const tables = Array.from(new Set([...dbTableNames, ...backupTableNames, ...STATIC_FALLBACK_TABLES]));
    let tablesImported = 0;
    let totalAdded = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const failedTables = []; // 🔧 لتسجيل أي جدول فشل استيراده دون إيقاف باقي الجداول

    showNotification('جاري قراءة البيانات... يرجى الانتظار ولا تغلق المتصفح', 'info');

    for (const table of tables) {
        try {
            // Look for the data under multiple naming conventions
            const dataArray = processedData[table] ||
                processedData[`edu_${table}`] ||
                (table === 'dailyTreasuryArchives' ? (processedData.dailyTreasury || processedData.dailyTreasuryArchives) : null) ||
                (table === 'payments' ? (processedData.studentPayments || processedData.allPayments) : null) ||
                (table === 'students' && Array.isArray(processedData) ? processedData : null);

            if (dataArray && Array.isArray(dataArray) && dataArray.length > 0) {
                console.log(`⏳ استيراد جدول "${table}"... (${dataArray.length} عنصر)`);
                const result = await mergeTableWithoutDuplicates(table, dataArray);
                if (result.added > 0 || result.updated > 0) tablesImported++;
                totalAdded += result.added;
                totalUpdated += result.updated;
                totalSkipped += result.skipped;
                console.log(`✅ جدول "${table}": +${result.added} جديد, ${result.updated} محدّث, ${result.skipped} تخطي`);
            } else if (dataArray && Array.isArray(dataArray)) {
                console.log(`⚠️ جدول "${table}": فارغ (0 عنصر)`);
            }
        } catch (tableError) {
            // ⭐ الإصلاح الأهم: فشل استيراد جدول واحد (مثلاً بسبب اختلاف نسخة
            // قاعدة البيانات بين الجهازين) لم يعد يوقف استيراد بقية الجداول.
            // سابقاً كان أي خطأ هنا يوقف الحلقة بالكامل، فتُفقد كل الجداول التالية
            // (وهذا يفسر اختفاء الأرشيفات/الاشتراكات وغيرها بعد الاستعادة).
            console.error(`❌ فشل استيراد جدول "${table}":`, tableError);
            failedTables.push(table);
        }
    }

    console.log('📊 ملخص الاستيراد:', { tablesImported, totalAdded, totalUpdated, totalSkipped, failedTables });
    if (failedTables.length > 0) {
        showNotification('⚠️ تعذّر استيراد بعض الجداول: ' + failedTables.join(', ') + ' — راجع الـ Console للتفاصيل', 'error');
    }

    // 4. Persistence of Meta & Settings
    const settings = processedData.settings || processedData.edu_master_settings || processedData.edu_settings;
    if (settings) {
        let incomingSettings = (typeof settings === 'string') ? JSON.parse(settings) : settings;
        const existingSettingsRaw = localStorage.getItem('edu_master_settings');
        let existingSettings = {};
        try { existingSettings = existingSettingsRaw ? JSON.parse(existingSettingsRaw) : {}; } catch (e) { existingSettings = {}; }
        const mergedSettings = Object.assign({}, existingSettings, incomingSettings);
        localStorage.setItem('edu_master_settings', JSON.stringify(mergedSettings));
    }
    const grades = processedData.gradesList || processedData.edu_grades_list || processedData.grades;
    if (grades) {
        let incomingGrades = (typeof grades === 'string') ? JSON.parse(grades) : grades;
        if (!Array.isArray(incomingGrades)) incomingGrades = [];
        const existingGradesRaw = localStorage.getItem('edu_grades_list');
        let existingGrades = [];
        try { existingGrades = existingGradesRaw ? JSON.parse(existingGradesRaw) : []; } catch (e) { existingGrades = []; }
        const combined = [...existingGrades];
        incomingGrades.forEach(g => {
            if (!combined.find(eg => String(eg.id) === String(g.id))) combined.push(g);
        });
        const finalGrades = buildGradesList(combined);
        localStorage.setItem('edu_grades_list', JSON.stringify(finalGrades));
    }

    // v2 localStorageSnapshot support
    const localSnapshot = processedData.localStorageSnapshot || processedData.localStorage || processedData.browserStorage;
    if (localSnapshot && typeof localSnapshot === 'object' && !Array.isArray(localSnapshot)) {
        const mergedGradesBeforeSnapshot = localStorage.getItem('edu_grades_list');
        Object.keys(localSnapshot).forEach(key => {
            const value = localSnapshot[key];
            if (key === 'edu_grades_list') return;
            if (value !== undefined && value !== null) localStorage.setItem(key, String(value));
        });
        if (mergedGradesBeforeSnapshot) localStorage.setItem('edu_grades_list', mergedGradesBeforeSnapshot);
    }

    // استعادة حالة الخزنة اليومية بدقة
    if (processedData.activeGrade) localStorage.setItem('edu_active_grade', processedData.activeGrade);
    if (processedData.activeGroup) localStorage.setItem('edu_active_group', processedData.activeGroup);
    const dtDate = processedData.dailyTreasuryLastArchiveDate ||
        (processedData.ls && processedData.ls['dailyTreasuryLastArchiveDate']);
    if (dtDate) localStorage.setItem('dailyTreasuryLastArchiveDate', dtDate);

    const validDataFound = (tablesImported > 0 || !!settings || !!grades || !!localSnapshot ||
        (processedData && typeof processedData === 'object' && Object.keys(processedData).length > 0));
    return validDataFound;
}

async function loadDataFromFile() {
    if (!directoryHandle) return;
    try {
        const fileHandle = await directoryHandle.getFileHandle('edumaster_data.json');
        const file = await fileHandle.getFile();
        const contents = await file.text();
        if (contents) {
            const success = await hydrateDatabase(contents);
            if (success) {
                await db.load(); // Refresh memory
                if (typeof showNotification === 'function') showNotification('✅ تم مزامنة البيانات من الملف بنجاح', 'success');

                const status = document.getElementById('sync-status');
                const indicator = document.getElementById('sync-indicator');
                const btn = document.getElementById('link-folder-btn');
                if (status) status.innerText = 'متصل - تم المزامنة';
                if (indicator) indicator.style.background = '#22c55e';
                if (btn) {
                    btn.style.background = '#dcfce7';
                    btn.querySelector('span').innerText = 'المجلد مربوط ✅';
                }
            }
        }
    } catch (err) {
        console.log('No existing data file found in linked folder.');
    }
}

async function importFromFolder() {
    try {
        if (!window.showDirectoryPicker) {
            return alert('متصفحك لا يدعم فتح المجلدات. يرجى استخدام Chrome أو Edge.');
        }

        const handle = await window.showDirectoryPicker();
        showNotification('جاري مسح المجلد بحثاً عن ملفات البيانات...', 'info');

        // Scan for common data file names
        const fileNames = ['data.js', 'data (5).js', 'edumaster_data.json', 'edu_master_db.json', 'backup.json'];
        let foundAny = false;

        for (const fName of fileNames) {
            try {
                const fileHandle = await handle.getFileHandle(fName);
                const file = await fileHandle.getFile();
                const text = await file.text();
                const success = await hydrateDatabase(text);
                if (success) foundAny = true;
            } catch (e) {
                // File not found, continue to next
            }
        }

        if (foundAny) {
            directoryHandle = handle; // LINK FOLDER IMMEDIATELY
            showNotification('✅ تم استعادة كافة البيانات وربط المجلد بنجاح. سنقوم بتحديث الصفحة الآن.', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            alert('❌ لم يتم العثور على أي ملفات بيانات صالحة داخل هذا المجلد. تأكد من اختيار المجلد الصحيح الذي يحتوي على ملف data.js');
        }
    } catch (err) {
        console.error('Folder import cancelled/failed', err);
    }
}

// Initialize from external file if localStorage is empty
const initialData = window.edu_initial_data || {};

// ─── الـ 12 مرحلة الثابتة - لا تُحذف ولا تتغير IDs بتاعتها ───
const DEFAULT_GRADES = [
    { id: 101, name: 'الأول الابتدائي',   icon: 'fa-child' },
    { id: 102, name: 'الثاني الابتدائي',  icon: 'fa-child' },
    { id: 103, name: 'الثالث الابتدائي',  icon: 'fa-child' },
    { id: 104, name: 'الرابع الابتدائي',  icon: 'fa-book-open' },
    { id: 105, name: 'الخامس الابتدائي',  icon: 'fa-book-open' },
    { id: 106, name: 'السادس الابتدائي',  icon: 'fa-book-open' },
    { id: 201, name: 'الأول الإعدادي',    icon: 'fa-user-graduate' },
    { id: 202, name: 'الثاني الإعدادي',   icon: 'fa-user-graduate' },
    { id: 203, name: 'الثالث الإعدادي',   icon: 'fa-user-graduate' },
    { id: 301, name: 'الأول الثانوي',     icon: 'fa-university' },
    { id: 302, name: 'الثاني الثانوي',    icon: 'fa-flask' },
    { id: 303, name: 'الثالث الثانوي',    icon: 'fa-graduation-cap' },
];

/**
 * يدمج القائمة المحفوظة مع الـ 12 الثابتة:
 * - الـ 12 دايماً موجودة (بترتيبها)
 * - أي مرحلة مضافة يدوياً (id > 303) تُضاف بعدهم
 */
function buildGradesList(stored) {
    const result = DEFAULT_GRADES.map(def => {
        const saved = stored ? stored.find(s => String(s.id) === String(def.id)) : null;
        return saved ? Object.assign({}, def, saved) : { ...def };
    });
    // أضف المراحل المخصصة (id مش من الـ 12) مع إزالة أي تكرار بالاسم
    if (Array.isArray(stored)) {
        const defaultNames = new Set(DEFAULT_GRADES.map(d => d.name.trim()));
        stored.forEach(s => {
            const isDefaultById   = DEFAULT_GRADES.some(d => String(d.id) === String(s.id));
            const isDefaultByName = s.name && defaultNames.has(s.name.trim());
            if (!isDefaultById && !isDefaultByName) result.push(s);
        });
    }
    return result;
}

let _storedGrades = null;
try { _storedGrades = JSON.parse(localStorage.getItem('edu_grades_list')); } catch(e) {}
let gradesList = buildGradesList(_storedGrades || (initialData && initialData.gradesList));
// احفظ الـ 12 مرة واحدة لو مش موجودين أصلاً
localStorage.setItem('edu_grades_list', JSON.stringify(gradesList));

// تصدير gradesList لتكون متاحة في ملفات JS الأخرى
window.gradesList = gradesList;
window.DEFAULT_GRADES = DEFAULT_GRADES;

let appZoom = parseFloat(localStorage.getItem('app_zoom')) || 1.0;

function applyZoom() {
    document.body.style.zoom = appZoom;
    const zoomVal = document.getElementById('zoom-value');
    if (zoomVal) zoomVal.innerText = `${Math.round(appZoom * 100)}%`;
}

function changeAppZoom(delta) {
    appZoom = Math.min(1.5, Math.max(0.7, appZoom + delta));
    localStorage.setItem('app_zoom', appZoom);
    applyZoom();
}

function resetAppZoom() {
    appZoom = 1.0;
    localStorage.setItem('app_zoom', appZoom);
    applyZoom();
}

// Check if we need to hydrate the db from data.js (if localStorage is empty)
if (!localStorage.getItem('edu_grades_list') && window.edu_initial_data) {
    Object.keys(window.edu_initial_data).forEach(key => {
        if (key !== 'gradesList') {
            const prefix = `g1_`; // Default to first grade for initial hydration
            // This is a simplified logic; in a real app, we'd handle multi-grade hydration
        }
    });
}

function saveGradesList() {
    // تأكد إن الـ 12 المرحلة الثابتة دايماً موجودة قبل الحفظ
    gradesList = buildGradesList(gradesList);
    window.gradesList = gradesList;
    localStorage.setItem('edu_grades_list', JSON.stringify(gradesList));
}

// --- Grade Management ---
function syncUIWithContext() {
    // currentGrade دلوقتي دايماً systemCode — نبحث بـ id أو بالتحويل
    const gradeObj = gradesList.find(g =>
        String(g.id) === String(currentGrade) ||
        gradeIdToSystemCode(String(g.id)) === String(currentGrade)
    );
    const groupObj = db.groups.find(g => String(g.id) === String(currentGroupId));

    const label = gradeObj ? gradeObj.name : 'الصف الدراسي';
    const groupLabel = groupObj ? ` - ${groupObj.name}` : '';

    const badge = document.getElementById('current-grade-badge');
    if (badge) badge.innerText = label + groupLabel;

    const headerGradeLabel = document.getElementById('grade-label');
    if (headerGradeLabel) headerGradeLabel.innerText = label;

    const selGradeTitle = document.getElementById('selected-grade-title');
    if (selGradeTitle) selGradeTitle.innerText = label;

    // Clear search inputs when context changes to ensure search isolation
    const searchInputs = ['group-student-search', 'student-search-input'];
    searchInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = '';
            el.dispatchEvent(new Event('input'));
        }
    });
}

async function selectGrade(gradeId) {
    // ── عزل: مسح السياق القديم ───────────────────────────────
    SessionManager.syncGlobals();   // التنقل بين الصفوف لا يلغي جلسة المجموعة القديمة
    currentGroupId = null;
    activePortalGroupId  = null;
    activePortalGroupIds = [];
    localStorage.removeItem('edu_active_group');

    const sid = String(gradeId);
    const sysCode = gradeIdToSystemCode(sid);
    localStorage.setItem('edu_active_grade', sysCode);
    currentGrade = sysCode;
    await db.load();
    SessionManager.syncGlobals();
    _syncSessionUI();

    syncUIWithContext();

    // Close any previous overlays
    document.getElementById('grade-selection-overlay').style.display = 'none';

    enterPortalMode();
    showPortalStep('group', sid);
    updateExperienceSummary();
}

function renderGroupSelection(gradeId) {
    const container = document.getElementById('group-selection-container');
    const overlay = document.getElementById('group-selection-overlay');
    if (!container || !overlay) return;

    overlay.style.display = 'flex';

    // Ensure we use string comparison for grade IDs
    const gradeGroups = db.groups.filter(g => String(g.grade) === gradeIdToSystemCode(String(gradeId)));

    let html = `
        <div class="grade-card-modern fade-in" onclick="toggleModal('group-modal', true)" style="--accent-color: var(--primary); background: rgba(255,255,255,0.05); border: 2px dashed rgba(255,255,255,0.2);">
            <div class="card-icon-modern" style="background: rgba(255,255,255,0.1);"><i class="fas fa-plus"></i></div>
            <h2>مجموعة جديدة</h2>
            <p>تعريف كود وموعد حصة جديد</p>
            <div class="card-stats-modern">اضغط للإضافة</div>
        </div>
    `;

    html += gradeGroups.map((group, idx) => `
        <div class="grade-card-modern fade-in" onclick="enterGroup('${group.id}')" style="--accent-color: hsl(${200 + idx * 40}, 70%, 50%); animation-delay: ${idx * 0.1}s">
            <div class="card-icon-modern"><i class="fas fa-users"></i></div>
            <h2>${group.name}</h2>
            <p>الموعد: ${group.time}</p>
            <div class="card-stats-modern">${db.students.filter(s => String(s.groupId) === String(group.id)).length} طالب مقيد</div>
        </div>
    `).join('');

    container.innerHTML = html;
}

function enterGroup(groupId) {
    // ── عزل: ضبط الـ context للمجموعة الجديدة ────────────────
    localStorage.setItem('edu_active_group', String(groupId));
    currentGroupId = String(groupId);

    // ── مزامنة الـ globals مع جلسة المجموعة الجديدة ───────────
    // لو المجموعة الجديدة عندها جلسة محفوظة → تُستعاد
    // لو ما عندهاش → الـ globals بتتصفر تلقائياً
    SessionManager.syncGlobals();

    // ── إعادة ضبط الـ UI للجلسة الجديدة ─────────────────────
    _syncSessionUI();

    syncUIWithContext();

    document.getElementById('grade-selection-overlay').style.display = 'none';
    document.getElementById('group-selection-overlay').style.display = 'none';

    showSection('dashboard');
    const groupObj = db.groups.find(g => String(g.id) === String(groupId));
    const label = (gradesList.find(g => g.id == currentGrade) || {}).name || '';
    showNotification(`تم الدخول إلى: ${label} (${groupObj ? groupObj.name : ''})`);

    updateDashboardStats();
    updateExperienceSummary();
}

// ── مزامنة أزرار التشفير مع حالة جلسة المجموعة الحالية ─────────
function _syncSessionUI() {
    const active = SessionManager.isActive();
    const paused = SessionManager.isPaused();

    const startBtn  = document.getElementById('start-session-btn');
    const jointBtn  = document.getElementById('start-joint-session-btn');
    const pauseBtn  = document.getElementById('pause-session-btn');
    const resumeBtn = document.getElementById('resume-session-btn');
    const endBtn    = document.getElementById('end-session-btn');
    const badge     = document.getElementById('session-status-badge');
    const container = document.getElementById('current-session-container');

    if (!startBtn) return; // قسم الحضور مش مفتوح

    if (!active) {
        // لا توجد جلسة → وضع البداية
        startBtn.style.display  = 'inline-flex';
        if (jointBtn) jointBtn.style.display = 'inline-flex';
        pauseBtn.style.display  = 'none';
        resumeBtn.style.display = 'none';
        endBtn.style.display    = 'none';
        if (badge)     badge.style.display     = 'none';
        if (container) container.style.display = 'none';
    } else {
        // جلسة نشطة → وضع التشفير
        startBtn.style.display  = 'none';
        if (jointBtn) jointBtn.style.display = 'none';
        pauseBtn.style.display  = paused ? 'none' : 'inline-flex';
        resumeBtn.style.display = paused ? 'inline-flex' : 'none';
        endBtn.style.display    = 'inline-flex';
        if (badge)     badge.style.display     = 'block';
        if (container) container.style.display = 'block';
        renderSessionTable();
    }
}
window._syncSessionUI = _syncSessionUI;

function showGradeSelection() {
    enterPortalMode();
}

function renderGradesList() {
    const container = document.getElementById('grades-container');
    if (!container) return;

    let html = `
        <div class="grade-card-modern fade-in" onclick="toggleModal('add-grade-modal', true)" style="--accent-color: var(--primary); border: 2px dashed rgba(255,255,255,0.2); background: rgba(255,255,255,0.05);">
            <div class="card-icon-modern" style="background: rgba(255,255,255,0.1);"><i class="fas fa-plus"></i></div>
            <h2>إضافة سنة جديدة</h2>
            <p>قم بتعريف مرحلة دراسية مخصصة</p>
            <div class="card-stats-modern">اضغط للإضافة</div>
        </div>
    `;

    html += gradesList.map((g, idx) => `
        <div class="grade-card-modern fade-in" onclick="selectGrade(${g.id})" style="--accent-color: hsl(${idx * 137.5}, 70%, 60%); border: 1px solid rgba(255,255,255,0.1); animation-delay: ${idx * 0.1}s">
            <div class="card-icon-modern"><i class="fas ${g.icon || 'fa-graduation-cap'}"></i></div>
            <h2>${g.name}</h2>
            <p>إدارة بيانات مستقلة لـ ${g.name}</p>
            <div class="card-stats-modern">اضغط للدخول</div>
            <button class="btn" style="position: absolute; top: 15px; left: 15px; color: rgba(255,255,255,0.2); background: transparent; padding: 5px;" onclick="event.stopPropagation(); deleteGrade(${g.id})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');

    container.innerHTML = html;
}

function addNewGrade() {
    const nameInput = document.getElementById('new-grade-name');
    const name = nameInput.value.trim();
    if (!name) return showNotification('يرجى إدخال مسمى السنة', 'error');

    const newGrade = { id: Date.now(), name, icon: 'fa-graduation-cap' };
    gradesList.push(newGrade);
    window.gradesList = gradesList;
    saveGradesList();
    renderGradesList();

    // Refresh portal if open
    if (document.getElementById('portal-overlay').style.display !== 'none') {
        renderPortalGrades();
    }

    initGradeSelects();
    toggleModal('add-grade-modal', false);
    nameInput.value = '';
    showNotification(`تم إضافة ${name} بنجاح`);
}

async function deleteGrade(id) {
    // الـ 12 مرحلة الثابتة محمية من الحذف
    if (DEFAULT_GRADES.some(d => String(d.id) === String(id))) {
        return showNotification('لا يمكن حذف المراحل الدراسية الأساسية', 'error');
    }
    if (!confirm('هل أنت متأكد من حذف هذه السنة الدراسية؟ سيتم مسح كافة بياناتها نهائياً!')) return;
    gradesList = gradesList.filter(g => g.id != id);
    window.gradesList = gradesList;
    saveGradesList();
    renderGradesList();
    // Clean localStorage
    const prefix = `g${id}_`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) localStorage.removeItem(key);
    }
    // Clean IndexedDB - remove students and groups for this grade
    try {
        const gradeStudents = db.students.filter(s => String(s.grade) === String(id));
        for (const s of gradeStudents) {
            await StorageEngine.delete('students', s.id);
        }
        const gradeGroups = db.groups.filter(g => String(g.grade) === String(id));
        for (const g of gradeGroups) {
            await StorageEngine.delete('groups', g.id);
        }
        db.students = db.students.filter(s => String(s.grade) !== String(id));
        db.groups = db.groups.filter(g => String(g.grade) !== String(id));
        showNotification(`تم حذف السنة الدراسية وكافة بياناتها بنجاح`, 'success');
    } catch (e) {
        console.error('Error cleaning grade data', e);
    }
    if (document.getElementById('portal-overlay').style.display !== 'none') {
        renderPortalGrades();
    }
}

// --- Global State ---
let activeHandoutId = null;
let html5QrCode = null;
let portalScanner = null;
let fastGradingScanner = null; // FIX: declared here to avoid undefined in stopAllCameraScanners
let activePortalGroupId = null; // Track which group is being scanned (Used for both Portal and Internal Joint sessions)
let activePortalGroupIds = []; // NEW: Track multiple groups for Joint Day
let jointSessionContext = null; // 'portal' or 'internal'
let activeGroupDetailId = null; // Track which group is being viewed in detail
let searchScanner = null;
let activeAbsenceSessionId = null; // Track current session in details view

// --- Student List Pagination State ---
let studentListPage = 0;
const studentListPageSize = 50;

// --- Lesson Coding Session State ---
// ══════════════════════════════════════════════════════════════════
//  SESSION MANAGER — عزل كامل لجلسة التشفير لكل مجموعة
//  المفتاح: grade + "_" + groupId  (مثال: "3_42", "prep1_17")
//  كل مجموعة عندها بيانات مستقلة تماماً لا تشاركها أي مجموعة.
// ══════════════════════════════════════════════════════════════════
const SessionManager = {
    _store: {},  // { "grade_gid": { isActive, isPaused, attendance, grade, groupId } }
    _storageKey: 'edu_lesson_coding_sessions',

    _load() {
        try {
            const saved = JSON.parse(localStorage.getItem(this._storageKey) || '{}');
            this._store = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
        } catch (e) {
            console.warn('Unable to load lesson coding sessions', e);
            this._store = {};
        }
    },

    _save() {
        try {
            const activeStore = {};
            Object.entries(this._store).forEach(([key, session]) => {
                if (session && session.isActive) activeStore[key] = session;
            });
            localStorage.setItem(this._storageKey, JSON.stringify(activeStore));
        } catch (e) {
            console.warn('Unable to save lesson coding sessions', e);
        }
    },

    _key(grade, gid) {
        return `${grade || '_'}_${gid || '_'}`;
    },

    // ── جلب جلسة محددة أو إنشاء فارغة ────────────────────────
    _get(grade, gid) {
        const k = this._key(grade, gid);
        if (!this._store[k]) {
            this._store[k] = { isActive: false, isPaused: false, attendance: [], grade, groupId: gid };
        }
        return this._store[k];
    },

    // ── جلسة المجموعة الحالية ─────────────────────────────────
    current() { return this._get(currentGrade, currentGroupId); },

    // ── getters مباشرة لتقصير الكود ───────────────────────────
    isActive()   { return this.current().isActive;   },
    isPaused()   { return this.current().isPaused;   },
    attendance() { return this.current().attendance; },

    // ── بدء جلسة جديدة — يمسح القديمة أولاً ─────────────────
    start() {
        const k = this._key(currentGrade, currentGroupId);
        this._store[k] = {
            isActive:   true,
            isPaused:   false,
            attendance: [],
            grade:      String(currentGrade),
            groupId:    String(currentGroupId),
        };
        // مزامنة المتغيرات العامة للكود القديم
        isLessonCodingActive     = true;
        isLessonCodingPaused     = false;
        currentSessionAttendance = [];
        this._save();
    },

    // ── إيقاف مؤقت ───────────────────────────────────────────
    pause() {
        this.current().isPaused = true;
        isLessonCodingPaused    = true;
        this._save();
    },

    // ── استئناف ──────────────────────────────────────────────
    resume() {
        this.current().isPaused = false;
        isLessonCodingPaused    = false;
        this._save();
    },

    // ── إنهاء وحذف جلسة المجموعة الحالية ────────────────────
    end() {
        const k = this._key(currentGrade, currentGroupId);
        delete this._store[k];
        isLessonCodingActive     = false;
        isLessonCodingPaused     = false;
        currentSessionAttendance = [];
        this._save();
    },

    // ── إضافة طالب (مع تحقق مزدوج grade + group) ────────────
    addStudent(studentObj) {
        const s = this.current();
        if (!s.isActive) return false;
        if (String(studentObj.grade)   !== String(s.grade)  ||
            String(studentObj.groupId) !== String(s.groupId)) return false;
        if (s.attendance.some(x => x.id === studentObj.id)) return false;
        s.attendance.push(studentObj);
        // مزامنة الـ global
        currentSessionAttendance = s.attendance;
        this._save();
        return true;
    },

    // ── حذف طالب ─────────────────────────────────────────────
    removeStudent(studentId) {
        const s = this.current();
        s.attendance = s.attendance.filter(x => x.id !== studentId);
        currentSessionAttendance = s.attendance;
        this._save();
    },

    // ── مسح جلسة المجموعة الحالية فقط (عند التبديل) ─────────
    resetCurrent() {
        const k = this._key(currentGrade, currentGroupId);
        delete this._store[k];
        isLessonCodingActive     = false;
        isLessonCodingPaused     = false;
        currentSessionAttendance = [];
        this._save();
    },

    // ── مزامنة الـ globals مع الجلسة الحالية ─────────────────
    //    تُستدعى عند الانتقال للمجموعة (لو فيها جلسة محفوظة)
    syncGlobals() {
        const s = this.current();
        isLessonCodingActive     = s.isActive;
        isLessonCodingPaused     = s.isPaused;
        currentSessionAttendance = s.attendance;
    },
};
SessionManager._load();
window.SessionManager = SessionManager;

// ── Global state vars (يتم مزامنتها مع SessionManager) ──────────
let isLessonCodingActive     = false;
let isLessonCodingPaused     = false;
let currentSessionAttendance = [];
const waTemplates = JSON.parse(localStorage.getItem('edu_wa_templates')) || {
    welcome:
`السلام عليكم ورحمة الله وبركاته،
يسرنا إعلامكم بأنه قد تم تسجيل حضور ابنكم/ابنتكم الطالب/ـة *[[name]]* بنجاح اليوم.
📌 إجمالي نقاط التميز المُجمّعة: [[points]] نقطة 💎
نتمنى له/ـا حضوراً منتظماً ومستوى دراسياً متميزاً، ونشكر لسيادتكم متابعتكم المستمرة.`,
    absence:
`السلام عليكم ورحمة الله وبركاته،
نحيط سيادتكم علماً بغياب الطالب/ـة *[[name]]* عن الحصة الدراسية اليوم.
نرجو التكرم بمتابعة سبب الغياب، حرصاً منا على انتظام مستواه/ـا الدراسي وتحقيق أفضل النتائج.`,
    payment:
`السلام عليكم ورحمة الله وبركاته،
يسرنا إفادتكم بأنه قد تم استلام اشتراك هذا الشهر للطالب/ـة *[[name]]* بنجاح.
شاكرين لسيادتكم حسن تعاونكم وثقتكم الدائمة، ونؤكد حرصنا على تقديم أفضل مستوى تعليمي.`
};

// --- 1. Global Navigation ---
function showSection(sectionId, btnEl) {
    // ─── RBAC Check ──────────────────────────────────────────
    if (!RBAC.canViewSection(sectionId)) {
        showNotification('⛔ ليس لديك صلاحية الوصول لهذا القسم.', 'error');
        RBAC.log('access_denied', sectionId);
        return;
    }

    // Password protection for sensitive financial sections (admin only)
    if (RBAC.isAdmin() && (sectionId === 'daily-treasury' || sectionId === 'payments' || sectionId === 'receipts')) {
        const pass = prompt("يرجى إدخال كلمة المرور للوصول إلى الخزينة والمالية:");
        const correct = (db._settings.globalPasswords && db._settings.globalPasswords.finance) || '4321';
        if (pass !== correct) {
            showNotification('❌ كلمة مرور خاطئة! لا يمكن الدخول.', 'error');
            return;
        }
    }

    // STOP all background camera scanners when switching sections to avoid conflicts
    stopAllCameraScanners();

    const sections = [
        'dashboard-section', 'students-section', 'attendance-section',
        'absence-section', 'payments-section', 'analytics-section',
        'exams-section', 'fame-section', 'backup-section',
        'whatsapp-section', 'fast-grading-section', 'certificates-section',
        'groups-section', 'group-detail-section', 'idcards-section',
        'daily-treasury-section', 'shifts-section', 'settings-section',
        'platform-codes-section', 'receipts-section', 'platform-activation-section',
        'employee-platform-sync-section'
    ];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const activeSection = document.getElementById(`${sectionId}-section`);
    if (activeSection) activeSection.style.display = 'block';

    if (btnEl) {
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        btnEl.classList.add('active');
    }

    const titles = {
        'dashboard': 'الرئيسية | ملخص اليوم', 'students': 'إدارة الطلاب',
        'attendance': 'الماسح الذكي', 'absence': 'متابعة الغياب اليومي',
        'exams': 'النتائج', 'groups': 'إدارة المجموعات',
        'certificates': 'الشهادات', 'hall': 'لوحة الشرف',
        'idcards': 'طباعة الأكواد', 'daily-treasury': 'الخزنة اليومية (عهدة السكرتارية)',
        'shifts': 'إدارة شفتات الموظفين', 'platform-codes': 'أكواد المنصة',
        'receipts': 'وصولات الدفع', 'platform-activation': 'تفعيل كورسات المنصة',
        'employee-platform-sync': 'مزامنة المنصة التعليمية'
    };
    document.getElementById('page-title').innerText = titles[sectionId] || 'نظام إدارة الدروس';

    if (sectionId === 'shifts') renderShifts();

    // Special initializers
    if (sectionId === 'attendance') {
        // ── مزامنة الـ UI مع جلسة المجموعة الحالية ───────────────
        // لو المجموعة عندها جلسة نشطة → تظهر في وضع التشفير
        // لو ما عندهاش → تظهر أزرار البداية
        SessionManager.syncGlobals();
        _syncSessionUI();

        startQRScanner();
        renderQuickAttendance();
        renderSessionTable();
        const today = new Date().toISOString().split('T')[0];
        const datePicker = document.getElementById('history-date-picker');
        if (datePicker) datePicker.value = today;
        toggleAttendanceView('scanner');
        initHistoryGroups();
    }
    if (sectionId === 'students') { initFilters(); renderStudents(); }
    if (sectionId === 'exams') renderExams();
    if (sectionId === 'groups') renderGroups();
    if (sectionId === 'hall') { calculateHallOfFame(); renderHallOfFame(); }
    if (sectionId === 'absence') { initAbsenceManager(); initAbsenceGroupFilter(); generateAbsenceReport(); }
    if (sectionId === 'certificates') initCertificatesSection();
    if (sectionId === 'payments') { renderFinances(); renderMonthlySubscriptionTables(); }
    if (sectionId === 'receipts') { initReceiptsSection(); }

    if (sectionId === 'make-exam') initMakeExamSection();
    if (sectionId === 'fast-grading') initFastGrading();
    if (sectionId === 'idcards') initIDCardsSection();
    if (sectionId === 'platform-codes') initPlatformCodesSection();
    if (sectionId === 'platform-activation') {
        if (typeof initPlatformActivationSection === 'function') initPlatformActivationSection();
    }
    if (sectionId === 'whatsapp') renderWABot();
    if (sectionId === 'daily-treasury') renderDailyTreasury();
    if (sectionId === 'settings') renderProgramSettings();

    updateDashboardStats();
    updateExperienceSummary();
}

function stopAllCameraScanners() {
    [html5QrCode, examScanner, searchScanner, portalScanner, fastGradingScanner].forEach(s => {
        if (s) {
            try {
                // Robust stop: Check state or just try to stop
                const state = s.getState ? s.getState() : (s.isScanning ? 2 : 0);
                if (state > 1 || s.isScanning) {
                    s.stop().catch(() => { });
                }
            } catch (e) { }
        }
    });
}

let currentExamMode = null;
let questionCount = 0;

function initMakeExamSection() {
    // Placeholder for future exam builder - delegates to renderExams for now
    if (typeof renderExams === 'function') renderExams();
}

function initFollowupSection() {
    const examSelect = document.getElementById('followup-exam-select');
    const groupSelect = document.getElementById('followup-group-select');
    if (!examSelect || !groupSelect) return;

    // Exams of current grade (either specific to current group or general grade-wide exams)
    const exams = db.exams.filter(e =>
        String(e.grade) === String(currentGrade) &&
        (!e.groupId || String(e.groupId) === String(currentGroupId))
    );
    examSelect.innerHTML = '<option value="">-- اختر الامتحان --</option>' +
        exams.map(e => `<option value="${e.id}">${e.title}</option>`).join('');

    // Groups of current grade
    const groups = db.groups.filter(g => g.grade == currentGrade);
    rebuildSelectPreservingSelection(
        groupSelect,
        () => groups.map(g => `<option value="${g.id}">${g.name}</option>`).join(''),
        currentGroupId
    );
}

function initAbsenceManager() {
    if (typeof generateAbsenceReport === 'function') {
        generateAbsenceReport();
    }
}

function renderFollowupList() {
    const examId = document.getElementById('followup-exam-select').value;
    const groupId = document.getElementById('followup-group-select').value;
    const list = document.getElementById('followup-list');

    if (!examId || !groupId) {
        list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--text-muted);">يرجى اختيار الامتحان والمجموعة للمتابعة</td></tr>';
        return;
    }

    const students = db.students.filter(s => s.groupId == groupId);
    // Already marked scores for this exam
    const existingScores = db.scores.filter(sc => sc.examId == examId);

    list.innerHTML = students.map(s => {
        const isAttended = existingScores.some(sc => sc.studentId == s.id);
        return `
            <tr class="fade-in">
                <td><strong>${s.name}</strong></td>
                <td><code style="background:var(--bg-light); padding:0.2rem 0.5rem; border-radius:4px;">${s.qrCode}</code></td>
                <td style="text-align:center;">
                    <label class="switch">
                        <input type="checkbox" class="attendance-check" data-student-id="${s.id}" ${isAttended ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                    <span style="display:inline-block; width:60px; font-weight:700; color:${isAttended ? 'var(--accent)' : 'var(--danger)'}">
                        ${isAttended ? 'حاضر' : 'غائب'}
                    </span>
                </td>
                <td><input type="text" class="form-input followup-note" style="margin-bottom:0; font-size:0.8rem;" placeholder="مثلاً: بعذر"></td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="4">لا يوجد طلاب في هذه المجموعة</td></tr>';

    // Add CSS for the switch if not exists
    if (!document.getElementById('switch-styles')) {
        const style = document.createElement('style');
        style.id = 'switch-styles';
        style.innerHTML = `
            .switch { position: relative; display: inline-block; width: 45px; height: 24px; vertical-align: middle; margin-left: 10px; }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; inset: 0; background-color: #ccc; transition: .4s; border-radius: 34px; }
            .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
            input:checked + .slider { background-color: var(--accent); }
            input:checked + .slider:before { transform: translateX(21px); }
        `;
        document.head.appendChild(style);
    }
}

function saveExamAttendance() {
    const examId = document.getElementById('followup-exam-select').value;
    if (!examId) return showNotification('يرجى اختيار الامتحان', 'error');

    const rows = document.querySelectorAll('#followup-list tr');
    let markedCount = 0;

    rows.forEach(row => {
        const check = row.querySelector('.attendance-check');
        if (!check) return;

        const studentId = parseInt(check.dataset.studentId);
        const isAttended = check.checked;

        if (!isAttended) {
            db.scores = db.scores.filter(sc => !(sc.studentId == studentId && sc.examId == examId));
        } else {
            const exists = db.scores.some(sc => sc.studentId == studentId && sc.examId == examId);
            if (!exists) {
                db.scores.push({
                    id: Date.now() + Math.random(),
                    studentId: studentId,
                    examId: parseInt(examId),
                    mark: null, // null means "attended but not yet graded"
                    date: new Date().toISOString()
                });
            }
        }
        markedCount++;
    });

    db.save();
    showNotification('تم تحديث سجل حضور الامتحان بنجاح ✅');
    renderFollowupList();
}


function toggleExamScanner() {
    const container = document.getElementById('exam-scan-container');
    if (container.style.display === 'none') {
        container.style.display = 'block';
        startExamScanner();
    } else {
        stopExamScanner();
    }
}

function startExamScanner() {
    const examId = document.getElementById('followup-exam-select').value;
    if (!examId) {
        showNotification('يرجى اختيار الامتحان أولاً', 'error');
        return;
    }

    if (!examScanner) {
        examScanner = new Html5Qrcode("exam-reader");
    }

    examScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 },
        (decodedText) => {
            handleExamAttendanceScan(decodedText);
            const reader = document.getElementById('exam-reader');
            reader.style.borderColor = 'var(--accent)';
            setTimeout(() => reader.style.borderColor = 'var(--primary)', 500);
        }
    ).catch(err => showNotification('فشل تشغيل الكاميرا', 'error'));
}

function stopExamScanner() {
    if (examScanner) {
        examScanner.stop().then(() => {
            document.getElementById('exam-scan-container').style.display = 'none';
        });
    } else {
        document.getElementById('exam-scan-container').style.display = 'none';
    }
}

function handleExamAttendanceScan(code) {
    const examId = document.getElementById('followup-exam-select').value;
    const student = db.students.find(s => s.qrCode === code);

    if (!student) return showNotification('طالب غير مسجل!', 'error');

    // --- STRICT CONTEXT CHECK ---
    if (String(student.grade) !== String(currentGrade)) {
        return showNotification('هذا الطالب غير مسجل في هذه السنة الدراسية', 'error');
    }

    const targetGroupId = document.getElementById('followup-group-select').value;
    if (String(student.groupId) !== String(targetGroupId)) {
        const studentGroupObj = db.groups.find(g => g.id == student.groupId);
        playSound('error');
        return showNotification(`🛑 خطأ: الطالب ${student.name} مقيد في مجموعة (${studentGroupObj ? studentGroupObj.name : 'أخرى'}). يرجى التبديل للمجموعة الصحيحة.`, 'error');
    }

    const exists = db.scores.some(sc => sc.studentId == student.id && sc.examId == examId);
    if (!exists) {
        db.scores.push({
            id: Date.now(),
            studentId: student.id,
            examId: parseInt(examId),
            mark: null,
            date: new Date().toISOString()
        });
        db.save();
        renderFollowupList();
        showNotification(`تم تسجيل حضور: ${student.name}`, 'success');
    } else {
        showNotification('تم تسجيل هذا الطالب مسبقاً', 'warning');
    }
}

function initAbsenceGroupFilter() {
    const select = document.getElementById('absence-group-filter');
    if (select) {
        const groups = db.groups.filter(g => g.grade == currentGrade);
        rebuildSelectPreservingSelection(
            select,
            () => groups.map(g => `<option value="${g.id}">${g.name}</option>`).join(''),
            currentGroupId
        );
    }
}

// --- Helper to check for existing parents during registration ---
function checkParentPhone(phone) {
    const results = document.getElementById('std-parent-results');
    if (!results) return;
    if (!phone || phone.length < 4) {
        results.innerHTML = '';
        return;
    }
    const matches = db.students.filter(s =>
        (s.parentPhone && s.parentPhone.includes(phone)) ||
        (s.phone && s.phone.includes(phone))
    );
    if (matches.length > 0) {
        results.innerHTML = matches.map(s => `<div style="padding:4px 8px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:4px; margin-bottom:2px; color:#166534">
            <i class="fas fa-user-friends"></i> مَسجل: <b>${s.name}</b> (${s.phone || 'بدون هاتف'})
        </div>`).join('');
    } else {
        results.innerHTML = '';
    }
}

function initFilters() {
    initStudentGroups(); // Populate Student Modal
    const filter = document.getElementById('filter-group');
    if (filter) {
        const groups = db.groups.filter(g => String(g.grade) === String(currentGrade));
        // ✅ كانت بترجع لـ currentGroupId في كل مرة يتعمل فيها refreshGroupContexts()
        // (مزامنة/أرشفة خلفية) وبتمسح اختيار المستخدم اليدوي في فلتر شاشة الطلاب.
        // دلوقتي بتحافظ على نفس الاختيار لو لسه موجود ضمن الخيارات.
        rebuildSelectPreservingSelection(
            filter,
            () => '<option value="all">كل المجموعات (الكل)</option>' +
                groups.map(g => `<option value="${g.id}">${g.name}</option>`).join(''),
            currentGroupId
        );
    }
}

// --- 2. Students & Groups Logic ---
async function handleStudentSubmit(printAfter = false) {
    const submitBtn = document.querySelector('#student-modal button[onclick^="handleStudentSubmit"]');
    try {
        const name = document.getElementById('std-name').value.trim();
        const phone = document.getElementById('std-phone').value.trim();
        const groupId = document.getElementById('std-group').value;
        const parent = document.getElementById('std-parent').value.trim();

        if (!name || !phone || !parent || !groupId) {
            return showNotification('يرجى تعبئة كافة البيانات والمجموعة', 'error');
        }

        // ── الكود: إما تلقائي (يُنشأ ويُضمن عدم تكراره) أو يدوي (يُدخله المستخدم) ──
        // لا يوجد فرق وظيفي بين الكودين؛ كلاهما يُخزَّن في نفس الحقل qrCode ويُستخدم
        // بنفس الطريقة في كل أجزاء السيستم (حضور، باركود، خزينة، مالية، اشتراكات، بحث، تقارير).
        const codeMode = (document.getElementById('std-code-mode')?.value) || 'auto';
        let code = document.getElementById('std-code').value.trim();
        const codeAlreadyUsed = (c) => db.students.some(s => String(s.qrCode) === c);

        if (codeMode === 'manual') {
            if (!code) {
                return showNotification('يرجى إدخال كود الطالب اليدوي', 'error');
            }
            if (!/^[0-9]+$/.test(code)) {
                return showNotification('كود الطالب يجب أن يتكوّن من أرقام إنجليزية فقط', 'error');
            }
            if (codeAlreadyUsed(code)) {
                return showNotification('هذا الكود مستخدم بالفعل لطالب آخر، يرجى إدخال كود مختلف', 'error');
            }
        } else {
            if (!code || codeAlreadyUsed(code)) {
                code = generateLocalUniqueCode(db.students);
            }
        }

        const group = db.groups.find(g => String(g.id) === String(groupId));
        const targetGrade = currentGrade || group?.grade;
        if (!targetGrade) {
            return showNotification('يرجى اختيار المرحلة الدراسية أولاً', 'error');
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
        }

        if (!StorageEngine.db) await StorageEngine.init();

        // ── الكود مولَّد تلقائيًا ومضمون التفرّد، يُحفظ كما هو ──
        const student = {
            id: Date.now(), name, phone, grade: targetGrade, groupId, parentPhone: parent,
            qrCode: code,
            balance: 0, points: 0, joinDate: new Date().toISOString()
        };

        db.students.push(student);
        await StorageEngine.save('students', student);
        const studentCloudOk = await waitForCloudTableSync('students');

        studentListPage = 0;
        renderStudents();

        const attendanceSection = document.getElementById('attendance-section');
        if (attendanceSection && attendanceSection.style.display === 'block') {
            if (!db.settings.isMonthlyActive) {
                showNotification('تنبيه: تم إضافة الطالب لكن لم يتم تسجيل حضوره لعدم تفعيل الاشتراك من الخزينة', 'warning');
            } else {
                SessionManager.addStudent({ ...student, scanTime: new Date().toISOString() });
                currentSessionAttendance = SessionManager.attendance();
                renderSessionTable();
                const att = {
                    id: Date.now() + 5,
                    studentId: student.id,
                    groupId,
                    date: new Date().toISOString(),
                    status: 'present'
                };
                db.attendance.push(att);
                await StorageEngine.save('attendance', att);
                await waitForCloudTableSync('attendance');
            }
        }

        document.getElementById('std-name').value = '';
        document.getElementById('std-code').value = '';
        document.getElementById('std-phone').value = '';
        document.getElementById('std-parent').value = '';
        document.getElementById('std-group').value = '';

        toggleModal('student-modal', false);
        if (studentCloudOk) {
            showNotification('تم إضافة الطالب وحفظه في قاعدة البيانات بنجاح', 'success');
        } else {
            showNotification('تم حفظ الطالب على الجهاز فقط، ولم يتم تأكيد رفعه لقاعدة البيانات. تأكد من الاتصال واضغط مزامنة.', 'warning');
        }

        // ✅ لو المستخدم ضغط "حفظ وطباعة الكود" — نفتح الطباعة فورًا لنفس الطالب
        if (printAfter && typeof generatePrintableIDCards === 'function') {
            const printMode = document.getElementById('print-type-main')?.value || 'thermal';
            generatePrintableIDCards([student], printMode);
        }
    } catch (err) {
        console.error('Student save failed', err);
        showNotification('حدث خطأ أثناء حفظ الطالب: ' + (err.message || err), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'حفظ البيانات';
        }
    }
}

async function renderStudents() {
    const list = document.getElementById('students-list');
    const searchTerm = document.getElementById('student-search-input')?.value.toLowerCase() || '';
    const groupFilter = document.getElementById('filter-group');

    // NOTE: Do NOT modify currentGroupId here - only read it
    // The group filter only affects the display, not the global context
    const selectedGroupId = (groupFilter && groupFilter.value && groupFilter.value !== 'all')
        ? groupFilter.value
        : (currentGroupId || 'all');

    if (!list) return;

    // Use IndexedDB paged loading for performance with 1,000,000 students
    const filter = { grade: currentGrade };
    if (selectedGroupId && selectedGroupId !== 'all') filter.groupId = selectedGroupId;

    let studentsToRender = [];
    let hasMore = false;

    const paged = await StorageEngine.getPaged('students', filter, studentListPage, studentListPageSize, searchTerm);
    studentsToRender = paged.data;
    hasMore = paged.hasMore;

    sortStudentsArabic(studentsToRender);

    const groups = {};
    studentsToRender.forEach(s => {
        const groupObj = db.groups.find(g => g.id == s.groupId);
        const groupName = groupObj ? `${groupObj.name} (${groupObj.time})` : 'بدون مجموعة مخصصة';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(s);
    });

    if (studentsToRender.length === 0 && studentListPage === 0) {
        list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 3rem; color: var(--text-muted);">لا يوجد طلاب مقيدين في هذا القسم حالياً</td></tr>';
        return;
    }

    let html = '';
    Object.keys(groups).forEach(groupName => {
        html += `
        <tr style="background: rgba(79, 70, 229, 0.05);">
            <td colspan="6" style="padding: 1rem; border-right: 4px solid var(--primary);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color: var(--primary); font-size: 1.1rem;"><i class="fas fa-users"></i> ${groupName}</strong>
                    <span class="status-badge" style="background: var(--primary); color:white;">${groups[groupName].length} طالب</span>
                </div>
            </td>
        </tr>`;

        html += groups[groupName].map(s => `
        <tr class="fade-in">
            <td style="padding-right: 2rem;"><strong>${s.name}</strong></td>
            <td>${s.phone}</td>
            <td>${s.parentPhone}</td>
            <td>${s.joinDate ? new Date(s.joinDate).toLocaleDateString('ar-EG') : '---'}</td>
            <td><span style="color:var(--primary); font-weight:bold;">${s.points} 💎</span></td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="btn" title="طباعة الكارت" style="padding:5px 10px; background:var(--primary); color:white;" onclick="generatePrintCard(${s.id})"><i class="fas fa-barcode"></i></button>
                    <button class="btn" title="QR Code الطالب" style="padding:5px 10px; background:#7c3aed; color:white;" onclick="showStudentQR(${s.id})"><i class="fas fa-qrcode"></i></button>
                    <button class="btn" title="تقرير شامل" style="padding:5px 10px; background:#3b82f6; color:white;" onclick="generateMonthlyReport(${s.id})"><i class="fas fa-file-invoice"></i></button>
                    <button class="btn" title="الملف الشخصي" style="padding:5px 10px;" onclick="viewDetailedProfile(${s.id})"><i class="fas fa-user-graduate"></i></button>
                    <button class="btn" title="تعديل" style="padding:5px 10px; background:var(--accent); color:white;" onclick="editStudent(${s.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn" title="حذف" style="padding:5px 10px; color:var(--danger);" onclick="deleteStudent('${s.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`).join('');
    });

    if (studentListPage === 0) {
        list.innerHTML = html;
    } else {
        list.innerHTML += html;
    }

    // Load More Button Logic
    let loadMoreContainer = document.getElementById('student-load-more-container');
    if (!loadMoreContainer) {
        loadMoreContainer = document.createElement('div');
        loadMoreContainer.id = 'student-load-more-container';
        loadMoreContainer.style = 'text-align: center; padding: 1rem;';
        list.parentNode.parentNode.appendChild(loadMoreContainer);
    }

    if (hasMore) {
        loadMoreContainer.innerHTML = `
            <button class="btn" style="background: var(--bg-light); color: var(--primary); border: 1px solid var(--primary); font-weight: bold;" onclick="studentListPage++; renderStudents();">
                <i class="fas fa-chevron-down"></i> عرض المزيد من الطلاب...
            </button>`;
    } else {
        loadMoreContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8rem;">نهاية القائمة</p>';
    }
}

function handleAddGroup() {
    const name = document.getElementById('group-name').value;
    const time = document.getElementById('group-time').value;
    if (!name || !time) return showNotification('يرجى ملء كافة البيانات', 'error');

    // Create group
    const newGroup = { id: Date.now(), name, time, grade: currentGrade };
    db.groups.push(newGroup);
    db.save('groups');

    // UI Updates
    renderGroups();

    // Refresh portal/overlays if open
    if (document.getElementById('group-selection-overlay').style.display !== 'none') {
        renderGroupSelection(currentGrade);
    }
    if (document.getElementById('portal-overlay').style.display !== 'none') {
        renderPortalGroups(currentGrade); // async — intentionally not awaited here
    }

    refreshGroupContexts(); // Update all dropdowns

    // Force close modal
    const modal = document.getElementById('group-modal');
    if (modal) modal.style.display = 'none';

    // Reset inputs
    document.getElementById('group-name').value = '';
    document.getElementById('group-time').value = '';

    showNotification('✅ تم إضافة المجموعة بنجاح');
}

function refreshGroupContexts() {
    // Refresh all places that show group dropdowns
    if (typeof initHistoryGroups === 'function') initHistoryGroups();
    if (typeof initFilters === 'function') initFilters();
    if (typeof initIDCardsSection === 'function') initIDCardsSection();

    if (typeof initFollowupSection === 'function') initFollowupSection();
    if (typeof initFastGrading === 'function') initFastGrading();
    if (typeof initStudentGroups === 'function') initStudentGroups();
    if (typeof initAbsenceGroupFilter === 'function') initAbsenceGroupFilter();

    // Also update portal group select
    const portalSelect = document.getElementById('portal-group-select');
    if (portalSelect) {
        const gradeGroups = db.groups.filter(g => g.grade == currentGrade);
        rebuildSelectPreservingSelection(
            portalSelect,
            () => gradeGroups.map(g => `<option value="${g.id}">${g.name} (${g.time})</option>`).join('') || '<option value="">لا يوجد مجموعات في هذا الصف</option>'
        );
    }
    initGradeSelects();
    if (typeof initCertificatesSection === 'function') initCertificatesSection();
}

function initGradeSelects() {
    const selects = ['std-grade']; // Add more IDs if needed
    const html = gradesList.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    });
}

function renderGroups() {
    const list = document.getElementById('groups-list');
    if (!list) return;
    const groups = db.groups.filter(g => g.grade == currentGrade);
    list.innerHTML = groups.map(g => `
        <tr>
            <td><strong>${g.name}</strong></td>
            <td>${g.time}</td>
            <td><span class="badge" style="background:var(--primary); color:white">${db.students.filter(s => s.groupId == g.id).length} طالب</span></td>
            <td>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-primary" style="padding: 5px 15px; background: var(--accent);" onclick="viewGroupDetails('${g.id}')">
                        <i class="fas fa-eye"></i> عرض المجموعة
                    </button>
                    <button class="btn" style="color:var(--danger)" onclick="deleteGroup('${g.id}')">
                        <i class="fas fa-trash"></i>
                    </button>

                </div>
            </td>
        </tr>`).join('') || '<tr><td colspan="4" style="text-align:center">لا يوجد مجموعات حالياً في هذا الصف</td></tr>';
}

function viewGroupDetails(groupId) {
    const group = db.groups.find(g => g.id == groupId);
    if (!group) return;

    activeGroupDetailId = groupId;
    showSection('group-detail');

    document.getElementById('active-group-detail-title').innerText = group.name;
    renderGroupStudents();
    updateGroupDetailStats(groupId);
}

function renderGroupStudents() {
    const list = document.getElementById('active-group-students-list');
    const searchQuery = document.getElementById('group-student-search')?.value.toLowerCase() || '';
    if (!list || !activeGroupDetailId) return;

    let students = db.students.filter(s => s.groupId == activeGroupDetailId);

    if (searchQuery) {
        students = students.filter(s =>
            s.name.toLowerCase().includes(searchQuery) ||
            s.qrCode.toLowerCase().includes(searchQuery)
        );
    }

    list.innerHTML = students.map(s => `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="avatar" style="width:35px; height:35px; font-size:0.8rem;">${s.name.charAt(0)}</div>
                    <div>
                        <div style="font-weight:700;">${s.name}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${s.qrCode}</div>
                    </div>
                </div>
            </td>
            <td>${s.phone || '---'}</td>
            <td><span style="color:var(--warning); font-weight:700;"><i class="fas fa-star"></i> ${s.points || 0}</span></td>
            <td>
                <div style="display:flex; gap:8px;">
                    <button class="btn" style="padding:4px 8px; font-size:0.8rem;" onclick="viewDetailedProfile(${s.id})"><i class="fas fa-user"></i></button>
                    <button class="btn" style="padding:4px 8px; font-size:0.8rem; color:var(--danger);" onclick="removeStudentFromGroup(${s.id})"><i class="fas fa-user-minus"></i></button>
                </div>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--text-muted);">لا يوجد طلاب في هذه المجموعة حالياً</td></tr>';
}

function updateGroupDetailStats(groupId) {
    const today = new Date().toISOString().split('T')[0];
    const presentCount = db.attendance.filter(a => a.groupId == groupId && a.date === today).length;

    document.getElementById('active-group-present-today').innerText = presentCount;

    const recentActivity = db.attendance
        .filter(a => a.groupId == groupId && a.date === today)
        .reverse()
        .slice(0, 10);

    const activityList = document.getElementById('active-group-recent-activity');
    if (activityList) {
        activityList.innerHTML = recentActivity.map(a => {
            const student = db.students.find(s => s.id == a.studentId);
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #f1f5f9;">
                    <span style="font-weight:600; font-size:0.9rem;">${student ? student.name : 'طالب محذوف'}</span>
                    <span style="font-size:0.8rem; color:var(--accent); font-weight:700;">${a.time}</span>
                </div>
            `;
        }).join('') || '<p style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.9rem;">لا يوجد حضور مسجل اليوم حتى الآن</p>';
    }
}

function openAddStudentForGroup() {
    // تنظيف النموذج قبل الفتح
    document.getElementById('std-name').value = '';
    document.getElementById('std-phone').value = '';
    document.getElementById('std-parent').value = '';
    const _codeMode = document.getElementById('std-code-mode'); if (_codeMode) _codeMode.value = 'auto';
    regenerateStudentCode();

    // تعيين المجموعة الحالية (من صفحة التفاصيل) تلقائياً
    const groupSelect = document.getElementById('std-group');
    if (groupSelect && activeGroupDetailId) {
        groupSelect.value = activeGroupDetailId;
    } else if (groupSelect && currentGroupId) {
        groupSelect.value = currentGroupId;
    } else if (groupSelect) {
        groupSelect.value = '';
    }

    toggleModal('student-modal', true);
}

function openAddStudentModal() {
    // تنظيف النموذج قبل الفتح
    document.getElementById('std-name').value = '';
    document.getElementById('std-phone').value = '';
    document.getElementById('std-parent').value = '';
    const _codeMode = document.getElementById('std-code-mode'); if (_codeMode) _codeMode.value = 'auto';
    regenerateStudentCode();

    // تعيين المجموعة الحالية تلقائياً
    const groupSelect = document.getElementById('std-group');
    if (groupSelect && currentGroupId) {
        groupSelect.value = currentGroupId;
    } else if (groupSelect) {
        groupSelect.value = '';
    }

    toggleModal('student-modal', true);
}

// ── توليد كود عشوائي فريد للطالب تلقائياً (12 رقم) ──
// يُستخدم عند فتح نموذج إضافة طالب جديد، أو عند الضغط على زر "توليد كود جديد"
// ملاحظة: لا يعمل هذا التوليد إلا في وضع "إنشاء كود تلقائي".
function regenerateStudentCode() {
    const modeEl = document.getElementById('std-code-mode');
    if (modeEl && modeEl.value === 'manual') return; // في الوضع اليدوي لا نُنشئ كوداً تلقائياً
    const field = document.getElementById('std-code');
    if (!field) return;
    if (typeof generateLocalUniqueCode !== 'function') {
        console.warn('generateLocalUniqueCode غير متاح - تأكد من تحميل code-generator.js');
        return;
    }
    field.value = generateLocalUniqueCode(db.students);
}

// ── التبديل بين وضع "إنشاء كود تلقائي" و"إدخال كود يدوي" في نموذج إضافة طالب ──
// الكودان (التلقائي واليدوي) يُخزَّنان بنفس الحقل qrCode ويُعاملان بنفس الطريقة
// تمامًا في كل أجزاء السيستم (حضور، باركود، خزينة، مالية، اشتراكات، بحث، تقارير...).
function toggleStudentCodeMode() {
    const modeEl = document.getElementById('std-code-mode');
    const field = document.getElementById('std-code');
    const label = document.getElementById('std-code-label');
    const regenBtn = document.getElementById('std-code-regen-btn');
    if (!modeEl || !field) return;

    if (modeEl.value === 'manual') {
        field.readOnly = false;
        field.value = '';
        field.placeholder = 'أدخل كود الطالب يدويًا (أرقام إنجليزية فقط)';
        field.style.background = '';
        if (label) label.textContent = 'كود الطالب (يدوي)';
        if (regenBtn) regenBtn.style.display = 'none';
        field.focus();
    } else {
        field.readOnly = true;
        field.style.background = 'var(--bg-light)';
        field.placeholder = 'سيتم إنشاء الكود تلقائيًا';
        if (label) label.textContent = 'كود الطالب (يُنشأ تلقائيًا)';
        if (regenBtn) regenBtn.style.display = '';
        regenerateStudentCode();
    }
}

function openGroupScanner() {
    showSection('attendance');
    // We could potentially auto-select the group in the scanner, but let's just go there for now
}

async function removeStudentFromGroup(studentId) {
    if (!confirm('هل أنت متأكد من رغبتك في إزالة الطالب من هذه المجموعة؟')) return;
    const student = db.students.find(s => s.id == studentId);
    if (student) {
        student.groupId = null;
        await StorageEngine.save('students', student);
        await db.save('students');
        renderGroupStudents();
        renderGroups();
        showNotification('تم إزالة الطالب من المجموعة بنجاح');
    }
}

async function deleteGroup(id) {
    if (!rbacGuardDelete('حذف المجموعة')) return;

    const group = db.groups.find(g => String(g.id) === String(id));
    if (!group) return;

    const studentsInGroup = db.students.filter(s => String(s.groupId) === String(id));
    const studentsCount   = studentsInGroup.length;
    const attendanceCount = db.attendance.filter(a => String(a.groupId) === String(id)).length;
    const paymentsCount   = db.payments.filter(p => studentsInGroup.some(s => String(s.id) === String(p.studentId))).length;

    // رسالة تأكيد تفصيلية
    let confirmMsg = `⚠️ حذف المجموعة: "${group.name}"\n\n`;
    confirmMsg += `سيتم حذف:\n`;
    confirmMsg += `• المجموعة نفسها\n`;
    if (studentsCount  > 0) confirmMsg += `• ${studentsCount} طالب مرتبط بالمجموعة\n`;
    if (attendanceCount > 0) confirmMsg += `• ${attendanceCount} سجل حضور\n`;
    if (paymentsCount  > 0) confirmMsg += `• ${paymentsCount} عملية دفع مرتبطة بطلاب المجموعة\n`;
    confirmMsg += `\nهذا الإجراء لا يمكن التراجع عنه!\nهل أنت متأكد؟`;

    if (!confirm(confirmMsg)) return;

    // حذف الحضور المرتبط بالمجموعة
    const attendanceToDelete = db.attendance.filter(a => String(a.groupId) === String(id));
    for (const a of attendanceToDelete) {
        await StorageEngine.delete('attendance', a.id).catch(() => {});
        if (typeof CloudSync !== 'undefined' && CloudSync.deleteRecord) {
            CloudSync.deleteRecord('attendance', a.id);
        }
    }
    db.attendance = db.attendance.filter(a => String(a.groupId) !== String(id));

    // حذف المدفوعات المرتبطة بطلاب هذه المجموعة
    const studentIds = new Set(studentsInGroup.map(s => String(s.id)));
    const paymentsToDelete = db.payments.filter(p => studentIds.has(String(p.studentId)));
    for (const p of paymentsToDelete) {
        await StorageEngine.delete('payments', p.id).catch(() => {});
        if (typeof CloudSync !== 'undefined' && CloudSync.deleteRecord) {
            CloudSync.deleteRecord('payments', p.id);
        }
    }
    db.payments = db.payments.filter(p => !studentIds.has(String(p.studentId)));

    // حذف الطلاب المرتبطين بالمجموعة
    for (const s of studentsInGroup) {
        await StorageEngine.delete('students', s.id).catch(() => {});
        if (typeof CloudSync !== 'undefined' && CloudSync.deleteRecord) {
            CloudSync.deleteRecord('students', s.id);
        }
    }
    db.students = db.students.filter(s => String(s.groupId) !== String(id));

    // حذف المجموعة نفسها
    db.groups = db.groups.filter(g => String(g.id) !== String(id));
    await StorageEngine.delete('groups', id);
    if (typeof CloudSync !== 'undefined' && CloudSync.deleteRecord) {
        CloudSync.deleteRecord('groups', id);
    }

    // حفظ كل الجداول المتأثرة
    await db.save('groups');
    await db.save('students');
    await db.save('attendance');
    await db.save('payments');

    if (typeof currentGroupId !== 'undefined' && String(currentGroupId) === String(id)) {
        currentGroupId = null;
    }
    if (typeof activeGroupDetailId !== 'undefined' && String(activeGroupDetailId) === String(id)) {
        activeGroupDetailId = null;
        showSection('groups-section');
    }

    showNotification(`✅ تم حذف المجموعة "${group.name}" وكل بياناتها بنجاح`, 'success');
    renderGroups();
    if (typeof refreshGroupContexts === 'function') refreshGroupContexts();
}


function initStudentGroups() {
    const select = document.getElementById('std-group');
    if (!select) return;
    const groups = db.groups.filter(g => g.grade == currentGrade);
    select.innerHTML = '<option value="">-- اختر المجموعة --</option>' +
        groups.map(g => `<option value="${g.id}" ${g.id == currentGroupId ? 'selected' : ''}>${g.name} (${g.time})</option>`).join('');
}

// --- 3. Hall of Fame & Shop ---
function calculateHallOfFame() {
    const studentsWithPoints = db.students.filter(s => String(s.grade) === String(currentGrade)).map(s => {
        const attCount = db.attendance.filter(a => a.studentId == s.id).length;
        const scoreTotal = db.scores.filter(sc => sc.studentId == s.id).reduce((sum, m) => sum + m.mark, 0);
        return { ...s, totalScore: (attCount * 50) + (scoreTotal * 10) };
    }).sort((a, b) => b.totalScore - a.totalScore);

    const podium = document.getElementById('fame-podium');
    if (!podium) return;

    const top3 = studentsWithPoints.slice(0, 3);
    podium.innerHTML = '';

    const displayOrder = [top3[1], top3[0], top3[2]];

    displayOrder.forEach((s, idx) => {
        if (!s) return;
        const rank = idx === 0 ? 2 : (idx === 1 ? 1 : 3);
        podium.innerHTML += `
            <div class="podium-item">
                ${rank === 1 ? '<div class="crown">👑</div>' : ''}
                <div class="podium-rank-${rank}">
                    <div style="padding-top:20px; font-weight:bold; color:#1e293b; font-size:1.2rem;">#${rank}</div>
                </div>
                <div class="podium-name">${s.name}</div>
            </div>
        `;
    });

    const list = document.getElementById('fame-list');
    list.innerHTML = studentsWithPoints.slice(3, 10).map((s, i) => `
        <tr>
            <td>#${i + 4}</td>
            <td>${s.name}</td>
            <td>${s.totalScore}</td>
            <td><span class="status-badge" style="background:#fef3c7; color:#92400e">طالب متميز</span></td>
        </tr>
    `).join('');
}

function handleAddReward() {
    const title = document.getElementById('rew-title').value;
    const cost = parseInt(document.getElementById('rew-cost').value);
    if (!title || !cost) return;
    db.rewards.push({ id: Date.now(), title, cost });
    db.save();
    renderShop();
    toggleModal('reward-modal', false);
}

function renderShop() {
    const grid = document.getElementById('shop-grid');
    grid.innerHTML = db.rewards.map(r => `
        <div class="card shop-card fade-in">
            <div class="points-tag">${r.cost} نقطة</div>
            <h3>${r.title}</h3>
            <p style="color:var(--text-muted); margin:1rem 0;">استبدل نقاطك بهذا العرض الرائع</p>
            <button class="btn btn-primary" style="width:100%;" onclick="redeemReward(${r.id})">استبدال الآن</button>
        </div>
    `).join('') || '<p>لا توجد عروض حالياً</p>';
}

function redeemReward(rewardId) {
    const reward = db.rewards.find(r => r.id === rewardId);
    const studentName = prompt("أدخل اسم الطالب الذي سيتم الخصم منه:");
    const student = db.students.find(s => s.name === studentName && String(s.grade) === String(currentGrade));

    if (student && student.points >= reward.cost) {
        student.points -= reward.cost;
        db.save();
        showNotification(`تم الاستبدال بنجاح لـ ${student.name}`);
        renderShop();
    } else {
        showNotification('النقاط غير كافية أو الطالب غير موجود', 'error');
    }
}

// --- 4. Absence & Portal & Camera ---
function generateAbsenceReport() {
    const absenceList = document.getElementById('absence-list');
    const presentList = document.getElementById('absence-present-list');
    const filterGroup = document.getElementById('absence-group-filter');
    if (!absenceList || !presentList) return;

    const today = new Date().toLocaleDateString('en-CA');
    const selectedGroupValue = filterGroup ? filterGroup.value : currentGroupId;

    // 1. Get expected students strictly for the active group
    const expectedStudents = db.students.filter(s =>
        String(s.grade) === String(currentGrade) &&
        String(s.groupId) === String(selectedGroupValue)
    );

    // 2. Identify attendance records for today in this context
    const dailyAttendance = db.attendance.filter(a => {
        const aDate = new Date(a.date).toLocaleDateString('en-CA');
        return aDate === today;
    });

    // We look at all students who have a 'present' record today in this grade/group
    const presentIds = dailyAttendance.filter(a => a.status === 'present').map(a => a.studentId);

    const presentStudents = expectedStudents.filter(s => presentIds.includes(s.id));
    const absentees = expectedStudents.filter(s => !presentIds.includes(s.id));

    // 3. Render Present List
    presentList.innerHTML = presentStudents.map(s => {
        const att = dailyAttendance.find(a => a.studentId == s.id && a.status === 'present');
        return `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td>${att ? new Date(att.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '---'}</td>
                <td style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="status-badge" style="background:#dcfce7; color:#166534">حاضر ✅</span>
                    <button class="btn" style="color:var(--danger); padding:2px 8px; font-size:0.7rem;" onclick="removeStudentFromPresentToday(${s.id})">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="3" style="text-align:center; padding:2rem;">لا يوجد حضور مسجل لهذه المجموعة اليوم</td></tr>';

    // 4. Render Absence List
    absenceList.innerHTML = absentees.map(s => {
        const group = db.groups.find(g => g.id == s.groupId);
        const isExplicitAbsent = dailyAttendance.some(a => a.studentId == s.id && a.status === 'absent');

        return `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td>${group ? group.name : '---'}</td>
                <td>
                    <span class="status-badge" style="background:${isExplicitAbsent ? '#fee2e2' : '#fff7ed'}; color:${isExplicitAbsent ? '#991b1b' : '#c2410c'}">
                        ${isExplicitAbsent ? 'غائب (مؤكد)' : 'لم يحضر بعد'}
                    </span>
                </td>
                <td style="display:flex; gap:10px;">
                    <button class="btn btn-primary" style="padding:5px 15px; background:var(--accent);" onclick="sendAbsenceWhatsApp(${s.id})">
                        <i class="fab fa-whatsapp"></i> تذكير
                    </button>
                    ${!isExplicitAbsent ? `
                    <button class="btn" style="background:#f1f5f9; color:var(--danger);" onclick="markStudentAbsentToday(${s.id})">
                        <i class="fas fa-user-times"></i> تسجيل غياب
                    </button>` : ''}
                </td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--accent);">تم تسجيل حضور جميع طلاب هذه المجموعة! 🎉</td></tr>';
}

function removeStudentFromPresentToday(studentId) {
    if (!confirm('هل تريد حذف تسجيل حضور هذا الطالب لليوم؟ سيتم إعادته إلى قائمة الغياب.')) return;

    const todayStr = new Date().toLocaleDateString('en-CA');

    // 1. Remove from global attendance
    db.attendance = db.attendance.filter(a => !(
        a.studentId == studentId &&
        new Date(a.date).toLocaleDateString('en-CA') === todayStr &&
        a.status === 'present'
    ));

    // 2. Remove from active session via SessionManager
    SessionManager.removeStudent(studentId);
    currentSessionAttendance = SessionManager.attendance();

    db.save();

    // 3. Refresh UI
    generateAbsenceReport();
    renderSessionTable();
    showNotification('تم حذف تسجيل الحضور وإعادة الطالب للغياب');
}

function archiveAbsenceSession() {
    const filterGroup = document.getElementById('absence-group-filter');
    const selectedGroupId = filterGroup && filterGroup.value !== 'all' ? filterGroup.value : currentGroupId;

    const today = new Date().toLocaleDateString('ar-EG');
    const groupObj = db.groups.find(g => String(g.id) === String(selectedGroupId));

    const defaultName = groupObj ? `جلسة ${groupObj.name} - ${today}` : `جلسة يوم ${today}`;
    const sessionName = prompt("أدخل اسماً لهذه الجلسة للرجوع إليها في الأرشيف:", defaultName);

    if (!sessionName) return;

    const expectedStudents = db.students.filter(s =>
        s.grade == currentGrade &&
        (selectedGroupId && selectedGroupId !== 'all' ? String(s.groupId) === String(selectedGroupId) : true)
    );

    const presentIds = currentSessionAttendance.map(s => s.id);
    const presentStudents = expectedStudents.filter(s => presentIds.includes(s.id));
    const absentStudents  = expectedStudents.filter(s => !presentIds.includes(s.id));

    // ── إنشاء كائن الجلسة أولاً عشان نستخدم id فيه ───────────
    const sessionId = Date.now();
    const session = {
        id:            sessionId,
        name:          sessionName,
        date:          new Date().toISOString(),
        grade:         currentGrade,
        groupId:       selectedGroupId === 'all' ? null : selectedGroupId,
        presentCount:  presentStudents.length,
        absentCount:   absentStudents.length,
        presentNames:  presentStudents.map(s => s.name),
        absenteeNames: absentStudents.map(s => s.name),
        presentIds:    presentStudents.map(s => s.id),
        absentIds:     absentStudents.map(s => s.id)
    };

    // ── تسجيل الحضور والغياب مرتبطاً بـ sessionId ─────────────
    // ✅ إصلاح تكرار الحضور: لو الطالب كان اتسجّل حضوره بالفعل النهاردة
    // (مثلاً وقت المسح بالباركود عن طريق processScan) هيكون عنده سجل في
    // db.attendance بالفعل بدون sessionId. الكود القديم كان بيتحقق من
    // sessionId فقط، فمكانش بيلاقي تطابق ويعمل سجل جديد تاني لنفس
    // الحصة → يظهر الطالب حضر مرتين. دلوقتي بندوّر أولاً على أي سجل
    // لنفس الطالب في نفس اليوم (بغض النظر عن sessionId) ولو لقيناه
    // بنربطه بالجلسة الحالية بدل ما نكرره.
    const todayStr = new Date().toLocaleDateString('en-CA');
    const findTodayRecord = (studentId) => db.attendance.find(a =>
        a.studentId == studentId &&
        new Date(a.date).toLocaleDateString('en-CA') === todayStr
    );

    presentStudents.forEach(s => {
        const existing = findTodayRecord(s.id);
        if (existing) {
            // موجود بالفعل (غالبًا من processScan) → اربطه بالجلسة فقط، من غير تكرار
            existing.status = 'present';
            existing.sessionId = existing.sessionId || sessionId;
            existing.groupId = existing.groupId || s.groupId || selectedGroupId;
        } else {
            db.attendance.push({
                id:        Date.now() * 1000 + Math.floor(Math.random() * 1000),
                studentId: s.id,
                groupId:   s.groupId || selectedGroupId,
                date:      new Date().toISOString(),
                sessionId,
                status:    'present'
            });
        }
    });

    absentStudents.forEach(s => {
        const existing = findTodayRecord(s.id);
        if (existing) {
            existing.status = existing.status === 'present' ? existing.status : 'absent';
            existing.sessionId = existing.sessionId || sessionId;
            existing.groupId = existing.groupId || s.groupId || selectedGroupId;
        } else {
            db.attendance.push({
                id:        Date.now() * 1000 + Math.floor(Math.random() * 1000),
                studentId: s.id,
                groupId:   s.groupId || selectedGroupId,
                date:      new Date().toISOString(),
                sessionId,
                status:    'absent'
            });
        }
    });

    if (!db.absenceSessions) db.absenceSessions = [];
    db.absenceSessions.push(session);
    db.save();

    showNotification('✅ تم حفظ الجلسة في الأرشيف وتسجيل غياب المتغيبين بنجاح');
    generateAbsenceReport();
}

function viewAbsenceSessionDetails(id) {
    const session = db.absenceSessions.find(s => s.id === id);
    if (!session) return;
    activeAbsenceSessionId = id; // Store ID for printing

    document.getElementById('session-det-title').innerText = session.name;
    document.getElementById('session-det-info').innerHTML = `
        <span><strong>حاضر:</strong> ${session.presentCount}</span>
        <span><strong>غائب:</strong> ${session.absentCount}</span>
    `;

    document.getElementById('session-det-present').innerHTML = (session.presentNames || [])
        .map(name => `<div style="padding:5px; border-bottom:1px solid #eee;">${name}</div>`).join('') || 'لا يوجد حاضرين';

    document.getElementById('session-det-absent').innerHTML = (session.absenteeNames || [])
        .map(name => `<div style="padding:5px; border-bottom:1px solid #eee; color:var(--danger);">${name}</div>`).join('') || 'لا يوجد غائبين';

    toggleModal('session-details-modal', true);
}

function showAbsenceArchive() {
    const list = document.getElementById('absence-archive-list');
    if (!list) return;

    // --- عزل صارم: الأرشيف يُعرض فقط للمجموعة الحالية المحددة ---
    // لو لم يتم تحديد مجموعة بعد، اعرض رسالة توضيحية
    if (!currentGroupId || currentGroupId === 'all') {
        list.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);"><i class="fas fa-info-circle"></i> يرجى تحديد مجموعة أولاً لعرض أرشيفها الخاص</td></tr>';
        toggleModal('absence-archive-modal', true);
        return;
    }

    // فلتر صارم: المجموعة الحالية فقط
    const mySessions = (db.absenceSessions || []).filter(s =>
        String(s.grade) === String(currentGrade) &&
        String(s.groupId) === String(currentGroupId)
    ).reverse();

    const currentGroupObj = db.groups.find(g => String(g.id) === String(currentGroupId));
    const archiveTitle = document.getElementById('absence-archive-modal-title') || document.querySelector('#absence-archive-modal h3');
    if (archiveTitle) archiveTitle.innerText = `أرشيف الحضور والغياب - ${currentGroupObj ? currentGroupObj.name : ''}`;

    list.innerHTML = mySessions.map(s => {
        const group = db.groups.find(g => g.id == s.groupId);
        return `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td>${new Date(s.date).toLocaleDateString('ar-EG')}</td>
                <td>${group ? group.name : 'الكل'}</td>
                <td><span style="color:var(--accent)">${s.presentCount} حاضر</span> / <span style="color:var(--danger)">${s.absentCount} غائب</span></td>
                <td>
                    <button class="btn btn-primary" style="padding:5px 10px;" onclick="viewAbsenceSessionDetails(${s.id})">
                        <i class="fas fa-eye"></i> التفاصيل
                    </button>
                    <button class="btn" style="color:var(--danger);" onclick="deleteAbsenceSession('${s.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('') || `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">لا يوجد جلسات مؤرشفة لهذه المجموعة بعد</td></tr>`;

    toggleModal('absence-archive-modal', true);
}

function deleteAbsenceSession(id) {
    if (!confirm('هل أنت متأكد من حذف هذا السجل من الأرشيف؟')) return;
    db.absenceSessions = db.absenceSessions.filter(s => s.id !== id);
    db.save();
    showAbsenceArchive();
}


function markStudentAbsentToday(studentId) {
    const s = db.students.find(x => x.id === studentId);
    db.attendance.push({
        id: Date.now(),
        studentId: studentId,
        groupId: s ? s.groupId : currentGroupId,
        date: new Date().toISOString(),
        status: 'absent'
    });
    db.save();
    generateAbsenceReport();
    showNotification('تم تسجيل الطالب غائب لليوم');
}

function sendAbsenceWhatsApp(id) {
    const s = db.students.find(x => x.id === id);
    if (!s) return;

    // ✅ استخدام نص الرسالة من إعدادات البرنامج مع استبدال {StudentName} باسم الطالب
    const message = buildAbsenceMessageForStudent(s.name);
    const url = `https://wa.me/2${s.parentPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    showNotification('تم فتح واتساب للإرسال المباشر');
}

function startSearchScanner() {
    toggleModal('search-scanner-modal', true);
    if (!searchScanner) searchScanner = new Html5Qrcode("search-reader");
    searchScanner.start(
        { facingMode: "environment" },
        { fps: 20, qrbox: { width: 300, height: 200 } },
        (decodedText) => {
            const input = document.getElementById('student-search-input');
            if (input) {
                input.value = decodedText;
                renderStudents();
                stopSearchScanner();
                showNotification('تم العثور على الطالب بنجاح ✅');

                // Highlight the student in the list if possible
                setTimeout(() => {
                    const rows = document.querySelectorAll('#students-list tr');
                    rows.forEach(row => {
                        if (row.innerText.includes(decodedText)) {
                            row.style.background = 'rgba(79, 70, 229, 0.2)';
                            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    });
                }, 500);
            }
        }
    ).catch(err => {
        console.error("Search scanner failed", err);
        showNotification('تعذر تشغيل الكاميرا', 'error');
    });
}

function stopSearchScanner() {
    if (searchScanner && searchScanner.isScanning) {
        searchScanner.stop().then(() => {
            toggleModal('search-scanner-modal', false);
        });
    } else {
        toggleModal('search-scanner-modal', false);
    }
}

function startQRScanner() {
    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, processScan)
        .catch(err => console.error("Scanner failed to start", err));
}

// --- NEW: Attendance History Functions ---
function toggleAttendanceView(view) {
    const scannerView = document.getElementById('attendance-scanner-view');
    const historyView = document.getElementById('attendance-history-view');
    const scannerBtn = document.getElementById('attendance-mode-btn');
    const historyBtn = document.getElementById('history-mode-btn');

    if (view === 'scanner') {
        scannerView.style.display = 'block';
        historyView.style.display = 'none';
        scannerBtn.style.background = 'var(--primary)';
        scannerBtn.style.color = 'white';
        historyBtn.style.background = 'var(--bg-white)';
        historyBtn.style.color = 'var(--text-main)';
        startQRScanner();
    } else {
        scannerView.style.display = 'none';
        historyView.style.display = 'block';
        scannerBtn.style.background = 'var(--bg-white)';
        scannerBtn.style.color = 'var(--text-main)';
        historyBtn.style.background = 'var(--primary)';
        historyBtn.style.color = 'white';
        if (html5QrCode) html5QrCode.stop().catch(() => { });
        renderHistoryByDate();
    }
}

function initHistoryGroups() {
    const select = document.getElementById('history-group-select');
    if (select) {
        const groups = db.groups.filter(g => g.grade == currentGrade);
        rebuildSelectPreservingSelection(
            select,
            () => '<option value="all">كل المجموعات</option>' +
                groups.map(g => `<option value="${g.id}">${g.name}</option>`).join(''),
            currentGroupId
        );
    }
}

function renderHistoryByDate() {
    let targetDate = document.getElementById('history-date-picker').value;
    if (!targetDate) {
        targetDate = new Date().toISOString().split('T')[0];
        document.getElementById('history-date-picker').value = targetDate;
    }

    const groupSelect = document.getElementById('history-group-select');
    const selectedGroup = groupSelect ? groupSelect.value : 'all';
    const list = document.getElementById('history-attendance-list');
    if (!list) return;

    document.getElementById('history-title').innerText = `سجل حضور يوم ${new Date(targetDate).toLocaleDateString('ar-EG')}`;

    // Filter students strictly by Active Group context
    const targetStudents = db.students.filter(s => {
        if (s.grade != currentGrade) return false;
        if (selectedGroup === 'all') return true;
        return String(s.groupId) === String(selectedGroup);
    });

    const attendanceRecords = db.attendance.filter(a => {
        const aDate = new Date(a.date).toLocaleDateString('en-CA');
        return aDate === targetDate;
    });
    let presentCount = 0;
    let absentCount = 0;
    list.innerHTML = targetStudents.map(student => {
        const record = attendanceRecords.find(a => a.studentId == student.id && a.status === 'present');
        const groupObj = db.groups.find(g => g.id == student.groupId);

        if (record) presentCount++; else absentCount++;

        const dateObj = new Date(targetDate);
        const dayName = dateObj.toLocaleDateString('ar-EG', { weekday: 'long' });
        const dayFormatted = `${dayName} ${dateObj.getDate()}/${dateObj.getMonth() + 1}`;

        return `
            <tr>
                <td><strong>${student.name}</strong></td>
                <td>${groupObj ? groupObj.name : '---'}</td>
                <td>${record ? new Date(record.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : dayFormatted}</td>
                <td>
                    <span class="status-badge" style="background:${record ? '#dcfce7' : '#fee2e2'}; color:${record ? '#166534' : '#991b1b'}">
                        ${record ? 'حاضر ✅' : 'غائب ❌'}
                    </span>
                </td>
            </tr>
        `;
    }).join('') || `<tr><td colspan="4" style="text-align:center; padding:3rem; color:var(--text-muted);">
        <i class="fas fa-users-slash" style="font-size:3rem; display:block; margin-bottom:1rem; opacity:0.3;"></i>
        لا يوجد طلاب مقيدين في هذه المجموعة حالياً
    </td></tr>`;

    document.getElementById('history-present-count').innerText = presentCount;
    document.getElementById('history-absent-count').innerText = absentCount;
}

function printHistoryReport() {
    const targetDate = document.getElementById('history-date-picker').value;
    if (!targetDate) return;
    window.print();
}

function enterPortalMode() {
    document.getElementById('portal-overlay').style.display = 'block';
    document.getElementById('portal-setup-container').style.display = 'flex';
    document.getElementById('portal-scanner-container').style.display = 'none';
    showPortalStep('grade');
}

function showPortalStep(step, data) {
    const gradeStep = document.getElementById('portal-step-grade');
    const groupStep = document.getElementById('portal-step-group');
    const setupContainer = document.getElementById('portal-setup-container');
    const scannerContainer = document.getElementById('portal-scanner-container');

    setupContainer.style.display = 'flex';
    scannerContainer.style.display = 'none';

    if (step === 'grade') {
        gradeStep.style.display = 'block';
        groupStep.style.display = 'none';
        renderPortalGrades();
    } else {
        gradeStep.style.display = 'none';
        groupStep.style.display = 'block';
        if (data) {
            const sysCode = gradeIdToSystemCode(String(data));
            currentGrade = sysCode;
            localStorage.setItem('edu_active_grade', sysCode);
            renderPortalGroups(data);
        }
    }
}

function renderPortalGrades() {
    const container = document.getElementById('portal-grades-list');
    if (!container) return;

    // Show years first
    let html = gradesList.map((g, idx) => `
        <div class="grade-card-modern shadow-hover fade-in" onclick="showPortalStep('group', '${g.id}')" style="--accent-color: hsl(${idx * 137.5}, 70%, 50%); background: #fff; color: var(--text-main); border: 1px solid #eee; height: 260px; width: 220px; cursor: pointer;">
            <div class="card-icon-modern"><i class="fas ${g.icon || 'fa-graduation-cap'}"></i></div>
            <h2 style="font-size: 1.5rem;">${g.name}</h2>
            <p style="font-size: 0.9rem;">إدارة بيانات ${g.name}</p>
            <div class="card-stats-modern">دخول البوابة</div>
        </div>
    `).join('');

    // Add Grade at the end
    html += `
        <div class="grade-card-modern fade-in" onclick="toggleModal('add-grade-modal', true)" style="--accent-color: var(--primary); border: 2px dashed rgba(0,0,0,0.1); background: #f8fafc; color: var(--text-main); height: 260px; width: 220px; cursor: pointer;">
            <div class="card-icon-modern" style="background: var(--bg-light); color: var(--primary);"><i class="fas fa-plus"></i></div>
            <h2 style="font-size: 1.4rem;">إضافة سنة جديدة</h2>
            <p style="font-size: 0.85rem;">تعريف مرحلة دراسية مخصصة</p>
            <div class="card-stats-modern" style="color: var(--primary);">اضغط للإضافة</div>
        </div>
    `;

    container.innerHTML = html;
}

async function renderPortalGroups(gradeId) {
    const container = document.getElementById('portal-groups-list');
    if (!container) return;

    const gradeObj = gradesList.find(g => String(g.id) === String(gradeId));
    document.getElementById('portal-grade-title-active').innerText = gradeObj ? gradeObj.name : 'السنة الدراسية';

    // ── ضمان وجود مجاميع الحجز الثابتة قبل الرسم ──────────────
    const systemGradeId = gradeIdToSystemCode(gradeId);
    const isBookingGrade = systemGradeId === '2' || systemGradeId === '3';
    let gradeGroups = db.groups.filter(g => String(g.grade) === systemGradeId);

    if (isBookingGrade && gradeGroups.length === 0) {
        // أظهر loading مؤقت ريثما تُزرع المجاميع
        container.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                        height:260px;width:100%;gap:16px;color:var(--text2,#888);">
                <i class="fas fa-spinner fa-spin" style="font-size:2rem;color:var(--primary,#c8a96e);"></i>
                <span style="font-size:1rem;font-weight:700;">جاري تحميل المجاميع...</span>
            </div>`;
        gradeGroups = db.groups.filter(g => String(g.grade) === systemGradeId);
    }

    // Groups first
    let html = gradeGroups.map((group, idx) => `
        <div class="grade-card-modern shadow-hover fade-in" onclick="enterSystemFromPortal('${group.id}')" style="--accent-color: hsl(${200 + idx * 40}, 70%, 50%); background: #fff; color: var(--text-main); border: 1px solid #eee; height: 260px; width: 220px; cursor: pointer;">
            <div class="card-icon-modern"><i class="fas fa-users"></i></div>
            <h2 style="font-size: 1.5rem;">${group.name}</h2>
            <p style="font-size: 0.9rem;">الموعد: ${group.time}</p>
            
            <div style="display: flex; gap: 8px; margin-top: 15px; width: 100%; padding: 0 10px; box-sizing: border-box;">
                 <button class="btn" onclick="event.stopPropagation(); startPortalSession('${group.id}')" style="flex: 1; height: 40px; font-size: 0.8rem; border-radius: 8px; background: var(--bg-light); color: var(--accent); border: 1px solid var(--border);">
                    <i class="fas fa-qrcode"></i> نظام الماسح
                </button>
                <button class="btn btn-primary" onclick="event.stopPropagation(); enterSystemFromPortal('${group.id}')" style="flex: 1.2; height: 40px; font-size: 0.8rem; border-radius: 8px;">
                    <i class="fas fa-cog"></i> الإدارة
                </button>
            </div>
            <div class="card-stats-modern">اضغط لدخول السيستم</div>
        </div>
    `).join('');

    // --- NEW: Joint Day Card ---
    html += `
        <div class="grade-card-modern shadow-hover fade-in" onclick="openJointDaySelector('${gradeId}')" style="--accent-color: var(--vibrant-orange); background: #fff; color: var(--text-main); border: 2px solid var(--vibrant-orange); border-style: dashed; height: 260px; width: 220px; cursor: pointer;">
            <div class="card-icon-modern" style="background: var(--vibrant-orange); color: white;"><i class="fas fa-layer-group"></i></div>
            <h2 style="font-size: 1.5rem; color: var(--vibrant-orange); font-weight: 800;">يوم جماعي</h2>
            <p style="font-size: 0.85rem;">رصد أكثر من مجموعة معاً</p>
            <div class="card-stats-modern" style="background: var(--vibrant-orange); color: white;">اختر المجموعات</div>
        </div>
    `;

    // Add group at the end
    html += `
        <div class="grade-card-modern fade-in" onclick="toggleModal('group-modal', true)" style="--accent-color: var(--secondary); border: 2px dashed rgba(0,0,0,0.1); background: #f8fafc; color: var(--text-main); height: 260px; width: 220px; cursor: pointer;">
            <div class="card-icon-modern" style="background: var(--bg-light); color: var(--secondary);"><i class="fas fa-plus"></i></div>
            <h2 style="font-size: 1.4rem;">مجموعة جديدة</h2>
            <p style="font-size: 0.85rem;">تعريف وقت حصة جديد</p>
            <div class="card-stats-modern" style="color: var(--secondary);">اضغط للإضافة</div>
        </div>
    `;

    container.innerHTML = html;
}

function openJointDaySelector(gradeId, context = 'portal') {
    const list = document.getElementById('joint-groups-list');
    const groups = db.groups.filter(g => String(g.grade) === gradeIdToSystemCode(String(gradeId)));
    jointSessionContext = context;

    list.innerHTML = groups.map(g => `
        <div onclick="toggleJointGroup(this, '${g.id}')" style="display:flex; align-items:center; gap:15px; padding: 12px; border-radius: 10px; cursor: pointer; margin-bottom: 8px; border: 2px solid #eee; background: white; transition: 0.2s;" class="joint-group-item">
            <div style="width: 24px; height: 24px; border: 2px solid var(--primary); border-radius: 6px; display: flex; align-items: center; justify-content: center;" class="check-box">
                <i class="fas fa-check" style="color: white; font-size: 0.7rem;"></i>
            </div>
            <div style="flex:1;">
                <div style="font-weight:700; color: var(--text-main);">${g.name}</div>
                <div style="font-size:0.75rem; color: var(--text-muted);">${g.time}</div>
            </div>
        </div>
    `).join('') || '<p style="text-align:center; padding: 1rem; color: var(--text-muted);">لا توجد مجموعات مسجلة لهذا الصف بعد</p>';

    activePortalGroupIds = []; // Clear previous selections
    toggleModal('joint-day-modal', true);
}

function toggleJointGroup(el, id) {
    const isSelected = activePortalGroupIds.includes(String(id));
    const checkbox = el.querySelector('.check-box');
    const checkIcon = checkbox.querySelector('i');

    if (isSelected) {
        activePortalGroupIds = activePortalGroupIds.filter(gid => gid !== String(id));
        el.style.borderColor = '#eee';
        checkbox.style.background = 'transparent';
    } else {
        activePortalGroupIds.push(String(id));
        el.style.borderColor = 'var(--primary)';
        checkbox.style.background = 'var(--primary)';
    }
}

function startJointSession() {
    if (activePortalGroupIds.length === 0) {
        showNotification('برجاء اختيار مجموعة واحدة على الأقل', 'error');
        return;
    }

    toggleModal('joint-day-modal', false);

    // Set first group as the primary context but mark it as joint session
    const firstGroup = db.groups.find(g => activePortalGroupIds.includes(String(g.id)));
    activePortalGroupId = 'joint:' + activePortalGroupIds.join(',');

    currentGrade = String(firstGroup.grade);
    currentGroupId = activePortalGroupIds[0];
    localStorage.setItem('edu_active_grade', currentGrade);
    localStorage.setItem('edu_active_group', currentGroupId);

    syncUIWithContext();

    const selectedGroupNames = db.groups.filter(g => activePortalGroupIds.includes(String(g.id))).map(g => g.name).join(' + ');

    if (jointSessionContext === 'internal') {
        // Handle Internal Context (Attendance Section)
        startLessonCoding(); // This will use activePortalGroupId set above
        const badge = document.getElementById('session-status-badge');
        if (badge) {
            badge.innerHTML = `
                <span class="status-badge" style="background: var(--vibrant-orange); color: white; padding: 0.5rem 1.5rem; font-size: 1rem;">
                    <i class="fas fa-layer-group" style="font-size: 0.8rem; margin-left: 5px;"></i> جلسة اليوم الجماعي نشطة: ${selectedGroupNames}
                </span>`;
        }
        document.getElementById('start-joint-session-btn').style.display = 'none';
        showNotification('تم بدء جلسة التشفير الجماعي بنجاح 🚀', 'success');
    } else {
        // Handle Portal Context
        document.getElementById('active-group-label').innerHTML = `
            <span style="background:var(--vibrant-orange);">يوم جماعي</span>
            <span style="margin-right:10px;">${selectedGroupNames}</span>
        `;
        document.getElementById('portal-setup-container').style.display = 'none';
        document.getElementById('portal-scanner-container').style.display = 'grid';
        renderPortalAttendance();
        if (!portalScanner) portalScanner = new Html5Qrcode("portal-reader");
        portalScanner.start({ facingMode: "environment" }, { fps: 25, qrbox: { width: 350, height: 250 } }, processScan);
    }
}

function enterSystemFromPortal(groupId) {
    exitPortalMode();
    enterGroup(groupId);
}

function startPortalSession(groupId) {
    if (!groupId) return;

    activePortalGroupId = groupId;
    const groupObj = db.groups.find(g => g.id == groupId);

    currentGrade = String(groupObj.grade);
    currentGroupId = String(groupId);
    localStorage.setItem('edu_active_grade', currentGrade);
    localStorage.setItem('edu_active_group', currentGroupId);

    syncUIWithContext();

    document.getElementById('active-group-label').innerText = `المجموعة النشطة: ${groupObj ? groupObj.name : 'مجهولة'}`;

    // Switch containers
    document.getElementById('portal-setup-container').style.display = 'none';
    document.getElementById('portal-scanner-container').style.display = 'grid';

    renderPortalAttendance();
    if (!portalScanner) portalScanner = new Html5Qrcode("portal-reader");
    portalScanner.start({ facingMode: "environment" }, { fps: 25, qrbox: { width: 350, height: 250 } }, processScan);
}

function renderPortalAttendance() {
    const today = new Date().toISOString().split('T')[0];
    const presentToday = db.attendance.filter(a => a.date.startsWith(today));
    const list = document.getElementById('portal-attendance-list');
    const badge = document.getElementById('portal-stats-badge');

    // NEW: Handle Joint/Single group filtering for the list display
    let allowedGroupIds = [];
    if (activePortalGroupId) {
        if (String(activePortalGroupId).startsWith('joint:')) {
            allowedGroupIds = activePortalGroupId.split(':')[1].split(',');
        } else {
            allowedGroupIds = [String(activePortalGroupId)];
        }
    }

    // Determine students present who belong to the ACTIVE CONTEXT (Grade + Selected Groups if any)
    const gradeStudents = db.students.filter(s => s.grade == currentGrade);
    const gradeStudentIds = gradeStudents.map(s => s.id);

    // Narrow down to selected groups if in Joint Mode or Single Portal context
    const gradePresence = presentToday.filter(a => {
        const student = db.students.find(s => s.id === a.studentId);
        if (!student || student.grade != currentGrade) return false;

        // If groups are explicitly selected, filter by them
        if (allowedGroupIds.length > 0) {
            return allowedGroupIds.includes(String(student.groupId));
        }
        return true;
    });

    if (badge) badge.innerText = `${gradePresence.length} طلاب`;

    if (!list) return;

    list.innerHTML = gradePresence.map(att => {
        const s = db.students.find(x => x.id === att.studentId);
        if (!s) return '';

        const payment = db.payments.find(p =>
            p.studentId == s.id &&
            p.category === 'اشتراك شهري' &&
            p.cycleId == db.settings.activeCycle
        );
        const isPaid = !!payment;
        const isExemption = payment?.isExemption;

        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="avatar" style="width:30px; height:30px; font-size:0.8rem;">${s.name.charAt(0)}</div>
                        <div style="text-align:right;">
                            <div style="font-weight:700;">${s.name}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">كود: ${s.qrCode}</div>
                        </div>
                    </div>
                </td>
                <td style="font-family:monospace;">${new Date(att.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>
                    <div style="display:flex; gap:5px; align-items:center;">
                        <button class="btn" style="padding: 4px 12px; border-radius: 50px; font-size: 0.8rem; background: ${isPaid ? (isExemption ? 'var(--bg-light)' : '#dcfce7') : 'var(--payment-orange)'}; color: ${isPaid ? (isExemption ? 'var(--text-main)' : '#166534') : 'white'}; min-width: 80px;" onclick="toggleMonthlyPayment(${s.id})">
                            ${isPaid ? (isExemption ? 'معفي ✅' : 'خالص ✅') : 'دفع؟'}
                        </button>
                        ${!isPaid ? `
                        <button class="btn" style="padding: 4px 10px; border-radius: 50px; font-size: 0.75rem; background: #f5f3ff; border:1px solid #ddd6fe; color:#7c3aed; font-weight:600;" onclick="exemptMonthlyPayment(${s.id})">إعفاء 🤍</button>
                        <button class="btn" style="padding: 4px 10px; border-radius: 50px; font-size: 0.75rem; background: #fff7ed; border:1px solid #fed7aa; color:#ea580c; font-weight:600;" onclick="discountMonthlyPayment(${s.id})">خصم %</button>
                        ` : ''}
                    </div>
                </td>
                <td style="text-align:center;">
                    <button class="btn" style="color:var(--danger); background:transparent;" onclick="removeAttendance(${att.id})">حذف</button>
                </td>
            </tr>
        `;
    }).join('') || '<tr class="no-data"><td colspan="4" style="text-align:center; padding:2rem; color:var(--text-muted);">لا يوجد حضور في هذا الصف اليوم حتى الآن..</td></tr>';
}

function renderSubscriptionTracker() {
    // This function is now deprecated in favor of renderMonthlySubscriptionTables
    // but we can make it redirect or show a grade-wide view if needed.
    renderMonthlySubscriptionTables();
}

function toggleMonthlyPayment(studentId) {
    const payIndex = db.payments.findIndex(p =>
        p.studentId == studentId &&
        p.category === 'اشتراك شهري' &&
        p.cycleId == db.settings.activeCycle
    );

    if (payIndex > -1) {
        const pass = prompt('يرجى إدخال كلمة المرور لإلغاء تسجيل الدفع (مطلوب للصلاحيات):');
        const correct = (db._settings.globalPasswords && db._settings.globalPasswords.unlockPayment) || '100qwe';
        if (pass === correct) {
            db.payments.splice(payIndex, 1);
            showNotification('تم إلغاء تسجيل الدفع الشهري بنجاح', 'warning');
        } else {
            showNotification('كلمة المرور غير صحيحة، لم يتم الإلغاء', 'error');
            return;
        }
    } else {
        db.payments.push({
            id: Date.now(),
            studentId,
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            amount: db.settings.monthlyFee || 0,
            date: new Date().toISOString(),
            category: 'اشتراك شهري',
            cycleId: db.settings.activeCycle,
            collectedBy: (typeof EmployeeAuth !== 'undefined') ? EmployeeAuth.getCurrentName() : undefined
        });
        addToQueue(studentId, 'payment');
        showNotification('تم تسجيل الدفع بنجاح ✅');
    }
    // ⚡ إصلاح أداء: حفظ جدول المدفوعات فقط بدل حفظ كل الجداول (بما فيها آلاف الطلاب)
    // في كل عملية دفع — كان ده بيسبب بطء/تجمّد شديد وأحياناً "ريفرش" مفاجئ للصفحة
    // على الأجهزة اللي فيها عدد كبير من الطلاب.
    db.save('payments');
    renderPortalAttendance();
    renderSubscriptionTracker();
    renderFinances();
    renderMonthlySubscriptionTables();
    updateDashboardStats();
}

function renderDailyTreasury() {
    const list = document.getElementById('dt-list');
    const statsGrid = document.getElementById('dt-stats-grid');
    const dateLabel = document.getElementById('dt-current-date');
    if (!list || !statsGrid) return;

    const todayStr = new Date().toLocaleDateString('en-CA');
    if (dateLabel) dateLabel.innerText = `تقرير يوم: ${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

    const todayPayments = db.payments.filter(p => {
        const pDate = new Date(p.date).toLocaleDateString('en-CA');
        if (pDate !== todayStr) return false;

        // --- NEW: STRICT ISOLATION BY GRADE & GROUP ---
        const student = db.students.find(s => s.id === p.studentId);
        if (!student || String(student.grade) !== String(currentGrade) || String(student.groupId) !== String(currentGroupId)) return false;

        const sessionResetTime = (db.settings.treasurySessionResetTime && db.settings.treasurySessionResetTime[todayStr]) || 0;
        return p.id > sessionResetTime;
    });

    const todayExpenses = db.expenses.filter(e => {
        const eDate = new Date(e.date || e.id).toLocaleDateString('en-CA');
        if (eDate !== todayStr) return false;

        // --- NEW: STRICT ISOLATION BY GRADE & GROUP ---
        if (String(e.grade || currentGrade) !== String(currentGrade) || String(e.groupId) !== String(currentGroupId)) return false;

        const sessionResetTime = (db.settings.treasurySessionResetTime && db.settings.treasurySessionResetTime[todayStr]) || 0;
        return e.id > sessionResetTime;
    });


    let totalSub = 0;
    let totalMisc = 0;
    let totalExpensesTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

    list.innerHTML = `
        ${todayPayments.map(p => {
        const student = db.students.find(s => s.id === p.studentId);
        const group = student ? db.groups.find(g => g.id == student.groupId) : null;
        if (p.category === 'اشتراك شهري') totalSub += p.amount;
        else totalMisc += p.amount;

        return `
            <tr>
                <td style="padding: 1.2rem 1rem;">
                    <div style="font-weight:700;">${student ? student.name : 'طالب مجهول'}</div>
                </td>
                <td>${group ? group.name : '---'}</td>
                <td><span class="status-badge" style="background:var(--bg-light); color:var(--text-main)">${p.category}</span>${p.collectedBy ? `<br><span style="font-size:.72rem; color:var(--text-muted);"><i class="fas fa-user"></i> ${p.collectedBy}</span>` : ''}</td>
                <td style="text-align:center; font-weight:800; color:var(--accent); font-size:1.1rem;">${p.amount} ج.م</td>
                <td style="text-align:center; color:var(--text-muted)">${new Date(p.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</td>
            </tr>
        `;
    }).join('')}
        ${todayExpenses.map(e => `
            <tr style="background: #fef2f2;">
                <td style="padding: 1.2rem 1rem;">
                    <div style="font-weight:700;">مصروف: ${e.title}</div>
                </td>
                <td>---</td>
                <td><span class="status-badge" style="background:#fee2e2; color:var(--danger)">مصروفات</span></td>
                <td style="text-align:center; font-weight:800; color:var(--danger); font-size:1.1rem;">-${e.amount} ج.م</td>
                <td style="text-align:center; color:var(--text-muted)">---</td>
            </tr>
        `).join('')}
    ` || '<tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--text-muted);">لا يوجد تحصيلات مالية مسجلة اليوم حتى الآن..</td></tr>';

    statsGrid.innerHTML = `
        <div class="card" style="padding:1.5rem; text-align:center; border-bottom:4px solid var(--accent); background: #f0fdf4;">
            <div style="font-size:0.9rem; color:var(--text-muted); margin-bottom: 10px;">إجمالي الاشتراكات</div>
            <div style="font-size:2rem; font-weight:800; color:var(--accent);">${totalSub} <small>ج.م</small></div>
            <p style="font-size:0.8rem; margin-top:5px; opacity:0.7;">محصلة من اشتراكات الشهر</p>
        </div>
        <div class="card" style="padding:1.5rem; text-align:center; border-bottom:4px solid var(--vibrant-orange); background: #fffcf0;">
            <div style="font-size:0.9rem; color:var(--text-muted); margin-bottom: 10px;">ملازم / أخرى</div>
            <div style="font-size:2rem; font-weight:800; color:var(--vibrant-orange);">${totalMisc} <small>ج.م</small></div>
            <p style="font-size:0.8rem; margin-top:5px; opacity:0.7;">محصلة من الملازم والخدمات الأخرى</p>
        </div>
        <div class="card" style="padding:1.5rem; text-align:center; border-bottom:4px solid var(--danger); background: #fef2f2;">
            <div style="font-size:0.9rem; color:var(--text-muted); margin-bottom: 10px;">إجمالي المصروفات</div>
            <div style="font-size:2rem; font-weight:800; color:var(--danger);">${totalExpensesTotal} <small>ج.م</small></div>
            <p style="font-size:0.8rem; margin-top:5px; opacity:0.7;">إجمالي ما تم إنفاقه اليوم</p>
        </div>
        <div class="card" style="padding:1.5rem; text-align:center; background:var(--primary); color:#fff; box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4); grid-column: span 3;">
            <div style="font-size:0.9rem; opacity: 0.9; margin-bottom: 10px;">صافي العهدة النقدية اليوم</div>
            <div style="font-size:2.5rem; font-weight:900;">${totalSub + totalMisc - totalExpensesTotal} <small>ج.م</small></div>
            <p style="font-size:0.8rem; margin-top:5px; opacity:0.7;">إجمالي المتبقي في الخزنة اليوم فعلياً</p>
        </div>
    `;
}

function showDailyTreasuryReport() {
    renderDailyTreasury(); // يُحدّث شاشة "الخزنة اليومية" الكاملة لو كانت مفتوحة
    renderQuickDailyTreasuryModal(); // يُحدّث بيانات المودال السريع نفسه
    toggleModal('daily-treasury-modal', true);
}

/**
 * يملأ مودال "عرض كشف تحصيل الخزنة اليومي" السريع (المتاح من الرئيسية وشاشة
 * المسح) ببيانات جلسة اليوم الحالية، مطابقة تماماً لما تعرضه شاشة الخزنة
 * اليومية الكاملة (نفس العزل بالصف/المجموعة وحدود الجلسة).
 */
function renderQuickDailyTreasuryModal() {
    const statsEl = document.getElementById('daily-treasury-stats');
    const listEl = document.getElementById('daily-treasury-list');
    if (!statsEl || !listEl) return;

    const { todayPayments, todayExpenses, totalSub, totalMisc, totalExpenses } = _getTodaysTreasurySessionData();
    const netTotal = totalSub + totalMisc - totalExpenses;

    statsEl.innerHTML = `
        <div class="card" style="padding:1rem; text-align:center; border-bottom:4px solid var(--accent); background:#f0fdf4;">
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:6px;">اشتراكات</div>
            <div style="font-size:1.4rem; font-weight:800; color:var(--accent);">${totalSub} <small>ج.م</small></div>
        </div>
        <div class="card" style="padding:1rem; text-align:center; border-bottom:4px solid #f59e0b; background:#fffbeb;">
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:6px;">ملازم / أخرى</div>
            <div style="font-size:1.4rem; font-weight:800; color:#f59e0b;">${totalMisc} <small>ج.م</small></div>
        </div>
        <div class="card" style="padding:1rem; text-align:center; background:var(--primary); color:#fff;">
            <div style="font-size:0.8rem; opacity:0.9; margin-bottom:6px;">صافي العهدة</div>
            <div style="font-size:1.4rem; font-weight:800;">${netTotal} <small>ج.م</small></div>
        </div>
    `;

    const paymentRows = todayPayments.map(p => {
        const student = db.students.find(s => s.id === p.studentId);
        return `
            <tr>
                <td style="padding-right: 1rem;">${student ? student.name : 'طالب مجهول'}</td>
                <td>${p.category}</td>
                <td style="text-align:center; font-weight:700; color:var(--accent);">${p.amount} ج.م</td>
            </tr>`;
    }).join('');

    const expenseRows = todayExpenses.map(e => `
        <tr style="background:#fff5f5;">
            <td style="padding-right: 1rem; color:var(--danger);">↳ ${e.title}</td>
            <td style="color:var(--text-muted);">مصروف</td>
            <td style="text-align:center; font-weight:700; color:var(--danger);">-${e.amount} ج.م</td>
        </tr>`).join('');

    listEl.innerHTML = (paymentRows + expenseRows) ||
        '<tr><td colspan="3" style="text-align:center; padding:2rem; color:var(--text-muted);">لا توجد تحصيلات في هذه الجلسة حتى الآن</td></tr>';
}

function manualResetDailyTreasury() {
    const pass = prompt("برجاء إدخال كلمة المرور لتصفير العهدة والبدء من جديد (إغلاق الجلسة):");
    if (pass === '1234') {
        if (!confirm("هل أنت متأكد؟ سيتم أرشفة عهدة الفترة الحالية لجميع المجموعات وتصفير العداد للبدء من جديد.")) return;

        const todayStr = new Date().toLocaleDateString('en-CA');
        const sessionResetTime = (db.settings.treasurySessionResetTime && db.settings.treasurySessionResetTime[todayStr]) || 0;
        const sessionLabel = `تصفير يدوي — ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;

        // 1. جمع جميع مدفوعات الجلسة الحالية (بعد آخر تصفير) من كل المجموعات
        const allSessionPayments = (db.payments || []).filter(p => {
            const pDate = new Date(p.date).toLocaleDateString('en-CA');
            return pDate === todayStr && p.id > sessionResetTime;
        });
        const allSessionExpenses = (db.expenses || []).filter(e => {
            const eDate = new Date(e.date || e.id).toLocaleDateString('en-CA');
            return eDate === todayStr && (e.id > sessionResetTime);
        });

        // 2. تجميع بحسب (grade + groupId)
        const pairMap = new Map();
        allSessionPayments.forEach(p => {
            const s = (db.students || []).find(x => x.id === p.studentId);
            if (!s) return;
            const key = `${s.grade}||${s.groupId}`;
            if (!pairMap.has(key)) pairMap.set(key, { payments: [], expenses: [] });
            pairMap.get(key).payments.push(p);
        });
        allSessionExpenses.forEach(e => {
            const grade   = e.grade   || currentGrade;
            const groupId = e.groupId || currentGroupId;
            const key = `${grade}||${groupId}`;
            if (!pairMap.has(key)) pairMap.set(key, { payments: [], expenses: [] });
            pairMap.get(key).expenses.push(e);
        });

        // 3. إنشاء entry أرشيف لكل مجموعة على حدة
        if (!db.dailyTreasuryArchives) db.dailyTreasuryArchives = [];

        pairMap.forEach(({ payments, expenses }, key) => {
            const [grade, groupId] = key.split('||');
            let totalSub = 0, totalMisc = 0;
            payments.forEach(p => {
                if (p.category === 'اشتراك شهري') totalSub += (p.amount || 0);
                else totalMisc += (p.amount || 0);
            });
            const totalExp = expenses.reduce((s, e) => s + (e.amount || 0), 0);

            const archiveEntry = {
                id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
                date: todayStr,
                grade,
                groupId,
                sessionName: sessionLabel,
                totalSub,
                totalMisc,
                totalExp,
                total: totalSub + totalMisc - totalExp,
                payments: payments.map(p => {
                    const st = (db.students || []).find(x => x.id === p.studentId);
                    return {
                        studentName: st ? st.name : 'طالب مجهول',
                        category: p.category,
                        amount: p.amount,
                        time: new Date(p.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                    };
                }),
                expenses: expenses.map(e => ({
                    title: e.description || e.name || 'مصروف',
                    amount: e.amount,
                    time: new Date(e.date || e.id).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                }))
            };

            // تجنّب التكرار: احذف أي entry موجود لنفس اليوم + المجموعة + الجلسة
            const existIdx = db.dailyTreasuryArchives.findIndex(
                a => a.date === todayStr && String(a.grade) === String(grade) &&
                     String(a.groupId) === String(groupId) && a.sessionName === sessionLabel
            );
            if (existIdx !== -1) db.dailyTreasuryArchives.splice(existIdx, 1);
            db.dailyTreasuryArchives.push(archiveEntry);
        });

        // 4. تحديث وقت التصفير الآن
        if (!db.settings.treasurySessionResetTime) db.settings.treasurySessionResetTime = {};
        db.settings.treasurySessionResetTime[todayStr] = Date.now();

        db.save();
        StorageEngine.save('dailyTreasuryArchives', db.dailyTreasuryArchives).catch(() => {});
        renderDailyTreasury();
        showNotification(`✅ تم تصفير العهدة لجميع المجموعات (${pairMap.size} مجموعة) والبدء من جديد`, "success");
    } else {
        showNotification("❌ كلمة المرور غير صحيحة", "error");
    }
}

function autoArchiveDailyTreasury() {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const nowHour  = new Date().getHours();

    // ── ساعة التصفير: من الإعدادات أو افتراضي 0 (منتصف الليل) ──
    const archiveHour = parseInt(
        (db._settings && db._settings.treasuryArchiveHour != null)
            ? db._settings.treasuryArchiveHour
            : (localStorage.getItem('treasuryArchiveHour') || '0'),
        10
    );

    const lastDateStr = db.dailyTreasuryLastArchiveDate
        || localStorage.getItem('dt_last_archive_date')
        || localStorage.getItem('dailyTreasuryLastArchiveDate');

    // ── أول تشغيل: ابدأ من اليوم ──
    if (!lastDateStr) {
        db.dailyTreasuryLastArchiveDate = todayStr;
        localStorage.setItem('dt_last_archive_date', todayStr);
        db.save();
        return;
    }

    // ── حساب تاريخ "أمس الأرشيفي" بحسب ساعة التصفير ──
    // إذا لم نبلغ ساعة التصفير بعد اليوم، فالفترة الحالية لا تزال "اليوم"
    // وإذا بلغناها، يجب أرشفة ما حدث قبل ساعة التصفير من اليوم
    let archivedAny = false;

    // ── أرشفة الأيام السابقة (من آخر أرشفة حتى أمس) ──
    let iterateDate = new Date(lastDateStr);
    iterateDate.setDate(iterateDate.getDate() + 1);
    const todayDate = new Date(todayStr);

    while (iterateDate < todayDate) {
        const currentIterDateStr = iterateDate.toLocaleDateString('en-CA');
        _archiveDateTreasury(currentIterDateStr);
        archivedAny = true;
        iterateDate.setDate(iterateDate.getDate() + 1);
    }

    // ── أرشفة اليوم الحالي إذا وصلنا أو تجاوزنا ساعة التصفير ──
    if (nowHour >= archiveHour && lastDateStr !== todayStr) {
        _archiveDateTreasury(todayStr);
        archivedAny = true;
    }

    db.dailyTreasuryLastArchiveDate = todayStr;
    localStorage.setItem('dt_last_archive_date', todayStr);
    localStorage.setItem('dailyTreasuryLastArchiveDate', todayStr);
    db.save();

    if (archivedAny && document.getElementById('daily-treasury-modal')?.style.display === 'block') {
        renderDailyTreasury();
    }
}

/**
 * يؤرشف عهدة تاريخ محدد (يُستدعى من autoArchiveDailyTreasury والزر اليدوي).
 * @param {string} dateStr  - بصيغة en-CA مثل "2026-06-27"
 */
function _archiveDateTreasury(dateStr) {
    const dayPayments = db.payments.filter(p => {
        const pDate = new Date(p.date).toLocaleDateString('en-CA');
        return pDate === dateStr;
    });
    const dayExpenses = db.expenses.filter(e => {
        const eDate = new Date(e.date || e.id).toLocaleDateString('en-CA');
        return eDate === dateStr;
    });

    // ── تجميع الأزواج (صف + مجموعة) الموجودة في هذا اليوم ──
    const pairKeys = new Set();
    dayPayments.forEach(p => {
        const s = db.students.find(x => x.id === p.studentId);
        if (s) pairKeys.add(`${s.grade}||${s.groupId}`);
    });
    dayExpenses.forEach(e => {
        if (e.grade || e.groupId) pairKeys.add(`${e.grade || currentGrade}||${e.groupId || currentGroupId}`);
    });

    if (pairKeys.size === 0) return; // لا يوجد شيء لأرشفته

    if (!db.dailyTreasuryArchives) db.dailyTreasuryArchives = [];

    const archivedPaymentIds = [];
    const archivedExpenseIds = [];

    pairKeys.forEach(pairKey => {
        const [gId, grpId] = pairKey.split('||');

        const groupPayments = dayPayments.filter(p => {
            const s = db.students.find(x => x.id === p.studentId);
            return s && String(s.grade) === String(gId) && String(s.groupId) === String(grpId);
        });
        const groupExpenses = dayExpenses.filter(e =>
            String(e.grade || currentGrade) === String(gId) &&
            String(e.groupId || currentGroupId) === String(grpId)
        );

        // 🔧 تسجيل معرفات العناصر المؤرشفة لحذفها لاحقاً
        groupPayments.forEach(p => archivedPaymentIds.push(p.id));
        groupExpenses.forEach(e => archivedExpenseIds.push(e.id));

        let totalSub = 0, totalMisc = 0;
        groupPayments.forEach(p => {
            if (p.category === 'اشتراك شهري') totalSub += p.amount;
            else totalMisc += p.amount;
        });
        const totalExp = groupExpenses.reduce((s, e) => s + e.amount, 0);

        const archiveEntry = {
            id: Date.now() * 1000 + Math.floor(Math.random() * 1000), // رقم صحيح دائماً
            date: dateStr,
            grade: gId,
            groupId: grpId || 'ungrouped',
            totalSub,
            totalMisc,
            totalExp,
            total: totalSub + totalMisc,
            payments: groupPayments.map(p => {
                const s = db.students.find(x => x.id === p.studentId);
                return {
                    studentName: s ? s.name : 'طالب مجهول',
                    category: p.category,
                    amount: p.amount,
                    collectedBy: p.collectedBy || null,
                    time: new Date(p.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                };
            }),
            expenses: groupExpenses.map(e => ({
                description: e.description || e.name || 'مصروف',
                amount: e.amount,
                time: new Date(e.date || e.id).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
            }))
        };

        // تجنّب التكرار: استبدال أي أرشيف موجود لنفس اليوم/الصف/المجموعة
        const existingIdx = db.dailyTreasuryArchives.findIndex(
            a => a.date === dateStr && String(a.grade) === String(gId) && String(a.groupId) === String(grpId)
        );
        if (existingIdx !== -1) db.dailyTreasuryArchives.splice(existingIdx, 1);
        db.dailyTreasuryArchives.push(archiveEntry);
    });

    // 🔧 الإصلاح الحاسم: حذف المدفوعات والمصروفات المؤرشفة من قاعدة البيانات
    // بعد نقل البيانات إلى الأرشيف بنجاح، يجب حذفها من الجداول النشطة
    console.log(`[_archiveDateTreasury] أرشفة ${archivedPaymentIds.length} مدفوعات و ${archivedExpenseIds.length} مصروفات من تاريخ ${dateStr}`);
    
    if (archivedPaymentIds.length > 0) {
        db.payments = db.payments.filter(p => !archivedPaymentIds.includes(p.id));
        console.log(`✅ تم حذف ${archivedPaymentIds.length} مدفوعات من العهدة الحالية`);
    }
    
    if (archivedExpenseIds.length > 0) {
        db.expenses = db.expenses.filter(e => !archivedExpenseIds.includes(e.id));
        console.log(`✅ تم حذف ${archivedExpenseIds.length} مصروفات من العهدة الحالية`);
    }

    // ⭐ حفظ التغييرات فوراً في IndexedDB
    Promise.all([
        StorageEngine.save('payments', db.payments),
        StorageEngine.save('expenses', db.expenses),
        StorageEngine.save('dailyTreasuryArchives', db.dailyTreasuryArchives)
    ]).catch(err => console.error('[_archiveDateTreasury] خطأ في الحفظ:', err));
}


function renderDailyTreasuryArchives(filterGroupId = 'all') {
    const list        = document.getElementById('dt-archive-list');
    const mainView    = document.getElementById('dt-main-view');
    const archiveView = document.getElementById('dt-archive-view');
    if (!list) return;

    if (mainView)    mainView.style.display    = 'none';
    if (archiveView) archiveView.style.display = 'block';

    const titleEl = document.getElementById('dt-archive-title');
    if (titleEl) titleEl.innerHTML = '<i class="fas fa-history"></i> أرشيف العهدة — جميع المجموعات';

    const allArchives = [...(db.dailyTreasuryArchives || [])];

    // ── بناء شريط الفلتر ────────────────────────────────────
    const groupIds = [...new Set(
        allArchives
            .map(a => String(a.groupId || ''))
            .filter(Boolean)
    )];

    // نستخدم data-gid بدلاً من onclick مباشرة لتجنب تعارض الـ quotes
    const filterBar = document.createElement('div');
    filterBar.style.cssText = 'margin-bottom:1.5rem; display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap; padding:1rem; background:var(--bg-light); border-radius:12px;';

    const filterLabel = document.createElement('strong');
    filterLabel.style.cssText = 'color:var(--primary); font-size:.9rem;';
    filterLabel.innerHTML = '<i class="fas fa-filter"></i> عرض:';
    filterBar.appendChild(filterLabel);

    const allBtn = document.createElement('button');
    allBtn.textContent = 'كل المجموعات';
    allBtn.dataset.gid = 'all';
    allBtn.style.cssText = `padding:5px 16px; border-radius:8px; border:2px solid ${filterGroupId==='all'?'var(--primary)':'var(--border)'}; cursor:pointer; font-family:inherit; font-weight:700; font-size:.85rem; background:${filterGroupId==='all'?'var(--primary)':'#fff'}; color:${filterGroupId==='all'?'#fff':'var(--text-main)'};`;
    filterBar.appendChild(allBtn);

    groupIds.forEach(gid => {
        const g = (db.groups || []).find(x => String(x.id) === gid);
        const label = g ? g.name : `مجموعة ${gid}`;
        const active = String(filterGroupId) === String(gid);
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.dataset.gid = gid;
        btn.style.cssText = `padding:5px 16px; border-radius:8px; border:2px solid ${active?'var(--accent)':'var(--border)'}; cursor:pointer; font-family:inherit; font-weight:700; font-size:.85rem; background:${active?'var(--accent)':'#fff'}; color:${active?'#fff':'var(--text-main)'};`;
        filterBar.appendChild(btn);
    });

    // event delegation على الـ filterBar
    filterBar.addEventListener('click', e => {
        const btn = e.target.closest('[data-gid]');
        if (btn) renderDailyTreasuryArchives(btn.dataset.gid);
    });

    // ── فلترة وترتيب ────────────────────────────────────────
    const filtered = allArchives
        .filter(a => filterGroupId === 'all' || String(a.groupId) === String(filterGroupId))
        .sort((a, b) => new Date(b.date) - new Date(a.date) || Number(b.id) - Number(a.id));

    list.innerHTML = '';
    list.appendChild(filterBar);

    if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'text-align:center; padding:3rem; color:var(--text-muted);';
        empty.innerHTML = '<i class="fas fa-inbox" style="font-size:2rem;margin-bottom:1rem;display:block;"></i>لا يوجد أرشيف مالي حتى الآن';
        list.appendChild(empty);
        return;
    }

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill, minmax(300px,1fr)); gap:1.2rem;';

    filtered.forEach(a => {
        const archiveId = Number(a.id); // رقم صحيح دائماً
        const gObj      = (db.groups || []).find(g => String(g.id) === String(a.groupId));
        const gName     = gObj ? gObj.name : (a.groupId && a.groupId !== 'ungrouped' ? `مجموعة ${a.groupId}` : 'بدون مجموعة');
        const net       = (a.totalSub || 0) + (a.totalMisc || 0) - (a.totalExp || 0);
        const dateLabel = new Date(a.date).toLocaleDateString('ar-EG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

        const card = document.createElement('div');
        card.className = 'card fade-in';
        card.style.cssText = 'padding:1.4rem; border-right:5px solid var(--accent); cursor:pointer;';
        card.innerHTML = `
            <div style="font-weight:800; font-size:1rem; color:var(--primary); margin-bottom:4px;">${dateLabel}</div>
            <div style="font-size:0.82rem; color:var(--text-muted); margin-bottom:10px;">
                <i class="fas fa-users" style="color:var(--accent)"></i> ${gName}
                ${a.sessionName ? ` — ${a.sessionName}` : ''}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:0.85rem; color:var(--text-muted);">
                    اشتراكات: <b>${a.totalSub||0}</b> ج.م | أخرى: <b>${a.totalMisc||0}</b> ج.م
                    ${a.totalExp ? ` | مصروفات: <b style="color:var(--danger)">-${a.totalExp}</b> ج.م` : ''}
                </div>
                <div style="font-weight:900; font-size:1.15rem; color:var(--accent)">${net} ج.م</div>
            </div>`;
        // event listener مباشر بدل onclick inline
        card.addEventListener('click', () => viewDailyArchive(archiveId));
        grid.appendChild(card);
    });

    list.appendChild(grid);
}

function viewDailyArchive(archiveId) {
    const targetId = Number(archiveId);
    const archive = (db.dailyTreasuryArchives || []).find(a => {
        const aId = Number(a.id);
        // مطابقة مباشرة أولاً (للـ ids الجديدة الصحيحة)
        if (aId === targetId) return true;
        // fallback للـ ids القديمة العشرية (Math.round)
        return Math.round(aId) === Math.round(targetId);
    });
    if (!archive) {
        showNotification('لم يتم العثور على بيانات هذا الأرشيف', 'error');
        return;
    }

    const groupObj  = db.groups.find(g => String(g.id) === String(archive.groupId));
    const groupName = groupObj ? groupObj.name : 'المجموعة';
    const dateLabel = new Date(archive.date).toLocaleDateString('ar-EG', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const payments  = archive.payments  || [];
    const expenses  = archive.expenses  || [];
    const totalExp  = archive.totalExp  || expenses.reduce((s, e) => s + e.amount, 0);
    const totalSub  = archive.totalSub  || 0;
    const totalMisc = archive.totalMisc || 0;
    const netTotal  = totalSub + totalMisc - totalExp;

    // ── بناء HTML التفاصيل ──────────────────────────────────
    const paymentsRows = payments.map((p, i) => `
        <tr style="${i % 2 === 0 ? 'background:#fafafa;' : ''}">
            <td style="padding:10px 14px; font-weight:700; color:#1e293b;">${p.studentName}</td>
            <td style="padding:10px 14px; color:#64748b;">${p.category}${p.collectedBy ? `<br><span style="font-size:.72rem; color:#94a3b8;">بواسطة: ${p.collectedBy}</span>` : ''}</td>
            <td style="padding:10px 14px; text-align:center; font-weight:800; color:#10b981;">${p.amount} ج.م</td>
            <td style="padding:10px 14px; text-align:center; color:#94a3b8; font-size:0.82rem;">${p.time || '—'}</td>
        </tr>`).join('');

    const expensesRows = expenses.map(e => `
        <tr style="background:#fff5f5;">
            <td style="padding:10px 14px; font-weight:700; color:#ef4444;">↳ ${e.title}</td>
            <td style="padding:10px 14px; color:#94a3b8;">مصروف</td>
            <td style="padding:10px 14px; text-align:center; font-weight:800; color:#ef4444;">-${e.amount} ج.م</td>
            <td style="padding:10px 14px; text-align:center; color:#94a3b8;">—</td>
        </tr>`).join('');

    const modalHTML = `
    <div id="dt-archive-detail-modal"
         onclick="if(event.target===this)this.remove()"
         style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;
                display:flex;align-items:center;justify-content:center;padding:1rem;">
      <div id="dt-archive-printable"
           style="background:#fff;border-radius:20px;width:100%;max-width:680px;
                  max-height:90vh;overflow-y:auto;box-shadow:0 25px 60px rgba(0,0,0,.25);
                  font-family:'Cairo',sans-serif;direction:rtl;">

        <!-- Header للطباعة -->
        <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;
                    padding:1.6rem 2rem;border-radius:20px 20px 0 0;text-align:center;">
            <div style="font-size:1.6rem;font-weight:900;">💰 تقرير العهدة اليومية</div>
            <div style="font-size:1rem;opacity:.85;margin-top:4px;">${dateLabel}</div>
            <div style="font-size:.9rem;opacity:.75;margin-top:2px;">
                ${groupName}${archive.sessionName ? ' — ' + archive.sessionName : ''}
            </div>
        </div>

        <!-- كروت الإجماليات -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;padding:1.5rem 2rem 0;">
            <div style="background:#f0fdf4;border-radius:14px;padding:1rem;text-align:center;border-bottom:4px solid #10b981;">
                <div style="font-size:.8rem;color:#64748b;margin-bottom:4px;">اشتراكات</div>
                <div style="font-size:1.5rem;font-weight:900;color:#10b981;">${totalSub} <small style="font-size:.7rem;">ج.م</small></div>
            </div>
            <div style="background:#fffbeb;border-radius:14px;padding:1rem;text-align:center;border-bottom:4px solid #f59e0b;">
                <div style="font-size:.8rem;color:#64748b;margin-bottom:4px;">ملازم / أخرى</div>
                <div style="font-size:1.5rem;font-weight:900;color:#f59e0b;">${totalMisc} <small style="font-size:.7rem;">ج.م</small></div>
            </div>
            <div style="background:#fef2f2;border-radius:14px;padding:1rem;text-align:center;border-bottom:4px solid #ef4444;">
                <div style="font-size:.8rem;color:#64748b;margin-bottom:4px;">مصروفات</div>
                <div style="font-size:1.5rem;font-weight:900;color:#ef4444;">-${totalExp} <small style="font-size:.7rem;">ج.م</small></div>
            </div>
        </div>
        <div style="margin:1rem 2rem;background:linear-gradient(135deg,#4f46e5,#7c3aed);
                    border-radius:14px;padding:1rem 1.5rem;color:#fff;
                    display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:.9rem;opacity:.85;">صافي العهدة</span>
            <span style="font-size:1.8rem;font-weight:900;">${netTotal} ج.م</span>
        </div>

        <!-- جدول التفاصيل -->
        <div style="padding:0 2rem 1.5rem;">
            <div style="font-weight:800;color:#374151;margin-bottom:.8rem;font-size:.95rem;">
                <i class="fas fa-list-ul" style="color:#4f46e5;margin-left:6px;"></i>
                تفاصيل التحصيل (${payments.length} دفعة${expenses.length > 0 ? ' + ' + expenses.length + ' مصروف' : ''})
            </div>
            <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;font-size:.88rem;">
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="padding:10px 14px;text-align:right;color:#475569;font-weight:700;">اسم الطالب</th>
                            <th style="padding:10px 14px;text-align:right;color:#475569;font-weight:700;">البند</th>
                            <th style="padding:10px 14px;text-align:center;color:#475569;font-weight:700;">المبلغ</th>
                            <th style="padding:10px 14px;text-align:center;color:#475569;font-weight:700;">الوقت</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paymentsRows}
                        ${expensesRows}
                        ${payments.length === 0 && expenses.length === 0 ?
                            '<tr><td colspan="4" style="text-align:center;padding:2rem;color:#94a3b8;">لا توجد بيانات</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- أزرار -->
        <div style="padding:1rem 2rem 1.5rem;display:flex;gap:.8rem;border-top:1px solid #f1f5f9;" class="no-print">
            <button onclick="printDtArchiveDetail()"
                style="flex:2;padding:.8rem;background:linear-gradient(135deg,#4f46e5,#7c3aed);
                       color:#fff;border:none;border-radius:12px;font-size:.95rem;
                       font-weight:700;cursor:pointer;font-family:inherit;">
                <i class="fas fa-print"></i> طباعة هذا التقرير
            </button>
            <button onclick="document.getElementById('dt-archive-detail-modal').remove()"
                style="flex:1;padding:.8rem;background:#f1f5f9;border:none;border-radius:12px;
                       font-size:.95rem;font-weight:700;cursor:pointer;font-family:inherit;color:#374151;">
                إغلاق
            </button>
        </div>
      </div>
    </div>`;

    // أزل أي modal قديم وأضف الجديد
    document.getElementById('dt-archive-detail-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function printDtArchiveDetail() {
    const content = document.getElementById('dt-archive-printable');
    if (!content) return;
    const win = window.open('', '_blank', 'width=750,height=900');
    win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head>
        <meta charset="UTF-8">
        <title>تقرير العهدة اليومية</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family:'Cairo',sans-serif; direction:rtl; background:#fff; color:#1e293b; }
            table { width:100%; border-collapse:collapse; }
            th,td { border:1px solid #e5e7eb; }
            .no-print { display:none !important; }
            @page { margin:1.5cm; size:A4; }
        </style>
    </head><body>${content.outerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 600);
}

function removeAttendance(attId) {
    if (!confirm('هل تريد حذف سجل الحضور هذا؟')) return;
    db.attendance = db.attendance.filter(a => a.id !== attId);
    db.save();
    renderPortalAttendance();
    showNotification('تم حذف سجل الحضور', 'warning');
}

function renderQuickAttendance() {
    const today = new Date().toLocaleDateString('en-CA');
    const list = document.getElementById('quick-attendance-list');
    if (!list) return;

    // ── guard + strict double filter ─────────────────────────────
    if (!currentGrade || !currentGroupId) {
        list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--text-muted);">يرجى اختيار صف ومجموعة أولاً</td></tr>';
        return;
    }
    const groupStudents = db.students.filter(s =>
        String(s.grade)   === String(currentGrade) &&
        String(s.groupId) === String(currentGroupId)
    );
    const groupStudentIds = groupStudents.map(s => s.id);

    const presentToday = db.attendance.filter(a => {
        const aDate = new Date(a.date).toLocaleDateString('en-CA');
        return aDate === today && groupStudentIds.includes(a.studentId) && a.status === 'present';
    }).reverse();

    list.innerHTML = presentToday.map(att => {
        const s = db.students.find(x => x.id === att.studentId);
        if (!s) return '';
        return `
            <tr class="fade-in">
                <td><strong>${s.name}</strong></td>
                <td style="font-family:monospace;">${new Date(att.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</td>
                <td><span class="status-badge" style="background:#dcfce7; color:#166534">حاضر</span></td>
                <td style="text-align:center;">
                    <button class="btn" style="color:var(--danger); padding:5px;" onclick="removeAttendance(${att.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="4" style="text-align:center; padding:2rem;">لم يتم تسجيل حضور للمجموعة الحالية بعد</td></tr>';
}

function endSessionAndMarkAbsent() {
    if (!activePortalGroupId) {
        showNotification('لم يتم تحديد مجموعة نشطة', 'error');
        return;
    }

    const rawId = String(activePortalGroupId);
    let allowedGroupIds = [];
    let groupDisplayName = '';

    if (rawId.startsWith('joint:')) {
        allowedGroupIds = rawId.split(':')[1].split(',');
        groupDisplayName = 'اليوم الجماعي';
    } else {
        allowedGroupIds = [rawId];
        const groupObj = db.groups.find(g => String(g.id) === rawId);
        groupDisplayName = groupObj ? groupObj.name : 'هذه المجموعة';
    }

    if (!confirm(`هل تريد إنهاء الجلسة وتسجيل الغياب لطلاب (${groupDisplayName}) غير المسجلين؟`)) return;

    const today = new Date().toISOString().split('T')[0];

    // Students already marked present or absent TODAY
    const recordedIds = db.attendance
        .filter(a => a.date.startsWith(today))
        .map(a => a.studentId);

    // Students in the ALLOWED GROUPS of the CURRENT GRADE who aren't recorded yet
    const absentees = db.students.filter(s =>
        String(s.grade) === String(currentGrade) &&
        allowedGroupIds.includes(String(s.groupId)) &&
        !recordedIds.includes(s.id)
    );

    absentees.forEach(s => {
        db.attendance.push({
            id: Date.now() + Math.random(),
            studentId: s.id,
            groupId: s.groupId, // Record under their own group
            date: new Date().toISOString(),
            status: 'absent'
        });
        addToQueue(s.id, 'absence');
    });

    db.save();
    showNotification(`تم إنهاء الجلسة. سجل الغياب لعدد: ${absentees.length} طالب`, 'success');

    // Cleanup
    activePortalGroupId = null;
    exitPortalMode();
    showSection('absence');
}

// --- 7. WhatsApp Bot Engine ---
function saveTemplates() {
    waTemplates.welcome = document.getElementById('tpl-welcome').value;
    waTemplates.absence = document.getElementById('tpl-absence').value;
    waTemplates.payment = document.getElementById('tpl-payment').value;
    localStorage.setItem('edu_wa_templates', JSON.stringify(waTemplates));
    showNotification('تم حفظ القوالب بنجاح');
}

// --- Hall of Fame Logic ---
function renderHallOfFame() {
    const podiumArea = document.getElementById('podium-area');
    const hallList = document.getElementById('hall-list');
    if (!podiumArea || !hallList) return;

    // Calculate Performance for all students in current grade
    const performance = db.students.filter(s => String(s.grade) === String(currentGrade)).map(s => {
        const attCount = db.attendance.filter(a => a.studentId == s.id && a.status === 'present').length;
        const marks = db.scores.filter(sc => sc.studentId == s.id);
        const avgMark = marks.length > 0
            ? (marks.reduce((sum, m) => sum + (m.mark / (db.exams.find(e => e.id === m.examId)?.maxMarks || 100)), 0) / marks.length) * 100
            : 0;

        return {
            ...s,
            score: (s.points || 0) + (attCount * 10) + avgMark,
            avgMark: Math.round(avgMark),
            attCount
        };
    }).sort((a, b) => b.score - a.score);

    // Render Podium (Top 3)
    const top3 = performance.slice(0, 3);
    const podiumHtml = [
        // Rank 2 (Left)
        top3[1] ? `
            <div class="podium-item podium-rank-2 fade-in" style="animation-delay: 0.2s;">
                <div class="avatar" style="width:60px; height:60px; margin: 0 auto 10px;">${top3[1].name.charAt(0)}</div>
                <div style="font-weight:700;">${top3[1].name.split(' ')[0]}</div>
                <div style="font-size:0.8rem; color:var(--text-muted)">${Math.round(top3[1].score)} نقطة</div>
                <div class="podium-name">🥈 المركز الثاني</div>
            </div>` : '',
        // Rank 1 (Center)
        top3[0] ? `
            <div class="podium-item podium-rank-1 fade-in">
                <i class="fas fa-crown crown"></i>
                <div class="avatar" style="width:80px; height:80px; font-size:2rem; margin: 0 auto 10px; border: 4px solid #ffd700;">${top3[0].name.charAt(0)}</div>
                <div style="font-weight:800; font-size:1.1rem;">${top3[0].name.split(' ')[0]}</div>
                <div style="font-size:0.9rem; color:var(--primary-dark)">${Math.round(top3[0].score)} نقطة</div>
                <div class="podium-name">🥇 بطل الشهر</div>
            </div>` : '',
        // Rank 3 (Right)
        top3[2] ? `
            <div class="podium-item podium-rank-3 fade-in" style="animation-delay: 0.4s;">
                <div class="avatar" style="width:50px; height:50px; margin: 0 auto 10px;">${top3[2].name.charAt(0)}</div>
                <div style="font-weight:700;">${top3[2].name.split(' ')[0]}</div>
                <div style="font-size:0.8rem; color:var(--text-muted)">${Math.round(top3[2].score)} نقطة</div>
                <div class="podium-name">🥉 المركز الثالث</div>
            </div>` : ''
    ].join('');
    podiumArea.innerHTML = podiumHtml;

    // Render Table (Top 10)
    hallList.innerHTML = performance.slice(0, 10).map((s, idx) => `
        <tr class="fade-in" style="animation-delay: ${idx * 0.1}s">
            <td><span style="font-weight:800; color:var(--primary)">#${idx + 1}</span></td>
            <td><strong>${s.name}</strong></td>
            <td><span class="points-tag" style="margin-bottom:0">${s.points} 💎</span></td>
            <td>${s.avgMark}%</td>
            <td>
                <button class="btn" style="padding: 5px 10px; background:var(--vibrant-orange); color:white; font-size:0.7rem;" onclick="generateCertificate(${s.id})">
                    <i class="fas fa-certificate"></i> شهادة
                </button>
                <button class="btn" style="padding: 5px 10px; background:var(--bg-light); font-size:0.7rem;" onclick="viewDetailedProfile(${s.id})">
                    <i class="fas fa-user-circle"></i> بروفايل
                </button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center;">لا يوجد بيانات كافية للتصنيف</td></tr>';
}

// --- Certificate Management Section ---
function initCertificatesSection() {
    const select = document.getElementById('cert-select-student');
    if (!select) return;

    // STRICTLY filter by active grade AND current group context
    const groupStudents = db.students.filter(s =>
        String(s.grade) === String(currentGrade) &&
        String(s.groupId) === String(currentGroupId)
    );
    const sortedStudents = sortStudentsArabic(groupStudents);

    select.innerHTML = '<option value="">-- اختر اسم الطالب --</option>' +
        sortedStudents.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

function generateCertificateFromSelect() {
    const studentId = document.getElementById('cert-select-student').value;
    if (!studentId) {
        showNotification('يرجى اختيار طالب أولاً', 'error');
        return;
    }
    generateCertificate(parseInt(studentId));
}

function sendCongratulationWA() {
    const studentId = document.getElementById('cert-select-student').value;
    if (!studentId) {
        showNotification('يرجى اختيار طالب أولاً', 'error');
        return;
    }
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    // رسالة تهنئة بمناسبة التفوق الدراسي — بنفس الهوية اللغوية الموحّدة للمنصة
    const text = buildFormalParentMessage({
        noticeType: 'تهنئة بالتفوق الدراسي',
        bodyLines: [
            `يسعدنا أن نُبشّر سيادتكم بأن ابنكم/ابنتكم الطالب/ـة المتميز/ـة *${s.name}* قد حقق/حققت تفوقاً ملحوظاً ومستوى دراسياً رائعاً 🏆.`,
            `ومرفق لسيادتكم شهادة تقدير تعبيراً عن مجهوده/ـا المتميز، وتحفيزاً له/ـا على الاستمرار والتفوق 🎉.`
        ]
    });

    window.open(`https://wa.me/2${s.parentPhone}?text=${encodeURIComponent(text)}`, '_blank');
}
let currentSelectedExamId = null;
let currentMarksFilter = 'all';

function generateCertificate(studentId) {
    let s;
    if (studentId) {
        s = db.students.find(x => x.id == studentId);
    } else {
        const profileName = document.getElementById('prof-name')?.innerText?.trim();
        if (profileName) {
            s = db.students.find(x => x.name.trim() === profileName);
        }
    }

    if (!s) {
        showNotification('يرجى اختيار طالب أولاً لإصدار الشهادة', 'error');
        return;
    }

    // Academic Data
    const marks = db.scores.filter(sc => sc.studentId == s.id && sc.mark !== null && sc.mark !== undefined);
    let totalPerc = 0;
    marks.forEach(m => {
        const ex = db.exams.find(e => e.id == m.examId);
        const max = (ex && ex.maxMarks > 0) ? ex.maxMarks : 100;
        totalPerc += (m.mark / max);
    });

    const avgMark = marks.length > 0 ? Math.round((totalPerc / marks.length) * 100) : 0;
    const gradeObj = gradesList.find(g => String(g.id) === String(s.grade));
    const gradeName = gradeObj ? gradeObj.name : '---';

    // Fill Modal
    document.getElementById('cert-student-name').innerText = s.name;
    document.getElementById('cert-avg').innerText = `${avgMark}%`;
    document.getElementById('cert-points').innerText = s.points || 0;
    document.getElementById('cert-grade').innerText = gradeName;
    document.getElementById('cert-date').innerText = new Date().toLocaleDateString('ar-EG');

    // Add data attribute for later capture
    document.getElementById('certificate-modal').dataset.studentId = s.id;

    toggleModal('certificate-modal', true);
}

async function sendNewCertificate(recipient) {
    const studentId = document.getElementById('certificate-modal').dataset.studentId;
    if (!studentId) {
        // If not in modal, check from select
        const selId = document.getElementById('cert-select-student').value;
        if (!selId) return showNotification('يرجى اختيار طالب أولاً', 'error');
        // Generate first to fill data
        generateCertificate(selId);
    }

    const s = db.students.find(x => x.id == (studentId || document.getElementById('cert-select-student').value));
    if (!s) return;

    showNotification('جاري تجهيز الشهادة ونسخها... يرجى الانتظار ⏳', 'success');

    const area = document.getElementById('certificate-printable-area');
    try {
        const canvas = await html2canvas(area, { scale: 2, useCORS: true });
        canvas.toBlob(async (blob) => {
            try {
                const item = new ClipboardItem({ "image/png": blob });
                await navigator.clipboard.write([item]);

                const phone = recipient === 'parent' ? s.parentPhone : s.phone;
                const msg = buildFormalParentMessage({
                    noticeType: 'شهادة تقدير',
                    bodyLines: [
                        `يسرنا مشاركتكم هذا الإنجاز؛ حيث حصل ابنكم/ابنتكم الطالب/ـة *${s.name}* على شهادة تقدير تقديراً لتفوقه/ـا الأكاديمي 🏆.`,
                        `_(مرفق صورة الشهادة — يمكنكم لصقها في المحادثة مباشرةً بالضغط على Ctrl+V)_`
                    ]
                });

                showNotification('✅ تم نسخ الشهادة للحافظة! يمكنك الآن الضغط على Ctrl+V في واتساب', 'success');

                setTimeout(() => {
                    window.open(`https://wa.me/2${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                }, 1000);
            } catch (err) {
                console.error(err);
                showNotification('عذراً، متصفحك لا يدعم نسخ الصور المباشر. يمكنك طباعة الشهادة يدوياً.', 'error');
            }
        });
    } catch (e) {
        console.error(e);
        showNotification('خطأ في معالجة الشهادة', 'error');
    }
}

function printCertificate() {
    const inner = document.getElementById('certificate-printable-area').innerHTML;
    const printWindow = window.open('', '_blank', 'width=1000,height=800');

    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <title>طباعة الشهادة</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Tajawal', sans-serif; margin: 0; padding: 0; background: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
                #printable-area { width: 100%; height: 100%; }
                @media print {
                    @page { size: landscape; margin: 0; }
                    body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
                }
            </style>
        </head>
        <body>
            <div id="printable-area">${inner}</div>
            <script>
                window.onload = () => {
                    setTimeout(() => {
                        window.print();
                        window.close();
                    }, 500);
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}


function addToQueue(studentId, type, customText = null) {
    const s = db.students.find(x => x.id === studentId);
    if (!s) return;

    let text = customText || waTemplates[type] || "تنبيه من نظام إدارة الدروس - [[name]]";
    text = text.replace(/\[\[name\]\]/g, s.name).replace(/\[\[points\]\]/g, s.points || 0);
    text += getTeacherSignatureLine();

    db.waQueue.push({
        id: Date.now(),
        studentId,
        phone: s.parentPhone,
        text,
        type
    });
    // ⚡ إصلاح أداء: حفظ جدول رسائل الواتساب فقط بدل كل الجداول
    db.save('waQueue');
    if (document.getElementById('whatsapp-section').style.display === 'block') renderWAQueue();
}

function renderWABot() {
    document.getElementById('tpl-welcome').value = waTemplates.welcome;
    document.getElementById('tpl-absence').value = waTemplates.absence;
    document.getElementById('tpl-payment').value = waTemplates.payment;
    renderWAQueue();
}

function renderWAQueue() {
    const list = document.getElementById('wa-queue-list');
    const badge = document.getElementById('pending-messages');
    if (badge) badge.innerText = db.waQueue.length;
    if (!list) return;

    list.innerHTML = db.waQueue.map(item => {
        const s = db.students.find(x => x.id === item.studentId);
        const typeLabels = {
            'absence': { label: 'غـياب ❌', color: 'var(--danger)' },
            'welcome': { label: 'تـرحيب ✅', color: 'var(--accent)' },
            'payment': { label: 'دفـع 💰', color: 'var(--vibrant-orange)' }
        };
        const typeInfo = typeLabels[item.type] || { label: 'عـام', color: 'var(--primary)' };

        return `
            <div class="card" style="margin-bottom: 0.5rem; padding: 1rem; border-right: 5px solid ${typeInfo.color}; background: #f8fafc;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="text-align:right">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                            <strong>إلى: ${s ? s.name : 'طالب'}</strong>
                            <span class="status-badge" style="background:${typeInfo.color}15; color:${typeInfo.color}; border:1px solid ${typeInfo.color}30; padding:2px 8px;">${typeInfo.label}</span>
                        </div>
                        <small style="color:var(--text-muted)">(${item.phone}) - ${item.text.substring(0, 60)}...</small>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-primary" style="padding:6px 12px; background:var(--accent);" onclick="sendFromQueue(${item.id})">
                            <i class="fab fa-whatsapp"></i> إرسال
                        </button>
                        <button class="btn" style="padding:6px 12px; background:white; border:1px solid #ddd;" onclick="removeFromQueue(${item.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).reverse().join('') || `
        <div style="text-align:center; padding:3rem; opacity:0.5;">
            <i class="fas fa-check-double" style="font-size:3rem; margin-bottom:1rem;"></i>
            <p>لا توجد رسائل معلقة</p>
        </div>
    `;
}

function handleBarcodeGrading(val) {
    if (!val) return;
    const clean = val.trim();
    const student = db.students.find(s => s.qrCode === clean || clean.includes(s.qrCode));
    if (student && clean.length >= 4) {
        processFastScan(clean);
        const input = document.getElementById('barcode-grading-entry');
        if (input) {
            input.value = '';
            setTimeout(() => {
                if (input) {
                    input.value = '';
                    input.focus();
                }
            }, 10);
        }
    }
}

function handleBarcodeAttendance(val) {
    if (!val) return;
    const clean = val.trim();
    const student = db.students.find(s => s.qrCode === clean || clean.includes(s.qrCode));
    if (student && clean.length >= 4) {
        processScan(clean);
        const input = document.getElementById('barcode-attendance-entry');
        if (input) {
            input.value = '';
            setTimeout(() => {
                if (input) {
                    input.value = '';
                    input.focus();
                }
            }, 10);
        }
    }
}

function sendFromQueue(id) {
    const item = db.waQueue.find(x => x.id === id);
    if (!item) return;
    window.open(`https://wa.me/2${item.phone}?text=${encodeURIComponent(item.text)}`, '_blank');
    removeFromQueue(id);
}

function removeFromQueue(id) {
    db.waQueue = db.waQueue.filter(x => x.id !== id);
    db.save();
    renderWAQueue();
}

function clearQueue() {
    if (!confirm('هل تريد مسح كافة الرسائل المعلقة؟')) return;
    db.waQueue = [];
    db.save();
    renderWAQueue();
}

function addToQueueBatch() {
    const grade = document.getElementById('batch-grade').value;
    const text = document.getElementById('batch-text').value;
    if (!text) return;

    const targets = grade === 'all' ? db.students : db.students.filter(s => s.grade === grade);
    targets.forEach(s => addToQueue(s.id, 'batch', text));
    showNotification(`تمت إضافة ${targets.length} رسالة إلى الطابور`);
    document.getElementById('batch-text').value = '';
    renderWAQueue();
}

// --- 8. Analytics (Chart.js) ---
function exitPortalMode() {
    document.getElementById('portal-overlay').style.display = 'none';
    activePortalGroupId = null; // Clear joint-day/portal context on exit
    activePortalGroupIds = [];
    if (portalScanner) {
        try {
            portalScanner.stop();
        } catch (e) { }
    }
}



// --- 7. Fast Grading AI Engine ---
// fastGradingScanner already declared in global state section above
let currentFastStudent = null;
let currentGradingMode = 'barcode'; // 'barcode' | 'manual' - آخر وضع رصد استخدمه المستخدم

function initFastGrading() {
    const examSelect = document.getElementById('fast-exam-select');
    const groupSelect = document.getElementById('fast-group-select');
    if (!examSelect || !groupSelect) return;

    // Filter Exams by current grade
    const exams = db.exams.filter(e => String(e.grade) === String(currentGrade));
    examSelect.innerHTML = '<option value="">-- اختر الامتحان --</option>' +
        exams.map(e => `<option value="${e.id}">${e.title} (درجة: ${e.maxMarks})</option>`).join('');

    // Filter Groups by current grade
    const groups = db.groups.filter(g => String(g.grade) === String(currentGrade));
    rebuildSelectPreservingSelection(
        groupSelect,
        () => '<option value="">-- اختر المجموعة --</option>' +
            '<option value="all">كل مجموعات المرحلة (يوم جماعي)</option>' +
            groups.map(g => `<option value="${g.id}">${g.name}</option>`).join(''),
        currentGroupId
    );

    // AUTO SELECT LAST EXAM if none selected
    if (!examSelect.value && exams.length > 0) {
        examSelect.value = exams[0].id; // Usually first is latest in some contexts, but let's check reverse
        // Alternatively, if they are sorted by date (id is Date.now), the last one is exams[exams.length-1]
        examSelect.value = exams[exams.length - 1].id;
        updateFastExamMax();
    }

    // Add event listeners for auto-refresh
    examSelect.onchange = () => {
        updateFastExamMax();
        renderFastHistory();
        renderFastPendingList();
    };
    groupSelect.onchange = () => {
        renderFastPendingList();
    };

    renderFastHistory();
    renderFastPendingList();

    // ✅ جهّز إعدادات وضع "الرصد اليدوي" كمان بحيث تكون جاهزة فورًا لما المستخدم يختارها
    initManualGradingSetup();

    // اعرض نفس وضع الرصد اللي كان مختار قبل كده (باركود / يدوي)
    applyGradingModeUI(currentGradingMode);

    if (currentGradingMode === 'barcode') {
        if (!fastGradingScanner) fastGradingScanner = new Html5Qrcode("fast-reader");
        fastGradingScanner.start({ facingMode: "environment" }, { fps: 20, qrbox: 250 }, processFastScan).catch(err => {
            console.error("Scanner failed", err);
            showNotification("تعذر تشغيل الكاميرا - يرجى التأكد من الصلاحيات", "error");
        });

        // ✅ خطوة 1: المؤشر داخل حقل الباركود تلقائيًا عند فتح الصفحة - بدون أي تدخل بالماوس
        focusBarcodeGradingInput();
    }
}

/**
 * يبدّل عرض البانل (باركود / يدوي) وشكل الأزرار بس - بدون تشغيل/إيقاف الكاميرا.
 * مستخدمة داخليًا من initFastGrading (أول فتح للصفحة) ومن switchGradingMode (تبديل يدوي من المستخدم).
 */
function applyGradingModeUI(mode) {
    const barcodePanel = document.getElementById('grading-mode-barcode-panel');
    const manualPanel = document.getElementById('grading-mode-manual-panel');
    const btnBarcode = document.getElementById('grading-mode-btn-barcode');
    const btnManual = document.getElementById('grading-mode-btn-manual');

    const isManual = mode === 'manual';
    if (barcodePanel) barcodePanel.style.display = isManual ? 'none' : 'block';
    if (manualPanel) manualPanel.style.display = isManual ? 'block' : 'none';

    if (btnBarcode) {
        btnBarcode.style.background = isManual ? 'var(--bg-light)' : '';
        btnBarcode.style.color = isManual ? 'var(--text-main)' : '';
    }
    if (btnManual) {
        btnManual.style.background = isManual ? '' : 'var(--bg-light)';
        btnManual.style.color = isManual ? '' : 'var(--text-main)';
    }
}

/** يُستدعى من زرّي "الرصد السريع بالباركود" / "الرصد اليدوي" أعلى الصفحة */
function switchGradingMode(mode) {
    if (mode === currentGradingMode) return;
    currentGradingMode = mode;
    applyGradingModeUI(mode);

    if (mode === 'manual') {
        // إيقاف الكاميرا عشان توفر الموارد ومايحصلش تعارض بين الوضعين
        if (fastGradingScanner) {
            try { fastGradingScanner.stop().catch(() => { }); } catch (e) { }
        }
        initManualGradingSetup();
    } else {
        if (!fastGradingScanner) fastGradingScanner = new Html5Qrcode("fast-reader");
        fastGradingScanner.start({ facingMode: "environment" }, { fps: 20, qrbox: 250 }, processFastScan).catch(err => {
            console.error("Scanner failed", err);
        });
        focusBarcodeGradingInput();
    }
}

/** يعيد التركيز لحقل ماسح الباركود بعد أي عملية حفظ، عشان الموظف يكمل شغله باللوحة والماسح فقط */
function focusBarcodeGradingInput() {
    setTimeout(() => {
        const barcodeInput = document.getElementById('barcode-grading-entry');
        if (barcodeInput) barcodeInput.focus();
    }, 150);
}

function markRemainingAsExamAbsent() {
    const examId = document.getElementById('fast-exam-select').value;
    const groupId = document.getElementById('fast-group-select').value;

    if (!examId || !groupId) {
        showNotification('يرجى اختيار الامتحان والمجموعة أولاً', 'warning');
        return;
    }

    const examObj = db.exams.find(e => e.id == examId);
    const groupObj = db.groups.find(g => g.id == groupId);

    if (!confirm(`هل تريد تسجيل "غائب" لجميع طلاب مجموعة (${groupObj.name}) الذين لم يتم رصد درجاتهم في امتحان (${examObj.title})؟`)) return;

    // Students in this group and grade
    const groupStudents = db.students.filter(s => String(s.grade) === String(currentGrade) && String(s.groupId) === String(groupId));

    // Students who already have a record for this exam
    const recordedStudentIds = db.scores.filter(sc => sc.examId == examId).map(sc => sc.studentId);

    let count = 0;
    groupStudents.forEach(s => {
        if (!recordedStudentIds.includes(s.id)) {
            db.scores.push({
                id: Date.now() + Math.random(),
                studentId: s.id,
                examId: parseInt(examId),
                mark: -1,
                date: new Date().toISOString()
            });
            count++;
        }
    });

    db.save();
    showNotification(`تم تسجيل غياب ${count} طالب بنجاح`, 'success');
    renderFastHistory();
    renderFastPendingList();
}

function processFastScan(token) {
    if (typeof token === 'object' && token.decodedText) token = token.decodedText;
    const cleanToken = token.trim();

    // 1. Find the student
    let student = db.students.find(s => s.qrCode === cleanToken);
    if (!student) {
        student = db.students.find(s => cleanToken.includes(s.qrCode) || s.qrCode.includes(cleanToken));
    }

    if (!student) {
        showNotification('طالب غير مسجل', 'warning');
        return;
    }

    // 2. Prevent Re-scan flicker
    if (currentFastStudent && currentFastStudent.id === student.id) return;

    // 3. ✅ متطلب 4: لو فيه درجة مكتوبة للطالب الحالي ولسه ما اتحفظتش، احفظها الأول تلقائيًا
    //    قبل الانتقال للطالب الجديد. لو الدرجة المكتوبة غير صحيحة، امنع الانتقال (متطلب 7)
    //    لحد ما المستخدم يصلّحها، بدل ما نضيّع الدرجة أو نتجاهل الخطأ.
    if (!tryAutoSavePendingFastMark()) return;

    // 4. Grade Check
    if (String(student.grade) !== String(currentGrade)) {
        const studentGradeObj = gradesList.find(g => g.id == student.grade);
        playSound('error');
        showNotification(`🛑 خطأ: الطالب ${student.name} مقيد في (${studentGradeObj ? studentGradeObj.name : student.grade}).`, 'error');
        return;
    }

    // 5. Group Warning (Relaxed to warning like attendance)
    const rawSessionId = activePortalGroupId || currentGroupId;
    let isGroupMatched = false;
    if (String(rawSessionId).startsWith('joint:')) {
        const allowedGroupIds = rawSessionId.split(':')[1].split(',');
        isGroupMatched = allowedGroupIds.includes(String(student.groupId));
    } else {
        isGroupMatched = String(student.groupId) === String(rawSessionId);
    }

    if (!isGroupMatched) {
        const studentGroupObj = db.groups.find(g => g.id == student.groupId);
        showNotification(`⚠️ تنبيه: الطالب ${student.name} مقيد في مجموعة (${studentGroupObj ? studentGroupObj.name : 'أخرى'})`, 'warning');
    }

    currentFastStudent = student;
    const examId = document.getElementById('fast-exam-select').value;
    const exam = db.exams.find(e => e.id == examId);

    const infoSide = document.getElementById('fast-student-info');
    infoSide.innerHTML = `
        <div class="fade-in" style="text-align:center; padding: 2rem;">
            <div class="avatar" style="width:100px; height:100px; font-size:2.5rem; margin: 0 auto 1.5rem; background:var(--primary); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center;">${student.name.charAt(0)}</div>
            <h2 style="margin-bottom:0.5rem;">${student.name}</h2>
            <p style="color:var(--primary); font-weight:700; font-size:1.1rem; margin-bottom:1rem;">رصد امتحان: ${exam ? exam.title : '---'}</p>
            
            <div class="form-group">
                <label style="font-weight:800; font-size:1.2rem; color:var(--primary);">أدخل الدرجة (من ${exam ? exam.maxMarks : '??'}):</label>
                <input type="number" id="fast-mark-input" autofocus class="form-input" 
                       style="font-size: 2.5rem; height: 80px; text-align: center; border: 3px solid var(--primary); border-radius: 20px;"
                       onkeyup="if(event.key === 'Enter') submitFastGrade()">
            </div>
            
            <button class="btn btn-primary" style="width:100%; height:60px; font-size:1.2rem; border-radius:15px; margin-top:1rem;" onclick="submitFastGrade()">
                رصد الدرجة الآن (اختياري - Enter كفاية) <i class="fas fa-check-double"></i>
            </button>
            <p style="margin-top:1rem; font-size:0.8rem; color:var(--text-muted);">أو امسح باركود الطالب التالي مباشرة للحفظ التلقائي والانتقال</p>
        </div>
    `;

    setTimeout(() => {
        const input = document.getElementById('fast-mark-input');
        if (input) input.focus();
    }, 150);

    playSound('success');
    showNotification(`تم التعرف على: ${student.name}`, 'success', 1000);
}

/**
 * ✅ متطلب 4 و 7: يحفظ درجة الطالب الحالي تلقائيًا لو فيه قيمة مكتوبة في حقل الدرجة
 * قبل الانتقال لطالب جديد (سواء عن طريق مسح باركود أو زر "رصد الدرجة الآن").
 * @returns {boolean} true = مفيش مشكلة، تقدر تكمل/تنتقل. false = فيه درجة غير صحيحة، امنع الانتقال.
 */
function tryAutoSavePendingFastMark() {
    const inputEl = document.getElementById('fast-mark-input');
    if (!currentFastStudent || !inputEl) return true; // مفيش طالب محمّل حاليًا، تقدر تكمل عادي

    const rawVal = inputEl.value.trim();
    if (!rawVal) return true; // مفيش درجة مكتوبة أصلاً، مفيش حاجة نحفظها

    const examId = document.getElementById('fast-exam-select').value;
    if (!examId) {
        showNotification('برجاء اختيار الامتحان أولاً', 'error');
        return false;
    }

    const mark = parseFloat(rawVal);
    if (isNaN(mark)) {
        // ✅ متطلب 7: خطأ واضح + عدم الانتقال حتى يتم حل المشكلة
        showNotification(`⚠️ الدرجة المكتوبة لـ ${currentFastStudent.name} غير صحيحة - صحّحها أو امسحها قبل المتابعة`, 'error');
        inputEl.focus();
        inputEl.select();
        return false;
    }

    processAndSaveGrade(currentFastStudent, examId, mark);
    return true;
}

function updateFastExamMax() {
    const examId = document.getElementById('fast-exam-select').value;
    const exam = db.exams.find(e => e.id == examId);
    if (exam) {
        document.getElementById('fast-max-marks').value = exam.maxMarks;
    }
    renderFastHistory();
    renderFastPendingList(); // Ensure list updates when exam changes
}

function submitFastGrade() {
    const examId = document.getElementById('fast-exam-select').value;
    const inputEl = document.getElementById('fast-mark-input');
    const rawVal = inputEl ? inputEl.value.trim() : '';

    if (!examId) return showNotification('برجاء اختيار الامتحان أولاً', 'error');

    // --- MANUAL ENTRY SUPPORT ---
    // If the input value looks like a student ID and it's a manual Enter (not a scan burst handled by global listener)
    const cleanVal = rawVal.trim();
    const possibleStudent = db.students.find(s => s.qrCode === cleanVal);

    if (possibleStudent && cleanVal.length >= 4) {
        document.getElementById('fast-mark-input').value = '';
        processFastScan(cleanVal);
        return;
    }

    if (!currentFastStudent) return showNotification('برجاء مسح كود الطالب أولاً أو اختيار اسم يدوي', 'warning');
    if (!rawVal) return showNotification('يرجى إدخال درجة الطالب', 'error');

    const mark = parseFloat(rawVal);
    // ✅ متطلب 7: خطأ واضح وعدم الانتقال للطالب التالي حتى يتم تصحيح الدرجة
    if (isNaN(mark)) {
        showNotification('يرجى إدخال درجة صحيحة', 'error');
        inputEl.focus();
        inputEl.select();
        return;
    }

    processAndSaveGrade(currentFastStudent, examId, mark);

    // After manual Enter, clear and wait for next scan
    currentFastStudent = null;
    if (inputEl) inputEl.value = "";

    document.getElementById('fast-student-info').innerHTML = `
        <div style="text-align: center; color: var(--accent); padding-top: 5rem;">
            <i class="fas fa-qrcode" style="font-size: 4rem; display: block; margin-bottom: 1rem; opacity: 0.3;"></i>
            <p>تم الحفظ.. جاهز لمسح باركود الطالب التالي فورًا...</p>
        </div>
    `;
    updateDashboardStats();

    // ✅ متطلب 8: رجّع المؤشر لحقل الباركود عشان الموظف يكمل بدون ما يلمس الماوس
    focusBarcodeGradingInput();
}

function processAndSaveGrade(studentObj, examId, mark, maxMarksOverride) {
    const exam = db.exams.find(e => e.id == examId);
    let currentMax = maxMarksOverride;
    if (currentMax == null) {
        const maxMarksInput = document.getElementById('fast-max-marks');
        currentMax = maxMarksInput ? parseFloat(maxMarksInput.value) : (exam ? exam.maxMarks : 100);
    }
    if (exam && exam.maxMarks !== currentMax) {
        exam.maxMarks = currentMax;
    }

    // Update existing score if it exists, otherwise push new one
    const existingIdx = db.scores.findIndex(sc => sc.examId == examId && sc.studentId == studentObj.id);
    if (existingIdx > -1) {
        db.scores[existingIdx].mark = mark;
        db.scores[existingIdx].date = new Date().toISOString();
    } else {
        db.scores.push({
            id: Date.now() + Math.random(),
            examId: parseInt(examId),
            studentId: studentObj.id,
            mark: mark,
            date: new Date().toISOString()
        });
    }

    studentObj.points = (studentObj.points || 0) + 5;
    db.save();
    db.save('students'); // FIXED: Ensure student points update is persisted

    // ✅ متطلب 6: إشعار نجاح قصير (ثانية واحدة) عشان مايوقفش سير العمل
    showNotification(`تم رصد ${mark} لـ ${studentObj.name} ✅`, 'success', 1000);
    renderFastHistory();
    renderFastPendingList();
}


// ============================================================
//  8. الرصد اليدوي بلوحة المفاتيح (Manual Keyboard Grading)
//  وضع بديل للرصد بالباركود: يختار الموظف مجموعة + امتحان + درجة نهائية،
//  فتظهر قائمة الطلاب مرتبة أبجديًا (نفس ترتيب الطباعة والكشوف)، ويرصد
//  كل درجة بالضغط على Enter فقط بدون أي استخدام للماوس.
// ============================================================
let manualGradingStudents = []; // الطلاب المعروضين في جلسة الرصد اليدوي الحالية (مرتبين أبجديًا)

/** يجهّز قوائم المجموعة/الامتحان الخاصة بوضع الرصد اليدوي */
function initManualGradingSetup() {
    const groupSelect = document.getElementById('manual-grade-group-select');
    const examSelect = document.getElementById('manual-grade-exam-select');
    if (!groupSelect || !examSelect) return;

    const groups = db.groups.filter(g => String(g.grade) === String(currentGrade));
    rebuildSelectPreservingSelection(
        groupSelect,
        () => '<option value="">-- اختر المجموعة --</option>' +
            groups.map(g => `<option value="${g.id}">${g.name}</option>`).join(''),
        currentGroupId
    );

    const exams = db.exams.filter(e => String(e.grade) === String(currentGrade));
    rebuildSelectPreservingSelection(
        examSelect,
        () => '<option value="">-- اختر الامتحان --</option>' +
            exams.map(e => `<option value="${e.id}">${e.title} (درجة: ${e.maxMarks})</option>`).join('')
    );

    // لو فيه امتحان مختار بالفعل في وضع الباركود، خليه نفس الاختيار الافتراضي هنا
    const fastExamVal = document.getElementById('fast-exam-select')?.value;
    if (fastExamVal && !examSelect.value) examSelect.value = fastExamVal;

    // مزامنة الدرجة النهائية تلقائيًا مع الامتحان المختار
    examSelect.onchange = () => {
        const exam = db.exams.find(e => e.id == examSelect.value);
        const maxInput = document.getElementById('manual-grade-max-marks');
        if (exam && maxInput) maxInput.value = exam.maxMarks;
    };
    if (examSelect.value) examSelect.onchange();
}

/** رجوع لشاشة الإعداد (تغيير مجموعة/امتحان) بدون فقد أي درجات محفوظة بالفعل */
function exitManualGrading() {
    const listWrap = document.getElementById('manual-grading-list-wrap');
    const setup = document.getElementById('manual-grading-setup');
    if (listWrap) listWrap.style.display = 'none';
    if (setup) setup.style.display = 'block';
}

/** ✅ متطلب 1+2+3: بعد اختيار المجموعة/الامتحان/الدرجة النهائية، اعرض كل الطلاب مرتبين أبجديًا */
function startManualGrading() {
    const groupId = document.getElementById('manual-grade-group-select').value;
    const examId = document.getElementById('manual-grade-exam-select').value;
    const maxMarks = parseFloat(document.getElementById('manual-grade-max-marks').value);

    if (!groupId) return showNotification('برجاء اختيار المجموعة أولاً', 'error');
    if (!examId) return showNotification('برجاء اختيار الامتحان أولاً', 'error');
    if (!maxMarks || maxMarks <= 0) return showNotification('برجاء إدخال الدرجة النهائية بشكل صحيح', 'error');

    const exam = db.exams.find(e => e.id == examId);
    if (exam) exam.maxMarks = maxMarks; // مزامنة الدرجة النهائية فور بدء الجلسة

    const groupObj = db.groups.find(g => String(g.id) === String(groupId));
    const groupStudents = db.students.filter(s =>
        String(s.groupId) === String(groupId) && String(s.grade) === String(currentGrade)
    );

    if (groupStudents.length === 0) {
        showNotification('لا يوجد طلاب في هذه المجموعة', 'warning');
        return;
    }

    // ✅ متطلب 3: نفس دالة الترتيب الأبجدي المستخدمة في كل شاشات النظام والطباعة
    manualGradingStudents = sortStudentsArabic([...groupStudents]);

    // اجلب أي درجات محفوظة مسبقًا لنفس الامتحان عشان نعرضها جاهزة (تعديل بدل ما تتفقد)
    const scoreMap = {};
    db.scores.filter(sc => sc.examId == examId).forEach(sc => { scoreMap[sc.studentId] = sc.mark; });

    const listBody = document.getElementById('manual-grading-list-body');
    listBody.innerHTML = manualGradingStudents.map((s, idx) => {
        const existing = scoreMap[s.id];
        const isAbsent = existing === -1;
        const displayVal = (existing != null && !isAbsent) ? existing : '';
        return `
        <tr data-manual-student-id="${s.id}" style="${isAbsent ? 'background:rgba(239,68,68,0.08);' : (existing != null ? 'background:rgba(16,185,129,0.06);' : '')}">
            <td>${idx + 1}</td>
            <td style="text-align:right; font-weight:700;">
                ${s.name}
                <span class="manual-absent-tag" style="display:${isAbsent ? 'inline' : 'none'}; color:var(--danger); font-weight:700; margin-right:8px;">(غائب)</span>
            </td>
            <td>
                <input type="number" class="form-input manual-mark-input" data-index="${idx}" data-student-id="${s.id}"
                    data-empty-confirms="0" value="${displayVal}"
                    style="text-align:center; font-weight:700;"
                    onkeydown="handleManualMarkKeydown(event, ${idx})">
            </td>
            <td class="manual-status-cell">${
                isAbsent
                    ? '<span style="color:var(--danger); font-weight:700;"><i class="fas fa-user-times"></i> غائب</span>'
                    : (existing != null
                        ? '<span style="color:var(--accent); font-weight:700;"><i class="fas fa-check-circle"></i> تم</span>'
                        : '<span style="color:var(--text-muted);">--</span>')
            }</td>
        </tr>`;
    }).join('');

    document.getElementById('manual-grading-title').innerText =
        `رصد: ${exam ? exam.title : ''} — ${groupObj ? groupObj.name : ''} (${manualGradingStudents.length} طالب)`;

    document.getElementById('manual-grading-setup').style.display = 'none';
    document.getElementById('manual-grading-list-wrap').style.display = 'block';

    // خلي وضع الباركود (والتاريخ/المتبقين تحت) متزامن مع نفس الامتحان/المجموعة المختارة
    const fastExamSelect = document.getElementById('fast-exam-select');
    const fastGroupSelect = document.getElementById('fast-group-select');
    if (fastExamSelect) { fastExamSelect.value = examId; }
    if (fastGroupSelect) { fastGroupSelect.value = groupId; }
    renderFastHistory();
    renderFastPendingList();

    // ✅ متطلب 2+10: المؤشر يروح تلقائيًا لأول طالب في القائمة - بدون أي لمس للماوس
    setTimeout(() => {
        const firstInput = document.querySelector('.manual-mark-input[data-index="0"]');
        if (firstInput) { firstInput.focus(); firstInput.select(); }
    }, 100);

    showNotification(`▶️ بدأت جلسة الرصد اليدوي لـ ${manualGradingStudents.length} طالب`, 'success', 1500);
}

/**
 * ✅ متطلب 5+6+7: التعامل مع الضغط على Enter داخل حقل درجة أي طالب:
 *  - درجة صحيحة  → تُحفظ فورًا وينتقل المؤشر للطالب التالي.
 *  - فاضي (Enter أول مرة) → تخطي مؤقت للطالب التالي بدون تسجيل غياب بعد.
 *  - فاضي (Enter تاني بدون كتابة حاجة) → تأكيد متعمد: يتسجل "غائب" وينتقل للتالي.
 *  - قيمة غير صحيحة (مش رقم / خارج النطاق) → خطأ واضح وعدم الانتقال حتى يتم التصحيح.
 */
function handleManualMarkKeydown(e, index) {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const input = e.target;
    const rawVal = input.value.trim();
    const studentId = input.dataset.studentId;
    const student = manualGradingStudents.find(s => String(s.id) === String(studentId));
    if (!student) return;

    const examId = document.getElementById('manual-grade-exam-select').value;
    const maxMarks = parseFloat(document.getElementById('manual-grade-max-marks').value) || 100;

    // --- حالة الحقل الفارغ (غياب محتمل) ---
    if (rawVal === '') {
        const confirms = parseInt(input.dataset.emptyConfirms || '0', 10);
        if (confirms === 0) {
            // أول Enter وهو فاضي: مجرد تخطي مؤقت، لسه معتبرينه لم يُرصد
            input.dataset.emptyConfirms = '1';
            moveToNextManualInput(index);
            return;
        }
        // ✅ متطلب 7: Enter تاني بدون كتابة درجة = تأكيد متعمد أنه غائب
        saveManualAbsence(student, examId, index);
        moveToNextManualInput(index);
        return;
    }

    // --- حالة كتابة درجة ---
    const mark = parseFloat(rawVal);
    if (isNaN(mark)) {
        // ✅ متطلب 7: خطأ واضح وعدم الانتقال حتى يتم حل المشكلة
        showNotification('يرجى إدخال درجة صحيحة، أو اترك الحقل فارغًا لو الطالب غائب', 'error');
        input.focus();
        input.select();
        return;
    }
    if (mark < 0 || mark > maxMarks) {
        showNotification(`الدرجة يجب أن تكون بين 0 و ${maxMarks}`, 'error');
        input.focus();
        input.select();
        return;
    }

    input.dataset.emptyConfirms = '0';
    processAndSaveGrade(student, examId, mark, maxMarks); // بيعمل toast قصير (1 ثانية) بنفسه
    updateManualRowVisual(student.id, mark);
    moveToNextManualInput(index);
}

/** يسجّل الطالب غائبًا (بدون منح نقاط) - نفس منطق التسجيل المستخدم في باقي الشاشات */
function saveManualAbsence(student, examId, index) {
    const existingIdx = db.scores.findIndex(sc => sc.examId == examId && sc.studentId == student.id);
    if (existingIdx > -1) {
        db.scores[existingIdx].mark = -1;
        db.scores[existingIdx].date = new Date().toISOString();
    } else {
        db.scores.push({
            id: Date.now() + Math.random(),
            examId: parseInt(examId),
            studentId: student.id,
            mark: -1,
            date: new Date().toISOString()
        });
    }
    db.save();
    updateManualRowVisual(student.id, -1);
    showNotification(`تم تسجيل ${student.name} غائبًا`, 'warning', 1000);
    renderFastHistory();
    renderFastPendingList();
}

/** ✅ متطلب 8: تمييز بصري واضح للطالب الغائب أو المرصود بالفعل */
function updateManualRowVisual(studentId, mark) {
    const row = document.querySelector(`#manual-grading-list-body tr[data-manual-student-id="${studentId}"]`);
    if (!row) return;
    const absentTag = row.querySelector('.manual-absent-tag');
    const statusCell = row.querySelector('.manual-status-cell');
    const isAbsent = mark === -1;

    row.style.background = isAbsent ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.06)';
    if (absentTag) absentTag.style.display = isAbsent ? 'inline' : 'none';
    if (statusCell) {
        statusCell.innerHTML = isAbsent
            ? '<span style="color:var(--danger); font-weight:700;"><i class="fas fa-user-times"></i> غائب</span>'
            : '<span style="color:var(--accent); font-weight:700;"><i class="fas fa-check-circle"></i> تم</span>';
    }
}

/** ينتقل لحقل الطالب التالي في القائمة، أو ينهي الجلسة لو كان آخر طالب */
function moveToNextManualInput(currentIndex) {
    const next = document.querySelector(`.manual-mark-input[data-index="${currentIndex + 1}"]`);
    if (next) {
        next.focus();
        next.select();
    } else {
        finishManualGrading();
    }
}

/** ✅ متطلب 9: عند الانتهاء من آخر طالب في القائمة، اعرض رسالة نجاح توضح اكتمال الرصد */
function finishManualGrading() {
    const examId = document.getElementById('manual-grade-exam-select').value;
    const studentIds = manualGradingStudents.map(s => s.id);
    const examScores = db.scores.filter(sc => sc.examId == examId && studentIds.includes(sc.studentId));
    const totalCount = manualGradingStudents.length;
    const absentCount = examScores.filter(sc => sc.mark === -1).length;
    const gradedCount = examScores.length - absentCount;

    db.save();
    updateDashboardStats();
    showNotification(
        `✅ تم الانتهاء من رصد المجموعة بالكامل: ${gradedCount} درجة، ${absentCount} غياب، من إجمالي ${totalCount} طالب`,
        'success', 3500
    );

    // رجوع تلقائي لشاشة الإعداد بعد لحظة، عشان يقدر يبدأ مجموعة جديدة فورًا بدون ماوس
    setTimeout(() => { exitManualGrading(); }, 1800);
}


function printFastGradingReport() {
    const examId = document.getElementById('fast-exam-select').value;
    if (!examId) { showNotification('اختر الامتحان أولاً لطباعة تقريره', 'error'); return; }

    const exam = db.exams.find(e => e.id == examId);
    const scores = db.scores.filter(s => s.examId == examId);

    let reportHtml = `
        <div style="direction: rtl; font-family: 'Tajawal', sans-serif; padding: 20px;">
            <h1 style="text-align: center; color: #4f46e5;">تقرير نتائج: ${exam.title}</h1>
            <p style="text-align: center; color: #64748b;">الدرجة النهائية: ${exam.maxMarks} | التاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="border: 1px solid #e2e8f0; padding: 12px;">اسم الطالب</th>
                        <th style="border: 1px solid #e2e8f0; padding: 12px;">الدرجة</th>
                        <th style="border: 1px solid #e2e8f0; padding: 12px;">الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    ${scores.map(s => {
        const st = db.students.find(x => x.id === s.studentId);
        const percent = (s.mark / exam.maxMarks) * 100;
        return `
                            <tr>
                                <td style="border: 1px solid #e2e8f0; padding: 10px;">${st ? st.name : '---'}</td>
                                <td style="border: 1px solid #e2e8f0; padding: 10px; text-align: center;">${s.mark} / ${exam.maxMarks}</td>
                                <td style="border: 1px solid #e2e8f0; padding: 10px; text-align: center; font-weight: bold; color: ${percent >= 50 ? '#10b981' : '#ef4444'}">
                                    ${percent >= 50 ? 'ناجح' : 'راسب'}
                                </td>
                            </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    const printWin = window.open('', '_blank');
    printWin.document.write(`<html><head><title>تقرير النتائج</title></head><body>${reportHtml}</body></html>`);
    printWin.document.close();
    setTimeout(() => {
        printWin.print();
        printWin.close();
    }, 500);
}

function renderFastHistory() {
    const examId = document.getElementById('fast-exam-select').value;
    const historyList = document.getElementById('fast-history-list');
    if (!historyList) return;

    if (!examId) {
        historyList.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; opacity:0.5;">يرجى اختيار امتحان لعرض السجل</td></tr>';
        return;
    }

    const scores = db.scores.filter(s => s.examId == examId).reverse().slice(0, 15);

    historyList.innerHTML = scores.map(s => {
        const student = db.students.find(x => x.id === s.studentId);
        const isAbsent = s.mark === -1;
        return `
            <tr class="fade-in">
                <td><strong>${student ? student.name : 'طالب'}</strong></td>
                <td>
                    <span style="font-weight:800; font-size:1.1rem; color:${isAbsent ? 'var(--danger)' : 'var(--primary)'}">
                        ${isAbsent ? 'غائب' : s.mark}
                    </span>
                </td>
                <td>${new Date(s.id).toLocaleTimeString('ar-EG')}</td>
                <td>
                    <button class="btn" style="color:var(--danger); padding:4px;" onclick="deleteScore('${s.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="4" style="text-align:center; padding:2rem;">لا يوجد رصد لهذا الامتحان حالياً</td></tr>';
}

function renderFastPendingList() {
    const examId = document.getElementById('fast-exam-select').value;
    const groupId = document.getElementById('fast-group-select').value;
    const list = document.getElementById('fast-pending-list');
    const countEl = document.getElementById('fast-pending-count');

    if (!list || !countEl) return;
    if (!examId || !groupId) {
        list.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:2rem; opacity:0.5;">يرجى اختيار المجموعة لفلترة المتبقيين</td></tr>';
        countEl.innerText = '0';
        return;
    }

    // Students in this group OR all students in grade
    const groupStudents = groupId === 'all'
        ? db.students.filter(s => String(s.grade) === String(currentGrade))
        : db.students.filter(s => String(s.groupId) === String(groupId));
    // Students who already have a score
    const recordedIds = db.scores.filter(sc => sc.examId == examId).map(sc => sc.studentId);

    const pendingStudents = groupStudents.filter(s => !recordedIds.includes(s.id));
    countEl.innerText = pendingStudents.length;

    list.innerHTML = pendingStudents.map(s => `
        <tr class="fade-in">
            <td style="font-weight:700;">${s.name}</td>
            <td style="font-family:monospace; color:var(--text-muted); font-size:0.8rem;">${s.qrCode}</td>
            <td style="text-align:center; display:flex; gap:5px; justify-content:center;">
                <button class="btn btn-primary" style="padding:4px 12px; font-size:0.75rem; background:var(--primary);" onclick="processFastScan('${s.qrCode}')">
                    <i class="fas fa-edit"></i> رصد الدرجة
                </button>
                <button class="btn btn-primary" style="padding:4px 12px; font-size:0.75rem; background:var(--danger);" onclick="markStudentExamAbsentDirect(${s.id}, ${examId})">
                    <i class="fas fa-user-times"></i> غائب
                </button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="3" style="text-align:center; padding:2rem; color:var(--accent); font-weight:700;">✅ اكتمل رصد جميع طلاب المجموعة!</td></tr>';
}

function markStudentExamAbsentDirect(studentId, examId) {
    db.scores.push({
        id: Date.now(),
        studentId: studentId,
        examId: parseInt(examId),
        mark: -1,
        date: new Date().toISOString()
    });
    db.save();
    showNotification('تم تسجيل الطالب غائب');
    renderFastHistory();
    renderFastPendingList();
}

function deleteScore(scoreId) {
    if (!confirm('هل تريد حذف هذه الدرجة؟')) return;
    db.scores = db.scores.filter(s => s.id !== scoreId);
    db.save();
    showNotification('تم الحذف');
    renderFastHistory();
    renderFastPendingList();
}

function openGradingArchive() {
    const container = document.getElementById('grading-archive-list');
    if (!container) return;

    // Get all exams that have scores for the current grade
    const myExams = db.exams.filter(e => String(e.grade) === String(currentGrade)).reverse();

    container.innerHTML = myExams.map(ex => {
        const scores = db.scores.filter(s => s.examId === ex.id);
        const attended = scores.filter(s => s.mark !== -1).length;
        const absent = scores.filter(s => s.mark === -1).length;

        return `
            <div class="card archive-card" style="padding: 1.5rem; text-align: center; border: 2px solid var(--border);">
                <div style="font-weight: 800; font-size: 1.3rem; margin-bottom: 0.5rem; color: var(--primary);">${ex.title}</div>
                <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
                    <i class="fas fa-users"></i> إجمالي: ${attended + absent} <br>
                    <span style="color:var(--accent)">${attended} حاضر</span> | <span style="color:var(--danger)">${absent} غائب</span>
                </div>
                <button class="btn btn-primary" style="width:100%;" onclick="toggleModal('grading-archive-modal', false); openMarksModal(${ex.id})">
                    <i class="fas fa-eye"></i> عرض النتائج
                </button>
            </div>
        `;
    }).join('') || '<p style="text-align:center; padding:3rem; grid-column:span 3; opacity:0.5;">لا يوجد امتحانات مؤرشفة بعد</p>';

    toggleModal('grading-archive-modal', true);
}


function renderExams() {
    const list = document.getElementById('exams-list');
    if (!list) return;

    // Students in the active group
    const groupStudents = db.students.filter(s => s.grade == currentGrade && s.groupId == currentGroupId);
    const groupStudentIds = groupStudents.map(s => s.id);

    // Filter exams to those belonging to our active grade 
    // AND (either matching this group Specifically OR are general grade-wide/archived exams)
    const exams = db.exams.filter(e =>
        String(e.grade) === String(currentGrade) &&
        (!e.groupId || String(e.groupId) === String(currentGroupId))
    );
    list.innerHTML = exams.map(e => {
        // Filter scores to ONLY those belonging to our active group's students
        const groupScores = db.scores.filter(s => s.examId === e.id && groupStudentIds.includes(s.studentId));
        const validScores = groupScores.filter(s => s.mark !== -1);

        const avg = validScores.length > 0 ? (validScores.reduce((sum, s) => sum + s.mark, 0) / validScores.length).toFixed(1) : 0;
        return `
            <tr>
                <td><strong>${e.title}</strong></td>
                <td>${new Date(e.id).toLocaleDateString('ar-EG')}</td>
                <td>${e.maxMarks || 100}</td>
                <td><span class="status-badge" style="background:#f0f9ff; color:#0369a1">${avg} / ${e.maxMarks || 100}</span></td>
                <td style="text-align:center;">
                    <button class="btn btn-primary" style="background:var(--accent); color:white; padding:5px 15px;" onclick="openMarksModal(${e.id})">
                        عرض النتائج <i class="fas fa-chart-line"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="5" style="text-align:center; padding:2rem;">لا توجد امتحانات مضافة في هذا الصف</td></tr>';
}

function handleAddExam() {
    const title = document.getElementById('modal-exam-title').value;
    const marks = parseInt(document.getElementById('modal-exam-marks').value);
    if (!title || !marks) return;
    db.exams.push({
        id: Date.now(),
        title,
        maxMarks: marks,
        grade: currentGrade,
        groupId: currentGroupId // Tag exam with current group context
    });
    db.save();
    renderExams();
    toggleModal('exam-modal', false);
    document.getElementById('modal-exam-title').value = '';
    document.getElementById('modal-exam-marks').value = '';
    showNotification('تم إنشاء الامتحان بنجاح');
}

function openMarksModal(id) {
    currentSelectedExamId = id;
    currentMarksFilter = 'all';
    renderMarksModalContent();
    toggleModal('marks-modal', true);
}

function filterMarks(status) {
    currentMarksFilter = status;
    renderMarksModalContent();
}

function renderMarksModalContent() {
    const id = currentSelectedExamId;
    const ex = db.exams.find(e => e.id === id);
    if (!ex) return;

    document.getElementById('marks-exam-title').innerText = `نتائج: ${ex.title}`;
    const container = document.getElementById('marks-entry-container');

    const groupStudents = db.students.filter(s => String(s.grade) === String(currentGrade) && String(s.groupId) === String(currentGroupId));
    const groupStudentIds = groupStudents.map(s => s.id);

    let scores = db.scores.filter(s => s.examId === id && groupStudentIds.includes(s.studentId));

    if (currentMarksFilter === 'present') {
        scores = scores.filter(s => s.mark !== -1);
    } else if (currentMarksFilter === 'absent') {
        scores = scores.filter(s => s.mark === -1);
    }

    container.innerHTML = scores.map(s => {
        const st = db.students.find(x => x.id === s.studentId);
        const displayMark = s.mark === -1 ? '<span class="status-badge" style="background:#fee2e2; color:#991b1b">غائب</span>' : `<b>${s.mark}</b> / ${ex.maxMarks}`;
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:1rem; border-bottom:1px solid #eee;">
                <span>${st ? st.name : 'طالب'}</span>
                <span>${displayMark}</span>
            </div>
        `;
    }).join('') || '<p style="text-align:center; padding:2rem; opacity:0.5;">لا يوجد طلاب في هذا التصنيف</p>';
}

function printExamResults(examId, filter = 'all') {
    const ex = db.exams.find(e => e.id === examId);
    if (!ex) return;

    const groupStudents = db.students.filter(s => String(s.grade) === String(currentGrade) && String(s.groupId) === String(currentGroupId));
    const groupStudentIds = groupStudents.map(s => s.id);
    let scores = db.scores.filter(s => s.examId === examId && groupStudentIds.includes(s.studentId));

    if (filter === 'present') {
        scores = scores.filter(s => s.mark !== -1);
    } else if (filter === 'absent') {
        scores = scores.filter(s => s.mark === -1);
    }

    const printWindow = window.open('', '_blank');
    let html = `
        <html dir="rtl">
        <head>
            <title>كشف درجات: ${ex.title}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
                body { font-family: 'Tajawal', sans-serif; padding: 20mm; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
                th { background-color: #f1f5f9; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
                .absent { color: red; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>كشف درجات ${ex.title}</h1>
                <p>الصف: ${gradesList.find(g => String(g.id) === String(currentGrade))?.name || '---'} | المجموعة: ${db.groups.find(g => String(g.id) === String(currentGroupId))?.name || '---'}</p>
                <p>الحالة: ${filter === 'all' ? 'الكل' : (filter === 'present' ? 'الحاضرين' : 'الغائبين')}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>م</th>
                        <th>اسم الطالب</th>
                        <th>الدرجة</th>
                        <th>ملاحظات</th>
                    </tr>
                </thead>
                <tbody>
    `;

    scores.forEach((s, idx) => {
        const st = db.students.find(x => x.id === s.studentId);
        const markText = s.mark === -1 ? '<span class="absent">غائب</span>' : s.mark;
        html += `
            <tr>
                <td>${idx + 1}</td>
                <td>${st ? st.name : '---'}</td>
                <td>${markText} / ${ex.maxMarks}</td>
                <td></td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <div style="margin-top: 50px; display: flex; justify-content: space-between;">
                <p>توقيع المحاضر: ........................</p>
                <p>تاريخ الكشف: ${new Date().toLocaleDateString('ar-EG')}</p>
            </div>
            <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
        </html>
    `;
    printWindow.document.write(html);
}

// --- 8. AI & Analytics Core Engine ---
function runAIAnalytics() {
    const dropoutRiskEl = document.getElementById('ai-dropout-risk');
    const risingStarsEl = document.getElementById('ai-rising-stars');
    const avgEngagementEl = document.getElementById('ai-avg-engagement');
    const riskList = document.getElementById('ai-risk-list');

    if (!dropoutRiskEl) return;

    let dropoutCount = 0;
    let starCount = 0;
    let totalEng = 0;

    // Filter strictly to current group
    const activeStudents = db.students.filter(s => s.grade == currentGrade && s.groupId == currentGroupId);
    const studentAnalyses = activeStudents.map(s => analyzeStudent(s.id));

    // Stats
    dropoutCount = studentAnalyses.filter(a => a.riskLevel === 'CRITICAL' || a.riskLevel === 'HIGH').length;
    starCount = studentAnalyses.filter(a => a.academicTrend === 'IMPROVING').length;
    totalEng = studentAnalyses.reduce((sum, a) => sum + a.engagementScore, 0) / (activeStudents.length || 1);

    dropoutRiskEl.innerText = dropoutCount;
    risingStarsEl.innerText = starCount;
    avgEngagementEl.innerText = `${Math.round(totalEng)}%`;

    // Risk Table Rendering
    const riskyStudents = studentAnalyses
        .filter(a => a.riskScore > 40)
        .sort((a, b) => b.riskScore - a.riskScore);

    riskList.innerHTML = riskyStudents.map(a => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:1rem; border-bottom:1px solid var(--border); background:${a.riskLevel === 'CRITICAL' ? '#fff1f2' : 'transparent'}">
            <div>
                <strong>${a.name}</strong> <span class="status-badge" style="background:${a.riskColor}; color:white">${a.riskLevel}</span>
                <br><small style="color:var(--text-muted)">${a.recommendation}</small>
            </div>
            <button class="btn" onclick="viewDetailedProfile(${a.id})" style="background:var(--primary); color:white; padding:5px 12px;">مراجعة</button>
        </div>
    `).join('') || '<p style="padding:1rem;">لا يوجد مخاطر مكتشفة حالياً. العمل يسير بشكل ممتاز! ✅</p>';

    initAnalyticsCharts();
}

function analyzeStudent(id) {
    const s = db.students.find(x => x.id === id);
    if (!s) return null;

    const atts = db.attendance.filter(a => a.studentId == id);
    const marks = db.scores.filter(sc => sc.studentId == id);

    // 1. Attendance Risk (Weight: 60%)
    const today = new Date();
    const last30Days = new Date(today.setDate(today.getDate() - 30)).toISOString();
    const recentAtts = atts.filter(a => a.date >= last30Days);
    const attendanceRate = (recentAtts.length / 8) * 100; // Assuming 8 sessions/month
    const attRisk = Math.max(0, 100 - attendanceRate);

    // Check for consecutive absences
    const sortedAtts = atts.sort((a, b) => new Date(b.date) - new Date(a.date));
    let gapSessions = 0;
    if (sortedAtts.length > 0) {
        const lastSessionDate = new Date(sortedAtts[0].date);
        const daysSince = Math.floor((new Date() - lastSessionDate) / (1000 * 60 * 60 * 24));
        gapSessions = Math.floor(daysSince / 3); // Approx 3 days per session
    } else {
        gapSessions = 5; // Long term absence if never attended
    }

    // 2. Academic Risk (Weight: 30%)
    let academicTrend = 'STABLE';
    let gradeRisk = 0;
    const validMarks = marks.filter(m => m.mark !== -1);
    if (validMarks.length >= 2) {
        const latest = validMarks[validMarks.length - 1].mark;
        const previous = validMarks[validMarks.length - 2].mark;
        if (latest < previous) academicTrend = 'DECLINING';
        if (latest > previous + 5) academicTrend = 'IMPROVING';

        const avg = validMarks.reduce((sum, m) => sum + m.mark, 0) / validMarks.length;
        if (latest < avg * 0.8) gradeRisk = 50;
    }
    // Boost risk if the student has multiple exam absences
    const examAbsenceCount = marks.filter(m => m.mark === -1).length;
    if (examAbsenceCount >= 2) gradeRisk += 20;

    // 3. Engagement Score (Based on points/shop)
    const engagementScore = Math.min(100, (s.points / 100) * 100);

    // Final Risk Calculation
    let riskScore = (attRisk * 0.6) + (gradeRisk * 0.3) + (gapSessions * 10);
    riskScore = Math.min(100, riskScore);

    let riskLevel = 'LOW';
    let riskColor = '#10b981';
    let recommendation = 'الاستمرار في التحفيز';

    if (riskScore > 30) { riskLevel = 'MEDIUM'; riskColor = '#f59e0b'; recommendation = 'ملاحظة النشاط في الحصص القادمة'; }
    if (riskScore > 60) { riskLevel = 'HIGH'; riskColor = '#f97316'; recommendation = 'يرجى الاتصال بولي الأمر فوراً'; }
    if (riskScore > 85 || gapSessions >= 3) { riskLevel = 'CRITICAL'; riskColor = '#ef4444'; recommendation = 'خطر الانقطاع النهائي! مطلوب مقابلة شخصية'; }

    return {
        id: s.id,
        name: s.name,
        riskScore,
        riskLevel,
        riskColor,
        academicTrend,
        engagementScore,
        recommendation,
        gapSessions
    };
}

function initAnalyticsCharts() {
    const grades = { '1': 0, '2': 0, '3': 0 };
    db.students.forEach(s => grades[s.grade]++);

    new Chart(document.getElementById('grade-chart-canvas').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['الصف الأول', 'الصف الثاني', 'الصف الثالث'],
            datasets: [{
                data: [grades['1'], grades['2'], grades['3']],
                backgroundColor: ['#4f46e5', '#10b981', '#f59e0b']
            }]
        }
    });

    // Audit: Filter analytics by current group context
    const groupStudents = db.students.filter(s => s.grade == currentGrade && s.groupId == currentGroupId);
    const groupStudentIds = groupStudents.map(s => s.id);

    // Revenue Estimate (example based on attendance, though actual payment data might be better)
    const groupAttCount = db.attendance.filter(a => groupStudentIds.includes(a.studentId) && a.status === 'present').length;
    const income = groupAttCount * 50;

    const exp = db.expenses.filter(e => e.groupId == currentGroupId).reduce((sum, e) => sum + e.amount, 0);

    new Chart(document.getElementById('finance-chart-canvas').getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['الإيرادات (تقديري)', 'المصروفات'],
            datasets: [{
                label: 'جنية مصري',
                data: [income, exp],
                backgroundColor: ['#10b981', '#ef4444']
            }]
        }
    });
}

// --- 7. GLOBAL SCANNER ENGINE (ROBUST & SMART) ---
let scannerBuffer = '';
let scannerLastKeyTime = 0;

window.addEventListener('keydown', (e) => {
    // Avoid interference with natural typing in long textareas
    if (e.target.tagName === 'TEXTAREA') return;

    const now = Date.now();

    // Sequence speed check: Real hardware scanners are extremely fast (< 30ms between keys)
    const isFast = (now - scannerLastKeyTime) < 100;

    // Reset buffer if this is a new "manual" typing attempt
    if (!isFast) {
        scannerBuffer = '';
    }

    if (e.key === 'Enter') {
        const code = scannerBuffer.trim();
        if (code.length >= 4) {
            // Audit: Find student ONLY in current grade to prevent global scan mixing
            const student = db.students.find(s => (s.qrCode === code || code.includes(s.qrCode)) && String(s.grade) === String(currentGrade));
            if (student) {
                e.preventDefault();
                e.stopPropagation();

                // If focus is in a mark input, clear it to prevent the ID from leaking in
                if (e.target.tagName === 'INPUT') {
                    e.target.value = '';
                }

                handleGlobalScanDispatch(student.qrCode);
                scannerBuffer = '';
                return;
            }
        }
        scannerBuffer = '';
        return;
    }

    // Capture alphanumeric only for the buffer
    if (e.key.length === 1) {
        scannerBuffer += e.key;
        scannerLastKeyTime = now;

        // Smart matching for scanners that don't send "Enter"
        if (scannerBuffer.length >= 6) {
            const student = db.students.find(s => s.qrCode === scannerBuffer);
            if (student) {
                // Give it a tiny delay to catch any suffix before dispatching
                setTimeout(() => {
                    if (scannerBuffer !== "") {
                        handleGlobalScanDispatch(scannerBuffer);
                        scannerBuffer = '';
                    }
                }, 50);
            }
        }
    }
});

/** Global Dispatcher with UI Intelligence **/
function handleGlobalScanDispatch(code) {
    const isGrading = document.getElementById('fast-grading-section').style.display === 'block';
    const isFollowup = document.getElementById('followup-section').style.display === 'block';

    // 1. AUTO-SAVE (Context: Fast Grading)
    // If scanning student B while a mark for student A is typed, SAVE student A first.
    if (isGrading && currentFastStudent) {
        const inputEl = document.getElementById('fast-mark-input');
        const examId = document.getElementById('fast-exam-select').value;
        const markVal = inputEl ? inputEl.value.trim() : "";
        if (markVal !== "" && !isNaN(parseFloat(markVal))) {
            processAndSaveGrade(currentFastStudent, examId, parseFloat(markVal));
        }
    }

    // 2. AUTO-OPEN PROFILE (Visual Confirmation)
    // Always show the Smart Card for visual feedback when scanning (unless in specific modes that have their own UI)
    const s = db.students.find(x => (x.qrCode === code || (code.length >= 8 && code.includes(x.qrCode))) && String(x.grade) === String(currentGrade));
    if (s && !isGrading) {
        openSmartCard(s.id);
    }

    // 3. LOGIC DISPATCH
    if (isGrading) {
        processFastScan(code);
    } else if (isFollowup) {
        handleExamAttendanceScan(code);
    } else {
        processScan(code);
    }

    // UI Monitor Ping
    const mon = document.getElementById('scanner-monitor');
    if (mon) {
        mon.style.display = 'block';
        mon.innerHTML = `<i class='fas fa-barcode' style='color:#10b981'></i> جاري المعالجة: <span style='color:#fff'>${code}</span>`;
        setTimeout(() => mon.style.display = 'none', 1500);
    }
}

function processScan(token) {
    if (typeof token === 'object' && token.decodedText) token = token.decodedText;
    const cleanToken = token.trim();
    let student = db.students.find(s => s.qrCode === cleanToken);
    if (!student) {
        student = db.students.find(s => cleanToken.includes(s.qrCode) || s.qrCode.includes(cleanToken));
    }

    if (!student) {
        showNotification(`كود غير مسجل: ${cleanToken}`, 'warning');
        return;
    }

    // --- STRICT CONTEXT CHECK: Only allow students from CURRENT GRADE ---
    if (String(student.grade) !== String(currentGrade)) {
        const studentGradeObj = gradesList.find(g => g.id == student.grade);
        playSound('error');
        showNotification(`🛑 خطأ: الطالب ${student.name} مقيد في (${studentGradeObj ? studentGradeObj.name : 'سنة أخرى'}). يرجى التبديل للسنة الدراسية الصحيحة أولاً.`, 'error');
        return;
    }

    // --- STRICT GROUP CHECK ---
    const rawSessionId = activePortalGroupId || currentGroupId;
    let isGroupMatched = false;
    let sessionGroupIdForRecord = rawSessionId;

    if (String(rawSessionId).startsWith('joint:')) {
        const allowedGroupIds = rawSessionId.split(':')[1].split(',');
        isGroupMatched = allowedGroupIds.includes(String(student.groupId));
        sessionGroupIdForRecord = student.groupId; // NEW: Record under original group on Joint Days
    } else {
        isGroupMatched = String(student.groupId) === String(rawSessionId);
        sessionGroupIdForRecord = rawSessionId;
    }

    // ── عزل صارم: رفض قاطع للطالب من مجموعة مختلفة ────────────
    if (!isGroupMatched) {
        const studentGroupObj = db.groups.find(g => String(g.id) === String(student.groupId));
        playSound('error');
        showNotification(
            `🛑 "${student.name}" مسجل في (${studentGroupObj ? studentGroupObj.name : 'مجموعة أخرى'}) — لا يمكن تسجيل حضوره هنا.`,
            'error'
        );
        return; // إيقاف كامل
    }

    // 3. Success! Visual feedback for the teacher
    const mon = document.getElementById('scanner-monitor');
    if (mon) {
        mon.innerHTML = `<i class='fas fa-check-double' style='color:#10b981'></i> تم التعرف: <span style='color:#fff'>${student.name}</span>`;
    }

    // --- NEW: Always open Smart Card for visual confirmation as requested ---
    openSmartCard(student.id);

    const todayStr = new Date().toLocaleDateString('en-CA');

    // --- NEW: Block Scanning if subscription is not active ---
    if (!db.settings.isMonthlyActive) {
        playSound('error');
        showNotification('🛑 تنبيه: يرجى تفعيل "بدء الاشتراك" من قسم الخزينة أولاً لتتمكن من رصد الحضور', 'error');
        return;
    }

    // --- 4. Permanent Attendance Logic ---

    // التحقق من الجلسة الحالية فقط (مش كل اليوم)
    const alreadyInSession = currentSessionAttendance.some(s => s.id === student.id);

    if (alreadyInSession) {
        // مسجل في نفس الجلسة → تحذير فقط بدون alert
        playSound('error');
        showNotification(`⚠️ ${student.name} مسجل مسبقاً في هذه الجلسة`, 'warning');
        if (document.getElementById('voice-feedback-toggle')?.checked) {
            const msg = new SpeechSynthesisUtterance();
            msg.text = 'تم تسجيله من قبل';
            msg.lang = 'ar-SA';
            window.speechSynthesis.speak(msg);
        }
        openSmartCard(student.id);
        return;
    }

    // مش في الجلسة الحالية → سجّله حتى لو كان في جلسة سابقة نفس اليوم
    let todayRecord = db.attendance.find(a =>
        a.studentId == student.id &&
        new Date(a.date).toLocaleDateString('en-CA') === todayStr
    );

    if (todayRecord) {
        todayRecord.status = 'present';
        todayRecord.date = new Date().toISOString();
        todayRecord.groupId = sessionGroupIdForRecord;
    } else {
        db.attendance.push({
            id: Date.now(),
            studentId: student.id,
            groupId: sessionGroupIdForRecord,
            date: new Date().toISOString(),
            status: 'present'
        });
        student.points = (student.points || 0) + 5;
    }

    showNotification(`تم رصد حضور: ${student.name} ✅`, 'success');

    // ── إضافة للجلسة عبر SessionManager (مع double-guard تلقائي) ─
    const studentEntry = { ...student, scanTime: new Date().toISOString() };
    SessionManager.addStudent(studentEntry);
    // مزامنة الـ global بعد الإضافة
    currentSessionAttendance = SessionManager.attendance();
    renderSessionTable();

    // --- 5. Mode Specific Logic ---
    const isAttendanceSection = document.getElementById('attendance-section').style.display === 'block';

    const hasPaidCurrentCycle = db.payments.some(p =>
        p.studentId == student.id &&
        p.category === 'اشتراك شهري' &&
        p.cycleId == db.settings.activeCycle
    );

    // Group Warning
    const studentGroup = db.groups.find(g => g.id == student.groupId);
    if (!isGroupMatched) {
        showNotification(`⚠️ تنبيه: ${student.name} ينتمي لمجموعة (${studentGroup ? studentGroup.name : 'أخرى'})`, 'warning');
    }

    // Smart Handout Distribution
    if (activeHandoutId) {
        const alreadyHasHandout = db.studentHandouts.some(sh => sh.studentId == student.id && sh.handoutId === activeHandoutId);
        if (!alreadyHasHandout) {
            db.studentHandouts.push({
                id: Date.now(),
                studentId: student.id,
                handoutId: activeHandoutId,
                date: new Date().toISOString()
            });
            showNotification(`تم تسليم الملزمة لـ ${student.name}`, 'success');
        }
    }

    db.save();

    // Auto-update Absence Report if visible
    if (document.getElementById('absence-section').style.display === 'block') {
        generateAbsenceReport();
    }

    // 7. Open Smart Card UI
    openSmartCard(student.id);

    // Voice Feedback
    playSound('success');
    speakName(student.name);
}

function searchStudentSmart(query) {
    const results = document.getElementById('attendance-manual-results');
    if (!query || query.trim().length < 1) {
        results.style.display = 'none';
        results.innerHTML = '';
        return;
    }

    // Sync active grade/group context to ensure db.settings resolves correctly
    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    // Get active context robustly using unified keys
    const activeGrade = currentGrade || localStorage.getItem('edu_active_grade');
    const activeGroup = currentGroupId || localStorage.getItem('edu_active_group');

    if (!activeGroup || activeGroup === 'all') {
        results.style.display = 'block';
        results.innerHTML = '<div class="result-item" style="color:var(--danger); justify-content:center;">⚠️ يرجى اختيار مجموعة أولاً من قائمة المجموعات أو لوحة التحكم</div>';
        return;
    }

    // Normalize Arabic for inclusive search
    const normalize = (text) => {
        return String(text)
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .toLowerCase()
            .trim();
    };

    const q = normalize(query);

    // --- NEW: Block Search selection if subscription is not active ---
    if (!db.settings.isMonthlyActive) {
        results.style.display = 'block';
        results.innerHTML = '<div class="result-item" style="color:var(--danger); justify-content:center;">⚠️ يرجى تفعيل الاشتراك من الخزينة أولاً</div>';
        return;
    }

    const matchedStudents = db.students.filter(s => {
        // ✅ إصلاح: توحيد صيغة الصف قبل المقارنة (قديم/systemCode/platformCode)
        // كانت المقارنة النصية المباشرة بتفشل لو الصف مخزّن بصيغة مختلفة عن activeGrade
        // رغم إن المجموعة (groupId) هي نفسها المطابقة فعلياً، فبنعتمد عليها كمرجع أساسي.
        const gradeMatches = (typeof normalizeGrade === 'function')
            ? normalizeGrade(s.grade) === normalizeGrade(activeGrade)
            : String(s.grade) === String(activeGrade);

        return gradeMatches &&
            String(s.groupId) === String(activeGroup) &&
            (normalize(s.name).includes(q) || String(s.qrCode).startsWith(query));
    }).slice(0, 5);

    // ✅ Fallback: لو مفيش نتائج بمطابقة الصف، جرّب المطابقة بالمجموعة فقط
    // (المجموعة أصلاً بتحدد الصف، فمفيش داعي نمنع النتيجة بسبب اختلاف صيغة تخزين الصف)
    if (matchedStudents.length === 0) {
        const fallbackMatches = db.students.filter(s => {
            return String(s.groupId) === String(activeGroup) &&
                (normalize(s.name).includes(q) || String(s.qrCode).startsWith(query));
        }).slice(0, 5);
        if (fallbackMatches.length > 0) matchedStudents.push(...fallbackMatches);
    }

    if (matchedStudents.length > 0) {
        results.style.display = 'block';
        results.innerHTML = matchedStudents.map(s => `
            <div class="result-item" onclick="recordQuickAction(${s.id}, 'attendance'); openSmartCard(${s.id});">
                <div style="text-align:right;">
                    <div style="font-weight:700; color:var(--primary);">${s.name}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${s.qrCode}</div>
                </div>
                <i class="fas fa-plus-circle" style="color:var(--accent);"></i>
            </div>
        `).join('');
    } else {
        results.style.display = 'block';
        results.innerHTML = '<div class="result-item" style="color:var(--text-muted); justify-content:center;">لا يوجد نتائج لهذه المجموعة</div>';
    }
}

function openSmartCard(studentId) {
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    // Reset Search
    document.getElementById('attendance-manual-results').style.display = 'none';
    document.getElementById('manual-student-entry').value = '';

    // 1. Fetch History & Context (Check latest archived session first)
    const todayStr = new Date().toLocaleDateString('en-CA');
    const groupSessions = (db.absenceSessions || [])
        .filter(sess => String(sess.groupId) === String(s.groupId) && new Date(sess.date).toLocaleDateString('en-CA') !== todayStr)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    let lastAttStatus = null;
    if (groupSessions.length > 0) {
        const lastSession = groupSessions[0];
        if (lastSession.presentIds && lastSession.presentIds.includes(s.id)) lastAttStatus = 'present';
        else if (lastSession.absentIds && lastSession.absentIds.includes(s.id)) lastAttStatus = 'absent';
        else if (lastSession.presentNames && lastSession.presentNames.includes(s.name)) lastAttStatus = 'present';
        else if (lastSession.absenteeNames && lastSession.absenteeNames.includes(s.name)) lastAttStatus = 'absent';
    }

    const lastAttFromLegacy = db.attendance
        .filter(a => a.studentId == s.id && new Date(a.date).toLocaleDateString('en-CA') !== todayStr)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    // Determine the status to display
    const finalStatus = lastAttStatus || (lastAttFromLegacy ? lastAttFromLegacy.status : null);

    const currentCycleId = db.settings.activeCycle;
    const payment = db.payments.find(p =>
        p.studentId == s.id &&
        p.category === 'اشتراك شهري' &&
        p.cycleId == currentCycleId
    );
    const isPaid = !!payment;
    const isExemption = payment?.isExemption;

    // 2. Render Card
    const container = document.getElementById('smart-card-content');
    if (!container) return;

    container.innerHTML = `
        <div style="text-align: center; padding: 0.5rem;">
            <div class="avatar" style="width: 100px; height: 100px; font-size: 3rem; margin: 0 auto 1rem; background: var(--bg-hover); color: var(--accent); border: 2px solid var(--accent);">
                ${s.name.charAt(0)}
            </div> 
            <h2 style="margin-bottom: 0.5rem; color: var(--text-main);">${s.name}</h2>
            <div style="display:flex; justify-content:center; gap:8px; margin-bottom:1.5rem;">
                <span class="status-badge" style="background:var(--bg-light);">كود: ${s.qrCode}</span>
                <span class="status-badge" style="background:#fef3c7; color:#92400e;">${s.points || 0} نقطة 💎</span>
            </div>

            <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div class="card" style="padding:1rem; border:2px solid ${finalStatus === 'absent' ? 'var(--danger)' : 'var(--accent)'};">
                    <small style="color:var(--text-muted)">الحصة السابقة</small>
                    <div style="font-weight:700; color:${finalStatus === 'absent' ? 'var(--danger)' : 'var(--accent)'}">${finalStatus ? (finalStatus === 'present' ? 'حضور ✅' : 'غياب ❌') : 'أول حضور'}</div>
                </div>
                <div class="card" style="padding:1rem; border:2px solid ${isPaid ? (isExemption ? 'var(--border)' : 'var(--accent)') : 'var(--danger)'};">
                    <small style="color:var(--text-muted)">اشتراك الشهر</small>
                    <div style="font-weight:700; color:${isPaid ? (isExemption ? 'var(--text-muted)' : 'var(--accent)') : 'var(--danger)'}">${isPaid ? (isExemption ? 'معفي ✅' : 'خالص ✅') : 'غير خالص ⏳'}</div>
                </div>
            </div>

            <!-- Quick Action Buttons -->
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 1rem;">
                <button class="btn btn-primary" style="height: 60px; border-radius: 12px; font-size: 1.1rem; background: var(--accent); box-shadow: 0 4px 12px -2px rgba(16, 185, 129, 0.3);"
                    onclick="recordQuickAction(${s.id}, 'attendance'); openSmartCard(${s.id});">
                    <i class="fas fa-user-check"></i> تسجيل حضور
                </button>
                <!-- أزرار دفع الاشتراك -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <button class="btn btn-payment" style="height: 65px; border-radius: 12px; font-size: 0.88rem; line-height:1.3; background: #f97316; box-shadow: 0 4px 14px -2px rgba(249,115,22,0.4);"
                        onclick="payLessonDirect(${s.id})">
                        <i class="fas fa-chalkboard-teacher" style="display:block;font-size:1.2rem;margin-bottom:3px;"></i>
                        دفع اشتراك الدرس
                    </button>
                    <button class="btn btn-payment" style="height: 65px; border-radius: 12px; font-size: 0.88rem; line-height:1.3; background: var(--vibrant-orange);"
                        onclick="recordQuickAction(${s.id}, 'handout'); openSmartCard(${s.id});">
                        <i class="fas fa-book" style="display:block;font-size:1.2rem;margin-bottom:3px;"></i>
                        دفع ملزمة
                    </button>
                </div>
                
                ${!isPaid ? `
                <button class="btn" style="height: 45px; border-radius: 12px; background: #f5f3ff; border: 1px solid #ddd6fe; color: #7c3aed; font-weight: 700; box-shadow: 0 4px 12px -2px rgba(124, 58, 237, 0.15);"
                    onclick="exemptMonthlyPayment(${s.id}); openSmartCard(${s.id});">
                    <i class="fas fa-hand-holding-heart"></i> عمل إعفاء لهذا الطالب (يتيم / حالة خاصة)
                </button>
                <button class="btn" style="height: 45px; border-radius: 12px; background: #fff7ed; border: 1px solid #fed7aa; color: #ea580c; font-weight: 700; box-shadow: 0 4px 12px -2px rgba(234, 88, 12, 0.1);"
                    onclick="discountMonthlyPayment(${s.id}); openSmartCard(${s.id});">
                    <i class="fas fa-tags"></i> عمل خصم على الاشتراك (جزئي)
                </button>
                ` : ''}
            </div>

            <button class="btn" style="width:100%; height:50px; background:var(--bg-light); border-radius:15px; border: 1px solid var(--border);" 
                onclick="toggleModal('smart-card-modal', false)">إغلاق النافذة</button>
        </div>
    `;

    // Apply session mode if a session is currently running to allow non-blocking scanning
    const overlay = document.getElementById('smart-card-modal');
    if (isLessonCodingActive && !isLessonCodingPaused) {
        overlay.classList.add('session-mode');
    } else {
        overlay.classList.remove('session-mode');
    }

    toggleModal('smart-card-modal', true);
}

// Function to handle the new action buttons
let quickActionPaymentId = null;
function recordQuickAction(studentId, action) {
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    // Sync active grade/group context to ensure db.settings resolves correctly
    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    const todayStr = new Date().toLocaleDateString('en-CA');
    const activeGroup = currentGroupId || localStorage.getItem('edu_active_group');

    // ⚡ إصلاح أداء: نتتبع أي الجداول اتغيّرت فعلاً عشان نحفظها هي بس
    // بدل ما نعيد حفظ كل قاعدة البيانات (بما فيها آلاف الطلاب) في كل ضغطة —
    // ده كان بيسبب تجمّد/بطء شديد وأحياناً ريفرش مفاجئ للصفحة على الأجهزة الضعيفة.
    let attendanceChanged = false;
    let paymentsChanged = false;

    // --- NEW: Block Quick Action if subscription is not active ---
    if (!db.settings.isMonthlyActive) {
        playSound('error');
        showNotification('🛑 تنبيه: يرجى تفعيل "بدء الاشتراك" من قسم الخزينة أولاً لتتمكن من رصد الحضور', 'error');
        return;
    }

    // 1. Handle Attendance
    if (action === 'attendance' || action === 'both') {
        const alreadyInSession = currentSessionAttendance.some(att => att.id === s.id);

        if (alreadyInSession) {
            // مسجل في نفس الجلسة الحالية فقط
            playSound('error');
            showNotification(`⚠️ ${s.name} مسجل مسبقاً في هذه الجلسة`, 'warning');
            if (document.getElementById('voice-feedback-toggle')?.checked) {
                const msg = new SpeechSynthesisUtterance();
                msg.text = 'تم تسجيله من قبل';
                msg.lang = 'ar-SA';
                window.speechSynthesis.speak(msg);
            }
        } else {
            // مش في الجلسة → سجّله حتى لو كان في جلسة سابقة نفس اليوم
            let todayRecord = db.attendance.find(a =>
                a.studentId == s.id &&
                new Date(a.date).toLocaleDateString('en-CA') === todayStr
            );

            if (todayRecord) {
                todayRecord.status = 'present';
                todayRecord.date = new Date().toISOString();
                todayRecord.groupId = activeGroup;
            } else {
                db.attendance.push({
                    id: Date.now(),
                    studentId: s.id,
                    groupId: activeGroup,
                    date: new Date().toISOString(),
                    status: 'present'
                });
                s.points = (s.points || 0) + 5;
            }
            attendanceChanged = true;

            SessionManager.addStudent({ ...s, scanTime: new Date().toISOString() });
            currentSessionAttendance = SessionManager.attendance();
            renderSessionTable();
            showNotification(`تم تسجيل حضور: ${s.name} ✅`, 'success');

            if (action === 'attendance') {
                playSound('success');
                speakName(s.name);
            }
        }
    }

    // 2. Handle Payment
    if (action === 'payment' || action === 'both') {
        const hasPaid = db.payments.some(p =>
            p.studentId == s.id &&
            p.category === 'اشتراك شهري' &&
            p.cycleId == db.settings.activeCycle
        );

        if (!hasPaid) {
            if (!db.settings.activeCycle) {
                // Auto start cycle if not exists
                db.settings.isMonthlyActive = true;
                db.settings.activeCycle = Date.now();
                db.settings.monthlyFee = db.settings.monthlyFee || 100; // default
            }

            const newPayment = {
                id: Date.now() + 1, // small offset to avoid duplicate ID
                studentId: s.id,
                amount: db.settings.monthlyFee,
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                date: new Date().toISOString(),
                category: 'اشتراك شهري',
                cycleId: db.settings.activeCycle,
                collectedBy: (typeof EmployeeAuth !== 'undefined') ? EmployeeAuth.getCurrentName() : undefined
            };
            db.payments.push(newPayment);
            paymentsChanged = true;
            showNotification(`تم تسجيل دفع الاشتراك لـ ${s.name} 💸`, 'success');

            // Voice Feedback
            playSound('success');
            if (action === 'both') speakName(`${s.name}. تم تسجيل الحضور والدفع`);
            else speakName(`${s.name}. تم تسجيل الدفع`);

            quickActionPaymentId = newPayment.id;
        } else {
            showNotification(`الطالب دفع الاشتراك مسبقاً`, 'warning');
            playSound('error');
        }
    }

    // 3. Handle Handout/Material Payment
    if (action === 'handout') {
        const amount = prompt('أدخل سعر الملزمة/المذكرة (ج.م):', 20);
        if (amount === null) return;

        db.payments.push({
            id: Date.now(),
            studentId: s.id,
            amount: parseInt(amount) || 0,
            date: new Date().toISOString(),
            category: 'ملزمة/مذكرة',
            cycleId: db.settings.activeCycle || 'misc',
            collectedBy: (typeof EmployeeAuth !== 'undefined') ? EmployeeAuth.getCurrentName() : undefined
        });
        paymentsChanged = true;
        showNotification(`تم تسجيل دفع الملزمة لـ ${s.name} ✅`, 'success');
        playSound('success');
        speakName(`${s.name}. تم تسجيل دفع الملزمة`);
        toggleModal('smart-card-modal', false);
        if (typeof renderReceiptsList === 'function') renderReceiptsList();
    }

    // ⚡ إصلاح أداء: نحفظ فقط الجداول اللي فعلاً اتغيّرت (حضور/مدفوعات)
    // بدل استدعاء db.save() الكامل اللي بيعيد كتابة كل الجداول (بما فيها آلاف
    // الطلاب) مرتين في نفس العملية — وده اللي كان بيسبب التجمّد/الريفرش المفاجئ.
    if (attendanceChanged) db.save('attendance');
    if (paymentsChanged) db.save('payments');
    if (!attendanceChanged && !paymentsChanged) db.save('payments'); // لضمان حفظ أي تغييرات في الإعدادات (مثل بدء دورة جديدة)
    // Don't close if we just wanted to mark both and see updated state
    // but for search results, we want to stay open, so we handle modal elsewhere if needed.
    // However, for consistency with 'attendance' which is now called from search:
    if (action !== 'attendance') {
        toggleModal('smart-card-modal', false);
    }

    // Refresh UI
    renderQuickAttendance();
    updateDashboardStats();
    if (document.getElementById('payments-section').style.display === 'block') {
        renderFinances();
    }

    // If a new monthly payment was just registered, offer to print a receipt
    if (typeof quickActionPaymentId !== 'undefined' && quickActionPaymentId) {
        const paymentIdToprint = quickActionPaymentId;
        quickActionPaymentId = null;
        showReceiptSelectionModal(paymentIdToprint);
    }
}


// Helper for legacy payment flow
function handleSmartCardPayment(studentId) {
    toggleMonthlyPayment(studentId); // Assuming collectMonthlyPayment is the function to handle payment
    openSmartCard(studentId); // Refresh card to show updated payment status
}

function viewDetailedProfile(id) {
    const s = db.students.find(x => x.id === id);
    if (!s) return;

    const group = db.groups.find(g => g.id == s.groupId);
    document.getElementById('prof-avatar-char').innerText = s.name.charAt(0);
    document.getElementById('prof-name').innerText = s.name;
    const jDateRaw = s.joinDate || s.id; // Use id as fallback for old records
    const jDateObj = new Date(jDateRaw);
    const jDateStr = jDateObj.toLocaleDateString('ar-EG');
    document.getElementById('prof-info').innerText = `المجموعة: ${group ? group.name : '---'} | هاتف: ${s.phone} | انضم في: ${jDateStr}`;

    const atts = db.attendance.filter(a => a.studentId == s.id).reverse();
    const marks = db.scores.filter(sc => sc.studentId == s.id).reverse();
    const payments = db.payments.filter(p => p.studentId == s.id).reverse();

    // 1. Calculate General Attendance
    document.getElementById('prof-attendance').innerText = atts.filter(a => a.status === 'present').length;
    document.getElementById('prof-points').innerText = s.points;

    // 2. Calculate Exam Stats (Since Registration)
    // Filter exams for this grade and after joining
    const studentJoinTimestamp = jDateObj.getTime();
    const relevantExams = db.exams.filter(e => e.grade == s.grade && e.id >= (studentJoinTimestamp - 86400000));
    const examsAttended = marks.length;
    const examsMissed = Math.max(0, relevantExams.length - examsAttended);

    const attendedEl = document.getElementById('prof-exams-attended');
    const totalEl = document.getElementById('prof-exams-total');
    const missedEl = document.getElementById('prof-exams-missed');

    if (attendedEl) attendedEl.innerText = examsAttended;
    if (totalEl) totalEl.innerText = relevantExams.length;
    if (missedEl) missedEl.innerText = examsMissed;

    // Attendance Log
    const attLog = document.getElementById('prof-attendance-log');
    attLog.innerHTML = atts.map(a => {
        const d = new Date(a.date);
        const statusText = a.status === 'present' ? 'حاضر' : (a.status === 'absent' ? 'غائب' : 'تأخير');
        const statusColor = a.status === 'present' ? 'var(--accent)' : 'var(--danger)';
        return `<tr>
            <td>${d.toLocaleDateString('ar-EG')}</td>
            <td>${d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</td>
            <td><span style="color:${statusColor}; font-weight:bold;">${statusText}</span></td>
        </tr>`;
    }).join('') || '<tr><td colspan="3" style="text-align:center; padding:1rem;">لا يوجد سجل حضور</td></tr>';

    // Payment Log
    const payLog = document.getElementById('prof-payment-log');
    payLog.innerHTML = payments.map(p => `<tr>
        <td>${p.category || 'اشتراك'}</td>
        <td>${new Date(p.date).toLocaleDateString('ar-EG')}</td>
        <td>${p.amount ? p.amount + ' ج.م' : 'تم السداد'}</td>
    </tr>`).join('') || '<tr><td colspan="3" style="text-align:center; padding:1rem;">لا يوجد سجل مدفوعات</td></tr>';

    const avg = marks.length > 0
        ? Math.round(marks.reduce((sum, m) => sum + (m.mark / (db.exams.find(e => e.id === m.examId)?.maxMarks || 100)) * 100, 0) / marks.length)
        : 0;
    document.getElementById('prof-avg-mark').innerText = `${avg}%`;

    const sList = document.getElementById('prof-scores-list');
    sList.innerHTML = marks.map(m => {
        const ex = db.exams.find(e => e.id === m.examId);
        return `<li style="padding:0.75rem; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between;">
            <strong>${ex ? ex.title : 'امتحان'}</strong>
            <span style="font-weight:700; color:var(--primary);">${m.mark} / ${ex ? ex.maxMarks : '-'}</span>
        </li>`;
    }).join('') || '<li>لا يوجد سجل امتحانات</li>';

    const hList = document.getElementById('prof-handouts-list');
    hList.innerHTML = db.studentHandouts.filter(sh => sh.studentId == s.id).map(sh => {
        const h = db.handouts.find(x => x.id === sh.handoutId);
        return `<li style="padding:0.5rem; border-bottom:1px solid #eee;"><i class="fas fa-check-circle" style="color:var(--accent)"></i> ${h ? h.title : 'ملزمة'}</li>`;
    }).join('') || '<li>لم يستلم ملازم بعد</li>';

    const analysis = analyzeStudent(s.id);
    const aiReport = document.getElementById('prof-ai-report');
    if (aiReport) {
        aiReport.innerHTML = `
            <div style="padding:10px; border-radius:8px; border-right:4px solid ${analysis.riskColor}; background:white; margin-bottom:10px;">
                <strong>مستوى الخطر:</strong> <span style="color:${analysis.riskColor}">${analysis.riskLevel} (${Math.round(analysis.riskScore)}%)</span><br>
                <strong>توقعات الحضور:</strong> ${analysis.gapSessions > 0 ? `غائب لـ ${analysis.gapSessions} حصص متتالية` : 'ملتزم بالحضور'}<br>
                <strong>التوجه الأكاديمي:</strong> ${analysis.academicTrend === 'IMPROVING' ? '🚀 في تحسن' : (analysis.academicTrend === 'DECLINING' ? '⚠️ تراجع في المستوى' : 'مستوى ثابت')}<br>
            </div>
            <div style="background:var(--primary); color:white; padding:10px; border-radius:8px; font-size:0.9rem;">
                <i class="fas fa-lightbulb"></i> <strong>توصية AI:</strong> ${analysis.recommendation}
            </div>
        `;
    }

    toggleModal('profile-modal', true);
}

// ──────────────────────────────────────────────────────────────
//  QR Code بطاقة الطالب — يفتح ملف الطالب مباشرة عند المسح
// ──────────────────────────────────────────────────────────────
let _currentQRStudentId = null;

function showStudentQR(id) {
    const s = db.students.find(x => x.id === id);
    if (!s) return;
    _currentQRStudentId = id;

    const group = db.groups.find(g => g.id == s.groupId);

    // بناء الـ URL الخاص بالطالب: student-report.html في نفس المجلد + ?student=ID
    const baseDir = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
    const studentUrl = `${baseDir}student-report.html?student=${id}`;

    // تحديث بيانات الـ Modal
    document.getElementById('qr-modal-student-name').textContent = s.name;
    document.getElementById('qr-modal-student-info').textContent =
        `${group ? group.name : '---'}  •  ${s.phone || '---'}`;
    document.getElementById('qr-modal-code-text').textContent = studentUrl.length > 60
        ? studentUrl.slice(0, 57) + '...' : studentUrl;

    // تنظيف QR container وإعادة الرسم
    const container = document.getElementById('student-qr-container');
    container.innerHTML = '<div style="color:var(--text-muted);"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

    toggleModal('student-qr-modal', true);

    // رسم الـ QR Code بعد فتح الـ Modal
    setTimeout(() => {
        container.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
            new QRCode(container, {
                text: studentUrl,
                width: 200,
                height: 200,
                colorDark: '#1e293b',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        } else {
            // Fallback: QR عبر Google Charts API
            const img = document.createElement('img');
            img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(studentUrl)}&color=1e293b&bgcolor=ffffff&qzone=1`;
            img.alt = 'QR Code';
            img.style = 'width:200px; height:200px; border-radius:8px;';
            container.appendChild(img);
        }
    }, 150);
}

function printStudentQRCard() {
    const s = db.students.find(x => x.id === _currentQRStudentId);
    if (!s) return;

    const group = db.groups.find(g => g.id == s.groupId);
    const baseDir = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
    const studentUrl = `${baseDir}student-report.html?student=${s.id}`;
    const qrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(studentUrl)}&color=1e293b&bgcolor=ffffff&qzone=2`;

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html dir="rtl"><head>
        <meta charset="UTF-8">
        <title>بطاقة QR - ${s.name}</title>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family: 'Segoe UI', Tahoma, sans-serif; background:#f1f5f9; display:flex; justify-content:center; align-items:center; min-height:100vh; }
            .card { background:white; border-radius:20px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.12); width:320px; }
            .card-header { background:linear-gradient(135deg,#0f4c81,#0ea5e9); color:white; padding:1.5rem; text-align:center; }
            .card-header h2 { font-size:1.2rem; margin-bottom:0.2rem; }
            .card-header p { opacity:.85; font-size:0.8rem; }
            .card-body { padding:1.5rem; text-align:center; }
            .card-body img { border-radius:12px; border:3px solid #e2e8f0; }
            .student-url { font-size:0.65rem; color:#64748b; margin-top:0.8rem; word-break:break-all; direction:ltr; }
            .group-badge { display:inline-block; background:#f1f5f9; border-radius:20px; padding:0.3rem 0.8rem; font-size:0.8rem; color:#0f4c81; font-weight:700; margin-top:0.6rem; }
            @media print { body { background:white; } .card { box-shadow:none; } }
        </style>
    </head><body>
        <div class="card">
            <div class="card-header">
                <h2>${s.name}</h2>
                <p>بطاقة الطالب الرقمية</p>
            </div>
            <div class="card-body">
                <img src="${qrImgSrc}" width="200" height="200" alt="QR Code">
                <div class="group-badge">📚 ${group ? group.name : '---'}</div>
                <p class="student-url">${studentUrl}</p>
                <p style="font-size:0.75rem; color:#94a3b8; margin-top:0.5rem;">امسح الكود لفتح ملف الطالب</p>
            </div>
        </div>
        <script>window.onload = () => setTimeout(() => window.print(), 500);<\/script>
    </body></html>`);
    win.document.close();
}

function downloadStudentQR() {
    const s = db.students.find(x => x.id === _currentQRStudentId);
    if (!s) return;

    const baseUrl = window.location.origin + window.location.pathname;
    const studentUrl = `${baseUrl}?student=${s.id}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(studentUrl)}&color=1e293b&bgcolor=ffffff&qzone=2`;

    const a = document.createElement('a');
    a.href = qrApiUrl;
    a.download = `QR_${s.name.replace(/\s+/g, '_')}.png`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showNotification('📥 جاري تحميل QR Code...', 'info');
}

function sendStudentQRWhatsApp(type) {
    const s = db.students.find(x => x.id === _currentQRStudentId);
    if (!s) return showNotification('لم يتم العثور على بيانات الطالب', 'error');

    const phone = type === 'parent' ? (s.parentPhone || s.phone) : s.phone;
    const recipientLabel = type === 'parent' ? 'ولي الأمر' : 'الطالب';

    if (!phone) {
        return showNotification(`رقم ${recipientLabel} غير مسجل لهذا الطالب`, 'warning');
    }

    const baseDir = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
    const studentUrl = `${baseDir}student-report.html?student=${s.id}`;

    const profile = typeof getProgramProfile === 'function' ? getProgramProfile() : {};
    const teacherName = typeof getTeacherDisplayName === 'function' ? getTeacherDisplayName() : 'أستاذ المادة';
    const spec = profile.specialization || 'أستاذ الرياضيات';

    let msg = '';
    if (typeof buildFormalParentMessage === 'function') {
        msg = buildFormalParentMessage({
            noticeType: `رابط التقرير المباشر للطالب/ـة ${s.name}`,
            bodyLines: [
`رابط التقرير الشخصي المباشر لمتابعة الحضور والغياب ودرجات الامتحانات والاشتراكات:

📌 ${studentUrl}`
            ]
        });
    } else {
        msg = `السلام عليكم ورحمة الله وبركاته،\n\nرابط التقرير الشخصي المباشر للطالب/ـة: *${s.name}*\n${studentUrl}`;
    }

    const cleanPhone = String(phone).replace(/\D/g, '').replace(/^0/, '');
    const fullPhone  = cleanPhone.startsWith('20') ? cleanPhone : `20${cleanPhone}`;
    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}



function showNotification(msg, type = 'success', duration = 4000) {
    const n = document.createElement('div');
    n.className = 'fade-in';
    const palette = {
        success: { bg: 'var(--accent)', icon: 'fa-check-circle' },
        warning: { bg: 'var(--warning)', icon: 'fa-exclamation-triangle' },
        error: { bg: 'var(--danger)', icon: 'fa-times-circle' },
        info: { bg: 'var(--primary)', icon: 'fa-info-circle' }
    };
    const state = palette[type] || palette.success;
    n.style = `position:fixed; bottom:30px; left:30px; max-width:min(420px, calc(100vw - 40px)); background:${state.bg}; color:#fff; padding:1rem 1.4rem; border-radius:8px; z-index:10000; box-shadow:0 16px 35px rgba(16,32,51,0.22); font-weight:700; line-height:1.6; display:flex; align-items:center; gap:0.7rem;`;
    n.innerHTML = `<i class="fas ${state.icon}"></i> <span>${msg}</span>`;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), duration);
}

function toggleModal(id, show) {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? 'flex' : 'none';
}

function generatePrintCard(id) {
    const s = db.students.find(x => x.id === id);
    if (!s) return;

    // Store active student ID for thermal printing
    document.getElementById('print-modal').dataset.studentId = id;

    // Fetch the actual grade name instead of ID
    const gradeObj = gradesList.find(g => String(g.id) === String(s.grade));
    const gradeName = gradeObj ? gradeObj.name : 'طالب';

    document.getElementById('print-name').innerText = s.name;
    document.getElementById('print-grade').innerText = gradeName;
    document.getElementById('print-code-text').innerText = s.qrCode;
    setTimeout(() => {
        JsBarcode("#barcode-canvas", s.qrCode, {
            format: "EAN13",
            width: 2.5,
            height: 80,
            displayValue: true,
            fontSize: 22,
            flat: true,
            margin: 10,
            background: "#ffffff",
            lineColor: "#000000"
        });
    }, 200);
    toggleModal('print-modal', true);
}

function printCurrentCardThermal() {
    const studentId = document.getElementById('print-modal').dataset.studentId;
    if (!studentId) return;
    const student = db.students.find(s => String(s.id) === String(studentId));
    const thermalWidth = document.getElementById('thermal-width-select')?.value || '80mm';
    if (student) generatePrintableIDCards([student], 'thermal', thermalWidth);
}

// Focus navigation using Enter key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
        const form = e.target.closest('.modal-content') || e.target.closest('.card') || document.body;
        const focusable = Array.from(form.querySelectorAll('input, select, textarea')).filter(el => {
            return !el.disabled && el.style.display !== 'none' && el.type !== 'hidden';
        });

        const index = focusable.indexOf(e.target);
        if (index > -1 && index < focusable.length - 1) {
            e.preventDefault();
            focusable[index + 1].focus();
            if (focusable[index + 1].select) focusable[index + 1].select();
        }
    }
});
// --- Lesson Coding Session Functions ---
function startLessonCoding() {
    // ── guard: لازم يكون فيه مجموعة وصف محددين ──────────────
    if (!currentGroupId || !currentGrade) {
        showNotification('⚠️ يرجى اختيار الصف والمجموعة أولاً قبل بدء التشفير', 'error');
        return;
    }

    // ── بدء جلسة معزولة للمجموعة الحالية فقط ────────────────
    SessionManager.start();

    document.getElementById('start-session-btn').style.display = 'none';
    const jointBtn = document.getElementById('start-joint-session-btn');
    if (jointBtn) jointBtn.style.display = 'none';
    document.getElementById('pause-session-btn').style.display = 'inline-flex';
    document.getElementById('resume-session-btn').style.display = 'none';
    document.getElementById('end-session-btn').style.display = 'inline-flex';
    document.getElementById('session-status-badge').style.display = 'block';
    document.getElementById('current-session-container').style.display = 'block';

    renderSessionTable();
    showNotification('تم بدء جلسة تشفير الحصة بنجاح 🚀', 'success');
}

function pauseLessonCoding() {
    SessionManager.pause();
    document.getElementById('pause-session-btn').style.display = 'none';
    document.getElementById('resume-session-btn').style.display = 'inline-flex';
    document.getElementById('session-status-badge').innerHTML = `
        <span class="status-badge" style="background: rgba(245, 158, 11, 0.2); color: var(--warning); padding: 0.5rem 1.5rem; font-size: 1rem;">
            <i class="fas fa-pause-circle" style="font-size: 0.7rem; margin-left: 5px;"></i> التشفير متوقف مؤقتاً...
        </span>`;
    showNotification('تم إيقاف التشفير مؤقتاً ⏸️');
}

function resumeLessonCoding() {
    SessionManager.resume();
    document.getElementById('pause-session-btn').style.display = 'inline-flex';
    document.getElementById('resume-session-btn').style.display = 'none';
    document.getElementById('session-status-badge').innerHTML = `
        <span class="status-badge" style="background: rgba(16, 185, 129, 0.2); color: var(--accent); padding: 0.5rem 1.5rem; font-size: 1rem;">
            <i class="fas fa-circle" style="font-size: 0.7rem; margin-left: 5px;"></i> جلسة تشفير نشطة الآن...
        </span>`;
    showNotification('تم استئناف تشفير الحصة 🚀');
}

function renderSessionTable() {
    const list = document.getElementById('session-attendance-list');
    const count = document.getElementById('session-count');
    if (!list) return;

    // ── اقرأ الحضور من SessionManager دائماً (مش من الـ global) ──
    const sessionAtt = SessionManager.attendance();
    currentSessionAttendance = sessionAtt; // مزامنة الـ global

    // Show Stats Grid if session active or list has items
    const statsGrid = document.getElementById('session-stats-grid');
    if (statsGrid) statsGrid.style.display = sessionAtt.length > 0 ? 'grid' : 'none';

    // Calculate Stats
    const total = sessionAtt.length;
    let paidCount = 0;
    let totalMoney = 0;

    sessionAtt.forEach(s => {
        const hasPaid = db.payments.some(p =>
            p.studentId == s.id &&
            p.category === 'اشتراك شهري' &&
            p.cycleId == db.settings.activeCycle
        );
        if (hasPaid) {
            paidCount++;
            totalMoney += db.settings.monthlyFee;
        }
    });

    // Update Stats Display
    if (count) count.innerText = total;
    if (document.getElementById('stat-session-total')) document.getElementById('stat-session-total').innerText = total;
    if (document.getElementById('stat-session-paid')) document.getElementById('stat-session-paid').innerText = paidCount;
    if (document.getElementById('stat-session-money')) document.getElementById('stat-session-money').innerHTML = `${totalMoney} <small>ج.م</small>`;

    list.innerHTML = sessionAtt.map((s, index) => `
        <tr class="fade-in">
            <td><strong>${s.name}</strong></td>
            <td>${new Date(s.scanTime).toLocaleTimeString('ar-EG')}</td>
            <td style="text-align:center;">
                <div style="display:flex; gap:5px; justify-content:center;">
                    <button class="btn" style="background:var(--bg-light); color:var(--primary); padding:5px 12px; font-size:0.8rem;" onclick="openSmartCard(${s.id})">
                        <i class="fas fa-id-card"></i>
                    </button>
                    <button class="btn" style="color:var(--danger); padding:5px;" onclick="removeFromSession(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="3" style="text-align:center; padding:2rem;">لا يوجد طلاب في جلسة التشفير</td></tr>';

    // ── قائمة الغياب — عزل صارم بالـ grade + group ─────────────
    const absenceList = document.getElementById('session-absence-list');
    const absenceCount = document.getElementById('session-absence-count');
    if (absenceList) {
        const rawId = activePortalGroupId || currentGroupId;

        // guard: لو مفيش grade أو group → قائمة فارغة
        if (!rawId || !currentGrade) {
            absenceList.innerHTML = '';
            if (absenceCount) absenceCount.innerText = '0';
        } else {
            let allowedGroupIds = [];
            if (String(rawId).startsWith('joint:')) {
                allowedGroupIds = rawId.split(':')[1].split(',');
            } else {
                allowedGroupIds = [String(rawId)];
            }

            // presentIds من SessionManager مباشرة
            const presentIds = SessionManager.attendance().map(s => s.id);

            // ── double-filter: grade صارم + group صارم ──────────
            const absentees = db.students.filter(s =>
                String(s.grade)   === String(currentGrade) &&
                allowedGroupIds.includes(String(s.groupId)) &&
                !presentIds.includes(s.id)
            );

            if (absenceCount) absenceCount.innerText = absentees.length;

            absenceList.innerHTML = absentees.map(s => {
                const group = db.groups.find(g => String(g.id) === String(s.groupId));
                return `
                    <tr>
                        <td><strong>${s.name}</strong></td>
                        <td>${group ? group.name : '---'}</td>
                        <td style="text-align:center;">
                            <div style="display:flex; gap:5px; justify-content:center;">
                                <button class="btn" style="background:var(--bg-light); color:var(--accent); padding:5px 12px; font-size:0.8rem;" onclick="processScan('${s.qrCode}')">
                                    <i class="fas fa-check"></i> تحضير يدوي
                                </button>
                                <button class="btn" style="background:rgba(37, 211, 102, 0.1); color:#25D366; padding:5px 12px; font-size:0.8rem;" title="إرسال إخطار غياب" onclick="sendAbsenceWhatsApp(${s.id})">
                                    <i class="fab fa-whatsapp"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('') || '<tr><td colspan="3" style="text-align:center; padding:2rem; color:var(--accent);">تم حضور جميع طلاب المجموعة! 🎉</td></tr>';
        }
    }
}

function printSessionAbsence() {
    const activeGroup = activePortalGroupId || currentGroupId;
    const groupObj = db.groups.find(g => g.id == activeGroup);
    const presentIds = currentSessionAttendance.map(s => s.id);
    const absentees = db.students.filter(s =>
        String(s.grade) === String(currentGrade) &&
        String(s.groupId) === String(activeGroup) &&
        !presentIds.includes(s.id)
    );

    let html = `
        <div style="direction:rtl; font-family:Arial; padding:40px;">
            <h2 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">كشف غياب الطلاب - ${groupObj ? groupObj.name : ''}</h2>
            <p style="text-align:center;">التاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
            <table style="width:100%; border-collapse:collapse; margin-top:30px;">
                <thead>
                    <tr style="background:#eee;">
                        <th style="border:1px solid #000; padding:10px;">م</th>
                        <th style="border:1px solid #000; padding:10px;">اسم الطالب</th>
                        <th style="border:1px solid #000; padding:10px;">تليفون ولي الأمر</th>
                        <th style="border:1px solid #000; padding:10px;">ملاحظات</th>
                    </tr>
                </thead>
                <tbody>
                    ${absentees.map((s, i) => `
                        <tr>
                            <td style="border:1px solid #000; padding:10px; text-align:center;">${i + 1}</td>
                            <td style="border:1px solid #000; padding:10px;">${s.name}</td>
                            <td style="border:1px solid #000; padding:10px; text-align:center;">${s.parentPhone || '---'}</td>
                            <td style="border:1px solid #000; padding:10px; width:150px;"></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    const win = window.open('', '', 'width=900,height=700');
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
        win.print();
        win.close();
    }, 500);
}

function removeFromSession(index) {
    const student = currentSessionAttendance[index];
    if (!student) return;

    if (student) {
        // Find and remove matching attendance today to stay in sync
        db.attendance = db.attendance.filter(a => !(
            a.studentId == student.id &&
            new Date(a.date).toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA') &&
            a.status === 'present'
        ));
    }

    SessionManager.removeStudent(student.id);
    currentSessionAttendance = SessionManager.attendance();
    db.currentSessionAttendance = currentSessionAttendance; // Persistent sync
    db.save();

    renderSessionTable();
    // Also update Absence report to reflect removal
    if (document.getElementById('absence-section').style.display === 'block') {
        generateAbsenceReport();
    }
}

function endLessonCoding() {
    // ── 1. تأكيد الإنهاء — السؤال الوحيد اللي بيوقف العملية ──
    const attCount = currentSessionAttendance.length;
    const confirmMsg = attCount === 0
        ? 'قائمة التشفير فارغة، هل تريد إنهاء الجلسة؟'
        : `سيتم ترحيل حضور ${attCount} طالب وإغلاق الجلسة، هل أنت متأكد؟`;

    if (!confirm(confirmMsg)) return;

    // ── من هنا: الجلسة تنتهي بكل الأحوال — لا return بعد الآن ──

    const today       = new Date().toLocaleDateString('en-CA');
    const activeGrade = currentGrade || localStorage.getItem('edu_active_grade');
    const rawId       = activePortalGroupId || currentGroupId;

    let allowedGroupIds  = [];
    let groupDisplayName = '';

    if (rawId && String(rawId).startsWith('joint:')) {
        allowedGroupIds  = rawId.split(':')[1].split(',');
        groupDisplayName = 'اليوم الجماعي';
    } else if (rawId) {
        allowedGroupIds  = [String(rawId)];
        const groupObj   = db.groups.find(g => String(g.id) === String(rawId));
        groupDisplayName = groupObj ? groupObj.name : 'هذه المجموعة';
    }

    // ── 2. تسجيل غياب باقي الطلاب (اختياري) ───────────────────
    if (allowedGroupIds.length > 0) {
        const wantAbsent = confirm(`هل تريد تسجيل غياب باقي طلاب (${groupDisplayName}) تلقائياً؟`);
        if (wantAbsent) {
            const recordedIdsForToday = db.attendance
                .filter(a => new Date(a.date).toLocaleDateString('en-CA') === today)
                .map(a => a.studentId);

            const absentees = db.students.filter(s =>
                String(s.grade) === String(activeGrade) &&
                allowedGroupIds.includes(String(s.groupId)) &&
                !recordedIdsForToday.includes(s.id)
            );

            absentees.forEach((s, idx) => {
                db.attendance.push({
                    id:        Date.now() + idx + 1,
                    studentId: s.id,
                    groupId:   s.groupId,
                    date:      new Date().toISOString(),
                    status:    'absent'
                });
                addToQueue(s.id, 'absence');
            });
            if (absentees.length > 0)
                showNotification(`تم تسجيل غياب ${absentees.length} طالب`, 'warning');
        }

        // ── 3. أرشفة الجلسة (اختياري) ──────────────────────────
        const wantArchive = confirm('هل تريد أرشفة سجل حضور وغياب هذه الحصة للرجوع إليه لاحقاً؟');
        if (wantArchive) {
            archiveAbsenceSession();
        }
    }

    // ── 4. حفظ البيانات ─────────────────────────────────────────
    db.save();

    // ── 5. إنهاء الجلسة (دائماً) ────────────────────────────────
    SessionManager.end();
    activePortalGroupId  = null;
    activePortalGroupIds = [];

    // ── 6. إعادة ضبط الـ UI (دائماً) ───────────────────────────
    renderSessionTable();

    const startBtn  = document.getElementById('start-session-btn');
    const jointBtn  = document.getElementById('start-joint-session-btn');
    const pauseBtn  = document.getElementById('pause-session-btn');
    const resumeBtn = document.getElementById('resume-session-btn');
    const endBtn    = document.getElementById('end-session-btn');
    const badge     = document.getElementById('session-status-badge');
    const container = document.getElementById('current-session-container');

    if (startBtn)  startBtn.style.display  = 'inline-flex';
    if (jointBtn)  jointBtn.style.display  = 'inline-flex';
    if (pauseBtn)  pauseBtn.style.display  = 'none';
    if (resumeBtn) resumeBtn.style.display = 'none';
    if (endBtn)    endBtn.style.display    = 'none';
    if (badge)     badge.style.display     = 'none';
    if (container) container.style.display = 'none';

    renderQuickAttendance();
    updateDashboardStats();
    showNotification('✅ تم إنهاء التشفير وحفظ البيانات بنجاح');
}

function stopQRScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('reader').style.display = 'none';
        }).catch(err => console.error("Error stopping scanner:", err));
    }
}

// --- Audio and Voice Helpers ---
function playSound(type) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1320, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    } else {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(110, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    }

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
}

function speakName(name) {
    if (!document.getElementById('voice-feedback-toggle').checked) return;
    const msg = new SpeechSynthesisUtterance();
    msg.text = name;
    msg.lang = 'ar-SA';
    msg.rate = 0.9;
    window.speechSynthesis.speak(msg);
}

// --- Print Functions ---

/**
 * يجمع بيانات تحصيل اليوم لجلسة الخزنة الحالية فقط (نفس البيانات المعروضة
 * في شاشة "الخزنة اليومية") — معزولة بالصف والمجموعة الحاليين + حدود
 * الجلسة (بعد آخر تصفير للعهدة، إن وجد).
 */
function _getTodaysTreasurySessionData() {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const sessionResetTime = (db.settings.treasurySessionResetTime && db.settings.treasurySessionResetTime[todayStr]) || 0;

    const todayPayments = db.payments.filter(p => {
        const pDate = new Date(p.date).toLocaleDateString('en-CA');
        if (pDate !== todayStr) return false;
        const student = db.students.find(s => s.id === p.studentId);
        if (!student || String(student.grade) !== String(currentGrade) || String(student.groupId) !== String(currentGroupId)) return false;
        return p.id > sessionResetTime;
    });

    const todayExpenses = db.expenses.filter(e => {
        const eDate = new Date(e.date || e.id).toLocaleDateString('en-CA');
        if (eDate !== todayStr) return false;
        if (String(e.grade || currentGrade) !== String(currentGrade) || String(e.groupId) !== String(currentGroupId)) return false;
        return e.id > sessionResetTime;
    });

    let totalSub = 0, totalMisc = 0;
    todayPayments.forEach(p => {
        if (p.category === 'اشتراك شهري') totalSub += p.amount;
        else totalMisc += p.amount;
    });
    const totalExpenses = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

    return { todayStr, todayPayments, todayExpenses, totalSub, totalMisc, totalExpenses };
}

/**
 * يفتح نافذة معاينة/طباعة لكشف تحصيل اليوم (الخزنة اليومية) لنفس الصف
 * والمجموعة المفتوحين حالياً — هذه هي الدالة التي يستدعيها زر
 * "طباعة كشف التحصيل اليومي" في شاشة الخزنة اليومية.
 */
function showPrintDailyOptions() {
    // ── نافذة اختيار نطاق الطباعة ──────────────────────────────────
    // نُنشئ modal بسيطاً داخل الصفحة بدل confirm()
    const existingModal = document.getElementById('print-daily-choice-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'print-daily-choice-modal';
    modal.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:99999;
        display:flex; align-items:center; justify-content:center;
    `;
    modal.innerHTML = `
        <div style="
            background:#fff; border-radius:20px; padding:2rem 2.5rem; max-width:420px; width:90%;
            box-shadow:0 24px 80px rgba(0,0,0,0.25); text-align:center; direction:rtl; font-family:'Cairo',sans-serif;
        ">
            <div style="font-size:2.2rem; margin-bottom:.5rem;">🖨️</div>
            <h3 style="margin:0 0 .4rem; font-size:1.2rem; color:#1e293b; font-weight:900;">طباعة كشف التحصيل اليومي</h3>
            <p style="color:#64748b; font-size:.9rem; margin-bottom:1.5rem;">اختر نطاق الطباعة:</p>
            <div style="display:flex; flex-direction:column; gap:.85rem;">
                <button id="print-choice-current" style="
                    background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; border:none;
                    border-radius:12px; padding:.85rem 1.2rem; font-size:1rem; font-weight:700;
                    cursor:pointer; font-family:'Cairo',sans-serif; transition:opacity .2s;
                " onmouseover="this.style.opacity='.88'" onmouseout="this.style.opacity='1'">
                    <i class="fas fa-layer-group" style="margin-left:.5rem;"></i> المجموعة الحالية فقط
                </button>
                <button id="print-choice-all" style="
                    background:linear-gradient(135deg,#0ea5e9,#0284c7); color:#fff; border:none;
                    border-radius:12px; padding:.85rem 1.2rem; font-size:1rem; font-weight:700;
                    cursor:pointer; font-family:'Cairo',sans-serif; transition:opacity .2s;
                " onmouseover="this.style.opacity='.88'" onmouseout="this.style.opacity='1'">
                    <i class="fas fa-print" style="margin-left:.5rem;"></i> جميع المجموعات
                </button>
                <button id="print-choice-cancel" style="
                    background:#f1f5f9; color:#64748b; border:none; border-radius:12px;
                    padding:.65rem 1rem; font-size:.9rem; cursor:pointer; font-family:'Cairo',sans-serif;
                ">إلغاء</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('print-choice-cancel').onclick = () => modal.remove();
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    document.getElementById('print-choice-current').onclick = () => {
        modal.remove();
        _printDailyTreasuryCurrentGroup();
    };
    document.getElementById('print-choice-all').onclick = () => {
        modal.remove();
        _printDailyTreasuryAllGroups();
    };
}

// ── طباعة كشف المجموعة الحالية فقط (الكود الأصلي) ──────────────────
function _printDailyTreasuryCurrentGroup() {
    const { todayStr, todayPayments, todayExpenses, totalSub, totalMisc, totalExpenses } = _getTodaysTreasurySessionData();
    const netTotal = totalSub + totalMisc - totalExpenses;

    const todayStrAr = new Date(todayStr).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const groupObj = db.groups.find(g => String(g.id) === String(currentGroupId));
    const gradeObj = (typeof gradesList !== 'undefined') ? gradesList.find(g => String(g.id) === String(currentGrade)) : null;
    const profile = (typeof getProgramProfile === 'function') ? getProgramProfile() : { teacherName: 'نظام إدارة الدروس', centerName: 'نظام إدارة الدروس' };

    const paymentsRows = todayPayments.map((p, i) => {
        const student = db.students.find(s => s.id === p.studentId);
        return `
            <tr style="${i % 2 === 0 ? 'background:#fafafa;' : ''}">
                <td style="padding:10px 14px; font-weight:700; color:#1e293b;">${student ? student.name : 'طالب مجهول'}</td>
                <td style="padding:10px 14px; color:#64748b;">${p.category}${p.collectedBy ? `<br><span style="font-size:.72rem; color:#94a3b8;">بواسطة: ${p.collectedBy}</span>` : ''}</td>
                <td style="padding:10px 14px; text-align:center; font-weight:800; color:#10b981;">${p.amount} ج.م</td>
                <td style="padding:10px 14px; text-align:center; color:#94a3b8; font-size:0.82rem;">${new Date(p.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</td>
            </tr>`;
    }).join('');

    const expensesRows = todayExpenses.map(e => `
        <tr style="background:#fff5f5;">
            <td style="padding:10px 14px; font-weight:700; color:#ef4444;">↳ ${e.title}</td>
            <td style="padding:10px 14px; color:#94a3b8;">مصروف</td>
            <td style="padding:10px 14px; text-align:center; font-weight:800; color:#ef4444;">-${e.amount} ج.م</td>
            <td style="padding:10px 14px; text-align:center; color:#94a3b8;">—</td>
        </tr>`).join('');

    const emptyRow = (todayPayments.length === 0 && todayExpenses.length === 0)
        ? '<tr><td colspan="4" style="text-align:center; padding:2rem; color:#94a3b8;">لا توجد تحصيلات في هذه الجلسة حتى الآن</td></tr>'
        : '';

    const printWindow = window.open('', '_blank', 'width=750,height=900');
    if (!printWindow) {
        showNotification('يرجى السماح بفتح النوافذ المنبثقة (Popups) لطباعة الكشف', 'error');
        return;
    }

    printWindow.document.write(`<!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>كشف تحصيل اليوم - ${todayStrAr}</title>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body { font-family:'Cairo', sans-serif; direction:rtl; background:#fff; color:#1e293b; padding: 30px; }
                .header { text-align:center; background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; padding: 1.6rem 2rem; border-radius: 16px; margin-bottom: 1.5rem; }
                .header h1 { font-size: 1.6rem; font-weight: 900; }
                .header p { margin-top: 4px; opacity: 0.9; font-size: 0.95rem; }
                .summary { display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
                .summary-item { text-align:center; padding: 1rem; border-radius: 14px; border-bottom: 4px solid #cbd5e1; background:#f8fafc; }
                .summary-item span { display:block; font-size: 0.8rem; color:#64748b; margin-bottom: 4px; }
                .summary-item strong { font-size: 1.4rem; }
                .net-box { margin-bottom: 1.5rem; background: linear-gradient(135deg,#4f46e5,#7c3aed); border-radius: 14px; padding: 1rem 1.5rem; color:#fff; display:flex; justify-content:space-between; align-items:center; }
                .net-box span { font-size: 0.9rem; opacity: 0.85; }
                .net-box strong { font-size: 1.8rem; }
                table { width:100%; border-collapse:collapse; font-size: 0.88rem; border:1px solid #e5e7eb; border-radius: 12px; overflow:hidden; }
                th, td { border:1px solid #e5e7eb; }
                th { background:#f1f5f9; color:#475569; font-weight:700; padding:10px 14px; text-align:right; }
                .footer { margin-top: 2rem; text-align:left; font-size:0.78rem; color:#94a3b8; }
                @page { margin: 1.2cm; size: A4; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>💰 كشف تحصيل اليوم</h1>
                <p>${profile.centerName || 'سنتر العباقرة'}</p>
                <p>${todayStrAr}</p>
                <p>${gradeObj ? gradeObj.name : ''}${groupObj ? ' — ' + groupObj.name : ''}</p>
            </div>

            <div class="summary">
                <div class="summary-item" style="border-color:#10b981;">
                    <span>اشتراكات شهرية</span>
                    <strong style="color:#10b981;">${totalSub} ج.م</strong>
                </div>
                <div class="summary-item" style="border-color:#f59e0b;">
                    <span>ملازم / أخرى</span>
                    <strong style="color:#f59e0b;">${totalMisc} ج.م</strong>
                </div>
                <div class="summary-item" style="border-color:#ef4444;">
                    <span>مصروفات</span>
                    <strong style="color:#ef4444;">-${totalExpenses} ج.م</strong>
                </div>
            </div>

            <div class="net-box">
                <span>صافي العهدة لهذه الجلسة</span>
                <strong>${netTotal} ج.م</strong>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>اسم الطالب</th>
                        <th>البند</th>
                        <th style="text-align:center;">المبلغ</th>
                        <th style="text-align:center;">الوقت</th>
                    </tr>
                </thead>
                <tbody>
                    ${paymentsRows}
                    ${expensesRows}
                    ${emptyRow}
                </tbody>
            </table>

            <div class="footer">طبع بواسطة نظام إدارة الدروس | ${new Date().toLocaleString('ar-EG')}</div>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

// ── طباعة كشف جميع المجموعات لليوم ──────────────────────────────────
function _printDailyTreasuryAllGroups() {
    const profile = (typeof getProgramProfile === 'function') ? getProgramProfile() : { teacherName: 'نظام إدارة الدروس', centerName: 'نظام إدارة الدروس' };
    const todayStrEn = new Date().toLocaleDateString('en-CA');
    const todayStrAr = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // جمع كل مدفوعات ومصروفات اليوم
    const allTodayPayments = db.payments.filter(p =>
        new Date(p.date).toLocaleDateString('en-CA') === todayStrEn
    );
    const allTodayExpenses = (db.expenses || []).filter(e =>
        new Date(e.date).toLocaleDateString('en-CA') === todayStrEn
    );

    // تجميع المبالغ الكلية
    let grandSub = 0, grandMisc = 0, grandExp = 0;
    allTodayPayments.forEach(p => {
        if (p.category === 'اشتراك شهري') grandSub += (p.amount || 0);
        else grandMisc += (p.amount || 0);
    });
    allTodayExpenses.forEach(e => grandExp += (e.amount || 0));
    const grandNet = grandSub + grandMisc - grandExp;

    // بناء الجداول مُقسَّمة حسب المجموعة
    let groupSections = '';
    const groups = [...db.groups].sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));

    groups.forEach(group => {
        const grpPayments = allTodayPayments.filter(p => {
            const student = db.students.find(s => s.id === p.studentId);
            return student && String(student.groupId) === String(group.id);
        });
        const grpExpenses = allTodayExpenses.filter(e => String(e.groupId || '') === String(group.id));

        if (grpPayments.length === 0 && grpExpenses.length === 0) return; // لا تحصيلات لهذه المجموعة

        let grpSub = 0, grpMisc = 0, grpExp = 0;
        grpPayments.forEach(p => {
            if (p.category === 'اشتراك شهري') grpSub += (p.amount || 0);
            else grpMisc += (p.amount || 0);
        });
        grpExpenses.forEach(e => grpExp += (e.amount || 0));

        const payRows = grpPayments.map((p, i) => {
            const student = db.students.find(s => s.id === p.studentId);
            return `<tr style="${i % 2 === 0 ? 'background:#fafafa;' : ''}">
                <td style="padding:8px 12px; font-weight:700;">${student ? student.name : '—'}</td>
                <td style="padding:8px 12px; color:#64748b;">${p.category}${p.collectedBy ? `<br><span style="font-size:.72rem; color:#94a3b8;">بواسطة: ${p.collectedBy}</span>` : ''}</td>
                <td style="padding:8px 12px; text-align:center; font-weight:800; color:#10b981;">${p.amount} ج.م</td>
                <td style="padding:8px 12px; text-align:center; color:#94a3b8; font-size:.8rem;">${new Date(p.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</td>
            </tr>`;
        }).join('');

        const expRows = grpExpenses.map(e => `
            <tr style="background:#fff5f5;">
                <td style="padding:8px 12px; color:#ef4444;">↳ ${e.title}</td>
                <td style="padding:8px 12px; color:#94a3b8;">مصروف</td>
                <td style="padding:8px 12px; text-align:center; font-weight:800; color:#ef4444;">-${e.amount} ج.م</td>
                <td style="padding:8px 12px; text-align:center; color:#94a3b8;">—</td>
            </tr>`).join('');

        const grpGradeObj = (typeof gradesList !== 'undefined') ? gradesList.find(g => String(g.id) === String(group.grade)) : null;
        const gradeLabel = grpGradeObj ? grpGradeObj.name : (group.grade || '');

        groupSections += `
            <div class="group-block" style="margin-bottom:2.2rem; page-break-inside:avoid;">
                <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; padding:.7rem 1.2rem; border-radius:10px 10px 0 0; display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:1rem;">📚 ${group.name}${gradeLabel ? ' — ' + gradeLabel : ''}</strong>
                    <span style="font-size:.85rem; opacity:.9;">صافي: ${(grpSub + grpMisc - grpExp)} ج.م</span>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:.85rem; border:1px solid #e5e7eb; border-top:none;">
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="padding:8px 12px; text-align:right; color:#475569;">اسم الطالب</th>
                            <th style="padding:8px 12px; text-align:right; color:#475569;">البند</th>
                            <th style="padding:8px 12px; text-align:center; color:#475569;">المبلغ</th>
                            <th style="padding:8px 12px; text-align:center; color:#475569;">الوقت</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payRows}${expRows}
                        ${(grpPayments.length === 0 && grpExpenses.length === 0) ? '<tr><td colspan="4" style="text-align:center; padding:1rem; color:#94a3b8;">لا توجد تحصيلات</td></tr>' : ''}
                    </tbody>
                </table>
                <div style="background:#f8fafc; border:1px solid #e5e7eb; border-top:none; padding:.5rem 1.2rem; border-radius:0 0 10px 10px; display:flex; gap:1.5rem; font-size:.83rem;">
                    <span>اشتراكات: <strong style="color:#10b981;">${grpSub} ج.م</strong></span>
                    <span>أخرى: <strong style="color:#f59e0b;">${grpMisc} ج.م</strong></span>
                    ${grpExp > 0 ? `<span>مصروفات: <strong style="color:#ef4444;">-${grpExp} ج.م</strong></span>` : ''}
                </div>
            </div>`;
    });

    if (!groupSections) {
        groupSections = '<p style="text-align:center; color:#94a3b8; padding:2rem;">لا توجد تحصيلات لأي مجموعة اليوم</p>';
    }

    const printWindow = window.open('', '_blank', 'width=800,height=950');
    if (!printWindow) {
        showNotification('يرجى السماح بفتح النوافذ المنبثقة (Popups) لطباعة الكشف', 'error');
        return;
    }
    printWindow.document.write(`<!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>كشف تحصيل جميع المجموعات - ${todayStrAr}</title>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body { font-family:'Cairo',sans-serif; direction:rtl; background:#fff; color:#1e293b; padding:28px; }
                .main-header { text-align:center; background:linear-gradient(135deg,#0ea5e9,#0284c7); color:#fff; padding:1.4rem 2rem; border-radius:16px; margin-bottom:1.5rem; }
                .main-header h1 { font-size:1.5rem; font-weight:900; }
                .main-header p { margin-top:4px; opacity:.9; font-size:.92rem; }
                .grand-summary { display:grid; grid-template-columns:repeat(4,1fr); gap:.9rem; margin-bottom:1.8rem; }
                .gs-item { text-align:center; padding:.85rem; border-radius:12px; background:#f8fafc; border-bottom:4px solid #cbd5e1; }
                .gs-item span { display:block; font-size:.78rem; color:#64748b; margin-bottom:3px; }
                .footer { margin-top:1.5rem; text-align:left; font-size:.75rem; color:#94a3b8; }
                @page { margin:1.2cm; size:A4; }
            </style>
        </head>
        <body>
            <div class="main-header">
                <h1>🖨️ كشف تحصيل جميع المجموعات</h1>
                <p>${profile.centerName || 'سنتر العباقرة'}</p>
                <p>${todayStrAr}</p>
            </div>
            <div class="grand-summary">
                <div class="gs-item" style="border-color:#10b981;">
                    <span>اشتراكات شهرية</span>
                    <strong style="color:#10b981; font-size:1.3rem;">${grandSub} ج.م</strong>
                </div>
                <div class="gs-item" style="border-color:#f59e0b;">
                    <span>ملازم / أخرى</span>
                    <strong style="color:#f59e0b; font-size:1.3rem;">${grandMisc} ج.م</strong>
                </div>
                <div class="gs-item" style="border-color:#ef4444;">
                    <span>مصروفات</span>
                    <strong style="color:#ef4444; font-size:1.3rem;">-${grandExp} ج.م</strong>
                </div>
                <div class="gs-item" style="border-color:#4f46e5; background:#f5f3ff;">
                    <span style="color:#4f46e5;">الصافي الكلي</span>
                    <strong style="color:#4f46e5; font-size:1.3rem;">${grandNet} ج.م</strong>
                </div>
            </div>
            ${groupSections}
            <div class="footer">طبع بواسطة نظام إدارة الدروس | ${new Date().toLocaleString('ar-EG')}</div>
        </body>
        </html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 600);
}

function printDailyTreasuryReport() {
    const todayStrAr = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const todayStrEn = new Date().toLocaleDateString('en-CA');

    const todayPayments = db.payments.filter(p => {
        const pDate = new Date(p.date).toLocaleDateString('en-CA');
        return pDate === todayStrEn;
    });

    let totalSub = 0;
    let totalMisc = 0;
    todayPayments.forEach(p => {
        if (p.category === 'اشتراك شهري') totalSub += p.amount;
        else totalMisc += p.amount;
    });

    const rows = todayPayments.map(p => {
        const student = db.students.find(s => s.id === p.studentId);
        return `
            <tr>
                <td>${student ? student.name : '---'}</td>
                <td>${p.category}</td>
                <td>${p.amount} ج.م</td>
                <td>${new Date(p.date).toLocaleTimeString('ar-EG')}</td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="4">لا يـوجد تحصيلات اليوم</td></tr>';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <title>تقرير الخزنة اليومي - ${todayStrAr}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
                body { font-family: 'Tajawal', sans-serif; padding: 40px; color: #1e293b; }
                .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #4f46e5; padding-bottom: 20px; }
                h1 { margin: 0; color: #4f46e5; font-size: 2.2rem; }
                .summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin: 30px 0; }
                .summary-item { text-align: center; padding: 20px; background: #f8fafc; border-radius: 15px; border: 1px solid #e2e8f0; }
                .summary-item span { color: #64748b; font-size: 0.9rem; display: block; margin-bottom: 5px; }
                .summary-item strong { font-size: 1.6rem; color: #1e293b; }
                table { width: 100%; border-collapse: collapse; margin-top: 30px; }
                th, td { border: 1px solid #e2e8f0; padding: 15px; text-align: center; }
                th { background: #f1f5f9; color: #475569; font-weight: 700; }
                tr:nth-child(even) { background: #f8fafc; }
                .footer { margin-top: 50px; text-align: left; font-size: 0.8rem; color: #94a3b8; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>تقرير تحصيل الخزنة اليومي</h1>
                <p>نظام إدارة الدروس</p>
                <p style="font-weight: 700;">${todayStrAr}</p>
            </div>
            
            <div class="summary">
                <div class="summary-item"><span>اشتراكات شهرية</span><strong>${totalSub} ج.م</strong></div>
                <div class="summary-item"><span>ملازم / أخرى</span><strong>${totalMisc} ج.م</strong></div>
                <div class="summary-item" style="border-color: #4f46e5; background: #f5f3ff;">
                    <span style="color: #4f46e5;">إجمالي النقدية</span>
                    <strong style="color: #4f46e5;">${totalSub + totalMisc} ج.م</strong>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>اسم الطالب</th>
                        <th>بند التحصيل</th>
                        <th>المبلغ</th>
                        <th>الوقت</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            
            <div class="footer">طبع بواسطة نظام إدارة الدروس | ${new Date().toLocaleString('ar-EG')}</div>
        </body>
        </html>
    `);
    printWindow.document.close();
    // Use timeout to ensure styles are loaded
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

function printSessionAttendance() {
    if (currentSessionAttendance.length === 0) {
        return showNotification('القائمة فارغة، لا يوجد ما يمكن طباعته', 'warning');
    }

    const printWindow = window.open('', '_blank');
    const groupName = db.groups.find(g => g.id == currentGroupId)?.name || 'كل المجموعات';
    const today = new Date().toLocaleDateString('ar-EG');

    let tableRows = currentSessionAttendance.map((s, index) => `
        <tr>
            <td style="border: 1px solid #000; padding: 8px;">${index + 1}</td>
            <td style="border: 1px solid #000; padding: 8px;">${s.name}</td>
            <td style="border: 1px solid #000; padding: 8px;">${s.qrCode}</td>
            <td style="border: 1px solid #000; padding: 8px;">${new Date(s.scanTime).toLocaleTimeString('ar-EG')}</td>
        </tr>
    `).join('');

    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <title>كشف حضور الجلسة - ${today}</title>
            <style>
                body { font-family: 'Tajawal', sans-serif; padding: 20px; }
                h1, h2 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background: #f0f0f0; border: 1px solid #000; padding: 10px; }
                td { border: 1px solid #000; padding: 8px; text-align: center; }
                .header-info { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            </style>
        </head>
        <body>
            <h1>كشف حضور حصة (جاري الآن)</h1>
            <div class="header-info">
                <span><strong>المجموعة:</strong> ${groupName}</span>
                <span><strong>التاريخ:</strong> ${today}</span>
                <span><strong>عدد الطلاب:</strong> ${currentSessionAttendance.length}</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>م</th>
                        <th>اسم الطالب</th>
                        <th>كود الطالب</th>
                        <th>وقت الحضور</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            <footer style="margin-top: 50px; text-align: center; font-size: 0.8rem; color: #666;">
                تم استخراج التقرير بواسطة نظام إدارة الدروس - ${new Date().toLocaleString('ar-EG')}
            </footer>
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

function printArchivedSession(filter = 'all') {
    if (!activeAbsenceSessionId) return;
    const session = db.absenceSessions.find(s => s.id === activeAbsenceSessionId);
    if (!session) return;

    const printWindow = window.open('', '_blank');
    const group = db.groups.find(g => g.id == session.groupId);
    const today = new Date(session.date).toLocaleDateString('ar-EG');

    let presentItems = (session.presentNames || []).map(name => `<li>${name}</li>`).join('');
    let absentItems = (session.absenteeNames || []).map(name => `<li>${name}</li>`).join('');

    let reportTitle = "تقرير كشف حضور وغياب";
    if (filter === 'present') reportTitle = "كشف التفوق والحضور";
    if (filter === 'absent') reportTitle = "كشف المتابعة والغياب";

    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <title>${reportTitle}: ${session.name}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
                body { font-family: 'Tajawal', sans-serif; padding: 30px; line-height: 1.6; }
                .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 20px; margin-bottom: 30px; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f9f9f9; padding: 15px; border-radius: 8px; }
                .columns { display: grid; grid-template-columns: ${filter === 'all' ? '1fr 1fr' : '1fr'}; gap: 40px; }
                h1 { margin: 0 0 10px; color: #333; }
                h3 { border-bottom: 2px solid #ccc; padding-bottom: 5px; margin-bottom: 15px; }
                .present { color: #166534; }
                .absent { color: #991b1b; }
                ul { list-style: decimal; padding-right: 25px; }
                li { margin-bottom: 5px; border-bottom: 1px dotted #eee; }
                @media print {
                    body { -webkit-print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${reportTitle}</h1>
                <h2 style="color: #666;">${session.name}</h2>
            </div>
            
            <div class="info-grid">
                <div><strong>المجموعة:</strong> ${group ? group.name : 'الكل'}</div>
                <div><strong>التاريخ:</strong> ${today}</div>
                ${filter !== 'absent' ? `<div><strong>إجمالي الحاضرين:</strong> ${session.presentCount} طالب</div>` : ''}
                ${filter !== 'present' ? `<div><strong>إجمالي الغائبين:</strong> ${session.absentCount} طالب</div>` : ''}
            </div>

            <div class="columns">
                ${(filter === 'all' || filter === 'present') ? `
                <div>
                    <h3 class="present">قائمة الحاضرين ✅</h3>
                    <ul>${presentItems || '<li>لا يوجد</li>'}</ul>
                </div>` : ''}
                ${(filter === 'all' || filter === 'absent') ? `
                <div>
                    <h3 class="absent">قائمة الغائبين ❌</h3>
                    <ul>${absentItems || '<li>لا يوجد</li>'}</ul>
                </div>` : ''}
            </div>

            <footer style="margin-top: 50px; text-align: center; font-size: 0.8rem; color: #999; border-top: 1px solid #eee; padding-top: 10px;">
                نظام إدارة الدروس - أرشيف الجلسات الرقمي | استُخرج بتاريخ: ${new Date().toLocaleString('ar-EG')}
            </footer>
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

function updateDashboardStats() {
    const totalS = document.getElementById('total-students');
    // Stats for active group context
    const groupStudents = db.students.filter(s => s.grade == currentGrade && s.groupId == currentGroupId);
    if (totalS) totalS.innerText = groupStudents.length;

    const presentTodayEl = document.getElementById('present-today');
    const today = new Date().toLocaleDateString('en-CA');

    // Cross-reference attendance with strictly-scoped group students
    const groupStudentIds = groupStudents.map(s => s.id);
    const presentCount = db.attendance.filter(a => {
        const aDate = new Date(a.date).toLocaleDateString('en-CA');
        return aDate === today && groupStudentIds.includes(a.studentId) && a.status === 'present';
    }).length;

    if (presentTodayEl) presentTodayEl.innerText = presentCount;

    // --- Financial Stats (Money, not points) ---
    const revEl = document.getElementById('monthly-revenue');
    const debtEl = document.getElementById('total-debt');

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Calculate actual money collected this month for this group only
    const monthlyIncome = db.payments.filter(p =>
        p.category === 'اشتراك شهري' &&
        p.cycleId == db.settings.activeCycle &&
        groupStudentIds.includes(p.studentId)
    ).reduce((sum, p) => sum + p.amount, 0);

    // Subtract monthly expenses for this group
    const monthlyExpenses = db.expenses
        .filter(e => e.groupId == currentGroupId)
        .reduce((sum, e) => sum + e.amount, 0);

    const netMonthly = monthlyIncome - monthlyExpenses;

    if (revEl) revEl.innerHTML = `${netMonthly} <small>ج.م</small>`;

    // Calculate Debt (Receivables) for this group
    if (db.settings.isMonthlyActive) {
        const unpaidCount = groupStudents.filter(s =>
            !db.payments.some(p => p.studentId == s.id && p.category === 'اشتراك شهري' && p.cycleId == db.settings.activeCycle)
        ).length;
        const totalDebt = unpaidCount * db.settings.monthlyFee;
        if (debtEl) debtEl.innerHTML = `${totalDebt} <small>ج.م</small>`;
    } else {
        if (debtEl) debtEl.innerText = `0 ج.م`;
    }

    // Display Active Group Info instead of the full grid
    const groupGrid = document.getElementById('dashboard-groups-grid');
    if (groupGrid) {
        const groupObj = db.groups.find(g => g.id == currentGroupId);
        if (groupObj) {
            groupGrid.innerHTML = `
                <div class="card active-ctx" style="padding: 1.5rem; border-right: 6px solid var(--primary); grid-column: span 3; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 0.9rem; color: var(--text-muted);">المجموعة النشطة حالياً</div>
                        <div style="font-weight: 800; font-size: 1.8rem; color: var(--text-main);">${groupObj.name}</div>
                        <div style="color: var(--primary); font-weight: 600;">${groupObj.time}</div>
                    </div>
                    <button class="btn" onclick="showGradeSelection()" style="background: var(--bg-light); padding: 0.8rem 1.5rem; border-radius: 12px;">
                        <i class="fas fa-exchange-alt"></i> تغيير المجموعة
                    </button>
                </div>
            `;
        } else {
            groupGrid.innerHTML = '<p style="color:var(--text-muted)">يرجى إعادة اختيار المجموعة</p>';
        }
    }
}

// --- Monthly Subscription Mode ---
function startMonthlySubscription() {
    const fee = parseInt(document.getElementById('monthly-fee-input').value) || 0;
    const comm = parseInt(document.getElementById('center-commission-input').value) || 0;
    const nameInput = document.getElementById('monthly-name-input');
    const cycleName = nameInput ? nameInput.value.trim() : '';

    const typeSelect = document.getElementById('cycle-subscription-type');
    const subscriptionType = typeSelect ? typeSelect.value : 'lesson';

    if ((subscriptionType === 'lesson' || subscriptionType === 'both') && fee <= 0) {
        return showNotification('يرجى تحديد قيمة اشتراك الدرس للدورة الجديدة', 'error');
    }

    // --- Platform course requirement ---
    let platformCourse = null;
    if (subscriptionType === 'platform' || subscriptionType === 'both') {
        const courseSelect = document.getElementById('cycle-platform-course');
        const courseId = courseSelect ? courseSelect.value : '';
        if (!courseId) {
            return showNotification('يرجى اختيار كورس المنصة المطلوب لهذه الدورة', 'error');
        }
        // السعر يُقرأ من بيانات الكورس المحفوظة
        const course = (db.platformCourses || []).find(c => String(c.courseId) === String(courseId));
        if (!course) {
            return showNotification('الكورس المحدد غير موجود، يرجى تحديث الكورسات', 'error');
        }
        // نحاول قراءة السعر من data-price أولاً (أحدث قيمة) ثم من db
        const selectedOption = courseSelect.options[courseSelect.selectedIndex];
        const priceFromOption = selectedOption ? Number(selectedOption.getAttribute('data-price') || 0) : 0;
        const originalPrice = priceFromOption || Number(course.price) || 0;

        // قراءة سعر طلاب السيستم
        const systemFeeInput = document.getElementById('platform-system-fee-input');
        const systemPrice = (systemFeeInput && systemFeeInput.value !== '') ? Number(systemFeeInput.value) : originalPrice;

        platformCourse = { 
            courseId: course.courseId, 
            courseTitle: course.courseTitle, 
            originalPrice: originalPrice, 
            price: systemPrice 
        };
    }

    // platformFee = سعر الكورس المختار لطلاب السيستم (المحدد مخصصاً أو تلقائياً)
    const platformFee = platformCourse ? platformCourse.price : 0;

    db.settings.isMonthlyActive = true;
    db.settings.monthlyFee = fee;
    db.settings.platformFee = platformFee;
    db.settings.centerCommissionPercent = comm;
    db.settings.monthlyCycleName = cycleName || `اشتراك ${new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}`;
    // Set a new unique cycle ID for this subscription period
    db.settings.activeCycle = Date.now();
    // ✅ حفظ تاريخ البداية الفعلي للدورة (اليوم الأول من الاشتراك)
    db.settings.cycleStartDate = new Date().toISOString();
    // ✅ إصلاح جوهري: نحفظ المجموعة/الصف اللي بدأت الدورة النشطة من أجلهما
    // بشكل ثابت مع الدورة نفسها، بدل الاعتماد على currentGroupId/currentGrade
    // العامّين المتغيّرين (اللي بيتغيّروا لما المدرس ينتقل بين المجموعات).
    // ده اللي كان بيسبب اختفاء/عدم ظهور صفحة الشهر بشكل صحيح في التقرير.
    db.settings.activeCycleGroupId = currentGroupId;
    db.settings.activeCycleGrade = currentGrade;

    db.settings.monthlyCollected = 0;

    // --- NEW: subscription type & linked platform course for this cycle ---
    db.settings.cycleSubscriptionType = subscriptionType;
    db.settings.activePlatformCourse = platformCourse; // { courseId, courseTitle, price } or null

    db.save();

    let msg = `تم تفعيل وضع الاشتراك الشهري`;
    if (fee > 0) msg += ` | درس: ${fee} ج.م`;
    if (platformFee > 0) msg += ` | منصة: ${platformFee} ج.م`;
    if (platformCourse) msg += ` | كورس: ${platformCourse.courseTitle}`;
    msg += ' 🚀';
    showNotification(msg);
    renderFinances();
    renderMonthlySubscriptionTables();
    updateDashboardStats();
}

function promptEndMonthlySubscription() {
    const pass = prompt("برجاء إدخال كلمة المرور لإنهاء الاشتراك:");
    const correct = (db._settings.globalPasswords && db._settings.globalPasswords.endSubscription) || '01000';
    if (pass === correct) {
        const cycleTitle = prompt("ادخل اسم لهذه الفترة للأرشفة (مثلاً: شهر فبراير 2026):", db.settings.monthlyCycleName || '');
        if (!cycleTitle) return showNotification("يجب إدخال اسم للدورة للأرشفة", "error");

        // Calculate center percentage from total monthly income for this cycle for the GROUP THE CYCLE BELONGS TO
        // ✅ إصلاح: نستخدم المجموعة/الصف المحفوظين مع الدورة نفسها وقت بدايتها
        // (activeCycleGroupId/activeCycleGrade)، مش currentGroupId/currentGrade
        // الحاليين — لأن المدرس ممكن يكون اتنقل لمجموعة تانية قبل ما يضغط
        // "إنهاء الاشتراك"، وده كان بيخلي الشهر يتؤرشف تحت مجموعة غلط
        // فتختفي صفحته من تقرير طلاب المجموعة الصح.
        const cycleGroupId = db.settings.activeCycleGroupId || currentGroupId;
        const cycleGrade   = db.settings.activeCycleGrade   || currentGrade;

        const cyclePayments = db.payments.filter(p => {
            const s = db.students.find(x => x.id === p.studentId);
            return p.cycleId == db.settings.activeCycle && p.category === 'اشتراك شهري' && s && String(s.groupId) === String(cycleGroupId);
        });
        const totalCollectedForGroup = cyclePayments.reduce((sum, p) => sum + p.amount, 0);
        const centerCutAmount = Math.round(totalCollectedForGroup * (db.settings.centerCommissionPercent / 100));

        // Save current cycle to archive with group isolation
        const cycleData = {
            id: db.settings.activeCycle,
            title: cycleTitle,
            fee: db.settings.monthlyFee,
            platformFee: db.settings.platformFee || 0,
            centerPercent: db.settings.centerCommissionPercent,
            centerCut: centerCutAmount,
            totalIncome: totalCollectedForGroup,
            startDate: db.settings.cycleStartDate || new Date().toISOString(), // ✅ تاريخ بداية الاشتراك
            date: new Date().toISOString(),                                     // تاريخ الأرشفة (النهاية)
            grade: cycleGrade,
            groupId: cycleGroupId,
            subscriptionType: db.settings.cycleSubscriptionType || 'lesson',
            activePlatformCourse: db.settings.activePlatformCourse || null
        };

        db.cycles.push(cycleData);

        db.settings.isMonthlyActive = false;
        db.settings.activeCycle = null;
        db.settings.cycleSubscriptionType = null;
        db.settings.activePlatformCourse = null;
        // ✅ تنظيف المجموعة/الصف المحفوظتين مع الدورة النشطة بعد إغلاقها
        db.settings.activeCycleGroupId = null;
        db.settings.activeCycleGrade = null;
        db.save();
        showNotification("تم إنهاء وأرشفة الدورة بنجاح ✅");
        renderFinances();
        renderMonthlySubscriptionTables();
        updateDashboardStats();
    } else {
        showNotification("كلمة المرور غير صحيحة!", "error");
    }
}

function collectMonthlyPayment(studentId) {
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    // Sync active grade/group context to ensure db.settings resolves correctly
    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // If no active cycle exists, start one automatically (or prompt)
    if (!db.settings.activeCycle) {
        if (confirm(`لا يوجد دورة اشتراك نشطة حالياً. هل تريد بدء دورة جديدة بقيمة ${db.settings.monthlyFee} ج.م؟`)) {
            db.settings.isMonthlyActive = true;
            db.settings.activeCycle = Date.now();
            // ✅ إصلاح: نفس مشكلة startMonthlySubscription — لازم نحفظ
            // المجموعة/الصف مع الدورة النشطة عشان تظهر صفحة الشهر صح لاحقًا
            db.settings.cycleStartDate = db.settings.cycleStartDate || new Date().toISOString();
            db.settings.activeCycleGroupId = currentGroupId;
            db.settings.activeCycleGrade = currentGrade;
            db.save();
        } else {
            return;
        }
    }

    // Check if paid in the CURRENT active cycle
    if (db.payments.some(p => p.studentId == s.id && p.category === 'اشتراك شهري' && p.cycleId == db.settings.activeCycle)) {
        return showNotification('الطالب دفع بالفعل لهذه الدورة', 'warning');
    }

    const newPayment = {
        id: Date.now(),
        studentId: s.id,
        amount: db.settings.monthlyFee,
        month: currentMonth,
        year: currentYear,
        date: new Date().toISOString(),
        category: 'اشتراك شهري',
        cycleId: db.settings.activeCycle,
        collectedBy: (typeof EmployeeAuth !== 'undefined') ? EmployeeAuth.getCurrentName() : undefined
    };
    db.payments.push(newPayment);

    // ⚡ إصلاح أداء: حفظ جدول المدفوعات فقط بدل كل الجداول (تفادياً لتجمّد/ريفرش الصفحة)
    db.save('payments');
    showNotification(`تم تسجيل دفع ${db.settings.monthlyFee} ج.م لـ ${s.name} ✅`);

    renderFinances();
    renderMonthlySubscriptionTables();
    updateDashboardStats();

    // Refresh portal if scanning
    if (document.getElementById('portal-overlay').style.display === 'block') {
        processScan(s.qrCode);
    }

    showReceiptSelectionModal(newPayment.id);
}

function exemptMonthlyPayment(studentId) {
    // Sync active grade/group context to ensure db.settings resolves correctly
    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    if (!db.settings.activeCycle) return showNotification('يجب تفعيل دورة اشتراك أولاً للاعفاء', 'error');

    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    if (db.payments.some(p => p.studentId == s.id && p.category === 'اشتراك شهري' && p.cycleId == db.settings.activeCycle)) {
        return showNotification('الطالب لديه سجل بالفعل لهذه الدورة', 'warning');
    }

    const newPayment = {
        id: Date.now(),
        studentId: s.id,
        amount: 0,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        date: new Date().toISOString(),
        category: 'اشتراك شهري',
        cycleId: db.settings.activeCycle,
        isExemption: true,
        collectedBy: (typeof EmployeeAuth !== 'undefined') ? EmployeeAuth.getCurrentName() : undefined
    };
    db.payments.push(newPayment);

    // ⚡ إصلاح أداء: حفظ جدول المدفوعات فقط بدل كل الجداول
    db.save('payments');
    showNotification(`تم إعفاء الطالب ${s.name} وقبوله ✅`, 'success');

    renderPortalAttendance();
    renderSubscriptionTracker();
    renderFinances();
    renderMonthlySubscriptionTables();
    updateDashboardStats();

    showReceiptSelectionModal(newPayment.id);
}

function discountMonthlyPayment(studentId) {
    // Sync active grade/group context to ensure db.settings resolves correctly
    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    if (!db.settings.activeCycle) return showNotification('يجب تفعيل دورة اشتراك أولاً لعمل خصم', 'error');

    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    if (db.payments.some(p => p.studentId == s.id && p.category === 'اشتراك شهري' && p.cycleId == db.settings.activeCycle)) {
        return showNotification('الطالب لديه سجل بالفعل لهذه الدورة', 'warning');
    }

    const discountStr = prompt(`المبلغ الأصلي: ${db.settings.monthlyFee} ج.م\nأدخل قيمة الخصم (المبلغ الذي سيتم طرحه):`, "0");
    const discount = parseFloat(discountStr);

    if (isNaN(discount) || discount < 0) return showNotification('قيمة الخصم غير صالحة', 'error');
    if (discount >= db.settings.monthlyFee) return showNotification('الخصم أكبر من أو يساوي الاشتراك! استخدم "إعفاء" بدلاً من ذلك.', 'warning');

    const netAmount = db.settings.monthlyFee - discount;

    const newPayment = {
        id: Date.now(),
        studentId: s.id,
        amount: netAmount,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        date: new Date().toISOString(),
        category: 'اشتراك شهري',
        cycleId: db.settings.activeCycle,
        discount: discount,
        collectedBy: (typeof EmployeeAuth !== 'undefined') ? EmployeeAuth.getCurrentName() : undefined
    };
    db.payments.push(newPayment);

    // ⚡ إصلاح أداء: حفظ جدول المدفوعات فقط بدل كل الجداول
    db.save('payments');
    showNotification(`تم تسجيل مبلغ ${netAmount} ج.م بعد خصم ${discount} ✅`, 'success');

    renderPortalAttendance();
    renderSubscriptionTracker();
    renderFinances();
    renderMonthlySubscriptionTables();
    updateDashboardStats();

    showReceiptSelectionModal(newPayment.id);
}

function renderMonthlySubscriptionTables() {
    const active = db.settings.isMonthlyActive;
    const monthlyFeeInput = document.getElementById('monthly-fee-input');
    const centerCommInput = document.getElementById('center-commission-input');
    const monthlyNameInput = document.getElementById('monthly-name-input');

    // Toggle controls
    document.getElementById('btn-start-monthly').style.display = active ? 'none' : 'block';
    document.getElementById('btn-stop-monthly').style.display = active ? 'block' : 'none';
    const badge = document.getElementById('monthly-status-badge');
    badge.style.display = active ? 'block' : 'none';

    if (active) {
        if (monthlyFeeInput) {
            monthlyFeeInput.value = db.settings.monthlyFee;
            monthlyFeeInput.disabled = true;
        }
        if (centerCommInput) centerCommInput.value = db.settings.centerCommissionPercent;
        if (monthlyNameInput) {
            monthlyNameInput.value = db.settings.monthlyCycleName || '';
            monthlyNameInput.disabled = true;
        }

        // عرض سعر المنصة تلقائياً (حقل مخفي + عرض للقراءة فقط)
        const platformFeeWrapper = document.getElementById('platform-fee-input-wrapper');
        const platformOriginalFeeValueEl = document.getElementById('platform-original-fee-value');
        const platformSystemFeeInput = document.getElementById('platform-system-fee-input');
        const platformFeeHidden = document.getElementById('platform-fee-input');

        const activeCourse = db.settings.activePlatformCourse;
        const savedPlatformFee = db.settings.platformFee || 0;

        if (platformFeeWrapper) {
            platformFeeWrapper.style.display = (db.settings.cycleSubscriptionType === 'platform' || db.settings.cycleSubscriptionType === 'both') ? 'block' : 'none';
        }

        if (platformFeeHidden) platformFeeHidden.value = savedPlatformFee;

        if (activeCourse) {
            if (platformOriginalFeeValueEl) {
                platformOriginalFeeValueEl.textContent = `${activeCourse.originalPrice || activeCourse.price || 0} ج.م`;
            }
            if (platformSystemFeeInput) {
                platformSystemFeeInput.value = activeCourse.price || 0;
                platformSystemFeeInput.disabled = true;
            }
        } else {
            if (platformOriginalFeeValueEl) {
                platformOriginalFeeValueEl.textContent = savedPlatformFee > 0 ? `${savedPlatformFee} ج.م` : 'مجاني (0 ج.م)';
            }
            if (platformSystemFeeInput) {
                platformSystemFeeInput.value = savedPlatformFee;
                platformSystemFeeInput.disabled = true;
            }
        }

        // Lock subscription type / course selects while a cycle is active
        const typeSelect = document.getElementById('cycle-subscription-type');
        const courseSelect = document.getElementById('cycle-platform-course');
        const courseWrapper = document.getElementById('cycle-platform-course-wrapper');
        if (typeSelect) {
            typeSelect.value = db.settings.cycleSubscriptionType || 'lesson';
            typeSelect.disabled = true;
        }
        if (courseWrapper) {
            courseWrapper.style.display = (db.settings.cycleSubscriptionType === 'platform' || db.settings.cycleSubscriptionType === 'both') ? 'block' : 'none';
        }
        if (courseSelect) {
            if (db.settings.activePlatformCourse) {
                courseSelect.innerHTML = `<option value="${db.settings.activePlatformCourse.courseId}">${db.settings.activePlatformCourse.courseTitle}</option>`;
            }
            courseSelect.disabled = true;
        }
    } else {
        if (monthlyFeeInput) {
            monthlyFeeInput.value = '';
            monthlyFeeInput.disabled = false;
        }
        if (centerCommInput) centerCommInput.value = '';
        if (monthlyNameInput) {
            monthlyNameInput.value = '';
            monthlyNameInput.disabled = false;
        }

        const platformOriginalFeeValueEl = document.getElementById('platform-original-fee-value');
        const platformSystemFeeInput = document.getElementById('platform-system-fee-input');
        const platformFeeHiddenReset = document.getElementById('platform-fee-input');

        if (platformOriginalFeeValueEl) platformOriginalFeeValueEl.textContent = 'اختر كورساً أولاً';
        if (platformSystemFeeInput) {
            platformSystemFeeInput.value = '';
            platformSystemFeeInput.disabled = false;
        }
        if (platformFeeHiddenReset) platformFeeHiddenReset.value = '0';

        const typeSelect = document.getElementById('cycle-subscription-type');
        const courseSelect = document.getElementById('cycle-platform-course');
        if (typeSelect) typeSelect.disabled = false;
        if (courseSelect) courseSelect.disabled = false;
        if (typeof onCycleSubscriptionTypeChange === 'function') onCycleSubscriptionTypeChange();
    }

    // ONLY show students from the ACTIVE group for the financial section
    const groupStudents = db.students.filter(s =>
        String(s.grade) === String(currentGrade) &&
        String(s.groupId) === String(currentGroupId)
    );
    const gradeStudentIds = groupStudents.map(s => s.id);

    if (active) {
        const collected = db.payments.filter(p =>
            p.category === 'اشتراك شهري' &&
            p.cycleId == db.settings.activeCycle &&
            gradeStudentIds.includes(p.studentId)
        ).reduce((sum, p) => sum + p.amount, 0);

        let badgeText = `وضع الاشتراك نشط (درس محصل: ${collected} ج.م)`;
        if (db.settings.platformFee) badgeText += ` | منصة: ${db.settings.platformFee} ج.م`;
        badgeText += ` | سنتر: ${db.settings.centerCommissionPercent}%`;
        const typeLabels = { lesson: 'اشتراك الدرس', platform: 'اشتراك المنصة', both: 'اشتراك الدرس + المنصة' };
        if (db.settings.cycleSubscriptionType) {
            badgeText += ` | ${typeLabels[db.settings.cycleSubscriptionType] || ''}`;
        }
        if (db.settings.activePlatformCourse) {
            badgeText += ` | كورس: ${db.settings.activePlatformCourse.courseTitle}`;
        }
        badge.innerHTML = badgeText;
    }

    const paidList = [];
    const unpaidList = [];

    groupStudents.forEach(s => {
        const hasPaid = db.payments.some(p =>
            p.studentId == s.id &&
            p.category === 'اشتراك شهري' &&
            p.cycleId == db.settings.activeCycle
        );
        if (hasPaid) paidList.push(s);
        else unpaidList.push(s);
    });

    document.getElementById('paid-students-list').innerHTML = paidList.map(s => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 0.5rem;"><i class="fas fa-check-circle" style="color:var(--accent)"></i> <strong>${s.name}</strong></td>
            <td style="font-family:monospace; color:var(--text-muted)">${s.qrCode}</td>
            <td style="text-align:left; padding: 0.5rem;">
                <button class="btn" onclick="toggleMonthlyPayment(${s.id})" style="background:transparent; color:var(--danger); padding:4px 8px; font-size:1rem; border:none; box-shadow:none;" title="إلغاء الدفع">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="3" style="text-align:center; padding:1rem;">لا يوجد</td></tr>';

    document.getElementById('unpaid-students-list').innerHTML = unpaidList.map(s => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 0.5rem;"><i class="fas fa-clock" style="color:var(--danger)"></i> <strong>${s.name}</strong></td>
            <td style="text-align:left; padding: 0.5rem; display:flex; gap:5px; justify-content:flex-end;">
                <button class="btn" onclick="collectMonthlyPayment(${s.id})" style="background:var(--payment-orange); color:white; padding:4px 10px; font-size:0.75rem; border-radius:50px;">
                    تحصيل الآن <i class="fas fa-check"></i>
                </button>
                <button class="btn" onclick="exemptMonthlyPayment(${s.id})" style="background:#f5f3ff; color:#7c3aed; padding:4px 12px; font-size:0.75rem; border-radius:50px; border:1px solid #ddd6fe; font-weight:600;">
                    إعفاء 🤍
                </button>
                <button class="btn" onclick="discountMonthlyPayment(${s.id})" style="background:#fff7ed; color:#ea580c; padding:4px 12px; font-size:0.75rem; border-radius:50px; border:1px solid #fed7aa; font-weight:600;">
                    خصم %
                </button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="2" style="text-align:center; padding:1rem;">لا يوجد</td></tr>';
}

function renderFinances() {
    renderMonthlySubscriptionTables();

    // Filter income/expenses by the ACTIVE GROUP for strict group-level treasury
    const groupStudents = db.students.filter(s => s.grade == currentGrade && s.groupId == currentGroupId);
    const groupStudentIds = groupStudents.map(s => s.id);

    // Filter payments for these specific students
    const groupPayments = db.payments.filter(p => groupStudentIds.includes(p.studentId));

    // Annual Income (All payments for this group)
    const annualIncome = groupPayments.reduce((sum, p) => sum + p.amount, 0);

    // Monthly Income (Only active cycle for this group)
    const monthlyIncome = groupPayments.filter(p => p.cycleId == db.settings.activeCycle)
        .reduce((sum, p) => sum + p.amount, 0);

    // Expenses for this group specifically
    const expenses = db.expenses
        .filter(e => e.groupId == currentGroupId)
        .reduce((sum, e) => sum + e.amount, 0);

    document.getElementById('finance-income-monthly').innerText = `${monthlyIncome} ج.م`;
    document.getElementById('finance-income-yearly').innerText = `${annualIncome} ج.م`;
    document.getElementById('finance-expenses').innerText = `${expenses} ج.م`;
    document.getElementById('finance-net').innerText = `${annualIncome - expenses} ج.م`;

    // Breakdown: Lesson subscription vs Platform subscription (current cycle)
    const monthlyCyclePayments = groupPayments.filter(p => p.cycleId == db.settings.activeCycle);
    const lessonIncome = monthlyCyclePayments
        .filter(p => p.category === 'اشتراك شهري')
        .reduce((sum, p) => sum + p.amount, 0);
    // Platform income = payments with category 'اشتراك المنصة' OR platformAmount stored on payment
    const platformIncome = monthlyCyclePayments
        .filter(p => p.category === 'اشتراك المنصة' || p.platformAmount > 0)
        .reduce((sum, p) => sum + (p.platformAmount || p.amount), 0);
    const lessonEl = document.getElementById('finance-income-lesson');
    const platformEl = document.getElementById('finance-income-platform');
    if (lessonEl) lessonEl.innerText = `${lessonIncome} ج.م`;
    if (platformEl) platformEl.innerText = `${platformIncome} ج.م`;

    // Center Commission Calculation
    const centerCut = Math.round(monthlyIncome * (db.settings.centerCommissionPercent / 100));
    const cutEl = document.getElementById('finance-center-cut');
    if (cutEl) cutEl.innerText = `${centerCut} ج.م`;
    const labelEl = document.getElementById('center-percent-label');
    if (labelEl) labelEl.innerText = `بنسبة ${db.settings.centerCommissionPercent}% من تحصيل الشهر الحقيقي`;

    // Combine payments and expenses for a full ledger
    const ledger = [
        ...groupPayments.map(p => ({
            title: `اشتراك: ${db.students.find(s => s.id === p.studentId)?.name || 'طالب'}`,
            category: p.category || 'اشتراك',
            amount: p.amount,
            date: p.date,
            type: 'income',
            collectedBy: p.collectedBy
        })),
        ...db.expenses.filter(e => e.groupId == currentGroupId).map(e => ({
            title: e.title,
            category: e.category,
            amount: e.amount,
            date: e.id, // e.id is timestamp
            type: 'expense',
            collectedBy: e.collectedBy
        }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    document.getElementById('finances-list').innerHTML = ledger.map(item => `
        <tr>
            <td>${item.title}</td>
            <td>${item.category}${item.collectedBy ? `<br><span style="font-size:.72rem; color:var(--text-muted);"><i class="fas fa-user"></i> ${item.collectedBy}</span>` : ''}</td>
            <td style="color:${item.type === 'income' ? 'var(--accent)' : 'var(--danger)'}; font-weight:bold;">
                ${item.type === 'income' ? '+' : '-'}${item.amount} ج.م
            </td>
            <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
        </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;">لا يوجد عمليات مالية مسجلة</td></tr>';
}

// =========================================================
// --- Payment Receipts: Print Modal & Templates ---
// =========================================================

let pendingReceiptPaymentId = null;

function getReceiptCycleTitle(payment) {
    if (!payment) return 'اشتراك شهري';
    if (payment.cycleId == db.settings.activeCycle && db.settings.monthlyCycleName) {
        return db.settings.monthlyCycleName;
    }
    const archivedCycle = db.cycles.find(c => c.id == payment.cycleId);
    if (archivedCycle) return archivedCycle.title;
    return db.settings.monthlyCycleName || 'اشتراك شهري';
}

// Open the print-size selection modal for a given payment (called after collecting/exempting/discounting a payment)
function showReceiptSelectionModal(paymentId) {
    const payment = db.payments.find(p => p.id == paymentId);
    if (!payment) return;

    // Keep the receipts log up to date if the section is visible
    if (typeof renderReceiptsList === 'function') renderReceiptsList();

    pendingReceiptPaymentId = paymentId;
    const student = db.students.find(s => s.id == payment.studentId);

    const infoEl = document.getElementById('receipt-choice-info');
    if (infoEl) {
        infoEl.innerHTML = student
            ? `الطالب: <strong>${student.name}</strong> | المبلغ: <strong>${payment.amount} ج.م</strong>`
            : '';
    }

    toggleModal('receipt-choice-modal', true);
}

// Called from the print-size modal buttons
function confirmReceiptPrint(size) {
    if (!pendingReceiptPaymentId) return;
    printMonthlyReceipt(pendingReceiptPaymentId, size);
    toggleModal('receipt-choice-modal', false);
    pendingReceiptPaymentId = null;
}

function skipReceiptPrint() {
    toggleModal('receipt-choice-modal', false);
    pendingReceiptPaymentId = null;
}

// بناء جدول تفاصيل البنود المدفوعة
function _buildReceiptItemsRows(payment) {
    const rows = [];

    if (payment.isExemption) {
        rows.push({ label: 'إعفاء من الاشتراك', amount: null, note: 'معفى', color: '#2563eb' });
    } else if (payment.category === 'اشتراك شهري' || !payment.category) {
        const platformPart = Number(payment.platformFee || 0);
        const lessonPart   = Number(payment.amount || 0) - platformPart;
        if (lessonPart > 0)   rows.push({ label: 'اشتراك دروس',    amount: lessonPart,   color: '#10b981' });
        if (platformPart > 0) rows.push({ label: 'اشتراك المنصة',  amount: platformPart, color: '#4f46e5' });
        if (payment.discount && Number(payment.discount) > 0)
            rows.push({ label: 'خصم مطبَّق', amount: -Number(payment.discount), color: '#f59e0b' });
    } else if (payment.category === 'اشتراك المنصة') {
        rows.push({ label: 'اشتراك المنصة', amount: Number(payment.amount), color: '#4f46e5' });
    } else if (payment.category === 'ملزمة/مذكرة') {
        rows.push({ label: 'ملازم / مذكرة', amount: Number(payment.amount), color: '#8b5cf6' });
    } else {
        rows.push({ label: payment.category, amount: Number(payment.amount), color: '#64748b' });
    }

    return rows;
}

// Print a monthly subscription receipt. size: 'thermal' (80mm) or 'normal' (A4)
function printMonthlyReceipt(paymentId, size = 'thermal') {
    const payment = db.payments.find(p => p.id == paymentId);
    if (!payment) return showNotification('لم يتم العثور على عملية الدفع', 'error');

    const student = db.students.find(s => s.id == payment.studentId);
    if (!student) return showNotification('لم يتم العثور على بيانات الطالب', 'error');

    const cycleTitle = getReceiptCycleTitle(payment);
    const dateStr    = new Date(payment.date).toLocaleDateString('ar-EG');
    const timeStr    = new Date(payment.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const groupObj   = db.groups.find(g => String(g.id) === String(student.groupId));
    const groupName  = groupObj ? groupObj.name : '—';
    const gradeName  = typeof gradeLabel === 'function' ? gradeLabel(student.grade) : (student.grade || '—');
    const itemRows   = _buildReceiptItemsRows(payment);

    let html;

    if (size === 'normal') {
        // تفاصيل البنود لـ A4
        const itemsTableRows = itemRows.map(r =>
            `<tr>
                <td style="padding:10px 14px; font-weight:600; color:#374151; border-bottom:1px solid #f1f5f9;">${r.label}</td>
                <td style="padding:10px 14px; text-align:left; font-weight:800; color:${r.color}; border-bottom:1px solid #f1f5f9;">
                    ${r.note
                        ? `<span style="background:rgba(37,99,235,.1);color:#2563eb;padding:2px 10px;border-radius:8px;">${r.note}</span>`
                        : (r.amount < 0 ? `- ${Math.abs(r.amount)} ج.م` : `${r.amount} ج.م`)}
                </td>
            </tr>`
        ).join('');

        html = `
        <html dir="rtl">
        <head>
            <title>إيصال استلام نقدية - ${student.name}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');
                * { box-sizing:border-box; margin:0; padding:0; }
                body { font-family:'Tajawal',sans-serif; padding:30px; color:#1e293b; background:#f8fafc; }
                .receipt { max-width:780px; margin:0 auto; background:#fff; border:2px solid #4f46e5; border-radius:16px; overflow:hidden; box-shadow:0 8px 30px rgba(79,70,229,.12); }
                .receipt-header { background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; padding:22px 30px; display:flex; justify-content:space-between; align-items:center; }
                .receipt-header h1 { font-size:1.4rem; font-weight:900; margin:0; }
                .receipt-header .meta { text-align:left; font-size:.85rem; opacity:.9; line-height:2; }
                .receipt-body { padding:24px 30px; }
                .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:20px; padding:16px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0; }
                .info-item label { font-size:.78rem; color:#64748b; display:block; margin-bottom:2px; }
                .info-item span { font-weight:700; color:#1e293b; font-size:.95rem; }
                .section-title { font-weight:800; color:#374151; font-size:.9rem; margin:18px 0 10px; padding-bottom:6px; border-bottom:2px solid #e2e8f0; }
                .items-table { width:100%; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; font-size:.9rem; }
                .items-table thead tr { background:#f8fafc; }
                .items-table thead th { padding:10px 14px; text-align:right; font-weight:700; color:#475569; border-bottom:1px solid #e5e7eb; }
                .items-table thead th:last-child { text-align:left; }
                .items-table tfoot tr { background:#f0fdf4; }
                .items-table tfoot td { padding:11px 14px; font-weight:900; color:#059669; font-size:1rem; }
                .items-table tfoot td:last-child { text-align:left; }
                .signatures { display:flex; justify-content:space-between; margin-top:40px; padding-top:20px; border-top:1px dashed #cbd5e1; }
                .sig-box { text-align:center; width:45%; }
                .sig-box .sig-label { font-size:.85rem; color:#64748b; margin-bottom:38px; }
                .sig-box .sig-line { border-top:1px dashed #94a3b8; padding-top:6px; font-size:.8rem; color:#94a3b8; }
                @media print { .no-print { display:none!important; } body { padding:0; background:#fff; } }
            </style>
        </head>
        <body>
            <div class="receipt">
                <div class="receipt-header">
                    <div>
                        <h1>إيصال استلام نقدية</h1>
                        <div style="font-size:.88rem; opacity:.85; margin-top:4px;">${cycleTitle}</div>
                    </div>
                    <div class="meta">
                        رقم الإيصال: <strong>#${payment.id}</strong><br>
                        التاريخ: ${dateStr}<br>
                        الوقت: ${timeStr}
                    </div>
                </div>

                <div class="receipt-body">
                    <div class="info-grid">
                        <div class="info-item"><label>اسم الطالب</label><span>${student.name}</span></div>
                        <div class="info-item"><label>كود الطالب</label><span>${student.qrCode || '—'}</span></div>
                        <div class="info-item"><label>الصف الدراسي</label><span>${gradeName}</span></div>
                        <div class="info-item"><label>المجموعة</label><span>${groupName}</span></div>
                        ${payment.collectedBy ? `<div class="info-item"><label>تم التحصيل بواسطة</label><span>${payment.collectedBy}</span></div>` : ''}
                    </div>

                    <div class="section-title">📋 تفاصيل المدفوعات</div>
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th>البند</th>
                                <th>المبلغ</th>
                            </tr>
                        </thead>
                        <tbody>${itemsTableRows}</tbody>
                        <tfoot>
                            <tr>
                                <td>الإجمالي المدفوع</td>
                                <td>${payment.isExemption ? 'معفى' : payment.amount + ' ج.م'}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div class="signatures">
                        <div class="sig-box">
                            <div class="sig-label">توقيع الإدارة</div>
                            <div class="sig-line">الختم</div>
                        </div>
                        <div class="sig-box">
                            <div class="sig-label">توقيع ولي الأمر / الطالب</div>
                            <div class="sig-line">الاستلام</div>
                        </div>
                    </div>
                </div>
            </div>
            <div style="text-align:center; margin-top:20px;" class="no-print">
                <button onclick="window.print()" style="padding:12px 36px; background:#4f46e5; color:#fff; border:none; border-radius:10px; font-size:1rem; font-family:inherit; cursor:pointer; font-weight:700;">
                    🖨 طباعة الإيصال
                </button>
            </div>
        </body>
        </html>`;

    } else {
        // تفاصيل البنود للطابعة الحرارية 80mm
        const thermalRows = itemRows.map(r =>
            `<tr>
                <td class="label">${r.label}</td>
                <td style="text-align:left; color:${r.color}; font-weight:700;">
                    ${r.note ? r.note : (r.amount < 0 ? '- ' + Math.abs(r.amount) + ' ج.م' : r.amount + ' ج.م')}
                </td>
            </tr>`
        ).join('');

        html = `
        <html dir="rtl">
        <head>
            <title>وصل دفع - ${student.name}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
                * { box-sizing:border-box; }
                body { font-family:'Tajawal',sans-serif; width:80mm; margin:0 auto; padding:10px; color:#000; font-size:12px; }
                .center { text-align:center; }
                hr { border:none; border-top:1px dashed #000; margin:8px 0; }
                table { width:100%; font-size:12px; }
                table td { padding:3px 0; }
                .label { font-weight:700; }
                .amount-box { text-align:center; font-size:15px; font-weight:900; margin:8px 0; border:1px solid #000; padding:6px; border-radius:4px; }
                .detail-title { font-weight:700; font-size:11px; margin:6px 0 3px; }
                @media print { .no-print { display:none; } body { width:80mm; } }
            </style>
        </head>
        <body>
            <div class="center">
                <h3 style="margin:5px 0; font-size:15px;">سنتر العباقرة</h3>
                <div style="font-size:11px; color:#555;">${cycleTitle}</div>
            </div>
            <hr>
            <table>
                <tr><td class="label">رقم الوصل</td><td style="text-align:left;">#${payment.id}</td></tr>
                <tr><td class="label">الطالب</td><td style="text-align:left;">${student.name}</td></tr>
                <tr><td class="label">الكود</td><td style="text-align:left;">${student.qrCode || '—'}</td></tr>
                <tr><td class="label">الصف</td><td style="text-align:left;">${gradeName}</td></tr>
                <tr><td class="label">التاريخ</td><td style="text-align:left;">${dateStr} ${timeStr}</td></tr>
                ${payment.collectedBy ? `<tr><td class="label">تم التحصيل بواسطة</td><td style="text-align:left;">${payment.collectedBy}</td></tr>` : ''}
            </table>
            <hr>
            <div class="detail-title">تفاصيل الدفع:</div>
            <table>${thermalRows}</table>
            <hr>
            <div class="amount-box">الإجمالي: ${payment.isExemption ? 'معفى' : payment.amount + ' ج.م'}</div>
            <hr>
            <div class="center" style="margin-top:8px; font-size:11px;">شكراً لكم 🌹</div>
            <div style="text-align:center; margin-top:15px;" class="no-print">
                <button onclick="window.print()" style="padding:8px 20px; background:#4f46e5; color:#fff; border:none; border-radius:5px; cursor:pointer; font-family:inherit; font-weight:700;">طباعة</button>
            </div>
        </body>
        </html>`;
    }

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
}

// =========================================================
// --- Payment Receipts Section (search by receipt/payment code) ---
// =========================================================

function initReceiptsSection() {
    const input = document.getElementById('receipt-search-input');
    const result = document.getElementById('receipt-search-result');
    const filter = document.getElementById('receipts-list-filter');
    if (input) input.value = '';
    if (result) result.innerHTML = '';
    if (filter) filter.value = '';
    renderReceiptsList('');
}

// Renders a list of all payment receipts (printed or not) for the current group, newest first
function renderReceiptsList(searchTerm = '') {
    const body = document.getElementById('receipts-list-body');
    if (!body) return;

    // Sync active grade/group context
    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    const normalize = (text) => {
        return String(text)
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .toLowerCase()
            .trim();
    };

    const groupStudents = db.students.filter(s =>
        String(s.grade) === String(currentGrade) &&
        String(s.groupId) === String(currentGroupId)
    );
    const groupStudentIds = new Set(groupStudents.map(s => s.id));

    let payments = db.payments
        .filter(p => groupStudentIds.has(p.studentId))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (searchTerm && searchTerm.trim()) {
        const term = normalize(searchTerm);
        payments = payments.filter(p => {
            const student = db.students.find(s => s.id == p.studentId);
            if (!student) return false;
            return normalize(student.name).includes(term) ||
                String(student.qrCode).includes(searchTerm.trim()) ||
                String(p.id).includes(searchTerm.trim());
        });
    }

    if (payments.length === 0) {
        body.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">لا توجد وصولات لعرضها</td></tr>';
        return;
    }

    body.innerHTML = payments.map(p => {
        const student = db.students.find(s => s.id == p.studentId);
        const cycleTitle = getReceiptCycleTitle(p);
        const dateStr = new Date(p.date).toLocaleString('ar-EG');
        const statusLabel = p.isExemption ? 'إعفاء كامل' : (p.discount ? `بعد خصم ${p.discount} ج.م` : 'كامل');
        return `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px; text-align:center;"><input type="checkbox" class="receipt-select-cb" value="${p.id}"></td>
                <td style="padding:8px; font-family:monospace;">#${p.id}</td>
                <td style="padding:8px;"><strong>${student ? student.name : 'غير معروف'}</strong></td>
                <td style="padding:8px;">${cycleTitle} <span style="color:var(--text-muted); font-size:0.8rem;">(${statusLabel})</span></td>
                <td style="padding:8px; color:var(--accent); font-weight:700;">${p.amount} ج.م</td>
                <td style="padding:8px; font-size:0.85rem; color:var(--text-muted);">${dateStr}</td>
                <td style="padding:8px; display:flex; gap:5px;">
                    <button class="btn" style="background:var(--accent); color:#fff; padding:4px 10px; font-size:0.75rem;" onclick="printMonthlyReceipt(${p.id}, 'thermal')" title="طباعة حرارية">
                        <i class="fas fa-print"></i>
                    </button>
                    <button class="btn" style="background:var(--primary); color:#fff; padding:4px 10px; font-size:0.75rem;" onclick="printMonthlyReceipt(${p.id}, 'normal')" title="طباعة A4">
                        <i class="fas fa-file-invoice"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ─── تحديد/إلغاء تحديد كل صناديق اختيار الوصولات دفعة واحدة ───
function toggleAllReceiptCheckboxes(masterCb) {
    document.querySelectorAll('.receipt-select-cb').forEach(cb => { cb.checked = masterCb.checked; });
}

function getSelectedReceiptIds() {
    return Array.from(document.querySelectorAll('.receipt-select-cb:checked')).map(cb => cb.value);
}

function getVisibleReceiptIds() {
    return Array.from(document.querySelectorAll('.receipt-select-cb')).map(cb => cb.value);
}

function printSelectedReceiptsBulk() {
    const ids = getSelectedReceiptIds();
    if (!ids.length) return showNotification('اختر وصلاً واحداً على الأقل من القائمة أولاً', 'error');
    printBulkReceipts(ids);
}

function printAllVisibleReceiptsBulk() {
    const ids = getVisibleReceiptIds();
    if (!ids.length) return showNotification('لا توجد وصولات لعرضها', 'error');
    printBulkReceipts(ids);
}

// بناء بطاقة وصل مصغّرة واحدة (لاستخدامها داخل شبكة الطباعة المجمّعة)
function _buildBulkReceiptCard(payment) {
    const student = db.students.find(s => s.id == payment.studentId);
    if (!student) return '';

    const profile   = (typeof getProgramProfile === 'function') ? getProgramProfile() : { centerName: 'نظام إدارة الدروس' };
    const cycleTitle = getReceiptCycleTitle(payment);
    const dateStr    = new Date(payment.date).toLocaleDateString('ar-EG');
    const gradeName  = typeof gradeLabel === 'function' ? gradeLabel(student.grade) : (student.grade || '—');
    const statusLabel = payment.isExemption ? 'معفى' : (payment.discount ? `بعد خصم ${payment.discount} ج.م` : 'كامل');
    const amountText  = payment.isExemption ? 'معفى' : `${payment.amount} ج.م`;

    return `
        <div class="bulk-receipt-card">
            <div class="bc-header">
                <span class="bc-center">${profile.centerName || 'سنتر العباقرة'}</span>
                <span class="bc-num">#${payment.id}</span>
            </div>
            <div class="bc-row"><span class="bc-label">الطالب</span><span class="bc-value">${student.name}</span></div>
            <div class="bc-row"><span class="bc-label">الكود</span><span class="bc-value">${student.qrCode || '—'}</span></div>
            <div class="bc-row"><span class="bc-label">الصف</span><span class="bc-value">${gradeName}</span></div>
            <div class="bc-row"><span class="bc-label">البيان</span><span class="bc-value">${cycleTitle}</span></div>
            <div class="bc-row"><span class="bc-label">التاريخ</span><span class="bc-value">${dateStr}</span></div>
            <div class="bc-amount">الإجمالي: ${amountText} <span class="bc-status">(${statusLabel})</span></div>
            <div class="bc-sign">توقيع الاستلام: ______________</div>
        </div>`;
}

// طباعة عدة وصلات دفعة واحدة، بواقع 10 وصلات (بطاقات) في كل صفحة A4
function printBulkReceipts(paymentIds) {
    const cards = paymentIds
        .map(id => db.payments.find(p => String(p.id) === String(id)))
        .filter(Boolean)
        .map(_buildBulkReceiptCard)
        .filter(Boolean);

    if (!cards.length) return showNotification('لم يتم العثور على أي وصولات صالحة للطباعة', 'error');

    const html = `
    <html dir="rtl">
    <head>
        <title>طباعة وصولات مجمّعة</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');
            * { box-sizing:border-box; margin:0; padding:0; }
            @page { size:A4; margin:10mm; }
            body { font-family:'Tajawal',sans-serif; color:#1e293b; background:#fff; }
            .bulk-grid {
                display:grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 4mm;
            }
            .bulk-receipt-card {
                border:1.5px dashed #94a3b8;
                border-radius:8px;
                padding:8px 10px;
                min-height:52mm;
                display:flex;
                flex-direction:column;
                gap:3px;
                break-inside:avoid;
            }
            .bc-header { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:4px; margin-bottom:2px; }
            .bc-center { font-weight:900; font-size:12px; color:#4f46e5; }
            .bc-num { font-family:monospace; font-size:11px; color:#64748b; }
            .bc-row { display:flex; justify-content:space-between; font-size:10.5px; }
            .bc-label { color:#64748b; font-weight:700; }
            .bc-value { font-weight:700; color:#1e293b; }
            .bc-amount { margin-top:auto; text-align:center; font-weight:900; font-size:12.5px; color:#059669; border-top:1px dashed #cbd5e1; padding-top:4px; }
            .bc-status { font-weight:600; font-size:10px; color:#64748b; }
            .bc-sign { font-size:9.5px; color:#94a3b8; text-align:left; margin-top:2px; }
            /* صفحة A4 كل 10 بطاقات (5 صفوف × عمودين) */
            .bulk-receipt-card:nth-child(10n) { break-after: page; }
            @media print { .no-print { display:none!important; } }
        </style>
    </head>
    <body>
        <div class="bulk-grid">
            ${cards.join('')}
        </div>
        <div class="no-print" style="text-align:center; margin-top:20px;">
            <button onclick="window.print()" style="padding:10px 30px; background:#4f46e5; color:#fff; border:none; border-radius:8px; font-family:inherit; font-weight:700; cursor:pointer;">
                🖨 طباعة (${cards.length} وصل)
            </button>
        </div>
    </body>
    </html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
}

function searchPaymentCodeSection() {
    const input = document.getElementById('receipt-search-input');
    const result = document.getElementById('receipt-search-result');
    if (!input || !result) return;

    const code = input.value.trim();
    if (!code) {
        result.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:1rem;">يرجى إدخال رقم الوصل (كود الدفع)</p>';
        return;
    }

    const payment = db.payments.find(p => String(p.id) === code) ||
        db.payments.find(p => String(p.id).endsWith(code));

    if (!payment) {
        result.innerHTML = '<p style="text-align:center; color:var(--danger); padding:1rem;">❌ لا يوجد وصل بهذا الكود</p>';
        return;
    }

    const student = db.students.find(s => s.id == payment.studentId);
    const cycleTitle = getReceiptCycleTitle(payment);
    const dateStr = new Date(payment.date).toLocaleString('ar-EG');
    const statusLabel = payment.isExemption ? 'إعفاء كامل' : (payment.discount ? `دفع بعد خصم ${payment.discount} ج.م` : 'دفع كامل');

    result.innerHTML = `
        <div class="card" style="padding:1.5rem; border:2px solid var(--accent); margin-top:1.5rem;">
            <h4 style="margin-bottom:1rem;"><i class="fas fa-receipt"></i> تفاصيل الوصل #${payment.id}</h4>
            <table style="width:100%; margin-bottom:1rem;">
                <tr><td style="font-weight:700; padding:6px;">الطالب</td><td style="padding:6px;">${student ? student.name : 'غير معروف'}</td></tr>
                <tr><td style="font-weight:700; padding:6px;">الكود</td><td style="padding:6px;">${student ? student.qrCode : '-'}</td></tr>
                <tr><td style="font-weight:700; padding:6px;">البيان</td><td style="padding:6px;">${cycleTitle}</td></tr>
                <tr><td style="font-weight:700; padding:6px;">المبلغ</td><td style="padding:6px; color:var(--accent); font-weight:700;">${payment.amount} ج.م</td></tr>
                <tr><td style="font-weight:700; padding:6px;">الحالة</td><td style="padding:6px;">${statusLabel}</td></tr>
                <tr><td style="font-weight:700; padding:6px;">التاريخ</td><td style="padding:6px;">${dateStr}</td></tr>
            </table>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button class="btn btn-primary" style="background:var(--accent);" onclick="printMonthlyReceipt(${payment.id}, 'thermal')">
                    <i class="fas fa-print"></i> طباعة حرارية (80mm)
                </button>
                <button class="btn btn-primary" style="background:var(--primary);" onclick="printMonthlyReceipt(${payment.id}, 'normal')">
                    <i class="fas fa-file-invoice"></i> طباعة عادية (A4)
                </button>
                ${student ? `<button class="btn" style="background:var(--bg-light); border:1px solid var(--border);" onclick="openSmartCard(${student.id})">
                    <i class="fas fa-id-card"></i> فتح كارت الطالب
                </button>` : ''}
            </div>
        </div>
    `;
}



function handleAddExpense() {
    const t = document.getElementById('exp-title').value;
    const a = parseInt(document.getElementById('exp-amount').value);
    const c = document.getElementById('exp-category').value;
    if (!t || !a) return;
    db.expenses.push({
        id: Date.now(),
        title: t,
        amount: a,
        category: c,
        date: new Date().toISOString(), // Ensure date is stored
        groupId: currentGroupId,
        collectedBy: (typeof EmployeeAuth !== 'undefined') ? EmployeeAuth.getCurrentName() : undefined
    });
    db.save('expenses');
    renderFinances();
    updateDashboardStats(); // Refresh dashboard with deduction
    toggleModal('expense-modal', false);

    // Clear inputs
    document.getElementById('exp-title').value = '';
    document.getElementById('exp-amount').value = '';
}

function printExpensesReport() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Group context
    const groupObj = db.groups.find(g => String(g.id) === String(currentGroupId));
    const groupLabel = groupObj ? groupObj.name : 'كل المجموعات';

    // Filters expenses of current month and current group (if any)
    const expenses = db.expenses.filter(e => {
        const eDate = new Date(e.date || e.id);
        const monthMatch = eDate.getMonth() === currentMonth && eDate.getFullYear() === currentYear;
        const groupMatch = !currentGroupId || String(e.groupId) === String(currentGroupId);
        return monthMatch && groupMatch;
    });

    if (expenses.length === 0) {
        showNotification('لا يوجد مصروفات مسجلة لهذا الشهر حالياً', 'warning');
        return;
    }

    const total = expenses.reduce((sum, e) => sum + e.amount, 0);

    const win = window.open('', '_blank');
    win.document.write(`
        <html dir="rtl" lang="ar">
        <head>
            <title>كشف المصروفات - ${groupLabel}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
                body { font-family: 'Cairo', sans-serif; padding: 40px; color: #333; }
                .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #ddd; padding-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: center; }
                th { background-color: #f8f9fa; color: #555; font-weight: 700; }
                .total-box { margin-top: 30px; text-align: left; font-size: 1.4rem; font-weight: 700; color: #dc2626; }
                .timestamp { font-size: 0.8rem; color: #777; margin-top: 50px; text-align: center; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>كشف المصروفات الشهرية</h1>
                <p>الفترة: ${now.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}</p>
                <p>المجموعة الدراسية: <strong>${groupLabel}</strong></p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>البيان (التفاصيل)</th>
                        <th>الفئة</th>
                        <th>التاريخ</th>
                        <th>القيمة (ج.م)</th>
                    </tr>
                </thead>
                <tbody>
                    ${expenses.map(e => `
                        <tr>
                            <td>${e.title}</td>
                            <td>${e.category}</td>
                            <td>${new Date(e.date || e.id).toLocaleDateString('ar-EG')}</td>
                            <td style="font-weight:700;">${e.amount} ج.م</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="total-box">
                إجمالي المنصرف: ${total} ج.م
            </div>
            <div class="timestamp">
                تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}
            </div>
            <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
        </body>
        </html>
    `);
}

async function deleteStudent(id) {
    if (!rbacGuardDelete('حذف الطالب')) return;
    if (!confirm('هل أنت متأكد من حذف هذا الطالب نهائياً؟')) return;
    db.students = db.students.filter(s => s.id !== id);
    await StorageEngine.delete('students', id);
    await db.save('students');
    renderStudents();
    showNotification('تم حذف الطالب بنجاح');
}

async function clearAllStudents() {
    const confirmed = confirm('⚠️ تحذير: هل أنت متأكد من رغبتك في مسح جميع الطلاب؟\n\nسيتم حذف جميع الطلاب المسجلين والبيانات المرتبطة بهم (الحضور والدرجات وغيرها).\n\nهذا الإجراء لا يمكن التراجع عنه!');
    
    if (!confirmed) return;

    const doubleConfirm = confirm('هل أنت متأكد 100%؟ سيتم حذف جميع الطلاب نهائياً!');
    if (!doubleConfirm) return;

    try {
        // مسح جميع الطلاب من الذاكرة
        db.students = [];
        
        // مسح جميع الطلاب من IndexedDB
        const allStudents = await StorageEngine.getAll('students');
        for (const student of allStudents) {
            await StorageEngine.delete('students', student.id);
        }

        // مسح بيانات الحضور المرتبطة بهم (اختياري - يمكن تركها)
        db.attendance = [];
        const allAttendance = await StorageEngine.getAll('attendance');
        for (const att of allAttendance) {
            await StorageEngine.delete('attendance', att.id);
        }

        // مسح الدرجات المرتبطة
        db.scores = [];
        const allScores = await StorageEngine.getAll('scores');
        for (const score of allScores) {
            await StorageEngine.delete('scores', score.id);
        }

        // حفظ التغييرات
        await db.save('students');
        await db.save('attendance');
        await db.save('scores');

        // تحديث الواجهة
        renderStudents();
        showNotification('✓ تم مسح جميع الطلاب بنجاح! البرنامج الآن جديد.', 'success');
    } catch (err) {
        console.error('خطأ في مسح الطلاب:', err);
        showNotification('حدث خطأ أثناء مسح الطلاب', 'error');
    }
}

function openWhatsAppMenu(id) {
    const s = db.students.find(x => x.id === id);
    if (!s) return;
    const target = prompt("أرسل إلى:\n1 - الطالب\n2 - ولي الأمر");
    if (target === '1') sendWhatsApp(s.id, 'student');
    else if (target === '2') sendWhatsApp(s.id, 'parent');
}

function sendWhatsApp(studentId, target) {
    const s = db.students.find(x => x.id === studentId);
    if (!s) return;
    const atts = db.attendance.filter(a => a.studentId == studentId);
    let msg;
    if (target === 'student') {
        // رسالة موجّهة للطالب مباشرة
        msg = `السلام عليكم ورحمة الله وبركاته،\n\n📌 *تقرير متابعة سريع*\nعدد الحصص التي حضرتها حتى الآن: ${atts.length} حصة.\nنتمنى لك دوام التفوق والانتظام.${getTeacherSignatureLine()}`;
    } else {
        // رسالة موجّهة لولي الأمر — بنفس الهوية الرسمية الموحّدة للمنصة
        msg = buildFormalParentMessage({
            noticeType: 'تقرير متابعة سريع',
            bodyLines: [
                `نحيطكم علماً بأن الطالب/ـة *${s.name}* قد حضر/حضرت حتى تاريخه ${atts.length} حصة دراسية.`,
                `نحرص دائماً على متابعة مستواه/ـا وانتظامه/ـا، ونثمّن تواصلكم المستمر معنا.`
            ]
        });
    }
    const phone = target === 'student' ? s.phone : s.parentPhone;
    window.open(`https://wa.me/2${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

// ============================================================
//  Monthly Performance Report — Rebuilt
//  تقرير الأداء الشهري — نسخة مطوّرة بالكامل
//
//  الإصلاحات الجوهرية:
//   1) الحضور/الغياب: يُحسب من db.attendance بدقّة لكل الفترة المختارة
//      (لم يعد يعتمد على db.settings.activeCycle الهش/العام).
//   2) الامتحانات: تُفلتر بمجموعة الطالب (groupId) + صفّه + الفترة.
//      الغياب عن امتحان لا يُحسب إلا إذا كان الامتحان خاصاً بمجموعته.
//   3) الدرجات تُعرض "X من Y" + نسبة + تقييم.
//   4) تصفّح كل الشهور (الحالي + السابقة) عبر بيانات حقيقية مجمّعة
//      من الحضور/الامتحانات/الدفعات — وليس مرتبط بدورة نشطة واحدة.
//   5) بيانات الاشتراك الشهري (دفع/تاريخ/حالة/متأخرات) من db.payments.
//   6) تصميم جديد بالكامل لمنطقة التقرير.
// ============================================================

const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function _periodKey(year, month) { return `${year}-${String(month).padStart(2, '0')}`; }

function _monthBounds(year, month) {
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = new Date(year, month + 1, 1, 0, 0, 0, 0); // exclusive
    return { start, end };
}

/**
 * يبني قائمة كل "صفحات الشهر" لهذا الطالب.
 *
 * ✅ إعادة تصميم جوهرية: الصفحات دلوقتي مبنية على كل دورة اشتراك فعلية
 * (كل ضغطة "بدء الاشتراكات" → "إنهاء الاشتراك") ولها بداية ونهاية حقيقية
 * — مش مجرد تجميع حسب الشهر الميلادي زي الأول. ده يحل مشكلة إنشاء
 * اشتراكين مختلفين (باسمين مختلفين) في نفس الشهر الميلادي وكانوا
 * بيتدمجوا في صفحة واحدة ويضيع تاني اشتراك.
 *
 * أي بيانات (حضور/امتحانات/دفعات) بتقع في نطاق تاريخ دورة معينة تتحسب
 * على صفحة الدورة دي. أي بيانات "يتيمة" (قبل أي دورة، أو في فجوة بين
 * دورتين) بتترجع لصفحة احتياطية بالشهر الميلادي عشان محدش يضيع منها بيانات.
 *
 * @returns {Array<{key:string, label:string, start:Date, end:Date}>} مرتبة تنازلياً (الأحدث أولاً)
 */
function buildAvailableReportPeriods(student) {
    // ── 1. بناء قائمة الدورات الفعلية (مؤرشفة + النشطة) الخاصة بهذا الطالب ──
    const cycles = [];

    (db.cycles || []).forEach(c => {
        const sameGroup = !c.groupId || String(c.groupId) === String(student.groupId);
        const sameGrade = !c.grade  || String(c.grade)   === String(student.grade);
        if (!sameGroup || !sameGrade) return;
        const start = c.startDate ? new Date(c.startDate) : new Date(c.date || c.id);
        const end   = c.date ? new Date(c.date) : new Date(c.id);
        if (isNaN(start.getTime())) return;
        cycles.push({
            key: `cycle-${c.id}`,
            label: c.title || null,
            start,
            end: isNaN(end.getTime()) || end <= start ? new Date(start.getTime() + 24 * 60 * 60 * 1000) : end
        });
    });

    if (db.settings.activeCycle && db.settings.cycleStartDate) {
        const activeSameGroup = !db.settings.activeCycleGroupId || String(db.settings.activeCycleGroupId) === String(student.groupId);
        const activeSameGrade = !db.settings.activeCycleGrade  || String(db.settings.activeCycleGrade)  === String(student.grade);
        if (activeSameGroup && activeSameGrade) {
            cycles.push({
                key: `cycle-${db.settings.activeCycle}`,
                label: db.settings.monthlyCycleName || null,
                start: new Date(db.settings.cycleStartDate),
                end: new Date(8640000000000000) // بلا نهاية لحد ما تتقفل
            });
        }
    }

    cycles.sort((a, b) => a.start - b.start);

    // ── دالة تدور على أي دورة يقع فيها تاريخ معيّن ──────────────
    const findCycleFor = (d) => cycles.find(c => d >= c.start && d < c.end) || null;

    // ── 2. الفجوات/البيانات اليتيمة (قبل أي دورة أو بين دورتين) ─────
    //    نجمّعها احتياطياً بالشهر الميلادي عشان محدش يضيع منها بيانات
    const monthlyFallback = new Map(); // key → {year, month}
    const addFallback = (d) => {
        if (!d || isNaN(d.getTime())) return;
        if (findCycleFor(d)) return; // البيانات دي بتخص دورة موجودة بالفعل
        const y = d.getFullYear(), m = d.getMonth();
        const key = _periodKey(y, m);
        if (!monthlyFallback.has(key)) monthlyFallback.set(key, { year: y, month: m });
    };

    db.attendance.forEach(a => { if (a.studentId == student.id) addFallback(new Date(a.date)); });
    db.payments.forEach(p => {
        if (p.studentId != student.id) return;
        if (p.year && p.month) addFallback(new Date(p.year, p.month - 1, 1));
        else addFallback(new Date(p.date));
    });
    db.exams
        .filter(e => String(e.grade) === String(student.grade) &&
                     (!e.groupId || String(e.groupId) === String(student.groupId)))
        .forEach(e => addFallback(new Date(e.id)));

    // ── 3. تجميع كل الصفحات: دورات فعلية + fallback شهري + الشهر الحالي ──
    const periods = cycles.map(c => ({
        key: c.key,
        label: c.label || `${ARABIC_MONTHS[c.start.getMonth()]} ${c.start.getFullYear()}`,
        start: c.start,
        end: c.end,
        // للترتيب فقط
        year: c.start.getFullYear(), month: c.start.getMonth()
    }));

    monthlyFallback.forEach(({ year, month }, key) => {
        const { start, end } = _monthBounds(year, month);
        periods.push({ key: `month-${key}`, label: `${ARABIC_MONTHS[month]} ${year}`, start, end, year, month });
    });

    // ✅ الشهر الحالي دايمًا متاح — إلا لو أصلاً واقع جوه دورة موجودة (نشطة مثلاً)
    const now = new Date();
    if (!findCycleFor(now)) {
        const y = now.getFullYear(), m = now.getMonth();
        const key = `month-${_periodKey(y, m)}`;
        if (!periods.some(p => p.key === key)) {
            const { start, end } = _monthBounds(y, m);
            periods.push({ key, label: `${ARABIC_MONTHS[m]} ${y}`, start, end, year: y, month: m });
        }
    }

    periods.sort((a, b) => b.start - a.start);
    return periods;
}

let _currentReportState = { studentId: null, periodKey: null, periods: [] };

function generateMonthlyReport(id, forcedPeriodKey = null) {
    const s = db.students.find(x => x.id === id);
    if (!s) return;

    const periods = buildAvailableReportPeriods(s);
    let periodKey = forcedPeriodKey;
    if (!periodKey || !periods.some(p => p.key === periodKey)) {
        periodKey = periods.length ? periods[0].key : _periodKey(new Date().getFullYear(), new Date().getMonth());
    }

    _currentReportState = { studentId: id, periodKey, periods };

    renderMonthlyReportPeriodSelector();
    renderMonthlyReportBody();

    toggleModal('report-modal', true);

    // ── إصلاح 4أ: تمكين التمرير داخل الـ modal لعرض المحتوى الكامل ──
    // overflow:hidden على modal-content يمنع ظهور باقي المحتوى
    setTimeout(() => {
        const modalContent = document.querySelector('#report-modal .modal-content');
        if (modalContent) {
            modalContent.style.overflowY = 'auto';
            modalContent.style.maxHeight = '92vh';
        }
    }, 50);

    // ── إصلاح 4ب: حساب وعرض رتبة الطالب في مجموعته ──
    const rankEl = document.getElementById('rep-st-rank');
    if (rankEl) {
        const groupStudents = db.students
            .filter(x => String(x.groupId) === String(s.groupId))
            .sort((a, b) => (b.points || 0) - (a.points || 0));
        const rank = groupStudents.findIndex(x => x.id === s.id) + 1;
        rankEl.innerText = rank > 0 ? `${rank} / ${groupStudents.length}` : '---';
    }
}

function changeReportPeriod(newKey) {
    if (!_currentReportState.studentId) return;
    _currentReportState.periodKey = newKey;
    renderMonthlyReportPeriodSelector();
    renderMonthlyReportBody();
}

function stepReportPeriod(direction) {
    const { periods, periodKey } = _currentReportState;
    const idx = periods.findIndex(p => p.key === periodKey);
    if (idx === -1) return;
    const newIdx = idx - direction; // periods[0] هو الأحدث
    if (newIdx < 0 || newIdx >= periods.length) {
        // ✅ إصلاح: بدل ما الزرار يفضل معطّل بصمت (بيبان كأنه "مش شغال")،
        // بنوضّح للمستخدم إنه وصل لآخر شهر متاح، ولو مفيش إلا شهر واحد
        // بس (زي شهر تجربة واحد اتعمل)، مفيش شهر تاني يتنقل له أصلاً.
        if (periods.length <= 1) {
            showNotification('لا يوجد سوى شهر واحد مسجل حالياً لهذا الطالب — لا يوجد شهور أخرى للتنقل بينها', 'warning');
        } else if (newIdx < 0) {
            showNotification('هذا هو أحدث شهر متاح', 'warning');
        } else {
            showNotification('هذا هو أقدم شهر متاح', 'warning');
        }
        return;
    }
    changeReportPeriod(periods[newIdx].key);
}

function renderMonthlyReportPeriodSelector() {
    const wrap = document.getElementById('report-period-selector');
    if (!wrap) return;
    const { periods, periodKey, studentId } = _currentReportState;
    const idx = periods.findIndex(p => p.key === periodKey);
    const isNewest = idx <= 0;
    const isOldest = idx === periods.length - 1;

    const s = db.students.find(x => x.id === studentId);
    const hasPhone = s && s.parentPhone;

    wrap.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap; justify-content:center;">
            <button class="btn report-nav-btn" onclick="stepReportPeriod(-1)" title="الشهر السابق">
                <i class="fas fa-chevron-right"></i>
            </button>
            <select class="form-input report-period-select" onchange="changeReportPeriod(this.value)" style="margin:0; width:auto; min-width:160px; text-align:center; font-weight:700;">
                ${periods.map(p => `<option value="${p.key}" ${p.key === periodKey ? 'selected' : ''}>${p.label}</option>`).join('')}
            </select>
            <button class="btn report-nav-btn" onclick="stepReportPeriod(1)" title="الشهر التالي">
                <i class="fas fa-chevron-left"></i>
            </button>
            <button onclick="sendMonthlyReportWhatsApp()"
                title="${hasPhone ? 'إرسال التقرير لولي الأمر عبر واتساب' : 'رقم ولي الأمر غير مسجل'}"
                style="display:flex; align-items:center; gap:6px; padding:8px 18px; border-radius:10px; border:none; cursor:${hasPhone ? 'pointer' : 'not-allowed'}; font-family:inherit; font-weight:700; font-size:.9rem; background:${hasPhone ? '#25D366' : '#94a3b8'}; color:#fff; opacity:${hasPhone ? '1' : '0.6'};">
                <i class="fab fa-whatsapp" style="font-size:1.1rem;"></i>
                إرسال لولي الأمر
            </button>
        </div>
    `;
}

// ── دالة بناء وإرسال تقرير الأداء عبر واتساب ────────────────
function sendMonthlyReportWhatsApp() {
    const { studentId, periodKey, periods } = _currentReportState;
    const s = db.students.find(x => x.id === studentId);
    if (!s) return showNotification('لم يتم العثور على بيانات الطالب', 'error');

    const phone = s.parentPhone;
    if (!phone) return showNotification('رقم ولي الأمر غير مسجل لهذا الطالب', 'warning');

    const period = periods.find(p => p.key === periodKey) || periods[0];
    if (!period) return showNotification('لم يتم تحديد الشهر', 'error');

    // ✅ إصلاح: الفترة دلوقتي بتحمل start/end حقيقيين (حدود الدورة الفعلية)
    // مش بس شهر ميلادي، فلازم نستخدمهم مباشرة بدل إعادة حسابهم بالشهر.
    const { start, end } = period;

    // ── 1. حضور وغياب — عدد السجلات الفعلية ────────────────
    const periodAttsWA = db.attendance.filter(a => {
        if (a.studentId != s.id) return false;
        const d = new Date(a.date);
        return d >= start && d < end;
    });

    const sessionIdsInAttWA = new Set(
        periodAttsWA.filter(a => a.sessionId).map(a => String(a.sessionId))
    );

    const extraPresentWA = (db.absenceSessions || []).filter(sess => {
        const d = new Date(sess.date);
        if (d < start || d >= end) return false;
        if (sess.grade && String(sess.grade) !== String(s.grade)) return false;
        if (sess.groupId && String(sess.groupId) !== String(s.groupId)) return false;
        if (sessionIdsInAttWA.has(String(sess.id))) return false;
        return Array.isArray(sess.presentIds) && sess.presentIds.includes(s.id);
    });
    const extraAbsentWA = (db.absenceSessions || []).filter(sess => {
        const d = new Date(sess.date);
        if (d < start || d >= end) return false;
        if (sess.grade && String(sess.grade) !== String(s.grade)) return false;
        if (sess.groupId && String(sess.groupId) !== String(s.groupId)) return false;
        if (sessionIdsInAttWA.has(String(sess.id))) return false;
        return Array.isArray(sess.absentIds) && sess.absentIds.includes(s.id);
    });

    const presentCount = periodAttsWA.filter(a => a.status === 'present').length + extraPresentWA.length;
    const absentCount  = periodAttsWA.filter(a => a.status === 'absent').length  + extraAbsentWA.length;

    // ── 2. الامتحانات ────────────────────────────────────────
    const periodExams = db.exams.filter(e => {
        if (String(e.grade) !== String(s.grade)) return false;
        if (e.groupId && String(e.groupId) !== String(s.groupId)) return false;
        const d = new Date(e.id);
        return d >= start && d < end;
    }).sort((a, b) => a.id - b.id);

    const examRows = periodExams.map(ex => {
        const score = db.scores.find(sc => sc.examId === ex.id && sc.studentId == s.id);
        if (!score) return { exam: ex, status: 'unrecorded', mark: null };
        if (score.mark === -1) return { exam: ex, status: 'absent', mark: null };
        return { exam: ex, status: 'present', mark: score.mark };
    });

    const examsAttended = examRows.filter(r => r.status === 'present');

    // ── 3. الاشتراك ─────────────────────────────────────────
    const periodPayments = db.payments.filter(p => {
        if (p.studentId != s.id || p.category !== 'اشتراك شهري') return false;
        if (p.year && p.month) return (p.year === period.year && (p.month - 1) === period.month);
        const d = new Date(p.date);
        return d >= start && d < end;
    });
    const latestPayment = periodPayments.sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null;

    let subStatus;
    if (latestPayment) {
        subStatus = latestPayment.isExemption ? 'معفى من الاشتراك ✅' : `تم السداد ✅ (${latestPayment.amount} ج.م)`;
    } else {
        const now = new Date();
        const isPast = (period.year < now.getFullYear()) ||
            (period.year === now.getFullYear() && period.month <= now.getMonth());
        subStatus = isPast ? 'لم يتم السداد ❌' : 'لم يحن وقت الدفع بعد';
    }

    // ── 4. بناء نص الرسالة ──────────────────────────────────
    const _profileWA = getProgramProfile();
    // 🔧 الاسم مثبّت دائماً "نظام إدارة الدروس" — لا يعتمد على الإعدادات المحفوظة
    const teacherLine = {
        name: getTeacherDisplayName(),
        spec: _profileWA.specialization || 'أستاذ الرياضيات'
    };
    const examsSection = examsAttended.length > 0
        ? examsAttended.map(r => {
            const percent = Math.round((r.mark / r.exam.maxMarks) * 100);
            return `   • ${r.exam.title}: ${r.mark} من ${r.exam.maxMarks} (${percent}%)`;
          }).join('\n')
        : '   لا توجد امتحانات مسجلة لهذا الشهر';

    const allExamsSection = examRows.length > 0
        ? examRows.map(r => {
            if (r.status === 'present') {
                const percent = Math.round((r.mark / r.exam.maxMarks) * 100);
                return `   • ${r.exam.title}: ${r.mark} من ${r.exam.maxMarks} (${percent}%) ✅`;
            } else if (r.status === 'absent') {
                return `   • ${r.exam.title}: غائب ❌`;
            } else {
                return `   • ${r.exam.title}: لم تُرصد النتيجة بعد ⏳`;
            }
          }).join('\n')
        : '   لا توجد امتحانات في هذا الشهر';

    const msg = buildFormalParentMessage({
        noticeType: `تقرير الأداء الشهري — ${period.label}`,
        bodyLines: [
`الطالب/ـة: *${s.name}*
مع ${teacherLine.name} - ${teacherLine.spec}

📌 الحضور والغياب:
   • عدد الحصص التي حضرها الطالب/ـة: ${presentCount} حصة
   • عدد الحصص التي غاب عنها الطالب/ـة: ${absentCount} حصة

📌 الاختبارات:
   • عدد الاختبارات التي حضرها الطالب/ـة: ${examsAttended.length} من ${examRows.length}
${allExamsSection}

📌 الاشتراك الشهري:
   • حالة الاشتراك: ${subStatus}`
        ]
    });

    // ── 5. فتح واتساب ───────────────────────────────────────
    // تنظيف رقم الهاتف: إزالة أي مسافات أو رموز، وإضافة كود مصر 20
    const cleanPhone = String(phone).replace(/\D/g, '').replace(/^0/, '');
    const fullPhone  = cleanPhone.startsWith('20') ? cleanPhone : `20${cleanPhone}`;
    const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

function renderMonthlyReportBody() {
    const { studentId, periodKey, periods } = _currentReportState;
    const s = db.students.find(x => x.id === studentId);
    if (!s) return;
    const period = periods.find(p => p.key === periodKey) || periods[0];
    if (!period) return;

    // ✅ إصلاح: نفس منطق sendMonthlyReportWhatsApp — استخدام حدود الدورة
    // الفعلية بدل حساب حدود الشهر الميلادي من جديد.
    const { start, end } = period;
    const profile = (typeof getProgramProfile === 'function') ? getProgramProfile() : { teacherName: 'نظام إدارة الدروس', centerName: 'نظام إدارة الدروس' };
    const groupObj = db.groups.find(g => String(g.id) === String(s.groupId));
    const gradeObj = (typeof gradesList !== 'undefined') ? gradesList.find(g => String(g.id) === String(s.grade)) : null;

    // ── Header info ──
    document.getElementById('report-teacher-name').innerText = `${getTeacherDisplayName()} — ${profile.specialization || 'أستاذ الرياضيات'}`;
    document.getElementById('report-date-range').innerText = `للفترة: ${period.label}`;
    document.getElementById('rep-st-name').innerText = s.name;
    document.getElementById('rep-st-code').innerText = s.qrCode || '---';
    document.getElementById('rep-st-points').innerText = s.points || 0;
    const gradeEl = document.getElementById('rep-st-grade');
    if (gradeEl) gradeEl.innerText = gradeObj ? gradeObj.name : (s.grade || '---');
    const groupEl = document.getElementById('rep-st-group');
    if (groupEl) groupEl.innerText = groupObj ? groupObj.name : '---';

    // ──────────────────────────────────────────────────────
    // 1) الحضور والغياب — العد الفعلي بعدد السجلات لا بعدد الأيام
    //
    //  المصدر الأساسي: db.attendance (كل سجل = حصة مستقلة)
    //  المصدر الاحتياطي: db.absenceSessions (لو الجلسة أُرشفت قبل ربطها بـ attendance)
    //
    //  منطق الأولوية:
    //   - لو الجلسة عندها sessionId → الحضور محسوب من attendance مباشرة
    //   - لو الجلسة بدون sessionId في attendance → نكمّل من absenceSessions
    //   - نتجنب العدّ المزدوج: لو absenceSession مرتبطة بسجلات attendance → لا نعدّها مرتين
    // ──────────────────────────────────────────────────────

    // أ) كل سجلات attendance للطالب في الفترة
    const periodAtts = db.attendance.filter(a => {
        if (a.studentId != s.id) return false;
        const d = new Date(a.date);
        return d >= start && d < end;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    const presentAtts = periodAtts.filter(a => a.status === 'present');
    const absentAtts  = periodAtts.filter(a => a.status === 'absent');

    // ب) جلسات absenceSessions للطالب في الفترة
    //    نستخدمها فقط لو الجلسة ليس لها سجلات في attendance (جلسات قديمة)
    const sessionIdsInAttendance = new Set(
        periodAtts.filter(a => a.sessionId).map(a => String(a.sessionId))
    );

    const extraPresentSessions = (db.absenceSessions || []).filter(sess => {
        const d = new Date(sess.date);
        if (d < start || d >= end) return false;
        if (sess.grade && String(sess.grade) !== String(s.grade)) return false;
        if (sess.groupId && String(sess.groupId) !== String(s.groupId)) return false;
        // تجاهل لو الجلسة موجودة بالفعل في attendance
        if (sessionIdsInAttendance.has(String(sess.id))) return false;
        return Array.isArray(sess.presentIds) && sess.presentIds.includes(s.id);
    });

    const extraAbsentSessions = (db.absenceSessions || []).filter(sess => {
        const d = new Date(sess.date);
        if (d < start || d >= end) return false;
        if (sess.grade && String(sess.grade) !== String(s.grade)) return false;
        if (sess.groupId && String(sess.groupId) !== String(s.groupId)) return false;
        if (sessionIdsInAttendance.has(String(sess.id))) return false;
        return Array.isArray(sess.absentIds) && sess.absentIds.includes(s.id);
    });

    // ج) البناء النهائي — كل سجل = حصة مستقلة
    const presentRecords = [
        ...presentAtts,
        ...extraPresentSessions.map(sess => ({
            date: sess.date, status: 'present',
            sessionId: sess.id, _sessionName: sess.name
        }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    const absentRecords = [
        ...absentAtts,
        ...extraAbsentSessions.map(sess => ({
            date: sess.date, status: 'absent',
            sessionId: sess.id, _sessionName: sess.name
        }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    // ──────────────────────────────────────────────────────
    // 2) الامتحانات — فقط امتحانات مجموعة الطالب نفسها (أو امتحانات
    //    عامة للصف بدون مجموعة محددة)، وفي حدود الشهر المختار
    // ──────────────────────────────────────────────────────
    const periodExams = db.exams.filter(e => {
        if (String(e.grade) !== String(s.grade)) return false;
        if (e.groupId && String(e.groupId) !== String(s.groupId)) return false;
        const d = new Date(e.id);
        return d >= start && d < end;
    }).sort((a, b) => a.id - b.id);

    const examRows = periodExams.map(ex => {
        const score = db.scores.find(sc => sc.examId === ex.id && sc.studentId == s.id);
        if (!score) return { exam: ex, status: 'unrecorded', mark: null };
        if (score.mark === -1) return { exam: ex, status: 'absent', mark: null };
        return { exam: ex, status: 'present', mark: score.mark };
    });

    const examsAttended = examRows.filter(r => r.status === 'present');
    const examsAbsent = examRows.filter(r => r.status === 'absent');

    // ──────────────────────────────────────────────────────
    // 3) الاشتراك الشهري لهذا الشهر بالتحديد
    //    تنبيه: p.month محفوظ بـ 1-based (يناير=1 ... ديسمبر=12)
    //           period.month محفوظ بـ 0-based (يناير=0 ... ديسمبر=11)
    //    المقارنة الصحيحة: p.month === period.month + 1
    // ──────────────────────────────────────────────────────
    const periodPayments = db.payments.filter(p => {
        if (p.studentId != s.id || p.category !== 'اشتراك شهري') return false;
        if (p.year && p.month) return (p.year === period.year && p.month === period.month + 1);
        const d = new Date(p.date);
        return d >= start && d < end;
    });
    const latestPayment = periodPayments.sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null;

    let subscriptionStatusHtml;
    if (latestPayment) {
        if (latestPayment.isExemption) {
            subscriptionStatusHtml = `<span class="rep-badge rep-badge-info">معفى من الاشتراك</span>`;
        } else {
            const discountNote = latestPayment.discount ? ` (بعد خصم ${latestPayment.discount} ج.م)` : '';
            subscriptionStatusHtml = `<span class="rep-badge rep-badge-success">مدفوع: ${latestPayment.amount} ج.م${discountNote}</span>`;
        }
    } else {
        const now = new Date();
        const isPastOrCurrentMonth = (period.year < now.getFullYear()) ||
            (period.year === now.getFullYear() && period.month <= now.getMonth());
        subscriptionStatusHtml = isPastOrCurrentMonth
            ? `<span class="rep-badge rep-badge-danger">لم يتم الدفع — متأخرات</span>`
            : `<span class="rep-badge rep-badge-muted">لم يحن وقت الدفع بعد</span>`;
    }
    const paymentDateStr = latestPayment ? new Date(latestPayment.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }) : '---';

    // ──────────────────────────────────────────────────────
    // بناء HTML للملخص (البطاقات العلوية) + صندوق الاشتراك
    // ──────────────────────────────────────────────────────
    const summaryHtml = `
        <div class="rep-summary-grid">
            <div class="rep-stat-card rep-stat-accent">
                <div class="rep-stat-icon"><i class="fas fa-calendar-check"></i></div>
                <div class="rep-stat-value">${presentRecords.length}</div>
                <div class="rep-stat-label">حصص حضرها</div>
            </div>
            <div class="rep-stat-card rep-stat-danger">
                <div class="rep-stat-icon"><i class="fas fa-calendar-times"></i></div>
                <div class="rep-stat-value">${absentRecords.length}</div>
                <div class="rep-stat-label">حصص غاب عنها</div>
            </div>
            <div class="rep-stat-card rep-stat-primary">
                <div class="rep-stat-icon"><i class="fas fa-file-alt"></i></div>
                <div class="rep-stat-value">${examsAttended.length}</div>
                <div class="rep-stat-label">امتحانات دخلها</div>
            </div>
            <div class="rep-stat-card rep-stat-warning">
                <div class="rep-stat-icon"><i class="fas fa-user-times"></i></div>
                <div class="rep-stat-value">${examsAbsent.length}</div>
                <div class="rep-stat-label">امتحانات غاب عنها</div>
            </div>
        </div>
    `;

    const subscriptionHtml = `
        <div class="rep-subscription-box">
            <div class="rep-sub-row">
                <span class="rep-sub-label"><i class="fas fa-wallet"></i> حالة الاشتراك:</span>
                ${subscriptionStatusHtml}
            </div>
            <div class="rep-sub-row">
                <span class="rep-sub-label"><i class="fas fa-calendar-day"></i> تاريخ الدفع:</span>
                <span>${paymentDateStr}</span>
            </div>
        </div>
    `;

    // ──────────────────────────────────────────────────────
    // بناء صفوف الجدول التفصيلي
    // ──────────────────────────────────────────────────────
    let reportRows = [];

    reportRows.push(`
        <tr class="rep-section-row">
            <td colspan="4"><i class="fas fa-user-clock"></i> الحضور والانضباط</td>
        </tr>
    `);

    const totalSessions = presentRecords.length + absentRecords.length;
    const attendanceStatus = totalSessions === 0
        ? '<span class="rep-pill rep-pill-muted">لا توجد بيانات</span>'
        : presentRecords.length >= absentRecords.length
            ? '<span class="rep-pill rep-pill-good">التزام جيد</span>'
            : '<span class="rep-pill rep-pill-bad">يحتاج متابعة</span>';

    reportRows.push(`
        <tr>
            <td><strong>إحصاء عام</strong></td>
            <td>إجمالي الحصص المسجلة: <b>${totalSessions}</b> حصة</td>
            <td><span style="color:var(--accent)">✅ حضر: ${presentRecords.length}</span> &nbsp;|&nbsp; <span style="color:var(--danger)">❌ غاب: ${absentRecords.length}</span></td>
            <td>${attendanceStatus}</td>
        </tr>
    `);

    if (presentRecords.length > 0) {
        // عرض كل حصة حضور على سطر منفصل مع اسم الجلسة لو متوفر
        const presentRows = presentRecords.map((a, i) => {
            const dateStr  = new Date(a.date).toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'numeric' });
            const sessName = a._sessionName
                ? `<span style="color:var(--text-muted); font-size:.8rem;"> — ${a._sessionName}</span>`
                : '';
            return `<tr style="background:#f0fdf4;">
                <td style="color:var(--accent); padding:6px 12px;">✅ حصة ${i + 1}</td>
                <td colspan="2" style="font-size:0.88rem; padding:6px 12px;">${dateStr}${sessName}</td>
                <td style="padding:6px 12px;">حضور</td>
            </tr>`;
        }).join('');
        reportRows.push(presentRows);
    }

    if (absentRecords.length > 0) {
        const absentRows = absentRecords.map((a, i) => {
            const dateStr  = new Date(a.date).toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'numeric' });
            const sessName = a._sessionName
                ? `<span style="color:var(--text-muted); font-size:.8rem;"> — ${a._sessionName}</span>`
                : '';
            return `<tr style="background:#fff1f2;">
                <td style="color:var(--danger); padding:6px 12px;">❌ غياب ${i + 1}</td>
                <td colspan="2" style="font-size:0.88rem; padding:6px 12px;">${dateStr}${sessName}</td>
                <td style="padding:6px 12px;">غياب</td>
            </tr>`;
        }).join('');
        reportRows.push(absentRows);
    }

    if (totalSessions === 0) {
        reportRows.push(`
            <tr>
                <td colspan="4" style="text-align:center; padding:1rem; color:var(--text-muted);">
                    لا توجد سجلات حضور أو غياب لهذا الشهر
                </td>
            </tr>
        `);
    }

    reportRows.push(`
        <tr class="rep-section-row">
            <td colspan="4"><i class="fas fa-file-invoice"></i> الامتحانات (مجموعة الطالب فقط)</td>
        </tr>
    `);

    if (examRows.length === 0) {
        reportRows.push(`
            <tr>
                <td colspan="4" style="text-align:center; padding:1rem; color:var(--text-muted);">لا توجد امتحانات مسجلة لمجموعة الطالب في هذا الشهر</td>
            </tr>
        `);
    } else {
        examRows.forEach(r => {
            const ex = r.exam;
            if (r.status === 'present') {
                const percent = Math.round((r.mark / ex.maxMarks) * 100);
                const evalLabel = percent >= 90 ? 'ممتاز ⭐' : (percent >= 75 ? 'جيد جداً' : (percent >= 50 ? 'مقبول' : 'ضعيف'));
                const evalColor = percent >= 90 ? '#10b981' : (percent >= 50 ? '#f59e0b' : '#ef4444');
                reportRows.push(`
                    <tr>
                        <td><strong>امتحان</strong></td>
                        <td>${ex.title}</td>
                        <td>${r.mark} من ${ex.maxMarks} (${percent}%)</td>
                        <td style="font-weight:bold; color:${evalColor}">${evalLabel}</td>
                    </tr>
                `);
            } else if (r.status === 'absent') {
                reportRows.push(`
                    <tr style="background: #fff1f2;">
                        <td><strong>امتحان</strong></td>
                        <td>${ex.title}</td>
                        <td style="color:var(--danger)">غائب ❌</td>
                        <td style="color:var(--danger)">لا توجد نتيجة</td>
                    </tr>
                `);
            } else {
                reportRows.push(`
                    <tr style="background:#fffbeb;">
                        <td><strong>امتحان</strong></td>
                        <td>${ex.title}</td>
                        <td style="color:var(--text-muted)">لم تُرصد نتيجته بعد</td>
                        <td style="color:var(--text-muted)">—</td>
                    </tr>
                `);
            }
        });
    }

    document.getElementById('report-data-body').innerHTML = reportRows.join('');

    let topInfo = document.getElementById('report-top-info');
    if (topInfo) topInfo.innerHTML = summaryHtml + subscriptionHtml;
}

// --- 13. Data Persistence & Recovery Logic ---
// ============================================================
//  نظام النسخ الاحتياطي v3 — ضغط ذكي بهندسة علوم البيانات
//
//  تقنيات الضغط المُستخدمة:
//  1. String Interning (Dictionary Encoding):
//     كل قيمة نصية متكررة (اسم طالب، اسم مجموعة، نوع حدث...) تُخزَّن
//     مرة واحدة في جدول مركزي "_dict" وتُستبدل برقم index صغير.
//     مثال: بدل تكرار "أحمد محمد" 200 مرة في سجلات الحضور →
//            تُخزَّن مرة واحدة: dict[5] = "أحمد محمد"
//            وفي كل سجل حضور: studentName → 5
//
//  2. Column-Oriented Storage (Columnar Format):
//     بدل مصفوفة من الـ objects (row-based)، نُخزِّن مصفوفة لكل عمود.
//     مثال attendance: بدل [{id,studentId,date,status}, ...]
//     نُخزِّن: {id:[...], sid:[...], d:[...], s:[...]}
//     وهذا يضغط بشكل ممتاز لأن الأعمدة المتكررة (مثل status) تتكرر قيمها.
//
//  3. Short Key Mapping:
//     المفاتيح الطويلة (studentId → sid, status → s, date → d) توفر مساحة
//     كبيرة لأنها تتكرر بعدد الصفوف.
//
//  4. Full State Capture:
//     يُصدِّر كل شيء بدون استثناء: IndexedDB + localStorage + db._settings
//     + حالة الخزنة اليومية + الأرشيف الكامل.
//
//  التوافق: import يُحلِّل كلا الصيغتين (v2 و v3) بشفافية تامة.
// ============================================================

// ── جدول الأعمدة المختصرة لكل جدول ──────────────────────────
const _COL_MAP = {
    students:             { id:'id', name:'nm', grade:'gr', groupId:'gid', qrCode:'qr', phone:'ph', parentPhone:'pp', points:'pt', notes:'no', joinDate:'jd', centerCode:'cc', platformCode:'pc', gender:'gn', isExempt:'ex' },
    attendance:           { id:'id', studentId:'sid', date:'d', status:'s', sessionId:'ssid', grade:'gr', groupId:'gid' },
    payments:             { id:'id', studentId:'sid', date:'d', amount:'am', category:'cat', cycleId:'cid', month:'mo', year:'yr', isExemption:'xm', discount:'dc', platformFee:'pf', notes:'no', groupId:'gid', grade:'gr' },
    expenses:             { id:'id', date:'d', amount:'am', description:'ds', grade:'gr', groupId:'gid', category:'cat' },
    exams:                { id:'id', title:'ti', grade:'gr', groupId:'gid', maxMarks:'mx', date:'d' },
    scores:               { id:'id', examId:'eid', studentId:'sid', mark:'mk', date:'d' },
    absenceSessions:      { id:'id', date:'d', grade:'gr', groupId:'gid', name:'nm', presentIds:'pid', absentIds:'aid', note:'no' },
    dailyTreasuryArchives:{ id:'id', date:'d', grade:'gr', groupId:'gid', sessionName:'sn', totalSub:'ts', totalMisc:'tm', totalExp:'te', total:'tt', payments:'py', expenses:'ex' },
    cycles:               { id:'id', title:'ti', grade:'gr', groupId:'gid', startDate:'sd', endDate:'ed', isActive:'ia', monthlyFee:'mf' },
    groups:               { id:'id', name:'nm', grade:'gr', time:'ti', days:'dy', capacity:'cp', color:'cl' },
    handouts:             { id:'id', title:'ti', grade:'gr', groupId:'gid', price:'pr', date:'d' },
    studentHandouts:      { id:'id', studentId:'sid', handoutId:'hid', date:'d', paid:'pd', amount:'am' },
    rewards:              { id:'id', title:'ti', grade:'gr', pointsCost:'pc', stock:'st', icon:'ic' },
    quizzes:              { id:'id', title:'ti', grade:'gr', groupId:'gid', questions:'q', date:'d' },
    staff:                { id:'id', name:'nm', role:'ro', pin:'pi', phone:'ph', joinDate:'jd', isActive:'ia' },
    shifts:               { id:'id', staffId:'sid', date:'d', type:'tp', note:'no' },
    materials:            { id:'id', title:'ti', grade:'gr', groupId:'gid', type:'tp', url:'ur', date:'d' },
    waQueue:              { id:'id', studentId:'sid', message:'ms', type:'tp', date:'d', status:'st', phone:'ph' },
    platformCourses:      { id:'id', title:'ti', grade:'gr', price:'pr', isActive:'ia', platformCode:'pc' },
    platformSubscriptions:{ id:'id', studentId:'sid', courseId:'cid', date:'d', expiryDate:'ed', status:'st', amount:'am' },
    courseCodes:          { id:'id', code:'co', grade:'gr', groupId:'gid', used:'us', usedBy:'ub', date:'d' },
};
const _COL_MAP_REVERSE = {}; // سيُبنى عند الاستيراد

// ── ضغط جدول واحد إلى columnar format ───────────────────────
function _compressTable(tableName, rows) {
    if (!rows || rows.length === 0) return { _c: true, cols: {}, n: 0 };
    const map = _COL_MAP[tableName] || {};
    const rev = {};
    Object.entries(map).forEach(([long, short]) => { rev[short] = long; });

    // بناء الأعمدة
    const cols = {};
    const allKeys = new Set();
    rows.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));

    allKeys.forEach(longKey => {
        const shortKey = map[longKey] || longKey;
        cols[shortKey] = rows.map(r => {
            const v = r[longKey];
            if (v === undefined || v === null) return null;
            return v;
        });
    });

    return { _c: true, cols, n: rows.length };
}

// ── فك ضغط جدول واحد ─────────────────────────────────────────
function _decompressTable(tableName, compressed) {
    if (!compressed || !compressed._c) return Array.isArray(compressed) ? compressed : [];
    const { cols, n } = compressed;
    if (!n) return [];
    const map = _COL_MAP[tableName] || {};
    const rev = {};
    Object.entries(map).forEach(([long, short]) => { rev[short] = long; });

    const rows = [];
    for (let i = 0; i < n; i++) {
        const row = {};
        Object.entries(cols).forEach(([shortKey, values]) => {
            const longKey = rev[shortKey] || shortKey;
            const v = values[i];
            if (v !== null && v !== undefined) row[longKey] = v;
        });
        rows.push(row);
    }
    return rows;
}

// ── String Dictionary: يستخرج القيم النصية المتكررة ──────────
function _buildDictionary(allTablesData) {
    const freq = new Map();
    const MIN_LEN = 3; // لا نضغط strings قصيرة جداً

    function scan(v) {
        if (typeof v === 'string' && v.length >= MIN_LEN) {
            freq.set(v, (freq.get(v) || 0) + 1);
        } else if (Array.isArray(v)) {
            v.forEach(scan);
        } else if (v && typeof v === 'object') {
            Object.values(v).forEach(scan);
        }
    }

    Object.values(allTablesData).forEach(rows => {
        if (Array.isArray(rows)) rows.forEach(row => scan(row));
    });

    // فقط القيم التي تكررت أكثر من 3 مرات تستحق الضغط
    const dict = [];
    const index = new Map();
    freq.forEach((count, str) => {
        if (count > 3) {
            index.set(str, dict.length);
            dict.push(str);
        }
    });

    return { dict, index };
}

// ── تطبيق الـ dictionary على object ─────────────────────────
function _applyDict(v, index) {
    if (typeof v === 'string') {
        const idx = index.get(v);
        return idx !== undefined ? `~${idx}` : v; // ~N = مرجع للـ dictionary
    }
    if (Array.isArray(v)) return v.map(x => _applyDict(x, index));
    if (v && typeof v === 'object') {
        const out = {};
        Object.entries(v).forEach(([k, val]) => { out[k] = _applyDict(val, index); });
        return out;
    }
    return v;
}

// ── فك الـ dictionary ────────────────────────────────────────
function _resolveDict(v, dict) {
    if (typeof v === 'string' && v.startsWith('~')) {
        const idx = parseInt(v.slice(1));
        return dict[idx] !== undefined ? dict[idx] : v;
    }
    if (Array.isArray(v)) return v.map(x => _resolveDict(x, dict));
    if (v && typeof v === 'object') {
        const out = {};
        Object.entries(v).forEach(([k, val]) => { out[k] = _resolveDict(val, dict); });
        return out;
    }
    return v;
}

async function exportData() {
    try {
        showNotification('⏳ جاري تجميع وضغط البيانات... لحظة من فضلك', 'info');
        if (!StorageEngine.db) await StorageEngine.init();

        // 🔧 إصلاح: القائمة تُبنى الآن من الجداول الموجودة فعلياً في IndexedDB
        // (StorageEngine.db.objectStoreNames) بدل قائمة ثابتة، حتى يشمل النسخ
        // الاحتياطي تلقائياً أي جدول/ميزة جديدة تُضاف مستقبلاً دون تعديل هذا الكود.
        const STATIC_FALLBACK_TABLES = [
            'students', 'attendance', 'exams', 'scores', 'expenses',
            'handouts', 'studentHandouts', 'materials', 'quizzes', 'rewards',
            'payments', 'waQueue', 'groups', 'cycles', 'absenceSessions',
            'dailyTreasuryArchives', 'staff', 'shifts', 'courseCodes',
            'platformCourses', 'platformSubscriptions'
        ];
        const ALL_TABLES = (StorageEngine.db && StorageEngine.db.objectStoreNames)
            ? Array.from(new Set([...Array.from(StorageEngine.db.objectStoreNames), ...STATIC_FALLBACK_TABLES]))
            : STATIC_FALLBACK_TABLES;

        // 1. جمع كل البيانات من IndexedDB
        const rawTables = {};
        for (const t of ALL_TABLES) {
            try { rawTables[t] = await StorageEngine.getAll(t); }
            catch (e) { rawTables[t] = []; }
        }

        // 2. بناء الـ String Dictionary
        const { dict, index } = _buildDictionary(rawTables);

        // 3. ضغط كل جدول: columnar + dictionary encoding
        const compressed = {};
        for (const t of ALL_TABLES) {
            const columnar = _compressTable(t, rawTables[t]);
            compressed[t] = index.size > 0 ? _applyDict(columnar, index) : columnar;
        }

        // 4. جمع كل مفاتيح localStorage بدون استثناء (Full Snapshot)
        // 🔧 إصلاح: كانت القائمة القديمة (LS_KEYS) whitelist ثابتة ناقصة —
        // مثلاً كانت تفتقد 'edu_lesson_coding_sessions' (حالة جلسات التصحيح/الحضور
        // النشطة لكل مجموعة)، وأي إعداد أو حالة جديدة تُضاف مستقبلاً كانت ستُستبعد
        // تلقائياً من كل نسخة احتياطية. الآن يُنسخ كل شيء موجود في localStorage
        // بلا استثناء، فيتحقق الشرط: "أي خاصية... يجب أن تُحفظ تلقائياً حتى لو أُضيفت لاحقاً".
        const lsSnapshot = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k === null) continue;
            const v = localStorage.getItem(k);
            if (v !== null) lsSnapshot[k] = v;
        }

        // 5. بناء الـ snapshot النهائي
        const snapshot = {
            __alamin_backup__: true,
            __version__: 3,
            __exportDate__: new Date().toISOString(),
            __dict__: dict,            // جدول النصوص المضغوطة
            tables: compressed,        // البيانات مضغوطة
            settings: db._settings,    // كل إعدادات المجموعات (gradeKey → settings)
            gradesList: gradesList || [],
            ls: lsSnapshot,            // كل localStorage
        };

        const jsonBody = JSON.stringify(snapshot); // بدون مسافات = أصغر حجم
        const fileContent =
            `/* ALAMIN_BACKUP_V3 | ${new Date().toLocaleString('ar-EG')} | لا تعدل هذا الملف يدوياً */\n` +
            `window.edu_initial_data=${jsonBody};`;

        // 6. حساب وعرض إحصاء الضغط
        const originalSize  = JSON.stringify(rawTables).length;
        const compressedSize = jsonBody.length;
        const ratio = Math.round((1 - compressedSize / originalSize) * 100);

        const blob = new Blob([fileContent], { type: 'application/javascript; charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        a.download = 'data.js';
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);

        const totalRows = ALL_TABLES.reduce((s, t) => s + (rawTables[t] || []).length, 0);
        showNotification(
            `✅ تم حفظ النسخة الاحتياطية الكاملة!\n` +
            `📦 ${totalRows.toLocaleString()} سجل | ضغط ${ratio > 0 ? ratio + '%' : 'لا يوجد تكرار'}`,
            'success'
        );

        console.log('[Backup v3]', {
            totalRows,
            originalKB: Math.round(originalSize / 1024),
            compressedKB: Math.round(compressedSize / 1024),
            compressionRatio: ratio + '%',
            dictSize: dict.length
        });

    } catch (error) {
        console.error('Export Error:', error);
        showNotification('❌ خطأ أثناء تجميع البيانات: ' + error.message, 'error');
    }
}
async function importData(input) {
    if (!input.files || input.files.length === 0) return;

    const confirmImport = confirm('⚠️ تنبيه هام: أنت على وشك استعادة بيانات من ملف.\nسيتم دمجها مع البيانات الحالية بدون حذف أي شيء.\nهل تريد الاستمرار؟');
    if (!confirmImport) return;

    const file = input.files[0];
    // أعد تعيين قيمة الـ input حتى يمكن اختيار نفس الملف مرة أخرى
    input.value = '';

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            showNotification('⏳ جاري قراءة الملف واستعادة البيانات... يرجى الانتظار', 'info');
            const fileContent = e.target.result;

            if (!fileContent || fileContent.trim().length < 10) {
                throw new Error('الملف فارغ أو تالف');
            }

            // ── استخراج مرن للبيانات من الملف — يقبل أي صيغة ──
            let parsedData = null;

            // 🔧 محاولة 1: JSON مباشر
            try { 
                parsedData = JSON.parse(fileContent.trim());
                console.log('✅ تم قراءة الملف كـ JSON مباشر');
            } catch (_) {}

            // 🔧 محاولة 2: window.edu_initial_data = {...}; (الصيغة القياسية لنظام إدارة الدروس)
            // greedy match لضمان التقاط الـ JSON كاملاً حتى آخر }
            if (!parsedData) {
                try {
                    const m = fileContent.match(/window\.edu_initial_data\s*=\s*([\s\S]+);/);
                    if (m && m[1]) {
                        const jsonStr = m[1].substring(0, m[1].lastIndexOf('}') + 1).trim();
                        parsedData = JSON.parse(jsonStr);
                        console.log('✅ تم قراءة الملف من window.edu_initial_data (greedy)');
                    }
                } catch (_) {}
            }

            // 🔧 محاولة 3: أول بلوك {} كامل في الملف (من أول { لآخر })
            if (!parsedData) {
                try {
                    const first = fileContent.indexOf('{');
                    const last  = fileContent.lastIndexOf('}');
                    if (first !== -1 && last > first) {
                        parsedData = JSON.parse(fileContent.substring(first, last + 1));
                        console.log('✅ تم قراءة الملف من أول بلوك {}');
                    }
                } catch (_) {}
            }

            // 🔧 محاولة 4: مصفوفة [] (students مباشرة)
            if (!parsedData && fileContent.trim().startsWith('[')) {
                try {
                    const arr = JSON.parse(fileContent.trim());
                    if (Array.isArray(arr)) {
                        parsedData = { students: arr };
                        console.log('✅ تم قراءة الملف كـ مصفوفة students');
                    }
                } catch (_) {}
            }

            // 🔧 محاولة 5: تنظيف شامل — إزالة التعليقات ومتغير window ثم parse
            if (!parsedData) {
                try {
                    const cleaned = fileContent
                        .replace(/\/\*[\s\S]*?\*\//g, '')
                        .replace(/\/\/.*$/gm, '')
                        .replace(/^\s*window\.\w+\s*=\s*/m, '')
                        .trim()
                        .replace(/;\s*$/, '');
                    parsedData = JSON.parse(cleaned);
                    console.log('✅ تم قراءة الملف بعد تنظيف شامل');
                } catch (_) {}
            }

            // 🔧 محاولة 6: Function sandbox — آخر ملاذ
            if (!parsedData) {
                try {
                    const execStr = fileContent
                        .replace(/\/\*[\s\S]*?\*\//g, '')
                        .replace(/\/\/.*$/gm, '');
                    const fn = new Function('window', execStr + '; return window.edu_initial_data;');
                    const result = fn({});
                    if (result && typeof result === 'object') {
                        parsedData = result;
                        console.log('✅ تم قراءة الملف عبر Function sandbox');
                    }
                } catch (_) {}
            }

            if (!parsedData || typeof parsedData !== 'object') {
                throw new Error('لم يتم التعرف على صيغة الملف. تأكد أن الملف هو data.js الصادر من نظام إدارة الدروس.');
            }

            // ⭐ طباعة معلومات تشخيصية
            console.log('📊 البيانات المستخرجة من الملف:', {
                hasStudents: !!parsedData.students,
                studentsCount: Array.isArray(parsedData.students) ? parsedData.students.length : 0,
                hasAttendance: !!parsedData.attendance,
                attendanceCount: Array.isArray(parsedData.attendance) ? parsedData.attendance.length : 0,
                hasPayments: !!parsedData.payments,
                paymentsCount: Array.isArray(parsedData.payments) ? parsedData.payments.length : 0,
                keys: Object.keys(parsedData)
            });

            const success = await hydrateDatabase(parsedData);
            if (success) {
                showNotification('✅ تم استعادة البيانات بنجاح! سيتم تحديث البرنامج...', 'success');
                setTimeout(() => location.reload(), 2000);
            } else {
                throw new Error('تعذّر استيراد البيانات — الملف لا يحتوي على بيانات صالحة');
            }
        } catch (err) {
            console.error('Import Error:', err);
            // استخراج رسالة الخطأ بغض النظر عن نوعه (Error / Event / string)
            const errMsg = (err && err.message)
                ? err.message
                : (err && err.target && err.target.error)
                    ? err.target.error.message
                    : (typeof err === 'string' ? err : 'خطأ غير معروف — راجع Console للتفاصيل');
            alert(
                '❌ فشل استيراد النسخة الاحتياطية\n\n' +
                'السبب: ' + errMsg + '\n\n' +
                'تأكد من الآتي:\n' +
                '• الملف هو data.js الذي صدّره نظام إدارة الدروس مباشرة\n' +
                '• اسم الملف لا يهم — data.js أو data (2).js كلها مقبولة\n' +
                '• لم يتم فتح الملف وتعديله يدوياً\n' +
                '• حجم الملف أكبر من 1 كيلوبايت'
            );
        }
    };
    reader.onerror = () => {
        alert('❌ تعذّر قراءة الملف. تأكد أن الملف غير تالف وحاول مرة أخرى.');
    };
    reader.readAsText(file, 'utf-8');
}

const APP_THEME_KEY = 'alamin_theme';
const APP_THEMES = [
    { id: 'academic', name: 'أكاديمي', swatch: 'academic' },
    { id: 'emerald', name: 'زمردي', swatch: 'emerald' },
    { id: 'sunset', name: 'دافئ', swatch: 'sunset' },
    { id: 'midnight', name: 'ليلي', swatch: 'midnight' }
];

function applyAppTheme(themeId = 'academic') {
    const selected = APP_THEMES.find(t => t.id === themeId) ? themeId : 'academic';
    if (selected === 'academic') {
        document.body.removeAttribute('data-theme');
    } else {
        document.body.dataset.theme = selected;
    }
    localStorage.setItem(APP_THEME_KEY, selected);

    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === selected);
    });
}

function initThemeSwitcher() {
    if (document.getElementById('theme-switcher')) return;

    const headerActions = document.querySelector('header > div:last-child');
    if (!headerActions) return;

    const switcher = document.createElement('div');
    switcher.id = 'theme-switcher';
    switcher.className = 'theme-switcher';
    switcher.innerHTML = `
        <button class="btn theme-trigger" type="button" title="تغيير الألوان">
            <i class="fas fa-palette"></i>
        </button>
        <div class="theme-menu">
            ${APP_THEMES.map(theme => `
                <button class="theme-option" type="button" data-theme="${theme.id}">
                    <span>${theme.name}</span>
                    <span class="theme-swatch ${theme.swatch}"></span>
                </button>
            `).join('')}
        </div>
    `;

    headerActions.insertBefore(switcher, headerActions.firstChild);
    switcher.querySelector('.theme-trigger').addEventListener('click', (event) => {
        event.stopPropagation();
        switcher.classList.toggle('open');
    });

    switcher.querySelectorAll('.theme-option').forEach(btn => {
        btn.addEventListener('click', () => {
            applyAppTheme(btn.dataset.theme);
            switcher.classList.remove('open');
            showNotification(`تم تطبيق ثيم ${btn.innerText.trim()}`, 'success');
        });
    });

    document.addEventListener('click', (event) => {
        if (!switcher.contains(event.target)) switcher.classList.remove('open');
    });
}

const DAY_NIGHT_THEMES = [
    { id: 'morning', name: '\u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0635\u0628\u0627\u062d\u064a', swatch: 'morning' },
    { id: 'night', name: '\u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0644\u064a\u0644\u064a', swatch: 'night' }
];

function normalizeAppTheme(themeId = 'morning') {
    if (themeId === 'midnight' || themeId === 'night') return 'night';
    return 'morning';
}

function updateThemeControls(selected) {
    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === selected);
    });

    const toggle = document.getElementById('mode-toggle');
    if (!toggle) return;

    const isNight = selected === 'night';
    toggle.title = isNight ? '\u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0635\u0628\u0627\u062d\u064a' : '\u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0644\u064a\u0644\u064a';
    toggle.innerHTML = `<i class="fas ${isNight ? 'fa-sun' : 'fa-moon'}"></i>`;
}

function applyAppTheme(themeId = 'morning') {
    const selected = normalizeAppTheme(themeId);
    document.body.dataset.theme = selected;
    localStorage.setItem(APP_THEME_KEY, selected);
    updateThemeControls(selected);
}

function toggleDayNightMode() {
    const current = normalizeAppTheme(localStorage.getItem(APP_THEME_KEY) || document.body.dataset.theme || 'morning');
    const next = current === 'night' ? 'morning' : 'night';
    applyAppTheme(next);
    showNotification(next === 'night' ? '\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0644\u064a\u0644\u064a' : '\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0635\u0628\u0627\u062d\u064a', 'success');
}

function initThemeSwitcher() {
    if (document.getElementById('theme-switcher')) {
        updateThemeControls(normalizeAppTheme(localStorage.getItem(APP_THEME_KEY) || 'morning'));
        return;
    }

    const headerActions = document.querySelector('header > div:last-child');
    if (!headerActions) return;

    const switcher = document.createElement('div');
    switcher.id = 'theme-switcher';
    switcher.className = 'theme-switcher';
    switcher.innerHTML = `
        <button class="btn mode-toggle" id="mode-toggle" type="button" title="\u062a\u0628\u062f\u064a\u0644 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0644\u064a\u0644\u064a \u0648\u0627\u0644\u0635\u0628\u0627\u062d\u064a">
            <i class="fas fa-moon"></i>
        </button>
        <button class="btn theme-trigger" type="button" title="\u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u0648\u0636\u0639">
            <i class="fas fa-palette"></i>
        </button>
        <div class="theme-menu">
            ${DAY_NIGHT_THEMES.map(theme => `
                <button class="theme-option" type="button" data-theme="${theme.id}">
                    <span>${theme.name}</span>
                    <span class="theme-swatch ${theme.swatch}"></span>
                </button>
            `).join('')}
        </div>
    `;

    headerActions.insertBefore(switcher, headerActions.firstChild);
    switcher.querySelector('#mode-toggle').addEventListener('click', (event) => {
        event.stopPropagation();
        toggleDayNightMode();
    });

    switcher.querySelector('.theme-trigger').addEventListener('click', (event) => {
        event.stopPropagation();
        switcher.classList.toggle('open');
    });

    switcher.querySelectorAll('.theme-option').forEach(btn => {
        btn.addEventListener('click', () => {
            applyAppTheme(btn.dataset.theme);
            switcher.classList.remove('open');
            showNotification(`\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 ${btn.innerText.trim()}`, 'success');
        });
    });

    document.addEventListener('click', (event) => {
        if (!switcher.contains(event.target)) switcher.classList.remove('open');
    });

    updateThemeControls(normalizeAppTheme(localStorage.getItem(APP_THEME_KEY) || 'morning'));
}

function getActiveGradeName() {
    const gradeObj = gradesList.find(g => String(g.id) === String(currentGrade));
    return gradeObj ? gradeObj.name : 'لم يتم اختيار سنة';
}

function getActiveGroupName() {
    const groupObj = db.groups.find(g => String(g.id) === String(currentGroupId));
    return groupObj ? groupObj.name : 'كل المجموعات';
}

function updateExperienceSummary() {
    const bar = document.getElementById('app-insight-bar');
    if (!bar) return;

    const activeStudents = db.students.filter(s => {
        const gradeOk = !currentGrade || String(s.grade) === String(currentGrade);
        const groupOk = !currentGroupId || String(s.groupId) === String(currentGroupId);
        return gradeOk && groupOk;
    });

    const today = new Date().toLocaleDateString('en-CA');
    const presentToday = db.attendance.filter(a => {
        const student = db.students.find(s => s.id === a.studentId);
        return a.date === today && a.status === 'present' && student &&
            (!currentGrade || String(student.grade) === String(currentGrade)) &&
            (!currentGroupId || String(student.groupId) === String(currentGroupId));
    }).length;

    const dateLabel = new Date().toLocaleDateString('ar-EG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });

    bar.innerHTML = `
        <div class="insight-pill">
            <i class="fas fa-layer-group"></i>
            <div><small>السنة الحالية</small><strong>${getActiveGradeName()}</strong></div>
        </div>
        <div class="insight-pill">
            <i class="fas fa-users"></i>
            <div><small>المجموعة</small><strong>${getActiveGroupName()}</strong></div>
        </div>
        <div class="insight-pill">
            <i class="fas fa-user-check"></i>
            <div><small>حضور اليوم</small><strong>${presentToday} / ${activeStudents.length}</strong></div>
        </div>
        <div class="insight-pill">
            <i class="fas fa-calendar-day"></i>
            <div><small>اليوم</small><strong>${dateLabel}</strong></div>
        </div>
    `;
}

function initExperienceSummary() {
    if (document.getElementById('app-insight-bar')) {
        updateExperienceSummary();
        return;
    }

    const header = document.querySelector('.main-content > header');
    if (!header) return;

    const bar = document.createElement('div');
    bar.id = 'app-insight-bar';
    bar.className = 'app-insight-bar';
    header.insertAdjacentElement('afterend', bar);
    updateExperienceSummary();
}

function initQuickDock() {
    if (document.getElementById('quick-dock')) return;

    const dock = document.createElement('div');
    dock.id = 'quick-dock';
    dock.className = 'quick-dock';
    dock.innerHTML = `
        <button class="btn quick-dock-btn" type="button" title="الرئيسية" data-action="dashboard"><i class="fas fa-home"></i></button>
        <button class="btn quick-dock-btn" type="button" title="اختيار السنة والمجموعة" data-action="portal"><i class="fas fa-layer-group"></i></button>
        <button class="btn quick-dock-btn" type="button" title="الحضور" data-action="attendance"><i class="fas fa-qrcode"></i></button>
        <button class="btn quick-dock-btn" type="button" title="الخزينة" data-action="payments"><i class="fas fa-wallet"></i></button>
        <button class="btn quick-dock-btn" type="button" title="نسخة احتياطية" data-action="backup"><i class="fas fa-shield-alt"></i></button>
    `;
    document.body.appendChild(dock);

    dock.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        if (action === 'portal') {
            enterPortalMode();
        } else if (action === 'backup') {
            exportData();
        } else {
            showSection(action);
        }
        updateExperienceSummary();
    });
}

function initExperienceEnhancements() {
    applyAppTheme(localStorage.getItem(APP_THEME_KEY) || 'morning');
    initThemeSwitcher();
    initExperienceSummary();
    initQuickDock();
    initProgramSettings();
}

function getProgramProfile() {
    if (!db._settings.appProfile) {
        db._settings.appProfile = {
            centerName: 'نظام إدارة الدروس',
            teacherName: '',
            specialization: 'أستاذ الرياضيات',
            phone: '',
            absenceMessage: 'السلام عليكم ورحمة الله وبركاته،\nنحيط سيادتكم علماً بأن الطالب/ـة {StudentName} لم يحضر/تحضر الحصة الدراسية اليوم.\nنرجو التكرم بمتابعة سبب الغياب.',
            reportMessage: 'السلام عليكم ورحمة الله وبركاته،\nنرفق لسيادتكم تقرير الأداء الشهري للطالب/ـة {StudentName}.\nنسأل الله لابنكم/ابنتكم دوام التوفيق والنجاح.'
        };
    }
    // ✅ توافق مع الملفات القديمة: تأكد من وجود الحقول الجديدة دائماً
    if (!db._settings.appProfile.specialization) {
        db._settings.appProfile.specialization = 'أستاذ الرياضيات';
    }
    if (db._settings.appProfile.absenceMessage === undefined) {
        db._settings.appProfile.absenceMessage = 'السلام عليكم ورحمة الله وبركاته،\nنحيط سيادتكم علماً بأن الطالب/ـة {StudentName} لم يحضر/تحضر الحصة الدراسية اليوم.\nنرجو التكرم بمتابعة سبب الغياب.';
    }
    if (db._settings.appProfile.reportMessage === undefined) {
        db._settings.appProfile.reportMessage = 'السلام عليكم ورحمة الله وبركاته،\nنرفق لسيادتكم تقرير الأداء الشهري للطالب/ـة {StudentName}.\nنسأل الله لابنكم/ابنتكم دوام التوفيق والنجاح.';
    }
    // إذا كان teacherName قديماً (نظام إدارة الدروس) وليس اسم مدرس حقيقي، نتركه فارغاً
    if (db._settings.appProfile.teacherName === 'نظام إدارة الدروس') {
        db._settings.appProfile.teacherName = '';
    }
    if (!db._settings.appProfile.centerName) {
        db._settings.appProfile.centerName = 'سنتر العباقرة';
    }

    return db._settings.appProfile;
}

/** يعيد اسم المدرس المحفوظ في الإعدادات، أو نص بديل إن لم يُعيَّن */
function getTeacherDisplayName() {
    const profile = getProgramProfile();
    return (profile.teacherName && profile.teacherName.trim()) ? profile.teacherName.trim() : 'سنتر العباقرة';
}

/** يعيد نص رسالة الغياب بعد استبدال {StudentName} باسم الطالب */
function buildAbsenceMessageForStudent(studentName) {
    const profile = getProgramProfile();
    const template = profile.absenceMessage || 'السلام عليكم،\nالطالب/ـة {StudentName} لم يحضر اليوم.';
    return template.replace(/\{StudentName\}/g, studentName);
}

/** يعيد نص رسالة تقرير الأداء بعد استبدال {StudentName} باسم الطالب */
function buildReportMessageForStudent(studentName) {
    const profile = getProgramProfile();
    const template = profile.reportMessage || 'السلام عليكم،\nتقرير أداء الطالب/ـة {StudentName}.';
    return template.replace(/\{StudentName\}/g, studentName);
}

// نص هوية النظام الجاهز للإضافة أسفل أي رسالة (واتساب / SMS)
// ✅ تم تحديثه: الاسم يُقرأ الآن من إعدادات البرنامج (اسم المدرس).
function getTeacherSignatureLine() {
    const name = getTeacherDisplayName();
    const profile = getProgramProfile();
    const spec = profile.specialization || 'أستاذ الرياضيات';
    return `\n\n━━━━━━━━━━━━━━\n*${name}*\n${spec}`;
}
// للتوافق مع الأكواد القديمة التي تستخدم TEACHER_FIXED_NAME مباشرة
// يُعاد تعريفه كدالة getter بدلاً من ثابت
Object.defineProperty(window, 'TEACHER_FIXED_NAME', {
    get() { return getTeacherDisplayName(); },
    configurable: true
});

// ============================================================
//  نظام موحّد لصياغة رسائل أولياء الأمور — هوية لغوية واحدة للمنصة
//  ============================================================
//  يُستخدم في كل رسالة تُرسَل لولي أمر (غياب، تقرير أداء، نتيجة اختبار،
//  تنبيه أكاديمي، تهنئة تفوق ...) لضمان مقدمة ترحيبية رسمية موحّدة،
//  عرض منظم للتفاصيل حسب نوع الرسالة، وخاتمة داعية + توقيع واحد للجميع.
//
//  bodyLines: مصفوفة أسطر تفاصيل الرسالة (تُبنى حسب نوع الإشعار)
//  noticeType: عنوان نوع الإشعار الذي يظهر أعلى التفاصيل (مثال: "إشعار غياب")
//  closing: خاتمة مخصّصة (اختياري) — إن لم تُمرَّر تُستخدم الخاتمة الافتراضية
// ============================================================
function buildFormalParentMessage({ noticeType = '', bodyLines = [], closing = null } = {}) {
    const intro =
`السلام عليكم ورحمة الله وبركاته،
يسرنا أن نطلع سيادتكم على آخر مستجدات المستوى الدراسي لابنكم/ابنتكم:`;

    const typeLine = noticeType ? `📌 *نوع الإشعار:* ${noticeType}\n` : '';
    const body = (Array.isArray(bodyLines) ? bodyLines : [String(bodyLines || '')]).join('\n');

    const defaultClosing =
`نسأل الله لابنكم/ابنتكم دوام التوفيق والنجاح، ونؤكد حرصنا الدائم على متابعة المستوى الدراسي والتواصل المستمر مع أولياء الأمور بما يحقق أفضل النتائج.`;

    return `${intro}\n\n${typeLine}${body}\n\n${closing || defaultClosing}${getTeacherSignatureLine()}`;
}

// ============================================================
//  سجل التعديلات المالية على الأرشيف — Financial Archive Audit Log
//  يُخزَّن داخل db._settings حتى لا يتطلب تعديل مخطط IndexedDB
// ============================================================
function getFinancialEditLog() {
    if (!Array.isArray(db._settings.financialEditLog)) {
        db._settings.financialEditLog = [];
    }
    return db._settings.financialEditLog;
}

function _currentEditorLabel() {
    const profile = getProgramProfile();
    const roleLabel = (typeof RBAC !== 'undefined' && RBAC.isAdmin && RBAC.isAdmin()) ? 'المشرف' : 'مستخدم';
    return `${roleLabel} — ${getTeacherDisplayName()}`;
}

/**
 * تعديل حالة اشتراك طالب داخل دورة (شهر) مؤرشفة بالفعل:
 * يسجل دفعة جديدة بتاريخ الدورة نفسها، يسجل العملية في سجل التعديلات المالية،
 * ثم يعيد حساب كل التقارير المرتبطة تلقائياً.
 * @param {number|string} cycleId
 * @param {number|string} studentId
 * @returns {boolean} نجاح العملية
 */
function recordArchivedMonthPayment(cycleId, studentId) {
    const cycle = db.cycles.find(c => c.id == cycleId);
    const student = db.students.find(s => s.id == studentId);
    if (!cycle || !student) {
        if (typeof showNotification === 'function') showNotification('تعذر العثور على الدورة أو الطالب', 'error');
        return false;
    }

    const alreadyPaid = db.payments.some(p =>
        p.studentId == student.id && p.category === 'اشتراك شهري' && p.cycleId == cycle.id
    );
    if (alreadyPaid) {
        if (typeof showNotification === 'function') showNotification('الطالب مسدد بالفعل لهذه الدورة', 'warning');
        return false;
    }

    const amount = cycle.fee || db.settings.monthlyFee || 0;
    const cycleDate = cycle.date ? new Date(cycle.date) : new Date();

    const newPayment = {
        id: Date.now(),
        studentId: student.id,
        amount,
        month: cycleDate.getMonth() + 1,
        year: cycleDate.getFullYear(),
        date: cycleDate.toISOString(),
        category: 'اشتراك شهري',
        cycleId: cycle.id,
        archivedEdit: true, // ✅ علامة تدل أن هذا السداد تم تسجيله بأثر رجعي من الأرشيف
        collectedBy: (typeof EmployeeAuth !== 'undefined') ? EmployeeAuth.getCurrentName() : undefined
    };
    db.payments.push(newPayment);

    // ── تسجيل العملية في سجل التعديلات المالية ──────────────────
    const log = getFinancialEditLog();
    log.push({
        id: Date.now() + 1,
        studentId: student.id,
        studentName: student.name,
        cycleId: cycle.id,
        month: cycle.title,
        oldStatus: 'غير مسدد',
        newStatus: 'تم السداد',
        amount,
        paymentId: newPayment.id,
        editDate: new Date().toLocaleDateString('ar-EG'),
        editTime: new Date().toLocaleTimeString('ar-EG'),
        editedBy: _currentEditorLabel()
    });

    // ✅ حفظ جميع الجداول المتأثرة (payments + الإعدادات وسجل التعديلات)
    db.save();

    // ── إعادة حساب كل التقارير والإحصائيات تلقائياً ─────────────
    if (typeof renderFinances === 'function') renderFinances();
    if (typeof renderMonthlySubscriptionTables === 'function') renderMonthlySubscriptionTables();
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
    if (typeof updateExperienceSummary === 'function') updateExperienceSummary();

    if (typeof showNotification === 'function') {
        showNotification(`تم تسجيل سداد ${student.name} عن ${cycle.title} بنجاح ✅`, 'success');
    }
    return true;
}

// عرض سجل كل التعديلات المالية في نافذة قابلة للطباعة
function viewFinancialEditLog() {
    const log = getFinancialEditLog();
    const profile = getProgramProfile();
    const rows = log.slice().reverse().map(e => `
        <tr>
            <td>${e.studentName}</td>
            <td>${e.month}</td>
            <td style="color:#ef4444;">${e.oldStatus}</td>
            <td style="color:#16a34a; font-weight:700;">${e.newStatus}</td>
            <td>${e.amount} ج.م</td>
            <td>${e.editDate}</td>
            <td>${e.editTime}</td>
            <td>${e.editedBy}</td>
        </tr>
    `).join('') || `<tr><td colspan="8" style="text-align:center; padding:2rem;">لا توجد تعديلات مسجلة بعد</td></tr>`;

    const html = `
        <html dir="rtl"><head><title>سجل التعديلات المالية</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;800&display=swap');
            body { font-family: 'Tajawal', sans-serif; padding: 20px; background:#f8fafc; color:#1e293b; }
            h2 { border-bottom: 3px solid #4f46e5; padding-bottom: 10px; }
            .sub { color:#64748b; margin-bottom: 20px; }
            table { width:100%; border-collapse: collapse; background:#fff; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
            th, td { padding: 10px 12px; text-align: center; border-bottom: 1px solid #e2e8f0; font-size: 0.85rem; }
            th { background:#4f46e5; color:#fff; }
        </style></head><body>
        <h2><i class="fas fa-history"></i> سجل التعديلات المالية على الأرشيف</h2>
        <div class="sub">${getTeacherDisplayName()} — ${profile.specialization || 'أستاذ الرياضيات'}</div>
        <table>
            <thead><tr>
                <th>اسم الطالب</th><th>الشهر / الدورة</th><th>الحالة القديمة</th><th>الحالة الجديدة</th>
                <th>المبلغ</th><th>تاريخ التعديل</th><th>وقت التعديل</th><th>تم بواسطة</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
        </body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
}

function applyProgramProfile() {
    const profile = getProgramProfile();
    document.title = `${profile.centerName} | نظام الإدارة`;

    const logo = document.querySelector('.logo');
    if (logo) logo.innerHTML = `<i class="fas fa-book-open"></i> ${profile.centerName || 'سنتر العباقرة'}`;

    const userName = document.querySelector('.user-profile span');
    if (userName) userName.innerText = getTeacherDisplayName();

    const userSpec = document.querySelector('.user-profile .user-specialization');
    if (userSpec) userSpec.innerText = profile.specialization || 'أستاذ الرياضيات';
}

function initProgramSettings() {
    ensureSettingsNavItem();
    ensureSettingsSection();
    applyProgramProfile();
}

function ensureSettingsNavItem() {
    if (document.getElementById('nav-settings')) return;

    const nav = document.querySelector('.nav-links');
    if (!nav) return;

    const item = document.createElement('li');
    item.className = 'nav-item';
    item.innerHTML = `
        <a href="#" class="nav-link" id="nav-settings" onclick="showSection('settings', this)">
            <i class="fas fa-sliders-h" style="color:var(--primary-light)"></i>
            <span>إعدادات البرنامج</span>
        </a>
    `;

    const backup = document.getElementById('nav-backup')?.closest('.nav-item');
    nav.insertBefore(item, backup || nav.lastElementChild);
}

function ensureSettingsSection() {
    if (document.getElementById('settings-section')) return;

    const main = document.querySelector('.main-content');
    if (!main) return;

    const section = document.createElement('section');
    section.id = 'settings-section';
    section.className = 'fade-in';
    section.style.display = 'none';
    section.innerHTML = `
        <div class="settings-grid">
            <div class="settings-panel">
                <h3><i class="fas fa-school"></i> بيانات البرنامج</h3>
                <div class="settings-row">
                    <label for="settings-center-name">اسم السنتر أو البرنامج</label>
                    <input id="settings-center-name" class="form-input" type="text">
                </div>
                <div class="settings-row">
                    <label for="settings-teacher-name">اسم المدرس</label>
                    <input id="settings-teacher-name" class="form-input" type="text" placeholder="مثال: محمد أحمد">
                </div>
                <div class="settings-row">
                    <label for="settings-specialization">التخصص / الوظيفة</label>
                    <input id="settings-specialization" class="form-input" type="text" placeholder="مثال: أستاذ الرياضيات">
                </div>
                <div class="settings-row">
                    <label for="settings-phone">رقم التواصل</label>
                    <input id="settings-phone" class="form-input" type="text">
                </div>
                <button class="btn btn-primary" onclick="saveProgramSettings()">
                    <i class="fas fa-save"></i> حفظ الإعدادات
                </button>
            </div>

            <div class="settings-panel" style="grid-column: span 2;">
                <h3><i class="fas fa-comment-alt"></i> نصوص الرسائل</h3>
                <div class="settings-row">
                    <label for="settings-absence-message">نص رسالة الغياب اليومية</label>
                    <small style="color:var(--text-muted); display:block; margin-bottom:0.5rem;">استخدم <code>{StudentName}</code> ليتم استبداله باسم الطالب تلقائياً عند الإرسال.</small>
                    <textarea id="settings-absence-message" class="form-input" style="height:130px; resize:vertical; font-size:0.9rem;"></textarea>
                </div>
                <div class="settings-row" style="margin-top:1rem;">
                    <label for="settings-report-message">نص رسالة تقرير الأداء الشهري</label>
                    <small style="color:var(--text-muted); display:block; margin-bottom:0.5rem;">استخدم <code>{StudentName}</code> ليتم استبداله باسم الطالب تلقائياً عند الإرسال.</small>
                    <textarea id="settings-report-message" class="form-input" style="height:130px; resize:vertical; font-size:0.9rem;"></textarea>
                </div>
                <button class="btn btn-primary" style="margin-top:1rem;" onclick="saveProgramSettings()">
                    <i class="fas fa-save"></i> حفظ الرسائل
                </button>
            </div>

            <div class="settings-panel">
                <h3><i class="fas fa-wallet"></i> الاشتراك والمالية</h3>
                <div class="settings-row">
                    <label for="settings-monthly-fee">قيمة الاشتراك الافتراضية</label>
                    <input id="settings-monthly-fee" class="form-input" type="number" min="0" step="1">
                </div>
                <div class="settings-row">
                    <label for="settings-commission">نسبة السنتر الافتراضية %</label>
                    <input id="settings-commission" class="form-input" type="number" min="0" max="100" step="1">
                </div>
                <p class="settings-note">هذه القيم تطبق على السنة الدراسية الحالية، ويمكن تغييرها لكل سنة بشكل مستقل.</p>
                <button class="btn settings-choice" onclick="viewFinancialEditLog()" style="margin-top:10px;">
                    <i class="fas fa-history"></i> سجل التعديلات المالية على الأرشيف
                </button>
            </div>

            <div class="settings-panel">
                <h3><i class="fas fa-palette"></i> المظهر والتكبير</h3>
                <div class="settings-actions">
                    <button id="settings-morning-btn" class="btn settings-choice" onclick="applyAppTheme('morning'); renderProgramSettings();">
                        <i class="fas fa-sun"></i> صباحي
                    </button>
                    <button id="settings-night-btn" class="btn settings-choice" onclick="applyAppTheme('night'); renderProgramSettings();">
                        <i class="fas fa-moon"></i> ليلي
                    </button>
                </div>
                <div class="settings-actions">
                    <button class="btn settings-choice" onclick="changeAppZoom(-0.1); renderProgramSettings();">
                        <i class="fas fa-search-minus"></i> تصغير
                    </button>
                    <button class="btn settings-choice" onclick="resetAppZoom(); renderProgramSettings();">
                        <i class="fas fa-sync-alt"></i> 100%
                    </button>
                    <button class="btn settings-choice" onclick="changeAppZoom(0.1); renderProgramSettings();">
                        <i class="fas fa-search-plus"></i> تكبير
                    </button>
                </div>
                <p class="settings-note">التكبير الحالي: <strong id="settings-zoom-label">100%</strong></p>
            </div>

            <div class="settings-panel">
                <h3><i class="fas fa-lock"></i> الأمان وكلمات المرور</h3>
                <div class="settings-actions">
                    <button class="btn btn-primary" onclick="openPasswordManagement()">
                        <i class="fas fa-key"></i> إدارة كلمات المرور
                    </button>
                    <button class="btn btn-primary" style="background:linear-gradient(135deg,#0ea5e9,#0284c7);" onclick="openEmployeeManagement()">
                        <i class="fas fa-users-cog"></i> إدارة المستخدمين (الموظفين)
                    </button>
                    <button class="btn settings-choice" onclick="toggleDayNightMode(); renderProgramSettings();">
                        <i class="fas fa-adjust"></i> تبديل الوضع
                    </button>
                </div>
                <p class="settings-note">يمكنك تغيير كلمة مرور الدخول، الخزينة، فك الحماية، وأكواد الموظفين.</p>
                <p class="settings-note">أضف مستخدمين بأسمائهم (مثل: محمد، أحمد) — سيُطلب من كل موظف اختيار اسمه عند الدخول، ويُسجَّل اسمه تلقائياً مع كل عملية تحصيل مالي.</p>
            </div>

            <div class="settings-panel">
                <h3><i class="fas fa-print"></i> الطباعة</h3>
                <div class="settings-row">
                    <label for="settings-print-width">عرض الطابعة الحرارية الافتراضي</label>
                    <select id="settings-print-width" class="form-input">
                        <option value="58mm">58mm</option>
                        <option value="80mm">80mm</option>
                    </select>
                </div>
                <button class="btn settings-choice" onclick="generatePrintCalibration()">
                    <i class="fas fa-ruler"></i> طباعة معايرة
                </button>
            </div>

            <div class="settings-panel">
                <h3><i class="fas fa-shield-alt"></i> النسخ الاحتياطي</h3>
                <div class="settings-actions">
                    <button class="btn btn-primary" onclick="exportData()">
                        <i class="fas fa-download"></i> نسخة أمان الآن
                    </button>
                    <label class="btn settings-choice" for="settings-import-file">
                        <i class="fas fa-upload"></i> استيراد نسخة
                    </label>
                    <input id="settings-import-file" type="file" accept=".js,.json" style="display:none" onchange="importData(this)">
                </div>
                <p class="settings-note">احفظ نسخة احتياطية قبل أي تعديل كبير أو نقل البرنامج لجهاز آخر. الملف المُصدَّر يعمل على أي جهاز أو متصفح.</p>
            </div>

            <div class="settings-panel">
                <h3><i class="fas fa-clock"></i> تصفير العهدة اليومية التلقائي</h3>
                <div class="settings-row">
                    <label for="settings-archive-hour">ساعة التصفير والأرشفة التلقائية</label>
                    <select id="settings-archive-hour" class="form-input" onchange="saveTreasuryArchiveHour(this.value)">
                        <option value="0">12:00 منتصف الليل (12 AM)</option>
                        <option value="1">1:00 ص</option>
                        <option value="2">2:00 ص</option>
                        <option value="3">3:00 ص</option>
                        <option value="4">4:00 ص</option>
                        <option value="5">5:00 ص</option>
                        <option value="6">6:00 ص</option>
                        <option value="7">7:00 ص</option>
                        <option value="8">8:00 ص</option>
                        <option value="9">9:00 م</option>
                        <option value="21">9:00 م</option>
                        <option value="22">10:00 م</option>
                        <option value="23">11:00 م</option>
                    </select>
                </div>
                <div class="settings-actions" style="margin-top:10px;">
                    <button class="btn btn-primary" onclick="runManualTreasuryArchiveNow()">
                        <i class="fas fa-archive"></i> أرشفة العهدة الآن يدوياً
                    </button>
                </div>
                <p class="settings-note">عند الوصول للساعة المحددة يتم حفظ العهدة اليومية في الأرشيف تلقائياً وتصفيرها. يمكنك أيضاً الأرشفة اليدوية في أي وقت.</p>
            </div>
        </div>
    `;
    main.appendChild(section);
}

function renderProgramSettings() {
    ensureSettingsSection();
    document.getElementById('page-title').innerText = 'إعدادات البرنامج';

    const profile = getProgramProfile();
    const center = document.getElementById('settings-center-name');
    const teacher = document.getElementById('settings-teacher-name');
    const specialization = document.getElementById('settings-specialization');
    const phone = document.getElementById('settings-phone');
    const fee = document.getElementById('settings-monthly-fee');
    const commission = document.getElementById('settings-commission');
    const printWidth = document.getElementById('settings-print-width');
    const zoom = document.getElementById('settings-zoom-label');

    if (center) center.value = profile.centerName || '';
    // ✅ اسم المدرس الآن يُقرأ من الإعدادات مباشرة (يعبّئه المدير بنفسه)
    if (teacher) teacher.value = profile.teacherName || '';
    if (specialization) specialization.value = profile.specialization || '';
    if (phone) phone.value = profile.phone || '';
    if (fee) fee.value = db.settings.monthlyFee || 0;
    if (commission) commission.value = db.settings.centerCommissionPercent || 0;
    if (printWidth) printWidth.value = localStorage.getItem('alamin_print_width') || '80mm';
    if (zoom) zoom.innerText = `${Math.round(appZoom * 100)}%`;

    // ✅ تعبئة حقول نصوص الرسائل
    const absenceMsgEl = document.getElementById('settings-absence-message');
    const reportMsgEl = document.getElementById('settings-report-message');
    if (absenceMsgEl) absenceMsgEl.value = profile.absenceMessage || '';
    if (reportMsgEl) reportMsgEl.value = profile.reportMessage || '';

    const activeTheme = normalizeAppTheme(localStorage.getItem(APP_THEME_KEY) || 'morning');
    document.getElementById('settings-morning-btn')?.classList.toggle('active', activeTheme === 'morning');
    document.getElementById('settings-night-btn')?.classList.toggle('active', activeTheme === 'night');
    // ── ساعة أرشفة العهدة ──
    const archiveHourSelect = document.getElementById('settings-archive-hour');
    if (archiveHourSelect) {
        const savedHour = String(
            (db._settings && db._settings.treasuryArchiveHour != null)
                ? db._settings.treasuryArchiveHour
                : (localStorage.getItem('treasuryArchiveHour') || '0')
        );
        archiveHourSelect.value = savedHour;
    }

}

function saveProgramSettings() {
    const profile = getProgramProfile();
    profile.centerName = document.getElementById('settings-center-name')?.value.trim() || 'نظام إدارة الدروس';
    // ✅ اسم المدرس يُحفظ من حقل الإدخال مباشرة (يُدخله المدير مرة واحدة)
    profile.teacherName = document.getElementById('settings-teacher-name')?.value.trim() || '';
    profile.specialization = document.getElementById('settings-specialization')?.value.trim() || 'أستاذ الرياضيات';
    profile.phone = document.getElementById('settings-phone')?.value.trim() || '';

    // ✅ حفظ نصوص الرسائل
    const absenceMsg = document.getElementById('settings-absence-message')?.value || '';
    const reportMsg = document.getElementById('settings-report-message')?.value || '';
    if (absenceMsg) profile.absenceMessage = absenceMsg;
    if (reportMsg) profile.reportMessage = reportMsg;

    const monthlyFee = parseFloat(document.getElementById('settings-monthly-fee')?.value || '0');
    const commission = parseFloat(document.getElementById('settings-commission')?.value || '0');
    db.settings.monthlyFee = Number.isFinite(monthlyFee) ? Math.max(0, monthlyFee) : 0;
    db.settings.centerCommissionPercent = Number.isFinite(commission) ? Math.min(100, Math.max(0, commission)) : 0;

    const printWidth = document.getElementById('settings-print-width')?.value || '80mm';
    localStorage.setItem('alamin_print_width', printWidth);
    localStorage.setItem('edu_master_settings', JSON.stringify(db._settings));

    applyProgramProfile();
    updateExperienceSummary();
    showNotification('تم حفظ إعدادات البرنامج بنجاح', 'success');
}
// --- Firebase Export Logic ---
// ─── تحويل gradeId (رقم gradesList) إلى systemCode (مستخدم في group.grade) ───
function gradeIdToSystemCode(rawId) {
    const g = String(rawId || '').trim();
    const TABLE = {
        '301':'1','302':'2','303':'3',
        '201':'prep1','202':'prep2','203':'prep3',
        '101':'prim1','102':'prim2','103':'prim3',
        '104':'prim4','105':'prim5','106':'prim6',
    };
    if (TABLE[g]) return TABLE[g];
    // لو كان systemCode بالفعل (مثل '3', 'prep3') يرجعه كما هو
    if (typeof normalizeGrade === 'function') {
        const n = normalizeGrade(g);
        if (n) return n;
    }
    return g;
}

function mapOfflineGradeToPlatformGrade(gradeId) {
    const grade = String(gradeId || '');
    const direct = { '301': '1', '302': '2', '303': '3', '203': 'prep3' };
    if (direct[grade]) return direct[grade];
    if (['1', '2', '3', 'prep3', 'all'].includes(grade)) return grade;
    const gradeObj = gradesList.find(g => String(g.id) === grade);
    const name = gradeObj ? gradeObj.name : '';
    if (name.includes('الأول') && name.includes('الثانوي')) return '1';
    if (name.includes('الثاني') && name.includes('الثانوي')) return '2';
    if (name.includes('الثالث') && name.includes('الثانوي')) return '3';
    if (name.includes('الثالث') && name.includes('الإعدادي')) return 'prep3';
    return grade;
}
function platformGradeLabel(gradeId) {
    const grade = String(gradeId || '');
    const mappedNames = { '1': 'الأول الثانوي', '2': 'الثاني الثانوي', '3': 'الثالث الثانوي', 'prep3': 'الثالث الإعدادي', 'all': 'كل الصفوف' };
    if (mappedNames[grade]) return mappedNames[grade];
    const gradeObj = gradesList.find(g => String(g.id) === grade || String(mapOfflineGradeToPlatformGrade(g.id)) === grade);
    return gradeObj ? gradeObj.name : (grade || 'غير محدد');
}
function getPlatformCodesFiltered() {
    const grade = document.getElementById('platform-codes-grade')?.value || '';
    const course = document.getElementById('platform-codes-course')?.value || '';
    const search = (document.getElementById('platform-codes-search')?.value || '').trim().toLowerCase();
    return (db.courseCodes || []).filter(code => {
        const codeGrade = String(code.grade || '');
        const matchesGrade = !grade || codeGrade === grade;
        const matchesCourse = !course || String(code.courseId || '') === course;
        const haystack = `${code.linkedStudentName || ''} ${code.code || ''} ${code.courseTitle || ''}`.toLowerCase();
        return matchesGrade && matchesCourse && (!search || haystack.includes(search));
    }).sort((a, b) => String(a.linkedStudentName || '').localeCompare(String(b.linkedStudentName || ''), 'ar'));
}
function initPlatformCodesSection() {
    renderPlatformCodesFilters();
    renderPlatformCodesSection();
}
function renderPlatformCodesFilters() {
    const gradeSelect = document.getElementById('platform-codes-grade');
    const courseSelect = document.getElementById('platform-codes-course');
    if (!gradeSelect || !courseSelect) return;
    const currentGradeValue = gradeSelect.value;
    const currentCourseValue = courseSelect.value;
    const grades = [...new Set((db.courseCodes || []).map(c => String(c.grade || '')).filter(Boolean))];
    gradeSelect.innerHTML = '<option value="">كل الصفوف</option>' + grades.map(g => `<option value="${g}">${platformGradeLabel(g)}</option>`).join('');
    if (grades.includes(currentGradeValue)) gradeSelect.value = currentGradeValue;
    const selectedGrade = gradeSelect.value;
    const courses = (db.courseCodes || []).filter(c => !selectedGrade || String(c.grade || '') === selectedGrade);
    const uniqueCourses = [];
    courses.forEach(c => {
        if (c.courseId && !uniqueCourses.some(x => String(x.courseId) === String(c.courseId))) {
            uniqueCourses.push({ courseId: c.courseId, courseTitle: c.courseTitle || 'كورس بدون اسم' });
        }
    });
    courseSelect.innerHTML = '<option value="">كل الكورسات</option>' + uniqueCourses.map(c => `<option value="${c.courseId}">${c.courseTitle}</option>`).join('');
    if (uniqueCourses.some(c => String(c.courseId) === currentCourseValue)) courseSelect.value = currentCourseValue;
}
function renderPlatformCodesSection() {
    renderPlatformCodesFilters();
    const rows = getPlatformCodesFiltered();
    const tbody = document.getElementById('platform-codes-list');
    if (!tbody) return;
    document.getElementById('platform-codes-total').innerText = (db.courseCodes || []).length;
    const grade = document.getElementById('platform-codes-grade')?.value || '';
    const course = document.getElementById('platform-codes-course')?.value || '';
    document.getElementById('platform-codes-grade-count').innerText = grade ? (db.courseCodes || []).filter(c => String(c.grade || '') === grade).length : (db.courseCodes || []).length;
    document.getElementById('platform-codes-course-count').innerText = course ? (db.courseCodes || []).filter(c => String(c.courseId || '') === course).length : rows.length;
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">لا توجد أكواد مطابقة.</td></tr>';
        return;
    }
    tbody.innerHTML = rows.map(item => `
        <tr>
            <td>${item.linkedStudentName || 'طالب غير محدد'}</td>
            <td>${platformGradeLabel(item.grade)}</td>
            <td>${item.courseTitle || '-'}</td>
            <td style="font-family:monospace; font-size:1.1rem; font-weight:800; letter-spacing:2px;">${item.code || '-'}</td>
            <td><span class="badge" style="background:${item.status === 'مستخدم' ? '#fee2e2' : '#dcfce7'}; color:${item.status === 'مستخدم' ? '#991b1b' : '#166534'}">${item.status || 'غير مستخدم'}</span></td>
        </tr>
    `).join('');
}
// ✅ تم إلغاء الاتصال بـ Firebase بالكامل — التطبيق دلوقتي بيعتمد فقط
// على قاعدة البيانات المحلية (IndexedDB) وملفات النسخ الاحتياطي اليدوية.

async function importPlatformCourseCodes() {
    showNotification('ميزة استلام أكواد الكورسات من المنصة غير متاحة — التطبيق يعمل محلياً بالكامل بدون أي اتصال بالإنترنت', 'info');
    const btn = document.getElementById('btn-import-platform-codes');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-ban"></i> غير متاح'; }
}
function printPlatformCourseCards() {
    const rows = getPlatformCodesFiltered();
    if (!rows.length) return showNotification('لا توجد أكواد للطباعة', 'warning');
    const html = `
    <html dir="rtl"><head><title>أكواد المنصة</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
      body{font-family:Tajawal,Arial,sans-serif;margin:0;padding:10mm;background:#fff;color:#111827}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm}
      .card{border:1px dashed #94a3b8;border-radius:8px;padding:8mm;min-height:48mm;break-inside:avoid;display:flex;flex-direction:column;gap:4mm}
      .title{font-weight:800;font-size:14px;color:#0f172a}
      .student{font-weight:800;font-size:18px}
      .meta{font-size:12px;color:#475569}
      .code{font-family:monospace;font-size:24px;font-weight:900;letter-spacing:3px;text-align:center;border:1px solid #e2e8f0;border-radius:6px;padding:6px;background:#f8fafc}
      @media print{body{padding:8mm}.card{page-break-inside:avoid}}
    </style></head><body>
      <div class="grid">
        ${rows.map(item => `
          <div class="card">
            <div class="title">نظام إدارة الدروس - كود تفعيل كورس</div>
            <div class="student">${item.linkedStudentName || 'طالب غير محدد'}</div>
            <div class="meta">${platformGradeLabel(item.grade)} | ${item.courseTitle || '-'}</div>
            <div class="code">${item.code || '-'}</div>
            <div class="meta">الكود مخصص لهذا الطالب فقط ولا يعمل مع طالب آخر.</div>
          </div>
        `).join('')}
      </div>
      <script>window.onload=function(){setTimeout(function(){window.print();window.close();},300)}<\/script>
    </body></html>`;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
}
async function exportStudentsToFirebase() {
    showNotification('ميزة تصدير الطلاب للمنصة غير متاحة — التطبيق يعمل محلياً بالكامل بدون أي اتصال بالإنترنت', 'info');
    const btn = document.getElementById('btn-export-firebase');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-ban"></i> غير متاح'; }
}

function saveTreasuryArchiveHour(hour) {
    const h = parseInt(hour, 10);
    if (!db._settings) db._settings = {};
    db._settings.treasuryArchiveHour = h;
    localStorage.setItem('treasuryArchiveHour', String(h));
    db.save();
    showNotification(`✅ تم حفظ ساعة الأرشفة: ${h}:00`, 'success');
}

function runManualTreasuryArchiveNow() {
    if (!confirm('سيتم الآن أرشفة عهدة اليوم الحالي وتسجيلها في الأرشيف. هل تريد الاستمرار؟')) return;
    const todayStr = new Date().toLocaleDateString('en-CA');
    _archiveDateTreasury(todayStr);
    db.dailyTreasuryLastArchiveDate = todayStr;
    localStorage.setItem('dt_last_archive_date', todayStr);
    localStorage.setItem('dailyTreasuryLastArchiveDate', todayStr);
    db.save();
    showNotification('✅ تمت أرشفة عهدة اليوم بنجاح', 'success');
    if (document.getElementById('daily-treasury-modal')?.style.display === 'block') {
        renderDailyTreasuryArchives();
    }
}


window.exportData = exportData;
window.saveTreasuryArchiveHour = saveTreasuryArchiveHour;
window.runManualTreasuryArchiveNow = runManualTreasuryArchiveNow;
window.exportStudentsToFirebase = exportStudentsToFirebase;
window.importData = importData;
window._archiveDateTreasury = _archiveDateTreasury;
window.importPlatformCourseCodes = importPlatformCourseCodes;
window.renderPlatformCodesSection = renderPlatformCodesSection;
window.printPlatformCourseCards = printPlatformCourseCards;
window.initPlatformCodesSection = initPlatformCodesSection;

// Unified Application Entry Point
window.onload = async () => {
    try {
        await ensureAppLoaded();
    } catch (err) {
        return;
    }

    applyZoom(); // Apply the saved zoom level
    initGradeSelects(); // Initialize all grade selects
    if (typeof initFilters === 'function') initFilters(); // Initialize other filters
    if (typeof initStudentGroups === 'function') initStudentGroups();
    initExperienceEnhancements();

    // Recover from file if needed (Legacy / Manual Check)
    if (localStorage.length <= 1 && window.edu_initial_data && window.edu_initial_data.db_state) {
        // This handles older backup formats
        const state = window.edu_initial_data.db_state;
        Object.keys(state).forEach(key => localStorage.setItem(key, state[key]));
        showNotification('🚀 تم استعادة البيانات القديمة. جاري التحديث...');
        setTimeout(() => location.reload(), 1000);
        return;
    }

    // 2. Auto-login if we have a grade AND a group
    if (currentGrade && currentGroupId) {
        const overlay = document.getElementById('grade-selection-overlay');
        const gOverlay = document.getElementById('group-selection-overlay');
        if (overlay) overlay.style.display = 'none';
        if (gOverlay) gOverlay.style.display = 'none';
        document.getElementById('portal-overlay').style.display = 'none';

        const gradeObj = gradesList.find(g => g.id == currentGrade);
        const groupObj = db.groups.find(g => g.id == currentGroupId);

        const label = gradeObj ? gradeObj.name : 'سنة دراسية';
        const groupLabel = groupObj ? ` - ${groupObj.name}` : '';

        const badge = document.getElementById('current-grade-badge');
        if (badge) badge.innerText = label + groupLabel;

        showSection('dashboard');
    } else if (currentGrade) {
        // We have a grade but no group - go to porcelain portal group selection
        enterPortalMode();
        showPortalStep('group', currentGrade);
    } else {
        // Completely new or reset - go to portal grade selection
        enterPortalMode();
    }

    updateExperienceSummary();

    // 3. Initialize Global File Sync
    const linkBtn = document.getElementById('link-folder-btn');
    if (linkBtn) {
        linkBtn.addEventListener('click', async () => {
            try {
                if (!window.showDirectoryPicker) {
                    return alert('عذراً، متصفحك لا يدعم خاصية المزامنة المفتوحة. يرجى استخدام Chrome أو Edge.');
                }
                directoryHandle = await window.showDirectoryPicker();
                await loadDataFromFile();
            } catch (err) {
                console.error('Folder selection cancelled', err);
            }
        });
    }
};

// Global Exposure (Ensure all functions are accessible from HTML)
const exposures = {
    // Grade & Group Management
    selectGrade, showGradeSelection, addNewGrade, deleteGrade,
    handleAddGroup, deleteGroup, showSection, toggleModal, viewGroupDetails, renderGroupStudents,
    openAddStudentForGroup, openAddStudentModal, openGroupScanner, removeStudentFromGroup, initStudentGroups, renderGroups,

    // Student Management
    handleAddStudent: handleStudentSubmit, renderStudents, deleteStudent, clearAllStudents, viewDetailedProfile,
    startSearchScanner, stopSearchScanner, searchManualStudent, selectManualStudent, processManualEntry,

    // Attendance & Session
    startLessonCoding, pauseLessonCoding, resumeLessonCoding, endLessonCoding,
    startQRScanner, toggleAttendanceView, removeAttendance, endSessionAndMarkAbsent,
    searchStudentSmart, removeStudentFromPresentToday, archiveAbsenceSession,
    showAbsenceArchive, viewAbsenceSessionDetails, deleteAbsenceSession,
    markStudentAbsentToday, generateAbsenceReport, initAbsenceGroupFilter,
    enterPortalMode, exitPortalMode, startPortalSession, handleBarcodeAttendance,
    showPortalStep, renderPortalGrades, renderPortalGroups, enterSystemFromPortal, syncUIWithContext,

    // Fast Grading & Exams
    submitFastGrade, deleteScore, handleAddExam, openMarksModal,
    printExamResults, updateFastExamMax, printFastGradingReport,
    markRemainingAsExamAbsent, openGradingArchive, initFastGrading,
    renderExams, filterMarks, markStudentExamAbsentDirect, handleBarcodeGrading,

    // Finance & Treasury
    handleAddExpense, startMonthlySubscription, promptEndMonthlySubscription,
    collectMonthlyPayment, exemptMonthlyPayment, discountMonthlyPayment, renderFinances, toggleMonthlyPayment,
    showReceiptSelectionModal, confirmReceiptPrint, skipReceiptPrint, printMonthlyReceipt,
    initReceiptsSection, searchPaymentCodeSection, renderReceiptsList,
    toggleAllReceiptCheckboxes, getSelectedReceiptIds, getVisibleReceiptIds,
    printSelectedReceiptsBulk, printAllVisibleReceiptsBulk, printBulkReceipts,
    renderDailyTreasury, renderDailyTreasuryArchives, manualResetDailyTreasury, showDailyTreasuryReport,
    viewDailyArchive, printDtArchiveDetail, showPrintDailyOptions, printDailyTreasuryReport,
    renderQuickDailyTreasuryModal,

    // Quizzes & Hall of Fame
    handleAddReward, redeemReward,
    calculateHallOfFame, renderHallOfFame, renderShop,

    // Certificates & ID Cards
    generateCertificate, generateCertificateFromSelect, sendCongratulationWA,
    initCertificatesSection, initIDCardsSection, printGroupCodes,
    printStudentCode, generatePrintCard, generatePrintableIDCards,

    // WhatsApp & Communication
    saveTemplates, sendFromQueue, removeFromQueue, clearQueue,
    addToQueueBatch, renderWABot, openWhatsAppMenu, sendWhatsApp,
    generateMonthlyReport, changeReportPeriod, stepReportPeriod, sendAbsenceWhatsApp, sendMonthlyReportWhatsApp,

    // Data & Sync
    exportData, exportStudentsToFirebase, importData, importFromFolder, showCycleArchive, viewArchivedCycle,
    applyAppTheme, toggleDayNightMode, initExperienceEnhancements, updateExperienceSummary,
    initProgramSettings, renderProgramSettings, saveProgramSettings,
    prepareHandoverDownload: async () => {
        showNotification('جاري تجهيز نسخة كاملة للنقل...', 'info');
        const snapshot = {};
        // 🔧 قائمة ديناميكية من كل الجداول الموجودة فعلياً في IndexedDB
        const tables = (StorageEngine.db && StorageEngine.db.objectStoreNames)
            ? Array.from(StorageEngine.db.objectStoreNames)
            : ['students', 'attendance', 'exams', 'scores', 'expenses', 'handouts', 'studentHandouts', 'materials', 'quizzes', 'rewards', 'payments', 'waQueue', 'groups', 'cycles', 'absenceSessions', 'dailyTreasuryArchives', 'staff', 'shifts', 'courseCodes', 'platformCourses', 'platformSubscriptions'];

        for (const t of tables) {
            snapshot[t] = await StorageEngine.getAll(t);
        }
        snapshot.settings = db._settings;
        snapshot.gradesList = gradesList;
        // 🔧 إصلاح: أضف نسخة كاملة من localStorage أيضاً حتى لا تُفقد أي إعدادات
        // (الثيمات، قوالب واتساب، جلسات التصحيح النشطة، ...) عند النقل لجهاز آخر
        const lsSnap = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k === null) continue;
            const v = localStorage.getItem(k);
            if (v !== null) lsSnap[k] = v;
        }
        snapshot.ls = lsSnap;

        const dataJsContent = `/**
 * نظام إدارة الدروس Data Storage File - للبيع والنقل
 * Created: ${new Date().toLocaleString()}
 */
window.edu_initial_data = ${JSON.stringify(snapshot, null, 4)};`;

        const blob = new Blob([dataJsContent], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.js';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification('🚀 تم استخراج ملف data.js شامل كافة البيانات. ضعه في المجلد قبل الشحن.', 'success');
    },
    syncToPermanentFile: async () => {
        showNotification('جاري تجميع البيانات للمزامنة اليدوية...', 'info');
        const snapshot = {};
        // 🔧 قائمة ديناميكية من كل الجداول الموجودة فعلياً في IndexedDB
        const tables = (StorageEngine.db && StorageEngine.db.objectStoreNames)
            ? Array.from(StorageEngine.db.objectStoreNames)
            : ['students', 'attendance', 'exams', 'scores', 'expenses', 'handouts', 'studentHandouts', 'materials', 'quizzes', 'rewards', 'payments', 'waQueue', 'groups', 'cycles', 'absenceSessions', 'dailyTreasuryArchives', 'staff', 'shifts', 'courseCodes', 'platformCourses', 'platformSubscriptions'];

        for (const t of tables) {
            snapshot[t] = await StorageEngine.getAll(t);
        }
        snapshot.settings = db._settings;
        snapshot.gradesList = gradesList;
        // 🔧 إصلاح: أضف نسخة كاملة من localStorage أيضاً حتى لا تُفقد أي إعدادات
        const lsSnap = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k === null) continue;
            const v = localStorage.getItem(k);
            if (v !== null) lsSnap[k] = v;
        }
        snapshot.ls = lsSnap;

        const json = JSON.stringify(snapshot);
        const el = document.createElement('textarea');
        el.value = json;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        alert("📊 تم نسخ بياناتك بالكامل (Snapshot) بنجاح! \n\nيرجى لصقها في ملف data.js أو تزويدها للمساعد (Antigravity) لتحديث ملفات المشروع.");
    },

    // UI Tools
    playSound, speakName, stopAllCameraScanners, updateDashboardStats,
    openSmartCard, recordQuickAction, handleSmartCardPayment,
    printSessionAttendance, printSessionAbsence, printArchivedSession,
    toggleMobileSidebar, changeAppZoom, resetAppZoom
};
Object.keys(exposures).forEach(key => window[key] = exposures[key]);
// --- NEW: Manual Student Entry Engine ---
let selectedManualStudent = null;

function searchManualStudent(query, context) {
    const resultsDiv = document.getElementById(`${context}-manual-results`);
    if (!query || query.trim().length < 1) {
        resultsDiv.style.display = 'none';
        return;
    }

    const normalize = (text) => {
        return String(text)
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .toLowerCase()
            .trim();
    };

    const q = normalize(query);

    const filtered = db.students.filter(s =>
        normalize(s.name).includes(q) ||
        String(s.qrCode).includes(query) ||
        (s.phone && s.phone.includes(query))
    ).slice(0, 5);

    if (filtered.length > 0) {
        resultsDiv.innerHTML = filtered.map(s => `
            <div onclick="selectManualStudent('${s.id}', '${s.name}', '${context}')" style="padding:0.75rem; border-bottom:1px solid #eee; cursor:pointer;">
                <strong>${s.name}</strong> <small style="color:var(--text-muted)">(${s.qrCode})</small>
            </div>
        `).join('');
        resultsDiv.style.display = 'block';
    } else {
        resultsDiv.innerHTML = '<p style="padding:0.75rem; font-size:0.8rem; color:var(--danger);">لا يوجد حوزة طلابية مطابقة!</p>';
        resultsDiv.style.display = 'block';
    }
}

function selectManualStudent(id, name, context) {
    let input;
    if (context === 'attendance') input = document.getElementById('manual-student-entry');
    else if (context === 'grading') input = document.getElementById('manual-grading-entry');
    else if (context === 'finance') input = document.getElementById('manual-finance-entry');

    const resultsDiv = document.getElementById(`${context}-manual-results`);

    if (input) input.value = name;
    selectedManualStudent = db.students.find(s => s.id == id);
    resultsDiv.style.display = 'none';

    if (context === 'finance' || context === 'attendance') {
        openSmartCard(id);
    }
}

function processManualEntry(context) {
    if (!selectedManualStudent) {
        showNotification('برجاء اختيار طالب من القائمة أولاً', 'error');
        return;
    }

    const s = selectedManualStudent;
    const token = s.qrCode;

    if (context === 'attendance') {
        processScan(token);
        document.getElementById('manual-student-entry').value = '';
    } else if (context === 'grading') {
        processFastScan(token);
        document.getElementById('manual-grading-entry').value = '';
    } else if (context === 'finance') {
        if (typeof collectMonthlyPayment === 'function') {
            collectMonthlyPayment(s.id);
        }
        document.getElementById('manual-finance-entry').value = '';
    }

    selectedManualStudent = null;
}

// --- 9. ID Cards & Print Codes ---
const ID_CARD_PRINT_SETTINGS_KEY = 'edu_idcard_print_settings';
const DEFAULT_ID_CARD_PRINT_SETTINGS = {
    mode: 'thermal',
    width: '80',
    height: '40',
    font: '14',
    barcodeHeight: '50'
};
let idCardPrintSettingsBound = false;

function getIDCardPrintSettings() {
    try {
        return { ...DEFAULT_ID_CARD_PRINT_SETTINGS, ...(JSON.parse(localStorage.getItem(ID_CARD_PRINT_SETTINGS_KEY) || '{}') || {}) };
    } catch (e) {
        return { ...DEFAULT_ID_CARD_PRINT_SETTINGS };
    }
}

function saveIDCardPrintSettings() {
    const settings = {
        mode: document.getElementById('print-type-main')?.value || DEFAULT_ID_CARD_PRINT_SETTINGS.mode,
        width: document.getElementById('thermal-w')?.value || DEFAULT_ID_CARD_PRINT_SETTINGS.width,
        height: document.getElementById('thermal-h')?.value || DEFAULT_ID_CARD_PRINT_SETTINGS.height,
        font: document.getElementById('thermal-font')?.value || DEFAULT_ID_CARD_PRINT_SETTINGS.font,
        barcodeHeight: document.getElementById('thermal-barcode-h')?.value || DEFAULT_ID_CARD_PRINT_SETTINGS.barcodeHeight
    };
    try { localStorage.setItem(ID_CARD_PRINT_SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
    return settings;
}

function applyIDCardPrintSettings() {
    const settings = getIDCardPrintSettings();
    const typeEl = document.getElementById('print-type-main');
    const widthEl = document.getElementById('thermal-w');
    const heightEl = document.getElementById('thermal-h');
    const fontEl = document.getElementById('thermal-font');
    const barcodeEl = document.getElementById('thermal-barcode-h');

    if (typeEl) typeEl.value = settings.mode;
    if (widthEl) widthEl.value = settings.width;
    if (heightEl) heightEl.value = settings.height;
    if (fontEl) fontEl.value = settings.font;
    if (barcodeEl) barcodeEl.value = settings.barcodeHeight;
    toggleThermalOptions(false);
}

function bindIDCardPrintSettings() {
    if (idCardPrintSettingsBound) return;
    const ids = ['print-type-main', 'thermal-w', 'thermal-h', 'thermal-font', 'thermal-barcode-h'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', saveIDCardPrintSettings);
        el.addEventListener('input', saveIDCardPrintSettings);
    });
    idCardPrintSettingsBound = true;
}

function initIDCardsSection() {
    const groupSelect = document.getElementById('idcard-group-select');
    const studentSelect = document.getElementById('idcard-student-select');
    if (!groupSelect || !studentSelect) return;

    bindIDCardPrintSettings();
    applyIDCardPrintSettings();

    // Filter by current grade
    const gradeGroups = db.groups.filter(g => g.grade == currentGrade);
    rebuildSelectPreservingSelection(
        groupSelect,
        () => gradeGroups.map(g => `<option value="${g.id}">${g.name}</option>`).join(''),
        currentGroupId
    );

    // STRICTLY filter by active group for individual selection
    const groupStudents = db.students.filter(s => String(s.groupId) === String(currentGroupId));
    const sortedStudents = sortStudentsArabic(groupStudents);
    studentSelect.innerHTML = '<option value="">-- اختر الطالب --</option>' +
        sortedStudents.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

function toggleThermalOptions(shouldSave = true) {
    const type = document.getElementById('print-type-main').value;
    const panel = document.getElementById('thermal-config-panel');
    if (panel) panel.style.display = (type === 'thermal') ? 'block' : 'none';
    if (shouldSave) saveIDCardPrintSettings();
}

function printGroupCodes() {
    const groupId = document.getElementById('idcard-group-select').value;
    if (!groupId) return showNotification('يرجى اختيار مجموعة أولاً', 'warning');

    const students = db.students.filter(s => s.groupId == groupId);
    if (students.length === 0) return showNotification('لا يوجد طلاب في هذه المجموعة', 'warning');

    const mode = document.getElementById('print-type-main').value;
    generatePrintableIDCards(students, mode);
}

function printStudentCode() {
    const studentId = document.getElementById('idcard-student-select').value;
    if (!studentId) return showNotification('يرجى اختيار طالب أولاً', 'warning');

    const student = db.students.find(s => s.id == studentId);
    const mode = document.getElementById('print-type-main').value;
    generatePrintableIDCards([student], mode);
}

function generatePrintableIDCards(students, mode = 'normal') {
    saveIDCardPrintSettings();
    const printWindow = window.open('', '_blank');
    const isThermal = mode === 'thermal';
    const profile = (typeof getProgramProfile === 'function') ? getProgramProfile() : {};
    // ملحوظة: تم حذف اسم/تخصص المدرّس من بطاقات الطباعة بناءً على طلب المستخدم

    // Get Thermal Config
    const tw = document.getElementById('thermal-w')?.value || 80;
    const th = document.getElementById('thermal-h')?.value || 40;
    const tFont = document.getElementById('thermal-font')?.value || 14;
    const tBCodeH = document.getElementById('thermal-barcode-h')?.value || 50;

    let html = '<html dir="rtl"><head><title>طباعة الأكواد</title>';
    html += '<style>' +
        '@import url("https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap");' +
        'body { font-family: "Tajawal", sans-serif; margin: 0; padding: ' + (isThermal ? '0' : '10mm') + '; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
        (isThermal ?
            '@page { size: ' + tw + 'mm ' + th + 'mm; margin: 0; }' +
            '.page { width: ' + tw + 'mm; height: ' + th + 'mm; overflow: hidden; page-break-after: always; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; padding: 2mm; }' +
            '.card { width: 100%; display: flex; flex-direction: column; align-items: center; text-align: center; }' +
            '.header-text { font-size: ' + (tFont * 0.85) + 'px; font-weight: 800; margin-bottom: 0; }' +
            '.header-spec { font-size: ' + (tFont * 0.55) + 'px; color: #444; margin-bottom: 3px; }' +
            '.student-name { font-weight: 800; font-size: ' + tFont + 'px; margin-bottom: 2px; }' +
            '.info-row { font-size: ' + (tFont * 0.7) + 'px; margin-bottom: 2px; }' +
            '.barcode-area { margin-top: 5px; width: 100%; display: flex; justify-content: center; }' +
            '.barcode { width: 95% !important; max-width: ' + (tw - 10) + 'mm; }'
            :
            '.page { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; page-break-after: always; }' +
            '.card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 0; height: 55mm; display: flex; flex-direction: column; position: relative; box-sizing: border-box; background: #fff; page-break-inside: avoid; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }' +
            '.card-header { background: linear-gradient(135deg, #4f46e5, #4338ca); color: #fff; padding: 8px 12px; }' +
            '.card-header .teacher-name { font-weight: 800; font-size: 0.95rem; line-height: 1.3; margin-bottom: 2px; }' +
            '.card-header .teacher-spec { font-size: 0.65rem; opacity: 0.9; }' +
            '.card-body { padding: 10px 12px; display: flex; flex-direction: column; flex: 1; }' +
            '.info-row { font-size: 0.85rem; margin-bottom: 5px; color: #475569; }' +
            '.info-row b { color: #1e293b; }' +
            '.barcode-area { margin-top: auto; text-align: center; background: #f8fafc; padding: 5px; border-radius: 5px; }' +
            '.barcode { width: 100% !important; height: auto !important; }' +
            '.grade-badge { position: absolute; top: 8px; left: 12px; font-size: 0.6rem; background: rgba(255,255,255,0.2); color: #fff; padding: 2px 8px; border-radius: 4px; }' +
            '@media print { body { padding: 0; } .page { padding: 10mm; } }'
        ) +
        '</style></head><body>';

    if (isThermal) {
        students.forEach(s => {
            const groupObj = db.groups.find(g => g.id == s.groupId);
            const gradeObj = gradesList.find(g => g.id == s.grade);
            const gradeName = gradeObj ? gradeObj.name : 'طالب منضم';

            html += '<div class="page">' +
                '<div class="card">' +
                '<div style="font-size: ' + (tFont * 0.7) + 'px; color: #333; margin-bottom: 3px;">' + gradeName + '</div>' +
                '<div class="student-name">' + s.name + '</div>' +
                '<div class="info-row">المجموعة: ' + (groupObj ? groupObj.name : '---') + ' | الكود: ' + s.qrCode + '</div>' +
                '<div class="barcode-area">' +
                '<svg class="barcode" ' +
                'jsbarcode-value="' + s.qrCode + '" ' +
                'jsbarcode-displayValue="true" ' +
                'jsbarcode-height="' + tBCodeH + '" ' +
                'jsbarcode-width="2" ' +
                'jsbarcode-fontSize="' + (tFont * 0.8) + '"></svg>' +
                '</div>' +
                '</div>' +
                '</div>';
        });
    } else {
        for (let i = 0; i < students.length; i += 10) {
            html += '<div class="page">';
            const chunk = students.slice(i, i + 10);
            chunk.forEach(s => {
                const groupObj = db.groups.find(g => g.id == s.groupId);
                const gradeObj = gradesList.find(g => g.id == s.grade);
                const gradeName = gradeObj ? gradeObj.name : 'طالب منضم';

                html += '<div class="card">' +
                    '<div class="card-header">' +
                    '<div class="teacher-name">سنتر العباقرة</div>' +
                    '<div class="grade-badge">' + gradeName + '</div>' +
                    '</div>' +
                    '<div class="card-body">' +
                    '<div style="background: #f8fafc; padding: 8px; border-radius: 6px; margin-bottom: 10px; border-right: 4px solid #4f46e5;">' +
                    '<span style="font-size: 0.7rem; color: #64748b; display: block;">اسم الطالب:</span>' +
                    '<div style="font-weight: 800; font-size: 1.15rem; color: #1e293b; line-height: 1.2;">' + s.name + '</div>' +
                    '</div>' +
                    '<div class="info-row"><b>المجموعة:</b> ' + (groupObj ? groupObj.name : '---') + '</div>' +
                    '<div class="info-row"><b>كود الطالب:</b> ' + s.qrCode + '</div>' +
                    '<div class="barcode-area">' +
                    '<svg class="barcode" ' +
                    'jsbarcode-value="' + s.qrCode + '" ' +
                    'jsbarcode-text="' + s.name + '" ' +
                    'jsbarcode-displayValue="true" ' +
                    'jsbarcode-textmargin="2" ' +
                    'jsbarcode-height="35" ' +
                    'jsbarcode-width="2" ' +
                    'jsbarcode-fontSize="14"></svg>' +
                    '</div>' +
                    '</div>' +
                    '</div>';
            });
            html += '</div>';
        }
    }

    html += '<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>' +
        '<script>' +
        'function initBarcodes() {' +
        '  if (typeof JsBarcode === "undefined") { setTimeout(initBarcodes, 50); return; }' +
        '  const barcodes = document.querySelectorAll(".barcode");' +
        '  barcodes.forEach(el => { try {' +
        '    JsBarcode(el).init();' +
        '    const w = el.getAttribute("width");' +
        '    const h = el.getAttribute("height");' +
        '    if (w && h) {' +
        '      el.setAttribute("viewBox", "0 0 " + w + " " + h);' +
        '      el.setAttribute("preserveAspectRatio", "xMidYMid meet");' +
        '      el.removeAttribute("width");' +
        '      el.removeAttribute("height");' +
        '    }' +
        '  } catch(e){ console.error(e); } });' +
        '  setTimeout(() => { window.print(); window.close(); }, 500);' +
        '}' +
        'window.onload = initBarcodes;' +
        '</script></body></html>';

    printWindow.document.write(html);
    printWindow.document.close();
}

window.addEventListener('click', (e) => {
    const searchRes = document.getElementById('attendance-manual-results');
    if (searchRes && !e.target.closest('#manual-student-entry')) {
        searchRes.style.display = 'none';
    }
});

/**
 * --- ULTRA ROYAL LUX UI ENGINES ---
 */

// 1. Mobile Sidebar Logic
function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar || !overlay) return;

    sidebar.classList.toggle('mobile-active');
    overlay.classList.toggle('active');
}

// 2. Splash Screen Sequencer — مع دعم RBAC
function checkAppPassword(val) {
    // ── إصلاح تسجيل الدخول بدون إنترنت ──
    // يقرأ كلمة المرور من db._settings أولاً، ثم من localStorage كـ fallback
    // هذا يضمن عمل تسجيل الدخول حتى قبل اكتمال تحميل قاعدة البيانات
    let adminPass = RBAC.PASSWORDS.admin; // القيمة الافتراضية (20062006)
    if (db._settings && db._settings.globalPasswords && db._settings.globalPasswords.admin) {
        adminPass = db._settings.globalPasswords.admin;
    } else {
        try {
            const saved = localStorage.getItem('_fallback_passwords');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.admin) adminPass = parsed.admin;
            }
        } catch(e) {}
    }

    let employeePass = RBAC.PASSWORDS.employee; // القيمة الافتراضية
    if (db._settings && db._settings.globalPasswords && db._settings.globalPasswords.main) {
        employeePass = db._settings.globalPasswords.main;
    } else {
        try {
            const saved = localStorage.getItem('_fallback_passwords');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.main) employeePass = parsed.main;
            }
        } catch(e) {}
    }

    const isAdmin    = (val === adminPass);
    const isEmployee = (val === employeePass);

    if (isAdmin || isEmployee) {
        // ✅ كلمة المرور العامة صحيحة — لكن ما زلنا محتاجين نعرف "مين"
        // بالتحديد بيدخل (إذا كان نظام المستخدمين مُفعَّلاً) قبل استكمال
        // الدخول، عشان نقدر نربط أي تحصيل مالي باسمه تلقائياً لاحقًا.
        const role = isAdmin ? 'admin' : 'employee';
        RBAC.login(role);
        RBAC.log('login', role);

        const errorDiv   = document.getElementById('password-error');
        const successDiv = document.getElementById('password-success');
        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) {
            successDiv.style.display = 'block';
            successDiv.innerHTML = `<i class="fas fa-check-circle"></i> تم تسجيل الدخول بنجاح!`;
        }
        const passwordInput = document.getElementById('app-password-input');
        if (passwordInput) passwordInput.disabled = true;

        if (typeof proceedAfterPasswordSuccess === 'function') {
            // user-management.js متاح: يقرر هو لو محتاج يعرض شاشة "من أنت؟"
            setTimeout(() => proceedAfterPasswordSuccess(role), 400);
        } else {
            // تحميل قديم بدون user-management.js — نفس السلوك الأصلي تمامًا
            finishLoginFlow(role);
        }
    } else {
        // ❌ كلمة مرور خاطئة — فوراً عند عدم التطابق
        const err = document.getElementById('password-error');
        const successDiv = document.getElementById('password-success');
        
        // إخفاء أي رسالة نجاح سابقة
        if (successDiv) successDiv.style.display = 'none';

        // التحقق من الطول والقيمة
        if (val.length > 0) {
            const expectedLength = val.length <= 4 ? 4 : 8;
            const expectedPass = expectedLength === 4 ? employeePass : adminPass;
            
            if (val !== expectedPass.substring(0, val.length)) {
                // الباسورد غلط حتى لو مكتمل أم لا
                if (err) {
                    err.style.display = 'block';
                    err.innerHTML = `<i class="fas fa-exclamation-triangle"></i> كلمة المرور غير صحيحة!`;
                }
            } else {
                // ما زال يكتب الباسورد الصحيح - إخفاء الخطأ
                if (err) err.style.display = 'none';
            }
        } else {
            // حقل فارغ - إخفاء الخطأ
            if (err) err.style.display = 'none';
        }
    }
}

// يُستكمل بعد تحديد هوية الموظف (أو تلقائيًا لو مفيش نظام مستخدمين مُفعَّل)
function finishLoginFlow(role) {
    const passwordScreen = document.getElementById('password-screen');
    const selectScreen   = document.getElementById('employee-select-screen');
    const loadingScreen  = document.getElementById('loading-screen');

    if (passwordScreen) passwordScreen.style.display = 'none';
    if (selectScreen)   selectScreen.style.display   = 'none';
    if (loadingScreen)  loadingScreen.style.display   = 'block';

    setTimeout(() => {
        const splash = document.getElementById('app-splash');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => { splash.style.display = 'none'; }, 1000);
        }
        RBAC.applyToUI();

        if (typeof startBookingAutoSync === 'function') {
            setTimeout(startBookingAutoSync, 3000);
        }
        // الموظف يروح الحضور مباشرة، المشرف يروح الداشبورد
        if (role === 'employee') {
            setTimeout(() => showSection('attendance'), 2200);
        }

        // ── فحص الـ URL: لو فيه ?student=ID → افتح ملف الطالب مباشرة ──
        // (يُستخدَم عند مسح QR Code الخاص بالطالب من التليفون)
        const _qrStudentId = new URLSearchParams(window.location.search).get('student');
        if (_qrStudentId) {
            const _qrDelay = role === 'employee' ? 3200 : 2600;
            setTimeout(() => {
                const sid = isNaN(_qrStudentId) ? _qrStudentId : Number(_qrStudentId);
                if (typeof viewDetailedProfile === 'function') {
                    showSection('students');
                    setTimeout(() => viewDetailedProfile(sid), 500);
                }
                // إزالة الـ param من الـ URL بعد الفتح بدون إعادة تحميل الصفحة
                try {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('student');
                    window.history.replaceState({}, '', url.toString());
                } catch(e) {}
            }, _qrDelay);
        }
    }, 800);
}
window.finishLoginFlow = finishLoginFlow;

async function waitForCloudTableSync(table) {
    if (typeof CloudSync === 'undefined' || !CloudSync.isReady || !CloudSync.isReady() || !CloudSync.syncTableNow) {
        return false;
    }
    try {
        await CloudSync.syncTableNow(table);
        return true;
    } catch (err) {
        console.warn('[CloudSync] immediate table sync failed', table, err);
        return false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // ─── إظهار شاشة كلمة المرور فوراً بدون انتظار أي شيء ───
    // هذا يضمن ظهور الشاشة حتى بدون إنترنت عند أول تشغيل
    const splash = document.getElementById('app-splash');
    if (splash) {
        splash.style.display = 'flex';
        // تأخير بسيط لضمان ظهور الـ splash قبل أي عملية ثقيلة
        await new Promise(r => setTimeout(r, 50));
        document.getElementById('app-password-input')?.focus();
    }

    try {
        await ensureAppLoaded();
        // ── حفظ كلمات المرور في localStorage فور اكتمال التحميل ──
        // هذا يضمن عملها في المرة القادمة حتى بدون إنترنت
        try {
            const passwords = db._settings && db._settings.globalPasswords;
            if (passwords) localStorage.setItem('_fallback_passwords', JSON.stringify(passwords));
        } catch(e) {}

        // ── عرض قائمة السكرتارية مباشرة على شاشة الدخول الرئيسية ──
        // (بجانب كلمة مرور المشرف) لو كان هناك حسابات سكرتير مُضافة
        try {
            if (typeof renderSplashSecretaryQuickSelect === 'function') renderSplashSecretaryQuickSelect();
        } catch(e) {}

        // ── بدء طبقة المزامنة السحابية (Firestore) — لا تمنع تشغيل
        // النظام لو فشلت أو لو مفيش إنترنت؛ النظام يعمل محليًا زي العادة ──
        if (typeof CloudSync !== 'undefined') {
            await CloudSync.init().catch(e => console.warn('[CloudSync] init error', e));
        }
    } catch (err) {
        // حتى لو فشل التحميل، تبقى شاشة المرور ظاهرة
        // المستخدم يدخل كلمة المرور وتعمل محلياً
        console.warn('[App] ensureAppLoaded failed, running in offline mode:', err);
        // لا نعود هنا — نستمر لتشغيل ما يمكن تشغيله بدون Firebase
    }

    // Initial check and periodic check for date change (Midnight Reset)
    try {
        autoArchiveDailyTreasury();
        setInterval(autoArchiveDailyTreasury, 60000); // Check every minute
    } catch (e) {
        console.warn('[App] autoArchiveDailyTreasury skipped:', e);
    }
});




async function editStudent(id) {
    const student = await StorageEngine.get('students', id);
    if (!student) return showNotification('تعذر العثور على الطالب في قاعدة البيانات', 'error');

    document.getElementById('edit-std-id').value = student.id;
    document.getElementById('edit-std-name').value = student.name;
    document.getElementById('edit-std-code').value = student.qrCode || '';
    document.getElementById('edit-std-phone').value = student.phone;
    document.getElementById('edit-std-parent').value = student.parentPhone;

    const groupSelect = document.getElementById('edit-std-group');
    const filteredGroups = db.groups.filter(g => g.grade == currentGrade);
    groupSelect.innerHTML = filteredGroups.map(g => `<option value="${g.id}" ${g.id == student.groupId ? 'selected' : ''}>${g.name} (${g.time})</option>`).join('');

    toggleModal('edit-student-modal', true);
}

async function handleStudentUpdate(printAfter = false) {
    const id = parseInt(document.getElementById('edit-std-id').value);
    const name = document.getElementById('edit-std-name').value;
    const code = document.getElementById('edit-std-code').value.trim();
    const phone = document.getElementById('edit-std-phone').value;
    const groupId = document.getElementById('edit-std-group').value;
    const parent = document.getElementById('edit-std-parent').value;

    if (!name || !code || !phone || !groupId || !parent) return showNotification('يرجى ملء كافة البيانات بما فيها كود الطالب', 'error');

    // ── منع تكرار الكود مع طالب آخر عند التعديل ──
    const codeTaken = db.students.some(s => String(s.qrCode) === code && Number(s.id) !== id);
    if (codeTaken) {
        return showNotification('هذا الكود مستخدم بالفعل، يرجى إدخال كود آخر.', 'error');
    }

    const student = await StorageEngine.get('students', id);
    if (!student) return showNotification('خطأ في استرجاع البيانات', 'error');

    // ✅ الكود بيتغيّر هنا على مستوى الطالب نفسه — وبما إن كل شاشات
    // البرنامج (الحضور، الطباعة، التقارير، البحث...) بتقرأ qrCode من
    // نفس كائن الطالب في db.students، التعديل ده بيسري تلقائيًا على
    // مستوى البرنامج كله من غير الحاجة لأي تحديث إضافي في أي مكان تاني.
    student.name = name;
    student.qrCode = code;
    student.phone = phone;
    student.groupId = groupId;
    student.parentPhone = parent;

    await StorageEngine.save('students', student);
    const studentCloudOk = await waitForCloudTableSync('students');

    const idx = db.students.findIndex(s => s.id == id);
    if (idx !== -1) db.students[idx] = student;

    if (studentCloudOk) {
        showNotification('تم تحديث بيانات الطالب في قاعدة البيانات بنجاح', 'success');
    } else {
        showNotification('تم تحديث الطالب على الجهاز فقط، ولم يتم تأكيد رفعه لقاعدة البيانات.', 'warning');
    }
    toggleModal('edit-student-modal', false);
    renderStudents();

    // ✅ لو المستخدم ضغط "تحديث وطباعة الكود" — نفتح الطباعة فورًا بالكود الجديد
    if (printAfter && typeof generatePrintableIDCards === 'function') {
        const printMode = document.getElementById('print-type-main')?.value || 'thermal';
        generatePrintableIDCards([student], printMode);
    }
}

function printAttendanceSheets() {
    const filter = document.getElementById('student-search-input').value.toLowerCase();
    let students = db.students;
    if (filter) {
        students = students.filter(s => s.name.toLowerCase().includes(filter) || s.qrCode.includes(filter));
    }

    if (students.length === 0) return showNotification('لا يوجد طلاب لطباعة كشوفهم', 'error');

    sortStudentsArabic(students);

    const groups = {};
    students.forEach(s => {
        const g = db.groups.find(x => x.id == s.groupId);
        const gName = g ? `${g.name} (${g.time})` : 'بدون مجموعة';
        if (!groups[gName]) groups[gName] = [];
        groups[gName].push(s);
    });

    const gradeName = document.getElementById('current-grade-badge')?.innerText || 'غير محدد';

    let printHtml = `
    <html>
    <head>
        <title>كشوف حضور الطلاب</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
            body { font-family: 'Tajawal', sans-serif; direction: rtl; padding: 20px; }
            .sheet-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: center; font-size: 14px; }
            th { background: #f2f2f2; }
            .group-title { background: #eee; font-weight: bold; margin-top: 20px; padding: 10px; border: 1px solid #000; display: flex; justify-content: space-between; }
            @media print {
                .page-break { page-break-after: always; }
            }
        </style>
    </head>
    <body>
        <div class="sheet-header">
            <h1>كشوف حضور وغياب الطلاب</h1>
            <p>نظام إدارة الدروس</p>
            <p>السنة الدراسية: ${gradeName} | تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
        </div>
    `;

    Object.keys(groups).forEach(gName => {
        printHtml += `
        <div class="group-title">
            <span>المجموعة: ${gName}</span>
            <span>عدد الطلاب: ${groups[gName].length}</span>
        </div>`;
        printHtml += `
        <table>
            <thead>
                <tr>
                    <th style="width: 40px;">م</th>
                    <th>اسم الطالب</th>
                    <th style="width: 120px;">رقم الطالب</th>
                    <th style="width: 120px;">رقم ولي الأمر</th>
                    <th style="width: 120px;">التوقيع / ملاحظات</th>
                </tr>
            </thead>
            <tbody>
        `;

        groups[gName].forEach((s, index) => {
            printHtml += `
            <tr>
                <td>${index + 1}</td>
                <td style="text-align: right; padding-right: 15px;">${s.name}</td>
                <td>${s.phone}</td>
                <td>${s.parentPhone}</td>
                <td></td>
            </tr>
            `;
        });

        printHtml += `</tbody></table><div class="page-break"></div>`;
    });

    printHtml += `</body></html>`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.print();
}

function printStudentsData() {
    const filter = document.getElementById('student-search-input').value.toLowerCase();
    const groupFilter = document.getElementById('filter-group').value;

    let students = db.students;

    // Apply group filter
    if (groupFilter !== 'all') {
        students = students.filter(s => s.groupId == groupFilter);
    }

    // Apply search filter
    if (filter) {
        students = students.filter(s => s.name.toLowerCase().includes(filter) || (s.qrCode && s.qrCode.includes(filter)));
    }

    if (students.length === 0) return showNotification('لا يوجد طلاب لطباعة بياناتهم', 'error');

    sortStudentsArabic(students);

    const gradeBadge = document.getElementById('current-grade-badge')?.innerText || 'غير محدد';

    let printHtml = `
    <html>
    <head>
        <title>كشف بيانات الطلاب</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
            body { font-family: 'Tajawal', sans-serif; direction: rtl; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px double #000; padding-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #000; padding: 10px; text-align: center; font-size: 14px; }
            th { background: #f8fafc; }
            tr:nth-child(even) { background: #f1f5f9; }
            .footer { margin-top: 30px; font-size: 0.9rem; text-align: left; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
    </head>
    <body onload="window.print()">
        <div class="header">
            <h1>سجل بيانات الطلاب التفصيلي</h1>
            <p>نظام إدارة الدروس</p>
            <p>المرحلة: ${gradeBadge} | إجمالي الطلاب: ${students.length}</p>
        </div>
        <table>
            <thead>
                <tr>
                    <th style="width: 30px;">م</th>
                    <th>اسم الطالب</th>
                    <th>المجموعة</th>
                    <th>رقم الهاتف</th>
                    <th>رقم ولي الأمر</th>
                    <th>النقاط</th>
                    <th>تاريخ الالتجاق</th>
                </tr>
            </thead>
            <tbody>
    `;

    students.forEach((s, index) => {
        const g = db.groups.find(x => x.id == s.groupId);
        const groupName = g ? `${g.name} (${g.time})` : '---';
        printHtml += `
            <tr>
                <td>${index + 1}</td>
                <td style="text-align: right; font-weight: bold;">${s.name}</td>
                <td>${groupName}</td>
                <td style="direction: ltr;">${s.phone || '---'}</td>
                <td style="direction: ltr;">${s.parentPhone || '---'}</td>
                <td>${s.points || 0}</td>
                <td>${s.joinDate ? new Date(s.joinDate).toLocaleDateString('ar-EG') : '---'}</td>
            </tr>
        `;
    });

    printHtml += `
            </tbody>
        </table>
        <div class="footer">
            تم الاستخراج بتاريخ: ${new Date().toLocaleString('ar-EG')}
        </div>
    </body>
    </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printHtml);
    printWindow.document.close();
}

// 3. Section Auto-Close on Mobile
const navItems = document.querySelectorAll('.nav-link');
navItems.forEach(item => {
    item.addEventListener('click', () => {
        if (window.innerWidth <= 991) {
            toggleMobileSidebar();
        }
    });
});

function generatePrintCalibration() {
    applyIDCardPrintSettings();
    const dummyStudent = {
        name: 'طالب تجريبي (معايرة)',
        qrCode: '1234567890123',
        grade: 'test',
        groupId: 'test'
    };
    const mode = document.getElementById('print-type-main').value;
    generatePrintableIDCards([dummyStudent], mode);
}// --- Shift Management Foundations ---
let staffStream = null;

function renderShifts() {
    const list = document.getElementById('shifts-list');
    if (!list) return;

    if (!db.shifts) db.shifts = [];
    if (!db.staff) db.staff = [
        { id: 1, name: 'سكرتارية A', code: 'A', pin: 'a1234a' },
        { id: 2, name: 'سكرتارية B', code: 'B', pin: 'b1b234' },
        { id: 3, name: 'سكرتارية C', code: 'C', pin: 'c12c34' },
        { id: 4, name: 'سكرتارية D', code: 'D', pin: '12d34d' }
    ];

    const todayStr = new Date().toLocaleDateString('en-CA');
    const todayShifts = db.shifts.filter(s => s.date === todayStr);

    let activeStaffCount = 0;
    let todayHours = 0;

    list.innerHTML = todayShifts.map(s => {
        const staff = db.staff.find(st => st.id === s.staffId);
        if (!s.endTime) activeStaffCount++;
        todayHours += (s.hours || 0);

        return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding:1rem;"><strong style="cursor:pointer; color:var(--primary);" onclick="showStaffProfile(${s.staffId})">${staff ? staff.name : 'موظف محذوف'} <i class="fas fa-external-link-alt" style="font-size:0.7rem; opacity:0.5;"></i></strong></td>
                <td><i class="fas fa-fingerprint" style="color:var(--text-muted);"></i></td>
                <td><span class="badge" style="background:#f0fdf4; color:#166534; padding:5px 12px;">${s.startTime}</span></td>
                <td><span class="badge" style="background:${s.endTime ? '#fef2f2' : '#fff7ed'}; color:${s.endTime ? '#991b1b' : '#c2410c'}; padding:5px 12px;">${s.endTime || 'قيد العمل...'}</span></td>
                <td style="font-weight:700; color:var(--primary);">${s.workHours || '---'}</td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--text-muted); opacity:0.6;">لا يوجد شفتات مسجلة لليوم</td></tr>';

    const currentMonthPrefix = todayStr.substring(0, 7); // e.g., "2026-03"
    const monthShifts = db.shifts.filter(s => s.date.startsWith(currentMonthPrefix));
    let monthHours = 0;
    monthShifts.forEach(s => monthHours += (s.hours || 0));

    const eToday = document.getElementById('shifts-today-hours');
    const eMonth = document.getElementById('shifts-month-hours');
    const eActive = document.getElementById('shifts-active-staff');

    if (eToday) eToday.innerText = todayHours.toFixed(1);
    if (eMonth) eMonth.innerText = monthHours.toFixed(1);
    if (eActive) eActive.innerText = activeStaffCount;
}

async function handlePunchPassword() {
    try {
        const input = document.getElementById('shift-password-input');
        const resultDiv = document.getElementById('shift-action-result');
        if (!input || !resultDiv) return;

        const pin = input.value.trim();
        if (!pin) return showNotification('يرجى إدخال الرقم السري', 'warning');

        // ── أعِد تحميل بيانات الموظفين من IndexedDB لضمان أحدث بيانات ──────
        const freshStaff = await StorageEngine.getAll('staff');
        if (freshStaff && freshStaff.length > 0) {
            db.staff = freshStaff;
        }

        // ── تأكد أن قائمة الموظفين محمّلة من قاعدة البيانات ──────────────
        // لا نُعيد القيم الافتراضية إلا إذا كانت القائمة فارغة تماماً
        if (!db.staff || db.staff.length === 0) {
            console.warn('[Shift-Auth] db.staff فارغ — سيتم استخدام القيم الافتراضية');
            db.staff = [
                { id: 1, name: 'سكرتارية A', code: 'A', pin: 'a1234a' },
                { id: 2, name: 'سكرتارية B', code: 'B', pin: 'b1b234' },
                { id: 3, name: 'سكرتارية C', code: 'C', pin: 'c12c34' },
                { id: 4, name: 'سكرتارية D', code: 'D', pin: '12d34d' }
            ];
        }

        // ── تشخيص مفصّل في الـ Console ────────────────────────────────────
        console.group('[Shift-Auth] محاولة تسجيل دخول شفت');
        console.log('عدد الموظفين المُحمَّلين:', db.staff.length);
        console.log('الـ PIN المُدخَل (طول):', pin.length, '| أحرف:', [...pin].map(c => c.charCodeAt(0)));

        // ── بحث عن الموظف بمقارنة آمنة ───────────────────────────────────
        // نُحوّل كلا الجانبين: trim() + toLowerCase() لإزالة مسافات وحساسية الحروف
        const pinNormalized = pin.trim().toLowerCase();
        let matchedStaff = null;
        let foundByName = null;

        for (const s of db.staff) {
            const storedPin = (s.pin !== undefined && s.pin !== null) ? String(s.pin).trim().toLowerCase() : '';
            const isMatch = (storedPin === pinNormalized);
            console.log(`  → موظف: "${s.name}" | PIN مخزّن (طول: ${storedPin.length}) | تطابق: ${isMatch}`);
            if (isMatch) {
                matchedStaff = s;
                foundByName = s.name;
                break;
            }
        }

        if (!matchedStaff) {
            // ── تحقق إذا كان PIN موجوداً لكن مع فارق Case فقط ────────────
            const caseIssue = db.staff.find(s => s.pin && String(s.pin).trim() === pin.trim() && String(s.pin).trim() !== pinNormalized);
            if (caseIssue) {
                console.warn('[Shift-Auth] فشل بسبب Case Sensitivity فقط — الموظف:', caseIssue.name);
            }

            // ── تحقق إذا كان PIN يحتوي على مسافات زائدة ──────────────────
            const spaceIssue = db.staff.find(s => s.pin && String(s.pin).trim().toLowerCase() === pinNormalized && String(s.pin) !== String(s.pin).trim());
            if (spaceIssue) {
                console.warn('[Shift-Auth] مسافات زائدة في PIN المخزّن — الموظف:', spaceIssue.name);
            }

            // ── تحقق من وجود موظف بدون PIN ────────────────────────────────
            const noPinStaff = db.staff.filter(s => !s.pin);
            if (noPinStaff.length > 0) {
                console.warn('[Shift-Auth] موظفون بدون PIN:', noPinStaff.map(s => s.name));
            }

            console.warn('[Shift-Auth] النتيجة: لم يُعثر على موظف بهذا الـ PIN');
            console.groupEnd();

            resultDiv.style.display = 'block';
            resultDiv.style.color = 'var(--danger)';
            resultDiv.innerHTML = '<i class="fas fa-times-circle"></i> الرقم السري غير صحيح — يرجى المحاولة مرة أخرى أو التواصل مع المسؤول';
            showNotification('❌ الرقم السري غير صحيح', 'error');
            setTimeout(() => resultDiv.style.display = 'none', 4000);
            input.select();
            return;
        }

        console.log('[Shift-Auth] تم التعرف على الموظف:', foundByName);
        console.groupEnd();

        const staff = matchedStaff;

        const todayStr = new Date().toLocaleDateString('en-CA');
        if (!db.shifts) db.shifts = [];

        const openShift = db.shifts.find(s => s.staffId === staff.id && s.date === todayStr && !s.endTime);

        const nowTimeObj = new Date();
        const nowTime = nowTimeObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

        if (openShift) {
            // Clock out
            openShift.endTime = nowTime;

            // Calculate work hours
            const tInObj = new Date(openShift.timestampIn);
            let diffMs = nowTimeObj - tInObj;
            if (isNaN(diffMs) || diffMs < 0) diffMs = 0;
            const hrs = (diffMs / (1000 * 60 * 60));
            openShift.hours = hrs;
            openShift.workHours = hrs.toFixed(2) + ' ساعة';

            resultDiv.style.color = 'var(--vibrant-orange)';
            resultDiv.innerHTML = `<i class="fas fa-sign-out-alt"></i> تم تسجيل خروج: ${staff.name} <br><small>المدة: ${openShift.workHours}</small>`;
            showNotification(`تم تسجيل الخروج للموظف ${staff.name}`, 'success');
        } else {
            // Clock in
            db.shifts.push({
                id: Date.now(),
                staffId: staff.id,
                date: todayStr,
                startTime: nowTime,
                timestampIn: nowTimeObj.toISOString(),
                endTime: null,
                workHours: 'جاري...',
                hours: 0,
                photoIn: null,
                photoOut: null
            });
            resultDiv.style.color = 'var(--accent)';
            resultDiv.innerHTML = `<i class="fas fa-check-circle"></i> تم تسجيل دخول: ${staff.name}`;
            showNotification(`تم تسجيل الدخول للموظف ${staff.name}`, 'success');
        }

        db.save();
        resultDiv.style.display = 'block';
        input.value = '';

        setTimeout(() => {
            resultDiv.style.display = 'none';
        }, 4000);

        renderShifts();
    } catch (err) {
        console.error('Punch Error:', err);
        showNotification('❌ فشل تسجيل الشفت، يرجى المحاولة مرة أخرى', 'error');
    }
}

function showShiftsStatsReport() {
    toggleModal('shifts-stats-modal', true);

    const list = document.getElementById('shifts-stats-list');
    if (!list) return;

    if (!db.staff || !db.shifts) return;

    const todayStr = new Date().toLocaleDateString('en-CA');
    const currentMonthPrefix = todayStr.substring(0, 7);

    list.innerHTML = db.staff.map(staff => {
        const staffShifts = db.shifts.filter(s => s.staffId === staff.id);

        let todayHours = 0;
        let monthHours = 0;
        let totalHours = 0;

        staffShifts.forEach(s => {
            const h = s.hours || 0;
            totalHours += h;
            if (s.date === todayStr) todayHours += h;
            if (s.date.startsWith(currentMonthPrefix)) monthHours += h;
        });

        return `
            <tr style="cursor:pointer; transition:background 0.2s;" onclick="showStaffProfile(${staff.id})">
                <td style="font-weight: 700; color:var(--primary);">${staff.name}</td>
                <td style="color: var(--accent); font-weight: 700;">${todayHours.toFixed(2)} س</td>
                <td style="color: var(--primary); font-weight: 700;">${monthHours.toFixed(2)} س</td>
                <td style="color: var(--text-main); font-weight: 700;">${totalHours.toFixed(2)} س</td>
            </tr>
        `;
    }).join('');
}

function toggleShiftsHistory() {
    showNotification('جاري تحميل سجل الأرشيف كاملاً...', 'info');
}

function showStaffProfile(staffId) {
    const staff = db.staff.find(s => s.id === staffId);
    if (!staff) return;

    toggleModal('staff-profile-modal', true);
    document.getElementById('staff-prof-name').innerText = staff.name;
    document.getElementById('staff-prof-code').innerText = `كود الموظف: ${staff.code || staff.id}`;

    const staffShifts = db.shifts.filter(s => s.staffId === staffId).sort((a, b) => b.id - a.id);

    const today = new Date().toLocaleDateString('en-CA');

    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toLocaleDateString('en-CA');

    const currentMonth = today.substring(0, 7);

    let hrsToday = 0;
    let hrsYesterday = 0;
    let hrsMonth = 0;

    staffShifts.forEach(s => {
        const h = s.hours || 0;
        if (s.date === today) hrsToday += h;
        if (s.date === yesterday) hrsYesterday += h;
        if (s.date.startsWith(currentMonth)) hrsMonth += h;
    });

    document.getElementById('staff-prof-today').innerText = hrsToday.toFixed(2);
    document.getElementById('staff-prof-yesterday').innerText = hrsYesterday.toFixed(2);
    document.getElementById('staff-prof-month').innerText = hrsMonth.toFixed(2);

    const historyBody = document.getElementById('staff-prof-history');
    const last5 = staffShifts.slice(0, 5);
    historyBody.innerHTML = last5.map(s => `
        <tr>
            <td>${s.date}</td>
            <td>${s.startTime}</td>
            <td>${s.endTime || '---'}</td>
            <td>${s.workHours || '---'}</td>
        </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center;">لا يوجد سجل</td></tr>';

    // Set print action
    document.getElementById('btn-print-staff-report').onclick = () => {
        printStaffReport(staffId);
    };
}

function printStaffReport(staffId) {
    const staff = db.staff.find(s => s.id === staffId);
    const printable = document.getElementById('staff-prof-printable-area').innerHTML;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>تقرير موظف - ${staff.name}</title>
                <link rel="stylesheet" href="style.css">
                <style>
                    body { direction: rtl; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; }
                    .header { text-align: center; border-bottom: 2px solid #333; margin-bottom: 30px; padding-bottom: 10px; }
                    .card { border: 1px solid #ddd; padding: 15px; border-radius: 10px; margin-bottom: 10px; text-align: center; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 12px; text-align: center; }
                    .no-print { display: none; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>تقرير ساعات عمل الموظف</h1>
                    <h3>${staff.name}</h3> 
                    <p>كود: ${staff.code || staff.id}</p>
                    <p>تاريخ التقرير: ${new Date().toLocaleString('ar-EG')}</p>
                </div>
                ${printable}
                <div style="margin-top: 50px; display: flex; justify-content: space-between;">
                    <p>توقيع الإدارة: ........................</p>
                    <p>توقيع الموظف: ........................</p>
                </div>
                <script>
                    setTimeout(() => { window.print(); window.close(); }, 500);
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

// --- PASSWORD MANAGEMENT CENTER ---
let activePasswordToEdit = null;

async function openPasswordManagement() {
    // 0. أعِد تحميل بيانات الموظفين من IndexedDB أولاً لضمان الحصول على أحدث بيانات
    const freshStaff = await StorageEngine.getAll('staff');
    if (freshStaff && freshStaff.length > 0) {
        db.staff = freshStaff;
        console.log('[PassMgmt] تم تحميل الموظفين من IndexedDB:', db.staff.length, 'موظف');
    }

    // 1. Ensure settings has the passwords object
    if (!db._settings.globalPasswords) {
        db._settings.globalPasswords = {
            admin: '20062006',
            main: '2446',
            finance: '4321',
            unlockPayment: '100qwe',
            endSubscription: '01000'
        };
        db.save();
    } else if (!db._settings.globalPasswords.admin) {
        // ترقية بيانات قديمة: أضف كود الأدمن الافتراضي إذا لم يكن محفوظاً بعد
        db._settings.globalPasswords.admin = '20062006';
        db.save();
    }

    // 2. Ensure staff is initialized for management
    if (!db.staff || db.staff.length === 0) {
        db.staff = [
            { id: 1, name: 'سكرتارية A', code: 'A', pin: 'a1234a' },
            { id: 2, name: 'سكرتارية B', code: 'B', pin: 'b1b234' },
            { id: 3, name: 'سكرتارية C', code: 'C', pin: 'c12c34' },
            { id: 4, name: 'سكرتارية D', code: 'D', pin: '12d34d' }
        ];
        db.save('staff');
    }

    const container = document.getElementById('password-management-list');
    const passwords = db._settings.globalPasswords || { admin: '20062006', main: '2446', finance: '4321', unlockPayment: '100qwe', endSubscription: '01000' };

    let html = `
        <div style="background: #fff8f8; border: 1px solid #fee2e2; padding: 1.5rem; border-radius: 20px; margin-bottom: 1.5rem; box-shadow: var(--shadow-sm);">
            <h4 style="color: var(--danger); margin-bottom: 1rem; font-size: 1.1rem;"><i class="fas fa-lock"></i> كلمات مرور النظام الأساسية</h4>
            <div style="display: grid; gap: 0.8rem;">
                ${renderPasswordRow('كود الأدمن (تسجيل دخول المشرف)', 'admin', passwords.admin)}
                ${renderPasswordRow('كود الموظف (دخول البرنامج الرئيسي)', 'main', passwords.main)}
                ${renderPasswordRow('الخزينة والمالية', 'finance', passwords.finance)}
                ${renderPasswordRow('فك حماية حذف العمليات', 'unlockPayment', passwords.unlockPayment)}
                ${renderPasswordRow('إنهاء اشتراك الشهر', 'endSubscription', passwords.endSubscription)}
            </div>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #dcfce7; padding: 1.5rem; border-radius: 20px; box-shadow: var(--shadow-sm);">
            <h4 style="color: var(--accent); margin-bottom: 1rem; font-size: 1.1rem;"><i class="fas fa-user-shield"></i> أكواد السكرتير (Staff)</h4>
            <div style="display: grid; gap: 0.8rem;">
                ${(db.staff || []).map(s => renderPasswordRow(`كود السكرتير: ${s.name}`, `staff_${s.id}`, s.pin)).join('')}
            </div>
        </div>
    `;

    container.innerHTML = html;
    toggleModal('password-management-modal', true);
}

function renderPasswordRow(label, key, currentVal) {
    return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #fff; border-radius: 12px; border: 1px solid #f1f5f9; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            <div style="text-align: right;">
                <span style="font-weight: 700; display: block; color: var(--text-main);">${label}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">الرقم الحالي: ****</span>
            </div>
            <button class="btn" style="background: var(--bg-light); padding: 8px 20px; font-size: 0.85rem; border-radius: 10px; font-weight: 600; color: var(--text-main);" onclick="startEditPassword('${key}', '${label}')">
                <i class="fas fa-sync-alt" style="margin-left: 5px;"></i> تغيير
            </button>
        </div>
    `;
}

function startEditPassword(key, label) {
    activePasswordToEdit = key;
    document.getElementById('edit-password-title').innerText = `تغيير ${label}`;
    document.getElementById('old-password-input').value = '';
    document.getElementById('new-password-input').value = '';
    document.getElementById('password-verify-step').style.display = 'block';
    document.getElementById('password-update-step').style.display = 'none';
    toggleModal('edit-password-modal', true);
}

function verifyOldPassword() {
    const input = document.getElementById('old-password-input').value.trim();
    if (!input) return showNotification('يرجى إدخال كلمة المرور الحالية', 'warning');

    let correctPass = '';

    if (activePasswordToEdit.startsWith('staff_')) {
        const staffId = parseInt(activePasswordToEdit.split('_')[1]);
        const staff = db.staff.find(s => s.id === staffId);
        if (!staff) {
            showNotification('❌ الموظف غير موجود في قاعدة البيانات!', 'error');
            return;
        }
        correctPass = staff.pin ? String(staff.pin).trim() : '';
        console.log('[VerifyPass] التحقق من PIN الموظف:', staff.name);
    } else {
        correctPass = (db._settings.globalPasswords && db._settings.globalPasswords[activePasswordToEdit]) || '';
        if (!correctPass) {
            const defaults = { admin: '20062006', main: '2446', finance: '4321', unlockPayment: '100qwe', endSubscription: '01000' };
            correctPass = defaults[activePasswordToEdit];
        }
    }

    // مقارنة آمنة: trim من الجانبين
    if (input.trim() === correctPass.trim()) {
        document.getElementById('password-verify-step').style.display = 'none';
        document.getElementById('password-update-step').style.display = 'block';
        document.getElementById('new-password-input').focus();
    } else {
        console.warn('[VerifyPass] فشل التحقق — طول المُدخَل:', input.length, '| طول المخزّن:', correctPass.length);
        showNotification('❌ كلمة المرور الحالية غير صحيحة!', 'error');
    }
}

function updateToNewPassword() {
    const newVal = document.getElementById('new-password-input').value.trim();
    if (!newVal) return showNotification('يرجى إدخال كلمة مرور جديدة', 'warning');
    if (newVal.length < 3) return showNotification('⚠️ كلمة المرور قصيرة جداً (3 أحرف على الأقل)', 'warning');

    if (activePasswordToEdit.startsWith('staff_')) {
        const staffId = parseInt(activePasswordToEdit.split('_')[1]);
        const staff = db.staff.find(s => s.id === staffId);
        if (staff) {
            staff.pin = newVal; // مُنظَّف بالفعل بـ .trim() أعلاه
            db.save('staff');
            console.log('[UpdatePass] تم تحديث PIN الموظف:', staff.name, '| طول PIN جديد:', newVal.length);
        } else {
            showNotification('❌ الموظف غير موجود!', 'error');
            return;
        }
    } else {
        if (!db._settings.globalPasswords) db._settings.globalPasswords = { admin: '20062006', main: '2446', finance: '4321', unlockPayment: '100qwe', endSubscription: '01000' };
        db._settings.globalPasswords[activePasswordToEdit] = newVal;
        db.save();
        // ── حفظ فوري في localStorage للعمل بدون إنترنت ──
        try { localStorage.setItem('_fallback_passwords', JSON.stringify(db._settings.globalPasswords)); } catch(e) {}
    }

    showNotification('✅ تم تحديث كلمة المرور بنجاح', 'success');
    toggleModal('edit-password-modal', false);
    openPasswordManagement(); // Refresh list
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 أداة تشخيص مصادقة الشفتات — اكتبها في Console للتشخيص الفوري
// diagnoseStaffAuth()
// diagnoseStaffAuth('الـ PIN المشكوك فيه')
// ═══════════════════════════════════════════════════════════════════════════
async function diagnoseStaffAuth(testPin = null) {
    console.group('🔍 تشخيص مصادقة الشفتات');

    // 1. تحميل بيانات الموظفين مباشرة من IndexedDB
    const freshStaff = await StorageEngine.getAll('staff');
    console.log('✅ عدد الموظفين في IndexedDB:', freshStaff.length);

    freshStaff.forEach((s, i) => {
        const pinStr = s.pin !== undefined && s.pin !== null ? String(s.pin) : '⛔ undefined/null';
        const pinTrimmed = s.pin ? String(s.pin).trim() : '';
        const hasSpaces = pinStr !== pinTrimmed;
        console.log(
            `  [${i + 1}] الاسم: "${s.name}" | id: ${s.id}` +
            ` | PIN: "${pinStr}" (طول: ${pinStr.length})` +
            (hasSpaces ? ' ⚠️ يحتوي على مسافات زائدة!' : '')
        );
    });

    // 2. مقارنة مع الـ PIN المُدخَل (اختياري)
    if (testPin !== null) {
        console.log('\n🔑 اختبار PIN:', `"${testPin}"`);
        const normalized = String(testPin).trim().toLowerCase();
        const match = freshStaff.find(s => s.pin && String(s.pin).trim().toLowerCase() === normalized);
        if (match) {
            console.log('✅ تطابق ناجح — الموظف:', match.name);
        } else {
            console.warn('❌ لا يوجد تطابق لهذا PIN');
            // اقتراح أقرب تطابق
            const partial = freshStaff.find(s => s.pin && (
                String(s.pin).includes(testPin) || testPin.includes(String(s.pin).trim())
            ));
            if (partial) console.log('💡 تطابق جزئي محتمل مع:', partial.name, '| PIN:', partial.pin);
        }
    }

    // 3. تحقق من db.staff في الذاكرة مقارنةً بـ IndexedDB
    console.log('\n📦 db.staff في الذاكرة:', db.staff ? db.staff.length : 'غير مُحمَّل');
    if (db.staff && db.staff.length !== freshStaff.length) {
        console.warn('⚠️ تناقض! الذاكرة تحتوي على', db.staff.length, 'بينما IndexedDB تحتوي على', freshStaff.length);
    }

    console.groupEnd();
    return freshStaff;
}

window.diagnoseStaffAuth = diagnoseStaffAuth;
