// ============================================================
//  Ali Haider Online Birthday Room — Main App Logic
//  Trio Back Birthday Bash
// ============================================================

(function () {
  "use strict";

  // ---------- session ----------
  let ME = null; // user key: panda/bear/icebear
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // ---------- screen routing ----------
  const SCREENS = {
    welcome: "screen-welcome", login: "screen-login", lobby: "screen-lobby",
    celebration: "screen-celebration", cake: "screen-cake", surprise: "screen-surprise",
    menu: "screen-menu", dare: "screen-dare", compat: "screen-compat",
    memory: "screen-memory", fireworks: "screen-fireworks",
  };
  let currentScreenName = "welcome";
  function show(name) {
    const changed = name !== currentScreenName;
    $$(".screen").forEach((s) => s.classList.remove("active"));
    const el = document.getElementById(SCREENS[name]);
    if (el) el.classList.add("active");
    try { window.scrollTo(0, 0); } catch (e) {}
    currentScreenName = name;
    // broadcast my location (for "who is here" glows + presence) only on change
    if (ME && changed) DB.ref(`users/${ME}/screen`).set(name);
    // re-evaluate the final-fireworks call banner for the new screen
    try { renderFireworksCall(fireworksCache); } catch (e) {}
  }

  // cache of all users' live state (online/typing/screen)
  let usersCache = {};

  // ---------- mutable state (declared early to avoid TDZ in immediate listeners) ----------
  let chatOpen = false;
  let unseenCount = 0;          // messages from OTHERS not yet seen
  let chatInitialised = false;  // ignore the first DB snapshot for notifications
  let knownMsgIds = {};         // ids we've already rendered
  let fwShown = false;
  let cakeReady = false;
  let wheelRotation = 0;
  let compatOptionsBuilt = -1;
  let revealShown = -1;
  let seenReactions = {};
  let typingTimer = null;
  let pinTarget = null;
  let isConnected = false;
  let lastResetAt = null;        // tracks room restores so all clients refresh
  let resetInitialised = false;  // ignore the first resetAt snapshot on boot
  let fireworksCache = null;     // latest fireworks state (for the call banner)

  // ---------- dynamic viewport height (mobile keyboard / address bar safe) ----------
  function setVH() {
    document.documentElement.style.setProperty("--vh", (window.innerHeight * 0.01) + "px");
  }
  setVH();
  window.addEventListener("resize", setVH);
  window.addEventListener("orientationchange", () => setTimeout(setVH, 300));

  // ---------- block pinch / double-tap zoom (extra safety beyond meta) ----------
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
  let lastTouch = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouch < 300) e.preventDefault();
    lastTouch = now;
  }, { passive: false });

  // ============================================================
  //  INIT
  // ============================================================
  FX.spawnStars();
  FX.spawnSparkles();
  FX.spawnBalloons();

  DB.onReady((mode) => {
    $("#mode-badge").textContent = mode === "firebase" ? "live" : "demo";
    bootListeners();
    watchConnection();
    restoreSession();
  });

  // ---------- Trio server connection badge ----------
  function watchConnection() {
    DB.watchConnection((online) => {
      isConnected = online;
      const badge = $("#conn-badge");
      const txt = $("#conn-text");
      badge.classList.remove("online", "offline");
      if (online) {
        badge.classList.add("online");
        txt.textContent = "Trio Connected";
        // (re)assert my presence + disconnect hooks whenever we reconnect
        if (ME) registerPresence();
      } else {
        badge.classList.add("offline");
        txt.textContent = "Reconnecting…";
      }
    });
  }

  // Mark me online now, and tell the server to auto-mark me offline / out-of-chat
  // the moment my connection drops (tab close, app minimize on mobile, network loss).
  function registerPresence() {
    if (!ME) return;
    DB.ref(`users/${ME}`).update({ online: true });
    DB.ref(`users/${ME}/online`).onDisconnectSet(false);
    DB.ref(`users/${ME}/typing`).onDisconnectSet(false);
    DB.ref(`users/${ME}/inChat`).onDisconnectSet(false);
  }

  // ---------- update the "who am I" top badge ----------
  function updateMeBadge() {
    const badge = $("#me-badge");
    if (ME && USERS[ME]) {
      $("#me-emoji").textContent = USERS[ME].emoji;
      $("#me-name").textContent = USERS[ME].short;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  // ---------- trio join/presence strip (under the connection badge) ----------
  // Shows each member's status: ✅ online, 🟡 joined-but-away, ⏳ not joined yet.
  function renderTrioStrip() {
    const strip = $("#trio-strip");
    if (!strip) return;
    if (!ME) { strip.classList.add("hidden"); return; }
    strip.classList.remove("hidden");
    USER_ORDER.forEach((k) => {
      const el = strip.querySelector(`.trio-member[data-user="${k}"]`);
      if (!el) return;
      const u = usersCache[k] || {};
      const stateEl = el.querySelector(".tm-state");
      el.classList.remove("online", "away", "pending");
      if (u.online) { el.classList.add("online"); stateEl.textContent = "✅"; }
      else if (u.joined) { el.classList.add("away"); stateEl.textContent = "🟡"; }
      else { el.classList.add("pending"); stateEl.textContent = "⏳"; }
    });
  }

  function restoreSession() {
    // use localStorage (NOT sessionStorage) so login survives the mobile
    // browser being closed / killed / minimized — otherwise users get sent
    // back to the profile + PIN page every time.
    const saved = localStorage.getItem("me") || sessionStorage.getItem("me");
    if (saved && USERS[saved]) {
      ME = saved;
      afterLogin(true);
    } else {
      show("welcome");
    }
  }

  // ============================================================
  //  WELCOME
  // ============================================================
  $("#btn-enter").addEventListener("click", () => {
    Sound.play("sparkle");
    FX.confetti(40);
    show("login");
  });

  // ============================================================
  //  LOGIN + PIN
  // ============================================================
  // pinTarget declared above
  $$(".profile-card").forEach((card) => {
    card.addEventListener("click", () => {
      pinTarget = card.dataset.user;
      const u = USERS[pinTarget];
      $("#pin-emoji").textContent = u.emoji;
      $("#pin-title").textContent = `${u.short} (${u.name})`;
      $("#pin-input").value = "";
      $("#pin-msg").textContent = "";
      $("#pin-msg").className = "pin-msg";
      $("#pin-modal").classList.remove("hidden");
      setTimeout(() => $("#pin-input").focus(), 100);
    });
  });
  $("#pin-close").addEventListener("click", () => $("#pin-modal").classList.add("hidden"));
  $("#pin-submit").addEventListener("click", submitPin);
  $("#pin-input").addEventListener("keydown", (e) => { if (e.key === "Enter") submitPin(); });

  function submitPin() {
    const u = USERS[pinTarget];
    const val = $("#pin-input").value.trim();
    if (val === u.pin) {
      $("#pin-msg").textContent = `Welcome ${u.short} ${u.emoji}`;
      $("#pin-msg").className = "pin-msg ok";
      Sound.play("win");
      ME = pinTarget;
      localStorage.setItem("me", ME);   // persist login across app restarts
      sessionStorage.setItem("me", ME);
      setTimeout(() => { $("#pin-modal").classList.add("hidden"); afterLogin(false); }, 700);
    } else {
      $("#pin-msg").textContent = "Oops! Wrong PIN 😭";
      $("#pin-msg").className = "pin-msg err";
      $("#pin-input").value = "";
    }
  }

  function afterLogin(restored) {
    // mark joined / online in DB
    DB.ref(`users/${ME}`).update({
      name: USERS[ME].name, emoji: USERS[ME].emoji,
      joined: true, online: true, typing: false, inChat: false, screen: "lobby",
    });
    // server-side auto-offline on disconnect (reliable on mobile minimize)
    registerPresence();
    updateMeBadge();
    // mark offline when leaving (best-effort, in addition to onDisconnect)
    window.addEventListener("beforeunload", () => {
      try {
        DB.ref(`users/${ME}/online`).set(false);
        DB.ref(`users/${ME}/typing`).set(false);
        DB.ref(`users/${ME}/inChat`).set(false);
      } catch (e) {}
    });
    $("#logout-btn").classList.remove("hidden");
    // reset / restore is admin-only (Haris = Panda / HORIZON)
    if (ME === ADMIN_USER) $("#reset-btn").classList.remove("hidden");
    else $("#reset-btn").classList.add("hidden");
    // jump to wherever the trio currently is
    syncToSharedScreen();
  }

  // Land the user wherever the trio currently is (used on login AND on
  // resume from a minimized browser so you never get "stuck" out of sync).
  function syncToSharedScreen() {
    if (!ME) return;
    DB.ref("state/currentScreen").once((cs) => {
      const GAME_SCREENS = ["dare", "compat", "memory"];
      const LIVE = ["celebration","cake","surprise","menu","fireworks"];
      // If the celebration is already live somewhere, follow it.
      if (cs && GAME_SCREENS.includes(cs)) {
        if (!GAME_SCREENS.includes(currentScreenName) && currentScreenName !== "menu") show("menu");
      } else if (cs && LIVE.includes(cs)) {
        if (cs !== currentScreenName) routeShared(cs);
      } else {
        // not started yet -> the LOBBY is the join/waiting room.
        // Never leave a logged-in user stuck on welcome/login.
        if (["welcome","login"].includes(currentScreenName) || !currentScreenName) {
          show("lobby");
        }
      }
      checkAllJoined();
    });
  }

  // Mobile browsers (Chrome/Safari) freeze JS & may drop the socket when
  // minimized. When we come back, re-assert presence and re-sync the screen.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && ME) {
      registerPresence();
      syncToSharedScreen();
    }
  });
  window.addEventListener("focus", () => {
    if (ME) registerPresence();
  });

  $("#logout-btn").addEventListener("click", () => {
    if (ME) {
      // cancel the auto-offline hooks before intentionally going offline
      DB.ref(`users/${ME}/online`).onDisconnectCancel();
      DB.ref(`users/${ME}`).update({ online: false, typing: false, inChat: false });
    }
    localStorage.removeItem("me");
    sessionStorage.removeItem("me");
    ME = null;
    $("#logout-btn").classList.add("hidden");
    updateMeBadge();
    renderTrioStrip();
    show("welcome");
  });

  // Full logout used by RESTORE: clears stored login so the user must pick a
  // profile + re-enter their PIN and come back online from scratch.
  function forceLogout() {
    try {
      if (ME) {
        DB.ref(`users/${ME}/online`).onDisconnectCancel();
        // mark me logged-out in the DB so others see me as not-joined again
        DB.ref(`users/${ME}`).update({ joined: false, online: false, typing: false, inChat: false });
      }
    } catch (e) {}
    localStorage.removeItem("me");
    sessionStorage.removeItem("me");
    ME = null;
    // reset transient local flags
    cakeReady = false; revealShown = -1; compatOptionsBuilt = -1; seenReactions = {};
    fwShown = false; chatInitialised = false; knownMsgIds = {}; unseenCount = 0;
    // small delay lets the DB writes flush, then hard reload -> boots to the
    // welcome / profile-login screen (no auto-restore, must re-enter PIN).
    setTimeout(() => location.reload(), 250);
  }

  // ============================================================
  //  SHARED STATE LISTENERS
  // ============================================================
  function bootListeners() {
    // lobby join status
    USER_ORDER.forEach((key) => {
      DB.ref(`users/${key}/joined`).on((joined) => updateLobbyCard(key, !!joined));
    });

    // shared current screen — only FORCE the linear celebration flow.
    // Games (dare / compat / memory) are opt-in: others see a "join" banner +
    // the who-is-here glow on the menu card instead of being yanked in.
    DB.ref("state/currentScreen").on((cs) => {
      if (!ME || !cs) return;
      if (cs === "menu") return;            // menu is a hub, don't force
      if (cs === currentScreenName) return; // already there (prevents loops)
      if (["cake","surprise","fireworks","celebration"].includes(cs)) {
        routeShared(cs);
      }
    });

    DB.ref("state/candlesBlown").on((v) => { if (v) onCandlesBlown(); });

    // room restore: when the admin restores, EVERYONE is fully logged out and
    // must re-enter their PIN + go online again (fresh start for the whole trio).
    // Seed from localStorage so a reload right after a restore never re-fires it.
    try { lastResetAt = localStorage.getItem("lastResetAt") || null; } catch (e) {}
    DB.ref("state/resetAt").on((v) => {
      const vs = v == null ? null : String(v);
      if (!resetInitialised) { resetInitialised = true; if (vs) lastResetAt = vs; return; }
      if (vs && vs !== lastResetAt) {
        lastResetAt = vs;
        // remember this reset so we don't re-trigger after the reload
        try { localStorage.setItem("lastResetAt", vs); } catch (e) {}
        forceLogout();
      }
    });

    // one listener for ALL user state -> presence, typing, who-is-here glows
    DB.ref("users").on((users) => {
      usersCache = users || {};
      renderPresence();
      renderTyping();
      renderHereGlows();
      renderTrioStrip();
      // keep the lobby join button (dim/glow) in sync live
      if (currentScreenName === "lobby") checkAllJoined();
      // keep the final-fireworks call banner's "pending" list fresh
      renderFireworksCall(fireworksCache);
    });

    // chat
    DB.ref("chat").on(renderChat);

    // reactions
    DB.ref("reactions").on(handleReactions);

    // dare wheel
    DB.ref("games/dareWheel").on(renderDare);

    // compatibility
    DB.ref("games/compatibility").on(renderCompat);

    // memory wall
    DB.ref("games/memoryWall").on(renderMemory);

    // fireworks finale
    DB.ref("games/fireworks").on(renderFireworks);
  }

  function routeShared(cs) {
    if (cs === "cake") { show("cake"); setupCakeScreen(); }
    else if (cs === "surprise") { show("surprise"); setupSurprise(); }
    else if (cs === "menu") show("menu");
    else if (cs === "dare") show("dare");
    else if (cs === "compat") show("compat");
    else if (cs === "memory") show("memory");
    else if (cs === "fireworks") { show("fireworks"); fwShown = false; ensureFireworksInit(); }
    else if (cs === "celebration") show("celebration");
  }

  // ============================================================
  //  LOBBY
  // ============================================================
  function updateLobbyCard(key, joined) {
    const card = document.querySelector(`.lobby-card[data-user="${key}"]`);
    if (!card) return;
    const status = card.querySelector(".lobby-status");
    if (joined) { card.classList.add("joined"); status.textContent = "Joined ✅"; }
    else { card.classList.remove("joined"); status.textContent = "Pending ⏳"; }
    checkAllJoined();
  }
  function checkAllJoined() {
    DB.ref("users").once((users) => {
      users = users || {};
      const joinedKeys = USER_ORDER.filter((k) => users[k] && users[k].joined);
      const count = joinedKeys.length;
      const all = count === USER_ORDER.length;
      const btn = $("#btn-go-celebration");

      // live "x / 3 joined" counter
      const cnt = $("#lobby-count");
      if (cnt) cnt.textContent = `${count} / ${USER_ORDER.length} joined`;

      // who is still pending?
      const pending = USER_ORDER.filter((k) => !(users[k] && users[k].joined))
        .map((k) => `${USERS[k].short} ${USERS[k].emoji}`);
      const hint = $("#lobby-hint");

      if (all) {
        $("#lobby-all").classList.remove("hidden");
        if (hint) hint.classList.add("hidden");
        // glow + enable the dashboard button
        btn.classList.remove("hidden", "btn-locked");
        btn.classList.add("btn-glow-ready");
        btn.disabled = false;
        btn.textContent = "Enter Main Dashboard ✨ (tap)";
      } else {
        $("#lobby-all").classList.add("hidden");
        if (hint) {
          hint.classList.remove("hidden");
          hint.textContent = pending.length
            ? `Waiting for ${pending.join(", ")} to join…`
            : "Waiting for everyone to join…";
        }
        // dim + locked
        btn.classList.remove("hidden", "btn-glow-ready");
        btn.classList.add("btn-locked");
        btn.disabled = true;
        btn.textContent = "Enter Main Dashboard 🔒";
      }
    });
  }
  $("#btn-go-celebration").addEventListener("click", () => {
    if ($("#btn-go-celebration").disabled) return; // guard while locked
    DB.ref("state").update({ currentScreen: "celebration" });
    show("celebration"); routeShared("celebration");
  });

  // ============================================================
  //  CELEBRATION START
  // ============================================================
  $("#btn-celebrate").addEventListener("click", () => {
    Sound.play("cake"); FX.confetti(80);
    DB.ref("state").update({ celebrationStarted: true, currentScreen: "cake" });
  });

  // ============================================================
  //  CAKE + CANDLES
  // ============================================================
  // cakeReady declared above
  function setupCakeScreen() {
    if (cakeReady) return; cakeReady = true;
    Sound.play("cake");
    // after drop animation, decide buttons
    setTimeout(() => {
      DB.ref("state/candlesBlown").once((blown) => {
        if (blown) { onCandlesBlown(); return; }
        if (ME === "bear") {
          $("#btn-blow").classList.remove("hidden");
          $("#cake-wait").classList.add("hidden");
        } else {
          $("#btn-blow").classList.add("hidden");
          $("#cake-wait").classList.remove("hidden");
        }
      });
    }, 1600);
  }
  $("#btn-blow").addEventListener("click", () => {
    Sound.play("blow");
    DB.ref("state").update({ candlesBlown: true });
  });

  function onCandlesBlown() {
    const cake = document.querySelector(".cake");
    if (cake) cake.classList.add("blown");
    $("#btn-blow").classList.add("hidden");
    $("#cake-wait").classList.add("hidden");
    Sound.play("blow");
    setTimeout(() => {
      Sound.play("confetti");
      FX.confetti(220); FX.ribbonsFall();
      FX.firework(window.innerWidth*0.3, window.innerHeight*0.3);
      FX.firework(window.innerWidth*0.7, window.innerHeight*0.35);
      $("#bday-text").classList.remove("hidden");
      $("#bday-sub").classList.remove("hidden");
      $("#btn-after-cake").classList.remove("hidden");
    }, 600);
  }
  $("#btn-after-cake").addEventListener("click", () => {
    DB.ref("state").update({ currentScreen: "surprise" });
    show("surprise"); setupSurprise();
  });

  // ============================================================
  //  SURPRISE CHAT UNLOCK
  // ============================================================
  function setupSurprise() {
    if (ME === "bear") {
      $("#surprise-bear").classList.remove("hidden");
      $("#surprise-friend").classList.add("hidden");
    } else {
      $("#surprise-friend").classList.remove("hidden");
      $("#surprise-bear").classList.add("hidden");
    }
  }
  $("#btn-send-bday").addEventListener("click", () => {
    sendChat(`Happy Birthday Ali Haider 🎂🥳`);
    $("#friend-sent-msg").textContent = "Sent! Chat is now open 💗";
    $("#btn-send-bday").disabled = true;
    DB.ref("state").update({ chatUnlocked: true });
    Sound.play("pop");
    // open chat right away so the wish is visible, then reveal menu button
    setTimeout(() => {
      openChat();
      $("#btn-go-menu").classList.remove("hidden");
    }, 250);
  });
  $("#btn-open-surprise").addEventListener("click", () => {
    DB.ref("state").update({ chatUnlocked: true });
    openChat();
    $("#btn-go-menu").classList.remove("hidden");
  });
  $("#btn-go-menu").addEventListener("click", () => {
    closeChat();
    DB.ref("state").update({ currentScreen: "menu" });
    show("menu");
  });

  // ============================================================
  //  MAIN MENU
  // ============================================================
  $$(".menu-card").forEach((c) => {
    c.addEventListener("click", () => {
      const go = c.dataset.go;
      Sound.play("pop");
      if (go === "chat") { show("menu"); openChat(); return; }
      // fireworks is part of the shared finale -> force everyone in.
      // games are opt-in -> just navigate myself (presence glow invites others).
      if (go === "fireworks") {
        DB.ref("state").update({ currentScreen: go, currentGame: go });
      } else {
        DB.ref("state").update({ currentGame: go });
      }
      show(go);
      if (go === "dare") ensureDareInit();
      if (go === "compat") ensureCompatInit();
      if (go === "memory") ensureMemoryInit();
      if (go === "fireworks") { fwShown = false; ensureFireworksInit(); }
    });
  });
  $$(".back-btn").forEach((b) => b.addEventListener("click", () => {
    DB.ref("state").update({ currentScreen: "menu" });
    show("menu");
  }));

  // ============================================================
  //  DARE WHEEL
  // ============================================================
  const wheelEl = $("#wheel");
  function buildWheel() {
    const seg = 360 / WHEEL_COLORS.length;
    let grad = "conic-gradient(";
    WHEEL_COLORS.forEach((col, i) => {
      grad += `${col} ${i*seg}deg ${(i+1)*seg}deg${i < WHEEL_COLORS.length-1 ? "," : ""}`;
    });
    grad += ")";
    wheelEl.style.background = grad;
  }
  buildWheel();
  // wheelRotation declared above

  function ensureDareInit() {
    DB.ref("games/dareWheel").once((d) => {
      if (!d || !d.currentTurn) {
        DB.ref("games/dareWheel").set({ currentTurn: "panda", spinning: false, result: "", completedTurn: false });
      }
    });
  }

  $("#btn-spin").addEventListener("click", () => {
    DB.ref("games/dareWheel").once((d) => {
      if (!d || d.currentTurn !== ME || d.spinning) return;
      const idx = Math.floor(Math.random() * DARES.length);
      Sound.play("spin");
      DB.ref("games/dareWheel").update({ spinning: true, result: "", completedTurn: false, resultIndex: idx });
      setTimeout(() => {
        DB.ref("games/dareWheel").update({ spinning: false, result: DARES[idx] });
      }, 4200);
    });
  });

  $("#btn-dare-done").addEventListener("click", () => {
    DB.ref("games/dareWheel").once((d) => {
      const order = USER_ORDER;
      const next = order[(order.indexOf(d.currentTurn) + 1) % order.length];
      DB.ref("games/dareWheel").update({ currentTurn: next, result: "", spinning: false, completedTurn: false });
      Sound.play("pop");
    });
  });

  function renderDare(d) {
    if (!d) { ensureDareInit(); return; }
    const turnU = USERS[d.currentTurn] || USERS.panda;
    $("#dare-turn-name").textContent = `${turnU.short} ${turnU.emoji}`;

    // spin animation (driven by resultIndex so all screens match)
    if (d.spinning && typeof d.resultIndex === "number") {
      const seg = 360 / WHEEL_COLORS.length;
      const colorSeg = d.resultIndex % WHEEL_COLORS.length;
      const target = 360 * 6 + (360 - (colorSeg * seg + seg / 2));
      wheelRotation = target;
      wheelEl.style.transform = `rotate(${wheelRotation}deg)`;
    }

    const isMyTurn = d.currentTurn === ME;
    $("#btn-spin").disabled = !isMyTurn || d.spinning;
    if (!isMyTurn && !d.result) {
      $("#dare-wait").classList.remove("hidden");
      $("#dare-wait").textContent = `Waiting for ${turnU.short} to spin… ${turnU.emoji}`;
    } else {
      $("#dare-wait").classList.add("hidden");
    }

    if (d.result) {
      $("#dare-result").classList.remove("hidden");
      $("#dare-result-who").textContent = `${turnU.short} got:`;
      $("#dare-result-text").textContent = d.result;
      $("#btn-dare-done").classList.toggle("hidden", !isMyTurn);
    } else {
      $("#dare-result").classList.add("hidden");
    }
  }

  // ============================================================
  //  COMPATIBILITY
  // ============================================================
  function ensureCompatInit() {
    DB.ref("games/compatibility").once((c) => {
      if (!c) {
        DB.ref("games/compatibility").set({
          currentQuestionIndex: 0, reveal: false,
          answers: { panda:{answered:false,selected:""}, bear:{answered:false,selected:""}, icebear:{answered:false,selected:""} },
        });
      }
    });
  }

  // compatOptionsBuilt declared above
  function renderCompat(c) {
    if (!c) { ensureCompatInit(); return; }
    const qi = c.currentQuestionIndex || 0;
    $("#q-counter").textContent = `Question ${qi+1}/${QUESTIONS.length}`;
    $("#q-text").textContent = QUESTIONS[qi];

    // build options once per question
    if (compatOptionsBuilt !== qi) {
      compatOptionsBuilt = qi;
      const wrap = $("#q-options"); wrap.innerHTML = "";
      COMPAT_OPTIONS.forEach((o) => {
        const b = document.createElement("button");
        b.className = "opt-btn"; b.textContent = o.label; b.dataset.key = o.key;
        b.addEventListener("click", () => selectCompat(o.key));
        wrap.appendChild(b);
      });
      $("#q-locked").classList.add("hidden");
    }

    const ans = (c.answers && c.answers[ME]) || {};
    if (ans.answered) {
      $$("#q-options .opt-btn").forEach((b) => b.classList.toggle("selected", b.dataset.key === ans.selected));
      $("#q-locked").classList.remove("hidden");
      $$("#q-options .opt-btn").forEach((b) => b.disabled = true);
    } else {
      $("#q-locked").classList.add("hidden");
      $$("#q-options .opt-btn").forEach((b) => b.disabled = false);
    }

    // status pills
    renderStatusPills($("#answer-status"), c.answers, "answered");

    // everyone answered? (coerce in case answered is stored as a string)
    const allAns = USER_ORDER.every((k) => {
      const a = c.answers && c.answers[k];
      return a && (a.answered === true || a.answered === "true");
    });
    const revealOn = c.reveal === true || c.reveal === "true";

    // "waiting" hint: my answer locked but not everyone has answered yet
    $("#compat-wait").classList.toggle("hidden", !(ans.answered && !allAns && !revealOn));

    // manual fallback: everyone answered but reveal not on yet -> show a
    // tappable "Show Reveal" button so the game can NEVER get stuck.
    $("#btn-show-reveal").classList.toggle("hidden", !(allAns && !revealOn));

    // reveal: ANY present user auto-triggers it (no single point of failure)
    if (allAns && !revealOn) {
      DB.ref("games/compatibility").update({ reveal: true });
    }

    if (revealOn) {
      // AUTO POPUP — overlays everyone's screen the moment all 3 answered
      $("#reveal-modal").classList.remove("hidden");
      showReveal(c);
    } else {
      // popup closed, back to the question
      $("#reveal-modal").classList.add("hidden");
      revealShown = -1;
    }
  }

  // manual reveal trigger (safety net if auto-trigger didn't fire)
  $("#btn-show-reveal").addEventListener("click", () => {
    DB.ref("games/compatibility").update({ reveal: true });
    Sound.play("win");
  });

  function selectCompat(key) {
    DB.ref(`games/compatibility/answers/${ME}`).update({ answered: true, selected: key });
    Sound.play("pop");
  }

  // revealShown declared above
  function showReveal(c) {
    const qi = c.currentQuestionIndex || 0;
    $("#reveal-counter").textContent = `Question ${qi+1}/${QUESTIONS.length}`;
    $("#reveal-question").textContent = QUESTIONS[qi];

    if (revealShown !== qi) {
      revealShown = qi;
      Sound.play("win"); FX.confetti(60);
    }
    const list = $("#reveal-list"); list.innerHTML = "";
    const counts = {};
    USER_ORDER.forEach((k) => {
      const sel = (c.answers[k] && c.answers[k].selected) || "";
      counts[sel] = (counts[sel]||0)+1;
      const row = document.createElement("div");
      row.className = "reveal-row";
      row.textContent = `${USERS[k].short} ${USERS[k].emoji} chose: ${labelFor(sel)}`;
      list.appendChild(row);
    });
    let most = null, max = 0;
    Object.keys(counts).forEach((k) => { if (counts[k] > max) { max = counts[k]; most = k; } });
    $("#reveal-most").textContent = max > 1 ? `Most selected: ${labelFor(most)}` : "Everyone had a different pick! 👀";

    // ANY present user can advance / finish (not just panda)
    const isLast = qi >= QUESTIONS.length - 1;
    $("#btn-next-q").classList.toggle("hidden", isLast);
    $("#btn-compat-done").classList.toggle("hidden", !isLast);
  }

  $("#btn-next-q").addEventListener("click", () => {
    DB.ref("games/compatibility").once((c) => {
      const next = ((c && c.currentQuestionIndex) || 0) + 1;
      DB.ref("games/compatibility").update({
        currentQuestionIndex: next, reveal: false,
        answers: { panda:{answered:false,selected:""}, bear:{answered:false,selected:""}, icebear:{answered:false,selected:""} },
      });
      Sound.play("pop");
    });
  });
  $("#btn-compat-done").addEventListener("click", () => {
    DB.ref("state").update({ currentScreen: "menu" });
    show("menu");
  });

  // ============================================================
  //  MEMORY WALL
  // ============================================================
  function ensureMemoryInit() {
    DB.ref("games/memoryWall").once((m) => {
      if (!m) {
        DB.ref("games/memoryWall/memories").set({
          panda:{submitted:false,text:""}, bear:{submitted:false,text:""}, icebear:{submitted:false,text:""},
        });
      }
    });
  }
  $("#btn-submit-memory").addEventListener("click", () => {
    const txt = $("#memory-text").value.trim();
    if (!txt) return;
    DB.ref(`games/memoryWall/memories/${ME}`).update({ submitted: true, text: txt });
    $("#memory-input-box").classList.add("hidden");
    Sound.play("pop");
  });

  function renderMemory(m) {
    if (!m || !m.memories) { ensureMemoryInit(); return; }
    const mem = m.memories;
    const iSubmitted = mem[ME] && mem[ME].submitted;
    $("#memory-input-box").classList.toggle("hidden", !!iSubmitted);
    if (!iSubmitted) $("#memory-text").value = $("#memory-text").value || "";
    renderStatusPills($("#memory-status"), mem, "submitted");

    const allSub = USER_ORDER.every((k) => mem[k] && mem[k].submitted);
    if (allSub) {
      $("#memory-reveal").classList.remove("hidden");
      const list = $("#memory-list"); list.innerHTML = "";
      USER_ORDER.forEach((k) => {
        const row = document.createElement("div");
        row.className = "mem-row";
        row.innerHTML = `<div class="mem-txt">"${escapeHtml(mem[k].text)}"</div>`;
        // Ali guesses who wrote it
        if (ME === "bear") {
          const guessRow = document.createElement("div");
          guessRow.className = "guess-row";
          ["panda","icebear","bear"].forEach((g) => {
            const gb = document.createElement("button");
            gb.className = "guess-btn"; gb.textContent = USERS[g].short;
            gb.addEventListener("click", () => {
              if (g === k) { gb.classList.add("correct"); gb.textContent = USERS[g].short + " ✅"; Sound.play("win"); }
              else { gb.classList.add("wrong"); gb.textContent = USERS[g].short + " ❌"; }
            });
            guessRow.appendChild(gb);
          });
          const lbl = document.createElement("div"); lbl.className = "mem-by"; lbl.textContent = "Guess who wrote this:";
          row.appendChild(lbl); row.appendChild(guessRow);
        } else {
          const by = document.createElement("div"); by.className = "mem-by";
          by.textContent = `— ${USERS[k].short} ${USERS[k].emoji}`;
          row.appendChild(by);
        }
        list.appendChild(row);
      });
    } else {
      $("#memory-reveal").classList.add("hidden");
    }
  }

  // ============================================================
  //  FINAL FIREWORKS
  //  Flow: only Panda sees "Launch" -> sends notification (ready check)
  //  -> everyone gets full-screen "Okay, Let's Do It!" -> when all 3
  //  ready -> fireworks fire for everyone + a heartfelt trio letter.
  // ============================================================
  const TRIO_LETTER =
    "Dear Ali Haider 🐻👑,\n\n" +
    "Aaj ka din sirf ek date nahi — ye us insaan ka din hai jo Trio Back ka dil hai. " +
    "Panda 🐼, Bear 🐻 aur Ice Bear 🐻‍❄️ — humari dosti tere bina adhoori hai. " +
    "Tere saath har chat, har hansi, har late reply bhi yaad ban jaati hai. 💗\n\n" +
    "Allah tujhe hamesha khush, healthy aur muskuraata rakhe. Tu jahan bhi rahe, " +
    "Trio Back hamesha tere saath hai. Happy Birthday, Birthday Bear! 🎂✨\n\n" +
    "— Forever, Trio Back 🫂";

  function ensureFireworksInit() {
    DB.ref("games/fireworks").once((f) => {
      if (!f) {
        DB.ref("games/fireworks").set({
          launched: false, started: false,
          ready: { panda: false, bear: false, icebear: false },
        });
      }
    });
  }

  // Panda launches the ready-check (sends notification to everyone)
  $("#btn-fw-launch").addEventListener("click", () => {
    Sound.play("sparkle");
    DB.ref("games/fireworks").update({ launched: true });
  });
  // everyone confirms ready
  $("#btn-fw-ready").addEventListener("click", () => {
    DB.ref(`games/fireworks/ready/${ME}`).set(true);
    $("#btn-fw-ready").disabled = true;
    $("#btn-fw-ready").textContent = "You're ready! Waiting for others… ⏳";
    Sound.play("pop");
  });
  // "Back to Main Menu" after the finale
  $("#btn-fw-menu").addEventListener("click", () => {
    Sound.play("pop");
    DB.ref("state").update({ currentScreen: "menu" });
    show("menu");
  });
  // the live call-banner "Join the Finale" button
  $("#fw-call-join").addEventListener("click", () => {
    Sound.play("sparkle");
    DB.ref("state").update({ currentScreen: "fireworks" });
    show("fireworks"); fwShown = false; ensureFireworksInit();
  });

  // Render the live "Haris called for Final Fireworks" banner.
  // Shows for anyone NOT yet on the fireworks screen, while the finale is
  // launched but not started — and lists who still hasn't joined.
  function renderFireworksCall(f) {
    const banner = $("#fw-call-banner");
    if (!banner) return;
    const active = f && f.launched && !f.started && currentScreenName !== "fireworks";
    if (active) {
      // who is NOT on the fireworks screen yet?
      const pending = USER_ORDER.filter((k) => !(usersCache[k] && usersCache[k].screen === "fireworks"))
        .map((k) => `${USERS[k].short} ${USERS[k].emoji}`);
      $("#fw-call-pending").textContent = pending.length ? `Waiting for ${pending.join(", ")}…` : "Everyone is heading in!";
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  }

  function renderFireworks(f) {
    fireworksCache = f;
    // keep the global call-banner in sync on every fireworks update
    renderFireworksCall(f);

    // only react while on the fireworks screen wiring is fine globally too
    if (!f) { if (currentScreenName === "fireworks") ensureFireworksInit(); return; }

    const launchStage = $("#fw-stage-launch");
    const readyStage = $("#fw-stage-ready");

    if (!f.launched && !f.started) {
      // pre-launch: only Panda sees the launch button
      launchStage.classList.remove("hidden");
      readyStage.classList.add("hidden");
      $("#fw-final").classList.add("hidden");
      $("#fw-letter").classList.add("hidden");
      $("#btn-fw-menu").classList.add("hidden");
      $("#dancers").classList.add("hidden");
      if (ME === "panda") {
        $("#btn-fw-launch").classList.remove("hidden");
        $("#fw-wait-panda").classList.add("hidden");
      } else {
        $("#btn-fw-launch").classList.add("hidden");
        $("#fw-wait-panda").classList.remove("hidden");
      }
      return;
    }

    if (f.launched && !f.started) {
      // ready-check full screen for everyone
      launchStage.classList.add("hidden");
      readyStage.classList.remove("hidden");

      // live waiting area: a card per member showing Ready / Waiting / Not here
      const wrap = $("#fw-waiting");
      if (wrap) {
        wrap.innerHTML = "";
        let readyCount = 0;
        USER_ORDER.forEach((k) => {
          const isReady = !!(f.ready && f.ready[k]);
          const onScreen = usersCache[k] && usersCache[k].screen === "fireworks";
          if (isReady) readyCount++;
          const card = document.createElement("div");
          card.className = "fw-wait-card" + (isReady ? " ready" : (onScreen ? " here" : " away"));
          const state = isReady ? "Ready 🎆" : (onScreen ? "Getting ready… ⏳" : "Not here yet 💤");
          card.innerHTML = `<div class="fw-wait-emoji">${USERS[k].emoji}</div>
            <div class="fw-wait-name">${USERS[k].short}</div>
            <div class="fw-wait-state">${state}</div>`;
          wrap.appendChild(card);
        });
        const cnt = $("#fw-ready-count");
        if (cnt) cnt.textContent = `${readyCount} / ${USER_ORDER.length} ready`;
      }

      // reflect MY ready state from the DB (survives reload / resume / reconnect)
      const meReady = !!(f.ready && f.ready[ME]);
      const btn = $("#btn-fw-ready");
      btn.disabled = meReady;
      btn.textContent = meReady ? "You're ready! Waiting for others… ⏳" : "I'm Ready! 🎆";

      // when everyone is ready, start the show. Whoever is present triggers it
      // (not only Panda) so a disconnected host can't stall the finale.
      const allReady = USER_ORDER.every((k) => f.ready && f.ready[k]);
      if (allReady) {
        DB.ref("games/fireworks").update({ started: true });
      }
      return;
    }

    if (f.started) {
      // only play the big show once, and only while actually on the fireworks screen
      if (!fwShown && currentScreenName === "fireworks") {
        fwShown = true;
        readyStage.classList.add("hidden");
        launchStage.classList.add("hidden");
        $("#fw-back").classList.add("hidden");
        Sound.play("fireworks");
        FX.fireworksShow(9000);
        setTimeout(() => {
          $("#dancers").classList.remove("hidden");
          $("#fw-final").classList.remove("hidden");
          const letter = $("#fw-letter");
          letter.textContent = TRIO_LETTER;
          letter.classList.remove("hidden");
          Sound.play("win");
        }, 1200);
        // reveal the "Back to Main Menu" button once the letter has landed
        setTimeout(() => { $("#btn-fw-menu").classList.remove("hidden"); }, 4200);
      } else if (fwShown && currentScreenName === "fireworks") {
        // already shown this session (e.g. resumed) -> jump straight to the letter
        readyStage.classList.add("hidden");
        launchStage.classList.add("hidden");
        $("#dancers").classList.remove("hidden");
        $("#fw-final").classList.remove("hidden");
        const letter = $("#fw-letter");
        letter.textContent = TRIO_LETTER;
        letter.classList.remove("hidden");
        $("#btn-fw-menu").classList.remove("hidden");
      }
    }
  }

  // ============================================================
  //  CHAT  (glitch-free: input never re-rendered; keyboard-safe)
  // ============================================================
  const chatSheet = $("#chat-sheet");
  const chatBackdrop = $("#chat-backdrop");

  function openChat() {
    chatOpen = true;
    chatSheet.classList.add("open");
    chatBackdrop.classList.remove("hidden");
    $("#chat-tab").classList.add("open-state");
    clearUnseen();
    setVH();
    scrollChat();
    // chat is an OVERLAY (screen stays the same), so we track a separate flag
    if (ME) DB.ref(`users/${ME}/inChat`).set(true);
  }
  function closeChat() {
    chatOpen = false;
    chatSheet.classList.remove("open");
    chatBackdrop.classList.add("hidden");
    $("#chat-tab").classList.remove("open-state");
    $("#emoji-picker").classList.add("hidden");
    if (ME) {
      DB.ref(`users/${ME}/typing`).set(false);
      DB.ref(`users/${ME}/inChat`).set(false);
    }
  }
  function clearUnseen() {
    unseenCount = 0;
    $("#chat-dot").classList.add("hidden");
  }

  $("#chat-tab").addEventListener("click", () => { chatOpen ? closeChat() : openChat(); });
  $("#chat-close").addEventListener("click", closeChat);
  $("#chat-backdrop").addEventListener("click", closeChat);
  // presence banner action button — context aware (open chat OR jump to a game)
  $("#presence-open").addEventListener("click", () => {
    const go = $("#presence-open").dataset.go;
    if (go && go !== "chat") {
      Sound.play("pop");
      show(go);
      if (go === "dare") ensureDareInit();
      if (go === "compat") ensureCompatInit();
      if (go === "memory") ensureMemoryInit();
    } else {
      openChat();
    }
  });

  $("#chat-send").addEventListener("click", doSend);
  $("#chat-input").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSend(); } });
  $("#chat-input").addEventListener("input", onTyping);
  // keep messages scrolled to bottom when keyboard opens
  $("#chat-input").addEventListener("focus", () => setTimeout(() => { setVH(); scrollChat(); }, 300));

  function doSend() {
    const input = $("#chat-input");
    const t = input.value.trim();
    if (!t) { input.focus(); return; }
    sendChat(t);
    input.value = "";
    input.focus();                 // keep keyboard open, don't close chat
    if (ME) DB.ref(`users/${ME}/typing`).set(false);
  }
  function sendChat(text) {
    if (!ME) return;
    DB.ref("chat").push({ from: ME, text, time: DB.serverTime() });
    Sound.play("pop");
  }

  // typingTimer declared above
  function onTyping() {
    if (!ME) return;
    DB.ref(`users/${ME}/typing`).set(true);
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => DB.ref(`users/${ME}/typing`).set(false), 1600);
  }

  function renderChat(chat) {
    const box = $("#chat-messages");
    const msgs = chat
      ? Object.keys(chat).map((k) => ({ id: k, ...chat[k] })).sort((a,b) => (a.time||0)-(b.time||0))
      : [];

    // rebuild bubble list (cheap; the INPUT is a separate element so typing is safe)
    box.innerHTML = "";
    let newFromOthers = 0;
    msgs.forEach((m) => {
      const u = USERS[m.from] || { short: m.from, emoji: "" };
      const div = document.createElement("div");
      div.className = `bubble ${m.from} ${m.from === ME ? "mine" : ""}`;
      div.innerHTML = `<div class="who">${u.short} ${u.emoji}</div>${escapeHtml(m.text)}`;
      box.appendChild(div);
      // notification accounting: only OTHERS' brand-new messages count
      if (chatInitialised && !knownMsgIds[m.id] && m.from !== ME) newFromOthers++;
      knownMsgIds[m.id] = true;
    });

    if (!chatInitialised) {
      // first load: remember existing ids without notifying
      msgs.forEach((m) => { knownMsgIds[m.id] = true; });
      chatInitialised = true;
    } else if (newFromOthers > 0) {
      if (chatOpen) {
        Sound.play("pop");
      } else {
        unseenCount += newFromOthers;
        $("#chat-dot").classList.remove("hidden");
        Sound.play("pop");
      }
    }
    if (chatOpen) scrollChat();
  }
  function scrollChat() { const b = $("#chat-messages"); if (b) b.scrollTop = b.scrollHeight; }

  // typing indicator inside the chat sheet
  function renderTyping() {
    const typers = USER_ORDER.filter((k) => k !== ME && usersCache[k] && usersCache[k].typing)
      .map((k) => `${USERS[k].short} ${USERS[k].emoji}`);
    $("#chat-typing").textContent = typers.length ? `${typers.join(", ")} is typing…` : "";
  }

  // emoji picker — appends to input WITHOUT closing chat
  const picker = $("#emoji-picker");
  picker.innerHTML = CHAT_EMOJIS.map((e) => `<span>${e}</span>`).join("");
  $("#chat-emoji-btn").addEventListener("click", (e) => {
    e.preventDefault();
    picker.classList.toggle("hidden");
    if (!picker.classList.contains("hidden")) setTimeout(scrollChat, 50);
  });
  picker.addEventListener("click", (e) => {
    if (e.target.tagName === "SPAN") {
      const input = $("#chat-input");
      input.value += e.target.textContent;
      input.focus();
      onTyping();
    }
  });

  // ============================================================
  //  PRESENCE  (typing banner across screens + who-is-here glows)
  // ============================================================
  const SCREEN_LABEL = {
    chat: "Chat 💬", dare: "Dare Wheel 🎡", compat: "Compatibility 🫂",
    memory: "Memory Wall 🧡", fireworks: "Final Fireworks 🎆",
    cake: "the Cake 🎂", surprise: "the Surprise 🎁", lobby: "the Lobby",
    celebration: "Celebration 🎉", menu: "the Menu", welcome: "", login: "",
  };

  function renderPresence() {
    if (!ME) { $("#presence-banner").classList.add("hidden"); return; }
    const banner = $("#presence-banner");
    const txt = $("#presence-text");
    const openBtn = $("#presence-open");

    // 1) anyone else typing?  -> highest priority
    const typers = USER_ORDER.filter((k) => k !== ME && usersCache[k] && usersCache[k].online && usersCache[k].typing)
      .map((k) => `${USERS[k].short} ${USERS[k].emoji}`);

    if (typers.length && !chatOpen) {
      txt.innerHTML = `<span class="dot-typing">✍️ ${typers.join(", ")} is typing in chat…</span>`;
      openBtn.textContent = "Open Chat 💬";
      openBtn.dataset.go = "chat";
      openBtn.classList.remove("hidden");
      banner.classList.remove("hidden");
      return;
    }

    // 2) someone in chat (but not me, and I'm not in chat)
    const inChat = USER_ORDER.filter((k) => k !== ME && usersCache[k] && usersCache[k].online && usersCache[k].inChat)
      .map((k) => `${USERS[k].short} ${USERS[k].emoji}`);
    if (inChat.length && !chatOpen) {
      txt.innerHTML = `💬 ${inChat.join(", ")} ${inChat.length > 1 ? "are" : "is"} in Chat`;
      openBtn.textContent = "Open Chat 💬";
      openBtn.dataset.go = "chat";
      openBtn.classList.remove("hidden");
      banner.classList.remove("hidden");
      return;
    }

    // 3) someone playing a game I'm not in -> invite me to join (opt-in)
    const GAME_SCREENS = ["dare", "compat", "memory"];
    if (!chatOpen && GAME_SCREENS.includes(currentScreenName) === false) {
      for (const g of GAME_SCREENS) {
        const players = USER_ORDER.filter((k) => k !== ME && usersCache[k] && usersCache[k].online && usersCache[k].screen === g)
          .map((k) => `${USERS[k].short} ${USERS[k].emoji}`);
        if (players.length) {
          txt.innerHTML = `${players.join(", ")} ${players.length > 1 ? "are" : "is"} playing ${SCREEN_LABEL[g]}`;
          openBtn.textContent = "Join 🎮";
          openBtn.dataset.go = g;
          openBtn.classList.remove("hidden");
          banner.classList.remove("hidden");
          return;
        }
      }
    }

    banner.classList.add("hidden");
  }

  // who-is-here emoji glows: fills every [data-here] container with the 3
  // emojis, glowing for users currently online & on that screen.
  function renderHereGlows() {
    $$("[data-here]").forEach((box) => {
      const feat = box.dataset.here;
      box.innerHTML = "";
      USER_ORDER.forEach((k) => {
        const u = usersCache[k];
        const here = u && u.online && (
          feat === "chat" ? !!u.inChat : u.screen === feat
        );
        const span = document.createElement("span");
        span.className = "here-emoji" + (here ? " on" : "");
        span.textContent = USERS[k].emoji;
        span.title = USERS[k].short;
        box.appendChild(span);
      });
    });
    // chat tab "who's here" mini-row
    renderChatTabHere();
  }
  function renderChatTabHere() {
    const tab = $("#chat-here");
    const headerRow = $("#chat-here-row");
    if (!tab) return;
    const html = USER_ORDER.map((k) => {
      const u = usersCache[k];
      const here = u && u.online && !!u.inChat;
      return `<span class="here-emoji${here ? " on" : ""}">${USERS[k].emoji}</span>`;
    }).join("");
    tab.innerHTML = html;
    if (headerRow) headerRow.innerHTML = html;
  }

  // ============================================================
  //  REACTIONS
  // ============================================================
  $$(".react-bar").forEach((bar) => {
    bar.innerHTML = REACTIONS.map((e) => `<div class="react">${e}</div>`).join("");
    bar.addEventListener("click", (e) => {
      const r = e.target.closest(".react");
      if (!r) return;
      DB.ref("reactions").push({ from: ME, emoji: r.textContent, screen: bar.dataset.screen, time: DB.serverTime() });
      Sound.play("pop");
    });
  });

  // seenReactions declared above
  function handleReactions(rx) {
    if (!rx) return;
    Object.keys(rx).forEach((id) => {
      if (seenReactions[id]) return;
      seenReactions[id] = true;
      // only animate recent (avoid flood on load)
      if (Date.now() - (rx[id].time || 0) < 8000) floatReaction(rx[id].emoji);
    });
    // prune old reactions occasionally
  }
  function floatReaction(emoji) {
    const el = document.createElement("div");
    el.className = "float-react";
    el.textContent = emoji;
    el.style.left = (Math.random() * 70 + 15) + "%";
    el.style.bottom = "120px";
    $("#reaction-layer").appendChild(el);
    setTimeout(() => el.remove(), 2300);
  }

  // ============================================================
  //  STATUS PILLS helper
  // ============================================================
  function renderStatusPills(container, obj, flag) {
    container.innerHTML = "";
    const doneLabel = flag === "submitted" ? "Submitted ✅" : flag === "ready" ? "Ready ✅" : "Answered ✅";
    USER_ORDER.forEach((k) => {
      const done = obj && obj[k] && obj[k][flag];
      const pill = document.createElement("div");
      pill.className = `status-pill ${done ? "done" : "pending"}`;
      pill.textContent = `${USERS[k].short}: ${done ? doneLabel : "Pending ⏳"}`;
      container.appendChild(pill);
    });
  }

  // ============================================================
  //  MUSIC TOGGLE
  // ============================================================
  $("#music-toggle").addEventListener("click", () => {
    const on = Sound.toggle();
    $("#music-toggle").textContent = on ? "🔊" : "🔇";
    if (on) Sound.play("sparkle");
  });

  // ============================================================
  //  RESET ROOM (replay the whole celebration)
  // ============================================================
  $("#reset-btn").addEventListener("click", () => {
    // only the admin (Haris = Panda / HORIZON) can reset / restore the room
    if (ME !== ADMIN_USER) return;
    if (!confirm("Restore the whole Birthday Room?\n\nThis clears chat, games & progress AND logs everyone out — all three will have to choose their profile and re-enter their PIN to rejoin. Continue?")) return;

    const resetAt = Date.now();
    // fresh state -> back to lobby, nothing started
    DB.ref("state").set({
      currentScreen: "lobby", celebrationStarted: false, candlesBlown: false,
      chatUnlocked: false, currentGame: "none", resetAt: resetAt,
    });
    DB.ref("chat").remove();
    DB.ref("reactions").remove();
    DB.ref("games").remove();
    // LOG EVERYONE OUT: clear joined/online so all three must re-login with PIN.
    USER_ORDER.forEach((k) => {
      DB.ref(`users/${k}`).update({ joined: false, online: false, screen: "login", inChat: false, typing: false });
    });

    // remember this reset locally so the resetAt listener doesn't double-fire,
    // then fully log myself out too (re-enter PIN like everyone else).
    try { localStorage.setItem("lastResetAt", String(resetAt)); } catch (e) {}
    forceLogout();
  });

  // ============================================================
  //  utils
  // ============================================================
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));
  }

})();
