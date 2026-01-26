import { auth, db, signInWithEmailAndPassword, onAuthStateChanged, signOut, ref, onValue, remove, update, push, set, serverTimestamp, off, get, query, limitToLast, orderByKey, endAt, onChildAdded, onChildChanged } from './firebase-config.js';

// ==========================================
// PART 1: DOM ELEMENTS & GLOBAL VARIABLES
// ==========================================

const loginContainer = document.getElementById('login-container');
const dashboard = document.getElementById('dashboard');
const userList = document.getElementById('user-list');
const mainContentTitle = document.getElementById('main-content-title');
const detailsView = document.getElementById('details-view');
const categoryButtonsContainer = document.querySelector('.category-buttons');
const sidebar = document.querySelector('.sidebar');
const overlay = document.getElementById('overlay');
const dataModal = document.getElementById('data-modal');
const modalDataDisplayArea = document.getElementById('modal-data-display-area');

const sendNotificationAllBtn = document.getElementById('send-notification-all-btn');
const sendSingleUserNotificationBtn = document.getElementById('send-single-user-notification-btn');
const notificationModal = document.getElementById('notification-modal');
const notificationMessageInput = document.getElementById('notification-message-input');
const sendNotificationSubmitBtn = document.getElementById('send-notification-submit-btn');

const menuBtn = document.getElementById('menu-btn');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const sidebarTitle = document.getElementById('sidebar-title');
const deleteUserBtn = document.getElementById('delete-user-btn');
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

// Limits Elements
const limitsContainer = document.getElementById('limits-settings-container');
const limitVideoInput = document.getElementById('limit-video');
const limitAudioInput = document.getElementById('limit-audio');
const limitImageInput = document.getElementById('limit-image');
const updateLimitsBtn = document.getElementById('update-limits-btn');
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
    // Agar data GZIP header (H4s) se shuru nahi hota, to shayad normal text hai
    if (!data.startsWith('H4s') && !data.startsWith('eJ') && data.length < 20) return data;

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

// ==========================================
// PART 2.5: NOTIFICATION LOGIC
// ==========================================

sendNotificationAllBtn.addEventListener('click', () => {
    notificationTarget = { type: 'all' };
    document.getElementById('notification-modal-title').textContent = 'Send Notification to All Users';
    openModal(notificationModal);
});

sendSingleUserNotificationBtn.addEventListener('click', () => {
    if (!selectedUserInfo.userId) {
        alert("Please select a user first.");
        return;
    }
    notificationTarget = { type: 'single', userId: selectedUserInfo.userId, userName: selectedUserInfo.userName };
    document.getElementById('notification-modal-title').textContent = `Send Notification to ${selectedUserInfo.userName}`;
    openModal(notificationModal);
});

sendNotificationSubmitBtn.addEventListener('click', () => {
    const message = notificationMessageInput.value.trim();
    if (!message) {
        alert("Please enter a message.");
        return;
    }

    if (notificationTarget.type === 'all') {
        sendNotificationToAll(message);
    } else if (notificationTarget.type === 'single') {
        sendNotificationToUser(notificationTarget.userId, message);
    }
});

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

    updates[`${path}/maxVideoLimit`] = v;
    updates[`${path}/maxAudioLimit`] = a;
    updates[`${path}/maxImageLimit`] = i;

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
    };

    onValue(limitsRef, window.currentLimitsCallback);
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
                Object.keys(data[uid]).forEach(childKey => {
                    // Filter out metadata keys so they don't count as devices
                    if (['email', 'online', 'uid', 'timestamp', 'last_seen'].includes(childKey)) {
                         // Attempt to extract email/online even if they are at root
                         if (childKey === 'email') users[uid].email = data[uid][childKey];
                         if (childKey === 'online') users[uid].online = data[uid][childKey];
                         return; 
                    }

                    const childData = data[uid][childKey];
                    // Ensure childData is an object (a valid device node)
                    if (typeof childData === 'object' && childData !== null) {
                        users[uid].children[childKey] = childData;
                        
                        // Also check inside child for email (legacy structure support)
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
            if (selectedUserInfo.userId === uid) li.classList.add('active');

            li.innerHTML = `<span class="verification-status ${u.online ? 'verified' : 'not-verified'}">●</span>
                            <div>
                                <div class="user-name"><b>${u.email || 'N/A'}</b></div>
                                <small>UID: ${uid}</small>
                            </div>`;

            li.onclick = () => {
                document.querySelectorAll('.user-list-item').forEach(i => i.classList.remove('active'));
                li.classList.add('active');
                selectedUserInfo = { userId: uid, userName: u.email || uid, children: u.children };
                displayUserDetails(selectedUserInfo);
            };
            userList.appendChild(li);
        });
        sidebarTitle.textContent = `Users (${count})`;
    });
}

function displayUserDetails(userInfo) {
    mainContentTitle.textContent = userInfo.userName;
    detailsView.style.display = 'block';

    const childSelectorContainer = document.querySelector('.child-selector-container');
    const childSelector = document.createElement('select');
    childSelector.id = 'child-selector';
    childSelector.className = 'child-selector';
    
    childSelector.innerHTML = '<option value="all">All Devices</option>';
    const deviceKeys = Object.keys(userInfo.children);
    deviceKeys.forEach(childKey => {
        const child = userInfo.children[childKey];
        childSelector.innerHTML += `<option value="${childKey}">Child: ${child.nameChild || childKey}</option>`;
    });
    
    childSelectorContainer.innerHTML = '';
    childSelectorContainer.appendChild(childSelector);
    
    if (deviceKeys.length === 1) {
        childSelector.value = deviceKeys[0];
        selectedUserInfo.childKey = deviceKeys[0];
        childSelectorContainer.style.display = 'none';
    } else {
        selectedUserInfo.childKey = childSelector.value;
        childSelectorContainer.style.display = 'block';
    }

    childSelector.onchange = () => {
        selectedUserInfo.childKey = childSelector.value;
        updateFreezeStatus();
        updateAppVisibility();
        loadLimits(selectedUserInfo.userId, selectedUserInfo.childKey);
    };

    // Show action buttons
    deleteUserBtn.style.display = 'inline-flex';
    freezeBtn.style.display = 'inline-flex';
    unfreezeBtn.style.display = 'inline-flex';
    sendSingleUserNotificationBtn.style.display = 'inline-flex';

    if (configListener) {
        off(configRef, 'value', configListener);
    }
    updateFreezeStatus();
    updateAppVisibility();
    loadLimits(userInfo.userId, selectedUserInfo.childKey);

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
        openModal(dataModal); 
        loadCategoryData(btn.dataset.category);
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

    if(cat === 'photo' || cat === 'video' || cat === 'audio') { renderMedia(userId, childKey, cat); return; }
    if(cat === 'chat') { renderChatInterface(userId, childKey); return; }


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
                    appIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99 0-3.903-.52-5.586-1.459l-6.354 1.687zM5.222 19.865a.47.47 0 0 0 .123.16.89.89 0 0 0 .283.172l.006.002.002.001a.985.985 0 0 0 .437.106l.02.001h.001l.001.001c.217.005.433.003.647-.005l.024-.001.003-.001.003-.001c.231-.019.458-.049.68-.09l.022-.006.001-.001c.229-.052.454-.117.67-.193l.001-.001c.214-.075.424-.162.627-.261l.002-.001c.203-.1.4-.211.586-.33l.001-.001c.184-.118.362-.245.532-.38l.001-.001c.17-.134.33-.278.48-.43l.002-.002c.119-.122.23-.249.333-.38a1.21 1.21 0 0 0 .248-.356l.001-.002c.075-.123.14-.252.196-.386l.002-.005a5.532 5.532 0 0 0 .265-1.026l.001-.003c-.021-.06-.021-.121-.021-.183v-.009c.004-.233.024-.465.059-.694l.003-.001.002-.001c.046-.24.108-.476.184-.705l.001-.003c.078-.229.17-.453.275-.669l.001-.002c.105-.216.224-.424.354-.622l.002-.003c.13-.198.27-.387.42-.567l.001-.001c.149-.18.307-.35.474-.508l.002-.002a.49.49 0 0 0 .092-.085l-.001-.002c.002 0 .003 0 .005-.001a.39.39 0 0 0 .118-.11c.023-.024.045-.05.066-.076l.001-.002c.021-.025.04-.052.059-.08l.001-.001c.019-.028.037-.057.053-.086l.001-.002c.016-.029.03-.06.044-.09l.001-.002c.014-.03.026-.062.038-.094l.001-.002c.012-.032.023-.065.033-.098l.001-.002c.01-.033.018-.067.026-.1l.001-.003c.008-.033.015-.067.021-.101l.001-.003c.006-.034.01-.069.014-.104l.001-.002c.004-.035.007-.07.01-.105l.001-.003h.001c.002-.023.004-.046.005-.069l.001-.003c.001-.023.002-.047.002-.07v-.009a.054.054 0 0 0-.001-.01c0-.003 0-.005 0-.008l-.001-.002c0-.003 0-.006-.001-.009v-.003c0-.003 0-.006-.001-.009l-.001-.002a.11.11 0 0 0-.004-.012c0-.002 0-.004 0-.007l-.001-.002c-.001-.003-.002-.006-.003-.009l-.001-.002a.44.44 0 0 0-.012-.027l-.001-.001a.34.34 0 0 0-.012-.02l-.002-.001a.22.22 0 0 0-.02-.024l-.002-.002c-.007-.008-.014-.016-.022-.024l-.002-.002a.48.48 0 0 0-.044-.04l-.002-.001a.29.29 0 0 0-.04-.032l-.001-.001a.19.19 0 0 0-.022-.016h-.001a.06.06 0 0 0-.009-.004c-.002 0-.005 0-.007-.001h-.002c-.002 0-.005 0-.007-.001h-.002c-.005 0-.01 0-.015-.001h-.001c-.005 0-.01 0-.015-.001l-2.906.012c-.088.001-.177.004-.265.009l-.002.001c-.088.005-.175.013-.262.025l-.001.001c-.087.012-.173.028-.258.047l-.002.001c-.085.019-.169.041-.252.066l-.002.001c-.083.025-.165.053-.245.084l-.002.001c-.08.031-.158.065-.235.102l-.002.001c-.077.037-.152.077-.226.12l-.002.001c-.074.043-.146.089-.217.137l-.002.001c-.071.048-.14.1-.208.154l-.002.001c-.068.054-.133.11-.197.168l-.002.001c-.064.058-.125.118-.185.18l-.002.001c-.06.062-.117.126-.172.19l-.002.002c-.055.064-.107.13-.158.197l-.002.002c-.051.067-.099.135-.145.204l-.002.002c-.046.069-.089.139-.13.21l-.002.002c-.041.071-.079.143-.114.215l-.002.002c-.035.072-.068.145-.098.218l-.002.002c-.03.073-.057.147-.082.221l-.002.003c-.025.074-.047.148-.067.223l-.002.003c-.02.075-.038.15-.053.225l-.002.003c-.015.075-.028.15-.04.225l-.002.003c-.012.075-.022.15-.03.225l-.001.003c-.008.075-.013.15-.017.225l-.001.003c-.004.075-.006.15-.006.225l.001.003c0 .075.002.15.005.225l.001.002c.003.075.008.15.014.225l.001.002c.006.075.014.15.023.224l.001.002c.009.074.02.148.032.221l.001.002c.012.073.026.146.042.218l.002.002c.016.072.033.143.052.213l.002.002c.019.07.04.139.062.207l.002.002c.022.068.046.135.07.201l.002.002c.024.066.05.13.077.194l.002.002c.027.064.055.126.084.187l.002.002c.029.061.059.12.09.178l.002.002c.031.058.062.115.094.17l.002.002c.032.055.065.109.098.162l.002.002c.033.053.067.105.101.155l.002.002c.034.05.069.098.104.146l.002.002c.035.048.07.094.106.139l.002.001c.036.045.072.089.109.132l.002.002c.037.043.074.084.112.125l.002.001c.038.041.076.081.115.119l.002.002c.039.038.078.075.117.111l.002.002c.039.036.078.07.118.103l.002.001c.04.033.08.065.12.096l.002.001c.04.031.08.06.12.088l.002.001c.04.028.08.055.12.081l.002.001c.04.026.08.05.12.073l.002.001c.04.023.08.044.12.065l.002.001c.04.021.08.04.12.058l.002.001c.04.018.08.035.12.05l.002.001c.04.015.08.029.12.042l.002.001c.04.013.08.025.12.036l.002.001c.04.011.08.02.12.029l.002.001c.04.009.08.017.12.024l.002.001c.04.007.08.013.12.018l.002.001c.04.005.08.009.12.012l.002.001c.04.003.08.005.12.006l.002.001c.04.001.08.001.12.001h.001c.04 0 .08 0 .12-.001l.002-.001c.04-.001.08-.003.12-.006l.002-.001c.04-.003.08-.007.12-.012l.002-.001c.04-.005.08-.011.12-.018l.002-.001c.04-.007.08-.015.12-.024l.002-.001c.04-.009.08-.019.12-.029l.002-.001c.04-.011.08-.023.12-.036l.002-.001c.04-.013.08-.027.12-.042l.002-.001c.04-.015.08-.032.12-.05l.002-.001c.04-.018.08-.037.12-.058l.002-.001c.04-.021.08-.044.12-.065l.002-.001c.04-.023.08-.047.12-.073l.002-.001c.04-.026.08-.053.12-.081l.002-.001c.04-.028.08-.058.12-.088l.002-.001c.04-.031.08-.063.12-.096l.002-.001c.04-.033.078-.067.118-.103l.002-.001c.039-.036.078-.073.117-.111l.002-.002c.039-.038.076-.077.115-.119l.002-.001c.038-.041.075-.083.112-.125l.002-.002c.037-.043.073-.087.109-.132l.002-.002c.036-.045.071-.091.106-.139l.002-.001c.035-.048.069-.098.104-.146l.002-.002c.034-.05.067-.101.101-.155l.002-.002c.033-.053.065-.107.098-.162l.002-.002c.032-.055.062-.112.094-.17l.002-.002c.031-.058.061-.117.09-.178l.002-.002c.029-.061.056-.123.084-.187l.002-.002c.027-.064.052-.13.077-.194l.002-.002c.024-.066.048-.133.07-.201l.002-.002c.022-.068.043-.138.062-.207l.002-.002c.019-.07.036-.141.052-.213l.002-.002c.016-.072.03-.145.042-.218l.001-.002c.012-.073.023-.147.032-.221l.001-.002c.009-.074.017-.148.023-.224l.001-.002c.006-.075.011-.15.014-.225l.001-.002c.003-.075.004-.15.005-.225h.001c0-.075-.002-.15-.006-.225l-.001-.003c-.004-.075-.009-.15-.017-.225l-.001-.003c-.008-.075-.018-.15-.03-.225l-.001-.003c-.012-.075-.025-.15-.04-.225l-.002-.003c-.015-.075-.033-.15-.053-.225l-.002-.003c-.02-.075-.042-.149-.067-.223l-.002-.003c-.025-.074-.052-.148-.082-.221l-.002-.003c-.03-.073-.063-.146-.098-.218l-.002-.002c-.035-.072-.073-.144-.114-.215l-.002-.002c-.041-.071-.084-.141-.13-.21l-.002-.002c-.046-.069-.094-.137-.145-.204l-.002-.002c-.051-.067-.103-.133-.158-.197l-.002-.002c-.055-.064-.112-.128-.172-.19l-.002-.002c-.06-.062-.121-.122-.185-.18l-.002-.001c-.064-.058-.13-.114-.197-.168l-.002-.002c-.068-.054-.137-.106-.208-.154l-.002-.002c-.071-.048-.143-.094-.217-.137l-.002-.002c-.074-.043-.152-.083-.226-.12l-.002-.002c-.077-.037-.155-.071-.235-.102l-.002-.002c-.08-.031-.162-.059-.245-.084l-.002-.001c-.083-.025-.169-.047-.252-.066l-.002-.001c-.085-.019-.171-.035-.258-.047l-.002-.001c-.087-.012-.174-.02-.262-.025l-.002-.001c-.088-.005-.177-.008-.265-.009l-2.906-.011z"/></svg>';
                } else if (appName.includes('instagram')) {
                    appIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>';
                } else if (appName.includes('facebook') || appName.includes('messenger')) {
                    appIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>';
                } else {
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

function renderMedia(uid, ck, type) {
    const lowerType = type.toLowerCase();
    let path = `user/${uid}/${ck}/${lowerType}/data`;
    let pPath = `user/${uid}/${ck}/${lowerType}/params`;

    // Command Buttons
    let btn = '';
    if (lowerType === 'photo') btn = `<button onclick="cmd('${pPath}',{capturePhoto:true,facingPhoto:1})">Front</button> <button onclick="cmd('${pPath}',{capturePhoto:true,facingPhoto:0})">Back</button>`;
    if (lowerType === 'audio') btn = `<button onclick="cmd('${pPath}',{recordAudio:true,duration:30000})">Record 30s</button>`;
    if (lowerType === 'video') btn = `<button onclick="cmd('${pPath}',{recordVideo:true,facing:1,duration:30000})">Vid Front</button> <button onclick="cmd('${pPath}',{recordVideo:true,facing:0,duration:30000})">Vid Back</button>`;

    modalDataDisplayArea.innerHTML = `<div class="data-header">${btn}<button class="clear-btn" data-path="${path}">Clear</button></div><div id="media-grid" class="media-grid media-grid-${lowerType}"></div>`;

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
                const url = d.urlPhoto || d.audioUrl || d.videoUrl;

                if (lowerType === 'photo') {
                    mediaElement = `
                        <div class="media-timestamp-header"><b style="color:white;">${timestamp}</b></div>
                        <div class="media-card-image" onclick="openImageModal('${url}')">
                            <img src="${url}" loading="lazy">
                            <div class="media-card-overlay">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0z"/><path d="M21 4H3v16h18V4z"/><path d="M3.5 13.5 9 9l4 4L17.5 9"/></svg>
                            </div>
                        </div>
                        <div class="media-card-footer">
                            
                            <a href="${url}" download class="download-btn" title="Download Image">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </a>
                        </div>
                    `;
                } else if (lowerType === 'video') {
                    mediaElement = `
                        <div class="media-timestamp-header"><b style="color:white;">${timestamp}</b></div>
                        <div class="video-player-wrapper">
                            <video controls playsinline>
                                <source src="${url}" type="video/mp4">
                                Your browser does not support the video tag.
                            </video>
                        </div>
                        <div class="media-card-footer">
                            
                            <a href="${url}" download class="download-btn" title="Download Video">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </a>
                        </div>
                    `;
                } else if (lowerType === 'audio') {
                    mediaElement = `
                        <div class="media-timestamp-header"><b style="color:white;">${timestamp}</b></div>
                        <div class="audio-player-wrapper">
                            <audio controls>
                                <source src="${url}" type="audio/mpeg">
                                Your browser does not support the audio element.
                            </audio>
                            <a href="${url}" download class="download-btn" title="Download Audio">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            </a>
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
                Object.values(messages).forEach(msg => {
                    const bubble = document.createElement('div');
                    bubble.classList.add('chat-bubble', msg.sender); // 'user' or 'admin'
                    
                    const text = document.createElement('div');
                    text.textContent = msg.text;

                    const time = document.createElement('div');
                    time.classList.add('chat-time');
                    time.textContent = formatTimestamp(msg.timestamp);

                    bubble.appendChild(text);
                    bubble.appendChild(time);
                    messagesArea.appendChild(bubble);
                });
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
window.cmd = (p, d) => update(ref(db, p), d).then(()=>alert('Command Sent!'));

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

    // Sidebar Overlay Click (Close Sidebar)
    if (e.target === overlay) {
        sidebar.classList.remove('open');
        overlay.style.display = 'none';
    }
});

// Sidebar & Notifications
toggleSidebarBtn.onclick = () => dashboard.classList.toggle('sidebar-hidden');
menuBtn.onclick = () => { sidebar.classList.add('open'); overlay.style.display = 'block'; };


// Delete User
deleteUserBtn.onclick = () => {
    deleteUserInfo.textContent = "Remove " + selectedUserInfo.userName + "?";
    openModal(deleteUserModal);
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

