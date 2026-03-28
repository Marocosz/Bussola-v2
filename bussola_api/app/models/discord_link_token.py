from sqlalchemy import Boolean, Column, Integer, String, DateTime, func
from app.db.base_class import Base


class DiscordLinkToken(Base):
    __tablename__ = "discord_link_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    discord_id = Column(String, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
