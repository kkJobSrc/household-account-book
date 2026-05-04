from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date
from database import get_db
import models
import schemas

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("/", response_model=List[schemas.TransactionResponse])
def get_transactions(
    year: Optional[int] = None,
    month: Optional[int] = None,
    type: Optional[str] = None,
    member_id: Optional[int] = None,
    category_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.Transaction).options(
        joinedload(models.Transaction.member),
        joinedload(models.Transaction.category)
    )
    if year:
        from sqlalchemy import extract
        query = query.filter(extract('year', models.Transaction.date) == year)
    if month:
        from sqlalchemy import extract
        query = query.filter(extract('month', models.Transaction.date) == month)
    if type:
        query = query.filter(models.Transaction.type == type)
    if member_id:
        query = query.filter(models.Transaction.member_id == member_id)
    if category_id:
        query = query.filter(models.Transaction.category_id == category_id)
    return query.order_by(models.Transaction.date.desc(), models.Transaction.id.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=schemas.TransactionResponse)
def create_transaction(transaction: schemas.TransactionCreate, db: Session = Depends(get_db)):
    db_transaction = models.Transaction(**transaction.model_dump())
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    # Reload with relationships
    db_transaction = db.query(models.Transaction).options(
        joinedload(models.Transaction.member),
        joinedload(models.Transaction.category)
    ).filter(models.Transaction.id == db_transaction.id).first()
    return db_transaction


@router.get("/{transaction_id}", response_model=schemas.TransactionResponse)
def get_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.query(models.Transaction).options(
        joinedload(models.Transaction.member),
        joinedload(models.Transaction.category)
    ).filter(models.Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


@router.put("/{transaction_id}", response_model=schemas.TransactionResponse)
def update_transaction(transaction_id: int, transaction_update: schemas.TransactionUpdate, db: Session = Depends(get_db)):
    transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for key, value in transaction_update.model_dump(exclude_unset=True).items():
        setattr(transaction, key, value)
    db.commit()
    db.refresh(transaction)
    transaction = db.query(models.Transaction).options(
        joinedload(models.Transaction.member),
        joinedload(models.Transaction.category)
    ).filter(models.Transaction.id == transaction_id).first()
    return transaction


@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(transaction)
    db.commit()
    return {"message": "Transaction deleted"}
