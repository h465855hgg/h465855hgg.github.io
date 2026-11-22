---
title: "把 iOS 内核跑在 OnePlus Ace 3V 上：HakiOS 移植记录"
description: "一条 fastboot boot 之后，Ace 3V 上跑起真正的 XNU 内核、8 核在线、进到 iOS 16.5 的 SpringBoard，触摸可用，全程不写分区。记录这条链路，以及中途三次「读一个寄存器就死机」式的硬坑。"
date: 2026-11-08
updated: 2026-11-22
tags: [HakiOS, Android, 内核移植, iOS]
pinned: true
---

把 iPhone 的系统内核跑在安卓手机上——听起来像段子，但 [HakiOS](https://github.com/oosexgang/hakios-xnu-kernel) 确实在这么干。这篇是我把它折腾到 **OnePlus Ace 3V** 上的完整记录。

## 结果先行

一条命令之后：

```bash
DEVICE=cliffs-ace3v ./xl enter
```

手机屏幕亮起 HakiOS 的标志，跑起真正的 XNU 内核，8 个核全部在线，最后进到 **iOS 16.5 的 SpringBoard**（桌面），触摸能点。整个过程 **RAM-only**：不碰手机任何一个分区，重启就回 Android。

![HakiOS 启动 iOS 全流程思维导图](/images/hakios-ios-boot-mindmap.png)

## HakiOS 是什么

一个把 Apple 开源的 **Darwin 内核（XNU，`xnu-8796.121.2`）** 移植到 Android 手机硬件上的研究项目。定位很像"手机上的 Linux"：内核是自己的，但引导器、驱动、配置系统、用户态都得自己配一套。

几个前提说清楚：

- **它不是 ROM**，默认从内存启动，重启即回 Android；
- 仓库里**没有任何 Apple 的二进制**，也没有厂商固件；要 Darwin 用户态得拿你自己的 IPSW 布置；
- 激活、Apple ID、iCloud、App Store 既不支持也不是目标；
- 与 Apple 无关联，纯粹是研究项目。

## 目标机器，以及为什么能搞

| 项 | 值 |
|---|---|
| 机型 | OnePlus Ace 3V（PJF110），平台代号 `cliffs` |
| SoC | Snapdragon 7+ Gen 3（SM7675），8 核 |
| GPU | Adreno 732 |
| 屏幕 | 1240 × 2772，120 / 90 / 60 Hz 三档 |
| 存储 / Wi-Fi | UFS 3.1（三星 KLUFG8RHHD-B0G1）/ QCA6750 |

移植最大的不确定性本来在 UEFI：如果没有这颗 SoC 的支持，就得从零写一套。但 Mu-Silicium（HakiOS 的 UEFI 基座）的 `PalawanPkg.dsc.inc` 里写着：

```
SOC_TYPE = 0  →  SM8635
SOC_TYPE = 1  →  SM7675   ← 就是这颗
```

SMBIOS 里也是 `Snapdragon (TM) 7+ Gen 3 @ 2.80 GHz` / `SM7675`。同代的 POCO F6、Realme GT Neo6 都在用这个包。

所以 UEFI 这一关不是"支持一颗新 SoC"，而是**照着一台同代设备做平台包**——从数月变成数天。

## 现在跑到哪一步

| 部分 | 状态 |
|---|---|
| UEFI + HakiOS loader + XNU（单核 / 8 核） | ✅ |
| Darwin 用户态 → iOS 16.5 SpringBoard | ✅ |
| 显示（1240 × 2772） | ✅ |
| 触摸（Synaptics S3910 + TCM） | ✅ |
| 电池 / 充电 | ⚠️ 驱动已编入，充电 firmware backend 未起来 |
| GPU / 音频 / Wi-Fi / 相机 | ❌ 未写 |
| 免 USB 安装（写分区从本机启动） | ❌ 未做 |

## 启动链路

### 一次性准备（PC 侧）

| 东西 | 产物 |
|---|---|
| `make kernel`（XNU + HakiOS 驱动） | `hakios-kernel`，约 14.8 MB |
| `make loader` | `xnuloader/loader.efi` |
| Mu-Silicium + vendor 驱动 + cliffs 平台 | `SILICIUM_UEFI.fd`（基址 `0xA7100000`） |
| `userland/build.sh`（Darwin 16.5） | `system.apfs`，2.36 GB |

### 跑起来

```bash
fastboot devices                            # 关机后长按 电源+音量下
DEVICE=cliffs-ace3v ./xl enter              # 打包 + fastboot boot，全进 RAM
DEVICE=cliffs-ace3v ./xl ramdisk userland/system.apfs   # 2.36 GB，约 80 s
DEVICE=cliffs-ace3v XL_CMDLINE="touchscreen=2 cpus=8 bootcpu=0" ./xl run
```

内部发生的事：

```
fastboot boot  →  BootShim(176 B)  →  复制 UEFI FD 到 0xA7100000、payload 到 0xF0000000
   →  Mu-Silicium DXE 初始化（PmicDxe / TLMMDxe / UFSDxe / USB / 显示）
   →  XnuLoader 加载 loader.efi，打开 fastboot 服务
   →  loader 建 DTB / boot_args，PSCI 拉起 8 核，跳 XNU
   →  内核算 GICv3、挂 md0 根分区、跑 launchd.darwin 与 backboardd/SpringBoard
```

收场有四种方式：`loader_return_after` 到时、PC 上 `xl stop`、屏幕五指按住 1.5 秒、或者 `battguard` 低电保护。之后 `./xl reboot` 回 Android。

**为什么全是 RAM：** 系统镜像放在内存 resident 区（`md0`），所以每个 loader 会话只需传一次，之后可以反复 `xl run` 试内核——这是能一天迭代几十轮的前提。

## 三个硬坑

### 一、GIC：每核 redistributor 的步长不是默认值

`cpus=8` 时 secondary core 一读 `GICR_TYPER` 就 synchronous external abort。真机设备树写得很清楚：

```
reg = <0x17100000 0x10000 0x17180000 0x200000>   // 8 核 → 0x40000 步长
```

而 ARM 架构默认是 `0x20000`，内核里 `GICR_FRAME_SIZE` 也是写死的。第 1 个 secondary core 就走到了一块不存在的帧上。

修法：loader 的 platform 结构加 `gic_redist_size = 0x200000`，内核改成按 `gicr_size / 核数` 动态推步长。改完 8 个核全部注册成功。

### 二、TLMM：设备树的 reg 基址 ≠ 寄存器窗口

触摸驱动的第一个探针就整机硬挂——没有 panic，USB 变成 `05c6:900e`（crash dump 模式）。诡异的是 Android 自己的 pinctrl 驱动读同一地址完全正常。

从 vendor 的 `TLMMDxe.efi` 里挖到答案：

```
/soc/pinctrl@f100000
```

GPIO 配置寄存器真正的窗口是 **`0x0F100000 + 0x1000 * n`**，而设备树里 `pinctrl@f000000` 给的是更大一块区域的基址。按它去读，读到的是不该碰的东西。

改到 `0x0F100000` 之后，引脚读写、bit-bang SPI 全部正常。这一个 1 MB 的偏移，让人查了两天。

### 三、供电：Android 跑在 Gunyah hypervisor 里

引脚通了，SPI 读回来还是全 0——因为**触摸芯片根本没上电**（未上电的芯片被 ESD 钳位拉低）。而且 `adb reboot bootloader` 的关机路径里，HBP suspend 会把触摸电源关掉。

要开的是 `ldob22`（VDD，3008 mV）和 `ldom5`（VCC，1800 mV）。麻烦在于内核日志里那句：

```
Running under Gunyah hypervisor 51/v1
```

我们的启动链跑在 Gunyah 的引导 VM 里，**RPMh 被 hypervisor 接管**：`cmd_db` 能读，但往 TCS 发写请求，`irq-status` 永远是 0。

最后走的是一条"借固件的手"的路线：UEFI 的 `PmicDxe` 里已经有建好的 `pmic` handle，loader 通过 RPMh client 协议（GUID `e1d0b573-f29f-495d-9352-ca0dd42a0a74`）借用它，对两路电源各发电压 / 使能 / 模式三条命令。**loader 启动时就把触摸电打开，内核起来时芯片已经带电**——不依赖 Android，也不用改固件。

中间还试过给 UEFI 的 PMIC 配置表打补丁（等长替换轨道名 + 最小 DTB），二进制确实进了 FV，但用完整 vendor DTB 时手机在 UEFI 阶段挂住，就先放下了。

## 触摸协议里两个坑

供电通了只是开始，报点解析错了表现就是"点不动"：

- **没有 `NUM_OF_ACTIVE_OBJECTS` 时只能解析一个对象**。按"一直解析到结尾"写，数据流尾部半截对象会把真实对象覆盖成"抬起"——这就是"屏幕中间点不动 / 键盘偶尔失灵"的根因；
- **手势 opcode `0xC6` / `0xC7` 要按位宽跳过**，当成结束符会让后面的数据全乱。

坐标要自己归一化（`raw * 65535 / max`，默认不镜像，`touch_xmirror=1` 可切）。

## 安全边界

- 所有对手机的操作**只读**（`dd if` / `adb pull`），没写过任何分区；
- 启动用 `fastboot boot`（RAM），不是 `fastboot flash`；后者才是不可逆的写槽；
- `dumps/` 里的 `vbmeta`、`boot`，以及可能含 IMEI / MAC 的 `persist`、`modemst*`，不要上传、不要提交；
- 没有救砖手段之前，不要尝试写 slot。

这台机器被反复重启了几十次，每次都是 RAM 启动，`adb devices` 一切正常——边界守住了，才有反复试错的空间。

## 下一步

优先级大概是这样：

1. **电池 / 充电**：现在跑久了会没电直接断电（USB 都没了），需要接充电器；
2. **显示刷新率**：目前是软件渲染，约 10 fps，能用但离流畅很远；
3. **UFS / Wi-Fi / GPU**：Adreno 732 属于 a7xx 世代，需要新的寄存器表和 Metal 适配，是后面的大工程；
4. **免 USB 安装**：从 userdata 尾部切一个 `darwin` 分区写入系统镜像，配合 `fastboot set_active` 切 slot，开机直接进 iOS。

第四步做完，这台手机才算真正意义上的"双系统"。
