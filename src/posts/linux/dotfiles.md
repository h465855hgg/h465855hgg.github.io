---
title: "Fedora 桌面 dotfiles 速查（Niri · Umbriel · Noctalia）"
description: "本机 Fedora 桌面配置索引：目录结构、Niri 配置拆分与键位、Umbriel 与 Noctalia 的设置路径、终端与输入法、自用脚本与 systemd 单元，以及 chezmoi 的备份方式。只记路径和关键值。"
date: 2026-11-24
updated: 2026-11-24
tags: [Linux, Fedora, Niri, Noctalia, dotfiles]
---

## 概述

本页是本机桌面配置的索引：哪个文件管什么、关键值是什么、怎么备份。不含凭据、令牌、设备序列号。

环境：Fedora 45 Workstation，NVIDIA RTX 4060 Laptop，会话链为 greetd → noctalia-greeter →（Umbriel 或 Niri）。

## 配置目录

| 路径 | 内容 |
| --- | --- |
| `~/.config/niri/` | Niri 窗口管理器（当前备用会话） |
| `~/.config/umbriel/` | Umbriel 合成器（当前主会话） |
| `~/.local/state/noctalia/` | Noctalia shell 的设置与状态 |
| `~/.config/ghostty/` | 终端 |
| `~/.config/fcitx5/` | 输入法 |
| `~/.config/environment.d/` | 会话环境变量 |
| `~/.local/bin/` | 自用脚本 |
| `~/.config/systemd/user/` | 用户单元 |
| `~/.local/share/chezmoi/` | dotfiles 源仓库 |
| `~/.config/dconf/user` | GTK/GNOME 设置数据库 |

## Niri

入口 `~/.config/niri/config.kdl` 只做四件事：include、启动项、自定义键位、窗口与图层规则。

| 文件 | 作用 |
| --- | --- |
| `config.kdl` | 入口，约 2KB |
| `default-base.kdl` | 上游默认配置（键位、输入、布局），27KB，121 条键位 |
| `animations.kdl` | 动画曲线 |
| `cursor.kdl` | 光标主题 `Bibata-Modern-Classic`，24px |
| `noctalia.kdl` | Noctalia 写入的配色（自动生成，勿手改） |

```kdl
include "default-base.kdl"
include "animations.kdl"
include "cursor.kdl"
...
include "noctalia.kdl"
```

启动项：

```kdl
spawn-at-startup "/home/rrzt/.local/bin/noctalia-watchdog"
spawn-at-startup "/home/rrzt/.local/bin/x11-to-wayland-clipboard"
```

自定义键位（其余沿用 `default-base.kdl`）：

| 键 | 动作 |
| --- | --- |
| `Mod+Return`、`Mod+T` | ghostty |
| `Mod+Space` | Noctalia 启动器 |
| `Mod+S` | 控制中心 |
| `Mod+V` | 剪贴板面板 |
| `Mod+Comma` | Noctalia 设置 |
| `MouseBack` | 切换窗口浮动 |
| `XF86Audio*`、`XF86MonBrightness*` | 音量与亮度，走 Noctalia OSD |

输入与规则：

| 项目 | 值 |
| --- | --- |
| 触控板 | `tap`、`natural-scroll` |
| 窗口圆角 | `geometry-corner-radius 12`，裁剪到几何 |
| Noctalia 设置窗口 | 浮动，固定 1080×920 |
| Zed / ghostty | 背景模糊（ghostty 额外 `xray`） |
| 图层规则 | 壁纸置于背景层，bar 不模糊 |

## Umbriel

| 路径或键 | 值 |
| --- | --- |
| `~/.config/umbriel/config.toml` | 用户配置，`[include]` 系统模板后只写差异 |
| `/usr/share/umbriel/config.toml` | 包自带基底，升级会变 |
| `general.autostart` | `/home/rrzt/.local/bin/noctalia-gpu` |
| `general.focus_on_activate` | `true`（否则托盘图标点击无效） |
| `general.nvidia_sync_workaround` | `false` |
| `output."eDP-1".scale` | `1.5` |
| `input.touchpad` | `natural_scroll = true`、`tap = true` |
| `hot_corners.top_left` | `delay_ms = 0` |
| `[keybinds]` | 152 条，对齐 Niri 习惯 |

启动包装脚本 `~/.local/bin/noctalia-gpu`：

```sh
#!/bin/sh
unset XDG_CONFIG_HOME
export __GL_SYNC_TO_VBLANK=0
exec /usr/bin/noctalia "$@"
```

鼠标侧键由 `~/.local/bin/umbriel-sidekey` + `~/.config/systemd/user/umbriel-sidekey.service` 实现：抓取指定鼠标，把 `BTN_SIDE` 转成 `window-toggle-floating`，其余事件原样转发。服务随 `umbriel-session.target` 启动。

配置检查与热重载：

```bash
umbriel config validate -c ~/.config/umbriel/config.toml
umbriel msg config-reload
umbriel config get hot_corners.top_left
```

## Noctalia

| 路径或键 | 值 |
| --- | --- |
| `~/.local/state/noctalia/settings.toml` | 全部设置（GUI 写这里） |
| `~/.local/state/noctalia/state.toml` | 运行状态 |
| `~/.local/state/noctalia/plugins/` | 插件与模板 |
| `/usr/share/noctalia/assets/templates/` | 各应用的模板脚本 `apply.sh` / `undo-*.sh` |

关键设置：

| 项目 | 值 |
| --- | --- |
| 主题 | `builtin = Ayu`，壁纸取色，`wallpaper_scheme = vibrant` |
| 模板 | `builtin_ids = ["ghostty", "niri", "qt"]`（已移除 gtk3/gtk4） |
| 插件 | 7 个（processes、hover-widgets、screen_recorder、lyrics、wallpaper-widget、github-contributions 等） |
| Bar | 两条：顶部 34px、底部 47px，均 `reserve_space` |

## 终端与输入法

| 路径 | 内容 |
| --- | --- |
| `~/.config/ghostty/config`、`config.ghostty` | 终端配置 |
| `~/.config/ghostty/themes/`、`shaders/` | 主题与着色器 |
| `~/.config/fcitx5/profile` | 默认布局 `us`，默认输入法 `msime` |
| `~/.config/environment.d/fcitx5.conf` | `GTK_IM_MODULE`、`QT_IM_MODULE`、`XMODIFIERS` 等 |
| `~/.config/environment.d/locale.conf` | `LANG=zh_CN.UTF-8` |

## Shell 与工具

`~/.zshrc` 中 14 条别名：

| 别名 | 展开 |
| --- | --- |
| `ls` / `ll` / `la` / `l` | 带颜色与人类可读大小 |
| `grep` | `--color=auto` |
| `cp` / `mv` / `rm` | 交互确认（`-i`） |
| `mkdir` | `-p` |
| `df` / `free` | `-h` |
| `..` / `...` / `....` | 上跳 1/2/3 级 |

`~/.gitconfig`：全局 `user.name`、`user.email`，GitHub 凭据走 `gh auth git-credential`。

## 脚本与单元

| 脚本 | 作用 |
| --- | --- |
| `noctalia-gpu` | 带环境变量启动 shell（修 NVIDIA 卡顿、隔离 XDG） |
| `umbriel-sidekey` | 鼠标侧键映射到窗口浮动 |
| `noctalia-watchdog` | Niri 会话下守护 shell |
| `x11-to-wayland-clipboard` | X11 与 Wayland 剪贴板桥 |
| `dotbackup` | dotfiles 备份工具 |
| `chezmoi` | dotfiles 版本管理 |

启用的用户单元：

```
umbriel-sidekey.service
msime-linux-clipboard.service
appimagelauncherd.service
wireplumber.service
obex.service
```

## 备份与同步

chezmoi 源目录 `~/.local/share/chezmoi`，远端 `github.com/h465855hgg/dotfiles`，当前管理 784 个文件。

```bash
chezmoi add ~/.config/niri/config.kdl   # 纳入管理
chezmoi diff                            # 查看差异
chezmoi apply                           # 应用
chezmoi cd                              # 进入源仓库
chezmoi update                          # 拉取并应用
```

覆盖情况：

| 文件 | 状态 |
| --- | --- |
| `~/.config/niri/*` | 已纳管 |
| `~/.config/ghostty/*` | 已纳管 |
| `~/.config/fcitx5/profile` | 已纳管 |
| `~/.config/environment.d/*` | 已纳管 |
| `~/.config/umbriel/config.toml` | 未纳管 |
| `~/.zshrc` | 未纳管 |
| Noctalia 设置 | 未纳管（明文 TOML，可直接 add） |

其它备份：

```bash
dconf dump / > ~/.config/dconf-backup-$(date +%F).txt   # GNOME/GTK 设置
dconf load / < ~/.config/dconf-backup-2026-11-24.txt    # 恢复
```

## 已知坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 登录后黑屏只有光标 | 未设置 `general.autostart` | `autostart = ["/home/rrzt/.local/bin/noctalia-gpu"]` |
| 操作 shell 卡顿 2 秒 | NVIDIA EGL-Wayland 在 swap 等帧，阻塞主循环 | 包装脚本加 `__GL_SYNC_TO_VBLANK=0` |
| GTK 应用设置"消失" | 环境里带 `XDG_CONFIG_HOME`，读错配置目录 | 启动脚本 `unset XDG_CONFIG_HOME` |
| 启动器对已运行应用只抬窗口 | desktop 条目 `DBusActivatable=true` | 用户级覆盖改为 `false` |
| Files 窗口背景透明 | Noctalia 注入 `gtk.css` 的自定义调色板 | 移除 gtk3/gtk4 模板并跑 `undo-gtk*.sh` |

详见 [Umbriel + Noctalia 速查](/posts/linux/umbriel-noctalia/)。
