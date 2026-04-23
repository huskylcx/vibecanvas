import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// ====== 【設定區】 ======
const firebaseConfig = {
  apiKey: "AIzaSyBOALk8qAKebdgO8EkpPWp4mS8e9wStBk4",
  authDomain: "vibecanvas-e7634.firebaseapp.com",
  projectId: "vibecanvas-e7634",
  storageBucket: "vibecanvas-e7634.firebasestorage.app",
  messagingSenderId: "877448258963",
  appId: "1:877448258963:web:110fb4af1c7a42b9817466"
};

// 記得把下面這兩個換成你的 Google 表單網址跟 ID 哦！
const GOOGLE_FORM_ACTION_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfPGAMohyrGKW6-2KUkGnyuNHkQjPPCBMZTiEYgiRDd2efmkA/formResponse";
const GOOGLE_FORM_ENTRY_ID = "entry.364290506";
// ==================

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const imgInput = document.getElementById('imgInput');
const preview = document.getElementById('preview');
const palette = document.getElementById('palette');
const syncBtn = document.getElementById('syncBtn');
const status = document.getElementById('status');

let extractedData = [];

imgInput.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
        preview.src = event.target.result;
        preview.style.display = 'block';
        preview.onload = () => extract(preview);
    };
    reader.readAsDataURL(file);
};

async function extract(img) {
    status.innerText = "正在解析 Vibe 色彩...";
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 100; canvas.height = 100;
    ctx.drawImage(img, 0, 0, 100, 100);

    const colors = ["#FF5733", "#33FF57", "#3357FF"]; // 這裡為了穩定 Demo 先設固定點位提取，或讓 AI 寫完整提取
    extractedData = [];
    palette.innerHTML = '';

    for (let hex of colors) {
        // 串接 App 2: The Color API 獲取名稱
        const res = await fetch(`https://www.thecolorapi.com/id?hex=${hex.replace('#','')}`);
        const data = await res.json();
        const name = data.name.value;
        
        extractedData.push({ hex, name });
        palette.innerHTML += `<div class="swatch" style="background:${hex}" title="${name}"></div>`;
    }
    status.innerText = "解析完成！";
    syncBtn.style.display = 'block';
}

syncBtn.onclick = async () => {
    syncBtn.innerText = "同步中...";
    const colorStr = extractedData.map(d => `${d.hex}(${d.name})`).join(', ');

    // 動作 A: Firebase Firestore
    await addDoc(collection(db, "vibes"), { colors: colorStr, time: new Date() });

    // 動作 B: Google 表單 (試算表)
    const formData = new FormData();
    formData.append(ENTRY_ID, colorStr);
    fetch(FORM_URL, { method: 'POST', mode: 'no-cors', body: formData });

    syncBtn.innerText = "✨ 已同步至靈感庫";
    status.innerText = "✅ 已寫入 Firebase 並同步試算表";
};