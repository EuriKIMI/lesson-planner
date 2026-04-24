# EduPlan Pro

EduPlan Pro is a modern lesson planner for students and teachers with:

- Supabase email/password authentication
- Cloud-backed lesson CRUD
- Weekly calendar planning
- Search and filter tools
- AI lesson drafting
- PDF export
- Dark mode and responsive UI

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Add your Supabase URL and anon key in `config.js` or paste them into the in-app setup panel.
4. Optional: set `OPENAI_API_KEY` before running Electron to enable live AI generation.
5. Start the app with `npm start`.

## Notes

- Lesson plans are stored in Supabase, not `localStorage`.
- Theme preference and temporary session/config data are stored locally for convenience.
- For a production browser deployment, move AI generation into a serverless route or Supabase Edge Function so the API key never reaches the client.
