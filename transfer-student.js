// ============================================================
//  transfer-student.js  v2.0
//  نقل الطالب بين المجموعات — متكامل مع app.js / IndexedDB
//
//  يُضاف بعد platform-subscriptions.js في index.html
//  ويُضاف في APP_SHELL داخل sw.js
//
//  نقاط التكامل:
//    ✅ زر "نقل" جنب كل طالب في إدارة الطلاب (renderStudents)
//    ✅ زر نقل في تفاصيل المجموعة (renderGroupStudents)
//    ✅ Modal ديناميكي باختيار المجموعة الجديدة
//    ✅ يُحدّث students + attendance في IndexedDB
//    ✅ يضيف ملاحظة نقل في dailyTreasuryArchives
//    ✅ payments / scores / platformSubscriptions تبقى بدون تعديل
//    ✅ الكود (qrCode) ثابت 100% — لا يتغير أبداً
//    ✅ يُسجّل في RBAC activity log
//    ✅ يُحدّث كل الـ UI فوراً بعد النقل
// ============================================================

/**
 * الدالة الرئيسية — تنقل الطالب من مجموعته الحالية للمجموعة الجديدة
 * وتُحدّث جميع البيانات المرتبطة به.
 *
 * @param {number|string} studentId   - id الطالب في IndexedDB
 * @param {number|string} newGroupId  - id المجموعة الجديدة
 * @param {object}        options
 * @param {boolean}       [options.confirm=true]       - هل تعرض confirm قبل التنفيذ؟
 * @param {boolean}       [options.updateArchive=true]  - هل تضيف ملاحظة في الأرشيف؟
 * @returns {Promise<{success:boolean, message:string}>}
 */
async function transferStudent(studentId, newGroupId, options = {}) {
    const { confirm: requireConfirm = true, updateArchive = true } = options;

    // ── 0. تهيئة قاعدة البيانات ─────────────────────────────────
    if (!StorageEngine.db) await StorageEngine.init();

    // ── 1. التحقق من وجود الطالب والمجموعة ─────────────────────
    const student = db.students.find(s => String(s.id) === String(studentId));
    if (!student) {
        showNotification('❌ لم يتم العثور على الطالب', 'error');
        return { success: false, message: 'student_not_found' };
    }

    const newGroup = db.groups.find(g => String(g.id) === String(newGroupId));
    if (!newGroup) {
        showNotification('❌ المجموعة المختارة غير موجودة', 'error');
        return { success: false, message: 'group_not_found' };
    }

    const oldGroupId   = String(student.groupId || '');
    const oldGroup     = db.groups.find(g => String(g.id) === oldGroupId);
    const oldGroupName = oldGroup ? oldGroup.name : (oldGroupId ? `مجموعة (${oldGroupId})` : 'غير محدد');
    const newGroupName = newGroup.name;

    // لا تنقل لنفس المجموعة
    if (oldGroupId === String(newGroupId)) {
        showNotification('⚠️ الطالب موجود بالفعل في هذه المجموعة', 'warning');
        return { success: false, message: 'same_group' };
    }

    // ── 2. عرض ملخص البيانات للتأكيد ────────────────────────────
    if (requireConfirm) {
        const attCount     = db.attendance.filter(a => String(a.studentId) === String(studentId)).length;
        const payCount     = db.payments.filter(p => String(p.studentId) === String(studentId)).length;
        const scoreCount   = db.scores.filter(sc => String(sc.studentId) === String(studentId)).length;
        const archiveCount = (db.dailyTreasuryArchives || []).filter(a =>
            (a.payments || []).some(p => p.studentName === student.name)
        ).length;

        const confirmed = window.confirm(
            `نقل الطالب:\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `📛 الاسم: ${student.name}\n` +
            `🔑 الكود: ${student.qrCode}  (لن يتغير)\n` +
            `\n` +
            `من مجموعة:  ${oldGroupName}\n` +
            `إلى مجموعة: ${newGroupName}\n` +
            `\n` +
            `البيانات التي ستنتقل معه:\n` +
            `  • ${attCount}  سجل حضور\n` +
            `  • ${payCount}  سجل مالي  (تبقى بدون تعديل)\n` +
            `  • ${scoreCount} درجة امتحان (تبقى بدون تعديل)\n` +
            `  • ${archiveCount} إدخال في أرشيف العهدة\n` +
            `\n` +
            `هل تريد المتابعة؟`
        );
        if (!confirmed) return { success: false, message: 'cancelled' };
    }

    try {
        const transferDate = new Date().toISOString();
        const transferNote = `[نُقل: ${oldGroupName} ← ${newGroupName} | ${new Date().toLocaleDateString('ar-EG')}]`;

        // ── 3. تحديث بيانات الطالب ──────────────────────────────
        // الكود (qrCode) لا يُمسّ أبداً
        student.groupId         = String(newGroupId);
        student.previousGroupId = oldGroupId;
        student.transferDate    = transferDate;
        student.transferNote    = transferNote;

        await StorageEngine.save('students', student);
        const sIdx = db.students.findIndex(s => String(s.id) === String(studentId));
        if (sIdx !== -1) db.students[sIdx] = { ...student };

        // ── 4. تحديث سجلات الحضور ───────────────────────────────
        // attendance.groupId يُحدَّث للمجموعة الجديدة
        // حتى تظهر سجلاته في تقارير المجموعة الجديدة بشكل صحيح
        const attendanceToUpdate = db.attendance.filter(
            a => String(a.studentId) === String(studentId)
        );

        if (attendanceToUpdate.length > 0) {
            attendanceToUpdate.forEach(a => {
                a.prevGroupId = a.prevGroupId || oldGroupId;
                a.groupId     = String(newGroupId);
            });
            await StorageEngine.save('attendance', attendanceToUpdate);
            attendanceToUpdate.forEach(updated => {
                const idx = db.attendance.findIndex(a => a.id === updated.id);
                if (idx !== -1) db.attendance[idx] = { ...updated };
            });
        }

        // ── 5. ملاحظة في أرشيف العهدة ───────────────────────────
        // الأرشيف هو snapshot مالي مقفول — لا نحذف ولا ننقل
        // فقط نضيف transferNote على مدفوعاته للتوضيح
        if (updateArchive && db.dailyTreasuryArchives) {
            const archivesToUpdate = db.dailyTreasuryArchives.filter(a =>
                (a.payments || []).some(p => p.studentName === student.name)
            );

            if (archivesToUpdate.length > 0) {
                archivesToUpdate.forEach(archive => {
                    archive.payments = (archive.payments || []).map(p =>
                        p.studentName === student.name && !p.transferNote
                            ? { ...p, transferNote }
                            : p
                    );
                });
                await StorageEngine.save('dailyTreasuryArchives', archivesToUpdate);
                archivesToUpdate.forEach(updated => {
                    const idx = db.dailyTreasuryArchives.findIndex(a => a.id === updated.id);
                    if (idx !== -1) db.dailyTreasuryArchives[idx] = { ...updated };
                });
            }
        }

        // ── 6. حفظ prevGroupId في absenceSessions ────────────────
        // absenceSessions مش بنغيّر groupId فيها (هي archive تاريخي)
        // لكن نضيف prevGroupId للـ student record بحيث
        // renderMonthlyReportBody يقدر يلاقي جلساتها بالـ groupId القديم
        // (هذا الحفظ اتعمل بالفعل في student.previousGroupId خطوة 3)
        // لا يوجد تعديل إضافي مطلوب هنا

        // ── 6. payments / scores / platformSubscriptions ─────────
        // هذه الجداول مرتبطة بـ studentId فقط — لا تحتاج تعديل
        // الطالب سيظهر في جميع تقاريرها تلقائياً عبر studentId الثابت

        // ── 7. تسجيل في Activity Log ─────────────────────────────
        if (typeof RBAC !== 'undefined' && RBAC.log) {
            RBAC.log(
                'transfer_student',
                `${student.name} (${student.qrCode}) | من [${oldGroupName}] → إلى [${newGroupName}]`
            );
        }

        // ── 8. تحديث الـ UI فوراً ────────────────────────────────
        if (typeof renderStudents       === 'function') renderStudents();
        if (typeof renderGroups         === 'function') renderGroups();
        if (typeof renderGroupStudents  === 'function') renderGroupStudents();
        if (typeof updateDashboardStats === 'function') updateDashboardStats();
        if (typeof syncUIWithContext    === 'function') syncUIWithContext();
        if (typeof updateGroupDetailStats === 'function' && typeof activeGroupDetailId !== 'undefined') {
            updateGroupDetailStats(activeGroupDetailId);
        }

        // ── 9. إشعار النجاح ─────────────────────────────────────
        showNotification(
            `✅ تم نقل "${student.name}" من [${oldGroupName}] إلى [${newGroupName}]\n🔑 الكود: ${student.qrCode} (ثابت)`,
            'success'
        );

        console.log('[transferStudent] ✅', {
            student: student.name,
            qrCode: student.qrCode,
            from: oldGroupName,
            to: newGroupName,
            attendanceUpdated: attendanceToUpdate.length,
        });

        return { success: true, message: 'transferred', student, oldGroupId, newGroupId: String(newGroupId) };

    } catch (err) {
        console.error('[transferStudent] ❌ فشل النقل:', err);
        showNotification('❌ حدث خطأ أثناء نقل الطالب: ' + (err.message || err), 'error');
        return { success: false, message: 'error', error: err };
    }
}

// ============================================================
//  showTransferStudentModal
//  يفتح نافذة اختيار المجموعة الجديدة للطالب المحدد
//  يُستدعى من زر "نقل" الموجود في جدول الطلاب
// ============================================================
function showTransferStudentModal(studentId) {
    const student = db.students.find(s => String(s.id) === String(studentId));
    if (!student) return showNotification('❌ الطالب غير موجود', 'error');

    const currentGroup = db.groups.find(g => String(g.id) === String(student.groupId));

    // مجموعات نفس الصف أولاً، ثم باقي الصفوف
    const sameGradeGroups = db.groups.filter(g =>
        String(g.grade) === String(student.grade) &&
        String(g.id) !== String(student.groupId)
    );
    const otherGroups = db.groups.filter(g =>
        String(g.grade) !== String(student.grade)
    );

    const buildOptions = (groups) => groups.map(g => {
        const gLabel = (typeof gradeLabel === 'function') ? gradeLabel(g.grade) : (g.grade || '');
        return `<option value="${g.id}">${g.name}${g.time ? ` — ${g.time}` : ''} (${gLabel})</option>`;
    }).join('');

    let optionsHtml = '';
    if (sameGradeGroups.length > 0) {
        const gLabel = (typeof gradeLabel === 'function') ? gradeLabel(student.grade) : student.grade;
        optionsHtml += `<optgroup label="نفس الصف — ${gLabel}">${buildOptions(sameGradeGroups)}</optgroup>`;
    }
    if (otherGroups.length > 0) {
        optionsHtml += `<optgroup label="صفوف أخرى">${buildOptions(otherGroups)}</optgroup>`;
    }

    if (!optionsHtml) {
        return showNotification('لا توجد مجموعات أخرى يمكن النقل إليها', 'warning');
    }

    // إزالة أي modal قديم
    const existingModal = document.getElementById('transfer-student-modal');
    if (existingModal) existingModal.remove();

    const attCount   = db.attendance.filter(a => String(a.studentId) === String(studentId)).length;
    const payCount   = db.payments.filter(p => String(p.studentId) === String(studentId)).length;
    const scoreCount = db.scores.filter(sc => String(sc.studentId) === String(studentId)).length;

    const modal = document.createElement('div');
    modal.id = 'transfer-student-modal';
    modal.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:99999',
        'display:flex', 'align-items:center', 'justify-content:center',
        'background:rgba(0,0,0,0.55)', 'backdrop-filter:blur(3px)',
        'animation:fadeInOverlay .2s ease'
    ].join(';');

    modal.innerHTML = `
        <style>
            @keyframes fadeInOverlay { from{opacity:0} to{opacity:1} }
            @keyframes slideUpModal  { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
            #transfer-modal-inner { animation: slideUpModal .25s ease; }
        </style>
        <div id="transfer-modal-inner" style="
            background:var(--bg-white,#fff);
            border-radius:20px;
            padding:2rem;
            max-width:500px;
            width:92%;
            box-shadow:0 25px 60px rgba(0,0,0,0.3);
            direction:rtl;
            font-family:inherit;
            max-height:90vh;
            overflow-y:auto;
        ">
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                <h2 style="margin:0;color:var(--primary,#4f46e5);font-size:1.25rem;font-weight:800;">
                    <i class="fas fa-exchange-alt" style="margin-left:8px;"></i>
                    نقل الطالب لمجموعة أخرى
                </h2>
                <button onclick="document.getElementById('transfer-student-modal').remove()"
                    style="background:var(--bg-light,#f1f5f9);border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;color:var(--text-muted,#64748b);">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <!-- بيانات الطالب -->
            <div style="
                background:linear-gradient(135deg,rgba(79,70,229,0.06),rgba(79,70,229,0.02));
                border:1.5px solid rgba(79,70,229,0.15);
                border-radius:14px;
                padding:1.2rem;
                margin-bottom:1.5rem;
            ">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:0.8rem;">
                    <div style="
                        width:44px;height:44px;border-radius:50%;
                        background:linear-gradient(135deg,var(--primary,#4f46e5),#7c3aed);
                        color:#fff;display:flex;align-items:center;justify-content:center;
                        font-size:1.2rem;font-weight:800;flex-shrink:0;
                    ">${student.name.charAt(0)}</div>
                    <div>
                        <div style="font-weight:800;font-size:1.05rem;color:var(--text-main,#1e293b);">${student.name}</div>
                        <div style="font-family:monospace;font-size:0.85rem;color:var(--primary,#4f46e5);font-weight:700;">🔑 ${student.qrCode}</div>
                    </div>
                </div>

                <div style="display:flex;gap:0.6rem;flex-wrap:wrap;margin-top:0.5rem;">
                    <span style="background:#f0f9ff;color:#0369a1;padding:3px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;">
                        <i class="fas fa-users"></i> ${currentGroup ? currentGroup.name : 'غير محدد'}
                    </span>
                    <span style="background:#f0fdf4;color:#166534;padding:3px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;">
                        <i class="fas fa-calendar-check"></i> ${attCount} حضور
                    </span>
                    <span style="background:#fffbeb;color:#92400e;padding:3px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;">
                        <i class="fas fa-wallet"></i> ${payCount} مدفوعة
                    </span>
                    <span style="background:#fdf4ff;color:#7e22ce;padding:3px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;">
                        <i class="fas fa-star"></i> ${scoreCount} درجة
                    </span>
                </div>
            </div>

            <!-- اختيار المجموعة -->
            <div style="margin-bottom:1.5rem;">
                <label style="display:block;font-weight:700;margin-bottom:8px;color:var(--text-main,#1e293b);">
                    <i class="fas fa-layer-group" style="color:var(--accent,#f59e0b);margin-left:6px;"></i>
                    اختر المجموعة الجديدة:
                </label>
                <select id="transfer-group-select" style="
                    width:100%;padding:0.75rem 1rem;
                    border:2px solid var(--border,#e2e8f0);
                    border-radius:12px;font-family:inherit;font-size:0.95rem;
                    color:var(--text-main,#1e293b);background:var(--bg-white,#fff);
                    cursor:pointer;outline:none;
                    transition:border-color .2s;
                " onchange="this.style.borderColor='var(--primary,#4f46e5)'">
                    <option value="">-- اختر المجموعة --</option>
                    ${optionsHtml}
                </select>
            </div>

            <!-- ملاحظة -->
            <div style="
                background:#fffbeb;border:1px solid #fde68a;
                border-radius:10px;padding:0.75rem 1rem;
                font-size:0.82rem;color:#92400e;
                margin-bottom:1.5rem;line-height:1.6;
            ">
                <i class="fas fa-info-circle" style="margin-left:5px;"></i>
                الكود لن يتغير. سجلات الحضور ستنتقل مع الطالب. المدفوعات والدرجات تبقى محفوظة تلقائياً.
            </div>

            <!-- أزرار -->
            <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
                <button
                    onclick="document.getElementById('transfer-student-modal').remove()"
                    style="
                        padding:0.65rem 1.5rem;border-radius:10px;
                        border:2px solid var(--border,#e2e8f0);
                        background:transparent;font-family:inherit;
                        font-weight:700;cursor:pointer;
                        color:var(--text-muted,#64748b);font-size:0.95rem;
                        transition:all .2s;
                    "
                    onmouseover="this.style.background='var(--bg-light,#f1f5f9)'"
                    onmouseout="this.style.background='transparent'"
                >
                    إلغاء
                </button>
                <button
                    onclick="_confirmTransferFromModal(${studentId})"
                    style="
                        padding:0.65rem 1.8rem;border-radius:10px;border:none;
                        background:linear-gradient(135deg,#16a34a,#15803d);
                        color:#fff;font-family:inherit;font-weight:700;
                        cursor:pointer;font-size:0.95rem;
                        box-shadow:0 4px 12px rgba(22,163,74,0.3);
                        transition:all .2s;
                    "
                    onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 16px rgba(22,163,74,0.4)'"
                    onmouseout="this.style.transform='';this.style.boxShadow='0 4px 12px rgba(22,163,74,0.3)'"
                >
                    <i class="fas fa-exchange-alt" style="margin-left:6px;"></i>
                    تأكيد النقل
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // إغلاق عند الضغط خارج المحتوى
    modal.addEventListener('click', e => {
        if (e.target === modal) modal.remove();
    });

    // تركيز على الـ select
    setTimeout(() => {
        const sel = document.getElementById('transfer-group-select');
        if (sel) sel.focus();
    }, 100);
}

/**
 * يُنفّذ النقل بعد اختيار المجموعة من الـ modal
 * @param {number|string} studentId
 */
async function _confirmTransferFromModal(studentId) {
    const select = document.getElementById('transfer-group-select');
    if (!select || !select.value) {
        // تأثير اهتزاز على الـ select لتنبيه المستخدم
        if (select) {
            select.style.borderColor = 'var(--danger,#ef4444)';
            select.style.animation = 'none';
            setTimeout(() => { select.style.borderColor = ''; }, 1500);
        }
        showNotification('⚠️ يرجى اختيار المجموعة الجديدة أولاً', 'warning');
        return;
    }

    const newGroupId = select.value;

    // إغلاق الـ modal أولاً
    const modal = document.getElementById('transfer-student-modal');
    if (modal) modal.remove();

    // تنفيذ النقل بدون confirm إضافي (الـ modal هو التأكيد)
    await transferStudent(studentId, newGroupId, { confirm: false });
}

// ============================================================
//  تصدير عالمي — يجب أن تكون كل الدوال في window
// ============================================================
window.transferStudent           = transferStudent;
window.showTransferStudentModal  = showTransferStudentModal;
window._confirmTransferFromModal = _confirmTransferFromModal;

console.log('[transfer-student.js] ✅ تم تحميل نظام النقل بين المجموعات');
