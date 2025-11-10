from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# Base schemas for peer learning sessions
class PeerLearningSessionBase(BaseModel):
    title: str = Field(..., description="Session title")
    topic: str = Field(..., description="Topic being taught")
    description: Optional[str] = Field(None, description="Session description")
    max_students: int = Field(default=5, description="Maximum number of students")
    scheduled_at: Optional[datetime] = Field(None, description="Scheduled start time")


class PeerLearningSessionCreate(BaseModel):
    title: str = Field(..., description="Session title")
    topic: str = Field(..., description="Topic to teach")
    description: Optional[str] = Field(None, description="Session description")
    max_students: int = Field(default=5, description="Maximum students (1-10)")
    scheduled_at: Optional[datetime] = Field(None, description="When to start (optional)")


class PeerLearningSessionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    max_students: Optional[int] = None
    scheduled_at: Optional[datetime] = None


class PeerLearningSessionResponse(PeerLearningSessionBase):
    id: str
    teacher_user_id: str
    teacher_name: Optional[str] = None
    teacher_best_score: Optional[int] = None
    status: str
    average_rating: float
    total_ratings: int
    upvotes: int
    coins_earned: int
    enrolled_student_ids: List[str]
    enrolled_count: int = 0
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Schema for peer session messages
class PeerMessageBase(BaseModel):
    content: str = Field(..., description="Message content")
    message_type: str = Field(default="text", description="Type: text, audio, drawing_reference")
    audio_duration: Optional[int] = Field(None, description="Audio duration in seconds")


class PeerMessageCreate(PeerMessageBase):
    whiteboard_image: Optional[str] = Field(None, description="Base64 encoded whiteboard image")


class PeerMessageResponse(PeerMessageBase):
    id: str
    peer_session_id: str
    sender_id: str
    sender_name: Optional[str] = None
    sender_role: str
    created_at: datetime

    class Config:
        from_attributes = True


# Schema for enrolling in a session
class EnrollRequest(BaseModel):
    peer_session_id: str = Field(..., description="ID of the peer session to join")


class EnrollResponse(BaseModel):
    message: str
    peer_session_id: str
    student_id: str


# Schema for rating a session
class RatingCreate(BaseModel):
    peer_session_id: str = Field(..., description="Session ID")
    rating: int = Field(..., ge=1, le=5, description="Rating 1-5 stars")
    feedback: Optional[str] = Field(None, description="Optional written feedback")
    upvoted: bool = Field(default=False, description="Whether the student upvoted")


class RatingResponse(BaseModel):
    id: str
    peer_session_id: str
    student_id: str
    rating: int
    feedback: Optional[str]
    upvoted: int
    created_at: datetime

    class Config:
        from_attributes = True


# Schema for chat in peer sessions
class PeerChatResponse(BaseModel):
    message_id: str
    peer_session_id: str


# Schema for session statistics
class PeerSessionStats(BaseModel):
    total_sessions_taught: int
    total_coins_earned: int
    average_rating: float
    total_students_taught: int


# Schemas for whiteboard data
class PeerWhiteboardDataCreate(BaseModel):
    drawing_data: dict = Field(..., description="Excalidraw drawing data in JSON format")
    snapshot_url: Optional[str] = Field(None, description="Optional snapshot URL")
    description: Optional[str] = Field(None, description="Optional description")


class PeerWhiteboardDataResponse(BaseModel):
    id: str
    peer_session_id: str
    drawing_data: dict
    snapshot_url: Optional[str]
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
