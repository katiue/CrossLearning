import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  sessionId: string;
  userId: string;
  userName: string;
  onMessage?: (message: any) => void;
  onWhiteboardUpdate?: (data: any) => void;
  onUserJoined?: (data: any) => void;
  onUserLeft?: (data: any) => void;
  onPeerJoined?: (data: any) => void;
  onPeerLeft?: (data: any) => void;
  onWebRTCSignal?: (data: any) => void;
}

export const useWebSocket = ({
  sessionId,
  userId,
  userName,
  onMessage,
  onWhiteboardUpdate,
  onUserJoined,
  onUserLeft,
  onPeerJoined,
  onPeerLeft,
  onWebRTCSignal,
}: UseWebSocketOptions) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);

  useEffect(() => {
    // Don't connect if we don't have required data
    if (!sessionId || !userId || !userName) {
      console.log('⏳ Waiting for session/user data...', { sessionId, userId, userName });
      return;
    }

    console.log('🔌 Initializing WebSocket connection...', { sessionId, userId, userName });

    // Detect the correct backend URL based on current hostname
    const getSocketUrl = () => {
      const hostname = window.location.hostname;
      
      // If accessing via IP address (not localhost), use that IP for WebSocket
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return `http://${hostname}:8000`;
      }
      
      // Default to localhost
      return 'http://localhost:8000';
    };

    // Connect to Socket.IO server
    const socket = io(getSocketUrl(), {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);

      // Join the session
      socket.emit('join_session', {
        session_id: sessionId,
        user_id: userId,
        user_name: userName,
      }, (response: any) => {
        if (response.success) {
          console.log('✅ Joined session successfully');
          setParticipants(response.participants || []);
        } else {
          console.error('❌ Failed to join session:', response.error);
        }
      });
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setIsConnected(false);
    });

    // Session events
    socket.on('new_message', (message) => {
      console.log('📨 New message received:', message);
      onMessage?.(message);
    });

    socket.on('whiteboard_changed', (data) => {
      console.log('🎨 Whiteboard update received');
      onWhiteboardUpdate?.(data);
    });

    socket.on('user_joined', (data) => {
      console.log('👋 User joined:', data.user_name);
      setParticipants((prev) => {
        // Avoid duplicates - check if user already exists
        if (prev.some(p => p.user_id === data.user_id)) {
          console.log('⚠️ User already in participants list, skipping duplicate');
          return prev;
        }
        return [...prev, { user_id: data.user_id, user_name: data.user_name }];
      });
      onUserJoined?.(data);
    });

    socket.on('user_left', (data) => {
      console.log('👋 User left:', data.user_id);
      setParticipants((prev) => prev.filter((p) => p.user_id !== data.user_id));
      onUserLeft?.(data);
    });

    // WebRTC events
    socket.on('peer_joined', (data) => {
      console.log('🎤 Peer joined voice:', data.user_name);
      onPeerJoined?.(data);
    });

    socket.on('peer_left', (data) => {
      console.log('🎤 Peer left voice:', data.user_id);
      onPeerLeft?.(data);
    });

    socket.on('webrtc_signal', (data) => {
      console.log('📡 WebRTC signal received from:', data.from_user_id);
      onWebRTCSignal?.(data);
    });

    // Cleanup on unmount
    return () => {
      console.log('🔌 Disconnecting WebSocket');
      socket.disconnect();
    };
  }, [sessionId, userId, userName]);

  // Send chat message
  const sendMessage = useCallback((message: any) => {
    if (!socketRef.current?.connected) {
      console.error('❌ Cannot send message: not connected');
      return;
    }

    socketRef.current.emit('send_message', {
      session_id: sessionId,
      message,
    }, (response: any) => {
      if (!response.success) {
        console.error('❌ Failed to send message:', response.error);
      }
    });
  }, [sessionId]);

  // Broadcast whiteboard update
  const broadcastWhiteboardUpdate = useCallback((elements: any[], appState: any) => {
    if (!socketRef.current?.connected) {
      console.error('❌ Cannot broadcast whiteboard: not connected');
      return;
    }

    socketRef.current.emit('whiteboard_update', {
      session_id: sessionId,
      elements,
      app_state: appState,
      user_id: userId,
    });
  }, [sessionId, userId]);

  // WebRTC methods
  const joinVoiceChannel = useCallback((callback?: (response: any) => void) => {
    if (!socketRef.current?.connected) {
      console.error('❌ Cannot join voice: not connected');
      return;
    }

    socketRef.current.emit('webrtc_join', {
      session_id: sessionId,
      user_id: userId,
      user_name: userName,
    }, (response: any) => {
      if (response.success) {
        console.log('✅ Joined voice channel, existing peers:', response.peers);
      } else {
        console.error('❌ Failed to join voice:', response.error);
      }
      callback?.(response);
    });
  }, [sessionId, userId, userName]);

  const leaveVoiceChannel = useCallback(() => {
    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit('webrtc_leave', {
      session_id: sessionId,
      user_id: userId,
    });
  }, [sessionId, userId]);

  const sendWebRTCSignal = useCallback((targetUserId: string, signal: any) => {
    if (!socketRef.current?.connected) {
      console.error('❌ Cannot send signal: not connected');
      return;
    }

    socketRef.current.emit('webrtc_signal', {
      session_id: sessionId,
      target_user_id: targetUserId,
      from_user_id: userId,
      signal,
    }, (response: any) => {
      if (!response.success) {
        console.error('❌ Failed to send signal:', response.error);
      }
    });
  }, [sessionId, userId]);

  return {
    isConnected,
    participants,
    sendMessage,
    broadcastWhiteboardUpdate,
    joinVoiceChannel,
    leaveVoiceChannel,
    sendWebRTCSignal,
  };
};
