import time
from typing import Dict, Any, List, Optional
from app.utils.helpers import generate_room_code, validate_room_code
from config import Config

class RoomManager:
    """
    Manages active WebRTC signaling rooms in memory.
    Ensures rooms expire after inactivity and handles role assignment.
    """
    def __init__(self) -> None:
        # Maps room_code -> room_data dict
        self._rooms: Dict[str, Dict[str, Any]] = {}

    def create_room(self) -> str:
        """
        Creates a new signaling room and returns its unique room code.
        """
        # Clean up any expired rooms first to conserve memory
        self.clean_expired_rooms()

        # Generate a unique room code
        while True:
            code = generate_room_code()
            if code not in self._rooms:
                break

        now = time.time()
        self._rooms[code] = {
            "code": code,
            "peers": {}, # Maps sid -> {"joined_at": float, "role": str}
            "created_at": now,
            "last_activity": now
        }
        print(f"[RoomManager] Room {code} created.")
        return code

    def room_exists(self, code: str) -> bool:
        """Checks if a room exists and has not expired."""
        self.clean_expired_rooms()
        return code.upper() in self._rooms

    def join_room(self, code: str, sid: str) -> Dict[str, Any]:
        """
        Attempts to register a Socket.IO session (sid) into a room.
        Returns a result dict indicating success, error, and role.
        """
        self.clean_expired_rooms()
        code = code.upper()

        if code not in self._rooms:
            return {"success": False, "error": "Room not found or expired."}

        room = self._rooms[code]
        peers = room["peers"]

        # If session is already in the room
        if sid in peers:
            return {"success": True, "role": peers[sid]["role"]}

        # WebRTC signaling rooms for Beamly support exactly 2 peers
        if len(peers) >= 2:
            return {"success": False, "error": "Room is full (max 2 devices)."}

        # Assign roles: first one to join is the "initiator", second is the "joiner"
        role = "initiator" if len(peers) == 0 else "joiner"
        
        peers[sid] = {
            "joined_at": time.time(),
            "role": role
        }
        
        room["last_activity"] = time.time()
        print(f"[RoomManager] Peer {sid} joined room {code} as {role}.")
        
        return {
            "success": True,
            "role": role,
            "peer_count": len(peers)
        }

    def leave_room(self, code: str, sid: str) -> bool:
        """
        Removes a session from a room.
        Returns True if the peer was removed, False otherwise.
        """
        code = code.upper()
        if code not in self._rooms:
            return False

        room = self._rooms[code]
        if sid in room["peers"]:
            del room["peers"][sid]
            room["last_activity"] = time.time()
            print(f"[RoomManager] Peer {sid} left room {code}.")
            
            # If the room becomes empty, we can clean it up immediately
            if not room["peers"]:
                del self._rooms[code]
                print(f"[RoomManager] Room {code} deleted because it is empty.")
            return True
            
        return False

    def remove_peer_globally(self, sid: str) -> List[str]:
        """
        Scans all rooms and removes the disconnected peer.
        Returns a list of room codes from which the peer was removed.
        """
        removed_from = []
        # Create a list of keys to avoid modification during iteration
        for code in list(self._rooms.keys()):
            if sid in self._rooms[code]["peers"]:
                self.leave_room(code, sid)
                removed_from.append(code)
        return removed_from

    def get_peers(self, code: str) -> Dict[str, Any]:
        """Returns the dictionary of peers in the room."""
        code = code.upper()
        if code in self._rooms:
            return self._rooms[code]["peers"]
        return {}

    def get_peer_role(self, code: str, sid: str) -> Optional[str]:
        """Returns the role of a specific peer in a room."""
        code = code.upper()
        if code in self._rooms and sid in self._rooms[code]["peers"]:
            return self._rooms[code]["peers"][sid]["role"]
        return None

    def update_activity(self, code: str) -> None:
        """Updates the last activity timestamp for a room."""
        code = code.upper()
        if code in self._rooms:
            self._rooms[code]["last_activity"] = time.time()

    def clean_expired_rooms(self) -> None:
        """
        Scans rooms and removes any that have exceeded the inactivity threshold.
        """
        now = time.time()
        expiry_limit = Config.ROOM_EXPIRATION_SECONDS
        
        for code in list(self._rooms.keys()):
            room = self._rooms[code]
            # Expire rooms if they exceed the expiration limit
            # Also, empty rooms are cleaned up immediately on leave_room, but this is a fallback.
            if now - room["last_activity"] > expiry_limit:
                print(f"[RoomManager] Expiring room {code} due to inactivity.")
                del self._rooms[code]

# Global instance of RoomManager
room_manager = RoomManager()
