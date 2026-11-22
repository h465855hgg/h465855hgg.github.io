---
title: "Qt 程序打包成单个 exe（Windows）"
description: "Release 构建 + windeployqt 收集依赖 + 虚拟文件打包，把 Qt 工程做成一个能直接发给别人的 exe，附常见启动报错的对应解法。"
date: 2026-11-22
tags: [Qt, Windows, 打包]
---

## 概述

Qt 程序不能只把一个 `.exe` 发给别人：它运行时需要 Qt 的 dll、平台插件（`platforms/qwindows.dll`）以及图像格式、样式等插件目录，缺一个就启动失败。

完整交付流程分三段：**Release 构建 → `windeployqt` 收集运行时 → 打包成单文件**。适用于 Windows 上的 Qt 5 / Qt 6，MSVC 与 MinGW 套件都适用。

## 前置

| 项目 | 说明 |
|---|---|
| Qt 套件 | 已安装桌面版（MSVC 或 MinGW），并能正常编译运行 |
| `windeployqt` | Qt 自带，在对应套件的 `bin` 目录里 |
| Enigma Virtual Box | 可选，只在需要「单文件」时使用：[下载页](https://enigmaprotector.com/en/downloads.html) |

## 使用

### 1. 用 Release 构建

在 Qt Creator 左下角的构建模式里把 **Debug** 切成 **Release**，重新构建。Debug 版依赖调试运行库，体积大且不适合分发。

### 2. 取出 exe

在构建目录（`build-<项目名>-Desktop_Qt_..._Release/`）里找到 `release/xxx.exe`，复制到一个**新建的空文件夹**，路径只用英文和数字。

### 3. 打开对应套件的命令行

开始菜单里找与构建套件一致的那个：`Qt 6.x.x (MSVC 2019 64-bit)` 或 `Qt 6.x.x (MinGW 11.2.0 64-bit)`。用系统自带的 `cmd` 找不到 `windeployqt`。

### 4. 收集运行时依赖

```bat
cd /d D:\dist\myapp
windeployqt --release --no-translations myapp.exe
```

| 参数 | 作用 |
|---|---|
| `--release` | 只复制 Release 版运行库 |
| `--no-translations` | 跳过 Qt 翻译文件；需要多语言界面时去掉 |
| `--compiler-runtime` | 额外带上 MSVC 运行库，目标机器没装 VC++ 时用 |

执行后目录里会多出 `Qt6Core.dll` 等 Qt 库，以及 `platforms/`、`styles/`、`imageformats/` 等插件目录——这些目录结构不能改动。

### 5. 先验证，再打包

双击 exe 能正常启动，说明依赖已经齐了。这一步不要跳过：等打包完才发现缺 dll，排查成本更高。

### 6. 封成单个 exe（可选）

需要「只发一个文件」时，用 Enigma Virtual Box 把整个文件夹塞进可执行文件：

1. 打开工具，**Input File** 选择你的 exe；
2. 在 **Files** 里把整个目录（包含 dll 与插件目录）添加为虚拟文件；
3. **Output File** 指定新的 exe 路径，点 **Process**。

生成的文件内部是虚拟文件系统，运行时不需要外部 dll。替代方案：7-Zip 的 SFX 自解压包（每次启动先解压，稍慢），或 Inno Setup 做正式安装包。

## 已知问题与解决方案

| 现象 | 原因 | 解决 |
|---|---|---|
| 启动提示缺少 `Qt6Core.dll` | 没有执行 `windeployqt`，或执行时用的不是对应套件 | 用该套件的 Qt 命令行重新执行 |
| 启动提示缺少 `VCRUNTIME140.dll` | MSVC 构建未携带 VC 运行库 | `windeployqt --compiler-runtime`，或要求目标机器安装 VC++ 运行库 |
| 报错 `could not find or load the Qt platform plugin "windows"` | `platforms/` 目录缺失、被移动，或 exe 与 dll 版本不匹配 | 保留 `windeployqt` 生成的目录结构，不要手工挪动插件 |
| `'windeployqt' 不是内部或外部命令` | 用的是系统 `cmd` 而不是 Qt 命令行 | 换 Qt 套件自带的命令行窗口 |
| 打包后的 exe 被杀毒软件报毒 | 虚拟化壳/自解压结构容易被误判 | 改用安装包方案，或对产物做代码签名 |
| 构建或打包中途失败，路径含中文 | 部分工具链对非 ASCII 路径支持不好 | 工程与输出目录都用纯英文路径 |

## 限制

- `windeployqt` 只收集它识别到的依赖；自己链接的第三方库（OpenSSL、ffmpeg 等）需要手动补进目录。
- 单文件 exe 首次启动要把虚拟文件映射到内存，冷启动会比文件夹版慢一点。
- 用 Enigma Virtual Box 打包后仍受杀软策略影响，对外分发前最好在多台机器上试运行。

## 参考

- 原始步骤（含截图）：[QT 打包成 exe 详细步骤](https://www.cnblogs.com/JinShanCheShen/p/16194526.html)，西北小蚂蚁，2022-04-26
- Qt 官方部署说明：`windeployqt` 与 Deployment 文档
