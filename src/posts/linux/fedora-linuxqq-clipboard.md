---
title: "LinuxQQ 在 Wayland 下的剪贴板同步（Fedora）"
description: "LinuxQQ 以 Wayland 运行时与系统剪贴板互不相通，用 linuxqq-clipsync 做双向同步。"
date: 2026-11-16
updated: 2026-11-27
tags: [Linux, Fedora, Wayland]
---

## 安装

```bash
sudo dnf copr enable hrrzt/linuxqq-clipsync
sudo dnf install linuxqq-clipsync
```

## 常驻与自启动

包内自带 systemd 用户服务，启用后随登录自动启动：

```bash
systemctl --user enable --now linuxqq-clipsync   # 立即启动，并设为登录自启
systemctl --user status linuxqq-clipsync         # 查看状态
journalctl --user -u linuxqq-clipsync -f         # 跟踪日志
```

服务文件为 `/usr/lib/systemd/user/linuxqq-clipsync.service`，`WantedBy=graphical-session.target`，在图形会话建立后启动；进程异常退出时 3 秒后自动拉起（`Restart=always`）。

不需要 `loginctl enable-linger`：linger 用于“未登录也要运行”的服务，而剪贴板同步依赖图形会话。

停止或取消自启：

```bash
systemctl --user disable --now linuxqq-clipsync
```

不用 systemd 时也可以直接运行 `linuxqq-clipsync`，自行加入桌面自启动；注意服务与手动运行只能留一个。

## 说明

LinuxQQ 在 Wayland 下仍使用 X11 剪贴板，因此与 Wayland 应用双向粘贴失败。`linuxqq-clipsync` 常驻监听两侧，把剪贴板内容互相同步；0.1.0-2 起图片和 GIF 也能正常同步。

- 服务与手动运行只能留一个，否则两个实例会互抢剪贴板。
- 延迟为毫秒级，极高频复制可能漏一次，重新复制即可。
- 只处理剪贴板，不解决屏幕共享、截图等问题。
- 上游已停止维护，继任项目为 `linuxqq-wayland-fix`；本 COPR 维护的是带修复的 fork。

## 参考

- 仓库：<https://github.com/h465855hgg/linuxqq-clipsync>
- COPR：<https://copr.fedorainfracloud.org/coprs/hrrzt/linuxqq-clipsync/>
