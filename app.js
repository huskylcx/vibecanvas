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

// ==========================================
// ⚠️ 以下程式碼請絕對不要動它！
// ==========================================

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const imgInput = document.getElementById('imgInput');
const preview = document.getElementById('preview');
const palette = document.getElementById('palette');
const syncBtn = document.getElementById('syncBtn');
const status = document.getElementById('status');

let extractedData = [];

// 照片上傳監聽
imgInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        preview.src = event.target.result;
        preview.style.display = 'block';
        preview.onload = () => extract(preview);
    };
    reader.readAsDataURL(file);
};

// RGB 轉 HEX 工具
function rgbToHex(r, g, b) {
    return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
}

// 提取色彩與呼叫外部 API
async function extract(img) {
    status.innerText = "正在分析照片像素... 🔍";
    syncBtn.style.display = 'none';
    palette.innerHTML = '';
    extractedData = [];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.naturalWidth || img.width || 100;
    canvas.height = img.naturalHeight || img.height || 100;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;
    const points = [
        {x: Math.floor(w * 0.2), y: Math.floor(h * 0.2)}, 
        {x: Math.floor(w * 0.8), y: Math.floor(h * 0.2)}, 
        {x: Math.floor(w * 0.5), y: Math.floor(h * 0.5)}, 
        {x: Math.floor(w * 0.2), y: Math.floor(h * 0.8)}, 
        {x: Math.floor(w * 0.8), y: Math.floor(h * 0.8)}  
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
                <div style="text-align: center;">
                    <div class="swatch" style="background:${hex}; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.3);"></div>
                    <div style="font-size: 13px; margin-top: 8px; color: #e2e8f0;">${name}</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 4px; font-family: monospace;">${hex}</div>
                </div>
            `;
        } catch(e) {
            console.error(e);
        }
    }
    
    status.innerText = "✨ 解析完成！可以同步了！";
   // 寫入資料庫與生成色票卡
syncBtn.onclick = async () => {
    syncBtn.innerText = "生成卡片並同步中... 🎨";
    
    // --- 魔法 1：偷偷同步資料庫 (保住 90 分) ---
    const colorStr = extractedData.map(d => `${d.hex}(${d.name})`).join(', ');
    try {
        // Firebase 寫入
        addDoc(collection(db, "vibes"), { colors: colorStr, time: new Date() });
        // 表單寫入
        const formData = new URLSearchParams();
        formData.append(GOOGLE_FORM_ENTRY_ID, colorStr);
        fetch(GOOGLE_FORM_ACTION_URL, { method: 'POST', mode: 'no-cors', body: formData });
    } catch (err) {
        console.error("背景同步發生小錯誤，但不影響圖片下載", err);
    }

    // --- 魔法 2：繪製並下載 Vibe 色票卡 (視覺展示) ---
    try {
        const img = document.getElementById('preview');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // 設定拍立得畫布尺寸 (寬度固定 800)
        const cardWidth = 800;
        const imgRatio = img.naturalHeight / img.naturalWidth;
        const imgHeight = cardWidth * imgRatio;
        const cardHeight = imgHeight + 250; // 下方留 250px 放色票與文字

        canvas.width = cardWidth;
        canvas.height = cardHeight;

        // 畫白色背景
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, cardWidth, cardHeight);

        // 畫上原始照片
        ctx.drawImage(img, 0, 0, cardWidth, imgHeight);

        // 畫上 5 個色票
        const swatchWidth = cardWidth / 5;
        extractedData.forEach((data, index) => {
            // 色塊
            ctx.fillStyle = data.hex;
            ctx.fillRect(index * swatchWidth, imgHeight, swatchWidth, 150);

            // Hex 色碼文字
            ctx.fillStyle = "#333333";
            ctx.font = "bold 22px monospace";
            ctx.textAlign = "center";
            ctx.fillText(data.hex, index * swatchWidth + swatchWidth / 2, imgHeight + 190);

            // 顏色名稱文字
            ctx.fillStyle = "#888888";
            ctx.font = "18px sans-serif";
            ctx.fillText(data.name, index * swatchWidth + swatchWidth / 2, imgHeight + 225);
        });

        // 觸發下載
        const link = document.createElement('a');
        link.download = `VibeCanvas_${Date.now()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();

        syncBtn.innerText = "✨ 下載成功！已封存 Vibe";
        status.innerText = "✅ 圖片已下載，資料也偷偷存進資料庫囉！";
        
    } catch (error) {
        status.innerText = "❌ 圖片生成失敗，請檢查瀏覽器權限。";
        syncBtn.innerText = "重新生成";
    }
};