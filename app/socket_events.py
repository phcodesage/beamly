from flask import request
from flask_socketio import join_room as socket_join, leave_room as socket_leave, emit
from app import socketio
from app.services.room_manager import room_manager

@socketio.on('join')
def on_join(data: dict) -> None:
    """
    Handles a peer joining a room.
    Assigns role ('initiator' or 'joiner') and relays the state to the client.
    """
    room_code = data.get('room', '').upper()
    sid = request.sid

    if not room_code:
        emit('error', {'message': 'Room code is required.'})
        return

    # Add to room manager
    result = room_manager.join_room(room_code, sid)

    if not result['success']:
        emit('error', {'message': result['error']})
        return

    # Join the Socket.IO room
    socket_join(room_code)
    
    # Send role information to the client who just joined
    emit('joined', {
        'room': room_code,
        'role': result['role'],
        'peer_count': result['peer_count']
    })

    # If this is the second peer (joiner), notify the initiator that a peer has joined
    if result['role'] == 'joiner':
        print(f"[SocketIO] Broadcast peer_joined to room {room_code} from joiner {sid}")
        # Broadcast to room except sender
        emit('peer_joined', {'sid': sid}, to=room_code, include_self=False)

@socketio.on('signal')
def on_signal(data: dict) -> None:
    """
    Relays WebRTC signaling data (SDP offer/answer, ICE candidates)
    to the other peer in the room.
    """
    room_code = data.get('room', '').upper()
    signal_payload = data.get('signal')
    
    if not room_code or not signal_payload:
        return

    # Update last activity for the room
    room_manager.update_activity(room_code)

    # Relay the signal directly to other users in the Socket.IO room
    # We include include_self=False so the sender does not receive their own signal.
    emit('signal', {
        'sender': request.sid,
        'signal': signal_payload
    }, to=room_code, include_self=False)

@socketio.on('leave')
def on_leave(data: dict) -> None:
    """
    Handles a peer voluntarily leaving a room.
    """
    room_code = data.get('room', '').upper()
    sid = request.sid

    if not room_code:
        return

    print(f"[SocketIO] Peer {sid} leaving room {room_code}")
    room_manager.leave_room(room_code, sid)
    socket_leave(room_code)
    
    # Notify remaining peer
    emit('peer_left', {'sid': sid}, to=room_code, include_self=False)

@socketio.on('disconnect')
def on_disconnect() -> None:
    """
    Handles socket disconnection (e.g. closing tab, network loss).
    Automatically removes the peer from all rooms they were in.
    """
    sid = request.sid
    print(f"[SocketIO] Peer {sid} disconnected.")
    
    # Clean up peer globally and notify any affected rooms
    affected_rooms = room_manager.remove_peer_globally(sid)
    for room_code in affected_rooms:
        # Notify other peers in the room that this peer left
        emit('peer_left', {'sid': sid}, to=room_code, include_self=False)
