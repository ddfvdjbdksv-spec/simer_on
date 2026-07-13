// ============================================================
//  firebase-sync.js  —  محرك المزامنة السحابية (Offline + Online)
//  ------------------------------------------------------------
//  الهدف: يفضل النظام يعمل Offline بالكامل زي ما هو تمامًا (لا
//  تغيير في أي منطق قديم)، وبالإضافة لذلك:
//
//   • أي تعديل محلي (إضافة/تعديل/حذف) يتزامن تلقائيًا مع Firestore
//     بمجرد توفر الإنترنت — بدون أي زر أو تدخل من المستخدم.
//   • أي تحديث يحصل من جهاز تاني (بنفس قاعدة البيانات) بيوصل هنا
//     تلقائيًا ويتحدّث في الجهاز الحالي فور توفر الإنترنت.
//   • البيانات المُحمَّلة من Firestore تتخزن محليًا (IndexedDB) زي
//     العادة، فتفضل موجودة حتى لو اتقفل الإنترنت تاني.
//
//  آلية العمل:
//   1. كل جداول db (الطلاب، المدفوعات، ...) بتتزامن كمستندات
//      مستقلة داخل مجموعات Firestore بنفس اسم الجدول، ومعرّف كل
//      مستند = نفس الـ id المحلي.
//   2. db._settings (فيها كلمات المرور، المستخدمون، الإعدادات
//      العامة) بتتزامن كمستند واحد في meta/settings.
//   3. الاعتماد على "hash" خفيف لكل سجل لتحديد التغييرات فقط
//      بدل رفع كل البيانات في كل مرة (كفاءة أعلى، Firestore أرخص).
//   4. الاعتماد على Firestore Offline Persistence نفسها كـ "صندوق
//      الرسائل الصادرة" (Outbox) — يعني أي كتابة بنعملها بتتسجل
//      محليًا فورًا وتتبعت لـ Firestore تلقائيًا لما النت يرجع،
//      حتى لو قفلنا التطبيق قبل رجوع النت (تمامًا زي واتساب).
// ============================================================

const CloudSync = (() => {

    // ⚠️ هذا الكونفيج عام (client-side) وليس سرًا، لكن تأكد أن Firestore
    // Security Rules عندك محكمة قبل الإطلاق الفعلي للمستخدمين.
    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyDfL2u_k9PM2_OBDsYNXPFLrbIk0yALds8",
        authDomain: "ahmedsimer.firebaseapp.com",
        projectId: "ahmedsimer",
        storageBucket: "ahmedsimer.firebasestorage.app",
        messagingSenderId: "1037880583763",
        appId: "1:1037880583763:web:e8ea5da761cb5902cfc8a6",
        measurementId: "G-XHQRVWNTFD"
    };

    // نفس قائمة الجداول المستخدمة في IndexedDB (StorageEngine) بالضبط
    const SYNC_TABLES = [
        'students', 'attendance', 'exams', 'scores', 'expenses',
        'handouts', 'studentHandouts', 'materials', 'quizzes', 'rewards',
        'payments', 'waQueue', 'groups', 'cycles', 'absenceSessions',
        'dailyTreasuryArchives', 'staff', 'shifts', 'courseCodes',
        'platformCourses', 'platformSubscriptions'
    ];

    const HASH_STORAGE_KEY = 'cloud_sync_hashes_v1';

    let fsDB = null;
    let ready = false;
    let applyingRemote = false;   // true أثناء تطبيق تحديث قادم من Firestore (لمنع حلقة رفع/سحب)
    let hashes = {};              // { table: { id: hash } , __settings: hash }
    let rerenderTimer = null;
    let statusEl = null;

    // ── تخزين/قراءة الـ hashes من localStorage (خفيف وسريع) ───
    function loadHashes() {
        try { hashes = JSON.parse(localStorage.getItem(HASH_STORAGE_KEY)) || {}; }
        catch (e) { hashes = {}; }
    }
    function saveHashes() {
        try { localStorage.setItem(HASH_STORAGE_KEY, JSON.stringify(hashes)); }
        catch (e) { /* ignore quota errors */ }
    }
    function hashOf(record) {
        const str = JSON.stringify(record);
        let h = 0;
        for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
        return h + '_' + str.length;
    }
    // Firestore بيرفض قيم undefined — لازم ننضّف الكائن قبل الإرسال
    function sanitize(obj) {
        const out = {};
        Object.keys(obj || {}).forEach(k => { if (obj[k] !== undefined) out[k] = obj[k]; });
        return out;
    }

    // ── مؤشر الحالة الصغير في الواجهة (متصل / غير متصل / مزامنة) ──
    function ensureStatusBadge() {
        if (statusEl) return statusEl;
        statusEl = document.createElement('div');
        statusEl.id = 'cloud-sync-badge';
        statusEl.style.cssText = 'position:fixed; bottom:14px; left:14px; z-index:9999; padding:.4rem .8rem; border-radius:20px; font-size:.75rem; font-weight:700; font-family:inherit; box-shadow:0 4px 14px rgba(0,0,0,.15); transition:.3s; display:flex; align-items:center; gap:.4rem; direction:rtl;';
        document.body.appendChild(statusEl);
        return statusEl;
    }
    function setStatus(mode) {
        const el = ensureStatusBadge();
        const map = {
            offline: { bg: '#f59e0b', text: 'غير متصل — العمل محلي', icon: 'fa-wifi-slash' },
            syncing: { bg: '#3b82f6', text: 'جارِ المزامنة...', icon: 'fa-sync fa-spin' },
            online:  { bg: '#16a34a', text: 'متصل ومتزامن', icon: 'fa-cloud' },
            error:   { bg: '#dc2626', text: 'تعذّرت المزامنة (سيُعاد المحاولة)', icon: 'fa-exclamation-triangle' },
        };
        const cfg = map[mode] || map.offline;
        el.style.background = cfg.bg;
        el.style.color = '#fff';
        el.innerHTML = `<i class="fas ${cfg.icon}"></i> ${cfg.text}`;
    }

    function scheduleUIRefresh() {
        clearTimeout(rerenderTimer);
        rerenderTimer = setTimeout(() => {
            ['renderStudents', 'renderFinances', 'updateDashboardStats', 'syncUIWithContext',
             'renderMonthlySubscriptionTables', 'renderSubscriptionTracker', 'renderPortalAttendance']
                .forEach(fnName => {
                    try { if (typeof window[fnName] === 'function') window[fnName](); } catch (e) {}
                });
        }, 700);
    }

    // ============================================================
    //  الدفع للسحابة (Push) — يُستدعى تلقائياً من داخل db.save()
    // ============================================================

    function pushTableDiff(table) {
        if (!ready || applyingRemote) return;
        const arr = db[table];
        if (!Array.isArray(arr)) return;

        if (!hashes[table]) hashes[table] = {};
        const tableHashes = hashes[table];
        const currentIds = new Set();
        const ops = [];

        arr.forEach(rec => {
            if (rec == null || rec.id === undefined || rec.id === null) return;
            const id = String(rec.id);
            currentIds.add(id);
            const h = hashOf(rec);
            if (tableHashes[id] !== h) {
                ops.push({ type: 'set', id, data: rec });
                tableHashes[id] = h;
            }
        });

        // الحذف: أي id كان موجود قبل كده وبقى مش موجود دلوقتي
        Object.keys(tableHashes).forEach(id => {
            if (!currentIds.has(id)) {
                ops.push({ type: 'delete', id });
                delete tableHashes[id];
            }
        });

        if (!ops.length) return;
        saveHashes();
        flushOps(table, ops);
    }

    function pushSettings() {
        if (!ready || applyingRemote) return;
        if (!db._settings) return;
        const h = hashOf(db._settings);
        if (hashes.__settings === h) return;
        hashes.__settings = h;
        saveHashes();

        setStatus('syncing');
        fsDB.collection('meta').doc('settings')
            .set({ ...sanitize(db._settings), _syncedAt: Date.now() }, { merge: true })
            .then(() => setStatus(navigator.onLine ? 'online' : 'offline'))
            .catch(err => { console.warn('[CloudSync] settings push failed', err); setStatus('error'); });
    }

    async function flushOps(table, ops) {
        setStatus('syncing');
        const col = fsDB.collection(table);
        const CHUNK = 400; // أقل من حد الـ 500 لكل batch في Firestore
        for (let i = 0; i < ops.length; i += CHUNK) {
            const chunk = ops.slice(i, i + CHUNK);
            const batch = fsDB.batch();
            chunk.forEach(op => {
                const ref = col.doc(op.id);
                if (op.type === 'delete') batch.delete(ref);
                else batch.set(ref, { ...sanitize(op.data), _syncedAt: Date.now() }, { merge: true });
            });
            try {
                await batch.commit();
                console.log(`[CloudSync] ✅ ${table}: تمت مزامنة ${chunk.length} سجل`);
            } catch (err) {
                console.warn(`[CloudSync] batch commit failed for ${table}`, err);
                setStatus('error');
                return; // هيتحاول تاني في أقرب db.save() جاي طالما الـ hash اتغيّر فعلاً
            }
        }
        setStatus(navigator.onLine ? 'online' : 'offline');
    }

    function pushAllTables() {
        SYNC_TABLES.forEach(pushTableDiff);
        pushSettings();
    }

    // يُستدعى من نهاية db.save() الأصلية في app.js
    function onLocalSave(modifiedTable) {
        if (!ready) return;
        if (modifiedTable && SYNC_TABLES.includes(modifiedTable)) {
            pushTableDiff(modifiedTable);
        } else if (!modifiedTable) {
            SYNC_TABLES.forEach(pushTableDiff);
        }
        // الإعدادات (كلمات المرور/المستخدمون) بتتحفظ مع كل db.save() في الكود الأصلي
        pushSettings();
    }

    // ============================================================
    //  الاستقبال من السحابة (Pull) — Real-time listeners
    // ============================================================

    function applyRemoteDocChange(table, change) {
        const arr = db[table];
        if (!Array.isArray(arr)) return false;

        const rawId = change.doc.id;
        const numericId = isNaN(Number(rawId)) ? rawId : Number(rawId);

        if (change.type === 'removed') {
            const idx = arr.findIndex(r => String(r.id) === String(numericId));
            if (idx > -1) arr.splice(idx, 1);
            StorageEngine.delete(table, numericId).catch(() => {});
            if (hashes[table]) delete hashes[table][String(numericId)];
            return true;
        }

        const data = { ...change.doc.data(), id: numericId };
        delete data._syncedAt;

        const idx = arr.findIndex(r => String(r.id) === String(numericId));
        if (idx > -1) arr[idx] = data; else arr.push(data);
        StorageEngine.save(table, [data]).catch(() => {});

        if (!hashes[table]) hashes[table] = {};
        hashes[table][String(numericId)] = hashOf(data);
        return true;
    }

    function attachTableListener(table) {
        const col = fsDB.collection(table);
        col.onSnapshot(snapshot => {
            let changed = false;
            applyingRemote = true;
            snapshot.docChanges().forEach(change => {
                // لو التغيير ده لسه "pending" (يعني إحنا اللي كتبناه بس لسه
                // ماوصلش تأكيد من السيرفر) — تجاهله، ده صدى كتابتنا إحنا
                if (change.doc.metadata.hasPendingWrites) return;
                if (applyRemoteDocChange(table, change)) changed = true;
            });
            applyingRemote = false;
            if (changed) {
                saveHashes();
                scheduleUIRefresh();
            }
        }, err => {
            console.warn(`[CloudSync] listener error on ${table}`, err);
        });
    }

    function attachSettingsListener() {
        fsDB.collection('meta').doc('settings').onSnapshot(doc => {
            if (!doc.exists) return;
            if (doc.metadata.hasPendingWrites) return;

            const data = { ...doc.data() };
            delete data._syncedAt;

            applyingRemote = true;
            db._settings = { ...db._settings, ...data };
            applyingRemote = false;

            hashes.__settings = hashOf(db._settings);
            saveHashes();

            try { localStorage.setItem('edu_master_settings', JSON.stringify(db._settings)); } catch (e) {}
            try {
                if (db._settings.globalPasswords) {
                    localStorage.setItem('_fallback_passwords', JSON.stringify(db._settings.globalPasswords));
                }
            } catch (e) {}

            scheduleUIRefresh();
        }, err => console.warn('[CloudSync] settings listener error', err));
    }

    function attachAllListeners() {
        SYNC_TABLES.forEach(attachTableListener);
        attachSettingsListener();
    }

    // ============================================================
    //  التهيئة
    // ============================================================

    async function init() {
        if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') {
            console.error('[CloudSync] ❌ مكتبة Firebase لم تُحمَّل — لن تعمل المزامنة. تأكد من وجود ملفات vendor/firebase/ بجانب index.html');
            setStatus('offline');
            return;
        }

        loadHashes();
        console.log('[CloudSync] بدء التهيئة...');

        try {
            firebase.initializeApp(FIREBASE_CONFIG);
            fsDB = firebase.firestore();

            // تفعيل الـ Persistence الخاصة بـ Firestore نفسها: بتخلّي أي
            // كتابة بنعملها "تتصف" فورًا محليًا وتتزامن تلقائيًا مع رجوع
            // النت حتى لو اتقفل المتصفح بالكامل في الأثناء (زي واتساب تمامًا)
            try {
                await fsDB.enablePersistence({ synchronizeTabs: true });
                console.log('[CloudSync] ✅ Offline persistence مُفعَّلة');
            } catch (e) {
                // لو فاتح أكتر من تاب أو المتصفح مش بيدعمها — نكمّل عادي
                console.warn('[CloudSync] ⚠️ Firestore persistence لم تُفعَّل:', e.code || e.message);
            }

            ready = true;
            console.log('[CloudSync] ✅ الاتصال جاهز، مشروع Firebase:', FIREBASE_CONFIG.projectId);
            setStatus(navigator.onLine ? 'syncing' : 'offline');

            attachAllListeners();

            window.addEventListener('online',  () => { console.log('[CloudSync] رجع النت — إعادة مزامنة'); setStatus('syncing'); pushAllTables(); });
            window.addEventListener('offline', () => setStatus('offline'));

            // أول تشغيل: ادفع أي بيانات محلية سابقة (قبل تفعيل المزامنة) لأعلى
            pushAllTables();

            setTimeout(() => setStatus(navigator.onLine ? 'online' : 'offline'), 2500);
        } catch (err) {
            console.error('[CloudSync] ❌ فشلت التهيئة:', err);
            setStatus('error');
        }
    }

    // للاختبار اليدوي من الـ console: CloudSync.debugInfo()
    function debugInfo() {
        const info = {
            ready,
            projectId: FIREBASE_CONFIG.projectId,
            online: navigator.onLine,
            tablesTracked: Object.keys(hashes).filter(k => k !== '__settings'),
            recordCountsPerTable: {},
        };
        SYNC_TABLES.forEach(t => { info.recordCountsPerTable[t] = Array.isArray(db[t]) ? db[t].length : 'N/A'; });
        console.table(info.recordCountsPerTable);
        console.log('[CloudSync] الحالة:', info);
        return info;
    }

    return { init, onLocalSave, pushAllTables, isReady: () => ready, debugInfo, forceSync: pushAllTables };
})();

window.CloudSync = CloudSync;
