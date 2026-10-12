# 坦克大战 · Tank Battle

一个用原生 HTML + CSS + JavaScript 写的经典坦克大战。零依赖、零构建，双击 `index.html` 就能玩。

![HTML](https://img.shields.io/badge/HTML5-Canvas-e34f26?logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-无框架-1572b6?logo=css3&logoColor=white)
![JS](https://img.shields.io/badge/JavaScript-原生-f7df1e?logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green)

## 🎮 在线试玩

**https://dasuixiangjixing.github.io/tank-battle/**

点开即玩，无需下载。

## 玩法

守住屏幕下方的基地（金色五角星），消灭全部敌方坦克即可通关。基地被摧毁，或者三条命全部用光，游戏结束。

敌人会朝你和基地推进，撞上砖墙就开火轰开一条路。它们分为三种：

| 类型 | 特征 | 分值 |
| --- | --- | --- |
| 银色 · 普通 | 速度、火力均衡 | 100 |
| 青色 · 快速 | 移动速度接近玩家的两倍 | 200 |
| 橙色 · 重甲 | 需要命中三次才会被摧毁 | 400 |

击毁敌人有约 20% 概率掉落道具，吃下后立刻生效：

| 道具 | 效果 |
| --- | --- |
| ⭐ 火力 | 提升射速与弹速，二级后一次可发射两发，并可击穿钢墙、炸开更宽的缺口 |
| 🛡️ 护盾 | 10 秒无敌 |
| ❤️ 生命 | 生命 +1 |
| 💣 核弹 | 立刻清空场上所有敌人 |

## 操作

| 按键 | 功能 |
| --- | --- |
| `W` `A` `S` `D` / `↑` `←` `↓` `→` | 移动 |
| `空格` / `J` | 开火 |
| `P` | 暂停 / 继续 |
| `M` | 静音 / 取消静音 |
| `R` | 重新开始 |

## 特性

- **瓦片地图**：砖墙可破坏、钢墙只能被强化弹击穿，15 × 15 的场地全是手写关卡。
- **固定时间步长**：逻辑锁定在 60Hz，144Hz 和 60Hz 屏幕上的手感与速度完全一致。
- **自动对齐**：移动时坦克会平滑吸附到通道中线，钻窄缝不会卡住。
- **防穿透**：子弹按 ≤4px 分段推进，再快的弹速也不会穿过薄墙。
- **基地保护**：己方子弹打不掉自己的基地，只会溅出火花 —— 避免一路向右开火把自己家拆了。
- **反馈**：屏幕震动、粒子火花、爆炸渐变、WebAudio 合成音效，全部由代码生成，没有任何素材文件。

## 本地运行

没有依赖，也没有构建步骤。三种方式任选：

```bash
# 1. 直接打开
start index.html          # Windows
open  index.html          # macOS

# 2. 起一个本地服务器（推荐，行为和线上一致）
python -m http.server 8000
# 然后访问 http://localhost:8000
```

## 项目结构

```
.
├── index.html    # 页面结构：HUD、画布、开始/结束遮罩、图例
├── style.css     # 全部样式，深色主题，窄屏自适应
├── game.js       # 游戏本体：地图、坦克、子弹、AI、渲染、音效
└── README.md
```

## 代码导览

`game.js` 按职责自上而下排列：

| 区域 | 说明 |
| --- | --- |
| 常量 / 配色 | 瓦片尺寸、方向向量、调色板 |
| `LEVELS` | 四个关卡的字符画地图，`.` 空地、`B` 砖墙、`S` 钢墙 |
| `Sfx` | WebAudio 振荡器与噪声合成的音效 |
| 地图与碰撞 | `buildGrid` `rectBlocked` `canStand` `alignAxis` |
| `Tank` / `Bullet` | 实体定义 |
| 更新逻辑 | `updatePlayer` `updateEnemy` `resolveBullet` `updateSpawner` |
| 流程控制 | `loadLevel` `levelClear` `gameOver` `startGame` |
| 渲染 | `drawBrickTile` `drawSteelTile` `drawBase` `drawTank` `drawEffect` |

想加一关，只要往 `LEVELS` 里再塞一个 15 × 15 的字符串数组即可 —— 出生点固定在 `row 0` 的 `col 0 / 7 / 14`，基地固定在 `col 7-8 / row 13-14`，这三处留空就行。

## 许可

MIT
