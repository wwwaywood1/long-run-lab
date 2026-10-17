# 任务分配 v1

| 角色 | 负责 | 不负责 |
|---|---|---|
| **Claude**（主导） | 架构、游戏引擎与测试、研究层计算与技术报告、审稿与验收、最终 QA | 逐页的体力活 |
| **GPT（Codex）** | 逐页移植设计稿为正式页面、共享组件、部署与性能 | 改规则、改数字、改文案含义 |
| **DeepSeek** | 中译英、中文校对、中文资料的事实核查 | 写代码、改数字 |

## 工作流
1. 每个任务一个分支、一个 PR，标题用任务编号，例如 `G2 百家乐`。
2. GPT 的 PR、DeepSeek 的译文交给 Claude 审：可以把仓库挂到 Claude 的会话里直接审 PR，也可以把 diff / JSON 贴过来。
3. 审过的才合并到 main；main 自动部署到 GitHub Pages。

## 第一波：赌场游戏（可玩性最强，先上线）
| 编号 | 任务 | 设计稿 | 引擎 | 译文 |
|---|---|---|---|---|
| G1 | 抽出共享组件（分段控件、盈亏头、盈亏曲线、实物换算、全黑揭晓段、100 人方阵）并重构 RouletteLab 使用它们；再移植骰宝 | SicBo | sicbo | D1 |
| G2 | 百家乐（含发牌动画、路单） | Baccarat | baccarat | D1 |
| G3 | 老虎机（转轴动画、伪装成赢的输横幅） | Slots | slots | D1 |
| G4 | 爆点（实时倍数曲线、手动跳车） | Crash | crash | D1 |
| G5 | 二十一点（手动打、提示、算牌开关） | Blackjack | blackjack | D1 |
| G6 | 双色球（开奖动画、坚持买 1 年 / 10 年） | Lottery | lottery | D1 |
| G7 | 刮刮乐（点格子刮开） | Scratch | scratch | D1 |
| G8 | 抽卡（保底进度、十连翻牌、多人成本分布） | Gacha | gacha | D1 |
| G9 | 足球竞猜（手选赔率、串关、真实概率开关） | Sports | sports | D1 |
| G10 | 赌场大厅 + 庄家视角计算器 | Casino | — | D1 |

## 第二波：章节
G11 首页 · G12 序章 · G13 第 1 章（嵌入轮盘实验室）· G14 第 2 章 · G15 第 3 章 · G16 第 4 章 · G17 轮盘拆解 · G18 网赌与杀猪盘 · G19 赌徒谬误 · G20 庄家年报 · G21 结尾（求助资源按 F14 核实结果）

## 第三波：研究层与上线
G22 研究层 · Ville 不等式 · G23 公平检测器（引擎 detector）· G24 上线检查：GitHub Pages、Lighthouse（性能 / 无障碍 ≥ 90）、404 页、社交分享图

## DeepSeek
| 编号 | 任务 | 输入 | 输出 |
|---|---|---|---|
| D1 | 翻译：common + 赌场 11 页 | `i18n/source/common.json` 与 SicBo、Baccarat、Slots、Crash、Blackjack、Lottery、Scratch、Gacha、Sports、Casino、RouletteLab | 填好 `en` 的同名 JSON + 问题表 |
| D2 | 翻译：章节 11 页 | Home、Prologue、Ch1–Ch4、Part2–Part4、Ending | 同上 |
| D3 | 翻译：研究层 | Research-Ville、Research-Detector | 同上 |
| D4 | 中文校对 | 全部 `i18n/source/*.json` 的 `zh` | 问题表：id / 原文 / 建议 / 理由 |
| D5 | 事实核查 | `docs/FACTCHECK.md` | 每条：结论、原始出处链接、核实日期 |

**状态（2026-10-17）**：D1–D3 已交付、审完并并入 `i18n/source/`，审稿记录见 `docs/reviews/2026-10-17-translation-D1-D3.md`。D4、D5 待派。

**状态（2026-10-17）**：D6 引用核查、D7 求助渠道核实、D8 站名候选已完成，记录见 `docs/reviews/2026-10-17-deepseek-D6-D8.md`。

**状态（2026-10-17）**：D4 中文校对、D5 事实核查已完成并采纳，记录见 `docs/reviews/2026-10-17-deepseek-D4-D5.md`。

**状态（2026-10-17）**：G1–G4（共享组件、骰宝、百家乐、老虎机、爆点）已合并，审稿记录与返工单 G-fix 见 `docs/reviews/2026-10-17-gpt-G1-G4.md`。G-fix 完成后再派 G5。

## Claude
C1 审每个 PR 与每批译文 · C2 研究层英文技术报告 · C3 引擎与 numbers.json 的扩展（移植中发现缺的数字）· C4 上线前全站 QA

---

## 可直接粘贴的提示词

### 给 GPT（Codex），每个 G 任务一份，替换尖括号
```
你在维护开源项目「赌博默示录」（仓库根目录有 docs/）。请完成任务 <G2 百家乐>。

先读：docs/ARCHITECTURE.md、docs/PORTING.md、docs/DESIGN.md，以及参照实现
src/components/RouletteLab.tsx 和 src/pages/zh|en/casino/roulette.astro。

要做：
1. 按 preview/<Baccarat>.dc.html 的设计稿，新建 src/components/<Baccarat>.tsx（Preact）
   和 src/pages/zh/casino/<baccarat>.astro、src/pages/en/casino/<baccarat>.astro。
2. 规则一律调用 src/engine/<baccarat>.ts，组件里不许写概率或赔付计算；缺的逻辑先加进引擎并补测试。
3. 页面上的统计数字从 data/numbers.json 读取，不许手写算出来的数。
4. 中文文案照设计稿；英文用 i18n/source/<Baccarat>.json 的 en 字段，没有译文的地方用中文并加 TODO(en) 注释。
5. 亏损色用 var(--loss)，不要写死颜色。

完成标准：docs/PORTING.md 里的验收清单全部打勾；npm test 和 npm run build 通过；
PR 描述里附 390px 宽度下中英文各一张截图，并列出你对引擎或 numbers.json 做的任何改动。
不要改动已有的数字、规则和文案含义；有疑问写在 PR 描述里。
```

### 给 DeepSeek：翻译（D1–D3）
```
你是中英翻译。项目「赌博默示录」是一个用可玩的模拟讲“久赌必输”的公益网站，读者是没有数学背景的普通人。

请严格按照下面的翻译规范和术语表，把 JSON 里每条的 zh 译成英文，填进 en 字段。
- 只改 en 和 note，其他字段原样保留；输出合法 JSON。
- 数字一个都不能改；{{占位符}} 和 <br> 原样保留。
- kind 为 script 的碎片：看 context 里的整行代码，在第一个碎片的 note 写出完整英文句子模板。
- 新术语、拿不准的句子，在交付时另附一张表。

【翻译规范】<粘贴 docs/TRANSLATION.md 全文>
【术语表】<粘贴 i18n/glossary.csv 全文>
【待翻译文件】<粘贴一个 i18n/source/*.json>
```

### 给 DeepSeek：中文校对（D4）
```
请校对下面 JSON 里所有 zh 文案：错别字、病句、前后用词不一致、语气过于说教或恐吓的地方。
不要改任何数字，不要改 {{占位符}}。
输出一张表：id | 原文 | 建议 | 理由。没有问题的条目不用列。
<粘贴一个 i18n/source/*.json>
```

### 给 DeepSeek：事实核查（D5）
```
请逐条核实下面清单里的事实。每条给出：
1. 结论：成立 / 不成立 / 已变化（写出现行数字）
2. 原始出处：优先政府公告、官方规则、原始报告的链接
3. 核实日期
找不到原始出处的，写明“只找到二手来源”并列出来源。不要猜。
<粘贴 docs/FACTCHECK.md 的表格>
```
