# tennis-court-cli

从 Android 手机上的韵动吧查询场馆、排期和畅打活动，输出 JSON。需要 Node.js 22.12+、Android Platform Tools，以及一台已解锁、已授权 ADB 并安装韵动吧的手机。已在韵动吧 Android 版 5.3.32 验证。

## 安装

```sh
npm install -g https://github.com/LampScript/tennis-court-cli/releases/download/v0.2.0/tennis-court-cli-0.2.0.tgz
tennis-court-cli --help
```

实时查询前，请确保 `adb devices` 显示手机状态为 `device`。仅查看接口清单时可以离线运行 `tennis-court-cli api describe`。

## 使用

```sh
tennis-court-cli auth status
tennis-court-cli auth login
tennis-court-cli venues --keyword 江湾 --pages 3
tennis-court-cli slots "从 venues 结果复制的完整场馆名" --at 19:00
tennis-court-cli play --pages 3
tennis-court-cli api describe
```

排期默认查询今天，可用 `--date YYYY-MM-DD` 指定场馆开放的其他日期。多台设备时在子命令前加 `--serial 设备序列号`。查询期间 CLI 会切换手机页面，请保持亮屏。城市和账号取自手机当前设置。登录需要时，在官方应用内完成验证。

`venues` 在读取的列表屏数内按名称和地址筛选；`slots` 用同一列表中的完整名称打开场馆，可用 `--pages` 扩大查找范围。排期返回界面中可识别的场地列、开始时间和显示值，默认向下读取最多六屏。可加 `--at 19:00` 只看指定开始时间。手机屏幕以外的横向场地列和未显示的日期不在结果中。`play` 读取首页畅打活动卡片，包含界面提供的时间、地点、报名状态及价格。查询不会提交订单或报名。

`api describe` 支持离线使用，列出从安装包 Hermes 字节码确认的生产域名、业务路由、字段和鉴权方式。实际查询由官方 App 完成网络请求；本工具不保存账号密码、短信验证码或会话 token。接口清单来自客户端静态分析，不能视为服务端 HTTP 直连测试结果。

## 本地开发

```sh
npm ci
npm run build
./tennis-court-cli --help
```
