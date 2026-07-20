import urllib.request
import json
from flask import Blueprint, render_template, redirect, url_for, request, abort, Response, jsonify
from app.services.room_manager import room_manager
from app.utils.helpers import validate_room_code
from config import Config
import qrcode
import qrcode.image.svg
import io

# Initialize Blueprint
bp = Blueprint("main", __name__)

@bp.route("/api/ice-servers", methods=["GET"])
def get_ice_servers():
    """
    Dynamically generates and returns WebRTC ICE servers configuration.
    Fetches short-lived TURN credentials from Cloudflare Calls API.
    """
    default_stun = [
        {"urls": "stun:stun.l.google.com:19302"},
        {"urls": "stun:stun1.l.google.com:19302"},
        {"urls": "stun:stun2.l.google.com:19302"}
    ]
    
    key_id = Config.CLOUDFLARE_TURN_KEY_ID
    token = Config.CLOUDFLARE_TURN_API_TOKEN
    
    if key_id and token:
        try:
            url = f"https://rtc.live.cloudflare.com/v1/turn/keys/{key_id}/credentials/generate-ice-servers"
            req = urllib.request.Request(
                url,
                data=json.dumps({"ttl": 86400}).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "User-Agent": "Beamly/1.0 (WebRTC Signaling Coordinator)"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                payload = json.loads(response.read().decode("utf-8"))
                cf_servers = payload.get("iceServers")
                
                if cf_servers:
                    servers_list = [cf_servers] if isinstance(cf_servers, dict) else cf_servers
                    return jsonify({"iceServers": servers_list + default_stun})

        except Exception as e:
            print(f"[Routes] Failed to fetch Cloudflare TURN credentials: {e}")
            
    return jsonify({"iceServers": default_stun})


@bp.route("/", methods=["GET"])
def index() -> str:
    """Renders the landing page."""
    return render_template("landing.html")

@bp.route("/docs", methods=["GET"])
def docs() -> str:
    """Renders the documentation page."""
    return render_template("docs.html")

@bp.route("/create-room", methods=["POST", "GET"])
def create_room():
    """Generates a new room code and redirects to the room page."""
    room_code = room_manager.create_room()
    return redirect(url_for("main.room", room_code=room_code))

@bp.route("/room/<room_code>", methods=["GET"])
def room(room_code: str):
    """
    Renders the room page if the code is valid.
    Redirects to landing with error if invalid.
    """
    room_code = room_code.upper()
    
    # Input validation: ensure room code is syntactically valid
    if not validate_room_code(room_code):
        return redirect(url_for("main.index", error="Invalid room code format."))
        
    # Check if the room exists/is active. If not, we can create it dynamically
    # to support users joining directly via URL, OR redirect to index.
    # In peer-to-peer file transfer, joining directly is a major UX plus,
    # so if it exists we use it; if it doesn't, we initialize it.
    if not room_manager.room_exists(room_code):
        # Dynamically create the room to improve the user experience when opening shared URLs
        # (Alternatively, you can redirect, but dynamic creation is much smoother).
        room_manager._rooms[room_code] = {
            "code": room_code,
            "peers": {},
            "created_at": qrcode.time.time() if hasattr(qrcode, 'time') else 0, # wait, time.time()
        }
        # Let's fix this in room_manager or here. Let's just create it properly.
        import time
        room_manager._rooms[room_code] = {
            "code": room_code,
            "peers": {},
            "created_at": time.time(),
            "last_activity": time.time()
        }
        print(f"[Routes] Dynamically created room {room_code} from direct URL access.")

    # Get join URL for QR code generation
    join_url = request.url_root.rstrip('/') + url_for('main.room', room_code=room_code)

    return render_template(
        "room.html",
        room_code=room_code,
        join_url=join_url
    )

@bp.route("/qr/<room_code>", methods=["GET"])
def qr_code(room_code: str) -> Response:
    """
    Generates a dynamic QR code SVG for the join URL.
    Returns SVG image bytes directly.
    """
    room_code = room_code.upper()
    if not validate_room_code(room_code):
        abort(400, "Invalid room code")

    # Reconstruct the absolute URL to this room
    join_url = request.url_root.rstrip('/') + url_for('main.room', room_code=room_code)

    # Generate QR Code SVG in-memory
    factory = qrcode.image.svg.SvgPathImage
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
        image_factory=factory
    )
    qr.add_data(join_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save SVG to string IO stream
    stream = io.BytesIO()
    img.save(stream)
    svg_bytes = stream.getvalue()

    return Response(svg_bytes, mimetype="image/svg+xml")
