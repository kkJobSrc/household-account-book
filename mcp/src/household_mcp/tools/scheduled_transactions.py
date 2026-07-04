from household_mcp.client import api_get, api_post, api_put
from fastmcp import FastMCP
from typing import Annotated, Literal, Optional

from pydantic import Field

mcp = FastMCP("scheduled_transactions")


@mcp.tool()
async def get_scheduled_transactions(
    is_active: Optional[bool] = None,
) -> list[dict]:
    """定期取引の一覧を取得する。is_active で有効/無効に絞り込める。"""
    params = {}
    if is_active is not None:
        params["is_active"] = is_active
    return await api_get("/scheduled-transactions/", params)


@mcp.tool()
async def create_scheduled_transaction(
    name: str,
    trns_type: Literal["income", "expense", "deduction"],
    amount: Annotated[float, Field(gt=0)],
    day_of_month: Annotated[int, Field(ge=1, le=28)],
    category_id: Optional[int] = None,
    member_id: Optional[int] = None,
    memo: str = "",
    is_active: bool = True,
) -> dict:
    """定期取引を新規登録する。day_of_month は 1〜28 で指定する。"""
    return await api_post(
        "/scheduled-transactions/",
        {
            "name": name,
            "type": trns_type,
            "amount": amount,
            "day_of_month": day_of_month,
            "category_id": category_id,
            "member_id": member_id,
            "memo": memo,
            "is_active": is_active,
        },
    )


@mcp.tool()
async def update_scheduled_transaction(
    scheduled_id: int,
    name: Optional[str] = None,
    trns_type: Optional[Literal["income", "expense", "deduction"]] = None,
    amount: Optional[Annotated[float, Field(gt=0)]] = None,
    day_of_month: Optional[Annotated[int, Field(ge=1, le=28)]] = None,
    category_id: Optional[int] = None,
    member_id: Optional[int] = None,
    memo: Optional[str] = None,
    is_active: Optional[bool] = None,
    clear_category: bool = False,
    clear_member: bool = False,
) -> dict:
    """特定の定期取引を更新する。category/member の紐づけを外すには clear_category=True / clear_member=True を渡す。"""
    body: dict = {
        k: v
        for k, v in {
            "name": name,
            "type": trns_type,
            "amount": amount,
            "day_of_month": day_of_month,
            "memo": memo,
            "is_active": is_active,
        }.items()
        if v is not None
    }
    # nullable FK: None を明示的に送らないと FastAPI(exclude_unset=True) が変更しないため
    if clear_category:
        body["category_id"] = None
    elif category_id is not None:
        body["category_id"] = category_id

    if clear_member:
        body["member_id"] = None
    elif member_id is not None:
        body["member_id"] = member_id

    return await api_put(f"/scheduled-transactions/{scheduled_id}", body)


@mcp.tool()
async def apply_scheduled_transactions() -> dict:
    """定期取引を当月の取引として一括適用する。戻り値は applied（適用数）と skipped（スキップ数）。"""
    return await api_post("/scheduled-transactions/apply", {})
