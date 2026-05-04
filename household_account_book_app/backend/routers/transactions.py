from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date
from database import get_db
import models
import schemas
from logger import db_logger, error_logger

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
    try:
        db_transaction = models.Transaction(**transaction.model_dump())
        db.add(db_transaction)
        db.commit()
        db.refresh(db_transaction)
        db_logger.info("transaction created: %s", transaction.model_dump())
        db_transaction = db.query(models.Transaction).options(
            joinedload(models.Transaction.member),
            joinedload(models.Transaction.category)
        ).filter(models.Transaction.id == db_transaction.id).first()
        return db_transaction
    except Exception as exc:
        db.rollback()
        error_logger.error("Failed to create transaction: %s | data=%s", exc, transaction.model_dump())
        raise


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
    try:
        update_data = transaction_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(transaction, key, value)
        db.commit()
        db.refresh(transaction)
        db_logger.info("transaction updated: id=%s | data=%s", transaction_id, update_data)
        transaction = db.query(models.Transaction).options(
            joinedload(models.Transaction.member),
            joinedload(models.Transaction.category)
        ).filter(models.Transaction.id == transaction_id).first()
        return transaction
    except Exception as exc:
        db.rollback()
        error_logger.error("Failed to update transaction: id=%s | %s", transaction_id, exc)
        raise


@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.query(models.Transaction).filter(models.Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    try:
        db.delete(transaction)
        db.commit()
        db_logger.info("transaction deleted: id=%s", transaction_id)
        return {"message": "Transaction deleted"}
    except Exception as exc:
        db.rollback()
        error_logger.error("Failed to delete transaction: id=%s | %s", transaction_id, exc)
        raise
