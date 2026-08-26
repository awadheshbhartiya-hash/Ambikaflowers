# Ambika Flowers 🌸

Flower-delivery storefront + admin panel. Static site (HTML/CSS/JS) served by a tiny Express server so it can run on Railway.

**Homepage:** `index2.html` · **Admin:** `/admin.html` (login `ambika` / `ambika123`)

---

## What goes on Railway

The **whole folder** goes on Railway. Railway installs the dependency (Express) and runs `server.js`, which serves every file — all HTML pages, `shop.css`, `shop.js`, `admin.js`, `characters.js`, and the `products/` images. Nothing is left out.

> Note: right now data (orders, products) is stored in the browser's `localStorage`, so it is **per-browser** — a real shared database is a later phase.

---

## Deploy steps (do these in order)

### 1. Put the code on GitHub (client's account)
1. Log in to the **client's GitHub** account and create a new repository, e.g. `ambika-flowers`.
2. Push this folder to it. Easiest options:
   - **GitHub Desktop**: Add this folder → Publish to the client's repo.
   - or terminal:
     ```
     git init
     git add .
     git commit -m "Ambika Flowers site"
     git branch -M main
     git remote add origin https://github.com/<client-username>/ambika-flowers.git
     git push -u origin main
     ```

### 2. Deploy on Railway
1. Go to **railway.app** → sign in with the same GitHub.
2. **New Project → Deploy from GitHub repo →** pick `ambika-flowers`.
3. Railway auto-detects Node, runs `npm install`, then `npm start`. No settings needed.
4. When it finishes, open **Settings → Networking → Generate Domain** to get a live `*.up.railway.app` URL. The site is now live. ✅

### 3. Connect the domain `ambikaflowers.in`
1. In Railway: **Settings → Networking → Custom Domain →** type `ambikaflowers.in` (and `www.ambikaflowers.in`). Railway will show a **CNAME/A record** target.
2. Log in where the domain was bought (GoDaddy / Hostinger / BigRock, etc.) → **DNS settings**.
3. Add the record Railway gave you:
   - `www` → **CNAME** → the Railway target
   - root `@` → **A/ALIAS/ANAME** → the value Railway shows (some registrars use ANAME/ALIAS for the root).
4. Wait for DNS to propagate (few minutes to a few hours). Railway will auto-issue HTTPS.

---

## What you need (accounts — create yourself)
- Client's **GitHub** account + a repo
- **Railway** account
- Access to **ambikaflowers.in** DNS settings (registrar login)

## Run locally (optional)
```
npm install
npm start
```
Then open http://localhost:3000
