from datetime import datetime
from flask import Blueprint, request, jsonify
from db import db
from models_central import CentralUser, CentralEntry, CentralProNote

docpro_api = Blueprint("docpro_api", __name__, url_prefix="/api/docpro")

def parse_iso(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))

def require_pro_key():
    # MVP auth: one shared key for DOCPRO
    from flask import current_app
    expected = current_app.config.get("PRO_SYNC_KEY", "")
    got = request.headers.get("X-PRO-KEY", "")
    return expected and (got == expected)

@docpro_api.get("/users")
def list_users():
    if not require_pro_key():
        return jsonify({"error": "unauthorized"}), 401

    users = CentralUser.query.order_by(CentralUser.created_at.desc()).limit(200).all()
    return jsonify({
        "users": [{
            "id": u.id,
            "label": u.label,
            "created_at": u.created_at.isoformat(),
            "consent_json": u.consent_json or {},
        } for u in users]
    })

@docpro_api.get("/user_entries")
def get_user_entries():
    """
    GET /user_entries?user_id=...&since=ISO(optional)
    """
    if not require_pro_key():
        return jsonify({"error": "unauthorized"}), 401

    user_id = (request.args.get("user_id") or "").strip()
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    since = request.args.get("since")
    q = CentralEntry.query.filter(CentralEntry.user_id == user_id)
    if since:
        q = q.filter(CentralEntry.last_modified > parse_iso(since))

    rows = q.order_by(CentralEntry.ts.desc()).limit(2000).all()
    return jsonify({
        "entries": [{
            "id": r.id,
            "user_id": r.user_id,
            "ts": r.ts.isoformat(),
            "mood": r.mood,
            "stress": r.stress,
            "note": r.note,
            "last_modified": r.last_modified.isoformat(),
            "deleted": r.deleted,
        } for r in rows]
    })

@docpro_api.post("/sync_notes")
def sync_notes():
    """
    Offline-first notes from DOCPRO:
    POST { professional_email, notes:[{id,user_id,ts,note,last_modified,deleted}] }
    """
    if not require_pro_key():
        return jsonify({"error": "unauthorized"}), 401

    data = request.get_json(force=True)
    prof_email = (data.get("professional_email") or "").strip()
    notes = data.get("notes") or []
    if not prof_email:
        return jsonify({"error": "professional_email required"}), 400

    synced = []
    for n in notes:
        nid = (n.get("id") or "").strip()
        if not nid:
            continue

        incoming_lm = n.get("last_modified")
        incoming_lm_dt = parse_iso(incoming_lm) if incoming_lm else datetime.utcnow()

        existing = CentralProNote.query.get(nid)
        if existing:
            if existing.last_modified and existing.last_modified >= incoming_lm_dt:
                continue
            existing.ts = parse_iso(n["ts"])
            existing.note = n.get("note") or ""
            existing.deleted = bool(n.get("deleted", False))
            existing.last_modified = incoming_lm_dt
        else:
            db.session.add(CentralProNote(
                id=nid,
                user_id=n["user_id"],
                professional_email=prof_email,
                ts=parse_iso(n["ts"]),
                note=n.get("note") or "",
                deleted=bool(n.get("deleted", False)),
                last_modified=incoming_lm_dt,
            ))
        synced.append(nid)

    db.session.commit()
    return jsonify({"status": "ok", "synced_note_ids": synced})
