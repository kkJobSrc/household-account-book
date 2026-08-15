from household_mcp.client import api_get
from fastmcp import FastMCP
from typing import Optional

mcp = FastMCP("receipts")


@mcp.tool()
async def get_receipt_ocr_result(receipt_image_id: int) -> dict:
    """特定のレシート画像の最新のOCR結果を取得する。"""
    return await api_get(f"/receipt-images/{receipt_image_id}/ocr-result")


@mcp.tool()
async def list_receipt_images(
    ocr_status: Optional[str] = None,
    linked: Optional[bool] = None,
) -> list[dict]:
    """レシート画像の一覧を取得する。OCRステータスや取引への紐付け状態で絞り込める。"""
    params = {k: v for k, v in {"ocr_status": ocr_status, "linked": linked}.items() if v is not None}
    return await api_get("/receipt-images/", params)
