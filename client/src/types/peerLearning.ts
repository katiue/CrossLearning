export interface PeerLearningSession {
  id: string;
  teacher_user_id: string;
  teacher_name?: string;
  teacher_best_score?: number;
  title: string;
  topic: string;
  description?: string;
  status: "waiting" | "active" | "completed" | "cancelled";
  max_students: number;
  average_rating: number;
  total_ratings: number;
  upvotes: number;
  coins_earned: number;
  enrolled_student_ids: string[];
  enrolled_count: number;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  reference_note_ids?: string[];
  reference_assignment_ids?: string[];
  uploaded_files?: string[];
}

export interface PeerSessionMessage {
  id: string;
  peer_session_id: string;
  sender_id: string;
  sender_name?: string;
  sender_role: "teacher" | "student";
  content: string;
  message_type: "text" | "audio" | "drawing_reference";
  audio_duration?: number;
  created_at: string;
}

export interface CreatePeerSessionRequest {
  title: string;
  topic: string;
  description?: string;
  max_students?: number;
  scheduled_at?: string;
}

export interface PeerMessageRequest {
  content: string;
  message_type?: "text" | "audio" | "drawing_reference";
  audio_duration?: number;
  whiteboard_image?: string;
}

export interface EnrollRequest {
  peer_session_id: string;
}

export interface EnrollResponse {
  message: string;
  peer_session_id: string;
  student_id: string;
}

export interface RatingRequest {
  peer_session_id: string;
  rating: number; // 1-5
  feedback?: string;
  upvoted: boolean;
}

export interface RatingResponse {
  id: string;
  peer_session_id: string;
  student_id: string;
  rating: number;
  feedback?: string;
  upvoted: number;
  created_at: string;
}

export interface PeerChatResponse {
  message_id: string;
  peer_session_id: string;
}

export interface PeerSessionStats {
  total_sessions_taught: number;
  total_coins_earned: number;
  average_rating: number;
  total_students_taught: number;
}
