# ShadowChat

A real-time chat application hidden inside a fully functional unit converter.

## 🔢 What it looks like
A clean, modern **unit converter** (UniConvert) that supports Length, Weight, Temperature, Volume, Speed and Area conversions.

## 💬 What it actually is
A **secret real-time chat** with self-destructing messages, powered by Firebase.

## 🔐 How to access the hidden chat

| Platform | Secret Sequence |
|----------|----------------|
| **Desktop** | Type `shadow` on your keyboard (outside any input field) |
| **Mobile** | Tap the converter logo **5 times** rapidly |

## Features

- 🔢 **Fully functional unit converter** as camouflage
- 💬 **Real-time chat** with Firebase Realtime Database
- 💣 **Self-destructing messages** (1min, 5min, 15min, 1hr, 24hr)
- 🔐 **Email/password authentication** with Firebase Auth
- ⚡ **Panic button** — instantly returns to the converter
- 👻 **Zero visual clues** — no one can tell the chat exists
- 📱 **Responsive** — works on mobile and desktop

## Setup

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/shadowchat.git
cd shadowchat
```

### 2. Configure Firebase
1. Create a project at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Email/Password Authentication**
3. Create a **Realtime Database**
4. Register a **Web App** and copy the config
5. Paste your credentials in `src/firebase.js`

### 3. Run locally
You need any HTTP server (ES modules require it). Examples:

**Python:**
```bash
python -m http.server 3000
```

**Node.js:**
```bash
npx serve .
```

**PowerShell (Windows):**
```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Then open `http://localhost:3000`

## Tech Stack

- Vanilla HTML/CSS/JS (no framework, no bundler)
- Firebase Auth + Realtime Database (via CDN)
- CSS Glassmorphism + micro-animations
- Inter font (Google Fonts)

## License

MIT
