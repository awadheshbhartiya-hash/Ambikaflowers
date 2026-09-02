/* ==========================================================================
   Ambika Flowers — Cart + Auth engine (vanilla JS, localStorage-backed)
   Works across every page. Include on each page:  <script src="shop.js"></script>
   ========================================================================== */
(function () {
  "use strict";

  /* API base — the Railway backend URL for the Vercel-hosted frontend.
     Leave "" for same-origin (works when server.js serves the site directly / localhost).
     After deploying the backend, set the Railway URL below (or window.AMBIKA_API_BASE). */
  var API_BASE = (window.AMBIKA_API_BASE || "https://ambikaflowers-production-a69a.up.railway.app" /* RAILWAY_URL */).replace(/\/+$/, "");

  /* One-time reset: wipe demo/seed data so the store starts LIVE at zero.
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

  var CART_KEY = "ambika_cart";
  var USER_KEY = "ambika_user";
  var DELIVERY_FEE = 99;         // flat delivery
  var FREE_ABOVE = 999;          // free delivery above this subtotal

  /* ---------------- State helpers ---------------- */
  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  var cart = load(CART_KEY) || [];
  var user = load(USER_KEY) || null;

  function slug(s) {
    return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || ("p" + Date.now());
  }
  function money(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

  /* ---------------- Cart operations ---------------- */
  function addItem(p, qty) {
    qty = qty || 1;
    if (!p || !p.name) return;
    var id = p.id || slug(p.name);
    var existing = null;
    for (var i = 0; i < cart.length; i++) { if (cart[i].id === id) { existing = cart[i]; break; } }
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({ id: id, name: p.name, price: Number(p.price) || 0, img: p.img || "", qty: qty });
    }
    save(CART_KEY, cart);
    updateBadges();
    renderCart();
    trackCart("add", { name: p.name, price: Number(p.price) || 0 });
    toast('🛒 "' + p.name + '" added to cart', true);
  }
  function setQty(id, qty) {
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === id) {
        cart[i].qty = qty;
        if (cart[i].qty <= 0) cart.splice(i, 1);
        break;
      }
    }
    save(CART_KEY, cart);
    updateBadges();
    renderCart();
    trackCart("update");
  }
  function removeItem(id) {
    cart = cart.filter(function (c) { return c.id !== id; });
    save(CART_KEY, cart);
    updateBadges();
    renderCart();
    trackCart("remove");
  }
  /* Report cart changes to the tracking layer (Admin live carts + activity) */
  function trackCart(action, item) {
    if (!window.AmbikaTrack) return;
    try {
      window.AmbikaTrack.cartSnapshot(cart);
      var who = window.AmbikaTrack.visitorName();
      if (action === "add" && item) window.AmbikaTrack.logActivity("cart", "🛒", who + " added '" + item.name + "' (₹" + item.price + ") to cart");
      else if (action === "remove") window.AmbikaTrack.logActivity("cart", "🗑️", who + " removed an item from cart");
    } catch (e) {}
  }
  function cartCount() { return cart.reduce(function (s, i) { return s + i.qty; }, 0); }
  function subtotal() { return cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0); }

  /* ---------------- Read product data from a card ---------------- */
  function cardData(card) {
    if (!card) return null;
    var nameEl = card.querySelector(".product-name, .bs-card-name, .p-name");
    var priceEl = card.querySelector(".price-current, .product-price, .bs-card-price, .p-price");
    var imgEl = card.querySelector("img");
    var name = nameEl ? nameEl.textContent.trim() : "Product";
    var price = priceEl ? parseInt(priceEl.textContent.replace(/[^\d]/g, ""), 10) || 0 : 0;
    var img = imgEl ? imgEl.getAttribute("src") : "";
    return { id: slug(name), name: name, price: price, img: img };
  }

  /* ---------------- Badges ---------------- */
  function updateBadges() {
    var n = cartCount();
    var badges = document.querySelectorAll(".js-cart-badge, .cart-count, .cart-badge-dot");
    badges.forEach(function (b) {
      b.textContent = n;
      b.style.display = "flex";
    });
  }

  /* ==========================================================================
     UI INJECTION
     ========================================================================== */
  function injectUI() {
    if (document.getElementById("ak-toast")) return; // already injected

    var wrap = document.createElement("div");
    wrap.innerHTML = [
      '<div id="ak-toast"></div>',

      /* overlay + cart drawer */
      '<div class="ak-overlay" id="ak-cart-ov"></div>',
      '<aside class="ak-cart" id="ak-cart" aria-label="Shopping cart">',
      '  <div class="ak-cart-head"><h3>🛒 Your Cart</h3><button class="ak-close" id="ak-cart-x">&times;</button></div>',
      '  <div class="ak-cart-body" id="ak-cart-body"></div>',
      '  <div class="ak-cart-foot" id="ak-cart-foot"></div>',
      '</aside>',

      /* overlay + auth modal */
      '<div class="ak-overlay" id="ak-auth-ov"></div>',
      '<div class="ak-modal" id="ak-auth" role="dialog" aria-modal="true">',
      '  <div class="ak-modal-head">',
      '    <span class="ak-head-flower ak-hf1">🌸</span><span class="ak-head-flower ak-hf2">🌷</span><span class="ak-head-flower ak-hf3">🌿</span>',
      '    <button class="ak-close" id="ak-auth-x">&times;</button>',
      '    <div class="ak-head-logo">🌸</div>',
      '    <h2 id="ak-auth-title">Welcome Back</h2>',
      '    <p id="ak-auth-sub">Login with OTP or password 🌸</p>',
      '  </div>',
      '  <div class="ak-tabs">',
      '    <span class="ak-tab-pill" id="ak-tab-pill"></span>',
      '    <button class="ak-tab active" data-tab="login">Login</button>',
      '    <button class="ak-tab" data-tab="signup">Sign Up</button>',
      '  </div>',
      /* Login form */
      '  <form class="ak-form" id="ak-login-form" novalidate>',
      '    <div class="ak-pane" id="ak-pane-otp">',
      '      <div class="ak-field" data-f="o-phone"><label>Mobile Number</label><div class="ak-inwrap"><span class="ak-inic">📱</span><input type="tel" id="o-phone" maxlength="10" inputmode="numeric" placeholder="Enter 10-digit mobile"></div><span class="ak-err-msg">Enter a valid 10-digit mobile number</span></div>',
      '      <button type="button" class="ak-submit ak-ripple" id="ak-send-otp">Send OTP</button>',
      '      <div class="ak-switch">Prefer password? <a href="#" id="ak-to-pw">Login with Password</a></div>',
      '    </div>',
      '    <div class="ak-pane" id="ak-pane-code" style="display:none">',
      '      <div class="ak-otp-info">Enter the 4-digit code sent to<br><b id="ak-otp-dest"></b></div>',
      '      <div class="ak-otp-cells" id="ak-otp-cells">',
      '        <input class="ak-otp-cell" inputmode="numeric" maxlength="1" aria-label="OTP digit 1">',
      '        <input class="ak-otp-cell" inputmode="numeric" maxlength="1" aria-label="OTP digit 2">',
      '        <input class="ak-otp-cell" inputmode="numeric" maxlength="1" aria-label="OTP digit 3">',
      '        <input class="ak-otp-cell" inputmode="numeric" maxlength="1" aria-label="OTP digit 4">',
      '      </div>',
      '      <div class="ak-otp-badge-row"><button type="button" class="ak-otp-badge" id="ak-autofill">✨ Auto-fill OTP</button></div>',
      '      <span class="ak-err-msg ak-otp-errmsg" id="ak-otp-err">Incorrect code — please try again</span>',
      '      <button type="button" class="ak-submit ak-ripple" id="ak-verify-otp">Verify &amp; Proceed</button>',
      '      <div class="ak-otp-foot"><span id="ak-resend-wrap">Resend OTP in <b id="ak-resend-timer">30</b>s</span><a href="#" id="ak-resend" style="display:none">Resend OTP</a><a href="#" id="ak-otp-change">Change number</a></div>',
      '    </div>',
      '    <div class="ak-pane" id="ak-pane-pw" style="display:none">',
      '      <div class="ak-field" data-f="l-id"><label>Mobile / Email</label><div class="ak-inwrap"><span class="ak-inic">👤</span><input type="text" id="l-id" placeholder="you@email.com or mobile"></div><span class="ak-err-msg">Enter a valid email or 10-digit mobile</span></div>',
      '      <div class="ak-field" data-f="l-pw"><label>Password</label><div class="ak-inwrap"><span class="ak-inic">🔒</span><input type="password" id="l-pw" placeholder="••••••••"></div><span class="ak-err-msg">Password must be at least 6 characters</span></div>',
      '      <div class="ak-form-row"><label><input type="checkbox" id="l-remember" checked> Remember me</label><a href="#" id="ak-forgot">Forgot Password?</a></div>',
      '      <button type="submit" class="ak-submit ak-ripple">Sign In</button>',
      '      <div class="ak-switch">Quick access? <a href="#" id="ak-to-otp">Login with OTP</a></div>',
      '    </div>',
      '  </form>',
      /* Signup form */
      '  <form class="ak-form" id="ak-signup-form" style="display:none" novalidate>',
      '    <div class="ak-field" data-f="s-name"><label>Full Name</label><div class="ak-inwrap"><span class="ak-inic">👤</span><input type="text" id="s-name" placeholder="Your name"></div><span class="ak-err-msg">Please enter your name</span></div>',
      '    <div class="ak-field" data-f="s-email"><label>Email</label><div class="ak-inwrap"><span class="ak-inic">✉️</span><input type="email" id="s-email" placeholder="you@email.com"></div><span class="ak-err-msg">Enter a valid email address</span></div>',
      '    <div class="ak-field" data-f="s-phone"><label>Phone Number</label><div class="ak-inwrap"><span class="ak-inic">📱</span><input type="tel" id="s-phone" maxlength="10" inputmode="numeric" placeholder="98873 38459"></div><span class="ak-err-msg">Enter a valid 10-digit phone number</span></div>',
      '    <div class="ak-field" data-f="s-pw"><label>Password</label><div class="ak-inwrap"><span class="ak-inic">🔒</span><input type="password" id="s-pw" placeholder="Min 6 characters"></div><span class="ak-err-msg">Password must be at least 6 characters</span></div>',
      '    <button type="submit" class="ak-submit ak-ripple">Create Account</button>',
      '  </form>',
      '</div>',

      /* account dropdown */
      '<div class="ak-account-menu" id="ak-account">',
      '  <div class="ak-account-head"><div class="nm" id="ak-acc-name"></div><div class="em" id="ak-acc-email"></div></div>',
      '  <a href="#" id="ak-acc-profile">👤 My Profile</a>',
      '  <a href="#" id="ak-acc-orders">📦 My Orders</a>',
      '  <a href="#" class="logout" id="ak-acc-logout">🚪 Logout</a>',
      '</div>'
    ].join("");
    document.body.appendChild(wrap);

    /* wire cart drawer */
    document.getElementById("ak-cart-x").addEventListener("click", closeCart);
    document.getElementById("ak-cart-ov").addEventListener("click", closeCart);

    /* wire auth modal */
    document.getElementById("ak-auth-x").addEventListener("click", closeAuth);
    document.getElementById("ak-auth-ov").addEventListener("click", closeAuth);
    document.querySelectorAll(".ak-tab").forEach(function (t) {
      t.addEventListener("click", function () { switchTab(t.getAttribute("data-tab")); });
    });
    document.getElementById("ak-login-form").addEventListener("submit", onLogin);
    document.getElementById("ak-signup-form").addEventListener("submit", onSignup);
    document.getElementById("ak-forgot").addEventListener("click", function (e) { e.preventDefault(); toast("Password reset link sent (demo)"); });
    document.getElementById("ak-to-pw").addEventListener("click", function (e) { e.preventDefault(); showLoginPane("pw"); });
    document.getElementById("ak-to-otp").addEventListener("click", function (e) { e.preventDefault(); showLoginPane("otp"); });
    document.getElementById("ak-send-otp").addEventListener("click", sendOtp);
    document.getElementById("ak-verify-otp").addEventListener("click", verifyOtp);
    document.getElementById("ak-autofill").addEventListener("click", fillOtp);
    document.getElementById("ak-resend").addEventListener("click", function (e) { e.preventDefault(); sendOtp(); });
    document.getElementById("ak-otp-change").addEventListener("click", function (e) { e.preventDefault(); showLoginPane("otp"); });
    wireOtpCells();
    // OTP login needs paid SMS, so we hide it — customers log in with a password
    var _toOtp = document.getElementById("ak-to-otp"); if (_toOtp && _toOtp.parentNode) _toOtp.parentNode.style.display = "none";
    document.addEventListener("click", function (e) { var b = e.target.closest(".ak-ripple"); if (b) spawnRipple(b, e); });

    /* account menu actions */
    document.getElementById("ak-acc-profile").addEventListener("click", function (e) { e.preventDefault(); closeAccount(); window.location.href = "account.html#profile"; });
    document.getElementById("ak-acc-orders").addEventListener("click", function (e) { e.preventDefault(); closeAccount(); window.location.href = "account.html#orders"; });
    document.getElementById("ak-acc-logout").addEventListener("click", function (e) { e.preventDefault(); logout(); });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeCart(); closeAuth(); closeAccount(); }
    });
    document.addEventListener("click", function (e) {
      var m = document.getElementById("ak-account");
      if (m && m.classList.contains("open") && !m.contains(e.target) && !e.target.closest("[data-auth-trigger]")) closeAccount();
    });
  }

  /* ==========================================================================
     TOAST
     ========================================================================== */
  var toastTimer;
  function toast(msg, ok) {
    var t = document.getElementById("ak-toast");
    if (!t) return;
    t.textContent = msg;
    t.className = ok ? "ok show" : "show";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = t.className.replace("show", "").trim(); }, 2600);
  }

  /* ==========================================================================
     CART DRAWER
     ========================================================================== */
  var cartLoadTimer;
  function showCartLoader() {
    var body = document.getElementById("ak-cart-body");
    var foot = document.getElementById("ak-cart-foot");
    if (!body || !foot) return;
    foot.innerHTML = "";
    body.innerHTML =
      '<div class="ak-loader">' +
        '<div class="ak-flower">' +
          '<span class="ak-petal"></span><span class="ak-petal"></span><span class="ak-petal"></span>' +
          '<span class="ak-petal"></span><span class="ak-petal"></span><span class="ak-petal"></span>' +
          '<span class="ak-center"></span>' +
        '</div>' +
        '<div class="ak-loader-text">Arranging your fresh picks… 🌸</div>' +
        '<div class="ak-skel-wrap"><div class="ak-skel"></div><div class="ak-skel"></div></div>' +
      '</div>';
  }
  function openCart() {
    var c = document.getElementById("ak-cart");
    if (!c) return;
    c.classList.add("open");
    document.getElementById("ak-cart-ov").classList.add("open");
    showCartLoader();
    clearTimeout(cartLoadTimer);
    cartLoadTimer = setTimeout(renderCart, 1100);
  }
  function closeCart() { clearTimeout(cartLoadTimer); document.getElementById("ak-cart").classList.remove("open"); document.getElementById("ak-cart-ov").classList.remove("open"); }

  function renderCart() {
    var body = document.getElementById("ak-cart-body");
    var foot = document.getElementById("ak-cart-foot");
    if (!body || !foot) return;

    if (cart.length === 0) {
      body.innerHTML = '<div class="ak-empty"><div class="big">🛒</div>Your cart is empty.<br>Add some fresh blooms!<br><button id="ak-shop-more">Continue Shopping</button></div>';
      foot.innerHTML = "";
      var sm = document.getElementById("ak-shop-more");
      if (sm) sm.addEventListener("click", closeCart);
      return;
    }

    body.innerHTML = cart.map(function (it) {
      var img = it.img
        ? '<img src="' + it.img + '" alt="" onerror="this.style.visibility=\'hidden\'">'
        : '<img alt="">';
      return '<div class="ak-item">' + img +
        '<div class="ak-item-mid">' +
          '<div class="ak-item-name">' + it.name + '</div>' +
          '<div class="ak-item-price">' + money(it.price) + '</div>' +
          '<div class="ak-item-bottom">' +
            '<div class="ak-qty">' +
              '<button data-dec="' + it.id + '">−</button>' +
              '<span>' + it.qty + '</span>' +
              '<button data-inc="' + it.id + '">+</button>' +
            '</div>' +
            '<button class="ak-remove" data-rm="' + it.id + '">🗑 Remove</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join("");

    var sub = subtotal();
    var delivery = sub >= FREE_ABOVE ? 0 : DELIVERY_FEE;
    var deliveryHtml = delivery === 0 ? '<span class="free">FREE</span>' : money(delivery);
    foot.innerHTML =
      '<div class="ak-row"><span>Subtotal (' + cartCount() + ' items)</span><span>' + money(sub) + '</span></div>' +
      '<div class="ak-row"><span>Estimated Delivery</span><span>' + deliveryHtml + '</span></div>' +
      '<div class="ak-row total"><span>Grand Total</span><span>' + money(sub + delivery) + '</span></div>' +
      '<button class="ak-checkout" id="ak-checkout">Proceed to Checkout →</button>';

    body.querySelectorAll("[data-inc]").forEach(function (b) { b.addEventListener("click", function () { var id = b.getAttribute("data-inc"); setQty(id, findQty(id) + 1); }); });
    body.querySelectorAll("[data-dec]").forEach(function (b) { b.addEventListener("click", function () { var id = b.getAttribute("data-dec"); setQty(id, findQty(id) - 1); }); });
    body.querySelectorAll("[data-rm]").forEach(function (b) { b.addEventListener("click", function () { removeItem(b.getAttribute("data-rm")); }); });
    var co = document.getElementById("ak-checkout");
    if (co) co.addEventListener("click", checkout);
  }
  function findQty(id) { for (var i = 0; i < cart.length; i++) if (cart[i].id === id) return cart[i].qty; return 0; }

  function checkout() {
    if (window.AmbikaTrack) try { window.AmbikaTrack.logActivity("cart", "💳", window.AmbikaTrack.visitorName() + " started checkout (₹" + subtotal() + ")"); } catch (e) {}
    if (cart.length === 0) { toast("Your cart is empty"); return; }
    // Login is required before ordering — so we capture the customer + address
    if (!user) { toast("Order karne ke liye pehle login / signup karein 🌸", false); closeCart(); openAuth("login"); return; }
    if (window.AmbikaPay && window.AmbikaPay.openCheckout) {
      var payload = {
        items: cart.map(function (i) { return { name: i.name, price: i.price, img: i.img, qty: i.qty }; }),
        subtotal: subtotal(), user: user
      };
      closeCart();
      window.AmbikaPay.openCheckout(payload, function () { cart = []; save(CART_KEY, cart); updateBadges(); renderCart(); });
      return;
    }
    // Fallback (payment module unavailable)
    toast("✅ Order placed! Thank you, " + firstName() + ".", true);
    cart = []; save(CART_KEY, cart); updateBadges(); renderCart();
    setTimeout(closeCart, 900);
  }

  /* ==========================================================================
     AUTH MODAL
     ========================================================================== */
  function openAuth(tab) { switchTab(tab || "login"); clearErrors(); document.getElementById("ak-auth").classList.add("open"); document.getElementById("ak-auth-ov").classList.add("open"); }
  function closeAuth() { document.getElementById("ak-auth").classList.remove("open"); document.getElementById("ak-auth-ov").classList.remove("open"); }

  function switchTab(tab) {
    var login = tab === "login";
    document.querySelectorAll(".ak-tab").forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-tab") === tab); });
    var pill = document.getElementById("ak-tab-pill");
    if (pill) pill.style.transform = login ? "translateX(0)" : "translateX(100%)";
    var lf = document.getElementById("ak-login-form");
    var sf = document.getElementById("ak-signup-form");
    if (login) { sf.style.display = "none"; lf.style.display = ""; showLoginPane("pw"); }
    else { lf.style.display = "none"; sf.style.display = ""; }
    var shown = login ? lf : sf;
    shown.classList.remove("ak-fade"); void shown.offsetWidth; shown.classList.add("ak-fade");
    document.getElementById("ak-auth-title").textContent = login ? "Welcome Back" : "Create Account";
    document.getElementById("ak-auth-sub").textContent = login ? "Apne password se login karein 🌸" : "Join the Ambika Flowers family 🌷";
  }

  /* ---- Login sub-panes (OTP / code / password) ---- */
  function showLoginPane(which) {
    clearErrors();
    if (which !== "code") pendingSignup = null;   // leaving the verify step cancels a pending signup
    var map = { otp: "ak-pane-otp", code: "ak-pane-code", pw: "ak-pane-pw" };
    Object.keys(map).forEach(function (k) { var el = document.getElementById(map[k]); if (el) el.style.display = (k === which) ? "" : "none"; });
    var focusId = which === "otp" ? "o-phone" : (which === "pw" ? "l-id" : null);
    if (focusId) { var f = document.getElementById(focusId); if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 60); }
  }

  /* ---- OTP flow (4-digit, manual verify) ---- */
  var OTP_LEN = 4;
  var otpCode = null, resendCd, otpPhone = "", pendingSignup = null;
  /* Shared OTP starter — used by both login (manual) and signup (auto-fill) */
  function startOtpFlow(phone, autoFill, title, sub) {
    otpPhone = phone;
    otpCode = String(Math.floor(1000 + Math.random() * 9000));
    document.getElementById("ak-signup-form").style.display = "none";
    document.getElementById("ak-login-form").style.display = "";
    if (title) document.getElementById("ak-auth-title").textContent = title;
    if (sub) document.getElementById("ak-auth-sub").textContent = sub;
    showLoginPane("code");
    document.getElementById("ak-otp-dest").textContent = "+91 " + phone.slice(0, 5) + " " + phone.slice(5);
    var cells = document.querySelectorAll(".ak-otp-cell");
    cells.forEach(function (c) { c.value = ""; });
    document.getElementById("ak-otp-err").classList.remove("show");
    if (cells[0]) setTimeout(function () { try { cells[0].focus(); } catch (e) {} }, 80);
    startResendTimer();
    toast("Your OTP is: " + otpCode + " 🌸", true);
    if (autoFill) {
      setTimeout(function () {
        var cp = document.getElementById("ak-pane-code");
        if (!cp || cp.style.display === "none") return;
        cells.forEach(function (c, i) { c.value = otpCode[i] || ""; });
        toast("OTP auto-filled ✓ verifying…", true);
        setTimeout(verifyOtp, 550);
      }, 1200);
    }
  }
  function sendOtp() {
    var el = document.getElementById("o-phone");
    var v = (el.value || "").replace(/\D/g, "");
    if (!isPhone(v)) { setErr("o-phone", true); el.classList.add("ak-shake"); setTimeout(function () { el.classList.remove("ak-shake"); }, 450); return; }
    setErr("o-phone", false);
    otpPhone = v;
    // Demo: generate a random 4-digit code — no SMS gateway
    otpCode = String(Math.floor(1000 + Math.random() * 9000));
    showLoginPane("code");
    document.getElementById("ak-otp-dest").textContent = "+91 " + v.slice(0, 5) + " " + v.slice(5);
    var cells = document.querySelectorAll(".ak-otp-cell");
    cells.forEach(function (c) { c.value = ""; });
    document.getElementById("ak-otp-err").classList.remove("show");
    if (cells[0]) setTimeout(function () { try { cells[0].focus(); } catch (e) {} }, 80);
    startResendTimer();
    // Floating floral toast with the mock code — user must still enter & verify
    toast("Your OTP is: " + otpCode + " 🌸", true);
  }
  /* Auto-fill badge: fills the boxes but does NOT submit — user clicks Verify */
  function fillOtp() {
    if (!otpCode) return;
    var cells = document.querySelectorAll(".ak-otp-cell");
    cells.forEach(function (c, i) { c.value = otpCode[i] || ""; });
    var last = cells[cells.length - 1]; if (last) { try { last.focus(); } catch (e) {} }
    document.getElementById("ak-otp-err").classList.remove("show");
  }
  function startResendTimer() {
    var n = 30;
    var wrap = document.getElementById("ak-resend-wrap");
    var link = document.getElementById("ak-resend");
    var t = document.getElementById("ak-resend-timer");
    if (!wrap || !link || !t) return;
    wrap.style.display = ""; link.style.display = "none"; t.textContent = n;
    clearInterval(resendCd);
    resendCd = setInterval(function () {
      n--; t.textContent = n;
      if (n <= 0) { clearInterval(resendCd); wrap.style.display = "none"; link.style.display = ""; }
    }, 1000);
  }
  function verifyOtp() {
    var cells = document.querySelectorAll(".ak-otp-cell");
    var code = ""; cells.forEach(function (c) { code += (c.value || "").replace(/\D/g, ""); });
    var errEl = document.getElementById("ak-otp-err");
    if (code.length < OTP_LEN) { errEl.textContent = "Please enter all " + OTP_LEN + " digits"; errEl.classList.add("show"); shakeCells(cells); return; }
    if (otpCode && code !== otpCode) { errEl.textContent = "Incorrect code — please try again"; errEl.classList.add("show"); shakeCells(cells); return; }
    errEl.classList.remove("show");
    clearInterval(resendCd);
    // Success animation, then finish auth + close
    cells.forEach(function (c) { c.classList.add("ak-otp-ok"); });
    var modal = document.getElementById("ak-auth");
    if (modal) modal.classList.add("ak-auth-success");
    toast("Verified! Welcome 🌸", true);
    setTimeout(function () {
      if (modal) modal.classList.remove("ak-auth-success");
      cells.forEach(function (c) { c.classList.remove("ak-otp-ok"); });
      if (pendingSignup) {
        var su = pendingSignup; pendingSignup = null;
        finishAuth({ name: su.name, email: su.email, phone: su.phone, role: "customer" });
        toast("Account created — welcome, " + firstName() + "! 🌸", true);
      } else {
        var known = load(USER_KEY);
        var name = known && known.phone === otpPhone ? known.name : "Guest";
        finishAuth({ name: name, email: known ? known.email : "", phone: otpPhone, role: "customer" });
      }
    }, 750);
  }
  function shakeCells(cells) {
    cells.forEach(function (c) { c.classList.add("ak-shake"); });
    setTimeout(function () { cells.forEach(function (c) { c.classList.remove("ak-shake"); }); }, 450);
  }
  function wireOtpCells() {
    var cells = Array.prototype.slice.call(document.querySelectorAll(".ak-otp-cell"));
    cells.forEach(function (cell, idx) {
      cell.addEventListener("input", function () {
        cell.value = cell.value.replace(/\D/g, "").slice(0, 1);
        if (cell.value && idx < cells.length - 1) cells[idx + 1].focus();
        // NOTE: no auto-submit — user must click "Verify & Proceed"
      });
      cell.addEventListener("keydown", function (e) {
        if (e.key === "Backspace" && !cell.value && idx > 0) { cells[idx - 1].focus(); cells[idx - 1].value = ""; e.preventDefault(); }
        else if (e.key === "ArrowLeft" && idx > 0) cells[idx - 1].focus();
        else if (e.key === "ArrowRight" && idx < cells.length - 1) cells[idx + 1].focus();
      });
      cell.addEventListener("paste", function (e) {
        e.preventDefault();
        var src = (e.clipboardData || window.clipboardData);
        var txt = (src ? src.getData("text") : "").replace(/\D/g, "").slice(0, 6);
        for (var i = 0; i < txt.length && (idx + i) < cells.length; i++) cells[idx + i].value = txt[i];
        var last = Math.min(idx + txt.length, cells.length - 1); cells[last].focus();
        if (cells.every(function (c) { return c.value; })) verifyOtp();
      });
    });
  }

  /* ---- Blooming petal ripple ---- */
  function spawnRipple(btn, e) {
    var rect = btn.getBoundingClientRect();
    var span = document.createElement("span");
    span.className = "ak-petal-ripple";
    var size = Math.max(rect.width, rect.height);
    var cx = (e && e.clientX) ? e.clientX : rect.left + rect.width / 2;
    var cy = (e && e.clientY) ? e.clientY : rect.top + rect.height / 2;
    span.style.width = span.style.height = size + "px";
    span.style.left = (cx - rect.left - size / 2) + "px";
    span.style.top = (cy - rect.top - size / 2) + "px";
    btn.appendChild(span);
    setTimeout(function () { if (span.parentNode) span.parentNode.removeChild(span); }, 650);
  }

  function setErr(fieldId, on) {
    var wrap = document.querySelector('[data-f="' + fieldId + '"]');
    if (wrap) wrap.classList.toggle("err", !!on);
  }
  function clearErrors() { document.querySelectorAll(".ak-field.err").forEach(function (f) { f.classList.remove("err"); }); }
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function isPhone(v) { return /^\d{10}$/.test(v.replace(/\D/g, "")); }

  function onLogin(e) {
    e.preventDefault();
    // Route Enter key based on the active login pane
    var pwPane = document.getElementById("ak-pane-pw");
    if (pwPane && pwPane.style.display === "none") {
      var codePane = document.getElementById("ak-pane-code");
      if (codePane && codePane.style.display !== "none") verifyOtp();
      else sendOtp();
      return;
    }
    var id = document.getElementById("l-id").value.trim();
    var pw = document.getElementById("l-pw").value;

    // --- Admin login (bypass customer email/phone regex) ---
    if (id.toLowerCase() === "ambika" && pw === "ambika123") {
      setErr("l-id", false); setErr("l-pw", false);
      loginAsAdmin();
      return;
    }

    var ok = true;
    var idOk = isEmail(id) || isPhone(id);
    setErr("l-id", !idOk); if (!idOk) ok = false;
    setErr("l-pw", pw.length < 6); if (pw.length < 6) ok = false;
    if (!ok) return;
    // Real login — verify the password against the database
    var sbtn = document.querySelector("#ak-pane-pw .ak-submit");
    if (sbtn) { sbtn.disabled = true; sbtn.style.opacity = ".7"; }
    fetch(API_BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, password: pw }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (sbtn) { sbtn.disabled = false; sbtn.style.opacity = ""; }
        if (!res.ok) { setErr("l-pw", true); toast((res.d && res.d.error) || "Login nahi hua"); return; }
        finishAuth(Object.assign({ role: "customer" }, res.d.user), res.d.token);
        toast("Welcome back, " + firstName() + "! 🌸", true);
      })
      .catch(function () { if (sbtn) { sbtn.disabled = false; sbtn.style.opacity = ""; } toast("Server tak nahi pahuncha, dobara try karein"); });
  }

  /* ---- Admin authentication + redirect ---- */
  function loginAsAdmin() {
    try {
      localStorage.setItem("ambika_admin_auth", "1");
      localStorage.setItem("ambika_role", "admin");
      localStorage.setItem("ambika_isLoggedIn", "true");
    } catch (e) {}
    finishAuth({ name: "Ambika Admin", email: "admin@ambikaflowers.in", phone: "", role: "admin" });
    toast("Welcome Admin — opening dashboard… 🌸", true);
    setTimeout(function () { window.location.href = "admin.html"; }, 900);
  }

  function onSignup(e) {
    e.preventDefault();
    var name = document.getElementById("s-name").value.trim();
    var email = document.getElementById("s-email").value.trim();
    var phone = document.getElementById("s-phone").value.trim();
    var pw = document.getElementById("s-pw").value;
    var ok = true;
    setErr("s-name", name.length < 2); if (name.length < 2) ok = false;
    setErr("s-email", !isEmail(email)); if (!isEmail(email)) ok = false;
    setErr("s-phone", !isPhone(phone)); if (!isPhone(phone)) ok = false;
    setErr("s-pw", pw.length < 6); if (pw.length < 6) ok = false;
    if (!ok) return;
    // Real signup — create the account in the database (password is hashed server-side)
    var btn = document.querySelector("#ak-signup-form .ak-submit");
    if (btn) { btn.disabled = true; btn.style.opacity = ".7"; }
    fetch(API_BASE + "/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name, email: email, phone: phone, password: pw }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (btn) { btn.disabled = false; btn.style.opacity = ""; }
        if (!res.ok) { toast((res.d && res.d.error) || "Signup nahi hua, dobara try karein"); return; }
        finishAuth(Object.assign({ role: "customer" }, res.d.user), res.d.token);
        toast("Account ban gaya — welcome, " + firstName() + "! 🌸", true);
      })
      .catch(function () { if (btn) { btn.disabled = false; btn.style.opacity = ""; } toast("Server tak nahi pahuncha, dobara try karein"); });
  }

  function finishAuth(u, token) {
    u = u || {};
    user = { id: u.id || "", name: u.name || "Guest", email: u.email || "", phone: u.phone || "", address: u.address || "", role: u.role || "customer" };
    save(USER_KEY, user);
    try {
      localStorage.setItem("ambika_isLoggedIn", "true");
      localStorage.setItem("ambika_role", user.role);
      if (token) localStorage.setItem("ambika_token", token);
    } catch (e) {}
    clearInterval(resendCd);
    otpCode = null;
    closeAuth();
    clearErrors();
    document.getElementById("ak-login-form").reset();
    document.getElementById("ak-signup-form").reset();
    renderAuthTriggers();
  }
  function logout() {
    user = null;
    try { localStorage.removeItem(USER_KEY); } catch (e) {}
    closeAccount();
    renderAuthTriggers();
    toast("You've been logged out");
  }
  function firstName() { return user ? (user.name || "Guest").split(" ")[0] : "Guest"; }

  /* ==========================================================================
     HEADER WIRING (cart + login triggers on any page layout)
     ========================================================================== */
  function wireHeader() {
    var candidates = document.querySelectorAll(".action-item, .icon-btn");
    candidates.forEach(function (el) {
      var txt = (el.textContent || "").toLowerCase();

      /* Cart trigger */
      if (txt.indexOf("cart") !== -1 && !el.getAttribute("data-cart-trigger")) {
        el.setAttribute("data-cart-trigger", "1");
        el.style.cursor = "pointer";
        if (el.style.position !== "relative" && el.style.position !== "absolute") el.style.position = "relative";
        el.addEventListener("click", function (e) { e.preventDefault(); openCart(); });
        var badge = el.querySelector(".cart-count, .cart-badge-dot, .js-cart-badge");
        if (!badge) { badge = document.createElement("span"); badge.className = "js-cart-badge"; el.appendChild(badge); }
      }

      /* Login / account trigger */
      if ((txt.indexOf("login") !== -1 || txt.indexOf("account") !== -1) && !el.getAttribute("data-auth-trigger")) {
        el.setAttribute("data-auth-trigger", "1");
        el.style.cursor = "pointer";
        var labelEl = el.querySelector("span:last-child") || el;
        el.__label = labelEl;
        el.addEventListener("click", function (e) {
          e.preventDefault();
          if (user) toggleAccount(el); else openAuth("login");
        });
      }
    });
    renderAuthTriggers();
  }

  function renderAuthTriggers() {
    document.querySelectorAll("[data-auth-trigger]").forEach(function (el) {
      var label = el.__label || el.querySelector("span:last-child");
      if (!label) return;
      label.textContent = user ? firstName() : "Login";
    });
  }

  function toggleAccount(anchor) {
    var m = document.getElementById("ak-account");
    if (m.classList.contains("open")) { closeAccount(); return; }
    document.getElementById("ak-acc-name").textContent = user.name;
    document.getElementById("ak-acc-email").textContent = user.email || user.phone || "";
    var r = anchor.getBoundingClientRect();
    var left = Math.min(r.left, window.innerWidth - 232);
    m.style.top = (r.bottom + 8) + "px";
    m.style.left = Math.max(8, left) + "px";
    m.classList.add("open");
  }
  function closeAccount() { var m = document.getElementById("ak-account"); if (m) m.classList.remove("open"); }

  /* ==========================================================================
     ADD-TO-CART DELEGATION + global overrides
     ========================================================================== */
  function flyFlower(fromEl) {
    try {
      if (!fromEl) return;
      var cartEl = document.querySelector(".cart-count") || document.querySelector(".icon-btn");
      var s = fromEl.getBoundingClientRect();
      var t = cartEl ? cartEl.getBoundingClientRect() : { left: window.innerWidth - 40, top: 16, width: 16, height: 16 };
      var flowers = ["🌸", "🌷", "💐", "🌺"];
      for (var i = 0; i < 4; i++) {
        (function (i) {
          var f = document.createElement("div");
          f.className = "af-fly-flower";
          f.textContent = flowers[i % flowers.length];
          f.style.left = (s.left + s.width / 2 - 11) + "px";
          f.style.top = (s.top + s.height / 2 - 11) + "px";
          document.body.appendChild(f);
          var dx = (t.left + t.width / 2) - (s.left + s.width / 2) + (i * 10 - 15);
          var dy = (t.top + t.height / 2) - (s.top + s.height / 2);
          setTimeout(function () {
            f.style.transform = "translate(" + dx + "px," + dy + "px) scale(.3) rotate(420deg)";
            f.style.opacity = "0";
          }, 20 + i * 70);
          setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 1200 + i * 70);
        })(i);
      }
    } catch (e) {}
  }

  function productFromCard(card) {
    if (!card) return null;
    var d = cardData(card);
    if (!d || !d.name) return null;
    var tagEl = card.querySelector(".product-sub-tag, .bs-card-tag");
    d.tag = tagEl ? tagEl.textContent.trim() : "";
    return d;
  }
  function openProductPage(card) {
    var d = productFromCard(card);
    if (!d) return;
    try { localStorage.setItem("ambika_pdp", JSON.stringify(d)); } catch (e) {}
    window.location.href = "product.html";
  }

  function wireAddButtons() {
    // Add to cart (+ flying-flower animation)
    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".add-to-cart");
      if (!btn) return;
      if (btn.hasAttribute("onclick")) return; // handled by inline handler (index2 / sig cards)
      e.preventDefault();
      e.stopPropagation();
      var card = btn.closest(".product-card, .bs-card");
      var data = cardData(card);
      if (data) { addItem(data, 1); flyFlower(btn); }
    }, true);
    // Click anywhere on a product card (except the add button / links) -> product detail page
    document.addEventListener("click", function (e) {
      if (e.target.closest(".add-to-cart")) return;
      if (e.target.closest("a")) return;
      var card = e.target.closest(".product-card, .bs-card");
      if (!card) return;
      openProductPage(card);
    });
  }

  /* Override the old/broken inline handlers used by index2.html & product2.html */
  window.addToCart = function (e, btn) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (e && e.preventDefault) e.preventDefault();
    if (btn && btn.closest) {
      var card = btn.closest(".product-card, .bs-card");
      var data = cardData(card);
      if (data) { addItem(data, 1); return; }
    }
    // product detail page (product2.html) — no useful args
    var nameEl = document.getElementById("p-name");
    if (nameEl) {
      var priceEl = document.getElementById("p-price");
      var imgEl = document.getElementById("main-img");
      var qEl = document.getElementById("qty-val");
      var price = priceEl ? parseInt(priceEl.textContent.replace(/[^\d]/g, ""), 10) || 0 : 0;
      var q = qEl ? parseInt(qEl.textContent, 10) || 1 : 1;
      addItem({ id: slug(nameEl.textContent), name: nameEl.textContent.trim(), price: price, img: imgEl ? imgEl.src : "" }, q);
    }
  };
  window.toggleCart = function () { openCart(); };
  window.buyNow = function () {
    if (window.addToCart) window.addToCart();
    openCart();
  };

  /* Public API */
  window.AmbikaShop = {
    openCart: openCart, closeCart: closeCart,
    openAuth: openAuth, add: addItem,
    flyFlower: flyFlower, openProductPage: openProductPage,
    getCart: function () { return cart.slice(); },
    getUser: function () { return user; }
  };

  /* ---------------- Boot ---------------- */
  function boot() {
    injectUI();
    wireHeader();
    wireAddButtons();
    updateBadges();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

/* ==========================================================================
   Ambika Flowers — Feature module:
   Track Order · Location · Reminders · Corporate Gifting
   (self-contained; shares localStorage with the admin panel & account page)
   ========================================================================== */
(function () {
  "use strict";

  /* API base — same as the first IIFE (separate scope, so redeclared here).
     Set the Railway URL below (or window.AMBIKA_API_BASE); "" = same-origin. */
  var API_BASE = (window.AMBIKA_API_BASE || "https://ambikaflowers-production-a69a.up.railway.app" /* RAILWAY_URL */).replace(/\/+$/, "");

  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function el(id) { return document.getElementById(id); }
  function esc(s) { return (s || "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------------- Shared order store (synced with admin) ---------------- */
  var ORDERS_KEY = "ambika_orders";
  var STEPS = [
    { t: "Order Received", s: "We’ve received your order", e: "🌸" },
    { t: "Arranging Flowers", s: "Handcrafting your bouquet", e: "💐" },
    { t: "Out for Delivery", s: "On the way to the doorstep", e: "🚚" },
    { t: "Delivered", s: "Enjoy your blooms!", e: "✨" }
  ];
  function loadOrders() { return load(ORDERS_KEY) || []; }  // live orders only — no demo

  /* ---------------- Event tracking (syncs to Admin via localStorage) ---------------- */
  var ACT_KEY = "ambika_activity", CARTS_KEY = "ambika_carts", LEADS_KEY = "ambika_leads", VIS_KEY = "ambika_visitor";
  function visitor() {
    var v = load(VIS_KEY);
    if (!v || !v.id) { v = { id: "U" + Math.floor(1000 + Math.random() * 9000) }; save(VIS_KEY, v); }
    return v;
  }
  function visitorId() { return visitor().id; }
  function visitorName() { var u = load("ambika_user"); return (u && u.name) ? u.name.split(" ")[0] : "Guest Visitor"; }
  function logActivity(cat, icon, text) {
    var a = load(ACT_KEY) || [];
    a.unshift({ cat: cat, icon: icon, text: text, ts: Date.now() });
    if (a.length > 80) a.length = 80;
    save(ACT_KEY, a);
  }
  function cartSnapshot(items) {
    var carts = load(CARTS_KEY) || {}; var vid = visitorId();
    if (!items || !items.length) { delete carts[vid]; }
    else {
      carts[vid] = {
        id: vid, name: visitorName(),
        items: items.map(function (i) { return { name: i.name, price: i.price, img: i.img, qty: i.qty }; }),
        total: items.reduce(function (s, i) { return s + i.price * i.qty; }, 0),
        updated: Date.now(), status: "Active Browsing"
      };
    }
    save(CARTS_KEY, carts);
  }
  function addLead(lead) {
    var l = load(LEADS_KEY) || [];
    lead.id = "LEAD" + Math.floor(1000 + Math.random() * 9000);
    lead.ts = Date.now(); lead.status = "New"; lead.read = false;
    l.unshift(lead); save(LEADS_KEY, l);
  }
  // Expose so the main cart module (and others) can report actions
  window.AmbikaTrack = { logActivity: logActivity, cartSnapshot: cartSnapshot, addLead: addLead, visitorName: visitorName, visitorId: visitorId };

  /* ---------------- Toast + confetti ---------------- */
  var afToastT;
  function toast(msg) {
    var t = el("af-toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(afToastT); afToastT = setTimeout(function () { t.classList.remove("show"); }, 2800);
  }
  function confetti() {
    var wrap = document.createElement("div"); wrap.className = "af-confetti";
    var colors = ["#e84393", "#f47ba9", "#7c3aed", "#f6b93b", "#34d399", "#60a5fa"];
    for (var i = 0; i < 44; i++) {
      var c = document.createElement("span"); c.className = "af-conf";
      c.style.left = Math.random() * 100 + "vw";
      c.style.background = colors[Math.floor(Math.random() * colors.length)];
      c.style.animationDuration = (1.6 + Math.random() * 1.6) + "s";
      c.style.animationDelay = (Math.random() * 0.3) + "s";
      c.style.transform = "rotate(" + (Math.random() * 360) + "deg)";
      wrap.appendChild(c);
    }
    document.body.appendChild(wrap);
    setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 3400);
  }

  /* ---------------- UI injection ---------------- */
  function injectUI() {
    if (el("af-toast")) return;
    var w = document.createElement("div");
    w.innerHTML = [
      '<div id="af-toast"></div>',
      /* Track */
      '<div class="af-ov" id="af-track-ov"></div>',
      '<div class="af-modal" id="af-track" role="dialog">',
      '  <div class="af-head"><button class="af-x" data-close="track">&times;</button><h3>🚚 Track Your Order</h3><p>Live status of your fresh flower delivery</p></div>',
      '  <div class="af-body">',
      '    <div class="af-inrow"><input id="af-track-q" placeholder="Order ID or Mobile Number"><button class="af-go" id="af-track-go">Track</button></div>',
      '    <div class="af-sub" id="af-track-sub">Your active orders</div>',
      '    <div id="af-track-list"></div>',
      '  </div>',
      '</div>',
      /* Location */
      '<div class="af-ov" id="af-loc-ov"></div>',
      '<div class="af-modal" id="af-loc" role="dialog">',
      '  <div class="af-head"><button class="af-x" data-close="loc">&times;</button><h3>📍 Choose Delivery Location</h3><p>Where should we deliver your blooms?</p></div>',
      '  <div class="af-body">',
      '    <button class="af-detect" id="af-detect">🎯 Detect My Current Location</button>',
      '    <div class="af-inrow"><input id="af-loc-q" placeholder="Enter Pincode or City"><button class="af-go" id="af-loc-go">Set</button></div>',
      '    <div class="af-sub">Popular delivery zones</div>',
      '    <div class="af-chips" id="af-loc-chips"></div>',
      '  </div>',
      '</div>',
      /* Reminders drawer */
      '<div class="af-ov" id="af-rem-ov"></div>',
      '<aside class="af-drawer" id="af-rem">',
      '  <div class="af-head"><button class="af-x" data-close="rem">&times;</button><h3>🌸 Occasion Reminders</h3><p>Never miss a special day again</p></div>',
      '  <div class="af-drawer-body">',
      '    <div class="rem-form">',
      '      <div class="rf"><label>Recipient Name</label><input id="rf-name" placeholder="e.g. Mom, Priya"></div>',
      '      <div class="rf"><label>Occasion</label><select id="rf-occ"><option>Birthday</option><option>Anniversary</option><option>Special Event</option></select></div>',
      '      <div class="rf"><label>Date</label><input id="rf-date" type="date"></div>',
      '      <div class="rf"><label>Flower Preference</label><select id="rf-flower"><option>Roses</option><option>Mixed Bouquet</option><option>Lilies</option><option>Orchids</option><option>Sunflowers</option></select></div>',
      '      <button class="save" id="rf-save">＋ Save Reminder</button>',
      '    </div>',
      '    <div class="af-sub">Upcoming reminders</div>',
      '    <div id="af-rem-list"></div>',
      '  </div>',
      '</aside>',
      /* Corporate */
      '<div class="af-ov" id="af-corp-ov"></div>',
      '<div class="af-modal" id="af-corp" role="dialog">',
      '  <div class="af-head"><button class="af-x" data-close="corp">&times;</button><h3>💼 Corporate Gifting</h3><p>Elegant bulk flowers for every occasion</p></div>',
      '  <div class="af-body" id="af-corp-body"></div>',
      '</div>'
    ].join("");
    document.body.appendChild(w);

    // close buttons + overlays
    document.querySelectorAll("[data-close]").forEach(function (b) {
      b.addEventListener("click", function () { closeAll(); });
    });
    ["af-track-ov", "af-loc-ov", "af-rem-ov", "af-corp-ov"].forEach(function (id) {
      var o = el(id); if (o) o.addEventListener("click", closeAll);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(); });

    el("af-track-go").addEventListener("click", function () { renderTrack(el("af-track-q").value); });
    el("af-track-q").addEventListener("keydown", function (e) { if (e.key === "Enter") renderTrack(this.value); });
    el("af-detect").addEventListener("click", detectLocation);
    el("af-loc-go").addEventListener("click", function () { var v = el("af-loc-q").value.trim(); if (v) setLocation(v, /\d{6}/.test(v) ? (v.match(/\d{6}/) || [""])[0] : ""); });
    el("af-loc-q").addEventListener("keydown", function (e) { if (e.key === "Enter") el("af-loc-go").click(); });
    el("rf-save").addEventListener("click", saveReminder);
    renderLocChips();
  }

  function closeAll() {
    ["af-track", "af-loc", "af-corp", "af-rem"].forEach(function (id) { var m = el(id); if (m) m.classList.remove("open"); });
    ["af-track-ov", "af-loc-ov", "af-corp-ov", "af-rem-ov"].forEach(function (id) { var o = el(id); if (o) o.classList.remove("open"); });
  }
  function openModal(id) { closeAll(); el(id).classList.add("open"); el(id + "-ov").classList.add("open"); }

  /* ---------------- TRACK ORDER ---------------- */
  function trackerHTML(o) {
    if (o.statusIdx === "Cancelled" || o.status === "Cancelled") {
      return '<div class="trk-cancel">✖ This order was cancelled.</div>';
    }
    var active = typeof o.statusIdx === "number" ? o.statusIdx : 0;
    return '<div class="trk">' + STEPS.map(function (st, i) {
      var cls = i < active ? "done" : (i === active ? "active" : "");
      var sub = i < active ? "Completed" : (i === active ? st.s : "Pending");
      return '<div class="trk-step ' + cls + '"><div class="trk-line"></div><div class="trk-dot">' + (i < active ? "✓" : st.e) + '</div>' +
        '<div class="trk-txt"><div class="t">' + st.t + '</div><div class="s">' + sub + '</div></div></div>';
    }).join("") + '</div>';
  }
  function orderCardHTML(o) {
    return '<div class="trk-card"><div class="trk-top"><div class="trk-id">' + esc(o.id) + '<small>' + esc(o.product || "") + ' · ' + esc(o.date || "") + '</small></div><div class="trk-amt">₹' + Number(o.amount || 0).toLocaleString("en-IN") + '</div></div>' +
      '<div class="trk-prod">📍 ' + esc(o.address || "") + (o.slot ? ' · 🕒 ' + esc(o.slot) : "") + '</div>' +
      trackerHTML(o) + '</div>';
  }
  function renderTrack(query) {
    var list = el("af-track-list"); var sub = el("af-track-sub");
    var orders = loadOrders();
    var q = (query || "").trim().toLowerCase();
    var rows = orders;
    if (q) {
      var digits = q.replace(/\D/g, "");
      rows = orders.filter(function (o) {
        return o.id.toLowerCase().indexOf(q) !== -1 || (digits && (o.phone || "").replace(/\D/g, "").indexOf(digits) !== -1);
      });
      sub.textContent = rows.length ? 'Results for “' + query + '”' : "No matching orders";
    } else {
      sub.textContent = "Your active orders";
    }
    list.innerHTML = rows.length ? rows.map(orderCardHTML).join("") : '<div style="text-align:center;color:#a1758a;padding:24px;font-size:13.5px;">No orders found. Try another ID or mobile number.</div>';
  }
  function openTrack() { injectUI(); el("af-track-q").value = ""; renderTrack(""); openModal("af-track"); }

  /* ---------------- LOCATION ---------------- */
  var ZONES = [
    { c: "Sikar", p: "332001" }, { c: "Jaipur", p: "302001" }, { c: "Delhi", p: "110001" },
    { c: "Bikaner", p: "334001" }, { c: "Ajmer", p: "305001" }, { c: "Jodhpur", p: "342001" }, { c: "Udaipur", p: "313001" }
  ];
  function renderLocChips() {
    var box = el("af-loc-chips"); if (!box) return;
    box.innerHTML = ZONES.map(function (z) { return '<button class="af-chip" data-city="' + z.c + '" data-pin="' + z.p + '">' + z.c + '</button>'; }).join("");
    box.querySelectorAll(".af-chip").forEach(function (b) {
      b.addEventListener("click", function () { setLocation(b.getAttribute("data-city"), b.getAttribute("data-pin")); });
    });
  }
  function setLocation(city, pin) {
    var label = pin ? city + " - " + pin : city;
    save("ambika_location", { city: city, pin: pin, label: label });
    applyLocation(label);
    closeAll();
    logActivity("location", "📍", "User set delivery location to '" + label + "'");
    toast("📍 Delivering to " + label + " 🌸");
  }
  function applyLocation(label) {
    document.querySelectorAll(".location-btn").forEach(function (b) { b.textContent = "📍 " + label; });
    document.querySelectorAll(".loc-val").forEach(function (v) { v.textContent = label; });
    document.querySelectorAll(".loc-label").forEach(function (v) { v.textContent = "📍 Delivering to"; });
    document.querySelectorAll(".mob-loc-val").forEach(function (v) { v.textContent = label; });
    document.querySelectorAll(".mob-loc-label").forEach(function (v) { v.textContent = "Delivering to"; });
  }
  function detectLocation() {
    var btn = el("af-detect");
    if (!navigator.geolocation) { toast("Geolocation not supported — pick a city below"); return; }
    btn.classList.add("loading"); btn.textContent = "🎯 Detecting…";
    navigator.geolocation.getCurrentPosition(function () {
      // No external reverse-geocode (offline demo) → resolve to nearest served zone
      btn.classList.remove("loading"); btn.textContent = "🎯 Detect My Current Location";
      setLocation("Sikar", "332001");
      toast("📍 Location detected: Sikar - 332001 🌸");
    }, function () {
      btn.classList.remove("loading"); btn.textContent = "🎯 Detect My Current Location";
      toast("Couldn’t detect location — please pick a city");
    }, { timeout: 8000 });
  }
  function openLoc() { injectUI(); openModal("af-loc"); }

  /* ---------------- REMINDERS ---------------- */
  var REM_KEY = "ambika_reminders";
  var FLOWER_ICON = { Birthday: "🎂", Anniversary: "❤️", "Special Event": "🎉" };
  function loadRem() { return load(REM_KEY) || []; }
  function daysUntil(dateStr) {
    var d = new Date(dateStr); if (isNaN(d)) return null;
    var now = new Date(); now.setHours(0, 0, 0, 0);
    // roll to this/next year for recurring occasion feel
    d.setFullYear(now.getFullYear());
    if (d < now) d.setFullYear(now.getFullYear() + 1);
    return Math.round((d - now) / 86400000);
  }
  function badgeFor(dateStr) {
    var n = daysUntil(dateStr);
    if (n === null) return { cls: "upc", txt: "Upcoming" };
    if (n === 0) return { cls: "soon", txt: "Today! 🎉" };
    if (n <= 3) return { cls: "soon", txt: n + " day" + (n > 1 ? "s" : "") + " left!" };
    return { cls: "upc", txt: n + " days left" };
  }
  function renderRem() {
    var list = el("af-rem-list"); if (!list) return;
    var rem = loadRem();
    if (!rem.length) { list.innerHTML = '<div style="text-align:center;color:#a1758a;padding:22px;font-size:13px;">No reminders yet. Add your first special date above! 🌸</div>'; return; }
    // sort by soonest
    rem.sort(function (a, b) { var x = daysUntil(a.date); var y = daysUntil(b.date); return (x == null ? 999 : x) - (y == null ? 999 : y); });
    list.innerHTML = rem.map(function (r, i) {
      var b = badgeFor(r.date);
      return '<div class="rem-card"><button class="rc-del" data-del="' + i + '">✕</button>' +
        '<div class="rc-top"><div class="rc-ic">' + (FLOWER_ICON[r.occ] || "🌷") + '</div>' +
        '<div class="rc-nm">' + esc(r.name) + '<small>' + esc(r.occ) + ' · ' + esc(r.flower || "Roses") + '</small></div>' +
        '<span class="rc-badge ' + b.cls + '">' + b.txt + '</span></div>' +
        '<button class="rc-pre" data-pre="' + esc(r.flower || "") + '">Pre-order Bouquet Now 🌸</button></div>';
    }).join("");
    list.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", function () { var a = loadRem(); a.splice(+btn.getAttribute("data-del"), 1); save(REM_KEY, a); renderRem(); toast("Reminder removed"); });
    });
    list.querySelectorAll("[data-pre]").forEach(function (btn) {
      btn.addEventListener("click", function () { window.location.href = "bouquet.html"; });
    });
  }
  function saveReminder() {
    var name = el("rf-name").value.trim();
    var occ = el("rf-occ").value;
    var date = el("rf-date").value;
    var flower = el("rf-flower").value;
    if (!name || !date) { toast("Enter a name and date"); return; }
    var a = loadRem(); a.push({ name: name, occ: occ, date: date, flower: flower }); save(REM_KEY, a);
    el("rf-name").value = ""; el("rf-date").value = "";
    logActivity("reminder", "⏰", visitorName() + " set a " + occ + " reminder for " + name);
    renderRem(); confetti(); toast("Reminder saved! We’ll remind you 🌸");
  }
  function openRem() { injectUI(); renderRem(); el("af-rem").classList.add("open"); el("af-rem-ov").classList.add("open"); }

  /* ---------------- CORPORATE ---------------- */
  function corpFormHTML() {
    var perks = [
      { e: "🎨", t: "Custom Branding" }, { e: "🏷️", t: "Bulk Discounts" },
      { e: "🗓️", t: "Scheduled Office Deliveries" }, { e: "🎪", t: "Event Decor" }
    ];
    return '<div class="corp-perks">' + perks.map(function (p) { return '<div class="corp-perk"><div class="pe">' + p.e + '</div><div class="pt">' + p.t + '</div></div>'; }).join("") + '</div>' +
      '<div class="corp-form" id="af-corp-form">' +
        '<div class="cf" data-f="c-company"><label>Company Name</label><input id="c-company" placeholder="Your company"></div>' +
        '<div class="corp-two"><div class="cf" data-f="c-person"><label>Contact Person</label><input id="c-person" placeholder="Full name"></div>' +
        '<div class="cf" data-f="c-contact"><label>Email / Phone</label><input id="c-contact" placeholder="you@company.com"></div></div>' +
        '<div class="corp-two"><div class="cf"><label>Event Type</label><select id="c-event"><option>Diwali</option><option>Annual Meet</option><option>Client Welcome</option><option>Employee Appreciation</option><option>Product Launch</option></select></div>' +
        '<div class="cf" data-f="c-qty"><label>Estimated Quantity</label><input id="c-qty" type="number" placeholder="e.g. 50"></div></div>' +
        '<div class="cf"><label>Budget / Requirement</label><input id="c-budget" placeholder="e.g. ₹50,000 · custom hampers with branding"></div>' +
        '<button class="corp-submit" id="c-submit">Request a Quote 💐</button>' +
      '</div>';
  }
  function openCorp() {
    injectUI();
    el("af-corp-body").innerHTML = corpFormHTML();
    el("c-submit").addEventListener("click", submitCorp);
    openModal("af-corp");
  }
  function submitCorp() {
    var company = el("c-company"), person = el("c-person"), contact = el("c-contact"), qty = el("c-qty");
    var ok = true;
    [["c-company", company.value.trim().length < 2], ["c-person", person.value.trim().length < 2], ["c-contact", contact.value.trim().length < 5], ["c-qty", !(+qty.value > 0)]].forEach(function (p) {
      var f = document.querySelector('[data-f="' + p[0] + '"]'); if (f) f.classList.toggle("err", p[1]); if (p[1]) ok = false;
    });
    if (!ok) { toast("Please complete the form"); return; }
    var budgetEl = el("c-budget");
    addLead({
      company: company.value.trim(), person: person.value.trim(), contact: contact.value.trim(),
      event: el("c-event").value, qty: +qty.value || 0, budget: budgetEl ? budgetEl.value.trim() : ""
    });
    logActivity("lead", "🏢", "New Corporate Inquiry received from '" + company.value.trim() + "'");
    el("af-corp-body").innerHTML = '<div class="corp-success"><div class="cs-ic">💼💐</div><h4>Thank you, ' + esc(person.value.trim()) + '!</h4>' +
      '<p>Your corporate gifting enquiry for <b>' + esc(company.value.trim()) + '</b> has been received.<br>Our Corporate Gifting Manager will contact you within <b>2 hours</b>.</p></div>';
    confetti();
    toast("Enquiry submitted 💼💐");
  }

  /* ==========================================================================
     CHECKOUT / PAYMENT
     ========================================================================== */
  var payState = { method: "upi", payload: null, onComplete: null };
  function injectPay() {
    if (el("af-pay")) return;
    var w = document.createElement("div");
    w.innerHTML =
      '<div class="af-ov" id="af-pay-ov"></div>' +
      '<div class="af-modal" id="af-pay" role="dialog">' +
      '  <div class="af-head"><button class="af-x" id="af-pay-x">&times;</button><h3>🌸 Secure Checkout</h3><p>Choose how you’d like to pay</p></div>' +
      '  <div class="af-body" id="af-pay-body"></div>' +
      '</div>';
    document.body.appendChild(w);
    el("af-pay-x").addEventListener("click", closePay);
    el("af-pay-ov").addEventListener("click", closePay);
  }
  function closePay() { var m = el("af-pay"); if (m) m.classList.remove("open"); var o = el("af-pay-ov"); if (o) o.classList.remove("open"); }

  function qrBlock(uri) {
    var fb = "";
    for (var i = 0; i < 121; i++) fb += '<span style="background:' + ((i * 7 + (i % 11) * 13) % 3 ? "#1a2b45" : "transparent") + ';"></span>';
    return '<img class="pay-qr" alt="UPI QR" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(uri) +
      '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\';">' +
      '<div class="pay-qr-fallback">' + fb + '</div>';
  }
  function refField() {
    return '<div class="pay-ref-wrap" style="margin-top:14px;">' +
      '<label style="display:block;font-size:13px;font-weight:700;color:#a23b7a;margin-bottom:6px;">Payment Reference / UPI Transaction ID <span style="color:#d33;">*</span></label>' +
      '<input id="pay-ref" autocomplete="off" placeholder="Payment ke baad app se mili Transaction/UTR ID daalo" ' +
      'style="width:100%;box-sizing:border-box;border:1.5px solid #ecd6e1;border-radius:10px;padding:11px 12px;font-size:14px;"></div>';
  }
  function methodPanel(method, amount) {
    var upiId = "7737014301@ybl";
    var uri = "upi://pay?pa=" + upiId + "&pn=Ambika%20Flowers&am=" + amount + "&cu=INR";
    if (method === "upi" || method === "card") {
      return '<div class="pay-panel"><div style="text-align:center;padding:22px 14px;">' +
        '<div style="font-size:40px;margin-bottom:8px;">🔐</div>' +
        '<div style="font-size:16px;font-weight:800;color:#3a2540;margin-bottom:6px;">Secure Online Payment</div>' +
        '<div style="font-size:13.5px;color:#666;line-height:1.5;">“<b>Confirm &amp; Pay</b>” dabate hi Razorpay ka secure window khulega — usme <b>UPI, GPay/PhonePe/Paytm, Cards, Net Banking &amp; Wallets</b> sab hain. Payment hote hi order apne aap confirm ho jayega.</div>' +
        '</div><div class="pay-secure">🔒 100% Secure · Powered by Razorpay</div></div>';
    }
    return '<div class="pay-panel"><div class="pay-cod">💵 <b>Cash on Delivery</b><br>Pay ₹' + amount + ' in cash when your fresh flowers arrive. Please keep exact change ready. 🌸</div>' +
      '<div class="pay-secure">Your order will be marked <b>Pending COD</b> until delivery.</div></div>';
  }
  /* ---- Distance-based delivery: Sikar ₹100 · outside ₹100 + ₹20/km ---- */
  var SIKAR = { lat: 27.6094, lng: 75.1398 };
  var CITY_KM = { "Jaipur": 115, "Delhi": 280, "Bikaner": 230, "Ajmer": 155, "Jodhpur": 300, "Udaipur": 340, "Churu": 95, "Reengus": 35 };
  var detectedKm = null;   // set after browser geolocation
  function haversine(la1, lo1, la2, lo2) {
    function r(x) { return x * Math.PI / 180; }
    var R = 6371, dLa = r(la2 - la1), dLo = r(lo2 - lo1);
    var s = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(r(la1)) * Math.cos(r(la2)) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function computeDelivery() {
    var loc = load("ambika_location") || {};
    var city = (loc.city || "").trim();
    if (detectedKm != null) {
      if (detectedKm <= 12) return { fee: 100, zone: "Sikar (Local)", detail: "Within Sikar · flat ₹100" };
      var km = Math.max(1, Math.round(detectedKm));
      return { fee: 100 + 20 * km, zone: "Outside Sikar", detail: "~" + km + " km · ₹100 + ₹20/km", km: km };
    }
    if (!city || /sikar/i.test(city)) return { fee: 100, zone: "Sikar (Local)", detail: "Within Sikar · flat ₹100" };
    var ck = CITY_KM[city];
    if (ck) return { fee: 100 + 20 * ck, zone: "Outside Sikar", detail: "~" + ck + " km to " + city + " · ₹100 + ₹20/km", km: ck };
    return { fee: 100, zone: city, detail: "Tap “Detect exact location” for the precise charge" };
  }
  function detectDeliveryLocation(rerender) {
    if (!navigator.geolocation) { toast("Location not supported — using saved area"); return; }
    var btn = el("pay-detect"); if (btn) { btn.textContent = "📍 Detecting…"; btn.classList.add("loading"); }
    navigator.geolocation.getCurrentPosition(function (pos) {
      detectedKm = haversine(SIKAR.lat, SIKAR.lng, pos.coords.latitude, pos.coords.longitude);
      if (rerender) renderPay();
      toast(detectedKm <= 12 ? "📍 You’re in Sikar — ₹100 delivery 🌸" : "📍 ~" + Math.round(detectedKm) + " km from Sikar");
    }, function () {
      if (el("pay-detect")) { el("pay-detect").textContent = "🎯 Detect my exact location"; el("pay-detect").classList.remove("loading"); }
      toast("Location access denied — using your saved area");
    }, { enableHighAccuracy: true, timeout: 9000 });
  }

  function renderPay() {
    var p = payState.payload;
    var del = computeDelivery();
    var delivery = del.fee;
    var total = p.subtotal + delivery;
    payState.total = total;
    payState.deliveryFee = delivery;
    payState.deliveryZone = del.zone;
    var loc = load("ambika_location");
    var payUser = load("ambika_user") || {};
    var prefillAddr = payUser.address || (loc && loc.label ? loc.label : "");
    // When "Coming Soon" mode is on (prices not finalised), allow only Cash on Delivery
    var cs = !!payState.comingSoon;
    var methodsHtml;
    if (cs) {
      methodsHtml =
        '<div class="pay-methods" id="pay-methods">' +
          '<div class="pay-m sel" data-m="cod"><span class="pe">💵</span>Cash on Delivery</div>' +
        '</div>' +
        '<div style="background:#fff0f6;border:1px dashed #e84393;border-radius:12px;padding:11px 13px;margin:2px 0 4px;font-size:13px;color:#7a1f4e;line-height:1.5;">🏷️ Iss product ki pricing abhi finalise ho rahi hai. Abhi <b>Cash on Delivery</b> se order karein — hum aapko call karke final price &amp; details confirm kar denge. 🌸</div>';
    } else {
      methodsHtml =
        '<div class="pay-methods" id="pay-methods">' +
          '<div class="pay-m' + (payState.method === "upi" ? " sel" : "") + '" data-m="upi"><span class="pe">📲</span>UPI / QR</div>' +
          '<div class="pay-m' + (payState.method === "card" ? " sel" : "") + '" data-m="card"><span class="pe">💳</span>Card / Net Banking</div>' +
          '<div class="pay-m' + (payState.method === "cod" ? " sel" : "") + '" data-m="cod"><span class="pe">💵</span>Cash on Delivery</div>' +
        '</div>';
    }
    var confirmLabel = payState.method === "cod" ? ("Place Order · ₹" + total.toLocaleString("en-IN")) : ("Confirm &amp; Pay ₹" + total.toLocaleString("en-IN"));
    var body =
      '<div class="pay-sum">' +
        p.items.map(function (it) { return '<div class="pl"><span>' + esc(it.name) + ' × ' + it.qty + '</span><span>₹' + (it.price * it.qty).toLocaleString("en-IN") + '</span></div>'; }).join("") +
        '<div class="pl"><span>Delivery <small style="color:#a1758a;">(' + esc(del.zone) + ')</small></span><span>₹' + delivery.toLocaleString("en-IN") + '</span></div>' +
        '<div class="pl tot"><span>Total Payable</span><span>₹' + total.toLocaleString("en-IN") + '</span></div>' +
      '</div>' +
      '<div class="pay-deliv"><div class="pay-deliv-txt">🚚 ' + esc(del.detail) + '</div>' +
        '<button type="button" class="pay-detect" id="pay-detect">🎯 Detect my exact location</button></div>' +
      '<div class="pay-flds">' +
        '<div class="pay-fld"><label>Delivery Date</label><input type="date" id="pay-date"></div>' +
        '<div class="pay-fld"><label>Time Slot</label><select id="pay-slot"><option>9 AM – 12 PM</option><option>12 PM – 3 PM</option><option selected>3 PM – 6 PM</option><option>6 PM – 9 PM</option></select></div>' +
        '<div class="pay-fld full"><label>Delivery Address</label><input id="pay-addr" placeholder="Full delivery address" value="' + esc(prefillAddr) + '"></div>' +
        '<div class="pay-fld full"><label>Gift Card Message (optional)</label><textarea id="pay-gift" rows="2" placeholder="Write a sweet note…"></textarea></div>' +
        '<div class="pay-fld full"><label>Customization / Special Request (optional)</label><textarea id="pay-custom" rows="2" placeholder="Koi customization chahiye? Jaise colour, flower type, packing, ya koi khaas message — yahan likho…"></textarea></div>' +
      '</div>' +
      methodsHtml +
      '<div id="pay-panel">' + methodPanel(payState.method, total) + '</div>' +
      '<button class="pay-confirm" id="pay-confirm">' + confirmLabel + '</button>' +
      '<div class="pay-secure">🔒 100% Secure Payments · Razorpay / UPI</div>';
    el("af-pay-body").innerHTML = body;

    el("pay-detect").addEventListener("click", function () { detectDeliveryLocation(true); });
    el("pay-methods").querySelectorAll(".pay-m").forEach(function (m) {
      m.addEventListener("click", function () {
        el("pay-methods").querySelectorAll(".pay-m").forEach(function (x) { x.classList.remove("sel"); });
        m.classList.add("sel"); payState.method = m.getAttribute("data-m");
        el("pay-panel").innerHTML = methodPanel(payState.method, payState.total);
        var cb = el("pay-confirm");
        if (cb) cb.innerHTML = payState.method === "cod" ? ("Place Order · ₹" + payState.total.toLocaleString("en-IN")) : ("Confirm &amp; Pay ₹" + payState.total.toLocaleString("en-IN"));
        wirePanel();
      });
    });
    wirePanel();
    el("pay-confirm").addEventListener("click", confirmPay);
  }
  function wirePanel() {
    var cp = el("pay-copy");
    if (cp) cp.addEventListener("click", function () {
      var t = "7737014301@ybl";
      try { navigator.clipboard.writeText(t); } catch (e) {}
      cp.textContent = "Copied ✓"; setTimeout(function () { cp.textContent = "Copy"; }, 1500);
      toast("UPI ID copied: 7737014301@ybl");
    });
  }
  function ensureRazorpay(cb) {
    if (window.Razorpay) { cb(); return; }
    var s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = function () { cb(); };
    s.onerror = function () { toast("Payment window load nahi hua — internet check karo"); };
    document.head.appendChild(s);
  }
  function confirmPay() {
    // Delivery address is compulsory
    var addrEl = el("pay-addr");
    if (!addrEl || !addrEl.value.trim()) {
      toast("Delivery address daalna zaroori hai 🌸");
      if (addrEl) { addrEl.focus(); addrEl.style.borderColor = "#e84393"; addrEl.scrollIntoView({ behavior: "smooth", block: "center" }); }
      return;
    }
    if (payState.method === "cod") { finalizeOrder("COD", "Pending COD", ""); return; }
    startRazorpay();
  }
  function startRazorpay() {
    var amt = payState.total, btn = el("pay-confirm");
    if (btn) { btn.disabled = true; btn.style.opacity = ".7"; }
    function reset() { if (btn) { btn.disabled = false; btn.style.opacity = ""; } }
    fetch(API_BASE + "/api/razorpay/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: amt }) })
      .then(function (r) { return r.json(); })
      .then(function (o) {
        reset();
        if (!o || !o.id) { toast(o && o.error ? o.error : "Payment shuru nahi hua, dobara try karo"); return; }
        ensureRazorpay(function () {
          var u = (payState.payload && payState.payload.user) || {};
          var rzp = new window.Razorpay({
            key: o.keyId, amount: o.amount, currency: o.currency || "INR", order_id: o.id,
            name: "Ambika Flowers", description: "Order Payment", image: "logo.png",
            prefill: { name: u.name || "", contact: (u.phone || "").replace(/\D/g, ""), email: u.email || "" },
            theme: { color: "#e84393" },
            handler: function (resp) {
              fetch(API_BASE + "/api/razorpay/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(resp) })
                .then(function (r) { return r.json(); })
                .then(function (v) {
                  if (v && v.ok) finalizeOrder("Online (Razorpay)", "Paid", resp.razorpay_payment_id || "");
                  else toast("Payment verify nahi hua — support se baat karo");
                })
                .catch(function () { finalizeOrder("Online (Razorpay)", "Paid", resp.razorpay_payment_id || ""); });
            },
            modal: { ondismiss: function () { toast("Payment cancel ho gaya"); } }
          });
          try { rzp.on("payment.failed", function () { toast("Payment fail ho gaya, dobara try karo"); }); } catch (e) {}
          rzp.open();
        });
      })
      .catch(function () { reset(); toast("Payment server tak nahi pahuncha, dobara try karo"); });
  }
  function finalizeOrder(methodName, paymentStatus, reference) {
    var p = payState.payload;
    var isCod = methodName === "COD";
    var oid = "AMB-" + Math.floor(1000 + Math.random() * 9000);
    var now = Date.now();
    var order = {
      id: oid, customer: (p.user && p.user.name) || "Guest", phone: (p.user && p.user.phone) || "",
      items: p.items, product: p.items.length === 1 ? p.items[0].name : (p.items[0].name + " +" + (p.items.length - 1) + " more"),
      amount: payState.total, statusIdx: 0, status: "Order Received",
      reference: reference, method: methodName, paymentStatus: paymentStatus,
      deliveryDate: (el("pay-date") && el("pay-date").value) || "", slot: (el("pay-slot") && el("pay-slot").value) || "",
      address: (el("pay-addr") && el("pay-addr").value.trim()) || "", gift: (el("pay-gift") && el("pay-gift").value.trim()) || "",
      customization: (el("pay-custom") && el("pay-custom").value.trim()) || "",
      deliveryFee: payState.deliveryFee || 0, deliveryZone: payState.deliveryZone || "",
      placedTs: now, date: new Date(now).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }), track: ""
    };
    var orders = load(ORDERS_KEY) || [];
    orders.unshift(order); save(ORDERS_KEY, orders);
    // Save the order to the shared database so it shows in the admin panel (any device)
    try { fetch(API_BASE + "/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order) }).catch(function () {}); } catch (e) {}
    // Save this delivery address to the customer's profile (so it's pre-filled next time)
    try {
      var ou = p.user || {};
      if ((ou.email || ou.phone) && order.address) {
        fetch(API_BASE + "/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ou.id, name: ou.name, email: ou.email, phone: ou.phone, address: order.address }) }).catch(function () {});
        var uu = load("ambika_user") || {}; uu.address = order.address; save("ambika_user", uu);
      }
    } catch (e) {}
    // reflect in tracking + clear cart
    try { logActivity("order", "✅", ((p.user && p.user.name) ? p.user.name.split(" ")[0] : "Guest") + " placed order " + oid + " (₹" + payState.total + ", " + methodName + ")"); } catch (e) {}
    try { cartSnapshot([]); } catch (e) {}
    if (typeof payState.onComplete === "function") { try { payState.onComplete(); } catch (e) {} }
    confetti(); confetti();
    var garden = '<div class="pay-success-garden" aria-hidden="true">' +
      '<span class="psf" style="--l:6%;--d:0s;--dur:3.4s;">🌸</span>' +
      '<span class="psf" style="--l:20%;--d:.6s;--dur:4s;">🌷</span>' +
      '<span class="psf" style="--l:34%;--d:1.1s;--dur:3.1s;">🌹</span>' +
      '<span class="psf" style="--l:48%;--d:.3s;--dur:4.3s;">💐</span>' +
      '<span class="psf" style="--l:62%;--d:1.5s;--dur:3.6s;">🌺</span>' +
      '<span class="psf" style="--l:76%;--d:.9s;--dur:4.1s;">🌼</span>' +
      '<span class="psf" style="--l:88%;--d:1.8s;--dur:3.3s;">✨</span>' +
      '<span class="psf" style="--l:14%;--d:2.2s;--dur:3.8s;">🌷</span>' +
      '<span class="psf" style="--l:56%;--d:2.6s;--dur:3.5s;">🌸</span>' +
    '</div>';
    el("af-pay-body").innerHTML =
      '<div class="pay-success">' + garden +
        '<div class="pay-burst"><span class="pay-ring"></span><span class="pay-ring r2"></span>' +
          '<div class="pay-check">' + (isCod ? '📦' : '✅') + '</div>' +
          '<span class="pay-pet p1">🌸</span><span class="pay-pet p2">🌷</span><span class="pay-pet p3">🌹</span><span class="pay-pet p4">💐</span><span class="pay-pet p5">🌺</span><span class="pay-pet p6">✨</span>' +
        '</div>' +
        '<h4>' + (isCod ? 'Order Confirmed!' : 'Payment Successful!') + '</h4>' +
        '<div class="oid">Order #' + oid + '</div>' +
        '<p>Thank you, ' + esc(order.customer) + '! Your order for <b>₹' + payState.total.toLocaleString("en-IN") + '</b> is placed' +
        (isCod ? ' with <b>Cash on Delivery</b> — pay when it arrives. 🌸' : ' and <b>paid via ' + methodName + '</b>. 🌸') +
        '<br>Track it live from “Track Order”.</p>' +
        '<div class="pay-brand"><img src="logo.png" alt="Ambika Flowers" onerror="this.style.display=\'none\';this.nextElementSibling.style.marginTop=\'0\';"><div class="pay-brand-name">Ambika Flowers 🌸</div><div class="pay-brand-tag">Fresh Blooms, Delivered with Love ❤️</div></div>' +
        '<button class="pay-confirm" style="margin-top:16px;" onclick="AmbikaFeatures.closePay&&AmbikaFeatures.closePay()">Done</button>' +
      '</div>';
    toast("🎉 Order #" + oid + " placed!");
  }
  window.AmbikaPay = {
    openCheckout: function (payload, onComplete) {
      injectPay();
      payState = { method: "upi", payload: payload, onComplete: onComplete, total: 0, comingSoon: false };
      renderPay();
      el("af-pay").classList.add("open"); el("af-pay-ov").classList.add("open");
      // Auto-detect the customer's home location first, then refine the delivery charge
      if (detectedKm == null) setTimeout(function () { detectDeliveryLocation(true); }, 400);
      // If "Coming Soon" mode is on, restrict checkout to Cash on Delivery only
      fetch(API_BASE + "/api/settings").then(function (r) { return r.ok ? r.json() : {}; }).then(function (s) {
        if (s && s.comingSoon) { payState.comingSoon = true; payState.method = "cod"; renderPay(); }
      }).catch(function () {});
    }
  };

  /* ---------------- HEADER WIRING ---------------- */
  /* ---------------- Search routing ---------------- */
  function routeSearch(q) {
    q = (q || "").toLowerCase().trim();
    if (!q) return;
    var map = [
      [/balloon/, "balloon.html"],
      [/jewel|jewellery|haath|kaleera|nath|bangle/, "flower-jewelry.html"],
      [/vermala|varmala|jaimala|jaymala|garland|\bmala\b/, "vermala.html"],
      [/car|bonnet/, "car-decor.html"],
      [/event|stage|mandap|haldi|mehndi|mehendi|welcome|decor/, "event-decor.html"],
      [/birthday|cake/, "birthday.html"],
      [/anniversar|love|romantic/, "anniversary.html"],
      [/hamper|basket|chocolate|choco|dry ?fruit|gift/, "hamper.html"],
      [/bouquet|flower|rose|bunch|bloom|sunflower|lily|lilies|orchid|carnation|mix|money/, "bouquet.html"]
    ];
    logActivity("page", "🔍", visitorName() + " searched for '" + q + "'");
    for (var i = 0; i < map.length; i++) {
      if (map[i][0].test(q)) { window.location.href = map[i][1]; return; }
    }
    toast("No matching category for “" + q + "” — try ‘bouquet’, ‘balloon’, ‘hamper’… 🌸");
  }
  function wireSearch() {
    document.querySelectorAll(".search-bar, .mob-search-bar").forEach(function (box) {
      if (box.getAttribute("data-af-s")) return; box.setAttribute("data-af-s", "1");
      var input = box.querySelector("input"); if (!input) return;
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); routeSearch(input.value); } });
      box.querySelectorAll("button").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); routeSearch(input.value); }); });
      var icon = box.querySelector("span, svg"); if (icon) { icon.style.cursor = "pointer"; icon.addEventListener("click", function () { routeSearch(input.value); }); }
    });
  }

  /* ---------------- Show admin-added products on the storefront ---------------- */
  function pageCategory() {
    var f = (location.pathname.split("/").pop() || "").toLowerCase();
    var map = { "bouquet.html": "Bouquet", "hamper.html": "Hamper", "vermala.html": "Vermala", "car-decor.html": "Car Decor", "event-decor.html": "Event Decor", "birthday.html": "Birthday", "anniversary.html": "Anniversary", "balloon.html": "Balloon", "flower-jewelry.html": "Flower Jewelry" };
    return map[f] || null;
  }
  function homeCard(p, dp, img) {
    var card = document.createElement("div");
    card.className = "product-card"; card.setAttribute("data-cust", p.id);
    card.setAttribute("data-cat", "custom " + (p.category || "").toLowerCase()); card.style.cursor = "pointer";
    card.innerHTML =
      '<div class="product-img-wrap"><img class="product-img" src="' + esc(img) + '" alt="' + esc(p.title) + '" onerror="this.style.visibility=\'hidden\'"></div>' +
      '<div class="product-info"><span class="product-badge badge-new">New</span>' +
      '<div class="product-name">' + esc(p.title) + '</div>' +
      '<div class="product-rating"><span class="stars">★★★★★</span><span class="rating-count">(New)</span></div>' +
      '<div class="product-price"><span class="price-current">₹' + dp.toLocaleString("en-IN") + '</span>' +
      (p.discount ? '<span class="price-original">₹' + Number(p.price).toLocaleString("en-IN") + '</span><span class="price-off">' + p.discount + '% OFF</span>' : '') +
      '</div><button class="add-to-cart">🛒 Add to Cart</button></div>';
    card.addEventListener("click", function (e) { if (e.target.closest(".add-to-cart")) return; if (window.AmbikaShop && window.AmbikaShop.openProductPage) window.AmbikaShop.openProductPage(card); });
    return card;
  }
  function catCard(p, dp, img) {
    var card = document.createElement("div");
    card.className = "product-card"; card.setAttribute("data-cust", p.id);
    card.setAttribute("data-sub", "all"); card.setAttribute("data-price", dp); card.setAttribute("data-name", p.title);
    card.innerHTML =
      '<div class="product-img-wrap"><img class="product-img" src="' + esc(img) + '" alt="' + esc(p.title) + '" onerror="this.style.visibility=\'hidden\'"></div>' +
      '<div class="product-info"><div class="product-sub-tag">✨ New Arrival</div>' +
      '<div class="product-name">' + esc(p.title) + '</div>' +
      '<div class="product-price">₹' + dp.toLocaleString("en-IN") + '</div>' +
      '<button class="add-to-cart">Add to Cart</button></div>';
    return card;
  }
  function renderCustomProducts() {
    var prods = load("ambika_products") || [];
    var customs = prods.filter(function (p) { return p.custom; });
    if (!customs.length) return;
    var sig = document.getElementById("sig-slider");
    var catGrid = document.getElementById("productGrid");
    var pageCat = pageCategory();
    customs.forEach(function (p) {
      var dp = p.discountPrice || (p.discount ? Math.round(p.price * (1 - p.discount / 100)) : p.price);
      var img = p.image || "";
      if (sig && !sig.querySelector('[data-cust="' + p.id + '"]')) sig.insertBefore(homeCard(p, dp, img), sig.firstChild);
      if (catGrid && pageCat && p.category === pageCat && !catGrid.querySelector('[data-cust="' + p.id + '"]')) catGrid.insertBefore(catCard(p, dp, img), catGrid.firstChild);
    });
  }

  function logPageView() {
    var name = "";
    var pn = document.getElementById("p-name");
    var ch = document.querySelector(".category-header h1");
    if (pn && pn.textContent.trim()) name = pn.textContent.trim();
    else if (ch && ch.textContent.trim()) name = ch.textContent.trim();
    else name = (document.title || "Ambika Flowers").split("—")[0].split("|")[0].trim() || "Home";
    logActivity("page", "🌸", visitorName() + " viewed '" + name + "'");
  }

  /* ---------------- Scroll-reveal animations (site-wide) ---------------- */
  function initReveal() {
    if (!("IntersectionObserver" in window)) return;
    var sels = ".product-card, .occasion-card, .trust-item, .category-header, .bs-card, .card2, .order-card, .sig-slider .product-card, .hero-banner, .occasion-title, .sec-title";
    var els = Array.prototype.slice.call(document.querySelectorAll(sels));
    if (!els.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("ak-reveal-in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.06, rootMargin: "0px 0px -30px 0px" });
    els.forEach(function (e, i) { e.classList.add("ak-reveal"); e.style.transitionDelay = ((i % 6) * 0.04) + "s"; io.observe(e); });
  }

  /* ---- Live prices from the shared database (admin edits reflect here) ----
     When the admin turns ON "Coming Soon" mode (global setting), every price on
     the storefront is replaced with "Coming Soon" (works on all card layouts,
     mobile + PC). When OFF, live prices from the database are shown as usual. */
  function applyComingSoonSweep() {
    // Replace every visible price with "Coming Soon" (all card layouts, mobile + PC)
    [".product-price", ".price-current", ".bs-card-price", ".verm-price"].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) { el.textContent = "Coming Soon"; });
    });
    // Hide struck-through MRP + discount badges (they look odd next to "Coming Soon")
    [".price-original", ".price-off", ".bs-card-old", ".bs-card-off"].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) { el.style.display = "none"; });
    });
    document.querySelectorAll(".product-card").forEach(function (card) { card.setAttribute("data-price", 0); });
  }
  // Run the sweep now and a few more times, so late-built sliders (bestsellers,
  // vermala) also get caught no matter when they render.
  function applyComingSoonRepeat() {
    applyComingSoonSweep();
    setTimeout(applyComingSoonSweep, 500);
    setTimeout(applyComingSoonSweep, 1500);
  }
  function syncStorefrontPrices() {
    var pSettings = fetch(API_BASE + "/api/settings").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
    var pProducts = fetch(API_BASE + "/api/products").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
    Promise.all([pSettings, pProducts]).then(function (res) {
      var settings = res[0] || {}, list = res[1] || [];
      if (settings.comingSoon) { applyComingSoonRepeat(); return; }   // Coming Soon mode ON
      if (!Array.isArray(list) || !list.length) return;
      var byName = {};
      list.forEach(function (p) { if (p && p.title) byName[String(p.title).trim().toLowerCase()] = p; });
      document.querySelectorAll(".product-card").forEach(function (card) {
        var nm = card.getAttribute("data-name");
        if (!nm) { var nel = card.querySelector(".product-name"); nm = nel ? nel.textContent : ""; }
        var p = byName[String(nm).trim().toLowerCase()]; if (!p) return;
        var dp = p.discount ? Math.round(p.price * (1 - p.discount / 100)) : p.price;
        var money = "₹" + Number(dp).toLocaleString("en-IN");
        var pe = card.querySelector(".product-price"); if (pe) pe.textContent = money;
        var cur = card.querySelector(".price-current"); if (cur) cur.textContent = money;
        card.setAttribute("data-price", dp);
      });
    }).catch(function () {});
  }

  function wire() {
    injectUI();
    logPageView();
    wireSearch();
    renderCustomProducts();
    syncStorefrontPrices();
    initReveal();
    // live-add products created in the admin (other tab)
    window.addEventListener("storage", function (e) { if (e.key === "ambika_products") renderCustomProducts(); });
    // apply saved location
    var loc = load("ambika_location"); if (loc && loc.label) applyLocation(loc.label);

    // keyword triggers on header controls
    document.querySelectorAll(".util-link, .action-item, .icon-btn").forEach(function (elm) {
      if (elm.getAttribute("data-af")) return;
      var txt = (elm.textContent || "").toLowerCase();
      if (txt.indexOf("track") !== -1) { tag(elm, "track"); elm.addEventListener("click", function (e) { e.preventDefault(); openTrack(); }); }
      else if (txt.indexOf("reminder") !== -1) { tag(elm, "rem"); elm.addEventListener("click", function (e) { e.preventDefault(); openRem(); }); }
      else if (txt.indexOf("corporate") !== -1) { tag(elm, "corp"); elm.addEventListener("click", function (e) { e.preventDefault(); openCorp(); }); }
    });
    // location controls
    document.querySelectorAll(".location-btn, .loc-box, .mob-loc-box").forEach(function (elm) {
      if (elm.getAttribute("data-af")) return; tag(elm, "loc");
      elm.style.cursor = "pointer";
      elm.addEventListener("click", function (e) { e.preventDefault(); openLoc(); });
    });

    // live sync: admin updates ambika_orders in another tab → refresh open tracker
    window.addEventListener("storage", function (e) {
      if (e.key === ORDERS_KEY && el("af-track") && el("af-track").classList.contains("open")) {
        renderTrack(el("af-track-q").value);
      }
    });
  }
  function tag(elm, name) { elm.setAttribute("data-af", name); elm.style.cursor = "pointer"; }

  // public API
  window.AmbikaFeatures = { openTrack: openTrack, openLoc: openLoc, openRem: openRem, openCorp: openCorp, loadOrders: loadOrders, closePay: closePay };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();
