import os
from dotenv import load_dotenv

# Load environment variables from a .env file if it exists
load_dotenv()

class Config:
    """Base configuration settings for the Beamly application."""
    
    # Flask configuration
    SECRET_KEY: str = os.getenv("SECRET_KEY", "beamly-dev-secret-key-change-in-production")
    DEBUG: bool = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    
    # Server details
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "5001"))
    BACKEND_URL: str = os.getenv("BACKEND_URL", "https://beamly-1.onrender.com")

    
    # WebSocket configuration
    SOCKETIO_PING_TIMEOUT: int = int(os.getenv("SOCKETIO_PING_TIMEOUT", "10"))
    SOCKETIO_PING_INTERVAL: int = int(os.getenv("SOCKETIO_PING_INTERVAL", "5"))
    
    # Room lifecycle settings
    # Time in seconds for room inactivity expiration (e.g., 3600 seconds = 1 hour)
    ROOM_EXPIRATION_SECONDS: int = int(os.getenv("ROOM_EXPIRATION_SECONDS", "3600"))
    
    # Max file size configuration (just for metadata display/validation where needed, 
    # remember that file data itself never passes through the server)
    MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "10240")) # 10 GB limit by default
