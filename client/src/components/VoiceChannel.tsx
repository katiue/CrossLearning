import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { toast } from "react-toastify";
import Peer from "simple-peer";

interface VoiceChannelProps {
  sessionId: string;
  userId: string;
  userName: string;
  onJoinVoice: (callback: (response: any) => void) => void;
  onLeaveVoice: () => void;
  onSendSignal: (targetUserId: string, signal: any) => void;
  onWebRTCSignal?: (handler: (data: any) => void) => void;
  onPeerJoined?: (handler: (data: any) => void) => void;
  onPeerLeft?: (handler: (data: any) => void) => void;
}

interface PeerConnection {
  userId: string;
  userName: string;
  peer: Peer.Instance;
  stream?: MediaStream;
  audioElement?: HTMLAudioElement;
}

export default function VoiceChannel({
  userId,
  userName,
  onJoinVoice,
  onLeaveVoice,
  onSendSignal,
  onWebRTCSignal,
  onPeerJoined,
  onPeerLeft,
}: VoiceChannelProps) {
  const [isInVoice, setIsInVoice] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState<PeerConnection[]>([]);
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const videoRef = useRef<HTMLVideoElement>(null);

  // Handle WebRTC signaling
  useEffect(() => {
    if (!onWebRTCSignal) return;

    const handleSignal = (data: any) => {
      const { from_user_id, signal } = data;
      
      const peer = peersRef.current.get(from_user_id);
      if (peer) {
        peer.peer.signal(signal);
      } else {
        console.warn(`Received signal from unknown peer: ${from_user_id}`);
      }
    };

    // Register the handler
    onWebRTCSignal(handleSignal);
    
    // No cleanup needed - the parent manages the event listener
  }, [onWebRTCSignal]);

  // Handle new peer joining
  useEffect(() => {
    if (!onPeerJoined) return;

    const handlePeerJoined = (data: any) => {
      const { user_id: peerUserId, user_name: peerUserName } = data;
      
      console.log('🎤 New peer joined voice:', peerUserId, peerUserName);
      
      if (peerUserId === userId) return; // Don't connect to ourselves
      
      if (!localStreamRef.current) {
        console.warn("No local stream available when peer joined");
        return;
      }

      // Create peer connection (we initiate because we're already in the channel)
      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream: localStreamRef.current,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ]
        }
      });

      // Store peer immediately with placeholder data
      peersRef.current.set(peerUserId, {
        userId: peerUserId,
        userName: peerUserName,
        peer,
      });
      setConnectedPeers(Array.from(peersRef.current.values()));

      // Send signal to peer
      peer.on('signal', (signal) => {
        console.log('📤 Sending signal to peer:', peerUserId);
        onSendSignal(peerUserId, signal);
      });

      // Receive peer's stream
      peer.on('stream', (stream) => {
        console.log('📥 Received stream from peer:', peerUserId);
        const audioElement = new Audio();
        audioElement.srcObject = stream;
        audioElement.autoplay = true;
        audioElement.volume = isDeafened ? 0 : 1;
        
        // Update peer with stream and audio element
        const existingPeer = peersRef.current.get(peerUserId);
        if (existingPeer) {
          existingPeer.stream = stream;
          existingPeer.audioElement = audioElement;
          peersRef.current.set(peerUserId, existingPeer);
          setConnectedPeers(Array.from(peersRef.current.values()));
        }
        
        toast.success(`${peerUserName} joined the voice channel`);
      });

      peer.on('error', (err) => {
        console.error('❌ Peer connection error:', peerUserId, err);
      });

      peer.on('close', () => {
        console.log(`🔌 Peer ${peerUserId} connection closed`);
        peersRef.current.delete(peerUserId);
        setConnectedPeers(Array.from(peersRef.current.values()));
      });
    };

    // Register the handler
    onPeerJoined(handlePeerJoined);
    
    // No cleanup needed - the parent manages the event listener
  }, [onPeerJoined, userId, onSendSignal, isDeafened]);

  // Handle peer leaving
  useEffect(() => {
    if (!onPeerLeft) return;

    const handlePeerLeft = (data: any) => {
      const { user_id: peerUserId } = data;
      
      const peer = peersRef.current.get(peerUserId);
      if (peer) {
        peer.peer.destroy();
        peer.audioElement?.pause();
        peer.audioElement = undefined;
        peersRef.current.delete(peerUserId);
        setConnectedPeers(Array.from(peersRef.current.values()));
        
        toast.info(`${peer.userName} left the voice channel`);
      }
    };

    // Register the handler
    onPeerLeft(handlePeerLeft);
    
    // No cleanup needed - the parent manages the event listener
  }, [onPeerLeft]);

  const joinVoice = async () => {
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Your browser doesn't support audio/video capture. Try using Chrome or Firefox.");
        return;
      }

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      localStreamRef.current = stream;

      // Show local video if enabled
      if (videoRef.current && isVideoEnabled) {
        videoRef.current.srcObject = stream;
      }

      // Join voice channel via WebSocket
      onJoinVoice((response) => {
        if (response.success) {
          setIsInVoice(true);
          toast.success("Joined voice channel!");

          console.log('🎤 Existing peers in channel:', response.peers);

          // Connect to existing peers
          response.peers?.forEach((peerInfo: any) => {
            console.log('🔗 Connecting to existing peer:', peerInfo.user_id, peerInfo.user_name);
            
            // Create peer connection (we DON'T initiate - they will initiate to us)
            const peer = new Peer({
              initiator: false,
              trickle: false,
              stream: stream,
              config: {
                iceServers: [
                  { urls: 'stun:stun.l.google.com:19302' },
                  { urls: 'stun:stun1.l.google.com:19302' },
                ]
              }
            });

            // Store peer immediately
            peersRef.current.set(peerInfo.user_id, {
              userId: peerInfo.user_id,
              userName: peerInfo.user_name,
              peer,
            });
            setConnectedPeers(Array.from(peersRef.current.values()));

            peer.on('signal', (signal) => {
              console.log('📤 Sending answer signal to:', peerInfo.user_id);
              onSendSignal(peerInfo.user_id, signal);
            });

            peer.on('stream', (peerStream) => {
              console.log('📥 Received stream from existing peer:', peerInfo.user_id);
              const audioElement = new Audio();
              audioElement.srcObject = peerStream;
              audioElement.autoplay = true;
              audioElement.volume = isDeafened ? 0 : 1;

              // Update peer with stream
              const existingPeer = peersRef.current.get(peerInfo.user_id);
              if (existingPeer) {
                existingPeer.stream = peerStream;
                existingPeer.audioElement = audioElement;
                peersRef.current.set(peerInfo.user_id, existingPeer);
                setConnectedPeers(Array.from(peersRef.current.values()));
              }
            });

            peer.on('error', (err) => {
              console.error('❌ Peer connection error with existing peer:', peerInfo.user_id, err);
            });

            peer.on('close', () => {
              console.log(`🔌 Existing peer ${peerInfo.user_id} connection closed`);
            });
          });
        } else {
          toast.error("Failed to join voice channel");
          stream.getTracks().forEach((track) => track.stop());
        }
      });
    } catch (error: any) {
      console.error("Failed to get user media:", error);
      
      // Provide specific error messages
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        toast.error("Microphone access denied. Please allow microphone permission in your browser settings and try again.");
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        toast.error("No microphone found. Please connect a microphone and try again.");
      } else if (error.name === 'NotSupportedError') {
        toast.error("Your browser doesn't support audio capture. For mobile devices, use HTTPS or try Chrome/Firefox.");
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        toast.error("Microphone is already in use by another app. Please close other apps using the microphone.");
      } else {
        toast.error(`Microphone error: ${error.message || 'Unknown error'}. On mobile, this feature may require HTTPS.`);
      }
    }
  };

  const leaveVoice = () => {
    // Stop all tracks
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    // Destroy all peer connections
    peersRef.current.forEach((peer) => {
      peer.peer.destroy();
      peer.audioElement?.pause();
    });
    peersRef.current.clear();
    setConnectedPeers([]);

    // Leave via WebSocket
    onLeaveVoice();
    setIsInVoice(false);
    setIsVideoEnabled(false);
    toast.info("Left voice channel");
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted; // Toggle
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleDeafen = () => {
    const newDeafenState = !isDeafened;
    setIsDeafened(newDeafenState);

    // Mute/unmute all peer audio elements
    peersRef.current.forEach((peer) => {
      if (peer.audioElement) {
        peer.audioElement.volume = newDeafenState ? 0 : 1;
      }
    });

    // Also mute self when deafening
    if (newDeafenState && !isMuted) {
      toggleMute();
    }
  };

  const toggleVideo = async () => {
    if (!isInVoice) return;

    try {
      if (!isVideoEnabled) {
        // Enable video
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        
        localStreamRef.current?.addTrack(videoTrack);
        
        if (videoRef.current) {
          videoRef.current.srcObject = localStreamRef.current;
        }
        
        // Add video track to all peer connections
        peersRef.current.forEach((peer) => {
          peer.peer.addTrack(videoTrack, localStreamRef.current!);
        });
        
        setIsVideoEnabled(true);
      } else {
        // Disable video
        localStreamRef.current?.getVideoTracks().forEach((track) => {
          track.stop();
          localStreamRef.current?.removeTrack(track);
        });
        
        setIsVideoEnabled(false);
      }
    } catch (error) {
      console.error("Failed to toggle video:", error);
      toast.error("Camera access denied or unavailable");
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Voice Channel
        </h3>
        {isInVoice && (
          <div className="flex items-center gap-1 px-2 py-1 bg-green-600/20 border border-green-600 rounded text-xs text-green-400">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Connected
          </div>
        )}
      </div>

      {/* Local Video Preview */}
      {isInVoice && isVideoEnabled && (
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full rounded-lg bg-black"
          />
          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded text-xs text-white">
            {userName} (You)
          </div>
        </div>
      )}

      {/* Connected Peers - Updated with Avatars */}
      {isInVoice && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400 font-medium">
            In Voice ({connectedPeers.length + 1})
          </p>
          
          {/* Current User */}
          <div className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg border border-gray-600/50">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{userName}</p>
              <p className="text-xs text-gray-400">You</p>
            </div>
            <div className="flex items-center gap-2">
              {isMuted ? (
                <MicOff className="h-4 w-4 text-red-400" />
              ) : (
                <Mic className="h-4 w-4 text-green-400" />
              )}
              {isDeafened ? (
                <VolumeX className="h-4 w-4 text-red-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </div>

          {/* Connected Peers */}
          {connectedPeers.map((peer) => (
            <div
              key={peer.userId}
              className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg border border-gray-600/50"
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-semibold">
                  {peer.userName.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{peer.userName}</p>
                <p className="text-xs text-green-400">Speaking</p>
              </div>
              <Volume2 className="h-4 w-4 text-green-400 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Show message when not in voice */}
      {!isInVoice && connectedPeers.length === 0 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-700/50 flex items-center justify-center">
            <Phone className="h-8 w-8 text-gray-500" />
          </div>
          <p className="text-sm text-gray-400">No one in voice channel</p>
          <p className="text-xs text-gray-500 mt-1">Join to start talking</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        {!isInVoice ? (
          <Button
            onClick={joinVoice}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Phone className="h-4 w-4 mr-2" />
            Join Voice
          </Button>
        ) : (
          <>
            <Button
              onClick={toggleMute}
              variant={isMuted ? "destructive" : "secondary"}
              size="icon"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            
            <Button
              onClick={toggleDeafen}
              variant={isDeafened ? "destructive" : "secondary"}
              size="icon"
              title={isDeafened ? "Undeafen" : "Deafen"}
            >
              {isDeafened ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            
            <Button
              onClick={toggleVideo}
              variant={isVideoEnabled ? "default" : "secondary"}
              size="icon"
              title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
            >
              {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </Button>
            
            <Button
              onClick={leaveVoice}
              variant="destructive"
              className="flex-1"
            >
              <PhoneOff className="h-4 w-4 mr-2" />
              Leave
            </Button>
          </>
        )}
      </div>

      {!isInVoice && (
        <p className="text-xs text-gray-500 text-center">
          Join to talk with participants using voice/video
        </p>
      )}
    </div>
  );
}
