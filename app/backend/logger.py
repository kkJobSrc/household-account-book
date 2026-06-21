import logging
import os
from datetime import datetime


LOG_DIR = os.getenv("LOG_DIR", "/app/logs")


class _DailyFileHandler(logging.FileHandler):
    """ログ書き込み時に日付が変わっていれば新しいファイルへ切り替える。"""

    def __init__(self, log_dir: str, prefix: str):
        self._log_dir = log_dir
        self._prefix = prefix
        self._current_date = datetime.now().date()
        os.makedirs(log_dir, exist_ok=True)
        super().__init__(self._filepath(), encoding="utf-8")

    def _filepath(self) -> str:
        return os.path.join(self._log_dir, f"{self._prefix}_{self._current_date}.log")

    def emit(self, record: logging.LogRecord) -> None:
        today = datetime.now().date()
        if today != self._current_date:
            self._current_date = today
            self.close()
            self.baseFilename = os.path.abspath(self._filepath())
            self.stream = self._open()
        super().emit(record)


def _build_logger(name: str, prefix: str, level: int) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(level)
    if not logger.handlers:
        handler = _DailyFileHandler(LOG_DIR, prefix)
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
        )
        logger.addHandler(handler)
    logger.propagate = False
    return logger


error_logger = _build_logger("kakeibo.error", "error", logging.ERROR)
db_logger = _build_logger("kakeibo.db", "db", logging.INFO)
