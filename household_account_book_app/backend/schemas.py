from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from enum import Enum


class TransactionType(str, Enum):
    income = "income"
    expense = "expense"


# Member schemas
class MemberBase(BaseModel):
    name: str
    color: str = "#4A90D9"


class MemberCreate(MemberBase):
    pass


class MemberUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class MemberResponse(MemberBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Category schemas
class CategoryBase(BaseModel):
    name: str
    type: TransactionType
    icon: str = ""


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[TransactionType] = None
    icon: Optional[str] = None


class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Transaction schemas
class TransactionBase(BaseModel):
    type: TransactionType
    amount: float
    date: date
    memo: str = ""
    member_id: Optional[int] = None
    category_id: Optional[int] = None


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    type: Optional[TransactionType] = None
    amount: Optional[float] = None
    date: Optional[date] = None
    memo: Optional[str] = None
    member_id: Optional[int] = None
    category_id: Optional[int] = None


class TransactionResponse(TransactionBase):
    id: int
    created_at: datetime
    member: Optional[MemberResponse] = None
    category: Optional[CategoryResponse] = None

    class Config:
        from_attributes = True


# Report schemas
class MonthlySummary(BaseModel):
    year: int
    month: int
    total_income: float
    total_expense: float
    balance: float


class CategorySummary(BaseModel):
    category_id: Optional[int]
    category_name: str
    total: float
    count: int


class MemberSummary(BaseModel):
    member_id: Optional[int]
    member_name: str
    total_expense: float
    total_income: float


class MonthlyReport(BaseModel):
    summary: MonthlySummary
    expense_by_category: List[CategorySummary]
    income_by_category: List[CategorySummary]
    by_member: List[MemberSummary]


class MonthlyTrend(BaseModel):
    year: int
    month: int
    total_income: float
    total_expense: float
    balance: float
