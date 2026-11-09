"""Small bounded process-local TTL cache for approved report responses."""

from __future__ import annotations

from collections import OrderedDict
from copy import deepcopy
from threading import RLock
from time import monotonic
from typing import Generic, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    """Thread-safe bounded LRU cache with absolute (non-sliding) expiration."""

    def __init__(self, max_entries: int = 256) -> None:
        if max_entries < 1:
            raise ValueError("max_entries must be positive")
        self._max_entries = max_entries
        self._entries: OrderedDict[str, tuple[float, T]] = OrderedDict()
        self._revision = 0
        self._lock = RLock()

    def get(self, key: str) -> T | None:
        now = monotonic()
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if expires_at <= now:
                del self._entries[key]
                return None
            self._entries.move_to_end(key)
            return deepcopy(value)

    def set(self, key: str, value: T, ttl_seconds: float) -> None:
        if ttl_seconds <= 0:
            return
        stored_value = deepcopy(value)
        with self._lock:
            self._entries[key] = (monotonic() + ttl_seconds, stored_value)
            self._entries.move_to_end(key)
            while len(self._entries) > self._max_entries:
                self._entries.popitem(last=False)

    def revision(self, scope: str) -> int:
        del scope
        with self._lock:
            return self._revision

    def set_if_revision(
        self, key: str, value: T, ttl_seconds: float, scope: str, revision: int,
    ) -> None:
        """Avoid publishing a result loaded before an invalidation completed."""
        if ttl_seconds <= 0:
            return
        stored_value = deepcopy(value)
        with self._lock:
            if self._revision != revision:
                return
            self._entries[key] = (monotonic() + ttl_seconds, stored_value)
            self._entries.move_to_end(key)
            while len(self._entries) > self._max_entries:
                self._entries.popitem(last=False)

    def invalidate(self, prefix: str) -> None:
        with self._lock:
            self._revision += 1
            for key in tuple(self._entries):
                if key.startswith(prefix):
                    del self._entries[key]

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()


report_cache: TTLCache[object] = TTLCache(max_entries=256)
WEEKLY_REPORT_PREFIX = "reporting:weekly-performance:v1:"
TELEMETRY_REPORT_PREFIX = "telemetry:report:v1:"


def invalidate_weekly_report(week_start: str) -> None:
    report_cache.invalidate(f"{WEEKLY_REPORT_PREFIX}{week_start}")


def invalidate_telemetry_reports() -> None:
    """Clear all bounded telemetry report variants after an event write."""
    report_cache.invalidate(TELEMETRY_REPORT_PREFIX)
