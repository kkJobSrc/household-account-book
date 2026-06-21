"""初期データを投入するスクリプト"""
from database import SessionLocal, engine
import models

def seed():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # 既にデータがあればスキップ
    if db.query(models.Category).count() > 0:
        db.close()
        return

    # デフォルトカテゴリ（支出）
    expense_categories = [
        {"name": "食費", "type": "expense", "icon": "🍽️"},
        {"name": "日用品", "type": "expense", "icon": "🛒"},
        {"name": "交通費", "type": "expense", "icon": "🚃"},
        {"name": "光熱費", "type": "expense", "icon": "💡"},
        {"name": "医療費", "type": "expense", "icon": "🏥"},
        {"name": "衣服", "type": "expense", "icon": "👗"},
        {"name": "娯楽", "type": "expense", "icon": "🎮"},
        {"name": "教育", "type": "expense", "icon": "📚"},
        {"name": "その他支出", "type": "expense", "icon": "📦"},
    ]
    # デフォルトカテゴリ（収入）
    income_categories = [
        {"name": "給与", "type": "income", "icon": "💼"},
        {"name": "副収入", "type": "income", "icon": "💰"},
        {"name": "その他収入", "type": "income", "icon": "🎁"},
    ]
    # デフォルトカテゴリ（控除）
    deduction_categories = [
        {"name": "所得税", "type": "deduction", "icon": "🏛️"},
        {"name": "住民税", "type": "deduction", "icon": "🏛️"},
        {"name": "健康保険", "type": "deduction", "icon": "🏥"},
        {"name": "厚生年金", "type": "deduction", "icon": "📋"},
        {"name": "その他控除", "type": "deduction", "icon": "📄"},
    ]

    for cat in expense_categories + income_categories + deduction_categories:
        db.add(models.Category(**cat))

    db.commit()
    db.close()
    print("Seed data inserted.")

if __name__ == "__main__":
    seed()
