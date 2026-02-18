# Jesse A. Eisenbalm — Blog Automation

AI-powered pipeline that generates, reviews, and publishes SEO-optimised blog posts to `jesseaeisenbalm.com/blog` on a daily schedule. Four GPT-4o / Gemini agents handle content generation, SEO revision, image creation, and orchestration. A Next.js dashboard provides visibility and control.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14+ (App Router) — fullstack: API routes + React dashboard |
| Language | TypeScript (strict mode, no `any`) |
| Agent orchestration | Custom async pipeline — **no LangChain** |
| AI — Content + Revision + Supervisor | OpenAI GPT-4o (`openai` npm package) |
| AI — Image generation | Google Gemini (`@google/generative-ai`) — model: `gemini-2.0-flash-preview-image-generation` |
| Database + Storage | Supabase (`@supabase/supabase-js`) |
| Scheduler | Vercel Cron Jobs (`vercel.json`) — **not** `node-cron` (won't work on serverless) |
| Tests | Vitest |
| Styling | Tailwind CSS |
| Hosting | Vercel |

---

## Dev Commands

```bash
npm install           # install dependencies
npm run dev           # start Next.js dev server (localhost:3000)
npm run build         # production build
npm run type-check    # tsc --noEmit
npm test              # vitest run
npm run test:watch    # vitest --watch
```

---

## Project Structure

```
jesse-eisenbalm-automation/
├── app/
│   ├── layout.tsx                  # Root layout + dashboard auth guard
│   ├── page.tsx                    # Redirect → /dashboard
│   ├── dashboard/
│   │   ├── page.tsx                # Overview: latest run stats
│   │   ├── queue/page.tsx          # Topic queue management
│   │   ├── review/page.tsx         # Human review queue (held posts)
│   │   └── history/page.tsx        # Post history + automation logs
│   └── api/
│       ├── pipeline/route.ts       # POST: trigger full pipeline (Vercel cron hits this)
│       ├── queue/route.ts          # GET list / POST new topic
│       ├── queue/[id]/route.ts     # PATCH status / DELETE topic
│       ├── review/[id]/route.ts    # POST: approve | discard held post
│       ├── logs/route.ts           # GET automation_logs
│       └── schedule/route.ts       # GET/POST schedule settings
├── agents/
│   ├── supervisorAgent.ts          # Orchestration entry point + publish decision
│   ├── contentAgent.ts             # GPT-4o SEO draft generator
│   ├── revisionAgent.ts            # 13-check Yoast audit + confidence scoring
│   └── imageAgent.ts               # Gemini image gen + upload to Supabase
├── services/
│   ├── blogApi.ts                  # POST /api/posts on jesse-eisenbalm-server
│   ├── uploadApi.ts                # POST /api/admin/upload on jesse-eisenbalm-server
│   └── supabase.ts                 # Supabase client (queue + logs tables)
├── prompts/
│   ├── contentPrompt.ts            # System + user prompts for content agent
│   ├── revisionPrompt.ts           # 13-check Yoast revision prompt
│   └── brandContext.ts             # Brand context injected into all agents
├── components/                     # Shared React UI components (dashboard)
├── lib/
│   └── auth.ts                     # Dashboard password check (server-side)
├── __tests__/
│   ├── agents/                     # Agent unit tests (mock OpenAI/Gemini)
│   └── services/                   # Service unit tests (mock fetch)
├── vercel.json                     # Vercel cron job config
├── vitest.config.ts
├── .env.local                      # Never commit
└── package.json
```

---

## Agent Architecture

### 1. Supervisor Agent (`agents/supervisorAgent.ts`)
**Model:** GPT-4o | **Role:** Orchestrates the full pipeline; makes publish/hold/discard decision.

**Flow:**
1. Pull next topic + focus keyphrase from `automation_queue`
2. Call `contentAgent` → draft
3. Call `revisionAgent` → revised draft + `confidence_score` + `seo_checks_passed`
4. If `confidence_score >= 70`: call `imageAgent` → cover image URL
5. Validate final payload (all fields present + correct lengths)
6. Publish decision (see thresholds below)
7. Log result to `automation_logs`

**Retry logic:** Up to 2 retries per agent call before failing to dashboard.

---

### 2. Content Agent (`agents/contentAgent.ts`)
**Model:** GPT-4o | **Role:** Produces the first Yoast-compliant HTML draft.

**Inputs:** topic, focus_keyphrase, existing post titles (to avoid duplication)

**Returns:**
```ts
{
  title: string;          // 50–60 chars, contains keyphrase
  excerpt: string;        // 150–160 chars, contains keyphrase
  content: string;        // Full HTML body (h2/h3 structure, 900–1200 words)
  tags: string[];         // 2–4 tags
  focus_keyphrase: string;
}
```

---

### 3. Revision Agent (`agents/revisionAgent.ts`)
**Model:** GPT-4o | **Role:** Audits 13 Yoast SEO checks, improves draft, returns confidence score.

**Returns:**
```ts
{
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
  confidence_score: number;    // 0–100
  seo_checks_passed: number;   // 0–13
  revision_notes: string;
}
```

---

### 4. Image Agent (`agents/imageAgent.ts`)
**Model:** `gemini-2.0-flash-preview-image-generation` | **Role:** Generates cover image → uploads → returns URL.

**Upload:** `POST /api/admin/upload` with `multipart/form-data`, field name `file`.

**Returns:** `{ url: string }` — the Supabase Storage public URL.

**Brand aesthetic suffix (appended to every prompt):**
> Minimal, clean, luxury skincare aesthetic. Muted tones — off-white, warm beige, soft black. No text overlays. Cinematic lighting. Product photography or abstract natural texture. No people. 16:9 aspect ratio.

---

## Pipeline Flow

```
POST /api/pipeline (Vercel cron or manual dashboard trigger)
  1. Supervisor: dequeue next topic (or auto-generate from keyword bank)
  2. contentAgent(topic, keyphrase) → draft
  3. revisionAgent(draft, keyphrase) → { revised, confidence_score, seo_checks_passed }
  4. if confidence_score < 70  → HOLD: save to review queue, log, return
  5. imageAgent(title, excerpt) → cover_image URL
  6. Supervisor: validate final payload
  7. if confidence_score >= 85 → POST /api/posts { published: true }   ← auto-publish
     if confidence_score 70–84 → POST /api/posts { published: false }  ← draft
  8. Log to automation_logs
```

---

## Publishing Thresholds

| `confidence_score` | Action |
|---|---|
| `>= 85` | Auto-publish (`published: true`) |
| `70–84` | Save as draft (`published: false`), flag in dashboard |
| `< 70` | Hold for human review — do **NOT** call `POST /api/posts` |

---

## 13 Yoast SEO Checks (Revision Agent)

| # | Check | Pass Criteria |
|---|---|---|
| 1 | Keyphrase in title | Title contains focus keyphrase |
| 2 | Keyphrase in URL slug | Slug contains keyphrase (slug derived from title) |
| 3 | Keyphrase in meta description | Excerpt contains focus keyphrase |
| 4 | Keyphrase in first paragraph | First `<p>` contains focus keyphrase |
| 5 | Keyphrase in H2 subheading | At least 1 `<h2>` contains focus keyphrase |
| 6 | Keyphrase density | 0.5–3% of total word count |
| 7 | Word count | ≥ 300 words (target 900+) |
| 8 | H2 subheadings present | At least 1 `<h2>` tag |
| 9 | Title length | 50–60 characters |
| 10 | Excerpt length | 150–160 characters |
| 11 | Internal links | ≥ 1 link to `jesseaeisenbalm.com` |
| 12 | External links | ≥ 1 link to a credible external source |
| 13 | Image alt text | All `<img>` tags have non-empty `alt` |

---

## External API Contracts

### Blog API — Create Post
```
POST https://jesse-eisenbalm-server.vercel.app/api/posts
Header: x-api-key: {BLOG_API_KEY}
Content-Type: application/json

Body:
{
  "title": "...",
  "excerpt": "...",
  "content": "<h2>...</h2><p>...</p>",
  "author": "Jesse A. Eisenbalm",
  "cover_image": "https://kqyiauyahlmruyblxezp.supabase.co/storage/v1/object/public/post-images/...",
  "tags": ["mindfulness", "ritual"],
  "published": true | false
}

Response: { post: { id, slug, title, created_at, ... } }
```

### Image Upload
```
POST https://jesse-eisenbalm-server.vercel.app/api/admin/upload
Header: x-admin-password: {ADMIN_PASSWORD}
Body: multipart/form-data, field name: "file"

Response: { url: "https://kqyiauyahlmruyblxezp.supabase.co/storage/v1/object/public/post-images/..." }
```

---

## Supabase Schema

```sql
-- Topic queue
CREATE TABLE automation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  focus_keyphrase TEXT,
  keywords TEXT[],
  status TEXT DEFAULT 'pending', -- pending | in_progress | published | held | discarded
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Run logs
CREATE TABLE automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID REFERENCES automation_queue(id),
  post_id UUID REFERENCES posts(id),
  status TEXT NOT NULL,             -- success | draft | held | error
  confidence_score INT,
  seo_checks_passed INT,            -- out of 13
  revision_notes TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Supabase project:** `https://kqyiauyahlmruyblxezp.supabase.co`
**Storage bucket:** `post-images` (public — already created, no setup needed)

---

## Vercel Cron (Scheduler)

`node-cron` does **not** work on Vercel serverless — use Vercel Cron Jobs instead.

`vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/pipeline",
      "schedule": "0 6 * * *"
    }
  ]
}
```

The cron hits `POST /api/pipeline` daily at 6 AM UTC. The pipeline route checks a `CRON_SECRET` header to prevent unauthorised triggers.

---

## Environment Variables

```env
# OpenAI
OPENAI_API_KEY=

# Google Gemini
GEMINI_API_KEY=

# Jesse A. Eisenbalm Blog API
BLOG_API_KEY=adb66a122a92b46278069f15d1d5b376103d80ea54745e0a29317896261cced8
BLOG_API_URL=https://jesse-eisenbalm-server.vercel.app

# Admin password — image uploads
ADMIN_PASSWORD=

# Supabase
SUPABASE_URL=https://kqyiauyahlmruyblxezp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=

# Dashboard auth
DASHBOARD_PASSWORD=

# Vercel cron secret (set in Vercel dashboard, verified in /api/pipeline)
CRON_SECRET=

# Publishing thresholds
AUTO_PUBLISH_THRESHOLD=85
DRAFT_THRESHOLD=70
```

---

## Brand Context

```
Brand: Jesse A. Eisenbalm
Product: Premium limited-edition beeswax lip balm. Release 001. $8.99. Hand-numbered.
Mission: Keep humans human in an AI-driven world.
Ritual: Stop. Breathe. Balm.
Tone: Calm. Minimal. Philosophical. Never corporate. Never hyperbolic.
Audience: Thoughtful adults who value mindfulness, quality, and intentional living.
Avoid: AI buzzwords, excessive exclamation points, hollow wellness clichés.
CTA target: https://jesseaeisenbalm.com
Internal link anchors: "shop the balm", "Jesse A. Eisenbalm", "try it here"
```

This is injected into every agent via `prompts/brandContext.ts`.

---

## Coding Conventions

- **TypeScript strict** — `"strict": true` in `tsconfig.json`, no `any`
- **No LangChain** — all agent calls are plain `openai.chat.completions.create()` / Gemini SDK calls wrapped in typed async functions
- **Server-only imports** — anything using `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, or `BLOG_API_KEY` lives in `app/api/`, `agents/`, or `services/` — never in `components/` or `'use client'` files
- **Agents return typed objects** — define `interface` for every agent's return shape in the agent file
- **Prompt strings** live in `prompts/` — never inline in agent files
- **Error handling** — all agent calls wrapped in try/catch; errors propagate to Supervisor for retry logic and dashboard logging
- **Tests** — use Vitest; mock `openai` and `@google/generative-ai` at module level; never make real API calls in tests

---

## Security Rules

| Secret | Location | Rule |
|---|---|---|
| `BLOG_API_KEY` | Server-side only | Creates posts; cannot read payments/customers/delete |
| `ADMIN_PASSWORD` | Server-side only | Never sent to browser or embedded in client code |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only | Full DB access — never in client components |
| `DASHBOARD_PASSWORD` | Server-side only | Verified in `lib/auth.ts` middleware |
| `CRON_SECRET` | Server-side only | Verified in `/api/pipeline` to reject unauthorised triggers |

The dashboard frontend communicates only with this app's own `/api/` routes — never directly with Supabase or jesse-eisenbalm-server.
