// ============================================================
//  code-generator.js  —  Central Student Code Generator
//  المولّد المركزي لأكواد الطلاب
//
//  يُستخدم من نظام إدارة الدروس (app.js / IndexedDB) فقط.
//  ✅ تم إلغاء كل ما يخص Firebase/Firestore نهائيًا من هذا الملف.
//
//  صيغة الكود:
//    - 12 رقمًا إنجليزيًا فقط  (0-9)
//    - بلا حروف، بلا شرطات، بلا رموز، بلا مسافات
//    - مثال: 182743920561
//
//  ضمانات التفرّد:
//    - IndexedDB: unique index على حقل qrCode
//    - توليد مع retry حتى 20 محاولة، ثم fallback بـ timestamp كامل
// ============================================================

/**
 * يولّد كود خام مكوّن من 12 رقمًا إنجليزيًا فقط.
 *   - أول رقم دائمًا 1-9 (لا يبدأ بصفر)
 *   - 11 رقمًا عشوائيًا بعده
 * @returns {string}  e.g. "182743920561"
 */
function _generateRawCode() {
  const first = Math.floor(1 + Math.random() * 9);           // 1-9
  const rest  = Array.from({ length: 11 }, () =>
    Math.floor(Math.random() * 10)
  ).join('');
  return String(first) + rest;  // 12 أرقام إجمالاً
}

// ──────────────────────────────────────────────────────────────
//  للاستخدام في نظام إدارة الدروس  (IndexedDB / app.js)
//  يتحقق من خلال مصفوفة الطلاب المحليّة (db.students)
// ──────────────────────────────────────────────────────────────

/**
 * يولّد كودًا فريدًا بالتحقق من db.students المحلية.
 * @param {Array} existingStudents  - db.students الحالية
 * @returns {string}
 */
function generateLocalUniqueCode(existingStudents) {
  const usedCodes = new Set(
    (existingStudents || []).map(s => String(s.qrCode || s.centerCode || ''))
  );

  let code;
  let tries = 0;
  do {
    code = _generateRawCode();
    tries++;
  } while (usedCodes.has(code) && tries < 20);

  if (usedCodes.has(code)) {
    // Fallback: timestamp كامل (13 رقمًا → نأخذ 12 بإزالة أول رقم)
    code = String(Date.now()).slice(1);  // 12 رقمًا
  }

  return code;
}

// ──────────────────────────────────────────────────────────────
//  تصدير: Node.js أو Browser (app.js)
// ──────────────────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateLocalUniqueCode,
  };
} else {
  window.generateLocalUniqueCode = generateLocalUniqueCode;
}

