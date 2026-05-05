Start the household account book app with Docker Compose (background mode, no rebuild).

```bash
cd /home/kobayashi/household-account-book/household_account_book_app && docker compose up -d
```

After running, confirm the containers are up:

```bash
docker ps --filter "name=kakeibo"
```

Report the result to the user, including the URLs:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
