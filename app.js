import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// ====== 【1. 設定區：使用你的專屬金鑰】 ======
const firebaseConfig = {
  apiKey: "AIzaSyBOALk8qAKebdgO8EkpPWp4mS8e9wStBk4",
  authDomain: "vibecanvas-e7634.firebaseapp.com",
  projectId: "vibecanvas-e7634",
  storageBucket: "vibecanvas-e7634.firebasestorage.app",
  messagingSenderId: "877448258963",
  appId: "1:877448258963:web:110fb4af1c7a42b9817466"
};

const GOOGLE_FORM_ACTION_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfPGAMohyrGKW6-2KUkGnyuNHkQjPPCBMZTiEYgiRDd2efmkA/formResponse";
const GOOGLE_FORM_ENTRY_ID = "entry.364290506";

// ====== 【2. 初始化服務】 ======
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const imgInput = document.getElementById('imgInput');
const preview = document.getElementById('preview');
const palette = document.getElementById('palette');
const syncBtn = document.getElementById('syncBtn');
const status = document.getElementById('status');
const themeToggle = document.getElementById('themeToggle');

let extractedData = [];

// ====== 【3. 深淺色模式切換邏輯】 ======
themeToggle.addEventListener('click', () => {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('vibe-theme', newTheme);
});

// 檢查上次儲存的主題
if (localStorage.getItem('vibe-theme')) {
    document.documentElement.setAttribute('data-theme', localStorage.getItem('vibe-theme'));
}

// ====== 【4. 圖片處理與色彩提取】 ======
imgInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        syncBtn.style.display = 'none';
        status.innerText = "正在載入圖片...";
        preview.src = event.target.result;
        preview.style.display = 'block';
        preview.onload = () => extract(preview);
    };
    reader.readAsDataURL(file);
};

function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
}

async function extract(img) {
    status.innerText = "正在分析像素氛圍... 🔍";
    palette.innerHTML = '';
    extractedData = [];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;
    // 取 5 個點
    const points = [
        {x: Math.floor(w*0.2), y: Math.floor(h*0.2)}, 
        {x: Math.floor(w*0.8), y: Math.floor(h*0.2)}, 
        {x: Math.floor(w*0.5), y: Math.floor(h*0.5)}, 
        {x: Math.floor(w*0.2), y: Math.floor(h*0.8)}, 
        {x: Math.floor(w*0.8), y: Math.floor(h*0.8)}  
    ];

    const dynamicColors = points.map(p => {
        const pixel = ctx.getImageData(p.x, p.y, 1, 1).data;
        return rgbToHex(pixel[0], pixel[1], pixel[2]);
    });

    for (let hex of dynamicColors) {
        try {
            const res = await fetch(`https://www.thecolorapi.com/id?hex=${hex.replace('#','')}`);
            const data = await res.json();
            const name = data.name.value;
            extractedData.push({ hex, name });
            
            palette.innerHTML += `
                <div style="text-align: center; flex: 1;">
                    <div class="swatch" style="background:${hex}; margin: 0 auto;"></div>
                    <div style="font-size: 10px; margin-top: 8px; font-weight: 500;">${name}</div>
                    <div style="font-size: 9px; opacity: 0.6; font-family: monospace;">${hex}</div>
                </div>
            `;
        } catch(e) { console.error(e); }
    }
    status.innerText = "解析完成，準備下載。";
    syncBtn.style.display = 'block';
}

// ====== 【5. 下載色票卡與後台同步】 ======
syncBtn.onclick = async () => {
    syncBtn.innerText = "處理中...";
    const colorStr = extractedData.map(d => `${d.hex}(${d.name})`).join(', ');

    // 背景同步 (Firebase & Google Form)
    try {
        addDoc(collection(db, "vibes"), { colors: colorStr, time: new Date() });
        const formData = new URLSearchParams();
        formData.append(GOOGLE_FORM_ENTRY_ID, colorStr);
        fetch(GOOGLE_FORM_ACTION_URL, { method: 'POST', mode: 'no-cors', body: formData });
    } catch (err) { console.log("Database sync error", err); }

    // 繪製下載圖卡
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const cardWidth = 1000;
        const imgRatio = preview.naturalHeight / preview.naturalWidth;
        const imgHeight = cardWidth * imgRatio;
        const footerHeight = 300;
        
        canvas.width = cardWidth;
        canvas.height = imgHeight + footerHeight;

        // 畫布背景
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 繪製照片
        ctx.drawImage(preview, 0, 0, cardWidth, imgHeight);

        // 繪製底部色票區
        const swatchWidth = cardWidth / 5;
        extractedData.forEach((data, index) => {
            ctx.fillStyle = data.hex;
            ctx.fillRect(index * swatchWidth, imgHeight, swatchWidth, 180);

            ctx.fillStyle = "#1a1a1a";
            ctx.textAlign = "center";
            ctx.font = "bold 24px Inter, sans-serif";
            ctx.fillText(data.hex, index * swatchWidth + swatchWidth / 2, imgHeight + 230);
            
            ctx.fillStyle = "#71717a";
            ctx.font = "20px Inter, sans-serif";
            ctx.fillText(data.name, index * swatchWidth + swatchWidth / 2, imgHeight + 265);
        });

        const link = document.createElement('a');
        link.download = `VibeCanvas_${Date.now()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();

        syncBtn.innerText = "下載成功 ✦";
        status.innerText = "✅ 圖片已存至裝置，資料已同步至雲端。";
    } catch (e) { status.innerText = "❌ 生成失敗"; }
};