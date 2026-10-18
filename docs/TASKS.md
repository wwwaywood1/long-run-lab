# 任务分配 v2（2026-10-17 调整）

> **v2 调整**：GPT 额度不够，静态页面（章节、序章、结尾、首页、大厅、研究层 Ville）改由 DeepSeek 移植（D9–D20），Claude 提供框架和样板、写涉及数学的小部件、负责合并和验收。GPT 只保留动画和状态最复杂的三个游戏页 G7–G9。

| 角色 | 负责 | 不负责 |
|---|---|---|
| **Claude**（主导） | 架构、游戏引擎与测试、研究层计算与技术报告、审稿与验收、最终 QA | 逐页的体力活 |
| **GPT（Codex）** | 赌场游戏页 G1–G9（**已全部完成**）；之后按需接 Claude 派的交互小部件 | 改规则、改数字、改文案含义 |
| **DeepSeek** | 翻译、校对、事实核查；静态页面移植（D9–D20，按 docs/STATIC_PORTING.md） | 写概率和金额计算、改数字 |

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
| ~~G10~~ | 赌场大厅 → 改为 D19（DeepSeek），计算器由 Claude 写 | Casino | — | D1 |

## 第二波：静态页面（v2 起由 DeepSeek 移植）
框架和样板：Claude 已完成 `src/components/chapter/`（Chapter、Hero、Step、Predict、Deeper、NextChapter、Pending）、`src/i18n/page.ts`（`t()` / `rich()`）、`src/i18n/routes.ts`（`pageHref()`），样板页第 3 章 `src/views/Ch3Ruin.astro`（含破产计算器 `engine/ruin.ts`）。规范见 `docs/STATIC_PORTING.md`。

任务包用 `python3 tools/make_ds_bundle.py` 生成到 `handoff/deepseek/`（不进仓库），每页一个 .md，DeepSeek 每页开一个新对话，上传任务包即可。

| 编号 | 页面 | 设计稿 | 原编号 | 交回后 Claude 要做的 |
|---|---|---|---|---|
| D9 | 首页 | Home | G11 | 页眉“目录”按钮接到首页目录 |
| D10 | 序章：你来当庄家 | Prologue | G12 | 庄家模拟小部件 |
| D11 | 第 1 章：每一局的隐形税 | Ch1-EV | G13 | **已合并（试点）**，见 `docs/reviews/2026-10-17-deepseek-D11.md` |
| D12 | 第 2 章：运气会被平均掉 | Ch2-LLN | G14 | 大数定律模拟小部件 |
| — | 第 3 章：有限的你，无限的庄家 | Ch3-Ruin | G15 | **已完成（样板）** |
| D13 | 第 4 章：倍投法为什么不灵 | Ch4-Martingale | G16 | 倍投模拟小部件 |
| D14 | 换押法，不换税率 | Part2-Roulette | G17 | 视交付说明 |
| D15 | 网赌：不是概率问题 | Part2-Scam | G18 | 核对求助渠道 |
| D16 | 明知会输，为什么停不下来 | Part3-Psych | G19 | 视交付说明 |
| D17 | 真实世界的账本 | Part4-RealWorld | G20 | 押注次数滑块；内华达数字接 numbers.facts |
| D18 | 如果停不下来 | Ending | G21 | 核对求助渠道；分享图（并入 C4） |
| D19 | 赌场大厅 | Casino | G10 | 庄家视角计算器 |
| D20 | 研究层 · Ville 不等式 | Research-Ville | G22 | 公式和图的数值核对 |

## 第三波：研究层与上线（Claude）
G23 公平检测器（引擎 detector，研究层，Claude 自己做）· G24 上线检查并入 C4：GitHub Pages、Lighthouse（性能 / 无障碍 ≥ 90）、404 页、社交分享图

## DeepSeek
| 编号 | 任务 | 输入 | 输出 |
|---|---|---|---|
| D1 | 翻译：common + 赌场 11 页 | `i18n/source/common.json` 与 SicBo、Baccarat、Slots、Crash、Blackjack、Lottery、Scratch、Gacha、Sports、Casino、RouletteLab | 填好 `en` 的同名 JSON + 问题表 |
| D2 | 翻译：章节 11 页 | Home、Prologue、Ch1–Ch4、Part2–Part4、Ending | 同上 |
| D3 | 翻译：研究层 | Research-Ville、Research-Detector | 同上 |
| D4 | 中文校对 | 全部 `i18n/source/*.json` 的 `zh` | 问题表：id / 原文 / 建议 / 理由 |
| D5 | 事实核查 | `docs/FACTCHECK.md` | 每条：结论、原始出处链接、核实日期 |
| D9–D20 | 静态页面移植 | `handoff/deepseek/<编号>-<页面>.md` | `src/views/<Name>.astro` + 交付说明表，见上文第二波 |
| D21 | 新站名商标、域名初查 | 下文提示词 | 每个名字：撞名、商标类别、域名可用性，附链接 |
| D22 | 其他地区求助渠道核实 | 下文提示词 | 港澳台、新加坡、马来西亚、加拿大、澳大利亚、国际在线服务：官方出处 + 可粘进 `data/helplines.json` 的条目 |
| D23 | BBGS 筛查问卷使用许可 | 下文提示词 | 出处、原文、许可条款、计分规则、效度，附链接 |
| D24 | 页眉目录按钮（W9） | `handoff/deepseek/D24-TocMenu.md` | `src/i18n/toc.ts`、`src/components/TocMenu.astro`，修改 Base、Home |
| D25 | 结尾页复制链接反馈、分享图（W8） | `handoff/deepseek/D25-ShareActions.md` | `ShareActions.tsx`，修改 Ending |
| D26 | 第四部分押注次数账本、内华达数字接数据（W7） | `handoff/deepseek/D26-TurnoverLedger.md` | `TurnoverLedger.tsx`，修改 Part4RealWorld |
| D27 | 第二部分赔率拆解器、八种押法表接引擎（W5） | `handoff/deepseek/D27-PayoutBreakdown.md` | `PayoutBreakdown.tsx`，修改 Part2Roulette |
| D28 | 第三部分红黑序列检测器、A/B 统计接引擎（W6） | `handoff/deepseek/D28-SequenceDetector.md` | `SequenceDetector.tsx`，修改 Part3Psych |
| D29 | 研究层 · 公平检测器静态移植（两块交互留占位，正文数字接 numbers.detector） | `handoff/deepseek/D29-Research-Detector.md`（`tools/make_ds_bundle.py`） | `src/views/ResearchDetector.astro` + 交付说明 |
| D30 | 404 页（中英文同页） | `handoff/deepseek/D30-NotFound.md`（`tools/make_ds_misc_bundle.py`） | `src/pages/404.astro` + 新文案 |
| D31a–c | 全站英文通读：章节与研究层 / 十个游戏 / 组件新文案与求助渠道 | `handoff/deepseek/D31a-EN-Chapters.md` 等三份 | 修改建议表（必须改 / 建议改 / 存疑） |

**状态（2026-10-17）**：D1–D3 已交付、审完并并入 `i18n/source/`，审稿记录见 `docs/reviews/2026-10-17-translation-D1-D3.md`。D4、D5 待派。

**状态（2026-10-17）**：D6 引用核查、D7 求助渠道核实、D8 站名候选已完成，记录见 `docs/reviews/2026-10-17-deepseek-D6-D8.md`。

**状态（2026-10-17）**：D4 中文校对、D5 事实核查已完成并采纳，记录见 `docs/reviews/2026-10-17-deepseek-D4-D5.md`。

**状态（2026-10-17）**：G1–G4（共享组件、骰宝、百家乐、老虎机、爆点）已合并，审稿记录与返工单 G-fix 见 `docs/reviews/2026-10-17-gpt-G1-G4.md`。G-fix 完成后再派 G5。

**状态（2026-10-17，v2）**：GPT 做到 G6，等交回审稿。之后只派 G7–G9；额度用完还剩的游戏页转给 DeepSeek，由 Claude 跑测试。静态页面改派 DeepSeek（D9–D20），第 3 章样板已完成；D11 试点合格并已合并，其余 11 页可以派发。

## Claude
C1 审每个 PR 与每批译文 · C2 研究层英文技术报告 · C3 引擎与 numbers.json 的扩展（移植中发现缺的数字）· C4 上线前全站 QA（含原 G24）· C5 静态页面框架与第 3 章样板（已完成）· C6 合并 DeepSeek 交回的页面：生成路由、构建、check:en、截图对照、接数字、写小部件 · G23 公平检测器

---

## 可直接粘贴的提示词

### 给 GPT（Codex），每个 G 任务一份，替换尖括号
```
你在维护开源项目「概率的游戏」（仓库根目录有 docs/）。请完成任务 <G2 百家乐>。

先读：docs/ARCHITECTURE.md、docs/PORTING.md、docs/DESIGN.md，以及参照实现
src/components/RouletteLab.tsx 和 src/pages/zh|en/casino/roulette.astro。

要做：
1. 按 preview/<Baccarat>.dc.html 的设计稿，新建 src/components/<Baccarat>.tsx（Preact）
   和 src/pages/zh/casino/<baccarat>.astro、src/pages/en/casino/<baccarat>.astro。
2. 规则一律调用 src/engine/<baccarat>.ts，组件里不许写概率或赔付计算；缺的逻辑先加进引擎并补测试。
3. 页面上的统计数字从 data/numbers.json 读取，不许手写算出来的数。
4. 中文文案照设计稿；英文用 i18n/source/<Baccarat>.json 的 en 字段，没有译文的地方用中文并加 TODO(en) 注释。
5. 亏损色用 var(--loss)，不要写死颜色。
6. 站内链接用 src/i18n/routes.ts 的 pageHref()，数字格式用 src/i18n/format.ts。

完成标准：docs/PORTING.md 里的验收清单全部打勾；npm test 和 npm run build 通过；
PR 描述里附 390px 宽度下中英文各一张截图，并列出你对引擎或 numbers.json 做的任何改动。
不要改动已有的数字、规则和文案含义；有疑问写在 PR 描述里。
```

### 给 GPT（Codex）：交互小部件（W1–W4；v6 起 W5–W9 改派 DeepSeek，W10 并入 Claude 的上线检查）
每个编号一个分支、一个 PR。开工前从 GitHub 拉最新的 main（不要用旧压缩包，避免和主线冲突）。
```
你在维护开源项目「概率的游戏 / Long Run Lab」。请完成 <W1 赌场大厅 · 庄家视角计算器>。

先读：docs/WIDGETS.md（本任务规格和通用规则）、docs/STATIC_PORTING.md、docs/PORTING.md，
参照实现：src/components/widgets/RuinCalculator.tsx + src/engine/ruin.ts + src/views/Ch3Ruin.astro
（第 3 章破产计算器：引擎精确计算、组件只管显示、测试核对文案数字）。

要做：
1. 按 WIDGETS.md 对应行实现组件，替换 src/views/<Page>.astro 里的 data-widget 占位。
2. 数学写进 src/engine/ 并配测试；缺的统计数字加进 research/compute_numbers.py 再生成 numbers.json。
3. 顺带把本页写死的统计数字接到 numbers.json / 引擎，并加测试核对中英文文案里的数字。
4. 不改 i18n/source 和 preview；JSON 里缺的界面文字按 WIDGETS.md 通用规则 4 处理。

完成标准：docs/PORTING.md 验收清单全部打勾；npm test、npm run build、npm run check:en 通过；
新增 tools/check_<名字>.mjs 浏览器检查；PR 描述附 390px 中英文截图，列出引擎和 numbers.json 的改动与任何疑问。
```

### 给 DeepSeek：翻译（D1–D3）
```
你是中英翻译。项目「概率的游戏」是一个用可玩的模拟讲“久赌必输”的公益网站，读者是没有数学背景的普通人。

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

### 给 DeepSeek：静态页面移植（D9–D20）
每页开一个新对话，打开“深度思考”，上传 `handoff/deepseek/<编号>-<页面>.md`，只发一句：
```
请按附件完成任务。只输出附件末尾“交付”要求的内容。
```

### 给 DeepSeek：新站名初查（D21）
```
请帮我初查两个网站名称的撞名风险（不是法律意见，只做公开信息检索）：
- 中文名：概率的游戏（副标题：庄家从不掷“骰子”）
- 英文名：Long Run Lab（副标题：The house doesn't play dice.）
用途：开源公益网站，用可玩的模拟讲“久赌必输”，面向普通读者，非商业。

每个名字请给出：
1. 撞名：同名或高度近似的网站、App、书、游戏、品牌，列出名称、领域、链接。
2. 商标：中国商标网（CNIPA）、美国 USPTO 里同名或近似的商标，写出注册号、类别（尤其第 9、41、42 类）、状态。查不到就写“未检索到”，不要猜。
3. 域名：longrunlab.com / .org / .io 是否已被注册，有没有在用；中文名的拼音域名（如 gailvdeyouxi.com）同样查。
4. 结论：低 / 中 / 高风险，一句话理由。
所有结论都要附可点开的链接和查询日期。
```

### 给 DeepSeek：交互小部件（D24–D28）
任务包用 `python3 tools/make_ds_widget_bundle.py` 生成。每个编号开一个新对话，打开“深度思考”，上传对应的 .md，只发一句：
```
请按附件完成任务。只输出附件末尾“交付”要求的内容。
```
数学已经由 Claude 写进引擎并测过，DeepSeek 只写界面。交回后 Claude 负责构建、补测试和截图验收。

### 给 DeepSeek：检测器页、404 页、英文通读（D29–D31）
每份任务包开一个新对话，打开“深度思考”（不需要联网），上传 .md，只发一句：
```
请按附件完成任务。只输出附件里“交付”要求的内容。
```
D31 拆成 a、b、c 三份，互不依赖，可以同时开。

### 给 DeepSeek：其他地区求助渠道（D22）
打开“联网搜索”，新开对话，发：
```
请帮我核实戒赌求助渠道，用于一个公益网站结尾页的“其他地区”标签。中国大陆、美国、英国已经有了，不用查。
读者主要读中文，所以只查这些地区：香港、澳门、台湾、新加坡、马来西亚、加拿大、澳大利亚，另加一个不分国家的在线求助服务（例如 Gambling Therapy）。

每个地区最多 2 条，只收免费的求助热线或在线服务，并且由政府设立、政府资助或知名公益机构运营。不收商业戒赌机构、律师、App。

每条给出：
1. 名称：中文和英文；当地有官方中文名就用官方中文名
2. 号码或网址：照官网原样抄
3. 一句说明：谁设立或运营、服务时间、有没有普通话或粤语服务
4. 官方出处链接：必须是运营方或政府官网，不要新闻转载
5. 核实日期

找不到官方出处的写“未核实”，不要猜。
最后先用一张表汇总，再把每条写成下面的 JSON（name 前面加地区，例如“香港 · ……”），我会直接粘进 data/helplines.json：
{"name": {"zh": "", "en": ""}, "detail": {"zh": "", "en": ""}, "contact": "", "source": ""}
```

### 给 DeepSeek：BBGS 使用许可（D23）
打开“联网搜索”，新开对话，发：
```
请核实一份筛查问卷的使用许可（不是法律意见，只做公开信息检索）。
问卷：Brief Biosocial Gambling Screen（BBGS），据我们所知由 Gebauer、LaBrie、Shaffer 于 2010 年发表，出自哈佛医学院附属 Cambridge Health Alliance 的 Division on Addiction。
用途：开源公益网站放这 3 道题，读者在自己的浏览器里作答，结果不上传、不收费。

请查清：
1. 出处：作者、年份、期刊、DOI，以及官方页面链接。
2. 3 道题的官方英文原文（逐字照抄），以及有没有官方或经授权的中文版。
3. 使用条款：能不能免费放在网站上用？要不要申请许可？要求怎样署名？可不可以译成中文？条款原文怎么写就怎么引，附链接。
4. 计分规则：答几个“是”算筛查阳性，引用原文。
5. 效度：原论文报告的灵敏度、特异度；之后有没有在华人群体里验证过的研究。
每条结论都附可点开的链接和核实日期。查不到写“未检索到”，不要猜。
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

**G5 交付（2026-10-17）**：二十一点双语页面、手动操作、提示、Hi-Lo 显示和批量模拟完成，待审稿。见 [G5 PR 说明](prs/G5_BLACKJACK_PR.md)，其中列有设计稿统计原始实验缺失的待核对项。

**G6 交付（2026-10-17）**：双色球双语页面、逐球开奖、每期机选 1/10/100 注、长期购买和人民币换算完成，待审稿。见 [G6 PR 说明](prs/G6_LOTTERY_PR.md)，包括官方资金流/固定奖金模拟口径及待 D5 核对的背景事实。

**G7 交付（2026-10-17）**：刮刮乐双语页面、逐格/一键刮开、1/10/100 张、自动和快进完成，待审稿。见 [G7 PR 说明](prs/G7_SCRATCH_PR.md)，包含快进英文单位歧义及待 D5 核对的背景数字。

**G8 交付（2026-10-17）**：抽卡双语页面、保底进度、单抽/十连翻牌、直到限定及 10/100 人成本分布完成，待审稿。见 [G8 PR 说明](prs/G8_GACHA_PR.md)，其中列明原译文保底含义、成本边界与验收适用范围。

**G9 交付（2026-10-17）**：足球竞猜双语页面、手选/押热门、真实概率、逐场揭晓、1/10/100 单、串关、自动和快进完成，待审稿。见 [G9 PR 说明](prs/G9_SPORTS_PR.md)，包含名义返还与实际期望、原稿近似例子及既有事实待核对范围。

**状态（2026-10-17，v3）**：GPT 的 G-fix 与 G5–G9 已审完并合并，第一波 10 个赌场游戏全部完成，审稿记录见 `docs/reviews/2026-10-17-gpt-Gfix-G5-G9.md`。DeepSeek 的 D9–D20（其余 11 个静态页面）已交回并接入构建（46 页全部构建通过、无横向溢出、无报错、英文页无中文），逐页视觉审稿、数字接线和交互小部件待 Claude 完成。

**状态（2026-10-17，v11）**：D29–D31 已交付、审完并合并，没有返工；检测器页的两块交互（DetectorLab、FalseAlarmGrid）由 Claude 完成，404 页上线（`Base.astro` 加了 `noindex`、`selfHref`）；英文通读采纳 56 条。审稿记录见 `docs/reviews/2026-10-17-deepseek-D29-D31.md`。剩 Claude 的 C3（二十一点精确优势）、C4（上线检查，含 W10）、C2（技术报告）。

**状态（2026-10-17，v10）**：派出 D29（检测器页静态移植）、D30（404 页）、D31a–c（英文通读）。检测器页的两块交互（DetectorLab、FalseAlarmGrid）等 D29 交回后由 Claude 接 `engine/detector.ts`。

**状态（2026-10-17，v9）**：W4（第 4 章倍投实验）由 Claude 完成：`engine/martingale.ts`（平注、倍投、止盈止损、看路，均押红）、`MartingaleLab`，第 03 段数字接引擎，测试验证四种方法每押 1 元都亏 2/38。W1–W10 中只剩 W10 上线检查（并入 C4）。

**状态（2026-10-17，v8）**：GPT 的 W1–W3 已审完并合并（PR #1–#3），审稿记录见 `docs/reviews/2026-10-17-gpt-W1-W3.md`；合并时修正了序章“1000 人一张桌”与十万局独立计算的矛盾。W4（第 4 章倍投）未交付。

**状态（2026-10-17，v7）**：D24–D28 已交付、审完并合并，五个组件一次通过，没有返工，审稿记录见 `docs/reviews/2026-10-17-deepseek-D24-D28.md`。W5–W9 完成；剩 GPT 的 W1–W4 和 Claude 的检测器页（G23）、二十一点精确优势（C3）、上线检查（C4）、技术报告（C2）。

**状态（2026-10-17，v6）**：GPT 额度不够，W5–W9 改派 DeepSeek（D24–D28），引擎由 Claude 先写好（`engine/roulette.ts` 押法拆解、`engine/sequence.ts`、`engine/ledger.ts`，测试 12 项）；GPT 只保留 W1–W4；W10 并入 Claude 的上线检查 C4。

**状态（2026-10-17，v5）**：D22 已接入结尾页“其他”标签，9 条渠道全部回官方页面复核过。D23 审完：官方没有写明允许转载，因此不转载题目，第三部分第 04 段改为链接官方中文版和在线版，不需要申请许可；W11 取消。审稿记录见 `docs/reviews/2026-10-17-deepseek-D22-D23.md`。

**状态（2026-10-17，v4）**：D9–D20 逐页审完，合格，不需要返工；样式细节已由 Claude 改好。D21 合格。审稿记录见 `docs/reviews/2026-10-17-deepseek-D9-D21.md`。下一批派 D22（其他地区求助渠道）、D23（BBGS 许可）。

**状态（2026-10-17，v3）**：GPT 下一批任务为 W1–W10（章节交互小部件、全站目录、上线检查），规格见 `docs/WIDGETS.md`；建议顺序 A 组 W1–W4 → B 组 W5–W8 → C 组 W9–W10。
