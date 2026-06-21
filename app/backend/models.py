from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class TransactionType(str, enum.Enum):
    income = "income"
    expense = "expense"
    deduction = "deduction"


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    color = Column(String, default="#4A90D9")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transactions = relationship("Transaction", back_populates="member")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(Enum(TransactionType), nullable=False)
    icon = Column(String, default="")
    memo = Column(String, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transactions = relationship("Transaction", back_populates="category")


class ScheduledTransaction(Base):
    __tablename__ = "scheduled_transactions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(Enum(TransactionType), nullable=False)
    amount = Column(Float, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=True)
    day_of_month = Column(Integer, nullable=False)
    memo = Column(String, default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    category = relationship("Category")
    member = relationship("Member")
    transactions = relationship("Transaction", back_populates="scheduled")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(Enum(TransactionType), nullable=False)
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
    memo = Column(String, default="")
    member_id = Column(Integer, ForeignKey("members.id"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    scheduled_transaction_id = Column(
        Integer,
        ForeignKey("scheduled_transactions.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    member = relationship("Member", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
    scheduled = relationship("ScheduledTransaction", back_populates="transactions")
