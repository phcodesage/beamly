import eventlet
# Monkey patch for eventlet async support in Flask-SocketIO
eventlet.monkey_patch()

from flask import Flask
from flask_socketio import SocketIO
from config import Config

# Initialize SocketIO globally, will be configured in create_app
socketio = SocketIO(
    cors_allowed_origins="*", 
    async_mode="eventlet",
    ping_timeout=Config.SOCKETIO_PING_TIMEOUT,
    ping_interval=Config.SOCKETIO_PING_INTERVAL
)

def create_app() -> Flask:
    """Flask application factory."""
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialize SocketIO with Flask app
    socketio.init_app(app)

    # Register blueprints/routes
    with app.app_context():
        from app import routes
        app.register_blueprint(routes.bp)
        
        # Import socket events to register handlers with the SocketIO instance
        from app import socket_events

    return app
