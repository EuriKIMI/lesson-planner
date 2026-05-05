# EduPlan Pro

EduPlan Pro is an Electron lesson-planning app designed for students and teachers who want a cleaner workflow for organizing lessons, drafting classroom content, and exporting plans for real use.

It combines Supabase-backed authentication and cloud storage with a modern dashboard, weekly planning tools, AI-assisted drafting, and printable PDF export.

## Highlights

- Supabase email/password authentication
- Cloud-backed lesson CRUD
- Weekly calendar planning
- Search and filter tools
- AI lesson drafting
- PDF export
- Dark mode and responsive UI

## Tech stack

- Electron
- HTML
- CSS
- JavaScript
- Supabase
- OpenAI API (optional)

## What it does

- Create, edit, and delete lesson plans
- Organize lessons in a weekly calendar view
- Filter by timeframe, status, and search query
- Generate draft lesson content with AI
- Export lesson plans to PDF
- Persist auth, theme, and local setup preferences for smoother repeat use

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Install dependencies with `npm install`.
4. Add your Supabase URL and anon key in the in-app setup panel, or prefill `config.js` for local use.
5. Optional: set `OPENAI_API_KEY` before running Electron to enable live AI generation.
6. Start the app with `npm start`.

## Running locally

```bash
npm install
npm start
```

If `OPENAI_API_KEY` is not set, the app still works and falls back to a structured lesson template generator instead of live AI output.

## Project structure

- `index.html`: main app shell and UI structure
- `style.css`: dashboard, forms, calendar, and modal styling
- `renderer.js`: frontend app logic, auth flow, lesson CRUD, and UI rendering
- `main.js`: Electron window setup, PDF export, and AI generation bridge
- `preload.js`: safe bridge between Electron and the renderer
- `config.js`: optional local Supabase config values
- `supabase/schema.sql`: database schema for lesson storage

## Notes

- Lesson plans are stored in Supabase, not `localStorage`.
- Theme preference and temporary session/config data are stored locally for convenience.
- The committed `config.js` is intentionally blank so the repository can stay safe for public GitHub publishing.
- For a production browser deployment, move AI generation into a serverless route or Supabase Edge Function so the API key never reaches the client.

## Roadmap ideas

- Add screenshots or a short demo GIF
- Support lesson categories or subjects
- Add lesson duplication templates
- Improve classroom sharing or collaboration flows
