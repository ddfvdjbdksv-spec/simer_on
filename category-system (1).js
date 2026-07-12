// ============================================================
//  category-system.js  —  نظام الفئات المركزي
//  Central Category System
//
//  المبدأ:
//    كل صف دراسي له categoryId ثابت وفريد.
//    جميع العمليات (طلاب، اختبارات، كورسات، نتائج، مدفوعات)
//    تعتمد على categoryId وليس على اسم الفئة.
//
//  جدول الفئات:
//    categoryId (رقم)  ←→  systemCode (grade-mapping)  ←→  label (عرض للمستخدم)
//
//  الاستخدام:
//    <script src="grade-mapping.js"></script>
//    <script src="category-system.js"></script>
// ============================================================

/**
 * جدول الفئات الثابت — المرجع الوحيد في كل النظام.
 *
 * categoryId : رقم صحيح ثابت، لا يتغير أبداً، يُخزَّن في DB
 * systemCode : نفس كود grade-mapping.js
 * platformCode: الكود الذي تفهمه المنصة (register / lessons / courses)
 * label      : الاسم الكامل للعرض للمستخدم
 * shortLabel : اسم مختصر للبادجات والفلاتر
 * group      : المرحلة (primary / prep / secondary)
 */
const CATEGORY_TABLE = [
  // ─── ابتدائي ───────────────────────────────────────────────
  { categoryId:  1, systemCode: 'prim1', platformCode:  '1', label: 'أولى ابتدائي',   shortLabel: 'أولى ابتدائي',   group: 'primary'   },
  { categoryId:  2, systemCode: 'prim2', platformCode:  '2', label: 'ثانية ابتدائي',  shortLabel: 'ثانية ابتدائي',  group: 'primary'   },
  { categoryId:  3, systemCode: 'prim3', platformCode:  '3', label: 'ثالثة ابتدائي',  shortLabel: 'ثالثة ابتدائي',  group: 'primary'   },
  { categoryId:  4, systemCode: 'prim4', platformCode:  '4', label: 'رابعة ابتدائي',  shortLabel: 'رابعة ابتدائي',  group: 'primary'   },
  { categoryId:  5, systemCode: 'prim5', platformCode:  '5', label: 'خامسة ابتدائي',  shortLabel: 'خامسة ابتدائي',  group: 'primary'   },
  { categoryId:  6, systemCode: 'prim6', platformCode:  '6', label: 'سادسة ابتدائي',  shortLabel: 'سادسة ابتدائي',  group: 'primary'   },
  // ─── إعدادي ────────────────────────────────────────────────
  { categoryId:  7, systemCode: 'prep1', platformCode:  '7', label: 'أولى إعدادي',    shortLabel: 'أولى إعدادي',    group: 'prep'      },
  { categoryId:  8, systemCode: 'prep2', platformCode:  '8', label: 'ثانية إعدادي',   shortLabel: 'ثانية إعدادي',   group: 'prep'      },
  { categoryId:  9, systemCode: 'prep3', platformCode:  '9', label: 'ثالثة إعدادي',   shortLabel: 'ثالثة إعدادي',   group: 'prep'      },
  // ─── ثانوي ─────────────────────────────────────────────────
  { categoryId: 10, systemCode: '1',     platformCode: '10', label: 'أولى ثانوي',     shortLabel: 'أولى ثانوي',     group: 'secondary' },
  { categoryId: 11, systemCode: '2',     platformCode: '11', label: 'ثانية ثانوي',    shortLabel: 'ثانية ثانوي',    group: 'secondary' },
  { categoryId: 12, systemCode: '3',     platformCode: '12', label: 'ثالثة ثانوي',    shortLabel: 'ثالثة ثانوي',    group: 'secondary' },
];

// ─── Legacy mapping: قيم قديمة → categoryId ───────────────
// يشمل كل ما كان في LEGACY_TO_SYSTEM + قيم register.html القديمة
const CATEGORY_LEGACY_MAP = {
  // قيم المنصة القديمة
  '301': 10, '302': 11, '303': 12, '203': 9,
  // systemCode المباشرة
  'prim1': 1, 'prim2': 2, 'prim3': 3, 'prim4': 4, 'prim5': 5, 'prim6': 6,
  'prep1': 7, 'prep2': 8, 'prep3': 9,
  '1': 10, '2': 11, '3': 12,
  // platformCode
  '7': 7, '8': 8, '9': 9, '10': 10, '11': 11, '12': 12,
  // register.html القديمة
  'sec1': 10,
  'sec2_science_bio': 11, 'sec2_science_math': 11, 'sec2_arts': 11,
  'sec3_science_bio': 12, 'sec3_science_math': 12, 'sec3_arts': 12,
  // booking.html القديمة
  '2': 11, '3': 12,
  // أسماء عربية قديمة
  'أولى ثانوي': 10, 'أول ثانوي': 10, 'أولي ثانوي': 10,
  'ثانية ثانوي': 11, 'تاني ثانوي': 11, 'ثاني ثانوي': 11,
  'ثالثة ثانوي': 12, 'تالت ثانوي': 12, 'ثالث ثانوي': 12,
  'ثالث إعدادي': 9, 'ثالثة إعدادي': 9, 'تالت إعدادي': 9,
  'ثاني إعدادي': 8, 'ثانية إعدادي': 8,
  'أول إعدادي': 7, 'أولى إعدادي': 7,
  'أولى ابتدائي': 1, 'أول ابتدائي': 1,
  'ثانية ابتدائي': 2, 'ثالثة ابتدائي': 3,
  'رابعة ابتدائي': 4, 'خامسة ابتدائي': 5, 'سادسة ابتدائي': 6,
  // ثاني وثالث ثانوي بالأرقام (من booking)
  'ثاني ثانوي': 11, 'ثالث ثانوي': 12,
};

// ══════════════════════════════════════════════════════════════
//  دوال البحث الأساسية
// ══════════════════════════════════════════════════════════════

/**
 * يُعيد entry كامل من CATEGORY_TABLE بحسب categoryId
 * @param {number|string} categoryId
 * @returns {object|null}
 */
function getCategoryById(categoryId) {
  const id = Number(categoryId);
  if (!id) return null;
  return CATEGORY_TABLE.find(c => c.categoryId === id) || null;
}

/**
 * يُحوّل أي قيمة (legacy / systemCode / platformCode / اسم عربي)
 * إلى categoryId صحيح.
 * @param {any} rawValue
 * @returns {number|null}
 */
function toCategoryId(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') return null;

  // إذا كان رقماً مباشرة بين 1 و 12 → تحقق إذا هو categoryId
  const num = Number(rawValue);
  if (!isNaN(num) && num >= 1 && num <= 12 && Number.isInteger(num)) {
    const direct = CATEGORY_TABLE.find(c => c.categoryId === num);
    if (direct) return direct.categoryId;
  }

  const str = String(rawValue).trim();

  // بحث في legacy map (يغطي كل الحالات)
  if (CATEGORY_LEGACY_MAP[str] !== undefined) {
    return CATEGORY_LEGACY_MAP[str];
  }

  // بحث في CATEGORY_TABLE مباشرة
  const bySystem   = CATEGORY_TABLE.find(c => c.systemCode   === str);
  if (bySystem)   return bySystem.categoryId;

  const byPlatform = CATEGORY_TABLE.find(c => c.platformCode === str);
  if (byPlatform) return byPlatform.categoryId;

  const byLabel    = CATEGORY_TABLE.find(c => c.label        === str || c.shortLabel === str);
  if (byLabel)    return byLabel.categoryId;

  return null;
}

/**
 * يُعيد categoryId الطالب من كائن بيانات الطالب.
 * يقرأ categoryId أولاً، ثم يُعيد الحساب من grade إذا لم يوجد.
 * @param {object} studentData
 * @returns {number|null}
 */
function getStudentCategoryId(studentData) {
  if (!studentData) return null;

  // أولوية: categoryId المخزّن مباشرة
  if (studentData.categoryId) {
    const id = Number(studentData.categoryId);
    if (id >= 1 && id <= 12) return id;
  }

  // fallback: احسب من أي حقل grade متاح
  const candidates = [
    studentData.grade,
    studentData.offlineGrade,
    studentData.platformGrade,
    studentData.groupGrade,
  ];
  for (const c of candidates) {
    const id = toCategoryId(c);
    if (id) return id;
  }

  return null;
}

// ══════════════════════════════════════════════════════════════
//  دوال التحويل (للعرض والحفظ)
// ══════════════════════════════════════════════════════════════

/**
 * categoryId → الاسم الكامل للعرض
 */
function categoryLabel(categoryId) {
  const entry = getCategoryById(categoryId);
  return entry ? entry.label : String(categoryId || '');
}

/**
 * categoryId → systemCode (للتوافق مع grade-mapping.js)
 */
function categoryToSystemCode(categoryId) {
  const entry = getCategoryById(categoryId);
  return entry ? entry.systemCode : '';
}

/**
 * categoryId → platformCode (للمنصة)
 */
function categoryToPlatformCode(categoryId) {
  const entry = getCategoryById(categoryId);
  return entry ? entry.platformCode : '';
}

/**
 * يُنشئ كائن بيانات الفئة الكامل لحفظه مع الطالب أو الاختبار.
 * يُضيف categoryId + systemCode + platformCode + categoryLabel
 */
function buildCategoryPayload(rawGradeOrCategoryId) {
  const catId = typeof rawGradeOrCategoryId === 'number' && rawGradeOrCategoryId >= 1
    ? rawGradeOrCategoryId
    : toCategoryId(rawGradeOrCategoryId);

  const entry = getCategoryById(catId);

  return entry
    ? {
        categoryId:    entry.categoryId,
        categoryLabel: entry.label,
        grade:         entry.systemCode,
        platformGrade: entry.platformCode,
        offlineGrade:  entry.systemCode,
      }
    : {
        categoryId:    null,
        categoryLabel: '',
        grade:         String(rawGradeOrCategoryId || ''),
        platformGrade: '',
        offlineGrade:  '',
      };
}

// ══════════════════════════════════════════════════════════════
//  دوال الفلترة (للاستخدام في الاختبارات، لوحة التحكم، إلخ)
// ══════════════════════════════════════════════════════════════

/**
 * يُقارن categoryId لاختبار بـ categoryId لطالب.
 * الاختبار بلا categoryId → يظهر للكل.
 * @param {object} quiz   - بيانات الاختبار
 * @param {number} studentCatId
 * @returns {boolean}
 */
function quizMatchesStudent(quiz, studentCatId) {
  const qCatId = quiz.categoryId
    ? Number(quiz.categoryId)
    : toCategoryId(quiz.grade || quiz.targetGrade || '');

  if (!qCatId) return true; // بلا فئة → للكل
  return qCatId === studentCatId;
}

/**
 * يُقارن categoryId لطالب بفلتر فئة معيّن.
 * إذا كان الفلتر 'all' أو null → يُعيد true.
 * @param {object} studentData
 * @param {number|string|null} filterCategoryId
 * @returns {boolean}
 */
function studentMatchesFilter(studentData, filterCategoryId) {
  if (!filterCategoryId || filterCategoryId === 'all') return true;
  return getStudentCategoryId(studentData) === Number(filterCategoryId);
}

// ══════════════════════════════════════════════════════════════
//  دوال واجهة المستخدم
// ══════════════════════════════════════════════════════════════

/**
 * يُنشئ <option> elements لقائمة الصفوف مرتّبة بمجموعات.
 * @param {number|string} selectedCategoryId - الفئة المحدّدة حالياً
 * @param {boolean} includeAll - هل تضيف خيار "كل الصفوف"؟
 * @returns {string} HTML string
 */
function buildCategoryOptions(selectedCategoryId = '', includeAll = false) {
  const selId = Number(selectedCategoryId) || null;
  let html = includeAll
    ? '<option value="all">كل الصفوف</option>'
    : '<option value="">اختر الصف الدراسي</option>';

  const groups = [
    { label: 'المرحلة الابتدائية', ids: [1, 2, 3, 4, 5, 6] },
    { label: 'المرحلة الإعدادية',  ids: [7, 8, 9] },
    { label: 'المرحلة الثانوية',   ids: [10, 11, 12] },
  ];

  groups.forEach(g => {
    html += `<optgroup label="${g.label}">`;
    g.ids.forEach(id => {
      const entry = getCategoryById(id);
      if (!entry) return;
      const sel = (id === selId) ? ' selected' : '';
      html += `<option value="${id}"${sel}>${entry.label}</option>`;
    });
    html += '</optgroup>';
  });

  return html;
}

/**
 * يُعيد شارة HTML للفئة (badge) بلون مناسب للمرحلة.
 * @param {number} categoryId
 * @returns {string}
 */
function categoryBadgeHtml(categoryId) {
  const entry = getCategoryById(categoryId);
  if (!entry) return '';
  const colors = {
    primary:   { bg: '#e8f4f8', color: '#0077b6' },
    prep:      { bg: '#fff8e8', color: '#e67e22' },
    secondary: { bg: '#eef2ff', color: '#5c6bc0' },
  };
  const c = colors[entry.group] || colors.secondary;
  return `<span style="background:${c.bg};color:${c.color};padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;">🎓 ${entry.shortLabel}</span>`;
}

// ══════════════════════════════════════════════════════════════
//  دالة تهيئة: تُضيف categoryId لطالب إذا لم يكن موجوداً
// ══════════════════════════════════════════════════════════════

/**
 * يُطبّع بيانات طالب: يضيف categoryId وجميع حقول الفئة.
 * يُستخدم عند استيراد طلاب من Firebase أو تسجيل جديد.
 * @param {object} studentData
 * @returns {object} studentData مُحدَّث
 */
function normalizeStudentCategory(studentData) {
  const catId = getStudentCategoryId(studentData);
  if (!catId) return studentData;

  const payload = buildCategoryPayload(catId);
  return { ...studentData, ...payload };
}

// ══════════════════════════════════════════════════════════════
//  تصدير: Browser أو Node.js
// ══════════════════════════════════════════════════════════════
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CATEGORY_TABLE,
    CATEGORY_LEGACY_MAP,
    getCategoryById,
    toCategoryId,
    getStudentCategoryId,
    categoryLabel,
    categoryToSystemCode,
    categoryToPlatformCode,
    buildCategoryPayload,
    quizMatchesStudent,
    studentMatchesFilter,
    buildCategoryOptions,
    categoryBadgeHtml,
    normalizeStudentCategory,
  };
} else {
  window.CATEGORY_TABLE          = CATEGORY_TABLE;
  window.CATEGORY_LEGACY_MAP     = CATEGORY_LEGACY_MAP;
  window.getCategoryById         = getCategoryById;
  window.toCategoryId            = toCategoryId;
  window.getStudentCategoryId    = getStudentCategoryId;
  window.categoryLabel           = categoryLabel;
  window.categoryToSystemCode    = categoryToSystemCode;
  window.categoryToPlatformCode  = categoryToPlatformCode;
  window.buildCategoryPayload    = buildCategoryPayload;
  window.quizMatchesStudent      = quizMatchesStudent;
  window.studentMatchesFilter    = studentMatchesFilter;
  window.buildCategoryOptions    = buildCategoryOptions;
  window.categoryBadgeHtml       = categoryBadgeHtml;
  window.normalizeStudentCategory = normalizeStudentCategory;
}
