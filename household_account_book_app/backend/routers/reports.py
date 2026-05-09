from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Optional
from datetime import date
from database import get_db
import models
import schemas

router = APIRouter(prefix='/reports', tags=['reports'])


@router.get('/monthly/{year}/{month}', response_model=schemas.MonthlyReport)
def get_monthly_report(year: int, month: int, db: Session = Depends(get_db)):
    base_query = db.query(models.Transaction).filter(
        extract('year', models.Transaction.date) == year,
        extract('month', models.Transaction.date) == month
    )

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
            category_name=row.name or '未分類',
            total=row.total,
            count=row.count
        ) for row in expense_by_cat
    ]

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
            category_name=row.name or '未分類',
            total=row.total,
            count=row.count
        ) for row in income_by_cat
    ]

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
                'member_id': row.member_id,
                'member_name': row.name or '未設定',
                'total_expense': 0,
                'total_income': 0,
                'total_deduction': 0
            }
        if row.type == 'expense':
            member_map[key]['total_expense'] = row.total
        elif row.type == 'income':
            member_map[key]['total_income'] = row.total
        elif row.type == 'deduction':
            member_map[key]['total_deduction'] = row.total

    by_member = [schemas.MemberSummary(**v) for v in member_map.values()]

    return schemas.MonthlyReport(
        summary=summary,
        expense_by_category=expense_by_category,
        income_by_category=income_by_category,
        by_member=by_member
    )


@router.get('/trend', response_model=List[schemas.MonthlyTrend])
def get_trend(
    months: int = 12,
    start_year: Optional[int] = None,
    start_month: Optional[int] = None,
    end_year: Optional[int] = None,
    end_month: Optional[int] = None,
    db: Session = Depends(get_db)
):
    range_params = [start_year, start_month, end_year, end_month]
    specified_count = len([p for p in range_params if p is not None])

    if 1 <= specified_count <= 3:
        raise HTTPException(
            status_code=422,
            detail='期間指定は4つのパラメータ（start_year, start_month, end_year, end_month）をすべて指定するか、すべて省略してください'
        )

    if specified_count == 4:
        start_date_check = date(start_year, start_month, 1)
        end_date_first = date(end_year, end_month, 1)
        if end_date_first < start_date_check:
            raise HTTPException(
                status_code=422,
                detail='終了月は開始月以降を指定してください'
            )
        start_date = date(start_year, start_month, 1)
        if end_month == 12:
            end_date_exclusive = date(end_year + 1, 1, 1)
        else:
            end_date_exclusive = date(end_year, end_month + 1, 1)
        date_filter = [
            models.Transaction.date >= start_date,
            models.Transaction.date < end_date_exclusive
        ]
    else:
        today = date.today()
        start_m = today.month - months + 1
        start_y = today.year
        while start_m <= 0:
            start_m += 12
            start_y -= 1
        start_date = date(start_y, start_m, 1)
        date_filter = [models.Transaction.date >= start_date]

    results = db.query(
        extract('year', models.Transaction.date).label('year'),
        extract('month', models.Transaction.date).label('month'),
        models.Transaction.type,
        func.sum(models.Transaction.amount).label('total')
    ).filter(
        *date_filter
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
            trend_map[key] = {'year': int(row.year), 'month': int(row.month), 'total_income': 0, 'total_expense': 0, 'total_deduction': 0, 'balance': 0}
        if row.type == 'income':
            trend_map[key]['total_income'] = row.total
        elif row.type == 'expense':
            trend_map[key]['total_expense'] = row.total
        elif row.type == 'deduction':
            trend_map[key]['total_deduction'] = row.total

    for key in trend_map:
        trend_map[key]['balance'] = trend_map[key]['total_income'] - (trend_map[key]['total_expense'] + trend_map[key]['total_deduction'])

    sorted_trends = sorted(trend_map.values(), key=lambda x: (x['year'], x['month']))
    return [schemas.MonthlyTrend(**t) for t in sorted_trends]


@router.get('/range', response_model=schemas.RangeSummaryResponse)
def get_range_summary(
    start_year: Optional[int] = None,
    start_month: Optional[int] = None,
    end_year: Optional[int] = None,
    end_month: Optional[int] = None,
    db: Session = Depends(get_db)
):
    range_params = [start_year, start_month, end_year, end_month]
    specified_count = len([p for p in range_params if p is not None])

    if 1 <= specified_count <= 3:
        raise HTTPException(
            status_code=422,
            detail='期間指定は4つのパラメータ（start_year, start_month, end_year, end_month）をすべて指定するか、すべて省略してください'
        )

    if specified_count == 4:
        start_date_check = date(start_year, start_month, 1)
        end_date_first = date(end_year, end_month, 1)
        if end_date_first < start_date_check:
            raise HTTPException(
                status_code=422,
                detail='終了月は開始月以降を指定してください'
            )
        start_date = date(start_year, start_month, 1)
        if end_month == 12:
            end_date_exclusive = date(end_year + 1, 1, 1)
        else:
            end_date_exclusive = date(end_year, end_month + 1, 1)
        filters = [
            models.Transaction.date >= start_date,
            models.Transaction.date < end_date_exclusive
        ]
        period_label = f'{start_year}年{start_month}月〜{end_year}年{end_month}月'
    else:
        filters = []
        period_label = '全期間'

    total_income = db.query(func.sum(models.Transaction.amount)).filter(
        *filters, models.Transaction.type == 'income'
    ).scalar() or 0

    total_expense = db.query(func.sum(models.Transaction.amount)).filter(
        *filters, models.Transaction.type == 'expense'
    ).scalar() or 0

    total_deduction = db.query(func.sum(models.Transaction.amount)).filter(
        *filters, models.Transaction.type == 'deduction'
    ).scalar() or 0

    balance = total_income - (total_expense + total_deduction)

    cat_rows = db.query(
        models.Transaction.category_id,
        models.Category.name,
        models.Transaction.type,
        func.sum(models.Transaction.amount).label('total')
    ).outerjoin(
        models.Category, models.Transaction.category_id == models.Category.id
    ).filter(*filters).group_by(
        models.Transaction.category_id,
        models.Category.name,
        models.Transaction.type
    ).all()

    by_category = [
        schemas.RangeSummaryByCat(
            category_id=row.category_id,
            category_name=row.name or '未分類',
            type=row.type,
            total=row.total
        ) for row in cat_rows
    ]

    member_rows = db.query(
        models.Transaction.member_id,
        models.Member.name,
        models.Member.color,
        models.Transaction.type,
        func.sum(models.Transaction.amount).label('total')
    ).outerjoin(
        models.Member, models.Transaction.member_id == models.Member.id
    ).filter(*filters).group_by(
        models.Transaction.member_id,
        models.Member.name,
        models.Member.color,
        models.Transaction.type
    ).all()

    member_map = {}
    for row in member_rows:
        key = row.member_id
        if key not in member_map:
            member_map[key] = {
                'member_id': row.member_id,
                'member_name': row.name or '未設定',
                'color': row.color or '#4A90D9',
                'total_income': 0,
                'total_expense': 0
            }
        if row.type == 'income':
            member_map[key]['total_income'] = row.total
        elif row.type == 'expense':
            member_map[key]['total_expense'] = row.total

    by_member = [schemas.RangeSummaryByMember(**v) for v in member_map.values()]

    return schemas.RangeSummaryResponse(
        period_label=period_label,
        total_income=total_income,
        total_expense=total_expense,
        total_deduction=total_deduction,
        balance=balance,
        by_category=by_category,
        by_member=by_member
    )
