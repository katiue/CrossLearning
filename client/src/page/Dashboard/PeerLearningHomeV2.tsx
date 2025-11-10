import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  Star,
  ThumbsUp,
  Coins,
  BookOpen,
  Award,
  Clock,
  Plus,
  Video,
  MessageSquare,
} from "lucide-react";
import { axiosClient } from "@/helper/axiosClient";
import { toast } from "react-toastify";
import type { PeerLearningSession } from "@/types/peerLearning";
import type { TeachSession } from "@/types/teachSession";

export default function PeerLearningHomeV2() {
  const navigate = useNavigate();
  const [availableSessions, setAvailableSessions] = useState<PeerLearningSession[]>([]);
  const [myTeachingSessions, setMyTeachingSessions] = useState<PeerLearningSession[]>([]);
  const [isQualified, setIsQualified] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const [activeTab, setActiveTab] = useState<"browse" | "teach">("browse");
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    topic: "",
    description: "",
    max_students: 5,
  });

  useEffect(() => {
    fetchAvailableSessions();
    fetchMyTeachingSessions();
    checkQualification();
  }, []);

  const checkQualification = async () => {
    try {
      // Get all teach sessions
      const response = await axiosClient.get<TeachSession[]>("/teach-sessions/sessions");
      
      // Find best score
      let highestScore = 0;
      response.data.forEach((session) => {
        if (session.clarity_score && session.completeness_score && session.status === "completed") {
          const avgScore = (session.clarity_score + session.completeness_score) / 2;
          if (avgScore > highestScore) {
            highestScore = avgScore;
          }
        }
      });
      
      setBestScore(highestScore);
      setIsQualified(highestScore >= 80);
    } catch (error) {
      console.error("Failed to check qualification:", error);
    }
  };

  const fetchAvailableSessions = async () => {
    try {
      // Fetch both waiting and active sessions (don't filter by status)
      const response = await axiosClient.get<PeerLearningSession[]>("/peer-learning/sessions");
      // Filter out completed sessions on the client side
      const availableSessions = response.data.filter(
        (session) => session.status === "waiting" || session.status === "active"
      );
      setAvailableSessions(availableSessions);
    } catch (error) {
      console.error("Failed to fetch peer sessions:", error);
    }
  };

  const fetchMyTeachingSessions = async () => {
    try {
      const response = await axiosClient.get<PeerLearningSession[]>(
        "/peer-learning/sessions/my-teachings"
      );
      setMyTeachingSessions(response.data);
    } catch (error) {
      console.error("Failed to fetch my teaching sessions:", error);
    }
  };

  const createPeerSession = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.topic) {
      toast.error("Please fill in title and topic");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axiosClient.post<PeerLearningSession>(
        "/peer-learning/sessions",
        formData
      );
      toast.success("Peer learning session created! Waiting for students to join...");
      setShowCreateForm(false);
      setFormData({ title: "", topic: "", description: "", max_students: 5 });
      fetchMyTeachingSessions();
      navigate(`/dashboard-panel/peer-learning/${response.data.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to create peer session");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const enrollInSession = async (sessionId: string) => {
    setIsLoading(true);
    try {
      await axiosClient.post(`/peer-learning/sessions/${sessionId}/enroll`);
      toast.success("Successfully enrolled! Join the session to start learning");
      fetchAvailableSessions();
      navigate(`/dashboard-panel/peer-learning/${sessionId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to enroll");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting":
        return "bg-secondary";
      case "active":
        return "bg-primary";
      case "completed":
        return "bg-muted";
      default:
        return "bg-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "waiting":
        return <Clock className="h-4 w-4" />;
      case "active":
        return <Video className="h-4 w-4" />;
      case "completed":
        return <Award className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen p-6 bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-secondary mb-2 flex items-center gap-3">
            <Users className="h-10 w-10" />
            Peer Learning - Live Sessions
          </h1>
          <p className="text-muted-foreground text-lg">
            Learn through live voice/chat sessions with students who scored 80%+ in teach-to-learn
          </p>
        </div>

        {/* Qualification Banner */}
        {isQualified && (
          <Card className="mb-6 bg-gradient-to-r from-[color-mix(in_srgb,var(--primary)_30%,transparent)] to-[color-mix(in_srgb,var(--primary)_30%,transparent)] border-primary">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Award className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-white font-semibold">You're Qualified to Teach!</p>
                  <p className="text-sm text-muted-foreground">
                    Best score: {bestScore.toFixed(0)}% - Create live teaching sessions and earn coins
                  </p>
                </div>
              </div>
              {activeTab !== "teach" && (
                <Button
                  onClick={() => setActiveTab("teach")}
                  className="bg-primary hover:bg-[color-mix(in_srgb,var(--primary)_90%,var(--background))]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Session
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab("browse")}
            className={`px-6 py-3 text-lg font-semibold transition-colors ${
              activeTab === "browse"
                ? "text-secondary border-b-2 border-secondary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Browse Sessions
          </button>
          <button
            onClick={() => setActiveTab("teach")}
            className={`px-6 py-3 text-lg font-semibold transition-colors ${
              activeTab === "teach"
                ? "text-secondary border-b-2 border-secondary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My Teaching
          </button>
        </div>

        {/* Browse Sessions Tab */}
        {activeTab === "browse" && (
          <div>
            {availableSessions.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Users className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-xl text-muted-foreground mb-2">No live sessions available</h3>
                  <p className="text-muted-foreground">Check back later or create your own if qualified!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableSessions.map((session) => (
                  <Card
                    key={session.id}
                    className="bg-card border-border hover:border-secondary transition-all"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <CardTitle className="text-lg text-white line-clamp-2">
                          {session.title}
                        </CardTitle>
                        <Badge className={`${getStatusColor(session.status)} text-white capitalize flex items-center gap-1`}>
                          {getStatusIcon(session.status)}
                          {session.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">by {session.teacher_name}</p>
                      <p className="text-sm text-secondary font-semibold">{session.topic}</p>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Teacher Stats */}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {session.teacher_best_score && (
                          <div className="flex items-center gap-1 text-primary">
                            <Award className="h-4 w-4" />
                            <span>{session.teacher_best_score}%</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-secondary">
                          <Star className="h-4 w-4 fill-secondary" />
                          <span>{session.average_rating.toFixed(1)} ({session.total_ratings})</span>
                        </div>
                        <div className="flex items-center gap-1 text-primary">
                          <ThumbsUp className="h-4 w-4" />
                          <span>{session.upvotes} upvotes</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>
                            {session.enrolled_count}/{session.max_students}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      {session.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{session.description}</p>
                      )}

                      {/* Action Button */}
                      <Button
                        className="w-full"
                        onClick={() => enrollInSession(session.id)}
                        disabled={
                          isLoading ||
                          session.enrolled_count >= session.max_students ||
                          !["waiting", "active"].includes(session.status)
                        }
                      >
                        {session.enrolled_count >= session.max_students
                          ? "Session Full"
                          : session.status === "active"
                          ? "Join Active Session"
                          : "Enroll & Learn"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Teaching Tab */}
        {activeTab === "teach" && (
          <div className="space-y-6">
            {/* Create Session Form */}
            {isQualified && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Plus className="h-6 w-6 text-primary" />
                    Create New Live Teaching Session
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!showCreateForm ? (
                    <Button
                      onClick={() => setShowCreateForm(true)}
                      className="w-full bg-primary hover:bg-[color-mix(in_srgb,var(--primary)_90%,var(--background))]"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      New Session
                    </Button>
                  ) : (
                    <form onSubmit={createPeerSession} className="space-y-4">
                      <div>
                        <label className="text-sm text-muted-foreground mb-1 block">Session Title *</label>
                        <Input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder="e.g., Advanced React Patterns"
                          className="bg-card border-border text-foreground"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm text-muted-foreground mb-1 block">Topic *</label>
                        <Input
                          type="text"
                          value={formData.topic}
                          onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                          placeholder="e.g., React, Python, Data Structures"
                          className="bg-card border-border text-foreground"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm text-muted-foreground mb-1 block">Description</label>
                        <Textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="What will you teach in this live session?"
                          className="bg-card border-border text-foreground"
                          rows={3}
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm text-muted-foreground mb-1 block">Max Students (1-10)</label>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          value={formData.max_students}
                          onChange={(e) => setFormData({ ...formData, max_students: parseInt(e.target.value) || 5 })}
                          className="bg-card border-border text-foreground"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          disabled={isLoading}
                          className="flex-1 bg-primary hover:bg-[color-mix(in_srgb,var(--primary)_90%,var(--background))]"
                        >
                          {isLoading ? "Creating..." : "Create Session"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowCreateForm(false);
                            setFormData({ title: "", topic: "", description: "", max_students: 5 });
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            )}

            {!isQualified && (
              <Card className="bg-card border-border">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Award className="h-12 w-12 text-muted-foreground mb-3" />
                  <h3 className="text-xl text-white mb-2">Not Qualified Yet</h3>
                  <p className="text-muted-foreground text-center">
                    Complete a teach-to-learn session with 80%+ score to start teaching others!
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your best score: {bestScore.toFixed(0)}%
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Active Teaching Sessions */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-secondary" />
                My Teaching Sessions
              </h2>
              {myTeachingSessions.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Video className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">
                      No teaching sessions yet. Create one to start teaching!
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myTeachingSessions.map((session) => (
                    <Card
                      key={session.id}
                      className="bg-card border-border hover:border-secondary transition-all cursor-pointer"
                      onClick={() => navigate(`/dashboard-panel/peer-learning/${session.id}`)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between mb-2">
                          <CardTitle className="text-lg text-white line-clamp-2">
                            {session.title}
                          </CardTitle>
                          <Badge className={`${getStatusColor(session.status)} text-white flex items-center gap-1`}>
                            {getStatusIcon(session.status)}
                            {session.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-secondary font-semibold">{session.topic}</p>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-1 text-secondary">
                            <Coins className="h-4 w-4" />
                            <span>{session.coins_earned} coins</span>
                          </div>
                          <div className="flex items-center gap-1 text-primary">
                            <Users className="h-4 w-4" />
                            <span>{session.enrolled_count} students</span>
                          </div>
                          <div className="flex items-center gap-1 text-secondary">
                            <Star className="h-4 w-4 fill-secondary" />
                            <span>{session.average_rating.toFixed(1)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-primary">
                            <ThumbsUp className="h-4 w-4" />
                            <span>{session.upvotes}</span>
                          </div>
                        </div>

                        <Button className="w-full" variant="outline">
                          <Clock className="mr-2 h-4 w-4" />
                          {session.status === "waiting" ? "Manage Session" : "View Session"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
