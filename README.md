# 🎂 Ali Haider Online Birthday Room — *Trio Back Birthday Bash*

A private, magical, mobile-first **online birthday room** where 3 friends connect
in real time to celebrate the Birthday Bear 🐻. Cake drop, candle blow, group chat,
Dare Wheel, Trio Compatibility Test, Memory Wall and a Final Fireworks finale —
all synced live across everyone's screens.

> Built for **3 fixed users only** (not a public app):
> | Profile | Emoji | Real name | Role | PIN |
> |---|---|---|---|---|
> | **Panda** | 🐼 | HORIZON | Friend / Host | `111` |
> | **Bear** | 🐻 | Ali Haider | 👑 Birthday Boy | `222` |
> | **Ice Bear** | 🐻‍❄️ | Faiqa | Friend | `333` |

---

## ✨ Features (full flow)

1. **Welcome** → magical dark-purple, stars, balloons, sparkles.
2. **Profile Login** → pick a profile, enter the PIN.
3. **Connecting Lobby** → live "Pending ⏳ / Joined ✅" status for all three.
4. **Celebration Start** → unlocks when all 3 are connected.
5. **Cake Drop** → cake falls + bounces, characters orbit the cake.
6. **Candle Blow** → only **Bear (Ali)** sees *Blow Candles*; others wait; confetti + fireworks for everyone.
7. **Surprise Chat** → friends send birthday wishes, Ali opens the surprise.
8. **Group Chat** → realtime bubbles, emojis, typing indicator, message pop sound.
9. **Main Menu** → hub to all activities.
10. **Dare Wheel 🎡** → turn-based spinning wheel, 20 funny dares, shared result, reactions.
11. **Trio Compatibility Test 🫂** → 20 questions, answers stay hidden until **all 3** answer, then *Reveal Time*.
12. **Memory Wall 🧡** → each writes a memory; revealed together; Ali guesses who wrote each.
13. **Final Fireworks 🎆** → fireworks, confetti, dancing trio, final message.

Plus: 🔊 music/SFX toggle, ♻️ reset-room (replay), 🚪 switch-profile.

### 🔔 Realtime presence & notifications
- **Side slide-chat tab** with a **red blinking dot** when new messages arrive — *only* from the other people (your own messages never notify you).
- **Cross-screen typing/presence banner**: "✍️ Ali is typing in chat… [Open Chat]" so you can jump straight in.
- **"Who's here" glowing emojis** on every feature (Menu cards, Dare Wheel, Compatibility, Memory Wall, chat tab) — the emoji of whoever is currently on that screen glows.
- **Glitch-free chat**: typing / emoji never closes the sheet; keyboard-safe layout using dynamic viewport height.

### 🎆 Final Fireworks ready-check
Only **Panda** sees *Launch Final Fireworks* → it notifies everyone with a full-screen **"Okay, Let's Do It!"** → once **all 3** confirm ready, fireworks fire for everyone, followed by a heartfelt **Trio Back letter** to Ali.

### 📱 Mobile-first & zoom-locked
Pinch-zoom and double-tap zoom are blocked, dynamic viewport units keep everything on-screen with the keyboard open, safe-area insets respected, and nothing gets cut off.

---

## 🚀 Run locally

```bash
# from this folder
python3 -m http.server 8000
# open http://localhost:8000
```

It works **immediately in DEMO mode** (no Firebase needed): open the site in
**multiple browser tabs on the same device** and they stay in sync via the
browser's storage events — perfect for previewing the whole experience.

For real cross-device multiplayer, connect Firebase ↓

---

## 🔥 Connect Firebase (real multiplayer across phones)

1. Go to <https://console.firebase.google.com> → **Add project**.
2. **Build → Realtime Database → Create Database** (start in *test mode* for the party,
   or paste the rules below).
3. **Project settings → General → Your apps → Web app (`</>`)** → copy the config.
4. Open **`js/firebase-config.js`** and paste your values into `FIREBASE_CONFIG`,
   then make sure `USE_FIREBASE = true`.
5. Reload. The top badge will read **`live`** instead of `demo`.

### Suggested Realtime Database rules
Because it's a tiny private 3-person room, simple open rules are fine for the event:

```json
{
  "rules": {
    "birthdayRoom": {
      ".read": true,
      ".write": true
    }
  }
}
```
*(For more safety, lock it down after the birthday or add Firebase Auth.)*

---

## 🌐 Deploy

Any static host works (it's plain HTML/CSS/JS):

- **GitHub Pages** – push and enable Pages on the branch root.
- **Cloudflare Pages / Netlify / Vercel** – point to this folder, no build step.
- **Firebase Hosting** – `firebase init hosting` → `firebase deploy`.

Just remember to fill in `js/firebase-config.js` before deploying for live multiplayer.

---

## 🧪 Tests

A jsdom smoke test covers the full flow (login → lobby → cake → candles → chat →
dare → compatibility reveal → memory wall → data integrity):

```bash
npm install        # installs jsdom (dev only)
node test.js
```

---

## 📁 Structure

```
index.html              # all 13 screens
css/styles.css          # magical theme, glass cards, animations
js/firebase-config.js   # Firebase config + realtime sync layer (with local fallback)
js/data.js              # users, PINs, 20 dares, 20 questions
js/effects.js           # stars, balloons, confetti, fireworks + WebAudio SFX
js/app.js               # all app logic & realtime wiring
test.js                 # jsdom functional smoke test
```

---

Made with 💗 by **Trio Back** — *Birthday Bear, you are officially celebrated 🐻👑*
