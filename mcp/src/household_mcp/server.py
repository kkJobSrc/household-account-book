from fastmcp import FastMCP
from household_mcp.tools import transactions

mcp = FastMCP(
    name="household_mcp",
    instructions="家計簿アプリのMCPサーバー。収支の記録・確認ができます。",
)

mcp.mount(transactions.mcp)


def main():
    mcp.run()