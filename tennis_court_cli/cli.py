import argparse
import json
import subprocess
import sys
from datetime import date, datetime
from .phone import Phone

def positive(s):
    n = int(s)
    if n < 1:
        raise argparse.ArgumentTypeError("请输入正整数")
    return n

def hour_minute(value):
    return datetime.strptime(value, "%H:%M").strftime("%H:%M")


def main():
    parser = argparse.ArgumentParser(description="通过已连接的 Android 手机查询韵动吧，输出 JSON")
    parser.add_argument("--serial", help="adb 设备序列号")
    commands = parser.add_subparsers(dest="command", required=True)
    venues = commands.add_parser("venues", help="列出当前城市的网球场馆")
    venues.add_argument("--keyword", default="", help="按名称或地址筛选")
    slots = commands.add_parser("slots", help="查询场馆各片场地的时间格")
    slots.add_argument("venue", help="venues 输出的完整名称")
    slots.add_argument("--date", type=date.fromisoformat, default=date.today(), help="YYYY-MM-DD")
    slots.add_argument("--at", type=hour_minute, help="只显示该开始时间，例如 19:00")
    slots.add_argument("--scrolls", type=positive, default=6, help="时间表最多读取屏数，默认 6")
    play = commands.add_parser("play", help="查询首页畅打活动")
    for sub in (venues, slots, play):
        sub.add_argument("--pages", type=positive, default=1, help="读取列表屏数，默认 1")
    auth = commands.add_parser("auth", help="查看手机登录状态或打开登录入口")
    auth.add_argument("action", choices=["status", "login"])
    api = commands.add_parser("api", help="查看 APK 中确认的业务接口")
    api.add_argument("action", choices=["describe"])
    args = parser.parse_args()
    device = Phone(args.serial)
    if args.command == "venues":
        data = device.venues(args.pages, args.keyword)
    elif args.command == "slots":
        delta = (args.date - date.today()).days
        if delta < 0 or delta > 365:
            parser.error("日期须在未来一年内（含今天）")
        data = device.slots(args.venue, args.date.strftime("%m/%d"), args.pages, args.scrolls)
        if args.at:
            data = [row for row in data if row["start"] == args.at]
    elif args.command == "play":
        data = device.play(args.pages)
    elif args.command == "auth":
        data = device.auth(args.action == "login")
    else:
        from . import venues as venue_api
        from . import play as play_api
        data = {
            "app": "韵动吧 Android 5.3.32", "origin": venue_api.ORIGIN,
            "transport": "POST JSON，App 公共请求层附加会话信息并签名",
            "venues": venue_api.ROUTES,
            "play_list_example": play_api.list_request("<cityid>"),
            "play_detail_example": play_api.detail_request("<activityid>"),
            "auth": {"password": "/api/ydb/account/userLogin",
                     "send_sms": "/api/ydb/account/v1/apiSendMobileSms",
                     "sms_login": "/api/ydb/account/quickLogin",
                     "session": ["Authorization: Bearer", "appSessionId", "appVersion"]},
        }
    print(json.dumps(data, ensure_ascii=False, indent=2))

def entrypoint():
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as exc:
        sys.exit(str(exc))
