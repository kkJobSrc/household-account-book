"""Insert 12 months of sample data (2025/06 - 2026/05) for demo purposes."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import date
from database import SessionLocal, engine
import models

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFICIT_MONTHS = {(2025, 10), (2026, 2)}

# Utility amounts that vary slightly by month index (0-11)
FOOD_TARO   = [42000, 40000, 38000, 41000, 44000, 46000, 45000, 43000, 40000, 47000, 48000, 39000]
FOOD_HANAKO = [28000, 27000, 26000, 29000, 30000, 31000, 30000, 29000, 27000, 32000, 33000, 26000]
UTILITY     = [20000, 18000, 13000, 12000, 13000, 15000, 18000, 19000, 15000, 13000, 19000, 22000]
MEDICAL     = [8000,  5000,  10000, 6000,  7000,  5000,  9000,  6000,  12000, 7000,  15000, 8000]
CLOTHING    = [15000, 20000, 10000, 25000, 12000, 18000, 10000, 22000, 15000, 30000, 12000, 18000]
ENTERTAIN   = [22000, 18000, 20000, 25000, 30000, 28000, 32000, 25000, 20000, 35000, 28000, 22000]
EDUCATION   = [10000, 10000, 12000, 10000, 15000, 10000, 10000, 12000, 10000, 10000, 15000, 10000]
OTHER_EXP   = [8000,  7000,  9000,  6000,  10000, 8000,  7000,  9000,  8000,  12000, 10000, 7000]
DAILY_GOODS = [18000, 17000, 16000, 20000, 19000, 22000, 21000, 20000, 18000, 24000, 22000, 18000]
TRANSPORT_T = [16000, 15000, 17000, 16000, 18000, 16000, 15000, 17000, 16000, 18000, 16000, 15000]
TRANSPORT_H = [10000, 9000,  11000, 10000, 12000, 10000, 9000,  11000, 10000, 12000, 10000, 9000]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_or_create_category(db, name: str, type_: str, icon: str) -> models.Category:
    cat = db.query(models.Category).filter_by(name=name, type=type_).first()
    if not cat:
        cat = models.Category(name=name, type=type_, icon=icon)
        db.add(cat)
        db.flush()
    return cat


def get_or_create_member(db, name: str, color: str) -> models.Member:
    member = db.query(models.Member).filter_by(name=name).first()
    if not member:
        member = models.Member(name=name, color=color)
        db.add(member)
        db.flush()
    return member


def add_tx(db, type_: str, amount: float, d: date, member: models.Member, category: models.Category, memo: str = ""):
    db.add(models.Transaction(
        type=type_,
        amount=amount,
        date=d,
        memo=memo,
        member_id=member.id,
        category_id=category.id,
    ))


def generate_month(db, year: int, month: int, idx: int, cats: dict, taro: models.Member, hanako: models.Member):
    is_deficit = (year, month) in DEFICIT_MONTHS
    safe_day = lambda d: min(d, 28)

    # --- Income (25th) ---
    pay_date = date(year, month, 25)
    add_tx(db, "income", 500000, pay_date, taro,   cats["給与"],  "給与")
    add_tx(db, "income", 300000, pay_date, hanako, cats["給与"],  "給与")

    # --- Deduction: 10% of each salary (25th) ---
    add_tx(db, "deduction", 50000, pay_date, taro,   cats["所得税"], "所得税")
    add_tx(db, "deduction", 30000, pay_date, hanako, cats["所得税"], "所得税")

    # --- Rent (1st) ---
    add_tx(db, "expense", 80000, date(year, month, 1), taro, cats["家賃"], "家賃")

    # --- Regular expenses ---
    d5  = date(year, month, safe_day(5))
    d10 = date(year, month, safe_day(10))
    d15 = date(year, month, safe_day(15))
    d20 = date(year, month, safe_day(20))

    add_tx(db, "expense", FOOD_TARO[idx],   d10, taro,   cats["食費"],   "食費（太郎）")
    add_tx(db, "expense", FOOD_HANAKO[idx], d10, hanako, cats["食費"],   "食費（花子）")
    add_tx(db, "expense", DAILY_GOODS[idx], d15, hanako, cats["日用品"], "日用品")
    add_tx(db, "expense", TRANSPORT_T[idx], d5,  taro,   cats["交通費"], "交通費（太郎）")
    add_tx(db, "expense", TRANSPORT_H[idx], d5,  hanako, cats["交通費"], "交通費（花子）")
    add_tx(db, "expense", UTILITY[idx],     d20, taro,   cats["光熱費"], "光熱費")
    add_tx(db, "expense", MEDICAL[idx],     d15, hanako, cats["医療費"], "医療費")
    add_tx(db, "expense", CLOTHING[idx],    d20, hanako, cats["衣服"],   "衣服")
    add_tx(db, "expense", ENTERTAIN[idx],   d20, taro,   cats["娯楽"],   "娯楽")
    add_tx(db, "expense", EDUCATION[idx],   d15, hanako, cats["教育"],   "教育")
    add_tx(db, "expense", OTHER_EXP[idx],   d20, taro,   cats["その他支出"], "その他支出")

    # --- Deficit months: add a large special expense ---
    if is_deficit:
        add_tx(db, "expense", 500000, d20, taro, cats["その他支出"], "大型特別支出（家電・旅行）")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Guard: skip if transactions already exist
        if db.query(models.Transaction).count() > 0:
            print("Sample data already exists. Skipping.")
            return

        # Ensure base categories exist (seed.py may not have run yet)
        base_cats = [
            ("食費",     "expense",   "🍽️"),
            ("日用品",   "expense",   "🛒"),
            ("交通費",   "expense",   "🚃"),
            ("光熱費",   "expense",   "💡"),
            ("医療費",   "expense",   "🏥"),
            ("衣服",     "expense",   "👗"),
            ("娯楽",     "expense",   "🎮"),
            ("教育",     "expense",   "📚"),
            ("その他支出","expense",  "📦"),
            ("給与",     "income",    "💼"),
            ("副収入",   "income",    "💰"),
            ("その他収入","income",   "🎁"),
            ("所得税",   "deduction", "🏛️"),
            ("住民税",   "deduction", "🏛️"),
            ("健康保険", "deduction", "🏥"),
            ("厚生年金", "deduction", "📋"),
            ("その他控除","deduction","📄"),
        ]
        for name, type_, icon in base_cats:
            get_or_create_category(db, name, type_, icon)

        # Additional category not in seed.py
        get_or_create_category(db, "家賃", "expense", "🏠")

        db.flush()

        # Build category lookup
        all_cats = db.query(models.Category).all()
        cats = {c.name: c for c in all_cats}

        # Members
        taro   = get_or_create_member(db, "太郎", "#4A90D9")
        hanako = get_or_create_member(db, "花子", "#E74C3C")

        db.flush()

        # Generate 12 months: 2025/06 - 2026/05
        months = []
        for m in range(6, 13):
            months.append((2025, m))
        for m in range(1, 6):
            months.append((2026, m))

        for idx, (year, month) in enumerate(months):
            generate_month(db, year, month, idx, cats, taro, hanako)

        db.commit()

        total = db.query(models.Transaction).count()
        print(f"Sample data inserted. Total transactions: {total}")
        print("Deficit months: 2025-10, 2026-02")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
