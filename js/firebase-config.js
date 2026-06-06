// ============================================================
//  Ali Haider Online Birthday Room — Firebase Config & Sync Layer
//  Trio Back Birthday Bash
// ============================================================
//
//  HOW TO CONNECT YOUR OWN FIREBASE (Realtime Database):
//  1. Go to https://console.firebase.google.com
//  2. Create a project -> Build -> Realtime Database -> Create Database
//     (choose "test mode" while celebrating, or set proper rules)
//  3. Project Settings -> General -> Your apps -> Web app -> copy config.
//  4. Paste the values below into FIREBASE_CONFIG.
//  5. Set USE_FIREBASE = true.
//
//  Until then the room runs in LOCAL DEMO MODE using the browser's
//  localStorage + the "storage" event so multiple TABS on the SAME
//  device stay in sync. (Great for previewing the whole flow.)
// ============================================================

const USE_FIREBASE = true; // set to false to force local demo mode

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCoraQFS9RZGskc_DOVIZJTXri-njsEBns",
  authDomain: "ali-birthday-85347.firebaseapp.com",
  // IMPORTANT: Realtime Database URL. If your DB region is the US default the
  // URL is "https://<project-id>-default-rtdb.firebaseio.com". If you created
  // the database in another region (e.g. Europe/Asia) it looks like
  // "https://<project-id>-default-rtdb.<region>.firebasedatabase.app".
  databaseURL: "https://ali-birthday-85347-default-rtdb.firebaseio.com",
  projectId: "ali-birthday-85347",
  storageBucket: "ali-birthday-85347.firebasestorage.app",
  messagingSenderId: "647564949782",
  appId: "1:647564949782:web:f71da39329c0a4e442f837",
  measurementId: "G-096Z9QKY6S"
};

// The single root path everything lives under.
const ROOT = "birthdayRoom";

// ------------------------------------------------------------
//  Sync abstraction: same API whether Firebase or local demo.
//  Methods:
//    DB.ref(path)            -> returns a tiny ref object
//    ref.set(value)
//    ref.update(obj)
//    ref.push(value)         -> returns key
//    ref.on(cb)              -> listen for value changes
//    ref.remove()
//    DB.onReady(cb)
// ------------------------------------------------------------

const DB = (function () {
  let mode = "local";
  let fb = null;          // firebase database instance
  let readyCbs = [];
  let ready = false;

  // ---------- Firebase mode ----------
  function initFirebase() {
    try {
      if (!window.firebase || FIREBASE_CONFIG.apiKey === "REPLACE_ME") {
        return false;
      }
      firebase.initializeApp(FIREBASE_CONFIG);
      fb = firebase.database();
      mode = "firebase";
      return true;
    } catch (e) {
      console.warn("Firebase init failed, falling back to local mode.", e);
      return false;
    }
  }

  // ---------- Local demo mode (localStorage + storage events) ----------
  const LS_KEY = ROOT + "_data";
  const listeners = {}; // path -> [cb]

  function readStore() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function writeStore(obj) {
    localStorage.setItem(LS_KEY, JSON.stringify(obj));
    // notify this tab
    fireLocalListeners(obj);
  }
  function getPath(obj, path) {
    if (!path) return obj;
    const parts = path.split("/").filter(Boolean);
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }
  function setPath(obj, path, value) {
    const parts = path.split("/").filter(Boolean);
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) {
        cur[parts[i]] = {};
      }
      cur = cur[parts[i]];
    }
    if (value === null || value === undefined) {
      delete cur[parts[parts.length - 1]];
    } else {
      cur[parts[parts.length - 1]] = value;
    }
    return obj;
  }
  function fireLocalListeners(store) {
    Object.keys(listeners).forEach((path) => {
      const val = getPath(store, path);
      listeners[path].forEach((cb) => cb(val));
    });
  }

  // cross-tab sync
  window.addEventListener("storage", (e) => {
    if (e.key === LS_KEY) {
      fireLocalListeners(readStore());
    }
  });

  // ---------- Public ref factory ----------
  function makeRef(path) {
    if (mode === "firebase") {
      const r = fb.ref(ROOT + "/" + path);
      return {
        set: (v) => r.set(v),
        update: (o) => r.update(o),
        push: (v) => { const nr = r.push(); nr.set(v); return nr.key; },
        remove: () => r.remove(),
        on: (cb) => r.on("value", (snap) => cb(snap.val())),
        once: (cb) => r.once("value").then((snap) => cb(snap.val())),
        // when this client disconnects (tab close, network drop, phone sleep),
        // Firebase server will automatically write `value` to this path.
        onDisconnectSet: (v) => { try { r.onDisconnect().set(v); } catch (e) {} },
        onDisconnectCancel: () => { try { r.onDisconnect().cancel(); } catch (e) {} },
      };
    }
    // local
    return {
      set: (v) => { const s = readStore(); setPath(s, path, v); writeStore(s); },
      update: (o) => {
        const s = readStore();
        Object.keys(o).forEach((k) => setPath(s, path + "/" + k, o[k]));
        writeStore(s);
      },
      push: (v) => {
        const s = readStore();
        const key = "id_" + Date.now() + "_" + Math.floor(Math.random() * 9999);
        setPath(s, path + "/" + key, v);
        writeStore(s);
        return key;
      },
      remove: () => { const s = readStore(); setPath(s, path, null); writeStore(s); },
      on: (cb) => {
        if (!listeners[path]) listeners[path] = [];
        listeners[path].push(cb);
        cb(getPath(readStore(), path)); // immediate
      },
      once: (cb) => cb(getPath(readStore(), path)),
      // local mode has no real disconnect handling — no-ops
      onDisconnectSet: () => {},
      onDisconnectCancel: () => {},
    };
  }

  // ---------- connection status ----------
  // Calls cb(true/false) whenever the realtime link to the server changes.
  function watchConnection(cb) {
    if (mode === "firebase") {
      try {
        fb.ref(".info/connected").on("value", (snap) => cb(snap.val() === true));
      } catch (e) { cb(false); }
    } else {
      // local demo mode is always "connected" within this device
      setTimeout(() => cb(true), 60);
    }
  }

  function triggerReady() {
    ready = true;
    readyCbs.forEach((cb) => cb(mode));
  }

  // init
  if (USE_FIREBASE && initFirebase()) {
    // firebase ready immediately
    setTimeout(triggerReady, 50);
  } else {
    mode = "local";
    setTimeout(triggerReady, 50);
  }

  return {
    ref: makeRef,
    mode: () => mode,
    onReady: (cb) => { if (ready) cb(mode); else readyCbs.push(cb); },
    watchConnection: watchConnection,
    serverTime: () => Date.now(),
  };
})();
