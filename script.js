
const API = 'https://api.mail.tm';
let account = null;
let expiryTime = parseInt(localStorage.getItem('expiryTime')) || (Date.now() + 600000);
const totalTime = 600000;

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');

    while (container.children.length >= 3) {
        container.removeChild(container.firstChild);
    }

    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-emerald-600' : 'bg-blue-600';

    toast.className = `toast ${bgColor} text-white px-6 py-3 rounded-xl shadow-2xl text-sm font-semibold flex items-center gap-3 min-w-[220px]`;
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode === container) {
            toast.classList.add('fade-out');
            setTimeout(() => {
                if (toast.parentNode === container) toast.remove();
            }, 500);
        }
    }, 3000);
}

async function fetchAPI(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (account?.token) headers['Authorization'] = `Bearer ${account.token}`;
    try {
        const res = await fetch(`${API}${endpoint}`, { ...options, headers });
        if (res.status === 401) {
            localStorage.clear();
            window.location.reload();
            return null;
        }
        return res;
    } catch (e) { return null; }
}

async function init() {
    const savedAccount = localStorage.getItem('mailAccount');
    if (savedAccount) {
        account = JSON.parse(savedAccount);
        const res = await fetchAPI('/messages');
        if (res) {
            document.getElementById('emailAddr').value = account.address;
            startTimer();
            checkInbox();
        }
    } else { await createAccount(); }
}

async function createAccount() {
    const domainRes = await fetch(`${API}/domains`);
    const domains = await domainRes.json();
    const domain = domains['hydra:member'][0].domain;
    const email = `swift_${Math.random().toString(36).substring(7)}@${domain}`;
    const password = 'pwd' + Math.random().toString(36).substring(5);

    await fetch(`${API}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: email, password })
    });

    const tokenRes = await fetch(`${API}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: email, password })
    });

    const data = await tokenRes.json();
    account = { address: email, token: data.token };
    expiryTime = Date.now() + totalTime;
    localStorage.setItem('mailAccount', JSON.stringify(account));
    localStorage.setItem('expiryTime', expiryTime);
    document.getElementById('emailAddr').value = email;
    startTimer();
    showToast("Secure session initialized", "success");
}

function startTimer() {
    clearInterval(window.timerInterval);
    window.timerInterval = setInterval(() => {
        const diff = expiryTime - Date.now();
        if (diff <= 0) return changeEmail();
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        document.getElementById('countdown').innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        document.getElementById('timerBar').style.width = (diff / totalTime * 100) + '%';
    }, 1000);
}

async function checkInbox() {
    const res = await fetchAPI('/messages');
    if (!res) return;
    const data = await res.json();
    const list = document.getElementById('mailList');
    const messages = data['hydra:member'];
    if (messages.length > 0) {
        list.innerHTML = messages.map(m => `
                    <div onclick="readMail('${m.id}')" class="p-3 rounded-lg bg-slate-800/40 hover:bg-blue-600/20 cursor-pointer border border-slate-700 transition group">
                        <div class="text-[10px] font-bold truncate text-slate-100 group-hover:text-blue-400">${m.from.address}</div>
                        <div class="text-[9px] text-slate-500 truncate">${m.subject}</div>
                    </div>`).join('');
    }
}

async function readMail(id) {
    const res = await fetchAPI(`/messages/${id}`);
    if (!res) return;
    const data = await res.json();
    document.getElementById('mailHeader').classList.remove('hidden');
    document.getElementById('subjectTitle').innerText = data.subject;
    document.getElementById('senderInfo').innerText = `From: ${data.from.address}`;
    document.getElementById('mailBody').innerHTML = `
                <div class="bg-white text-black p-6 rounded-xl shadow-xl leading-relaxed">
                    ${data.html || `<pre class="whitespace-pre-wrap font-sans">${data.text || data.intro}</pre>`}
                </div>`;

    const attachArea = document.getElementById('attachmentArea');
    if (data.attachments?.length > 0) {
        attachArea.classList.remove('hidden');
        attachArea.innerHTML = data.attachments.map(f => `
                    <a href="${API}${f.downloadUrl}" target="_blank" class="bg-blue-600/20 border border-blue-500/30 px-3 py-1.5 rounded text-[10px] text-blue-300 transition hover:bg-blue-600/40">
                        Download ${f.filename}
                    </a>`).join('');
    } else { attachArea.classList.add('hidden'); }
}

function closeMail() {
    document.getElementById('mailHeader').classList.add('hidden');
    document.getElementById('attachmentArea').classList.add('hidden');
    document.getElementById('mailBody').innerHTML = `<div class="h-full flex items-center justify-center text-slate-700 italic non-selectable">Select an email to read</div>`;
}

function extendTime() {
    expiryTime = Date.now() + totalTime;
    localStorage.setItem('expiryTime', expiryTime);
    showToast("Session extended +10m", "info");
}

function copyEmail() {
    const el = document.getElementById("emailAddr");
    el.select();
    document.execCommand("copy");
    showToast("Address copied!", "success");
}

function changeEmail() {
    localStorage.clear();
    window.location.reload();
}

init();
setInterval(checkInbox, 5000);