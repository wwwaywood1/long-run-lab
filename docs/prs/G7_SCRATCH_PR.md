# G7 刮刮乐：逐格刮开、回本揭晓与批量购买

新增 `/zh/casino/scratch/` 与 `/en/casino/scratch/`。单张票可点击或用键盘刮开两个中奖号码和六个“我的号码”，也可以一键刮开。票面和奖金一致，全部八格揭晓后才累计结果，明确区分真赚、只拿回本钱和没中。10 / 100 张模式支持批量揭晓，另有自动购买、连续快进 100 次和重来。

基于 G6 完整交付版继续实现；双色球的下一桌链接已可达，赌场大厅加入刮刮乐入口。

## 实现与行为

- `Scratch.tsx` / `Scratch.css` 使用共享的分段控件、盈亏头、曲线、实物换算、全黑揭晓段与百票方阵。组件只负责计时和显示，不计算概率、中奖规则或赔付。
- 八格操作使用真按钮，支持 Enter / Space，提供状态和已揭晓数字/奖金的无障碍名称。覆盖状态不把号码、奖金或是否命中输出到 DOM。
- 任意顺序都可刮开，先刮“我的号码”也不改变结果；只有全部八格完成时结算一次。重复点击已揭晓格或重复一键操作不会重复累计。命中的号码在最终揭晓后标蓝，票面印的奖金等于实际奖金。
- 当前单张未完成时锁定购买、快进和张数选择；可以继续逐格、一键或开启自动来完成。自动停止会取消下一次购买，当前已安排揭晓的票/批仍完成；重来和卸载清理全部计时器。
- 手动一键揭晓会取消同一张票之前安排的自动揭晓；新的购买读取最新张数。等待阶段改变张数、快进或手动购买不会留下重复的下一批回调。
- 三种结果分别显示：蓝色真赚、黄色“中奖 10 元”但净额为零、亏损色没中。百票格子增加 + / = / −，不只靠颜色区分。
- 英文按 `Scratch.json` note 的整句 TEMPLATE 渲染，如 `Still 7 to go`、`Buy 1 ticket` 和 `This buy: 10 tickets, 5 “wins”, 2 break-even only · +90 yuan`，没有中文碎片拼接。
- 英文保留人民币：主盈亏和实物换算使用 `currency="CNY"`，票面金额使用 ¥10、¥1,000、¥10K、¥100K、¥1M。英文 K/M 与中文“万”按数值分别格式化，避免只换后缀造成百倍误差。中奖动词后的金额没有额外正负号。
- 公益说明、资金流、100 张示意图和真实世界文案保持原含义；静态文案直接读取翻译 JSON，高亮原句中的完整 `35%`，数字由测试核对。

## 引擎和 numbers.json 改动

| 文件 | 改动 |
| --- | --- |
| `src/engine/scratch.ts` | 原票价、奖级、每百万张分布、中奖抽样、干扰金额、号码生成和实际赔付完全保留。新增不可变八格状态、单格/全部揭晓、隐藏未揭晓值的数字视图、整批结算、共享会话扩展、100 次快进，以及张数/格数常量。数字视图将既有中文票面金额映射为数值，供双语显示使用，不重抽结果。 |
| `src/engine/__tests__/scratch-port.test.ts` | 新增 16 项测试，覆盖全部金额、覆盖值隐藏、重复/非法格号、任意揭晓顺序、号码/奖金一致、回本与净额、累计、同随机流的 100 次快进等价性和历史截断。 |
| `src/i18n/scratch.ts` | 新增人民币票面短金额格式；由 `money()` 格式化数字，再选择中文“万”或英文 ¥K / ¥M。 |
| `research/compute_numbers.py` | 新增刮刮乐 edge、百张示意频数、每张资金流和原稿背景引用；提供 `--scratch-presentation-only` 增量入口。完整/quick 输出含同样的新字段。 |
| `data/numbers.json` | **仅新增 `scratch.edge`、`scratch.hundred_outcomes`、`scratch.fund_flow_yuan_per_ticket`、`scratch.presentation_reference`**。全部既有字段和元数据不变。前三项由既有模型/比例计算；背景统计引用单独标记为 `design_reference`。 |

设计稿、翻译源文件和其他游戏引擎完全未改。共享组件接口无需变动。

## 保留的口径与待核对事项

1. 本页是项目设计的 10 元示例票，不是发行机构某款真实票的奖级表。沿用既有精确模型：返奖 65%、公益金 20%、发行费 15%；每张期望返奖 6.5 元，平均净亏 3.5 元。中奖率约 29.63112%，其中约 57.372% 的中奖仅返还本金。百张图将期望频数取整为 13 真赚 / 17 回本 / 70 没中，不保证任何一批恰好如此。
2. 原稿的“刚好拿回本钱，等于没中 / Just your money back, same as losing”照译文保留。引擎和累计正确记录为零净额，不把回本票计成亏 10 元。
3. **原译文的快进单位存在歧义。** 中文“快进 100 次”及设计稿代码表示 100 次购买，每次按所选 1/10/100 张，即共 100 / 1,000 / 10,000 张；`Scratch.031.en` 却写 `Skip 100 tickets`，与 note 中的 `Skip 100` 也不完全一致。本轮按任务要求保留 en 字段和原算法，没有悄悄改译文或把实际快进改成总共 100 张。请译者审定是否统一为 `Skip 100 buys` 或 `Skip 100`。浏览器断言覆盖上述实际张数。
4. 背景数字 2025 年 1–11 月即开型彩票销售额 1,208 亿元、同比 13.8%、2023 年同期增长 93.6% 来自原设计稿。新增 `presentation_reference` 明确记录原稿引用财政部/观研天下及澎湃新闻，但原始链接未随仓库提供，仍待 D5 核实；本轮不声称完成独立事实核查。公益金分配约数复用 G6 已保存的背景引用，既有 2025 年全国销售额与公益金数据保持不变。
5. 为保持原稿行为，购买后尚未刮完的单张不先记入盈亏和“已刮”计数，只有结算后累计；重来会丢弃未完成的示例票。没有增加实际付款或购票功能。
6. 下一桌抽卡与页脚“如果停不下来”分别保留同语言 `/casino/gacha/` 与 `/ending/` 目标，属于后续 G8 / G21。本轮没有虚构后续内容或热线信息。

## 验证

- `npm test`：187 项通过，16 个测试文件。
- `npx tsc --noEmit`：零错误。
- `npm run build`：20 个静态页面构建成功。
- `npm run check:en`：英文构建页零中文残留。
- `node tools/check_scratch.mjs`：中文和英文均通过。覆盖逐格与一键、键盘、未揭晓内容隐藏、任意顺序、防重复累计、所有奖金（含 ¥10K / ¥100K / ¥1M）、票面匹配、回本/没中/真赚、1/10/100 张、自动接管手动票、停止时机、重来清理、最新张数、自动等待期间快进、人民币及实物物价、语言/双色球/大厅导航。
- 390px / 640px 无横向溢出，所有按钮和语言链接至少 44px；亏损色正确，无页面异常。每个英文状态检查正文和无障碍名称没有中文及美元符号，关键完整英文句子有精确断言。
- 26 项文案/格式测试核对整句占位符、ticket 单复数、双语金额、M/K 数量级、高亮、资金流守恒及与 `numbers.json` / 引擎一致的静态数字。
- 研究脚本 quick 冒烟成功；新增四项与生成结果一致，增量生成逐字节幂等。变更清单确认所有旧数字/元数据和原规则正文不变。

截图、日志和浏览器报告在 `.gitignore` 排除的 `qa-output/`。本 ZIP 为审阅附带证据，提交 Git 时不提交该目录；截图上传 PR 附件即可。本文件是可直接使用的 PR 描述，尚未创建远程 PR。

## 390px 双语截图

| 状态 | 中文 | English |
| --- | --- | --- |
| 初始页面 | ![中文 390px](../../qa-output/screenshots/scratch-zh-390.png) | ![English 390px](../../qa-output/screenshots/scratch-en-390.png) |
| 逐格刮开 | ![部分揭晓](../../qa-output/screenshots/scratch-zh-390-partial.png) | ![Partial reveal](../../qa-output/screenshots/scratch-en-390-partial.png) |
| 回本提示 | ![回本](../../qa-output/screenshots/scratch-zh-390-even.png) | ![Break-even](../../qa-output/screenshots/scratch-en-390-even.png) |
| 真赚 | ![真赚](../../qa-output/screenshots/scratch-zh-390-win.png) | ![Net win](../../qa-output/screenshots/scratch-en-390-win.png) |
| 十张 | ![十张](../../qa-output/screenshots/scratch-zh-390-ten.png) | ![10 tickets](../../qa-output/screenshots/scratch-en-390-ten.png) |
| 百张 | ![百张](../../qa-output/screenshots/scratch-zh-390-hundred.png) | ![100 tickets](../../qa-output/screenshots/scratch-en-390-hundred.png) |

## 640px 双语截图

| 中文 | English |
| --- | --- |
| ![中文 640px](../../qa-output/screenshots/scratch-zh-640.png) | ![English 640px](../../qa-output/screenshots/scratch-en-640.png) |

## 移植验收清单

- [x] 组件里没有概率、赔付或规则计算（都在 engine）
- [x] 页面上的统计数字都能在 numbers.json 或引擎常量里找到
- [x] zh 与 en 两个路由都在，语言切换互通
- [x] 英文文案取自 `i18n/source/<Page>.json` 的 `en`，script 拼接照首碎片 note 里的 TEMPLATE；note 里写了“移植时必须改”的代码都改了
- [x] 金额一律用 `money()`；双色球、刮刮乐、抽卡三页传 `currency: 'CNY'`（英文也写人民币，见 TRANSLATION.md 第 5 条）
- [x] 组件文案用 `src/i18n/copy.ts` 的 `makeCopy()`；碎片句按 TEMPLATE 写英文函数，不拼碎片；英文单复数正确，动词后的金额不带正负号
- [x] 页面模板里不替换中文子串（高亮短语按语言分别写；文案里的数字由测试核对 numbers.json）
- [x] `npm run check:en` 零残留；浏览器检查在英文页玩遍所有模式后也没有中文
- [x] 截图和 QA 结果输出到 `qa-output/`，放进 PR 描述，不提交进仓库
- [x] 1 / 10 / 100 三种模式、自动、快进、重来都能用，自动模式能停
- [x] 无障碍：真按钮、aria-pressed、aria-live、触控目标 ≥ 44px
- [x] 390px 与 640px 宽度下截图附在 PR 里
- [x] `npm test` 与 `npm run build` 通过

原译文单位和背景事实待核对范围按上文披露；本页所有英文金额均保留人民币。
