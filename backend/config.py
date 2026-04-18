from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/aivoa_crm"
    GROQ_API_KEY: str = ""
    JWT_SECRET: str = "change-me-in-production"
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ORIGINS: str = '["http://localhost:3000"]'

    @property
    def async_database_url(self) -> str:
        """Convert any postgresql:// URL to postgresql+asyncpg:// and fix SSL params."""
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        # asyncpg uses ssl=require instead of sslmode=require
        url = url.replace("sslmode=require", "ssl=require")
        return url

    @property
    def cors_origins_list(self) -> List[str]:
        return json.loads(self.CORS_ORIGINS)

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
