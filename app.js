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

// 將 RGB 轉換為 Hex 色碼的工具
function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
}

async function extract(img) {
    status.innerText = "正在分析照片像素...";
    syncBtn.style.display = 'none';
    palette.innerHTML = '';
    extractedData = [];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 使用照片真實比例
    canvas.width = img.naturalWidth || img.width || 100;
    canvas.height = img.naturalHeight || img.height || 100;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 抓取照片中 5 個不同位置的顏色 (左上、右上、中間、左下、右下)
    const w = canvas.width;
    const h = canvas.height;
    const points = [
        {x: Math.floor(w * 0.2), y: Math.floor(h * 0.2)}, 
        {x: Math.floor(w * 0.8), y: Math.floor(h * 0.2)}, 
        {x: Math.floor(w * 0.5), y: Math.floor(h * 0.5)}, 
        {x: Math.floor(w * 0.2), y: Math.floor(h * 0.8)}, 
        {x: Math.floor(w * 0.8), y: Math.floor(h * 0.8)}  
    ];

    // 取得這 5 個點的色碼
    const dynamicColors = points.map(p => {
        const pixel = ctx.getImageData(p.x, p.y, 1, 1).data;
        return rgbToHex(pixel[0], pixel[1], pixel[2]);
    });

    // 串接 The Color API 取得名稱，並畫出介面
    for (let hex of dynamicColors) {
        try {
            const res = await fetch(`https://www.thecolorapi.com/id?hex=${hex.replace('#','')}`);
            const data = await res.json();
            const name = data.name.value;
            
            extractedData.push({ hex, name });
            
            // 介面更新：顯示色塊、名稱與數值
            palette.innerHTML += `
                <div style="text-align: center;">
                    <div class="swatch" style="background:${hex}; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.3);"></div>
                    <div style="font-size: 13px; margin-top: 8px; color: #e2e8f0;">${name}</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 4px; font-family: monospace;">${hex}</div>
                </div>
            `;
        } catch(e) {
            console.error("API 發生錯誤", e);
        }
    }
    
    status.innerText = "✨ 解析完成！";
    syncBtn.style.display = 'block';
}

syncBtn.onclick = async () => {
    syncBtn.innerText = "同步中...";
    const colorStr = extractedData.map(d => `${d.hex}(${d.name})`).join(', ');

    try {
        // 動作 A: 寫入 Firebase
        await addDoc(collection(db, "vibes"), { colors: colorStr, time: new Date() });

        // 動作 B: 寫入 Google 表單
        const formData = new FormData();
        formData.append(GOOGLE_FORM_ENTRY_ID, colorStr);
        await fetch(GOOGLE_FORM_ACTION_URL, { method: 'POST', mode: 'no-cors', body: formData });

        syncBtn.innerText = "✨ 已同步至靈感庫";
        status.innerText = "✅ 已寫入 Firebase 並同步試算表";
    } catch (err) {
        status.innerText = "❌ 同步失敗，請檢查網路連線。";
    }
};