---
title: "LinuxQQ 在 Wayland 下的剪贴板同步（Fedora）"
description: "LinuxQQ 运行于 Wayland 时与系统剪贴板互不相通，表现为双向粘贴失败。本文说明其原理、在 Fedora 上的安装配置方法、验证步骤及替代方案。"
date: 2026-11-16
tags: [Linux, Fedora, Wayland]
---

## 概述

LinuxQQ 在 Wayland 会话下运行时，QQ 与系统剪贴板互不可见：在 QQ 内复制的内容无法粘贴到其他应用，其他应用复制的内容也无法粘贴到 QQ；图片与文件同样受影响。该问题在 X11 会话下不存在。

在 Fedora 上可通过安装 `hrrzt/linuxqq-clipsync` 解决。该程序在 X11 与 Wayland 两侧剪贴板之间做双向同步。

## 原理

Wayland 中剪贴板由合成器（compositor）统一管理，X11 中则由 X server 管理，两套 selection 互不共享。

LinuxQQ 的窗口运行于 Wayland，但部分剪贴板操作仍由内部的 X11 client 完成。由此产生两个方向的隔离：

- QQ 复制 → 内容写入 X11 selection → Wayland 应用读取不到；
- 其他应用复制 → 内容位于合成器 → QQ 的 X11 client 读取不到。

同步程序的作用是在两侧之间搬运剪贴板内容，使双方看到同一份数据。

## 安装

`linuxqq-clipsync` 由 Fedora COPR 提供，覆盖 Fedora 44–45 与 rawhide（x86_64、aarch64）：

```bash
sudo dnf copr enable hrrzt/linuxqq-clipsync
sudo dnf install linuxqq-clipsync
```

依赖 `xclip`（X11 侧）与 `wl-clipboard`（Wayland 侧），由 RPM 自动安装。

## 使用

以 systemd 用户服务方式常驻：

```bash
systemctl --user enable --now linuxqq-clipsync
systemctl --user status linuxqq-clipsync
```

不使用 systemd 时可直接运行同名命令 `linuxqq-clipsync`，自行加入自启动。

3. 使用截图工具复制图片，粘贴到 QQ 中。三项均通过即表示文本与图片同步均正常。

## 替代方案

| 方案 | 做法 | 代价 |
|---|---|---|
| 强制 QQ 使用 X11 / XWayland | QQ 完全运行于 X11，两侧同源 | 高分屏缩放、输入法、屏幕共享可能退化 |
| xwayclip 等通用同步工具 | 通用的 X11 ↔ Wayland 双向同步 | 需自行配置自启，行为不一定适配 QQ |
| linuxqq-wayland-fix | 上游继任项目，同时处理剪贴板、屏幕共享与共享声音 | 目前主要为 AUR 包，Fedora 需自行构建 |
| 等待上游修复 | — | 时间不可控 |

`linuxqq-clipsync` 原仓库已归档，维护工作移交 `linuxqq-wayland-fix`；Fedora 的 COPR 包当前仍可用。

## 注意

- COPR 为第三方非官方仓库，启用前确认项目名为 `hrrzt/linuxqq-clipsync`。
- 同步为事件驱动加轮询，存在毫秒级延迟；极高频连续复制时可能漏一次，重新复制即可。
- 若 QQ 通过 Flatpak 安装，同步程序运行于沙箱之外，通常仍有效；若失效，可先用 RPM 版本对照排查 Flatpak 的剪贴板权限。
