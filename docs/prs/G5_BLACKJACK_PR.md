# G5 二十一点：手动打牌、策略提示与 Hi-Lo 计数

新增 `/zh/casino/blackjack/` 与 `/en/casino/blackjack/`。单桌可以手动要牌、停牌、加倍、分牌；提示显示基本策略建议，算牌开关显示已公开牌的 Hi-Lo 流水数、真数与剩余副数。10 / 100 桌按所选策略自动结算，可以比较 3:2 与 6:5 黑杰克赔付。赌场大厅已加入入口，爆点的下一桌链接现在可达。

基于 G-fix 交付包继续实现，保留整句英文、单复数、金额格式、双语高亮和共享组件的修复。

## 行为和实现

- 使用 `Blackjack.tsx`、`Blackjack.css` 与双语 Astro 页面。分段控件、盈亏头、盈亏曲线、实物换算、全黑揭晓段和百桌方阵均复用 `shared/`。
- 发牌后配置锁定，手动操作只开放引擎允许的动作；庄家逐步翻暗牌、摸牌、结算。分 A 后只补一张；分牌产生的 21 不显示成自然黑杰克，赔付仍遵循原引擎。
- 自动模式使用所选策略。单桌玩家行动阶段按下“停下”会交回手动控制；庄家阶段或多桌结算中的当前局会完成，随后停止。可在手动局中开启自动。重来与卸载会清理所有计时器。
- 快进累计 100 局，并继续使用当前牌靴；更换桌数和重来按设计稿重新创建牌靴。自动等待期间快进会更新下一局计时，避免重复回调。所有配置在下一局生效，局内注额/赔付/期望口径固定。
- 原“共多少手”的累计口径按设计稿保留：统计初始手数/桌数，分牌不额外计手；分牌和加倍产生的实际盈亏全部计入。手动局的虚线按基本策略期望绘制，正文保留说明。
- 英文通过 `makeCopy()` 取页面和 common 文案，动态句子按 `Blackjack.json` note 的整句模板渲染。动词后的金额不带正负号，独立净额保留符号；注额显示 `$1,000`。共享占位符格式增加 `hands` 单复数处理。
- 提示/算牌按钮从设计稿的 36px 增大至至少 44px。百桌格子保留颜色并增加 + / − / = 文字区别；暗牌不在 DOM 中输出牌面。

## 引擎和 numbers.json 改动

| 文件 | 改动 |
| --- | --- |
| `src/engine/blackjack.ts` | 只新增动作可用性、策略建议、庄家单步推进、已公开牌面/点数/计数视图、逐手金额和整轮结算、自动多桌汇总、损失速度，以及 70 局/小时、8 小时、100 局快进常量。累计会话使用已有 `session.ts`。原规则、基本策略、`BJ_EDGE`、牌靴洗牌和赔付实现未改。 |
| `src/engine/__tests__/blackjack-port.test.ts` | 新增 11 项边界/累计测试，包含自然黑杰克两档赔付、双方自然、暗牌只计数一次、四种动作、分牌及分 A、加倍、软 17 停牌、先爆先输、洗牌和自动累计。 |
| `research/compute_numbers.py` | 新增 `blackjack_presentation_numbers()`，并提供 `--blackjack-presentation-only` 增量生成入口。正常和 quick 输出也包含同一组展示引用。 |
| `data/numbers.json` | **仅新增 `blackjack.presentation_reference`**；所有原字段和原数值（含元数据和既有百万局基本策略模拟结果）完全保留。新增项明确标为 `method: design_reference`，具体限制见下节。 |

## 待审稿人核对的数字与口径

这些是原设计稿已有的问题，本次没有擅自修改数字或文案含义：

1. 设计稿声称爆牌图来自 200 万局、策略比较来自 300 万至 1500 万局、算牌结果来自 600 万局，但仓库没有这些原始实验的脚本/种子/输出。新增 `presentation_reference` 是对原设计稿数字的明确引用，**不是本次复现出来的 Monte Carlo 结果**。包括每 100 局约 16 局玩家爆牌、3.7 局双方爆牌，策略展示的 0.5% / 1.8% / 5.6% / 6.0%，以及算牌 +0.25%、每小时 27、波动 ±2,000、95% 不亏所需 16,000 小时等。来源和未复现状态已写入该数据项的 `source` / `note`。需要维护者补充原始实验记录，或另派研究任务重新验证。
2. `BJ_EDGE` 的基本策略值为 0.46% / 1.83%；`numbers.json` 既有独立百万局模拟为约 0.33485% / 1.87074%。原静态展示又采用上述约数。这几组并非同一份输出，现分别保留；动态期望沿用引擎常量，静态说明沿用设计稿展示引用，没有互相覆盖。
3. 原牌桌的“算牌”开关只显示 Hi-Lo，不会自动按真数调注；下面的“真数 2/3/4 对应 2/4/8 倍”是设计稿独立统计的说明。保留这一行为，避免把显示开关改成新的下注规则。
4. 静态说明保留“二十一点是唯一一个决定改变胜率的赌场游戏”等设计稿表述，未新增事实主张。下一桌双色球和研究层 Ville 仍属于后续任务，本轮保留同语言目标链接。

## 验证

- `npm test`：112 项通过，11 个测试文件。
- `npx tsc --noEmit`：零错误。
- `npm run build`：16 个静态页面构建成功。
- `npm run check:en`：英文构建页零中文残留。
- `node tools/check_blackjack.mjs`：中文与英文均通过，覆盖四种手动操作、分牌/分 A/加倍、两档自然黑杰克、庄家黑杰克、平局、先爆先输、软 17、提示和算牌、暗牌计数、所有注额和策略、1/10/100 桌、自动接管/停止、快进、重来、最新设置、计时器清理和语言/大厅/爆点导航。
- 浏览器在每个交互状态检查英文正文和无障碍标签没有中文，且无 `1 hands`、重复负号、未分组的 `$1000`；390px / 640px 无横向溢出，所有按钮和语言链接至少 44px，亏损色正确，没有页面异常。
- 新增 17 项文案/数据测试核对双语数字、整句占位符、hands 单复数和高亮；设计引用与已有模拟明确区分。
- `research/compute_numbers.py --quick --out qa-output/g5-numbers-smoke.json` 冒烟生成，及增量生成幂等性检查：结果见 `qa-output/g5-research.log`。

QA 图片和日志保存在 `.gitignore` 排除的 `qa-output/`；本 ZIP 为审阅附带证据，提交 Git 时不提交该目录，截图可上传 PR 附件。仓库尚未接入远程 Git，本文件是可直接使用的 PR 描述。

## 390px 双语截图

| 状态 | 中文 | English |
| --- | --- | --- |
| 初始页面 | ![中文 390px](../../qa-output/screenshots/blackjack-zh-390.png) | ![English 390px](../../qa-output/screenshots/blackjack-en-390.png) |
| 提示与 Hi-Lo | ![提示与计数](../../qa-output/screenshots/blackjack-zh-390-hint-count.png) | ![Hint and count](../../qa-output/screenshots/blackjack-en-390-hint-count.png) |
| 分牌与加倍 | ![分牌](../../qa-output/screenshots/blackjack-zh-390-split.png) | ![Split](../../qa-output/screenshots/blackjack-en-390-split.png) |
| 百桌 | ![百桌](../../qa-output/screenshots/blackjack-zh-390-hundred.png) | ![100 tables](../../qa-output/screenshots/blackjack-en-390-hundred.png) |

## 640px 双语截图

| 中文 | English |
| --- | --- |
| ![中文 640px](../../qa-output/screenshots/blackjack-zh-640.png) | ![English 640px](../../qa-output/screenshots/blackjack-en-640.png) |

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

数字出处的限制按上述待核对项披露；这组引用未被标成已复现研究。
