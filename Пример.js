import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCwtSgIwcl3WQckITAoovh-U6sqa7bNzT4",
    authDomain: "swemessage-365d6.firebaseapp.com",
    projectId: "swemessage-365d6",
    storageBucket: "swemessage-365d6.firebasestorage.app",
    messagingSenderId: "587168011310",
    appId: "1:587168011310:web:2c2f20eaaf6697417bbbbf"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentChatId = null;
let unsubscribeMessages = null;
let allUsersCache = [];
let myUserData = null;

function generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 6);
}

window.registerUser = async () => {
    const nick = document.getElementById('regNickname').value.trim();
    const email = document.getElementById('emailInput').value;
    const pass = document.getElementById('passwordInput').value;
    const errorMsg = document.getElementById('error-msg');

    if (!nick || !email || !pass) { errorMsg.innerText = "Заполните все поля!"; return; }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const generatedId = generateId();
        await setDoc(doc(db, "users", userCredential.user.uid), { 
            email: email, displayId: nick, publicId: generatedId, createdAt: serverTimestamp(), online: true
        });
    } catch (e) { errorMsg.innerText = "Ошибка: " + e.message; }
};

window.loginUser = async () => {
    const email = document.getElementById('emailInput').value;
    const pass = document.getElementById('passwordInput').value;
    try { await signInWithEmailAndPassword(auth, email, pass); } 
    catch (e) { document.getElementById('error-msg').innerText = "Ошибка: " + e.message; }
};

window.logout = async () => {
    if (auth.currentUser) await updateDoc(doc(db, "users", auth.currentUser.uid), { online: false });
    signOut(auth);
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            myUserData = userDoc.data();
            document.getElementById('my-name-display').innerText = myUserData.displayId;
            document.getElementById('my-id-text').innerText = "ID: " + myUserData.publicId;
            document.getElementById('avatar').innerText = myUserData.displayId.charAt(0).toUpperCase();
            document.getElementById('my-id-text').onclick = () => { navigator.clipboard.writeText(myUserData.publicId); alert("ID скопирован: " + myUserData.publicId); };
            await updateDoc(doc(db, "users", user.uid), { online: true }).catch(()=>{});
        } else {
            const defaultNick = user.email.split('@')[0];
            const generatedId = generateId();
            await setDoc(doc(db, "users", user.uid), { email: user.email, displayId: defaultNick, publicId: generatedId, createdAt: serverTimestamp(), online: true });
            myUserData = { displayId: defaultNick, publicId: generatedId };
            document.getElementById('my-name-display').innerText = defaultNick;
            document.getElementById('my-id-text').innerText = "ID: " + generatedId;
            document.getElementById('avatar').innerText = defaultNick.charAt(0).toUpperCase();
        }
        loadUsers();
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('chat-screen').style.display = 'none';
        if (unsubscribeMessages) unsubscribeMessages();
    }
});

async function loadUsers() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        allUsersCache = [];
        snapshot.forEach((doc) => {
            if (doc.id !== auth.currentUser.uid) {
                allUsersCache.push({ id: doc.id, ...doc.data() });
            }
        });
        renderUsers(allUsersCache);
    });
}

function renderUsers(users) {
    const userList = document.getElementById('user-list');
    userList.innerHTML = "";
    if (users.length === 0) { userList.innerHTML = '<div style="padding:15px;color:#888;text-align:center;">Никого не найдено</div>'; return; }
    users.forEach((user) => {
        const div = document.createElement('div');
        div.className = 'user-item';
        const statusClass = user.online ? 'user-status' : 'user-status offline';
        const statusText = user.online ? 'В сети' : 'Не в сети';
        div.innerHTML = `
            <div style="width:32px;height:32px;border-radius:50%;background:#333;color:white;display:flex;justify-content:center;align-items:center;font-weight:bold;">${user.displayId.charAt(0).toUpperCase()}</div>
            <div class="user-info">
                <div class="user-name">${user.displayId}</div>
                <div class="${statusClass}">${statusText} • ${user.publicId}</div>
            </div>`;
        div.onclick = () => startChat(user.displayId, user.id, div);
        userList.appendChild(div);
    });
}

document.getElementById('search-input').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allUsersCache.filter(u => u.displayId.toLowerCase().includes(term) || u.publicId.toLowerCase().includes(term));
    renderUsers(filtered);
});

function startChat(otherUserNick, otherUserUid, btnElement) {
    document.querySelectorAll('.user-item').forEach(b => b.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');
    currentChatId = [auth.currentUser.uid, otherUserUid].sort().join('_');
    document.getElementById('current-chat-name').innerText = otherUserNick;
    document.getElementById('chat-header').style.display = 'flex';
    document.getElementById('input-area').style.display = 'flex';
    loadMessages();
}

function loadMessages() {
    if (unsubscribeMessages) unsubscribeMessages();
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = "Загрузка...";
    const messagesRef = collection(db, "chats", currentChatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));
    
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        chatBox.innerHTML = "";
        if (snapshot.empty) chatBox.innerHTML = '<div class="empty-chat">Напишите первое сообщение!</div>';
        snapshot.forEach((doc) => {
            const msg = doc.data();
            const isMe = msg.senderId === auth.currentUser.uid;
            const div = document.createElement('div');
            div.className = `msg ${isMe ? 'my' : 'other'}`;
            const nameSpan = document.createElement('span');
            nameSpan.className = 'msg-name';
            nameSpan.textContent = isMe ? 'Вы' : msg.senderName;
            div.appendChild(nameSpan);
            div.appendChild(document.createTextNode(msg.text));
            chatBox.appendChild(div);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

window.sendMessage = async function() {
    if (!currentChatId) return;
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text) return;
    try {
        await addDoc(collection(db, "chats", currentChatId, "messages"), {
            senderId: auth.currentUser.uid, 
            senderName: myUserData ? myUserData.displayId : "Аноним", 
            text: text, 
            createdAt: serverTimestamp()
        });
        input.value = "";
    } catch (e) { alert("Ошибка отправки"); }
};
