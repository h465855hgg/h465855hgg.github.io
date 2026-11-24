---
title: "我的配置"
description: "本机 Fedora 桌面的配置索引：Umbriel 与 Noctalia 的安装、更新、路径与快捷键，Niri 备用会话、终端与输入法、自用脚本和 systemd 单元，以及 chezmoi 的备份方式。"
date: 2026-11-24
updated: 2026-11-24
tags: [Linux, Fedora, Wayland, Umbriel, Noctalia, dotfiles]
---

## 概述

本页是本机桌面的配置索引：装了什么、配置放在哪、怎么更新、怎么备份。只记录路径与公开配置值，不含凭据、令牌与设备序列号。

## 环境

| 项目 | 值 |
| --- | --- |
| 系统 | Fedora Linux 45 Workstation |
| 显示 | NVIDIA RTX 4060 Laptop，内屏 eDP-1 2560×1600 |
| 会话栈 | greetd → noctalia-greeter →（Umbriel 或 Niri） |
| 键盘 | `us,cn`，variant `,,altgr-pinyin`，由 systemd-localed 提供 |
| dotfiles | chezmoi，远端 `github.com/h465855hgg/dotfiles` |

## 更新

三个组件都由 dnf 管理，不编译：

```bash
sudo dnf upgrade --refresh
```

| 组件 | 包名 | 生效方式 |
| --- | --- | --- |
| 合成器 | `umbriel-nightly` | 注销并重新登录 |
| 桌面 shell | `noctalia` | `pkill -x noctalia; setsid -f noctalia` |
| 登录界面 | `noctalia-greeter-git` | 下次登录时 |

```bash
rpm -q umbriel-nightly noctalia noctalia-greeter-git
noctalia --version
```

greeter 可以换成 terra 的稳定版，两者互斥，必须 swap：

```bash
sudo dnf swap noctalia-greeter-git noctalia-greeter
```

## 配置路径

| 路径 | 内容 |
| --- | --- |
| `~/.config/umbriel/config.toml` | Umbriel 用户配置，`[include]` 系统模板后只写差异 |
| `/usr/share/umbriel/config.toml` | 包自带基底，升级会变 |
| `~/.local/state/noctalia/settings.toml` | Noctalia 全部设置（GUI 写这里） |
| `~/.local/state/noctalia/state.toml` | Noctalia 运行状态 |
| `~/.local/state/noctalia/plugins/` | 插件与模板 |
| `/usr/share/noctalia/assets/templates/` | 各应用模板脚本 `apply.sh` / `undo-*.sh` |
| `~/.config/niri/` | Niri 备用会话配置 |
| `~/.config/ghostty/` | 终端 |
| `~/.config/fcitx5/` | 输入法 |
| `~/.config/environment.d/` | 会话环境变量 |
| `~/.local/bin/` | 自用脚本 |
| `~/.config/systemd/user/` | 用户单元 |
| `~/.local/share/chezmoi/` | dotfiles 源仓库 |
| `~/.config/dconf/user` | GTK/GNOME 设置数据库 |

## Umbriel

| 键 | 值 |
| --- | --- |
| `general.autostart` | `/home/rrzt/.local/bin/noctalia-gpu` |
| `general.focus_on_activate` | `true`（托盘图标点击依赖它） |
| `general.nvidia_sync_workaround` | `false` |
| `output."eDP-1".scale` | `1.5` |
| `input.touchpad` | `natural_scroll = true`、`tap = true` |
| `input.cursor` | `theme = Bibata-Modern-Classic`、`size = 24` |
| `hot_corners.top_left` | `delay_ms = 0` |
| `[keybinds]` | 152 条，对齐 Niri 习惯 |

启动包装脚本 `~/.local/bin/noctalia-gpu`：

```sh
#!/bin/sh
unset XDG_CONFIG_HOME
export __GL_SYNC_TO_VBLANK=0
exec /usr/bin/noctalia "$@"
```

鼠标侧键由 `~/.local/bin/umbriel-sidekey` + `~/.config/systemd/user/umbriel-sidekey.service` 实现：抓取指定鼠标，把 `BTN_SIDE` 转成 `window-toggle-floating`，其余事件原样转发；随 `umbriel-session.target` 启动。

```bash
umbriel config validate -c ~/.config/umbriel/config.toml
umbriel msg config-reload
umbriel config get hot_corners.top_left
umbriel outputs
umbriel windows
```

## Noctalia

| 项目 | 值 |
| --- | --- |
| 主题 | `builtin = Ayu`，壁纸取色，`wallpaper_scheme = vibrant` |
| 模板 | `builtin_ids = ["ghostty", "niri", "qt"]`（已移除 gtk3/gtk4） |
| 插件 | 7 个（processes、hover-widgets、screen_recorder、lyrics、wallpaper-widget、github-contributions 等） |
| Bar | 两条：顶部 34px、底部 47px，均 `reserve_space` |

```bash
noctalia msg status
noctalia msg config-reload
noctalia msg settings-toggle
noctalia msg panel-toggle launcher
noctalia msg session lock
```

## 快捷键

`Mod` = Super，全部在 `~/.config/umbriel/config.toml` 的 `[keybinds]`。现场查看：`Mod+Shift+/`。

| 键 | 应用与面板 |
| --- | --- |
| `Mod+Return`、`Mod+T` | 终端 ghostty |
| `Mod+Space`、`Mod+D` | 启动器 |
| `Mod+S` / `Mod+V` / `Mod+Comma` | 控制中心 / 剪贴板 / 设置 |
| `Alt+Tab` | 窗口切换器 |
| `Mod+Escape` | 快捷键抑制开关 |
| `Mod+Shift+Escape`、`Mod+Shift+E`、`Ctrl+Alt+Delete` | 退出会话 |
| `Super+Alt+L` | 锁屏 |
| `Print` / `Ctrl+Print` / `Alt+Print` | 区域 / 全屏 / 窗口截图 |

| 键 | 窗口 |
| --- | --- |
| `Mod+Q` / `Mod+Shift+Q` | 关闭 / 强制关闭 |
| `Mod+F` / `Mod+Shift+F` | 最大化 / 全屏 |
| `Mod+M` | 最大化到边缘 |
| `Mod+P` | 置顶 |
| `Mod+W` | 标签页分组 |
| `Mod+O` | 工作区总览 |
| `Mod+Alt+T` | 浮动 / 平铺切换 |
| `Mod+Shift+V` | 浮动层与平铺层切焦点 |
| `Mod+C` | 浮动窗口居中 |
| `Mod+Alt+方向键` | 浮动窗口推到边缘 |
| `Mod+Alt+-` / `Mod+Alt+=` | 浮动窗宽度 |
| `Mod+Alt+Shift+-` / `+=` | 浮动窗高度 |

| 键 | 焦点、移动与尺寸 |
| --- | --- |
| `Mod+方向键`、`Mod+H/J/K/L` | 焦点移动 |
| `Mod+F1` | 下一个窗口 |
| `Mod+Home` / `Mod+End` | 首 / 末列 |
| `Mod+Ctrl+方向键`、`Mod+Ctrl+H/J/K/L` | 移动列 / 窗口 |
| `Mod+Ctrl+Home` / `Mod+Ctrl+End` | 列移到首 / 末 |
| `Mod+[` / `Mod+]` / `Mod+.` | 吞并或拆出 |
| `Mod+Shift+方向键`、`Mod+Shift+H/J/K/L` | 切显示器焦点 |
| `Mod+Shift+Ctrl+方向键`、`Mod+Shift+Ctrl+H/J/K/L` | 列移到别的显示器 |
| `Mod+R` / `Mod+Shift+R` | 列宽预设循环 / 反向 |
| `Mod+-` / `Mod+=`、`Mod+Ctrl+-` / `Mod+Ctrl+=` | 列宽微调 / 粗调 |
| `Mod+Shift+-` / `Mod+Shift+=` | 窗口高度 |
| `Mod+Ctrl+Shift+R` / `Mod+Ctrl+R` | 高度预设循环 / 复位 |
| `Mod+Ctrl+F` / `Mod+Ctrl+C` | 列撑满 / 居中 |

| 键 | 工作区与其它 |
| --- | --- |
| `Mod+1`…`Mod+9` | 切换工作区 |
| `Mod+Shift+1`…`9` | 窗口移到工作区 |
| `Mod+Ctrl+1`…`9` | 整列移到工作区 |
| `Mod+U` / `Mod+I`、`Mod+Page_Down` / `Mod+Page_Up` | 上 / 下切工作区 |
| `Mod+Ctrl+U` / `Mod+Ctrl+I` | 列移到上 / 下工作区 |
| `Mod+Shift+U` / `Mod+Shift+I` | 移动工作区本身 |
| `Mod+滚轮` / `Mod+Ctrl+滚轮` / `Mod+Shift+滚轮` | 切工作区 / 移列 / 左右切焦点 |
| `Mod+Alt+Space` / `Mod+Shift+Space` / `Mod+Ctrl+Space` | scratchpad 开关 / 移入 / 恢复 |
| `XF86Audio*`、`XF86MonBrightness*` | 音量与亮度，走 Noctalia OSD |

## Niri

入口 `~/.config/niri/config.kdl` 只做四件事：include、启动项、自定义键位、窗口与图层规则。

| 文件 | 作用 |
| --- | --- |
| `config.kdl` | 入口，约 2KB |
| `default-base.kdl` | 上游默认配置，27KB，121 条键位 |
| `animations.kdl` | 动画曲线 |
| `cursor.kdl` | 光标 `Bibata-Modern-Classic`，24px |
| `noctalia.kdl` | Noctalia 写入的配色（自动生成，勿手改） |

```kdl
include "default-base.kdl"
include "animations.kdl"
include "cursor.kdl"
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
| `Mod+Space` / `Mod+S` / `Mod+V` / `Mod+Comma` | Noctalia 启动器 / 控制中心 / 剪贴板 / 设置 |
| `MouseBack` | 切换窗口浮动 |
| `XF86Audio*`、`XF86MonBrightness*` | 音量与亮度 |

输入与规则：

| 项目 | 值 |
| --- | --- |
| 触控板 | `tap`、`natural-scroll` |
| 窗口圆角 | `geometry-corner-radius 12`，裁剪到几何 |
| Noctalia 设置窗口 | 浮动，固定 1080×920 |
| Zed / ghostty | 背景模糊（ghostty 额外 `xray`） |
| 图层规则 | 壁纸置于背景层，bar 不模糊 |

## 终端与输入法

| 路径或项目 | 内容 |
| --- | --- |
| `~/.config/ghostty/config`、`config.ghostty` | 终端配置 |
| `~/.config/ghostty/themes/`、`shaders/` | 主题与着色器 |
| `~/.config/fcitx5/profile` | 默认布局 `us`，默认输入法 `msime` |
| `~/.config/environment.d/fcitx5.conf` | `GTK_IM_MODULE`、`QT_IM_MODULE`、`XMODIFIERS` 等 |
| `~/.config/environment.d/locale.conf` | `LANG=zh_CN.UTF-8` |
| `~/.config/environment.d/cursor.conf` | `XCURSOR_THEME`、`XCURSOR_SIZE` |

## Shell 与工具

`~/.zshrc` 的 14 条别名：

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
chezmoi add ~/.config/niri/config.kdl
chezmoi diff
chezmoi apply
chezmoi cd
chezmoi update
```

| 文件 | 状态 |
| --- | --- |
| `~/.config/niri/*` | 已纳管 |
| `~/.config/ghostty/*` | 已纳管 |
| `~/.config/fcitx5/profile` | 已纳管 |
| `~/.config/environment.d/*` | 已纳管 |
| `~/.config/umbriel/config.toml` | 未纳管 |
| `~/.zshrc` | 未纳管 |
| Noctalia 设置 | 未纳管（明文 TOML，可直接 add） |

GNOME/GTK 设置单独备份：

```bash
dconf dump / > ~/.config/dconf-backup-$(date +%F).txt
dconf load / < ~/.config/dconf-backup-2026-11-24.txt
```

## 已知坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 登录后黑屏只有光标 | 未设置 `general.autostart` | `autostart = ["/home/rrzt/.local/bin/noctalia-gpu"]` |
| 操作 shell 卡顿 2 秒 | NVIDIA EGL-Wayland 在 swap 等帧，阻塞主循环 | 包装脚本加 `__GL_SYNC_TO_VBLANK=0` |
| GTK 应用设置"消失" | 环境里带 `XDG_CONFIG_HOME`，读错配置目录 | 启动脚本 `unset XDG_CONFIG_HOME` |
| 启动器对已运行应用只抬窗口 | desktop 条目 `DBusActivatable=true` | 用户级覆盖改为 `false` |
| Files 窗口背景透明 | Noctalia 注入 `gtk.css` 的自定义调色板 | 移除 gtk3/gtk4 模板并跑 `undo-gtk*.sh` |
| 托盘图标点击无反应 | `focus_on_activate` 默认关闭 | 设为 `true` |
| 挂起或切 VT 后黑屏 | NVIDIA 恢复时 swapchain 失败 | 切 VT 或重启 |

## 参考

- [Umbriel 配置](https://docs.noctalia.dev/umbriel/configuration/)：TOML 全部选项与热重载规则
- [Umbriel 动作列表](https://docs.noctalia.dev/umbriel/actions/)：键位可绑定的全部动作名
- [Umbriel 键位](https://docs.noctalia.dev/umbriel/keybinds/)：chord 语法、子映射、热角
- [Noctalia 与 Umbriel 集成](https://docs.noctalia.dev/noctalia/compositor-settings/umbriel)：推荐设置组合
- [Noctalia IPC](https://docs.noctalia.dev/noctalia/ipc/shell/)：`noctalia msg` 全部命令
