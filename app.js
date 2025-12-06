import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  orderBy,
  updateDoc,
  deleteDoc,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCtFOOGfjbeLM-bAT5i2J601w9_95MQlxs",
  authDomain: "kiit-confessions.firebaseapp.com",
  projectId: "kiit-confessions",
  storageBucket: "kiit-confessions.firebasestorage.app",
  messagingSenderId: "844059847809",
  appId: "1:844059847809:web:98a8a39a3a33c2dd7d3180",
  measurementId: "G-2JRL8TMMV7",
};

// *** ADMIN CONFIGURATION ***
const ADMIN_UIDS = [
    "WYr4sMbvSoapijfQREWV2d7zpZD2",
    "eASWpZ7o4Th1QD5ukGRJqllcTnh1"
]; 

// DOM elements
const feedContainer = document.getElementById("feedContainer");
const loading = document.getElementById("loading");
const navConfessions = document.getElementById("navConfessions");
const navChat = document.getElementById("navChat");
const confessionForm = document.getElementById("confessionForm");
const confessionInput = document.getElementById("confessionInput");
const confessionButton = document.getElementById("confessionButton");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatButton = document.getElementById("chatButton");
const typingIndicator = document.getElementById("typingIndicator");

// Scroll UI Elements
const scrollToBottomBtn = document.getElementById("scrollToBottomBtn");
const newMsgCount = document.getElementById("newMsgCount");

const profileButton = document.getElementById("profileButton");
const profileModal = document.getElementById("profileModal");
const modalCloseButton = document.getElementById("modalCloseButton");
const modalSaveButton = document.getElementById("modalSaveButton");
const modalUsernameInput = document.getElementById("modalUsernameInput");

const editModal = document.getElementById("editModal");
const modalEditTextArea = document.getElementById("modalEditTextArea");
const editModalCancelButton = document.getElementById("editModalCancelButton");
const editModalSaveButton = document.getElementById("editModalSaveButton");

// DELETE MODAL ELEMENTS
const confirmModal = document.getElementById("confirmModal");
const confirmModalText = document.getElementById("confirmModalText");
const confirmModalNoButton = document.getElementById("confirmModalNoButton");
const confirmModalActionContainer = document.getElementById("confirmModalActionContainer") || createActionContainer();

const contextMenu = document.getElementById("contextMenu");
const menuEdit = document.getElementById("menuEdit");
const menuDelete = document.getElementById("menuDelete");
const menuSelect = document.getElementById("menuSelect");

const selectionBar = document.getElementById("selectionBar");
const selectionCount = document.getElementById("selectionCount");
const selectionCancel = document.getElementById("selectionCancel");
const selectionDelete = document.getElementById("selectionDelete");

const replyBar = document.getElementById("replyBar");
const replyAuthor = document.getElementById("replyAuthor");
const replyText = document.getElementById("replyText");
const cancelReply = document.getElementById("cancelReply");

// State
let db;
let auth;
let currentUserId = null;
let currentUsername = "Anonymous";
let currentProfilePhotoURL = null;
let userProfiles = {};
let confessionsCollection;
let chatCollection;
let typingStatusCollection;
let unsubscribeConfessions = () => {};
let unsubscribeChat = () => {};
let unsubscribeUserProfiles = () => {};
let unsubscribeTypingStatus = () => {};
let currentPage = "chat";
let typingTimeout = null;

let docToEditId = null;
let collectionToEdit = null;
let deleteCallback = null;

let isSelectionMode = false;
let selectedMessages = new Set();
let currentContextMenuData = null;

let replyToMessage = null;

// Notification State
let notificationsEnabled = false;

// Scroll State
let unreadMessages = 0;
let userIsAtBottom = true;
let bottomObserver = null; 

// REACTIONS
const REACTION_TYPES = {
  thumbsup: "👍",
  laugh: "😂",
  surprised: "😮",
  heart: "❤️",
  skull: "💀"
};

// *** EXPANDED COLOR PALETTE (Neon/Pastel for Dark Mode) ***
const USER_COLORS = [
  "#ff79c6", // Pink
  "#8be9fd", // Cyan
  "#50fa7b", // Green
  "#bd93f9", // Purple
  "#ffb86c", // Orange
  "#f1fa8c", // Yellow
  "#ff5555", // Red
  "#00e5ff", // Bright Blue
  "#fab1a0", // Peach
  "#a29bfe", // Lavender
  "#55efc4", // Mint
  "#fdcb6e", // Mustard
  "#e17055", // Burnt Orange
  "#d63031", // Deep Red
  "#e84393", // Hot Pink
  "#0984e3", // Electron Blue
  "#00b894"  // Jungle Green
];

// Helper: Generate a consistent color from a User ID
function getUserColor(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash % USER_COLORS.length);
  return USER_COLORS[index];
}

function createActionContainer() {
    const existingYesBtn = document.getElementById("confirmModalYesButton");
    if(existingYesBtn && existingYesBtn.parentNode) {
        const container = document.createElement("div");
        container.id = "confirmModalActionContainer";
        container.className = "flex gap-2 flex-1";
        existingYesBtn.parentNode.replaceChild(container, existingYesBtn);
        return container;
    }
    return null;
}

// *** NOTIFICATIONS LOGIC ***

// 1. Inject the Bell Button into the UI
function injectNotificationButton() {
    const headerActions = profileButton.parentElement; // The div containing nav and profile button
    if (!headerActions) return;

    // Check if already exists
    if (document.getElementById("notificationButton")) return;

    const notifBtn = document.createElement("button");
    notifBtn.id = "notificationButton";
    notifBtn.className = "p-2 rounded-full hover:bg-[#262626] transition text-[#ededed]";
    notifBtn.title = "Toggle Notifications";
    // Default Icon (Will be updated by updateNotificationIcon)
    notifBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
    `;

    // Insert before the profile button
    headerActions.insertBefore(notifBtn, profileButton);

    notifBtn.addEventListener("click", handleNotificationClick);
    
    // Initialize State based on current permission
    if ("Notification" in window && Notification.permission === "granted") {
        notificationsEnabled = true;
    }
    updateNotificationIcon();
}

async function handleNotificationClick() {
    if (!("Notification" in window)) {
        alert("This browser does not support notifications.");
        return;
    }

    if (Notification.permission === "granted") {
        // Toggle Logic
        notificationsEnabled = !notificationsEnabled;
        
        if(notificationsEnabled) {
            new Notification("Notifications ON", { body: "You will receive updates.", icon: "icon.jpg" });
        } else {
             // Optional: Visual feedback
             // alert("Notifications Muted");
        }
        updateNotificationIcon();
        
    } else if (Notification.permission === "denied") {
        alert("Notifications are blocked by your browser. Please enable them in Site Settings.");
    } else {
        // Request Permission
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            notificationsEnabled = true;
            new Notification("Welcome!", { body: "Notifications enabled.", icon: "icon.jpg" });
            updateNotificationIcon();
        }
    }
}

function updateNotificationIcon() {
    const btn = document.getElementById("notificationButton");
    if (!btn) return;

    if (notificationsEnabled) {
        // STATE: ON (Yellow Filled Bell)
        btn.classList.add("text-yellow-400");
        btn.innerHTML = `
         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>`;
    } else {
        // STATE: OFF (Gray Outline Bell with Slash)
        btn.classList.remove("text-yellow-400");
        btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            <path d="M18.63 13A17.89 17.89 0 0 1 18 8"></path>
            <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"></path>
            <path d="M18 8a6 6 0 0 0-9.33-5"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>`;
    }
}

function showNotification(title, body) {
  // GUARD: Only show if supported, granted, AND enabled by user
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!notificationsEnabled) return;

  const cleanBody = body.length > 50 ? body.substring(0, 50) + "..." : body;
  
  try {
      new Notification(title, {
          body: cleanBody,
          icon: "icon.jpg",
          vibrate: [200, 100, 200]
      });
  } catch (e) {
      console.error("Notification failed:", e);
  }
}

async function initFirebase() {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    const userCredential = await signInAnonymously(auth);
    currentUserId = userCredential.user.uid;
    console.log("Your UID:", currentUserId); 
    
    // Inject UI elements
    injectNotificationButton();

    listenForUserProfiles();
    await loadUserProfile();

    confessionsCollection = collection(db, "confessions");
    chatCollection = collection(db, "chat");
    typingStatusCollection = collection(db, "typingStatus");

    initScrollObserver();
    showPage(currentPage);
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    loading.textContent = "Error: Could not connect to the grid. Refresh page.";
  }
}

function initScrollObserver() {
  const options = {
    root: feedContainer,
    rootMargin: "100px", 
    threshold: 0.1
  };

  bottomObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      userIsAtBottom = entry.isIntersecting;
      if (userIsAtBottom) {
        unreadMessages = 0;
        updateScrollButton();
      } else {
        updateScrollButton();
      }
    });
  }, options);
}

function updateScrollButton() {
  if (userIsAtBottom) {
    scrollToBottomBtn.classList.add("hidden");
    scrollToBottomBtn.style.display = ""; 
    newMsgCount.classList.add("hidden");
    unreadMessages = 0;
  } else {
    scrollToBottomBtn.classList.remove("hidden");
    scrollToBottomBtn.style.display = "flex";
    if (unreadMessages > 0) {
      newMsgCount.classList.remove("hidden");
      newMsgCount.textContent = unreadMessages > 99 ? "99+" : unreadMessages;
    } else {
      newMsgCount.classList.add("hidden");
    }
  }
}

function listenForUserProfiles() {
  const usersCollection = collection(db, "users");
  unsubscribeUserProfiles = onSnapshot(usersCollection, (snapshot) => {
    snapshot.docs.forEach((docSnap) => {
      userProfiles[docSnap.id] = docSnap.data();
    });
  });
}

async function loadUserProfile() {
  if (!db || !currentUserId) return;
  const userDocRef = doc(db, "users", currentUserId);
  const userDoc = await getDoc(userDocRef);

  if (userDoc.exists()) {
    const data = userDoc.data();
    currentUsername = data.username || "Anonymous";
    currentProfilePhotoURL = data.profilePhotoURL || null;
  } else {
    currentUsername = "Anonymous";
    currentProfilePhotoURL = null;
  }
  modalUsernameInput.value =
    currentUsername === "Anonymous" ? "" : currentUsername;
}

// *** OBSIDIAN PROFILE STYLE ***
async function handleProfileSave() {
  if (!db || !currentUserId) return;
  modalSaveButton.textContent = "SAVING...";
  modalSaveButton.disabled = true;
  const inputVal = modalUsernameInput.value.trim();
  if (!inputVal || inputVal.toLowerCase() === "anonymous") {
      alert("Please enter a valid username to continue.");
      modalSaveButton.textContent = "SAVE";
      modalSaveButton.disabled = false;
      return; 
  }
  const newUsername = inputVal;
  const firstLetter = newUsername.charAt(0).toUpperCase();
  const newProfilePhotoURL = `https://placehold.co/32x32/000000/ffffff?text=${firstLetter}`;

  try {
    const userDocRef = doc(db, "users", currentUserId);
    await setDoc(
      userDocRef,
      {
        username: newUsername,
        profilePhotoURL: newProfilePhotoURL,
      },
      { merge: true }
    );
    currentUsername = newUsername;
    currentProfilePhotoURL = newProfilePhotoURL;
    closeProfileModal();
  } catch (error) {
    console.error("Error saving profile: ", error);
  } finally {
    modalSaveButton.textContent = "SAVE";
    modalSaveButton.disabled = false;
  }
}

function openProfileModal() {
  modalUsernameInput.value =
    currentUsername === "Anonymous" ? "" : currentUsername;
  profileModal.classList.add("is-open");
}

function closeProfileModal() {
  profileModal.classList.remove("is-open");
}

function showEditModal(docId, collectionName, currentText) {
  docToEditId = docId;
  collectionToEdit = collectionName;
  modalEditTextArea.value = currentText;
  editModal.classList.add("is-open");
}

function closeEditModal() {
  editModal.classList.remove("is-open");
  docToEditId = null;
  collectionToEdit = null;
}

async function saveEdit() {
  const newText = modalEditTextArea.value.trim();
  if (newText && docToEditId && collectionToEdit) {
    editModalSaveButton.textContent = "SAVING...";
    editModalSaveButton.disabled = true;
    try {
      const docRef = doc(db, collectionToEdit, docToEditId);
      await updateDoc(docRef, {
        text: newText,
        edited: true,
      });
      closeEditModal();
    } catch (error) {
      console.error("Error updating document:", error);
      alert("Error: Could not save edit. The 5-minute edit window may have expired.");
    }
    editModalSaveButton.textContent = "SAVE";
    editModalSaveButton.disabled = false;
  }
}

// *** CONFIRM MODAL (OBSIDIAN THEME + ADMIN LOGIC) ***
function showConfirmModal(text, isMine, docId) {
  confirmModalText.textContent = text;
  confirmModalActionContainer.innerHTML = '';

  const isAdmin = ADMIN_UIDS.includes(currentUserId);

  if (isMine || isAdmin) {
    const btnForMe = document.createElement('button');
    btnForMe.className = "flex-1 px-4 py-2 rounded-lg font-bold text-sm border border-white text-white hover:bg-white hover:text-black transition";
    btnForMe.textContent = "FOR ME";
    btnForMe.onclick = async () => {
        closeConfirmModal();
        await updateDoc(doc(db, currentPage, docId), {
            hiddenFor: arrayUnion(currentUserId)
        });
    };

    const btnEveryone = document.createElement('button');
    btnEveryone.className = "flex-1 px-4 py-2 rounded-lg font-bold text-sm bg-red-600 text-white hover:bg-red-500 transition border border-red-600";
    btnEveryone.textContent = isAdmin && !isMine ? "NUKE (ADMIN)" : "EVERYONE";
    btnEveryone.onclick = async () => {
        closeConfirmModal();
        await deleteDoc(doc(db, currentPage, docId));
    };

    confirmModalActionContainer.appendChild(btnForMe);
    confirmModalActionContainer.appendChild(btnEveryone);

  } else {
    const btnForMe = document.createElement('button');
    btnForMe.className = "flex-1 px-4 py-2 rounded-lg font-bold text-sm bg-red-600 text-white hover:bg-red-500 transition";
    btnForMe.textContent = "DELETE";
    btnForMe.onclick = async () => {
        closeConfirmModal();
        await updateDoc(doc(db, currentPage, docId), {
            hiddenFor: arrayUnion(currentUserId)
        });
    };
    confirmModalActionContainer.appendChild(btnForMe);
  }

  confirmModal.classList.add("is-open");
}

function closeConfirmModal() {
  confirmModal.classList.remove("is-open");
}

async function toggleReaction(docId, collectionName, reactionType, hasReacted) {
  if (!db || !currentUserId) return;
  try {
    const docRef = doc(db, collectionName, docId);
    const reactionField = `reactions.${reactionType}`;
    if (hasReacted) {
      await updateDoc(docRef, { [reactionField]: arrayRemove(currentUserId) });
    } else {
      await updateDoc(docRef, { [reactionField]: arrayUnion(currentUserId) });
    }
  } catch (error) {
    console.error("Error toggling reaction:", error);
  }
}

function showDropdownMenu(event, data) {
  event.stopPropagation();
  
  if (contextMenu.classList.contains("is-open") && 
      currentContextMenuData && 
      currentContextMenuData.id === data.id) {
    hideDropdownMenu();
    return;
  }
  
  currentContextMenuData = data;
  const now = Date.now();
  const messageTime = parseInt(currentContextMenuData.timestamp, 10);
  
  // FIX: Increased Edit Window
  const isRecent = isNaN(messageTime) ? true : (now - messageTime < 900000);
  
  const isMine = currentContextMenuData.isMine === "true";
  const isAdmin = ADMIN_UIDS.includes(currentUserId);

  menuEdit.style.display = isRecent && isMine ? "block" : "none";
  menuDelete.style.display = "block";

  const rect = event.currentTarget.getBoundingClientRect();
  contextMenu.style.top = `${rect.bottom + 2}px`;
  
  if (isMine) {
    const menuWidth = contextMenu.offsetWidth || 150;
    contextMenu.style.left = `${rect.right - menuWidth}px`;
  } else {
    contextMenu.style.left = `${rect.left}px`;
  }
  contextMenu.classList.add("is-open");
}

function hideDropdownMenu() {
  contextMenu.classList.remove("is-open");
}

function handleMessageClick(bubble) {
  if (!isSelectionMode) return;
  const docId = bubble.dataset.id;
  if (selectedMessages.has(docId)) {
    selectedMessages.delete(docId);
    bubble.classList.remove("selected-message");
  } else {
    selectedMessages.add(docId);
    bubble.classList.add("selected-message");
  }
  updateSelectionBar();
}

function enterSelectionMode() {
  isSelectionMode = true;
  document.body.classList.add("selection-mode");
  selectionBar.classList.remove("hidden");
  chatForm.classList.add("hidden");
  confessionForm.classList.add("hidden");
  
  if (currentContextMenuData) {
    const docId = currentContextMenuData.id;
    selectedMessages.add(docId);
    const bubble = document.querySelector(`.message-bubble[data-id="${docId}"]`);
    if (bubble) bubble.classList.add("selected-message");
  }
  updateSelectionBar();
}

function exitSelectionMode() {
  isSelectionMode = false;
  document.body.classList.remove("selection-mode");
  selectionBar.classList.add("hidden");
  selectedMessages.clear();
  if (currentPage === "chat") {
    chatForm.classList.remove("hidden");
    chatForm.classList.add("flex");
  } else {
    confessionForm.classList.remove("hidden");
    confessionForm.classList.add("flex");
  }
  document.querySelectorAll(".selected-message").forEach((el) => {
    el.classList.remove("selected-message");
  });
}

function updateSelectionBar() {
  const count = selectedMessages.size;
  selectionCount.textContent = `${count} selected`;
  if (count === 0 && isSelectionMode) {
    exitSelectionMode();
  }
}

async function handleMultiDelete() {
  const count = selectedMessages.size;
  if (count === 0) return;
  const batch = writeBatch(db);
  
  const isAdmin = ADMIN_UIDS.includes(currentUserId);

  selectedMessages.forEach((docId) => {
    const docRef = doc(db, currentPage, docId);
    if (isAdmin) {
       batch.delete(docRef);
    } else {
       batch.update(docRef, { hiddenFor: arrayUnion(currentUserId) });
    }
  });
  
  await batch.commit();
  exitSelectionMode();
}

function scrollToBottom() {
  feedContainer.scrollTop = feedContainer.scrollHeight;
  userIsAtBottom = true;
  unreadMessages = 0;
  updateScrollButton();
}

function showPage(page) {
  currentPage = page;
  if (isSelectionMode) exitSelectionMode();
  cancelReplyMode();
  unsubscribeConfessions();
  unsubscribeChat();
  unsubscribeTypingStatus();
  typingIndicator.innerHTML = "&nbsp;";
  unreadMessages = 0;
  newMsgCount.classList.add("hidden");
  scrollToBottomBtn.classList.add("hidden");
  scrollToBottomBtn.style.display = "";

  if (page === "confessions") {
    navConfessions.classList.add("active");
    navChat.classList.remove("active");
    confessionForm.classList.add("flex");
    confessionForm.classList.remove("hidden");
    chatForm.classList.add("hidden");
    chatForm.classList.remove("flex");
    typingIndicator.classList.add("hidden");
    listenForConfessions();
  } else {
    navChat.classList.add("active");
    navConfessions.classList.remove("active");
    chatForm.classList.add("flex");
    chatForm.classList.remove("hidden");
    confessionForm.classList.add("hidden");
    confessionForm.classList.remove("flex");
    typingIndicator.classList.remove("hidden");
    listenForChat();
    listenForTyping();
  }
}

let lastConfessionDocs = [];
let lastChatDocs = [];

function listenForConfessions(isRerender = false) {
  if (isRerender) {
    renderFeed(lastConfessionDocs, "confessions", null, true); // Rerender doesn't need to notify
    return;
  }
  unsubscribeChat();
  feedContainer.innerHTML = '<div id="loading" class="text-center p-4">LOADING CONFESSIONS...</div>';
  const q = query(confessionsCollection, orderBy("timestamp", "asc"));
  
  let isFirstRun = true;
  unsubscribeConfessions = onSnapshot(q, (snapshot) => {
      lastConfessionDocs = snapshot.docs;
      renderFeed(lastConfessionDocs, "confessions", snapshot, isFirstRun);
      isFirstRun = false;
  });
}

function listenForChat(isRerender = false) {
  if (isRerender) {
    renderFeed(lastChatDocs, "chat", null, true); // Rerender doesn't need to notify
    return;
  }
  unsubscribeConfessions();
  feedContainer.innerHTML = '<div id="loading" class="text-center p-4">LOADING CHAT...</div>';
  const q = query(chatCollection, orderBy("timestamp", "asc"));

  let isFirstRun = true;
  unsubscribeChat = onSnapshot(q, (snapshot) => {
      lastChatDocs = snapshot.docs;
      renderFeed(lastChatDocs, "chat", snapshot, isFirstRun);
      isFirstRun = false;
  });
}

function listenForTyping() {
  unsubscribeTypingStatus = onSnapshot(typingStatusCollection, (snapshot) => {
    const now = Date.now();
    const typingUsers = [];
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const userId = docSnap.id;
      if (
        data.isTyping &&
        userId !== currentUserId &&
        now - data.timestamp < 5000
      ) {
        const username = userProfiles[userId]?.username || "Someone";
        typingUsers.push(username);
      }
    });
    if (typingUsers.length === 0) {
      typingIndicator.innerHTML = "&nbsp;";
    } else if (typingUsers.length === 1) {
      typingIndicator.textContent = `${typingUsers[0]} is typing...`;
    } else {
      typingIndicator.textContent = "Several users are typing...";
    }
  });
}

async function updateTypingStatus(isTyping) {
  if (!db || !currentUserId) return;
  if (typingTimeout) {
    clearTimeout(typingTimeout);
    typingTimeout = null;
  }
  const typingDocRef = doc(db, "typingStatus", currentUserId);
  if (isTyping) {
    await setDoc(typingDocRef, { isTyping: true, timestamp: Date.now() });
    typingTimeout = setTimeout(() => { updateTypingStatus(false); }, 3000);
  } else {
    await setDoc(typingDocRef, { isTyping: false, timestamp: Date.now() });
  }
}

function getDateHeader(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMessageTime(date) {
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 5) return seconds < 60 ? "Just now" : `${minutes} mins ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

// *** RENDER FEED (WITH USER COLORS) ***
function renderFeed(docs, type, snapshot, isFirstRun) {
  // Check for new notifications BEFORE clearing innerHTML
  if (!isFirstRun && snapshot) {
      snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
              const data = change.doc.data();
              // Notify if message is not from self and not hidden
              if (data.userId !== currentUserId) {
                  const isHidden = data.hiddenFor && data.hiddenFor.includes(currentUserId);
                  if (!isHidden) {
                     const title = type === "chat" ? "New Chat Message" : "New Confession";
                     showNotification(title, data.text || "Sent an image/file");
                  }
              }
          }
      });
  }

  const prevScrollTop = feedContainer.scrollTop;
  const wasAtBottom = userIsAtBottom;
  
  feedContainer.innerHTML = "";
  
  if (docs.length === 0) {
    const loadingEl = document.createElement("div");
    loadingEl.id = "loading";
    loadingEl.className = "text-center p-4";
    loadingEl.textContent = `NO ${type.toUpperCase()} YET. BE THE FIRST!`;
    feedContainer.appendChild(loadingEl);
    return;
  }

  let lastUserId = null;
  let lastDateString = null; 

  docs.forEach((docInstance) => {
    const data = docInstance.data();
    
    if (data.hiddenFor && data.hiddenFor.includes(currentUserId)) return;

    const text = data.text || "...";
    let messageDateObj = new Date();
    
    // FIX: Handle Latency Timestamp (null check)
    if (data.timestamp) {
        messageDateObj = data.timestamp.toDate();
    } else {
        messageDateObj = new Date();
    }
    
    const messageDateStr = messageDateObj.toDateString(); 

    if (lastDateString !== messageDateStr) {
        const sepDiv = document.createElement('div');
        sepDiv.className = 'date-separator';
        sepDiv.innerHTML = `<span>${getDateHeader(messageDateObj)}</span>`;
        feedContainer.appendChild(sepDiv);
        lastDateString = messageDateStr;
        lastUserId = null; 
    }

    const rawMillis = data.timestamp ? data.timestamp.toMillis() : Date.now();
    const timeString = formatMessageTime(messageDateObj);
    const docUserId = data.userId;
    const profile = userProfiles[docUserId] || {};
    const username = profile.username || "Anonymous";
    
    // OBSIDIAN: Default to B&W placeholder if no photo
    const photoURL = profile.profilePhotoURL || `https://placehold.co/32x32/000000/ffffff?text=${username.charAt(0).toUpperCase() || "?"}`;

    const isMine = currentUserId && docUserId === currentUserId;
    const isConsecutive = docUserId && docUserId === lastUserId;
    lastUserId = docUserId;

    // *** USER COLOR LOGIC ***
    const userColor = getUserColor(docUserId);

    const alignWrapper = document.createElement("div");
    alignWrapper.className = `flex w-full ${isMine ? "justify-end" : "justify-start"}`;

    const row = document.createElement("div");
    row.className = "message-wrapper"; 

    const bubble = document.createElement("div");
    bubble.className = `message-bubble rounded-lg max-w-xs sm:max-w-md md:max-w-lg ${isMine ? "my-message" : ""} ${isConsecutive ? "mt-0.5" : "mt-6"}`;
    bubble.dataset.id = docInstance.id;
    bubble.dataset.text = text;
    bubble.dataset.isMine = isMine;
    bubble.dataset.userId = docUserId;
    bubble.dataset.timestamp = rawMillis;

    if (!isMine) {
        bubble.style.borderLeft = `3px solid ${userColor}`;
        bubble.style.background = `linear-gradient(90deg, ${userColor}10, transparent)`;
    }

    if (isSelectionMode && selectedMessages.has(docInstance.id)) bubble.classList.add("selected-message");

    bubble.addEventListener('click', (e) => {
        if (isSelectionMode) {
            e.preventDefault();
            e.stopPropagation();
            handleMessageClick(bubble);
        }
    });

    const kebabBtn = document.createElement("button");
    kebabBtn.className = "kebab-btn";
    kebabBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg>`;
    kebabBtn.addEventListener("click", (e) => showDropdownMenu(e, bubble.dataset));
    bubble.appendChild(kebabBtn);

    // HEADER
    if (!isConsecutive) {
      const headerElement = document.createElement("div");
      headerElement.className = `flex items-center gap-1.5 mb-1 ${isMine ? "justify-end" : "justify-start"}`;
      
      const imgElement = document.createElement("img");
      imgElement.src = photoURL;
      imgElement.className = `chat-pfp ${isMine ? "order-2" : "order-1"}`;
      if (!isMine) imgElement.style.borderColor = userColor;

      const usernameElement = document.createElement("div");
      usernameElement.className = `font-bold text-sm opacity-90 ${isMine ? "order-1 text-right" : "order-2 text-left"}`;
      usernameElement.textContent = username;
      if (!isMine) usernameElement.style.color = userColor;

      // ADMIN BADGE
      if (ADMIN_UIDS.includes(docUserId)) {
          const badge = document.createElement("span");
          badge.className = "admin-badge";
          badge.textContent = "ADMIN";
          if(isMine) {
             badge.style.marginRight = "6px";
             usernameElement.prepend(badge); 
          } else {
             badge.style.marginLeft = "6px";
             usernameElement.appendChild(badge);
          }
      }

      headerElement.appendChild(imgElement);
      headerElement.appendChild(usernameElement);
      bubble.appendChild(headerElement);
    }

    if (data.replyTo) {
      const replyPreview = document.createElement("div");
      replyPreview.className = "reply-preview";
      const replyAuthorEl = document.createElement("div");
      replyAuthorEl.className = "reply-author";
      const replyToProfile = userProfiles[data.replyTo.userId] || {};
      replyAuthorEl.textContent = replyToProfile.username || "Anonymous";
      
      if (!isMine) {
          replyPreview.style.borderLeftColor = userColor;
          replyAuthorEl.style.color = userColor;
      }

      const replyTextEl = document.createElement("div");
      replyTextEl.className = "reply-text";
      replyTextEl.textContent = data.replyTo.text;
      replyPreview.appendChild(replyAuthorEl);
      replyPreview.appendChild(replyTextEl);
      replyPreview.addEventListener("click", () => {
        const originalBubble = document.querySelector(`.message-bubble[data-id="${data.replyTo.messageId}"]`);
        if (originalBubble) {
          originalBubble.scrollIntoView({ behavior: "smooth", block: "center" });
          originalBubble.style.backgroundColor = "rgba(255, 255, 255, 0.1)"; // Obsidian Highlight
          setTimeout(() => { originalBubble.style.backgroundColor = ""; }, 1000);
        }
      });
      bubble.appendChild(replyPreview);
    }

    const textElement = document.createElement("p");
    // FIXED: Always align text to the left
    textElement.className = "text-left";
    textElement.textContent = text;
    bubble.appendChild(textElement);

    const footerDiv = document.createElement("div");
    footerDiv.className = "bubble-footer";
    footerDiv.style.justifyContent = isMine ? "flex-end" : "flex-start";

    const timeElement = document.createElement("span");
    timeElement.className = "inner-timestamp";
    timeElement.dataset.ts = rawMillis;
    timeElement.textContent = timeString;
    if (data.edited) timeElement.textContent += " (edited)";

    footerDiv.appendChild(timeElement);
    bubble.appendChild(footerDiv);

    // ACTIONS
    const replyBtn = document.createElement("button");
    replyBtn.className = "side-action-btn";
    replyBtn.innerHTML = "↩";
    replyBtn.onclick = (e) => { e.stopPropagation(); startReplyMode(bubble.dataset); };

    const reactBtn = document.createElement("button");
    reactBtn.className = "side-action-btn";
    reactBtn.innerHTML = "♡";
    
    const picker = document.createElement("div");
    picker.className = "reaction-picker hidden";
    const docReactions = data.reactions || {};

    Object.entries(REACTION_TYPES).forEach(([rtype, emoji]) => {
      const opt = document.createElement("span");
      opt.className = "reaction-option";
      opt.textContent = emoji;
      opt.onclick = (e) => {
        e.stopPropagation();
        const userIds = docReactions[rtype] || [];
        const hasReacted = userIds.includes(currentUserId);
        toggleReaction(docInstance.id, type, rtype, hasReacted);
        picker.classList.add("hidden");
      };
      picker.appendChild(opt);
    });

    reactBtn.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll(".reaction-picker").forEach(p => p.classList.add("hidden"));
      const rect = reactBtn.getBoundingClientRect();
      picker.style.top = `${rect.top - 60}px`;
      if (window.innerWidth < 640) {
        picker.style.left = "50%";
        picker.style.transform = "translateX(-50%)";
      } else {
        picker.style.left = `${rect.left}px`;
      }
      picker.classList.remove("hidden");
      document.body.appendChild(picker);
    };

    const chipsContainer = document.createElement("div");
    chipsContainer.className = "reaction-chips-container";
    let hasChips = false;
    Object.keys(REACTION_TYPES).forEach(rtype => {
      const userIds = docReactions[rtype] || [];
      if (userIds.length > 0) {
        hasChips = true;
        const chip = document.createElement("div");
        chip.className = "reaction-chip";
        const hasReacted = userIds.includes(currentUserId);
        if (hasReacted) chip.classList.add("user-reacted");
        chip.innerHTML = `${REACTION_TYPES[rtype]} ${userIds.length}`;
        chip.onclick = (e) => {
          e.stopPropagation();
          toggleReaction(docInstance.id, type, rtype, hasReacted);
        };
        chipsContainer.appendChild(chip);
      }
    });

    if (hasChips) {
      bubble.appendChild(chipsContainer);
      bubble.classList.add("has-reactions");
    }

    if (isMine) {
      row.appendChild(reactBtn);
      row.appendChild(replyBtn);
      row.appendChild(bubble);
    } else {
      row.appendChild(bubble);
      row.appendChild(replyBtn);
      row.appendChild(reactBtn);
    }

    alignWrapper.appendChild(row);
    feedContainer.appendChild(alignWrapper);
  });

  const scrollAnchor = document.createElement("div");
  scrollAnchor.id = "scrollAnchor";
  scrollAnchor.style.height = "1px";
  scrollAnchor.style.width = "100%";
  feedContainer.appendChild(scrollAnchor);

  if (bottomObserver) {
    bottomObserver.disconnect();
    bottomObserver.observe(scrollAnchor);
  }

  const lastDoc = docs[docs.length - 1];
  const lastMessageIsMine = lastDoc && lastDoc.data().userId === currentUserId;

  // SCROLL FIX
  const hasNewMessages = snapshot && snapshot.docChanges().some(change => change.type === 'added');
  
  if (hasNewMessages) {
      if (lastMessageIsMine || wasAtBottom) {
          scrollToBottom();
      } else {
          unreadMessages++;
          updateScrollButton();
      }
  } else {
      feedContainer.scrollTop = prevScrollTop;
  }
}

document.addEventListener("click", (e) => {
    if(!e.target.closest(".side-action-btn") && !e.target.closest(".reaction-picker")) {
       document.querySelectorAll(".reaction-picker").forEach(p => p.classList.add("hidden"));
    }
    if (!contextMenu.contains(e.target) && !e.target.closest(".kebab-btn")) {
      hideDropdownMenu();
    }
});

setInterval(() => {
  const timestampElements = document.querySelectorAll('.inner-timestamp');
  timestampElements.forEach(el => {
    const ts = parseInt(el.dataset.ts);
    if (ts > 0) {
      let suffix = el.textContent.includes("(edited)") ? " (edited)" : "";
      el.textContent = formatMessageTime(new Date(ts)) + suffix;
    }
  });
}, 60000);

scrollToBottomBtn.addEventListener("click", scrollToBottom);

// *** COMPULSORY USERNAME CHECK ***
async function postConfession(e) {
  e.preventDefault();
  
  if (currentUsername === "Anonymous") {
      alert("Please set a username before posting!");
      openProfileModal();
      return;
  }

  const text = confessionInput.value.trim();
  if (text && db) {
    await addDoc(confessionsCollection, {
      text: text,
      timestamp: serverTimestamp(),
      userId: currentUserId,
      ...(replyToMessage && { replyTo: { messageId: replyToMessage.id, userId: replyToMessage.userId, text: replyToMessage.text } })
    });
    confessionInput.value = "";
    cancelReplyMode();
    updateTypingStatus(false);
    scrollToBottom();
  }
}

async function postChatMessage(e) {
  e.preventDefault();

  if (currentUsername === "Anonymous") {
      alert("Please set a username before chatting!");
      openProfileModal();
      return;
  }

  const text = chatInput.value.trim();
  if (text && db) {
    await addDoc(chatCollection, {
      text: text,
      timestamp: serverTimestamp(),
      userId: currentUserId,
      ...(replyToMessage && { replyTo: { messageId: replyToMessage.id, userId: replyToMessage.userId, text: replyToMessage.text } })
    });
    chatInput.value = "";
    cancelReplyMode();
    updateTypingStatus(false);
    scrollToBottom();
  }
}

confessionForm.addEventListener("submit", postConfession);
chatForm.addEventListener("submit", postChatMessage);
navConfessions.addEventListener("click", () => showPage("confessions"));
navChat.addEventListener("click", () => showPage("chat"));

profileButton.addEventListener("click", openProfileModal);
modalCloseButton.addEventListener("click", closeProfileModal);
modalSaveButton.addEventListener("click", handleProfileSave);

editModalCancelButton.addEventListener("click", closeEditModal);
editModalSaveButton.addEventListener("click", saveEdit);
confirmModalNoButton.addEventListener("click", closeConfirmModal);

menuEdit.addEventListener("click", () => {
  if (currentContextMenuData) showEditModal(currentContextMenuData.id, currentPage, currentContextMenuData.text);
  hideDropdownMenu();
});

menuDelete.addEventListener("click", () => {
  if (currentContextMenuData) {
    const isMine = currentContextMenuData.isMine === "true";
    showConfirmModal(isMine ? "Delete this message?" : "Delete for me?", isMine, currentContextMenuData.id);
  }
  hideDropdownMenu();
});

menuSelect.addEventListener("click", () => {
  enterSelectionMode();
  hideDropdownMenu();
});

selectionCancel.addEventListener("click", exitSelectionMode);
selectionDelete.addEventListener("click", handleMultiDelete);
cancelReply.addEventListener("click", cancelReplyMode);

confessionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); confessionForm.requestSubmit(confessionButton); }
  else updateTypingStatus(true);
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); chatForm.requestSubmit(chatButton); }
  else updateTypingStatus(true);
});

function startReplyMode(messageData) {
  let repliedUserId = messageData.userId || null;
  if (!repliedUserId && messageData.isMine === "true") repliedUserId = currentUserId;
  replyToMessage = { id: messageData.id, userId: repliedUserId, text: messageData.text };
  const profile = repliedUserId && userProfiles[repliedUserId] ? userProfiles[repliedUserId] : {};
  replyAuthor.textContent = `Replying to ${profile.username || "Anonymous"}`;
  replyText.textContent = replyToMessage.text;
  replyBar.classList.add("show");
  if (currentPage === "chat") chatInput.focus(); else confessionInput.focus();
}

function cancelReplyMode() {
  replyToMessage = null;
  replyBar.classList.remove("show");
}

initFirebase();