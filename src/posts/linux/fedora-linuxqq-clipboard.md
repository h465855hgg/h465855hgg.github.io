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
systemctl --user enable --now linuxqq-clipsync
```

## 说明

LinuxQQ 在 Wayland 下仍使用 X11 剪贴板，因此与 Wayland 应用双向粘贴失败。`linuxqq-clipsync` 常驻监听两侧，把剪贴板内容互相同步；0.1.0-2 起图片和 GIF 也能正常同步。

- 服务与手动运行只能留一个，否则两个实例会互抢剪贴板。
- 延迟为毫秒级，极高频复制可能漏一次，重新复制即可。
- 只处理剪贴板，不解决屏幕共享、截图等问题。
- 上游已停止维护，继任项目为 `linuxqq-wayland-fix`；本 COPR 维护的是带修复的 fork。

## 参考

- 仓库：<https://github.com/h465855hgg/linuxqq-clipsync>
- COPR：<https://copr.fedorainfracloud.org/coprs/hrrzt/linuxqq-clipsync/>
