from household_mcp.client import api_get, api_post, api_put, api_delete
from fastmcp import FastMCP
from typing import Literal, Optional

import httpx
import os

mcp = FastMCP("transactions")


@mcp.tool()
async def get_transactions() -> list[dict]:
    """収支の一覧を取得する。"""
    return await api_get(f"/transactions/")


@mcp.tool()
async def get_transaction(transaction_id : int) -> dict:
    """特定の収支記録を取得する"""
    return await api_get(f"/transactions/{transaction_id}")


@mcp.tool()
async def delete_transaction(transaction_id : int) -> dict:
    """特定の収支記録を削除する"""
    return await api_delete(f"/transactions/{transaction_id}")


@mcp.tool()
async def update_transaction(
    transaction_id : int,
    trns_type: Literal['income','expense','deduction'],
    amount: int,
    reg_date: str,
    memo:str= "",
    member_id: Optional[int] = None,
    category_id: Optional[int] = None
) -> dict:
    """特定の収支記録を更新する"""
    return await api_put(f"/transactions/{transaction_id}", 
            {
                "type": trns_type,
                "amount": amount,
                "date": reg_date,
                "memo": memo,
                "member_id": member_id,
                "category_id": category_id
            })


@mcp.tool()
async def create_transaction(
    trns_type: Literal['income','expense','deduction'],
    amount: int,
    reg_date: str,
    memo:str= "",
    member_id: Optional[int] = None,
    category_id: Optional[int] = None
) -> dict:
    """収支を新規登録する"""
    return await api_post(f"/transactions/",
            {
                "type": trns_type,
                "amount": amount,
                "date": reg_date,
                "memo": memo,
                "member_id": member_id,
                "category_id": category_id
            })
