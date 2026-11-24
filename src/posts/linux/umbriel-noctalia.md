---
title: "Umbriel + Noctalia：Fedora 上的 Wayland 合成器与桌面 shell"
description: "Umbriel 是 Noctalia 团队开发的 Wayland 合成器，负责窗口、输入与输出；Noctalia 提供 bar、启动器、通知、锁屏，greeter 负责登录。本文给出三者的 dnf 安装、配置要点（触控板方向、键位迁移、热角、鼠标侧键）与统一更新流程。"
date: 2026-11-24
tags: [Linux, Fedora, Wayland, Umbriel, Noctalia]
---

## 概述

Umbriel 是一个平铺式 Wayland 合成器，采用动态工作区与 scrolling 布局，职责与 Niri、Hyprland 相同：管理窗口、输入设备与输出，不提供任何界面元素。壁纸、任务栏、启动器、通知、锁屏由 Noctalia shell 承担；登录界面由 Noctalia greeter（greetd 前端）承担。

三者分工明确，也意味着**只装合成器不会得到桌面**：没有 shell 连接到 Umbriel 时，登录后屏幕上只有黑色背景与鼠标指针。这是空会话的正常表现，不是驱动或渲染故障。

本文覆盖 Fedora 上的安装形态、关键配置项、Niri 键位迁移对照，以及全部由 dnf 完成的更新方式。

## 环境

| 项目 | 值 |
| --- | --- |
| 系统 | Fedora Linux 45 Workstation |
| 显示 | NVIDIA RTX 4060 Laptop，内屏 eDP-1 2560×1600 |
| 会话栈 | greetd → noctalia-greeter → Umbriel → Noctalia shell |
| 键盘 | `us,cn`，variant `,,altgr-pinyin`，由 systemd-localed 提供 |

## 组成

| 组件 | RPM 包 | 版本 | 仓库 |
| --- | --- | --- | --- |
| 合成器 | `umbriel-nightly` | `0^20261122git.3d7052f` | terra |
| 桌面 shell | `noctalia` | `5.6.0` | Fedora `updates` |
| 登录界面 | `noctalia-greeter-git` | `1.7.0^9.199fb7f` | COPR `lionheartp/Hyprland` |

```mindmap
  root((Umbriel · Noctalia))
    合成器
      umbriel-nightly
      config.toml
      键位与输入
    桌面层
      noctalia shell
      bar 与启动器
      通知与锁屏
    登录层
      greetd
      noctalia-greeter
```

terra 另提供稳定版 `noctalia-greeter` 1.7.1，与 COPR 的 git 版互斥，切换需使用 `dnf swap`，不能直接 `install`。

## 配置

### 文件结构

系统模板位于 `/usr/share/umbriel/config.toml`，随包升级而变化，不直接修改。用户配置 `~/.config/umbriel/config.toml` 通过 `[include]` 引入系统模板，只写差异项：

```toml
[include]
files = ["/usr/share/umbriel/config.toml"]

[general]
autostart = ["noctalia"]

[output."eDP-1"]
scale = 1.5

[input.touchpad]
natural_scroll = true
tap = true

[hot_corners.top_left]
delay_ms = 0
```

表按键合并，标量与数组由后加载的文件覆盖。配置保存后热重载，无需注销；校验命令：

```bash
umbriel config validate -c ~/.config/umbriel/config.toml
```

### 必改项

| 配置项 | 默认值 | 不改的后果 |
| --- | --- | --- |
| `general.autostart` | `[]` | 登录后无任何客户端，黑屏加一个鼠标指针 |
| `input.touchpad.natural_scroll` | 跟随 libinput（关闭） | 双指滚动方向与 GNOME、Niri 相反 |
| `hot_corners.top_left.delay_ms` | `500` | 触发角需要停留半秒才响应 |
| `output."<name>".scale` | `1` | 高分辨率小尺寸屏幕上的文字过小 |

热角默认动作是 `overview-open`，与 GNOME 的左上角行为一致；`delay_ms = 0` 后进入角落后立即打开。

### 键位迁移

Umbriel 内置键位参考 Niri，但若干默认绑定不同。`Mod` 对应 `general.mod_key`，原生会话下为 Super。需要覆写时在用户配置的 `[keybinds]` 中写出，同一 chord 后者覆盖前者。

| 用途 | Niri | Umbriel 默认 | 覆写为 |
| --- | --- | --- | --- |
| 终端 | `Mod+T` | 切换浮动 | `spawn ghostty` |
| 启动器 | `Mod+Space` | scratchpad | `spawn noctalia msg panel-toggle launcher` |
| 控制中心 / 剪贴板 / 设置 | `Mod+S` `Mod+V` `Mod+Comma` | 未绑定 / 未绑定 / 吞并左列 | 分别指向 Noctalia 面板 |
| 最大化列 | `Mod+F` | 全屏 | `window-toggle-maximize` |
| 全屏 | `Mod+Shift+F` | — | `window-toggle-fullscreen` |
| 浮动切换 | `Mod+V` | — | `window-toggle-floating` |
| 浮动 / 平铺切焦点 | `Mod+Shift+V` | — | `window-focus-switch-floating` |
| 移动列与窗口 | `Mod+Ctrl+方向键` | `Mod+Shift+方向键` | `column-move-left/right`、`window-move-up/down` |
| 上下切工作区 | `Mod+U` `Mod+I` | — | `workspace-next/previous` |
| 滚轮切工作区 | `Mod+滚轮` | 左右切窗口 | `workspace-next/previous`，配 `cooldown_ms = 150` |
| 快捷键抑制 | `Mod+Escape` | **直接退出会话** | `shortcuts-inhibit-toggle` |
| 退出会话 | `Mod+Shift+E` | — | `session-quit` |
| 截图 | `Print` | — | `spawn noctalia msg screenshot-region` |
| 锁屏 | `Super+Alt+L` | — | `spawn noctalia msg session lock` |
| 热键总览 | `Mod+Shift+Slash` | — | `cheatsheet-toggle` |

`Mod+Escape` 一项需要特别注意：Umbriel 默认把它绑定为 `session-quit`，从 Niri 迁移时若按习惯连按两次抑制快捷键，会触发退出确认面板。

### 鼠标侧键

Umbriel 的 chord 解析器要求鼠标按键至少带一个修饰键，`MouseBack`、`BTN_SIDE` 等写法均被判为无效 chord，只有 `Alt+MouseBack` 一类可以通过。Wayland 下也无法用 udev hwdb 把 `BTN_SIDE` 改成键盘键：libinput 按设备能力分类，改键码不会让指针设备获得键盘能力，改出的事件会被丢弃。

要保留“裸按侧键切换浮动”，需要用用户态程序接管该设备：读取鼠标 evdev、转发除 `BTN_SIDE` 以外的全部事件到虚拟设备，收到 `BTN_SIDE` 时调用合成器 IPC。

```bash
# 服务与脚本
~/.local/bin/umbriel-sidekey
~/.config/systemd/user/umbriel-sidekey.service

systemctl --user enable --now umbriel-sidekey
journalctl --user -u umbriel-sidekey -f
```

服务通过 `WantedBy=umbriel-session.target` 仅在 Umbriel 会话中启动，其他会话不受影响；`/dev/input/event*` 需要用户属于 `input` 组，`/dev/uinput` 需要可写。

## 常用命令

```bash
# 配置
umbriel config get 'hot_corners.top_left'
umbriel config set 'hot_corners.top_left.delay_ms' 0   # 仅本次会话，重启失效
umbriel config unset 'hot_corners.top_left.delay_ms'   # 撤销运行时覆盖

# 状态检查
umbriel outputs
umbriel windows
umbriel layers
umbriel msg config-reload

# shell
noctalia msg status
noctalia msg panel-toggle launcher
noctalia msg session lock
```

`umbriel config set` 是内存覆盖，不写文件；持久化仍需修改 `config.toml`。

## 更新

三个组件均由 dnf 管理，不需要编译，也不建议从源码覆盖安装：

```bash
sudo dnf upgrade --refresh
```

`--refresh` 会先刷新元数据，避免看到过期的版本。组件生效时机不同：

| 组件 | 生效条件 |
| --- | --- |
| Umbriel | 注销并重新登录 |
| Noctalia shell | `pkill -x noctalia; setsid -f noctalia`，或注销重登 |
| greeter | 下次登录时 |

版本核对：

```bash
rpm -q umbriel-nightly noctalia noctalia-greeter-git
umbriel --version
noctalia --version
```

若把 greeter 换成 terra 的稳定版，两者互斥，必须使用 swap：

```bash
sudo dnf swap noctalia-greeter-git noctalia-greeter
```

### 手动安装的清理

若此前用手动方式装过 shell，`~/.local/bin/noctalia` 会因 PATH 顺序遮蔽包版，导致 `dnf upgrade` 后仍运行旧二进制。处理方式是把该路径改为指向包版：

```bash
rm -f ~/.local/bin/noctalia
ln -s /usr/bin/noctalia ~/.local/bin/noctalia
```

同时清理手动安装留下的资源副本与 `/usr/local/bin` 下的软链；用户数据目录 `~/.local/state/noctalia` 保存设置、插件与状态，不能删除。

## 已知问题与解决方案

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 登录后只有黑屏与光标 | 未配置 `general.autostart`，合成器没有客户端 | `autostart = ["noctalia"]` |
| 触控板滚动方向相反 | `natural_scroll` 未设置，沿用 libinput 传统方向 | `input.touchpad.natural_scroll = true` |
| 快捷键与 Niri 不一致 | 内置键位与 Niri 存在差异 | 按对照表覆写 `[keybinds]` |
| 按 `Mod+Escape` 弹出退出确认 | Umbriel 默认该键为 `session-quit` | 改为 `shortcuts-inhibit-toggle` |
| 鼠标侧键无响应 | chord 必须带修饰键；hwdb 改键码在 Wayland 无效 | 用户态 evdev 接管（见上） |
| 触发角要等半秒 | 默认 `delay_ms = 500` | 设为 `0` |
| 更新后版本没变 | `~/.local/bin` 中的旧二进制遮蔽包版 | 软链指向 `/usr/bin/noctalia` |
| 安装稳定版 greeter 失败 | 与 `noctalia-greeter-git` 文件冲突 | 使用 `dnf swap` |
| 挂起或切换 VT 后黑屏 | NVIDIA 恢复时 `Swapchain for output 'eDP-1' failed test` | 切换 VT 或重启；属于合成器与驱动的恢复路径问题 |

## 限制

- 合成器不绘制任何界面，shell 缺席时必然是黑屏，这属于设计而非故障。
- 鼠标按键不能作为无修饰键的独立 chord。
- `umbriel-nightly` 来自 terra、`noctalia-greeter-git` 来自 COPR，均为第三方仓库，跟上游 git 快照更新，行为可能随快照变化。需要稳定版本时改用 Fedora 仓库中的 `noctalia` 与 terra 的 `noctalia-greeter`。
- 挂起恢复在 NVIDIA 上的失败需要从合成器侧解决，配置层面没有可靠规避手段。

## 参考

- [Umbriel 文档](https://docs.noctalia.dev/umbriel/)
- [Umbriel 配置说明](https://docs.noctalia.dev/umbriel/configuration/)
- [Umbriel 动作列表](https://docs.noctalia.dev/umbriel/actions/)
- [Noctalia 与 Umbriel 集成](https://docs.noctalia.dev/noctalia/compositor-settings/umbriel)
- [Noctalia IPC](https://docs.noctalia.dev/noctalia/ipc/shell/)
