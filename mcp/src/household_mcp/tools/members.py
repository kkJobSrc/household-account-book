from household_mcp.client import api_get, api_post, api_put
from fastmcp import FastMCP
from typing import Optional

mcp = FastMCP("members")


@mcp.tool()
async def get_members() -> list[dict]:
    """メンバーの一覧を取得する。"""
    return await api_get("/members/")


@mcp.tool()
async def get_member(member_id: int) -> dict:
    """特定のメンバーを取得する。"""
    return await api_get(f"/members/{member_id}")


@mcp.tool()
async def create_member(name: str, color: str = "#4A90D9") -> dict:
    """メンバーを新規登録する。"""
    return await api_post("/members/", {"name": name, "color": color})


@mcp.tool()
async def update_member(
    member_id: int,
    name: Optional[str] = None,
    color: Optional[str] = None,
) -> dict:
    """特定のメンバー情報を更新する。"""
    body = {k: v for k, v in {"name": name, "color": color}.items() if v is not None}
    return await api_put(f"/members/{member_id}", body)
