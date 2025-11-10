import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Mic,
  MicOff,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Star,
  ThumbsUp,
  Users,
  Coins,
  Volume2,
  Upload,
  FileText,
  BookOpen,
} from "lucide-react";
import { axiosClient } from "@/helper/axiosClient";
import { toast } from "react-toastify";
import type {
  PeerLearningSession,
  PeerSessionMessage,
  PeerMessageRequest,
  RatingRequest,
} from "@/types/peerLearning";
import ExcalidrawWhiteboard, { type WhiteboardHandle } from "@/components/ExcalidrawWhiteboard";
import { useWebSocket } from "@/hooks/useWebSocket";
import VoiceChannel from "@/components/VoiceChannel";

export default function PeerLearningSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const [session, setSession] = useState<PeerLearningSession | null>(null);
  const [messages, setMessages] = useState<PeerSessionMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserName, setCurrentUserName] = useState<string>("");
  
  // Sidebar states
  const [activeTab, setActiveTab] = useState<'chat' | 'participants' | 'voice' | 'materials' | 'rating'>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Rating state
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [upvoted, setUpvoted] = useState(false);
  
  // Voice features
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Whiteboard ref
  const whiteboardRef = useRef<WhiteboardHandle>(null);
  const remoteWhiteboardHandlerRef = useRef<((data: any) => void) | null>(null);
  
  // WebRTC event handlers
  const webrtcSignalHandlerRef = useRef<((data: any) => void) | null>(null);
  const peerJoinedHandlerRef = useRef<((data: any) => void) | null>(null);
  const peerLeftHandlerRef = useRef<((data: any) => void) | null>(null);
  
  // Fetch session data
  useEffect(() => {
    if (sessionId) {
      fetchSession();
      fetchCurrentUser();
    }
  }, [sessionId]);

  // Initialize WebSocket connection when we have user data
  const {
    isConnected,
    participants: connectedParticipants,
    sendMessage: sendWSMessage,
    broadcastWhiteboardUpdate,
    joinVoiceChannel,
    leaveVoiceChannel,
    sendWebRTCSignal,
  } = useWebSocket({
    sessionId: sessionId || '',
    userId: currentUserId,
    userName: currentUserName,
    onMessage: (message: PeerSessionMessage) => {
      // Add new message to the list (prevent duplicates)
      setMessages((prev) => {
        const exists = prev.some(msg => msg.id === message.id);
        if (exists) return prev;
        return [...prev, message];
      });
    },
    onWhiteboardUpdate: (data) => {
      // Apply remote whiteboard changes
      if (remoteWhiteboardHandlerRef.current) {
        remoteWhiteboardHandlerRef.current(data);
      }
    },
    onUserJoined: (data) => {
      toast.info(`${data.user_name} joined the session`);
      // Refresh session to update participant count
      fetchSession();
    },
    onUserLeft: () => {
      toast.info(`User left the session`);
      fetchSession();
    },
    onPeerJoined: (data) => {
      console.log('🎤 Peer joined event:', data);
      if (peerJoinedHandlerRef.current) {
        peerJoinedHandlerRef.current(data);
      }
    },
    onPeerLeft: (data) => {
      console.log('🎤 Peer left event:', data);
      if (peerLeftHandlerRef.current) {
        peerLeftHandlerRef.current(data);
      }
    },
    onWebRTCSignal: (data) => {
      console.log('📡 WebRTC signal event:', data);
      if (webrtcSignalHandlerRef.current) {
        webrtcSignalHandlerRef.current(data);
      }
    },
  });

  // Fetch messages only after we have session and user data
  useEffect(() => {
    if (session && currentUserId) {
      const isTeacher = session.teacher_user_id === currentUserId;
      const isEnrolled = session.enrolled_student_ids.includes(currentUserId);
      
      if (isTeacher || isEnrolled) {
        fetchMessages();
      }
    }
  }, [session, currentUserId]);

  const fetchSession = async () => {
    try {
      const response = await axiosClient.get<PeerLearningSession>(`/peer-learning/sessions/${sessionId}`);
      console.log("Session data fetched:", response.data);
      console.log("Enrolled student IDs:", response.data.enrolled_student_ids);
      setSession(response.data);
    } catch (error: any) {
      toast.error("Failed to load peer session");
      console.error(error);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await axiosClient.get<PeerSessionMessage[]>(
        `/peer-learning/sessions/${sessionId}/messages`
      );
      setMessages(response.data);
    } catch (error: any) {
      console.error("Failed to load messages:", error);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await axiosClient.get("/auth/me");
      console.log("Current user:", response.data);
      setCurrentUserId(response.data.id);
      setCurrentUserName(response.data.full_name || response.data.email || "User");
    } catch (error) {
      console.error("Failed to get current user:", error);
    }
  };

  const handleEnroll = async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    try {
      await axiosClient.post(`/peer-learning/sessions/${sessionId}/enroll`);
      toast.success("Successfully enrolled! Loading session...");
      // Refresh session data to update enrolled status
      await fetchSession();
      // Messages will be fetched automatically by the useEffect
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to enroll");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize speech recognition
  useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result) => result.transcript)
          .join("");
        
        setInputMessage(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !sessionId) return;

    const formData = new FormData();
    formData.append("file", file);

    setIsLoading(true);
    try {
      await axiosClient.post(`/peer-learning/sessions/${sessionId}/upload-file`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("File uploaded successfully!");
      
      // Refresh session data to show the new file
      await fetchSession();
      
      // Auto-add the uploaded file to whiteboard
      const response = await axiosClient.get(`/peer-learning/sessions/${sessionId}`);
      const latestFile = response.data.uploaded_files?.[response.data.uploaded_files.length - 1];
      if (latestFile && whiteboardRef.current) {
        const urlParts = latestFile.split('/');
        const fileName = urlParts[urlParts.length - 1].split('?')[0];
        whiteboardRef.current.addImageToCanvas(latestFile, fileName);
        toast.success("File added to whiteboard!");
      }
      
      // Reset the input
      event.target.value = '';
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to upload file");
      console.error("Upload error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addFileToWhiteboard = (fileUrl: string, fileName?: string) => {
    if (whiteboardRef.current) {
      whiteboardRef.current.addImageToCanvas(fileUrl, fileName);
    } else {
      toast.error("Whiteboard is not ready");
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !sessionId) return;

    const messageContent = inputMessage.trim();
    setInputMessage("");
    setIsLoading(true);

    try {
      // Export whiteboard as image
      let whiteboardImageBase64: string | undefined = undefined;
      if (whiteboardRef.current) {
        const blob = await whiteboardRef.current.exportAsImage();
        if (blob) {
          const reader = new FileReader();
          whiteboardImageBase64 = await new Promise((resolve) => {
            reader.onloadend = () => {
              const base64 = reader.result as string;
              const base64Data = base64.split(',')[1];
              resolve(base64Data);
            };
            reader.readAsDataURL(blob);
          });
        }
      }

      const messageData: PeerMessageRequest = {
        content: messageContent,
        message_type: "text",
        whiteboard_image: whiteboardImageBase64,
      };

      // Save message to database
      const response = await axiosClient.post<PeerSessionMessage>(`/peer-learning/sessions/${sessionId}/chat`, messageData);

      // Broadcast via WebSocket for real-time delivery to OTHER participants
      if (isConnected) {
        sendWSMessage(response.data);
      }

      // Add message to local state immediately (don't wait for WebSocket echo)
      setMessages((prev) => {
        // Check if message already exists (prevent duplicates)
        const exists = prev.some(msg => msg.id === response.data.id);
        if (exists) return prev;
        return [...prev, response.data];
      });
    } catch (error: any) {
      toast.error("Failed to send message");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const submitRating = async () => {
    if (!sessionId || rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    setIsLoading(true);
    try {
      const ratingData: RatingRequest = {
        peer_session_id: sessionId,
        rating,
        feedback: feedback.trim() || undefined,
        upvoted,
      };

      await axiosClient.post(`/peer-learning/sessions/${sessionId}/rate`, ratingData);
      toast.success("Thank you for your feedback!");
      fetchSession(); // Refresh session to show updated rating
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to submit rating");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    );
  }

  const isTeacher = session.teacher_user_id === currentUserId;
  const isEnrolled = session.enrolled_student_ids.includes(currentUserId);
  
  console.log("isTeacher:", isTeacher, "isEnrolled:", isEnrolled);
  console.log("currentUserId:", currentUserId);
  console.log("enrolled_student_ids:", session.enrolled_student_ids);

  // Show enrollment prompt if user is not a participant
  if (!isTeacher && !isEnrolled) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard-panel/peer-learning")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold text-secondary">{session.title}</h1>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md text-center space-y-4">
            <Users className="h-16 w-16 text-muted-foreground mx-auto" />
            <h2 className="text-2xl font-bold text-white">Not Enrolled</h2>
            <p className="text-muted-foreground">
              You need to enroll in this session to participate in the live teaching.
            </p>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Teacher: {session.teacher_name}
              </p>
              <p className="text-sm text-muted-foreground">
                Enrolled: {session.enrolled_count}/{session.max_students}
              </p>
            </div>
            <Button
              onClick={handleEnroll}
              disabled={isLoading || session.enrolled_count >= session.max_students || !["waiting", "active"].includes(session.status)}
              className="w-full max-w-xs bg-primary hover:bg-primary"
            >
              {isLoading ? "Enrolling..." : session.status === "active" ? "Join Active Session" : "Enroll in Session"}
            </Button>
            {!["waiting", "active"].includes(session.status) && (
              <p className="text-sm text-secondary">
                This session is no longer accepting enrollments.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Header Bar */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Session Info */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard-panel/peer-learning")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <div>
              <h1 className="text-xl font-semibold text-secondary">{session.title}</h1>
              <p className="text-sm text-muted-foreground">
                {isTeacher ? "You are teaching" : `Teacher: ${session.teacher_name}`}
              </p>
            </div>
          </div>

          {/* Right: Session Stats */}
          <div className="flex items-center gap-6 text-sm">
            {isConnected && (
              <div className="flex items-center gap-2 px-3 py-1 bg-primary/20 border border-primary rounded-lg">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span className="text-primary font-medium">Live</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-white">{session.enrolled_count}/{session.max_students}</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-secondary fill-secondary" />
              <span className="text-white">{session.average_rating.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-primary" />
              <span className="text-white">{session.upvotes}</span>
            </div>
            {isTeacher && (
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-secondary" />
                <span className="text-white font-semibold">{session.coins_earned}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Whiteboard - Main Area */}
        <div className="flex-1">
          <ExcalidrawWhiteboard 
            ref={whiteboardRef} 
            sessionId={sessionId!} 
            sessionType="peer"
            onWhiteboardChange={(elements, appState) => {
              // Broadcast whiteboard changes to all participants
              if (isConnected) {
                broadcastWhiteboardUpdate(elements, appState);
              }
            }}
            onRemoteUpdate={(handler) => {
              // Register the handler for remote updates
              remoteWhiteboardHandlerRef.current = handler;
            }}
          />
        </div>

        {/* Right Sidebar - Collapsible Panels */}
        <div className={`transition-all duration-300 ${isSidebarOpen ? 'w-96' : 'w-0'}`}>
          {isSidebarOpen && (
            <div className="h-full bg-card border-l border-border flex flex-col shadow-2xl">
              {/* Sidebar Tabs */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'chat'
                      ? "bg-card text-foreground border-b-2 border-secondary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab('participants')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'participants'
                      ? "bg-card text-foreground border-b-2 border-secondary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  Participants
                </button>
                <button
                  onClick={() => setActiveTab('materials')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'materials'
                      ? "bg-card text-foreground border-b-2 border-secondary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  Materials
                </button>
                {!isTeacher && (
                  <button
                    onClick={() => setActiveTab('rating')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'rating'
                        ? "bg-card text-foreground border-b-2 border-secondary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    Rate
                  </button>
                )}
              </div>

              {/* Chat Panel */}
              {activeTab === 'chat' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map((message) => {
                      const isOwnMessage = message.sender_id === currentUserId;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] p-3 rounded-lg ${
                              isOwnMessage
                                ? "bg-primary text-foreground"
                                : message.sender_role === "teacher"
                                ? "bg-secondary text-foreground"
                                : "bg-card text-card-foreground"
                            }`}
                          >
                            <p className="text-xs opacity-80 mb-1">
                              {message.sender_name} ({message.sender_role})
                            </p>
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <span className="text-xs opacity-70 mt-1 block">
                              {new Date(message.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="p-4 border-t border-border">
                    <div className="flex gap-2 mb-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={toggleListening}
                        className={isListening ? "bg-destructive text-foreground" : ""}
                      >
                        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Type your message..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={handleKeyPress}
                        className="flex-1 min-h-[60px] max-h-[120px] bg-card border-border text-foreground resize-none"
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={isLoading || !inputMessage.trim()}
                        size="icon"
                        className="self-end"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Participants Panel */}
              {activeTab === 'participants' && (
                <div className="flex-1 overflow-y-auto p-4">
                  <h3 className="text-lg font-semibold text-secondary mb-4">
                    Participants ({connectedParticipants.length})
                  </h3>
                  <div className="space-y-3">
                    {connectedParticipants.length === 0 ? (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">No participants connected yet</p>
                      </div>
                    ) : (
                      connectedParticipants.map((participant: any) => {
                        const isCurrentUser = participant.user_id === currentUserId;
                        const isTeacherUser = participant.user_id === session?.teacher_user_id;
                        
                        // Determine role and styling priority: Teacher > Current User > Student
                        let bgClass, borderClass, avatarClass, roleText, roleClass;
                        
                        if (isTeacherUser) {
                          bgClass = 'bg-[color-mix(in_srgb,var(--secondary)_20%,transparent)]';
                          borderClass = 'border-[color-mix(in_srgb,var(--secondary)_40%,transparent)]';
                          avatarClass = 'bg-gradient-to-br from-yellow-500 to-orange-600';
                          roleText = 'Teacher';
                          roleClass = 'text-secondary';
                        } else {
                          bgClass = isCurrentUser ? 'bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]' : 'bg-[color-mix(in_srgb,var(--card)_50%,transparent)]';
                          borderClass = isCurrentUser ? 'border-[color-mix(in_srgb,var(--primary)_40%,transparent)]' : 'border-[color-mix(in_srgb,var(--border)_50%,transparent)]';
                          avatarClass = isCurrentUser 
                            ? 'bg-gradient-to-br from-blue-500 to-purple-600'
                            : 'bg-gradient-to-br from-green-500 to-teal-600';
                          roleText = 'Student';
                          roleClass = isCurrentUser ? 'text-primary' : 'text-primary';
                        }
                        
                        return (
                          <div
                            key={participant.user_id}
                            className={`flex items-center gap-3 p-3 rounded-lg border ${bgClass} ${borderClass}`}
                          >
                            <div className="relative">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${avatarClass}`}>
                                {participant.user_name?.charAt(0).toUpperCase() || 'U'}
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-background" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-white">
                                {participant.user_name || 'Unknown User'}
                                {isCurrentUser && <span className={`${roleClass} ml-1`}>(You)</span>}
                              </p>
                              <p className={`text-xs ${roleClass}`}>
                                {roleText}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Volume2 className={`h-4 w-4 ${isCurrentUser ? 'text-primary' : 'text-muted-foreground'}`} />
                              <Mic className={`h-4 w-4 ${isCurrentUser ? 'text-primary' : 'text-muted-foreground'}`} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Voice Channel Panel */}
              {activeTab === 'voice' && (
                <div className="flex-1 overflow-y-auto p-4">
                  <VoiceChannel
                    sessionId={sessionId!}
                    userId={currentUserId}
                    userName={currentUserName}
                    onJoinVoice={joinVoiceChannel}
                    onLeaveVoice={leaveVoiceChannel}
                    onSendSignal={sendWebRTCSignal}
                    onWebRTCSignal={(handler) => { webrtcSignalHandlerRef.current = handler; }}
                    onPeerJoined={(handler) => { peerJoinedHandlerRef.current = handler; }}
                    onPeerLeft={(handler) => { peerLeftHandlerRef.current = handler; }}
                  />
                </div>
              )}

              {/* Rating Panel (Students Only) */}
              {activeTab === 'rating' && !isTeacher && (
                <div className="flex-1 overflow-y-auto p-4">
                  <h3 className="text-lg font-semibold text-secondary mb-4">Rate this Session</h3>
                  
                  <div className="space-y-6">
                    {/* Star Rating */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">How helpful was this session?</p>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setRating(star)}
                            className="transition-all"
                          >
                            <Star
                              className={`h-8 w-8 ${
                                star <= rating
                                  ? "text-secondary fill-secondary"
                                  : "text-muted-foreground"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Upvote */}
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={upvoted}
                          onChange={(e) => setUpvoted(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <ThumbsUp className="h-4 w-4 text-primary" />
                        <span className="text-sm text-foreground">Upvote this session</span>
                      </label>
                    </div>

                    {/* Feedback */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Feedback (optional)</p>
                      <Textarea
                        placeholder="Share your thoughts..."
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        className="w-full bg-card border-border text-foreground"
                        rows={4}
                      />
                    </div>

                    {/* Submit Button */}
                    <Button
                      onClick={submitRating}
                      disabled={isLoading || rating === 0}
                      className="w-full bg-primary hover:bg-primary text-foreground"
                    >
                      Submit Rating
                    </Button>
                  </div>
                </div>
              )}

              {/* Materials Panel */}
              {activeTab === 'materials' && (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-secondary">Reference Materials</h3>
                      <label htmlFor="file-upload-materials">
                        <input
                          id="file-upload-materials"
                          type="file"
                          className="hidden"
                          onChange={handleFileUpload}
                          accept=".pdf,.doc,.docx,.txt,image/*"
                        />
                        <Button variant="outline" size="sm" asChild>
                          <span>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload
                          </span>
                        </Button>
                      </label>
                    </div>

                    {/* Notes Section */}
                    {session.reference_note_ids && session.reference_note_ids.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          Notes ({session.reference_note_ids.length})
                        </h4>
                        <p className="text-xs text-muted-foreground">Reference notes will be displayed here</p>
                      </div>
                    )}

                    {/* Assignments Section */}
                    {session.reference_assignment_ids && session.reference_assignment_ids.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Assignments ({session.reference_assignment_ids.length})
                        </h4>
                        <p className="text-xs text-muted-foreground">Reference assignments will be displayed here</p>
                      </div>
                    )}

                    {/* Uploaded Files Section */}
                    {session.uploaded_files && session.uploaded_files.length > 0 ? (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <Upload className="h-4 w-4" />
                          Uploaded Files ({session.uploaded_files.length})
                        </h4>
                        <div className="space-y-2">
                          {session.uploaded_files.map((fileUrl: string, idx: number) => {
                            const urlParts = fileUrl.split('/');
                            const fileNameWithExt = urlParts[urlParts.length - 1].split('?')[0];
                            const isPDF = fileUrl.toLowerCase().includes('.pdf');
                            const isImage = fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                            
                            const extension = fileNameWithExt.split('.').pop()?.toUpperCase() || 'FILE';
                            const displayName = fileNameWithExt.length > 25 
                              ? fileNameWithExt.substring(0, 22) + '...' 
                              : fileNameWithExt;
                            
                            return (
                              <button
                                key={idx}
                                onClick={() => addFileToWhiteboard(fileUrl, fileNameWithExt)}
                                className="w-full p-3 rounded-lg border border-border hover:border-primary bg-card hover:bg-[color-mix(in_srgb,var(--card)_90%,var(--background))] transition-all cursor-pointer group"
                                title={`Click to add ${fileNameWithExt} to whiteboard`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-16 h-16 rounded bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                                    {isImage ? (
                                      <img 
                                        src={fileUrl} 
                                        alt={displayName}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = 'none';
                                          (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
                                        }}
                                      />
                                    ) : null}
                                    <div className={isImage ? 'hidden' : 'text-lg font-bold text-muted-foreground'}>
                                      {isPDF ? '📄' : extension}
                                    </div>
                                  </div>
                                  
                                  <div className="flex-1 text-left overflow-hidden">
                                    <p className="text-sm font-medium text-foreground group-hover:text-primary truncate">
                                      {displayName}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {extension} file
                                    </p>
                                  </div>
                                  
                                  <div className="text-muted-foreground group-hover:text-primary">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 text-center">
                        <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground mb-4">No files uploaded yet</p>
                        <label htmlFor="file-upload-empty">
                          <input
                            id="file-upload-empty"
                            type="file"
                            className="hidden"
                            onChange={handleFileUpload}
                            accept=".pdf,.doc,.docx,.txt,image/*"
                          />
                          <Button variant="outline" asChild>
                            <span>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload First File
                            </span>
                          </Button>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-card border border-border rounded-l-lg p-2 hover:bg-[color-mix(in_srgb,var(--card)_90%,var(--background))] transition-colors z-10"
          style={{ right: isSidebarOpen ? '24rem' : '0' }}
        >
          {isSidebarOpen ? (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  );
}
