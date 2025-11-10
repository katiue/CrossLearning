import redis
from dotenv import load_dotenv
import os

load_dotenv()

# Prefer a single REDIS_URL if provided, otherwise fall back to discrete fields
redis_url = os.getenv("REDIS_URL")

if redis_url:
    redis_client = redis.from_url(redis_url, decode_responses=True)
else:
    host = os.getenv("REDIS_HOST")
    port_env = os.getenv("REDIS_PORT")
    username = os.getenv("REDIS_USER")
    password = os.getenv("REDIS_PASSWORD")

    port = int(port_env) if port_env else None

    redis_client = redis.Redis(
        host=host,
        port=port,
        username=username,
        password=password,
        decode_responses=True,
    )


class _LocalCache:
    def __init__(self):
        self._store = {}

    def get(self, key):
        return self._store.get(key)

    def set(self, key, value):
        self._store[key] = value
        return True

    def delete(self, key):
        self._store.pop(key, None)
        return True


def get_redis_client():
    try:
        # Validate connectivity lazily when the dependency is requested
        redis_client.ping()
        return redis_client
    except Exception:
        # Fallback to in-memory cache so app can still function without Redis
        return _LocalCache()
