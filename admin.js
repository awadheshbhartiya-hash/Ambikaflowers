/* ==========================================================================
   Ambika Flowers — Admin Dashboard engine (vanilla JS, mock data)
   ========================================================================== */
(function () {
  "use strict";

  /* One-time reset: clear demo/seed data so the panel starts LIVE at zero.
     Real products you uploaded (custom) are preserved. Runs once per browser. */
  try {
    if (!localStorage.getItem("ambika_live_v1")) {
      ["ambika_orders", "ambika_carts", "ambika_leads", "ambika_activity"].forEach(function (k) { localStorage.removeItem(k); });
      try {
        var _pr = JSON.parse(localStorage.getItem("ambika_products")) || [];
        var _keep = _pr.filter(function (p) { return p && p.custom; });
        if (_keep.length) localStorage.setItem("ambika_products", JSON.stringify(_keep));
        else localStorage.removeItem("ambika_products");
      } catch (e2) {}
      localStorage.setItem("ambika_live_v1", "1");
    }
  } catch (e) {}

  /* ------------------------------------------------------------------ */
  /* DATA (live — no dummy seeds)                                        */
  /* ------------------------------------------------------------------ */
  var PRODUCTS_POOL = [
    "Red Rose Bouquet", "Mixed Flower Bouquet", "Purple Balloon Basket", "Rose Vermala Set",
    "Chocolate Bouquet", "Fortuner Car Decor", "Bridal Rose Garland", "Sunflower Bunch",
    "Money Bouquet", "Teddy Bear Bouquet", "Anniversary Room Decor", "Haldi Stage Setup"
  ];
  var CATEGORIES = ["Bouquet", "Hamper", "Vermala", "Car Decor", "Event Decor", "Balloon", "Flower Jewelry"];
  var CITIES = ["Sikar", "Jaipur", "Delhi", "Bikaner", "Ajmer", "Churu", "Reengus"];
  var METHODS = ["UPI", "Card", "Net Banking", "COD"];
  var FIRST = ["Aarav","Diya","Vivaan","Ananya","Kabir","Isha","Rohan","Priya","Arjun","Meera","Kunal","Sneha","Rahul","Nisha","Vikram","Pooja"];
  var LAST = ["Sharma","Verma","Gupta","Agarwal","Singh","Jain","Meena","Tiwari","Soni","Khandelwal"];

  function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(arr) { return arr[rand(0, arr.length - 1)]; }
  function inr(n) { return "₹" + Number(n).toLocaleString("en-IN"); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function daysAgo(d) { var t = new Date(); t.setDate(t.getDate() - d); return t; }
  function fmtDate(dt) { return pad(dt.getDate()) + " " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][dt.getMonth()] + " " + dt.getFullYear(); }
  function fmtDT(dt) { var h = dt.getHours(), m = dt.getMinutes(); var ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return fmtDate(dt) + ", " + pad(h) + ":" + pad(m) + " " + ap; }

  function fullName() { return pick(FIRST) + " " + pick(LAST); }
  function initials(n) { var p = n.split(" "); return (p[0][0] + (p[1] ? p[1][0] : "")).toUpperCase(); }
  function email(n) { return n.toLowerCase().replace(/\s+/g, ".") + "@gmail.com"; }
  function phone() { return "+91 " + rand(70, 99) + rand(100, 999) + " " + rand(10000, 99999); }

  var FLORAL = ["Order Received", "Arranging Flowers", "Out for Delivery", "Delivered"];
  var ORDER_STATUSES = FLORAL.concat(["Cancelled"]);
  function deriveStatus(o) { return o.statusIdx === "Cancelled" ? "Cancelled" : (FLORAL[o.statusIdx] || "Order Received"); }
  function saveOrders() { try { localStorage.setItem("ambika_orders", JSON.stringify(orders)); } catch (e) {} }
  var GREETINGS = [
    "Happy Birthday! May your day bloom with joy 🌸",
    "Congratulations on your big day! ❤️",
    "Thinking of you always. With love.",
    "Get well soon! Sending fresh blooms 💐",
    "Happy Anniversary to the lovely couple!",
    "Just because you're amazing 🌷"
  ];
  var SLOTS = ["9 AM – 12 PM", "12 PM – 3 PM", "3 PM – 6 PM", "6 PM – 9 PM"];

  // Customers — built live from real registered users (no dummy data)
  var customers = [];
  (function () {
    // A signed-in shopper (ambika_user) shows up as your first real customer
    var u = null; try { u = JSON.parse(localStorage.getItem("ambika_user")); } catch (e) {}
    if (u && (u.email || u.phone)) {
      var ords = (function () { try { return (JSON.parse(localStorage.getItem("ambika_orders")) || []); } catch (e) { return []; } })();
      var mine = ords.filter(function (o) { return (u.phone && o.phone === u.phone) || (u.name && o.customer === u.name); });
      customers.push({
        id: "CUS1001", name: u.name || "Customer", email: u.email || "—", phone: u.phone || "—",
        orders: mine.length, ltv: mine.reduce(function (s, o) { return s + (+o.amount || 0); }, 0),
        last: new Date(), city: "Sikar", status: "Active"
      });
    }
  })();

  // Transactions are derived from real orders (kept empty)
  var transactions = [];

  // Orders — shared with storefront tracker via localStorage("ambika_orders")
  var orders = (function () {
    var existing = null; try { existing = JSON.parse(localStorage.getItem("ambika_orders")); } catch (e) {}
    if (existing && existing.length) {
      existing.forEach(function (o) {
        if (o.statusIdx === undefined) o.statusIdx = FLORAL.indexOf(o.status) >= 0 ? FLORAL.indexOf(o.status) : 0;
        o.status = deriveStatus(o);
        if (!o.greeting) o.greeting = pick(GREETINGS);
        if (!o.slot) o.slot = pick(SLOTS);
        if (!o.placed) o.placed = o.date || fmtDate(daysAgo(rand(0, 10)));
        if (!o.deliveryDate || typeof o.deliveryDate !== "string") o.deliveryDate = fmtDate(daysAgo(-rand(0, 6)));
      });
      return existing;
    }
    return []; // start empty — real orders arrive from the storefront checkout
  })();

  // Products — shared with the storefront via localStorage("ambika_products").
  // The storefront homepage already shows these 6 as hardcoded cards; we mirror them
  // here so the admin catalogue is never empty. They are display defaults only — not
  // written to localStorage and not marked custom, so the storefront never duplicates
  // them. Once the shopkeeper edits/adds a product, the whole list is saved.
  var DEFAULT_CATALOG = [
    { id: "P001", title: "Grand Rose Bouquet", category: "Bouquet", price: 699, discount: 0, stock: 25, tags: "rose", image: "products/WhatsApp Image 2026-08-20 at 12.36.15 PM (1).jpeg", custom: false },
    { id: "P002", title: "Pink Rose Bouquet", category: "Bouquet", price: 549, discount: 0, stock: 25, tags: "rose", image: "products/WhatsApp Image 2026-08-20 at 12.36.15 PM (2).jpeg", custom: false },
    { id: "P003", title: "Classic Rose Bouquet", category: "Bouquet", price: 399, discount: 0, stock: 25, tags: "rose", image: "products/WhatsApp Image 2026-08-20 at 12.36.20 PM.jpeg", custom: false },
    { id: "P004", title: "Red Rose Special", category: "Bouquet", price: 499, discount: 0, stock: 25, tags: "rose", image: "products/WhatsApp Image 2026-08-20 at 12.36.23 PM (1).jpeg", custom: false },
    { id: "P005", title: "Wrapped Rose Bouquet", category: "Bouquet", price: 449, discount: 0, stock: 25, tags: "rose", image: "products/WhatsApp Image 2026-08-20 at 12.36.25 PM (2).jpeg", custom: false },
    { id: "P006", title: "Premium Rose Arrangement", category: "Bouquet", price: 599, discount: 0, stock: 25, tags: "rose", image: "products/WhatsApp Image 2026-08-20 at 12.36.26 PM.jpeg", custom: false },
    { id: "P007", title: "Luxury Rose Bouquet", category: "Bouquet", price: 649, discount: 0, stock: 25, tags: "rose", image: "products/WhatsApp Image 2026-08-20 at 12.36.26 PM (1).jpeg", custom: false },
    { id: "P008", title: "Designer Rose Bouquet", category: "Bouquet", price: 799, discount: 0, stock: 25, tags: "rose", image: "products/WhatsApp Image 2026-08-20 at 12.36.45 PM (1).jpeg", custom: false },
    { id: "P009", title: "Signature Rose Bouquet", category: "Bouquet", price: 899, discount: 0, stock: 25, tags: "rose", image: "products/WhatsApp Image 2026-08-20 at 12.36.54 PM (1).jpeg", custom: false },
    { id: "P010", title: "Pink Rose Hand Tied", category: "Bouquet", price: 749, discount: 0, stock: 25, tags: "rose", image: "products/WhatsApp Image 2026-08-20 at 12.41.37 PM.jpeg", custom: false },
    { id: "P011", title: "Fresh Rose Bunch", category: "Bouquet", price: 549, discount: 0, stock: 25, tags: "rose", image: "products/WhatsApp Image 2026-08-20 at 12.41.41 PM.jpeg", custom: false },
    { id: "P012", title: "Rose Bouquet Classic", category: "Bouquet", price: 499, discount: 0, stock: 25, tags: "rose", image: "products/WhatsApp Image 2026-08-20 at 12.42.23 PM.jpeg", custom: false },
    { id: "P013", title: "Pink Rose Bouquet", category: "Bouquet", price: 599, discount: 0, stock: 25, tags: "rose", image: "products/WhatsApp Image 2026-08-20 at 12.42.35 PM (1).jpeg", custom: false },
    { id: "P014", title: "White Rose Bouquet", category: "Bouquet", price: 649, discount: 0, stock: 25, tags: "rose", image: "products/WhatsApp Image 2026-08-20 at 12.42.39 PM (2).jpeg", custom: false },
    { id: "P015", title: "Rose & Ferrero Rocher Bouquet", category: "Bouquet", price: 999, discount: 0, stock: 25, tags: "rose", image: "products/WhatsApp Image 2026-08-20 at 12.42.40 PM (1).jpeg", custom: false },
    { id: "P016", title: "Mixed Flower Bouquet", category: "Bouquet", price: 549, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.36.16 PM.jpeg", custom: false },
    { id: "P017", title: "Colorful Mix Bouquet", category: "Bouquet", price: 649, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.36.16 PM (1).jpeg", custom: false },
    { id: "P018", title: "Spring Mix Bouquet", category: "Bouquet", price: 499, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.36.40 PM (1).jpeg", custom: false },
    { id: "P019", title: "Seasonal Mix Bouquet", category: "Bouquet", price: 599, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.36.44 PM (2).jpeg", custom: false },
    { id: "P020", title: "Wildflower Bouquet", category: "Bouquet", price: 549, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.36.48 PM.jpeg", custom: false },
    { id: "P021", title: "Pastel Mix Bouquet", category: "Bouquet", price: 699, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.36.48 PM (2).jpeg", custom: false },
    { id: "P022", title: "Garden Fresh Bouquet", category: "Bouquet", price: 449, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.36.49 PM.jpeg", custom: false },
    { id: "P023", title: "Tropical Mix Bouquet", category: "Bouquet", price: 499, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.36.50 PM.jpeg", custom: false },
    { id: "P024", title: "Vibrant Mix Bouquet", category: "Bouquet", price: 599, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.36.54 PM.jpeg", custom: false },
    { id: "P025", title: "Bloom Mix Bouquet", category: "Bouquet", price: 749, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.36.54 PM (2).jpeg", custom: false },
    { id: "P026", title: "Floral Fantasy Bouquet", category: "Bouquet", price: 649, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.41.37 PM (1).jpeg", custom: false },
    { id: "P027", title: "Pink Tulip Bouquet", category: "Bouquet", price: 799, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.41.44 PM.jpeg", custom: false },
    { id: "P028", title: "White Rose Black Wrap", category: "Bouquet", price: 549, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.42.13 PM.jpeg", custom: false },
    { id: "P029", title: "Gerbera Carnation Bouquet", category: "Bouquet", price: 599, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.42.17 PM (1).jpeg", custom: false },
    { id: "P030", title: "Purple Chrysanthemum Bouquet", category: "Bouquet", price: 899, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.42.25 PM.jpeg", custom: false },
    { id: "P031", title: "Sunflower Bouquet", category: "Bouquet", price: 649, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.42.29 PM.jpeg", custom: false },
    { id: "P032", title: "Pink Roses & Carnations", category: "Bouquet", price: 599, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.42.36 PM.jpeg", custom: false },
    { id: "P033", title: "Alstroemeria Mix Bouquet", category: "Bouquet", price: 749, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.42.39 PM (1).jpeg", custom: false },
    { id: "P034", title: "Red Rose Lily Bouquet", category: "Bouquet", price: 699, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.42.40 PM.jpeg", custom: false },
    { id: "P035", title: "Red Lily Carnation Bouquet", category: "Bouquet", price: 799, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.42.41 PM.jpeg", custom: false },
    { id: "P036", title: "Pink Lily Carnation Bouquet", category: "Bouquet", price: 749, discount: 0, stock: 25, tags: "mixed", image: "products/WhatsApp Image 2026-08-20 at 12.42.41 PM (2).jpeg", custom: false },
    { id: "P037", title: "Grand Luxury Bouquet", category: "Bouquet", price: 1499, discount: 0, stock: 25, tags: "grand", image: "products/WhatsApp Image 2026-08-20 at 12.36.15 PM.jpeg", custom: false },
    { id: "P038", title: "Grand Mixed Bouquet", category: "Bouquet", price: 1299, discount: 0, stock: 25, tags: "grand", image: "products/WhatsApp Image 2026-08-20 at 12.36.16 PM (2).jpeg", custom: false },
    { id: "P039", title: "Royal Grand Bouquet", category: "Bouquet", price: 1999, discount: 0, stock: 25, tags: "grand", image: "products/WhatsApp Image 2026-08-20 at 12.36.28 PM (1).jpeg", custom: false },
    { id: "P040", title: "Premium Grand Bouquet", category: "Bouquet", price: 1799, discount: 0, stock: 25, tags: "grand", image: "products/WhatsApp Image 2026-08-20 at 12.36.37 PM.jpeg", custom: false },
    { id: "P041", title: "Signature Grand Bouquet", category: "Bouquet", price: 2499, discount: 0, stock: 25, tags: "grand", image: "products/WhatsApp Image 2026-08-20 at 12.37.03 PM (1).jpeg", custom: false },
    { id: "P042", title: "100 Red Roses Grand Bouquet", category: "Bouquet", price: 2999, discount: 0, stock: 25, tags: "grand", image: "products/WhatsApp Image 2026-08-20 at 12.41.44 PM (1).jpeg", custom: false },
    { id: "P043", title: "50+ Red Roses Black Wrap", category: "Bouquet", price: 3499, discount: 0, stock: 25, tags: "grand", image: "products/WhatsApp Image 2026-08-20 at 12.41.46 PM.jpeg", custom: false },
    { id: "P044", title: "Ambika Signature Grand", category: "Bouquet", price: 1999, discount: 0, stock: 25, tags: "grand", image: "products/WhatsApp Image 2026-08-20 at 12.41.48 PM.jpeg", custom: false },
    { id: "P045", title: "100 Mixed Roses Grand Bouquet", category: "Bouquet", price: 4999, discount: 0, stock: 25, tags: "grand", image: "products/WhatsApp Image 2026-08-20 at 12.42.37 PM.jpeg", custom: false },
    { id: "P046", title: "50 Pink Roses Top View", category: "Bouquet", price: 2499, discount: 0, stock: 25, tags: "grand", image: "products/WhatsApp Image 2026-08-20 at 12.42.19 PM (1).jpeg", custom: false },
    { id: "P047", title: "Mini Rose Bouquet", category: "Bouquet", price: 299, discount: 0, stock: 25, tags: "small", image: "products/WhatsApp Image 2026-08-20 at 12.36.26 PM (2).jpeg", custom: false },
    { id: "P048", title: "Sweet Mini Bouquet", category: "Bouquet", price: 249, discount: 0, stock: 25, tags: "small", image: "products/WhatsApp Image 2026-08-20 at 12.36.26 PM (3).jpeg", custom: false },
    { id: "P049", title: "Coral Pink Roses", category: "Bouquet", price: 699, discount: 0, stock: 25, tags: "small", image: "products/WhatsApp Image 2026-08-20 at 12.42.19 PM.jpeg", custom: false },
    { id: "P050", title: "Dried Boho Bouquet", category: "Bouquet", price: 349, discount: 0, stock: 25, tags: "small", image: "products/WhatsApp Image 2026-08-20 at 12.42.25 PM (1).jpeg", custom: false },
    { id: "P051", title: "Boho Dried Flower Bouquet", category: "Bouquet", price: 449, discount: 0, stock: 25, tags: "small", image: "products/WhatsApp Image 2026-08-20 at 12.42.25 PM (2).jpeg", custom: false },
    { id: "P052", title: "Single Sunflower", category: "Bouquet", price: 249, discount: 0, stock: 25, tags: "small", image: "products/WhatsApp Image 2026-08-20 at 12.42.32 PM (1).jpeg", custom: false },
    { id: "P053", title: "Pink Money Bouquet", category: "Bouquet", price: 599, discount: 0, stock: 25, tags: "money", image: "products/WhatsApp Image 2026-08-20 at 12.36.32 PM (1).jpeg", custom: false },
    { id: "P054", title: "Peach Money Bouquet", category: "Bouquet", price: 1099, discount: 0, stock: 25, tags: "money", image: "products/WhatsApp Image 2026-08-20 at 12.36.34 PM.jpeg", custom: false },
    { id: "P055", title: "Black Money Bouquet", category: "Bouquet", price: 1499, discount: 0, stock: 25, tags: "money", image: "products/WhatsApp Image 2026-08-20 at 12.36.34 PM (1).jpeg", custom: false },
    { id: "P056", title: "White Money Bouquet", category: "Bouquet", price: 499, discount: 0, stock: 25, tags: "money", image: "products/WhatsApp Image 2026-08-20 at 12.36.36 PM.jpeg", custom: false },
    { id: "P057", title: "Grey Money Bouquet", category: "Bouquet", price: 1799, discount: 0, stock: 25, tags: "money", image: "products/WhatsApp Image 2026-08-20 at 12.36.36 PM (1).jpeg", custom: false },
    { id: "P058", title: "Purple Money Bouquet", category: "Bouquet", price: 1999, discount: 0, stock: 25, tags: "money", image: "products/WhatsApp Image 2026-08-20 at 12.36.36 PM (2).jpeg", custom: false },
    { id: "P059", title: "Money Bouquet Premium", category: "Bouquet", price: 1199, discount: 0, stock: 25, tags: "money", image: "products/WhatsApp Image 2026-08-20 at 12.42.32 PM.jpeg", custom: false },
    { id: "P060", title: "Choco Delight Bouquet", category: "Bouquet", price: 399, discount: 0, stock: 25, tags: "choco", image: "products/WhatsApp Image 2026-08-20 at 12.36.20 PM (1).jpeg", custom: false },
    { id: "P061", title: "Chocolate Bouquet Classic", category: "Bouquet", price: 599, discount: 0, stock: 25, tags: "choco", image: "products/WhatsApp Image 2026-08-20 at 12.36.25 PM.jpeg", custom: false },
    { id: "P062", title: "Sweet Chocolate Bouquet", category: "Bouquet", price: 499, discount: 0, stock: 25, tags: "choco", image: "products/WhatsApp Image 2026-08-20 at 12.36.41 PM.jpeg", custom: false },
    { id: "P063", title: "Choco Love Bouquet", category: "Bouquet", price: 649, discount: 0, stock: 25, tags: "choco", image: "products/WhatsApp Image 2026-08-20 at 12.36.43 PM.jpeg", custom: false },
    { id: "P064", title: "Chocolate Tower Bouquet", category: "Bouquet", price: 799, discount: 0, stock: 25, tags: "choco", image: "products/WhatsApp Image 2026-08-20 at 12.36.44 PM.jpeg", custom: false },
    { id: "P065", title: "Premium Chocolate Bouquet", category: "Bouquet", price: 999, discount: 0, stock: 25, tags: "choco", image: "products/WhatsApp Image 2026-08-20 at 12.36.46 PM.jpeg", custom: false },
    { id: "P066", title: "Choco Roses Bouquet", category: "Bouquet", price: 749, discount: 0, stock: 25, tags: "choco", image: "products/WhatsApp Image 2026-08-20 at 12.36.51 PM.jpeg", custom: false },
    { id: "P067", title: "Chocolate Basket Bouquet", category: "Bouquet", price: 449, discount: 0, stock: 25, tags: "choco", image: "products/WhatsApp Image 2026-08-20 at 12.36.55 PM.jpeg", custom: false },
    { id: "P068", title: "Dairy Milk Rose Bouquet", category: "Bouquet", price: 549, discount: 0, stock: 25, tags: "choco", image: "products/WhatsApp Image 2026-08-20 at 12.42.22 PM.jpeg", custom: false },
    { id: "P069", title: "Dairy Milk KitKat Bouquet", category: "Bouquet", price: 399, discount: 0, stock: 25, tags: "choco", image: "products/WhatsApp Image 2026-08-20 at 12.42.26 PM.jpeg", custom: false },
    { id: "P070", title: "KitKat 5Star Bouquet", category: "Bouquet", price: 349, discount: 0, stock: 25, tags: "choco", image: "products/WhatsApp Image 2026-08-20 at 12.42.26 PM (1).jpeg", custom: false },
    { id: "P071", title: "Kinder Joy Bouquet", category: "Bouquet", price: 299, discount: 0, stock: 25, tags: "choco", image: "products/WhatsApp Image 2026-08-20 at 12.42.35 PM.jpeg", custom: false },
    { id: "P072", title: "iPhone Chocolate Gift Tray", category: "Hamper", price: 2999, discount: 0, stock: 25, tags: "gift-hamper", image: "products/WhatsApp Image 2026-08-21 at 9.18.22 PM.jpeg", custom: false },
    { id: "P073", title: "Luxury Chocolate Gift Box", category: "Hamper", price: 1499, discount: 0, stock: 25, tags: "gift-hamper", image: "products/WhatsApp Image 2026-08-21 at 9.18.09 PM.jpeg", custom: false },
    { id: "P074", title: "Birthday Gift Hamper", category: "Hamper", price: 699, discount: 0, stock: 25, tags: "gift-hamper", image: "products/WhatsApp Image 2026-08-20 at 12.41.40 PM.jpeg", custom: false },
    { id: "P075", title: "Rose Box Hamper", category: "Hamper", price: 849, discount: 0, stock: 25, tags: "gift-hamper", image: "products/WhatsApp Image 2026-08-20 at 12.42.17 PM (2).jpeg", custom: false },
    { id: "P076", title: "Pink Hat Box", category: "Hamper", price: 949, discount: 0, stock: 25, tags: "gift-hamper", image: "products/WhatsApp Image 2026-08-20 at 12.42.18 PM.jpeg", custom: false },
    { id: "P077", title: "Ferrero Rocher Basket", category: "Hamper", price: 1199, discount: 0, stock: 25, tags: "chocolate-hamper", image: "products/WhatsApp Image 2026-08-20 at 12.42.23 PM (1).jpeg", custom: false },
    { id: "P078", title: "Chocolate Flower Basket", category: "Hamper", price: 899, discount: 0, stock: 25, tags: "chocolate-hamper", image: "products/WhatsApp Image 2026-08-20 at 12.42.31 PM.jpeg", custom: false },
    { id: "P079", title: "Rose Chocolate Basket", category: "Hamper", price: 699, discount: 0, stock: 25, tags: "chocolate-hamper", image: "products/WhatsApp Image 2026-08-20 at 12.42.31 PM (1).jpeg", custom: false },
    { id: "P080", title: "Fresh Flower Hamper", category: "Hamper", price: 799, discount: 0, stock: 25, tags: "flower-hamper", image: "products/WhatsApp Image 2026-08-20 at 12.36.48 PM (1).jpeg", custom: false },
    { id: "P081", title: "Classic Rose Vermala", category: "Vermala", price: 399, discount: 0, stock: 25, tags: "rose-vermala", image: "products/WhatsApp Image 2026-08-20 at 12.36.27 PM (1).jpeg", custom: false },
    { id: "P082", title: "Red Rose Vermala", category: "Vermala", price: 499, discount: 0, stock: 25, tags: "rose-vermala", image: "products/WhatsApp Image 2026-08-20 at 12.36.55 PM (2).jpeg", custom: false },
    { id: "P083", title: "Premium Rose Vermala", category: "Vermala", price: 649, discount: 0, stock: 25, tags: "rose-vermala", image: "products/WhatsApp Image 2026-08-20 at 12.36.58 PM (1).jpeg", custom: false },
    { id: "P084", title: "Bridal Rose Vermala", category: "Vermala", price: 799, discount: 0, stock: 25, tags: "rose-vermala", image: "products/WhatsApp Image 2026-08-20 at 12.41.36 PM.jpeg", custom: false },
    { id: "P085", title: "Rose Garland Pair", category: "Vermala", price: 549, discount: 0, stock: 25, tags: "rose-vermala", image: "products/WhatsApp Image 2026-08-20 at 12.41.38 PM (1).jpeg", custom: false },
    { id: "P086", title: "Luxury Rose Vermala", category: "Vermala", price: 699, discount: 0, stock: 25, tags: "rose-vermala", image: "products/WhatsApp Image 2026-08-20 at 12.41.42 PM.jpeg", custom: false },
    { id: "P087", title: "Rose Vermala Pair", category: "Vermala", price: 449, discount: 0, stock: 25, tags: "rose-vermala", image: "products/WhatsApp Image 2026-08-20 at 12.41.43 PM.jpeg", custom: false },
    { id: "P088", title: "Pink Rose Vermala Pair", category: "Vermala", price: 599, discount: 0, stock: 25, tags: "rose-vermala", image: "products/WhatsApp Image 2026-08-20 at 12.42.09 PM (1).jpeg", custom: false },
    { id: "P089", title: "Pink White Vermala Set", category: "Vermala", price: 499, discount: 0, stock: 25, tags: "rose-vermala", image: "products/WhatsApp Image 2026-08-20 at 12.42.09 PM (2).jpeg", custom: false },
    { id: "P090", title: "Mixed Flower Garland", category: "Vermala", price: 349, discount: 0, stock: 25, tags: "mixed-flower-vermala", image: "products/WhatsApp Image 2026-08-20 at 12.36.28 PM.jpeg", custom: false },
    { id: "P091", title: "Floral Mix Vermala", category: "Vermala", price: 399, discount: 0, stock: 25, tags: "mixed-flower-vermala", image: "products/WhatsApp Image 2026-08-20 at 12.36.55 PM (1).jpeg", custom: false },
    { id: "P092", title: "Pink White Rose Vermala", category: "Vermala", price: 499, discount: 0, stock: 25, tags: "mixed-flower-vermala", image: "products/WhatsApp Image 2026-08-20 at 12.42.04 PM (1).jpeg", custom: false },
    { id: "P093", title: "Chrysanthemum Rose Vermala", category: "Vermala", price: 549, discount: 0, stock: 25, tags: "mixed-flower-vermala", image: "products/WhatsApp Image 2026-08-20 at 12.42.05 PM.jpeg", custom: false },
    { id: "P094", title: "Baby's Breath Vermala", category: "Vermala", price: 449, discount: 0, stock: 25, tags: "mixed-flower-vermala", image: "products/WhatsApp Image 2026-08-20 at 12.42.08 PM.jpeg", custom: false },
    { id: "P095", title: "Lotus Pink Vermala", category: "Vermala", price: 599, discount: 0, stock: 25, tags: "mixed-flower-vermala", image: "products/WhatsApp Image 2026-08-20 at 12.42.09 PM.jpeg", custom: false },
    { id: "P096", title: "Lotus Mogra Vermala", category: "Vermala", price: 299, discount: 0, stock: 25, tags: "mixed-flower-vermala", image: "products/WhatsApp Image 2026-08-20 at 12.41.43 PM (1).jpeg", custom: false },
    { id: "P097", title: "White Carnation Vermala", category: "Vermala", price: 399, discount: 0, stock: 25, tags: "mixed-flower-vermala", image: "products/WhatsApp Image 2026-08-20 at 12.42.12 PM (2).jpeg", custom: false },
    { id: "P098", title: "Triple Mogra Vermala", category: "Vermala", price: 199, discount: 0, stock: 25, tags: "mixed-flower-vermala", image: "products/WhatsApp Image 2026-08-20 at 12.42.12 PM (3).jpeg", custom: false },
    { id: "P099", title: "Thar Wedding Decor", category: "Car Decor", price: 3999, discount: 0, stock: 25, tags: "wedding-car", image: "products/WhatsApp Image 2026-08-20 at 12.41.41 PM (1).jpeg", custom: false },
    { id: "P100", title: "Fortuner Wedding Decor", category: "Car Decor", price: 4999, discount: 0, stock: 25, tags: "wedding-car", image: "products/WhatsApp Image 2026-08-20 at 12.42.10 PM (1).jpeg", custom: false },
    { id: "P101", title: "Fortuner Front Decor", category: "Car Decor", price: 3499, discount: 0, stock: 25, tags: "wedding-car", image: "products/WhatsApp Image 2026-08-20 at 12.42.10 PM (2).jpeg", custom: false },
    { id: "P102", title: "Classic Car Decor", category: "Car Decor", price: 999, discount: 0, stock: 25, tags: "simple-car-decor", image: "products/WhatsApp Image 2026-08-20 at 12.36.44 PM (1).jpeg", custom: false },
    { id: "P103", title: "Elegant Car Decor", category: "Car Decor", price: 1499, discount: 0, stock: 25, tags: "simple-car-decor", image: "products/WhatsApp Image 2026-08-20 at 12.36.49 PM (1).jpeg", custom: false },
    { id: "P104", title: "Premium Car Decor", category: "Car Decor", price: 1799, discount: 0, stock: 25, tags: "simple-car-decor", image: "products/WhatsApp Image 2026-08-20 at 12.37.00 PM.jpeg", custom: false },
    { id: "P105", title: "Simple Car Decor", category: "Car Decor", price: 1099, discount: 0, stock: 25, tags: "simple-car-decor", image: "products/WhatsApp Image 2026-08-20 at 12.37.01 PM (1).jpeg", custom: false },
    { id: "P106", title: "Floral Ring Decor", category: "Car Decor", price: 1299, discount: 0, stock: 25, tags: "simple-car-decor", image: "products/WhatsApp Image 2026-08-20 at 12.37.03 PM (2).jpeg", custom: false },
    { id: "P107", title: "Luxury Car Decor", category: "Car Decor", price: 2199, discount: 0, stock: 25, tags: "simple-car-decor", image: "products/WhatsApp Image 2026-08-20 at 12.37.04 PM.jpeg", custom: false },
    { id: "P108", title: "White Rose Car Decor", category: "Car Decor", price: 1599, discount: 0, stock: 25, tags: "simple-car-decor", image: "products/WhatsApp Image 2026-08-20 at 12.37.05 PM.jpeg", custom: false },
    { id: "P109", title: "Pink Ribbon Car Decor", category: "Car Decor", price: 1399, discount: 0, stock: 25, tags: "simple-car-decor", image: "products/WhatsApp Image 2026-08-20 at 12.37.05 PM (1).jpeg", custom: false },
    { id: "P110", title: "Grand Car Decor", category: "Car Decor", price: 2499, discount: 0, stock: 25, tags: "simple-car-decor", image: "products/WhatsApp Image 2026-08-20 at 12.37.05 PM (2).jpeg", custom: false },
    { id: "P111", title: "Designer Car Decor", category: "Car Decor", price: 1699, discount: 0, stock: 25, tags: "simple-car-decor", image: "products/WhatsApp Image 2026-08-20 at 12.37.06 PM.jpeg", custom: false },
    { id: "P112", title: "Rose Car Decor", category: "Car Decor", price: 1299, discount: 0, stock: 25, tags: "simple-car-decor", image: "products/WhatsApp Image 2026-08-20 at 12.41.40 PM (1).jpeg", custom: false },
    { id: "P113", title: "Fortuner Floral Decor", category: "Car Decor", price: 1899, discount: 0, stock: 25, tags: "simple-car-decor", image: "products/WhatsApp Image 2026-08-20 at 12.42.11 PM.jpeg", custom: false },
    { id: "P114", title: "Black SUV Decor", category: "Car Decor", price: 1499, discount: 0, stock: 25, tags: "simple-car-decor", image: "products/WhatsApp Image 2026-08-20 at 12.42.12 PM.jpeg", custom: false },
    { id: "P115", title: "White Toyota Decor", category: "Car Decor", price: 1599, discount: 0, stock: 25, tags: "simple-car-decor", image: "products/WhatsApp Image 2026-08-20 at 12.42.12 PM (1).jpeg", custom: false },
    { id: "P116", title: "Land Rover Decor", category: "Car Decor", price: 2999, discount: 0, stock: 25, tags: "simple-car-decor", image: "products/WhatsApp Image 2026-08-20 at 12.42.13 PM (1).jpeg", custom: false },
    { id: "P117", title: "Premium SUV Decor", category: "Car Decor", price: 2199, discount: 0, stock: 25, tags: "simple-car-decor", image: "products/WhatsApp Image 2026-08-20 at 12.42.22 PM (1).jpeg", custom: false },
    { id: "P118", title: "Fortuner Bonnet Garland", category: "Car Decor", price: 1499, discount: 0, stock: 25, tags: "new-car-delivery", image: "products/WhatsApp Image 2026-08-21 at 9.18.59 PM.jpeg", custom: false },
    { id: "P119", title: "BMW Bonnet Flower Decor", category: "Car Decor", price: 1299, discount: 0, stock: 25, tags: "new-car-delivery", image: "products/WhatsApp Image 2026-08-21 at 9.19.05 PM.jpeg", custom: false },
    { id: "P120", title: "Rose Garland Bonnet Decor", category: "Car Decor", price: 1599, discount: 0, stock: 25, tags: "new-car-delivery", image: "products/WhatsApp Image 2026-08-21 at 9.19.07 PM.jpeg", custom: false },
    { id: "P121", title: "Grand Stage Decor", category: "Event Decor", price: 14999, discount: 0, stock: 25, tags: "stage-decor", image: "products/WhatsApp Image 2026-08-20 at 12.36.58 PM.jpeg", custom: false },
    { id: "P122", title: "Floral Stage Setup", category: "Event Decor", price: 11999, discount: 0, stock: 25, tags: "stage-decor", image: "products/WhatsApp Image 2026-08-20 at 12.36.59 PM.jpeg", custom: false },
    { id: "P123", title: "Wedding Stage Decor", category: "Event Decor", price: 24999, discount: 0, stock: 25, tags: "stage-decor", image: "products/WhatsApp Image 2026-08-20 at 12.37.00 PM (1).jpeg", custom: false },
    { id: "P124", title: "Haldi Ceremony Decor", category: "Event Decor", price: 9999, discount: 0, stock: 25, tags: "stage-decor", image: "products/WhatsApp Image 2026-08-20 at 12.37.01 PM.jpeg", custom: false },
    { id: "P125", title: "Floral Table Centerpiece", category: "Event Decor", price: 2999, discount: 0, stock: 25, tags: "table-decor", image: "products/WhatsApp Image 2026-08-20 at 12.36.37 PM (1).jpeg", custom: false },
    { id: "P126", title: "Balloon Arch Setup", category: "Event Decor", price: 4999, discount: 0, stock: 25, tags: "balloon-decor", image: "products/WhatsApp Image 2026-08-20 at 12.36.40 PM (2).jpeg", custom: false },
    { id: "P127", title: "Balloon Decoration", category: "Event Decor", price: 3499, discount: 0, stock: 25, tags: "balloon-decor", image: "products/WhatsApp Image 2026-08-20 at 12.36.42 PM.jpeg", custom: false },
    { id: "P128", title: "Floral Entrance Gate", category: "Event Decor", price: 7999, discount: 0, stock: 25, tags: "entrance-decor", image: "products/WhatsApp Image 2026-08-20 at 12.37.05 PM (3).jpeg", custom: false },
    { id: "P129", title: "Rose Haath Phool Set", category: "Flower Jewelry", price: 599, discount: 0, stock: 25, tags: "wristlet", image: "products/WhatsApp Image 2026-08-20 at 12.37.03 PM.jpeg", custom: false },
    { id: "P130", title: "Bridal Wristlet Haath Phool", category: "Flower Jewelry", price: 399, discount: 0, stock: 25, tags: "wristlet", image: "products/WhatsApp Image 2026-08-20 at 12.41.37 PM (2).jpeg", custom: false },
    { id: "P131", title: "Bridal Hand Bouquet", category: "Flower Jewelry", price: 449, discount: 0, stock: 25, tags: "wristlet", image: "products/WhatsApp Image 2026-08-20 at 12.42.00 PM.jpeg", custom: false },
    { id: "P132", title: "Bridal Hair Flower Accessory", category: "Flower Jewelry", price: 349, discount: 0, stock: 25, tags: "hair", image: "products/WhatsApp Image 2026-08-20 at 12.41.38 PM.jpeg", custom: false },
    { id: "P133", title: "Purple Silver Balloon Arch", category: "Balloon", price: 2999, discount: 0, stock: 25, tags: "arch", image: "products/WhatsApp Image 2026-08-21 at 9.16.09 PM.jpeg", custom: false },
    { id: "P134", title: "Rose Gold Balloon Arch", category: "Balloon", price: 3499, discount: 0, stock: 25, tags: "arch", image: "products/WhatsApp Image 2026-08-21 at 9.16.09 PM (1).jpeg", custom: false },
    { id: "P135", title: "Pink Purple Balloon Arch", category: "Balloon", price: 2499, discount: 0, stock: 25, tags: "arch", image: "products/WhatsApp Image 2026-08-21 at 9.18.11 PM.jpeg", custom: false },
    { id: "P136", title: "Blue White Balloon Arch", category: "Balloon", price: 2999, discount: 0, stock: 25, tags: "arch", image: "products/WhatsApp Image 2026-08-21 at 9.18.12 PM.jpeg", custom: false },
    { id: "P137", title: "Birthday Bubble Balloon", category: "Balloon", price: 1499, discount: 0, stock: 25, tags: "birthday", image: "products/WhatsApp Image 2026-08-21 at 9.16.14 PM.jpeg", custom: false },
    { id: "P138", title: "Birthday Balloon Hamper", category: "Balloon", price: 1999, discount: 0, stock: 25, tags: "birthday", image: "products/WhatsApp Image 2026-08-21 at 9.16.14 PM (1).jpeg", custom: false },
    { id: "P139", title: "Birthday Balloon Decor", category: "Balloon", price: 1299, discount: 0, stock: 25, tags: "birthday", image: "products/WhatsApp Image 2026-08-21 at 9.16.14 PM (2).jpeg", custom: false },
    { id: "P140", title: "Car Birthday Balloon Arch", category: "Balloon", price: 1799, discount: 0, stock: 25, tags: "birthday", image: "products/WhatsApp Image 2026-08-21 at 9.16.15 PM.jpeg", custom: false },
    { id: "P141", title: "Birthday Balloon Setup", category: "Balloon", price: 2499, discount: 0, stock: 25, tags: "birthday", image: "products/WhatsApp Image 2026-08-21 at 9.16.15 PM (1).jpeg", custom: false },
    { id: "P142", title: "Baby Shower Balloon Stage", category: "Balloon", price: 3999, discount: 0, stock: 25, tags: "baby-shower", image: "products/WhatsApp Image 2026-08-21 at 9.18.38 PM.jpeg", custom: false },
    { id: "P143", title: "Birthday Balloon Bouquet", category: "Bouquet", price: 499, discount: 0, stock: 25, tags: "birthday-balloon", image: "products/WhatsApp Image 2026-08-20 at 12.36.17 PM.jpeg", custom: false },
    { id: "P144", title: "Happy Birthday Balloons", category: "Bouquet", price: 399, discount: 0, stock: 25, tags: "birthday-balloon", image: "products/WhatsApp Image 2026-08-20 at 12.36.17 PM (1).jpeg", custom: false },
    { id: "P145", title: "Birthday Balloon Decor", category: "Bouquet", price: 599, discount: 0, stock: 25, tags: "birthday-balloon", image: "products/WhatsApp Image 2026-08-20 at 12.36.17 PM (2).jpeg", custom: false },
    { id: "P146", title: "Party Balloon Set", category: "Bouquet", price: 699, discount: 0, stock: 25, tags: "birthday-balloon", image: "products/WhatsApp Image 2026-08-20 at 12.36.27 PM.jpeg", custom: false },
    { id: "P147", title: "Birthday Balloon Arch", category: "Bouquet", price: 999, discount: 0, stock: 25, tags: "birthday-balloon", image: "products/WhatsApp Image 2026-08-20 at 12.36.31 PM (1).jpeg", custom: false },
    { id: "P148", title: "Balloon Surprise Setup", category: "Bouquet", price: 1499, discount: 0, stock: 25, tags: "birthday-balloon", image: "products/WhatsApp Image 2026-08-20 at 12.36.45 PM (2).jpeg", custom: false },
    { id: "P149", title: "Birthday Special Hamper", category: "Bouquet", price: 799, discount: 0, stock: 25, tags: "birthday-hamper", image: "products/WhatsApp Image 2026-08-20 at 12.36.27 PM (2).jpeg", custom: false },
    { id: "P150", title: "Birthday Gift Basket", category: "Bouquet", price: 649, discount: 0, stock: 25, tags: "birthday-hamper", image: "products/WhatsApp Image 2026-08-20 at 12.36.39 PM.jpeg", custom: false },
    { id: "P151", title: "Birthday Surprise Box", category: "Bouquet", price: 899, discount: 0, stock: 25, tags: "birthday-hamper", image: "products/WhatsApp Image 2026-08-20 at 12.36.40 PM.jpeg", custom: false },
    { id: "P152", title: "Teddy Balloon Combo", category: "Bouquet", price: 1199, discount: 0, stock: 25, tags: "birthday-hamper", image: "products/WhatsApp Image 2026-08-20 at 12.42.04 PM.jpeg", custom: false },
    { id: "P153", title: "Mixed Flower Tray", category: "Bouquet", price: 549, discount: 0, stock: 25, tags: "birthday-hamper", image: "products/WhatsApp Image 2026-08-20 at 12.42.23 PM (2).jpeg", custom: false },
    { id: "P154", title: "Yellow Pink Rose Basket", category: "Bouquet", price: 299, discount: 0, stock: 25, tags: "birthday-hamper", image: "products/WhatsApp Image 2026-08-20 at 12.42.24 PM.jpeg", custom: false },
    { id: "P155", title: "Romantic Room Decor", category: "Bouquet", price: 2999, discount: 0, stock: 25, tags: "romantic-setup", image: "products/WhatsApp Image 2026-08-20 at 12.36.18 PM.jpeg", custom: false },
    { id: "P156", title: "Candlelight Setup", category: "Bouquet", price: 1999, discount: 0, stock: 25, tags: "romantic-setup", image: "products/WhatsApp Image 2026-08-20 at 12.36.18 PM (1).jpeg", custom: false },
    { id: "P157", title: "Rose Petal Love Setup", category: "Bouquet", price: 2499, discount: 0, stock: 25, tags: "romantic-setup", image: "products/WhatsApp Image 2026-08-20 at 12.42.16 PM.jpeg", custom: false },
    { id: "P158", title: "Anniversary Special Bouquet", category: "Bouquet", price: 799, discount: 0, stock: 25, tags: "anniversary-bouquet", image: "products/WhatsApp Image 2026-08-20 at 12.36.25 PM (1).jpeg", custom: false },
    { id: "P159", title: "Photo Bouquet", category: "Bouquet", price: 999, discount: 0, stock: 25, tags: "anniversary-bouquet", image: "products/WhatsApp Image 2026-08-20 at 12.42.39 PM.jpeg", custom: false },
    { id: "P160", title: "Photo Bouquet Black", category: "Bouquet", price: 1099, discount: 0, stock: 25, tags: "anniversary-bouquet", image: "products/WhatsApp Image 2026-08-20 at 12.42.38 PM (1).jpeg", custom: false },
    { id: "P161", title: "Photo Bouquet White", category: "Bouquet", price: 1099, discount: 0, stock: 25, tags: "anniversary-bouquet", image: "products/WhatsApp Image 2026-08-20 at 12.42.38 PM (2).jpeg", custom: false },
    { id: "P162", title: "I Love You Red Bouquet", category: "Bouquet", price: 499, discount: 0, stock: 25, tags: "anniversary-bouquet", image: "products/WhatsApp Image 2026-08-20 at 12.42.41 PM (1).jpeg", custom: false },
    { id: "P163", title: "25th Anniversary Box", category: "Bouquet", price: 1499, discount: 0, stock: 25, tags: "anniversary-hamper", image: "products/WhatsApp Image 2026-08-20 at 12.42.38 PM.jpeg", custom: false }
  ];
  /* ---- Server API (small shared JSON database on the Railway backend) ---- */
  function apiGet(p) { return fetch(p).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }); }
  function apiSend(method, p, body) { return fetch(p, { method: method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }); }
  function normalizeOrder(o) {
    if (o.statusIdx === undefined) o.statusIdx = FLORAL.indexOf(o.status) >= 0 ? FLORAL.indexOf(o.status) : 0;
    o.status = deriveStatus(o);
    if (!o.customer) o.customer = o.name || "Guest";
    if (o.amount === undefined || o.amount === null) o.amount = o.total || 0;
    if (!o.product && o.items && o.items.length) o.product = o.items.map(function (it) { return it.name || it.title; }).filter(Boolean).join(", ");
    if (!o.greeting) o.greeting = pick(GREETINGS);
    if (!o.slot) o.slot = pick(SLOTS);
    if (!o.placed) o.placed = o.date || fmtDate(daysAgo(rand(0, 10)));
    if (!o.deliveryDate || typeof o.deliveryDate !== "string") o.deliveryDate = fmtDate(daysAgo(-rand(0, 6)));
    return o;
  }
  function customersFromServer(list) {
    return list.map(function (c) {
      var mine = orders.filter(function (o) { return (c.phone && o.phone === c.phone) || (c.name && (o.customer === c.name || o.name === c.name)); });
      return { id: c.id || "CUS", name: c.name || "Customer", email: c.email || "—", phone: c.phone || "—",
        orders: mine.length, ltv: mine.reduce(function (s, o) { return s + (+o.amount || 0); }, 0),
        last: c.createdAt ? new Date(c.createdAt) : new Date(), city: c.city || "Sikar", status: "Active" };
    });
  }
  var _lastOrderN = -1;
  function syncFromServer(initial) {
    apiGet("/api/products").then(function (d) { if (Array.isArray(d) && d.length) { products = d; if (current === "products") go("products"); } }).catch(function () {});
    apiGet("/api/orders").then(function (d) {
      if (!Array.isArray(d)) return;
      orders = d.map(normalizeOrder);
      var grew = orders.length > _lastOrderN && _lastOrderN >= 0;
      _lastOrderN = orders.length;
      if (grew) {
        try { playOrderSound(); } catch (e) {}
        var latest = orders[0];
        notify("🎉 New order received!" + (latest ? " " + esc(latest.id || "") + " · " + inr(latest.amount) : ""));
        if (typeof toast === "function") toast("🔔 New order received!");
      }
      if ((initial || grew) && /dashboard|orders|analytics|payments|customers/.test(current)) go(current);
    }).catch(function () {});
    apiGet("/api/customers").then(function (d) { if (Array.isArray(d)) { customers = customersFromServer(d); if (current === "customers") go("customers"); } }).catch(function () {});
  }
  function saveProducts() {
    try { localStorage.setItem("ambika_products", JSON.stringify(products)); } catch (e) {}
    apiSend("PUT", "/api/products", products).catch(function () {});   // persist to the shared database
  }
  var products = (function () {
    var existing = null; try { existing = JSON.parse(localStorage.getItem("ambika_products")); } catch (e) {}
    if (existing && existing.length) return existing;
    return DEFAULT_CATALOG.slice(); // show the storefront catalogue by default
  })();
  function stockStatus(s) { return s === 0 ? { t: "Out of Stock", c: "red" } : s <= 10 ? { t: "Low Stock", c: "amber" } : { t: "In Stock", c: "green" }; }

  /* ---- Shared live stores (written by the storefront tracker) ---- */
  function lsLoad(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSave(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var LEADS_KEY = "ambika_leads", CARTS_KEY = "ambika_carts", ACT_KEY = "ambika_activity";

  function loadLeads() { return lsLoad(LEADS_KEY) || []; }        // real corporate enquiries only
  function loadCarts() { return lsLoad(CARTS_KEY) || {}; }         // real live carts only
  function cartStatus(updated) {
    var mins = (Date.now() - updated) / 60000;
    if (mins < 5) return { t: "Active Browsing", c: "green" };
    if (mins < 30) return { t: "Idle", c: "amber" };
    return { t: "Abandoned", c: "red" };
  }
  function loadActivity() { return lsLoad(ACT_KEY) || []; }        // real visitor activity only

  function timeAgo(ts) {
    var s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return s + "s ago";
    var m = Math.floor(s / 60); if (m < 60) return m + "m ago";
    var h = Math.floor(m / 60); if (h < 24) return h + "h ago";
    return Math.floor(h / 24) + "d ago";
  }
  function unreadLeads() { return loadLeads().filter(function (l) { return !l.read; }).length; }
  function updateLeadBadge() {
    var b = document.getElementById("leadsBadge"); if (!b) return;
    var n = unreadLeads(); b.textContent = n; b.style.display = n > 0 ? "flex" : "none";
  }

  /* ---- Dynamic stats derived from the live shared stores ---- */
  function freshOrders() { return (orders && orders.length) ? orders : (lsLoad("ambika_orders") || []); }
  function computeStats() {
    var ords = freshOrders();
    var live = ords.filter(function (o) { return o.statusIdx !== "Cancelled" && o.status !== "Cancelled"; });
    var revenue = live.reduce(function (s, o) { return s + (+o.amount || 0); }, 0);
    var startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    var todaySales = live.filter(function (o) { return o.placedTs && o.placedTs >= startToday.getTime(); })
      .reduce(function (s, o) { return s + (+o.amount || 0); }, 0);
    var aov = live.length ? Math.round(revenue / live.length) : 0;
    var cartsObj = loadCarts();
    var carts = Object.keys(cartsObj).map(function (k) { return cartsObj[k]; });
    var activeCarts = carts.filter(function (c) { return cartStatus(c.updated).t === "Active Browsing"; }).length;
    var idle = carts.filter(function (c) { return cartStatus(c.updated).t === "Idle"; }).length;
    var abandoned = carts.filter(function (c) { return cartStatus(c.updated).t === "Abandoned"; }).length;
    var potential = carts.reduce(function (s, c) { return s + (+c.total || 0); }, 0);
    var acts = loadActivity();
    var recent = acts.filter(function (a) { return (Date.now() - a.ts) < 120000; }).length;
    var liveVisitors = Math.max(activeCarts + idle, Math.min(recent, 40));
    var leads = loadLeads();
    return {
      revenue: revenue, todaySales: todaySales, ordersCount: ords.length, aov: aov,
      activeCarts: activeCarts, abandoned: abandoned, cartsTotal: carts.length, potential: potential,
      liveVisitors: liveVisitors, leads: leads.length, unread: leads.filter(function (l) { return !l.read; }).length
    };
  }

  /* ------------------------------------------------------------------ */
  /* HELPERS                                                            */
  /* ------------------------------------------------------------------ */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var content = $("#content");
  var charts = {};
  function esc(s) { return ("" + (s == null ? "" : s)).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function statusPill(s) {
    var map = {
      "Delivered": "green", "Success": "green", "Active": "green", "In Stock": "green",
      "Pending": "amber", "Low Stock": "amber", "Processing": "blue",
      "Order Received": "amber", "Arranging Flowers": "blue",
      "Out for Delivery": "violet", "Cancelled": "red", "Failed": "red", "Out of Stock": "red",
      "Refunded": "gray", "Inactive": "gray"
    };
    return '<span class="pill ' + (map[s] || "gray") + '">' + s + '</span>';
  }

  /* ------------------------------------------------------------------ */
  /* PAGE RENDERERS                                                     */
  /* ------------------------------------------------------------------ */
  var pages = {};

  /* ---------- DASHBOARD ---------- */
  pages.dashboard = function () {
    var st = computeStats();
    return '' +
      '<div class="page-head"><div><h1>Dashboard</h1><p>Welcome back, Keshav — here’s today at Ambika Flowers 🌸</p></div>' +
      '<button class="btn btn-primary" onclick="ADMIN.go(\'products\')">＋ Add Product</button></div>' +
      '<div class="grid g-4">' +
        metric("pink", "💰", "Total Revenue", inr(st.revenue), "up", "live from orders") +
        metric("green", "🛒", "Today’s Sales", inr(st.todaySales), "up", "orders placed today") +
        metric("violet", "📈", "Avg Order Value", inr(st.aov), "up", "per order") +
        metric("amber", "📦", "Total Orders", st.ordersCount, "up", st.activeCarts + " carts active") +
      '</div>' +
      '<div class="grid g-2 split" style="margin-top:18px;grid-template-columns:1.5fr 1fr;">' +
        '<div class="card"><h3>Revenue — Last 14 Days</h3><div class="sub">Daily sales performance</div><canvas id="revChart" height="150"></canvas></div>' +
        '<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;"><h3>Live Visitors</h3><span class="live-tag"><span class="live-dot"></span>Live</span></div>' +
          '<div style="font-size:44px;font-weight:800;margin:14px 0 2px;" id="liveBig">0</div>' +
          '<div class="sub" style="margin:0;">active users on site right now</div>' +
          '<div class="section-title" style="margin-top:20px;">Top Categories</div>' + topCatBars() +
        '</div>' +
      '</div>' +
      '<div class="grid g-2 split" style="margin-top:18px;">' +
        '<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;"><h3>Live Browsing Feed</h3><span class="live-tag"><span class="live-dot"></span>Realtime</span></div><div class="feed" id="feedMini" style="margin-top:12px;max-height:300px;"></div></div>' +
        '<div class="card"><h3>Recent Orders</h3><div class="sub">Latest activity</div><div class="tbl-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead><tbody>' +
          freshOrders().slice(0, 6).map(function (o) { return '<tr><td><b>' + esc(o.id) + '</b></td><td>' + esc(o.customer || "Guest") + '</td><td>' + inr(o.amount) + '</td><td>' + statusPill(o.status || deriveStatus(o)) + '</td></tr>'; }).join("") +
        '</tbody></table></div></div>' +
      '</div>';
  };

  /* ---------- LIVE ANALYTICS ---------- */
  pages.analytics = function () {
    var st = computeStats();
    var views = loadActivity().filter(function (a) { return a.cat === "page"; }).length;
    var abRate = st.cartsTotal ? Math.round(st.abandoned / st.cartsTotal * 100) : 0;
    return '' +
      '<div class="page-head"><div><h1>Live Analytics & Tracking</h1><p>Real-time visitor and traffic intelligence</p></div><span class="live-tag"><span class="live-dot"></span>Streaming</span></div>' +
      '<div class="grid g-4">' +
        metric("green", "🟢", "Active Users Now", '<span id="liveNow">' + st.liveVisitors + '</span>', "up", st.activeCarts + " with carts") +
        metric("blue", "👁️", "Page Views (logged)", views.toLocaleString("en-IN"), "up", "live events") +
        metric("violet", "🛍️", "Active Carts", st.activeCarts, "up", inr(st.potential) + " in carts") +
        metric("red", "🛒", "Cart Abandonment", abRate + "%", "down", st.abandoned + " abandoned") +
      '</div>' +
      '<div class="grid g-2 split" style="margin-top:18px;grid-template-columns:1fr 1.2fr;">' +
        '<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;"><h3>Live Browsing Feed</h3><span class="live-tag"><span class="live-dot"></span>Live</span></div><div class="feed" id="feedFull" style="margin-top:12px;max-height:420px;"></div></div>' +
        '<div style="display:flex;flex-direction:column;gap:18px;">' +
          '<div class="card"><h3>Top Categories</h3><div class="sub">By views this week</div>' + topCatBars() + '</div>' +
          '<div class="card"><h3>Most Viewed Products</h3><div class="sub">From live page views</div><div class="tbl-wrap"><table><thead><tr><th>#</th><th>Product</th><th>Views</th></tr></thead><tbody>' +
            (function () {
              var views = {};
              loadActivity().forEach(function (a) { if (a.cat !== "page") return; var m = (a.text || "").match(/'([^']+)'/); if (m) views[m[1]] = (views[m[1]] || 0) + 1; });
              var arr = Object.keys(views).map(function (k) { return { p: k, v: views[k] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 6);
              if (!arr.length) return '<tr><td colspan="3" style="text-align:center;color:var(--ink2);padding:20px;">No product views yet.</td></tr>';
              return arr.map(function (r, i) { return '<tr><td><b>' + (i + 1) + '</b></td><td>' + esc(r.p) + '</td><td><b>' + r.v + '</b></td></tr>'; }).join("");
            })() +
          '</tbody></table></div></div>' +
        '</div>' +
      '</div>';
  };

  /* ---------- PAYMENTS (derived from real orders) ---------- */
  function methodOf(o) { return o.method || (o.paymentStatus === "Pending COD" ? "COD" : "UPI"); }
  function payStatusOf(o) {
    if (o.paymentStatus) return o.paymentStatus === "Paid" ? "Success" : (o.paymentStatus === "Pending COD" ? "Pending" : o.paymentStatus);
    if (o.statusIdx === "Cancelled" || o.status === "Cancelled") return "Refunded";
    return "Success";
  }
  pages.payments = function () {
    var st = computeStats();
    var ords = freshOrders();
    var byMethod = { UPI: 0, Card: 0, "Net Banking": 0, COD: 0 };
    var byStatus = { Success: 0, Pending: 0, Failed: 0, Refunded: 0 };
    ords.forEach(function (o) {
      var m = methodOf(o); if (byMethod[m] === undefined) m = "UPI"; if (payStatusOf(o) === "Success") byMethod[m] += (+o.amount || 0);
      var ps = payStatusOf(o); byStatus[ps] = (byStatus[ps] || 0) + 1;
    });
    var totalM = (byMethod.UPI + byMethod.Card + byMethod["Net Banking"] + byMethod.COD) || 1;
    return '' +
      '<div class="page-head"><div><h1>Payments & Finance</h1><p>Live transactions from storefront orders</p></div><span class="live-tag"><span class="live-dot"></span>Live</span></div>' +
      '<div class="grid g-4">' +
        metric("pink", "💰", "Total Revenue", inr(st.revenue), "up", "collected") +
        metric("green", "📅", "Today’s Sales", inr(st.todaySales), "up", "today") +
        metric("violet", "🧾", "Avg Order Value", inr(st.aov), "up", "per order") +
        metric("amber", "📦", "Total Orders", st.ordersCount, "up", "paid & COD") +
      '</div>' +
      '<div class="grid g-2 split" style="margin-top:18px;grid-template-columns:1fr 1fr;">' +
        '<div class="card"><h3>Payment Methods</h3><div class="sub">Revenue share by method</div>' +
          '<div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;"><div style="width:190px;"><canvas id="methodChart"></canvas></div>' +
          '<div class="legend" style="flex:1;min-width:160px;">' +
            legendRow("#e84393", "UPI", inr(byMethod.UPI)) +
            legendRow("#7c3aed", "Card", inr(byMethod.Card)) +
            legendRow("#2563eb", "Net Banking", inr(byMethod["Net Banking"])) +
            legendRow("#f59e0b", "COD", inr(byMethod.COD)) +
          '</div></div>' +
        '</div>' +
        '<div class="card"><h3>Payment Status</h3><div class="sub">Transaction outcomes</div>' +
          statusRow("Success", byStatus.Success, "green") + statusRow("Pending", byStatus.Pending, "amber") +
          statusRow("Failed", byStatus.Failed, "red") + statusRow("Refunded", byStatus.Refunded, "gray") +
        '</div>' +
      '</div>' +
      '<div class="card" style="margin-top:18px;"><h3>Recent Transactions</h3><div class="sub">Latest payment activity</div><div class="tbl-wrap"><table><thead><tr><th>Txn / Order ID</th><th>Customer</th><th>Amount</th><th>Method</th><th>Status</th><th>Date/Time</th><th>Invoice</th></tr></thead><tbody>' +
        (ords.length ? ords.slice(0, 20).map(function (o) {
          var when = o.placedTs ? new Date(o.placedTs).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : (o.date || "—");
          return '<tr><td><b>' + esc(o.id) + '</b></td><td>' + esc(o.customer || "Guest") + '</td><td><b>' + inr(o.amount) + '</b></td><td><span class="pill gray">' + esc(methodOf(o)) + '</span></td><td>' + statusPill(payStatusOf(o)) + '</td><td>' + when + '</td>' +
            '<td><button class="mini-btn" onclick="ADMIN.invoice(\'' + esc(o.id) + '\')">⬇ Invoice</button></td></tr>';
        }).join("") : '<tr><td colspan="7" style="text-align:center;color:var(--ink2);padding:26px;">No transactions yet.</td></tr>') +
      '</tbody></table></div>' +
      '<div style="font-size:11.5px;color:var(--ink2);margin-top:10px;">Method split — UPI ' + Math.round(byMethod.UPI / totalM * 100) + '% · Card ' + Math.round(byMethod.Card / totalM * 100) + '% · Net Banking ' + Math.round(byMethod["Net Banking"] / totalM * 100) + '% · COD ' + Math.round(byMethod.COD / totalM * 100) + '%</div>' +
      '</div>';
  };

  /* ---------- CUSTOMERS ---------- */
  pages.customers = function () {
    var active = customers.filter(function (c) { return c.status === "Active"; }).length;
    return '' +
      '<div class="page-head"><div><h1>Customers (CRM)</h1><p>Live client directory (real registered shoppers)</p></div></div>' +
      '<div class="grid g-3">' +
        metric("blue", "👥", "Total Clients", customers.length, "up", "registered") +
        metric("green", "🛍️", "Active Shoppers", active, "up", "with activity") +
        metric("pink", "✨", "New Signups (Week)", customers.length, "up", "this week") +
      '</div>' +
      '<div class="card" style="margin-top:18px;"><h3>Customer Directory</h3><div class="sub">Click a row to view profile & orders</div><div class="tbl-wrap"><table><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Orders</th><th>Lifetime Value</th><th>Last Active</th><th>Status</th></tr></thead><tbody>' +
        (customers.length ? customers.map(function (c) {
          return '<tr style="cursor:pointer;" onclick="ADMIN.customer(\'' + c.id + '\')">' +
            '<td><span class="avatar-sm">' + initials(c.name) + '</span>' + esc(c.name) + '</td>' +
            '<td>' + esc(c.email) + '</td><td>' + esc(c.phone) + '</td><td><b>' + c.orders + '</b></td>' +
            '<td><b>' + inr(c.ltv) + '</b></td><td>' + fmtDate(c.last) + '</td><td>' + statusPill(c.status) + '</td></tr>';
        }).join("") : '<tr><td colspan="7" style="text-align:center;color:var(--ink2);padding:30px;">No customers yet — they’ll appear when shoppers sign in / order. 🌸</td></tr>') +
      '</tbody></table></div></div>';
  };

  /* ---------- ORDERS ---------- */
  var orderFilter = "All";
  pages.orders = function () {
    var live = freshOrders();
    var counts = { All: live.length };
    ORDER_STATUSES.forEach(function (s) { counts[s] = live.filter(function (o) { return (o.status || deriveStatus(o)) === s; }).length; });
    var tabs = ["All"].concat(ORDER_STATUSES).map(function (s) {
      return '<button class="tab ' + (orderFilter === s ? "active" : "") + '" onclick="ADMIN.orderFilter(\'' + s + '\')">' + s + '<span class="cnt">' + (counts[s] || 0) + '</span></button>';
    }).join("");
    var rows = live.filter(function (o) { return orderFilter === "All" || (o.status || deriveStatus(o)) === orderFilter; });
    return '' +
      '<div class="page-head"><div><h1>Orders & Delivery</h1><p>Live order pipeline — updates as customers order</p></div><span class="live-tag"><span class="live-dot"></span>Live</span></div>' +
      '<div class="tabs">' + tabs + '</div>' +
      '<div class="card"><div class="tbl-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Product</th><th>Amount</th><th>Delivery</th><th>Status</th><th>Tracking</th><th></th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (o) {
          var cur = o.status || deriveStatus(o);
          var opts = ORDER_STATUSES.map(function (s) { return '<option ' + (s === cur ? "selected" : "") + '>' + s + '</option>'; }).join("");
          var pName = o.product || (o.items && o.items[0] && o.items[0].name) || "—";
          var pImg = (o.items && o.items[0] && o.items[0].img) || o.image || "";
          var pThumb = pImg ? '<img src="' + esc(pImg) + '" alt="" onerror="this.style.display=\'none\'" style="width:40px;height:40px;border-radius:8px;object-fit:cover;margin-right:9px;vertical-align:middle;background:#f0f0f0;box-shadow:0 1px 4px rgba(0,0,0,.12);">' : '';
          return '<tr><td><b>' + esc(o.id) + '</b></td><td>' + esc(o.customer || "Guest") + '</td><td style="white-space:nowrap;">' + pThumb + '<span style="vertical-align:middle;">' + esc(pName) + '</span></td><td><b>' + inr(o.amount) + '</b></td>' +
            '<td>' + esc(o.deliveryDate || "—") + '<br><small style="color:var(--ink2);">' + esc(o.slot || "") + '</small></td>' +
            '<td><select class="status-sel" onchange="ADMIN.setStatus(\'' + esc(o.id) + '\',this.value)">' + opts + '</select></td>' +
            '<td><input class="track-in" placeholder="Add #" value="' + esc(o.track || "") + '" onchange="ADMIN.setTrack(\'' + esc(o.id) + '\',this.value)"></td>' +
            '<td><button class="mini-btn" onclick="ADMIN.order(\'' + esc(o.id) + '\')">View</button></td></tr>';
        }).join("") : '<tr><td colspan="8" style="text-align:center;color:var(--ink2);padding:30px;">No orders yet — they’ll appear here live when customers check out. 🌸</td></tr>') +
      '</tbody></table></div></div>';
  };

  /* ---------- PRODUCTS ---------- */
  pages.products = function () {
    return '' +
      '<div class="page-head"><div><h1>Products & Inventory</h1><p>Stock matrix and catalogue control</p></div>' +
      '<button class="btn btn-primary" onclick="ADMIN.addProduct()">＋ Add New Product</button></div>' +
      '<div class="grid g-4" style="margin-bottom:18px;">' +
        metric("violet", "🌷", "Total Products", products.length, "up", "catalogue") +
        metric("green", "✅", "In Stock", products.filter(function (p) { return p.stock > 10; }).length, "up", "healthy") +
        metric("amber", "⚠️", "Low Stock", products.filter(function (p) { return p.stock > 0 && p.stock <= 10; }).length, "down", "reorder soon") +
        metric("red", "⛔", "Out of Stock", products.filter(function (p) { return p.stock === 0; }).length, "down", "restock") +
      '</div>' +
      '<div class="card"><h3>Inventory Matrix</h3><div class="sub">All catalogue items</div><div class="tbl-wrap"><table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Discount</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody id="prodBody">' +
        productRows() +
      '</tbody></table></div></div>';
  };

  function productRows() {
    return products.map(function (p) {
      var ss = stockStatus(p.stock);
      var thumb = p.image ? '<img src="' + esc(p.image) + '" alt="" onerror="this.style.display=\'none\'" style="width:38px;height:38px;border-radius:8px;object-fit:cover;margin-right:9px;vertical-align:middle;">' : '<span style="display:inline-block;width:38px;height:38px;border-radius:8px;background:rgba(120,140,170,.15);margin-right:9px;vertical-align:middle;text-align:center;line-height:38px;">🌸</span>';
      return '<tr><td>' + thumb + '<b>' + esc(p.title) + '</b>' + (p.custom ? ' <span class="pill pink" style="font-size:9px;">NEW</span>' : '') + '<br><small style="color:var(--ink2);">' + p.id + ' · ' + esc(p.tags) + '</small></td>' +
        '<td><span class="pill blue">' + esc(p.category) + '</span></td><td>' + inr(p.price) + '</td>' +
        '<td>' + (p.discount ? p.discount + "%" : "—") + '</td><td><b>' + p.stock + '</b></td><td>' + statusPill(ss.t) + '</td>' +
        '<td style="white-space:nowrap;"><button class="mini-btn" onclick="ADMIN.editProduct(\'' + p.id + '\')">✏ Edit</button> ' +
          '<button class="mini-btn" title="Delete" style="color:#d33;" onclick="ADMIN.delProduct(\'' + p.id + '\')">🗑 Delete</button></td></tr>';
    }).join("");
  }

  /* ---------- CORPORATE LEADS ---------- */
  pages.leads = function () {
    // mark all as read on view
    var leads = loadLeads();
    leads.forEach(function (l) { l.read = true; });
    lsSave(LEADS_KEY, leads); setTimeout(updateLeadBadge, 0);
    var LEAD_STATUS = ["New", "Contacted", "In Progress", "Closed"];
    var newN = leads.filter(function (l) { return l.status === "New"; }).length;
    return '' +
      '<div class="page-head"><div><h1>Corporate Leads</h1><p>Bulk & corporate gifting enquiries from the storefront</p></div><span class="live-tag"><span class="live-dot"></span>Live capture</span></div>' +
      '<div class="grid g-3">' +
        metric("pink", "📨", "Total Leads", leads.length, "up", "all time") +
        metric("amber", "🆕", "New (Uncontacted)", newN, "up", "need follow-up") +
        metric("green", "💰", "Pipeline Value", inr(leads.reduce(function (s, l) { return s + (l.qty || 0) * 600; }, 0)), "up", "est. @ ₹600/unit") +
      '</div>' +
      '<div class="card" style="margin-top:18px;"><h3>Lead Directory</h3><div class="sub">Call / WhatsApp, update status, or remove</div><div class="tbl-wrap"><table><thead><tr><th>Date & Time</th><th>Company</th><th>Contact Person</th><th>Phone & Email</th><th>Event</th><th>Qty</th><th>Budget / Requirement</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
        (leads.length ? leads.map(function (l) {
          var opts = LEAD_STATUS.map(function (s) { return '<option ' + (s === l.status ? "selected" : "") + '>' + s + '</option>'; }).join("");
          var phone = (l.contact.match(/[\d\s]{7,}/) || [""])[0].replace(/\s/g, "");
          return '<tr><td>' + new Date(l.ts).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) + '</td>' +
            '<td><b>' + esc(l.company) + '</b></td><td>' + esc(l.person) + '</td>' +
            '<td style="max-width:180px;white-space:normal;font-size:12px;">' + esc(l.contact) + '</td>' +
            '<td><span class="pill blue">' + esc(l.event) + '</span></td><td><b>' + l.qty + '</b></td>' +
            '<td style="max-width:150px;white-space:normal;font-size:12px;">' + esc(l.budget || "—") + '</td>' +
            '<td><select class="status-sel" onchange="ADMIN.leadStatus(\'' + l.id + '\',this.value)">' + opts + '</select></td>' +
            '<td style="white-space:nowrap;"><button class="mini-btn" title="Call" onclick="ADMIN.call(\'' + phone + '\')">📞</button> ' +
              '<button class="mini-btn" title="WhatsApp" onclick="ADMIN.whatsapp(\'' + phone + '\')">💬</button> ' +
              '<button class="mini-btn" title="Delete" style="color:#d33;" onclick="ADMIN.delLead(\'' + l.id + '\')">🗑</button></td></tr>';
        }).join("") : '<tr><td colspan="9" style="text-align:center;color:var(--ink2);padding:30px;">No corporate leads yet.</td></tr>') +
      '</tbody></table></div></div>';
  };

  /* ---------- LIVE CARTS ---------- */
  pages.carts = function () {
    var cartsObj = loadCarts();
    var carts = Object.keys(cartsObj).map(function (k) { return cartsObj[k]; }).sort(function (a, b) { return b.updated - a.updated; });
    var active = carts.filter(function (c) { return cartStatus(c.updated).t === "Active Browsing"; }).length;
    var potential = carts.reduce(function (s, c) { return s + c.total; }, 0);
    var abandoned = carts.filter(function (c) { return cartStatus(c.updated).t === "Abandoned"; }).length;
    var rate = carts.length ? Math.round(abandoned / carts.length * 100) : 0;
    return '' +
      '<div class="page-head"><div><h1>Live &amp; Abandoned Carts</h1><p>Real-time view of what shoppers have in their carts</p></div><span class="live-tag"><span class="live-dot"></span>Realtime</span></div>' +
      '<div class="grid g-3">' +
        metric("green", "🛒", "Active Carts", active, "up", "browsing now") +
        metric("pink", "💰", "Potential Revenue", inr(potential), "up", "value in carts") +
        metric("red", "📉", "Abandonment Rate", rate + "%", "down", abandoned + " abandoned") +
      '</div>' +
      '<div class="grid g-2 split" style="margin-top:18px;grid-template-columns:1fr 1fr;">' +
        (carts.length ? carts.map(function (c) {
          var st = cartStatus(c.updated);
          var items = c.items.map(function (it) {
            var img = it.img ? '<img src="' + it.img + '" alt="" onerror="this.style.visibility=\'hidden\'" style="width:44px;height:44px;border-radius:9px;object-fit:cover;background:#eee;">' : '<div style="width:44px;height:44px;border-radius:9px;background:#eee;"></div>';
            return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;">' + img + '<div style="flex:1;min-width:0;"><div style="font-size:12.5px;font-weight:600;">' + esc(it.name) + '</div><div style="font-size:11.5px;color:var(--ink2);">' + inr(it.price) + ' × ' + it.qty + '</div></div></div>';
          }).join("");
          return '<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><h3>' + esc(c.name) + ' <span style="font-weight:500;color:var(--ink2);font-size:12px;">· ' + esc(c.id) + '</span></h3>' + statusPill(st.t) + '</div>' +
            items +
            '<div class="ak-row" style="display:flex;justify-content:space-between;border-top:1px dashed var(--line);padding-top:10px;margin-top:8px;font-weight:800;color:var(--ink);"><span>Cart Total</span><span>' + inr(c.total) + '</span></div>' +
            '<div style="font-size:11.5px;color:var(--ink2);margin-top:6px;">Last updated ' + timeAgo(c.updated) + '</div></div>';
        }).join("") : '<div class="card"><div style="text-align:center;color:var(--ink2);padding:30px;">No active carts right now.</div></div>') +
      '</div>';
  };

  /* ---------- LIVE ACTIVITY FEED ---------- */
  var actFilter = "all";
  var ACT_FILTERS = { all: null, cart: ["cart"], page: ["page"], leadorder: ["lead", "order"] };
  pages.activity = function () {
    var acts = loadActivity();
    var f = ACT_FILTERS[actFilter];
    var rows = f ? acts.filter(function (a) { return f.indexOf(a.cat) !== -1; }) : acts;
    var tabs = [["all", "All Activity"], ["cart", "Cart Actions"], ["page", "Page Views"], ["leadorder", "Leads & Orders"]]
      .map(function (t) { return '<button class="tab ' + (actFilter === t[0] ? "active" : "") + '" onclick="ADMIN.actFilter(\'' + t[0] + '\')">' + t[1] + '</button>'; }).join("");
    return '' +
      '<div class="page-head"><div><h1>Live Activity Feed</h1><p>Every key action shoppers take across the store</p></div><span class="live-tag"><span class="live-dot"></span>Streaming</span></div>' +
      '<div class="tabs">' + tabs + '</div>' +
      '<div class="card"><div class="feed" id="actFeed" style="max-height:none;">' +
        (rows.length ? rows.map(function (a) {
          return '<div class="feed-item"><div class="fav">' + a.icon + '</div><div class="ft">' + esc(a.text) + '<small>' + timeAgo(a.ts) + '</small></div></div>';
        }).join("") : '<div style="text-align:center;color:var(--ink2);padding:30px;">No activity in this filter yet.</div>') +
      '</div></div>';
  };

  /* ------------------------------------------------------------------ */
  /* SMALL COMPONENT BUILDERS                                           */
  /* ------------------------------------------------------------------ */
  function metric(color, ic, lbl, val, dir, chg) {
    return '<div class="card metric"><div class="ic ' + color + '">' + ic + '</div>' +
      '<div class="lbl">' + lbl + '</div><div class="val">' + val + '</div>' +
      '<div class="chg ' + dir + '">' + (dir === "up" ? "▲" : "▼") + " " + chg + '</div></div>';
  }
  function legendRow(color, name, val) {
    return '<div class="row"><span class="dot" style="background:' + color + '"></span>' + name + '<b>' + val + '</b></div>';
  }
  function statusRow(name, count, color) {
    var pct = Math.min(100, count * 14 + 8);
    return '<div style="margin-bottom:16px;"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:7px;">' + statusPill(name) + '<b>' + count + ' txns</b></div>' +
      '<div class="bar"><span style="width:' + pct + '%;background:var(--' + (color === "gray" ? "ink2" : color) + ');"></span></div></div>';
  }
  function topCatBars() {
    // Real category interest = page views per category from the live activity log
    var acts = loadActivity();
    var counts = {}; CATEGORIES.forEach(function (c) { counts[c] = 0; });
    acts.forEach(function (a) { CATEGORIES.forEach(function (c) { if ((a.text || "").toLowerCase().indexOf(c.toLowerCase()) !== -1) counts[c]++; }); });
    var max = 0; CATEGORIES.forEach(function (c) { if (counts[c] > max) max = counts[c]; });
    if (max === 0) return '<div style="font-size:12.5px;color:var(--ink2);padding:8px 0;">No category traffic yet — data appears as visitors browse. 🌸</div>';
    var data = CATEGORIES.map(function (c) { return { c: c, v: counts[c] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 5);
    return '<div style="display:flex;flex-direction:column;gap:13px;margin-top:6px;">' + data.map(function (d) {
      var pct = Math.round(d.v / max * 100);
      return '<div><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px;"><span>' + d.c + '</span><b>' + d.v + '</b></div><div class="bar"><span style="width:' + pct + '%;"></span></div></div>';
    }).join("") + '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* CHARTS                                                             */
  /* ------------------------------------------------------------------ */
  function drawCharts(page) {
    if (typeof Chart === "undefined") return;
    Object.keys(charts).forEach(function (k) { try { charts[k].destroy(); } catch (e) {} });
    charts = {};
    var ink2 = getComputedStyle(document.body).getPropertyValue("--ink2") || "#889";
    if (page === "dashboard" && $("#revChart")) {
      var labels = [], vals = [];
      var ords = freshOrders();
      for (var i = 13; i >= 0; i--) {
        var day = daysAgo(i); var ds = day; ds.setHours(0, 0, 0, 0); var start = ds.getTime(); var end = start + 86400000;
        labels.push(pad(new Date(start).getDate()));
        vals.push(ords.filter(function (o) { return o.placedTs && o.placedTs >= start && o.placedTs < end && o.statusIdx !== "Cancelled"; }).reduce(function (s, o) { return s + (+o.amount || 0); }, 0));
      }
      charts.rev = new Chart($("#revChart"), {
        type: "line",
        data: { labels: labels, datasets: [{ data: vals, borderColor: "#e84393", backgroundColor: "rgba(232,67,147,.12)", fill: true, tension: .4, pointRadius: 0, borderWidth: 3 }] },
        options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: ink2, font: { size: 10 } } }, y: { grid: { color: "rgba(120,140,170,.12)" }, ticks: { color: ink2, font: { size: 10 }, callback: function (v) { return "₹" + v / 1000 + "k"; } } } } }
      });
    }
    if (page === "payments" && $("#methodChart")) {
      var bm = { UPI: 0, Card: 0, "Net Banking": 0, COD: 0 };
      freshOrders().forEach(function (o) { if (payStatusOf(o) === "Success") { var m = methodOf(o); if (bm[m] === undefined) m = "UPI"; bm[m] += (+o.amount || 0); } });
      var data = [bm.UPI, bm.Card, bm["Net Banking"], bm.COD];
      if (!data.some(function (v) { return v > 0; })) data = [1, 1, 1, 1];
      charts.method = new Chart($("#methodChart"), {
        type: "doughnut",
        data: { labels: ["UPI", "Card", "Net Banking", "COD"], datasets: [{ data: data, backgroundColor: ["#e84393", "#7c3aed", "#2563eb", "#f59e0b"], borderWidth: 0 }] },
        options: { cutout: "66%", plugins: { legend: { display: false } } }
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* REAL-TIME SIMULATION                                               */
  /* ------------------------------------------------------------------ */
  var liveUsers = rand(60, 95);
  var feedTimer, userTimer, feedSeq = 1040;
  function tickUsers() {
    var n = computeStats().liveVisitors;
    setText("#liveBig", n); setText("#liveNow", n); setText("#miniLive", n);
  }
  function makeFeed() {
    var act = Math.random();
    var what = act > 0.5 ? { icon: "🌸", txt: "is viewing <b>" + pick(PRODUCTS_POOL) + "</b>" }
      : act > 0.28 ? { icon: "📂", txt: "is browsing <b>" + pick(CATEGORIES) + "</b> category" }
      : act > 0.14 ? { icon: "🛒", txt: "added <b>" + pick(PRODUCTS_POOL) + "</b> to cart" }
      : { icon: "✅", txt: "placed an order for <b>" + inr(rand(499, 4999)) + "</b>" };
    return '<div class="feed-item"><div class="fav">' + what.icon + '</div><div class="ft">User #' + (feedSeq++) + " " + what.txt +
      '<small>' + pick(CITIES) + ' · just now</small></div></div>';
  }
  function pushFeed() {
    ["#feedMini", "#feedFull"].forEach(function (sel) {
      var el = $(sel); if (!el) return;
      el.insertAdjacentHTML("afterbegin", makeFeed());
      while (el.children.length > 14) el.removeChild(el.lastChild);
    });
  }
  function setText(sel, v) { var el = $(sel); if (el) el.textContent = v; }
  function startRealtime() {
    stopRealtime();
    tickUsers();
    for (var i = 0; i < 6; i++) pushFeed();
    userTimer = setInterval(tickUsers, 2600);
    feedTimer = setInterval(pushFeed, 1900);
  }
  function stopRealtime() { clearInterval(userTimer); clearInterval(feedTimer); }

  /* ------------------------------------------------------------------ */
  /* NAVIGATION                                                         */
  /* ------------------------------------------------------------------ */
  var current = "dashboard";
  function go(page) {
    if (!pages[page]) return;
    current = page;
    document.querySelectorAll(".sb-link").forEach(function (l) { l.classList.toggle("active", l.getAttribute("data-page") === page); });
    content.innerHTML = '<div class="page active">' + pages[page]() + '</div>';
    drawCharts(page);
    startRealtime();
    document.getElementById("app").classList.remove("mobopen");
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------------ */
  /* MODAL / DRAWER                                                     */
  /* ------------------------------------------------------------------ */
  function openModal(title, html) {
    $("#modalTitle").innerHTML = title; $("#modalBody").innerHTML = html;
    $("#modal").classList.add("open"); $("#ovModal").classList.add("open");
  }
  function closeModal() { $("#modal").classList.remove("open"); $("#ovModal").classList.remove("open"); }

  /* ------------------------------------------------------------------ */
  /* PUBLIC ACTIONS (referenced by inline handlers)                     */
  /* ------------------------------------------------------------------ */
  window.ADMIN = {
    go: go,
    orderFilter: function (s) { orderFilter = s; go("orders"); },
    setStatus: function (id, s) { var o = freshOrders(); o.forEach(function (x) { if (x.id === id) { x.status = s; x.statusIdx = (s === "Cancelled") ? "Cancelled" : FLORAL.indexOf(s); } }); lsSave("ambika_orders", o); notify("Order " + id + " → " + s + " (synced to live tracker)"); },
    setTrack: function (id, t) { var o = freshOrders(); o.forEach(function (x) { if (x.id === id) x.track = t; }); lsSave("ambika_orders", o); notify("Tracking saved for " + id); },
    invoice: function (id) { notify("Invoice " + id + " downloaded (demo)"); },
    customer: function (id) {
      var c = customers.filter(function (x) { return x.id === id; })[0]; if (!c) return;
      var mine = freshOrders().filter(function (o) { return (c.phone && o.phone === c.phone) || (c.name && o.customer === c.name); });
      var hist = mine.slice(0, 6).map(function (o) {
        return '<tr><td><b>' + esc(o.id) + '</b></td><td>' + esc(o.product || "—") + '</td><td>' + inr(o.amount) + '</td><td>' + statusPill(o.status || deriveStatus(o)) + '</td></tr>';
      }).join("");
      openModal('<span class="avatar-sm">' + initials(c.name) + '</span> ' + c.name,
        '<div class="grid g-2" style="gap:10px;margin-bottom:16px;">' +
          kv("Email", c.email) + kv("Phone", c.phone) + kv("Total Orders", c.orders) + kv("Lifetime Value", inr(c.ltv)) +
          kv("Last Active", fmtDate(c.last)) + kv("Status", c.status) +
        '</div>' +
        '<div class="section-title">Delivery Addresses</div>' +
        '<div class="addr-box"><b>Home</b>' + rand(1, 99) + ", Rose Villa, " + c.city + ", Rajasthan " + rand(300000, 335000) + '</div>' +
        '<div class="addr-box"><b>Office</b>Shop ' + rand(1, 40) + ', Flower Market, ' + c.city + '</div>' +
        '<div class="section-title">Recent Order History</div>' +
        '<div class="tbl-wrap"><table><thead><tr><th>Order</th><th>Item</th><th>Amount</th><th>Status</th></tr></thead><tbody>' + (hist || '<tr><td colspan="4">No orders yet</td></tr>') + '</tbody></table></div>');
    },
    order: function (id) {
      var o = freshOrders().filter(function (x) { return x.id === id; })[0]; if (!o) return;
      var placed = o.placed || (o.ts ? new Date(o.ts).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : (o.date || "—"));
      var items = (o.items && o.items.length) ? o.items : [{ name: o.product, price: o.amount, img: o.image, qty: 1 }];
      var gallery = '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">' +
        items.map(function (it) {
          var img = it.img ? '<img src="' + esc(it.img) + '" alt="" onerror="this.style.visibility=\'hidden\'" style="width:56px;height:56px;border-radius:10px;object-fit:cover;background:#f0f0f0;box-shadow:0 2px 6px rgba(0,0,0,.12);">' : '<div style="width:56px;height:56px;border-radius:10px;background:#f0f0f0;"></div>';
          return '<div style="display:flex;align-items:center;gap:12px;background:var(--bg2,#f7f8fb);border-radius:12px;padding:10px 12px;">' + img +
            '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:var(--ink);">' + esc(it.name || "Product") + '</div>' +
            '<div style="font-size:12px;color:var(--ink2);">' + inr(it.price) + (it.qty ? ' × ' + it.qty : '') + '</div></div></div>';
        }).join("") + '</div>';
      openModal("Order " + o.id,
        gallery +
        '<div class="grid g-2" style="gap:10px;margin-bottom:16px;">' +
          kv("Customer", o.customer || "Guest") + kv("Phone", o.phone || "—") + kv("Amount", inr(o.amount)) + kv("Status", o.status || deriveStatus(o)) +
          kv("Payment", (o.method || "—") + (o.paymentStatus ? " · " + o.paymentStatus : "")) +
          kv("Payment Ref / Txn ID", o.reference || "—") +
          kv("Placed On", placed) + kv("Tracking #", o.track || "—") +
        '</div>' +
        (o.address ? '<div class="section-title">📍 Delivery Address</div><div class="addr-box">' + esc(o.address) + '</div>' : '') +
        (o.customization ? '<div class="section-title">✏️ Customization / Special Request</div><div class="addr-box" style="border-left:4px solid #e84393;background:#fff0f6;color:#7a1f4e;font-weight:600;">' + esc(o.customization) + '</div>' : '') +
        (o.gift ? '<div class="section-title">🎁 Gift Card Message</div><div class="addr-box">' + esc(o.gift) + '</div>' : '') +
        '<div class="grid g-2" style="gap:10px;">' + kv("Delivery Date", o.deliveryDate || "—") + kv("Preferred Slot", o.slot || "—") + '</div>');
    },
    addProduct: function () { productForm(null); },
    editProduct: function (id) { productForm(products.filter(function (p) { return p.id === id; })[0]); },
    delProduct: function (id) {
      var p = products.filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      if (!confirm('Delete "' + p.title + '"?\nYe product hamesha ke liye hat jayega.')) return;
      var i = products.map(function (x) { return x.id; }).indexOf(id);
      if (i > -1) products.splice(i, 1);
      saveProducts();
      if (current === "products") go("products");
      notify("Product deleted ✓");
    },
    saveProduct: function () {
      var t = $("#pfTitle").value.trim(); if (!t) { notify("Title required"); return; }
      var editing = $("#pfId").value;
      var price = +$("#pfPrice").value || 0;
      var discount = +$("#pfDisc").value || 0;
      var obj = {
        title: t, category: $("#pfCat").value, price: price, discount: discount,
        discountPrice: Math.round(price * (1 - discount / 100)),
        stock: +$("#pfStock").value || 0, tags: $("#pfTags").value || "new",
        image: $("#pfImg").value || ""
      };
      obj.status = stockStatus(obj.stock).t;
      if (editing) { products.forEach(function (p) { if (p.id === editing) { for (var k in obj) p[k] = obj[k]; } }); notify("Product updated ✓"); }
      else { obj.id = "PRD" + rand(400, 999); obj.custom = true; products.unshift(obj); notify("Product added ✓ — live on the store"); }
      saveProducts();
      closeModal();
      if (current === "products") go("products");
    },
    /* ---- Corporate Leads actions ---- */
    leadStatus: function (id, s) { var l = loadLeads(); l.forEach(function (x) { if (x.id === id) x.status = s; }); lsSave(LEADS_KEY, l); notify("Lead " + id + " → " + s); },
    delLead: function (id) { var l = loadLeads().filter(function (x) { return x.id !== id; }); lsSave(LEADS_KEY, l); updateLeadBadge(); if (current === "leads") go("leads"); notify("Lead " + id + " deleted"); },
    call: function (phone) { var p = (phone || "").replace(/\D/g, ""); if (p) window.location.href = "tel:+91" + p; else toast("No phone on file"); },
    whatsapp: function (phone) { var p = (phone || "").replace(/\D/g, ""); if (p) window.open("https://wa.me/91" + p, "_blank"); else toast("No phone on file"); },
    /* ---- Activity feed filter ---- */
    actFilter: function (f) { actFilter = f; go("activity"); }
  };

  function kv(k, v) { return '<div class="fld" style="margin:0;"><label>' + k + '</label><div style="font-weight:700;font-size:14px;">' + v + '</div></div>'; }

  function productForm(p) {
    var cats = CATEGORIES.map(function (c) { return '<option ' + (p && p.category === c ? "selected" : "") + '>' + c + '</option>'; }).join("");
    openModal(p ? "Edit Product" : "Add New Product",
      '<input type="hidden" id="pfId" value="' + (p ? p.id : "") + '">' +
      '<div class="form-grid">' +
        '<div class="fld full"><label>Product Title</label><input id="pfTitle" value="' + (p ? p.title : "") + '" placeholder="e.g. Red Rose Bouquet"></div>' +
        '<div class="fld full"><label>Description</label><textarea rows="2" placeholder="Short description…">' + (p ? "Beautiful " + p.title.toLowerCase() + " handcrafted fresh." : "") + '</textarea></div>' +
        '<div class="fld full"><label>Product Photo</label>' +
          '<div class="pf-drop" id="pfDrop"><input type="file" id="pfFile" accept="image/*" style="display:none;">' +
            '<div class="pf-drop-inner" id="pfDropInner"><div style="font-size:30px;">📷</div><div style="font-size:12.5px;font-weight:600;margin-top:6px;">Drag &amp; drop an image, or <span style="color:var(--brand);text-decoration:underline;">browse</span></div><div style="font-size:11px;color:var(--ink2);margin-top:3px;">JPG / PNG · stored locally</div></div>' +
            '<div class="pf-preview" id="pfPreview" style="display:none;"><img id="pfThumb" alt=""><button type="button" class="pf-remove" id="pfRemove">Remove / Change</button></div>' +
          '</div>' +
          '<input id="pfUrl" placeholder="…or paste an image URL / path (e.g. products/rose.jpeg)" style="margin-top:9px;">' +
        '</div>' +
        '<input type="hidden" id="pfImg" value="' + (p ? esc(p.image || "") : "") + '">' +
        '<div class="fld"><label>Category</label><select id="pfCat">' + cats + '</select></div>' +
        '<div class="fld"><label>Tags</label><input id="pfTags" value="' + (p ? p.tags : "new") + '" placeholder="bestseller"></div>' +
        '<div class="fld"><label>Price (₹)</label><input id="pfPrice" type="number" value="' + (p ? p.price : "") + '"></div>' +
        '<div class="fld"><label>Discount (%)</label><input id="pfDisc" type="number" value="' + (p ? p.discount : 0) + '"></div>' +
        '<div class="fld"><label>Stock Count</label><input id="pfStock" type="number" value="' + (p ? p.stock : "") + '"></div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;margin-top:8px;"><button class="btn btn-primary" onclick="ADMIN.saveProduct()">' + (p ? "Save Changes" : "Add Product") + '</button><button class="btn btn-ghost" onclick="ADMIN_close()">Cancel</button></div>');
    wireImageUpload(p ? p.image : "");
  }
  window.ADMIN_close = closeModal;

  /* ---- Product image upload (drag-drop / file / URL → base64, with preview) ---- */
  function setProductImage(src) {
    var img = $("#pfImg"); if (img) img.value = src || "";
    var prev = $("#pfPreview"), inner = $("#pfDropInner"), thumb = $("#pfThumb");
    if (src) { if (thumb) thumb.src = src; if (prev) prev.style.display = ""; if (inner) inner.style.display = "none"; }
    else { if (prev) prev.style.display = "none"; if (inner) inner.style.display = ""; }
  }
  function readFile(file) {
    if (!file || !/^image\//.test(file.type)) { toast("Please choose an image file"); return; }
    if (file.size > 3 * 1024 * 1024) { toast("Image too large (max 3 MB)"); return; }
    var fr = new FileReader();
    fr.onload = function () { setProductImage(fr.result); };
    fr.readAsDataURL(file);
  }
  function wireImageUpload(existing) {
    var drop = $("#pfDrop"), file = $("#pfFile"), inner = $("#pfDropInner");
    if (!drop) return;
    setProductImage(existing || "");
    if (inner) inner.addEventListener("click", function () { file.click(); });
    file.addEventListener("change", function () { if (file.files && file.files[0]) readFile(file.files[0]); });
    ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("drag"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("drag"); }); });
    drop.addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });
    var rm = $("#pfRemove"); if (rm) rm.addEventListener("click", function () { setProductImage(""); file.value = ""; var u = $("#pfUrl"); if (u) u.value = ""; });
    var url = $("#pfUrl"); if (url) url.addEventListener("input", function () { var v = url.value.trim(); if (v) setProductImage(v); });
  }

  /* ------------------------------------------------------------------ */
  /* NOTIFICATIONS                                                      */
  /* ------------------------------------------------------------------ */
  var notifs = [];
  function renderNotifs() {
    $("#notifBody").innerHTML = notifs.map(function (n) {
      return '<div class="notif"><div class="nic ic ' + n.ic + '">' + n.e + '</div><div class="nt">' + n.t + '<small>' + n.s + '</small></div></div>';
    }).join("");
    $("#notifCount").textContent = notifs.length;
  }
  function notify(msg) {
    notifs.unshift({ ic: "blue", e: "🔔", t: msg, s: "just now" });
    if (notifs.length > 12) notifs.pop();
    renderNotifs();
  }

  /* ---- New-order chime (Web Audio, no file needed) ---- */
  var _actx = null;
  function ensureAudio() {
    try {
      if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
      if (_actx.state === "suspended") _actx.resume();
    } catch (e) { _actx = null; }
    return _actx;
  }
  var _pendingChime = false;
  function playChimeNow(ctx) {
    try {
      var now = ctx.currentTime;
      [880, 1174.66, 1567.98].forEach(function (f, i) {         // A5 → D6 → G6, a pleasant rising chime
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = f;
        o.connect(g); g.connect(ctx.destination);
        var t = now + i * 0.13;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        o.start(t); o.stop(t + 0.5);
      });
    } catch (e) {}
  }
  function playOrderSound() {
    var ctx = ensureAudio();
    if (!ctx) { _pendingChime = true; return; }
    if (ctx.state === "running") { _pendingChime = false; playChimeNow(ctx); }
    else { ctx.resume().then(function () { _pendingChime = false; playChimeNow(ctx); }).catch(function () { _pendingChime = true; }); }
  }
  // If the chime couldn't play (tab backgrounded / audio locked), play it as soon as the admin is focused
  function flushChime() { if (_pendingChime) playOrderSound(); else ensureAudio(); }
  // Order-arrival watcher: fires the chime + a notification whenever the live order count grows
  var lastOrderCount = 0;
  function orderCountNow() { try { return (JSON.parse(localStorage.getItem("ambika_orders")) || []).length; } catch (e) { return 0; } }
  function checkNewOrders(fromStorage) {
    var n = orderCountNow();
    if (n > lastOrderCount) {
      var got = n - lastOrderCount; lastOrderCount = n;
      playOrderSound();
      var latest = (function () { try { return (JSON.parse(localStorage.getItem("ambika_orders")) || [])[0]; } catch (e) { return null; } })();
      notify("🎉 New order received!" + (latest ? " " + latest.id + " · " + inr(latest.amount) : "") + (got > 1 ? " (+" + got + ")" : ""));
      if (typeof toast === "function") toast("🔔 New order received!");
      if (current === "dashboard" || current === "orders" || current === "payments" || current === "analytics") go(current);
    } else {
      lastOrderCount = n;
    }
  }

  /* ------------------------------------------------------------------ */
  /* BOOT + GLOBAL WIRING                                               */
  /* ------------------------------------------------------------------ */
  function boot() {
    // sidebar nav
    document.querySelectorAll(".sb-link").forEach(function (l) {
      l.addEventListener("click", function () { go(l.getAttribute("data-page")); });
    });
    // collapse / mobile toggle
    $("#toggleSb").addEventListener("click", function () {
      var app = document.getElementById("app");
      if (window.innerWidth <= 720) app.classList.toggle("mobopen");
      else app.classList.toggle("collapsed");
    });
    // theme
    $("#themeBtn").addEventListener("click", function () {
      var html = document.documentElement;
      var dark = html.getAttribute("data-theme") === "dark";
      html.setAttribute("data-theme", dark ? "light" : "dark");
      this.textContent = dark ? "🌙" : "☀️";
      drawCharts(current);
    });
    // notifications drawer
    $("#notifBtn").addEventListener("click", function () { renderNotifs(); $("#drawerNotif").classList.add("open"); $("#ovNotif").classList.add("open"); });
    $("#notifClose").addEventListener("click", closeDrawer);
    $("#ovNotif").addEventListener("click", closeDrawer);
    function closeDrawer() { $("#drawerNotif").classList.remove("open"); $("#ovNotif").classList.remove("open"); }
    // modal close
    $("#modalClose").addEventListener("click", closeModal);
    $("#ovModal").addEventListener("click", closeModal);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeModal(); closeDrawer(); } });
    // global search -> jump to matching section
    $("#globalSearch").addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var q = this.value.toLowerCase();
      if (/order|deliver/.test(q)) go("orders");
      else if (/lead|corporate|enquiry|inquiry/.test(q)) go("leads");
      else if (/cart|abandon/.test(q)) go("carts");
      else if (/activ|feed|live|stream/.test(q)) go("activity");
      else if (/pay|txn|invoice|revenue/.test(q)) go("payments");
      else if (/cust|client|user/.test(q)) go("customers");
      else if (/product|stock|invent/.test(q)) go("products");
      else if (/analy|traffic/.test(q)) go("analytics");
      else notify('No section for "' + this.value + '"');
    });

    // Live sync from the storefront (other tab) via localStorage
    var LIVE_PAGES = { dashboard: 1, analytics: 1, payments: 1, orders: 1, carts: 1 };
    window.addEventListener("storage", function (e) {
      if (e.key === "ambika_leads") { updateLeadBadge(); if (current === "leads") go("leads"); notify("📨 New corporate lead received"); }
      else if (e.key === "ambika_orders") { checkNewOrders(true); }   // plays chime if a new order arrived
      else if (e.key === "ambika_products") { if (current === "products") go("products"); }
      else if (e.key === "ambika_carts") { if (current === "carts" || current === "dashboard" || current === "analytics") go(current); }
      else if (e.key === "ambika_activity" && current === "activity") go("activity");
    });

    // Unlock audio on any interaction (browser autoplay policy) + flush any queued chime
    document.addEventListener("click", flushChime, true);
    document.addEventListener("keydown", flushChime, true);
    window.addEventListener("focus", flushChime);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) flushChime(); });

    // Periodic live refresh + reliable new-order chime (works same-tab and cross-tab)
    lastOrderCount = orderCountNow();
    setInterval(function () {
      checkNewOrders(false);
      if (current === "dashboard" || current === "analytics") { try { tickUsers(); } catch (e2) {} }
    }, 3000);

    renderNotifs();
    updateLeadBadge();
    go("dashboard");

    // Load live shared data from the server, then keep it fresh (new orders / signups)
    syncFromServer(true);
    setInterval(function () { syncFromServer(false); }, 6000);
  }

  /* ------------------------------------------------------------------ */
  /* LOGIN GATE                                                          */
  /* ------------------------------------------------------------------ */
  var ADMIN_USER = "ambika";
  var ADMIN_PASS = "ambika123";
  var AUTH_KEY = "ambika_admin_auth";
  var booted = false;

  function showDashboard() {
    $("#loginScreen").style.display = "none";
    document.getElementById("app").style.display = "";
    if (!booted) { booted = true; boot(); }
  }
  function initLogin() {
    // already logged in this browser?
    var ok = false;
    try { ok = localStorage.getItem(AUTH_KEY) === "1"; } catch (e) {}
    if (ok) { showDashboard(); return; }

    var form = $("#loginForm");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var u = $("#loginUser").value.trim();
      var p = $("#loginPass").value;
      if (u === ADMIN_USER && p === ADMIN_PASS) {
        try { localStorage.setItem(AUTH_KEY, "1"); } catch (e) {}
        $("#loginErr").classList.remove("show");
        showDashboard();
      } else {
        $("#loginErr").classList.add("show");
        $("#loginPass").value = "";
        $("#loginPass").focus();
      }
    });
    setTimeout(function () { try { $("#loginUser").focus(); } catch (e) {} }, 100);
  }

  window.ADMIN_LOGOUT = function () {
    try { localStorage.removeItem(AUTH_KEY); } catch (e) {}
    location.reload();
  };

  function wireLogout() {
    var b = document.getElementById("logoutBtn");
    if (b) b.addEventListener("click", function () { if (confirm("Log out of the admin panel?")) window.ADMIN_LOGOUT(); });
  }
  // wire logout once the dashboard boots
  var _boot = boot;
  boot = function () { _boot(); wireLogout(); };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initLogin);
  else initLogin();
})();
