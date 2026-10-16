# EcoHome website — deploying on Vercel

## Preview locally
```
python3 -m http.server 8000   # then open http://localhost:8000
```

## Mobile fixes (Oct 2026)
- The mobile **Menu** button opened an empty panel: the CSS rule that hides the desktop nav on small screens (`header nav{display:none}`) also hid the mobile nav. It now only targets `nav[data-eh-nav="desktop"]`.
- The open menu now sits above the cookie banner and bottom call bar, so every item is tappable.
- React is loaded from `vendor/` instead of unpkg.com. If the CDN was slow or blocked on a phone, the runtime never booted and the pages rendered blank.

## What's in this folder
- `index.html` — the website (every page lives in this one file)
- `EcoHomeLogoAnim.dc.html` — the animated logo
- `support.js` — the runtime that renders the pages
- `vendor/` — React and the `<model-viewer>` 3D viewer, bundled locally
- The hero photo, the three house renders and the 3D house models were generated with Higgsfield and are served from its CDN (`d8j0ntlcm91z4.cloudfront.net`). To make the site fully self-contained, download them into `assets/` and update the URLs in `index.html`.
- `assets/` — logo, logo animation frames and your photos
- `vercel.json` — security headers and caching
- `robots.txt` — lets search engines index the site

Keep the folder structure exactly as it is.

## Option A — no coding (GitHub + Vercel), about 10 minutes
1. Create a free account at github.com.
2. Click **New repository**, name it `ecohome-website`, set it to **Private**, and click **Create**.
3. On the empty repo page click **uploading an existing file**, drag in **everything inside this folder** (not the folder itself), then click **Commit changes**.
4. Go to vercel.com, sign up with **Continue with GitHub**.
5. Click **Add New → Project**, pick `ecohome-website`, click **Import**.
6. Leave every setting as default (Framework: *Other*, no build command) and click **Deploy**.
7. About 30 seconds later you get a live link like `ecohome-website.vercel.app`.

To update the site later: upload the changed files to the GitHub repo and Vercel redeploys automatically.

## Option B — command line
```
npm i -g vercel
cd website-upload
vercel          # first deploy (preview link)
vercel --prod   # publish to production
```

## Connect your domain
1. In Vercel open the project → **Settings → Domains** → type your domain (`ecohomegb.com`) → **Add**.
2. Vercel shows the DNS records to set. At your domain registrar (Namecheap, GoDaddy, 123-reg, Cloudflare…) add:
   - **A record** — host `@` — value `76.76.21.21`
   - **CNAME record** — host `www` — value `cname.vercel-dns.com`
   (Use whatever Vercel shows on screen if it differs.)
3. Wait 10 minutes to a few hours. Vercel issues the HTTPS certificate automatically.
4. In Domains, set `www` to redirect to the root domain (or the other way round) so there's one address.

## Before you announce it
- [ ] **Turn on form emails.** Every form (Contact, Book a Call with the chosen slot, Investor Pack request, Submit a Site, data requests) is sent by `api/enquiry.js` to **info@ecohomegb.com** and **walid@ecohomegb.com**. Replying to the email replies to the visitor. To switch it on:
  1. Sign up free at resend.com.
  2. **Domains → Add Domain** → `ecohomegb.com`. Add the DNS records it shows at your domain provider and wait for "Verified".
  3. **API Keys → Create API Key** (sending access) and copy it.
  4. In Vercel: project → **Settings → Environment Variables** → add `RESEND_API_KEY` with that key (all environments) → then **Deployments → Redeploy**.
  5. Send a test from the Contact page. To change who receives emails, add an `ENQUIRY_TO` variable, e.g. `info@ecohomegb.com,walid@ecohomegb.com`.
- [ ] Written permission from Steel Homes and Ozok Steel for their photos.
- [ ] Solicitor review of the investor page and legal pages.
- [ ] Add your ICO registration number to the Privacy page.
