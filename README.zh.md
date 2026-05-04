# Full Suite (EN 版)

[English](./README.en.md) · 中文

[Owlbear Rodeo](https://owlbear.rodeo) 第三方扩展。一个 manifest 集成 10 个模块。

> **EN 版定位**：这个 build 默认 **不内置任何数据库**、**不预装任何中文模板**。是为 OBR 官方商店投递的中性版本，DM 自行配置 SRD / 家酿 JSON 数据源。中文社区版（含 kiwee 镜像 + 悲灵角色卡模板）请见上游仓库。

## 安装

OBR 房间内点击右上角 ⊕ "Add Extension"，粘贴：

```
https://obr.dnd.center/full-suite-en/manifest.json
```

UI 默认英文。Settings / 公告 顶部的 CN | EN 切换可独立设置每个客户端的语言。

## 模块清单

| 模块 | 说明 |
|---|---|
| Dice 骰子 | 表达式投骰、多目标、历史、回放、音效，`{@dice}` `{@damage}` `{@hit}` 等内联 tag 均可点击直投。 |
| Initiative 先攻 | 顶部横向先攻条，开战、回合切换镜头、Owner 玩家可自助投骰 / 结束回合。 |
| Bestiary 怪物图鉴 | 拖拽怪物到地图 → 自动生成带 HP/AC 的 token，可选自动加入先攻。右键绑定 / 更换 / 移除。**需要先在设置 → Libraries 配置库**。 |
| Character Cards 角色卡 | 点骰即投，HP / AC / 临时 / 生命骰 就地编辑（从 JSON 加载，卡片内 `Import JSON` 按钮替换）。内置一张只读示例卡。 |
| Global Search 全局搜索 | 顶部右侧浮窗搜索框，覆盖已配置的库，悬停预览、点击钉住。 |
| Time Stop 时停 | DM 一键禁用玩家画布操作 + 电影黑边 + 全场静音。 |
| Sync Viewport 同步视口 | 把所有玩家镜头移到指定坐标或选中 token。 |
| Portals 传送门 | 圆形传送区域，同标签互联，绕过 Dynamic Fog 的光源拦截。 |
| HP / AC Bubbles 血量气泡 | token 头顶紧凑信息条 (HP 条 + AC 盾)，战斗外可剪影显示隐藏血量。可替换第三方 Stat Bubbles。 |
| Status Tracker 状态追踪 | buff 调色板拖到 token 上施加；拖到别人 = 转移，拖到空白 = 删除。包含轻量级 HP 小面板组件（无怪物 / 角色卡绑定的 token 自动可用）。 |

## 与中文社区版的差异

| | EN 版 | 中文版 |
|---|---|---|
| 默认 UI 语言 | **英文** | 中文 |
| 默认公告语言 | **英文** | 中文 |
| 内置库 | **无** (用户自行添加) | kiwee 主版 + 合作版 默认装好 |
| 角色卡数据源 | **仅 JSON** (拖入或 `Import JSON`) | JSON + xlsx 双通道 |
| 默认关闭模块 | Vision / Fog（设计中），Metadata Inspector（DM 调试工具） | 同 |
| 默认开启模块 | Status Tracker、HP / AC Bubbles 等其他全部 | 同 |
| 手机端 | Status Tracker、Metadata Inspector、Character Card 全屏面板、Global Search 自动禁用并提示 | 同 |
| Stable / Dev 通道 | 单条生产通道 (`/full-suite-en/`) | 稳定 + 测试双通道 |
| 场景元数据命名空间 | `com.full-suite-en/*` | `com.obr-suite/*` （不兼容 — 同房间不要同时装两个） |

## 配置库

Bestiary + Global Search 在没有库的情况下处于"待配置"状态。Settings → Libraries → "+ Add library" → 填写 base URL。

库需要在 base URL 下提供：

```
search/index.json
data/<file>.json
data/bestiary/<file>.json
data/class/index.json + data/class/class-<slug>.json
data/items-base.json   （武器属性 tooltip 需要）
```

JSON schema 跟标准 5e SRD 一致。本扩展是**纯渲染器，不打包任何规则内容**。

单库情况下，`indexPath` 字段允许指向 `search/index.json` 之外的自定义索引文件（适合一个 host 同时维护多个精选列表）。

## 骰子表达式语法

```
基础         2d6 + 1d20 + 5
优势         adv(1d20)              投两次取较高
劣势         dis(1d20)              投两次取较低
精灵之准     adv(1d20, 2)           投三次取最高
保底         max(1d20, 10)          值不低于 10
封顶         min(1d20, 15)          值不高于 15
触发重投     reset(1d20, 1)         投到 1 时重投一次
爆发         burst(2d6)             投到最大值时追加一颗，链式最多 5 次
同值高亮     same(2d20)
重复         repeat(3, 1d20+5)      投 3 行，每行独立总和
独立段       adv(1d6) + adv(1d4)    两个独立优势骰
嵌套         adv(max(1d20, 10) + 5)
```

中文标点 `（）` 和 `，` 自动识别。

## 怪物图鉴绑定

每个 token 在元数据下存储一个 `com.bestiary/slug` 引用键。怪物完整数据存放在场景元数据 `com.bestiary/monsters` 表中（同种怪物共享一份）。

- 无绑定 token → 右键菜单出现"Bind Monster"
- 已绑定 token → 右键菜单出现"Replace Monster" / "Unbind"
- 绑定与更换会重写 token 的 bubbles HP/AC、name、dexMod 来匹配新怪物。

## 传送门

DM 在左侧工具栏选 "Portal"，按下并拖拽：起点为圆心，距离为半径。释放时弹出命名面板。玩家拖 token 进入传送门 → 弹出目的地选择 → 同标签传送门列表 → 选定后所有选中单位以六边形螺旋集结到目的地。

OBR 官方 Dynamic Fog 会阻止有光源的 token 进入迷雾。本扩展在传送瞬间临时摘除 token 的光源 metadata（含 `attenuationRadius` / `sourceRadius` 字段的键），完成位置更新后立刻按 snapshot 1:1 还原。

## 项目结构

```
obr-suite-en/
├── public/manifest.json
├── src/
│   ├── background.ts
│   ├── cluster.ts
│   ├── settings.ts
│   ├── state.ts
│   └── modules/
│       ├── dice/
│       ├── initiative/
│       ├── bestiary/
│       ├── characterCards/
│       ├── search/
│       ├── portals/
│       ├── bubbles/
│       ├── statusTracker/
│       ├── hpBar/
│       ├── metadata-inspector/
│       ├── timeStop.ts
│       └── focus.ts
└── *.html (iframe 入口)
```

技术栈：TypeScript + Vite + Preact（先攻面板 + 角色卡全屏）+ `@owlbear-rodeo/sdk` v3.x。

跨客户端状态：场景元数据 (`com.full-suite-en/state`)，DM 写、玩家读。

每客户端偏好：localStorage（cluster 展开状态、自动浮窗开关、骰子音效、骰子历史、气泡大小等）。

## 许可证

[GNU 通用公共许可证 v3.0 (GPL-3.0)](./LICENSE) — 强 copyleft。

| | |
|---|---|
| ✓ | 自由查看、修改、再分发，包括商业分发 |
| ✓ | 任何分发都必须附带源码 |
| ✓ | 衍生作品必须保持 GPL-3.0 许可证 |
| ✓ | 原始版权声明 (`Copyright (c) 2026 FullPeople`) 保留 |

## 鸣谢

- 骰子图标：[flaticon](https://www.flaticon.com/) by [Freepik](https://www.flaticon.com/authors/freepik)
- 骰子音效：Sound Effect by [freesound_community](https://pixabay.com/users/freesound_community-46691455/) 与 ksjsbwuil（来自 [Pixabay](https://pixabay.com/)）
- D&D 5e 内容版权属于 Wizards of the Coast；本扩展仅作查阅与跑团辅助使用，**不内置任何规则文本**。
- `bubbles` 模块衍生自 Seamus Finlayson 的 [Stat Bubbles for D&D](https://github.com/SeamusFinlayson/Bubbles-for-Owlbear-Rodeo)（同样基于 GPL-3.0）。

## 支持

[![Ko-fi](https://img.shields.io/badge/Ko--fi-FullPeople-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/fullpeople)

## 联系方式

- Email：[1763086701@qq.com](mailto:1763086701@qq.com)
- GitHub：[@FullPeople](https://github.com/FullPeople)
