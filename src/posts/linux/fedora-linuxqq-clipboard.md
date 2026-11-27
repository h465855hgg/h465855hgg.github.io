---
title: "LinuxQQ 在 Wayland 下的剪贴板同步（Fedora）"
description: "LinuxQQ 以 Wayland 运行时与系统剪贴板互不相通，用 linuxqq-clipsync 在两侧双向同步。"
date: 2026-11-16
updated: 2026-11-27
tags: [Linux, Fedora, Wayland]
---

## 概述

LinuxQQ 以 Wayland（`--ozone-platform=wayland`）运行时，剪贴板与系统其它应用互不可见：QQ 里复制的文字、图片粘不出去，外面复制的也粘不进 QQ。原因是 QQ 的窗口是 Wayland 的，剪贴板操作仍走内部的 X11 client。

[linuxqq-clipsync](https://github.com/h465855hgg/linuxqq-clipsync) 常驻监听两侧，把 X11 selection 与 Wayland 剪贴板的内容互相同步。它只处理剪贴板，不解决屏幕共享、截图等问题。

## 环境

| 项目 | 值 |
| --- | --- |
| 发行版 | Fedora 44 / 45 / rawhide（x86_64、aarch64） |
| 桌面 | GNOME |
| QQ | LinuxQQ 3.x，Wayland 模式启动 |
| 依赖 | `xclip`、`wl-clipboard`（RPM 自动安装） |

## 安装

```bash
sudo dnf copr enable hrrzt/linuxqq-clipsync
sudo dnf install linuxqq-clipsync
```

## 常驻与自启动

包内自带 systemd 用户服务，`WantedBy=graphical-session.target`，登录图形会话后启动：

```bash
systemctl --user enable --now linuxqq-clipsync
systemctl --user status linuxqq-clipsync
journalctl --user -u linuxqq-clipsync -f
```

进程异常退出时 3 秒后自动拉起（`Restart=always`）。**不需要 `loginctl enable-linger`**：linger 用于未登录也要运行的服务，而剪贴板同步依赖图形会话。

关闭自启：

```bash
systemctl --user disable --now linuxqq-clipsync
```

不用 systemd 时可直接运行 `linuxqq-clipsync` 并自行加入自启动；服务与手动运行只能留一个。

## 参考

- [COPR：hrrzt/linuxqq-clipsync](https://copr.fedorainfracloud.org/coprs/hrrzt/linuxqq-clipsync/)
- [linuxqq-clipsync](https://github.com/h465855hgg/linuxqq-clipsync)
- [linuxqq-clipsync](https://github.com/W-874/linuxqq-clipsync)
- [linuxqq-clipsync](https://github.com/SHORiN-KiWATA/linuxqq-clipsync)
