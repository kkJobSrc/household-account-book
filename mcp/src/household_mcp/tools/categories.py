from household_mcp.client import api_get, api_post, api_put
from fastmcp import FastMCP
from typing import Literal, Optional

mcp = FastMCP("categories")


@mcp.tool()
async def get_categories(
    trns_type: Optional[Literal["income", "expense", "deduction"]] = None,
) -> list[dict]:
    """カテゴリの一覧を取得する。trns_type で income/expense/deduction に絞り込める。"""
    params = {}
    if trns_type is not None:
        params["type"] = trns_type
    return await api_get("/categories/", params)


@mcp.tool()
async def create_category(
    name: str,
    trns_type: Literal["income", "expense", "deduction"],
    icon: str = "",
    memo: str = "",
) -> dict:
    """カテゴリを新規登録する。"""
    return await api_post(
        "/categories/",
        {"name": name, "type": trns_type, "icon": icon, "memo": memo},
    )


@mcp.tool()
async def update_category(
    category_id: int,
    name: Optional[str] = None,
    trns_type: Optional[Literal["income", "expense", "deduction"]] = None,
    icon: Optional[str] = None,
    memo: Optional[str] = None,
) -> dict:
    """特定のカテゴリ情報を更新する。"""
    body = {
        k: v
        for k, v in {
            "name": name,
            "type": trns_type,
            "icon": icon,
            "memo": memo,
        }.items()
        if v is not None
    }
    return await api_put(f"/categories/{category_id}", body)
