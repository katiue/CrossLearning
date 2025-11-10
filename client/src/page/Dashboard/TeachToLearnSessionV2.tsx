import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  FileText,
  BookOpen,
  Upload,
  BarChart3,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { axiosClient } from "@/helper/axiosClient";
import { toast } from "react-toastify";
import type {
  TeachSession,
  TeachSessionMessage,
  ChatRequest,
  ChatResponse,
  SessionEvaluation,
} from "@/types/teachSession";
import ExcalidrawWhiteboard, { type WhiteboardHandle } from "@/components/ExcalidrawWhiteboard";

export default function TeachToLearnSessionV2() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const [session, setSession] = useState<TeachSession | null>(null);
  const [messages, setMessages] = useState<TeachSessionMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<SessionEvaluation | null>(null);
  
  // Sidebar states
  const [activeTab, setActiveTab] = useState<'chat' | 'evaluation' | 'materials'>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Voice features
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Whiteboard ref
  const whiteboardRef = useRef<WhiteboardHandle>(null);
  
  // Fetch session data
  useEffect(() => {
    if (sessionId) {
      fetchSession();
    }
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const response = await axiosClient.get(`/teach-sessions/sessions/${sessionId}`);
      console.log("Session data fetched:", response.data);
      console.log("Uploaded files:", response.data.uploaded_files);
      console.log("Reference note IDs:", response.data.reference_note_ids);
      console.log("Reference assignment IDs:", response.data.reference_assignment_ids);
      setSession(response.data);
      setMessages(response.data.messages || []);
    } catch (error: any) {
      toast.error("Failed to load session");
      console.error(error);
    }
  };

  // Auto-load files to whiteboard when session is loaded or updated
  useEffect(() => {
    if (session && session.uploaded_files && session.uploaded_files.length > 0 && whiteboardRef.current) {
      // Small delay to ensure whiteboard is fully initialized
      const timer = setTimeout(() => {
        const files = session.uploaded_files.map((url: string) => {
          const urlParts = url.split('/');
          const fileName = urlParts[urlParts.length - 1].split('?')[0];
          return { url, fileName };
        });
        
        whiteboardRef.current?.addMultipleFilesToCanvas(files);
      }, 1000); // Wait 1 second for whiteboard to be ready
      
      return () => clearTimeout(timer);
    }
  }, [session]);

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

  const speakText = (text: string) => {
    if (!voiceEnabled || !("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !sessionId) return;

    const messageContent = inputMessage.trim();
    setInputMessage("");
    setIsLoading(true);

    // Add user message to UI immediately
    const userMessage: TeachSessionMessage = {
      id: Date.now().toString(),
      session_id: sessionId,
      role: "student",
      content: messageContent,
      message_type: "text",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // Export whiteboard as image
      let whiteboardImageBase64: string | undefined = undefined;
      if (whiteboardRef.current) {
        console.log("Exporting whiteboard...");
        const blob = await whiteboardRef.current.exportAsImage();
        if (blob) {
          console.log("Whiteboard exported, size:", blob.size, "bytes");
          // Convert blob to base64
          const reader = new FileReader();
          whiteboardImageBase64 = await new Promise((resolve) => {
            reader.onloadend = () => {
              const base64 = reader.result as string;
              // Remove the data:image/png;base64, prefix
              const base64Data = base64.split(',')[1];
              console.log("Base64 length:", base64Data.length);
              resolve(base64Data);
            };
            reader.readAsDataURL(blob);
          });
          console.log("Whiteboard image will be sent with message");
        } else {
          console.log("Whiteboard export returned null");
        }
      } else {
        console.log("Whiteboard ref not available");
      }

      const chatRequest: ChatRequest = {
        message: messageContent,
        message_type: "text",
        whiteboard_image: whiteboardImageBase64,
      };

      const response = await axiosClient.post<ChatResponse>(
        `/teach-sessions/sessions/${sessionId}/chat`,
        chatRequest
      );

      // Add AI response
      const aiMessage: TeachSessionMessage = {
        id: response.data.message_id,
        session_id: sessionId,
        role: "ai",
        content: response.data.ai_message,
        message_type: "text",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMessage]);

      // Speak AI response if voice is enabled
      if (voiceEnabled) {
        speakText(response.data.ai_message);
      }
    } catch (error: any) {
      toast.error("Failed to send message");
      console.error(error);
      // Remove the optimistically added user message on error
      setMessages((prev) => prev.slice(0, -1));
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

  const generateEvaluation = async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    try {
      // Export whiteboard as image for evaluation
      let whiteboardImageBase64: string | undefined = undefined;
      if (whiteboardRef.current) {
        const blob = await whiteboardRef.current.exportAsImage();
        if (blob) {
          // Convert blob to base64
          const reader = new FileReader();
          whiteboardImageBase64 = await new Promise((resolve) => {
            reader.onloadend = () => {
              const base64 = reader.result as string;
              // Remove the data:image/png;base64, prefix
              const base64Data = base64.split(',')[1];
              resolve(base64Data);
            };
            reader.readAsDataURL(blob);
          });
        }
      }

      const response = await axiosClient.post<SessionEvaluation>(
        `/teach-sessions/sessions/${sessionId}/evaluate`,
        {
          session_id: sessionId,
          whiteboard_image: whiteboardImageBase64,
        }
      );
      setEvaluation(response.data);
      setActiveTab('evaluation');
      toast.success("Session evaluated successfully!");
    } catch (error: any) {
      toast.error("Failed to generate evaluation");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !sessionId) return;

    const formData = new FormData();
    formData.append("file", file);

    setIsLoading(true);
    try {
      await axiosClient.post(`/teach-sessions/sessions/${sessionId}/upload-file`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("File uploaded successfully!");
      
      // Refresh session data to show the new file
      await fetchSession();
      
      // Auto-add the uploaded file to whiteboard
      // The file will be in the refreshed session data
      const response = await axiosClient.get(`/teach-sessions/sessions/${sessionId}`);
      const latestFile = response.data.uploaded_files?.[response.data.uploaded_files.length - 1];
      if (latestFile) {
        const urlParts = latestFile.split('/');
        const fileName = urlParts[urlParts.length - 1].split('?')[0];
        addFileToWhiteboard(latestFile, fileName);
        toast.success("File added to whiteboard!");
      }
      
      // Reset the input so the same file can be uploaded again if needed
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

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-muted-foreground">Loading session...</p>
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
              onClick={() => navigate("/dashboard-panel/teach-sessions")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <div>
              <h1 className="text-xl font-semibold text-primary">{session.title}</h1>
              <p className="text-sm text-muted-foreground">Topic: {session.topic}</p>
            </div>
          </div>

          {/* Right: Session Stats */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <span className="text-foreground capitalize px-2 py-1 bg-secondary rounded">
                {session.status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Messages:</span>
              <span className="text-foreground font-semibold">{messages.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Duration:</span>
              <span className="text-foreground font-semibold">{session.duration_minutes} min</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={generateEvaluation}
              disabled={isLoading}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Get Evaluation
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Whiteboard - Main Area */}
        <div className="flex-1">
          <ExcalidrawWhiteboard ref={whiteboardRef} sessionId={sessionId!} />
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
                      ? "bg-secondary text-foreground border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  AI Chat
                </button>
                <button
                  onClick={() => setActiveTab('evaluation')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'evaluation'
                      ? "bg-secondary text-foreground border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  Evaluation
                </button>
                <button
                  onClick={() => setActiveTab('materials')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'materials'
                      ? "bg-secondary text-foreground border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  Materials
                </button>
              </div>

              {/* AI Chat Panel */}
              {activeTab === 'chat' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Chat Header */}
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">AI Student</h3>
                      <div className="flex gap-2">
                        {isSpeaking && (
                          <span className="text-xs text-primary flex items-center gap-1">
                            <Volume2 className="h-3 w-3 animate-pulse" />
                            Speaking...
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setVoiceEnabled(!voiceEnabled)}
                        >
                          {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                        </Button>
                        {isSpeaking && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={stopSpeaking}
                            className="text-destructive"
                          >
                            Stop
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === "student" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                            className={`max-w-[85%] p-3 rounded-lg ${
                            message.role === "student"
                              ? "bg-primary text-foreground"
                              : "bg-secondary text-foreground"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <span className="text-xs opacity-70 mt-1 block">
                            {new Date(message.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="p-4 border-t border-border">
                    <div className="flex gap-2 mb-2">
                      <label htmlFor="file-upload">
                        <input
                          id="file-upload"
                          type="file"
                          className="hidden"
                          onChange={handleFileUpload}
                          accept=".pdf,.doc,.docx,.txt,image/*"
                        />
                        <Button variant="outline" size="icon" asChild>
                          <span>
                            <Upload className="h-4 w-4" />
                          </span>
                        </Button>
                      </label>

                      <Button
                        variant="outline"
                        size="icon"
                        onClick={toggleListening}
                        className={isListening ? "bg-destructive text-white" : ""}
                      >
                        {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Explain the concept..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={handleKeyPress}
                        className="flex-1 min-h-[60px] max-h-[120px] bg-secondary border-border text-foreground resize-none"
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

              {/* Evaluation Panel */}
              {activeTab === 'evaluation' && (
                <div className="flex-1 overflow-y-auto p-4">
                  {evaluation ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-primary mb-4">Session Evaluation</h3>
                        
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="text-sm text-muted-foreground">Clarity Score:</span>
                              <span className="text-foreground font-bold">{evaluation.clarity_score}/100</span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-3">
                              <div
                                className="bg-primary h-3 rounded-full transition-all"
                                style={{ width: `${evaluation.clarity_score}%` }}
                              />
                            </div>
                          </div>
                          
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="text-sm text-muted-foreground">Completeness:</span>
                              <span className="text-foreground font-bold">{evaluation.completeness_score}/100</span>
                            </div>
                            <div className="w-full bg-secondary rounded-full h-3">
                              <div
                                className="bg-accent h-3 rounded-full transition-all"
                                style={{ width: `${evaluation.completeness_score}%` }}
                              />
                            </div>
                          </div>

                          {/* Average Score & Peer Learning Eligibility */}
                          {(() => {
                            const avgScore = (evaluation.clarity_score + evaluation.completeness_score) / 2;
                            const isEligible = avgScore >= 80;
                            return (
                              <div className="pt-3 border-t border-border">
                                <div className="flex justify-between items-center mb-3">
                                  <span className="text-sm text-muted-foreground">Average Score:</span>
                                  <span className={`font-bold text-xl ${isEligible ? 'text-primary' : 'text-white'}`}>
                                    {avgScore.toFixed(1)}%
                                  </span>
                                </div>
                                {isEligible && (
                                  <div className="p-3 bg-primary/20 border border-primary/40 rounded-lg">
                                    <p className="text-sm text-accent mb-2 font-semibold">
                                      🎉 Excellent! You can now teach others!
                                    </p>
                                    <Button
                                      className="w-full bg-accent hover:bg-accent text-foreground"
                                      onClick={() => navigate('/dashboard-panel/peer-learning')}
                                    >
                                      Create Peer Learning Session
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          <div className="pt-2">
                            <p className="text-sm text-muted-foreground mb-2 font-semibold">Feedback:</p>
                            <p className="text-sm text-muted-foreground bg-secondary p-3 rounded">
                              {evaluation.feedback}
                            </p>
                          </div>

                          {evaluation.areas_for_improvement.length > 0 && (
                            <div className="pt-2">
                              <p className="text-sm text-muted-foreground mb-2 font-semibold">Areas to Improve:</p>
                              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 bg-secondary p-3 rounded">
                                {evaluation.areas_for_improvement.map((area, idx) => (
                                  <li key={idx}>{area}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">No evaluation yet</p>
                      <Button onClick={generateEvaluation} disabled={isLoading}>
                        Generate Evaluation
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Materials Panel */}
              {activeTab === 'materials' && (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-primary">Reference Materials</h3>
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
                    {session.reference_note_ids.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          Notes ({session.reference_note_ids.length})
                        </h4>
                        <p className="text-xs text-muted-foreground">Reference notes will be displayed here</p>
                      </div>
                    )}

                    {/* Assignments Section */}
                    {session.reference_assignment_ids.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Assignments ({session.reference_assignment_ids.length})
                        </h4>
                        <p className="text-xs text-muted-foreground">Reference assignments will be displayed here</p>
                      </div>
                    )}

                    {/* Uploaded Files Section */}
                    {session.uploaded_files && session.uploaded_files.length > 0 ? (
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                          <Upload className="h-4 w-4" />
                          Uploaded Files ({session.uploaded_files.length})
                        </h4>
                        <div className="space-y-2">
                          {session.uploaded_files.map((fileUrl: string, idx: number) => {
                            // Extract filename from URL (last part before extension)
                            const urlParts = fileUrl.split('/');
                            const fileNameWithExt = urlParts[urlParts.length - 1].split('?')[0];
                            const isPDF = fileUrl.toLowerCase().includes('.pdf');
                            const isImage = fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                            
                            // Get file extension and create clean display name
                            const extension = fileNameWithExt.split('.').pop()?.toUpperCase() || 'FILE';
                            const displayName = fileNameWithExt.length > 25 
                              ? fileNameWithExt.substring(0, 22) + '...' 
                              : fileNameWithExt;
                            
                            return (
                              <button
                                key={idx}
                                onClick={() => addFileToWhiteboard(fileUrl, fileNameWithExt)}
                                className="w-full p-3 rounded-lg border border-border hover:border-primary bg-card hover:bg-muted transition-all cursor-pointer group"
                                title={`Click to add ${fileNameWithExt} to whiteboard`}
                              >
                                <div className="flex items-center gap-3">
                                  {/* Thumbnail */}
                                  <div className="w-16 h-16 rounded bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                                  
                                  {/* File info */}
                                  <div className="flex-1 text-left overflow-hidden">
                                    <p className="text-sm font-medium text-muted-foreground group-hover:text-primary truncate">
                                      {displayName}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {extension} file
                                    </p>
                                  </div>
                                  
                                  {/* Add icon */}
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
          className="absolute right-0 top-1/2 -translate-y-1/2 bg-card border border-border rounded-l-lg p-2 hover:bg-secondary transition-colors z-10"
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
