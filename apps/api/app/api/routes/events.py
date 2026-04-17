import asyncio

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.core.db import SessionLocal
from app.services.auth_service import resolve_current_user
from app.services.event_stream_service import event_bus, heartbeat_event, sse_encode

router = APIRouter(prefix="/events")


@router.get("/stream")
async def event_stream_route(request: Request) -> StreamingResponse:
    db = SessionLocal()
    try:
        current_user = resolve_current_user(
            db,
            request,
            None,
            require_authenticated=True,
            allow_dev_fallback=False,
            persist_dev_session=False,
        )
        if current_user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
        user_id = current_user.id
    finally:
        db.rollback()
        db.close()

    subscriber = event_bus.subscribe(user_id)

    async def event_generator():
        try:
            yield sse_encode(
                {
                    "event_id": "connection-ready",
                    "event_type": "connection.ready",
                    "target_type": "system",
                    "target_id": None,
                    "revision": None,
                }
            )
            while True:
                try:
                    event = await asyncio.wait_for(subscriber.get(), timeout=25)
                except asyncio.TimeoutError:
                    event = heartbeat_event()
                yield sse_encode(event)
        finally:
            event_bus.unsubscribe(user_id, subscriber)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
