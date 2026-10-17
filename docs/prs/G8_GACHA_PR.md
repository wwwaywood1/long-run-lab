# G8 抽卡：保底进度、十连翻牌与多人成本分布

新增 `/zh/casino/gacha/` 与 `/en/casino/gacha/`。单人可单抽、十连，或一直抽到下一张限定卡；十连逐张翻开，支出和保底状态同步更新。10 / 100 人模式各自从零抽到第一张限定，展示每个人花了多少、平均成本及成本分档。赌场大厅加入抽卡入口，G7 的下一桌链接可达。

基于 G7 完整交付版继续实现。本文件可直接作为 PR 描述使用，尚未创建远程 PR。

## 实现和行为

- `Gacha.tsx` / `Gacha.css` 按原稿分为单人卡池、多人成本分布、全黑精确分布揭晓、保底心理和法规文案。复用 `SegmentedControl`、`PnlHeader`、`LossConversion`、`HundredGrid` 和 `DarkReveal`。本页按设计展示抽数分布，没有另加现金盈亏曲线。
- 单抽或十连的结果只由原 `pull()` 产生；界面通过引擎快照逐张显示。翻牌尚未结束时锁定重复购买和人数切换；重来始终可用，并清理所有未执行计时器，卸载时也清理。
- 单抽保留其余九个空卡位，十连每 70ms 揭晓下一张，卡面有 320ms 翻入动画；减少动态效果设置下关闭 CSS 动画。未揭晓卡片不在 DOM 或无障碍名称中暴露结果。
- “一直抽到限定”从当前保底和大保底状态继续，停在下一张限定。沿用设计稿只展示最后十张的方式；前面的抽数先计入展示起点，最后十张逐张计入，最终支出精确到此次抽取和总累计两种口径。新一轮抽取不清空已有累计。
- 切换 10 / 100 人会自动生成一组独立的新玩家，每人拿到第一张限定即停。十人显示成本条；百人用共享方阵显示成本档位，增加 1 / 2 / 3 和对应图例，读屏名称、title 包含玩家编号和人民币成本。每次重跑替换整组，不累计上组结果。
- 切回“只看我”保留个人记录；多人“清空”沿用原稿 `reset()`，同时清空个人和多人结果，维持当前人数选项。正在生成时清空会取消稍后的展示。
- 中英都按人民币展示。主支出由共享盈亏头显示负数；“You have spent / This one cost / Cheapest”等句子中的金额为无符号正数，英文不出现美元。实物换算使用人民币物价，正确显示 `1 bubble tea` 等单数。
- 组件整句文案用 `makeCopy()`；动态横幅、多人结果和统计行用完整英文模板。`1 pull / 1 limited card / 1 lost 50/50 / 1 4-star` 均为单数；不拼接中文碎片。
- 直方图九组数据直接取 `numbers.json`。33% / 22% 的原稿峰值说明移到图下，避免英文在 SVG 内互相遮挡。心理段高亮分别指定中英文短语，保留原句和标点；返奖率零使用亏损色，深色区用 `var(--loss-on-dark)`。

## 引擎与 numbers.json 改动

| 文件 | 改动 |
| --- | --- |
| `src/engine/gacha.ts` | **原文件正文逐字保留，仅在末尾新增接口**：人数、保底/张数/成本分档常量；不可变的单抽/十连/直到限定操作；逐张玩家快照与最后十张视图；总支出、剩余保底和进度视图；独立多人模拟、平均/最少/最多成本和严格大于 2,000 元的人数。原 `p5()`、`pull()`、五星/四星概率、软/硬保底和 50/50/大保底规则不变。 |
| `src/engine/__tests__/gacha-port.test.ts` | 新增 20 项测试：同随机流与原引擎等价、输入/快照隔离、下一张限定停止、180 抽上限、歪后保证、十抽保底、现金支出、阈值边界、独立多人、研究数据一致性。 |
| `src/i18n/gacha.ts` / `gacha.test.ts` | 英文整句与单复数、人民币金额、按语言高亮和静态数字一致性；新增 16 项测试。 |
| `research/compute_numbers.py` | 新增 `gacha.presentation`，以及只补这一项的 `--gacha-presentation-only` 入口。正常/quick 生成同样包含这项。 |
| `data/numbers.json` | **仅新增 `gacha.presentation`**：16 元单价；中位 / 90 分位 / 最坏成本 1,280 / 2,480 / 2,880 元；示例模型现金返还率 0；原稿 76 抽示例的已花 1,216 元、剩 14 抽 / 224 元和进度。全部既有字段、旧统计与元数据不变。 |

其他游戏引擎、设计稿、译文源文件和共享组件接口未改。

## 保留的原稿口径与待核对事项

1. 本页是示例卡池，不对应某款游戏。16 元单价为原稿“648 元约 40 抽”的近似，继续使用既有常量，没有改成 16.2 元。卡片不返还现金，抽中限定仍累计全部支出。
2. **`Gacha.039.en` 把“再抽 14 抽就一定能出”明确译成了限定卡 “certain to drop”。** 在没有大保底时，硬保底保证的是五星，未必限定。中文原稿也未在这个静态例子说明大保底状态。本轮遵循 en 字段保留，交译者/主导审定；互动引擎仍正确执行 50/50 和歪后的大保底。
3. 原稿 `Gacha.058` 写“十连至少出一张四星 / A 10-pull gives at least one four-star”，实际原引擎保证的是四星**或以上**。界面原句未改，测试包含十连只有五星而没有四星也合法的规则口径。
4. **成本档位边界沿用原算法的 `> 2,000`**，所以恰好 2,000 元（125 抽）计入中档；`Gacha.077.en` 却写 “2,000 yuan or more”。本轮没有静默改规则或译文，需审定英文是否改为 “over 2,000 yuan”。“Under 1,000”与中文“以内”的边界也略不同，但 16 元步长不会正好得到 1,000 元。引擎测试明确包含 2,000 边界。
5. 原稿 `Gacha.041.en` 的 “after pull 74” 与下一句前 73 抽基础概率之间有端点表述歧义：代码从第 74 抽开始加概率。保留译文供审定。64% 仍来自 `share_5star_after_pull_73` 的精确值取整。
6. 直方图的 33% / 22% 是两个 20 抽区间的总概率；原稿标注“没歪 / 歪了一次”是在解释两座山，不是把区间总概率进一步按是否歪精确分组。本轮保留标签含义和原始分布，没有用标签反推另一套数据。
7. 法规段中国 2017 年及比利时 2018 年的历史描述照原文/译文保留，仍属 D5 待核实范围；本轮只移植，不声称补做了现行法规核查。英文 `Gacha.061/062/069/076` note 里的旧 `$` 示例按审定的人民币规则覆盖。
8. 下一桌足球竞猜链接保留同语言 `/casino/sports/`，由后续 G9 实现。本轮没有提前移植 G9。

## 验证

- `npm test`：**223 项通过，18 个测试文件**（新增 36 项）。
- `npx tsc --noEmit`：零错误。
- `npm run build`：22 个静态页面构建成功（另有首页重定向 HTML）。
- `npm run check:en`：英文构建页零中文残留。
- `node tools/check_gacha.mjs`：中英均通过，覆盖键盘单抽、逐张十连、四星保底、80 抽软保底显示、90 抽硬保底和歪后下一五星限定、until 的新增与总支出口径、单抽限定的单数、多人分布、新组/清空/模式保留、重来和卸载计时器、人民币换算、按语言亏损色、强调与导航。
- 所有已跑英文状态同时检查正文、读屏名称、单复数和美元残留。390px / 640px 无横向溢出，按钮及语言链接至少 44px；两种语言均无页面异常。
- 新增统计仅取既有精确模型；增量生成逐字节幂等，并与研究脚本 quick 输出核对。变更清单验证旧数据/元数据、原抽卡规则正文、所有设计稿/翻译及其他游戏引擎保持不变。

截图、日志和报告位于 `.gitignore` 排除的 `qa-output/`，随 ZIP 附上便于审阅；提交 Git 时不提交此目录，截图上传为 PR 附件。

## 390px 双语截图

| 状态 | 中文 | English |
| --- | --- | --- |
| 初始页 | ![中文 390px](../../qa-output/screenshots/gacha-zh-390.png) | ![English 390px](../../qa-output/screenshots/gacha-en-390.png) |
| 十连翻牌中 | ![翻牌中](../../qa-output/screenshots/gacha-zh-390-flipping.png) | ![Flipping](../../qa-output/screenshots/gacha-en-390-flipping.png) |
| 十连完成 | ![十连](../../qa-output/screenshots/gacha-zh-390-ten.png) | ![10-pull](../../qa-output/screenshots/gacha-en-390-ten.png) |
| 歪后大保底 | ![歪了](../../qa-output/screenshots/gacha-zh-390-off.png) | ![Lost 50/50](../../qa-output/screenshots/gacha-en-390-off.png) |
| 软保底进度 | ![软保底](../../qa-output/screenshots/gacha-zh-390-soft-pity.png) | ![Soft pity](../../qa-output/screenshots/gacha-en-390-soft-pity.png) |
| 抽到限定为止 | ![直到限定](../../qa-output/screenshots/gacha-zh-390-until.png) | ![Until limited](../../qa-output/screenshots/gacha-en-390-until.png) |
| 10 人成本 | ![10 人](../../qa-output/screenshots/gacha-zh-390-ten-players.png) | ![10 players](../../qa-output/screenshots/gacha-en-390-ten-players.png) |
| 100 人成本 | ![100 人](../../qa-output/screenshots/gacha-zh-390-hundred-players.png) | ![100 players](../../qa-output/screenshots/gacha-en-390-hundred-players.png) |

## 640px 双语截图

| 中文 | English |
| --- | --- |
| ![中文 640px](../../qa-output/screenshots/gacha-zh-640.png) | ![English 640px](../../qa-output/screenshots/gacha-en-640.png) |
| ![百人 640px](../../qa-output/screenshots/gacha-zh-640-hundred-players.png) | ![100 players 640px](../../qa-output/screenshots/gacha-en-640-hundred-players.png) |

## 移植验收清单

- [x] 组件里没有概率、赔付或规则计算（都在 engine）
- [x] 页面上的统计数字都能在 numbers.json 或引擎常量里找到
- [x] zh 与 en 两个路由都在，语言切换互通
- [x] 英文文案取自 `i18n/source/<Page>.json` 的 `en`，script 拼接照首碎片 note 里的 TEMPLATE；note 里写了“移植时必须改”的代码都改了；原译文与规则的待核对项已列明
- [x] 金额一律用 `money()`；双色球、刮刮乐、抽卡三页传 `currency: 'CNY'`（英文也写人民币，见 TRANSLATION.md 第 5 条）
- [x] 组件文案用 `src/i18n/copy.ts` 的 `makeCopy()`；碎片句按 TEMPLATE 写英文函数，不拼碎片；英文单复数正确，动词后的金额不带正负号
- [x] 页面模板里不替换中文子串（高亮短语按语言分别写；文案里的数字由测试核对 numbers.json）
- [x] `npm run check:en` 零残留；浏览器检查在英文页玩遍所有模式后也没有中文
- [x] 截图和 QA 结果输出到 `qa-output/`，放进 PR 描述，不提交进仓库
- [x] 1 / 10 / 100 三种模式、自动、快进、重来都能用，自动模式能停——**按 G8 设计适用范围验收**：1 / 10 / 100 为人数；单人单抽/十连/直到限定、多人自动生成/重跑和重来/清空可用。原稿没有无限自动、快进 100 次或对应停下按钮；有限的“直到限定”自动停在限定，重来可中断翻牌。未添加原稿以外的持续抽取模式。
- [x] 无障碍：真按钮、aria-pressed、aria-live、触控目标 ≥ 44px
- [x] 390px 与 640px 宽度下截图附在 PR 里
- [x] `npm test` 与 `npm run build` 通过
