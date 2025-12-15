# app.py
from __future__ import annotations

import os
from flask import Flask
from flask_cors import CORS

from db import db
from central_api import central_api
from api_docpro import docpro_api
from api_cleodoc import cleodoc_api

# Optional: load .env when running locally (safe on Heroku)
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass


def _get_db_url() -> str:
    db_url = (
        os.getenv("DATABASE_URL")
        or os.getenv("CENTRAL_DB_URL")
        or os.getenv("CENTRAL_DB")
    )
    if not db_url:
        raise RuntimeError("No DATABASE_URL / CENTRAL_DB_URL found in environment config vars.")

    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    return db_url


def create_app() -> Flask:
    app = Flask(__name__)

    app.config["SQLALCHEMY_DATABASE_URI"] = _get_db_url()
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JSON_SORT_KEYS"] = False

    # Keys used by api_docpro / api_cleodoc (set as Heroku config vars)
    app.config["PRO_SYNC_KEY"] = os.getenv("PRO_SYNC_KEY", "")
    app.config["MOBILE_SYNC_KEY"] = os.getenv("MOBILE_SYNC_KEY", "")

    db.init_app(app)

    # Fix CORS: ensure browser fetch gets Access-Control-Allow-Origin
    # Allow all origins for /api/* (tighten later)
    CORS(
        app,
        resources={r"/api/*": {"origins": "*"}},
        send_wildcard=True,     # <- makes Access-Control-Allow-Origin: *
        always_send=True,       # <- sends CORS headers even if Origin is missing/null
        supports_credentials=False,
        allow_headers=["Content-Type", "X-MOBILE-KEY", "X-PRO-KEY"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    # Blueprints
    app.register_blueprint(central_api)   # /api/central/*
    app.register_blueprint(docpro_api)    # /api/docpro/*
    app.register_blueprint(cleodoc_api)   # /api/cleodoc/*

    @app.get("/")
    def health():
        return {"ok": True, "service": "docpro-central-backend"}

    return app


app = create_app()
