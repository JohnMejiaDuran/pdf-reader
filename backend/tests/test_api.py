import asyncio
import json
from pathlib import Path
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from folio.api import create_app
from folio.config import Settings
from folio.assistance import assist, AssistRequest


def converted(source, destination, book_id, max_pages):
    return {"version": 1, "id": book_id, "title": "Libro", "assets": [], "warnings": [],
            "blocks": [{"id": "p1", "kind": "paragraph", "text": "Un libro.", "sourcePage": 1}]}


@pytest.fixture
def settings(tmp_path):
    return Settings(data_dir=tmp_path, api_token="test-token", max_upload_mb=1)


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings, converter=converted)) as client:
        client.headers["Authorization"] = "Bearer test-token"
        yield client


def wait_ready(client, job_id):
    for _ in range(100):
        job = client.get(f"/jobs/{job_id}").json()
        if job["status"] in {"ready", "failed"}:
            return job
        time.sleep(0.02)
    raise AssertionError("Worker did not finish")


def test_auth_and_pdf_validation(client):
    assert client.get("/health", headers={"Authorization": ""}).status_code == 200
    assert client.get("/jobs/unknown", headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.post("/jobs", files={"file": ("x.pdf", b"not a PDF", "application/pdf")}).status_code == 415
    assert client.post("/jobs", files={"file": ("x.pdf", b"%PDF-" + b"x" * 1024 * 1024, "application/pdf")}).status_code == 413


def test_complete_conversion_contract(client):
    response = client.post("/jobs", files={"file": ("libro.pdf", b"%PDF-1.7 test", "application/pdf")})
    assert response.status_code == 202
    job_id = response.json()["id"]
    assert wait_ready(client, job_id)["status"] == "ready"
    manifest = client.get(f"/jobs/{job_id}/manifest")
    assert manifest.status_code == 200
    assert manifest.json()["blocks"][0]["text"] == "Un libro."
    assert client.get(f"/jobs/{job_id}/assets/manifest.json").status_code == 404
    assert client.get("/jobs/not-a-uuid").status_code == 404


def test_failed_conversion_has_recoverable_message(settings):
    def broken(*args):
        raise ValueError("Este PDF está protegido.")
    with TestClient(create_app(settings, converter=broken)) as client:
        client.headers["Authorization"] = "Bearer test-token"
        job_id = client.post("/jobs", files={"file": ("x.pdf", b"%PDF-1.7", "application/pdf")}).json()["id"]
        job = wait_ready(client, job_id)
        assert job["status"] == "failed"
        assert "protegido" in job["error"]


def test_restart_recovers_processing_jobs(settings):
    from folio.jobs import JobStore
    store = JobStore(settings.data_dir)
    job = store.create("Libro")
    (settings.data_dir / job["id"] / "source.pdf").write_bytes(b"%PDF-1.7")
    store.update(job["id"], "processing")
    with TestClient(create_app(settings, converter=converted)) as client:
        client.headers["Authorization"] = "Bearer test-token"
        assert wait_ready(client, job["id"])["status"] == "ready"


def test_ai_missing_config_is_explicit(client):
    assert client.post("/assist", json={"action": "define", "text": "clorofila", "context": ""}).status_code == 503


def test_grok_request_has_server_key_and_untrusted_context(settings):
    settings.xai_api_key = "server-secret"
    settings.xai_model = "configured-model"
    def respond(request):
        assert request.headers["Authorization"] == "Bearer server-secret"
        body = json.loads(request.content)
        assert body["model"] == "configured-model"
        assert body["messages"][1]["role"] == "user"
        assert "clorofila" in body["messages"][1]["content"]
        return httpx.Response(200, json={"choices": [{"message": {"content": "Pigmento vegetal."}}]})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            return await assist(AssistRequest(action="define", text="clorofila"), settings, client)
    assert asyncio.run(run())["answer"] == "Pigmento vegetal."


def test_expiration_cleans_files_and_job_record(settings):
    from folio.jobs import JobStore
    store = JobStore(settings.data_dir)
    job = store.create("Libro")
    store.update(job["id"], "ready")
    with store.connect() as db:
        db.execute("UPDATE jobs SET updated=? WHERE id=?", (time.time() - 25 * 3600, job["id"]))
    store.clean(24)
    assert store.get(job["id"]) is None
    assert not (settings.data_dir / job["id"]).exists()


def test_missing_token_fails_closed(settings):
    settings.api_token = ""
    with TestClient(create_app(settings, converter=converted)) as client:
        assert client.get("/jobs/unknown").status_code == 503


def test_unauthorized_upload_is_rejected_before_reading_body(settings):
    app = create_app(settings, converter=converted)
    received = []
    async def receive():
        received.append(True)
        return {"type": "http.request", "body": b"x" * 1000, "more_body": False}
    sent = []
    async def send(message):
        sent.append(message)
    scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": "POST",
             "scheme": "http", "path": "/jobs", "raw_path": b"/jobs", "query_string": b"",
             "headers": [(b"content-type", b"multipart/form-data; boundary=test")],
             "client": ("127.0.0.1", 123), "server": ("test", 80)}
    asyncio.run(app(scope, receive, send))
    assert not received
    assert sent[0]["status"] == 401


def test_chunked_body_limit_precedes_file_spooling(client):
    def body():
        yield b'--test\r\nContent-Disposition: form-data; name="file"; filename="x.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-'
        for _ in range(18):
            yield b"x" * 65536
        yield b'\r\n--test--\r\n'
    response = client.post('/jobs', content=body(), headers={"Content-Type": "multipart/form-data; boundary=test"})
    assert response.status_code == 413


def test_chunked_upload_stops_consuming_before_complete_body(settings):
    app = create_app(settings, converter=converted)
    chunks = iter([b'--test\r\nContent-Disposition: form-data; name="file"; filename="x.pdf"\r\n\r\n%PDF-']
                  + [b"x" * 65536] * 100 + [b'\r\n--test--\r\n'])
    consumed = []
    async def receive():
        chunk = next(chunks)
        consumed.append(len(chunk))
        return {"type": "http.request", "body": chunk, "more_body": True}
    sent = []
    async def send(message):
        sent.append(message)
    scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": "POST",
             "scheme": "http", "path": "/jobs", "raw_path": b"/jobs", "query_string": b"",
             "headers": [(b"content-type", b"multipart/form-data; boundary=test"), (b"authorization", b"Bearer test-token")],
             "client": ("127.0.0.1", 123), "server": ("test", 80)}
    asyncio.run(app(scope, receive, send))
    assert sent[0]["status"] == 413
    assert len(consumed) <= 19


def test_grok_failure_does_not_leak_credentials(settings):
    from fastapi import HTTPException
    settings.xai_api_key = "server-secret"
    settings.xai_model = "configured-model"
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(401, text="server-secret"))) as client:
            with pytest.raises(HTTPException) as error:
                await assist(AssistRequest(action="define", text="clorofila"), settings, client)
            assert error.value.status_code == 502
            assert "server-secret" not in error.value.detail
    asyncio.run(run())
