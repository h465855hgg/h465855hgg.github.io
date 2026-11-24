---
title: "我的配置"
description: "一台 Fedora 笔记本上的桌面配置：Umbriel 合成器、Noctalia shell、Niri 备用会话、终端与输入法，以及这些年攒下来的脚本和踩过的坑。"
date: 2026-11-24
updated: 2026-11-24
tags: [Linux, Fedora, Wayland, Umbriel, Noctalia, dotfiles]
---

去年开始把主力桌面从 Niri 挪到 Umbriel，中途换过几轮包，也踩了不少坑。这篇把我现在机器上的东西整理一下：装了什么、配置写在哪、快捷键怎么排的、出问题去哪看。不是教程，更像自己的备忘录，顺带留给以后重装系统的自己。

## 这台机器

Fedora 45，RTX 4060 Laptop，14 寸 2560×1600 内屏，键盘是 `us,cn` 加 altgr-pinyin。

登录链是 greetd → noctalia-greeter → 会话。默认进 Umbriel，Niri 那套配置还留着，出问题能随时切回去。

## 装了什么，怎么更新

三件东西都走 dnf，不自己编译：

```bash
sudo dnf upgrade --refresh
```

- **Umbriel**：`umbriel-nightly`，来自 terra 仓库的 git 快照，注销重登生效
- **Noctalia**：`noctalia`，Fedora 官方源，`pkill -x noctalia; setsid -f noctalia` 就换新版
- **greeter**：`noctalia-greeter-git`，COPR 的 git 版，下次登录生效

以前图新鲜自己编译过，编一次十几分钟，出问题还得自己查依赖，后来就老实交给包管理器了。想更激进一点可以换 `noctalia-git`，但和 `noctalia` 包冲突，得先 swap。

## 配置都放在哪

| 路径 | 里面是什么 |
| --- | --- |
| `~/.config/umbriel/config.toml` | Umbriel 的用户配置，只写和默认值不一样的部分 |
| `/usr/share/umbriel/config.toml` | 包自带的基底配置，升级会变，别直接改 |
| `~/.local/state/noctalia/settings.toml` | Noctalia 的全部设置，设置界面改的就是它 |
| `~/.local/state/noctalia/plugins/` | 插件和模板 |
| `~/.config/niri/` | Niri 备用会话 |
| `~/.config/ghostty/` | 终端 |
| `~/.config/fcitx5/`、`~/.config/environment.d/` | 输入法和会话环境变量 |
| `~/.local/bin/` | 我自己写的脚本 |
| `~/.config/systemd/user/` | 用户单元 |
| `~/.local/share/chezmoi/` | dotfiles 源仓库，远端在 GitHub |

Umbriel 的配置我用 `[include]` 把系统那份引进来，自己只覆盖改过的项，升级后新默认值能自动吃到。改完保存就热重载，顺手校验一下：

```bash
umbriel config validate -c ~/.config/umbriel/config.toml
umbriel msg config-reload
```

## Umbriel

真正需要动的其实没几项：

| 配置 | 值 | 为什么 |
| --- | --- | --- |
| `general.autostart` | `/home/rrzt/.local/bin/noctalia-gpu` | 不自动拉起 shell，登录进去就是黑屏加一个鼠标 |
| `general.focus_on_activate` | `true` | 关着的时候点托盘图标没反应 |
| `general.nvidia_sync_workaround` | `false` | 开着会等 GPU 完成，帧率高的时候反而卡 |
| `output."eDP-1".scale` | `1.5` | 2560×1600 的 14 寸屏，1 倍缩放字小得看不清 |
| `input.touchpad` | `natural_scroll = true`、`tap = true` | 默认方向和 GNOME 相反，用着别扭 |
| `input.cursor` | `Bibata-Modern-Classic`，24 | 和 Niri 那边保持一致 |
| `hot_corners.top_left` | `delay_ms = 0` | 默认要停 500ms，习惯了 GNOME 那种一碰就开 |

`noctalia-gpu` 是个包装脚本，两行环境变量都是为了修 bug，正文后面说：

```sh
#!/bin/sh
unset XDG_CONFIG_HOME
export __GL_SYNC_TO_VBLANK=0
exec /usr/bin/noctalia "$@"
```

鼠标侧键单独开了个服务。Umbriel 的键位不接受没有修饰键的鼠标键，`MouseBack` 直接判无效，所以只能抓设备自己做事件转发：把 `BTN_SIDE` 吃掉换成 `window-toggle-floating`，其余事件原样往虚拟设备写。服务挂在 `umbriel-session.target` 上，只在这个会话里跑。

```bash
systemctl --user status umbriel-sidekey
journalctl --user -u umbriel-sidekey -f
```

## Noctalia

设置全在 `~/.local/state/noctalia/settings.toml`，图形界面改完也是写这里，所以直接拿编辑器改完全没问题。主题是壁纸取色，模板只留了 ghostty、niri、qt 三个，GTK 那两个被我关了——原因在踩坑那节。

插件挂了 7 个，常用的就是进程监控、hover widgets 和歌词。bar 两条，顶部 34px、底部 47px。

常用命令：

```bash
noctalia msg status
noctalia msg panel-toggle launcher
noctalia msg settings-toggle
noctalia msg session lock
```

## 快捷键

`Mod` 是 Super，全部在 `~/.config/umbriel/config.toml` 的 `[keybinds]` 里，152 条。记不住就按 `Mod+Shift+/`，会把当前生效的键位表弹出来。

| 键 | 干什么 |
| --- | --- |
| `Mod+Return`、`Mod+T` | 终端 |
| `Mod+Space`、`Mod+D` | 启动器 |
| `Mod+S` / `Mod+V` / `Mod+Comma` | 控制中心 / 剪贴板 / 设置 |
| `Alt+Tab` | 窗口切换 |
| `Mod+Q` / `Mod+Shift+Q` | 关窗 / 强杀 |
| `Mod+F` / `Mod+Shift+F` / `Mod+M` | 最大化 / 全屏 / 撑满到边缘 |
| `Mod+Alt+T` / `Mod+Shift+V` / `Mod+C` | 浮动切换 / 浮动层切焦点 / 浮动窗居中 |
| `Mod+Alt+方向` | 把浮动窗推到边缘 |
| `Mod+H/J/K/L`、`Mod+方向` | 焦点移动 |
| `Mod+Ctrl+H/J/K/L` | 移动列或窗口 |
| `Mod+R` / `Mod+Shift+R` | 列宽预设轮换 |
| `Mod+Ctrl+F` / `Mod+Ctrl+C` | 撑满可用宽度 / 列居中 |
| `Mod+1`…`9` | 切工作区 |
| `Mod+Shift+1`…`9` | 把窗口丢到对应工作区 |
| `Mod+U` / `Mod+I`、`Mod+滚轮` | 上下切工作区 |
| `Mod+Escape` | 快捷键抑制开关 |
| `Mod+Shift+E`、`Ctrl+Alt+Delete` | 退出会话（带确认） |
| `Super+Alt+L` | 锁屏 |
| `Print` / `Ctrl+Print` / `Alt+Print` | 区域 / 全屏 / 窗口截图 |

有一处特意改过：Umbriel 默认把 `Mod+Escape` 绑成直接退出会话，从 Niri 过来的人很容易误触，我换成了快捷键抑制，退出挪到 `Mod+Shift+E`。

## Niri 还留着

`~/.config/niri/config.kdl` 只是个入口，实际内容拆开：

| 文件 | 内容 |
| --- | --- |
| `default-base.kdl` | 上游默认配置，27KB，键位都在里面 |
| `animations.kdl` | 动画曲线 |
| `cursor.kdl` | 光标主题 |
| `noctalia.kdl` | Noctalia 写进来的配色，别手改 |

启动项挂了 shell 的 watchdog 和剪贴板桥。自己加的键位不多：终端、几个 Noctalia 面板、`MouseBack` 切浮动、音量亮度键，其余都沿用默认。窗口圆角 12，Zed 和 ghostty 开了背景模糊，壁纸压在背景层。

## 终端和输入法

终端是 ghostty，配置在 `~/.config/ghostty/`，主题和 shader 也放在那。输入法 fcitx5，默认布局 `us`，日常用 msime。会话变量在 `~/.config/environment.d/`：`GTK_IM_MODULE`、`QT_IM_MODULE`、`XMODIFIERS` 一套，外加 locale 和光标主题。

## 自己写的几个脚本

`~/.local/bin` 里常用的就这些：

- `noctalia-gpu`：带环境变量启动 shell，修 NVIDIA 卡顿和配置目录串台
- `umbriel-sidekey`：鼠标侧键转窗口浮动
- `noctalia-watchdog`：Niri 会话下守着 shell，挂了自动拉起来
- `x11-to-wayland-clipboard`：X11 和 Wayland 的剪贴板桥
- `dotbackup`、`chezmoi`：备份和版本管理

用户单元开了 `umbriel-sidekey`、`msime-linux-clipboard`、`appimagelauncherd`、`wireplumber`、`obex`。

## 备份

dotfiles 用 chezmoi 管，源目录在 `~/.local/share/chezmoi`，推到 `github.com/h465855hgg/dotfiles`，现在 784 个文件。

```bash
chezmoi add ~/.config/niri/config.kdl
chezmoi diff
chezmoi apply
chezmoi update
```

Niri、ghostty、fcitx5、environment.d 都已经纳管；Umbriel 的 `config.toml`、`.zshrc` 和 Noctalia 的设置还没加，属于回头要补的活。

GTK 和 GNOME 那套设置单独导一份，心里踏实：

```bash
dconf dump / > ~/.config/dconf-backup-$(date +%F).txt
dconf load / < ~/.config/dconf-backup-2026-11-24.txt
```

## 踩过的坑

**登录进去只有黑屏和一个鼠标。** 没配 `autostart`，合成器起来了但没有任何客户端。加一行 `autostart = [...]` 就好。

**操作 shell 的时候莫名卡两秒。** 用 gdb 看了下栈，Noctalia 主线程卡在 NVIDIA 的 `eglSwapBuffers` 里等帧回调，IPC 和渲染在同一个循环，所以按快捷键开面板也跟着排队。给 shell 单独加 `__GL_SYNC_TO_VBLANK=0` 就好了，IPC 从 2 秒降到 20 毫秒。

**GTK 应用的设置像是全丢了。** 环境里不知什么时候多了个 `XDG_CONFIG_HOME`，指向 `~/.config-ghostty`，于是应用和 dconf 都去那边找配置，看起来很干净，其实是找错了地方。原来那份 dconf 一直躺在 `~/.config/dconf/user` 里，把变量去掉就回来了。

**Files 的背景变透明了。** Noctalia 的模板处理器往 `gtk.css` 里塞了一段 `@import`，把窗口背景色换成了它按壁纸算出来的调色板。把 gtk3/gtk4 模板从 `builtin_ids` 里删掉，再跑一遍官方的 `undo-gtk*.sh` 就恢复。

**从启动器打开已经开着的 Files，只抬窗口不开新的。** 因为它的 desktop 条目写着 `DBusActivatable=true`，启动器走 D-Bus 的 `Activate`，根本不会执行 `--new-window`。覆盖一份用户级的 desktop 文件，把这一行改成 `false`。

**托盘图标点了没反应。** `focus_on_activate` 默认是关的，应用请求激活被合成器丢掉。设成 `true` 就行。

**合盖或者切 VT 回来黑屏。** 日志里是 `Swapchain for output 'eDP-1' failed test`，NVIDIA 恢复时的问题，目前没找到配置层面的解法，只能切 VT 或者重启。

## 参考

- [Umbriel 配置](https://docs.noctalia.dev/umbriel/configuration/)
- [Umbriel 动作列表](https://docs.noctalia.dev/umbriel/actions/)
- [Umbriel 键位](https://docs.noctalia.dev/umbriel/keybinds/)
- [Noctalia 与 Umbriel 集成](https://docs.noctalia.dev/noctalia/compositor-settings/umbriel)
- [Noctalia IPC](https://docs.noctalia.dev/noctalia/ipc/shell/)
