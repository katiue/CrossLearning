from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import func, and_
from typing import List
from datetime import datetime, timezone

from app.models.auth import User
from app.models.teachSession import TeachSession
from app.models.peerLearning import PeerLearningSession, PeerSessionMessage, PeerSessionRating, PeerWhiteboardData
from app.schemas.peerLearning import (
    PeerLearningSessionCreate,
    PeerLearningSessionResponse,
    PeerLearningSessionUpdate,
    PeerMessageCreate,
    PeerMessageResponse,
    EnrollRequest,
    EnrollResponse,
    RatingCreate,
    RatingResponse,
    PeerChatResponse,
    PeerSessionStats,
    PeerWhiteboardDataCreate,
    PeerWhiteboardDataResponse
)
from app.dependencies.dependencies import get_current_user
from app.config.db import get_db

router = APIRouter()

# Minimum score required to create a peer learning session (80%)
MIN_SCORE_THRESHOLD = 80
COINS_PER_STUDENT = 10  # Coins earned per student enrolled


@router.post("/sessions", response_model=PeerLearningSessionResponse)
async def create_peer_learning_session(
    session_data: PeerLearningSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new peer learning session as a qualified teacher (requires 80%+ in any teach session)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Check if user has ANY teach session with 80%+ average score
    user_sessions = db.query(TeachSession).filter(
        TeachSession.student_id == current_user.id,
        TeachSession.status == "completed"
    ).all()
    
    # Find the best score
    best_score = 0
    for session in user_sessions:
        if session.clarity_score and session.completeness_score:
            avg_score = (session.clarity_score + session.completeness_score) / 2
            if avg_score > best_score:
                best_score = avg_score
    
    if best_score < MIN_SCORE_THRESHOLD:
        raise HTTPException(
            status_code=400,
            detail=f"You need at least one teach session with {MIN_SCORE_THRESHOLD}%+ score to create a peer learning session. Your best score: {best_score:.1f}%"
        )
    
    # Validate max_students
    if session_data.max_students < 1 or session_data.max_students > 10:
        raise HTTPException(status_code=400, detail="Max students must be between 1 and 10")
    
    # Create the peer learning session
    new_peer_session = PeerLearningSession(
        teacher_user_id=current_user.id,
        title=session_data.title,
        topic=session_data.topic,
        description=session_data.description,
        max_students=session_data.max_students,
        scheduled_at=session_data.scheduled_at,
        teacher_best_score=int(best_score),
        status="waiting"  # Waiting for students to join
    )
    
    db.add(new_peer_session)
    db.commit()
    db.refresh(new_peer_session)
    
    # Prepare response
    response = PeerLearningSessionResponse(
        **new_peer_session.__dict__,
        teacher_name=current_user.full_name,
        enrolled_count=len(new_peer_session.enrolled_student_ids)
    )
    
    return response


@router.get("/sessions", response_model=List[PeerLearningSessionResponse])
async def get_available_peer_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: str = None,  # Changed from "waiting" to None to show all by default
    skip: int = 0,
    limit: int = 20
):
    """Get all available peer learning sessions (waiting for students or active)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"=== Fetching peer sessions for user: {current_user.email} ===")
    logger.info(f"Status filter: {status}")
    
    # Query peer sessions - exclude completed sessions by default
    query = db.query(PeerLearningSession).filter(
        PeerLearningSession.status.in_(["waiting", "active"])
    )
    
    # Allow additional filtering if status is specified
    if status:
        query = query.filter(PeerLearningSession.status == status)
    
    sessions = query.order_by(
        PeerLearningSession.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    logger.info(f"Found {len(sessions)} sessions")
    for s in sessions:
        logger.info(f"  - Session ID: {s.id}, Title: {s.title}, Teacher: {s.teacher_user_id}, Status: {s.status}")
    
    # Enrich with teacher info
    enriched_sessions = []
    for session in sessions:
        teacher = db.query(User).filter(User.id == session.teacher_user_id).first()
        
        response = PeerLearningSessionResponse(
            **session.__dict__,
            teacher_name=teacher.full_name if teacher else "Unknown",
            enrolled_count=len(session.enrolled_student_ids)
        )
        enriched_sessions.append(response)
    
    logger.info(f"Returning {len(enriched_sessions)} enriched sessions")
    return enriched_sessions


@router.get("/sessions/my-teachings", response_model=List[PeerLearningSessionResponse])
async def get_my_peer_teaching_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all peer sessions where current user is the teacher"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    sessions = db.query(PeerLearningSession).filter(
        PeerLearningSession.teacher_user_id == current_user.id
    ).order_by(PeerLearningSession.created_at.desc()).all()
    
    enriched_sessions = []
    for session in sessions:
        response = PeerLearningSessionResponse(
            **session.__dict__,
            teacher_name=current_user.full_name,
            enrolled_count=len(session.enrolled_student_ids)
        )
        enriched_sessions.append(response)
    
    return enriched_sessions


@router.get("/sessions/{session_id}", response_model=PeerLearningSessionResponse)
async def get_peer_session_by_id(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific peer learning session"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    session = db.query(PeerLearningSession).filter(
        PeerLearningSession.id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Peer session not found")
    
    teacher = db.query(User).filter(User.id == session.teacher_user_id).first()
    
    response = PeerLearningSessionResponse(
        **session.__dict__,
        teacher_name=teacher.full_name if teacher else "Unknown",
        enrolled_count=len(session.enrolled_student_ids)
    )
    
    return response


@router.post("/sessions/{session_id}/enroll", response_model=EnrollResponse)
async def enroll_in_peer_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Enroll in a peer learning session"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    session = db.query(PeerLearningSession).filter(
        PeerLearningSession.id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Peer session not found")
    
    # Check if session is accepting enrollments (waiting or active, not completed)
    if session.status not in ["waiting", "active"]:
        raise HTTPException(status_code=400, detail="Session is not accepting enrollments")
    
    # Check if user is the teacher
    if session.teacher_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot enroll in your own session")
    
    # Check if already enrolled
    if current_user.id in session.enrolled_student_ids:
        raise HTTPException(status_code=400, detail="You are already enrolled in this session")
    
    # Check if session is full
    if len(session.enrolled_student_ids) >= session.max_students:
        raise HTTPException(status_code=400, detail="Session is full")
    
    # Enroll the student
    session.enrolled_student_ids.append(current_user.id)
    flag_modified(session, "enrolled_student_ids")
    
    # Auto-start session when first student joins
    if len(session.enrolled_student_ids) == 1:
        session.status = "active"
        session.started_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(session)
    
    return EnrollResponse(
        message="Successfully enrolled in peer learning session",
        peer_session_id=session_id,
        student_id=current_user.id
    )


@router.post("/sessions/{session_id}/start")
async def start_peer_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually start a peer learning session (teacher only)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    session = db.query(PeerLearningSession).filter(
        PeerLearningSession.id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Peer session not found")
    
    # Only teacher can start the session
    if session.teacher_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the teacher can start this session")
    
    if session.status != "waiting":
        raise HTTPException(status_code=400, detail="Session is not in waiting state")
    
    if len(session.enrolled_student_ids) == 0:
        raise HTTPException(status_code=400, detail="No students enrolled yet")
    
    session.status = "active"
    session.started_at = datetime.now(timezone.utc)
    
    db.commit()
    
    return {
        "message": "Peer learning session started",
        "session_id": session_id,
        "status": "active",
        "enrolled_count": len(session.enrolled_student_ids)
    }


@router.post("/sessions/{session_id}/end")
async def end_peer_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """End a peer learning session and award coins (teacher only)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    session = db.query(PeerLearningSession).filter(
        PeerLearningSession.id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Peer session not found")
    
    # Only teacher can end the session
    if session.teacher_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the teacher can end this session")
    
    if session.status != "active":
        raise HTTPException(status_code=400, detail="Session is not currently active")
    
    session.status = "completed"
    session.ended_at = datetime.now(timezone.utc)
    
    # Award coins to teacher based on number of students taught
    num_students = len(session.enrolled_student_ids)
    coins_awarded = num_students * COINS_PER_STUDENT
    
    # Update teacher's coins in database
    teacher = db.query(User).filter(User.id == session.teacher_user_id).first()
    if teacher:
        teacher.coins = (teacher.coins or 0) + coins_awarded
    
    session.coins_earned = coins_awarded
    
    db.commit()
    
    return {
        "message": "Peer learning session completed",
        "session_id": session_id,
        "status": "completed",
        "students_taught": num_students,
        "coins_earned": coins_awarded
    }


@router.get("/sessions/{session_id}/messages", response_model=List[PeerMessageResponse])
async def get_peer_session_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all messages in a peer learning session"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    session = db.query(PeerLearningSession).filter(
        PeerLearningSession.id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Peer session not found")
    
    # Check if user is teacher or enrolled student
    if session.teacher_user_id != current_user.id and current_user.id not in session.enrolled_student_ids:
        raise HTTPException(status_code=403, detail="You are not a participant in this session")
    
    messages = db.query(PeerSessionMessage).filter(
        PeerSessionMessage.peer_session_id == session_id
    ).order_by(PeerSessionMessage.created_at).all()
    
    # Enrich with sender names
    enriched_messages = []
    for msg in messages:
        sender = db.query(User).filter(User.id == msg.sender_id).first()
        response = PeerMessageResponse(
            **msg.__dict__,
            sender_name=sender.full_name if sender else "Unknown"
        )
        enriched_messages.append(response)
    
    return enriched_messages


@router.post("/sessions/{session_id}/chat", response_model=PeerMessageResponse)
async def send_peer_message(
    session_id: str,
    message_data: PeerMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a message in a peer learning session"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    session = db.query(PeerLearningSession).filter(
        PeerLearningSession.id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Peer session not found")
    
    # Determine sender role
    if session.teacher_user_id == current_user.id:
        sender_role = "teacher"
    elif current_user.id in session.enrolled_student_ids:
        sender_role = "student"
    else:
        raise HTTPException(status_code=403, detail="You are not a participant in this session")
    
    # Create message
    new_message = PeerSessionMessage(
        peer_session_id=session_id,
        sender_id=current_user.id,
        sender_role=sender_role,
        content=message_data.content,
        message_type=message_data.message_type,
        audio_duration=message_data.audio_duration
    )
    
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    
    # Return full message with sender name
    return PeerMessageResponse(
        **new_message.__dict__,
        sender_name=current_user.full_name
    )


@router.post("/sessions/{session_id}/rate", response_model=RatingResponse)
async def rate_peer_session(
    session_id: str,
    rating_data: RatingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Rate and provide feedback for a peer learning session"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    session = db.query(PeerLearningSession).filter(
        PeerLearningSession.id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Peer session not found")
    
    # Check if user is enrolled
    if current_user.id not in session.enrolled_student_ids:
        raise HTTPException(status_code=403, detail="Only enrolled students can rate this session")
    
    # Check if user already rated this session
    existing_rating = db.query(PeerSessionRating).filter(
        and_(
            PeerSessionRating.peer_session_id == session_id,
            PeerSessionRating.student_id == current_user.id
        )
    ).first()
    
    if existing_rating:
        # Update existing rating
        existing_rating.rating = rating_data.rating
        existing_rating.feedback = rating_data.feedback
        existing_rating.upvoted = 1 if rating_data.upvoted else 0
        db.commit()
        db.refresh(existing_rating)
        new_rating = existing_rating
    else:
        # Create new rating
        new_rating = PeerSessionRating(
            peer_session_id=session_id,
            student_id=current_user.id,
            rating=rating_data.rating,
            feedback=rating_data.feedback,
            upvoted=1 if rating_data.upvoted else 0
        )
        db.add(new_rating)
        db.commit()
        db.refresh(new_rating)
    
    # Recalculate session average rating and upvotes
    all_ratings = db.query(PeerSessionRating).filter(
        PeerSessionRating.peer_session_id == session_id
    ).all()
    
    total_ratings = len(all_ratings)
    average_rating = sum(r.rating for r in all_ratings) / total_ratings if total_ratings > 0 else 0
    total_upvotes = sum(r.upvoted for r in all_ratings)
    
    session.average_rating = average_rating
    session.total_ratings = total_ratings
    session.upvotes = total_upvotes
    
    db.commit()
    
    return RatingResponse(**new_rating.__dict__)


@router.get("/stats", response_model=PeerSessionStats)
async def get_peer_teaching_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get statistics for peer teaching sessions"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    sessions = db.query(PeerLearningSession).filter(
        PeerLearningSession.teacher_user_id == current_user.id
    ).all()
    
    total_sessions = len(sessions)
    total_coins = sum(s.coins_earned for s in sessions)
    total_students = sum(len(s.enrolled_student_ids) for s in sessions)
    
    # Calculate average rating across all sessions
    rated_sessions = [s for s in sessions if s.total_ratings > 0]
    average_rating = sum(s.average_rating for s in rated_sessions) / len(rated_sessions) if rated_sessions else 0
    
    return PeerSessionStats(
        total_sessions_taught=total_sessions,
        total_coins_earned=total_coins,
        average_rating=average_rating,
        total_students_taught=total_students
    )


@router.delete("/sessions/{session_id}")
async def delete_peer_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a peer learning session (only by teacher before it starts)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    session = db.query(PeerLearningSession).filter(
        PeerLearningSession.id == session_id,
        PeerLearningSession.teacher_user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Peer session not found")
    
    # Can only delete if session hasn't started
    if session.status not in ["waiting", "open"]:
        raise HTTPException(status_code=400, detail="Cannot delete a session that has started")
    
    # Refund coins to teacher if any were awarded
    if session.coins_earned > 0:
        teacher = db.query(User).filter(User.id == session.teacher_user_id).first()
        if teacher:
            teacher.coins = max(0, (teacher.coins or 0) - session.coins_earned)
    
    db.delete(session)
    db.commit()
    
    return {"message": "Peer session deleted successfully"}


# ============== WHITEBOARD ENDPOINTS ==============

@router.post("/sessions/{session_id}/whiteboard", response_model=PeerWhiteboardDataResponse)
async def save_peer_whiteboard_data(
    session_id: str,
    whiteboard_data: PeerWhiteboardDataCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save whiteboard drawing data for a peer learning session"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Check if session exists and user is a participant (teacher or enrolled student)
    session = db.query(PeerLearningSession).filter(
        PeerLearningSession.id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Peer session not found")
    
    # Verify user is the teacher or an enrolled student
    is_teacher = session.teacher_user_id == current_user.id
    is_enrolled = current_user.id in session.enrolled_student_ids
    
    if not is_teacher and not is_enrolled:
        raise HTTPException(status_code=403, detail="You are not a participant in this session")
    
    # Create whiteboard entry
    wb_data = PeerWhiteboardData(
        peer_session_id=session_id,
        drawing_data=whiteboard_data.drawing_data,
        snapshot_url=whiteboard_data.snapshot_url,
        description=whiteboard_data.description
    )
    
    db.add(wb_data)
    db.commit()
    db.refresh(wb_data)
    
    return wb_data


@router.get("/sessions/{session_id}/whiteboard", response_model=List[PeerWhiteboardDataResponse])
async def get_peer_whiteboard_data(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all whiteboard data for a peer learning session"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Check if session exists and user is a participant
    session = db.query(PeerLearningSession).filter(
        PeerLearningSession.id == session_id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Peer session not found")
    
    # Verify user is the teacher or an enrolled student
    is_teacher = session.teacher_user_id == current_user.id
    is_enrolled = current_user.id in session.enrolled_student_ids
    
    if not is_teacher and not is_enrolled:
        raise HTTPException(status_code=403, detail="You are not a participant in this session")
    
    # Get whiteboard data
    whiteboard_data = db.query(PeerWhiteboardData).filter(
        PeerWhiteboardData.peer_session_id == session_id
    ).order_by(PeerWhiteboardData.created_at).all()
    
    return whiteboard_data
