from pydantic import BaseModel

class SystemConfig(BaseModel):
    deployment_mode: str
    public_registration: bool
    google_login_enabled: bool
    discord_login_enabled: bool
    stripe_enabled: bool
    version: str = "2.0.0"