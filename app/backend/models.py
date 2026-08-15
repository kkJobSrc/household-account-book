from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Enum, Boolean, UniqueConstraint
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
    receipt_images = relationship(
        "ReceiptImage", secondary="transaction_receipt_images", back_populates="transactions"
    )


class OcrStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class ReceiptImage(Base):
    __tablename__ = "receipt_images"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="SET NULL"), nullable=True)
    storage_path = Column(String, nullable=False)
    file_hash = Column(String, nullable=False, unique=True, index=True)
    file_size = Column(Integer, nullable=False)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    mime_type = Column(String, nullable=False)
    ocr_status = Column(Enum(OcrStatus), nullable=False, default=OcrStatus.pending)
    ocr_processed_at = Column(DateTime(timezone=True), nullable=True)
    # Counts consecutive OCR attempts (incremented on each transient
    # failure/requeue); reset to 0 on success. See services/ocr_processing.py
    # MAX_OCR_ATTEMPTS for the retry cap that consults this column.
    ocr_attempt_count = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    member = relationship("Member")
    transactions = relationship(
        "Transaction", secondary="transaction_receipt_images", back_populates="receipt_images"
    )
    ocr_results = relationship(
        "ReceiptOcrResult", back_populates="receipt_image", cascade="all, delete-orphan"
    )


class ReceiptOcrResult(Base):
    """Append-only history of OCR attempts for a receipt image.

    Rows are never updated/overwritten; every scan or manual re-run inserts
    a new row so past attempts can still be inspected/compared later. The
    "current" status lives on ReceiptImage.ocr_status instead.
    """
    __tablename__ = "receipt_ocr_results"

    id = Column(Integer, primary_key=True, index=True)
    receipt_image_id = Column(Integer, ForeignKey("receipt_images.id", ondelete="CASCADE"), nullable=False)
    # Plain String (not Enum) because SQLite can't ALTER a CHECK constraint
    # in place, so adding a new OCR engine later would require a full table
    # rebuild if this were an Enum column.
    engine = Column(String, nullable=False)
    raw_text = Column(String, nullable=True)
    # JSON-serialized OcrLine list ({"text", "confidence", "box"} per line),
    # kept as TEXT since SQLite has no native JSON column type.
    raw_json = Column(String, nullable=True)
    status = Column(String, nullable=False)
    error_message = Column(String, nullable=True)
    processing_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    receipt_image = relationship("ReceiptImage", back_populates="ocr_results")


class TransactionReceiptImage(Base):
    __tablename__ = "transaction_receipt_images"
    __table_args__ = (UniqueConstraint("transaction_id", "receipt_image_id"),)

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False)
    receipt_image_id = Column(Integer, ForeignKey("receipt_images.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
