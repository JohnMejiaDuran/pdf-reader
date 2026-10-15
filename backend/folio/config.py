from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    data_dir: Path = Path("./data")
    api_token: str = ""
    xai_api_key: str = ""
    xai_model: str = ""
    max_upload_mb: int = 50
    max_pages: int = 500
    retention_hours: int = 24
