from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List
from datetime import date
from database import get_db
import models
import schemas

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/monthly/{year}/{month}", response_model=schemas.MonthlyReport)
def get_monthly_report(year: int, month: int, db: Session = Depends(get_db)):
    # Base query for this month
    base_query = db.query(models.Transaction).filter(
        extract('year', models.Transaction.date) == year,
        extract('month', models.Transaction.date) == month
    )

    # Summary
    income_result = base_query.filter(models.Transaction.type == 'income').with_entities(
        func.sum(models.Transaction.amount)
    ).scalar() or 0
    expense_result = base_query.filter(models.Transaction.type == 'expense').with_entities(
        func.sum(models.Transaction.amount)
    ).scalar() or 0
    deduction_result = base_query.filter(models.Transaction.type == 'deduction').with_entities(
        func.sum(models.Transaction.amount)
    ).scalar() or 0

    summary = schemas.MonthlySummary(
        year=year,
        month=month,
        total_income=income_result,
        total_expense=expense_result,
        total_deduction=deduction_result,
        balance=income_result - (expense_result + deduction_result)
    )

    # Expense by category
    expense_by_cat = db.query(
        models.Transaction.category_id,
        models.Category.name,
        func.sum(models.Transaction.amount).label('total'),
        func.count(models.Transaction.id).label('count')
    ).outerjoin(
        models.Category, models.Transaction.category_id == models.Category.id
    ).filter(
        extract('year', models.Transaction.date) == year,
        extract('month', models.Transaction.date) == month,
        models.Transaction.type == 'expense'
    ).group_by(models.Transaction.category_id, models.Category.name).all()

    expense_by_category = [
        schemas.CategorySummary(
            category_id=row.category_id,
            category_name=row.name or "未分類",
            total=row.total,
            count=row.count
        ) for row in expense_by_cat
    ]

    # Income by category
    income_by_cat = db.query(
        models.Transaction.category_id,
        models.Category.name,
        func.sum(models.Transaction.amount).label('total'),
        func.count(models.Transaction.id).label('count')
    ).outerjoin(
        models.Category, models.Transaction.category_id == models.Category.id
    ).filter(
        extract('year', models.Transaction.date) == year,
        extract('month', models.Transaction.date) == month,
        models.Transaction.type == 'income'
    ).group_by(models.Transaction.category_id, models.Category.name).all()

    income_by_category = [
        schemas.CategorySummary(
            category_id=row.category_id,
            category_name=row.name or "未分類",
            total=row.total,
            count=row.count
        ) for row in income_by_cat
    ]

    # By member
    member_stats = db.query(
        models.Transaction.member_id,
        models.Member.name,
        models.Transaction.type,
        func.sum(models.Transaction.amount).label('total')
    ).outerjoin(
        models.Member, models.Transaction.member_id == models.Member.id
    ).filter(
        extract('year', models.Transaction.date) == year,
        extract('month', models.Transaction.date) == month
    ).group_by(models.Transaction.member_id, models.Member.name, models.Transaction.type).all()

    member_map = {}
    for row in member_stats:
        key = row.member_id
        if key not in member_map:
            member_map[key] = {
                "member_id": row.member_id,
                "member_name": row.name or "未設定",
                "total_expense": 0,
                "total_income": 0,
                "total_deduction": 0
            }
        if row.type == 'expense':
            member_map[key]["total_expense"] = row.total
        elif row.type == 'income':
            member_map[key]["total_income"] = row.total
        elif row.type == 'deduction':
            member_map[key]["total_deduction"] = row.total

    by_member = [schemas.MemberSummary(**v) for v in member_map.values()]

    return schemas.MonthlyReport(
        summary=summary,
        expense_by_category=expense_by_category,
        income_by_category=income_by_category,
        by_member=by_member
    )


@router.get("/trend", response_model=List[schemas.MonthlyTrend])
def get_trend(months: int = 12, db: Session = Depends(get_db)):
    today = date.today()
    start_month = today.month - months + 1
    start_year = today.year
    while start_month <= 0:
        start_month += 12
        start_year -= 1
    start_date = date(start_year, start_month, 1)

    results = db.query(
        extract('year', models.Transaction.date).label('year'),
        extract('month', models.Transaction.date).label('month'),
        models.Transaction.type,
        func.sum(models.Transaction.amount).label('total')
    ).filter(
        models.Transaction.date >= start_date
    ).group_by(
        extract('year', models.Transaction.date),
        extract('month', models.Transaction.date),
        models.Transaction.type
    ).order_by(
        extract('year', models.Transaction.date),
        extract('month', models.Transaction.date)
    ).all()

    trend_map = {}
    for row in results:
        key = (int(row.year), int(row.month))
        if key not in trend_map:
            trend_map[key] = {"year": int(row.year), "month": int(row.month), "total_income": 0, "total_expense": 0, "total_deduction": 0, "balance": 0}
        if row.type == 'income':
            trend_map[key]["total_income"] = row.total
        elif row.type == 'expense':
            trend_map[key]["total_expense"] = row.total
        elif row.type == 'deduction':
            trend_map[key]["total_deduction"] = row.total

    for key in trend_map:
        trend_map[key]["balance"] = trend_map[key]["total_income"] - (trend_map[key]["total_expense"] + trend_map[key]["total_deduction"])

    sorted_trends = sorted(trend_map.values(), key=lambda x: (x["year"], x["month"]))
    return [schemas.MonthlyTrend(**t) for t in sorted_trends]
