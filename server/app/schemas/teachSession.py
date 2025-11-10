from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# Base schemas for messages
class MessageBase(BaseModel):
    role: str = Field(..., description="Role: 'student' or 'ai'")
    content: str = Field(..., description="Message content")
    message_type: str = Field(default="text", description="Type: text, audio, drawing_reference")
    audio_duration: Optional[int] = Field(None, description="Audio duration in seconds")


class MessageCreate(MessageBase):
    pass


class MessageResponse(MessageBase):
    id: str
    session_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# Base schemas for whiteboard
class WhiteboardDataBase(BaseModel):
    drawing_data: dict = Field(..., description="Drawing data in JSON format")
    snapshot_url: Optional[str] = Field(None, description="Optional image snapshot URL")
    description: Optional[str] = Field(None, description="AI-generated description")


class WhiteboardDataCreate(WhiteboardDataBase):
    pass


class WhiteboardDataResponse(WhiteboardDataBase):
    id: str
    session_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Base schemas for teach sessions
class TeachSessionBase(BaseModel):
    title: str = Field(..., description="Session title")
    topic: str = Field(..., description="Topic being taught")


class TeachSessionCreate(TeachSessionBase):
    reference_note_ids: Optional[List[str]] = Field(default=[], description="Reference note IDs")
    reference_assignment_ids: Optional[List[str]] = Field(default=[], description="Reference assignment IDs")
    uploaded_files: Optional[List[str]] = Field(default=[], description="Uploaded file URLs")


class TeachSessionUpdate(BaseModel):
    title: Optional[str] = None
    topic: Optional[str] = None
    status: Optional[str] = None
    duration_minutes: Optional[int] = None
    reference_note_ids: Optional[List[str]] = None
    reference_assignment_ids: Optional[List[str]] = None
    uploaded_files: Optional[List[str]] = None


class TeachSessionResponse(TeachSessionBase):
    id: str
    student_id: str
    status: str
    duration_minutes: int
    ai_summary: Optional[str]
    clarity_score: Optional[int]
    completeness_score: Optional[int]
    feedback: Optional[str]
    reference_note_ids: List[str]
    reference_assignment_ids: List[str]
    uploaded_files: List[str]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    messages: Optional[List[MessageResponse]] = None
    whiteboard_data: Optional[List[WhiteboardDataResponse]] = None

    class Config:
        from_attributes = True


# Schema for chat interactions
class ChatRequest(BaseModel):
    message: str = Field(..., description="Student's teaching message")
    message_type: str = Field(default="text", description="Type: text, audio, drawing_reference")
    audio_duration: Optional[int] = Field(None, description="Audio duration in seconds")
    whiteboard_image: Optional[str] = Field(None, description="Base64 encoded whiteboard image")


class ChatResponse(BaseModel):
    ai_message: str = Field(..., description="AI student's response")
    message_id: str = Field(..., description="ID of the saved message")
    session_id: str = Field(..., description="Session ID")


# Schema for session completion and evaluation
class SessionEvaluationRequest(BaseModel):
    session_id: str = Field(..., description="Session ID to evaluate")
    whiteboard_image: Optional[str] = Field(None, description="Base64 encoded final whiteboard image")


class SessionEvaluationResponse(BaseModel):
    session_id: str
    ai_summary: str = Field(..., description="Summary of what AI learned")
    clarity_score: int = Field(..., ge=0, le=100, description="Teaching clarity score 0-100")
    completeness_score: int = Field(..., ge=0, le=100, description="Concept completeness score 0-100")
    feedback: str = Field(..., description="Detailed feedback on teaching")
    areas_for_improvement: List[str] = Field(..., description="Specific areas to improve")

    class Config:
        from_attributes = True


# Schema for file upload
class FileUploadResponse(BaseModel):
    file_url: str = Field(..., description="URL of uploaded file")
    file_name: str = Field(..., description="Name of uploaded file")
