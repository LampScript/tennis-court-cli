# tennis-court-cli

TypeScript 编写的独立终端工具，通过 HTTPS 直接查询韵动吧官网公开的场馆目录。需要 Node.js 22.12+。可在 Mac 上使用系统定位，也可以在其他系统手动传入坐标。

## 安装

```sh
npm install -g https://github.com/LampScript/tennis-court-cli/releases/download/v0.3.0-alpha.2/tennis-court-cli-0.3.0-alpha.2.tgz
tennis-court-cli venues --city 上海市 --keyword 网球 --pages 2
```

## 定位和附近场馆

```sh
brew install --cask corelocationcli
tennis-court-cli location
tennis-court-cli nearby
```

首次定位时按 macOS 系统提示授权。若无法定位，请在「系统设置 → 隐私与安全性 → 定位服务」检查权限，并打开 Wi-Fi。`location` 在终端输出经纬度及水平精度（米）。`nearby` 将坐标发给韵动吧官网，按官网返回的距离排列首页推荐场馆。范围仅覆盖首页推荐名单。

也可以传入 WGS84 坐标查询指定地点，无需安装定位工具。以下为上海市中心示例坐标。

```sh
tennis-court-cli nearby --coords 31.2304,121.4737
```

## 预览版范围

`venues` 支持城市、关键词和分页。`api describe` 可离线查看以前从 Android 客户端整理的接口信息。普通场馆的排期查询需要自行提供服务方授权的签名程序。独立版暂未接通账户登录和畅打活动。历史 v0.2.0 使用 ADB 驱动手机，与本版本安装包独立。

## 普通场馆排期

`slots` 接受场馆 ID 或完整名称，日期默认上海当天。返回每个可订场地的名称、起止时间和实际价格（元）。第三方场馆排期格式尚未接入。

```sh
export TENNIS_COURT_SIGNER=/path/to/authorized-signer
tennis-court-cli slots 481 --date 2026-11-20
tennis-court-cli slots '6号网球中心' --city 上海市
```

环境变量指向本地可执行文件。程序从标准输入读取 JSON，其中包含 `url`、`method` 和业务字段 `data.stadiumid`、`data.date`（上海零点 Unix 秒）。程序向标准输出写入包含 `headers` 和 `body` 的 JSON，两者均为对象。CLI 将请求发送到固定的韵动吧排期地址。安装包未附签名程序或凭据。在没有授权签名程序的环境中，命令会提示缺少配置。

## 本地开发

```sh
npm ci
npm run build
./tennis-court-cli --help
```
