import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, BookOpen, Clock, BarChart, Trash2, Eye } from "lucide-react";
import { axiosClient } from "@/helper/axiosClient";
import { toast } from "react-toastify";
import type { TeachSession, CreateTeachSessionRequest } from "@/types/teachSession";
import type { NoteState } from "@/types/note";
import type { IAssignment } from "@/types/assignment";

export default function TeachToLearnHome() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<TeachSession[]>([]);
  const [notes, setNotes] = useState<NoteState[]>([]);
  const [assignments, setAssignments] = useState<IAssignment[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);

  useEffect(() => {
    fetchSessions();
    fetchNotes();
    fetchAssignments();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await axiosClient.get<TeachSession[]>("/teach-sessions/sessions");
      setSessions(response.data);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    }
  };

  const fetchNotes = async () => {
    try {
      const response = await axiosClient.get<NoteState[]>("/notes/get-notes");
      setNotes(response.data);
    } catch (error) {
      console.error("Failed to fetch notes:", error);
    }
  };

  const fetchAssignments = async () => {
    try {
      const response = await axiosClient.get<IAssignment[]>("/assignments/get-all-assignments");
      setAssignments(response.data);
    } catch (error) {
      console.error("Failed to fetch assignments:", error);
    }
  };

  const createSession = async () => {
    if (!title.trim() || !topic.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    try {
      const sessionData: CreateTeachSessionRequest = {
        title: title.trim(),
        topic: topic.trim(),
        reference_note_ids: selectedNotes,
        reference_assignment_ids: selectedAssignments,
      };

      const response = await axiosClient.post<TeachSession>(
        "/teach-sessions/sessions",
        sessionData
      );

      toast.success("Session created successfully!");
      setIsCreateDialogOpen(false);
      resetForm();
      navigate(`/dashboard-panel/teach-sessions/${response.data.id}`);
    } catch (error: any) {
      toast.error("Failed to create session");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to delete this session?")) return;

    try {
      await axiosClient.delete(`/teach-sessions/sessions/${sessionId}`);
      toast.success("Session deleted");
      fetchSessions();
    } catch (error) {
      toast.error("Failed to delete session");
      console.error(error);
    }
  };

  const resetForm = () => {
    setTitle("");
    setTopic("");
    setSelectedNotes([]);
    setSelectedAssignments([]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-primary";
      case "completed":
        return "text-primary";
      case "paused":
        return "text-secondary";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Teach-to-Learn Mode</h1>
            <p className="text-muted-foreground">
              Reinforce your understanding by teaching the AI student
            </p>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary text-foreground">
                <Plus className="mr-2 h-4 w-4" />
                New Teaching Session
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl">Create New Teaching Session</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Start a new session where you'll teach the AI about a topic
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm text-foreground mb-2 block">
                    Session Title *
                  </label>
                  <Input
                    placeholder="e.g., Teaching Quantum Physics Basics"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-card border-border text-foreground"
                  />
                </div>

                <div>
                  <label className="text-sm text-foreground mb-2 block">Topic *</label>
                  <Input
                    placeholder="e.g., Quantum Superposition"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="bg-card border-border text-foreground"
                  />
                </div>

                <div>
                  <label className="text-sm text-foreground mb-2 block">
                    Reference Notes (Optional)
                  </label>
                  <Select
                    value={selectedNotes[selectedNotes.length - 1] || ""}
                    onValueChange={(value) => {
                      if (!selectedNotes.includes(value)) {
                        setSelectedNotes([...selectedNotes, value]);
                      }
                    }}
                  >
                    <SelectTrigger className="bg-card border-border text-foreground">
                      <SelectValue placeholder="Select notes to reference" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {notes.map((note) => (
                        <SelectItem key={note.id} value={note.id}>
                          {note.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedNotes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedNotes.map((noteId) => {
                        const note = notes.find((n) => n.id === noteId);
                        return note ? (
                          <span
                            key={noteId}
                            className="px-2 py-1 bg-primary text-xs rounded-full flex items-center gap-1"
                          >
                            {note.title}
                            <button
                              onClick={() =>
                                setSelectedNotes(selectedNotes.filter((id) => id !== noteId))
                              }
                              className="ml-1 hover:text-destructive"
                            >
                              ×
                            </button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm text-foreground mb-2 block">
                    Reference Assignments (Optional)
                  </label>
                  <Select
                    value={selectedAssignments[selectedAssignments.length - 1] || ""}
                    onValueChange={(value) => {
                      if (!selectedAssignments.includes(value)) {
                        setSelectedAssignments([...selectedAssignments, value]);
                      }
                    }}
                  >
                    <SelectTrigger className="bg-card border-border text-foreground">
                      <SelectValue placeholder="Select assignments to reference" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {assignments.map((assignment) => (
                        <SelectItem key={assignment.id} value={assignment.id}>
                          {assignment.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedAssignments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedAssignments.map((assignmentId) => {
                        const assignment = assignments.find((a) => a.id === assignmentId);
                        return assignment ? (
                          <span
                            key={assignmentId}
                            className="px-2 py-1 bg-primary text-xs rounded-full flex items-center gap-1"
                          >
                            {assignment.title}
                            <button
                              onClick={() =>
                                setSelectedAssignments(
                                  selectedAssignments.filter((id) => id !== assignmentId)
                                )
                              }
                              className="ml-1 hover:text-destructive"
                            >
                              ×
                            </button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={createSession}
                    disabled={isLoading || !title.trim() || !topic.trim()}
                    className="bg-primary hover:bg-primary text-foreground"
                  >
                    {isLoading ? "Creating..." : "Create Session"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Sessions Grid */}
        {sessions.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl text-muted-foreground mb-2">No teaching sessions yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first session to start teaching the AI
              </p>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-primary hover:bg-primary text-foreground"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create First Session
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className="bg-card border-border hover:border-secondary transition-colors cursor-pointer"
              >
                <CardHeader>
                  <CardTitle className="text-lg text-foreground flex items-start justify-between">
                    <span className="line-clamp-2">{session.title}</span>
                    <span className={`text-xs ${getStatusColor(session.status)} capitalize`}>
                      {session.status}
                    </span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground line-clamp-1">Topic: {session.topic}</p>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{session.duration_minutes || 0} min</span>
                    </div>
                    
                    {session.clarity_score !== null && (
                      <div className="flex items-center gap-1">
                        <BarChart className="h-4 w-4" />
                        <span>{session.clarity_score}/100</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/dashboard-panel/teach-sessions/${session.id}`)}
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      {session.status === "completed" ? "View" : "Continue"}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
