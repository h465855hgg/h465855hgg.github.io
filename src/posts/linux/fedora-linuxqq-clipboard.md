---
title: "Fedora 上修好 LinuxQQ 的剪贴板：linuxqq-clipsync"
description: "Fedora + Wayland 下 QQ 和系统剪贴板互相看不见，复制粘贴像两个世界。用 COPR 上的 linuxqq-clipsync 一个包解决，顺带说清原理和几种替代方案。"
date: 2026-11-16
tags: [Linux, Fedora, Wayland, 踩坑]
---

在 Fedora 上用 QQ 的同学大概率都遇到过这个：QQ 里复制一段话，切到浏览器粘贴——空的；反过来从终端复制，粘进 QQ——也是空的。文字时好时坏，图片和文件基本必挂。

这不是 QQ 坏了，也不是桌面环境的问题，而是 **Wayland 和 X11 两套剪贴板各干各的**。

## 为什么会不同步

Wayland 下剪贴板的所有权归合成器（compositor），谁复制了什么、谁能粘贴，全由它仲裁。而 X11 的剪贴板是 X server 里的一套 selection，跟 Wayland 完全不通。

问题在于：QQ 的窗口已经跑在 Wayland 上，但它内部有一部分剪贴板操作仍然是交给一个隐藏的 X11 client 去做的。于是：

- 你在 QQ 里复制，内容写进了 **X11 的 selection**，Wayland 应用读不到；
- 你在别的应用复制，内容在 **compositor 里**，QQ 内部那个 X11 client 也读不到。

两边都在正常工作，只是彼此看不见。

## 解法：让一个守护进程盯着两边

[linuxqq-clipsync](https://github.com/W-874/linuxqq-clipsync) 做的事情很朴素：常驻后台，监听 X11 和 Wayland 两侧的剪贴板，任意一侧发生变化就写到另一侧去。

Fedora 上有人打包好了，直接用 COPR 装（[项目页](https://copr.fedorainfracloud.org/coprs/walker874/linuxqq-clipsync/)，支持 Fedora 42–45 和 rawhide，x86_64 / aarch64 都有）：

```bash
sudo dnf copr enable walker874/linuxqq-clipsync
sudo dnf install linuxqq-clipsync
```

它会带上 `xclip` 和 `wl-clipboard` 两个依赖——一个是 X11 侧的读写工具，一个是 Wayland 侧的。

## 开机自启

包里带了 systemd user unit，建议直接托管：

```bash
systemctl --user enable --now linuxqq-clipsync
systemctl --user status linuxqq-clipsync
```

看日志：

```bash
journalctl --user -u linuxqq-clipsync -f
```

不想用 systemd 也行，包里有同名命令，放进自启动项里手跑也可以：

```bash
linuxqq-clipsync
```

## 验证

装完重启 QQ，按顺序试三件事：

1. QQ 里复制一段文字 → 终端 `wl-paste`，应该能看到；
2. 终端 `echo hello | wl-copy` → QQ 输入框粘贴，应该能粘上；
3. 截图工具里复制一张图 → QQ 里粘贴，图片也应该正常了。

第三步是关键，很多同步脚本只处理文本，图片依旧会挂。

## 其他几种思路

装之前我也看过别的做法，摆在一起对比：

| 方案 | 做法 | 代价 |
|---|---|---|
| **linuxqq-clipsync**（本文） | 守护进程双向同步 X11 ↔ Wayland | 多一个常驻进程，占几 MB 内存 |
| 强制 QQ 走 X11 / XWayland | 让 QQ 完全待在 X11 世界里，剪贴板自然通 | 高分屏缩放、输入法、屏幕共享可能一起退化 |
| 通用同步工具（如 xwayclip） | 同样是双向同步，不专为 QQ | 需要自己配开机自启，行为不一定贴合 QQ |
| 换 [linuxqq-wayland-fix](https://github.com/SHORiN-KiWATA/linuxqq-wayland-fix) | 上游项目的继任者，同时修剪贴板、屏幕共享和共享声音 | 目前主要是 Arch（AUR）那边的包，Fedora 要自己编 |
| 等腾讯修 | —— | 最慢 |

顺带一提：`linuxqq-clipsync` 上游仓库已经归档，作者把维护交给了 `linuxqq-wayland-fix`。不过 Fedora 这个 COPR 包目前还能正常装、正常用，功能也足够，所以我暂时留着；哪天它不更新了再考虑迁移。

## 几点提醒

- COPR 是**第三方非官方仓库**，`dnf copr enable` 的时候看清楚项目名是 `walker874/linuxqq-clipsync`，别装到来路不明的源。
- 如果你的 QQ 是 Flatpak 版，同步进程跑在沙箱外面，一般仍然有效，但 flatpak 的剪贴板权限本身也可能拦一层——真遇到问题，先用原生 RPM 版对比一下。
- 这类同步工具的天然局限是**有延迟**：它是"轮询/事件驱动地搬运"，不是内核级共享，极快节奏的连续复制偶尔会漏一次，重新复制一下就好。

## 小结

一个 COPR 源、两个命令、一条 systemctl，五分钟内解决一个困扰很久的日常问题。如果你也在 Fedora + Wayland 下用 QQ，值得装上。
