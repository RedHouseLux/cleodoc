# central_api.py
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify

from db import db
from models_central import CentralUser, CentralEntry

central_api = Blueprint("central_api", __name__, url_prefix="/api/central")


def parse_ts(s: str) -> datetime:
    # Accept: 2025-12-14T10:30:00Z or with offset
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    # ensure tz-aware
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


@central_api.get("/health")
def health():
    return jsonify({"ok": True, "service": "central_api"}), 200


@central_api.get("/users")
def list_users():
    limit = int(request.args.get("limit", 200))
    rows = (
        CentralUser.query
        .order_by(CentralUser.created_at.desc())
        .limit(limit)
        .all()
    )
    return jsonify([
        {
            "id": u.id,
            "label": u.label,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "consent": u.consent_json or {},
            "extra_data": u.extra_data or {},
        }
        for u in rows
    ]), 200


@central_api.get("/entries")
def list_entries():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    limit = int(request.args.get("limit", 500))
    include_deleted = request.args.get("include_deleted", "0").lower() in ("1", "true", "yes")

    # NEW: incremental sync cursor (ISO time)
    since = request.args.get("since")
    since_dt = None
    if since:
        try:
            since_dt = parse_ts(since)
        except Exception:
            return jsonify({"error": "since must be a valid ISO timestamp (e.g. 2025-12-14T10:30:00Z)"}), 400

    q = CentralEntry.query.filter(CentralEntry.user_id == user_id)

    # If pulling incrementally, filter by last_modified strictly greater than since
    if since_dt is not None:
        q = q.filter(CentralEntry.last_modified > since_dt)

    # If not including deleted, hide them
    if not include_deleted:
        q = q.filter(CentralEntry.deleted.is_(False))

    rows = q.order_by(CentralEntry.ts.desc()).limit(limit).all()

    return jsonify([
        {
            "id": e.id,
            "user_id": e.user_id,
            "ts": e.ts.isoformat() if e.ts else None,
            "mood": e.mood,
            "stress": e.stress,
            "note": e.note,
            "last_modified": e.last_modified.isoformat() if e.last_modified else None,
            "deleted": bool(e.deleted),
        }
        for e in rows
    ]), 200


@central_api.route("/sync_entries", methods=["POST"])
def sync_entries():
    data = request.get_json(force=True, silent=False) or {}

    user_payload = data.get("user") or {}
    entries_payload = data.get("entries") or []

    user_id = user_payload.get("id")
    if not user_id:
        return jsonify({"error": "user.id is required"}), 400

    # 1) Upsert user
    user = CentralUser.query.get(user_id)
    if not user:
        user = CentralUser(
            id=user_id,
            label=user_payload.get("label"),
            consent_json=user_payload.get("consent") or {},
            extra_data=user_payload.get("extra_data") or {},
        )
        db.session.add(user)
    else:
        if "label" in user_payload:
            user.label = user_payload["label"]
        if "consent" in user_payload:
            user.consent_json = user_payload["consent"]
        if "extra_data" in user_payload:
            user.extra_data = user_payload["extra_data"]

    synced_ids = []

    # 2) Upsert entries
    for e in entries_payload:
        entry_id = e.get("id")
        if not entry_id:
            continue

        incoming_last_modified = e.get("last_modified")
        if incoming_last_modified:
            incoming_last_modified_dt = parse_ts(incoming_last_modified)
        else:
            incoming_last_modified_dt = datetime.now(timezone.utc)

        existing = CentralEntry.query.get(entry_id)

        if existing:
            if existing.last_modified and existing.last_modified >= incoming_last_modified_dt:
                continue

            existing.ts = parse_ts(e["ts"])
            existing.mood = e.get("mood")
            existing.stress = e.get("stress")
            existing.note = e.get("note")
            existing.deleted = bool(e.get("deleted", False))
            existing.last_modified = incoming_last_modified_dt
        else:
            entry = CentralEntry(
                id=entry_id,
                user_id=user_id,
                ts=parse_ts(e["ts"]),
                mood=e.get("mood"),
                stress=e.get("stress"),
                note=e.get("note"),
                deleted=bool(e.get("deleted", False)),
                last_modified=incoming_last_modified_dt,
            )
            db.session.add(entry)

        synced_ids.append(entry_id)

    db.session.commit()

    return jsonify({"status": "ok", "synced_entry_ids": synced_ids}), 200
