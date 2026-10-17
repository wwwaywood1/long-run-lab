# G1：共享组件与骰宝

轮盘实验台的控件、盈亏展示和曲线原本全部内嵌，后续游戏需要重复实现；骰宝也尚无正式页面。本次先提取共享组件并重构轮盘，再依照 `preview/SicBo.dc.html` 上线中英文骰宝页。此前 G2 的百家乐实现保留。

本文件可直接作为 PR 描述。项目来自 ZIP，没有远程仓库地址，本次未创建远程 PR。任务开头明确要求 G1/骰宝，后续模板中的 Baccarat 占位路径按 SicBo/sicbo 对应处理。

## 共享组件与轮盘重构

在 `src/components/shared/` 新增六个展示组件：

| 组件 | 作用与接入位置 |
| --- | --- |
| `SegmentedControl` | 分段按钮；轮盘与骰宝的桌数、注额等控件 |
| `PnlHeader` | 金额格式、盈亏色、累计信息和 live region；两个实验台共用 |
| `PnlChart` | 实线/虚线的 SVG 图形；两个实验台共用，保留各自图高 |
| `LossConversion` | 调用现有实物引擎；两个实验台的内联提示，以及轮盘原有深色实物面板 |
| `DarkReveal` | 两个游戏的中英文 Astro 揭晓段，无需 hydration |
| `HundredGrid` | 10 列方阵，支持自定义格子，可承载 100 人/结果/桌子；目前接入轮盘和骰宝百桌模式 |

API 与逻辑边界见 [`src/components/shared/README.md`](../src/components/shared/README.md)。共享组件不处理概率或赔率结算。轮盘转动、默认十桌、文案和展示节奏保留；抽出的旧 CSS 从 `RouletteLab.css` 删除，避免两处维护。

计时器同时修正：轮盘在两局之间停止自动时会取消下一局回调；重来立即清除自动标记与计时器；已排队的下一局读取最新桌数/注额。换桌后显示待开始状态，避免把上一模式的结果误标到新桌面。发牌/转动期间更改桌数和注额的按钮明确禁用。

## 骰宝页面

- 新增 `src/components/SicBo.tsx`、`SicBo.css` 与 `src/pages/zh|en/casino/sicbo.astro`，赌场大厅加入入口。
- 保留设计稿默认单桌、900ms 摇骰、75ms 画面更新、650ms 自动间隔，支持 1/10/100 桌、每注 10/100/1000、押大/押小/任意豹子、自动、暂停、快进 100 局和重来。
- 单桌三颗骰子、十桌结果卡片、百桌结果方阵、实物换算、累计曲线、每分钟/通宵期望亏损及 216 格揭晓图均已接通。
- 骰子点阵和旋转角度属于展示；结果、点数、大小/豹子分类、结算与期望调用骰宝引擎。百桌在颜色之外提供 `+ / −` 和可访问文字；亏损用 `var(--loss)`。

## 引擎与 numbers.json 改动（完整清单）

| 文件 | 新增接口；原有规则与常量均未改 |
| --- | --- |
| `src/engine/session.ts` | `HistoryPoint`、`RoundTotals`、`Session`、`newSession`、`appendRound`、`lossAmount`：纯累计统计与曲线历史管理，供轮盘和骰宝调用 |
| `src/engine/roulette.ts` | `RouletteRound`、`settleRed`、`redLossRates`：把原来组件中的押红净收益、期望累计及时间换算移入引擎 |
| `src/engine/sicbo.ts` | `diceKind`、`SicBoGame`、`SicBoRound`、`settleDice`、`rollRound`、`sicboLossRates`、`allOutcomes`；以及从设计稿提取的每小时 60 局、通宵 8 小时、快进 100 局常量 |

`data/numbers.json` **未改**；研究脚本未改。骰宝静态数字直接读取 `sicbo.counts`、`edge_big_small`、`edge_any_triple_30to1`、`edge_total4_60to1`、`edge_specific_triple_180to1`；百分比、条形宽度与计数文案按这些数值格式化。动态统计来自引擎。

`numbers.json` SHA-256 仍为：
`f3b688cd29a3e5b85ffe6262aa1cd8712ae5d5fd37e9d40bf4e21f3e0074081b`

原有概率、赔付、设计稿、翻译源文件、`package.json` 和锁文件未改；没有增加项目依赖。变更记录见 [`g1-change-manifest.json`](运行 tools/check_*.mjs 生成)。

## 验收与证据

- [x] 组件里没有概率、赔付或规则计算（都在 engine）
- [x] 页面上的统计数字都能在 numbers.json 或引擎常量里找到
- [x] zh 与 en 两个路由都在，语言切换互通
- [x] 1 / 10 / 100 三种模式、自动、快进、重来都能用，自动模式能停
- [x] 无障碍：真按钮、aria-pressed、aria-live、触控目标 ≥ 44px
- [x] 390px 与 640px 宽度下截图附在 PR 里
- [x] `npm test` 与 `npm run build` 通过

`npm test`：4 个测试文件、35 项测试通过。新增 7 项测试穷举骰宝全部 216 种结果、核对三种下注的期望与数据源、覆盖全部豹子与大小边界，并检验轮盘提取后的结算、累计计数、历史截断及时间换算。既有百家乐测试继续通过。

`npm run build`：成功生成包含骰宝两种语言的 10 个静态页面。

浏览器检查覆盖轮盘/骰宝 × 中/英文 × 390/640px；验证全部桌数和注额、骰宝三种押注、动画、快进、暂停发生在局中/间隔两种情况、重来清理回调、自动读取最新设置、语言切换、亏损色、触控尺寸、无横向溢出及无运行错误。见 [`g1-browser-results.json`](运行 tools/check_*.mjs 生成)。

轮盘还与 G1 修改前的正式构建逐一比较：中英文 × 390/640px × 初始/固定种子快进，共 8 对截图，尺寸与全部像素相同，画面文字及实验台布局尺寸也一致。见 [`g1-roulette-regression.json`](运行 tools/check_*.mjs 生成)、[`g1-roulette-pixel-diff.json`](运行 tools/check_*.mjs 生成)。这验证的是所列状态，不代表全部可能状态的截图等价。

复现：

```sh
npm ci
npm test
npm run build
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run preview -- --host 127.0.0.1
# 另一终端
node tools/check_g1.mjs http://127.0.0.1:4321
```

Playwright 仅用于 QA。脚本支持 `PLAYWRIGHT_MODULE_PATH`、`BROWSER_EXECUTABLE_PATH`、`QA_FONTS_ROOT`；本次以 Chromium 和相同字体家族的本地字体包生成截图，未注入产品样式或改写游戏结果。

## 待确认事项

- `i18n/source/SicBo.json` 的英文栏全部为空。骰宝英文路由按要求使用中文兜底并标注 `TODO(en)`；金额、实物、站名与页脚使用已有全站英文约定。轮盘既有英文文案保持原样。
- 设计稿保留“总和 4 点”“指定豹子”的赔率比较，它们只用于说明，实验台可押项目仍是大/小/任意豹子，未增加新玩法。
- 设计稿对赔率仍写明“按常见规则举例，各场馆不同，上线前逐条核对”，本次原样保留；没有将示例写成所有场馆通用规则。
- 原始 `preview/support.js` 未包含在交付项目中，因此根据设计稿源文件逐段比对正式站点，未声称运行了原始 DC 预览。
- `npx tsc --noEmit` 仍因原有 `sports.ts` 元组负索引报错。轮盘原有的字面量推断错误在本次重构中已消除，新增文件没有类型错误；要求的测试/构建均通过。

## 骰宝截图

中文 390px：

![中文骰宝 390px](../../qa-output/screenshots/g1-sicbo-zh-390.png)

英文路由 390px（缺译处中文兜底）：

![英文路由骰宝 390px](../../qa-output/screenshots/g1-sicbo-en-390.png)

中文 640px：

![中文骰宝 640px](../../qa-output/screenshots/g1-sicbo-zh-640.png)

英文路由 640px：

![英文路由骰宝 640px](../../qa-output/screenshots/g1-sicbo-en-640.png)

| 390px 交互状态 | 中文 | 英文路由 |
| --- | --- | --- |
| 单桌结算 | [截图](../../qa-output/screenshots/g1-sicbo-zh-390-one.png) | [截图](../../qa-output/screenshots/g1-sicbo-en-390-one.png) |
| 十桌 | [截图](../../qa-output/screenshots/g1-sicbo-zh-390-ten.png) | [截图](../../qa-output/screenshots/g1-sicbo-en-390-ten.png) |
| 百桌 | [截图](../../qa-output/screenshots/g1-sicbo-zh-390-hundred.png) | [截图](../../qa-output/screenshots/g1-sicbo-en-390-hundred.png) |
| 重构后的轮盘 | [截图](../../qa-output/screenshots/g1-roulette-zh-390.png) | [截图](../../qa-output/screenshots/g1-roulette-en-390.png) |

轮盘 640px：[中文](../../qa-output/screenshots/g1-roulette-zh-640.png)、[英文](../../qa-output/screenshots/g1-roulette-en-640.png)。`screenshots/g1-roulette-*-before.png` 与对应 `after.png` 保留重构前后对比证据。
