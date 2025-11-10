from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from typing import List, AsyncGenerator
from datetime import datetime
import os
from dotenv import load_dotenv

from app.models.auth import User
from app.models.teachSession import TeachSession, TeachSessionMessage, WhiteboardData
from app.models.notes import Note
from app.models.assignment import Assignment
from app.schemas.teachSession import (
    TeachSessionCreate,
    TeachSessionResponse,
    TeachSessionUpdate,
    MessageCreate,
    MessageResponse,
    ChatRequest,
    ChatResponse,
    WhiteboardDataCreate,
    WhiteboardDataResponse,
    SessionEvaluationRequest,
    SessionEvaluationResponse,
    FileUploadResponse
)
from app.dependencies.dependencies import get_current_user
from app.config.db import get_db
from langchain_google_genai import ChatGoogleGenerativeAI
from fastapi.responses import StreamingResponse
import json
import cloudinary
import cloudinary.uploader

router = APIRouter()
load_dotenv()

# Initialize Gemini AI
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    temperature=0.7
)

# AI Student Prompt Template
AI_STUDENT_SYSTEM_PROMPT = """You are an enthusiastic AI student learning from your teacher (the human user). 
Your role is to:
1. Act as if you have NO prior knowledge of the topic
2. Ask SHORT, focused clarifying questions when unclear
3. Request brief examples to understand concepts
4. Occasionally give BRIEF summaries of what you learned
5. Express curiosity with concise responses
6. Point out gaps in explanations briefly

CRITICAL: Keep responses SHORT (2-4 sentences max). Be conversational but CONCISE.
Don't lecture - you're here to LEARN. Ask questions, don't explain.

Examples of good responses:
- "That makes sense! Can you give me a quick example?"
- "I'm not sure I understand X. Could you clarify?"
- "So far, I've learned that... Is that right?"
- "Interesting! How does this relate to Y?"

Bad responses (too long/explanatory):
- Long paragraphs explaining concepts
- Detailed summaries
- Multiple questions at once
"""


def build_context_from_references(
    db: Session,
    reference_note_ids: List[str],
    reference_assignment_ids: List[str]
) -> str:
    """Build context string from reference materials"""
    context_parts = []
    
    # Get notes content
    if reference_note_ids:
        notes = db.query(Note).filter(Note.id.in_(reference_note_ids)).all()
        for note in notes:
            context_parts.append(f"Note - {note.title}:\n{note.content}\n")
    
    # Get assignment content
    if reference_assignment_ids:
        assignments = db.query(Assignment).filter(Assignment.id.in_(reference_assignment_ids)).all()
        for assignment in assignments:
            context_parts.append(f"Assignment - {assignment.title}:\n{assignment.description}\n")
    
    return "\n---\n".join(context_parts) if context_parts else ""


def get_conversation_history(db: Session, session_id: str, limit: int = 10) -> str:
    """Get recent conversation history"""
    messages = (
        db.query(TeachSessionMessage)
        .filter(TeachSessionMessage.session_id == session_id)
        .order_by(TeachSessionMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    messages.reverse()  # Chronological order
    
    history = []
    for msg in messages:
        role = "Teacher" if msg.role == "student" else "AI Student"
        history.append(f"{role}: {msg.content}")
    
    return "\n".join(history)


@router.post("/sessions", response_model=TeachSessionResponse)
async def create_teach_session(
    session_data: TeachSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new teach-to-learn session"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Create session
    new_session = TeachSession(
        student_id=current_user.id,
        title=session_data.title,
        topic=session_data.topic,
        reference_note_ids=session_data.reference_note_ids or [],
        reference_assignment_ids=session_data.reference_assignment_ids or [],
        uploaded_files=session_data.uploaded_files or [],
        status="active"
    )
    
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    # Add initial AI greeting message
    greeting_message = TeachSessionMessage(
        session_id=new_session.id,
        role="ai",
        content=f"Hi! I'm your student for today. I'm excited to learn about {session_data.topic}! Can you start by giving me an overview of what we'll be covering?",
        message_type="text"
    )
    db.add(greeting_message)
    db.commit()
    
    return new_session


@router.get("/sessions", response_model=List[TeachSessionResponse])
async def get_user_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 20
):
    """Get all teach sessions for the current user"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    sessions = (
        db.query(TeachSession)
        .filter(TeachSession.student_id == current_user.id)
        .order_by(TeachSession.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    return sessions


@router.get("/sessions/{session_id}", response_model=TeachSessionResponse)
async def get_session_by_id(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific teach session with all messages and whiteboard data"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    session = db.query(TeachSession).filter(
        TeachSession.id == session_id,
        TeachSession.student_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session


@router.put("/sessions/{session_id}", response_model=TeachSessionResponse)
async def update_teach_session(
    session_id: str,
    update_data: TeachSessionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a teach session"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    session = db.query(TeachSession).filter(
        TeachSession.id == session_id,
        TeachSession.student_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update fields
    for field, value in update_data.dict(exclude_unset=True).items():
        setattr(session, field, value)
    
    if update_data.status == "completed" and not session.completed_at:
        session.completed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(session)
    
    return session


@router.delete("/sessions/{session_id}")
async def delete_teach_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a teach session"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    session = db.query(TeachSession).filter(
        TeachSession.id == session_id,
        TeachSession.student_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    db.delete(session)
    db.commit()
    
    return {"message": "Session deleted successfully"}


@router.post("/sessions/{session_id}/chat", response_model=ChatResponse)
async def chat_with_ai_student(
    session_id: str,
    chat_data: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a message to the AI student and get a response"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Get session
    session = db.query(TeachSession).filter(
        TeachSession.id == session_id,
        TeachSession.student_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Save student's message
    student_message = TeachSessionMessage(
        session_id=session_id,
        role="student",
        content=chat_data.message,
        message_type=chat_data.message_type,
        audio_duration=chat_data.audio_duration
    )
    db.add(student_message)
    db.commit()
    
    # Build context
    reference_context = build_context_from_references(
        db,
        session.reference_note_ids,
        session.reference_assignment_ids
    )
    
    conversation_history = get_conversation_history(db, session_id)
    
    # Build prompt for AI - include whiteboard context if available
    whiteboard_context = ""
    if chat_data.whiteboard_image:
        whiteboard_context = "\n\n[VISUAL CONTEXT: The teacher is showing you a whiteboard with diagrams, drawings, or notes. Please refer to the visual content in the image when responding to their explanation. Ask questions about what you see in the whiteboard if anything is unclear.]"
    
    # Build prompt for AI
    prompt = f"""{AI_STUDENT_SYSTEM_PROMPT}

Topic: {session.topic}

Reference Materials (treat these as the teacher's notes, not your knowledge):
{reference_context}

Conversation so far:
{conversation_history}

Teacher's latest explanation: {chat_data.message}{whiteboard_context}

Respond as an engaged AI student in 2-4 sentences MAX. Ask a focused question, give brief feedback, or make a short observation. If there's a whiteboard image, briefly reference what you see.
"""
    
    # Get AI response with vision if whiteboard image is provided
    try:
        if chat_data.whiteboard_image:
            # Log that we received an image
            print(f"Received whiteboard image, length: {len(chat_data.whiteboard_image)} chars")
            
            # Use Gemini Vision model when whiteboard is shared
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain_core.messages import HumanMessage
            
            vision_llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                temperature=0.7
            )
            
            # Create message with image - Gemini expects inline_data format
            message = HumanMessage(
                content=[
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{chat_data.whiteboard_image}"
                        }
                    }
                ]
            )
            print("Invoking Gemini with vision model...")
            ai_response = vision_llm.invoke([message])
        else:
            print("No whiteboard image, using text-only model")
            ai_response = llm.invoke(prompt)
            
        ai_content = ai_response.content
    except Exception as e:
        print(f"AI Error Details: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI generation error: {str(e)}")
    
    # Save AI response
    ai_message = TeachSessionMessage(
        session_id=session_id,
        role="ai",
        content=ai_content,
        message_type="text"
    )
    db.add(ai_message)
    db.commit()
    db.refresh(ai_message)
    
    return ChatResponse(
        ai_message=ai_content,
        message_id=ai_message.id,
        session_id=session_id
    )


@router.post("/sessions/{session_id}/chat/stream")
async def chat_with_ai_student_stream(
    session_id: str,
    chat_data: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a message to the AI student and get a streaming response"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Get session
    session = db.query(TeachSession).filter(
        TeachSession.id == session_id,
        TeachSession.student_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Save student's message
    student_message = TeachSessionMessage(
        session_id=session_id,
        role="student",
        content=chat_data.message,
        message_type=chat_data.message_type,
        audio_duration=chat_data.audio_duration
    )
    db.add(student_message)
    db.commit()
    
    # Build context
    reference_context = build_context_from_references(
        db,
        session.reference_note_ids,
        session.reference_assignment_ids
    )
    
    conversation_history = get_conversation_history(db, session_id)
    
    # Build prompt for AI
    prompt = f"""{AI_STUDENT_SYSTEM_PROMPT}

Topic: {session.topic}

Reference Materials:
{reference_context}

Conversation so far:
{conversation_history}

Teacher's latest explanation: {chat_data.message}

Respond as an engaged AI student.
"""
    
    # Stream AI response
    async def event_stream() -> AsyncGenerator[str, None]:
        full_response = ""
        try:
            llm_stream = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                temperature=0.7,
                streaming=True
            )
            
            for chunk in llm_stream.stream(prompt):
                if hasattr(chunk, 'content'):
                    content = chunk.content
                    full_response += content
                    yield content
            
            # Save complete AI response
            ai_message = TeachSessionMessage(
                session_id=session_id,
                role="ai",
                content=full_response,
                message_type="text"
            )
            db.add(ai_message)
            db.commit()
            
        except Exception as e:
            yield f"\n\nError: {str(e)}"
    
    return StreamingResponse(event_stream(), media_type="text/plain")


@router.post("/sessions/{session_id}/whiteboard", response_model=WhiteboardDataResponse)
async def save_whiteboard_data(
    session_id: str,
    whiteboard_data: WhiteboardDataCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save whiteboard drawing data"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    session = db.query(TeachSession).filter(
        TeachSession.id == session_id,
        TeachSession.student_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Create whiteboard entry
    wb_data = WhiteboardData(
        session_id=session_id,
        drawing_data=whiteboard_data.drawing_data,
        snapshot_url=whiteboard_data.snapshot_url,
        description=whiteboard_data.description
    )
    
    db.add(wb_data)
    db.commit()
    db.refresh(wb_data)
    
    return wb_data


@router.get("/sessions/{session_id}/whiteboard", response_model=List[WhiteboardDataResponse])
async def get_whiteboard_data(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all whiteboard data for a session"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    session = db.query(TeachSession).filter(
        TeachSession.id == session_id,
        TeachSession.student_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    whiteboard_data = db.query(WhiteboardData).filter(
        WhiteboardData.session_id == session_id
    ).order_by(WhiteboardData.created_at).all()
    
    return whiteboard_data


@router.post("/sessions/{session_id}/evaluate", response_model=SessionEvaluationResponse)
async def evaluate_teaching_session(
    session_id: str,
    evaluation_request: SessionEvaluationRequest = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate AI evaluation and feedback for the teaching session"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    session = db.query(TeachSession).filter(
        TeachSession.id == session_id,
        TeachSession.student_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get all messages
    conversation_history = get_conversation_history(db, session_id, limit=1000)
    
    # Build evaluation prompt
    whiteboard_context = ""
    if evaluation_request and evaluation_request.whiteboard_image:
        whiteboard_context = "\n\n[The final whiteboard shows the visual aids and diagrams the teacher used during the session. Evaluate how effectively they used visual explanations.]"
    
    evaluation_prompt = f"""You are an educational assessment AI. Analyze the following teaching session where a student taught you (an AI) about {session.topic}.

Provide:
1. A comprehensive summary of what was taught
2. A clarity score (0-100) - how clear and well-explained the concepts were
3. A completeness score (0-100) - how thoroughly the topic was covered
4. Detailed feedback on the teaching quality
5. 3-5 specific areas for improvement

Conversation:
{conversation_history}{whiteboard_context}

Respond in JSON format:
{{
    "summary": "...",
    "clarity_score": 85,
    "completeness_score": 78,
    "feedback": "...",
    "areas_for_improvement": ["...", "...", "..."]
}}
"""
    
    try:
        # Use vision model if whiteboard image is provided
        if evaluation_request and evaluation_request.whiteboard_image:
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain_core.messages import HumanMessage
            
            evaluation_llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                temperature=0.3
            )
            
            message = HumanMessage(
                content=[
                    {
                        "type": "text",
                        "text": evaluation_prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{evaluation_request.whiteboard_image}"
                        }
                    }
                ]
            )
            response = evaluation_llm.invoke([message])
        else:
            evaluation_llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                temperature=0.3
            )
            response = evaluation_llm.invoke(evaluation_prompt)
        
        # Parse JSON response
        content = response.content.strip()
        if content.startswith("```json"):
            content = content[7:-3].strip()
        elif content.startswith("```"):
            content = content[3:-3].strip()
            
        evaluation_data = json.loads(content)
        
        # Update session with evaluation
        session.ai_summary = evaluation_data.get("summary", "")
        session.clarity_score = evaluation_data.get("clarity_score", 0)
        session.completeness_score = evaluation_data.get("completeness_score", 0)
        session.feedback = evaluation_data.get("feedback", "")
        session.status = "completed"
        session.completed_at = datetime.utcnow()
        
        db.commit()
        db.refresh(session)
        
        return SessionEvaluationResponse(
            session_id=session.id,
            ai_summary=session.ai_summary,
            clarity_score=session.clarity_score,
            completeness_score=session.completeness_score,
            feedback=session.feedback,
            areas_for_improvement=evaluation_data.get("areas_for_improvement", [])
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation error: {str(e)}")


@router.post("/sessions/{session_id}/upload-file", response_model=FileUploadResponse)
async def upload_session_file(
    session_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a file (PDF, image, etc.) for the teach session"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    session = db.query(TeachSession).filter(
        TeachSession.id == session_id,
        TeachSession.student_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Upload to Cloudinary (reusing existing config)
    try:
        upload_result = cloudinary.uploader.upload(
            file.file,
            folder=f"teach_sessions/{session_id}",
            resource_type="auto"
        )
        
        file_url = upload_result.get("secure_url")
        
        # Add to session's uploaded files
        if file_url not in session.uploaded_files:
            session.uploaded_files.append(file_url)
            # Mark the JSON field as modified so SQLAlchemy detects the change
            flag_modified(session, "uploaded_files")
            db.commit()
            db.refresh(session)
        
        return FileUploadResponse(
            file_url=file_url,
            file_name=file.filename
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload error: {str(e)}")
