---
title: "LinuxQQ 在 Wayland 下的剪贴板同步（Fedora）"
description: "用 linuxqq-clipsync 解决 LinuxQQ 在 Wayland 下与系统剪贴板不通的问题。"
date: 2026-11-16
updated: 2026-11-27
tags: [Linux, Fedora, Wayland]
---

LinuxQQ 在 Wayland 下仍使用 X11 剪贴板，与系统剪贴板双向不通。[linuxqq-clipsync](https://github.com/h465855hgg/linuxqq-clipsync) 在两侧做同步。

## 安装

```bash
sudo dnf copr enable hrrzt/linuxqq-clipsync
sudo dnf install linuxqq-clipsync
```

## 常驻

```bash
systemctl --user enable --now linuxqq-clipsync
systemctl --user status linuxqq-clipsync
journalctl --user -u linuxqq-clipsync -f
```

随登录启动，不需要 `loginctl enable-linger`。关闭：`systemctl --user disable --now linuxqq-clipsync`。

## 注意

- 服务与手动运行只能留一个。
- 0.1.0-2 起图片、GIF 正常同步。
- 上游已停止维护，继任项目 `linuxqq-wayland-fix`。
