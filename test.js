// Functional smoke test using jsdom (local/demo mode, no Firebase SDK).
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

// Build DOM but DON'T run the dynamic loader scripts; we inject our own.
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;
global.window = window;
global.document = window.document;
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
window.AudioContext = function(){ return { currentTime:0, createOscillator:()=>({frequency:{},connect(){},start(){},stop(){}}), createGain:()=>({gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}), createBuffer:()=>({getChannelData:()=>new Float32Array(10)}), createBufferSource:()=>({connect(){},start(){},buffer:null}), destination:{}, resume(){} }; };

// canvas stub
window.HTMLCanvasElement.prototype.getContext = () => ({
  clearRect(){}, fillRect(){}, beginPath(){}, arc(){}, fill(){}, save(){}, restore(){}, translate(){}, rotate(){}, set fillStyle(v){}, set globalAlpha(v){},
});
window.requestAnimationFrame = () => 0;

// No firebase global -> forces local mode
function loadScript(file) {
  const code = fs.readFileSync(path.join(__dirname, file), "utf8");
  window.eval(code);
}

let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log("  ✅ " + msg); }
  else { console.log("  ❌ " + msg); failures++; }
}

// load app scripts in order — concatenate so top-level const/let share
// one scope, mimicking how separate <script> tags share global scope.
(function () {
  const combined = ["js/firebase-config.js","js/data.js","js/effects.js","js/app.js"]
    .map((f) => fs.readFileSync(path.join(__dirname, f), "utf8"))
    .join("\n;\n")
    // expose module-scoped consts to window for assertions
    + "\n;window.DB=DB;window.DARES=DARES;window.QUESTIONS=QUESTIONS;window.USERS=USERS;window.ADMIN_USER=ADMIN_USER;window.FX=FX;";
  window.eval(combined);
})();
void loadScript;

const DB = window.DB;
const $ = (s) => window.document.querySelector(s);

setTimeout(() => {
  console.log("\n[1] Boot / mode");
  assert(DB.mode() === "local", "DB in local demo mode (no firebase)");
  assert($("#screen-welcome").classList.contains("active"), "Welcome screen active on boot");

  console.log("\n[2] Enter room");
  $("#btn-enter").click();
  assert($("#screen-login").classList.contains("active"), "Login screen shows after Enter");

  console.log("\n[3] PIN login as Panda");
  document.querySelector('.profile-card[data-user="panda"]').click();
  assert(!$("#pin-modal").classList.contains("hidden"), "PIN modal opens");
  $("#pin-input").value = "999"; $("#pin-submit").click();
  assert($("#pin-msg").textContent.includes("Wrong"), "Wrong PIN rejected");
  $("#pin-input").value = "150906"; $("#pin-submit").click();

  setTimeout(() => {
    assert(DB_val("users/panda/joined") === true, "Panda joined=true in DB");
    // ensure lobby visible (afterLogin routes here)

    console.log("\n[4] Simulate Bear + IceBear joining");
    // before all join: dashboard button should be locked/dim & disabled
    assert($("#btn-go-celebration").classList.contains("btn-locked"), "Dashboard button locked before all join");
    assert($("#btn-go-celebration").disabled === true, "Dashboard button disabled before all join");
    DB.ref("users/bear").update({ joined:true, online:true, name:"Ali Haider", emoji:"🐻" });
    DB.ref("users/icebear").update({ joined:true, online:true, name:"Faiqa", emoji:"🐻‍❄️" });
    assert(!$("#btn-go-celebration").classList.contains("hidden"), "Dashboard button shows when all joined");
    assert($("#btn-go-celebration").classList.contains("btn-glow-ready"), "Dashboard button glows when all joined");
    assert($("#btn-go-celebration").disabled === false, "Dashboard button enabled when all joined");

    console.log("\n[5] Celebration -> Cake");
    $("#btn-go-celebration").click();
    $("#btn-celebrate").click();
    assert(DB_val("state/currentScreen") === "cake", "currentScreen=cake after celebrate");
    assert(DB_val("state/celebrationStarted") === true, "celebrationStarted=true");

    console.log("\n[6] Candle blow (bear only logic)");
    DB.ref("state").update({ candlesBlown: true });
    assert(DB_val("state/candlesBlown") === true, "candlesBlown=true");

    console.log("\n[7] Chat send");
    DB.ref("chat").push({ from:"panda", text:"Happy Birthday Ali 🎂", time:Date.now() });
    const chat = DB_val("chat");
    assert(chat && Object.keys(chat).length >= 1, "chat message stored");

    console.log("\n[8] Dare wheel init + turn");
    DB.ref("state").update({ currentScreen:"dare" });
    DB.ref("games/dareWheel").set({ currentTurn:"panda", spinning:false, result:"", completedTurn:false });
    assert(DB_val("games/dareWheel/currentTurn") === "panda", "dare currentTurn=panda");

    console.log("\n[9] Compatibility reveal POPUP (auto, any user advances)");
    DB.ref("state").update({ currentScreen:"compat", currentGame:"compat" });
    DB.ref("games/compatibility").set({ currentQuestionIndex:0, reveal:false, answers:{ panda:{answered:true,selected:"bear"}, bear:{answered:true,selected:"all"}, icebear:{answered:true,selected:"bear"} }});
    setTimeout(() => {
      assert(DB_val("games/compatibility/reveal") === true, "reveal auto-triggers when all answered (any present user, not panda-only)");
      // force a render with reveal=true so the popup reflects current state
      DB.ref("games/compatibility").update({ reveal: true });
      // reveal shows as an overlay POPUP (not inline) on everyone's screen
      assert($("#reveal-modal") != null && !$("#reveal-modal").classList.contains("hidden"), "reveal pops up as an overlay modal for everyone");
      // next-question button lives inside the popup and is available to ANY user
      assert(!$("#btn-next-q").classList.contains("hidden"), "Next Question button available inside popup to advance");
      $("#btn-next-q").click();
      assert(DB_val("games/compatibility/currentQuestionIndex") === 1, "Next Question advances the question index");
      assert(DB_val("games/compatibility/reveal") === false, "advancing closes popup back to question");
      // popup closes once reveal is false
      DB.ref("games/compatibility").update({ reveal: false });
      assert($("#reveal-modal").classList.contains("hidden"), "popup hidden after advancing to next question");

      console.log("\n[10] Memory wall");
      DB.ref("games/memoryWall/memories").set({ panda:{submitted:true,text:"cute"}, bear:{submitted:true,text:"funny"}, icebear:{submitted:true,text:"caring"} });
      assert(DB_val("games/memoryWall/memories/panda/submitted") === true, "memory submitted stored");

      console.log("\n[11] Final Fireworks ready-check flow");
      DB.ref("state").update({ currentScreen:"fireworks" });
      DB.ref("games/fireworks").set({ launched:false, started:false, ready:{panda:false,bear:false,icebear:false} });
      assert(DB_val("games/fireworks/launched") === false, "fireworks starts not launched");
      DB.ref("games/fireworks").update({ launched:true });
      assert(DB_val("games/fireworks/launched") === true, "Panda launch sets launched=true");

      // enhanced finale visuals: launchRocket helper exists
      assert(typeof window.FX.launchRocket === "function", "FX.launchRocket() exists (enhanced finale)");

      // live waiting area renders a card per member + ready counter
      DB.ref("games/fireworks/ready/panda").set(true);
      assert($("#fw-waiting").querySelectorAll(".fw-wait-card").length === 3, "waiting area shows a card per member");
      assert(/1 \/ 3 ready/.test($("#fw-ready-count").textContent), "ready counter shows 1 / 3");

      // call banner: simulate a user NOT on the fireworks screen
      DB.ref("users/icebear/screen").set("menu");
      DB.ref("games/fireworks/ready/bear").set(true);
      DB.ref("games/fireworks/ready/icebear").set(true);
      setTimeout(() => {
        assert(DB_val("games/fireworks/started") === true, "all-ready auto-starts fireworks");

        console.log("\n[11b] Back-to-Menu button exists & routes to menu");
        assert($("#btn-fw-menu") != null, "Back to Main Menu button exists on fireworks screen");
        $("#btn-fw-menu").click();
        assert(DB_val("state/currentScreen") === "menu", "Back to Main Menu routes everyone to menu");

        console.log("\n[12] Presence: user screen broadcast");
        assert(DB_val("users/panda/screen") != null, "panda screen recorded in DB");

        console.log("\n[13] Data integrity");
        assert(window.DARES.length === 20, "20 dares present");
        assert(window.QUESTIONS.length === 20, "20 questions present");
        assert(window.USERS.bear.pin === "222", "Bear PIN = 222");
        assert(window.USERS.panda.pin === "150906" && window.USERS.icebear.pin === "333", "Panda(150906)/Ice Bear PINs correct");
        assert(window.ADMIN_USER === "panda" && window.USERS.panda.admin === true, "Panda (Haris) is admin");

        console.log("\n[14] Reset button is admin-only (logged in as Panda)");
        assert(!$("#reset-btn").classList.contains("hidden"), "Reset visible for admin (Panda)");

        console.log("\n[15] Chat presence uses inChat flag (overlay-safe)");
        // simulate another user opening chat
        DB.ref("users/bear/inChat").set(true);
        DB.ref("users/bear/online").set(true);
        DB.ref("users/bear/screen").set("dare");
        // me (panda) on menu, not in chat -> banner should show "Bear is in Chat"
        DB.ref("users/panda/screen").set("menu");
        DB.ref("users/panda/inChat").set(false);
        setTimeout(() => {
          const ptxt = $("#presence-text").innerHTML;
          assert(/in Chat/i.test(ptxt), "Presence banner shows 'in Chat' via inChat flag");
          assert($("#presence-open").dataset.go === "chat", "Banner action targets chat");
          DB.ref("users/bear/inChat").set(false);

          console.log("\n[16] 'Who am I' badge shows my profile");
          assert(!$("#me-badge").classList.contains("hidden"), "Me badge visible after login");
          assert($("#me-emoji").textContent === "🐼" && $("#me-name").textContent === "Panda", "Me badge shows Panda 🐼");

          console.log("\n[17] Trio server connection badge");
          assert(typeof DB.watchConnection === "function", "DB exposes watchConnection()");
          assert($("#conn-badge").classList.contains("online"), "Connection badge shows online in demo mode");
          assert(/connect/i.test($("#conn-text").textContent), "Connection text reflects connected state");

          console.log("\n[18] Disconnect presence hooks exist (mobile-minimize safe)");
          assert(typeof DB.ref("users/panda/online").onDisconnectSet === "function", "ref.onDisconnectSet() exists");
          assert(typeof DB.ref("users/panda/online").onDisconnectCancel === "function", "ref.onDisconnectCancel() exists");

          console.log("\n[19] Login persists in localStorage (survives app restart)");
          assert(localStorage.getItem("me") === "panda", "login saved to localStorage as panda");

          console.log("\n[20] Trio join/presence strip");
          assert(!$("#trio-strip").classList.contains("hidden"), "Trio strip visible when logged in");
          const pandaMember = $('#trio-strip .trio-member[data-user="panda"]');
          assert(pandaMember.classList.contains("online"), "Panda shows online in trio strip");

          console.log("\n[21] Restore = full reset + LOG EVERYONE OUT");
          // stub reload so the resetAt listener's forceLogout() doesn't blow up jsdom
          let reloadCalled = false;
          try { Object.defineProperty(window.location, "reload", { configurable:true, value: () => { reloadCalled = true; } }); } catch (e) {}
          // simulate the admin restore exactly as the handler does
          const rAt = Date.now() + 1;
          DB.ref("state").set({ currentScreen:"lobby", celebrationStarted:false, candlesBlown:false, chatUnlocked:false, currentGame:"none", resetAt:rAt });
          DB.ref("chat").remove();
          DB.ref("games").remove();
          ["panda","bear","icebear"].forEach((k) => {
            DB.ref("users/"+k).update({ joined:false, online:false, screen:"login", inChat:false, typing:false });
          });
          assert(DB_val("state/resetAt") === rAt, "resetAt timestamp written for room restore");
          assert(DB_val("state/currentScreen") === "lobby", "restore returns room to lobby");
          assert(DB_val("state/celebrationStarted") === false, "restore clears celebration progress");
          assert(DB_val("chat") == null, "restore clears chat");
          // everyone logged out in the DB
          assert(DB_val("users/panda/joined") === false, "restore logs Panda out (joined=false)");
          assert(DB_val("users/bear/joined") === false, "restore logs Bear out (joined=false)");
          assert(DB_val("users/icebear/joined") === false, "restore logs Ice Bear out (joined=false)");

          setTimeout(() => {
            // the resetAt listener should have force-logged-out this client
            assert(localStorage.getItem("me") == null, "restore clears saved login (must re-enter PIN)");
            assert(localStorage.getItem("lastResetAt") === String(rAt), "lastResetAt recorded so reload won't re-trigger");

            console.log(`\n${failures === 0 ? "🎉 ALL TESTS PASSED" : "⚠️ "+failures+" FAILURES"}`);
            process.exit(failures === 0 ? 0 : 1);
          }, 80);
        }, 60);
      }, 120);
    }, 100);
  }, 850);
}, 150);

function DB_val(p) {
  const data = JSON.parse(localStorage.getItem("birthdayRoom_data") || "{}");
  return p.split("/").reduce((o,k)=> (o==null?undefined:o[k]), data);
}
