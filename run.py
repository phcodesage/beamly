#!/usr/bin/env python3
"""
Beamly Run Server Script
Starts the Flask-SocketIO server with Eventlet.
"""

from app import create_app, socketio
from config import Config

app = create_app()

if __name__ == "__main__":
    # In production, we run via gunicorn with eventlet worker,
    # but in development we can run directly using socketio.run
    print(f"[*] Starting Beamly server on http://{Config.HOST}:{Config.PORT}")
    socketio.run(
        app,
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG,
        use_reloader=Config.DEBUG
    )
