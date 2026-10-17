# G3：老虎机

老虎机已有设计稿与转轴引擎，但没有正式页面。本次新增中英文路由及 Preact 实验台，复用 G1 的六个共享展示组件，并接通完整赔付表、亏损伪装揭晓和“差一点”说明。百家乐原先指向老虎机的下一桌链接现在可以正常访问。

本文件可直接作为 PR 描述。项目来自 ZIP，没有远程仓库地址，本次未创建远程 PR。任务名称为 G3/老虎机，因此模板中的 Baccarat 占位文件按 Slots/slots 对应处理。

## 页面与行为

- 新增 `src/components/Slots.tsx`、`Slots.css`、`src/pages/zh|en/casino/slots.astro`，赌场大厅加入老虎机入口。
- 默认单机、每次投 10；支持 1/10/100 台、每次投 1/10/100、拉一下、自动拉、停止、快进 100 次及重来。保留设计稿的单机三轴依次停止动画和多机更新时长。
- 单机横幅分别展示真赢、返还半注的“赢”、邻位“差一点”和未中；净盈亏与响铃/亏损计数由引擎提供。已经结算的横幅使用当次注额，避免改注后重算旧结果。
- 十机卡片与百机结果方阵保留三种反馈；百机用 `+ / −♪ / −` 和可访问文字补充颜色区分。亏损颜色使用 `var(--loss)`。
- 自动模式下一次读取最新设置；停止会取消下一次拉动，允许当前拉动结算；重来和卸载清理转轴启动、结算、间隔和多机帧更新计时器。重来也恢复初始转轴位置。
- 共享 `SegmentedControl`、`PnlHeader`、`PnlChart`、`LossConversion`、`HundredGrid`、`DarkReveal` 均有使用。`SlotsOutcomeGrid` 是静态 JSX 适配器，确保 Astro 可通过共享方阵输出揭晓图，无需 hydration。

## 引擎改动（完整清单）

`src/engine/slots.ts` 新增：

| 接口 | 作用 |
| --- | --- |
| `pullAtStops` | 从确定停点调用既有符号、赔付及邻位判定；原 `pull` 委托此函数，随机分布不变 |
| `SlotOutcome`、`SettledPull`、`SlotsRound`、`settlePulls`、`pullRound` | 多机净收益、返还总额、亏损额、真赢/响铃亏损/未中分类与单轮计数 |
| `SlotsSession`、`newSlotsSession`、`appendSlotsRound` | 调用 G1 纯累计器，额外累计响铃及伪装成赢的输 |
| `slotsLossRates` | 每分钟及通宵期望亏损 |
| `SLOTS_PULLS_PER_HOUR`、`SLOTS_NIGHT_HOURS`、`SLOTS_FAST_ROUNDS` | 从设计稿提取每小时 600 次、通宵 8 小时、快进 100 次的设定 |

现有三条转轴、20 个停点、特殊三连/圆点赔付、RTP 和 `isNearMiss` 规则均未改。赔付倍数继续指含本金的返还倍数，净收益在引擎中扣除注额。组件没有概率或赔付计算。

## numbers.json 与研究脚本改动（完整清单）

`research/compute_numbers.py → slots_numbers()` 在原有 8,000 种停点穷举中增加三个输出；只生成并追加这些新字段，没有重跑或改写其他游戏的模拟：

| 新字段 | 内容 |
| --- | --- |
| `slots.pay_table_probabilities` | 完整赔付表各行概率：777、BAR 三连、星三连、菱形三连及恰好 3/2/1 个圆点 |
| `slots.hundred_outcomes` | 100 格示意计数：真赢 17、响铃亏损 42、未中 41；分别取整并补足 100，不是随机抽出的样本 |
| `slots.p_adjacent_near_miss` | 邻位“差一点”概率 0.001，与引擎 `isNearMiss` 一致 |

旧 `numbers.json` 的所有字段和值逐项核对保持不变，包括原有老虎机 RTP、各类频率、`p_777`、`p_77x`、全部其他游戏与事实数据及 meta。页面上的概率表、100 格计数与“差一点”比较从 JSON 读取；赔率从引擎常量读取；实际赢率读取已有 `facts.nevada_sep_2025.strip_slots_hold.value[1]`。

研究层可单独复现整个老虎机数字块，不触发其他游戏计算：

```sh
python3 -c 'import json; from research.compute_numbers import slots_numbers; print(json.dumps(slots_numbers(), ensure_ascii=False, indent=2))'
```

变更清单与哈希见 [`g3-change-manifest.json`](运行 tools/check_*.mjs 生成)。设计稿、翻译源文件、依赖清单和锁文件保持原样；既有轮盘、骰宝、百家乐和共享组件文件未改。

## 验收清单（对应 docs/PORTING.md）

- [x] 组件里没有概率、赔付或规则计算（都在 engine）
- [x] 页面上的统计数字都能在 numbers.json 或引擎常量里找到
- [x] zh 与 en 两个路由都在，语言切换互通
- [x] 1 / 10 / 100 三种模式、自动、快进、重来都能用，自动模式能停
- [x] 无障碍：真按钮、aria-pressed、aria-live、触控目标 ≥ 44px
- [x] 390px 与 640px 宽度下截图附在 PR 里
- [x] `npm test` 与 `npm run build` 通过

`npm test`：5 个测试文件、41 项测试通过。新增 6 项老虎机测试，穷举全部 8,000 种停点，核对完整概率表、RTP、响铃/亏损率与两种“差一点”口径，并覆盖半注返还、大奖总额/净收益、累计计数、快进、换机/改注与展示历史截断。

`npm run build`：成功生成 12 个静态页面，含老虎机两种语言。

浏览器检查通过中英文 × 390/640px；覆盖数据表、揭晓计数、全部机数与注额、转轴中心停点、定向半注返还/邻位未中/大奖/普通未中、累计响铃与亏损次数、快进、局中/间隔停止自动、最新设置、启动前与结算前重来、语言切换、百家乐下一桌导航、亏损色、触控尺寸、无横向溢出与无运行错误。见 [`g3-browser-results.json`](运行 tools/check_*.mjs 生成)。

日志：[`validation/g3-tests.txt`](validation/g3-tests.txt)、[`validation/g3-build.txt`](validation/g3-build.txt)、[`validation/g3-numbers.txt`](validation/g3-numbers.txt)。

复现浏览器验收：

```sh
npm ci
npm test
npm run build
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run preview -- --host 127.0.0.1
# 另一终端：
node tools/check_slots.mjs http://127.0.0.1:4321
```

脚本支持 `PLAYWRIGHT_MODULE_PATH`、`BROWSER_EXECUTABLE_PATH`、`QA_FONTS_ROOT`。本次截图使用 Chromium 和相同字体家族的本地字体包；测试只在浏览器中控制随机输入以检验指定情形，没有给产品增加测试入口或结果替换逻辑。

## 待确认事项

1. 设计稿“19 倍”按 `p_77x / p_777 = 0.0095 / 0.0005`，即前两轴为 7、第三轴非 7；动画横幅的 `isNearMiss` 则要求第三轴相邻格是 7，概率为 0.001。本次保留这两个原有口径和全部文案，没有把它们混成同一个事件。建议后续编辑说明中明确两者区别。
2. 设计稿“赢 200 倍”对应含本金返还 200 倍；引擎净赚为 199 倍。表与横幅保留原含义，并在横幅另列净赚。
3. `i18n/source/Slots.json` 的英文栏全部为空。英文路由按要求中文兜底并加 `TODO(en)`；金额、实物、站名及页脚继续使用全站语言约定。
4. 100 格揭晓是整百分比示意，实际精确概率仍按完整赔付表和 JSON 数据展示。三个新字段的 note 已标明口径。
5. 下一张桌子的 `/casino/crash/` 尚未移植，保留同语言目标链接，待爆点任务补齐。原稿未附音频播放逻辑，本次响铃以原稿的视觉反馈和计数呈现。
6. 原始 `preview/support.js` 未包含在项目里，本次依据设计稿源文件逐段核对正式构建截图。`npx tsc --noEmit` 仍会在原有 `sports.ts` 报元组索引错误，新增文件无错误；任务要求的测试和构建均通过。

## 正式构建截图

中文 390px：

![中文老虎机 390px](../../qa-output/screenshots/slots-zh-390.png)

英文路由 390px（缺译处中文兜底）：

![英文路由老虎机 390px](../../qa-output/screenshots/slots-en-390.png)

中文 640px：

![中文老虎机 640px](../../qa-output/screenshots/slots-zh-640.png)

英文路由 640px：

![英文路由老虎机 640px](../../qa-output/screenshots/slots-en-640.png)

| 390px 状态 | 中文 | 英文路由 |
| --- | --- | --- |
| 返还半注、净亏损 | [截图](../../qa-output/screenshots/slots-zh-390-ldw.png) | [截图](../../qa-output/screenshots/slots-en-390-ldw.png) |
| 邻位“差一点” | [截图](../../qa-output/screenshots/slots-zh-390-near.png) | [截图](../../qa-output/screenshots/slots-en-390-near.png) |
| 大奖总额与净赚 | [截图](../../qa-output/screenshots/slots-zh-390-jackpot.png) | [截图](../../qa-output/screenshots/slots-en-390-jackpot.png) |
| 十台 | [截图](../../qa-output/screenshots/slots-zh-390-ten.png) | [截图](../../qa-output/screenshots/slots-en-390-ten.png) |
| 百台 | [截图](../../qa-output/screenshots/slots-zh-390-hundred.png) | [截图](../../qa-output/screenshots/slots-en-390-hundred.png) |
