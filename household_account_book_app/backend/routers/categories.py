from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models
import schemas

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/", response_model=List[schemas.CategoryResponse])
def get_categories(type: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Category)
    if type:
        query = query.filter(models.Category.type == type)
    return query.order_by(models.Category.id).all()


@router.post("/", response_model=schemas.CategoryResponse)
def create_category(category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    db_category = models.Category(**category.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


@router.put("/{category_id}", response_model=schemas.CategoryResponse)
def update_category(category_id: int, category_update: schemas.CategoryUpdate, db: Session = Depends(get_db)):
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    for key, value in category_update.model_dump(exclude_unset=True).items():
        setattr(category, key, value)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(category)
    db.commit()
    return {"message": "Category deleted"}
