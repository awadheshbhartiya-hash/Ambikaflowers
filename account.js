/* ==========================================================================
   Ambika Flowers — Account page (My Orders + My Profile)
   ========================================================================== */
(function () {
  "use strict";

  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var user = load("ambika_user") || { name: "Garvit Sharma", email: "garvit@gmail.com", phone: "9876543210", role: "customer" };

  function esc(s) { return (s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function inr(n) { return "₹" + Number(n).toLocaleString("en-IN"); }
  function firstName() { return (user.name || "there").split(" ")[0]; }

  function toast(msg) {
    var t = document.getElementById("acctoast");
    t.textContent = msg; t.style.opacity = "1"; t.style.transform = "translateX(-50%) translateY(0)";
    clearTimeout(t._t); t._t = setTimeout(function () { t.style.opacity = "0"; t.style.transform = "translateX(-50%) translateY(20px)"; }, 2400);
  }

  /* ---------------- REAL ORDERS (from shared ambika_orders) ---------------- */
  function loadMyOrders() {
    var all = load("ambika_orders") || [];
    var mine = all.filter(function (o) {
      if (!user) return true;
      if (user.phone && o.phone === user.phone) return true;
      if (user.name && o.customer === user.name) return true;
      return false;
    });
    if (!mine.length) mine = all; // single-shopper browser fallback
    return mine.map(function (o) {
      var imgs = (o.items || []).map(function (it) { return it.img; }).filter(Boolean);
      var step = (typeof o.statusIdx === "number") ? o.statusIdx : 0;
      return {
        id: o.id, date: o.date || "", amount: o.amount || 0, step: step,
        products: imgs, address: o.address || "—", recipient: o.customer || "You",
        slot: o.slot || "—", gift: o.gift || "", method: o.method || "", payment: o.paymentStatus || "",
        cancelled: (o.statusIdx === "Cancelled" || o.status === "Cancelled")
      };
    });
  }
  var STEPS = [
    { t: "Order Placed", s: "We received your order", e: "📝" },
    { t: "Preparing Fresh Flowers", s: "Handcrafting your bouquet", e: "🌸" },
    { t: "Out for Delivery", s: "On the way to the doorstep", e: "🚚" },
    { t: "Delivered", s: "Enjoy your blooms!", e: "✨" }
  ];

  function timelineHTML(active) {
    return '<div class="tl">' + STEPS.map(function (st, i) {
      var cls = i < active ? "done" : (i === active ? "active" : "");
      var sub = i < active ? "Completed" : (i === active ? st.s : "Pending");
      return '<div class="tl-step ' + cls + '"><div class="tl-line"></div>' +
        '<div class="tl-dot">' + (i < active ? "✓" : st.e) + '</div>' +
        '<div class="tl-txt"><div class="t">' + st.t + '</div><div class="s">' + sub + '</div></div></div>';
    }).join("") + '</div>';
  }

  function orderCardHTML(o, idx) {
    var thumbs = o.products.length
      ? o.products.map(function (p) { return '<img class="oc-thumb" src="' + esc(p) + '" alt="" onerror="this.style.visibility=\'hidden\'">'; }).join("")
      : '<div class="oc-thumb" style="display:flex;align-items:center;justify-content:center;font-size:26px;">🌸</div>';
    var payTag = o.payment ? ' · <b style="color:#10b981;">' + esc(o.payment) + '</b>' : '';
    var tracker = o.cancelled
      ? '<div class="tracker" id="trk-' + o.id + '"><div style="text-align:center;color:#d33;font-weight:700;padding:14px;background:rgba(239,68,68,.08);border-radius:12px;">✖ This order was cancelled.</div></div>'
      : '<div class="tracker" id="trk-' + o.id + '">' + timelineHTML(o.step) +
          '<div class="dd">' +
            '<div class="box"><b>Delivery Slot</b>' + esc(o.slot) + '</div>' +
            '<div class="box"><b>Recipient</b>' + esc(o.recipient) + '</div>' +
            (o.gift ? '<div class="giftcard"><span class="q">“</span><div class="gt">' + esc(o.gift) + '</div></div>' : '') +
          '</div>' +
        '</div>';
    return '<div class="order-card rise" style="animation-delay:' + (idx * 0.08) + 's">' +
      '<div class="oc-head"><div class="oc-id">' + esc(o.id) + '<small>Placed on ' + esc(o.date) + payTag + '</small></div><div class="oc-amt">Coming Soon</div></div>' +
      '<div class="oc-body"><div class="oc-thumbs">' + thumbs + '</div>' +
        '<div class="oc-addr"><b>Deliver to:</b><br>' + esc(o.address) + '</div>' +
        '<button class="oc-track-btn" data-track="' + o.id + '">Track Status</button>' +
      '</div>' + tracker +
    '</div>';
  }

  function renderOrders() {
    var v = document.getElementById("view-orders");
    var orders = loadMyOrders();
    if (!orders.length) {
      v.innerHTML = '<div class="card2 rise"><h2>My Orders</h2><div class="empty">🛒 You have no orders yet.<br><a href="index2.html" style="color:#e84393;font-weight:700;">Start shopping →</a></div></div>';
      return;
    }
    v.innerHTML = '<div class="card2 rise"><h2>My Orders</h2><div class="mut">Track and review your recent flower deliveries</div>' +
      orders.map(orderCardHTML).join("") + '</div>';
    v.querySelectorAll("[data-track]").forEach(function (b) {
      b.addEventListener("click", function () {
        var trk = document.getElementById("trk-" + b.getAttribute("data-track"));
        var open = trk.classList.toggle("open");
        b.textContent = open ? "Hide Tracking" : "Track Status";
      });
    });
  }

  /* ---------------- PROFILE ---------------- */
  var addresses = load("ambika_addresses") || [
    { tag: "Home", body: "12, Rose Villa, Piprali Road, Sikar, Rajasthan 332001" },
    { tag: "Office", body: "Shop 8, Flower Market, Station Road, Sikar 332001" }
  ];
  var reminders = load("ambika_reminders") || [
    { name: "Mom's Birthday", date: "12 Sep", occ: "Birthday" },
    { name: "Wedding Anniversary", date: "5 Nov", occ: "Anniversary" }
  ];
  var OCC_ICON = { Birthday: "🎂", Anniversary: "❤️", Other: "🌷" };

  function renderProfile() {
    var v = document.getElementById("view-profile");
    v.innerHTML =
      '<div class="card2 rise"><div class="pf-head">' +
        '<div class="pf-av">' + (firstName()[0] || "G").toUpperCase() + '</div>' +
        '<div><div class="pf-hi">Hello, ' + esc(firstName()) + '! <small>Welcome back to Ambika Flowers</small></div><span class="pf-badge">🌟 Premium Member</span></div>' +
      '</div></div>' +

      '<div class="card2 rise" style="animation-delay:.08s"><h2>Edit Profile</h2><div class="mut">Keep your details up to date</div>' +
        '<div class="pf-form">' +
          '<div class="pf-fld full"><label>Full Name</label><input id="pf-name" value="' + esc(user.name) + '"></div>' +
          '<div class="pf-fld"><label>Email Address</label><input id="pf-email" value="' + esc(user.email) + '"></div>' +
          '<div class="pf-fld"><label>Phone Number</label><input id="pf-phone" value="' + esc(user.phone) + '"></div>' +
        '</div>' +
        '<button class="save-btn" id="pf-save">Save Changes</button>' +
      '</div>' +

      '<div class="card2 rise" style="animation-delay:.16s"><h2>Saved Delivery Addresses</h2><div class="mut">Where should we send the blooms?</div>' +
        '<div class="addr-grid" id="addrGrid"></div>' +
      '</div>' +

      '<div class="card2 rise" style="animation-delay:.24s"><h2>🌸 Occasion Reminders</h2><div class="mut">We\'ll remind you to send flowers before the big day</div>' +
        '<div id="remList"></div>' +
        '<div class="rem-add">' +
          '<input type="text" id="rem-name" placeholder="e.g. Dad\'s Birthday">' +
          '<input type="text" id="rem-date" placeholder="e.g. 20 Dec" style="max-width:120px">' +
          '<select id="rem-occ"><option>Birthday</option><option>Anniversary</option><option>Other</option></select>' +
          '<button id="rem-add-btn">＋ Add</button>' +
        '</div>' +
      '</div>';

    document.getElementById("pf-save").addEventListener("click", function () {
      user.name = document.getElementById("pf-name").value.trim() || user.name;
      user.email = document.getElementById("pf-email").value.trim();
      user.phone = document.getElementById("pf-phone").value.trim();
      save("ambika_user", user);
      var b = this; b.classList.add("saved"); b.textContent = "✓ Saved!";
      toast("Profile updated 🌸");
      setTimeout(function () { b.classList.remove("saved"); b.textContent = "Save Changes"; }, 1800);
    });

    renderAddresses(); renderReminders();
    document.getElementById("rem-add-btn").addEventListener("click", addReminder);
  }

  function renderAddresses() {
    var g = document.getElementById("addrGrid");
    g.innerHTML = addresses.map(function (a, i) {
      return '<div class="addr-c"><button class="edit" data-edit="' + i + '">Edit</button><span class="tag">' + esc(a.tag) + '</span><p>' + esc(a.body) + '</p></div>';
    }).join("") + '<div class="addr-add" id="addrAdd">＋ Add New Address</div>';
    g.querySelectorAll("[data-edit]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = +b.getAttribute("data-edit");
        var nv = prompt("Edit " + addresses[i].tag + " address:", addresses[i].body);
        if (nv != null && nv.trim()) { addresses[i].body = nv.trim(); save("ambika_addresses", addresses); renderAddresses(); toast("Address updated"); }
      });
    });
    document.getElementById("addrAdd").addEventListener("click", function () {
      var tag = prompt("Address label (e.g. Home, Office):", "Home"); if (!tag) return;
      var body = prompt("Full address:", ""); if (!body || !body.trim()) return;
      addresses.push({ tag: tag.trim(), body: body.trim() }); save("ambika_addresses", addresses); renderAddresses(); toast("Address added 🌸");
    });
  }

  function renderReminders() {
    var l = document.getElementById("remList");
    if (!reminders.length) { l.innerHTML = '<div class="empty" style="padding:14px;">No reminders yet — add one below.</div>'; return; }
    l.innerHTML = reminders.map(function (r, i) {
      return '<div class="rem-item"><div class="ic">' + (OCC_ICON[r.occ] || "🌷") + '</div>' +
        '<div class="rt">' + esc(r.name) + '<small>' + esc(r.occ) + ' · ' + esc(r.date) + '</small></div>' +
        '<button class="edit" data-del="' + i + '" style="position:static;background:rgba(239,68,68,.12);color:#d33;">Remove</button></div>';
    }).join("");
    l.querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", function () { reminders.splice(+b.getAttribute("data-del"), 1); save("ambika_reminders", reminders); renderReminders(); toast("Reminder removed"); });
    });
  }
  function addReminder() {
    var name = document.getElementById("rem-name").value.trim();
    var date = document.getElementById("rem-date").value.trim();
    var occ = document.getElementById("rem-occ").value;
    if (!name || !date) { toast("Enter occasion name and date"); return; }
    reminders.push({ name: name, date: date, occ: occ }); save("ambika_reminders", reminders);
    document.getElementById("rem-name").value = ""; document.getElementById("rem-date").value = "";
    renderReminders(); toast("Reminder added 🌸");
  }

  /* ---------------- TABS + ROUTING ---------------- */
  function showView(name) {
    name = (name === "profile") ? "profile" : "orders";
    document.querySelectorAll(".acc-tab").forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-v") === name); });
    document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
    var view = document.getElementById("view-" + name);
    view.classList.add("active");
    if (name === "orders") renderOrders(); else renderProfile();
    if (location.hash.slice(1) !== name) history.replaceState(null, "", "#" + name);
  }

  function boot() {
    document.querySelectorAll(".acc-tab").forEach(function (t) {
      t.addEventListener("click", function () { showView(t.getAttribute("data-v")); });
    });
    window.addEventListener("hashchange", function () { showView(location.hash.slice(1)); });
    showView(location.hash.slice(1) || "orders");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
