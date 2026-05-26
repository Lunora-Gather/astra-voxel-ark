# 之后要让 Alexander 干的任务

这个文件专门装后续任务，之后你可以直接说“继续 Hermes 里的游戏项目”

## 已完成

- **v1.3 生存诊断与移动端布局升级 (Survival Diagnostics & Mobile Readability Update)**:
  - 重构 Survival Diagnostics 面板，引入炫酷的 Glassmorphism 设计和动态呼吸环境发光特效
  - 增加 Crystal Power & Threat Level 标识的专属 SVG icon 图标，优化生存参数的视觉识别度
  - 修复移动端横屏状态下 Survival Diagnostics 被隐藏的 Bug，实现横屏自适应水平紧凑排版
  - 修复移动端低分辨率下 Hotbar 与摇杆 / 动作按键重叠冲突的问题，动态适配安全间距限制
- 创建 GitHub 公开仓库：`wangjiehu/astra-voxel-ark`
- 搭建 Vite + TypeScript + Three.js 项目骨架
- 完成可玩的 MVP：移动、视角、挖方块、放方块、8 格物品栏
- 加入日夜循环、水、发光方块、雾效、浮云、星光粒子
- 配置 GitHub Pages 自动部署
- 加 MIT License、topics、README、预览图和基础 SEO meta

## 下一轮优先级

### P0：第一眼审美
- 做更高级的方块纹理：草地顶面/侧面分离、石头噪声、木纹
- 水面做轻微波动，不要只是透明方块
- 加更漂亮的截图/宣传 GIF

### P1：代码和性能
- 拆分 `src/main.ts`
- 方块合批：InstancedMesh 或 chunk mesh
- Raycast 只检测附近/可见方块
- 玩家碰撞避免把方块放进身体

### P2：玩法
- 简单背包
- 合成台
- 存档
- 遗迹和宝箱
- 音效和背景音乐

### P3：区块就绪后的核心玩法 (v1.2 规划) [进行中]

- [x] **v1.2 无限地平线 HUD 与生存循环 UI (Infinite Horizon HUD & Survival UX Foundation)**:
  - 增加“Survival Diagnostics”生存状态监控面板
  - 实装动态昼夜状态（Time Phase）与威胁等级（Threat Level）展示
  - 引入 Crystal Power 动态电量进度条，基于玩家背包中的晶矿（Crystal Block）数量进行电量模拟与补充
- [ ] **动态无限地图生成 (Infinite Procedural World)**:
  - 基于玩家当前的区块坐标，在后台线程/协程中动态加载、生成和卸载外围区块，实现真正的无限世界平滑游玩。
  - 区块多线程生成：利用 Web Worker 独立计算噪声与顶点属性，避免主线程卡顿
- [ ] **物理与交互式流体 (Voxel Physics & Fluids)**:
  - 实现受重力影响的方块（如沙子、碎石坠落压碎植被）
  - 基于区块相邻网格的简易阶梯流体扩散（如水源方块流动与回流）
- [/] **晶矿供能与生存昼夜环境 (Crystal Power & Dangerous Nights)**:
  - [x] 设计 HUD 显示及与背包晶矿的数量进行基础交互绑定
  - [ ] 实现 Crystal Power 便携光源范围的动态衰减与限制
  - [ ] 挂载深夜光照度过低时的屏幕冷色调滤镜/视野大幅受限（Vignette 渐变效果）
  - [ ] 增加玩家在极寒深夜时生命/体温/辐射值随时间下降的生存机制
  - [ ] 允许通过消耗背包中的晶石或火把方块建立安全光照网络（点亮后抵消负面状态）

## 给 Codex / 小弟的任务草稿

```text
Improve AstraVoxel Ark, a Vite + TypeScript + Three.js voxel sandbox game.
Focus on GitHub-ready polish: procedural block textures, water animation, performance, code organization, and README presentation.
Keep the project simple, clean, and deployable on GitHub Pages.
Run npm run build before finishing.
```

## QA Feedback & Performance / Mobile Usability Risks (v1.4)

### 性能风险与优化建议 (Performance Risks)
1. **逐帧 JavaScript 动画更新瓶颈 (Per-Frame JS Animation Loop)**:
   - **问题**: 在 `animate()` 循环中，`waterBlocks` 和 `grassTufts` 列表在每一帧中都会被 JavaScript 逐个更新 `position` 和 `scale`。随着玩家移动并加载更多区块，水体与草丛的实例数量急剧膨胀，导致大量的 CPU 运算与频繁的 WebGL 数据重传，导致严重卡顿。
   - **建议**: 应避免在 JS 线程中逐个循环网格的动画。可将波动动画移入自定义的 `ShaderMaterial` 顶点着色器（Vertex Shader）中通过统一时间变量（uniform time）驱动，或使用 `InstancedMesh` 的顶点属性动态控制。
2. **全局射线检测开销 (Global Raycasting Overhead)**:
   - **问题**: `pickBlock()` 目前使用 `raycaster.intersectObjects(blockMeshes)` 对整个世界的所有 `blockMeshes` 数组执行包围盒/球交点计算，这对具有成千上万方块的大型场景非常重。
   - **建议**: 应当将射线检测限定在玩家前方的局部区块（如 3x3x3 范围），利用空间网格快速索引，避免全局遍历。
3. **缺少方块合批 (Missing Batching / Draw Call Bottleneck)**:
   - **问题**: 所有的普通方块和额外生成的边框线都分别对应了独立的 `THREE.Mesh`，造成极端夸张的 Draw Call 次数。
   - **建议**: 需要尽快落实 P1 中规划的方块合批，通过单单一大网格拼接（Mesh Merging）或者利用 `InstancedMesh` 进行合并渲染。

### 移动端体验与触控优化 (Mobile Usability & UX)
1. **刘海屏与圆角遮挡 (Notch & Safe Area Clipping)**:
   - **已修复**: 手机横屏游玩时，左右两侧 UI 贴边极易被现代屏幕的“刘海”或圆角裁剪。我们已在 `style.css` 的移动端适配部分为所有侧边元素引入了 `env(safe-area-inset-*)` 变量，动态计算安全边距。
2. **Hotbar 滚动条视觉与交互干扰 (Hotbar Scrollbar Obtrusion)**:
   - **已修复**: 手机小屏下 Hotbar 改为横向滚动虽然保障了小屏适配，但默认的系统滚动条非常破坏高级感，甚至会挡住格子底部的名称和晶石计数。我们已通过 CSS 彻底隐藏了滚动条，并对物品格添加了 `touch-action: manipulation` 避免双击误触缩放，极大地提升了类似原生 Dock 栏的滑动畅快度。
3. **横屏下面板潜在堆叠重叠 (Potential HUD Overlap)**:
   - **已修复**: 为生存面板 `.survival-badge` 与 `.help` 的宽度和边距增加了基于 `safe-area-inset` 的动态宽度保护，防止二者在窄屏设备上严重重叠。

## QA Feedback & Playability Pass (v1.5)

### 移动端体验与触控优化 (Mobile Usability & UX)
1. **热键栏与虚拟按键重叠风险 (Hotbar & Virtual Buttons Overlap)**:
   - **问题**: 在小屏移动端横屏（Landscape）模式下，右侧 3 按键网格（Jump, Break, Place）与底部居中的 Hotbar 存在水平重叠风险。较窄屏幕下容易在点击按键或点击热键栏时发生误触。
   - **已修复**: 在 `src/style.css` 的横屏媒体查询中对 `.hotbar` 引入了动态的 `width: clamp(180px, calc(100vw - 470px - env(safe-area-inset-left) - env(safe-area-inset-right)), 400px)`，在水平方向预留了足够的安全区域，彻底规避了与左侧虚拟摇杆、右侧虚拟按键的重叠干涉。

### 碰撞与放置 UX 风险 (Collision & Placement Risks)
1. **玩家方块放置防夹塞 (Player Anti-Trapping on Placement)**:
   - **已修复**: 新版本通过引入 `PLAYER_PLACEMENT_CLEARANCE` (0.08) 扩张了 placement 重叠判定盒，并结合 `playerOverlapsBlockAt` 进行前置验证，使得玩家无法在贴近自身包围盒的距离内放置方块。这极大地减少了因方块放置导致玩家被“夹在方块里”或卡死（trapped）的 UX 故障率。
2. **垂直运动碰撞抖动 (Vertical Collision Jitter)**:
   - **已修复**: 在 `animate()` 中由直接的 Y 轴 `floor` 强力截断重置（Clamp）升级为基于二分插值检测的 `movePlayerVertical()` 垂直碰撞推进逻辑。在受到重力下坠或跳跃触顶时，能平滑检测并回退到非碰撞临界位置，大幅降低了之前版本在方块边缘频繁发生的上下跳动和镜头拉伸感。
3. **水体放置干涉限制 (Water Block Placement Restriction)**:
   - **潜在风险**: 当前水体方块（`water`）的 Mesh 会被加入到全局 `blocks` 关系映射中。当玩家试图在水体中放置其他实体方块时，由于 `!blocks.has(key)` 校验，放置行为会被拦截。这导致玩家无法像常规沙盒游戏那样在水里直接用实体方块“排干/替代”水体，增加了水下建造的难度。
   - **建议**: 在后续迭代中，应允许在 `placeTargetBlock` 时将水体或空气等“非固体/流体”方块视作可直接覆盖 (override/replace) 的背景，从而提升水下/复杂环境的建造体验。

## QA Feedback & Playability Pass (v1.6)

### 建造流向与水体替代 (Build-Flow & Water Replacement)
1. **水体物理替代机制 (Water Block Replacement)**:
   - **设计建议**: 允许实体方块替代水体以优化建造体验。在 `placeTargetBlock()` 中，若目标位置存在水体（即 `blockData.get(key) === 'water'`），应先获取水体 Mesh 实例，调用 `removeBlock(waterMesh, 'system')` 移除该水体，然后正常执行新方块的放置 logic。
   - **交互视线设计**: 鉴于水体网格（water）具有一定可见性并被包含在射线检测数组中，若直接穿透水体会破坏物理感。因此建议保留水体作为可点击表面，但在放置时直接覆盖它。

### 玩家防夹塞/防卡死机制 (Player Anti-Trapping on Placement)
1. **防夹判定一致性**:
   - **现状**: 现有的 `PLAYER_PLACEMENT_CLEARANCE = 0.08` 与 `wouldTrapPlayer` 成功阻断了玩家把方块塞入自己身处的空间。
   - **v1.6 校验要求**: 在实现水体替代流程后，需确保移除水体并放置实体方块时，依然严格进行 `wouldTrapPlayer` 的重叠校验，避免玩家在脚下水坑放方块导致角色被死死卡在实体方块内部。

### 移动端触控放置与挖掘手感 (Mobile Touch Placement & Break Feel)
1. **虚拟按键激活微动效 (Button Scale & Active Transition)**:
   - **已修复 (CSS-only)**: 在 `style.css` 中为 `.touch-btn` 增加了 `transition` 缓动，并增加了 `:active` 伪类样式（缩放 scale(0.92)、深蓝渐变高亮与阴影重置），使移动端虚拟按键（Jump, Break, Place）在被点击时有明确的弹簧挤压和色彩深度反馈，告别无响应感。
2. **长按破坏与振动触觉反馈 (Long-press & Vibration Feedback)**:
   - **建议**: 在移动端长按右屏挖掘度达到 100% 触发 `breakTargetBlock()` 或单点 `placeTargetBlock()` 时，若浏览器支持，建议加入短暂的 haptic 反馈（例如 `navigator.vibrate(12)`），使破坏/放置实体有更厚实的物理冲击感。

## QA Feedback & Exploration / Performance Pass (v1.7)

### 1. 探索细节与结构生成 (World Exploration & Structure Detail)
- **现状**: 晶石与发光块目前仅作为单点随机生成于地表 (`Math.random() < 0.016`)，尚无聚集成群的矿脉或探索性人文遗迹结构。
- **QA 细节导向建议**:
  - **晶矿集群生成 (Crystal Clusters)**: 更改单点生成逻辑，改为基于 3D 噪声或相邻节点扩散生成“晶矿簇”（如 3-7 个晶石块相互连接的矿脉）。这能显著提升玩家采集时的获得感与地下/洞穴探索的真实感。
  - **稀有遗迹生成 (Rare Ruins)**: 增加小概率的结构生成器（如每区块 `0.001 - 0.002` 概率生成由 `brick`、`obsidian` 或 `gold` 构成的祭坛、残垣断壁或废弃石室）。这类遗迹可作为无限世界中的视觉路标与稀有建材来源，极大增强世界的探索深度。

### 2. 存档兼容性与体积风险 (Save/Load Compatibility & File Size Risks)
- **现状**: 存档序列化了全局所有的 `blockData`（包含数万个 procedurally 生成的普通方块）以及生成的区块键列表。
- **QA 兼容性与性能风险**:
  - **存档体积膨胀**: 随着玩家向外探索，`blockData` 大小呈指数级上升，序列化后的 JSON 字符串极易超出 LocalStorage 的 5MB 限制，并带来显著的序列化/反序列化卡顿。
  - **非确定性随机数瓶颈**: 由于树木、草丛、晶矿生成基于不确定的 `Math.random()`，无法仅保存玩家修改的 Diff (即 `playerPlacedBlocks` 和 `removedTerrainBlocks`) 进行还原。建议重构为**基于确定性种子 (Seed-based PRNG)** 的地形装饰生成，届时仅需存储 Seed 以及玩家对世界的修改 Diff 即可重建完整世界，且能完美向下兼容旧版。
  - **架构版本管理**: 目前 `serializeWorld` 声明了 `version: 4`，但 `applySavedWorld` 缺少版本兼容转换逻辑与数据合法性校验。如果未来新增或调整了 `BlockId` 的映射关系，老存档可能会直接引发运行时渲染异常或闪退。

### 3. 方块数量与渲染性能瓶颈 (Block Count & Performance Draw Call Risks)
- **现状**: 目前每个方块都是一个独立的 `THREE.Mesh` 实例，这意味着成千上万个方块将引发极高数量的 WebGL Draw Call。
- **QA 性能瓶颈分析**:
  - **Draw Call 爆炸**: 在 `TERRAIN_MAX_RADIUS = 6` 状态下，可视范围内方块渲染调用轻松上万。如果方块带有白边轮廓线 (EdgesGeometry)，渲染调用翻倍。这在移动端低端处理器上会导致严重的帧率暴跌 (FPS Jitter)。
  - **合批渲染迫在眉睫**: 必须引入区块级别的网格合并 (Mesh Merging) 或按 `BlockId` 使用 `THREE.InstancedMesh` 进行实例化渲染。这样可以将 Draw Call 次数从上万次压缩到 100 次以内，从根本上解决大场景卡顿风险。

### 4. 移动端布局可读性优化 (Mobile Readability & HUD Readability)
- **已修复 (CSS-only Fixes)**:
  - 提高了物品栏格子中方块数量计数器 `.count` 的字号，将桌面端从 `9px` 提升至 `11px`，移动端从 `8px` 提升至 `10px`，并微调了边距，解决了手机屏幕上数字难以辨认的问题。
  - 优化了移动端横屏/竖屏下的生存诊断标题 `.survival-title` 字号，将最小字号由 `8px` 修正为 `10px`，确保在视网膜（Retina/High-DPI）屏幕下的基础清晰度。
- **QA 长期体验准则**:
  - 应避免在 CSS 中硬编码低于 `10px` 的文字大小。
  - 维持所有 HUD 面板的安全区域控制 (`env(safe-area-inset-*)`)，严禁向界面直接塞入未经自适应排版的原生 HUD 面板。

## QA Feedback & Performance / Mobile Usability Risks (v1.8) [三弟 QA]

### 1. 移动端布局与安全区域 (Mobile Layout & Safe Area)
- **已修复 (CSS-only Fix)**:
  - 修复了移动端媒体查询中生存状态值 `.metric-value` 字号硬编码为 `9px` 的遗留问题，将其升级为 `10px`，完全符合 v1.7 提出的“禁止在 CSS 中硬编码低于 10px 字体大小”的长期体验准则。
- **布局重叠风险与建议**:
  - **超窄横屏重叠**: 在极窄的手机横屏设备（宽度 < 640px）上，`.title` (VOXEL SANDBOX) 与横向排布的生存面板 `.survival-badge` 在顶部仍有轻微挤压风险。建议在未来引入响应式隐藏 `.title` 副标题，或使生存诊断面板在窄屏下支持点击折叠。
  - **UI 穿透遮挡保护**: 所有的侧边栏及按钮均已配置 `env(safe-area-inset-*)` 以适配刘海屏，安全性表现良好。

### 2. 物品栏可读性与交互 (Hotbar Readability & Interactivity)
- **热点栏滑动反馈**:
  - **现状**: 移动端下热键栏隐藏了系统滚动条，滑动体验流畅。
  - **潜在体验问题**: 由于完全隐藏了滚动条，且没有边缘淡出遮罩（Fade Mask），在无越界指示器的情况下，玩家第一眼难以直观察觉右侧还有未显示的第 8-18 格物品格。
  - **建议**: 在 `.hotbar` 左右边缘使用 CSS `mask-image` 实现渐变透明效果，提示玩家可以通过左右滑动露出更多物品格。

### 3. 触控操作手感与手势设计 (Touch Controls & Gestures)
- **双轨输入互斥校验**:
  - **机制**: 游戏采用“屏幕右侧滑动/长按”与“专用虚拟按键（Jump, Break, Place）”双轨控制。利用 `isUiTouch` 函数对 `.hud` 内部 `pointer-events: auto` 元素进行过滤，防止点击虚拟按键时意外触发相机视角的激烈晃动或地表方块的误触放置，互斥逻辑设计非常严密。
- **手势体验细节**:
  - 右屏长按 650ms 触发挖掘并弹出动态挖掘环，配合 120ms 的防抖延时，能完美过滤快速划屏调整视角的操作，手势误触概率极低。

### 4. 性能风险与优化点 (Performance Risks)
- **未合并网格的 Draw Call 瓶颈**:
  - **现状**: 每一个方块仍是独立的 `THREE.Mesh` 实例，并未合并网格，也没有使用 `InstancedMesh` 进行合批。在可视范围 `TERRAIN_MAX_RADIUS = 6` 状态下，数千个方块加重了 CPU-GPU 的通信负担。
- **装饰性白边渲染开销**:
  - **现状**: outline 方块（如 `wood`、`leaves`、`crystal`）通过新建 `THREE.LineSegments` 实现白边。在方块数量繁多时，每一个 outlined 方块都会产生额外的 Draw Call，进一步恶化移动端流畅度。
  - **建议**: 在移动端模式下可静默关闭 outlines 边框线渲染，或使用后处理描边（Outline Pass）以节省渲染管线开销。
- **水体动画 CPU 轮询**:
  - **现状**: `animate()` 每帧通过 JS 循环修改 `waterBlocks` 数组中的水体 Y 轴位移和缩放。
  - **建议**: 应当将波动动画移入自定义 `ShaderMaterial` 顶点着色器中，由 GPU 统一渲染，释放宝贵的移动端 CPU 线程资源。

## QA Feedback & Release Polish (v1.9) [三弟 QA]

### 1. 存档兼容性与移动端保存/加载缺陷 (Save/Load & Mobile UX)
- **已修复 (CSS-only Fix)**:
  - 修复了在平板/iPad等中大型触控设备上（`pointer: coarse` 触发且高度 > 520px），保存工具栏 `.save-tools` 与左下角虚拟摇杆 `.joystick` 重叠冲突的问题。我们通过 CSS 媒体查询将触控设备下的工具栏位置重定位至 `top: 80px; bottom: auto;`，使其与左上角的标题和诊断面板完美垂直堆叠。
- **存档可用性缺陷**:
  - **现状**: 在移动端横屏模式下（`height <= 520px`），存档工具栏 `.save-tools` 被设置为 `display: none`。由于竖屏模式被“请横屏游玩”的遮罩完全拦截，手机玩家目前在任何模式下均**无法进行存档、读档、导出或导入**操作。
  - **建议**: 在后续版本中，应将 `.save-tools` 的部分高频按键（如快速保存/快速读取）合理放置于移动端横屏 HUD 的剩余空间（例如放置于屏幕顶部中央或隐藏于右上角设置菜单内），而不应直接将其从移动端页面中隐藏。

### 2. 物品栏计数反向与逻辑一致性 (Inventory Count Inconsistency)
- **计数逻辑反向与地形生成绑定缺陷**:
  - **现状**: 目前 `inventoryCounts` 强行绑定在底层 `addBlock()` 和 `removeBlock()` 的核心逻辑上：
    1. 游戏初始化生成自然地形时会大量调用 `addBlock()`，导致初始物品栏直接塞满数千个各类地表方块。
    2. 玩家放置方块时会调用 `addBlock()`，这会导致玩家热键栏中的物品计数**增加**而非消耗减少。
    3. 玩家挖除/破坏方块时会调用 `removeBlock()`，这会导致玩家热键栏中的物品计数**减少**而非采集增加。
  - **建议**: 应当将“玩家背包物品数量”与“场景内 Mesh 数量”的核心数据流彻底解耦。物品计数应独立于地形初始化，仅在玩家执行动作时（例如 `placeTargetBlock` 时扣减 1，`breakTargetBlock` 时增加 1）进行计算，从而符合正常的沙盒建造体验。

### 3. 移动端触控防误触与体验 (Mobile Controls & Usability)
- **手势缩放干扰**:
  - **现状**: 在移动端横屏手游中，双指缩放操作（Pinch to Zoom）未在 Canvas 上进行阻止，这可能导致部分手机浏览器发生整页误触缩放或三维视角瞬间瞬移抖动。
  - **建议**: 在 `pointerdown` / `touchstart` 事件中，对多指操作进行更严格的 `preventDefault()` 拦截，防止引起浏览器的弹性缩放响应。

### 4. 视觉表现与性能显示组件重构 (Visual Regressions & Perf Badge Layout)
- **已修复 (CSS-only Fix)**:
  - 修复了桌面端下性能监测面板 `.perf-badge` 布局塌陷、折行重叠的视觉缺陷。原样式未给 `.perf-badge` 设定 `display: flex;`，导致其中的各个指标展示呈现默认 block 的纵向拉伸块，与其 `border-radius: 999px` 的胶囊型圆角外观产生极其违和的视觉冲突。我们添加了 `display: flex; align-items: center; gap: 8px;`，并将 `.perf-divider` 设定为 1px 的精致垂直线分割，使其在桌面与移动端均呈现出极高质感的水平走马灯式胶囊 HUD。

## Stable Milestone (v2.0)

- 标记 AstraVoxel Ark v2.0 Stable Ark：同步更新包版本、浏览器标题、HUD 徽标与启动面板文案。
- 确认移动端横屏 `.save-tools` 仍提供 Save/Load/Export/Import/Reset。
- 加固移动端画布指针事件默认行为拦截，降低浏览器触摸缩放/滚动干扰存档与建造操作的风险。
- **v2.0 Final QA Release Check (三弟 QA)**:
  - **已验证 Build**: 成功运行 `npm run build`，所有 TypeScript 及 Vite 构建检查通过。
  - **已修复移动端 Layout 冲突**: 修复了移动端横屏模式下 `.save-tools` 与底部 `.hotbar` / `.touch-actions` 重叠的问题。 将其移至左上角标题下方 (`top: 60px; left: calc(12px + env(safe-area-inset-left)); scale: 0.84`)，确保存档、载入、导入、导出、重置等功能在所有手机分辨率及横屏比例下完全可见且无重叠冲突。
  - **已同步浏览器标题**: 修改 `index.html` 标题为 `AstraVoxel Ark v2.0` 以确保对外发布版本号一致。

## QA Feedback & Reality Pass (v2.1) [三弟 QA]

### 1. 物品栏与生态真实感流向 (Inventory Reality Direction)
- **挖掘增加与放置消耗**:
  - **现状分析**: 玩家通过挖掘破坏方块时，由于内部计数绑定在 `removeBlock` 底层，物品计数却减少了；在放置方块时触发 `addBlock` 底层，物品计数反而增加了。这与真实的物理/生存逻辑完全相反。
  - **整改规划**: 背包计数应独立于场景 Mesh 的增删。玩家挖掘方块（`breakTargetBlock`）应增加对应物品数量，放置方块（`placeTargetBlock`）应减少对应物品数量。
- **自然地形生成隔离**:
  - **现状分析**: 游戏初始化或动态区块加载时，大量调用 `addBlock` 生成自然世界（如泥土、石头、树木等），导致这部分自然生成的方块全部无端塞入了玩家背包，使初始物品计数暴增至数千个。
  - **整改规划**: 区分 `BlockSource`。只有 `BlockSource === 'player'`（或者明确的玩家挖掘采集行为）才对背包进行计数增减，`source === 'terrain'` 时静默生成，不干扰玩家初始背包。
- **存档、读档与重置的一致性**:
  - **现状分析**: 由于 `applySavedWorld` 在重建世界时循环调用了 `addBlock`（带有 `'save'` 标识），且 `clearWorldBlocks` 只是清空了 `inventoryCounts`。这就导致每次读取存档时，背包计数会被再次根据保存的所有方块重新塞满。
  - **整改规划**: 重置、存档、读档时应完全保持背包 counts 独立保存和恢复。背包物品计数必须与场景中所有静态生成的方块总数脱钩，不应因重载场景而发生背包暴涨。

### 2. 移动端热键栏可读性优化 (Mobile Hotbar Readability Pass)
- **已修复 (CSS-only Fix)**:
  - 针对在极窄或常规移动端横屏状态下，热键栏 `.hotbar` 完全隐藏滚动条导致玩家第一眼无法感知“右侧仍可滑动显示第 8 格及后续方块”的问题，在 `.hotbar` 两侧引入了渐变消隐遮罩（Gradient Fade Mask），通过 CSS 视觉提示指示滑动区域。
  - 针对热键栏格子中的物品数量 `.count` 在移动端高亮 swatch 背景下容易模糊、无法识别的问题，为 `.count` 增加了黑色的微细文字投影（text-shadow），在不占用额外 HUD 面板的前提下，实现强对比度及像素级清晰可读性。

## QA Feedback & Exploration Goals (v2.2) [三弟 QA]

### 1. 轻量级探索目标与无 HUD 面板原则 (Lightweight Exploration & Zero-HUD Policy)
- **拒绝大型 HUD 面板**:
  - **建议**: 为维护 AstraVoxel Ark 卓越的沉浸式极简美学，绝对不可引入复杂的任务日志、大地图、成就列表等“大面板 (Big HUD Panels)”。一切探索相关的引导和进度提示应保持极致轻量。
  - **交互**: 优先利用短小的 Toast 提示、声音反馈或现有的 Survival Diagnostics（如 Crystal Power 进度和 Day/Night 时间相位的动态变化）来隐式传达探索目标，严防 UI 视觉噪点堆积。

### 2. 地标与晶体绑定奖励机制 (Landmark & Crystal-Tied Rewards)
- **结合已有地标生成**:
  - **设计**: 利用 `addExplorationMarks` 自然生成的各类废墟遗迹（如 brick 废石室、obsidian 祭坛）和发光的晶体丛林。
  - **奖励反馈**: 当玩家接近这些特定地标时，可以通过 Crystal Power 获得临时环境抗性或供能增强。挖掘并拾取稀有地标中的 `crystal`、`glow` 或贵金属方块时，除了获得对应方块物品外，可以触发短暂的威胁度（Threat Level）下降或护盾值/电量爆发性回复。
  - **优势**: 直接将玩法激励融入现有的 3D 世界元素中，无需增加任何系统负担，开发极其轻量且生态自洽。

### 3. 物品栏真实感与存档/载入兼容性防护 (Inventory Reality & Save/Load Stability)
- **背包真实逻辑守卫**:
  - **要求**: 探索奖励所带来的资源获取必须与 v2.1 奠定的“挖掘增加、放置消耗”的背包数据流完全融合。玩家挖掘遗迹、搜集晶体时，所得产物应直接以 counts 形式入背包，并在放置时扣减。
  - **存档/读档数据完整性**: 必须保障背包的 counts 在 `serializeWorld` 和 `applySavedWorld` 时完美地与地图的 3D mesh 脱钩，独立存取，不受探索逻辑的修改而引发 counts 暴涨或存档损坏，确保存档大小依然极其紧凑（LocalStorage 5MB 内）。

### 4. 移动端布局与触控安全区域 (Mobile Layout & Safe Area Protection)
- **防重叠保护**:
  - **要求**: 存档/读档工具栏 `.save-tools` 在移动端横屏和常规触控下的位置（左上角 `top: 60px`）和自适应比例必须保持完好，不得因新增的轻量探索通知或视觉提示发生水平挤压与重叠冲突。
  - **微小动画优化**: 在 v2.2 版本中，我们已通过 CSS-only fix 为 `.save-tools` 的所有操作按钮（Save/Load/Reset 等）补充了平滑的 transition 缓动以及 `:active` 缩放微动效。这有效提升了在移动触屏及桌面下的物理按压反馈，解决了小屏下点击操作无触觉响应的遗留问题。

## Polish Stop (v2.3)

- 标记 AstraVoxel Ark v2.3 Polish Stop：同步包版本、浏览器标题、HUD 徽标与启动面板文案。
- 收紧帮助文案，把探索目标压缩为 “find 6 landmark shards”，避免 Controls/Tips 过长造成桌面和移动端拥挤。
- 不新增玩法系统、不新增 HUD 面板；v2.3 作为 v2.1 背包真实感与 v2.2 探索目标之后的稳定停工点。
- 验收要求：`git diff --check`、`npm run build`、浏览器进入游戏、save/load smoke、console 零错误、后台进程为空。

## QA Feedback & Optimization (v0.2) [三弟 QA]

- **移动端与触控交互优化 (Mobile & Touch Interactivity Polish)**:
  - 已通过 CSS `@media (hover: hover)` 包裹 `.help-toggle-btn:hover`、`.save-tools button:hover` 以及 `.panel button:hover` 的悬停样式，成功消除移动端触屏设备上按钮被点击后遗留/卡死的“粘性悬停 (sticky hover)”状态，极大提升触控物理反馈体验。
  - 维持现有移动端自适应布局。移动端横屏模式下，左上角标题与 `.save-tools` 的自适应排版以及生存诊断 `.survival-badge` 面板适配度已通过安全区域 (`env(safe-area-inset-*)`) 的细致核对，无布局塌陷或水平挤压重叠风险。
- **页面资源与仓库整洁度 (Repository & Asset Hygiene)**:
  - 修改 `index.html` 浏览器标题为 `AstraVoxel Ark v0.2`，保证版本与 `main.ts` 中的 `${GAME_VERSION_LABEL}` 一致，提高页面发布的专业度。
  - 核查并确认 `.gitignore` 规则，排除 Android Gradle 生成的临时文件、构建文件和 `.npmkeep` 等，保持 Git 干净整洁，仅追踪有效源码。
- **运行及构建验证 (Build Verification)**:
  - 成功运行 `npm run build` 打包。所有 TypeScript 类型检查通过，Vite 生成的产物无报错及警告。
