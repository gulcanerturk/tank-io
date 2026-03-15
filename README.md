# 🎮 Tank.io — Çok Oyunculu

Diep.io tarzı tarayıcı tabanlı çok oyunculu tank oyunu.

## 📁 Dosya Yapısı

```
tank-io/
├── server.js          ← Node.js sunucusu
├── package.json       ← Bağımlılıklar
└── public/
    └── index.html     ← Oyun istemcisi
```

## 🚀 Bilgisayarında Çalıştırma

### 1. Node.js kur
https://nodejs.org adresinden Node.js indir ve kur.

### 2. Bağımlılıkları yükle
```bash
npm install
```

### 3. Sunucuyu başlat
```bash
npm start
```

### 4. Tarayıcıda aç
```
http://localhost:3000
```

Arkadaşlarınla aynı ağdaysan:
```
http://[BİLGİSAYARIN_IP]:3000
```

---

## 🌍 İnternette Yayınlama (Ücretsiz)

### Render.com ile (Önerilen)

1. https://github.com adresinde ücretsiz hesap aç
2. Bu dosyaları bir GitHub reposuna yükle
3. https://render.com adresinde ücretsiz hesap aç
4. "New Web Service" → GitHub repoyu seç
5. Ayarlar:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
6. "Deploy" tıkla → 2-3 dakikada yayında!

### Railway.app ile

1. https://railway.app adresinde GitHub ile giriş yap
2. "New Project" → "Deploy from GitHub repo"
3. Repoyu seç → otomatik deploy

---

## 🎮 Kontroller

| Tuş | Eylem |
|-----|-------|
| WASD / Ok tuşları | Hareket |
| Fare (sol tık) | Ateş et |
| 1-7 | Upgrade satın al |

## ⚔️ Özellikler

- Gerçek zamanlı çok oyunculu (Socket.io)
- 7 farklı upgrade
- Skor tablosu
- Minimap
- Can yenileme
- Şekil toplama (XP)
- Oyuncu öldürme sistemi
