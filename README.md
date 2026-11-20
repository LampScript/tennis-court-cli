# tennis-court-cli

TypeScript 编写的独立终端工具，通过 HTTPS 直接查询韵动吧官网公开的场馆目录。需要 Node.js 22.12+。可在 Mac 上使用系统定位，也可以在其他系统手动传入坐标。

## 安装

```sh
npm install -g https://github.com/LampScript/tennis-court-cli/releases/download/v0.3.0-alpha.1/tennis-court-cli-0.3.0-alpha.1.tgz
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

`venues` 支持城市、关键词和分页。`api describe` 可离线查看以前从 Android 客户端整理的接口信息。独立版暂未接通账户登录、实时排期及畅打活动。历史 v0.2.0 使用 ADB 驱动手机，与本版本安装包独立。

## 本地开发

```sh
npm ci
npm run build
./tennis-court-cli --help
```
