---
title: "LinuxQQ 在 Wayland 下的剪贴板同步（Fedora）"
description: "LinuxQQ 以 Wayland 运行时不与系统剪贴板互通，文字、图片都会双向粘贴失败。本文给出 Fedora 上的安装、验证与已知问题。"
date: 2026-11-16
updated: 2026-11-27
tags: [Linux, Fedora, Wayland]
---

## 概述

LinuxQQ 以 Wayland（`--ozone-platform=wayland`）运行时，剪贴板与系统其它应用互不可见：QQ 里复制的内容粘不出去，外面复制的内容也粘不进 QQ，图片与文件同样受影响。X11 会话下没有这个问题。

`linuxqq-clipsync` 是一个常驻的同步程序，在 X11 selection 与 Wayland 剪贴板之间双向搬运内容，使两侧看到同一份数据。它只处理剪贴板，不修复 QQ 的其它 Wayland 问题（屏幕共享、截图、共享声音等）。

## 原理

Wayland 的剪贴板由合成器管理，X11 的由 X server 管理，两套 selection 互不共享。

LinuxQQ 的窗口是 Wayland 的，但剪贴板操作仍走内部的 X11 client，于是形成两个方向的隔离：

- QQ 复制：内容写进 X11 selection，Wayland 应用读不到；
- 其它应用复制：内容在合成器，QQ 的 X11 client 读不到。

同步程序监听两侧变化并把内容写到对侧。GNOME 的 mutter 还会在 Wayland 侧变化后接管 X11 的 `CLIPBOARD`，这一行为在 0.1.0-2 起的版本中已做回写处理。

## 环境

| 项目 | 要求 |
|---|---|
| 发行版 | Fedora 44 / 45 / rawhide（x86_64、aarch64） |
| 桌面 | GNOME（适配 mutter 的 Xwayland 桥接行为） |
| QQ | LinuxQQ 3.x，Wayland 模式启动 |
| 依赖 | `xclip`、`wl-clipboard`，由 RPM 自动安装 |

## 安装

```bash
sudo dnf copr enable hrrzt/linuxqq-clipsync
sudo dnf install linuxqq-clipsync
```

COPR 是第三方仓库，启用前确认项目名为 `hrrzt/linuxqq-clipsync`。

以 systemd 用户服务常驻：

```bash
systemctl --user enable --now linuxqq-clipsync
systemctl --user status linuxqq-clipsync
```

不使用 systemd 时可直接运行 `linuxqq-clipsync`，自行加入自启动；两种方式只保留一个实例。

## 验证

```bash
# Wayland → X11
printf 'wl->x11' | wl-copy; sleep 0.3; xclip -sel clip -t UTF8_STRING -o

# X11 → Wayland
printf 'x11->wl' | xclip -sel clip -i -t UTF8_STRING; sleep 0.3; wl-paste -n
```

再在 QQ 里复制一段文字和一张图片，分别粘贴到浏览器或图片查看器，反向各测一次。图片应显示为图片，而不是文件路径。

## 已知问题

| 现象 | 原因 | 解决 |
|---|---|---|
| 复制图片 / GIF 后对侧只得到文件路径 | 旧版规则先匹配 `x-special/gnome-copied-files` | 升级到 `0.1.0-2` 及以上 |
| 日志出现 `读取 X11 TARGETS 失败`，同时 X11 应用粘贴失效 | mutter 的 Xwayland 桥接接管 X11 `CLIPBOARD` 后不响应转换 | 升级到 `0.1.0-2` 及以上；并确保只运行一个实例 |
| 同步偶尔漏一次 | 事件驱动，另有 200ms 防回声窗口 | 重新复制一次 |
| QQ 复制时闪退（日志 `signo 13`，SIGPIPE） | QQ 原生代码向已关闭的管道写入，崩溃栈位于 QQ 内部 | 与同步程序无直接关系；可用 X11 模式对照排查 |

## 限制

- 延迟为毫秒级；极高频连续复制可能漏一次。
- 只做剪贴板，不解决 QQ 的屏幕共享、截图与共享声音。
- Flatpak 版 QQ 运行在沙箱内，同步程序在沙箱外通常仍有效；失效时先用 RPM 版对照排查。
- 上游 `linuxqq-clipsync` 已停止维护，维护移交 `linuxqq-wayland-fix`；本 COPR 维护的是带上述修复的 fork。

## 参考

- 仓库：<https://github.com/h465855hgg/linuxqq-clipsync>
- COPR：<https://copr.fedorainfracloud.org/coprs/hrrzt/linuxqq-clipsync/>
- 继任项目：<https://github.com/SHORiN-KiWATA/linuxqq-wayland-fix>
