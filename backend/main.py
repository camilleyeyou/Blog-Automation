"""FastAPI app + APScheduler — Railway entry point."""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from agents.supervisor import run_pipeline, run_replenish
from services import supabase_client as db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=2)
_scheduler = BackgroundScheduler()


# ── Scheduler helpers ───────────────────────────────────────────────────────────

def _pipeline_job() -> None:
    """Called by APScheduler — checks active flag before running."""
    try:
        settings = db.get_schedule_settings()
        if not settings.active:
            logger.info("[scheduler] paused — skipping run")
            return
        logger.info("[scheduler] firing pipeline job")
        result = run_pipeline()
        logger.info("[scheduler] done: %s", result.status)
        if result.error:
            logger.error("[scheduler] error detail: %s", result.error)
    except Exception as exc:
        logger.error("[scheduler] pipeline error: %s", exc)


def _load_schedule_from_db() -> None:
    """Remove all pipeline jobs and re-add from Supabase app_settings."""
    _scheduler.remove_all_jobs()
    try:
        settings = db.get_schedule_settings()
        tz = settings.timezone or "UTC"
        for t in settings.run_times:
            hour, minute = t.split(":")
            _scheduler.add_job(
                _pipeline_job,
                CronTrigger(hour=int(hour), minute=int(minute), timezone=tz),
                id=f"pipeline_{t.replace(':', '')}",
                replace_existing=True,
            )
            logger.info("[scheduler] scheduled pipeline at %s %s", t, tz)
    except Exception as exc:
        logger.error("[scheduler] failed to load schedule: %s", exc)
        # Fallback: 3 daily runs at UTC
        for t in ["06:00", "12:00", "18:00"]:
            hour, minute = t.split(":")
            _scheduler.add_job(
                _pipeline_job,
                CronTrigger(hour=int(hour), minute=int(minute), timezone="UTC"),
                id=f"pipeline_{t.replace(':', '')}",
                replace_existing=True,
            )


# ── Auth ────────────────────────────────────────────────────────────────────────

def _check_api_key(request: Request) -> None:
    expected = os.environ.get("RAILWAY_API_KEY")
    if not expected:
        return  # No key configured — open (dev mode)
    provided = request.headers.get("x-api-key")
    if provided != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


# ── App lifespan ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("[startup] loading schedule from Supabase …")
    _load_schedule_from_db()
    _scheduler.start()
    logger.info("[startup] APScheduler started with %d jobs", len(_scheduler.get_jobs()))
    yield
    _scheduler.shutdown(wait=False)
    logger.info("[shutdown] APScheduler stopped")


app = FastAPI(title="Blog Automation Backend", lifespan=lifespan)


# ── Routes ──────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    jobs = [
        {"id": j.id, "next_run": str(j.next_run_time)}
        for j in _scheduler.get_jobs()
    ]
    return {"status": "ok", "scheduled_jobs": jobs}


@app.post("/pipeline")
async def pipeline_route(request: Request):
    _check_api_key(request)
    import asyncio
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(_executor, run_pipeline)
        return JSONResponse(result.to_dict())
    except Exception as exc:
        logger.error("[/pipeline] error: %s", exc)
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.post("/replenish")
async def replenish_route(request: Request):
    _check_api_key(request)
    import asyncio
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(_executor, run_replenish)
        return JSONResponse(result)
    except Exception as exc:
        logger.error("[/replenish] error: %s", exc)
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.post("/reload-schedule")
async def reload_schedule(request: Request):
    _check_api_key(request)
    try:
        _load_schedule_from_db()
        jobs = [
            {"id": j.id, "next_run": str(j.next_run_time)}
            for j in _scheduler.get_jobs()
        ]
        return {"message": "Schedule reloaded", "jobs": jobs}
    except Exception as exc:
        logger.error("[/reload-schedule] error: %s", exc)
        return JSONResponse({"error": str(exc)}, status_code=500)
