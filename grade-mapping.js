/**
 * grade-mapping.js
 * ============================================================
 *  نظام توحيد السنوات الدراسية بين السيستم (بوابة الحضور) والمنصة
 *
 *  القاعدة:
 *   • GRADE_MAP  →  المرجع الوحيد لكل السنوات
 *   • systemCode  =  القيمة المخزّنة في localStorage وFirestore للسيستم
 *   • platformCode = القيمة التي تفهمها المنصة (register.html / lessons / courses)
 *   • label       = الاسم العربي الكامل للعرض
 *   • shortLabel  = اسم مختصر للبادجات
 * ============================================================
 */

const GRADE_MAP = [
  // ─── ابتدائي ──────────────────────────────────────────────
  { systemCode: 'prim1',  platformCode: '1',      label: 'أولى ابتدائي',   shortLabel: 'أولى ابتدائي'  },
  { systemCode: 'prim2',  platformCode: '2',      label: 'ثانية ابتدائي',  shortLabel: 'ثانية ابتدائي' },
  { systemCode: 'prim3',  platformCode: '3',      label: 'ثالثة ابتدائي',  shortLabel: 'ثالثة ابتدائي' },
  { systemCode: 'prim4',  platformCode: '4',      label: 'رابعة ابتدائي',  shortLabel: 'رابعة ابتدائي' },
  { systemCode: 'prim5',  platformCode: '5',      label: 'خامسة ابتدائي',  shortLabel: 'خامسة ابتدائي' },
  { systemCode: 'prim6',  platformCode: '6',      label: 'سادسة ابتدائي',  shortLabel: 'سادسة ابتدائي' },
  // ─── إعدادي ───────────────────────────────────────────────
  { systemCode: 'prep1',  platformCode: '7',      label: 'أولى إعدادي',    shortLabel: 'أولى إعدادي'   },
  { systemCode: 'prep2',  platformCode: '8',      label: 'ثانية إعدادي',   shortLabel: 'ثانية إعدادي'  },
  { systemCode: 'prep3',  platformCode: '9',      label: 'ثالثة إعدادي',   shortLabel: 'ثالثة إعدادي'  },
  // ─── ثانوي ────────────────────────────────────────────────
  { systemCode: '1',      platformCode: '10',     label: 'أولى ثانوي',     shortLabel: 'أولى ثانوي'    },
  { systemCode: '2',      platformCode: '11',     label: 'ثانية ثانوي',    shortLabel: 'ثانية ثانوي'   },
  { systemCode: '3',      platformCode: '12',     label: 'ثالثة ثانوي',    shortLabel: 'ثالثة ثانوي'   },
];

// ─── جدول الـ fallback للقيم القديمة (للتوافق مع البيانات السابقة) ──
// أي قيمة قديمة في الـ database تُحوَّل تلقائياً لـ systemCode الجديد
const LEGACY_TO_SYSTEM = {
  // قيم المنصة القديمة
  '301':   '1',   '302': '2',   '303': '3',   '203': 'prep3',
  // أسماء قديمة مكتوبة يدوياً
  'أولى ثانوي':    '1',   'أول ثانوي':   '1',   'أولي ثانوي': '1',
  'ثانية ثانوي':   '2',   'تاني ثانوي':  '2',   'ثاني ثانوي': '2',
  'ثالثة ثانوي':   '3',   'تالت ثانوي':  '3',   'ثالث ثانوي': '3',
  'ثالث إعدادي':   'prep3', 'ثالثة إعدادي': 'prep3', 'تالت إعدادي': 'prep3',
  'ثاني إعدادي':   'prep2',  'ثانية إعدادي': 'prep2',
  'أول إعدادي':    'prep1',  'أولى إعدادي':  'prep1',
  'أولى ابتدائي':  'prim1',  'أول ابتدائي':  'prim1',
  'ثانية ابتدائي': 'prim2',  'ثالثة ابتدائي':'prim3',
  'رابعة ابتدائي': 'prim4',  'خامسة ابتدائي':'prim5',  'سادسة ابتدائي':'prim6',
};

// ─── دوال المساعدة ────────────────────────────────────────────

/** يُعيد entry كامل من GRADE_MAP بحسب systemCode أو قيمة legacy */
function getGradeEntry(rawCode) {
  if (!rawCode) return null;
  const code = String(rawCode).trim();
  // بحث مباشر
  let entry = GRADE_MAP.find(g => g.systemCode === code);
  if (entry) return entry;
  // بحث في legacy
  const mapped = LEGACY_TO_SYSTEM[code];
  if (mapped) return GRADE_MAP.find(g => g.systemCode === mapped) || null;
  return null;
}

/** systemCode → الاسم العربي الكامل */
function gradeLabel(systemCode) {
  const entry = getGradeEntry(systemCode);
  return entry ? entry.label : (systemCode || '');
}

/** systemCode → الكود الذي تفهمه المنصة */
function gradeToPlatformCode(systemCode) {
  const entry = getGradeEntry(systemCode);
  return entry ? entry.platformCode : String(systemCode || '');
}

/** platformCode → systemCode */
function platformCodeToSystem(platformCode) {
  const code = String(platformCode || '').trim();
  const entry = GRADE_MAP.find(g => g.platformCode === code);
  return entry ? entry.systemCode : code;
}

/** أي قيمة خام (legacy/platform/system) → systemCode نظيف */
function normalizeGrade(rawValue) {
  if (!rawValue) return '';
  const code = String(rawValue).trim();
  // هل هو systemCode مباشرة؟
  if (GRADE_MAP.find(g => g.systemCode === code)) return code;
  // هل هو platformCode؟
  const byPlatform = GRADE_MAP.find(g => g.platformCode === code);
  if (byPlatform) return byPlatform.systemCode;
  // هل هو legacy؟
  const byLegacy = LEGACY_TO_SYSTEM[code];
  if (byLegacy) return byLegacy;
  return code;
}

/**
 * يُوحّد بيانات طالب قادم من Firebase قبل حفظه محلياً.
 * يقرأ grade أو offlineGrade ويحوّلهما لـ systemCode.
 */
function normalizeImportedStudentGrade(data) {
  const candidates = [data.grade, data.offlineGrade, data.platformGrade];
  for (const c of candidates) {
    const normalized = normalizeGrade(c);
    if (normalized) return normalized;
  }
  return '';
}

/**
 * يُحضّر كائن الطالب للإرسال إلى Firebase / المنصة.
 * يُضيف platformGrade و gradeLabel تلقائياً.
 */
function buildStudentExportPayload(studentObj) {
  const systemCode = normalizeGrade(studentObj.grade);
  const entry = getGradeEntry(systemCode);
  return {
    ...studentObj,
    grade: systemCode,               // systemCode المُنظَّف
    platformGrade: entry ? entry.platformCode : systemCode,  // للمنصة
    gradeLabel: entry ? entry.label : systemCode,            // للعرض
    offlineGrade: systemCode,        // توافق مع الكود القديم
  };
}

/** يُنشئ <option> elements لكل السنوات الدراسية */
function buildGradeOptions(selectedCode = '', includeAll = false) {
  let html = includeAll ? '<option value="all">كل الصفوف</option>' : '<option value="">اختر الصف الدراسي</option>';
  const groups = [
    { label: 'المرحلة الابتدائية', codes: ['prim1','prim2','prim3','prim4','prim5','prim6'] },
    { label: 'المرحلة الإعدادية',  codes: ['prep1','prep2','prep3'] },
    { label: 'المرحلة الثانوية',   codes: ['1','2','3'] },
  ];
  groups.forEach(group => {
    html += `<optgroup label="${group.label}">`;
    group.codes.forEach(code => {
      const entry = GRADE_MAP.find(g => g.systemCode === code);
      if (!entry) return;
      const sel = (code === selectedCode) ? ' selected' : '';
      html += `<option value="${code}"${sel}>${entry.label}</option>`;
    });
    html += '</optgroup>';
  });
  return html;
}

/** gradeClass للـ badge (للتوافق مع الكود القديم) */
function gradeClass(systemCode) {
  const entry = getGradeEntry(systemCode);
  if (!entry) return 'grade1';
  if (entry.platformCode <= '6')  return 'grade-prim';
  if (entry.platformCode <= '9')  return 'grade-prep';
  if (entry.platformCode === '10') return 'grade1';
  if (entry.platformCode === '11') return 'grade2';
  return 'grade3';
}

// ─── تصدير global ────────────────────────────────────────────
window.GRADE_MAP                    = GRADE_MAP;
window.LEGACY_TO_SYSTEM             = LEGACY_TO_SYSTEM;
window.getGradeEntry                = getGradeEntry;
window.gradeLabel                   = gradeLabel;
window.gradeToPlatformCode          = gradeToPlatformCode;
window.platformCodeToSystem         = platformCodeToSystem;
window.normalizeGrade               = normalizeGrade;
window.normalizeImportedStudentGrade = normalizeImportedStudentGrade;
window.buildStudentExportPayload    = buildStudentExportPayload;
window.buildGradeOptions            = buildGradeOptions;
window.gradeClass                   = gradeClass;
