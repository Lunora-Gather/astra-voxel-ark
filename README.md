# AstraVoxel Ark / 星野方舟

> 一款面向网页、Android、Windows 与 Linux 的轻量体素沙盒探索建造游戏。

**正式版本：v1.0.0 · 单机版**

[立即在线游玩](https://lunora-gather.github.io/astra-voxel-ark/) · [查看打包说明](PACKAGING.md) · [游戏设计案](GAME_DESIGN.md)

![AstraVoxel Ark 游戏预览](docs/assets/preview.png)

## 游戏简介

你将在程序生成的星野群岛中采集资源、建造结构、升级工具、寻找地标碎片，并逐步修复方舟核心。游戏借鉴经典体素沙盒的自由挖掘与建造体验，同时保持更轻量的生存压力、清晰的单机目标和适合浏览器运行的性能预算。

v1.0.0 是完整可玩的单机正式版。多人联机入口仅作为未来扩展边界保留，目前不可用，也不会影响本地世界。

## v1.0.0 包含什么

| 系统 | 内容 |
|---|---|
| 世界 | 确定性种子、流式区块、四种生态、矿脉、树木、群系植物与地标遗迹 |
| 采集 | 按住挖掘、方块硬度、工具等级、触屏与桌面统一规则 |
| 建造 | 单格、立柱、墙、定向阶梯、平台、批量预览与最近 32 次建造撤销 |
| 成长 | 18 种材料、三阶工具、配方、批量合成、目标奖励与方舟修复 |
| 生存 | 生命、坠落伤害、寒夜、晶体防护、水中游动与方舟休整 |
| 探索 | 坐标、生态提示、地标指南针、六枚核心碎片和情境式新手引导 |
| 存档 | 三个独立命名世界、自动保存、备份恢复、JSON 导入导出与损坏回退 |
| 平台 | GitHub Pages、Android、Windows x64/arm64、Ubuntu AppImage/deb |

### 低端设备优先

- Worker 异步生成地形，区块按距离加载和回收。
- 不透明地形使用区块贪心网格，粒子、天空装饰和植物使用实例化批次。
- 运行期掉帧保护会逐级减少网格、地形、灯光和装饰工作，并在恢复后平滑还原。
- `Eco` 模式固定近视距与 30 FPS，关闭 MSAA、阴影和动态方块灯光，并降低首帧绘制缓冲。
- `Low`、`Balanced`、`High` 提供更高画质；设置保存在本机并在 WebGL 创建前生效。
- HUD 会根据桌面、短横屏、触屏横屏和触屏竖屏自动压缩或重排。

## 开始游玩

在线版无需安装：

**https://lunora-gather.github.io/astra-voxel-ark/**

存档保存在当前浏览器的本地存储中。清理站点数据或更换设备前，请在 `Game Menu → World` 中导出 JSON 备份。

### 本地运行

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

`npm run verify` 会运行类型检查、性能/功能静态守卫、生产构建，以及桌面和移动端 Electron 交互烟测。

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

## 世界与存档

- 三个世界槽位互相隔离，可分别重命名。
- 世界由种子确定性生成，存档只记录玩家修改、进度和已探索区块。
- 自动保存会合并重复写入；切后台、页面隐藏和移动端生命周期事件会触发安全保存。
- 每个存档保留最近一次有效备份，损坏或写入失败时会给出明确反馈。
- 当前 v8 世界格式继续兼容旧格式迁移；应用版本 `1.0.0` 与存档格式版本是两个独立概念。

## 项目结构

```text
src/
  app/            # 当前应用级粒子效果管线
  game/           # 设置、保存状态与页面生命周期
  performance/    # 设备分级、画质和运行期性能保护
  player/         # 移动、碰撞与方块拾取
  render/         # 区块网格、实例批次、灯光和天空装饰
  session/        # 单机入口与预留多人边界
  singleplayer/   # 背包、合成、目标、生存与建造规则
  systems/        # 音频系统
  world/          # 地形、区块、生态、地标、植物与存档
  workers/        # 地形 Worker
scripts/          # 静态守卫、Electron 烟测和 Android 构建
electron/         # 桌面壳
android/          # Capacitor Android 工程
docs/             # 正式架构与性能文档
```

核心单机规则不依赖 Three.js、DOM 或网络库。未来联机应通过 `src/session/` 的独立网关接入，不应把网络逻辑直接写入世界或进度系统。

## 打包

```bash
# Linux AppImage + deb
npm run dist:linux

# Windows x64 + arm64 安装包
npm run dist:windows

# Android debug APK
npm run android:build
```

推送 `v*` 标签会触发 GitHub Actions，验证后生成 Windows、Linux 和 Android 产物，并创建 GitHub Release。推送 `main` 会验证并部署 GitHub Pages。

## 文档

- [GAME_DESIGN.md](GAME_DESIGN.md) — 游戏方向、核心循环与已实现里程碑
- [PACKAGING.md](PACKAGING.md) — 桌面、Android 和版本发布说明
- [docs/SINGLEPLAYER_ARCHITECTURE.md](docs/SINGLEPLAYER_ARCHITECTURE.md) — 单机边界与多人预留接口
- [docs/PERFORMANCE_ARCHITECTURE.md](docs/PERFORMANCE_ARCHITECTURE.md) — 设备分级、Worker、区块和帧预算
- [docs/OPTIMIZATION_PLAN.md](docs/OPTIMIZATION_PLAN.md) — 当前优化基线与后续方向

## 后续方向

- 更丰富的遗迹、装饰方块和结构模板
- 更完整的制作站、种植与环境音
- 在保持旧存档兼容的前提下扩展生态与探索事件
- 多人联机将在未来作为独立模块开发，v1.0.0 不包含联机功能

## License

[MIT](LICENSE)
