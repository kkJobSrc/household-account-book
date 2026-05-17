import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import extract
from sqlalchemy.orm import Session, joinedload

from database import get_db
import models
import schemas
from logger import db_logger, error_logger

router = APIRouter(prefix="/scheduled-transactions", tags=["scheduled-transactions"])


@router.get("/", response_model=List[schemas.ScheduledTransactionResponse])
def get_scheduled_transactions(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.ScheduledTransaction).options(
        joinedload(models.ScheduledTransaction.member),
        joinedload(models.ScheduledTransaction.category)
    )
    if is_active is not None:
        query = query.filter(models.ScheduledTransaction.is_active == is_active)
    return query.order_by(models.ScheduledTransaction.id).all()


@router.post("/", response_model=schemas.ScheduledTransactionResponse, status_code=201)
def create_scheduled_transaction(
    data: schemas.ScheduledTransactionCreate,
    db: Session = Depends(get_db)
):
    try:
        st = models.ScheduledTransaction(**data.model_dump())
        db.add(st)
        db.commit()
        db.refresh(st)
        db_logger.info("scheduled_transaction created: %s", data.model_dump())
        st = db.query(models.ScheduledTransaction).options(
            joinedload(models.ScheduledTransaction.member),
            joinedload(models.ScheduledTransaction.category)
        ).filter(models.ScheduledTransaction.id == st.id).first()
        return st
    except Exception as exc:
        db.rollback()
        error_logger.error("Failed to create scheduled_transaction: %s | data=%s", exc, data.model_dump())
        raise


# NOTE: /apply は /{id} より前に定義すること（パスの競合回避）
@router.post("/apply")
def apply_scheduled_transactions(db: Session = Depends(get_db)):
    # NOTE: 同一家族での利用を前提に、並行リクエストによる重複作成リスクは許容する
    today = datetime.date.today()
    current_year = today.year
    current_month = today.month

    active_schedules = db.query(models.ScheduledTransaction).filter(
        models.ScheduledTransaction.is_active == True
    ).all()

    applied_count = 0
    skipped_count = 0

    try:
        for st in active_schedules:
            existing = db.query(models.Transaction).filter(
                extract('year', models.Transaction.date) == current_year,
                extract('month', models.Transaction.date) == current_month,
                models.Transaction.scheduled_transaction_id == st.id
            ).first()

            if existing:
                skipped_count += 1
                continue

            transaction = models.Transaction(
                type=st.type,
                amount=st.amount,
                date=datetime.date(current_year, current_month, st.day_of_month),
                memo=st.memo,
                member_id=st.member_id,
                category_id=st.category_id,
                scheduled_transaction_id=st.id
            )
            db.add(transaction)
            applied_count += 1

        db.commit()
        db_logger.info(
            "scheduled_transactions applied: year=%s month=%s applied=%s skipped=%s",
            current_year, current_month, applied_count, skipped_count
        )
    except Exception as exc:
        db.rollback()
        error_logger.error("Failed to apply scheduled_transactions: %s", exc)
        raise

    return {"applied": applied_count, "skipped": skipped_count}


@router.put("/{scheduled_id}", response_model=schemas.ScheduledTransactionResponse)
def update_scheduled_transaction(
    scheduled_id: int,
    data: schemas.ScheduledTransactionUpdate,
    db: Session = Depends(get_db)
):
    st = db.query(models.ScheduledTransaction).filter(
        models.ScheduledTransaction.id == scheduled_id
    ).first()
    if not st:
        raise HTTPException(status_code=404, detail="ScheduledTransaction not found")

    try:
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(st, key, value)
        db.commit()
        db.refresh(st)
        db_logger.info("scheduled_transaction updated: id=%s | data=%s", scheduled_id, update_data)
        st = db.query(models.ScheduledTransaction).options(
            joinedload(models.ScheduledTransaction.member),
            joinedload(models.ScheduledTransaction.category)
        ).filter(models.ScheduledTransaction.id == scheduled_id).first()
        return st
    except Exception as exc:
        db.rollback()
        error_logger.error("Failed to update scheduled_transaction: id=%s | %s", scheduled_id, exc)
        raise


@router.delete("/{scheduled_id}", status_code=204)
def delete_scheduled_transaction(
    scheduled_id: int,
    db: Session = Depends(get_db)
):
    st = db.query(models.ScheduledTransaction).filter(
        models.ScheduledTransaction.id == scheduled_id
    ).first()
    if not st:
        raise HTTPException(status_code=404, detail="ScheduledTransaction not found")

    try:
        # 参照している Transaction の scheduled_transaction_id を NULL に更新
        db.query(models.Transaction).filter(
            models.Transaction.scheduled_transaction_id == scheduled_id
        ).update({"scheduled_transaction_id": None})

        db.delete(st)
        db.commit()
        db_logger.info("scheduled_transaction deleted: id=%s", scheduled_id)
    except Exception as exc:
        db.rollback()
        error_logger.error("Failed to delete scheduled_transaction: id=%s | %s", scheduled_id, exc)
        raise
