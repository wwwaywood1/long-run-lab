# G4：爆点

爆点已有设计稿和抽样/自动跳车净收益函数，但缺少正式页面与实时飞行状态机。本次新增中英文路由及交互实验台，复用共享组件，并把飞行推进、手动跳车和全部结算移入引擎。老虎机原先指向爆点的下一桌链接现在可正常访问。

本文件可作为 PR 描述。项目来源是 ZIP，没有远程仓库地址，本次未创建远程 PR。

**需要审阅者注意：保留了原稿的规则边界，测试通过不代表原稿“任何手动策略均为 −3%”的论断已获验证。详见下方两项数学口径问题。**

## 页面与交互

- 新增 `src/components/Crash.tsx`、`Crash.css` 和 `src/pages/zh|en/casino/crash.astro`；赌场大厅加入入口。
- 默认单局、每注 10、自动 2× 跳车；支持 1/10/100 局、每注 10/100/1000、自动跳车点 1.5/2/5/10×、实时手动跳车、自动玩、停止、快进 100 轮与重来。
- 保留原稿 50ms 固定步长、倍增速度、单局跳车后继续显示到爆点或展示上限 20× 的节奏、多局在各局下注均结束时结算的行为。
- 单局显示飞行轨迹、自动跳车虚线与实际跳车标记；十局卡片与百局方阵同步区分飞行、跳车成功和爆掉。百格用 `… / + / −` 和可访问名称补充颜色，亏损统一使用 `var(--loss)`。
- 目标、注额及局数在飞行中禁用；仍在飞的局可手动跳车，已结束局不会再修改。没有仍在飞的下注时禁用手动按钮，避免重复操作。
- 停止自动取消下一轮但让当前轮结束；下一轮读取最新设置；重来与卸载清除飞行 interval 和下一轮 timeout。单局已跳车但轨迹还在显示期间，重来也能取消后续结算。
- 使用全部六个共享展示组件。`CrashZeroGrid` 是静态方阵 JSX 适配器，无需 hydration。
- `Base.astro` 增加可选 `footerHref` / `footerLabel`，爆点页按设计稿链接“研究层”。其他页面未传这些参数，沿用原有赌场大厅页脚。

## 引擎改动（完整清单）

`src/engine/crash.ts` 原有 `CRASH_RTP`、`CRASH_EDGE`、`crashPoint`、`crashNet`、`cashOutProbability` 保持原样，仅新增：

| 接口 | 作用 |
| --- | --- |
| `FlightGame`、`Flight`、`newFlight`、`startFlight` | 独立爆点、下注快照和可序列化飞行状态 |
| `advanceFlight`、`jumpFlight` | 按原稿固定步长推进、自动跳车与手动跳车；手动使用上次显示倍数向下取到两位小数 |
| `flightSummary`、`CrashRound`、`settleFlight` | 活跃/跳车/爆掉数量、净收益和单轮期望参考；拒绝结算未完成轮次 |
| `fastFlight` | 生成与自动目标结算一致的快进结果，保留原稿单局展示上限 |
| `CrashSession`、`newCrashSession`、`appendCrashRound` | 调用共享累计器，并累计跳车成功率 |
| `crashTargetTerms`、`crashLossRates` | 控件说明的概率/净收益及每分钟/通宵期望参考 |
| `multiplierAt`、`timeAtMultiplier` | 飞行倍率与显示时间换算；组件只把返回值映射为 SVG 坐标 |
| `CRASH_RATE`、`CRASH_TICK_MS`、`CRASH_DISPLAY_CAP`、`CRASH_PAUSE_MS`、`CRASH_ROUNDS_PER_HOUR`、`CRASH_NIGHT_HOURS`、`CRASH_FAST_ROUNDS`、`CRASH_TARGETS` | 从原稿提取的规则/时间设定 |

组件不生成爆点、不判断自动/手动跳车收益、不计算赔付或胜率。动画与快进均调用上述引擎接口。

## 数字与文案

`data/numbers.json` 和 `research/compute_numbers.py` **均未改**。静态目标概率表、97% 返还率、每押 100 的 −3 期望及 3/100 理论抽水示意来自现有 `numbers.crash`。百格高亮位置只负责视觉排布，数量从源数据格式化得到；概率表按目标数值升序排列，避免 JSON 整数键枚举顺序改变设计稿顺序。

动态目标说明与累计统计来自引擎，原有概率和赔付不变。英文 `i18n/source/Crash.json` 的 65 条 en 字段全部为空，按要求使用中文兜底并在源文件加 `TODO(en)`。金额、实物和全站页脚继续使用既有语言约定。设计稿与翻译源文件未改。

完整改动和未变文件哈希见 [`g4-change-manifest.json`](运行 tools/check_*.mjs 生成)。此前游戏组件、引擎及共享组件未修改；依赖清单和锁文件也未修改。

## 必须保留记录的数学口径问题

1. **3% 理论抽水成分不等于离散生成器 `1.00×` 的频率。** 原 `crashPoint` 先向下取到 0.01，再将低于 1 的值钳到 1，因此 `P(crashPoint = 1.00) = 1 − 0.97/1.01 ≈ 3.9604%`。原稿揭晓段的“100 轮里有 3 轮一起飞就爆”按原有 3% 抽水理论示意保留，没有把它当成当前生成器的经验频率，也没有改生成器或已有 JSON。
2. **首个计时步之前可手动在 1.00× 退回本金。** 原稿允许这种操作；保留的实现也是净收益 0，而非 −3%。原稿对“任何手动策略”统一 −3% 的文案、`ev_any_target` 注释及累计虚线因此不能理解为对这个离散交互实现的已验证精确结论。自动目标 1.5/2/5/10× 的现有理论概率和收益函数继续沿用；本次未擅自改手动规则或把理论文案换成新的论断。新增测试明确记录该反例，后续应单独决定修订规则还是收窄文案。

## 其他待确认事项

- 原稿每小时 180 局、每局约 20 秒用于统一速率比较，实际展示动画不固定 20 秒，保留原来的假设标注。
- 下一桌 `/casino/blackjack/` 与页脚 `/research/ville/` 尚未移植，本次保留同语言目标路径，没有伪造占位页面。
- ZIP 没有 `preview/support.js`，本次按设计稿源码逐段核对正式构建截图，未声称运行了原始 DC 预览。
- 额外 `npx tsc --noEmit` 仍在原有 `sports.ts` 报元组索引错误；新增文件无类型错误。任务要求的测试与构建均通过。

## 验收清单（对应 docs/PORTING.md）

- [x] 组件里没有概率、赔付或规则计算（都在 engine）
- [x] 页面上的统计数字都能在 numbers.json 或引擎常量里找到
- [x] zh 与 en 两个路由都在，语言切换互通
- [x] 1 / 10 / 100 三种模式、自动、快进、重来都能用，自动模式能停
- [x] 无障碍：真按钮、aria-pressed、aria-live、触控目标 ≥ 44px
- [x] 390px 与 640px 宽度下截图附在 PR 里
- [x] `npm test` 与 `npm run build` 通过

`npm test`：6 个测试文件、47 项测试通过，新增 6 项爆点测试覆盖生成器边界、全部发布概率、目标相等、自动与手动跳车、已结束游戏不可改写、混合爆掉/跳车状态、展示上限、快进与逐步模拟一致性、累计计数、改注及数学口径反例。

`npm run build`：成功生成 14 个静态页面。

浏览器验证中英文及 390/640px，覆盖全部目标/局数/注额、爆掉、自动目标相等、手动跳车净收益与图上标记、混合局面、单局尾部轨迹取消、快进累计、飞行中/间隔中停止自动、下一轮读最新目标/注额/局数、重来清理、语言切换、老虎机下一桌导航、页脚目标、亏损色、触控尺寸、无横向溢出及无运行错误。见 [`g4-browser-results.json`](运行 tools/check_*.mjs 生成)。

日志：[`validation/g4-tests.txt`](validation/g4-tests.txt)、[`validation/g4-build.txt`](validation/g4-build.txt)。

复现：

```sh
npm ci
npm test
npm run build
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run preview -- --host 127.0.0.1
# 另一终端：
node tools/check_crash.mjs http://127.0.0.1:4321
```

Playwright 仅用于 QA。脚本支持 `PLAYWRIGHT_MODULE_PATH`、`BROWSER_EXECUTABLE_PATH`、`QA_FONTS_ROOT`；本次使用 Chromium 和与页面相同字体家族的本地字体包。测试在浏览器控制随机输入验证特定情形，没有向产品添加测试入口。

## 正式构建截图

中文 390px：

![中文爆点 390px](../../qa-output/screenshots/crash-zh-390.png)

英文路由 390px（缺译处中文兜底）：

![英文路由爆点 390px](../../qa-output/screenshots/crash-en-390.png)

中文 640px：

![中文爆点 640px](../../qa-output/screenshots/crash-zh-640.png)

英文路由 640px：

![英文路由爆点 640px](../../qa-output/screenshots/crash-en-640.png)

| 390px 状态 | 中文 | 英文路由 |
| --- | --- | --- |
| 飞行中 | [截图](../../qa-output/screenshots/crash-zh-390-flying.png) | [截图](../../qa-output/screenshots/crash-en-390-flying.png) |
| 自动跳车 | [截图](../../qa-output/screenshots/crash-zh-390-auto.png) | [截图](../../qa-output/screenshots/crash-en-390-auto.png) |
| 手动跳车 | [截图](../../qa-output/screenshots/crash-zh-390-manual.png) | [截图](../../qa-output/screenshots/crash-en-390-manual.png) |
| 爆掉 | [截图](../../qa-output/screenshots/crash-zh-390-bust.png) | [截图](../../qa-output/screenshots/crash-en-390-bust.png) |
| 十局 | [截图](../../qa-output/screenshots/crash-zh-390-ten.png) | [截图](../../qa-output/screenshots/crash-en-390-ten.png) |
| 混合局面 | [截图](../../qa-output/screenshots/crash-zh-390-mixed.png) | [截图](../../qa-output/screenshots/crash-en-390-mixed.png) |
| 百局飞行中 | [截图](../../qa-output/screenshots/crash-zh-390-hundred-flying.png) | [截图](../../qa-output/screenshots/crash-en-390-hundred-flying.png) |
| 百局结算 | [截图](../../qa-output/screenshots/crash-zh-390-hundred.png) | [截图](../../qa-output/screenshots/crash-en-390-hundred.png) |
