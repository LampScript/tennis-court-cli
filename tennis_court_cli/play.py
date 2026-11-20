"""畅打查询的客户端参数，来自韵动吧 Android 5.3.32。"""

from datetime import date, datetime, time
from zoneinfo import ZoneInfo


LIST_PATH = "/YDBCLUB/service/personalCenter/activityList"
DETAIL_PATH = "/YDBCLUB/service/personalCenter/activityDetail"
SORT = {"default": "1", "nearby": "2", "recent": "3"}


def list_request(city_id: str, *, page: int = 1, sort: str = "default",
                 day: date | None = None) -> dict:
    """Return the request passed by FreePlayList to the app's network layer."""
    data = {
        "cityid": city_id,
        "flag": None,
        "status": 10,
        "typecode": None,
        "stadiumid": None,
        "orderType": SORT[sort],
        "pageSize": 10,
        "method": "Android.v30",
        "page": page,
    }
    if day is not None:
        zone = ZoneInfo("Asia/Shanghai")
        data["begin"] = int(datetime.combine(day, time.min, zone).timestamp())
        data["end"] = int(datetime.combine(day, time(23, 59, 59), zone).timestamp())
    return {"url": LIST_PATH, "data": data}


def detail_request(activity_id: str) -> dict:
    """Return the free-play detail query for a listed activity."""
    return {"url": DETAIL_PATH, "data": {"activityid": activity_id}}
