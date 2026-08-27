/* Ambika Flowers — static site + tiny JSON database API (for Railway)
   Data is stored in a JSON file so products, orders and customers are SHARED
   across every visitor and the admin panel (unlike the old per-browser storage).
   For the data to survive redeploys, attach a Railway Volume and mount it at the
   path in DATA_DIR (default /data). Without a volume the site still works, but
   data resets on each redeploy. */
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------- data store ---------- */
// Prefer the Railway volume's real mount path so data persists wherever the
// volume was attached (RAILWAY_VOLUME_MOUNT_PATH is set automatically by Railway).
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
function writeStore(store) {
  const tmp = STORE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 1));
  fs.renameSync(tmp, STORE_FILE);
}
let store = readStore();
if (!store || typeof store !== "object") store = {};
if (!Array.isArray(store.products) || store.products.length === 0) store.products = loadSeed();
if (!Array.isArray(store.orders)) store.orders = [];
if (!Array.isArray(store.customers)) store.customers = [];
// Keep product photos in sync with the bundled catalogue by id, so image swaps
// (e.g. new Vermala photos) deploy without wiping orders/customers. Only the image
// is refreshed here; prices/stock/edits stay as they are in the store.
(function () {
  var byId = {}; loadSeed().forEach(function (p) { byId[p.id] = p; });
  store.products.forEach(function (p) { var s = byId[p.id]; if (s && s.image && p.image !== s.image) p.image = s.image; });
})();
writeStore(store);
function save() { try { writeStore(store); } catch (e) { console.error("store write failed", e); } }
function rid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ---------- CORS ---------- */
// The frontend is hosted separately (Vercel) and calls this API cross-origin.
// No cookies/credentials are used, so a permissive origin is safe here.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* ---------- API ---------- */
app.use(express.json({ limit: "2mb" }));

// PRODUCTS
app.get("/api/products", (req, res) => res.json(store.products));
app.put("/api/products", (req, res) => {                 // replace whole list (admin bulk save)
  if (!Array.isArray(req.body)) return res.status(400).json({ error: "expected array" });
  store.products = req.body; save(); res.json({ ok: true, count: store.products.length });
});
app.post("/api/products", (req, res) => {                // add one
  const p = req.body || {}; if (!p.id) p.id = rid("PRD");
  store.products.unshift(p); save(); res.json(p);
});
app.put("/api/products/:id", (req, res) => {             // update one
  const i = store.products.findIndex(p => String(p.id) === req.params.id);
  if (i < 0) return res.status(404).json({ error: "not found" });
  store.products[i] = Object.assign({}, store.products[i], req.body, { id: store.products[i].id });
  save(); res.json(store.products[i]);
});
app.delete("/api/products/:id", (req, res) => {          // delete one
  const before = store.products.length;
  store.products = store.products.filter(p => String(p.id) !== req.params.id);
  save(); res.json({ ok: true, removed: before - store.products.length });
});

// ORDERS
app.get("/api/orders", (req, res) => res.json(store.orders));
app.post("/api/orders", (req, res) => {
  const o = req.body || {}; if (!o.id) o.id = rid("ORD");
  if (!o.createdAt) o.createdAt = Date.now();
  if (!o.status) o.status = "New";
  store.orders.unshift(o); save(); res.json(o);
});
app.put("/api/orders/:id", (req, res) => {
  const i = store.orders.findIndex(o => String(o.id) === req.params.id);
  if (i < 0) return res.status(404).json({ error: "not found" });
  store.orders[i] = Object.assign({}, store.orders[i], req.body, { id: store.orders[i].id });
  save(); res.json(store.orders[i]);
});

// CUSTOMERS
app.get("/api/customers", (req, res) => res.json(store.customers));
app.post("/api/customers", (req, res) => {
  const c = req.body || {};
  const key = (c.phone || c.email || "").trim().toLowerCase();
  if (key) {                                             // upsert by phone/email so signups don't duplicate
    const i = store.customers.findIndex(x => ((x.phone || x.email || "").trim().toLowerCase()) === key);
    if (i >= 0) { store.customers[i] = Object.assign({}, store.customers[i], c, { id: store.customers[i].id }); save(); return res.json(store.customers[i]); }
  }
  if (!c.id) c.id = rid("CUST");
  if (!c.createdAt) c.createdAt = Date.now();
  store.customers.unshift(c); save(); res.json(c);
});

app.get("/api/health", (req, res) => res.json({ ok: true, dataDir: DATA_DIR, volumePath: process.env.RAILWAY_VOLUME_MOUNT_PATH || null, persisted: STORE_EXISTED_ON_BOOT, products: store.products.length, orders: store.orders.length, customers: store.customers.length }));

/* ---------- static site ---------- */
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index2.html")));
app.use(express.static(__dirname, { extensions: ["html"] }));
app.use((req, res) => res.sendFile(path.join(__dirname, "index2.html")));

app.listen(PORT, () => console.log("🌸 Ambika Flowers live on port " + PORT + " | data: " + DATA_DIR));
