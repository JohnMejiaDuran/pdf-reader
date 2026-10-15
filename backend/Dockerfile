FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    DATA_DIR=/data HF_HOME=/data/models/huggingface \
    OMP_NUM_THREADS=2
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml ./
COPY folio ./folio
# CPU wheels avoid installing the CUDA runtime on Railway CPU services.
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir '.[conversion]'
EXPOSE 8000
CMD ["sh", "-c", "uvicorn folio.api:app_factory --factory --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
