---
title: "在 OnePlus Ace 3V 上跑 iOS 内核（HakiOS）"
description: "一条 fastboot 命令，在 Ace 3V 上跑起 XNU 内核和 iOS 16.5 桌面，触摸可用，不写任何分区。附操作步骤和三个必须知道的坑。"
date: 2026-11-08
updated: 2026-11-22
tags: [HakiOS, Android, 内核移植, iOS]
pinned: true
---

**有什么用**：在 OnePlus Ace 3V（PJF110 / SM7675「cliffs」）上启动真正的 Darwin 内核（XNU）和 iOS 16.5 的 SpringBoard，8 核在线、触摸可用。全程 RAM 运行，不写手机任何分区，重启回 Android。

![启动流程](/images/hakios-ios-boot-mindmap.png)

## 怎么跑

前置产物（各自 build 一次）：`hakios-kernel`、`xnuloader/loader.efi`、`SILICIUM_UEFI.fd`、`system.apfs`（2.36 GB）。

```bash
# 1. 手机关机后长按 电源 + 音量下，进 fastboot
fastboot devices

# 2. 引导链进内存（RAM），等到 loader 起来
DEVICE=cliffs-ace3v ./xl enter

# 3. 上传系统镜像，约 80 秒（每个 loader 会话一次）
DEVICE=cliffs-ace3v ./xl ramdisk userland/system.apfs

# 4. 启动内核
DEVICE=cliffs-ace3v XL_CMDLINE="touchscreen=2 cpus=8 bootcpu=0" ./xl run

# 5. 回 Android
./xl reboot
```

中间发生的事：

```
fastboot boot → BootShim → UEFI(0xA7100000) → loader.efi
  → 建 DTB/boot_args，PSCI 拉 8 核 → XNU → md0 上的 Darwin 用户态 → SpringBoard
```

## 现在能用的部分

| 能力 | 状态 |
|---|---|
| 启动 + 8 核 + iOS SpringBoard | ✅ |
| 显示（1240 × 2772） | ✅ |
| 触摸（Synaptics S3910 / TCM） | ✅ |
| 电池 / 充电 | ⚠️ 驱动在，充电 backend 未起来，跑久了会断电 |
| GPU / 音频 / Wi-Fi / 相机 | ❌ 未写 |
| 免 USB 安装（写分区开机自启） | ❌ 未做 |

## 三个坑

**1. GICR 每核步长不是默认的 0x20000。**
真机 `reg = <0x17100000 0x10000 0x17180000 0x200000>`，8 核意味着步长 `0x40000`。loader 的 DT 和内核 `GICR_FRAME_SIZE` 都写死了默认值，`cpus=8` 时 secondary core 一读 `GICR_TYPER` 就 external abort。改成按 `gicr_size / 核数` 动态推即可。

**2. TLMM 的寄存器窗口在 `0x0F100000`，不是设备树的 `pinctrl@f000000`。**
按设备树基址读 GPIO 会让整机硬挂（USB 变 `05c6:900e`）。真正的窗口是 `0x0F100000 + 0x1000 * n`（答案来自厂商 `TLMMDxe.efi` 里的 `/soc/pinctrl@f100000`）。触摸的 SPI（gpio16–19）、复位（128）、中断（129）都在这上面。

**3. 触摸供电要绕过 Gunyah hypervisor。**
Android 跑在 Gunyah 下，RPMh 被接管，TCS 写请求永远无响应；而 `fastboot boot` 启动链里触摸芯片是没电的（`ldob22` 2.8 V / `ldom5` 1.8 V）。办法是在 loader 里借用 UEFI `PmicDxe` 已建好的 `pmic` handle，通过 RPMh client 协议（GUID `e1d0b573-f29f-495d-9352-ca0dd42a0a74`）发电压/使能/模式三条命令，内核启动时芯片已带电。

## 触摸解析两个细节

- 没有 `NUM_OF_ACTIVE_OBJECTS` 时**只能解析一个对象**，否则尾部半截对象会把真实触点覆盖成"抬起"（表现为中间点不动、键盘偶尔失灵）；
- 手势 opcode `0xC6` / `0xC7` 要按位宽跳过，不能当结束符。

## 注意

- 只用 `fastboot boot`（RAM 启动），不要 `fastboot flash`；
- `vbmeta`、`boot`、`persist`、`modemst*` 这些 dump 可能含 IMEI / MAC，别上传；
- `dumps/`、固件、XNU 源码都不该进博客仓库。

项目地址：[oosexgang/hakios-xnu-kernel](https://github.com/oosexgang/hakios-xnu-kernel)。
