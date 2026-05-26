# GitHub 发布计划

## 仓库建议
- 仓库名：`astra-voxel-ark`
- 描述：A polished browser-based voxel sandbox game inspired by block-building exploration
- License：MIT
- 默认分支：main

## README 结构
```md
# AstraVoxel Ark

A polished browser-based voxel sandbox game built with TypeScript and Three.js

## Play Online
GitHub Pages link here

## Features
- Procedural voxel terrain
- First-person exploration
- Block breaking and placing
- Hotbar block selection
- Day-night cycle
- Polished water, glow blocks, and fog

## Controls
WASD move
Mouse look
Left click break
Right click place
1-8 select block
Space jump

## Development
npm install
npm run dev
npm run build
```

## GitHub Pages 部署
后续可以加 `.github/workflows/deploy.yml`，push 到 main 后自动部署

## 首次发布 checklist
- [ ] 本地能 `npm run dev`
- [ ] 能 `npm run build`
- [ ] README 有截图
- [ ] GitHub Pages 可访问
- [ ] 操作说明清楚
- [ ] 没有明显性能问题
