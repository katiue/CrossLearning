export interface TeachSession {
  id: string;
  student_id: string;
  title: string;
  topic: string;
  status: "active" | "completed" | "paused";
  duration_minutes: number;
  ai_summary: string | null;
  clarity_score: number | null;
  completeness_score: number | null;
  feedback: string | null;
  reference_note_ids: string[];
  reference_assignment_ids: string[];
  uploaded_files: string[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  messages?: TeachSessionMessage[];
  whiteboard_data?: WhiteboardData[];
}

export interface TeachSessionMessage {
  id: string;
  session_id: string;
  role: "student" | "ai";
  content: string;
  message_type: "text" | "audio" | "drawing_reference";
  audio_duration?: number;
  created_at: string;
}

export interface WhiteboardData {
  id: string;
  session_id: string;
  drawing_data: any;
  snapshot_url?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTeachSessionRequest {
  title: string;
  topic: string;
  reference_note_ids?: string[];
  reference_assignment_ids?: string[];
  uploaded_files?: string[];
}

export interface ChatRequest {
  message: string;
  message_type?: "text" | "audio" | "drawing_reference";
  audio_duration?: number;
  whiteboard_image?: string; // Base64 encoded image
}

export interface ChatResponse {
  ai_message: string;
  message_id: string;
  session_id: string;
}

export interface SessionEvaluation {
  session_id: string;
  ai_summary: string;
  clarity_score: number;
  completeness_score: number;
  feedback: string;
  areas_for_improvement: string[];
}

export interface FileUploadResponse {
  file_url: string;
  file_name: string;
}
