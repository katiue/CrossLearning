import socketio
from typing import Dict, Set
import logging

logger = logging.getLogger(__name__)

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

# Track connected users per session
# Format: {session_id: {user_id: {'sid': sid, 'user_name': name}, ...}}
session_participants: Dict[str, Dict[str, dict]] = {}

# Track WebRTC signaling peers
# Format: {session_id: {user_id: {...peer_info}}}
webrtc_peers: Dict[str, Dict[str, dict]] = {}


@sio.event
async def connect(sid, environ, auth):
    """Handle client connection"""
    logger.info(f"Client connected: {sid}")
    await sio.emit('connected', {'sid': sid}, room=sid)


@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    logger.info(f"Client disconnected: {sid}")
    
    # Remove from all sessions
    for session_id, participants in list(session_participants.items()):
        for user_id, user_info in list(participants.items()):
            if user_info['sid'] == sid:
                del session_participants[session_id][user_id]
                # Notify others in the session
                await sio.emit('user_left', {
                    'user_id': user_id,
                    'session_id': session_id
                }, room=f"session_{session_id}")
                logger.info(f"User {user_id} left session {session_id}")
                
                # Clean up WebRTC peer
                if session_id in webrtc_peers and user_id in webrtc_peers[session_id]:
                    del webrtc_peers[session_id][user_id]
                    await sio.emit('peer_left', {
                        'user_id': user_id
                    }, room=f"session_{session_id}")


@sio.event
async def join_session(sid, data):
    """Join a peer learning session"""
    session_id = data.get('session_id')
    user_id = data.get('user_id')
    user_name = data.get('user_name', 'Unknown')
    
    if not session_id or not user_id:
        return {'error': 'Missing session_id or user_id'}
    
    logger.info(f"User {user_id} ({user_name}) joining session {session_id}")
    
    # Initialize session if needed
    if session_id not in session_participants:
        session_participants[session_id] = {}
        webrtc_peers[session_id] = {}
    
    # Add user to session with their name
    session_participants[session_id][user_id] = {
        'sid': sid,
        'user_name': user_name
    }
    
    # Join Socket.IO room
    await sio.enter_room(sid, f"session_{session_id}")
    
    # Get list of all participants (including the new joiner)
    participants = [
        {'user_id': uid, 'user_name': info['user_name']} 
        for uid, info in session_participants[session_id].items()
    ]
    
    # Notify ONLY existing users about new participant (skip the new user themselves)
    await sio.emit('user_joined', {
        'user_id': user_id,
        'user_name': user_name,
        'session_id': session_id
    }, room=f"session_{session_id}", skip_sid=sid)
    
    # Send current participants to new user (includes everyone including themselves)
    return {
        'success': True,
        'participants': participants,
        'peers': list(webrtc_peers.get(session_id, {}).keys())
    }


@sio.event
async def send_message(sid, data):
    """Broadcast chat message to all session participants"""
    session_id = data.get('session_id')
    message = data.get('message')
    
    if not session_id:
        return {'error': 'Missing session_id'}
    
    logger.info(f"Broadcasting message in session {session_id}")
    
    # Broadcast to all in session
    await sio.emit('new_message', message, room=f"session_{session_id}")
    
    return {'success': True}


@sio.event
async def whiteboard_update(sid, data):
    """Broadcast whiteboard changes to all session participants"""
    session_id = data.get('session_id')
    elements = data.get('elements')
    app_state = data.get('app_state')
    user_id = data.get('user_id')
    
    if not session_id:
        return {'error': 'Missing session_id'}
    
    # Broadcast to all in session except sender
    await sio.emit('whiteboard_changed', {
        'elements': elements,
        'app_state': app_state,
        'user_id': user_id
    }, room=f"session_{session_id}", skip_sid=sid)
    
    return {'success': True}


# ============== WebRTC Signaling ==============

@sio.event
async def webrtc_join(sid, data):
    """Register as WebRTC peer for voice/video"""
    session_id = data.get('session_id')
    user_id = data.get('user_id')
    user_name = data.get('user_name', 'Unknown')
    
    if not session_id or not user_id:
        return {'error': 'Missing session_id or user_id'}
    
    logger.info(f"WebRTC: User {user_id} joining voice channel in session {session_id}")
    
    # Initialize if needed
    if session_id not in webrtc_peers:
        webrtc_peers[session_id] = {}
    
    # Store peer info
    webrtc_peers[session_id][user_id] = {
        'sid': sid,
        'user_name': user_name,
        'user_id': user_id
    }
    
    # Get existing peers
    existing_peers = [
        {'user_id': uid, 'user_name': info['user_name']}
        for uid, info in webrtc_peers[session_id].items()
        if uid != user_id
    ]
    
    # Notify others that a new peer joined
    await sio.emit('peer_joined', {
        'user_id': user_id,
        'user_name': user_name
    }, room=f"session_{session_id}", skip_sid=sid)
    
    return {
        'success': True,
        'peers': existing_peers
    }


@sio.event
async def webrtc_signal(sid, data):
    """Forward WebRTC signaling data between peers"""
    session_id = data.get('session_id')
    target_user_id = data.get('target_user_id')
    signal_data = data.get('signal')
    from_user_id = data.get('from_user_id')
    
    if not session_id or not target_user_id:
        return {'error': 'Missing session_id or target_user_id'}
    
    # Find target peer's socket ID
    if session_id in webrtc_peers and target_user_id in webrtc_peers[session_id]:
        target_sid = webrtc_peers[session_id][target_user_id]['sid']
        
        # Forward signal to target peer
        await sio.emit('webrtc_signal', {
            'from_user_id': from_user_id,
            'signal': signal_data
        }, room=target_sid)
        
        logger.info(f"WebRTC signal forwarded from {from_user_id} to {target_user_id}")
        return {'success': True}
    
    return {'error': 'Target peer not found'}


@sio.event
async def webrtc_leave(sid, data):
    """Leave WebRTC voice/video channel"""
    session_id = data.get('session_id')
    user_id = data.get('user_id')
    
    if session_id in webrtc_peers and user_id in webrtc_peers[session_id]:
        del webrtc_peers[session_id][user_id]
        
        # Notify others
        await sio.emit('peer_left', {
            'user_id': user_id
        }, room=f"session_{session_id}")
        
        logger.info(f"WebRTC: User {user_id} left voice channel in session {session_id}")
        return {'success': True}
    
    return {'error': 'Peer not found'}

# Export only the Socket.IO server instance
# The ASGIApp wrapper is created in main.py
