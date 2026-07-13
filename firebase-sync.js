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

    const HASH_STORAGE_KEY = 'cloud_sync_hashes_v2'; // v2: تصحيح باگ كان بيسجّل "تمت المزامنة" قبل التأكد فعليًا

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
            const simpleFnNames = [
                'renderStudents', 'renderFinances', 'updateDashboardStats', 'syncUIWithContext',
                'renderMonthlySubscriptionTables', 'renderSubscriptionTracker', 'renderPortalAttendance',
                'renderGroups', 'renderGroupStudents', 'refreshGroupContexts'
            ];
            simpleFnNames.forEach(fnName => {
                try { if (typeof window[fnName] === 'function') window[fnName](); } catch (e) {}
            });

            try {
                if (typeof window.currentGrade !== 'undefined' && window.currentGrade) {
                    if (typeof window.renderPortalGroups === 'function') {
                        window.renderPortalGroups(window.currentGrade);
                    }
                    if (typeof window.renderGroupSelection === 'function') {
                        window.renderGroupSelection(window.currentGrade);
                    }
                }
            } catch (e) {}
        }, 700);
    }

    // ============================================================
    //  الدفع للسحابة (Push) — يُستدعى تلقائياً من داخل db.save()
    // ============================================================

    async function pushTableDiff(table) {
        if (!ready || applyingRemote) return 0;
        const arr = db[table];
        if (!Array.isArray(arr)) return 0;

        if (!hashes[table]) hashes[table] = {};
        const tableHashes = hashes[table];
        const currentIds = new Set();
        const ops = []; // { type, id, data, newHash }

        arr.forEach(rec => {
            if (rec == null || rec.id === undefined || rec.id === null) return;
            const id = String(rec.id);
            currentIds.add(id);
            const h = hashOf(rec);
            if (tableHashes[id] !== h) {
                ops.push({ type: 'set', id, data: rec, newHash: h });
            }
        });

        // الحذف: أي id كان موجود قبل كده وبقى مش موجود دلوقتي
        Object.keys(tableHashes).forEach(id => {
            if (!currentIds.has(id)) {
                ops.push({ type: 'delete', id });
            }
        });

        if (!ops.length) return 0;
        await flushOps(table, ops); // الـ hash بيتحدّث جوه flushOps بعد نجاح الكتابة فعليًا فقط
        return ops.length;
    }

    async function pushSettings() {
        if (!ready || applyingRemote) return false;
        if (!db._settings) return false;
        const h = hashOf(db._settings);
        if (hashes.__settings === h) return false;

        setStatus('syncing');
        try {
            await fsDB.collection('meta').doc('settings')
                .set({ ...sanitize(db._settings), _syncedAt: Date.now() }, { merge: true });
            hashes.__settings = h; // نحدّث الهاش بعد التأكد من نجاح الكتابة فقط
            saveHashes();
            setStatus(navigator.onLine ? 'online' : 'offline');
            return true;
        } catch (err) {
            console.warn('[CloudSync] settings push failed', err);
            setStatus('error');
            return false;
        }
    }

    async function flushOps(table, ops) {
        setStatus('syncing');
        const col = fsDB.collection(table);
        const CHUNK = 400; // أقل من حد الـ 500 لكل batch في Firestore
        const tableHashes = hashes[table] || (hashes[table] = {});

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
                // ✅ نحدّث الـ hash المحلي بعد تأكيد Firestore فعليًا للنجاح فقط —
                // ده اللي كان ناقص قبل كده وسبب إن المزامنة تتوقف بصمت
                chunk.forEach(op => {
                    if (op.type === 'delete') delete tableHashes[op.id];
                    else tableHashes[op.id] = op.newHash;
                });
                saveHashes();
                console.log(`[CloudSync] ✅ ${table}: تمت مزامنة ${chunk.length} سجل`);
            } catch (err) {
                console.error(`[CloudSync] ❌ فشلت مزامنة ${table} (${chunk.length} سجل):`, err);
                setStatus('error');
                // لا نحدّث الـ hash — هيتحاول تاني تلقائيًا في أقرب db.save() أو زر يدوي
            }
        }
        setStatus(navigator.onLine ? 'online' : 'offline');
    }

    function pushAllTables() {
        SYNC_TABLES.forEach(t => pushTableDiff(t).catch(e => console.error(`[CloudSync] push ${t} failed`, e)));
        pushSettings().catch(e => console.error('[CloudSync] push settings failed', e));
    }

    // ── رفع يدوي بزر — يرجع تقرير واضح بعدد السجلات المرفوعة فعليًا ──
    async function manualPushToCloud() {
        if (!ready) {
            alert('⚠️ الاتصال بـ Firebase غير جاهز حاليًا.\nافتح Console (F12) وشوف رسائل [CloudSync] لمعرفة السبب.');
            return;
        }
        const btn = document.getElementById('manual-push-btn');
        const originalHTML = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارِ الرفع...'; }

        setStatus('syncing');
        const report = {};
        for (const table of SYNC_TABLES) {
            try { report[table] = await pushTableDiff(table); }
            catch (e) { report[table] = 'خطأ: ' + (e.message || e); }
        }
        const settingsSynced = await pushSettings();
        setStatus(navigator.onLine ? 'online' : 'offline');

        if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }

        const lines = Object.entries(report)
            .filter(([, v]) => v !== 0)
            .map(([t, v]) => `• ${t}: ${v}`);
        alert(
            '✅ انتهى الرفع للسحابة.\n\n' +
            (lines.length ? lines.join('\n') : 'لا يوجد بيانات جديدة — كل شيء متزامن بالفعل.') +
            (settingsSynced ? '\n• الإعدادات/المستخدمون: تم التحديث' : '')
        );
    }

    // ── جلب يدوي بزر — يجيب كل حاجة موجودة فعليًا في Firestore ويستبدل بها المحلي ──
    async function manualPullFromCloud() {
        if (!ready) {
            alert('⚠️ الاتصال بـ Firebase غير جاهز حاليًا.\nافتح Console (F12) وشوف رسائل [CloudSync] لمعرفة السبب.');
            return;
        }
        if (!confirm('سيتم استبدال البيانات المحلية الحالية بكل ما هو موجود على السحابة الآن.\nهل أنت متأكد؟')) return;

        const btn = document.getElementById('manual-pull-btn');
        const originalHTML = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارِ الجلب...'; }

        setStatus('syncing');
        applyingRemote = true;
        const report = {};
        try {
            for (const table of SYNC_TABLES) {
                const snap = await fsDB.collection(table).get({ source: 'server' });
                report[table] = snap.size;
                const arr = [];
                snap.forEach(doc => {
                    const rawId = doc.id;
                    const numericId = isNaN(Number(rawId)) ? rawId : Number(rawId);
                    const data = { ...doc.data(), id: numericId };
                    delete data._syncedAt;
                    arr.push(data);
                });
                db[table] = arr;
                await StorageEngine.save(table, arr).catch(() => {});
                hashes[table] = {};
                arr.forEach(r => { hashes[table][String(r.id)] = hashOf(r); });
            }

            const settingsDoc = await fsDB.collection('meta').doc('settings').get({ source: 'server' });
            report['الإعدادات'] = settingsDoc.exists ? 'موجودة' : 'غير موجودة';
            if (settingsDoc.exists) {
                const data = { ...settingsDoc.data() };
                delete data._syncedAt;
                db._settings = { ...db._settings, ...data };
                localStorage.setItem('edu_master_settings', JSON.stringify(db._settings));
                hashes.__settings = hashOf(db._settings);
            }
            saveHashes();
        } catch (err) {
            console.error('[CloudSync] ❌ فشل الجلب من السحابة', err);
            applyingRemote = false;
            setStatus('error');
            if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }
            alert('❌ فشل جلب البيانات من السحابة:\n' + (err.message || err) + '\n\nافتح Console (F12) لمزيد من التفاصيل.');
            return;
        }
        applyingRemote = false;
        setStatus(navigator.onLine ? 'online' : 'offline');
        scheduleUIRefresh();
        if (btn) { btn.disabled = false; btn.innerHTML = originalHTML; }

        const lines = Object.entries(report).map(([t, v]) => `• ${t}: ${v}`);
        alert('✅ انتهى الجلب من السحابة:\n\n' + lines.join('\n'));
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
            console.error('[CloudSync] ❌ مكتبة Firebase لم تُحمَّل — لن تعمل المزامنة. تأكد من وجود ملفات firebase-app-compat.js و firebase-firestore-compat.js بجانب index.html');
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

    return {
        init, onLocalSave, pushAllTables, isReady: () => ready, debugInfo,
        forceSync: pushAllTables,
        manualPushToCloud, manualPullFromCloud
    };
})();

window.CloudSync = CloudSync;
window.manualPushToCloud  = () => CloudSync.manualPushToCloud();
window.manualPullFromCloud = () => CloudSync.manualPullFromCloud();
