"""Helpers for Points Engine Robot suites (unique data, flags, expiry copy)."""

from __future__ import annotations

import calendar
import json
import random
import urllib.request
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from robot.api import SkipExecution
from robot.api.deco import keyword, library

MINUS = "\u2212"
MONTH_ABBR = (
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
)


def _fmt(n: int) -> str:
    return f"{n:,}"


def _mysql_add_months(year: int, month: int, day: int, months: int) -> tuple[int, int, int]:
    idx = year * 12 + (month - 1) + months
    y = idx // 12
    m = idx % 12 + 1
    d = min(day, calendar.monthrange(y, m)[1])
    return y, m, d


@library
class PointsEngine:
    ROBOT_LIBRARY_SCOPE = "GLOBAL"

    @keyword
    def fetch_meta(self, base_url: str) -> dict:
        url = base_url.rstrip("/") + "/api/meta"
        with urllib.request.urlopen(url, timeout=15) as response:
            return json.loads(response.read().decode())

    @keyword
    def feature_flag_enabled(self, base_url: str, flag: str) -> bool:
        meta = self.fetch_meta(base_url)
        flags = meta.get("featureFlags") or {}
        return bool(flags.get(flag))

    @keyword
    def require_cancel_earn(self, base_url: str) -> None:
        if not self.feature_flag_enabled(base_url, "enable_cancel_earn"):
            raise SkipExecution("ENABLE_CANCEL_EARN is not enabled on this instance")

    @keyword
    def require_cancel_redeem(self, base_url: str) -> None:
        if not self.feature_flag_enabled(base_url, "enable_cancel_redeem"):
            raise SkipExecution("ENABLE_CANCEL_REDEEM is not enabled on this instance")

    @keyword
    def unique_member_name(self, prefix: str = "Robot Member") -> str:
        return f"{prefix} {datetime.now().strftime('%H%M%S')}{random.randint(10, 99)}"

    @keyword
    def unique_phone(self) -> str:
        return f"0917{random.randint(1000000, 9999999)}"

    @keyword
    def formatted_points(self, amount: int) -> str:
        return _fmt(int(amount))

    @keyword
    def signed_points(self, amount: int) -> str:
        n = int(amount)
        if n > 0:
            return f"+{_fmt(n)}"
        if n < 0:
            return f"{MINUS}{_fmt(abs(n))}"
        return _fmt(n)

    @keyword
    def next_expiration_copy(self, points: int, base_url: str) -> str:
        """Copy shown under Next expiration for earns logged now (same local calendar day)."""
        meta = self.fetch_meta(base_url)
        settings = meta["settings"]["expiration"]
        timezone = settings.get("timezone") or "Asia/Manila"
        interval = settings.get("interval") or "1_year"
        now = datetime.now(ZoneInfo(timezone))
        y, m, d = now.year, now.month, now.day
        if interval == "6_months":
            y, m, d = _mysql_add_months(y, m, d, 6)
        else:
            y, m, d = _mysql_add_months(y, m, d, 12)
        expire = date(y, m, d) + timedelta(days=1)
        phrase = f"{expire.day:02d} {MONTH_ABBR[expire.month - 1]} {expire.year} at 00:00"
        return f"{_fmt(int(points))} points expire on {phrase}"
