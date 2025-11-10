from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Integer, Text, Float
from sqlalchemy.orm import relationship
from ..config.db import Base
import uuid
from datetime import datetime


class PeerLearningSession(Base):
    """Model for peer-learning sessions where students teach each other in real-time"""
    __tablename__ = "peer_learning_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # The student who will be teaching (must have achieved >80% in any teach session)
    teacher_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    # Session details
    title = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="waiting")  # waiting, active, completed, cancelled
    max_students = Column(Integer, default=5)  # Maximum number of students who can join (smaller groups for better interaction)
    
    # Teacher's qualification (from their best teach session)
    teacher_best_score = Column(Integer, nullable=True)  # Their highest teach score
    
    # Ratings and feedback
    average_rating = Column(Float, default=0.0)  # Average rating from students (0-5 stars)
    total_ratings = Column(Integer, default=0)
    upvotes = Column(Integer, default=0)
    
    # Rewards
    coins_earned = Column(Integer, default=0)  # Coins earned by the teacher from this session
    
    # Enrollment tracking
    enrolled_student_ids = Column(JSON, default=list)  # List of student IDs who joined
    
    # Timing
    scheduled_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    teacher = relationship("User", foreign_keys=[teacher_user_id], backref="peer_sessions_taught")
    messages = relationship("PeerSessionMessage", back_populates="peer_session", cascade="all, delete-orphan")
    ratings = relationship("PeerSessionRating", back_populates="peer_session", cascade="all, delete-orphan")
    whiteboard_data = relationship("PeerWhiteboardData", back_populates="peer_session", cascade="all, delete-orphan")


class PeerSessionMessage(Base):
    """Model for storing conversation messages in peer learning sessions"""
    __tablename__ = "peer_session_messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    peer_session_id = Column(String, ForeignKey("peer_learning_sessions.id", ondelete="CASCADE"), nullable=False)
    
    # Sender information
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    sender_role = Column(String, nullable=False)  # "teacher" or "student"
    
    content = Column(Text, nullable=False)
    message_type = Column(String, default="text")  # text, audio, drawing_reference
    
    # Audio-specific fields
    audio_duration = Column(Integer, nullable=True)  # in seconds
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    peer_session = relationship("PeerLearningSession", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])


class PeerSessionRating(Base):
    """Model for storing ratings and feedback for peer learning sessions"""
    __tablename__ = "peer_session_ratings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    peer_session_id = Column(String, ForeignKey("peer_learning_sessions.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    # Rating (1-5 stars)
    rating = Column(Integer, nullable=False)  # 1-5
    
    # Optional feedback
    feedback = Column(Text, nullable=True)
    
    # Upvote
    upvoted = Column(Integer, default=0)  # 0 or 1
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    peer_session = relationship("PeerLearningSession", back_populates="ratings")
    student = relationship("User", foreign_keys=[student_id])


class PeerWhiteboardData(Base):
    """Model for storing whiteboard/drawing data from peer learning sessions"""
    __tablename__ = "peer_whiteboard_data"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    peer_session_id = Column(String, ForeignKey("peer_learning_sessions.id", ondelete="CASCADE"), nullable=False)
    
    # Drawing data in JSON format (compatible with Excalidraw)
    drawing_data = Column(JSON, nullable=False)
    snapshot_url = Column(String, nullable=True)  # Optional image snapshot URL
    description = Column(Text, nullable=True)  # Optional description of the drawing
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    peer_session = relationship("PeerLearningSession", back_populates="whiteboard_data")
