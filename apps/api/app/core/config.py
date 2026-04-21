from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT_DIR = Path(__file__).resolve().parents[4]
ENV_FILE = ROOT_DIR / '.env'


class Settings(BaseSettings):
    app_name: str = 'CloudDoc API'
    app_env: str = 'development'
    app_debug: bool = True
    api_prefix: str = '/api'
    database_url: str = 'postgresql+psycopg://user:password@localhost:5432/clouddoc'
    cors_origins: str = 'http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:3100'
    upload_dir: str = 'uploads'
    upload_url_prefix: str = '/uploads'
    session_cookie_name: str = 'clouddoc_session'
    session_ttl_days: int = 14
    session_cookie_secure: bool = False
    session_cookie_samesite: str = 'lax'
    app_secret_key: str = 'change-me-in-production'
    share_cookie_prefix: str = 'clouddoc_share'
    webhook_retry_interval_seconds: int = 15
    webhook_retry_attempt_limit: int = 4

    model_config = SettingsConfigDict(env_file=str(ENV_FILE), extra='ignore')

    @property
    def cors_origins_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(',') if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
