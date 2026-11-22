---
title: "在 OnePlus Ace 3V 上跑起 iOS 内核：HakiOS 移植总览"
description: "HakiOS 把 Apple 开源的 Darwin/XNU 内核搬到 Android 手机上。这篇是 OnePlus Ace 3V（PJF110 / SM7675「cliffs」）移植的总览：它是怎么做到的、UEFI 从哪来、现在能跑到哪一步。"
date: 2026-11-08
updated: 2026-11-22
tags: [HakiOS, Android, 内核移植, iOS]
pinned: true
---

把 iPhone 的系统内核跑在安卓手机上——听起来像段子，但 HakiOS 确实在这么干。这篇记录的是我把它折腾到 **OnePlus Ace 3V** 上的过程。

先给结论：`fastboot boot` 一条命令之后，手机屏幕会亮起 HakiOS 的标志，跑起真正的 XNU 内核，8 个核全部在线，最后进到 iOS 16.5 的 SpringBoard（桌面），触摸也能用。整个过程 **RAM-only**，不碰手机任何一个分区，重启就回 Android。

## HakiOS 是什么

[HakiOS](https://github.com/oosexgang/hakios-xnu-kernel) 是一个把 Apple 开源的 **Darwin 内核（XNU，`xnu-8796.121.2`）** 移植到 Android 手机硬件上的研究项目。

它的定位很像"手机上的 Linux"：内核是自己的，但引导加载器、驱动、配置系统、用户态全都得自己配一套。同一个内核既能在 QEMU 里跑（`make qemu-open`，不需要任何 Apple 的东西，也不需要任何手机），也能在真机上跑。

几个必须说清楚的前提：

- **它不是一个 ROM**，默认从内存启动，重启即回 Android；
- 仓库里**没有任何 Apple 的二进制**，也没有厂商固件。想要 Darwin 用户态，得拿你自己的 IPSW 去布置；固件从你自己的手机里提；
- 激活、Apple ID、iCloud、App Store 这类服务既不支持也不是目标；
- 与 Apple 无关联、未获认可，纯粹是研究项目。

## 目标设备

| 项 | 值 |
|---|---|
| 机型 | OnePlus Ace 3V（PJF110） |
| 平台代号 | `cliffs` |
| SoC | Snapdragon 7+ Gen 3（SM7675），8 核（core 0–2 是 A520 小核） |
| GPU | Adreno 732 |
| 屏幕 | 1240 × 2772，DSC 命令模式，120 / 90 / 60 Hz 三档 |
| 存储 | 三星 `KLUFG8RHHD-B0G1`，UFS 3.1 |
| Wi-Fi | QCA6750 |

## 为什么这台机器能搞

移植最大的不确定性本来在 UEFI：Mu-Silicium（HakiOS 用的 UEFI 基座）如果没有这颗 SoC 的支持，就得从零写一套，工作量以月计。

翻代码时发现了一件事：Mu-Silicium 的 `Silicon/Qualcomm/PalawanPkg/PalawanPkg.dsc.inc` 里，

```
SOC_TYPE = 0  →  SM8635
SOC_TYPE = 1  →  SM7675   ← 就是这颗
```

SMBIOS 里写得明明白白：`Snapdragon (TM) 7+ Gen 3 @ 2.80 GHz` / `SM7675`。同代的 POCO F6（peridot）、Realme GT Neo6 也都在用这个包。

所以 UEFI 这一关不是"从零支持一颗新 SoC"，而是**照着一台同代设备做一个平台包**——性质完全不同，从数月变成数天。

## 现在跑到哪一步

| 部分 | 状态 |
|---|---|
| UEFI 启动 + HakiOS loader | ✅ |
| XNU 内核单核 / 8 核启动 | ✅ |
| Darwin 用户态 → iOS 16.5 SpringBoard | ✅ |
| 显示（1240 × 2772 面板） | ✅ |
| 触摸（Synaptics S3910 + TCM） | ✅ 中间区域、键盘都可点 |
| 电池 / 充电 | ⚠️ 驱动已编入，充电 firmware backend 还没起来 |
| GPU / 音频 / Wi-Fi / 相机 | ❌ 未写 |
| 免 USB 安装（写分区从本机启动） | ❌ 未做 |

细节分别在后面两篇里：启动链路见 [从 fastboot 到 SpringBoard](/posts/android/hakios-ace3v-boot/)，触摸那场硬仗见 [把触摸救回来](/posts/android/hakios-ace3v-touch/)。

## 工程准备：真机数据驱动

这部分是整个移植里最"体力活"、但也最能省事的地方——**不靠猜，全部从真机上读**。

### 设备骨架来自真机的 FDT

```bash
python3 tools/hakios-device.py new cliffs-ace3v --soc sm7675 \
  --soc-title "Snapdragon 7+ Gen 3 (SM7675)" --title "OnePlus Ace 3V" \
  --vendor OnePlus --maintainer rrzt --fdt ../tools/fdt-cliffs.bin
```

`fdt-cliffs.bin` 是 `adb pull /sys/firmware/fdt` 拉下来的合并设备树（751 319 B）。生成器从里面读出 16 项 SoC 参数，**15 项一次到位**，只剩 modem 的 `soc_pas_mpss` 因为真机树里没写 `qcom,pas-id` 而缺席。

顺带 dump 了 12 个分区（`boot_a/b`、`init_boot_a/b`、`dtbo_a/b`、`uefi_a/b`、`vbmeta_a/b`、`vendor_boot_a/b`，共约 840 MB），以及 `xbl_a` / `xbl_config_a`（Mu-Silicium 的厂商驱动就从 XBL 里提）。

### DTB 的出处比想象中讲究

`vendor_boot_a.img` 里其实塞了 **8 个完整的 DTB**（Cliffs、Cliffs 7、Pineapple 系列、Volcano 系列……），一个 SoC 一个。取第一个（478 025 B）才是这台机器的基树，和 `/sys/firmware/fdt` 那种"合并后带 overlay"的树不是一回事——前者给 UEFI，后者给内核读参数，别混用。

### UEFI 平台包

```
devices/cliffs-ace3v/uefi/files/
├── Platforms/OnePlus/cliffs-ace3vPkg/     # 照 POCO F6 的 peridotPkg 改
│   ├── cliffs-ace3v.dsc                   # SOC_TYPE = 1，SMBIOS "OnePlus"/"Ace 3V"/"PJF110"
│   ├── cliffs-ace3v.fdf
│   └── Library/{MemoryMapLib,ConfigurationMapLib}/
├── Resources/Configs/cliffs-ace3v.toml    # FD base 0xA7100000 / size 0x300000
├── Resources/DTBs/cliffs-ace3v.dtb
└── Binaries/cliffs-ace3v/                 # 厂商驱动不入库，从 xbl_a.img 用 UEFIReader 提
```

内存映射是照真机 `reserved-memory` 重写的，FD 区 `0xA7100000`、payload `0xF0000000` 在这台机器上都是空闲内存。这些地址后面会反复出现——它们是整条启动链的地基。

### 固件

按参考机（POCO X5 Pro 5G）的脚本改了一份 `pull-firmware.sh`，从 `/vendor/firmware_mnt/image` 拉了 321 个文件、257 MB：

| 目录 | 内容 | 大小 |
|---|---|---|
| `fw-gpu/` | `gen71100_gmu.bin`、`gen71100_sqe.fw`、`gen70900_*` | 376 KB |
| `fw-wifi/` | `qca6750/` 的 bdwlan 板级数据、`WCNSS_qcom_cfg.ini` | 12 MB |
| `fw-audio/` | `adsp2.*`（这代是 adsp2，不是 adsp） | 23 MB |
| `fw-modem/` | `modem.*`、`ipa_fws.*` | 134 MB |

## 顺手修掉的上游 bug

移植过程里踩到的坑不全是自己的，有几个是仓库本身的：

1. **`tools/soc-args.py`** 读不懂厂商树里的节点命名（`aop_cmd_db_region`、`mpss_region`、`qcom,aoss-qmp` 这些），导致 6 个 `soc_*` 参数读不出来；
2. **`xnu-deps/setup.sh`** 在 Linux 上没把 theos 的 `dsymutil` 链进 `xnu-deps/host/bin`，XNU 构建会在 dSYM 阶段挂掉；
3. **`tools/make-kernel.sh`** 只认英文 make 输出（`Error 2`），中文 locale 下是 `错误 2`，于是把成功构建判成失败；
4. **`qemu/run.sh`** 只会找 3 MB 的 `QEMU_EFI.fd`，不认 Fedora 上 64 MB 的 `QEMU_EFI-pflash.raw`。

这些改动都很小，但对"能不能一遍跑通"影响巨大。如果你也在跟着文档移植，这四个点可以先打上。

## 安全边界（很重要）

这类折腾最怕的是把手机弄成砖，所以流程上做了几条硬约束：

- 所有对手机的操作**只读**（`dd if` / `adb pull`），没有写过任何分区；
- 启动用 `fastboot boot`（RAM 启动），不是 `fastboot flash`；后者才是不可逆的写槽操作；
- `dumps/` 里的 `vbmeta`、`boot`、以及可能含 IMEI / Wi-Fi MAC 的 `persist`、`modemst*`，**不要上传、不要提交**；
- 没有救砖手段（官方救砖包 / EDL 线）之前，不要尝试写 slot。

到目前为止这台机器被反复重启过几十次，每次都是 RAM 启动，`adb devices` 一切正常——边界守住了，才有后面反复试错的空间。

## 下一步

按优先级：触摸已经通了，剩下的是**电池/充电**（现在内核跑久了会断电"卡住"）、**显示刷新率**（软件渲染只有 ~10 fps）、然后是 UFS、Wi-Fi、GPU（Adreno 732 属于 a7xx 世代，需要新的寄存器表和 Metal 适配）。

还有一条很值得做的：**免 USB 安装**——从 userdata 尾部切一个 `darwin` 分区写入系统镜像，再配合 `fastboot set_active` 切 slot，就能不插电脑直接开机进 iOS。这一步做完，这台手机才算真正"双系统"。
