# Setup & Deployment Guide

This guide takes you from the zip file to a live, public demo — step by step, assuming you have never
deployed anything before. Everything here is **free** (no credit card needed anywhere).

| Part | Where it runs | Cost |
|---|---|---|
| Frontend (Next.js) | Vercel — Hobby plan | Free |
| Backend (FastAPI + SQLite) | Render — Free web service | Free |
| AI notes & AskFred | Groq API (key already included) | Free |
| Keep the backend awake | UptimeRobot — 5-minute monitor | Free |

Total time: about 1 hour the first time. Do the parts in order.

- **Part A** — Install the tools (one time)
- **Part B** — Run the app on your computer
- **Part C** — Put the code on GitHub
- **Part D** — Deploy the backend on Render
- **Part E** — Deploy the frontend on Vercel
- **Part F** — Connect frontend and backend
- **Part G** — Keep the backend awake with UptimeRobot
- **Part H** — Troubleshooting
- **Part I** — Using Claude Code on this project

> **Commands** are shown for **Windows (PowerShell)** and **macOS (Terminal)**. Type them exactly;
> run each command from the folder the step says.

> **Security:** `backend/.env` contains the team's Groq API key. It is listed in `.gitignore`, so it
> will **not** be uploaded to GitHub — never remove it from `.gitignore`, and never paste the key
> into code, README or chats. You will paste it only into Render's settings (Part D).

---

## Part A — Install the tools (one time)

Install these, accepting the default options. **Close and reopen your terminal after installing**
so it can find the new programs.

| Tool | Version | Download |
|---|---|---|
| Python | **3.12** | https://www.python.org/downloads/ (Windows: tick **"Add python.exe to PATH"** on the first installer screen) |
| Node.js | **20 LTS** or **22 LTS** | https://nodejs.org/ (choose "LTS") |
| Git | latest | https://git-scm.com/downloads (Windows: keep all defaults — it includes "Git Credential Manager") |

macOS alternative (if you use Homebrew): `brew install python@3.12 node@22 git`

**Check the installs** — open a new terminal and run:

Windows (PowerShell):
```powershell
py -3.12 --version
node --version
npm --version
git --version
```
macOS:
```bash
python3.12 --version
node --version
npm --version
git --version
```
You should see `Python 3.12.x`, `v20.x` or `v22.x`, a version for npm, and a version for git.

Also create free accounts now (use the same email for all, sign in with GitHub where offered):
1. **GitHub** — https://github.com/signup
2. **Render** — https://render.com → *Get Started* → **Sign up with GitHub**
3. **Vercel** — https://vercel.com/signup → **Hobby** → **Continue with GitHub**
4. **UptimeRobot** — https://uptimerobot.com → *Register for free*

---

## Part B — Run the app on your computer

### B1. Unzip
Unzip `fireflies-clone.zip` somewhere simple, e.g. `Documents`. You get a folder `fireflies-clone`
containing `backend`, `frontend`, `README.md`, this guide, and more.

Open a terminal **in that folder**:
- Windows: open the `fireflies-clone` folder in File Explorer → right-click empty space →
  **Open in Terminal**.
- macOS: in Terminal type `cd ` (with a space), drag the folder onto the window, press Enter.

### B2. Start the backend (terminal 1)

Windows (PowerShell):
```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```
macOS:
```bash
cd backend
python3.12 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```
The install takes 1–2 minutes. When you see `Application startup complete`, the backend is running.
On first start it creates the database and fills it with 9 demo meetings automatically.

Check it: open http://localhost:8000/api/v1/health in your browser → you should see
`{"status":"ok","database":"ok"}`. (API documentation: http://localhost:8000/docs)

**Leave this terminal open** — closing it stops the backend.

### B3. Start the frontend (terminal 2)

Open a **second** terminal in the `fireflies-clone` folder.

Windows (PowerShell):
```powershell
cd frontend
npm install
copy .env.example .env.local
npm run dev
```
macOS:
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```
`npm install` takes 1–3 minutes (warnings about deprecated packages are normal). When you see
`Ready`, open **http://localhost:3000** — the Fireflies clone loads with the demo meetings.

### B4. Quick check that everything works
1. **Meetings** (left menu, video icon) → 9 meetings are listed.
2. Open **Weekly Product Sync** → press the purple **Play** button → the transcript highlights the
   sentence being "played".
3. Click a timestamp like `(02:26)` in the notes → the player jumps there.
4. Click **AskFred** (top of the right panel) → ask "What are the action items?" → you get an answer.
5. Click **Capture** (top right) → **Browse Files** → pick `backend/tests/fixtures/standup.vtt` →
   **Create meeting** → after a few seconds a new meeting opens with AI-written notes.

### B5. Optional: run the automated checks
Backend (in terminal 1, after stopping the server with `Ctrl + C`, from the `backend` folder):
- Windows: `.venv\Scripts\python -m pytest`
- macOS: `.venv/bin/python -m pytest`

Expected: `70 passed`. Frontend (terminal 2, `frontend` folder, after `Ctrl + C`):
`npm run lint` then `npm run build` — both must finish without errors.

### B6. Starting it again later
- Terminal 1: `cd backend`, then the **last** command of B2 (the `uvicorn` one).
- Terminal 2: `cd frontend`, then `npm run dev`.
- Reset the demo data any time (backend stopped): Windows `.venv\Scripts\python -m app.seed --reset`,
  macOS `.venv/bin/python -m app.seed --reset`.

---

## Part C — Put the code on GitHub

### C1. Tell Git who you are (one time, use your own name and GitHub email)
```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### C2. Create an empty repository on GitHub
1. Go to https://github.com/new
2. **Repository name:** e.g. `fireflies-clone`
3. Select **Public** (the assignment requires a public repository).
4. **Do not** tick "Add a README", ".gitignore" or "license" — the project already has them.
5. Click **Create repository** and keep the page open; you need the URL shown, e.g.
   `https://github.com/<your-username>/fireflies-clone.git`

### C3. Upload the project
In a terminal in the `fireflies-clone` folder (stop the servers first or use a third terminal):
```bash
git init
git add .
git status
```
**Check the `git status` list before continuing.** It must **not** contain `backend/.env`,
`node_modules`, `.venv` or any `.db` file (they are excluded by `.gitignore`). If `backend/.env`
appears, stop and ask for help — it would publish the API key.

Then (replace the URL with yours from C2):
```bash
git commit -m "Fireflies.ai clone: Next.js frontend + FastAPI backend"
git branch -M main
git remote add origin https://github.com/<your-username>/fireflies-clone.git
git push -u origin main
```
On the first push a browser window asks you to sign in to GitHub — approve it.
(macOS: if you are asked for a password, use a token instead: GitHub → Settings → Developer settings
→ Personal access tokens → *Tokens (classic)* → Generate, tick **repo**, and paste it as the password.)

Refresh the GitHub page — your code is there. Confirm `backend/.env` is **not** listed inside the
`backend` folder on GitHub.

---

## Part D — Deploy the backend on Render

Render reads the file `render.yaml` in the repository and sets everything up.

1. Open https://dashboard.render.com and sign in (with GitHub).
2. Click **New +** (top right) → **Blueprint**.
3. Under *Connect a repository*, click **Connect GitHub** / **Configure account** if asked, allow
   access to your `fireflies-clone` repository, then click **Connect** next to it.
4. **Blueprint Name:** `fireflies-clone`. Render shows one service to create:
   **fireflies-clone-api** (Web Service, Docker, **Free**).
5. Render asks for two values:
   - **`CORS_ORIGINS`** → type `http://localhost:3000` for now (you'll change it in Part F).
   - **`GROQ_API_KEY`** → open `backend/.env` on your computer (with Notepad / TextEdit), copy the
     text after `GROQ_API_KEY=` (it starts with `gsk_`), and paste it here.
6. Click **Apply** (or **Deploy Blueprint**). The first build takes about 5–10 minutes. Click the
   service name to watch the **Logs**; it is ready when the top of the page shows **Live**.
7. Copy the service URL shown under its name, e.g. `https://fireflies-clone-api.onrender.com`.
8. Test it: open `https://<your-service>.onrender.com/api/v1/health` → you should see
   `{"status":"ok","database":"ok"}`.

Write the backend URL down — you need it in Parts E, F and G.

---

## Part E — Deploy the frontend on Vercel

1. Open https://vercel.com/new and sign in (with GitHub).
2. Under **Import Git Repository**, click **Import** next to `fireflies-clone`
   (if it isn't listed: **Adjust GitHub App Permissions** → give Vercel access to the repository).
3. On *Configure Project*:
   - **Root Directory:** click **Edit** → choose **`frontend`** → **Continue**.
   - **Framework Preset:** shows **Next.js** automatically. Leave build settings as they are.
   - Open **Environment Variables** and add:
     - **Key:** `NEXT_PUBLIC_API_URL`
     - **Value:** `https://<your-service>.onrender.com/api/v1` (your Render URL from Part D +
       `/api/v1`, no trailing slash)
4. Click **Deploy** and wait ~2 minutes for the confetti screen.
5. Click **Continue to Dashboard**. Copy the main domain under **Domains**, e.g.
   `https://fireflies-clone-abc.vercel.app`.

---

## Part F — Connect frontend and backend

The backend only accepts requests from websites it knows (this is called CORS).

1. Render dashboard → **fireflies-clone-api** → **Environment** (left menu).
2. Edit **`CORS_ORIGINS`** → set it to your Vercel URL from Part E, e.g.
   `https://fireflies-clone-abc.vercel.app` — `https://`, no slash at the end.
3. Click **Save, rebuild, and deploy** (or **Save Changes**). Wait until the service is **Live** again.
4. Open your Vercel URL and repeat the quick check from **B4** on the live site.
5. Put the two links in `README.md` (top: *Live demo* and *Repository*), then publish the change:
   ```bash
   git add README.md
   git commit -m "Add demo and repository links"
   git push
   ```
   (Vercel and Render redeploy automatically on every push.)

Submit the **GitHub repository URL** and the **Vercel URL**.

---

## Part G — Keep the backend awake with UptimeRobot

Render's free service goes to sleep after 15 minutes without visitors, and waking up takes about a
minute. A free monitor that visits it every 5 minutes keeps it awake.

1. Sign in at https://dashboard.uptimerobot.com → **+ New monitor**.
2. **Monitor type:** HTTP / website monitoring.
3. **URL:** `https://<your-service>.onrender.com/api/v1/health`
4. **Monitoring interval:** 5 minutes. Click **Create monitor**.
5. After a few minutes the monitor shows **Up**. You'll also get an email if the backend goes down.

Important facts about the free backend:
- Render gives **750 free hours per month**; one service running all month uses at most 744. Keep
  this as the **only free web service** in your Render account, or the hours run out.
- The free service has no permanent disk: whenever it **redeploys** (every `git push`) or Render
  restarts it, the database goes back to the 9 demo meetings. Meeting links stay the same. Avoid
  pushing right before an evaluation.

---

## Part H — Troubleshooting

| Problem | Fix |
|---|---|
| `py` / `python3.12` is not recognized | Python isn't installed or not on PATH. Reinstall Python 3.12 (Windows: tick *Add python.exe to PATH*), then open a **new** terminal. |
| `node` / `npm` / `git` is not recognized | Install it (Part A), then open a **new** terminal. |
| `ModuleNotFoundError: No module named 'app'` | You are not in the `backend` folder. Run `cd backend` first. |
| Port 8000 or 3000 "already in use" | A previous server is still running — close its terminal (or press `Ctrl + C` in it) and start again. |
| Local site says "Couldn't load meetings" | The backend (terminal 1) isn't running, or `frontend/.env.local` is missing — redo B2/B3. |
| Live site says "Couldn't load meetings" | 1) Backend asleep: wait a minute and refresh. 2) Wrong `NEXT_PUBLIC_API_URL` on Vercel: fix it, then Vercel → *Deployments* → ⋯ → **Redeploy** (the value is used at build time). 3) CORS: see next row. |
| Browser console shows a "CORS" error | `CORS_ORIGINS` on Render must exactly equal your Vercel URL — `https://`, no trailing `/`. |
| Notes look plain / not AI-written | The Groq key is missing or wrong on Render (Environment → `GROQ_API_KEY`), or the free Groq limit was hit for a minute — the app automatically uses its built-in summarizer instead. |
| Render build fails | Open the service → **Logs**, copy the red error, and ask Claude Code (Part I). |
| Render says the free hours are used up | Delete or suspend any other free web service in your Render account. |
| A meeting I created disappeared | The backend restarted (after a push or a Render restart) and reloaded the demo data — expected on the free plan. |

---

## Part I — Using Claude Code on this project

The project includes `CLAUDE.md`, which Claude Code reads automatically. It describes what was
built, how the code is organized and the project rules, so Claude can answer questions and make
changes with full context.

1. Install Claude Code (https://claude.com/claude-code) and open it **in the `fireflies-clone`
   folder** (the one containing `CLAUDE.md`).
2. Ask in plain language, for example:
   - "Walk me through Part B of DEPLOYMENT.md and run the commands for me."
   - "The Render build failed with this error: … What's wrong?"
   - "Explain how clicking a transcript sentence moves the player."
   - "Explain the database schema so I can present it."
3. Rules Claude will follow (from `CLAUDE.md`): never commit `backend/.env` or print the Groq key,
   keep everything on free plans, and run the tests after changing code.

`CLAUDE.md` and `backend/.env` stay on your computer only — `.gitignore` keeps both out of GitHub.
