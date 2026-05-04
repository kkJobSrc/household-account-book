from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models
import schemas
from logger import db_logger, error_logger

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/", response_model=List[schemas.CategoryResponse])
def get_categories(type: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Category)
    if type:
        query = query.filter(models.Category.type == type)
    return query.order_by(models.Category.id).all()


@router.post("/", response_model=schemas.CategoryResponse)
def create_category(category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    try:
        db_category = models.Category(**category.model_dump())
        db.add(db_category)
        db.commit()
        db.refresh(db_category)
        db_logger.info("category created: %s", category.model_dump())
        return db_category
    except Exception as exc:
        db.rollback()
        error_logger.error("Failed to create category: %s | data=%s", exc, category.model_dump())
        raise


@router.put("/{category_id}", response_model=schemas.CategoryResponse)
def update_category(category_id: int, category_update: schemas.CategoryUpdate, db: Session = Depends(get_db)):
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    try:
        update_data = category_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(category, key, value)
        db.commit()
        db.refresh(category)
        db_logger.info("category updated: id=%s | data=%s", category_id, update_data)
        return category
    except Exception as exc:
        db.rollback()
        error_logger.error("Failed to update category: id=%s | %s", category_id, exc)
        raise


@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    try:
        db.delete(category)
        db.commit()
        db_logger.info("category deleted: id=%s", category_id)
        return {"message": "Category deleted"}
    except Exception as exc:
        db.rollback()
        error_logger.error("Failed to delete category: id=%s | %s", category_id, exc)
        raise
