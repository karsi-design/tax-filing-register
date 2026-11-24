# Filing Register

A Next.js app that uses a Google Drive folder as the database for a family's ITR
filings: one subfolder per family member, then one subfolder per assessment year
inside that, holding up to four documents (ITR, Computation, Balance Sheet, Tax
Audit Report). A dropdown at the top switches between family members; clicking a
document cell previews it and lets you download, replace, or remove it.

There is no login or password — anyone with the deployed URL can view and upload.
That's fine for a private link only you and your family have; see the Notes section
if you ever want to lock it down later.

## How the data is organised in Drive

```
Your Drive folder (ROOT)
├── Vikas Mittal/
│   ├── AY 2024-25/           <- folder description holds "FY 2023-24"
│   │   ├── itr.pdf
│   │   ├── computation.pdf
│   │   ├── balanceSheet.pdf
│   │   └── taxAudit.pdf
│   └── AY 2025-26/
│       └── computation.pdf
├── Poonam Mittal/
│   └── AY 2024-25/
│       └── ...
└── Rimpi Mittal/
    └── ...
```

No database is used — the app reads this folder structure live on every request.
Add a family member in the dropdown and it creates their folder; add a year and it
creates that subfolder; upload a document and it's saved with the right file name
automatically. Family members are just Drive folders named whatever you type — add
as many as you need.

---

## 1. Set up Google Drive access (one-time)

This app authenticates as **your own Google account** (OAuth), not a service account.
Service accounts have zero storage quota of their own, so Drive refuses to let them
create files in a regular folder even when it's shared with Editor access — this
route sidesteps that entirely, and needs no special admin permissions.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a project
   (or use an existing one).
2. **Enable the Drive API**: APIs & Services → Library → search "Google Drive API" → Enable.
3. **Configure the OAuth consent screen** if you haven't already: APIs & Services → OAuth
   consent screen → choose "External" → fill in an app name and your email → save. It's fine
   for this to stay in "Testing" status — just add your own Google account under "Test users".
4. **Create an OAuth Client ID**: APIs & Services → Credentials → Create Credentials → OAuth
   client ID → Application type: **Desktop app** → give it any name → Create. Note the
   **Client ID** and **Client secret** shown.
5. In your own Google Drive, create a folder (e.g. "Vikas Mittal — Filings") — no sharing
   needed this time, it's already yours. Open it and copy its ID from the URL:
   `https://drive.google.com/drive/folders/`**`THIS_PART_IS_THE_ID`**

## 2. Run it locally in VS Code

```bash
cd tax-filing-register
npm install
```

Generate your refresh token (one-time, opens a browser login):
```bash
node scripts/get-refresh-token.js <CLIENT_ID> <CLIENT_SECRET>
```
Sign in with the Google account whose Drive you want to use, click Allow, and the script
prints three values in the terminal.

```bash
cp .env.local.example .env.local
```
Open `.env.local` and fill in the three values the script printed, plus `DRIVE_ROOT_FOLDER_ID`
from step 1.5.

Then:
```bash
npm run dev
```
Open **`http://localhost:3000`** — not the `192.168.x.x` network address npm sometimes also
prints, which Next.js blocks for safety in dev mode and can cause buttons to silently not work.
Click **+ Add family member** to create the first person, then **+ Add filing year**, then click
any document chip to upload a real file — it lands in your Drive folder within seconds, nested
under that person's folder.

## 3. Deploy to Vercel

1. Push this project to a GitHub repo (or run `npx vercel` directly from this folder — it works
   without GitHub too).
2. In the [Vercel dashboard](https://vercel.com/new), import the repo (or confirm the CLI deploy).
3. Before the first deploy finishes, go to the project's **Settings → Environment Variables** and
   add the same four variables from `.env.local`:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REFRESH_TOKEN`
   - `DRIVE_ROOT_FOLDER_ID`
4. Redeploy (Vercel → Deployments → ⋯ → Redeploy) so the new env vars take effect.
5. Open the live URL Vercel gives you — same app, same Drive folder, now reachable from anywhere.

## Importing your existing files in bulk

If you already have a folder per family member with years and documents inside (like the
`ITR & COMPUTATION` archive), the fastest path is still to re-upload through the app itself —
for each person, add them, add each filing year, and upload each document through the chips.
It's a few dozen clicks but guarantees the folder names and file names match exactly what the
app expects (`AY <year>` folders with a `FY <year>` description, files named `itr.pdf`,
`computation.pdf`, etc.). Dragging your existing folders into Drive as-is won't work directly,
since their folder names (e.g. `FY 2022-23`) don't match the app's naming convention.

If you'd rather not re-upload by hand, tell me and I'll write a one-off script that reads your
zip's folder structure directly and pushes everything into Drive in the right shape automatically.

## Notes

- **No login:** anyone with the Vercel URL can view, upload, and delete for any family member.
  Keep the URL private within the family. If you change your mind later, Vercel supports simple
  password protection on paid plans, or I can add a basic login page.
- **File types:** preview works inline for PDFs and images; anything else (e.g. `.rtf`, `.doc`)
  shows a download-only prompt. Convert such files to PDF before uploading for the best preview —
  your archive has a few `.rtf`/`.doc` computation files that will need this.
