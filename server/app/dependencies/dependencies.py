from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.config.db import get_db
from app.models.auth import User
from app.utils.utils import decode_access_token
import logging

logger = logging.getLogger(__name__)

def get_current_user(request: Request, db: Session = Depends(get_db)):
    logger.info("=== get_current_user called ===")
    logger.info(f"Request URL: {request.url}")
    logger.info(f"Request headers: {dict(request.headers)}")
    logger.info(f"Cookies: {request.cookies}")
    
    # Try to get token from cookie first (for same-origin requests)
    token = request.cookies.get("access_token")
    
    # If not in cookie, try Authorization header (for cross-origin/mobile requests)
    if not token:
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            logger.info(f"Token from Authorization header: {token[:20] if token else 'None'}...")
        else:
            logger.info("No Authorization header or invalid format")
    else:
        logger.info(f"Token from cookie: {token[:20] if token else 'None'}...")
    
    if not token:
        logger.error("No access_token found in cookie or Authorization header")
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = decode_access_token(token)
        logger.info(f"Decoded payload: {payload}")
        
        email = payload.get("sub")
        if not email:
            logger.error("No email in token payload")
            raise HTTPException(status_code=401, detail="Invalid token")
        
        logger.info(f"Looking up user with email: {email}")
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            logger.error(f"User not found for email: {email}")
            raise HTTPException(status_code=401, detail="User not found")
        
        logger.info(f"✅ User authenticated successfully: {user.email}")
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Exception in get_current_user: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")