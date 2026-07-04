import os
import httpx

BASE_URL = os.getenv("HOUSEHOLD_API_URL", "http://localhost:8000")

async def api_get(path: str, params: dict = {}) -> dict | list:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}{path}", params=params)
        response.raise_for_status()
        return response.json()

async def api_post(path: str, body: dict) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}{path}", json=body)
        response.raise_for_status()
        return response.json()

async def api_put(path: str, body: dict) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.put(f"{BASE_URL}{path}", json=body)
        response.raise_for_status()
        return response.json()

async def api_delete(path: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.delete(f"{BASE_URL}{path}")
        response.raise_for_status()
        return response.json()