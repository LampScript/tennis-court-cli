"""Read the visible booking data through the installed Android client."""
import re
import subprocess
import time
from xml.etree import ElementTree

PACKAGE = "com.sports8.newtennis"


class Phone:
    def __init__(self, serial=None):
        self.adb = ["adb"] + (["-s", serial] if serial else [])

    def run(self, *args):
        p = subprocess.run(self.adb + list(map(str, args)), capture_output=True, timeout=30)
        if p.returncode:
            raise RuntimeError(p.stderr.decode().strip() or "ADB 操作失败")
        return p.stdout.decode()

    def screen(self):
        for attempt in range(3):
            data = self.run("exec-out", "uiautomator", "dump", "/dev/tty")
            end = data.find("</hierarchy>")
            if end >= 0:
                break
            time.sleep(.4)
        if end < 0:
            raise RuntimeError("无法读取手机界面，请解锁后重试")
        nodes = []
        for elem in ElementTree.fromstring(data[:end + 12]).iter("node"):
            if elem.get("package") != PACKAGE:
                continue
            bounds = tuple(map(int, re.findall(r"-?\d+", elem.get("bounds", ""))))
            if len(bounds) == 4 and bounds[0] < bounds[2] and bounds[1] < bounds[3]:
                nodes.append((elem.get("text", ""), elem.get("content-desc", ""), bounds))
        if not nodes:
            raise RuntimeError("韵动吧不在前台，请解锁手机并打开应用")
        return nodes

    def touch(self, bounds):
        x, y, right, bottom = bounds
        self.run("shell", "input", "tap", (x + right) // 2, (y + bottom) // 2)
        time.sleep(.4)

    def select(self, nodes, label):
        for text, desc, bounds in reversed(nodes):
            if label in (text, desc):
                self.touch(bounds)
                return
        raise ValueError(f"当前页面未找到「{label}」")

    def tab(self, label):
        self.run("shell", "am", "start", "-W", "-n", PACKAGE + "/.MainActivity")
        time.sleep(.6)
        for _ in range(6):
            nodes = self.screen()
            if any(text == "首页" for text, _, _ in nodes):
                self.select(nodes, label)
                return self.screen()
            self.run("shell", "input", "keyevent", 4)
            time.sleep(.35)
        raise RuntimeError("未找到应用首页，请在手机上返回首页")

    def swipe(self, nodes):
        width = max(b[2] for _, _, b in nodes)
        height = max(b[3] for _, _, b in nodes)
        self.run("shell", "input", "swipe", width // 2, height * 3 // 4,
                 width // 2, height * 2 // 5, 480)
        time.sleep(.45)

    def venue_list(self):
        self.select(self.tab("订场"), "全部场馆")
        self.select(self.screen(), "网球")
        return self.screen()

    def venues(self, pages, keyword="", open_name=None):
        nodes = self.venue_list()
        result = {}
        for page in range(pages):
            for _, desc, box in nodes:
                if ", " not in desc or not re.search(r"(?:收藏|已订|￥|¥)", desc):
                    continue
                fields = desc.split(", ")
                name = fields[0]
                if open_name and name == open_name:
                    self.touch(box)
                    return self.screen()
                if keyword in desc:
                    result[name] = {"name": name, "summary": desc}
            if page + 1 < pages:
                self.swipe(nodes)
                nodes = self.screen()
        if open_name:
            raise ValueError(f"前 {pages} 屏未找到「{open_name}」，请用 venues 确认场馆名或增大 --pages")
        return list(result.values())

    def slots(self, name, date, pages, scrolls):
        detail = self.venues(pages, open_name=name)
        if any(t == date for t, _, _ in detail):
            self.select(detail, date)
        else:
            self.select(detail, "立即预订")
        nodes = self.screen()
        date_tab = next((b for _, d, b in nodes if d.endswith(", " + date)), None)
        if date_tab is None:
            raise ValueError(f"当前场馆可见的预约日期中没有 {date}")
        self.touch(date_tab)
        nodes = self.screen()
        result = {}
        columns = []
        for page in range(scrolls):
            times = [(b[1] + (b[3]-b[1])//2, t) for t, _, b in nodes if re.fullmatch(r"\d\d:\d\d", t)]
            if not times:
                raise ValueError("当前场馆未显示可读取的时间表")
            top = min(y for y, _ in times)
            columns = columns or [(b[0], b[2], t) for t, _, b in nodes
                       if t and b[0] > 0 and 0 <= top-b[3] < b[3]-b[1]+20
                       and b[2]-b[0] >= 2*(b[3]-b[1])]
            for _, desc, b in nodes:
                if not desc:
                    continue
                court = next((t for left, right, t in columns if left == b[0] and right == b[2]), None)
                # Time-axis labels are centred on the top boundary of each cell.
                row_y, hour = min(times, key=lambda p: abs(p[0]-b[1]))
                if court and abs(row_y-b[1]) <= 6:
                    result[(court, hour)] = {"court": court, "start": hour, "display": desc}
            if page+1 < scrolls:
                previous = nodes
                self.swipe(nodes)
                nodes = self.screen()
                if nodes == previous:
                    break
        if not result:
            raise ValueError("未识别到场地和时间格，请在手机核对该场馆排期")
        return list(result.values())

    def play(self, pages):
        nodes = self.tab("首页")
        if any("畅打活动" in (t,d) for t,d,_ in nodes):
            self.select(nodes, "畅打活动")
            nodes = self.screen()
        cards = {}
        for page in range(pages):
            for _, desc, box in nodes:
                fields = desc.split(", ")
                when = next((f for f in fields if re.search(r"\d\d:\d\d[-~]\d\d:\d\d", f)), None)
                if len(fields) < 3 or not when or ("#网球" not in desc and "畅打" not in desc):
                    continue
                key = (fields[0], fields[1], when)
                card = cards.setdefault(key, {"title": fields[0], "club": fields[1], "time": when})
                if len(desc) > len(card.get("summary", "")):
                    card["summary"] = desc
                for text, _, child in nodes:
                    if (re.fullmatch(r"[¥￥]\s*[\d.]+", text)
                            and box[0] <= child[0] and child[2] <= box[2]
                            and box[1] <= child[1] and child[3] <= box[3]):
                        card["price"] = text
            if page+1 < pages:
                self.swipe(nodes)
                nodes = self.screen()
        return list(cards.values())

    def auth(self, login):
        nodes = self.tab("我的")
        labels = [t for t, _, _ in nodes if t]
        entry = next((t for t in labels if "登录" in t), None)
        if entry and login:
            self.select(nodes, entry)
            return {"status": "login_required", "next": "在手机上完成登录后运行 auth status"}
        if entry:
            return {"status": "login_required"}
        if any("天陪伴" in t or "韵动吧已陪你" in t for t in labels):
            return {"status": "signed_in", "source": "韵动吧个人主页"}
        return {"status": "unknown", "source": "韵动吧个人主页"}
