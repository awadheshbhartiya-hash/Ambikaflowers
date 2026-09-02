/* Ambika Flowers — static site + database API (for Railway)

   Customers (with real login), orders and settings are stored in a SUPABASE
   database so they are permanent (survive every redeploy) and shared across
   every device. Products come from the bundled catalogue (catalog-seed.json).

   To enable Supabase, set these Railway environment variables:
     SUPABASE_URL          e.g. https://xxxxx.supabase.co   (public — safe)
     SUPABASE_SECRET_KEY   the sb_secret_... key            (SECRET — env only)
   Without them the site still works using a local JSON file (data resets on
   redeploy), so it never breaks. */
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Razorpay — Key ID is public (safe in code); the SECRET must come from a Railway
// environment variable named RAZORPAY_KEY_SECRET (never commit the secret to GitHub).
const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_live_TUgdos67Jx1dew";
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

// Supabase — URL is public (safe in code). The SECRET key must come from a Railway
// environment variable named SUPABASE_SECRET_KEY (never commit it to GitHub).
const SUPABASE_URL = (process.env.SUPABASE_URL || "https://uuwxkeknxwwvzyzulhlm.supabase.co").replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || "";
const SB_ON = !!SUPABASE_KEY;
const AUTH_SECRET = process.env.AUTH_SECRET || SUPABASE_KEY || "ambika-flowers-secret";

const app = express();
const PORT = process.env.PORT || 3000;

/* CORS — let the Vercel-hosted static frontend call this API cross-origin.
   Lock it down by setting CORS_ORIGIN in Railway to your Vercel domain
   (e.g. https://ambikaflowers.vercel.app); defaults to "*" so it never breaks. */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* ---------- Supabase REST helpers (server uses the SECRET key → bypasses RLS) ---------- */
function sbHeaders(extra) {
  return Object.assign({ "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" }, extra || {});
}
async function sbGet(pathq) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + pathq, { headers: sbHeaders() });
  if (!r.ok) throw new Error("sbGet " + r.status + " " + (await r.text()));
  return r.json();
}
async function sbUpsert(table, rows) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + table, {
    method: "POST",
    headers: sbHeaders({ "Prefer": "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(rows)
  });
  if (!r.ok) throw new Error("sbUpsert " + r.status + " " + (await r.text()));
  return true;
}
async function sbDelete(table, filter) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + table + "?" + filter, {
    method: "DELETE",
    headers: sbHeaders({ "Prefer": "return=minimal" })
  });
  if (!r.ok) throw new Error("sbDelete " + r.status);
  return true;
}

/* ---------- password hashing (built-in crypto, no dependency) ---------- */
function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(String(pw), salt, 64).toString("hex");
  return salt + ":" + h;
}
function verifyPw(pw, stored) {
  try {
    const parts = String(stored || "").split(":");
    if (parts.length !== 2) return false;
    const h = crypto.scryptSync(String(pw), parts[0], 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(h, "hex"), Buffer.from(parts[1], "hex"));
  } catch (e) { return false; }
}
function makeToken(id) {
  const ts = Date.now();
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(id + "|" + ts).digest("hex").slice(0, 32);
  return id + "." + ts + "." + sig;
}

/* ---------- local JSON fallback store (used when Supabase is unreachable) ---------- */
function pickDataDir() {
  const candidates = [process.env.RAILWAY_VOLUME_MOUNT_PATH, process.env.DATA_DIR, "/data"].filter(Boolean);
  for (let i = 0; i < candidates.length; i++) {
    try { fs.mkdirSync(candidates[i], { recursive: true }); fs.accessSync(candidates[i], fs.constants.W_OK); return candidates[i]; }
    catch (e) {}
  }
  const local = path.join(__dirname, "data");
  try { fs.mkdirSync(local, { recursive: true }); } catch (e2) {}
  return local;
}
const DATA_DIR = pickDataDir();
const STORE_FILE = path.join(DATA_DIR, "store.json");
let STORE_EXISTED_ON_BOOT = false;
try { STORE_EXISTED_ON_BOOT = fs.existsSync(STORE_FILE); } catch (e) {}

function loadSeed() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, "catalog-seed.json"), "utf8")); }
  catch (e) { return []; }
}
function readStore() {
  try { return JSON.parse(fs.readFileSync(STORE_FILE, "utf8")); }
  catch (e) { return null; }
}
function writeStore(s) {
  try {
    const tmp = STORE_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(s, null, 1));
    fs.renameSync(tmp, STORE_FILE);
  } catch (e) { console.error("store write failed", e && e.message); }
}
// Bump this when the bundled catalogue (catalog-seed.json) changes and the live
// product list should be rebuilt.
const CATALOG_VERSION = 4;
let store = readStore();
if (!store || typeof store !== "object") store = {};
if (!Array.isArray(store.orders)) store.orders = [];
if (!Array.isArray(store.customers)) store.customers = [];
if (!store.settings || typeof store.settings !== "object") store.settings = {};
if (typeof store.settings.comingSoon !== "boolean") store.settings.comingSoon = false;
if (!Array.isArray(store.products) || store.products.length === 0 || store.catalogVersion !== CATALOG_VERSION) {
  store.products = loadSeed();          // catalogue always comes from the bundled seed
  store.catalogVersion = CATALOG_VERSION;
}
writeStore(store);
function save() { writeStore(store); }
function rid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ---------- auth index (email/phone -> {id, hash}); passwords never leave the server ---------- */
let authByKey = {};
function indexAuth(id, email, phone, hash) {
  if (email) authByKey[String(email).trim().toLowerCase()] = { id: id, hash: hash };
  if (phone) authByKey[String(phone).trim().toLowerCase()] = { id: id, hash: hash };
}
function publicCustomer(c) {
  return { id: c.id, name: c.name || "", email: c.email || "", phone: c.phone || "", address: c.address || "", createdAt: c.createdAt || c.created_at || Date.now() };
}

/* ---------- load live data from Supabase on boot (falls back silently) ---------- */
async function loadFromSupabase() {
  if (!SB_ON) { console.log("Supabase not configured — using local JSON store"); return; }
  try {
    const cust = await sbGet("customers?select=*");
    if (Array.isArray(cust)) {
      store.customers = [];
      authByKey = {};
      cust.forEach(function (c) {
        store.customers.push(publicCustomer(c));
        indexAuth(c.id, c.email, c.phone, c.password_hash);
      });
      store.customers.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    }
  } catch (e) { console.error("SB customers load failed:", e.message); }
  try {
    const ords = await sbGet("orders?select=data&order=created_at.desc");
    if (Array.isArray(ords)) store.orders = ords.map(function (r) { return r.data; }).filter(Boolean);
  } catch (e) { console.error("SB orders load failed:", e.message); }
  try {
    const st = await sbGet("settings?id=eq.global&select=data");
    if (Array.isArray(st) && st[0] && st[0].data) store.settings = Object.assign({}, store.settings, st[0].data);
  } catch (e) { console.error("SB settings load failed:", e.message); }
  save();
  console.log("Supabase loaded: " + store.customers.length + " customers, " + store.orders.length + " orders");
}

/* ---------- API ---------- */
app.use(express.json({ limit: "2mb" }));

// AUTH — real signup / login with hashed passwords (stored in Supabase)
app.post("/api/auth/signup", async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || "").trim();
  const email = String(b.email || "").trim().toLowerCase();
  const phone = String(b.phone || "").trim();
  const password = String(b.password || "");
  if (!name || (!email && !phone) || password.length < 6) return res.status(400).json({ error: "Naam, email ya phone, aur kam se kam 6 character ka password zaroori hai." });
  if (email && authByKey[email]) return res.status(409).json({ error: "Ye email pehle se registered hai — login karein." });
  if (phone && authByKey[phone]) return res.status(409).json({ error: "Ye phone pehle se registered hai — login karein." });
  const id = rid("CUST");
  const hash = hashPw(password);
  const cust = { id: id, name: name, email: email, phone: phone, address: String(b.address || "").trim(), createdAt: Date.now() };
  store.customers.unshift(cust);
  indexAuth(id, email, phone, hash);
  save();
  if (SB_ON) {
    try { await sbUpsert("customers", [{ id: id, name: name, email: email, phone: phone, password_hash: hash, address: cust.address, created_at: cust.createdAt }]); }
    catch (e) { console.error("SB signup upsert failed:", e.message); }
  }
  res.json({ user: cust, token: makeToken(id) });
});

app.post("/api/auth/login", (req, res) => {
  const b = req.body || {};
  const idIn = String(b.id || b.email || b.phone || "").trim().toLowerCase();
  const password = String(b.password || "");
  if (!idIn || !password) return res.status(400).json({ error: "Email/phone aur password daalein." });
  const rec = authByKey[idIn];
  if (!rec || !verifyPw(password, rec.hash)) return res.status(401).json({ error: "Galat email/phone ya password." });
  const cust = store.customers.find(function (c) { return c.id === rec.id; });
  if (!cust) return res.status(401).json({ error: "Account nahi mila." });
  res.json({ user: publicCustomer(cust), token: makeToken(cust.id) });
});

// PRODUCTS (from the bundled catalogue; admin edits are kept in memory + JSON)
app.get("/api/products", (req, res) => res.json(store.products));
app.put("/api/products", (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: "expected array" });
  store.products = req.body; save(); res.json({ ok: true, count: store.products.length });
});
app.post("/api/products", (req, res) => {
  const p = req.body || {}; if (!p.id) p.id = rid("PRD");
  store.products.unshift(p); save(); res.json(p);
});
app.put("/api/products/:id", (req, res) => {
  const i = store.products.findIndex(p => String(p.id) === req.params.id);
  if (i < 0) return res.status(404).json({ error: "not found" });
  store.products[i] = Object.assign({}, store.products[i], req.body, { id: store.products[i].id });
  save(); res.json(store.products[i]);
});
app.delete("/api/products/:id", (req, res) => {
  const before = store.products.length;
  store.products = store.products.filter(p => String(p.id) !== req.params.id);
  save(); res.json({ ok: true, removed: before - store.products.length });
});

// ORDERS (stored in Supabase so they are permanent)
app.get("/api/orders", (req, res) => res.json(store.orders));
app.post("/api/orders", async (req, res) => {
  const o = req.body || {}; if (!o.id) o.id = rid("ORD");
  if (!o.createdAt) o.createdAt = Date.now();
  if (!o.status) o.status = "New";
  store.orders.unshift(o); save();
  if (SB_ON) { try { await sbUpsert("orders", [{ id: o.id, data: o, created_at: o.createdAt }]); } catch (e) { console.error("SB order upsert failed:", e.message); } }
  res.json(o);
});
app.put("/api/orders/:id", async (req, res) => {
  const i = store.orders.findIndex(o => String(o.id) === req.params.id);
  if (i < 0) return res.status(404).json({ error: "not found" });
  store.orders[i] = Object.assign({}, store.orders[i], req.body, { id: store.orders[i].id });
  save();
  const o = store.orders[i];
  if (SB_ON) { try { await sbUpsert("orders", [{ id: o.id, data: o, created_at: o.createdAt || Date.now() }]); } catch (e) { console.error("SB order update failed:", e.message); } }
  res.json(o);
});

// CUSTOMERS (profile / address upsert — never touches the password)
app.get("/api/customers", (req, res) => res.json(store.customers.map(publicCustomer)));
app.post("/api/customers", async (req, res) => {
  const c = req.body || {};
  const key = String(c.phone || c.email || "").trim().toLowerCase();
  let target = null;
  if (key) target = store.customers.find(x => (String(x.phone || "").trim().toLowerCase() === key) || (String(x.email || "").trim().toLowerCase() === key));
  if (target) {
    if (c.name) target.name = c.name;
    if (c.address) target.address = c.address;
    if (c.email && !target.email) target.email = String(c.email).trim().toLowerCase();
    if (c.phone && !target.phone) target.phone = String(c.phone).trim();
  } else {
    target = { id: c.id || rid("CUST"), name: c.name || "", email: String(c.email || "").trim().toLowerCase(), phone: String(c.phone || "").trim(), address: c.address || "", createdAt: Date.now() };
    store.customers.unshift(target);
  }
  save();
  if (SB_ON) {
    try { await sbUpsert("customers", [{ id: target.id, name: target.name, email: target.email, phone: target.phone, address: target.address, created_at: target.createdAt }]); }
    catch (e) { console.error("SB customer upsert failed:", e.message); }
  }
  res.json(publicCustomer(target));
});

// SETTINGS (global storefront flags — e.g. "Coming Soon" price mode; stored in Supabase)
app.get("/api/settings", (req, res) => res.json(store.settings || {}));
app.put("/api/settings", async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return res.status(400).json({ error: "expected object" });
  store.settings = Object.assign({}, store.settings, req.body);
  save();
  if (SB_ON) { try { await sbUpsert("settings", [{ id: "global", data: store.settings }]); } catch (e) { console.error("SB settings upsert failed:", e.message); } }
  res.json(store.settings);
});

// RAZORPAY
app.get("/api/razorpay/config", (req, res) => res.json({ keyId: RZP_KEY_ID, enabled: !!RZP_KEY_SECRET }));
app.post("/api/razorpay/order", async (req, res) => {
  try {
    if (!RZP_KEY_SECRET) return res.status(500).json({ error: "Razorpay secret not configured (set RAZORPAY_KEY_SECRET in Railway)" });
    var rupees = Math.max(1, Math.round(Number(req.body && req.body.amount) || 0));
    var auth = "Basic " + Buffer.from(RZP_KEY_ID + ":" + RZP_KEY_SECRET).toString("base64");
    var rr = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": auth },
      body: JSON.stringify({ amount: rupees * 100, currency: "INR", receipt: "rcpt_" + Date.now() })
    });
    var data = await rr.json();
    if (!rr.ok) return res.status(400).json({ error: (data && data.error && data.error.description) || "order failed" });
    res.json({ id: data.id, amount: data.amount, currency: data.currency, keyId: RZP_KEY_ID });
  } catch (e) { res.status(500).json({ error: String(e && e.message || e) }); }
});
app.post("/api/razorpay/verify", (req, res) => {
  try {
    var b = req.body || {};
    if (!RZP_KEY_SECRET) return res.status(500).json({ ok: false });
    var expected = crypto.createHmac("sha256", RZP_KEY_SECRET)
      .update(String(b.razorpay_order_id) + "|" + String(b.razorpay_payment_id)).digest("hex");
    res.json({ ok: expected === b.razorpay_signature });
  } catch (e) { res.status(500).json({ ok: false, error: String(e && e.message || e) }); }
});

app.get("/api/health", (req, res) => res.json({ ok: true, dataDir: DATA_DIR, supabase: SB_ON, razorpay: !!RZP_KEY_SECRET, volumePath: process.env.RAILWAY_VOLUME_MOUNT_PATH || null, persisted: STORE_EXISTED_ON_BOOT, products: store.products.length, orders: store.orders.length, customers: store.customers.length }));

/* ---------- static site ---------- */
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index2.html")));
app.use(express.static(__dirname, { extensions: ["html"] }));
app.use((req, res) => res.sendFile(path.join(__dirname, "index2.html")));

app.listen(PORT, () => {
  console.log("🌸 Ambika Flowers live on port " + PORT + " | data: " + DATA_DIR + " | supabase: " + SB_ON);
  loadFromSupabase();
});
