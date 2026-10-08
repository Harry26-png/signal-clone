"""Background jobs that run inside the API process."""

import asyncio
import logging

from starlette.concurrency import run_in_threadpool

from .config import settings
from .database import SessionLocal
from .realtime import manager
from .services.messages import purge_expired

logger = logging.getLogger(__name__)


def _purge():
    with SessionLocal() as db:
        return purge_expired(db)


async def disappearing_message_sweeper() -> None:
    """Delete expired disappearing messages and tell clients to drop them from their timelines."""
    while True:
        await asyncio.sleep(settings.sweep_interval_seconds)
        try:
            await manager.send_many(await run_in_threadpool(_purge))
        except Exception:  # noqa: BLE001 - keep the sweeper alive
            logger.exception("Disappearing message sweep failed")
