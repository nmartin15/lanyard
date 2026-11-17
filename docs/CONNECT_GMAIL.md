# Connect Gmail to Lanyard (one-time setup)

This is the **computer** setup. Do it once. After that, the phone only needs: tap Connect Gmail → sign in → Allow.

You are teaching Google: “Lanyard may send email **as me**, but only when I approve a note.”

Keep it simple: one Google Cloud project, one Web OAuth client, your Mac’s overnight server.

---

## What you need before you start

1. A computer (your Mac) with this Lanyard project open.
2. A browser signed into the **same Google account** you want to send from (work Gmail is fine).
3. Your iPhone on the **same Wi‑Fi** as the Mac (for dogfood).
4. About 15–20 minutes. Don’t skip steps.

---

## Part A — Find your Mac’s Wi‑Fi address

Your phone cannot use `localhost`. It needs your Mac’s LAN IP.

1. On your Mac, open **System Settings**.
2. Click **Network**.
3. Click **Wi‑Fi** (the network you’re on).
4. Click **Details…** (or the “i” / details for that network).
5. Find **IP Address**. It usually looks like `192.168.1.20` or `10.0.0.5`.
6. Write it down. Below we’ll call it `YOUR_LAN_IP`.

Check it works:

```bash
# On the Mac, in Terminal:
ipconfig getifaddr en0
# If blank, try:
ipconfig getifaddr en1
```

---

## Part B — Create a Google Cloud project

1. Open [https://console.cloud.google.com/](https://console.cloud.google.com/) in Chrome.
2. Sign in with the Google account you’ll send email from (or an admin account that can create projects).
3. At the top bar, open the **project picker** (it may say “Select a project”).
4. Click **New Project**.
5. **Project name:** type `Lanyard` (or anything you’ll recognize).
6. Leave Organization blank unless your company requires one.
7. Click **Create**.
8. Wait until it finishes, then make sure **Lanyard** is the selected project in the top bar.

---

## Part C — Turn on the Gmail API

1. In the left menu, go to **APIs & Services** → **Library**.  
   (If the menu is collapsed, click the ☰ hamburger first.)
2. In the search box, type `Gmail API`.
3. Click **Gmail API** in the results.
4. Click **Enable**.
5. Wait until it says enabled / you land on the Gmail API page.

---

## Part D — Configure the OAuth consent screen (who can sign in)

1. Go to **APIs & Services** → **OAuth consent screen**.
2. If Google asks for **User type**:
   - Choose **External** (unless you only use Workspace internal apps and know you need Internal).
   - Click **Create**.
3. **App information**
   - **App name:** `Lanyard`
   - **User support email:** pick your email from the dropdown
   - **App logo:** skip
4. **App domain** — leave blank for now.
5. **Developer contact information** — enter your email.
6. Click **Save and Continue**.
7. **Scopes** screen:
   - Click **Add or Remove Scopes**.
   - Search / find and check:
     - `.../auth/gmail.send` (Send email on your behalf)
     - `email`
     - `openid`
   - Click **Update**, then **Save and Continue**.
8. **Test users** (important while the app is in Testing):
   - Click **Add Users**.
   - Add the exact Gmail address you’ll connect on the phone.
   - Click **Add**, then **Save and Continue**.
9. Review → **Back to Dashboard**.

> While status is **Testing**, only test users can connect. That’s what you want for dogfood.

---

## Part E — Create OAuth credentials (the “keys”)

1. Go to **APIs & Services** → **Credentials**.
2. Click **+ Create Credentials** → **OAuth client ID**.
3. If Google asks you to configure the consent screen first, finish Part D, then come back.
4. **Application type:** choose **Web application** (yes — Web — even for the phone. The phone talks to your Mac server; the server talks to Google).
5. **Name:** `Lanyard overnight server`
6. **Authorized JavaScript origins** — leave empty.
7. **Authorized redirect URIs** — click **Add URI** and add **both** of these (copy carefully):

   ```text
   http://localhost:8787/oauth/google/callback
   http://YOUR_LAN_IP:8787/oauth/google/callback
   ```

   Example if your IP is `192.168.1.20`:

   ```text
   http://localhost:8787/oauth/google/callback
   http://192.168.1.20:8787/oauth/google/callback
   ```

8. Click **Create**.
9. A popup shows **Client ID** and **Client secret**.
10. Copy both somewhere safe for the next part (or download the JSON).  
    You can always reopen: Credentials → click the client name → copy again.

---

## Part F — Put the keys into Lanyard’s `.env`

1. In the Lanyard project folder on your Mac:

   ```bash
   cp .env.example .env
   ```

   (Skip if `.env` already exists.)

2. Open `.env` in any editor.
3. Set these lines (paste your real values; no quotes needed):

   ```bash
   # Phone → your Mac (use YOUR_LAN_IP, not localhost, for a real iPhone)
   EXPO_PUBLIC_OVERNIGHT_URL=http://YOUR_LAN_IP:8787

   # Gmail OAuth (server only — never share these)
   GOOGLE_CLIENT_ID=paste-client-id-here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=paste-client-secret-here
   GOOGLE_REDIRECT_URI=http://YOUR_LAN_IP:8787/oauth/google/callback
   ```

4. **Critical:** `GOOGLE_REDIRECT_URI` must be **exactly** one of the URIs you added in Part E (same IP, same port, same path).
5. Save the file.

Optional (overnight research LLM — separate from Gmail):

```bash
OPENAI_API_KEY=sk-...
```

---

## Part G — Start the overnight server

1. In Terminal, from the Lanyard project folder:

   ```bash
   npm run overnight:server
   ```

2. You should see something like:

   ```text
   Lanyard overnight server on http://0.0.0.0:8787
   Gmail OAuth: ready · redirect http://YOUR_LAN_IP:8787/oauth/google/callback
   ```

3. If it says **Gmail OAuth: not configured**, re-check Part F — a typo in env names is the usual culprit.
4. Leave this Terminal window **running**.

Sanity check on the Mac:

```bash
curl -s http://localhost:8787/health | python3 -m json.tool
```

Look for `"gmail": { "configured": true, ... }`.

From the phone’s browser (optional): open `http://YOUR_LAN_IP:8787/health` — you should see JSON, not an error.

---

## Part H — Restart the Expo app so it picks up `.env`

1. Stop Metro if it’s running (Ctrl+C in that terminal).
2. Start again:

   ```bash
   npm start
   ```

3. Open Lanyard on your iPhone (dev client), connected to Metro as you already do.

---

## Part I — Connect Gmail on the phone (what you’ll feel)

1. Open **Team** (or finish intake → **Preferences** / constraints).
2. Read the numbered steps on screen.
3. Tap **Connect Gmail**.
4. A browser sheet opens → pick your Google account.
5. Google may say the app is unverified / testing — choose **Continue** (you’re the test user).
6. When it asks for permission to **send email**, tap **Allow**.
7. You should bounce back into Lanyard and see your address.
8. Go to **Decisions**.
9. Open a lead → type a real **To** email (for a first test, use your own address).
10. Tap **Send**.
11. Check that inbox — you should get the note **from** your connected Gmail.

---

## If something breaks

| Symptom | Likely fix |
| --- | --- |
| “No server URL” | Set `EXPO_PUBLIC_OVERNIGHT_URL`, restart Expo |
| “OAuth isn’t configured” | Set `GOOGLE_*` in `.env`, restart `npm run overnight:server` |
| Google `redirect_uri_mismatch` | Redirect URI in Console ≠ `GOOGLE_REDIRECT_URI` — fix to match exactly |
| Phone can’t reach server | Same Wi‑Fi; use LAN IP not localhost; Mac firewall allowing Node |
| “Access blocked: app not verified” | Add your Gmail under OAuth consent **Test users** |
| Send fails / no refresh token | Disconnect in Google Account → Security → Third-party access, Connect again |
| Send fails “recipient” | Fill the **To** field on the Decision card |

---

## What this does / does not do

**Does**

- OAuth sign-in with Google
- Store refresh token on your Mac (`server/mail-tokens/`, gitignored)
- Send approved outreach through the **Gmail API** as you

**Does not (yet)**

- Microsoft 365 send
- Real web research for leads (still local sim / optional LLM overnight)
- Sending without you tapping Send

---

## Security notes (plain language)

- Client secret stays on your Mac server, not in the phone app binary.
- Tokens live in `server/mail-tokens/` — don’t commit them.
- Lanyard only sends when you tap **Send** on a Decision.
- Scope is `gmail.send` (send only), not full mailbox read.
