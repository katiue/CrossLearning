from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Integer, Text
from sqlalchemy.orm import relationship
from ..config.db import Base
import uuid
from datetime import datetime


class TeachSession(Base):
    """Model for storing teach-to-learn sessions where students teach the AI"""
    __tablename__ = "teach_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    
    # Session metadata
    status = Column(String, default="active")  # active, completed, paused
    duration_minutes = Column(Integer, default=0)
    
    # AI feedback and evaluation
    ai_summary = Column(Text, nullable=True)
    clarity_score = Column(Integer, nullable=True)  # 0-100
    completeness_score = Column(Integer, nullable=True)  # 0-100
    feedback = Column(Text, nullable=True)
    
    # Reference materials
    reference_note_ids = Column(JSON, default=list)  # List of note IDs used as reference
    reference_assignment_ids = Column(JSON, default=list)  # List of assignment IDs used
    uploaded_files = Column(JSON, default=list)  # List of uploaded file URLs
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    student = relationship("User", backref="teach_sessions")
    messages = relationship("TeachSessionMessage", back_populates="session", cascade="all, delete-orphan")
    whiteboard_data = relationship("WhiteboardData", back_populates="session", cascade="all, delete-orphan")


class TeachSessionMessage(Base):
    """Model for storing conversation messages in teach sessions"""
    __tablename__ = "teach_session_messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("teach_sessions.id", ondelete="CASCADE"), nullable=False)
    
    role = Column(String, nullable=False)  # "student" or "ai"
    content = Column(Text, nullable=False)
    message_type = Column(String, default="text")  # text, audio, drawing_reference
    
    # Audio-specific fields
    audio_duration = Column(Integer, nullable=True)  # in seconds
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    session = relationship("TeachSession", back_populates="messages")


class WhiteboardData(Base):
    """Model for storing whiteboard/drawing data from teach sessions"""
    __tablename__ = "whiteboard_data"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("teach_sessions.id", ondelete="CASCADE"), nullable=False)
    
    # Drawing data in JSON format (compatible with tldraw or similar)
    drawing_data = Column(JSON, nullable=False)
    snapshot_url = Column(String, nullable=True)  # Optional image snapshot URL
    description = Column(Text, nullable=True)  # AI-generated description of the drawing
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    session = relationship("TeachSession", back_populates="whiteboard_data")
