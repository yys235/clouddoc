from __future__ import annotations

import time
from threading import Lock


class DuplicateSubmissionGuard:
    def __init__(self, ttl_seconds: float = 30.0) -> None:
        self.ttl_seconds = ttl_seconds
        self._lock = Lock()
        self._active: dict[str, float] = {}

    def acquire(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            self._cleanup(now)
            if key in self._active:
                return False
            self._active[key] = now + self.ttl_seconds
            return True

    def release(self, key: str) -> None:
        with self._lock:
            self._active.pop(key, None)

    def _cleanup(self, now: float) -> None:
        expired = [key for key, expires_at in self._active.items() if expires_at <= now]
        for key in expired:
            self._active.pop(key, None)


submission_guard = DuplicateSubmissionGuard()
