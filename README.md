# AstraVoxel Ark / 星野方舟

一款面向 Web、Android、Windows 和 Linux 的轻量体素沙盒探索建造游戏。

**正式版本：v1.0.1 · 单机版**

[![Version](https://img.shields.io/badge/version-1.0.1-8f7cff)](https://github.com/Lunora-Gather/astra-voxel-ark/releases/latest)
[![Verify](https://github.com/Lunora-Gather/astra-voxel-ark/actions/workflows/verify.yml/badge.svg)](https://github.com/Lunora-Gather/astra-voxel-ark/actions/workflows/verify.yml)
[![Deploy](https://github.com/Lunora-Gather/astra-voxel-ark/actions/workflows/deploy.yml/badge.svg)](https://github.com/Lunora-Gather/astra-voxel-ark/actions/workflows/deploy.yml)
[![License](https://img.shields.io/badge/license-MIT-5fd3a8)](LICENSE)

**[在线游玩](https://lunora-gather.github.io/astra-voxel-ark/)** ·
**[下载正式版](https://github.com/Lunora-Gather/astra-voxel-ark/releases/latest)** ·
[游戏设计](GAME_DESIGN.md) ·
[打包说明](PACKAGING.md)

![AstraVoxel Ark 游戏预览](docs/assets/preview.png)

## 游戏简介

你将在程序生成的星野群岛中采集资源、建造结构、升级工具、寻找地标碎片，并逐步修复方舟核心。

AstraVoxel Ark 保留体素沙盒自由挖掘与建造的乐趣，同时采用更轻量的生存压力、明确的单机目标和面向浏览器及低端设备的性能预算。世界可离线游玩，进度保存在本机。

## v1.0.1 更新

`v1.0.1` 是正式版的维护与性能更新，保持 v8 存档完全兼容。

- 重新整理启动流程，确保设备分级、触控识别和已保存画质在 WebGL 创建前生效。
- 将性能与生存 HUD 拆为独立的类型化组件，降低主循环和 DOM 的耦合。
- 统一程序化地形随机算法，并在切换世界时释放旧地形缓存。
- 清理过期性能配置、旧字符串坐标实现及未使用代码。
- 加强 TypeScript 检查，未使用变量和参数现在会阻止构建。
- 补充维护架构与依赖方向文档，便于继续拆分世界、输入和 UI。

## 核心内容

| 系统 | 内容 |
|---|---|
| 世界 | 确定性种子、流式区块、四种生态、矿脉、树木、植物与地标遗迹 |
| 采集 | 按住挖掘、方块硬度、三阶工具、桌面与触屏统一规则 |
| 建造 | 单格、立柱、墙、定向阶梯、平台、批量预览与最近 32 次撤销 |
| 成长 | 18 种材料、配方、批量合成、目标奖励与方舟修复 |
| 生存 | 生命、坠落伤害、寒夜、晶体防护、水中游动与方舟休整 |
| 探索 | 坐标、生态提示、地标指南针、六枚核心碎片与情境式引导 |
| 存档 | 三个独立命名世界、自动保存、备份恢复、JSON 导入与导出 |
| 平台 | GitHub Pages、Android、Windows x64/arm64、Ubuntu AppImage/deb |

多人入口目前仅作为未来扩展边界保留。`v1.0.1` 是完整可玩的单机版本，不依赖网络服务。

## 开始游玩

### 在线版

直接访问：

**https://lunora-gather.github.io/astra-voxel-ark/**

Web 存档位于当前浏览器的本地存储中。清理站点数据、切换浏览器或更换设备前，请在 `Game Menu → World` 中导出 JSON 备份。

### 桌面与 Android

前往 [GitHub Releases](https://github.com/Lunora-Gather/astra-voxel-ark/releases/latest) 下载：

- Windows x64 / arm64 安装包
- Ubuntu AppImage / deb
- Android debug APK

### 本地开发

需要 Node.js `^20.19.0` 或 `>=22.12.0`。

```bash
git clone https://github.com/Lunora-Gather/astra-voxel-ark.git
cd astra-voxel-ark
npm ci
npm run dev
```

生产构建与完整验证：

```bash
npm run build
npm run verify
```

`npm run verify` 包含 TypeScript 检查、架构与性能守卫、生产构建，以及桌面和多种触屏布局的 Electron 交互烟测。

## 操作

| 动作 | 桌面 | 触屏 |
|---|---|---|
| 移动 | `WASD` | 左侧摇杆 |
| 视角 | 鼠标 | 右侧拖动 |
| 跳跃 / 游泳 | `Space` | `Jump / Swim` |
| 冲刺 | `Left Shift` | 摇杆推至边缘 |
| 挖掘 | 按住左键 | 按住 `Break` |
| 放置 | 右键 | `Place` |
| 选择材料 | `1–9` / 滚轮 | 点击快捷栏 |
| 切换材料页 | `Tab` | `Palette` |
| 切换建造模板 | `B` | 背包页 |
| 撤销建造 | `Ctrl/Command + Z` | 背包页 |
| 打开背包 | `E` | 游戏菜单 |
| 方舟休整 | `R` | 旅程页 |
| 菜单 | `Esc` / `II` | `II` |

## 存档与兼容性

- 三个世界槽位完全隔离，可分别命名。
- 世界由种子确定性生成，存档只记录玩家修改、探索和进度。
- 自动保存会合并重复写入，页面隐藏和移动端生命周期事件会触发安全保存。
- 每个槽位保留最近一次有效备份；主存档损坏时可从世界菜单恢复。
- 当前应用版本为 `1.0.1`，存档格式仍为 v8。
- 旧存档缺失的新字段会使用兼容默认值，不会重新生成已有世界。

## 低端设备优先

- 地形在 Worker 中异步规划，主线程按帧预算应用结果。
- 不透明地形使用区块贪心网格，粒子、云、植物和天空装饰使用实例化批次。
- `normal`、`strained`、`critical` 三档运行期保护会在持续掉帧时逐步降低非必要工作。
- `Eco` 模式锁定近视距与 30 FPS，关闭 MSAA、阴影和动态方块灯光。
- `Low`、`Balanced`、`High` 可逐级启用纹理地形、Lambert 光照、PBR 和阴影。
- 隐藏页面停止渲染，暂停界面降至 10 FPS，自动保存通过空闲任务合并执行。

## 项目结构

```text
src/
  app/            # 应用级渲染管线
  game/           # 设置、保存状态与页面生命周期
  performance/    # 设备分级、画质配置与运行期保护
  platform/       # 浏览器能力、启动策略与空闲任务
  player/         # 移动、碰撞与方块拾取
  render/         # 区块网格、粒子、灯光和天空装饰
  session/        # 本地会话与预留多人边界
  singleplayer/   # 背包、合成、目标、生存与建造规则
  systems/        # 音频等共享服务
  ui/             # 类型化 HUD 与界面呈现
  world/          # 地形、区块、生态、地标、缓存与存档
  workers/        # 程序化地形 Worker
scripts/          # 静态守卫、交互烟测与 Android 构建
electron/         # Electron 桌面壳
android/          # Capacitor Android 工程
docs/             # 架构、性能与维护文档
```

确定性玩法规则不依赖 Three.js、DOM 或网络库。`src/main.ts` 只负责组合浏览器输入、世界状态、渲染资源和帧循环；新规则应优先落入对应模块，再由入口接线。

## 架构文档

- [游戏设计案](GAME_DESIGN.md)
- [单机架构](docs/SINGLEPLAYER_ARCHITECTURE.md)
- [性能架构](docs/PERFORMANCE_ARCHITECTURE.md)
- [维护架构](docs/MAINTENANCE_ARCHITECTURE.md)
- [优化基线](docs/OPTIMIZATION_PLAN.md)
- [桌面与 Android 打包](PACKAGING.md)

## 打包与发布

```bash
# Linux AppImage + deb
npm run dist:linux

# Windows x64 + arm64
npm run dist:windows

# Android debug APK
npm run android:build
```

推送 `main` 会在完整验证后部署 GitHub Pages；推送 `v*` 标签会生成 Windows、Linux 和 Android 产物并发布 GitHub Release。

## 后续方向

- 将应用模板与完整 DOM 注册表继续拆入 `ui/`。
- 将世界流送队列和 Worker 编排收敛为独立控制器。
- 在保持 v8 存档兼容的前提下扩展遗迹、制作站、种植和探索事件。
- 继续在真实 Android 低内存设备上记录帧时间和纹理内存。
- 多人功能作为独立会话模块开发，不直接侵入单机世界规则。

## License

[MIT](LICENSE) © Lunora-Gather
