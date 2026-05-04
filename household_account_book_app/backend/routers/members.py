from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
import schemas

router = APIRouter(prefix="/members", tags=["members"])


@router.get("/", response_model=List[schemas.MemberResponse])
def get_members(db: Session = Depends(get_db)):
    return db.query(models.Member).order_by(models.Member.id).all()


@router.post("/", response_model=schemas.MemberResponse)
def create_member(member: schemas.MemberCreate, db: Session = Depends(get_db)):
    db_member = models.Member(**member.model_dump())
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member


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
    for key, value in member_update.model_dump(exclude_unset=True).items():
        setattr(member, key, value)
    db.commit()
    db.refresh(member)
    return member


@router.delete("/{member_id}")
def delete_member(member_id: int, db: Session = Depends(get_db)):
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()
    return {"message": "Member deleted"}
