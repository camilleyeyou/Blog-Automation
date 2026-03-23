# Jesse A. Eisenbalm — Blog Automation

AI-powered pipeline that generates, reviews, and publishes SEO-optimised blog posts to [jesseaeisenbalm.com/blog](https://jesseaeisenbalm.com/blog) on a configurable daily schedule.

## Architecture

| Component | Tech | Hosted on |
|---|---|---|
| **Pipeline backend** | Python · FastAPI · APScheduler | Railway |
| **Dashboard frontend** | Next.js 14 · React · Tailwind CSS | Vercel |
| **Content + Revision** | OpenAI GPT-4o | — |
| **Image generation** | Gemini (primary) · DALL-E 3 (fallback) | — |
| **Database + Storage** | Supabase (Postgres + object storage) | Supabase |

## Pipeline Flow

```
Scheduler (APScheduler cron) → POST /pipeline
  1. Daily frequency gate — max 1 post/day
  2. Dequeue next topic from automation_queue
  3. Pick structure type (rotates: deep-dive, comparison, how-to, myth-busting, story-science, data-driven)
  4. Content Agent (GPT-4o) → 1,800–2,200 word HTML draft
  5. Revision Agent (GPT-4o) → 15-check SEO audit + improvements
  6. Expansion loop (up to 2 passes) if word count < 1,500
  7. Final revision pass after expansion
  8. Image Agent (Gemini → DALL-E 3 fallback) → cover image → upload
  9. Publish decision:
     - confidence ≥ 85 → auto-publish
     - confidence 70–84 → save as draft
     - confidence < 70 → hold for review
 10. Log result to automation_logs
```

## Project Structure

```
├── backend/                    # Python pipeline (Railway)
│   ├── main.py                 # FastAPI app + APScheduler entry point
│   ├── agents/
│   │   ├── supervisor.py       # Orchestration, publish decision, expansion loop
│   │   ├── content.py          # GPT-4o content generation
│   │   ├── revision.py         # GPT-4o SEO audit + content expansion
│   │   ├── image.py            # Gemini / DALL-E 3 image generation + upload
│   │   └── topic.py            # GPT-4o topic generation for queue
│   ├── prompts/
│   │   ├── brand_context.py    # Brand voice + GEO positioning
│   │   ├── content_prompt.py   # 6 structure types, banned phrases, SEO rules
│   │   └── revision_prompt.py  # 15-check audit, hard rejections, expansion
│   ├── services/
│   │   ├── supabase_client.py  # Queue, logs, schedule, structure rotation
│   │   ├── blog_api.py         # POST to jesse-eisenbalm-server
│   │   └── upload_api.py       # Image upload to blog server
│   └── requirements.txt
├── app/                        # Next.js dashboard (Vercel)
│   ├── dashboard/              # Overview, queue, review, history pages
│   └── api/                    # Dashboard API routes
├── components/                 # Shared React UI components
├── lib/                        # Dashboard auth
├── CLAUDE.md                   # Full project specification
└── vercel.json                 # Vercel cron config
```

## Agents

| Agent | Model | Role |
|---|---|---|
| **Content** | GPT-4o | Generates 1,800–2,200 word HTML drafts using one of 6 rotating structure types |
| **Revision** | GPT-4o | 15-check Yoast SEO audit, content expansion, confidence scoring |
| **Image** | Gemini / DALL-E 3 | Mood-based cover image generation, auto-upload to Supabase storage |
| **Topic** | GPT-4o | Auto-replenishes queue when topics run low |
| **Supervisor** | — | Orchestrates all agents, manages retries, publish decisions |

## Quality Gates

- **Word count**: minimum 1,500 words (target 1,800–2,200); up to 2 expansion passes if short
- **SEO checks**: 15-point Yoast audit (keyphrase placement, links, title/excerpt length, etc.)
- **Hard rejections**: banned phrases, generic CTAs, FAQ sections, unsourced statistics
- **Structure rotation**: 6 post formats, avoids repeating the last 3 used
- **Daily limit**: max 1 post published per day

## Environment Variables

```env
# OpenAI (content + revision + topic agents, DALL-E 3 fallback)
OPENAI_API_KEY=

# Google Gemini (primary image generation)
GEMINI_API_KEY=

# Blog API
BLOG_API_KEY=
BLOG_API_URL=https://jesse-eisenbalm-server.vercel.app

# Image uploads
ADMIN_PASSWORD=

# Supabase
SUPABASE_URL=https://kqyiauyahlmruyblxezp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=

# Dashboard auth
DASHBOARD_PASSWORD=

# Vercel cron
CRON_SECRET=
```

## Development

```bash
# Dashboard (Next.js)
npm install
npm run dev              # localhost:3000

# Backend (Python)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

## Deployment

- **Dashboard**: Vercel (auto-deploys from `main`)
- **Backend**: Railway (auto-deploys from `main`, entry: `backend/main.py`)
- **Scheduler**: APScheduler inside the Railway backend; run times configurable via Supabase `app_settings`
