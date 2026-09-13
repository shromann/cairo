"""FastAPI application entry point for Cairo.

The API is now organized into a package-based layout under
``cairo.backend.api`` while keeping the public import path
``cairo.backend.api:app`` stable for Uvicorn and deployment scripts.
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from cairo.backend.api.routes import health_router, studies_router, videos_router

app = FastAPI(title="cairo", version="0.1.0")

# Dev: the Astro dev server on :4321 calls the API cross-origin. Prod: same origin (frontend served below).
_extra_origins = [origin for origin in os.environ.get("CAIRO_CORS_ORIGINS", "").split(",") if origin]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4321", "http://127.0.0.1:4321", *_extra_origins],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(studies_router)
app.include_router(videos_router)

# Built frontend (production container): everything not under /api is the Astro site.
_static = os.environ.get("CAIRO_STATIC_DIR")
if _static and os.path.isdir(_static):
    app.mount("/", StaticFiles(directory=_static, html=True), name="frontend")
