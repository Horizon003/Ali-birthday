// ============================================================
//  Static data: users, PINs, dares, compatibility questions
// ============================================================

const USERS = {
  panda:   { key: "panda",   name: "HORIZON",   short: "Panda",    emoji: "🐼",   pin: "150906", role: "Friend / Host", admin: true },
  bear:    { key: "bear",    name: "Ali Haider", short: "Bear",    emoji: "🐻",   pin: "222", role: "Birthday Boy" },
  icebear: { key: "icebear", name: "Faiqa",     short: "Ice Bear", emoji: "🐻‍❄️", pin: "333", role: "Friend" },
};
const USER_ORDER = ["panda", "bear", "icebear"];
// Host / admin = Haris (Panda / HORIZON). Only the admin can reset/restore the room.
const ADMIN_USER = "panda";

const DARES = [
  "Ali ko WhatsApp par 5 funny emojis bhejo.",
  "Ali ke liye funny birthday roast likho.",
  "Chat mein sirf emojis se Ali ko wish karo.",
  "Ali ko ek cute nickname do.",
  "Ali ke liye 10 second ka voice note bhejo.",
  "Ali ko fake award do: Late Reply King Award.",
  "Ali ke liye dramatic movie style wish likho.",
  "Group chat mein 3 baar Happy Birthday Bear likho.",
  "Ali ko ek virtual hug bhejo.",
  "Ali ki ek achi habit mention karo.",
  "Ali ke liye one-line poem likho.",
  "Apni last used emoji se Ali ko wish karo.",
  "Ali ko ek savage but friendly line bolo.",
  "Ali ke liye \"Breaking News\" birthday headline banao.",
  "Ali ko ek secret compliment do.",
  "Ali ko ek funny punishment suggest karo.",
  "Trio Back ke liye ek slogan banao.",
  "Ali ke liye 3 words only birthday wish likho.",
  "Ali ko crown emoji spam karo.",
  "Apne keyboard ke random letters se birthday wish banao.",
];

const WHEEL_COLORS = ["#FF6B9A", "#A855F7", "#FFD166", "#7BDFF2", "#ff5f7e", "#4ade80"];

const QUESTIONS = [
  "Sabse masoom kon hai?",
  "Sabse cute kon hai?",
  "Sabse funny kon hai?",
  "Late reply kon karta hai?",
  "Jaldi reply kon karta hai?",
  "Sabse zyada roast kon karta hai?",
  "Sabse zyada roast kon hota hai?",
  "Panda kon hai?",
  "Bear kon hai?",
  "Ice Bear kon hai?",
  "Emotional kon hai?",
  "Best planner kon hai?",
  "Trio ka boss kon hai?",
  "Sabse caring kon hai?",
  "Sabse zyada drama kon karta hai?",
  "Sabse zyada overthinking kon karta hai?",
  "Sabse zyada emojis kon use karta hai?",
  "Chat ko alive kon rakhta hai?",
  "Sabse savage kon hai?",
  "Trio Back ka heart kon hai?",
];

const COMPAT_OPTIONS = [
  { key: "panda",   label: "Panda 🐼" },
  { key: "bear",    label: "Bear 🐻" },
  { key: "icebear", label: "Ice Bear 🐻‍❄️" },
  { key: "all",     label: "All Three 🫂" },
  { key: "none",    label: "No One / Depends 👀" },
];

const REACTIONS = ["😂", "🔥", "🫂", "😭", "👀"];

const CHAT_EMOJIS = ["🎂","🥳","🎉","🎈","🐼","🐻","🐻‍❄️","👑","💗","🔥","😂","😭","🫂","✨","🎁","🍰","👀","🥰","😎","🙌"];

function labelFor(key) {
  if (key === "all") return "All Three 🫂";
  if (key === "none") return "No One / Depends 👀";
  const u = USERS[key];
  return u ? `${u.short} ${u.emoji}` : key;
}
