function showCycleArchive() {
    const list = document.getElementById('archive-list');
    if (!list) return;

    // Filter cycles by both grade and current group for isolation
    const gradeCycles = db.cycles.filter(c => c.grade == currentGrade && (c.groupId == currentGroupId || !c.groupId)).reverse();

    list.innerHTML = gradeCycles.map(c => `
        <tr>
            <td><strong>${c.title}</strong></td>
            <td>${new Date(c.date).toLocaleDateString('ar-EG')}</td>
            <td>${c.fee || 0} ج.م ${c.platformFee ? `+ ${c.platformFee} منصة` : ''}</td>
            <td>
                <button class="btn btn-primary" style="background:var(--accent); padding:5px 15px;" onclick="viewArchivedCycle(${c.id})">
                    عرض التقرير <i class="fas fa-file-invoice"></i>
                </button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center; padding:2rem;">لا يوجد دورات مؤرشفة بعد</td></tr>';

    toggleModal('archive-modal', true);
}

function viewArchivedCycle(cycleId) {
    const cycle = db.cycles.find(c => c.id == cycleId);
    if (!cycle) return;

    // 1. تصفية الطلاب لنفس الصف والمجموعة الخاصة بالدورة
    const gradeStudents = db.students.filter(s => s.grade == cycle.grade && String(s.groupId) === String(cycle.groupId));
    
    // 2. تصفية المدفوعات التابعة للدورة والمجموعة
    const cyclePayments = db.payments.filter(p => p.cycleId == cycleId);
    const groupPayments = cyclePayments.filter(p => gradeStudents.some(s => s.id == p.studentId));

    // 3. تصفية اشتراكات المنصة التابعة للدورة والمجموعة
    const cyclePlatformSubs = (db.platformSubscriptions || []).filter(ps => 
        ps.cycleId == cycleId && gradeStudents.some(s => s.id == ps.student_id)
    );

    const lessonPaidList = [];
    const platformPaidList = [];
    const combinedPaidList = [];
    const unpaidList = [];

    // رسم الخرائط للبحث السريع
    const paymentsByStudent = {};
    groupPayments.forEach(p => {
        if (!paymentsByStudent[p.studentId]) paymentsByStudent[p.studentId] = [];
        paymentsByStudent[p.studentId].push(p);
    });

    const platformSubsByStudent = {};
    cyclePlatformSubs.forEach(ps => {
        if (!platformSubsByStudent[ps.student_id]) platformSubsByStudent[ps.student_id] = [];
        platformSubsByStudent[ps.student_id].push(ps);
    });

    gradeStudents.forEach(s => {
        const studentPayments = paymentsByStudent[s.id] || [];
        const studentPlatformSubs = platformSubsByStudent[s.id] || [];

        const lessonPay = studentPayments.find(p => p.category === 'اشتراك شهري');
        const hasPlatformSub = studentPlatformSubs.length > 0;
        const platformPay = studentPayments.find(p => p.category === 'اشتراك المنصة');

        const hasLesson = !!lessonPay;
        const hasPlatform = hasPlatformSub || !!platformPay;

        // أ. أرشيف اشتراكات الدروس
        if (hasLesson) {
            lessonPaidList.push({
                name: s.name,
                code: s.qrCode,
                amount: lessonPay.amount,
                date: lessonPay.date,
                collectedBy: lessonPay.collectedBy || null
            });
        }

        // ب. أرشيف اشتراكات المنصة
        if (hasPlatform) {
            if (hasPlatformSub) {
                studentPlatformSubs.forEach(ps => {
                    platformPaidList.push({
                        name: s.name,
                        code: s.qrCode,
                        course: ps.course_title,
                        amount: ps.amount,
                        date: ps.payment_date,
                        sync: ps.sync_status,
                        collectedBy: ps.collectedBy || null
                    });
                });
            } else if (platformPay) {
                // استرجاع احتياطي للسجلات القديمة
                platformPaidList.push({
                    name: s.name,
                    code: s.qrCode,
                    course: platformPay.platformCourseTitle || (cycle.activePlatformCourse ? cycle.activePlatformCourse.courseTitle : 'كورس المنصة'),
                    amount: platformPay.amount,
                    date: platformPay.date,
                    sync: 1,
                    collectedBy: platformPay.collectedBy || null
                });
            }
        }

        // ج. أرشيف الاشتراكين معاً (نوع العملية)
        if (hasLesson || hasPlatform) {
            let type = '';
            let totalAmount = 0;
            let date = '';
            const collectors = new Set();

            if (hasLesson && hasPlatform) {
                type = 'اشتراك درس + منصة';
                const platformAmt = studentPlatformSubs.reduce((sum, ps) => sum + ps.amount, 0) || (platformPay ? platformPay.amount : 0);
                totalAmount = lessonPay.amount + platformAmt;
                date = lessonPay.date;
                if (lessonPay.collectedBy) collectors.add(lessonPay.collectedBy);
                studentPlatformSubs.forEach(ps => { if (ps.collectedBy) collectors.add(ps.collectedBy); });
                if (platformPay && platformPay.collectedBy) collectors.add(platformPay.collectedBy);
            } else if (hasLesson) {
                type = 'اشتراك درس';
                totalAmount = lessonPay.amount;
                date = lessonPay.date;
                if (lessonPay.collectedBy) collectors.add(lessonPay.collectedBy);
            } else {
                type = 'اشتراك منصة';
                totalAmount = studentPlatformSubs.reduce((sum, ps) => sum + ps.amount, 0) || (platformPay ? platformPay.amount : 0);
                date = studentPlatformSubs[0] ? studentPlatformSubs[0].payment_date : (platformPay ? platformPay.date : '');
                studentPlatformSubs.forEach(ps => { if (ps.collectedBy) collectors.add(ps.collectedBy); });
                if (platformPay && platformPay.collectedBy) collectors.add(platformPay.collectedBy);
            }

            combinedPaidList.push({
                name: s.name,
                code: s.qrCode,
                type: type,
                totalAmount: totalAmount,
                date: date,
                collectedBy: collectors.size ? [...collectors].join(' + ') : null
            });
        } else {
            // د. الطلاب غير الدافعين
            unpaidList.push({
                id: s.id,
                name: s.name,
                code: s.qrCode
            });
        }
    });

    const totalLessonCollected = lessonPaidList.reduce((sum, p) => sum + p.amount, 0);
    const totalPlatformCollected = platformPaidList.reduce((sum, p) => sum + p.amount, 0);
    const totalCollected = totalLessonCollected + totalPlatformCollected;
    const centerCut = Math.round(totalCollected * (cycle.centerPercent || 0) / 100);

    const reportHtml = `
        <html dir="rtl">
        <head>
            <title>أرشيف دورة: ${cycle.title}</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
                :root {
                    --primary: #4f46e5;
                    --primary-light: #e0e7ff;
                    --accent: #10b981;
                    --danger: #ef4444;
                    --warning: #f59e0b;
                    --text-main: #1e293b;
                    --text-muted: #64748b;
                    --bg-light: #f8fafc;
                    --border: #e2e8f0;
                }
                body {
                    font-family: 'Tajawal', sans-serif;
                    padding: 30px;
                    color: var(--text-main);
                    background-color: #f1f5f9;
                    margin: 0;
                }
                .container {
                    max-width: 1100px;
                    margin: 0 auto;
                    background: white;
                    padding: 30px;
                    border-radius: 20px;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid var(--border);
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .header-title h1 {
                    margin: 0 0 10px 0;
                    color: var(--primary);
                    font-size: 2rem;
                    font-weight: 800;
                }
                .header-title p {
                    margin: 0;
                    color: var(--text-muted);
                    font-size: 0.95rem;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 30px;
                }
                .stat-card {
                    background: var(--bg-light);
                    padding: 20px;
                    border-radius: 15px;
                    border: 1px solid var(--border);
                    text-align: center;
                }
                .stat-card.highlight {
                    background: var(--primary-light);
                    border-color: #c7d2fe;
                }
                .stat-card-title {
                    font-size: 0.88rem;
                    color: var(--text-muted);
                    margin-bottom: 10px;
                    font-weight: 500;
                }
                .stat-card-value {
                    font-size: 1.8rem;
                    font-weight: 800;
                    color: var(--text-main);
                }
                .stat-card.highlight .stat-card-value {
                    color: var(--primary);
                }
                .tabs {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 25px;
                    border-bottom: 2px solid var(--border);
                    padding-bottom: 10px;
                }
                .tab-btn {
                    padding: 12px 24px;
                    background: none;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    font-weight: 700;
                    font-family: 'Tajawal', sans-serif;
                    color: var(--text-muted);
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .tab-btn:hover {
                    background: var(--bg-light);
                    color: var(--text-main);
                }
                .tab-btn.active {
                    background: var(--primary);
                    color: white;
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
                }
                .tab-content {
                    display: none;
                    animation: fadeIn 0.3s ease;
                }
                .tab-content.active {
                    display: block;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                th, td {
                    padding: 12px 15px;
                    text-align: right;
                    border-bottom: 1px solid var(--border);
                }
                th {
                    background-color: var(--bg-light);
                    color: var(--text-muted);
                    font-weight: 700;
                }
                tr:hover {
                    background-color: rgba(241, 245, 249, 0.5);
                }
                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 4px 12px;
                    border-radius: 50px;
                    font-size: 0.8rem;
                    font-weight: 700;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @media print {
                    .no-print { display: none !important; }
                    body { background: white; padding: 0; }
                    .container { box-shadow: none; padding: 0; max-width: 100%; }
                    .tab-content { display: none !important; }
                    .tab-content.active { display: block !important; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="header-title">
                        <h1>${cycle.title}</h1>
                        <p><i class="far fa-calendar-alt"></i> تاريخ الأرشفة: ${new Date(cycle.date).toLocaleString('ar-EG')}</p>
                    </div>
                    <div class="no-print">
                        <button onclick="window.print()" style="padding:10px 25px; background:var(--primary); color:white; border:none; border-radius:10px; font-weight:700; cursor:pointer; font-family:'Tajawal'; box-shadow:0 4px 10px rgba(79,70,229,0.15);">
                            <i class="fas fa-print"></i> طباعة التقرير
                        </button>
                    </div>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-card-title">قيمة اشتراك الدرس</div>
                        <div class="stat-card-value">${cycle.fee || 0} ج.م</div>
                    </div>
                    ${cycle.platformFee ? `
                    <div class="stat-card">
                        <div class="stat-card-title">قيمة اشتراك المنصة</div>
                        <div class="stat-card-value">${cycle.platformFee} ج.م</div>
                    </div>` : ''}
                    <div class="stat-card highlight">
                        <div class="stat-card-title">إجمالي المحصل الفعلي</div>
                        <div class="stat-card-value">${totalCollected} ج.م</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-title">نسبة السنتر (${cycle.centerPercent || 0}%)</div>
                        <div class="stat-card-value" style="color:var(--warning)">${centerCut} ج.م</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-title">إجمالي عدد الطلاب</div>
                        <div class="stat-card-value" style="color:var(--primary)">${gradeStudents.length}</div>
                    </div>
                </div>

                <div class="tabs no-print">
                    <button class="tab-btn active" onclick="openTab(event, 'combined-tab')"><i class="fas fa-list"></i> سجل العمليات ونوع الدفع</button>
                    <button class="tab-btn" onclick="openTab(event, 'lessons-tab')"><i class="fas fa-chalkboard-teacher"></i> اشتراكات الدروس (${lessonPaidList.length})</button>
                    <button class="tab-btn" onclick="openTab(event, 'platform-tab')"><i class="fas fa-laptop-code"></i> اشتراكات المنصة (${platformPaidList.length})</button>
                    <button class="tab-btn" onclick="openTab(event, 'unpaid-tab')"><i class="fas fa-times-circle"></i> طلاب لم يدفعوا (${unpaidList.length})</button>
                </div>

                <!-- 1. سجل العمليات الإجمالي -->
                <div id="combined-tab" class="tab-content active">
                    <h3 style="margin-bottom:15px; border-right:4px solid var(--primary); padding-right:10px;">سجل جميع العمليات (نوع الدفع)</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>اسم الطالب</th>
                                <th>كود الطالب</th>
                                <th>نوع العملية</th>
                                <th>إجمالي المدفوع</th>
                                <th>تاريخ الدفع</th>
                                <th>بواسطة</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${combinedPaidList.map(item => `
                                <tr>
                                    <td><strong>${item.name}</strong></td>
                                    <td style="font-family:monospace; color:var(--text-muted);">${item.code}</td>
                                    <td>
                                        <span class="status-badge" style="${
                                            item.type === 'اشتراك درس + منصة' ? 'background:#f5f3ff; color:#7c3aed; border:1px solid #ddd6fe;' :
                                            item.type === 'اشتراك درس' ? 'background:#dcfce7; color:#166534; border:1px solid #bbf7d0;' :
                                            'background:#dbeafe; color:#1e40af; border:1px solid #bfdbfe;'
                                        }">
                                            ${item.type}
                                        </span>
                                    </td>
                                    <td style="font-weight:bold; color:var(--primary);">${item.totalAmount} ج.م</td>
                                    <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
                                    <td style="color:var(--text-muted); font-size:.85rem;">${item.collectedBy || '—'}</td>
                                </tr>
                            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:2rem;">لا توجد عمليات سداد مسجلة بعد</td></tr>'}
                        </tbody>
                    </table>
                </div>

                <!-- 2. أرشيف اشتراكات الدروس -->
                <div id="lessons-tab" class="tab-content">
                    <h3 style="margin-bottom:15px; border-right:4px solid var(--accent); padding-right:10px;">أرشيف اشتراكات الدروس</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>اسم الطالب</th>
                                <th>كود الطالب</th>
                                <th>الشهر</th>
                                <th>قيمة الاشتراك</th>
                                <th>تاريخ الدفع</th>
                                <th>بواسطة</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lessonPaidList.map(item => `
                                <tr>
                                    <td><strong>${item.name}</strong></td>
                                    <td style="font-family:monospace; color:var(--text-muted);">${item.code}</td>
                                    <td>${cycle.title}</td>
                                    <td style="font-weight:bold; color:var(--accent);">${item.amount} ج.م</td>
                                    <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
                                    <td style="color:var(--text-muted); font-size:.85rem;">${item.collectedBy || '—'}</td>
                                </tr>
                            `).join('') || '<tr><td colspan="6" style="text-align:center; padding:2rem;">لا توجد اشتراكات دروس مسجلة بعد</td></tr>'}
                        </tbody>
                    </table>
                </div>

                <!-- 3. أرشيف اشتراكات المنصة -->
                <div id="platform-tab" class="tab-content">
                    <h3 style="margin-bottom:15px; border-right:4px solid var(--primary); padding-right:10px;">أرشيف اشتراكات المنصة</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>اسم الطالب</th>
                                <th>كود الطالب</th>
                                <th>اسم الكورس</th>
                                <th>قيمة اشتراك المنصة</th>
                                <th>تاريخ الدفع</th>
                                <th>حالة المزامنة</th>
                                <th>بواسطة</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${platformPaidList.map(item => `
                                <tr>
                                    <td><strong>${item.name}</strong></td>
                                    <td style="font-family:monospace; color:var(--text-muted);">${item.code}</td>
                                    <td>${item.course}</td>
                                    <td style="font-weight:bold; color:var(--primary);">${item.amount} ج.م</td>
                                    <td>${new Date(item.date).toLocaleDateString('ar-EG')}</td>
                                    <td>
                                        ${item.sync === 1 
                                            ? '<span style="color:var(--accent); font-weight:700;"><i class="fas fa-check-circle"></i> تمت المزامنة</span>' 
                                            : '<span style="color:var(--warning); font-weight:700;"><i class="fas fa-clock"></i> معلقة محلياً</span>'
                                        }
                                    </td>
                                    <td style="color:var(--text-muted); font-size:.85rem;">${item.collectedBy || '—'}</td>
                                </tr>
                            `).join('') || '<tr><td colspan="7" style="text-align:center; padding:2rem;">لا توجد اشتراكات منصة مسجلة بعد</td></tr>'}
                        </tbody>
                    </table>
                </div>

                <!-- 4. الطلاب غير الدافعين -->
                <div id="unpaid-tab" class="tab-content">
                    <h3 style="margin-bottom:15px; border-right:4px solid var(--danger); padding-right:10px; color:var(--danger)">قائمة الطلاب المتأخرين عن الدفع</h3>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:10px;">
                        <i class="fas fa-info-circle"></i> يمكنك الآن تسجيل سداد أي طالب متأخر بأثر رجعي عن هذا الشهر مباشرة من هنا، وستتحدث كل التقارير والإحصائيات تلقائياً.
                    </p>
                    <table>
                        <thead>
                            <tr>
                                <th>اسم الطالب</th>
                                <th>كود الطالب</th>
                                <th>الحالة</th>
                                <th class="no-print">إجراء</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${unpaidList.map(item => `
                                <tr style="background-color:rgba(239, 68, 68, 0.02)">
                                    <td><strong>${item.name}</strong></td>
                                    <td style="font-family:monospace; color:var(--text-muted);">${item.code}</td>
                                    <td style="color:var(--danger); font-weight:700;"><i class="fas fa-exclamation-triangle"></i> لم يسدد أي اشتراك</td>
                                    <td class="no-print">
                                        <button class="tab-btn" style="background:var(--accent); color:#fff; padding:6px 14px;" onclick="_markArchivedStudentPaid(${cycle.id}, ${item.id})">
                                            <i class="fas fa-check-circle"></i> تسجيل السداد الآن
                                        </button>
                                    </td>
                                </tr>
                            `).join('') || '<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--accent); font-weight:700;"><i class="fas fa-trophy"></i> جميع الطلاب قاموا بالسداد بنجاح!</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <script>
                function _markArchivedStudentPaid(cycleId, studentId) {
                    if (!window.opener || window.opener.closed) {
                        alert('تعذر الاتصال بالنافذة الرئيسية للبرنامج. أعد فتح الأرشيف من الصفحة الرئيسية.');
                        return;
                    }
                    if (!confirm('هل تريد تسجيل سداد هذا الطالب عن هذا الشهر الآن؟ سيتم تحديث كل التقارير تلقائياً.')) return;
                    const ok = window.opener.recordArchivedMonthPayment(cycleId, studentId);
                    if (ok) {
                        window.opener.viewArchivedCycle(cycleId);
                        window.close();
                    }
                }
                function openTab(evt, tabName) {
                    var i, tabcontent, tablinks;
                    tabcontent = document.getElementsByClassName("tab-content");
                    for (i = 0; i < tabcontent.length; i++) {
                        tabcontent[i].classList.remove("active");
                    }
                    tablinks = document.getElementsByClassName("tab-btn");
                    for (i = 0; i < tablinks.length; i++) {
                        tablinks[i].classList.remove("active");
                    }
                    document.getElementById(tabName).classList.add("active");
                    evt.currentTarget.classList.add("active");
                }
            </script>
        </body>
        </html>
    `;

    const win = window.open('', '_blank');
    win.document.write(reportHtml);
    win.document.close();
}
