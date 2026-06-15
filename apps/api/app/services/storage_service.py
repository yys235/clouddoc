from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.core.config import settings


@dataclass(frozen=True)
class StoredAsset:
    url: str
    key: str


class StorageProvider:
    def save_bytes(self, *, key: str, content: bytes, content_type: str) -> StoredAsset:
        raise NotImplementedError

    def delete_url(self, url: str) -> bool:
        raise NotImplementedError


class LocalStorageProvider(StorageProvider):
    def save_bytes(self, *, key: str, content: bytes, content_type: str) -> StoredAsset:
        upload_dir = Path(settings.upload_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        safe_key = Path(key).name
        file_path = upload_dir / safe_key
        file_path.write_bytes(content)
        return StoredAsset(url=f"{settings.upload_url_prefix}/{safe_key}", key=safe_key)

    def delete_url(self, url: str) -> bool:
        prefix = f"{settings.upload_url_prefix.rstrip('/')}/"
        if not url.startswith(prefix):
            return False
        safe_key = Path(url.removeprefix(prefix)).name
        if not safe_key:
            return False
        file_path = Path(settings.upload_dir) / safe_key
        if not file_path.exists():
            return False
        file_path.unlink()
        return True


class S3CompatibleStorageProvider(StorageProvider):
    def __init__(self) -> None:
        try:
            import boto3
        except ImportError as exc:
            raise RuntimeError("boto3 is required when STORAGE_PROVIDER=s3") from exc
        if not settings.s3_bucket:
            raise RuntimeError("S3_BUCKET is required when STORAGE_PROVIDER=s3")
        self._bucket = settings.s3_bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url or None,
            region_name=settings.s3_region_name or None,
            aws_access_key_id=settings.s3_access_key_id or None,
            aws_secret_access_key=settings.s3_secret_access_key or None,
        )

    def save_bytes(self, *, key: str, content: bytes, content_type: str) -> StoredAsset:
        prefix = settings.s3_key_prefix.strip("/")
        object_key = f"{prefix}/{Path(key).name}" if prefix else Path(key).name
        self._client.put_object(
            Bucket=self._bucket,
            Key=object_key,
            Body=content,
            ContentType=content_type,
        )
        base_url = settings.storage_public_base_url.rstrip("/")
        if base_url:
            url = f"{base_url}/{object_key}"
        elif settings.s3_endpoint_url:
            url = f"{settings.s3_endpoint_url.rstrip('/')}/{self._bucket}/{object_key}"
        else:
            url = f"https://{self._bucket}.s3.{settings.s3_region_name}.amazonaws.com/{object_key}"
        return StoredAsset(url=url, key=object_key)

    def delete_url(self, url: str) -> bool:
        object_key = self._object_key_from_url(url)
        if not object_key:
            return False
        self._client.delete_object(Bucket=self._bucket, Key=object_key)
        return True

    def _object_key_from_url(self, url: str) -> str:
        base_url = settings.storage_public_base_url.rstrip("/")
        if base_url and url.startswith(f"{base_url}/"):
            return url.removeprefix(f"{base_url}/")
        endpoint_prefix = f"{settings.s3_endpoint_url.rstrip('/')}/{self._bucket}/" if settings.s3_endpoint_url else ""
        if endpoint_prefix and url.startswith(endpoint_prefix):
            return url.removeprefix(endpoint_prefix)
        amazon_prefix = f"https://{self._bucket}.s3.{settings.s3_region_name}.amazonaws.com/"
        if url.startswith(amazon_prefix):
            return url.removeprefix(amazon_prefix)
        return ""


def get_storage_provider() -> StorageProvider:
    provider = settings.storage_provider.strip().lower()
    if provider in {"", "local"}:
        return LocalStorageProvider()
    if provider in {"s3", "s3-compatible", "s3_compatible"}:
        return S3CompatibleStorageProvider()
    raise RuntimeError(f"Unsupported storage provider: {settings.storage_provider}")
