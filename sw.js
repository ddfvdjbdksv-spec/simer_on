// ============================================================
//  sw.js  —  Service Worker مع نظام التحديث التلقائي
//
//  آلية التحديث:
//    1. عند كل فتح للتطبيق يتحقق المتصفح من sw.js تلقائياً
//    2. إذا تغيّر CACHE_VERSION → يبدأ install جديد في الخلفية
//    3. بعد اكتمال التحميل، يرسل SW رسالة UPDATE_READY للتطبيق
//    4. التطبيق يُظهر للمستخدم إشعار "تحديث جاهز" → يضغط → يُطبَّق
//    5. أو: يُطبَّق تلقائياً بعد 10 ثوانٍ بدون تدخّل
// ============================================================

const CACHE_VERSION = 'edarat-eldroos-pwa-v23';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './user-management.js',
  './firebase-sync.js',
  './vendor/firebase/firebase-app-compat.js',
  './vendor/firebase/firebase-firestore-compat.js',
  './archive_functions.js',
  './platform-subscriptions.js',
  './transfer-student.js',
  './code-generator.js',
  './grade-mapping.js',
  './manifest.webmanifest',
  './app-icon-192.png',
  './app-icon-512.png',
  './app-icon-maskable-512.png',
  './apple-touch-icon.png'
];

// مكتبات خارجية (CDN) — تُخزَّن مسبقاً وقت التثبيت لضمان عملها أوفلاين
// فوراً من أول تشغيل، بدلاً من انتظار أول استخدام ناجح لها أونلاين
const EXTERNAL_LIBS = [
  'https://unpkg.com/html5-qrcode',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// ─── Install: تحميل كل ملفات الـ App Shell في الـ Cache ───
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version: ${CACHE_VERSION}`);
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => Promise.all(
        [...APP_SHELL, ...EXTERNAL_LIBS].map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Failed to cache:', url, err);
            return null;
          })
        )
      ))
      // skipWaiting: الـ SW الجديد يأخذ السيطرة فور اكتمال التحميل
      // لكن لن يُعيد تحميل الصفحة بنفسه — نحن من نقرر متى
      .then(() => {
        console.log(`[SW] Install complete: ${CACHE_VERSION}`);
        return self.skipWaiting();
      })
  );
});

// ─── Activate: حذف الـ Cache القديم وأخذ السيطرة الكاملة ──
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version: ${CACHE_VERSION}`);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => {
            console.log(`[SW] Deleting old cache: ${key}`);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim())
      .then(async () => {
        // ✅ أبلغ كل النوافذ المفتوحة بأن تحديثاً جديداً تم تفعيله
        const clients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        });
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: CACHE_VERSION
          });
        });
        console.log(`[SW] Activated & notified ${clients.length} clients`);
      })
  );
});

// ─── Fetch: Cache-First للـ Shell، Network-First للباقي ───
// ✅ إصلاح: "أوفلاين" على بعض الأجهزة لا يعني فشل fetch فوراً — أحياناً
// الطلب يظل معلّقاً (hang) لثوانٍ طويلة قبل أن يفشل، وهو ما كان يُظهر
// الشاشة الزرقاء (شاشة الـ splash) متجمّدة دون أن يكتمل تحميل app.js
// وبالتالي لا يعمل تسجيل الدخول. نحدّد مهلة قصيرة للشبكة ثم نرجع للكاش فوراً.
const NETWORK_TIMEOUT_MS = 3000;

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('network-timeout')), ms);
    fetch(request, { cache: 'no-store' }).then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  // ✅ إصلاح: تجاهل الـ query string (?v=N) عند المطابقة، لأن الملفات
  // اتخزنت بدون ?v= وقت install لكن بتتطلب فعليًا بـ ?v= من index.html
  // (مثال: app.js?v=7) — بدون ignoreSearch الطلب مكنش بيتطابق مع الكاش
  // فيضطر يروح للشبكة، ولو أوفلاين كان بيفشل بالكامل (ده كان سبب تعطل
  // تسجيل الدخول أوفلاين لأن app.js كان بيفشل في التحميل).
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const fresh = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (fresh && fresh.ok) await cache.put(request, fresh.clone());
    return fresh;
  } catch (error) {
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html', { ignoreSearch: true });
      if (shell) return shell;
    }
    throw error;
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const fresh = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (fresh && fresh.ok) await cache.put(request, fresh.clone());
    return fresh;
  } catch (error) {
    // نفس إصلاح تجاهل الـ query string هنا كمان
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html', { ignoreSearch: true });
      if (shell) return shell;
    }
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // الموارد الخارجية (CDN) → Network-First مع مهلة قصيرة + Cache fallback
  if (url.origin !== self.location.origin) {
    event.respondWith(networkFirst(request));
    return;
  }

  // ✅ إصلاح: كل ملفات نفس النطاق (HTML/CSS/JS/صور/Manifest...) تُعامَل
  // Cache-First دائماً، بدل الاعتماد على مطابقة المسار مع APP_SHELL فقط
  // (كانت هذه المطابقة تفشل لو تم رفع المشروع داخل مجلد فرعي، فيضطر
  // الطلب للذهاب للشبكة ويعلّق التطبيق بالكامل عند انقطاع الإنترنت).
  // هذا التطبيق مصمم للعمل أوفلاين بالكامل ودائماً، لذا الكاش دائماً أولاً.
  event.respondWith(cacheFirst(request));
});

// ─── Messages من التطبيق ────────────────────────────────────
self.addEventListener('message', (event) => {
  if (!event.data) return;

  // طلب تطبيق SW الجديد فوراً (من زر التحديث في الـ UI)
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // تنظيف كامل للـ Cache + تطبيق التحديث (Hard Refresh)
  if (event.data.type === 'FORCE_CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.skipWaiting())
    );
  }

  // تسجيل Periodic Background Sync للخزنة
  if (event.data.type === 'REGISTER_TREASURY_SYNC') {
    registerPeriodicSync();
  }

  if (event.data.type === 'TREASURY_ARCHIVE_DONE') {
    self._lastArchiveDate = event.data.date;
  }
});

// ─── Periodic Background Sync ──────────────────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'treasury-daily-archive') {
    event.waitUntil(notifyClientsToArchive());
  }
});

async function registerPeriodicSync() {
  try {
    const registration = self.registration;
    if (registration && registration.periodicSync) {
      await registration.periodicSync.register('treasury-daily-archive', {
        minInterval: 12 * 60 * 60 * 1000
      });
    }
  } catch (e) {
    console.log('[SW] periodicSync not supported');
  }
}

async function notifyClientsToArchive() {
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  });
  const todayStr = new Date().toLocaleDateString('en-CA');
  if (clients.length > 0) {
    clients.forEach((client) => {
      client.postMessage({ type: 'RUN_TREASURY_ARCHIVE', date: todayStr });
    });
  } else {
    self._pendingArchive = todayStr;
  }
}
