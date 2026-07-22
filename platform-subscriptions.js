/**
 * نظام اشتراكات المنصة (Offline-First)
 * Platform Subscriptions Module
 *
 * يضيف نوع اشتراك جديد "اشتراك المنصة" بجانب "اشتراك الدرس" الحالي،
 * مع دعم كامل للعمل بدون إنترنت وجدول مزامنة معلّقة (platform_subscriptions)
 * يُرفع تلقائياً إلى Firebase عند توافر الاتصال.
 */

// ============================================
// State
// ============================================
let platformSubModalStudentId = null;
let platformSubAutoSyncTimer = null;
let platformSubSelectedCourses = [];

// ============================================
// Helpers
// ============================================

/** ✅ يتحقق من جاهزية Firestore وحالة الاتصال بالإنترنت */
async function isReallyOnline() {
    return navigator.onLine && !!(window._firestoreDB || (typeof CloudSync !== 'undefined' && CloudSync.isReady && CloudSync.isReady()));
}

/** قائمة كورسات المنصة المتاحة للصف الحالي (أو الكل إن لم يوجد صف) */
function getAvailablePlatformCourses(searchTerm = '') {
    const grade = mapOfflineGradeToPlatformGrade(currentGrade);
    const term = (searchTerm || '').trim().toLowerCase();

    return (db.platformCourses || []).filter(c => {
        const matchesGrade = !c.grade || c.grade === 'all' || String(c.grade) === String(grade);
        if (!matchesGrade) return false;
        if (!term) return true;
        const haystack = `${c.courseTitle || ''} ${c.courseId || ''}`.toLowerCase();
        return haystack.includes(term);
    });
}

// ============================================
// 1. تحديث الكورسات (تحميلها وحفظها محلياً)
// ============================================

/**
 * يجلب جميع الكورسات من Firebase ويحفظها محلياً.
 *
 * ── استراتيجية الجلب (بالترتيب) ──────────────────────────────────
 *  1. يجرب Collection  'platform_courses'  (المسار الأصلي).
 *  2. إذا رجعت صفر نتائج يجرب 'courses' (اسم بديل شائع).
 *  3. إذا رجعت صفر نتائج ينتقل لـ Fallback:
 *     يبني الكورسات الفريدة من course_codes المحفوظة محلياً
 *     (التي تحتوي courseId + courseTitle + grade + price بالفعل).
 *
 * ── لماذا course_codes كـ Fallback؟ ──────────────────────────────
 *  • course_codes تُجلب بنجاح وتحتوي بيانات كل كورس (id, title, grade, price).
 *  • نستخرج الكورسات الفريدة منها مباشرة بدلاً من ترك القائمة فارغة.
 */
async function refreshPlatformCourses() {
    const btn = document.getElementById('btn-refresh-platform-courses');
    try {
        const online = await isReallyOnline();
        if (!online) {
            // offline: حاول البناء من course_codes المحلية
            const built = _buildCoursesFromCourseCodes();
            if (built.length) {
                db.platformCourses = built;
                await StorageEngine.save('platformCourses', built);
                showNotification(`لا يوجد إنترنت — تم بناء ${built.length} كورس من الأكواد المحلية.`, 'warning');
                if (typeof populateCycleCourseSelect === 'function') populateCycleCourseSelect();
                return true;
            }
            showNotification('لا يوجد اتصال بالإنترنت. سيتم استخدام آخر نسخة محفوظة من الكورسات.', 'warning');
            return false;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تحديث الكورسات...';
        }

        let courses = [];
        let sourceUsed = '';

        // ─── المحاولة 0: platform_data/courses_list (المصدر الحقيقي للمنصة) ───────────────────
        try {
            const fsDb = window._firestoreDB || (typeof CloudSync !== 'undefined' ? CloudSync.getFirestoreDB() : null);
            if (!fsDb) throw new Error('Firestore not initialized');
            const doc = await fsDb.collection('platform_data').doc('courses_list').get();
            if (doc.exists) {
                const data = doc.data();
                if (Array.isArray(data.items) && data.items.length > 0) {
                    data.items.forEach(c => {
                        courses.push({
                            id: String(c.id),
                            courseId: String(c.id),
                            courseTitle: c.title || 'كورس بدون اسم',
                            grade: c.grade || '',
                            price: Number(c.price || 0),
                            status: c.status || 'active'
                        });
                    });
                    sourceUsed = 'platform_data/courses_list';
                    console.log('[COURSES] platform_data/courses_list ✅', courses.length);
                }
            }
        } catch (e) {
            console.warn('[COURSES] platform_data/courses_list خطأ:', e.message);
        }

        // ─── المحاولة 1: platform_courses ───────────────────────────
        if (!courses.length) {
            try {
                const fsDb = window._firestoreDB || (typeof CloudSync !== 'undefined' ? CloudSync.getFirestoreDB() : null);
                if (!fsDb) throw new Error('Firestore not initialized');
                const snap1 = await fsDb.collection('platform_courses').get();
                if (!snap1.empty) {
                    snap1.forEach(doc => {
                        const d = doc.data();
                        courses.push({
                            id: doc.id,
                            courseId: d.courseId || d.id || doc.id,
                            courseTitle: d.courseTitle || d.title || d.name || 'كورس بدون اسم',
                            grade: d.grade || d.gradeId || '',
                            price: Number(d.price || d.unitPrice || d.cost || 0),
                            status: d.status || 'active'
                        });
                    });
                    sourceUsed = 'platform_courses';
                    console.log('[COURSES] platform_courses ✅', courses.length);
                } else {
                    console.warn('[COURSES] platform_courses فارغة — جاري تجربة مسار بديل...');
                }
            } catch (e) {
                console.warn('[COURSES] platform_courses خطأ:', e.message);
            }
        }

        // ─── المحاولة 2: courses ─────────────────────────────────────
        if (!courses.length) {
            try {
                const fsDb = window._firestoreDB || (typeof CloudSync !== 'undefined' ? CloudSync.getFirestoreDB() : null);
                if (!fsDb) throw new Error('Firestore not initialized');
                const snap2 = await fsDb.collection('courses').get();
                if (!snap2.empty) {
                    snap2.forEach(doc => {
                        const d = doc.data();
                        courses.push({
                            id: doc.id,
                            courseId: d.courseId || d.id || doc.id,
                            courseTitle: d.courseTitle || d.title || d.name || 'كورس بدون اسم',
                            grade: d.grade || d.gradeId || '',
                            price: Number(d.price || d.unitPrice || d.cost || 0),
                            status: d.status || 'active'
                        });
                    });
                    sourceUsed = 'courses';
                    console.log('[COURSES] courses ✅', courses.length);
                } else {
                    console.warn('[COURSES] courses فارغة أيضاً.');
                }
            } catch (e) {
                console.warn('[COURSES] courses خطأ:', e.message);
            }
        }

        // ─── Fallback: بناء من course_codes ──────────────────────────
        if (!courses.length) {
            console.warn('[COURSES] لا توجد كورسات من Firebase — سيتم البناء من course_codes.');
            // تحديث course_codes من Firebase أولاً
            try {
                const fsDb = window._firestoreDB || (typeof CloudSync !== 'undefined' ? CloudSync.getFirestoreDB() : null);
                if (!fsDb) throw new Error('Firestore not initialized');
                const codesSnap = await fsDb.collection('course_codes').get();
                if (!codesSnap.empty) {
                    const freshCodes = [];
                    codesSnap.forEach(doc => freshCodes.push({ id: doc.id, ...doc.data() }));
                    db.courseCodes = freshCodes;
                    await StorageEngine.save('courseCodes', freshCodes);
                    console.log('[COURSES] course_codes محدّثة:', freshCodes.length);
                }
            } catch (e) {
                console.warn('[COURSES] تعذّر تحديث course_codes:', e.message);
            }
            courses = _buildCoursesFromCourseCodes();
            sourceUsed = 'course_codes (fallback)';
            console.log('[COURSES] courses مبنية من course_codes:', courses.length);
        }

        db.platformCourses = courses;
        await StorageEngine.save('platformCourses', courses);

        if (courses.length) {
            showNotification(
                `✅ تم تحديث ${courses.length} كورس من (${sourceUsed}). يمكنك الاختيار الآن.`,
                'success'
            );
        } else {
            showNotification(
                '⚠️ لا توجد كورسات في قاعدة البيانات. تأكد من إضافة الكورسات على المنصة.',
                'warning'
            );
        }

        if (typeof populateCycleCourseSelect === 'function') populateCycleCourseSelect();
        return true;

    } catch (err) {
        console.error('refreshPlatformCourses failed', err);
        showNotification('حدث خطأ أثناء تحديث الكورسات: ' + err.message, 'error');
        return false;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> تحديث الكورسات';
        }
    }
}

/**
 * يبني قائمة كورسات فريدة من db.courseCodes المحفوظة محلياً.
 * السعر = أول قيمة price/unitPrice/discountedPrice في أكواد نفس الكورس.
 */
function _buildCoursesFromCourseCodes() {
    const codes = db.courseCodes || [];
    if (!codes.length) return [];
    const map = new Map();
    codes.forEach(c => {
        const cid = String(c.courseId || '').trim();
        if (!cid) return;
        if (!map.has(cid)) {
            map.set(cid, {
                id: cid,
                courseId: cid,
                courseTitle: c.courseTitle || c.title || 'كورس بدون اسم',
                grade: String(c.grade || ''),
                price: Number(c.price || c.unitPrice || c.discountedPrice || 0),
                status: 'active'
            });
        } else {
            const existing = map.get(cid);
            if (!existing.courseTitle || existing.courseTitle === 'كورس بدون اسم')
                existing.courseTitle = c.courseTitle || c.title || existing.courseTitle;
            if (!existing.grade) existing.grade = String(c.grade || '');
            if (!existing.price) existing.price = Number(c.price || c.unitPrice || c.discountedPrice || 0);
        }
    });
    return Array.from(map.values());
}

// ============================================
// 1.5 إعدادات "بدء الاشتراك" - نوع الاشتراك وكورس المنصة
// ============================================

/**
 * تُستدعى عند تغيير "نوع الاشتراك" في شاشة الخزنة والمالية → بدء الاشتراك.
 * تُظهر/تُخفي قائمة اختيار كورس المنصة بحسب النوع المختار.
 */
function onCycleSubscriptionTypeChange() {
    const typeSelect = document.getElementById('cycle-subscription-type');
    const courseWrapper = document.getElementById('cycle-platform-course-wrapper');
    const feeInput = document.getElementById('monthly-fee-input');
    if (!typeSelect || !courseWrapper) return;

    const type = typeSelect.value;
    const needsCourse = (type === 'platform' || type === 'both');
    courseWrapper.style.display = needsCourse ? 'block' : 'none';

    if (needsCourse) {
        populateCycleCourseSelect();
    }

    // اشتراك المنصة فقط لا يتطلب قيمة اشتراك للدرس
    if (feeInput) {
        feeInput.placeholder = (type === 'platform') ? 'غير مطلوب لاشتراك المنصة فقط' : 'مثلاً: 100';
    }
}

/**
 * يملأ القائمة المنسدلة لاختيار كورس المنصة في شاشة "بدء الاشتراك"
 * من الكورسات المحفوظة محلياً (db.platformCourses) للصف الحالي.
 */
/**
 * يملأ قائمة الكورسات في شاشة "بدء الاشتراك".
 * — يعرض جميع الكورسات بدون فلترة الصف.
 * — إذا كانت القائمة فارغة يحاول البناء من course_codes أو الجلب من Firebase.
 * — السعر يُعرض تلقائياً من بيانات الكورس (data-price attribute).
 */
function populateCycleCourseSelect() {
    const select = document.getElementById('cycle-platform-course');
    if (!select) return;

    // اعرض جميع الكورسات بدون فلترة صف
    let courses = db.platformCourses || [];

    // إذا كانت فارغة — ابنِها من course_codes المحلية
    if (!courses.length && (db.courseCodes || []).length) {
        courses = _buildCoursesFromCourseCodes();
        if (courses.length) {
            db.platformCourses = courses;
            StorageEngine.save('platformCourses', courses);
        }
    }

    console.log('[COURSES] populateCycleCourseSelect — كورسات:', courses.length,
        ' | أكواد:', (db.courseCodes || []).length);

    const currentValue = select.value;

    if (!courses.length) {
        select.innerHTML = `<option value="">-- لا توجد كورسات، اضغط "تحديث الكورسات" أولاً --</option>`;
        // ✅ لا يوجد جلب تلقائي هنا — التحديث يتم فقط يدوياً عبر زر "تحديث الكورسات" / "مزامنة مع المنصة"
        return;
    }

    select.innerHTML = `<option value="">-- اختر الكورس --</option>` +
        courses.map(c => {
            const priceLabel = c.price ? ` — ${c.price} ج.م` : '';
            return `<option value="${c.courseId}" data-price="${c.price || 0}">${c.courseTitle}${priceLabel}</option>`;
        }).join('');

    if (courses.some(c => String(c.courseId) === String(currentValue))) {
        select.value = currentValue;
    }
}

/**
 * تُستدعى عند اختيار كورس من قائمة "كورس المنصة المطلوب".
 * تقرأ سعر الكورس من data-price attribute وتعرضه تلقائياً.
 * تحدّث أيضاً الحقل المخفي platform-fee-input بالقيمة الصحيحة.
 */
function onPlatformCourseSelected(selectEl) {
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const price = Number(selectedOption ? selectedOption.getAttribute('data-price') || 0 : 0);
    const courseTitle = selectedOption ? selectedOption.text : '';

    // تحديث العرض التلقائي للسعر
    const priceDisplay = document.getElementById('platform-fee-value');
    const hiddenInput = document.getElementById('platform-fee-input');

    if (selectEl.value && price > 0) {
        if (priceDisplay) priceDisplay.textContent = `${price} ج.م`;
        if (hiddenInput) hiddenInput.value = price;
    } else if (selectEl.value && price === 0) {
        if (priceDisplay) priceDisplay.textContent = 'مجاني (0 ج.م)';
        if (hiddenInput) hiddenInput.value = 0;
    } else {
        if (priceDisplay) priceDisplay.textContent = 'اختر كورساً أولاً';
        if (hiddenInput) hiddenInput.value = 0;
    }
}

// ============================================
// 2. شاشة دفع الاشتراك - اختيار نوع الاشتراك
// ============================================

/**
 * يفتح نافذة اختيار نوع الاشتراك (الدرس / المنصة / الاثنين)
 * تُستدعى من البطاقة الذكية للطالب بدلاً من recordQuickAction('payment') مباشرة
 *
 * الكورس المرتبط باشتراك المنصة يُحدَّد مرة واحدة من "الخزنة والمالية → بدء الاشتراك"
 * ولا يُطلب من المستخدم اختياره مرة أخرى هنا.
 */
function openSubscriptionTypeModal(studentId) {
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    platformSubModalStudentId = studentId;

    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    const lessonFee = db.settings.monthlyFee || 0;
    const cycleType = db.settings.cycleSubscriptionType || 'lesson';
    const platformCourse = db.settings.activePlatformCourse || null;

    const showLessonOption = cycleType === 'lesson' || cycleType === 'both';
    // If a platform course is set or it is a platform type cycle, show platform option
    const showPlatformOption = (cycleType === 'platform' || cycleType === 'both');

    const hasLessonPaid = db.payments.some(p =>
        p.studentId == s.id &&
        p.category === 'اشتراك شهري' &&
        p.cycleId == db.settings.activeCycle
    );

    const hasPlatformSub = platformCourse ? (db.platformSubscriptions || []).some(ps =>
        String(ps.student_id) == String(s.id) &&
        String(ps.course_id) === String(platformCourse.courseId) &&
        ps.cycleId == db.settings.activeCycle
    ) : (db.platformSubscriptions || []).some(ps =>
        String(ps.student_id) == String(s.id) &&
        new Date(ps.created_at).getMonth() === new Date().getMonth() &&
        new Date(ps.created_at).getFullYear() === new Date().getFullYear()
    );

    const container = document.getElementById('subscription-type-content');
    if (!container) return;

    if (!showLessonOption && !showPlatformOption) {
        container.innerHTML = `
            <div style="text-align:center; padding:2rem; color:var(--text-muted);">
                <i class="fas fa-exclamation-circle" style="font-size:2rem; margin-bottom:0.5rem; display:block;"></i>
                لا يوجد نوع اشتراك مفعّل لهذه الدورة. يرجى ضبط "نوع الاشتراك" من الخزنة والمالية → بدء الاشتراك.
            </div>`;
        toggleModal('subscription-type-modal', true);
        return;
    }

    container.innerHTML = `
        <div style="text-align:center; margin-bottom:1.5rem;">
            <h3 style="margin-bottom:0.3rem;">${s.name}</h3>
            <p style="color:var(--text-muted); font-size:0.9rem;">اختر نوع الاشتراك الذي سيتم دفعه</p>
        </div>

        <div style="display:flex; flex-direction:column; gap:0.75rem;">
            ${showLessonOption ? `
            <label class="sub-type-option">
                <input type="checkbox" id="sub-type-lesson" ${hasLessonPaid ? 'disabled checked' : ''}>
                <div class="sub-type-box">
                    <div class="sub-type-title">
                        <i class="fas fa-chalkboard-teacher"></i> اشتراك الدرس
                        ${hasLessonPaid ? '<span class="status-badge" style="background:#dcfce7; color:#166534;">مدفوع ✅</span>' : ''}
                    </div>
                    <div class="sub-type-price">${lessonFee} ج.م</div>
                </div>
            </label>` : ''}

            ${showPlatformOption ? `
            <label class="sub-type-option">
                <input type="checkbox" id="sub-type-platform" ${hasPlatformSub ? 'disabled checked' : ''}>
                <div class="sub-type-box">
                    <div class="sub-type-title">
                        <i class="fas fa-laptop-code"></i> 
                        ${platformCourse ? `اشتراك المنصة: ${platformCourse.courseTitle}` : 'اشتراك المنصة'}
                        ${hasPlatformSub ? '<span class="status-badge" style="background:#dbeafe; color:#1e40af;">مشترك بالفعل ✅</span>' : ''}
                    </div>
                    <div class="sub-type-price" id="platform-price-preview">
                        ${platformCourse ? `${platformCourse.price} ج.م` : 'حدد الكورسات لمعرفة السعر'}
                    </div>
                </div>
            </label>` : ''}
        </div>

        <div id="platform-selected-summary" style="display:none; margin-top:1rem; padding:0.75rem 1rem; background:var(--bg-light); border-radius:12px; font-size:0.9rem;"></div>

        <div style="margin-top:1.5rem; padding-top:1rem; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
            <strong>الإجمالي</strong>
            <strong id="sub-type-total" style="font-size:1.3rem; color:var(--accent);">0 ج.م</strong>
        </div>

        <button class="btn btn-primary" style="width:100%; height:55px; border-radius:12px; margin-top:1.5rem; font-size:1.05rem;"
            onclick="confirmSubscriptionSelection(${s.id})">
            <i class="fas fa-check-circle"></i> متابعة
        </button>
    `;

    // Reset selected courses each time the modal opens
    platformSubSelectedCourses = [];

    const lessonCheckbox = document.getElementById('sub-type-lesson');
    const platformCheckbox = document.getElementById('sub-type-platform');

    if (lessonCheckbox) lessonCheckbox.addEventListener('change', updateSubscriptionTotal);
    if (platformCheckbox) {
        platformCheckbox.addEventListener('change', () => {
            if (platformCheckbox.checked) {
                if (platformCourse) {
                    updateSubscriptionTotal();
                } else {
                    openPlatformCourseModal();
                }
            } else {
                if (!platformCourse) {
                    platformSubSelectedCourses = [];
                    const summary = document.getElementById('platform-selected-summary');
                    if (summary) summary.style.display = 'none';
                    const preview = document.getElementById('platform-price-preview');
                    if (preview) preview.innerText = 'حدد الكورسات لمعرفة السعر';
                }
                updateSubscriptionTotal();
            }
        });
    }

    updateSubscriptionTotal();
    toggleModal('subscription-type-modal', true);
}

function updateSubscriptionTotal() {
    const lessonChecked = document.getElementById('sub-type-lesson')?.checked;
    const platformChecked = document.getElementById('sub-type-platform')?.checked;

    const lessonFee = lessonChecked ? (db.settings.monthlyFee || 0) : 0;
    
    let platformFee = 0;
    if (platformChecked) {
        const platformCourse = db.settings.activePlatformCourse;
        if (platformCourse) {
            platformFee = Number(platformCourse.price) || 0;
        } else {
            platformFee = platformSubSelectedCourses.reduce((sum, c) => sum + (Number(c.price) || 0), 0);
        }
    }

    const total = lessonFee + platformFee;
    const totalEl = document.getElementById('sub-type-total');
    if (totalEl) totalEl.innerText = `${total} ج.م`;
}



/**
 * يُنفَّذ عند الضغط على "متابعة" في نافذة اختيار نوع الاشتراك.
 * يقرأ اختيار المستخدم (الدرس / المنصة) ويسجل الدفعات المناسبة.
 * اشتراك المنصة يُربط تلقائياً بالكورس المحدد مسبقاً في "بدء الاشتراك" دون أي خطوة إضافية.
 */
async function confirmSubscriptionSelection(studentId) {
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    const lessonCheckbox = document.getElementById('sub-type-lesson');
    const platformCheckbox = document.getElementById('sub-type-platform');
    const lessonChecked = lessonCheckbox ? lessonCheckbox.checked : false;
    const platformChecked = platformCheckbox ? platformCheckbox.checked : false;

    if (!lessonChecked && !platformChecked) {
        return showNotification('يرجى تحديد نوع اشتراك واحد على الأقل', 'warning');
    }

    const platformCourse = db.settings.activePlatformCourse;
    if (platformChecked && !platformCourse && platformSubSelectedCourses.length === 0) {
        return showNotification('يرجى تحديد كورس منصة واحد على الأقل لاشتراك المنصة', 'warning');
    }

    let lessonResult = null;
    let platformResult = null;

    // --- 1. اشتراك الدرس ---
    if (lessonChecked && (!lessonCheckbox || !lessonCheckbox.disabled)) {
        const alreadyPaid = db.payments.some(p =>
            p.studentId == s.id &&
            p.category === 'اشتراك شهري' &&
            p.cycleId == db.settings.activeCycle
        );

        if (!alreadyPaid) {
            if (!db.settings.activeCycle) {
                db.settings.isMonthlyActive = true;
                db.settings.activeCycle = Date.now();
                db.settings.monthlyFee = db.settings.monthlyFee || 100;
            }
            lessonResult = {
                id: Date.now(),
                studentId: s.id,
                amount: db.settings.monthlyFee,
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                date: new Date().toISOString(),
                category: 'اشتراك شهري',
                cycleId: db.settings.activeCycle,
                collectedBy: (typeof EmployeeAuth !== 'undefined') ? EmployeeAuth.getCurrentName() : undefined
            };
            db.payments.push(lessonResult);
        }
    }

    // --- 2. اشتراك المنصة ---
    if (platformChecked && !(platformCheckbox && platformCheckbox.disabled)) {
        if (platformCourse) {
            platformResult = await recordPlatformSubscription(s, platformCourse);
        } else if (platformSubSelectedCourses.length > 0) {
            platformResult = await recordPlatformSubscription(s, platformSubSelectedCourses);
        }
    }

    await db.save();

    // --- إشعار ---
    const parts = [];
    if (lessonResult) parts.push(`اشتراك الدرس (${lessonResult.amount} ج.م)`);
    if (platformResult) {
        const courseTitles = platformCourse ? platformCourse.courseTitle : platformSubSelectedCourses.map(c => c.courseTitle).join(', ');
        parts.push(`اشتراك المنصة - ${courseTitles} (${platformResult.totalAmount} ج.م)`);
    }

    if (parts.length) {
        showNotification(`✅ تم تسجيل: ${parts.join(' + ')} لـ ${s.name}`, 'success');
        if (typeof playSound === 'function') playSound('success');
    } else {
        showNotification('الطالب مدفوع بالفعل لكل ما تم تحديده', 'warning');
    }

    toggleModal('subscription-type-modal', false);

    // تحديث الواجهات المرتبطة
    if (typeof renderFinances === 'function') renderFinances();
    if (typeof renderMonthlySubscriptionTables === 'function') renderMonthlySubscriptionTables();
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
    if (typeof openSmartCard === 'function') openSmartCard(studentId);

    // طباعة إيصال اشتراك الدرس إن وُجد
    if (lessonResult && typeof showReceiptSelectionModal === 'function') {
        showReceiptSelectionModal(lessonResult.id);
    }
}

/**
 * يسجل اشتراك منصة لطالب في الكورس المحدد مسبقاً للدورة الحالية.
 * - يحفظ السجل محلياً دائماً (Offline-First)
 * - لو متصل بالإنترنت: يرفع مباشرة لـ Firebase ويربط الطالب بالكورس
 * - لو غير متصل: يضعه في جدول platform_subscriptions بحالة sync_status = 0
 */
async function recordPlatformSubscription(student, coursesInput) {
    const online = await isReallyOnline();
    const now = new Date().toISOString();

    const selectedCourses = Array.isArray(coursesInput) ? coursesInput : [coursesInput];
    const totalAmount = selectedCourses.reduce((sum, c) => sum + (Number(c.price) || 0), 0);

    const newRecords = [];
    for (const course of selectedCourses) {
        const record = {
            id: `PSUB_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            student_id: student.id,
            studentCode: student.qrCode,
            course_id: course.courseId,
            course_title: course.courseTitle,
            amount: Number(course.price) || 0,
            payment_date: now,
            sync_status: 0, // 0 = لم تتم المزامنة, 1 = تمت المزامنة
            created_at: now,
            cycleId: db.settings.activeCycle || 'misc'
        };
        newRecords.push(record);
    }

    // 1. الحفظ المحلي دائماً أولاً
    db.platformSubscriptions = db.platformSubscriptions || [];
    db.platformSubscriptions.push(...newRecords);
    await StorageEngine.save('platformSubscriptions', newRecords);

    // 2. تسجيل عملية دفع داخلية لإظهارها في الخزينة والمالية
    const financePayment = {
        id: Date.now() + 2,
        studentId: student.id,
        amount: totalAmount,
        date: now,
        category: 'اشتراك المنصة',
        cycleId: db.settings.activeCycle || 'misc',
        platformCourses: selectedCourses.map(c => c.courseTitle),
        collectedBy: (typeof EmployeeAuth !== 'undefined') ? EmployeeAuth.getCurrentName() : undefined
    };
    if (selectedCourses.length === 1) {
        financePayment.platformCourseId = selectedCourses[0].courseId;
        financePayment.platformCourseTitle = selectedCourses[0].courseTitle;
    }
    db.payments.push(financePayment);

    // 3. لو متصل بالإنترنت: نحاول المزامنة فوراً
    if (online) {
        const syncResult = await syncPlatformSubscriptionRecords(newRecords);
        if (syncResult.success) {
            showNotification(`🌐 تم ربط ${student.name} بالكورس(ات) على المنصة فوراً`, 'success');
        } else {
            showNotification('⚠️ تم الحفظ محلياً، وسيتم رفع الاشتراك تلقائياً عند تحسن الاتصال', 'warning');
        }
    } else {
        showNotification(`📴 تم تسجيل اشتراك المنصة محلياً لـ ${student.name}. سيتم رفعه تلقائياً عند توفر الإنترنت`, 'warning');
    }

    return { records: newRecords, totalAmount, online };
}


// ============================================
// 5. مزامنة الاشتراكات المعلّقة مع المنصة
// ============================================

/**
 * يرسل مجموعة من سجلات الاشتراك إلى Firebase ويحدّث حالة المزامنة محلياً.
 * يعيد { success, syncedCount }
 */
/**
 * ✅ تم إلغاء الرفع لـ Firebase نهائياً — السجلات تفضل محفوظة محلياً فقط
 * (sync_status هيفضل 0 دايمًا لأنه مفيش قاعدة بيانات سحابية تُرفع ليها).
 */
async function syncPlatformSubscriptionRecords(records) {
    return { success: false, syncedCount: 0 };
}

/**
 * يبحث عن كل الاشتراكات المعلّقة (sync_status = 0) ويحاول رفعها للمنصة.
 * يُستدعى تلقائياً عند عودة الاتصال، ويمكن استدعاؤه يدوياً من زر "مزامنة الآن".
 */
async function syncPendingPlatformSubscriptions() {
    const pending = (db.platformSubscriptions || []).filter(r => r.sync_status === 0);
    if (pending.length === 0) {
        showNotification('لا توجد اشتراكات معلّقة للمزامنة ✅', 'info');
        return;
    }

    const online = await isReallyOnline();
    if (!online) {
        showNotification(`لا يوجد اتصال بالإنترنت. يوجد ${pending.length} اشتراك معلّق سيتم رفعه تلقائياً عند الاتصال`, 'warning');
        return;
    }

    showNotification(`🔄 جاري رفع ${pending.length} اشتراك معلّق إلى المنصة...`, 'info');
    const result = await syncPlatformSubscriptionRecords(pending);

    if (result.syncedCount > 0) {
        showNotification(`✅ تم رفع ${result.syncedCount} من ${pending.length} اشتراك معلّق إلى المنصة`, 'success');
    }
    if (result.syncedCount < pending.length) {
        showNotification(`⚠️ تبقى ${pending.length - result.syncedCount} اشتراك لم تتم مزامنته بعد`, 'warning');
    }

    updatePendingSyncBadge();
}

/** عداد الاشتراكات المعلّقة - يُعرض كشارة على شاشة أكواد المنصة */
function updatePendingSyncBadge() {
    const badge = document.getElementById('platform-sync-pending-badge');
    if (!badge) return;
    const pendingCount = (db.platformSubscriptions || []).filter(r => r.sync_status === 0).length;
    if (pendingCount > 0) {
        badge.style.display = 'inline-block';
        badge.innerText = `${pendingCount} اشتراك معلّق ⏳`;
    } else {
        badge.style.display = 'none';
    }
}

// ============================================
// 5.5 عرض الكورسات المستلمة (المحفوظة محلياً)
// ============================================

/**
 * يعرض في نافذة منبثقة كل الكورسات المحفوظة محلياً في db.platformCourses
 * للتأكد من أن "تحديث الكورسات" نزّل كل الكورسات من المنصة بنجاح.
 */
function showReceivedPlatformCourses() {
    let modal = document.getElementById('platform-received-courses-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'platform-received-courses-modal';
        modal.className = 'modal-overlay';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 620px; border-radius: 24px;">
                <button class="modal-close-btn" onclick="toggleModal('platform-received-courses-modal', false)">
                    <i class="fas fa-times"></i>
                </button>
                <h3 style="margin-bottom:0.5rem; text-align:center;"><i class="fas fa-graduation-cap"></i> الكورسات المستلمة من المنصة</h3>
                <p id="platform-received-courses-count" style="text-align:center; color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;"></p>
                <div id="platform-received-courses-list" style="max-height: 450px; overflow-y:auto; display:flex; flex-direction:column; gap:0.5rem;"></div>
                <div style="margin-top:1rem; text-align:center;">
                    <button class="btn btn-primary" onclick="syncWithPlatform(); toggleModal('platform-received-courses-modal', false);"
                        style="height:44px; border-radius:12px; padding:0 1.5rem;">
                        <i class="fas fa-sync-alt"></i> مزامنة مع المنصة لتحديث القائمة
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // محاولة تحميل الكورسات من الذاكرة أو من التخزين المحلي
    let courses = db.platformCourses || [];

    const countEl = document.getElementById('platform-received-courses-count');
    const list = document.getElementById('platform-received-courses-list');

    if (countEl) countEl.innerText = courses.length > 0
        ? `إجمالي الكورسات المحفوظة محلياً: ${courses.length}`
        : 'لم يتم استلام أي كورسات بعد';

    if (!list) {
        toggleModal('platform-received-courses-modal', true);
        return;
    }

    if (!courses.length) {
        list.innerHTML = `
            <div style="text-align:center; padding:2.5rem; color:var(--text-muted);">
                <i class="fas fa-box-open" style="font-size:2.5rem; margin-bottom:0.75rem; display:block; opacity:0.5;"></i>
                <strong style="display:block; margin-bottom:0.5rem; color:var(--text-color);">لا توجد كورسات مستلمة حالياً</strong>
                <p style="font-size:0.85rem; margin:0;">اضغط "مزامنة مع المنصة" عند توفر الإنترنت لاستلام الكورسات.</p>
            </div>`;
    } else {
        list.innerHTML = courses.map(c => `
            <div class="sub-type-box" style="display:flex; justify-content:space-between; align-items:center; padding:0.8rem 1rem; border-radius:12px; background:var(--bg-light); border:1px solid var(--border);">
                <div>
                    <div style="font-weight:700; margin-bottom:0.25rem;">${c.courseTitle || 'كورس بدون اسم'}</div>
                    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                        <span class="status-badge" style="background:#e0e7ff; color:#3730a3; font-size:0.75rem;">${c.grade ? 'الصف: ' + c.grade : 'عام'}</span>
                        <span class="status-badge" style="background:${c.status === 'active' ? '#dcfce7' : '#fee2e2'}; color:${c.status === 'active' ? '#166534' : '#991b1b'}; font-size:0.75rem;">${c.status === 'active' ? 'نشط' : (c.status || 'غير محدد')}</span>
                    </div>
                </div>
                <div style="font-weight:800; font-size:1.1rem; color:var(--primary); white-space:nowrap;">${c.price || 0} ج.م</div>
            </div>
        `).join('');
    }

    toggleModal('platform-received-courses-modal', true);
}

// ============================================
// 6. التهيئة والمزامنة التلقائية
// ============================================

// ============================================
// 7. زر "مزامنة مع المنصة" الشامل
// ============================================

/**
 * ينفذ جميع عمليات المزامنة بالترتيب:
 * 1. تحديث الكورسات
 * 2. مزامنة الاشتراكات المعلّقة
 * 3. استلام الأكواد من المنصة
 * 4. تحديث البيانات المطلوبة
 * ثم يعرض تقريراً بالنتائج.
 */
async function syncWithPlatform() {
    const btn = document.getElementById('btn-sync-platform');
    const results = [];
    const errors = [];

    // إظهار مؤشر التحميل
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري المزامنة...';
    }

    // التحقق من الاتصال
    const online = await isReallyOnline();
    if (!online) {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> مزامنة مع المنصة';
        }
        showNotification('❌ لا يوجد اتصال بالإنترنت. تأكد من الاتصال وحاول مجدداً.', 'error');
        return;
    }

    // ─── الخطوة 1: تحديث الكورسات (مع fallback تلقائي) ───
    try {
        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> (1/4) تحديث الكورسات...';
        // نستخدم refreshPlatformCourses التي تجرب مسارات متعددة تلقائياً
        const didRefresh = await refreshPlatformCourses();
        const count = (db.platformCourses || []).length;
        results.push(`✅ تم تحديث ${count} كورس بنجاح`);
    } catch (err) {
        console.error('Step 1 failed', err);
        errors.push(`❌ تحديث الكورسات: ${err.message}`);
    }

    // ─── الخطوة 2: مزامنة الاشتراكات المعلّقة ───
    try {
        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> (2/4) مزامنة الاشتراكات...';
        const pending = (db.platformSubscriptions || []).filter(r => r.sync_status === 0);
        if (pending.length > 0) {
            const syncResult = await syncPlatformSubscriptionRecords(pending);
            if (syncResult.syncedCount > 0) {
                results.push(`✅ تم مزامنة ${syncResult.syncedCount} اشتراك معلّق`);
            }
            if (syncResult.syncedCount < pending.length) {
                errors.push(`⚠️ تبقى ${pending.length - syncResult.syncedCount} اشتراك لم يُزامَن`);
            }
        } else {
            results.push(`✅ لا توجد اشتراكات معلّقة (كل شيء محدّث)`);
        }
        updatePendingSyncBadge();
    } catch (err) {
        console.error('Step 2 failed', err);
        errors.push(`❌ مزامنة الاشتراكات: ${err.message}`);
    }

    // ─── الخطوة 3: استلام الأكواد من المنصة ───
    try {
        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> (3/4) استلام الأكواد...';
        const fsDb = window._firestoreDB || (typeof CloudSync !== 'undefined' ? CloudSync.getFirestoreDB() : null);
        if (!fsDb) throw new Error('Firestore not initialized');
        const codesSnapshot = await fsDb.collection('course_codes').get();
        const imported = [];
        codesSnapshot.forEach(doc => imported.push({ id: doc.id, ...doc.data() }));
        db.courseCodes = imported;
        await StorageEngine.save('courseCodes', imported);
        if (typeof renderPlatformCodesSection === 'function') renderPlatformCodesSection();
        results.push(`✅ تم استلام ${imported.length} كود من المنصة`);
    } catch (err) {
        console.error('Step 3 failed', err);
        errors.push(`❌ استلام الأكواد: ${err.message}`);
    }

    // ─── الخطوة 4: تحديث البيانات المطلوبة ───
    try {
        if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> (4/4) تحديث البيانات...';
        await db.save();
        if (typeof updateDashboardStats === 'function') updateDashboardStats();
        if (typeof renderPlatformCodesSection === 'function') renderPlatformCodesSection();
        results.push(`✅ تم تحديث بيانات المنصة`);
    } catch (err) {
        console.error('Step 4 failed', err);
        errors.push(`❌ تحديث البيانات: ${err.message}`);
    }

    // ─── إعادة الزر ───
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sync-alt"></i> مزامنة مع المنصة';
    }

    // ─── عرض تقرير النتائج ───
    showSyncResultsModal(results, errors);
}

/**
 * يعرض نافذة تقرير نتائج المزامنة
 */
function showSyncResultsModal(results, errors) {
    let modal = document.getElementById('sync-results-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'sync-results-modal';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display:none;';
        document.body.appendChild(modal);
    }

    const allItems = [...results, ...errors];
    const hasErrors = errors.length > 0;

    modal.innerHTML = `
        <div class="modal-content" style="max-width:500px; border-radius:24px; text-align:center;">
            <div style="font-size:3rem; margin-bottom:1rem;">${hasErrors ? '⚠️' : '🎉'}</div>
            <h3 style="margin-bottom:0.5rem; font-size:1.4rem;">
                ${hasErrors ? 'اكتملت المزامنة مع تنبيهات' : 'اكتملت المزامنة بنجاح!'}
            </h3>
            <p style="color:var(--text-muted); margin-bottom:1.5rem; font-size:0.9rem;">
                نتائج عمليات المزامنة مع المنصة
            </p>
            <div style="text-align:right; display:flex; flex-direction:column; gap:0.6rem; margin-bottom:1.5rem;">
                ${allItems.map(item => `
                    <div style="
                        padding:0.7rem 1rem;
                        border-radius:10px;
                        font-size:0.95rem;
                        font-weight:600;
                        background:${item.startsWith('✅') ? '#f0fdf4' : item.startsWith('⚠️') ? '#fffbeb' : '#fef2f2'};
                        color:${item.startsWith('✅') ? '#166534' : item.startsWith('⚠️') ? '#92400e' : '#991b1b'};
                        border:1px solid ${item.startsWith('✅') ? '#bbf7d0' : item.startsWith('⚠️') ? '#fde68a' : '#fecaca'};
                    ">${item}</div>
                `).join('')}
            </div>
            <button class="btn btn-primary" onclick="toggleModal('sync-results-modal', false)"
                style="width:100%; height:48px; border-radius:12px;">
                <i class="fas fa-check"></i> حسناً
            </button>
        </div>
    `;

    toggleModal('sync-results-modal', true);
}

document.addEventListener('DOMContentLoaded', () => {
    // ✅ تم إلغاء المزامنة التلقائية نهائياً (لا listener على 'online' ولا setInterval دوري).
    // المزامنة الآن تتم حصرياً عند الضغط اليدوي على أزرار المزامنة المخصصة
    // (مثل "مزامنة مع المنصة" و "مزامنة الاشتراكات المعلّقة").

    // عرض شارة الاشتراكات المعلقة بعد تحميل البيانات (محلي بالكامل، لا يتصل بالشبكة)
    setTimeout(updatePendingSyncBadge, 2000);
});

// ============================================
// 8. دوال الدفع المباشر والتحكم بنافذة الكورسات
// ============================================

function getPlatformSubscriptionPrice() {
    return Number(db.settings.platformSubscriptionFee) || 100;
}

function openPlatformCourseModal() {
    // Restore default save button for standard modal flow
    const confirmSection = document.getElementById('platform-course-confirm-section');
    if (confirmSection) {
        confirmSection.innerHTML = `
            <button class="btn btn-primary" style="width:100%; height:50px; border-radius:12px; margin-top:1rem;" onclick="savePlatformCourseSelection()">
                <i class="fas fa-check"></i> حفظ
            </button>`;
    }
    renderPlatformCourseSelectionList();
    toggleModal('platform-course-select-modal', true);
}

function renderPlatformCourseSelectionList() {
    const search = document.getElementById('platform-course-search')?.value || '';
    const courses = getAvailablePlatformCourses(search);
    const list = document.getElementById('platform-course-select-list');
    if (!list) return;

    if (!courses.length) {
        list.innerHTML = `
            <div style="text-align:center; padding:2rem; color:var(--text-muted);">
                <i class="fas fa-box-open" style="font-size:2rem; margin-bottom:0.5rem; display:block;"></i>
                لا توجد كورسات مطابقة. اضغط "تحديث الكورسات" من قسم المزامنة للتأكد من اتصالك بالإنترنت.
            </div>`;
        return;
    }

    list.innerHTML = courses.map(c => {
        const checked = platformSubSelectedCourses.some(sel => String(sel.courseId) === String(c.courseId));
        return `
            <label class="sub-type-option" style="margin-bottom:0.5rem; display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" value="${c.courseId}" data-price="${c.price || 0}"
                    data-title="${(c.courseTitle || '').replace(/"/g, '&quot;')}"
                    ${checked ? 'checked' : ''} onchange="togglePlatformCourseSelection(this)">
                <div class="sub-type-box" style="flex: 1; margin-right: 10px;">
                    <div class="sub-type-title">${c.courseTitle || 'كورس بدون اسم'}</div>
                    <div class="sub-type-price">${c.price || 0} ج.م</div>
                </div>
            </label>
        `;
    }).join('');
}

function togglePlatformCourseSelection(checkbox) {
    const courseId = checkbox.value;
    const price = Number(checkbox.dataset.price) || 0;
    const title = checkbox.dataset.title || '';

    if (checkbox.checked) {
        if (!platformSubSelectedCourses.some(c => String(c.courseId) === String(courseId))) {
            platformSubSelectedCourses.push({ courseId, price, courseTitle: title });
        }
    } else {
        platformSubSelectedCourses = platformSubSelectedCourses.filter(c => String(c.courseId) !== String(courseId));
    }
}

function savePlatformCourseSelection() {
    const summary = document.getElementById('platform-selected-summary');
    const preview = document.getElementById('platform-price-preview');
    const platformCheckbox = document.getElementById('sub-type-platform');

    if (platformSubSelectedCourses.length === 0) {
        if (platformCheckbox) platformCheckbox.checked = false;
        if (summary) summary.style.display = 'none';
        if (preview) preview.innerText = 'حدد الكورسات لمعرفة السعر';
    } else {
        const total = platformSubSelectedCourses.reduce((sum, c) => sum + (Number(c.price) || 0), 0);
        if (summary) {
            summary.style.display = 'block';
            summary.innerHTML = `<strong>الكورسات المختارة:</strong> ` +
                platformSubSelectedCourses.map(c => `<span class="status-badge" style="background:#e0e7ff; color:#3730a3; margin:2px;">${c.courseTitle}</span>`).join(' ');
        }
        if (preview) preview.innerText = `${total} ج.م (${platformSubSelectedCourses.length} كورس)`;
        if (platformCheckbox) platformCheckbox.checked = true;
    }

    updateSubscriptionTotal();
    toggleModal('platform-course-select-modal', false);
}

async function payLessonDirect(studentId) {
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    const alreadyPaid = db.payments.some(p =>
        p.studentId == s.id &&
        p.category === 'اشتراك شهري' &&
        p.cycleId == db.settings.activeCycle
    );

    if (alreadyPaid) {
        return showNotification(`✅ ${s.name} دفع اشتراك الدرس بالفعل هذا الشهر`, 'info');
    }

    if (!db.settings.activeCycle) {
        db.settings.isMonthlyActive = true;
        db.settings.activeCycle = Date.now();
        db.settings.monthlyFee = db.settings.monthlyFee || 100;
    }

    const payment = {
        id: Date.now(),
        studentId: s.id,
        amount: db.settings.monthlyFee,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        date: new Date().toISOString(),
        category: 'اشتراك شهري',
        cycleId: db.settings.activeCycle,
        collectedBy: (typeof EmployeeAuth !== 'undefined') ? EmployeeAuth.getCurrentName() : undefined
    };
    db.payments.push(payment);
    await db.save();

    showNotification(`✅ تم تسجيل اشتراك الدرس لـ ${s.name} (${payment.amount} ج.م)`, 'success');
    if (typeof playSound === 'function') playSound('success');
    if (typeof renderFinances === 'function') renderFinances();
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
    if (typeof openSmartCard === 'function') openSmartCard(studentId);
    if (typeof showReceiptSelectionModal === 'function') showReceiptSelectionModal(payment.id);
}

async function payPlatformDirect(studentId) {
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    currentGrade = localStorage.getItem('edu_active_grade') || currentGrade;
    currentGroupId = localStorage.getItem('edu_active_group') || currentGroupId;

    const platformCourse = db.settings.activePlatformCourse;

    if (platformCourse) {
        // التحقق من وجود اشتراك سابق في نفس الدورة
        const alreadySubscribed = (db.platformSubscriptions || []).some(ps =>
            String(ps.student_id) == String(s.id) &&
            String(ps.course_id) === String(platformCourse.courseId) &&
            ps.cycleId == db.settings.activeCycle
        );

        if (alreadySubscribed) {
            return showNotification(`✅ ${s.name} مشترك بالفعل في كورس المنصة هذا الشهر`, 'info');
        }

        const result = await recordPlatformSubscription(s, platformCourse);
        await db.save();

        showNotification(`✅ تم تسجيل اشتراك المنصة لـ ${s.name} (${result.totalAmount} ج.م)`, 'success');
        if (typeof playSound === 'function') playSound('success');

        if (typeof renderFinances === 'function') renderFinances();
        if (typeof updateDashboardStats === 'function') updateDashboardStats();
        if (typeof openSmartCard === 'function') openSmartCard(studentId);
        updatePendingSyncBadge();
    } else {
        // الاسترجاع الاحتياطي: فتح مودال الاختيار اليدوي
        platformSubModalStudentId = studentId;
        platformSubSelectedCourses = [];

        renderPlatformCourseSelectionList();

        const confirmSection = document.getElementById('platform-course-confirm-section');
        if (confirmSection) {
            confirmSection.innerHTML = `
                <div style="padding:1rem; border-top:1px solid var(--border); display:flex; gap:10px;">
                    <button class="btn" style="flex:1; height:50px; border-radius:12px; background:var(--bg-light); border:1px solid var(--border);"
                        onclick="toggleModal('platform-course-select-modal', false)">إلغاء</button>
                    <button class="btn btn-primary" style="flex:2; height:50px; border-radius:12px;"
                        onclick="confirmPlatformOnlyPayment(${s.id})">
                        <i class='fas fa-check-circle'></i> تأكيد دفع اشتراك المنصة
                    </button>
                </div>`;
        }

        toggleModal('platform-course-select-modal', true);
    }
}

async function confirmPlatformOnlyPayment(studentId) {
    const s = db.students.find(x => x.id == studentId);
    if (!s) return;

    if (platformSubSelectedCourses.length === 0) {
        return showNotification('يرجى اختيار كورس واحد على الأقل', 'warning');
    }

    const result = await recordPlatformSubscription(s, platformSubSelectedCourses);
    await db.save();

    showNotification(`✅ تم تسجيل اشتراك المنصة لـ ${s.name} (${result.totalAmount} ج.م)`, 'success');
    if (typeof playSound === 'function') playSound('success');

    toggleModal('platform-course-select-modal', false);
    if (typeof renderFinances === 'function') renderFinances();
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
    if (typeof openSmartCard === 'function') openSmartCard(studentId);
    updatePendingSyncBadge();
}

function payBothDirect(studentId) {
    openSubscriptionTypeModal(studentId);
    setTimeout(() => {
        const lessonCb = document.getElementById('sub-type-lesson');
        const platformCb = document.getElementById('sub-type-platform');
        if (lessonCb && !lessonCb.disabled) lessonCb.checked = true;
        if (platformCb) platformCb.checked = false; 
        updateSubscriptionTotal();
    }, 120);
}

// ============================================
// Exports
// ============================================
window.refreshPlatformCourses = refreshPlatformCourses;
window.openSubscriptionTypeModal = openSubscriptionTypeModal;
window.updateSubscriptionTotal = updateSubscriptionTotal;
window.confirmSubscriptionSelection = confirmSubscriptionSelection;
window.recordPlatformSubscription = recordPlatformSubscription;
window.syncPendingPlatformSubscriptions = syncPendingPlatformSubscriptions;
window.syncPlatformSubscriptionRecords = syncPlatformSubscriptionRecords;
window.updatePendingSyncBadge = updatePendingSyncBadge;
window.onCycleSubscriptionTypeChange = onCycleSubscriptionTypeChange;
window.populateCycleCourseSelect = populateCycleCourseSelect;
window.onPlatformCourseSelected   = onPlatformCourseSelected;
window._buildCoursesFromCourseCodes = _buildCoursesFromCourseCodes;
window.showReceivedPlatformCourses = showReceivedPlatformCourses;
window.getAvailablePlatformCourses = getAvailablePlatformCourses;
window.syncWithPlatform = syncWithPlatform;
window.showSyncResultsModal = showSyncResultsModal;

// Direct payment exports
window.payLessonDirect = payLessonDirect;
window.payPlatformDirect = payPlatformDirect;
window.payBothDirect = payBothDirect;
window.confirmPlatformOnlyPayment = confirmPlatformOnlyPayment;
window.openPlatformCourseModal = openPlatformCourseModal;
window.renderPlatformCourseSelectionList = renderPlatformCourseSelectionList;
window.togglePlatformCourseSelection = togglePlatformCourseSelection;
window.savePlatformCourseSelection = savePlatformCourseSelection;
window.getPlatformSubscriptionPrice = getPlatformSubscriptionPrice;

// =========================================================
// تفعيل كورسات المنصة المباشر (Direct Activation Screen)
// =========================================================

let activationListPage = 0;
const activationListPageSize = 50;

function initPlatformActivationSection() {
    activationListPage = 0;
    
    // 1. ملء الكورسات
    populatePlatformActivationCourses();
    
    // 2. ملء الصفوف
    populatePlatformActivationGrades();
    
    // 3. مسح البحث وإعادة التعيين
    const searchInput = document.getElementById('platform-activation-search');
    if (searchInput) searchInput.value = '';
    
    const selectAllCheckbox = document.getElementById('platform-activation-select-all');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    
    // 4. عرض الواجهة
    renderPlatformActivationList();
}

function populatePlatformActivationCourses() {
    const select = document.getElementById('platform-activation-course');
    if (!select) return;
    
    let courses = db.platformCourses || [];
    
    // إذا كانت فارغة، ابنها من الأكواد
    if (!courses.length && (db.courseCodes || []).length) {
        courses = _buildCoursesFromCourseCodes();
        if (courses.length) {
            db.platformCourses = courses;
            StorageEngine.save('platformCourses', courses);
        }
    }
    
    select.innerHTML = '<option value="">-- اختر الكورس --</option>' + 
        courses.map(c => `<option value="${c.courseId}">${c.courseTitle}</option>`).join('');
}

function populatePlatformActivationGrades() {
    const select = document.getElementById('platform-activation-grade');
    if (!select) return;
    
    // محاولة قراءة الصفوف من window.gradesList أو من localStorage مباشرة
    let grades = window.gradesList;
    if (!grades || grades.length === 0) {
        try {
            grades = JSON.parse(localStorage.getItem('edu_grades_list')) || [];
        } catch(e) {
            grades = [];
        }
    }
    
    select.innerHTML = '<option value="">-- اختر الصف --</option>' + 
        grades.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
}

async function renderPlatformActivationList() {
    const courseSelect = document.getElementById('platform-activation-course');
    const gradeSelect = document.getElementById('platform-activation-grade');
    const searchInput = document.getElementById('platform-activation-search');
    const listBody = document.getElementById('platform-activation-list');
    const tableWrapper = document.getElementById('platform-activation-table-wrapper');
    const welcomeMsg = document.getElementById('platform-activation-welcome-message');
    const pageInfo = document.getElementById('activation-page-info');
    
    if (!courseSelect || !gradeSelect || !listBody || !tableWrapper || !welcomeMsg) return;
    
    const courseId = courseSelect.value;
    const gradeId = gradeSelect.value;
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    
    if (!courseId || !gradeId) {
        tableWrapper.style.display = 'none';
        welcomeMsg.style.display = 'block';
        return;
    }
    
    tableWrapper.style.display = 'block';
    welcomeMsg.style.display = 'none';
    
    // استرجاع الطلاب باستخدام IndexedDB بشكل paged
    const filter = { grade: gradeId };
    const paged = await StorageEngine.getPaged('students', filter, activationListPage, activationListPageSize, searchTerm);
    const students = paged.data;
    const hasMore = paged.hasMore;
    
    // ترتيب الطلاب أبجدياً
    students.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    
    const gradeObj = (window.gradesList || []).find(g => String(g.id) === String(gradeId));
    const gradeName = gradeObj ? gradeObj.name : '---';
    
    if (students.length === 0 && activationListPage === 0) {
        listBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">لا توجد نتائج بحث تطابق الفلاتر المحددة</td></tr>';
        if (pageInfo) pageInfo.innerText = `صفحة 1`;
        return;
    }
    
    listBody.innerHTML = students.map((s, idx) => {
        // التحقق من حالة التفعيل
        const actRecord = (db.platformSubscriptions || []).find(ps => 
            String(ps.student_id) === String(s.id) && 
            String(ps.course_id) === String(courseId)
        );
        
        let statusHtml = '';
        let buttonHtml = '';
        let checkboxHtml = '';
        
        if (actRecord) {
            if (actRecord.sync_status === 1) {
                statusHtml = '<span class="status-badge" style="background:#dcfce7; color:#166534; border: 1px solid #bbf7d0;">تم التفعيل والمزامنة ✅</span>';
            } else {
                statusHtml = '<span class="status-badge" style="background:#fff7ed; color:#c2410c; border: 1px solid #fed7aa;">مفعل محلياً (معلق) ⏳</span>';
            }
            buttonHtml = `<button class="btn" disabled style="background:var(--bg-light); color:var(--text-muted); border:1px solid var(--border); padding: 5px 12px; font-size: 0.8rem; border-radius: 50px;">تم التفعيل</button>`;
            checkboxHtml = `<input type="checkbox" disabled style="transform: scale(1.1); opacity:0.5;">`;
        } else {
            statusHtml = '<span class="status-badge" style="background:#f3f4f6; color:#4b5563; border: 1px solid #e5e7eb;">غير مفعل ❌</span>';
            buttonHtml = `<button class="btn btn-primary" onclick="activateCourseForStudent(${s.id})" style="background:#8b5cf6; padding: 5px 15px; font-size: 0.8rem; border-radius: 50px;">
                            <i class="fas fa-bolt"></i> تفعيل الكورس
                          </button>`;
            checkboxHtml = `<input type="checkbox" class="student-activation-checkbox" data-student-id="${s.id}" style="transform: scale(1.1); cursor: pointer;">`;
        }
        
        const rowNumber = (activationListPage * activationListPageSize) + idx + 1;
        
        return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="text-align: center; padding: 1rem 0.5rem;">${checkboxHtml}</td>
                <td><strong>${s.name}</strong></td>
                <td style="font-family:monospace; color:var(--text-muted);">${s.qrCode}</td>
                <td>${gradeName}</td>
                <td>${statusHtml}</td>
                <td>${buttonHtml}</td>
            </tr>
        `;
    }).join('');
    
    // تحديث أزرار التنقل
    const prevBtn = document.getElementById('btn-activation-prev');
    const nextBtn = document.getElementById('btn-activation-next');
    if (prevBtn) prevBtn.disabled = (activationListPage === 0);
    if (nextBtn) nextBtn.disabled = !hasMore;
    if (pageInfo) pageInfo.innerText = `صفحة ${activationListPage + 1}`;
    
    const selectAllCheckbox = document.getElementById('platform-activation-select-all');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
}

function toggleSelectAllActivation(checkbox) {
    const checkboxes = document.querySelectorAll('.student-activation-checkbox');
    checkboxes.forEach(cb => {
        if (!cb.disabled) {
            cb.checked = checkbox.checked;
        }
    });
}

function changeActivationPage(direction) {
    activationListPage += direction;
    if (activationListPage < 0) activationListPage = 0;
    renderPlatformActivationList();
}

async function activatePlatformCourseDirectly(student, course) {
    const online = await isReallyOnline();
    const now = new Date().toISOString();
    
    const record = {
        id: `PSUB_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        student_id: student.id,
        studentCode: student.qrCode,
        course_id: course.courseId,
        course_title: course.courseTitle,
        amount: 0, // 0 for free direct activation
        payment_date: now,
        sync_status: 0,
        created_at: now,
        cycleId: db.settings.activeCycle || 'activation'
    };
    
    db.platformSubscriptions = db.platformSubscriptions || [];
    db.platformSubscriptions.push(record);
    await StorageEngine.save('platformSubscriptions', record);
    
    if (online) {
        const syncResult = await syncPlatformSubscriptionRecords([record]);
        if (syncResult.success) {
            record.sync_status = 1;
        }
    }
    
    return record;
}

async function activateCourseForStudent(studentId) {
    const courseSelect = document.getElementById('platform-activation-course');
    if (!courseSelect || !courseSelect.value) return showNotification('يرجى اختيار كورس أولاً', 'warning');
    
    const courseId = courseSelect.value;
    const course = db.platformCourses.find(c => String(c.courseId) === String(courseId));
    if (!course) return showNotification('الكورس المحدد غير موجود', 'error');
    
    const student = db.students.find(s => s.id == studentId);
    if (!student) return showNotification('الطالب غير موجود', 'error');
    
    showNotification('🔄 جاري تفعيل الكورس للطالب...', 'info');
    const result = await activatePlatformCourseDirectly(student, course);
    await db.save();
    
    if (result.sync_status === 1) {
        showNotification(`✅ تم تفعيل كورس "${course.courseTitle}" ومزامنته للطالب: ${student.name}`, 'success');
    } else {
        showNotification(`⏳ تم تسجيل تفعيل كورس "${course.courseTitle}" محلياً للطالب: ${student.name} (سيتم الرفع عند الاتصال بالإنترنت)`, 'warning');
    }
    
    if (typeof playSound === 'function') playSound('success');
    renderPlatformActivationList();
    updatePendingSyncBadge();
}

async function batchActivateSelected() {
    const courseSelect = document.getElementById('platform-activation-course');
    if (!courseSelect || !courseSelect.value) return showNotification('يرجى اختيار كورس أولاً', 'warning');
    
    const courseId = courseSelect.value;
    const course = db.platformCourses.find(c => String(c.courseId) === String(courseId));
    if (!course) return showNotification('الكورس المحدد غير موجود', 'error');
    
    const checkboxes = document.querySelectorAll('.student-activation-checkbox:checked');
    if (checkboxes.length === 0) {
        return showNotification('⚠️ يرجى تحديد طالب واحد على الأقل للتفعيل الجماعي', 'warning');
    }
    
    if (!confirm(`هل أنت متأكد من تفعيل الكورس "${course.courseTitle}" لـ ${checkboxes.length} طالب دفعة واحدة؟`)) return;
    
    showNotification(`🔄 جاري تفعيل الكورس لـ ${checkboxes.length} طالب...`, 'info');
    
    const online = await isReallyOnline();
    const now = new Date().toISOString();
    const records = [];
    
    checkboxes.forEach(cb => {
        const studentId = cb.getAttribute('data-student-id');
        const s = db.students.find(x => x.id == studentId);
        if (s) {
            const record = {
                id: `PSUB_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${records.length}`,
                student_id: s.id,
                studentCode: s.qrCode,
                course_id: course.courseId,
                course_title: course.courseTitle,
                amount: 0,
                payment_date: now,
                sync_status: 0,
                created_at: now,
                cycleId: db.settings.activeCycle || 'activation'
            };
            records.push(record);
        }
    });
    
    if (records.length === 0) return;
    
    db.platformSubscriptions = db.platformSubscriptions || [];
    db.platformSubscriptions.push(...records);
    await StorageEngine.save('platformSubscriptions', records);
    
    let synced = 0;
    if (online) {
        const syncResult = await syncPlatformSubscriptionRecords(records);
        synced = syncResult.syncedCount;
    }
    
    await db.save();
    
    if (synced === records.length && records.length > 0) {
        showNotification(`✅ تم تفعيل الكورس ومزامنة جميع الطلاب (${records.length}) بنجاح!`, 'success');
    } else if (synced > 0) {
        showNotification(`⚠️ تم تفعيل الكورس لـ ${records.length} طالب (مزامنة ${synced} بنجاح، وتبقى ${records.length - synced} معلقين محلياً)`, 'warning');
    } else {
        showNotification(`⏳ تم تسجيل تفعيل الكورس لـ ${records.length} طالب محلياً (جميعهم معلقين المزامنة لحين الاتصال بالإنترنت)`, 'warning');
    }
    
    if (typeof playSound === 'function') playSound('success');
    renderPlatformActivationList();
    updatePendingSyncBadge();
}

// تصدير دوال التفعيل للنافذة العامة
window.initPlatformActivationSection = initPlatformActivationSection;
window.populatePlatformActivationCourses = populatePlatformActivationCourses;
window.populatePlatformActivationGrades = populatePlatformActivationGrades;
window.renderPlatformActivationList = renderPlatformActivationList;
window.toggleSelectAllActivation = toggleSelectAllActivation;
window.changeActivationPage = changeActivationPage;
window.activateCourseForStudent = activateCourseForStudent;
window.batchActivateSelected = batchActivateSelected;


