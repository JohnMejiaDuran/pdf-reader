import json
import shutil
import sqlite3
import time
import uuid
from pathlib import Path


class JobStore:
    def __init__(self, root: Path):
        self.root = root
        root.mkdir(parents=True, exist_ok=True)
        self.db_path = root / "jobs.db"
        with self.connect() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("""CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL,
                error TEXT, created REAL NOT NULL, updated REAL NOT NULL)""")

    def connect(self):
        db = sqlite3.connect(self.db_path, timeout=10)
        db.row_factory = sqlite3.Row
        return db

    def create(self, title: str) -> dict:
        job_id, now = str(uuid.uuid4()), time.time()
        (self.root / job_id).mkdir()
        with self.connect() as db:
            db.execute("INSERT INTO jobs VALUES (?, ?, 'uploading', NULL, ?, ?)", (job_id, title, now, now))
        return self.get(job_id)

    def get(self, job_id: str):
        with self.connect() as db:
            row = db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return dict(row) if row else None

    def update(self, job_id: str, status: str, error=None):
        with self.connect() as db:
            db.execute("UPDATE jobs SET status=?, error=?, updated=? WHERE id=?",
                       (status, error, time.time(), job_id))

    def recover(self):
        with self.connect() as db:
            db.execute("UPDATE jobs SET status='queued' WHERE status='processing'")
            db.execute("UPDATE jobs SET status='failed', error='La carga fue interrumpida. Volvé a importar el PDF.' WHERE status='uploading'")

    def next_job(self):
        with self.connect() as db:
            row = db.execute("SELECT * FROM jobs WHERE status='queued' ORDER BY created LIMIT 1").fetchone()
        return dict(row) if row else None

    def pending_count(self):
        with self.connect() as db:
            return db.execute("SELECT COUNT(*) FROM jobs WHERE status IN ('queued','processing','uploading')").fetchone()[0]

    def delete(self, job_id: str):
        with self.connect() as db:
            db.execute("DELETE FROM jobs WHERE id=?", (job_id,))
        shutil.rmtree(self.root / job_id, ignore_errors=True)

    def clean(self, retention_hours: int):
        cutoff = time.time() - retention_hours * 3600
        with self.connect() as db:
            ids = [row[0] for row in db.execute(
                "SELECT id FROM jobs WHERE updated < ? AND status IN ('ready','failed')", (cutoff,))]
        for job_id in ids:
            self.delete(job_id)


def process_job(store: JobStore, job: dict, converter, max_pages: int):
    store.update(job["id"], "processing")
    folder = store.root / job["id"]
    try:
        manifest = converter(folder / "source.pdf", folder, job["id"], max_pages)
        if not manifest.get("blocks"):
            raise ValueError("El PDF no produjo contenido legible.")
        manifest["title"] = job["title"]
        temporary = folder / "manifest.tmp"
        temporary.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
        temporary.replace(folder / "manifest.json")
        store.update(job["id"], "ready")
    except ValueError as error:
        store.update(job["id"], "failed", str(error)[:500])
    except Exception:
        import logging
        logging.exception("Conversion failed: %s", job["id"])
        store.update(job["id"], "failed", "No se pudo convertir el PDF. Revisá el archivo y los logs del servidor.")
