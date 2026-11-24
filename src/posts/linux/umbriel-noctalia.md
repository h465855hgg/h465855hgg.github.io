---
title: "Umbriel + Noctalia 速查（Fedora）"
description: "Umbriel 合成器与 Noctalia shell、greeter 的安装路径、更新命令、配置项与键位表。一页速查，不含叙述。"
date: 2026-11-24
updated: 2026-11-24
tags: [Linux, Fedora, Wayland, Umbriel, Noctalia]
---

## 更新

全部由 dnf 管理，不编译。一条命令更新三者：

```bash
sudo dnf upgrade --refresh
```

| 组件 | 包名 | 生效方式 |
| --- | --- | --- |
| 合成器 | `umbriel-nightly` | 注销并重新登录 |
| 桌面 shell | `noctalia` | `pkill -x noctalia; setsid -f noctalia` |
| 登录界面 | `noctalia-greeter-git` | 下次登录时自动生效 |

```bash
# 核对版本
rpm -q umbriel-nightly noctalia noctalia-greeter-git
noctalia --version

# 只更新到 git 快照的稳定版 greeter（与 git 版互斥，必须 swap）
sudo dnf swap noctalia-greeter-git noctalia-greeter
```

## 路径

| 路径 | 内容 |
| --- | --- |
| `~/.config/umbriel/config.toml` | Umbriel 用户配置（只写差异项） |
| `/usr/share/umbriel/config.toml` | 包自带起始配置，被上面 include，升级会变 |
| `~/.local/state/noctalia/settings.toml` | Noctalia 全部设置（GUI 设置页写这里） |
| `~/.local/state/noctalia/state.toml` | Noctalia 运行状态 |
| `~/.local/state/noctalia/plugins/` | 插件与模板 |
| `/etc/greetd/config.toml` | greetd 启动哪个 greeter |
| `/var/lib/noctalia-greeter/greeter.toml` | greeter 外观与登录设置 |
| `/usr/lib/systemd/user/umbriel.service` | Umbriel 会话单元 |
| `~/.local/bin/umbriel-sidekey` | 鼠标侧键映射脚本 |
| `~/.config/systemd/user/umbriel-sidekey.service` | 侧键服务单元 |
| `~/.local/bin/noctalia` | 指向 `/usr/bin/noctalia` 的软链 |

## Umbriel 配置

用户配置只保留与默认值的差异，校验与生效：

```bash
umbriel config validate -c ~/.config/umbriel/config.toml   # 校验
umbriel config get hot_corners.top_left                    # 查生效值
umbriel config set hot_corners.top_left.delay_ms 0         # 临时覆盖（不写文件）
umbriel msg config-reload                                  # 手动重载
```

| 段落 | 设置 | 作用 |
| --- | --- | --- |
| `[include]` | `files = ["/usr/share/umbriel/config.toml"]` | 以包配置为基底 |
| `[general]` | `autostart = ["noctalia"]` | 登录后拉起 shell，缺了就是黑屏加光标 |
| `[output."eDP-1"]` | `scale = 1.5` | 内屏缩放 |
| `[input.touchpad]` | `natural_scroll = true`、`tap = true` | 触控板方向与轻触 |
| `[hot_corners.top_left]` | `delay_ms = 0` | 左上角触发角，零延迟 |

## 快捷键

`Mod` = Super。文件同一位置：`~/.config/umbriel/config.toml` 的 `[keybinds]`。

| 键 | 动作 |
| --- | --- |
| `Mod+Return`、`Mod+T` | 终端 ghostty |
| `Mod+Space`、`Mod+D` | Noctalia 启动器 |
| `Mod+S` / `Mod+V` / `Mod+Comma` | 控制中心 / 剪贴板 / 设置 |
| `Alt+Tab` | 窗口切换器 |
| `Mod+Shift+/` | 键位速查表 |
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
| `Mod+Shift+V` | 在浮动层与平铺层间切焦点 |
| `Mod+C` | 浮动窗口居中 |
| `Mod+Alt+方向键` | 浮动窗口推到边缘 |
| `Mod+Alt+-` / `Mod+Alt+=` | 浮动窗宽度 |
| `Mod+Alt+Shift+-` / `+=` | 浮动窗高度 |

| 键 | 焦点与移动 |
| --- | --- |
| `Mod+方向键`、`Mod+H/J/K/L` | 焦点移动 |
| `Mod+F1` | 下一个窗口 |
| `Mod+Home` / `Mod+End` | 首 / 末列 |
| `Mod+Ctrl+方向键`、`Mod+Ctrl+H/J/K/L` | 移动列 / 窗口 |
| `Mod+Ctrl+Home` / `Mod+Ctrl+End` | 列移到首 / 末 |
| `Mod+[` / `Mod+]` / `Mod+.` | 吞并或拆出 |
| `Mod+Shift+方向键`、`Mod+Shift+H/J/K/L` | 切显示器焦点 |
| `Mod+Shift+Ctrl+方向键`、`Mod+Shift+Ctrl+H/J/K/L` | 列移到别的显示器 |

| 键 | 尺寸 |
| --- | --- |
| `Mod+R` / `Mod+Shift+R` | 列宽预设循环 / 反向 |
| `Mod+-` / `Mod+=` | 列宽 ±2% |
| `Mod+Ctrl+-` / `Mod+Ctrl+=` | 列宽 ±10% |
| `Mod+Shift+-` / `Mod+Shift+=` | 窗口高度 ±10% |
| `Mod+Ctrl+Shift+R` | 窗口高度预设循环 |
| `Mod+Ctrl+R` | 高度复位 |
| `Mod+Ctrl+F` | 列撑满可用宽度 |
| `Mod+Ctrl+C` | 列居中 |

| 键 | 工作区 |
| --- | --- |
| `Mod+1` … `Mod+9` | 切换工作区 |
| `Mod+Shift+1` … `Mod+Shift+9` | 窗口移到工作区 |
| `Mod+Ctrl+1` … `Mod+Ctrl+9` | 整列移到工作区 |
| `Mod+U` / `Mod+I`、`Mod+Page_Down` / `Mod+Page_Up` | 上 / 下切工作区 |
| `Mod+Ctrl+U` / `Mod+Ctrl+I`、`Mod+Ctrl+Page_*` | 列移到上 / 下工作区 |
| `Mod+Shift+U` / `Mod+Shift+I`、`Mod+Shift+Page_*` | 移动工作区本身 |
| `Mod+滚轮` | 切工作区 |
| `Mod+Ctrl+滚轮` | 列移到相邻工作区 |
| `Mod+Shift+滚轮`、`Mod+滚轮左右` | 左右切焦点 |

| 键 | 其他 |
| --- | --- |
| `Mod+Alt+Space` | scratchpad 开关 |
| `Mod+Shift+Space` | 窗口移入 scratchpad |
| `Mod+Ctrl+Space` | 从 scratchpad 恢复 |
| `XF86Audio*`、`XF86MonBrightness*` | 音量 / 亮度，走 Noctalia OSD |

## Noctalia

设置用 GUI（`Mod+Comma`）或写 `~/.local/state/noctalia/settings.toml`；命令行：

```bash
noctalia msg status                       # 状态
noctalia msg config-reload                # 重载设置
noctalia msg settings-toggle              # 打开设置
noctalia msg panel-toggle launcher        # 启动器
noctalia msg session lock                 # 锁屏
```

## 侧键

`BTN_SIDE` 映射为 `window-toggle-floating`，由用户级服务实现（Umbriel 的键位不接受无修饰键的鼠标键）：

```bash
systemctl --user status umbriel-sidekey
systemctl --user restart umbriel-sidekey
systemctl --user disable --now umbriel-sidekey   # 停用，恢复鼠标原样
journalctl --user -u umbriel-sidekey -f
```

仅抓取指定鼠标，其余事件原样转发；服务随 `umbriel-session.target` 启动，不影响 Niri 会话。

## 故障速查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 登录后黑屏只有光标 | 没有 `general.autostart` | 加 `autostart = ["noctalia"]` |
| 滚动方向反 | `natural_scroll` 跟随 libinput | 设为 `true` |
| 按 `Mod+Escape` 弹退出确认 | 默认绑定是退出会话 | 改绑 `shortcuts-inhibit-toggle` |
| 更新后版本没变 | `~/.local/bin` 旧二进制遮蔽包版 | 软链指向 `/usr/bin/noctalia` |
| 装稳定版 greeter 失败 | 与 git 版文件冲突 | `dnf swap` |
| 挂起或切 VT 后黑屏 | NVIDIA 恢复时 swapchain 失败 | 切 VT 或重启 |

## 参考

- [Umbriel 配置](https://docs.noctalia.dev/umbriel/configuration/)：TOML 全部选项与热重载规则
- [Umbriel 动作列表](https://docs.noctalia.dev/umbriel/actions/)：键位可绑定的全部动作名
- [Umbriel 键位](https://docs.noctalia.dev/umbriel/keybinds/)：chord 语法、子映射、热角
- [Noctalia 与 Umbriel 集成](https://docs.noctalia.dev/noctalia/compositor-settings/umbriel)：推荐设置组合
- [Noctalia IPC](https://docs.noctalia.dev/noctalia/ipc/shell/)：`noctalia msg` 全部命令
