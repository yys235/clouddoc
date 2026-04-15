from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.models.user import User


ActorType = Literal["user", "guest", "anonymous", "service"]


@dataclass(frozen=True)
class ActorContext:
    actor_type: ActorType
    user_id: str | None = None
    email: str | None = None

    @property
    def is_authenticated(self) -> bool:
        return self.user_id is not None and self.actor_type in {"user", "guest", "service"}

    @property
    def is_guest(self) -> bool:
        return self.actor_type == "guest"

    @classmethod
    def anonymous(cls) -> "ActorContext":
        return cls(actor_type="anonymous")

    @classmethod
    def from_user(cls, user: User, *, actor_type: ActorType = "user") -> "ActorContext":
        return cls(actor_type=actor_type, user_id=user.id, email=user.email)

    @classmethod
    def from_user_id(cls, user_id: str | None, *, actor_type: ActorType = "user") -> "ActorContext":
        if not user_id:
            return cls.anonymous()
        return cls(actor_type=actor_type, user_id=user_id)


def ensure_actor(value: ActorContext | User | str | None) -> ActorContext:
    if isinstance(value, ActorContext):
        return value
    if isinstance(value, User):
        return ActorContext.from_user(value)
    if isinstance(value, str):
        return ActorContext.from_user_id(value)
    return ActorContext.anonymous()
