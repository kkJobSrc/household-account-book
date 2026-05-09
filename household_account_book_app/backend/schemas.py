from pydantic import BaseModel, Field
from typing import Optional, List
import datetime
from enum import Enum


class TransactionType(str, Enum):
    income = "income"
    expense = "expense"
    deduction = "deduction"


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
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# Category schemas
class CategoryBase(BaseModel):
    name: str
    type: TransactionType
    icon: str = ""
    memo: str = ""


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[TransactionType] = None
    icon: Optional[str] = None
    memo: Optional[str] = None


class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# Transaction schemas
class TransactionBase(BaseModel):
    type: TransactionType
    amount: float = Field(gt=0)
    date: datetime.date
    memo: str = ""
    member_id: Optional[int] = None
    category_id: Optional[int] = None


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    type: Optional[TransactionType] = None
    amount: Optional[float] = Field(default=None, gt=0)
    date: Optional[datetime.date] = None
    memo: Optional[str] = None
    member_id: Optional[int] = None
    category_id: Optional[int] = None


class TransactionResponse(TransactionBase):
    id: int
    created_at: datetime.datetime
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
    total_deduction: float
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
    total_deduction: float = 0


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
    total_deduction: float = 0
    balance: float


class RangeSummaryByCat(BaseModel):
    category_id: Optional[int]
    category_name: str
    type: TransactionType
    total: float


class RangeSummaryByMember(BaseModel):
    member_id: Optional[int]
    member_name: str
    color: str
    total_income: float
    total_expense: float


class RangeSummaryResponse(BaseModel):
    period_label: str
    total_income: float
    total_expense: float
    balance: float
    by_category: List[RangeSummaryByCat]
    by_member: List[RangeSummaryByMember]
