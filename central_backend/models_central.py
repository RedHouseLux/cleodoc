from datetime import datetime, timezone
import uuid
from db import db

SCHEMA = "cleodoc_central"

def gen_uuid() -> str:
    return str(uuid.uuid4())

def utcnow():
    return datetime.now(timezone.utc)

class CentralUser(db.Model):
    __tablename__ = "users"
    __table_args__ = {"schema": SCHEMA}

    id = db.Column(db.String, primary_key=True)  # phone-generated UUID (stable)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    label = db.Column(db.String)
    consent_json = db.Column(db.JSON)
    extra_data = db.Column(db.JSON)

class CentralEntry(db.Model):
    __tablename__ = "entries"
    __table_args__ = {"schema": SCHEMA}

    id = db.Column(db.String, primary_key=True)  # entry UUID
    user_id = db.Column(db.String, db.ForeignKey(f"{SCHEMA}.users.id"), nullable=False)

    ts = db.Column(db.DateTime(timezone=True), nullable=False)
    mood = db.Column(db.Integer)
    stress = db.Column(db.Integer)
    note = db.Column(db.Text)

    last_modified = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    deleted = db.Column(db.Boolean, default=False, nullable=False)

class CentralProfessional(db.Model):
    __tablename__ = "professionals"
    __table_args__ = {"schema": SCHEMA}

    id = db.Column(db.String, primary_key=True, default=gen_uuid)
    email = db.Column(db.String, unique=True, nullable=False)
    name = db.Column(db.String)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

class CentralProNote(db.Model):
    """
    Optional but useful for DOCPRO offline-first notes.
    Create this table manually if you want it (SQL below).
    """
    __tablename__ = "pro_notes"
    __table_args__ = {"schema": SCHEMA}

    id = db.Column(db.String, primary_key=True)  # UUID from pro app
    user_id = db.Column(db.String, db.ForeignKey(f"{SCHEMA}.users.id"), nullable=False)
    professional_email = db.Column(db.String, nullable=False)

    ts = db.Column(db.DateTime(timezone=True), nullable=False)
    note = db.Column(db.Text, nullable=False)

    last_modified = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    deleted = db.Column(db.Boolean, default=False, nullable=False)
