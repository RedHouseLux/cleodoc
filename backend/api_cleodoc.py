from datetime import datetime
from flask import Blueprint, request, jsonify
from db import db
from models_central import CentralUser, CentralEntry

cleodoc_api = Blueprint("cleodoc_api", __name__, url_prefix="/api/cleodoc")

def parse_iso(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))

def require_mobile_key():
    # Super-simple auth for MVP: one shared header key
    from flask import current_app
    expected = current_app.config.get("MOBILE_SYNC_KEY", "")
    got = request.headers.get("X-MOBILE-KEY", "")
    return expected and (got == expected)

@cleodoc_api.post("/sync")
def sync_from_phone():
    if not require_mobile_key():
        return jsonify({"error": "unauthorized"}), 401

    data = request.get_json(force=True)
    user = data.get("user") or {}
    entries = data.get("entries") or []

    user_id = (user.get("id") or "").strip()
    if not user_id:
        return jsonify({"error": "user.id required"}), 400

    # Upsert user
    u = CentralUser.query.get(user_id)
    if not u:
        u = CentralUser(
            id=user_id,
            label=user.get("label"),
            consent_json=user.get("consent") or {},
            extra_data=user.get("extra_data") or {},
        )
        db.session.add(u)
    else:
        if "label" in user: u.label = user.get("label")
        if "consent" in user: u.consent_json = user.get("consent") or {}
        if "extra_data" in user: u.extra_data = user.get("extra_data") or {}

    synced_ids = []
    for e in entries:
        eid = (e.get("id") or "").strip()
        if not eid:
            continue

        incoming_lm = e.get("last_modified")
        incoming_lm_dt = parse_iso(incoming_lm) if incoming_lm else datetime.utcnow()

        existing = CentralEntry.query.get(eid)
        if existing:
            if existing.last_modified and existing.last_modified >= incoming_lm_dt:
                continue
            existing.ts = parse_iso(e["ts"])
            existing.mood = e.get("mood")
            existing.stress = e.get("stress")
            existing.note = e.get("note")
            existing.deleted = bool(e.get("deleted", False))
            existing.last_modified = incoming_lm_dt
        else:
            db.session.add(CentralEntry(
                id=eid,
                user_id=user_id,
                ts=parse_iso(e["ts"]),
                mood=e.get("mood"),
                stress=e.get("stress"),
                note=e.get("note"),
                deleted=bool(e.get("deleted", False)),
                last_modified=incoming_lm_dt,
            ))
        synced_ids.append(eid)

    db.session.commit()
    return jsonify({"status": "ok", "synced_entry_ids": synced_ids})

@cleodoc_api.get("/pull")
def pull_for_phone():
    """
    Optional: phone can pull updates if needed.
    GET /pull?user_id=...&since=ISO
    """
    if not require_mobile_key():
        return jsonify({"error": "unauthorized"}), 401

    user_id = (request.args.get("user_id") or "").strip()
    since = request.args.get("since") or ""
    if not user_id or not since:
        return jsonify({"error": "user_id and since required"}), 400

    since_dt = parse_iso(since)

    rows = (CentralEntry.query
            .filter(CentralEntry.user_id == user_id)
            .filter(CentralEntry.last_modified > since_dt)
            .all())

    out = []
    for r in rows:
        out.append({
            "id": r.id,
            "user_id": r.user_id,
            "ts": r.ts.isoformat(),
            "mood": r.mood,
            "stress": r.stress,
            "note": r.note,
            "last_modified": r.last_modified.isoformat(),
            "deleted": r.deleted,
        })
    return jsonify({"entries": out})
