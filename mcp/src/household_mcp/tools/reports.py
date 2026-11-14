from household_mcp.client import api_get
from fastmcp import FastMCP
from typing import Annotated, Optional

from pydantic import Field

mcp = FastMCP("reports")

Year = Annotated[int, Field(ge=2000, le=2100)]
Month = Annotated[int, Field(ge=1, le=12)]


def _range_params(
    start_year: Optional[int],
    start_month: Optional[int],
    end_year: Optional[int],
    end_month: Optional[int],
) -> dict:
    # Validation (all-or-nothing, end >= start) is done by the backend
    return {
        k: v
        for k, v in {
            "start_year": start_year,
            "start_month": start_month,
            "end_year": end_year,
            "end_month": end_month,
        }.items()
        if v is not None
    }


@mcp.tool()
async def get_monthly_report(year: Year, month: Month) -> dict:
    """指定した年月の月次レポートを取得する。
    戻り値は summary（収入・支出・控除の合計と収支）、expense_by_category / income_by_category（カテゴリ別集計）、
    by_member（メンバー別集計）。"""
    return await api_get(f"/reports/monthly/{year}/{month}")


@mcp.tool()
async def get_range_summary(
    start_year: Optional[Year] = None,
    start_month: Optional[Month] = None,
    end_year: Optional[Year] = None,
    end_month: Optional[Month] = None,
) -> dict:
    """指定期間の収支サマリーを取得する。
    期間は start_year/start_month/end_year/end_month の4つをすべて指定するか（開始月・終了月を含む）、すべて省略する（全期間）。
    戻り値は period_label・total_income・total_expense・total_deduction・balance・by_category・by_member。"""
    return await api_get("/reports/range", _range_params(start_year, start_month, end_year, end_month))


@mcp.tool()
async def get_trend(
    months: Annotated[int, Field(ge=1, le=120)] = 12,
    start_year: Optional[Year] = None,
    start_month: Optional[Month] = None,
    end_year: Optional[Year] = None,
    end_month: Optional[Month] = None,
) -> list[dict]:
    """月ごとの収支推移を取得する。期間を省略すると当月までの直近 months か月を対象にする。
    期間指定時は start_year/start_month/end_year/end_month の4つをすべて指定する（開始月・終了月を含む）。
    戻り値は月ごとの year・month・total_income・total_expense・total_deduction・balance。取引のない月は含まれない。"""
    params = {"months": months, **_range_params(start_year, start_month, end_year, end_month)}
    return await api_get("/reports/trend", params)


@mcp.tool()
async def get_category_trend(
    months: Annotated[int, Field(ge=1, le=120)] = 12,
    start_year: Optional[Year] = None,
    start_month: Optional[Month] = None,
    end_year: Optional[Year] = None,
    end_month: Optional[Month] = None,
    category_ids: Optional[list[int]] = None,
) -> list[dict]:
    """カテゴリ別の月次推移を取得する。category_ids で対象カテゴリを絞り込める（省略時は全カテゴリ）。
    期間を省略すると当月までの直近 months か月を対象にする。
    期間指定時は start_year/start_month/end_year/end_month の4つをすべて指定する（開始月・終了月を含む）。
    戻り値は year・month・category_id・category_name・type・total の行の一覧。"""
    params: dict = {"months": months, **_range_params(start_year, start_month, end_year, end_month)}
    if category_ids:
        params["category_id"] = category_ids
    return await api_get("/reports/trend/by-category", params)
