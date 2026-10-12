# SHAHZON Clip League: free hosting on GitHub Pages + Google Sheets

- **website/** is the site. It goes on GitHub Pages (free).
- **google-apps-script/Code.gs** is the backend. It runs inside a Google Sheet (free) and stores every entry, score and expense in that sheet.

Total time: about 15 minutes. You only need a Google account and a GitHub account.

---

## Part A: Google Sheet backend (do this first)

1. Go to https://sheets.new and name the sheet **SHAHZON Clip League Data**.
2. Click **Extensions → Apps Script**.
3. Delete everything in the editor, then paste the full contents of `google-apps-script/Code.gs`.
4. On line 8, replace `CHANGE_THIS_PASSWORD` with your own organiser password (at least 10 characters). Keep the quotes. Click **Save** (disk icon).
5. In the toolbar, choose the function **setup** in the dropdown and click **Run**.
   - Google asks for permission: **Review permissions → choose your account → Advanced → Go to (project name) → Allow**. This is your own script, so it's safe.
6. Click **Deploy → New deployment**.
   - Click the gear icon next to "Select type" and choose **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, then copy the **Web app URL** (it ends with `/exec`).

## Part B: Website on GitHub Pages

1. Open `website/config.js` in Notepad and paste the Web app URL between the quotes:
   ```js
   window.SZ_CONFIG = {
     apiUrl: "https://script.google.com/macros/s/XXXXXXXX/exec"
   };
   ```
   Save the file.
2. On github.com, click **New repository**. Name it `shahzon-clip-league`, set it to **Public**, and click **Create repository**.
3. Click **uploading an existing file**. Drag in **everything inside the `website` folder** (`index.html`, `config.js`, the `assets` folder, and `.nojekyll`). Click **Commit changes**.
4. Go to the repository's **Settings → Pages**.
   - Source: **Deploy from a branch**
   - Branch: **main**, folder **/ (root)** → **Save**
5. Wait 1–2 minutes. Your site is live at:
   `https://YOUR-GITHUB-USERNAME.github.io/shahzon-clip-league/`

## Part C: First sign-in

1. Open the site. In the footer, click **Organiser** and enter your password.
2. Go to **Admin → Settings** and fill in the start date, end date, results date, official channel URL, community link and winners' contact. Save.
3. Share the site link with clippers.

---

## Day-to-day
- Clippers apply and submit clips on **Join & Submit**. They see the status of their own entries in the same browser.
- **Admin → Inbox**: accept or reject entries. Accepting an application creates the next Clipper ID (SZ001, SZ002…). Send that ID to the clipper on your community channel.
- **Admin → Clips & scoring**: score with the 35 / 30 / 20 / 15 rubric. Only clips marked *eligible* appear publicly, and the leaderboard updates automatically.
- **Budget**, **Metrics**, **Overview → payouts**, **Templates** and **Launch checklist** work the same way.
- Every record is also a row in the `docs` tab of your Google Sheet. Don't edit or delete those rows by hand; use the Admin panel.

## Changing the password
Edit `ADMIN_PASSWORD` in Apps Script, click Save, then **Deploy → Manage deployments → pencil icon → Version: New version → Deploy**. The URL stays the same. Anyone signed in is signed out.

## Updating the backend code later
Always use **Manage deployments → New version**. Creating a *new deployment* gives a new URL, which you would then have to paste into `config.js` again.

## Custom domain (optional)
In the repository's **Settings → Pages → Custom domain**, add a domain such as `league.yourdomain.com`. Then add a CNAME record at your domain provider pointing to `YOUR-GITHUB-USERNAME.github.io`.

## Limits
- Google's free Apps Script quota easily covers a league of this size (hundreds of visitors and entries a day).
- Pages refresh data every 30 seconds.
- Spam protection: hidden honeypot field, max 8 entries per visitor per hour, max 10 sign-in attempts per 15 minutes.

## Backup
In Google Sheets: **File → Download → Microsoft Excel (.xlsx)** once a week, or use **File → Make a copy**.
