---
title: "Fedora 上修复 LinuxQQ 剪贴板不同步"
description: "Wayland 下 QQ 和系统剪贴板互不相通，两条命令解决。"
date: 2026-11-16
tags: [Linux, Fedora, Wayland]
---

**有什么用**：让 QQ 和系统剪贴板互通——QQ 里复制的能在别处粘，别处复制的能粘进 QQ，图片也正常。

**为什么会坏**：QQ 窗口跑在 Wayland 上，但一部分剪贴板操作仍由内部的 X11 client 完成。Wayland 的剪贴板归合成器管，X11 的归 X server 管，两边互不可见。

**怎么修**：装一个在两侧之间搬运的同步守护进程。

```bash
sudo dnf copr enable walker874/linuxqq-clipsync
sudo dnf install linuxqq-clipsync
```

**开机自启**：

```bash
systemctl --user enable --now linuxqq-clipsync
```

**验证**：

```bash
# QQ 里复制一段文字，然后在终端
wl-paste

# 终端复制，再粘进 QQ
echo hello | wl-copy
```

截图工具里复制张图，粘进 QQ 能出来，就算完整可用。

**如果不想用这个包**：

- 让 QQ 走 XWayland 启动，两边都在 X11 世界，问题消失（代价是缩放和输入法可能退化）；
- 用上游继任项目 [linuxqq-wayland-fix](https://github.com/SHORiN-KiWATA/linuxqq-wayland-fix)，同时修剪贴板、屏幕共享和共享声音，目前主要是 AUR 包。

COPR 是第三方源，项目名是 `walker874/linuxqq-clipsync`。
