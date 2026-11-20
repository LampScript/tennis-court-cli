"""韵动吧 Android 5.3.32 场馆查询。描述应用调用 request() 时的业务参数。"""

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

ORIGIN = "https://wxapi.sports8.com.cn"

ROUTES = {
    "venues": {
        "name": "按条件列出场馆",
        "path": "/api/ydb/stadium/v2/apiGetSearchStadiumByV2",
        "fields": ["cityid", "countyid", "reqKey", "type", "sort", "labels", "lat",
                   "lng", "date", "timePeriod", "pageIndex", "pageSize", "userid"],
        "result": ["stadiumList", "allStadiumList", "recommendStadiumList"],
        "evidence": "Hermes #25767–25770。依次取首个非空列表；网球 type=0，reqKey 初值 100，首页页码 1。",
    },
    "keyword": {
        "name": "按场馆名称搜索",
        "path": "/api/ydb/seach/apiSearchKeyword",
        "fields": ["type", "keyword", "longitude", "latitude", "cityid", "pageIndex", "pageSize"],
        "result": ["resultList"],
        "evidence": "Hermes #25776 与搜索页。App 传 type=1，首次取 50 条，结果按 resultType=2 筛选场馆。",
    },
    "detail": {
        "name": "场馆详情",
        "path": "/api/ydb/stadium/apiGetStadiumDetail",
        "fields": ["stadiumid", "userid", "lat", "lng"],
        "result": ["stadiumName"],
        "evidence": "Hermes #25735，以及场馆页对 useGetStadiumDetail 的调用。",
    },
    "slots": {
        "name": "普通场馆排期",
        "path": "/api/ydb/stadium/apiGetStadiumShedule",
        "fields": ["stadiumid", "date", "userid", "selfflag"],
        "result": ["dateList", "fieldList", "showhour"],
        "evidence": "Hermes #30123。date 是当地零点的 Unix 秒。fieldList 的 shedule 包含场地时段。",
    },
    "third-party-slots": {
        "name": "第三方场馆排期",
        "path": "/StadiumHelper/third/apiv3/product/book",
        "fields": ["stadium_id", "product_id", "ydbsp_time", "select_date",
                   "product_type", "selfflag"],
        "result": ["booking_ground_array", "detail_ground_names"],
        "evidence": "Hermes #30125。selfflag=2 使用此查询。book_price_infos 包含 booking_start_time、booking_price、booking_status。",
    },
}


def _request(route: str, data: dict) -> dict:
    return {
        "method": "POST",
        "url": ORIGIN + ROUTES[route]["path"],
        "data": {key: value for key, value in data.items() if value is not None},
    }


def _day_start(day: date) -> int:
    return int(datetime.combine(day, time.min, ZoneInfo("Asia/Shanghai")).timestamp())


def search_request(city_id: str, *, day: date | None = None,
                   time_period: str | None = None, page: int = 1, page_size: int = 10,
                   county_id: str | None = None, venue_type: int | None = 0,
                   sort: str | None = None, labels: str = "") -> dict:
    return _request("venues", {
        "cityid": city_id, "countyid": county_id, "reqKey": 100, "type": venue_type,
        "labels": labels, "sort": sort, "date": _day_start(day) if day else None,
        "timePeriod": time_period, "pageIndex": page, "pageSize": page_size,
    })


def keyword_request(city_id: str, keyword: str, *, page: int = 1, page_size: int = 50) -> dict:
    return _request("keyword", {
        "type": 1, "keyword": keyword, "cityid": city_id,
        "pageIndex": page, "pageSize": page_size,
    })


def detail_request(stadium_id: str) -> dict:
    return _request("detail", {"stadiumid": stadium_id})


def schedule_request(stadium_id: str, day: date, *, self_flag: str,
                     product_id: str | None = None) -> dict:
    selected_date = _day_start(day)
    if self_flag == "2":
        if not product_id:
            raise ValueError("第三方场馆需要 product_id")
        return _request("third-party-slots", {
            "stadium_id": stadium_id, "product_id": product_id, "select_date": selected_date,
            "product_type": self_flag, "selfflag": self_flag,
            "ydbsp_time": int(datetime.now().timestamp()),
        })
    return _request("slots", {
        "stadiumid": stadium_id, "date": selected_date, "selfflag": self_flag,
    })
