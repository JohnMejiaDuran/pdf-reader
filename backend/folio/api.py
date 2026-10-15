import asyncio
from contextlib import asynccontextmanager
import hmac
import json
from pathlib import Path
import threading

import httpx
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse

from .assistance import AssistRequest, assist
from .config import Settings
from .conversion import convert_pdf
from .jobs import JobStore, process_job
from .ingress import IngressGuard


def create_app(settings: Settings | None = None, converter=convert_pdf) -> FastAPI:
    settings = settings or Settings()
    store = JobStore(settings.data_dir)
    stop = threading.Event()

    def worker():
        tick = 0
        while not stop.is_set():
            if tick % 120 == 0:
                store.clean(settings.retention_hours)
            job = store.next_job()
            if job:
                process_job(store, job, converter, settings.max_pages)
            else:
                stop.wait(0.5)
            tick += 1

    @asynccontextmanager
    async def lifespan(app):
        store.recover()
        thread = threading.Thread(target=worker, daemon=True, name="pdf-converter")
        thread.start()
        yield
        stop.set()
        await asyncio.to_thread(thread.join, 5)

    app = FastAPI(title="Folio API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(IngressGuard, settings=settings)

    def authorize(authorization: str = Header(default="")):
        if not settings.api_token:
            raise HTTPException(503, "Configurá API_TOKEN en el servidor.")
        if not hmac.compare_digest(authorization.encode(), f"Bearer {settings.api_token}".encode()):
            raise HTTPException(401, "Token del servidor inválido.")

    def get_job(job_id: str):
        job = store.get(job_id)
        if not job:
            raise HTTPException(404, "El trabajo no existe o expiró. Volvé a importar el PDF.")
        return job

    def ready_folder(job_id: str):
        if get_job(job_id)["status"] != "ready":
            raise HTTPException(409, "La conversión todavía no está lista.")
        return store.root / job_id

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.post("/jobs", status_code=202, dependencies=[Depends(authorize)])
    async def upload(file: UploadFile = File()):
        if store.pending_count() >= 3:
            raise HTTPException(429, "Hay tres conversiones en curso. Esperá y reintentá.")
        title = Path(file.filename or "Libro.pdf").stem[:200]
        job = store.create(title)
        destination = store.root / job["id"] / "source.pdf"
        try:
            size = 0
            with destination.open("wb") as output:
                while chunk := await file.read(1024 * 1024):
                    if size == 0 and not chunk.startswith(b"%PDF-"):
                        raise HTTPException(415, "El archivo no es un PDF válido.")
                    size += len(chunk)
                    if size > settings.max_upload_mb * 1024 * 1024:
                        raise HTTPException(413, f"El PDF supera {settings.max_upload_mb} MB.")
                    output.write(chunk)
            if not size:
                raise HTTPException(415, "El PDF está vacío.")
            store.update(job["id"], "queued")
            return store.get(job["id"])
        except BaseException:
            store.delete(job["id"])
            raise
        finally:
            await file.close()

    @app.get("/jobs/{job_id}", dependencies=[Depends(authorize)])
    def status(job_id: str):
        return get_job(job_id)

    @app.get("/jobs/{job_id}/manifest", dependencies=[Depends(authorize)])
    def manifest(job_id: str):
        return FileResponse(ready_folder(job_id) / "manifest.json", media_type="application/json")

    @app.get("/jobs/{job_id}/assets/{name}", dependencies=[Depends(authorize)])
    def asset(job_id: str, name: str):
        folder = ready_folder(job_id)
        manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
        if Path(name).name != name or name not in manifest["assets"]:
            raise HTTPException(404, "Recurso inexistente.")
        path = folder / "assets" / name
        if not path.is_file():
            raise HTTPException(404, "Recurso inexistente.")
        return FileResponse(path, media_type="image/png")

    @app.post("/assist", dependencies=[Depends(authorize)])
    async def assistance(request: AssistRequest):
        async with httpx.AsyncClient(timeout=httpx.Timeout(90, connect=10)) as client:
            return await assist(request, settings, client)

    return app


def app_factory():
    return create_app()
