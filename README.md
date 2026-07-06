# Rickard Flodin Photography

A photography portfolio built with Next.js and Supabase. The homepage is a
drag-reorderable masonry gallery, each image has a detail page, and there is an
about page. An admin (the photographer) logs in to upload images, reorder them
directly in the masonry, and edit content inline across the site. Uploaded
images are automatically resized/optimized on upload and served as
AVIF/WebP by Next.js.

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** primitives
- **Supabase** — Postgres (content), Storage (images), Auth (admin login)
- **sharp** — upload-time image resizing/optimization
- **dnd-kit** — drag-and-drop reordering

## Project structure

```
app/
  admin/              Admin login page
  api/
    auth/             Login/logout/session route handlers
    photos/           Gallery reads, uploads, edits, deletes, ordering
    about/            About reads, text edits, photographer image upload
    gallery-settings/ Gallery column settings
  photos/[id]/        Image detail page
  about/              About page
components/
  admin/              Admin context + login/logout
  gallery/            Masonry gallery, sortable cards, upload button
  photo/              Detail inline editor
  about/              About inline editor
  ui/                 shadcn/ui primitives
lib/                  utils, constants, image processing
services/api/         App-facing API fetch helpers
services/supabase/    Server-only Supabase clients + data access
supabase/migrations/  SQL schema (run once on your project)
types/                Shared types
```

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create a Supabase project and apply the migration

Create a project at [supabase.com](https://supabase.com), then link this repo to
it and push the migration:

```bash
supabase link --project-ref <your-project-ref>
pnpm db:push
```

`supabase/migrations/` contains the schema — it creates the `photos` and `about`
tables, the `photos` and `about` Storage buckets, and the RLS / storage policies
(public read, authenticated write). Requires the
[Supabase CLI](https://supabase.com/docs/guides/cli). `supabase link` will prompt
for the database password.

(Alternatively, paste the contents of the migration file into the Supabase SQL
editor and run it once.)

### 3. Create the admin user

In the Supabase dashboard: **Authentication -> Users -> Add user**, and create
the photographer's email/password. Disable public sign-ups under
**Authentication -> Providers -> Email** so no one else can register.

### 4. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=              # https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=  # sb_publishable_... (used by server routes/proxy)
SUPABASE_SECRET_KEY=                   # sb_secret_... (server only)
ADMIN_EMAIL=                           # optional: lock admin to one email
```

These use Supabase's current publishable/secret API keys (found under
**Project Settings -> API Keys**). The publishable key replaces the legacy
`anon` key; the secret key replaces the legacy `service_role` key. Browser code
does not use the Supabase SDK directly; it talks to the Next.js `/api/*` routes.

### 5. Run

```bash
pnpm dev
```

Visit `http://localhost:3000`. Log in at `/admin` to unlock upload, reorder and
inline editing.

## Database scripts

These wrap the Supabase CLI against your linked project:

| Script | Description |
| --- | --- |
| `pnpm db:push` | Apply pending migrations in `supabase/migrations/` to the linked project |
| `pnpm db:reset` | **Destructive.** Drop and re-apply all migrations on the linked project |
| `pnpm db:gen-types` | Regenerate `types/database.types.ts` from the linked schema |

New schema changes go in new timestamped files under `supabase/migrations/`
(format `YYYYMMDDHHMMSS_name.sql`); never edit a migration that has already been
pushed — add a new one on top.

## How admin editing works

- Any authenticated Supabase user is treated as admin. If `ADMIN_EMAIL` is set,
  only that email is allowed.
- Browser and page code talks to Next.js `/api/*` route handlers. Supabase Auth,
  Postgres, and Storage access stays inside server-only route implementation
  modules.
- Writes are guarded server-side (`requireAdmin`) in every route handler and
  additionally at the proxy layer (`proxy.ts`) for protected mutating API routes.
- Uploads go through `sharp`: images larger than 2400px on the long edge are
  scaled down, re-encoded to high-quality WebP, and a blur placeholder is
  generated for fast perceived loading.

## Notes

- The "Order" button on the detail page is an intentional placeholder; the
  ordering flow has not been defined yet.
