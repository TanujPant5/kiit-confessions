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

const confirmModal = document.getElementById("confirmModal");
const confirmModalText = document.getElementById("confirmModalText");
const confirmModalNoButton = document.getElementById("confirmModalNoButton");
const confirmModalYesButton = document.getElementById("confirmModalYesButton");

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

// Scroll State
let unreadMessages = 0;
let userIsAtBottom = true;
let bottomObserver = null; // New Observer

// The allowed reactions
const REACTION_TYPES = {
  thumbsup: "👍",
  laugh: "😂",
  surprised: "😮",
  heart: "❤️",
};

async function initFirebase() {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    const userCredential = await signInAnonymously(auth);
    currentUserId = userCredential.user.uid;

    listenForUserProfiles();
    await loadUserProfile();

    confessionsCollection = collection(db, "confessions");
    chatCollection = collection(db, "chat");
    typingStatusCollection = collection(db, "typingStatus");

    // Initialize Intersection Observer
    initScrollObserver();

    showPage(currentPage);
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    loading.textContent = "Error: Could not connect to the grid. Refresh page.";
  }
}

// *** NEW: INTERSECTION OBSERVER LOGIC ***
function initScrollObserver() {
  const options = {
    root: feedContainer,
    rootMargin: "100px", // Detect bottom even if slightly above
    threshold: 0.1
  };

  bottomObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      // If the invisible anchor is visible, we are at the bottom
      userIsAtBottom = entry.isIntersecting;
      
      if (userIsAtBottom) {
        // Reset counters immediately
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
    scrollToBottomBtn.style.display = ""; // Clear inline style
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

async function handleProfileSave() {
  if (!db || !currentUserId) return;
  modalSaveButton.textContent = "SAVING...";
  modalSaveButton.disabled = true;
  const newUsername = modalUsernameInput.value.trim() || "Anonymous";
  let newProfilePhotoURL = null;
  if (newUsername && newUsername !== "Anonymous") {
    const firstLetter = newUsername.charAt(0).toUpperCase();
    newProfilePhotoURL = `https://placehold.co/32x32/0a0a1a/00e5ff?text=${firstLetter}`;
  } else {
    newProfilePhotoURL = `https://placehold.co/32x32/00e5ff/0a0a1a?text=?`;
  }

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
      alert(
        "Error: Could not save edit. The 5-minute edit window may have expired."
      );
    }
    editModalSaveButton.textContent = "SAVE";
    editModalSaveButton.disabled = false;
  }
}

function showConfirmModal(callback) {
  deleteCallback = callback;
  confirmModal.classList.add("is-open");
}

function closeConfirmModal() {
  confirmModal.classList.remove("is-open");
  deleteCallback = null;
}

async function handleDelete() {
  if (deleteCallback) {
    confirmModalYesButton.textContent = "DELETING...";
    confirmModalYesButton.disabled = true;
    try {
      await deleteCallback();
    } catch (error) {
      console.error("DELETE FAILED:", error);
    }
    closeConfirmModal();
    confirmModalYesButton.textContent = "DELETE";
    confirmModalYesButton.disabled = false;
  }
}

async function toggleReaction(
  docId,
  collectionName,
  reactionType,
  hasReacted
) {
  if (!db || !currentUserId) return;

  try {
    const docRef = doc(db, collectionName, docId);
    const reactionField = `reactions.${reactionType}`;

    if (hasReacted) {
      await updateDoc(docRef, {
        [reactionField]: arrayRemove(currentUserId),
      });
    } else {
      await updateDoc(docRef, {
        [reactionField]: arrayUnion(currentUserId),
      });
    }
  } catch (error) {
    console.error("Error toggling reaction:", error);
  }
}

function showDropdownMenu(event, data) {
  event.stopPropagation();
  currentContextMenuData = data;

  const now = Date.now();
  const messageTime = parseInt(currentContextMenuData.timestamp, 10);
  const isEditable = now - messageTime < 300000;
  const isMine = currentContextMenuData.isMine === "true";

  menuEdit.style.display = isEditable && isMine ? "block" : "none";
  menuDelete.style.display = isMine ? "block" : "none";

  const rect = event.currentTarget.getBoundingClientRect();
  contextMenu.style.top = `${rect.bottom + 2}px`;
  const menuWidth = contextMenu.offsetWidth || 150;
  contextMenu.style.left = `${rect.right - menuWidth}px`;

  contextMenu.classList.add("is-open");
}

function hideDropdownMenu() {
  contextMenu.classList.remove("is-open");
}

function handleMessageClick(bubble) {
  if (!isSelectionMode) return;

  const docId = bubble.dataset.id;
  const isMine = bubble.dataset.isMine === "true";

  if (!isMine) return;

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
  selectionBar.classList.remove("hidden");
  chatForm.classList.add("hidden");
  confessionForm.classList.add("hidden");

  if (currentContextMenuData) {
    const docId = currentContextMenuData.id;
    selectedMessages.add(docId);
    const bubble = document.querySelector(
      `.message-bubble[data-id="${docId}"]`
    );
    if (bubble) {
      bubble.classList.add("selected-message");
    }
  }
  updateSelectionBar();
}

function exitSelectionMode() {
  isSelectionMode = false;
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

  confirmModalText.textContent = `Are you sure you want to permanently delete these ${count} messages?`;
  showConfirmModal(async () => {
    const batch = writeBatch(db);
    selectedMessages.forEach((docId) => {
      const docRef = doc(db, currentPage, docId);
      batch.delete(docRef);
    });

    await batch.commit();
    exitSelectionMode();
    confirmModalText.textContent =
      "Are you sure you want to permanently delete this message?";
  });
}

function scrollToBottom() {
  feedContainer.scrollTop = feedContainer.scrollHeight;
  userIsAtBottom = true;
  unreadMessages = 0;
  updateScrollButton();
}


function showPage(page) {
  currentPage = page;

  if (isSelectionMode) {
    exitSelectionMode();
  }

  cancelReplyMode();

  unsubscribeConfessions();
  unsubscribeChat();
  unsubscribeTypingStatus();
  typingIndicator.innerHTML = "&nbsp;";
  
  // Reset Scroll State
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
    renderFeed(lastConfessionDocs, "confessions");
    return;
  }
  unsubscribeChat();
  feedContainer.innerHTML =
    '<div id="loading" class="text-center p-4">LOADING CONFESSIONS...</div>';

  const q = query(confessionsCollection, orderBy("timestamp", "asc"));
  unsubscribeConfessions = onSnapshot(
    q,
    (snapshot) => {
      lastConfessionDocs = snapshot.docs;
      renderFeed(lastConfessionDocs, "confessions", snapshot);
    },
    (error) => {
      console.error("Error listening to confessions:", error);
      loading.textContent = "Error loading confessions.";
    }
  );
}

function listenForChat(isRerender = false) {
  if (isRerender) {
    renderFeed(lastChatDocs, "chat");
    return;
  }
  unsubscribeConfessions();
  feedContainer.innerHTML =
    '<div id="loading" class="text-center p-4">LOADING CHAT...</div>';

  const q = query(chatCollection, orderBy("timestamp", "asc"));
  unsubscribeChat = onSnapshot(
    q,
    (snapshot) => {
      lastChatDocs = snapshot.docs;
      renderFeed(lastChatDocs, "chat", snapshot);
    },
    (error) => {
      console.error("Error listening to chat:", error);
      loading.textContent = "Error loading chat.";
    }
  );
}

function listenForTyping() {
  unsubscribeTypingStatus = onSnapshot(
    typingStatusCollection,
    (snapshot) => {
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
      } else if (typingUsers.length === 2) {
        typingIndicator.textContent = `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
      } else {
        typingIndicator.textContent = "Several users are typing...";
      }
    }
  );
}

async function updateTypingStatus(isTyping) {
  if (!db || !currentUserId) return;
  if (typingTimeout) {
    clearTimeout(typingTimeout);
    typingTimeout = null;
  }
  const typingDocRef = doc(db, "typingStatus", currentUserId);
  if (isTyping) {
    await setDoc(typingDocRef, {
      isTyping: true,
      timestamp: Date.now(),
    });
    typingTimeout = setTimeout(() => {
      updateTypingStatus(false);
    }, 3000);
  } else {
    await setDoc(typingDocRef, {
      isTyping: false,
      timestamp: Date.now(),
    });
  }
}

// Helper: Format Date for Headers
function getDateHeader(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Helper: Format Time inside Bubbles
function formatMessageTime(date) {
  const now = new Date();
  const diff = now - date; // milliseconds
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes < 5) {
     if (seconds < 60) return "Just now";
     return `${minutes} mins ago`;
  }
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false 
  });
}


// RENDER FEED
function renderFeed(docs, type, snapshot) {
  // Capture current scroll state
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
    const text = data.text || "...";
    
    // Process Dates
    let messageDateObj = new Date();
    if (data.timestamp) messageDateObj = data.timestamp.toDate();
    const messageDateStr = messageDateObj.toDateString(); 

    // Insert Date Separator
    if (lastDateString !== messageDateStr) {
        const sepDiv = document.createElement('div');
        sepDiv.className = 'date-separator';
        sepDiv.innerHTML = `<span>${getDateHeader(messageDateObj)}</span>`;
        feedContainer.appendChild(sepDiv);
        lastDateString = messageDateStr;
        lastUserId = null; 
    }

    const rawMillis = data.timestamp ? data.timestamp.toMillis() : 0;
    const timeString = formatMessageTime(messageDateObj);
    const docUserId = data.userId;
    const profile = userProfiles[docUserId] || {};
    const username = profile.username || "Anonymous";
    const photoURL =
      profile.profilePhotoURL ||
      `https://placehold.co/32x32/00e5ff/0a0a1a?text=${
        username.charAt(0).toUpperCase() || "?"
      }`;

    const isMine = currentUserId && docUserId === currentUserId;
    const isConsecutive = docUserId && docUserId === lastUserId;
    lastUserId = docUserId;

    // Structure
    const alignWrapper = document.createElement("div");
    alignWrapper.className = `flex w-full ${
      isMine ? "justify-end" : "justify-start"
    }`;

    const row = document.createElement("div");
    row.className = "message-wrapper";

    const bubble = document.createElement("div");
    // GROUPING LOGIC
    bubble.className = `message-bubble rounded-lg max-w-xs sm:max-w-md md:max-w-lg ${
      isMine ? "my-message" : ""
    } ${isConsecutive ? "mt-0.5" : "mt-6"}`;

    bubble.dataset.id = docInstance.id;
    bubble.dataset.text = text;
    bubble.dataset.isMine = isMine;
    bubble.dataset.userId = docUserId;
    bubble.dataset.timestamp = rawMillis;

    if (isSelectionMode && selectedMessages.has(docInstance.id)) {
      bubble.classList.add("selected-message");
    }

    // HEADER (Username)
    if (!isConsecutive) {
      const headerElement = document.createElement("div");
      headerElement.className = `flex items-center gap-1.5 mb-1 ${
        isMine ? "justify-end" : ""
      }`;
      const imgElement = document.createElement("img");
      imgElement.src = photoURL;
      imgElement.className = `chat-pfp ${isMine ? "order-2" : "order-1"}`;
      const usernameElement = document.createElement("div");
      usernameElement.className = `font-bold text-sm opacity-70 ${
        isMine ? "order-1 text-right" : "order-2 text-left"
      }`;
      usernameElement.textContent = username;
      headerElement.appendChild(imgElement);
      headerElement.appendChild(usernameElement);
      bubble.appendChild(headerElement);
    }

    // REPLY PREVIEW
    if (data.replyTo) {
      const replyPreview = document.createElement("div");
      replyPreview.className = "reply-preview";
      const replyAuthorEl = document.createElement("div");
      replyAuthorEl.className = "reply-author";
      const replyToProfile = userProfiles[data.replyTo.userId] || {};
      replyAuthorEl.textContent = replyToProfile.username || "Anonymous";
      const replyTextEl = document.createElement("div");
      replyTextEl.className = "reply-text";
      replyTextEl.textContent = data.replyTo.text;
      replyPreview.appendChild(replyAuthorEl);
      replyPreview.appendChild(replyTextEl);
      replyPreview.addEventListener("click", () => {
        const originalBubble = document.querySelector(
          `.message-bubble[data-id="${data.replyTo.messageId}"]`
        );
        if (originalBubble) {
          originalBubble.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          originalBubble.style.backgroundColor = "rgba(0, 229, 255, 0.3)";
          setTimeout(() => {
            originalBubble.style.backgroundColor = "";
          }, 1000);
        }
      });
      bubble.appendChild(replyPreview);
    }

    // TEXT
    const textElement = document.createElement("p");
    textElement.className = `${isMine ? "text-right" : "text-left"}`;
    textElement.textContent = text;
    bubble.appendChild(textElement);

    // TIMESTAMP + KEBAB
    const timeElement = document.createElement("div");
    timeElement.className = "timestamp text-right";
    if (data.edited) {
      const editedMarker = document.createElement("span");
      editedMarker.className = "edited-marker";
      editedMarker.textContent = "(edited)";
      timeElement.appendChild(editedMarker);
    }
    
    const timeText = document.createElement("span");
    timeText.className = "live-timestamp"; 
    timeText.dataset.ts = rawMillis;
    timeText.textContent = timeString;
    timeElement.appendChild(timeText);
    
    const kebabBtn = document.createElement("button");
    kebabBtn.className = "kebab-btn";
    kebabBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg>`;
    kebabBtn.addEventListener("click", (e) => {
      showDropdownMenu(e, bubble.dataset);
    });
    timeElement.appendChild(kebabBtn);
    bubble.appendChild(timeElement);


    // SIDE BUTTONS
    const replyBtn = document.createElement("button");
    replyBtn.className = "side-action-btn";
    replyBtn.innerHTML = "↩";
    replyBtn.title = "Reply";
    replyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      startReplyMode(bubble.dataset);
    });

    const reactBtn = document.createElement("button");
    reactBtn.className = "side-action-btn";
    reactBtn.innerHTML = "♡";
    reactBtn.title = "Add Reaction";
    
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
      if (window.innerWidth < 640) {
        picker.style.bottom = "auto";
        picker.style.top = `${rect.top - 60}px`;
        picker.style.left = "50%";
        picker.style.transform = "translateX(-50%)";
      } else {
        picker.style.bottom = "auto";
        picker.style.top = `${rect.top - 60}px`;
        picker.style.left = `${rect.left}px`;
        picker.style.transform = "none";
      }
      picker.classList.remove("hidden");
      document.body.appendChild(picker);
    };
    
    feedContainer.addEventListener('scroll', () => picker.classList.add('hidden'), {once: true});

    // Hanging Chips
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

  // *** SCROLL ANCHOR LOGIC ***
  // Add an invisible anchor at the end of the feed
  const scrollAnchor = document.createElement("div");
  scrollAnchor.id = "scrollAnchor";
  scrollAnchor.style.height = "1px";
  scrollAnchor.style.width = "100%";
  feedContainer.appendChild(scrollAnchor);

  // Observe the anchor
  if (bottomObserver) {
    bottomObserver.disconnect();
    bottomObserver.observe(scrollAnchor);
  }

  // Handle Initial Position
  const lastDoc = docs[docs.length - 1];
  const lastMessageIsMine = lastDoc && lastDoc.data().userId === currentUserId;

  if (lastMessageIsMine) {
    scrollToBottom();
  } else if (wasAtBottom) {
    scrollToBottom();
  } else {
    // Restore scroll position to prevent jumping
    feedContainer.scrollTop = prevScrollTop;

    // Check if new "added" messages arrived
    if (snapshot && snapshot.docChanges().some(change => change.type === "added")) {
       unreadMessages++;
       updateScrollButton();
    }
  }
}

// Global listener for picker closing
document.addEventListener("click", (e) => {
    if(!e.target.closest(".side-action-btn") && !e.target.closest(".reaction-picker")) {
       document.querySelectorAll(".reaction-picker").forEach(p => p.classList.add("hidden"));
    }
});

// Update timestamps every minute
setInterval(() => {
  const timestampElements = document.querySelectorAll('.live-timestamp');
  timestampElements.forEach(el => {
    const ts = parseInt(el.dataset.ts);
    if (ts > 0) {
      el.textContent = formatMessageTime(new Date(ts));
    }
  });
}, 60000);

scrollToBottomBtn.addEventListener("click", scrollToBottom);

async function postConfession(e) {
  e.preventDefault();
  const text = confessionInput.value.trim();
  if (text && db) {
    try {
      const messageData = {
        text: text,
        timestamp: serverTimestamp(),
        userId: currentUserId,
      };

      if (replyToMessage) {
        messageData.replyTo = {
          messageId: replyToMessage.id,
          userId: replyToMessage.userId,
          text: replyToMessage.text,
        };
      }

      await addDoc(confessionsCollection, messageData);
      confessionInput.value = "";
      cancelReplyMode();
      updateTypingStatus(false);
      scrollToBottom();
    } catch (error) {
      console.error("Error adding confession: ", error);
    }
  }
}

async function postChatMessage(e) {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text && db) {
    try {
      const messageData = {
        text: text,
        timestamp: serverTimestamp(),
        userId: currentUserId,
      };

      if (replyToMessage) {
        messageData.replyTo = {
          messageId: replyToMessage.id,
          userId: replyToMessage.userId,
          text: replyToMessage.text,
        };
      }

      await addDoc(chatCollection, messageData);
      chatInput.value = "";
      cancelReplyMode();
      updateTypingStatus(false);
      scrollToBottom();
    } catch (error) {
      console.error("Error adding chat message: ", error);
    }
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
confirmModalYesButton.addEventListener("click", handleDelete);

feedContainer.addEventListener("click", (e) => {
  if (!isSelectionMode) return;
  if (e.target.closest(".kebab-btn")) return;

  const bubble = e.target.closest(".message-bubble");
  if (!bubble) return;

  e.preventDefault();
  handleMessageClick(bubble);
});

document.addEventListener(
  "click",
  (e) => {
    if (
      !contextMenu.contains(e.target) &&
      !e.target.closest(".kebab-btn")
    ) {
      hideDropdownMenu();
    }
  },
  true
);

menuEdit.addEventListener("click", () => {
  if (currentContextMenuData) {
    showEditModal(
      currentContextMenuData.id,
      currentPage,
      currentContextMenuData.text
    );
  }
  hideDropdownMenu();
});

menuDelete.addEventListener("click", () => {
  if (currentContextMenuData) {
    const docId = currentContextMenuData.id;
    showConfirmModal(async () => {
      await deleteDoc(doc(db, currentPage, docId));
    });
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
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    confessionForm.requestSubmit(confessionButton);
  } else {
    updateTypingStatus(true);
  }
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit(chatButton);
  } else {
    updateTypingStatus(true);
  }
});

function startReplyMode(messageData) {
  let repliedUserId = messageData.userId || null;
  if (!repliedUserId && messageData.isMine === "true") {
    repliedUserId = currentUserId;
  }

  replyToMessage = {
    id: messageData.id,
    userId: repliedUserId,
    text: messageData.text,
  };

  const profile =
    repliedUserId && userProfiles[repliedUserId]
      ? userProfiles[repliedUserId]
      : {};
  const username = profile.username || "Anonymous";

  replyAuthor.textContent = `Replying to ${username}`;
  replyText.textContent = replyToMessage.text;
  replyBar.classList.add("show");

  if (currentPage === "chat") {
    chatInput.focus();
  } else {
    confessionInput.focus();
  }
}

function cancelReplyMode() {
  replyToMessage = null;
  replyBar.classList.remove("show");
}

initFirebase();