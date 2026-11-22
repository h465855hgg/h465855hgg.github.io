---
title: "HakiOS 启动链路拆解：从 fastboot 到 SpringBoard"
description: "一条 fastboot boot 之后，手机里到底发生了什么？把 HakiOS 在 OnePlus Ace 3V 上的启动链路逐段拆开：BootShim、UEFI、loader、XNU，以及中途踩到的 GIC 和 USB 坑。"
date: 2026-11-11
tags: [HakiOS, 启动流程, UEFI, XNU]
---

这篇文章讲**怎么启动**，以及启动过程中每一步内部在干什么。目标机型是 OnePlus Ace 3V（PJF110 / SM7675「cliffs」），整条链路 **RAM-only**：不写手机任何分区，重启就回 Android。

先看全景：

![HakiOS 启动 iOS 全流程思维导图](/images/hakios-ios-boot-mindmap.png)

## 0. 前置条件（PC 侧，一次性）

| 东西 | 怎么来 | 产物 |
|---|---|---|
| 内核 | `make kernel`（XNU 8796.121.2 + HakiOS 驱动） | `hakios-kernel`（约 14.8 MB） |
| loader | `make loader`（`xnuloader/loader.c`，`identity.h` 由自己的 IPSW 设备树生成） | `xnuloader/loader.efi` |
| UEFI | Mu-Silicium + 高通 vendor 驱动 + cliffs 平台，`build_uefi.py -d cliffs-ace3v -r RELEASE` | `SILICIUM_UEFI.fd`（基址 `0xA7100000`） |
| 系统镜像 | `userland/build.sh`（Darwin 16.5 userland） | `userland/system.apfs`（2.36 GB） |
| 工具 | 仓库自带的 `./xl` | — |

内核编译用 `devices/cliffs-ace3v/configs/cliffs-ace3v_defconfig`，八个驱动先按"能起来"的最小集合编进去。

## 1. 让手机进 fastboot

手机关机后长按 **电源 + 音量下**，或者在 Android 里：

```bash
adb reboot bootloader
fastboot devices      # 应该出现 1c073e97  fastboot
```

## 2. `xl enter`：把引导链塞进 RAM

```bash
DEVICE=cliffs-ace3v ./xl enter
```

这一条命令内部做了五件事：

1. `mkxnuimg.py` 打包出 `xnu-usb.img` = BootShim + UEFI FD + XNUP payload（`loader.efi`、`chargerapp`）；
2. `fastboot boot xnu-usb.img` —— 注意是 `boot` 不是 `flash`，镜像只进内存；
3. **BootShim**（176 字节的小跳板）把 payload 复制到 `0xF0000000`，把 UEFI FD 放到 `0xA7100000`，然后跳过去；
4. Mu-Silicium 的 DXE 阶段开始初始化：PmicDxe、TLMMDxe、UFSDxe、USB device、显示……；
5. UEFI 启动内置的 XnuLoader，加载 `loader.efi`；loader 常驻下来，并开放一个 fastboot 服务。

看到 `xl: loader is up` 就成功了。此时手机对电脑来说就是一个叫 `xnuloader` 的 fastboot 设备。

## 3. loader 的开机准备

loader 是这套东西里最"脏"的部分——很多硬件在 UEFI 阶段没被完全初始化，得在这里补。当前实现里它做四件事：

- **触摸供电**：在内存里按 `pm_rpmh.c` 字符串找到 `PmicDxe` 镜像，拿到它已经建好的 `pmic` handle，再定位 RPMh client 协议（GUID `e1d0b573-f29f-495d-9352-ca0dd42a0a74`），给 `ldob22`（3008 mV）和 `ldom5`（1800 mV）下电压 / 使能 / 模式三条命令。这一段是触摸能不能用的前提，详见[触摸那篇](/posts/android/hakios-ace3v-touch/)。
- **触摸总线**：把 gpio16–19 配成 GPIO，bit-bang 出 SPI；gpio128 做复位（低 10 ms → 高 → 200 ms）。
- **充电固件**：`LoadImage` / `StartImage` 跑 `QcomChargerApp.efi`，给内核的电池驱动准备 charger backend。
- **存储 / 显示 / USB**：UEFI 驱动已经常驻，loader 通过共享内存页把它们当成"服务"交给内核。

## 4. 上传系统镜像（每个 loader 会话一次）

```bash
DEVICE=cliffs-ace3v ./xl ramdisk userland/system.apfs
```

2.36 GB，约 80 秒（29 MB/s）。传完之后它躺在内存的 resident 区，之后一直是 `md0`——所以每个 loader 会话只需要传一次，可以反复 `xl run` 试内核。

## 5. `xl run`：启动 XNU

```bash
DEVICE=cliffs-ace3v XL_CMDLINE="touchscreen=2 cpus=8 bootcpu=0" XL_SECS=300 ./xl run
```

内部流程：

1. 上传 `run-payload.bin`（kernel + root.apfs + cmdline）；
2. loader 解析 payload、挑一段合适的物理内存窗口、把内核 Mach-O 装进去；
3. 生成 `boot_args` 和设备树，用 PSCI 拉起 8 个核，跳到内核入口；
4. 内核跑满 `loader_return_after` 秒（或你 `xl stop`）后返回 loader。

## 6. XNU 内核做了什么

- ARM64 启动、GICv3、定时器、PSCI 8 核、VM / BSD 子系统初始化；
- **触摸线程**：TCM identify → 读 app info → 读 128 字节 report config → `CMD_ENABLE_REPORT(0x05) + [0x11]` → 每帧解析触点；
- 触点通过 `hakios_touch_post()` 进入 `/dev/hakios-touch` 队列；
- 挂载根分区：`md0` 上的 Darwin `root.apfs` + `system.apfs`。

## 7. Darwin 用户态（iOS）

- `init` / `launchd.darwin` 启动 `/redwood/LaunchDaemons`；
- `inject.c`（编进 `libhakios.dylib`）注入 backboardd：提供虚拟 HID 触摸、软件渲染、容器修复；
- backboardd + SpringBoard 把 iOS 界面画出来。

**触摸链路**是这样的：

```
S3910 芯片 → SPI → 内核解析 → /dev/hakios-touch → inject → IOHID digitizer → SpringBoard
```

## 8. 怎么收场

四种结束方式，随便哪种都行：

- `loader_return_after` 时间到；
- 你在 PC 上 `./xl stop`；
- 屏幕上五指同时按住 1.5 秒；
- `battguard` 检测到电量过低。

内核把控制权交回 loader，`./xl reboot` 回 Android。

## 踩坑记录

### GIC：每核 redistributor 的步长不是你以为的那个数

`cpus=8` 时，secondary core 在 `gic_v3_irq_cpu_init` 里读 `GICR_TYPER` 就直接 synchronous external abort（ESR `0x96000010`）。单核一切正常，说明是每核 redistributor 地址算错。

真机设备树里写得很清楚：

```
interrupt-controller@17100000 {
    reg = <0x17100000 0x10000 0x17180000 0x200000>;
}
```

8 个核、`0x200000 / 8 = 0x40000` 的步长——而 ARM 架构默认是 `0x20000`。loader 给内核的 DT 里 GICR 大小写死 `0x100000`，内核里 `GICR_FRAME_SIZE` 也写死 `0x20000`，于是第一个 secondary core 就走到了一块不存在的帧上。

修了两处：loader 的 platform 结构加上 `gic_dist_size` / `gic_redist_size`（cliffs 用 `0x10000` / `0x200000`）；内核里 `gicr_frame_size` 改成由 `gicr_size / 核数` 动态推出来（下限 `0x20000`）。改完 8 个核全部注册成功。

### 让内核在大核上启动还不行

`cpus=8 bootcpu=0` 正常，但 `bootcpu=7`（让内核从 X4 大核起）会早期 abort。这条路径在参考机 redwood 上是通的，所以多半是 cliffs 这边跨核 PSCI 启动的缓存一致性 / 入口问题，属于后续优化——主路径能跑就先不追。

### 真机上写一个 MMIO 就 Synchronous Exception

第一次真机尝试时，loader 卡在 `Synchronous Exception at 0xBDBEA96C`。反汇编对回去，PC 落在一条 `strh w9, [x27]` 上，`x27 = 0x09020000`。

原因很无语：`loader.c` 里有一段 **QEMU fw_cfg 探测**——发现帧缓冲地址不是参考机的 `0xE1000000` 就认为自己在 QEMU 里，往 `0x09020000` 写半字。真机上这个地址是活的 MMIO，一写就挂。

修法是加 `firmware_vendor_is()`：读 UEFI 的 `FirmwareVendor`（QEMU 的 stock EDK2 是 `EDK II`，HakiOS 自己的 UEFI 是 `HakiOS`），真机就完全不碰 fw_cfg，并按帧缓冲地址选择平台（`0xE1000000` → redwood，否则 → `platform_cliffs`）。

### USB 一旦没枚举，手机就卡死

早期 loader 的 USB 没枚举，`xl` 连不上，只能长按电源键硬重启。现在加了引导参数：

```bash
usb_host_timeout=30
```

超时前没收到主机第一条命令，loader 就把日志写进 `logdump`、打印一句 `usb: no host in 30 s: giving the phone back to Android`，然后 cold reset 回 Android。

这个改动看着小，但它把"每次失败都要人手按电源"变成了**无人值守迭代**——内核调试能一天跑几十轮，靠的就是它。

## 未来：不插电脑也能开机

现在每次都要 PC 陪跑，是因为系统镜像在内存里。要免 USB，路已经画好了：

1. 从 userdata 尾部切一个 `darwin` 分区（`tools/userdata-carve.py`，会缩 Android 数据区）；
2. `tools/darwin-write.py` 把 2.36 GB 镜像写进去（带回读校验）；
3. 内核用 `root_apfs=` 从手机存储挂载，而不是 `md0`；
4. 启动镜像刷到非活动 slot，`fastboot set_active` 切过去 —— 开机直接进 iOS。

这一步做完，Ace 3V 才算真正意义上的"双系统"。

## 当前状态

| 部分 | 状态 |
|---|---|
| 显示 + iOS 16.5 SpringBoard | ✅ |
| 触摸（S3910，含中间区域 / 键盘） | ✅ |
| 多核 8 核启动 | ✅ |
| 电池 / 充电 | ⚠️ 驱动已编入，充电 firmware backend 未初始化 |
| GPU / 音频 / Wi-Fi / 相机 | ❌ 未写 |
| 免 USB 安装 | ❌ 未做 |

一句话总结这条链路：**`fastboot boot` → BootShim → UEFI（SM7675 平台）→ HakiOS loader → XNU → 用户态 → 日志回传 → 自动重启回 Android**，全在 RAM 里发生，不留下任何痕迹。
