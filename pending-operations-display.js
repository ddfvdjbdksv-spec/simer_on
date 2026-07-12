// ============================================
// نظام عرض حالة العمليات المعلقة + البحث الذكي
// Pending Operations Status + Smart Donor Search
// ============================================

/**
 * =============================================
 * 1️⃣ نظام عرض حالة العمليات المعلقة
 * Pending Operations Status Display System
 * =============================================
 */

// دالة تحديث حالة العمليات المعلقة في الصفحة
window.updatePendingOperationsDisplay = function() {
    if (!window.offlineSync) {
        console.log('⚠️ نظام المزامنة غير متاح');
        return;
    }

    const stats = window.offlineSync.getStatistics();
    const pendingCount = window.offlineSync.syncQueue.length;
    
    // إنشاء أو تحديث مؤشر الحالة
    let statusIndicator = document.getElementById('pending-ops-status-indicator');
    
    if (!statusIndicator) {
        statusIndicator = document.createElement('div');
        statusIndicator.id = 'pending-ops-status-indicator';
        statusIndicator.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 999;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 18px;
            border-radius: 25px;
            font-family: 'Cairo', sans-serif;
            font-size: 14px;
            font-weight: 700;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            cursor: pointer;
            transition: all 0.3s ease;
            direction: rtl;
        `;
        document.body.appendChild(statusIndicator);
    }

    // تحديد النص والألون حسب الحالة
    let statusHTML = '';
    let bgColor = '';
    let textColor = '';

    if (!stats.isOnline) {
        // حالة غير متصل
        statusHTML = `
            <i class="fas fa-wifi" style="font-size: 16px;"></i>
            <span>🔴 غير متصل</span>
            ${pendingCount > 0 ? `<span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 8px;">${pendingCount} عملية</span>` : ''}
        `;
        bgColor = '#ef4444';
        textColor = 'white';
    } else if (pendingCount > 0) {
        // حالة متصل لكن توجد عمليات معلقة
        const operationWord = pendingCount === 1 ? 'عملية' : 'عمليات';
        statusHTML = `
            <i class="fas fa-cloud-upload-alt" style="font-size: 16px; animation: pulse 1.5s infinite;"></i>
            <span>في انتظار رفع <strong>${pendingCount}</strong> ${operationWord}</span>
        `;
        bgColor = '#f59e0b';
        textColor = 'white';
    } else {
        // حالة متصل وجميع العمليات مرفوعة
        statusHTML = `
            <i class="fas fa-check-circle" style="font-size: 16px; color: #10b981;"></i>
            <span>✅ جميع العمليات محدثة</span>
        `;
        bgColor = '#10b981';
        textColor = 'white';
    }

    statusIndicator.innerHTML = statusHTML;
    statusIndicator.style.background = bgColor;
    statusIndicator.style.color = textColor;

    // أضف حدث الضغط لعرض التفاصيل
    statusIndicator.onclick = () => {
        window.showPendingOperationsDetails();
    };

    // إذا كانت عمليات معلقة، أضف animation
    if (pendingCount > 0) {
        statusIndicator.style.animation = 'pulse 1.5s infinite';
    } else {
        statusIndicator.style.animation = 'none';
    }

    console.log(`📊 تم تحديث مؤشر العمليات: ${pendingCount} عملية معلقة`);
};

// دالة عرض تفاصيل العمليات المعلقة
window.showPendingOperationsDetails = function() {
    if (!window.offlineSync) return;

    const stats = window.offlineSync.getStatistics();
    const pendingCount = window.offlineSync.syncQueue.length;
    const queue = window.offlineSync.syncQueue;

    let detailsHTML = `
        <div style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            z-index: 10000;
            direction: rtl;
            text-align: right;
            font-family: 'Cairo', sans-serif;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; color: #333; font-size: 1.5rem;">📊 تفاصيل العمليات</h3>
                <button onclick="this.closest('div').remove()" style="
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #999;
                ">×</button>
            </div>

            <div style="background: #f0fdf4; border: 2px solid #10b981; border-radius: 10px; padding: 15px; margin-bottom: 20px;">
                <p style="margin: 0; color: #059669; font-weight: 700;">
                    🟢 حالة الاتصال: ${stats.isOnline ? '✅ متصل' : '❌ غير متصل'}
                </p>
            </div>

            <div style="background: #fff7ed; border: 2px solid #f97316; border-radius: 10px; padding: 15px; margin-bottom: 20px;">
                <p style="margin: 10px 0 0 0; color: #ea580c; font-weight: 700; font-size: 1.1rem;">
                    ⏳ العمليات المعلقة: <span style="color: #dc2626; font-size: 1.3rem;">${pendingCount}</span>
                </p>
            </div>
    `;

    if (pendingCount > 0) {
        detailsHTML += `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <p style="margin: 0 0 12px 0; font-weight: 700; color: #333;">📋 قائمة العمليات:</p>
        `;

        queue.forEach((op, index) => {
            const typeLabel = {
                'case': '👤 حالة',
                'donor': '💚 متبرع',
                'expense': '💰 مصروف'
            }[op.type] || op.type;

            const actionLabel = {
                'add': '➕ إضافة',
                'update': '✏️ تحديث',
                'delete': '🗑️ حذف'
            }[op.action] || op.action;

            detailsHTML += `
                <div style="
                    background: white;
                    padding: 10px;
                    border-radius: 6px;
                    margin-bottom: 8px;
                    border-right: 4px solid #f97316;
                ">
                    <p style="margin: 0; font-size: 0.9rem;">
                        <strong>${index + 1}.</strong> ${typeLabel} - ${actionLabel}
                    </p>
                    <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #666;">
                        🕐 ${new Date(op.timestamp).toLocaleTimeString('ar-EG')}
                    </p>
                </div>
            `;
        });

        detailsHTML += `</div>`;
    }

    detailsHTML += `
            <div style="text-align: center;">
                <button onclick="this.closest('div').remove()" style="
                    background: #6366f1;
                    color: white;
                    border: none;
                    padding: 12px 30px;
                    border-radius: 8px;
                    font-size: 1rem;
                    font-weight: 700;
                    cursor: pointer;
                    width: 100%;
                ">
                    ✓ حسناً
                </button>
            </div>
        </div>
    `;

    // أضف background overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
    `;
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);

    const detailsDiv = document.createElement('div');
    detailsDiv.innerHTML = detailsHTML;
    detailsDiv.firstChild.onclick = (e) => e.stopPropagation();
    overlay.appendChild(detailsDiv);

    console.log('📊 تم عرض تفاصيل العمليات المعلقة');
};

// تحديث مؤشر الحالة عند تغيير قائمة الانتظار
window.setupPendingOpsListener = function() {
    if (!window.offlineSync) return;

    window.offlineSync.addListener((event) => {
        if (event.type === 'operation_added' || 
            event.type === 'operation_synced' || 
            event.type === 'operation_removed' ||
            event.type === 'status_changed') {
            
            setTimeout(() => {
                window.updatePendingOperationsDisplay();
            }, 100);
        }
    });

    // تحديث أولي
    window.updatePendingOperationsDisplay();
};

// استدعاء المستمع عند بدء التطبيق
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(window.setupPendingOpsListener, 1000);
    });
} else {
    setTimeout(window.setupPendingOpsListener, 1000);
}

/**
 * =============================================
 * 2️⃣ رسالة النجاح عند رفع العمليات
 * Success Message on Upload
 * =============================================
 */

// دالة عرض رسالة النجاح
window.showUploadSuccessMessage = function(count = 'جميع') {
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 18px 25px;
        border-radius: 12px;
        box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
        font-family: 'Cairo', sans-serif;
        font-size: 1rem;
        font-weight: 700;
        z-index: 10001;
        animation: slideIn 0.3s ease, slideOut 0.3s ease 4.7s;
        direction: rtl;
        text-align: right;
    `;

    message.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <i class="fas fa-check-circle" style="font-size: 24px;"></i>
            <div>
                <p style="margin: 0; font-weight: 800;">✅ تم رفع جميع العمليات بنجاح!</p>
                <p style="margin: 4px 0 0 0; font-size: 0.9rem; opacity: 0.9;">تم مزامنة البيانات مع الخادم</p>
            </div>
        </div>
    `;

    document.body.appendChild(message);

    // إزالة الرسالة بعد 5 ثوان
    setTimeout(() => {
        message.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => message.remove(), 300);
    }, 5000);

    console.log('✅ تم عرض رسالة النجاح');
};

// إضافة CSS للـ animations
if (!document.querySelector('#pending-ops-animations')) {
    const style = document.createElement('style');
    style.id = 'pending-ops-animations';
    style.textContent = `
        @keyframes pulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.7;
            }
        }

        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * =============================================
 * 3️⃣ نظام البحث الذكي عن المتبرعين
 * Smart Donor Search System
 * =============================================
 */

// دالة الحصول على قائمة المتبرعين بدون تكرار
window.getUniqueDonors = function() {
    if (!appData || !appData.donors) return [];

    const uniqueDonors = [];
    const donorNames = new Set();

    // إضافة المتبرعين من قائمة الأسماء الفريدة
    appData.donors.forEach(donor => {
        if (donor.name && !donorNames.has(donor.name)) {
            donorNames.add(donor.name);
            uniqueDonors.push({
                name: donor.name,
                count: appData.donors.filter(d => d.name === donor.name).length
            });
        }
    });

    // ترتيب الأسماء
    return uniqueDonors.sort((a, b) => b.count - a.count);
};

// دالة البحث عن المتبرعين مع التصفية
window.searchDonors = function(query) {
    const uniqueDonors = window.getUniqueDonors();

    if (!query || query.trim() === '') {
        return uniqueDonors;
    }

    return uniqueDonors.filter(donor =>
        donor.name.includes(query)
    );
};

// دالة إنشاء قائمة البحث عن المتبرعين
window.createDonorSearchList = function(inputElement, resultContainerId) {
    inputElement.addEventListener('input', function(e) {
        const results = window.searchDonors(e.target.value);
        const resultContainer = document.getElementById(resultContainerId);

        if (!resultContainer) return;

        if (e.target.value.trim() === '' || results.length === 0) {
            resultContainer.innerHTML = '';
            return;
        }

        let html = '<div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; max-height: 300px; overflow-y: auto; position: absolute; width: 100%; top: 100%; left: 0; z-index: 1000;">';

        results.forEach(donor => {
            const countText = donor.count > 1 ? `(${donor.count} تبرعات)` : '(تبرع واحد)';
            html += `
                <div onclick="window.selectDonor('${donor.name}')" style="
                    padding: 12px 15px;
                    cursor: pointer;
                    border-bottom: 1px solid #f0f0f0;
                    transition: background 0.2s;
                "
                onmouseover="this.style.background = '#f0f9ff'"
                onmouseout="this.style.background = 'white'"
                >
                    <div style="font-weight: 700; color: #333;">${donor.name}</div>
                    <div style="font-size: 0.8rem; color: #999; margin-top: 3px;">💚 ${countText}</div>
                </div>
            `;
        });

        html += '</div>';
        resultContainer.innerHTML = html;
    });

    // إغلاق القائمة عند الضغط خارجها
    document.addEventListener('click', function(e) {
        if (e.target !== inputElement) {
            const container = document.getElementById(resultContainerId);
            if (container) container.innerHTML = '';
        }
    });
};

// دالة اختيار متبرع
window.selectDonor = function(donorName) {
    const input = document.querySelector('[data-donor-search]');
    if (input) {
        input.value = donorName;
        const container = input.nextElementSibling;
        if (container) container.innerHTML = '';
    }

    console.log(`✅ تم اختيار المتبرع: ${donorName}`);
};

/**
 * =============================================
 * 4️⃣ تحديث دالة المزامنة لعرض رسالة النجاح
 * Update Sync Function to Show Success Message
 * =============================================
 */

window.syncWithSuccessNotification = async function() {
    if (!window.offlineSync) {
        console.log('نظام المزامنة غير متاح');
        return;
    }

    const initialCount = window.offlineSync.syncQueue.length;

    if (initialCount === 0) {
        console.log('لا توجد عمليات معلقة');
        return;
    }

    // بدء المزامنة
    await window.offlineSync.attemptSync();

    // انتظر قليلاً ثم تحقق من النتيجة
    setTimeout(() => {
        const finalCount = window.offlineSync.syncQueue.length;

        if (finalCount === 0 && initialCount > 0) {
            window.showUploadSuccessMessage(initialCount);
            console.log('✅ تم رفع جميع العمليات بنجاح');
        }
    }, 500);
};

console.log('✅ تم تحميل نظام عرض العمليات المعلقة والبحث الذكي');
