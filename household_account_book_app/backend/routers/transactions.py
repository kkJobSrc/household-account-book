from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import asc, desc
from typing import List, Optional
from datetime import date
from database import get_db
import models
import schemas
from logger import db_logger, error_logger

router = APIRouter(prefix="/transactions", tags=["transactions"])

# Sortable column mapping
SORT_COLUMN_MAP = {
    "date": models.Transaction.date,
    "amount": models.Transaction.amount,
    "created_at": models.Transaction.created_at,
}


@router.get("/", response_model=List[schemas.TransactionResponse])
def get_transactions(
    year: Optional[int] = None,
    month: Optional[int] = None,
    # Multi-value type filter (OR join): ?type=income&type=expense
    types: List[str] = Query(default=[], alias="type"),
    # Multi-value member filter (OR join): ?member_id=1&member_id=2
    member_ids: List[int] = Query(default=[], alias="member_id"),
    # Multi-value category filter (OR join): ?category_id=1&category_id=2
    category_ids: List[int] = Query(default=[], alias="category_id"),
    # Date range filter
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    # Sort parameters: sort_by accepts 'date' | 'amount' | 'created_at'
    sort_by: str = Query(default="date"),
    sort_order: str = Query(default="desc"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.Transaction).options(
        joinedload(models.Transaction.member),
        joinedload(models.Transaction.category)
    )

    # Year/month filters
    if year:
        from sqlalchemy import extract
        query = query.filter(extract('year', models.Transaction.date) == year)
    if month:
        from sqlalchemy import extract
        query = query.filter(extract('month', models.Transaction.date) == month)

    # OR filter for transaction types
    if types:
        query = query.filter(models.Transaction.type.in_(types))

    # OR filter for member IDs
    if member_ids:
        query = query.filter(models.Transaction.member_id.in_(member_ids))

    # OR filter for category IDs
    if category_ids:
        query = query.filter(models.Transaction.category_id.in_(category_ids))

    # Date range filters
    if date_from:
        query = query.filter(models.Transaction.date >= date_from)
    if date_to:
        query = query.filter(models.Transaction.date <= date_to)

    # Resolve sort column; fall back to 'date' for unknown values
    sort_col = SORT_COLUMN_MAP.get(sort_by, models.Transaction.date)
    order_fn = asc if sort_order == "asc" else desc
    query = query.order_by(order_fn(sort_col), desc(models.Transaction.id))

    return query.offset(skip).limit(limit).all()


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
