from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
import schemas
from logger import db_logger, error_logger

router = APIRouter(prefix="/members", tags=["members"])


@router.get("/", response_model=List[schemas.MemberResponse])
def get_members(db: Session = Depends(get_db)):
    return db.query(models.Member).order_by(models.Member.id).all()


@router.post("/", response_model=schemas.MemberResponse)
def create_member(member: schemas.MemberCreate, db: Session = Depends(get_db)):
    try:
        db_member = models.Member(**member.model_dump())
        db.add(db_member)
        db.commit()
        db.refresh(db_member)
        db_logger.info("member created: %s", member.model_dump())
        return db_member
    except Exception as exc:
        db.rollback()
        error_logger.error("Failed to create member: %s | data=%s", exc, member.model_dump())
        raise


@router.get("/{member_id}", response_model=schemas.MemberResponse)
def get_member(member_id: int, db: Session = Depends(get_db)):
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@router.put("/{member_id}", response_model=schemas.MemberResponse)
def update_member(member_id: int, member_update: schemas.MemberUpdate, db: Session = Depends(get_db)):
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    try:
        update_data = member_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(member, key, value)
        db.commit()
        db.refresh(member)
        db_logger.info("member updated: id=%s | data=%s", member_id, update_data)
        return member
    except Exception as exc:
        db.rollback()
        error_logger.error("Failed to update member: id=%s | %s", member_id, exc)
        raise


@router.delete("/{member_id}")
def delete_member(member_id: int, db: Session = Depends(get_db)):
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    try:
        db.delete(member)
        db.commit()
        db_logger.info("member deleted: id=%s", member_id)
        return {"message": "Member deleted"}
    except Exception as exc:
        db.rollback()
        error_logger.error("Failed to delete member: id=%s | %s", member_id, exc)
        raise
