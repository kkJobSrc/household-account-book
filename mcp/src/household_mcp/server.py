from fastmcp import FastMCP
from household_mcp.tools import categories, members, receipts, scheduled_transactions, transactions

mcp = FastMCP(
    name="household_mcp",
    instructions="家計簿アプリのMCPサーバー。収支・メンバー・カテゴリ・定期取引の記録・確認ができます。",
)

mcp.mount(transactions.mcp)
mcp.mount(members.mcp)
mcp.mount(categories.mcp)
mcp.mount(scheduled_transactions.mcp)
mcp.mount(receipts.mcp)


def main():
    mcp.run(transport="streamable-http", host="0.0.0.0", port=8001)