---
title: "我的配置"
description: "Fedora 桌面配置记录：Umbriel、Noctalia、Niri、终端与输入法，含配置路径、快捷键与已知问题。"
date: 2026-11-24
updated: 2026-11-24
tags: [Linux, Fedora, Wayland, Umbriel, Noctalia, dotfiles]
---

2026 年 7 月起主力桌面用 Umbriel，Niri 配置保留作备用。下面是当前配置。

## 环境

| 项目 | 值 |
| --- | --- |
| 系统 | Fedora 45 Workstation |
| 显示 | RTX 4060 Laptop，2560×1600 |
| 会话 | greetd → noctalia-greeter → Umbriel / Niri |
| 键盘 | `us,cn`，`altgr-pinyin` |

## 更新

```bash
sudo dnf upgrade --refresh
```

| 组件 | 包 | 生效 |
| --- | --- | --- |
| 合成器 | `umbriel-nightly`（terra） | 注销重登 |
| shell | `noctalia`（Fedora） | `pkill -x noctalia; setsid -f noctalia` |
| greeter | `noctalia-greeter-git`（COPR） | 下次登录 |

```bash
rpm -q umbriel-nightly noctalia noctalia-greeter-git
sudo dnf swap noctalia-greeter-git noctalia-greeter   # 可选：换稳定版 greeter
```

## 配置路径

| 路径 | 内容 |
| --- | --- |
| `~/.config/umbriel/config.toml` | Umbriel 用户配置，`[include]` 系统模板后只写差异 |
| `/usr/share/umbriel/config.toml` | 包自带基底，升级会变 |
| `~/.local/state/noctalia/settings.toml` | Noctalia 全部设置 |
| `~/.local/state/noctalia/plugins/` | 插件与模板 |
| `~/.config/niri/` | Niri 备用会话 |
| `~/.config/ghostty/` | 终端 |
| `~/.config/fcitx5/`、`~/.config/environment.d/` | 输入法与会话变量 |
| `~/.local/bin/` | 自用脚本 |
| `~/.config/systemd/user/` | 用户单元 |
| `~/.config/dconf/user` | GTK/GNOME 设置 |

校验与重载：

```bash
umbriel config validate -c ~/.config/umbriel/config.toml
umbriel msg config-reload
```

## Umbriel

| 键 | 值 |
| --- | --- |
| `general.autostart` | `/home/rrzt/.local/bin/noctalia-gpu` |
| `general.focus_on_activate` | `true` |
| `general.nvidia_sync_workaround` | `false` |
| `output."eDP-1".scale` | `1.5` |
| `input.touchpad` | `natural_scroll = true`、`tap = true` |
| `input.cursor` | `Bibata-Modern-Classic`，24 |
| `hot_corners.top_left` | `delay_ms = 0` |
| `appearance` | `corner_radius = 12`、`border_width = 0`（对齐 Niri 的无边框） |
| `appearance.blur` | `radius = 6`、`passes = 2`（包里默认 3，太淡；10 又过头） |
| `layout` | `gap = 16`、`scrolling.default_extent_fraction = 0.5` |
| `[[window_rule]]` | Noctalia 设置窗浮动 1080×920；Zed 实时模糊；ghostty 缓存壁纸模糊 |
| `[keybinds]` | 152 条 |

`~/.local/bin/noctalia-gpu`：

```sh
#!/bin/sh
unset XDG_CONFIG_HOME
export __GL_SYNC_TO_VBLANK=0
exec /usr/bin/noctalia "$@"
```

鼠标侧键由 `umbriel-sidekey` 服务处理：抓取鼠标，把 `BTN_SIDE` 转为 `window-toggle-floating`，其余事件转发。Umbriel 的键位不支持无修饰键的鼠标键。

```bash
systemctl --user status umbriel-sidekey
journalctl --user -u umbriel-sidekey -f
```

## Noctalia

设置存 `~/.local/state/noctalia/settings.toml`，图形界面改的也是它。主题按壁纸取色，模板保留 ghostty、niri、qt。插件 7 个，bar 两条（34px / 47px）。

```bash
noctalia msg status
noctalia msg panel-toggle launcher
noctalia msg settings-toggle
noctalia msg session lock
```

## 快捷键

`Mod` 为 Super，配置在 `~/.config/umbriel/config.toml` 的 `[keybinds]`。`Mod+Shift+/` 显示键位表。

| 键 | 动作 |
| --- | --- |
| `Mod+Return`、`Mod+T` | 终端 |
| `Mod+Space`、`Mod+D` | 启动器 |
| `Mod+S` / `Mod+V` / `Mod+Comma` | 控制中心 / 剪贴板 / 设置 |
| `Alt+Tab` | 窗口切换 |
| `Mod+Q` / `Mod+Shift+Q` | 关闭 / 强杀 |
| `Mod+F` / `Mod+Shift+F` / `Mod+M` | 最大化 / 全屏 / 撑满 |
| `Mod+Alt+T` / `Mod+Shift+V` / `Mod+C` | 浮动切换 / 浮动层切焦点 / 居中 |
| `Mod+H/J/K/L`、`Mod+方向` | 焦点移动 |
| `Mod+Ctrl+H/J/K/L` | 移动列或窗口 |
| `Mod+R` / `Mod+Shift+R` | 列宽预设 |
| `Mod+Ctrl+F` / `Mod+Ctrl+C` | 撑满宽度 / 列居中 |
| `Mod+1`…`9` / `Mod+Shift+1`…`9` | 切工作区 / 窗口移入 |
| `Mod+U` / `Mod+I`、`Mod+滚轮` | 切工作区 |
| `Mod+Escape` | 快捷键抑制 |
| `Mod+Shift+E`、`Ctrl+Alt+Delete` | 退出会话 |
| `Super+Alt+L` | 锁屏 |
| `Print` / `Ctrl+Print` / `Alt+Print` | 区域 / 全屏 / 窗口截图 |

## Niri

| 文件 | 内容 |
| --- | --- |
| `config.kdl` | 入口 |
| `default-base.kdl` | 上游默认配置，27KB |
| `animations.kdl` | 动画曲线 |
| `cursor.kdl` | 光标主题 |
| `noctalia.kdl` | Noctalia 写入的配色，自动生成 |

启动项：

```kdl
spawn-at-startup "/home/rrzt/.local/bin/noctalia-watchdog"
spawn-at-startup "/home/rrzt/.local/bin/x11-to-wayland-clipboard"
```

自定义键位：终端、Noctalia 面板、`MouseBack` 切浮动、音量与亮度，其余沿用默认。窗口圆角 12，Zed 与 ghostty 开背景模糊。

## 终端与输入法

终端 ghostty，配置、主题、shader 在 `~/.config/ghostty/`。输入法 fcitx5，布局 `us`，默认 `msime`。会话变量在 `~/.config/environment.d/`：输入法、locale、光标主题。

## 脚本

- `noctalia-gpu`：带环境变量启动 shell
- `umbriel-sidekey`：鼠标侧键转窗口浮动
- `noctalia-watchdog`：Niri 下守护 shell
- `x11-to-wayland-clipboard`：剪贴板桥

用户单元：`umbriel-sidekey`、`msime-linux-clipboard`、`appimagelauncherd`、`wireplumber`、`obex`。

## 备份

配置用 Pika Backup（Borg）备份，仓库在 `~/----我的文件/backup-h465855hgg-rrzt`，加密，每次要输密码。

备份 13 个路径：`.config` 下的 niri、umbriel、ghostty、fcitx5、environment.d、systemd、gtk-3.0、gtk-4.0、autostart，加上 `.local/bin`、`.local/state/noctalia`、`.zshrc`、`.gitconfig`。首次归档 7284 个文件、424MB。

每天 17:00 自动跑，保留策略 hourly 48 / daily 14 / weekly 4 / monthly 12 / yearly 10。

GTK 与 GNOME 的设置不在文件里，单独导出：

```bash
dconf dump / > ~/.config/dconf-backup-$(date +%F).txt
dconf load / < ~/.config/dconf-backup-2026-11-24.txt
```

## 已知问题

**登录后黑屏只有光标**：缺少 `general.autostart`，合成器没有客户端。

**操作 shell 卡两秒**：Noctalia 主线程在 NVIDIA `eglSwapBuffers` 等帧回调，IPC 与渲染同循环。shell 加 `__GL_SYNC_TO_VBLANK=0`。

**GTK 设置像丢了**：环境带 `XDG_CONFIG_HOME`，应用与 dconf 读错目录。原设置在 `~/.config/dconf/user`，去掉变量即可。

**Files 背景透明**：Noctalia 模板向 `gtk.css` 注入调色板。移除 gtk3/gtk4 模板并执行 `undo-gtk*.sh`。

**启动器不开新窗口**：desktop 条目 `DBusActivatable=true`，走 D-Bus `Activate`。改为 `false`。

**托盘图标点击无反应**：`focus_on_activate` 默认关闭。

**挂起或切 VT 后黑屏**：`Swapchain for output 'eDP-1' failed test`，NVIDIA 恢复问题，切 VT 或重启。

## 参考

- [Umbriel 配置](https://docs.noctalia.dev/umbriel/configuration/)
- [Umbriel 动作列表](https://docs.noctalia.dev/umbriel/actions/)
- [Umbriel 键位](https://docs.noctalia.dev/umbriel/keybinds/)
- [Noctalia 与 Umbriel 集成](https://docs.noctalia.dev/noctalia/compositor-settings/umbriel)
- [Noctalia IPC](https://docs.noctalia.dev/noctalia/ipc/shell/)
