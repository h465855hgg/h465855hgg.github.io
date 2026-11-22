---
title: "HakiOS：在 OnePlus Ace 3V 上运行 Darwin 内核"
description: "HakiOS 是运行在 Android 手机上的 Darwin（XNU）内核移植项目。本文记录其在一加 Ace 3V（PJF110 / SM7675）上的启动链路、使用方法、已知问题与对应解决方案。"
date: 2026-11-08
updated: 2026-11-22
tags: [HakiOS, Android, 内核移植, iOS]
pinned: true
---

## 概述

[HakiOS](https://github.com/oosexgang/hakios-xnu-kernel) 是一个把 Apple 开源的 Darwin 内核（XNU，`xnu-8796.121.2`）移植到 Android 手机硬件上的研究项目。它自带引导器、驱动与配置系统，可在 QEMU 中独立运行，也可以直接跑在真机上。

在 OnePlus Ace 3V（PJF110，SM7675「cliffs」）上，当前已实现：启动 XNU、8 核上线、显示输出、触摸输入，以及进入 iOS 16.5 的 SpringBoard。系统从内存运行（RAM-only），不写入任何分区，重启即回到 Android。

**性质说明**：HakiOS 不是 ROM，不包含 Apple 的任何二进制，也不提供厂商固件。Darwin 用户态需要用户自行使用持有设备的 IPSW 布置。Apple 的激活、Apple ID、iCloud、App Store 等服务不受支持。项目与 Apple 无关联。

## 目标设备

| 项目 | 值 |
|---|---|
| 机型 | OnePlus Ace 3V（PJF110） |
| 平台代号 | `cliffs` |
| SoC | Snapdragon 7+ Gen 3（SM7675），8 核 |
| GPU | Adreno 732 |
| 屏幕 | 1240 × 2772，DSC 命令模式，120 / 90 / 60 Hz |
| 存储 | Samsung KLUFG8RHHD-B0G1（UFS 3.1） |
| Wi-Fi | QCA6750 |

UEFI 基座（Mu-Silicium）的 `PalawanPkg` 已包含 SM7675：`SOC_TYPE=0` 对应 SM8635，`SOC_TYPE=1` 对应 SM7675。因此移植工作是按同代设备（如 POCO F6 / peridot）构建平台包，而非从零适配 SoC。

## 组成

启动链由五部分组成，自下而上：

```
fastboot boot
  └─ BootShim            176 字节跳板：复制 UEFI FD 到 0xA7100000、payload 到 0xF0000000
      └─ UEFI             Mu-Silicium + 厂商 DXE 驱动 + cliffs 平台包（SM7675）
          └─ loader.efi   建 DTB / boot_args，PSCI 拉起 CPU，跳转内核；常驻并提供 fastboot 服务
              └─ XNU      内核：GICv3、SMP、VM/BSD、驱动
                  └─ 用户态  Darwin root.apfs / system.apfs → launchd → backboardd → SpringBoard
```

上述链路对应的节点图（可拖动平移、滚轮缩放）：

```mermaid
flowchart LR
  F("fastboot boot") --> B("BootShim")
  B --> U("UEFI")
  U --> L("loader.efi")
  L --> X("XNU")
  X --> D("Darwin 用户态")
  D --> S("SpringBoard")
  classDef cmd fill:#1d2940,stroke:#5e7eff,stroke-width:2px,color:#eaf0ff
  classDef hot fill:#2a1f2b,stroke:#ff9eb6,stroke-width:2px,color:#ffeaf1
  classDef plain fill:#161c26,stroke:#3d4a5c,stroke-width:1.5px,color:#e6ebf2
  class F cmd
  class S hot
  class B,U,L,X,D plain
```

## 准备

以下产物需在主机上各构建一次：

| 产物 | 来源 | 说明 |
|---|---|---|
| `hakios-kernel` | `make kernel` | 约 14.8 MB，使用 `cliffs-ace3v_defconfig` |
| `xnuloader/loader.efi` | `make loader` | `identity.h` 由自己的 IPSW 设备树生成 |
| `SILICIUM_UEFI.fd` | `build_uefi.py -d cliffs-ace3v -r RELEASE` | 加载基址 `0xA7100000` |
| `userland/system.apfs` | `userland/build.sh` | Darwin 16.5 用户态，约 2.36 GB |

## 使用

```bash
# 1. 进入 fastboot：关机后长按 电源 + 音量下
fastboot devices

# 2. 引导链进入内存，等待 loader 就绪
DEVICE=cliffs-ace3v ./xl enter

# 3. 上传系统镜像（每个 loader 会话一次，约 80 秒）
DEVICE=cliffs-ace3v ./xl ramdisk userland/system.apfs

# 4. 启动内核
DEVICE=cliffs-ace3v XL_CMDLINE="touchscreen=2 cpus=8 bootcpu=0" ./xl run

# 5. 结束并回到 Android
./xl reboot
```

常用参数：

| 参数 | 含义 |
|---|---|
| `cpus=N` | 启动的 CPU 数量 |
| `bootcpu=N` | 内核启动所在的物理核 |
| `touchscreen=N` | 触摸设备索引；`touch_xmirror=1` 可镜像 X 轴 |
| `loader_return_after=N` | 内核运行 N 秒后交还 loader |
| `usb_host_timeout=N` | loader 等待主机的秒数，超时自动重启回 Android |

结束会话的四种方式：`loader_return_after` 到期、`xl stop`、屏幕五指按住 1.5 秒、`battguard` 低电保护。

## 已知问题与解决方案

| 现象 | 原因 | 解决 |
|---|---|---|
| `cpus=8` 时 secondary core 触发同步异常（ESR `0x96000010`） | 真机 GICR 每核步长为 `0x40000`（`0x200000 / 8`），而非架构默认的 `0x20000` | loader 传递 `gic_redist_size = 0x200000`；内核 `gicr_frame_size` 改为按 `gicr_size / 核数` 计算 |
| 读取 TLMM 寄存器导致整机硬挂（USB 变为 `05c6:900e`） | GPIO 寄存器窗口位于 `0x0F100000 + 0x1000 * n`，设备树的 `pinctrl@f000000` 只是区域基址 | 改用 `0x0F100000` 访问引脚（SPI gpio16–19、复位 128、中断 129） |
| 触摸 SPI 读回全为 0 | 触摸芯片未供电；启动链处于 Gunyah hypervisor 下，RPMh 被接管，TCS 写请求无响应 | 在 loader 中借用 UEFI `PmicDxe` 的 `pmic` handle，经 RPMh client 协议（GUID `e1d0b573-f29f-495d-9352-ca0dd42a0a74`）为 `ldob22`（2.8 V）、`ldom5`（1.8 V）下发电压/使能/模式命令 |
| 屏幕中间区域点不动、键盘偶发失灵 | 数据流无 `NUM_OF_ACTIVE_OBJECTS` 时按多对象解析，尾部残段会把真实触点覆盖为「抬起」 | 无该字段时只解析一个对象 |
| 触摸事件被误判 | 手势 opcode `0xC6` / `0xC7` 被当作结束符 | 按位宽跳过这两个 opcode |
| loader 的 USB 未枚举时手机无法恢复 | 旧版本无超时处理 | 使用 `usb_host_timeout=N`，超时写日志并自动重启回 Android |
| 真机上出现 `Synchronous Exception` | `loader.c` 的 QEMU fw_cfg 探测在真机上写入 `0x09020000` | 读取 UEFI `FirmwareVendor` 区分 QEMU 与真机，真机不访问 fw_cfg |
| `cpus=8 bootcpu=7` 早期 abort | 跨核 PSCI 启动的缓存一致性/入口问题，尚未解决 | 使用 `bootcpu=0` |
| 长时间运行后断电「卡住」 | 无电池/充电驱动，充电 backend 未初始化 | 接充电器运行；等待电池驱动完成 |

## 当前能力

| 能力 | 状态 |
|---|---|
| UEFI + loader + XNU（单核 / 8 核） | 可用 |
| 显示（1240 × 2772） | 可用 |
| 触摸（Synaptics S3910 / TCM） | 可用 |
| iOS 16.5 SpringBoard | 可用 |
| 电池 / 充电 | 部分可用（充电 backend 缺失） |
| GPU / 音频 / Wi-Fi / 相机 | 未实现 |
| 免 USB 安装（写入分区开机自启） | 未实现 |

`touchscreen` 数据路径：S3910 → SPI → 内核解析 → `/dev/hakios-touch` → `libhakios.dylib` → IOHID → backboardd → SpringBoard。

## 安全与合规

- 全流程使用 `fastboot boot`（RAM 启动），不使用 `fastboot flash`；后者会写入分区，属不可逆操作。
- `vbmeta`、`boot`、`persist`、`modemst*` 等分区 dump 可能包含 IMEI、Wi-Fi MAC 等唯一标识，不应上传或提交。
- 项目仓库不包含 Apple 二进制与厂商固件；Darwin 用户态需由使用者自行从持有的 IPSW 生成。
- HakiOS 的 XNU 补丁遵循 Apple Public Source License 2.0，其余部分遵循 MIT。

## 参考

- 项目仓库：https://github.com/oosexgang/hakios-xnu-kernel
- 上游 UEFI 基座：Mu-Silicium
