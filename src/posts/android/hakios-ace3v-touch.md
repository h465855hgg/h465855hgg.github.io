---
title: "把触摸救回来：HakiOS 在 Ace 3V 上的 S3910 驱动攻坚"
description: "读一个寄存器就整机死机、RPMh 被 hypervisor 接管、触摸芯片根本没电——记录 Synaptics S3910 从完全不可用到能在 iOS 界面上点按的全过程。"
date: 2026-11-15
tags: [HakiOS, 触摸驱动, 逆向, RPMh]
---

内核能启动、SpringBoard 能画出来之后，卡住的就剩下触摸。没有触摸，iOS 界面只是一张壁纸。

这台机器用的是 **Synaptics S3910**（TCM 协议，挂在 `synaptics_tcm_spi` 上），HakiOS 仓库里现成的只有 Goodix 驱动，等于要从零写一个。这篇记录的是这个过程——它比想象中曲折得多，因为一半的问题根本不在驱动层。

## 起点：参数都是现成的

真机上能读到的信息其实很全：

| 项 | 值 |
|---|---|
| 芯片 | Synaptics S3910（TCM 协议） |
| 总线 | SPI（`spi1.0`，`tcm-spi-hbp`） |
| SPI 引脚 | gpio16–19（TLMM） |
| 中断 / 复位 | gpio129 / gpio128 |
| 供电 | VDD = PMX2230 LDO22（3008 mV），VCC = PM8010M LDO5（1800 mV） |
| 参考源码 | vendor 的 `synaptics_tcm_core.c`、`synaptics_tcm_S3910.c` |

驱动骨架很快就写出来了：bit-bang SPI、复位时序、identify。内核能编译、能启动，看上去一切顺利——直到第一次真机测试。

## 探针一挂，整机进 crash dump

第一个反常现象是：**只要读一下 TLMM 的寄存器，整机直接硬挂**。没有 panic，没有异常输出，USB 设备变成 `05c6:900e`（高通的 crash dump 模式），只能长按电源。

三种测法，结果很一致：

| 测试 | 结果 |
|---|---|
| 内核里只读 GPIO_CFG / GPIO_IO（pin 16/19/129，不写） | 挂 |
| loader（UEFI 阶段）启动时只读同样 6 个引脚 | loader 都起不来 |
| 对照组：不带探针的 loader | ✅ 正常 |

诡异的地方在于：**Android 自己的 pinctrl 驱动对同一地址、同一批引脚工作正常**（`f000000.pinctrl`，引脚状态一切正常）。

说明不是地址算错，而是"我们的启动链里，TLMM 处于一种不可访问的状态"。

## 第一个突破：地址少了 0x100000

沿着这条线查下去，从 vendor 的 `TLMMDxe.efi` 里挖到了一行关键信息：

```
/soc/pinctrl@f100000
```

而 Linux 设备树里的节点是：

```
tlmm: pinctrl@f000000 { reg = <0x0F000000 0x1000000>; }
```

**GPIO 配置寄存器真正的窗口在 `0x0F100000 + 0x1000 * n`**，而设备树给的那个 `0x0F000000` 是更大一块区域的基址——直接按它去读，读到的是不该碰的东西。

改到 `0x0F100000` 之后，一切正常了：

```
syna: pins before: 16=203 17=203 18=1 19=1 129=1
配置后：             16=3   17=280 18=280 19=280 128=1 129=3
```

loader 里能读、内核里能读写，bit-bang SPI 也能跑起来了。这个坑值得单独记一笔：**设备树的 reg 基址不等于寄存器的偏移起点**，尤其是高通这种把一堆子模块塞进一大块 MMIO 的 SoC。

## 第二个发现：Android 跑在 Gunyah 里

引脚能碰了，但 SPI 读回来永远是 0。继续查，撞见了真正的架构：

```
Running under Gunyah hypervisor 51/v1
```

这台机器上 Android 跑在 **Gunyah hypervisor** 下面，我们的启动链（BootShim → UEFI → loader → XNU）跑在它的"引导 VM"里。

后果是：**RPMh 被 hypervisor 接管了**。

- `cmd_db` 能读（magic 正确，`ldob22 @ 0x42c00`、`ldob5 @ 0x41100` 都在）；
- 但往 TCS 里发 RPMh 写请求，`irq-status` 永远是 0——命令发出去，没有回应；
- 更糟的是对 DRV0 / DRV1 盲写会让机器直接挂掉。

而 Android 的 primary VM 里，同样的操作是正常的。

## 第三个确认：触摸芯片根本没电

SPI MISO 全是 0，一开始以为是驱动问题。后来才想明白：**没上电的芯片，引脚会被 ESD 钳位拉低**——读出来可不就是 0 吗。

旁证也很干净：把一根悬空的引脚（gpio17）配上拉，能读到 1，说明引脚、上拉、读取全部正常；只有接芯片的那几根是死的。

再回头看 Android 那边：解绑平台 HBP 驱动，`/sys/class/regulator/regulator.N/state` 里 `pmxr2230_l22` 和 `pm8010m_l5` 立刻从 enabled 变 disabled；而只要 `adb reboot bootloader`，就算之前只解绑 SPI 驱动、两路电源还开着，进 fastboot 之后 loader 再测还是没电——**关机路径里 HBP suspend 会把触摸电源关掉**。

所以问题收敛成一句话：**在 loader 里把 LDO22（2.8 V）和 L5B（1.8 V）打开**。

## 逆向 RPMh：从 GUID 到函数表

RPMh 在引导 VM 里不可直连，但 **UEFI 固件自己有 RPMh 驱动**（`RpmhDxe`），它已经跑在能用的上下文里。思路就变成：让 loader 借用固件的协议。

逆向过程大致是这样：

1. 把 `RpmhDxe.efi` 里的 GUID 集合与各驱动 `.depex` 交叉比对，定位到 **RPMh 协议 GUID = `1c34f691-d33d-4e14-b8f8-32c6c029e95b`**（只出现在 RpmhDxe / CmdDbDxe / PmicDxe / ClockDxe / PwrUtilsDxe / ICBDxe / VcsDxe 里）；
2. 在 `.data` 里 GUID 之后找到 `Version = 0x10001` + **24 个函数指针**的接口表；
3. 从导出日志里对上名字：`rpmh_create_handle`、`delete_handle`、`issue_command_set`、`churn_all`、`churn_single`、`barrier_all`……

中间还试过一条"更省事"的路：把 `PmicDxeLa.efi` 里两条用不到的轨道名**等长替换**成 `ldob22` / `ldom5`（`ldob23 → ldob22`、`ldod1 → ldom5`），再给 UEFI 喂一份只含 `/pm` 节点的最小 DTB，让固件自己在启动时把这两路电源打开。

这条路走了一部分：二进制补丁、DTB、DtPlatformDxe 都塞进了 FV（`FVMAIN` 里能检出 `ldob22` 字符串），FD 大小也没爆——但第一次用完整 vendor DTB 时，手机在 UEFI 阶段就挂住了（大概率是 TLMMDxe 拿到 DT 之后开始碰 TLMM，和内核那次同源）。换最小 DTB 之后没再验证这条，因为下面这条路先通了。

## 最终方案：借固件的 handle 发命令

真正跑通的方案，全靠 UEFI 的 **RPMh client 协议**（GUID `e1d0b573-f29f-495d-9352-ca0dd42a0a74`）：

1. 在内存里按 `pm_rpmh.c` 字符串找到 `PmicDxe` 镜像；
2. 从它 `.data + 0x37908` 处拿到已经建好的 `pmic` handle；
3. 通过协议接口的 offset `0x30` 借用这个 handle；
4. 用 offset `0x78` 调 `rpmh_issue_command_set`，对 `ldob22` 和 `ldom5` 各发三条 VRM 命令（电压 / 使能 / 模式）——地址是 `cmd_db` 地址 + `0 / 4 / 8`。

于是整个供电流程变成：**loader 启动时就替内核把触摸电打开，内核起来的瞬间芯片已经带电**。不需要 Android 配合，也不需要改固件。

## TCM 协议：几个必须知道的细节

供电通了之后，剩下的是协议层。这部分全靠 vendor 源码对照，但有几个地方文档里不会写，踩了才知道：

- 命令响应的 header 里，`code` 字段是 **`STATUS_OK = 0x01`**，不是 report id；
- identify 拿到的字符串是 `S3910PA0B0-15.2`；
- app info：`max_x = 12399`、`max_y = 27719`、`max_objects = 10`；
- 要读 128 字节的 report config，然后发 `CMD_ENABLE_REPORT(0x05) + [0x11]` 才会开始出报点。

## 报点解析：三个坑

拿到数据流只是开始，解析错了表现就是"点不动"或者"偶尔失灵"。

**坑一：手势 opcode 不能当结束符。**
`0xC6` / `0xC7` 这两个 opcode 是手势相关的，必须**按位宽跳过**。当成结束标记处理，后面的数据就全乱了。

**坑二：没有 `NUM_OF_ACTIVE_OBJECTS` 时只能解析一个对象。**
这一条是"屏幕中间点不动 / 键盘偶尔失灵"的**根因**。如果按"一直解析到结尾"去写，数据流尾部半截对象会把真实对象覆盖成"抬起"状态——看起来就像触摸丢了。

**坑三：坐标要自己归一化。**
`raw * 65535 / max`，x / y 默认都不镜像；想要镜像得显式传 `touch_xmirror=1`。

## 结果

真机上用户的原话是："可以，差不多都能用了"——中间区域、键盘按键都能点。

链路完整跑通：

```
S3910 → SPI（bit-bang，gpio16–19）→ 内核解析 → /dev/hakios-touch
      → libhakios.dylib（inject）→ IOHID digitizer → backboardd → iOS
```

还写过一段程序，自动往系统里注入点击去打开「设置」，确认整条注入链路是通的。

## 遗留问题

- **内核长时间运行会"卡住"**：没有电池/充电驱动，跑久了没电直接断电，USB 也没了。需要接充电器，或者把电池驱动补完；
- **显示是软件渲染，约 10 fps**：能用，但离"流畅"很远，GPU 驱动（Adreno 732 / a7xx）是后面的大工程；
- **audio / Wi-Fi / 相机**：完全没开始。

## 复盘

如果只记三句话：

1. **先怀疑环境，再怀疑代码**。同一段 MMIO 在 Android 的启动链里好好的，在我们的链里一读就死——那不是地址算错，是地址之外的东西（电源、时钟、hypervisor 映射）没到位。
2. **设备树的 `reg` 不一定等于寄存器窗口**。`pinctrl@f000000` 和真正的 `0x0F100000` 差了整整 1 MB，这一 MB 让人查了两天。
3. **借固件的手，比逆完整个协议栈便宜**。RPMh 协议 24 个函数、参数顺序全靠反汇编猜；而 PmicDxe 已经把 handle 建好了，借来发三条命令就够了。

整台手机到现在没写过一个分区，所有测试都是 RAM 启动。这既是安全边界，也是能一天迭代几十轮的底气。
