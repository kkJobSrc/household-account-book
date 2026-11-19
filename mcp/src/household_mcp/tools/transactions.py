import datetime
from household_mcp.client import api_get, api_post, api_put, api_delete
from fastmcp import FastMCP
from typing import Annotated, Literal, Optional

from pydantic import Field

mcp = FastMCP("transactions")

TransactionType = Literal["income", "expense", "deduction"]
# Amount must be positive, matching the backend schema (float, gt=0)
Amount = Annotated[float, Field(gt=0)]


@mcp.tool()
async def get_transactions(
    year: Optional[Annotated[int, Field(ge=2000, le=2100)]] = None,
    month: Optional[Annotated[int, Field(ge=1, le=12)]] = None,
    trns_types: Optional[list[TransactionType]] = None,
    member_ids: Optional[list[int]] = None,
    category_ids: Optional[list[int]] = None,
    date_from: Optional[datetime.date] = None,
    date_to: Optional[datetime.date] = None,
    sort_by: Literal["date", "amount", "created_at"] = "date",
    sort_order: Literal["asc", "desc"] = "desc",
    skip: Annotated[int, Field(ge=0)] = 0,
    limit: Annotated[int, Field(ge=1, le=1000)] = 100,
) -> list[dict]:
    """収支の一覧を取得する。
    絞り込み条件はすべて AND で結合され、trns_types / member_ids / category_ids はリスト内で OR になる。
    year/month は日付の年・月で絞り込む。date_from/date_to は YYYY-MM-DD 形式で、両端を含む。
    件数は skip/limit でページングする（既定 100 件）。合計値が欲しい場合は get_monthly_report / get_range_summary を使う。"""
    params: dict = {
        "sort_by": sort_by,
        "sort_order": sort_order,
        "skip": skip,
        "limit": limit,
    }
    if year is not None:
        params["year"] = year
    if month is not None:
        params["month"] = month
    # List values are sent as repeated query keys (?type=a&type=b)
    if trns_types:
        params["type"] = trns_types
    if member_ids:
        params["member_id"] = member_ids
    if category_ids:
        params["category_id"] = category_ids
    if date_from is not None:
        params["date_from"] = date_from.isoformat()
    if date_to is not None:
        params["date_to"] = date_to.isoformat()
    return await api_get("/transactions/", params)


@mcp.tool()
async def get_transaction(transaction_id: int) -> dict:
    """特定の収支記録を取得する。"""
    return await api_get(f"/transactions/{transaction_id}")


@mcp.tool()
async def delete_transaction(transaction_id: int) -> dict:
    """特定の収支記録を削除する。"""
    return await api_delete(f"/transactions/{transaction_id}")


@mcp.tool()
async def update_transaction(
    transaction_id: int,
    trns_type: Optional[TransactionType] = None,
    amount: Optional[Amount] = None,
    reg_date: Optional[datetime.date] = None,
    memo: Optional[str] = None,
    member_id: Optional[int] = None,
    category_id: Optional[int] = None,
    clear_member: bool = False,
    clear_category: bool = False,
) -> dict:
    """特定の収支記録を部分更新する。指定した項目だけが変更され、省略した項目は元の値のまま残る。
    reg_date は YYYY-MM-DD 形式。メモを空にするには memo="" を渡す。
    member/category の紐づけを外すには clear_member=True / clear_category=True を渡す。"""
    body: dict = {
        k: v
        for k, v in {
            "type": trns_type,
            "amount": amount,
            "date": reg_date.isoformat() if reg_date is not None else None,
            "memo": memo,
        }.items()
        if v is not None
    }
    # Nullable FK: None must be sent explicitly, otherwise the backend
    # (model_dump(exclude_unset=True)) leaves the field unchanged
    if clear_member:
        body["member_id"] = None
    elif member_id is not None:
        body["member_id"] = member_id

    if clear_category:
        body["category_id"] = None
    elif category_id is not None:
        body["category_id"] = category_id

    return await api_put(f"/transactions/{transaction_id}", body)


@mcp.tool()
async def create_transaction(
    trns_type: TransactionType,
    amount: Amount,
    reg_date: datetime.date,
    memo: str = "",
    member_id: Optional[int] = None,
    category_id: Optional[int] = None,
) -> dict:
    """収支を新規登録する。reg_date は YYYY-MM-DD 形式、amount は 0 より大きい値。"""
    return await api_post(
        "/transactions/",
        {
            "type": trns_type,
            "amount": amount,
            "date": reg_date.isoformat(),
            "memo": memo,
            "member_id": member_id,
            "category_id": category_id,
        },
    )


@mcp.tool()
async def link_receipt_images(
    transaction_id: int,
    receipt_image_ids: list[int],
) -> dict:
    """取引にレシート画像を紐付ける。"""
    return await api_post(
        f"/transactions/{transaction_id}/receipt-images",
        {"receipt_image_ids": receipt_image_ids},
    )


@mcp.tool()
async def unlink_receipt_image(
    transaction_id: int,
    receipt_image_id: int,
) -> dict:
    """取引とレシート画像の紐付けを解除する。"""
    return await api_delete(f"/transactions/{transaction_id}/receipt-images/{receipt_image_id}")
