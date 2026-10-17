"""
为 DeepSeek 生成“交互小部件”任务包（D24–D28，对应 docs/WIDGETS.md 的 W9、W8、W7、W5、W6）。
数学已由 Claude 写进 src/engine/，DeepSeek 只写界面。每个任务一个 .md，上传到一个新对话即可开工。

运行：python3 tools/make_ds_widget_bundle.py          # 生成全部
      python3 tools/make_ds_widget_bundle.py D27      # 只生成一个
输出：handoff/deepseek/<编号>-<名字>.md（handoff/ 不进仓库）
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_ds_bundle import ROOT, OUT, clean_design, copy_table, fence  # noqa: E402

LANG = {"ts": "ts", "tsx": "tsx", "astro": "astro", "css": "css", "json": "json"}

RULES = """\
1. **你不能运行代码**，所以请严格照着下面给出的现成写法（尤其是 `RuinCalculator.tsx`），宁可朴素，不要发明新写法。写完后 Claude 负责构建、测试和截图验收。
2. **数学只在引擎里**。本任务要用的引擎函数 Claude 已经写好并测过，直接 `import`，**不要自己重写公式**，也不要在组件里写死任何概率、金额或百分比。页面上显示的统计数字一律来自引擎或 `data/numbers.json`。
3. **文案**：先用本页 JSON 里已有的条目——在页面模板里用 `t(n)` 取好，通过 props 传给组件（见 Ch3 的 `labels={{ … }}`）。JSON 没有的界面文字，在组件顶部写一个 `{ zh: …, en: … }` 字典，注释标 `NEW COPY`，并在交付说明里逐条列出，由 Claude 审定。**不要改 JSON，不要改设计稿。** 中文用简体，英文页不能出现中文。
4. **组件**：Preact + hooks（`import { useState } from 'preact/hooks'`），TypeScript。放在任务指定的路径。在页面里用 `<组件名 client:visible locale={locale} … />` 替换原来带 `data-widget` 的那一块，同时删掉对应的 `{/* WIDGET … */}` 注释和不再用到的静态样式。
5. **样式**：沿用页面现有的 class 和 CSS 变量（`var(--ink)`、`var(--muted)`、`var(--you)`、`var(--loss)`、`var(--highlight)` 等，见 `tokens.css`）。组件由 Preact 渲染，**不带 Astro 的作用域属性**，所以组件里用到的 class 如果样式写在页面 `<style>` 里，选择器要包 `:global(…)`；也可以写进 `src/components/widgets/widgets.css`。不要用内联颜色值。
6. **默认状态**要和现在的静态画面一致（本任务另有说明的除外）。
7. **无障碍**：按钮都用 `<button type="button">`；分段控件用 `aria-pressed`；会变化的结果区加 `aria-live="polite"`；滑块要有 `<label for>` 和 `aria-valuetext`；键盘能操作；可点区域不小于 44px。
8. **数字格式**：千分位用 `toLocaleString('en-US')`；英文金额前加 `$`（见 `site.ts` 的 `money()`）；百分比写清楚保留几位小数，并在交付说明里列出。
"""

DELIVERY = """\
1. 每个新建或修改的文件一个代码块，代码块第一行用注释写出路径。**修改的文件给完整内容**，不要只给片段。
2. 交付说明表：类型（NEW COPY / 数字 / 改动 / 疑问）| 位置 | 内容 | 说明。NEW COPY 要写出中英文全文。
3. 自查清单（逐条打勾）：
   - [ ] 没有在组件或页面里写概率、金额公式；所有统计数字来自引擎或 numbers.json
   - [ ] 用到的 `t(n)` 编号都在 JSON 里；新文案都标了 NEW COPY 并列进交付说明
   - [ ] 默认状态与现在的静态画面一致（或按本任务说明）
   - [ ] 按钮、分段控件、滑块、结果区的无障碍属性齐全，键盘可用
   - [ ] 英文页不会出现中文；中文用简体
   - [ ] 删掉了 WIDGET 注释和不再用到的静态样式
"""

COMMON_FILES = [
    ("src/i18n/site.ts", "语言、站名、金额格式"),
    ("src/i18n/page.ts", "t() / rich()"),
    ("src/i18n/format.ts", "概率和计数的格式化"),
    ("src/i18n/routes.ts", "pageHref()"),
    ("src/styles/tokens.css", "颜色变量"),
    ("src/components/widgets/RuinCalculator.tsx", "参考写法：第 3 章破产计算器，Claude 写的组件，照这个风格"),
    ("src/components/widgets/widgets.css", "参考写法：组件样式"),
    ("src/components/chapter/Predict.tsx", "参考写法：选择题组件"),
]


def numbers_excerpt(paths: list[str]) -> str:
    data = json.loads((ROOT / "data/numbers.json").read_text(encoding="utf-8"))
    out = {}
    for p in paths:
        node = data
        for k in p.split("."):
            node = node[k]
        out[p] = node
    return json.dumps(out, ensure_ascii=False, indent=2)


TASKS = [
    {
        "code": "D24", "name": "TocMenu", "title": "页眉“目录”按钮（W9）",
        "spec": """\
每一页的页眉右侧加一个“目录”按钮（设计稿里语言切换“中 / EN”右边那个两道横线的图标），点开后显示章节目录，和首页“目录”段是**同一份数据**。

要写的文件：
- `src/i18n/toc.ts`（新建）：导出 `tocEntries(locale)`，返回 `{ href, tag, label }[]`。把现在 `src/views/Home.astro` frontmatter 里的 `toc` 数组原样搬过来（用 `pageText(homeSource, locale)` 取 `t(16)`… 这些文字，`pageHref` 生成链接）。
- `src/views/Home.astro`（修改）：改为 `const toc = tocEntries(locale)`，其余不动。
- `src/components/TocMenu.astro`（新建）：一个 Astro 组件（**不用 Preact**），包含按钮、目录面板和一小段 `<script>`。
- `src/layouts/Base.astro`（修改）：在 `<nav class="lang-switch">` 后面放 `<TocMenu locale={locale} />`。Base 被全站 46 页共用，改动要小。

行为：
- 按钮：`<button type="button" aria-label={t('common.028')} aria-expanded="false" aria-controls="toc-panel">`，图标照设计稿的 SVG（两条横线），44×44。
- 面板：`<nav id="toc-panel" hidden aria-label={t('common.028')}>`，在页眉下方展开，白底，宽度占满（左右留 `var(--gutter)`），列表样式参照首页目录（左边短标签、右边章节名、行间细线）。当前页那一行加 `aria-current="page"` 并加粗（比较 `Astro.url.pathname` 和 `href`）。
- 脚本：点按钮切换 `hidden` 和 `aria-expanded`；按 Esc 关闭，焦点回到按钮；点面板外关闭；打开时焦点移到第一条链接。页面里只有一个目录按钮，用 id 选元素即可。
- 没有 JavaScript 时按钮不起作用也没关系，不要影响页面其他部分。

设计稿只有按钮没有展开后的样子，面板样式请朴素，跟首页目录保持一致。""",
        "files": [
            ("src/layouts/Base.astro", "要修改：全站外壳"),
            ("src/views/Home.astro", "要修改：首页（目录数据现在在这里）"),
            ("src/styles/global.css", "页眉、语言切换的样式"),
        ],
        "design": ("Home", "设计稿（看页眉右侧的按钮和首页目录段的样式）"),
        "json": ["Home", "common"],
        "numbers": [],
    },
    {
        "code": "D25", "name": "ShareActions", "title": "结尾页：复制链接反馈 + 生成分享图（W8）",
        "spec": """\
结尾页“把它传出去”一段有两个按钮。现在“复制链接”靠页面里一小段脚本，没有反馈；“生成分享图”是静态占位。把两个按钮合成一个组件。

要写的文件：
- `src/components/widgets/ShareActions.tsx`（新建）
- `src/views/Ending.astro`（修改）：用组件替换 `.end-actions` 整块，删掉页面底部 `data-copy-link` 那段 `<script>`。

数字：结论句里的 4.5 来自 `numbers.json` 的 `roulette.p_ahead_after_n.value['1000']`（0.0448 → 乘 100 保留 1 位 = 4.5）。在 Ending.astro 的 frontmatter 里算出这个字符串，用于分享图；页面上 `rich(30, …)` 那句保持原样（Claude 会加测试核对两者一致）。

组件 props：`locale`、`labels: { copy: t(31), create: t(32) }`、`lines: string[]`（结论句按 `<br>` 拆成的几行纯文字，在页面里用 `t(30).split('<br>')` 并去掉标签得到）、`highlight: string`（"4.5"）。

复制链接：
- 复制 `SITE_URL`（`src/i18n/site.ts`，Claude 已加）+ 当前语言路径，即 `${SITE_URL}${locale}/`，不要复制当前页面地址里的查询参数。
- 成功后按钮文字变成“已复制”2 秒再变回（NEW COPY），失败时显示“复制失败，请手动复制地址”（NEW COPY）。用 `navigator.clipboard.writeText`，不支持时走失败分支。

生成分享图：
- 用 `<canvas>` 画一张 1080×1350 的图：背景 `#0E0F12`；上方小字眉标用 `t(29)`；中间是结论句，衬线粗体白字（`'Noto Serif SC', serif`，字重 900，约 76px，行距 1.4），其中 highlight 那个数字用 `#FFE066`；底部是站名 `SITE[locale].name`、副标题 `SITE[locale].subtitle` 和网址（去掉 `https://`）。画之前先 `await document.fonts.load("900 76px 'Noto Serif SC'")`，避免字体还没下载就画成默认字体。
- 中文一行放不下时按字符换行，英文按单词换行；左右各留 96px。
- 画好后在按钮下方显示预览图（`<img>`，宽 100%，圆角 12px，`alt` 用结论句全文），下面两个按钮：“下载图片”（NEW COPY；用 `canvas.toBlob` 生成链接，文件名 `long-run-lab-${locale}.png`）；如果 `navigator.canShare?.({ files: [file] })` 为真，再显示“分享”（NEW COPY）调用 `navigator.share({ files: [file] })`。
- 这一切都在浏览器里完成，不上传任何东西。""",
        "files": [
            ("src/views/Ending.astro", "要修改：结尾页"),
        ],
        "design": ("Ending", "设计稿"),
        "json": ["Ending"],
        "numbers": ["roulette.p_ahead_after_n"],
    },
    {
        "code": "D26", "name": "TurnoverLedger", "title": "第四部分：押注次数账本 + 内华达数字接数据（W7）",
        "spec": """\
“同一笔钱，两种算法”：滑块调“每个筹码平均被押几次”（1–30，默认 10），重算三条账目和两张卡片。

要写的文件：
- `src/components/widgets/TurnoverLedger.tsx`（新建）
- `src/views/Part4RealWorld.astro`（修改）

引擎：`turnoverLedger(cash, timesBet, edge)`（`src/engine/ledger.ts`）。现金固定 100；`edge` 用 `numbers.baccarat.eight_deck_published.value.edge.B`（押庄 0.010579）。显示：
- 换成筹码的现金：`100`
- 总下注额：`totalBet`，千分位，整数
- 庄家赢走：`houseWin`，保留 1 位小数
- 左卡片（÷ 总下注额，庄家优势）：`edge × 100` 保留 2 位小数加 %（1.06%）
- 右卡片（÷ 换成筹码的现金，报告里的“赢率”）：`holdOnCash × 100` 保留 1 位小数加 %
- 默认 10 次时必须是 100 / 1,000 / 10.6 / 1.06% / 10.6%，和现在的静态画面一致。
- 滑块旁的“10 次”（`t(11)`）只在 10 时成立，需要一个模板（NEW COPY）：中文 `${n} 次`；英文 1 时写 `1 time`，其他写 `${n} times`。模板在 n = 10 时必须和 `t(11)` 一模一样。
- `t(14)` “庄家赢走（押庄 1.06%）”里的 1.06% 不用动，Claude 会加测试核对。

顺带把第 03、04 段写死的内华达数字接到 `numbers.facts.nevada_sep_2025`（只改数据来源，不改样子）：
- `$937.1M` = `slots_win_usd`，`$346.1M` = `table_win_usd`：两种语言都写成 `$` + 百万美元保留 1 位 + `M`。
- `55` = `consecutive_months`。
- 三张小图的“8.8% → 8.0%”“15.1% → 12.1%”“17.10% → 8.49%”和点的位置：分别来自 `strip_slots_hold`、`statewide_table_hold`、`strip_baccarat_hold` 的 `value`（[2024 年 9 月, 2025 年 9 月]）。现在的 x 坐标就是 `19 × 百分数`（8.8 → 167.2），照这个算；百分比的小数位保持现在的样子（老虎机、桌台 1 位，百家乐 2 位）。注意 `turns` 里 `from` 是 2024、`to` 是 2025。""",
        "files": [
            ("src/views/Part4RealWorld.astro", "要修改：第四部分页面"),
            ("src/engine/ledger.ts", "引擎，Claude 已写好，只读"),
        ],
        "design": ("Part4-RealWorld", "设计稿"),
        "json": ["Part4-RealWorld"],
        "numbers": ["baccarat.eight_deck_published", "facts.nevada_sep_2025"],
    },
    {
        "code": "D27", "name": "PayoutBreakdown", "title": "第二部分：赔率拆解器 + 八种押法表接引擎（W5）",
        "spec": """\
“赔率拆解器：庄家少付了多少”：四个押法按钮（单号 / 五号注 / 一打 / 红黑，默认单号），切换后重算两条赔率条和下面那句话。

要写的文件：
- `src/components/widgets/PayoutBreakdown.tsx`（新建）
- `src/views/Part2Roulette.astro`（修改）

引擎：`payoutBreakdown(key)`（`src/engine/roulette.ts`，Claude 已写好）。四个按钮对应 `'straight'`、`'five'`、`'dozen'`、`'red'`，标签用 `t(19)`–`t(22)`，分段控件的 `aria-label` 用 `t(18)`。
- 第一条“公平游戏应该赔”（`t(23)`）：数值 `fair`，条子占满宽度。
- 第二条“赌场实际赔”（`t(25)`）：数值 `pays`；条子蓝色部分宽度 = `paidShare × 100%`，剩下的黑色部分就是庄家少付的。
- 倍数显示规则：最多保留 2 位小数，去掉末尾的 0（37、6.6、2.17、1.11）。中文 `${x} 倍`，英文 `${x}×`。默认单号时必须和 `t(24)` “37 倍”、`t(26)` “35 倍”一模一样。
- 下面那句（现在是 `rich(27, …)`）：做成模板（NEW COPY），少付倍数 `shortfall` 按同样的规则显示，优势 `edge × 100` 保留 2 位小数加 %，加粗。**选单号时，模板去掉标签后必须和 `t(27)` 的中英文一字不差**（Claude 会加测试）。

顺带把第 03 段“八种押法，庄家各拿走多少”的八行表改成由引擎生成：遍历 `ROULETTE_BETS`，用一个 `key → t(n)` 的对照表取标签（单号 `t(19)`、两号 `t(29)`、三号 `t(30)`、四号 `t(31)`、五号注 `t(20)`、六号 `t(32)`、一打 `t(21)`、红黑 `t(33)`），数值 `edge × 100` 保留 2 位小数加 %。优势最高的那一行（五号注）保持现在的 `is-worst` 样式。样子不变。""",
        "files": [
            ("src/views/Part2Roulette.astro", "要修改：第二部分 · 轮盘页面"),
            ("src/engine/roulette.ts", "引擎，Claude 已写好，只读；本任务用文件末尾的“押法拆解”部分"),
        ],
        "design": ("Part2-Roulette", "设计稿"),
        "json": ["Part2-Roulette"],
        "numbers": ["roulette.bet_edges"],
    },
    {
        "code": "D28", "name": "SequenceDetector", "title": "第三部分：红黑序列检测器 + A/B 统计接引擎（W6）",
        "spec": """\
“轮到你：编 20 局，看检测器能不能认出来”：读者点“红 / 黑”一局一局编 20 局，编完后显示统计和结论。

要写的文件：
- `src/components/widgets/SequenceDetector.tsx`（新建）
- `src/views/Part3Psych.astro`（修改）

引擎：`assessSequence(seq)`（`src/engine/sequence.ts`，Claude 已写好）。`seq` 是 `boolean[]`，`true` = 红。返回换色次数 `switches`、最长同色 `longest`、平均换色 `expectedSwitches`、四个尾部概率和结论 `verdict`（`'random'` / `'too-even'` / `'too-streaky'`）。判定规则已在引擎里定好，组件只管显示。

界面：
- **初始状态是空的 20 个圆点**（例外：设计稿里已填 9 个只是示意，读者需要从头编）。红 = 实心，黑 = 空心，未编 = 虚线圈，样式沿用现有的 `.p3p-pill`。
- “红”“黑”两个按钮（`t(6)`、`t(7)`）在末尾追加一局；再加“撤销一局”“重来”两个小按钮（NEW COPY）。编满 20 局后红黑按钮禁用。
- 圆点区的 `aria-label` 现在是 `t(19)` “已编 9 局”，需要模板（NEW COPY）：中文 `已编 ${k} 局`，英文 1 时 `1 round entered`，其他 `${k} rounds entered`；k = 9 时必须和 `t(19)` 一模一样。
- 编满 20 局后，在按钮下方显示（`aria-live="polite"`）：
  - 换色次数：你的次数，以及“真随机平均 9.5 次”（9.5 来自 `expectedSwitches`）
  - 最长同色：你的长度
  - 结论一句（NEW COPY，三种）：random → 检测器认不出来，这串看起来像真随机；too-even → 换色太勤、连串太短，像人编的“太均匀”；too-streaky → 换色太少或连串太长，也不像公平随机。请写成简短、不说教的口吻。
  - 一行小字（NEW COPY）：说明判定规则是“在公平硬币下精确计算；一串真随机的结果被误判的概率不到 3%”。

顺带把第 02 段 A / B 两串的统计表（现在 `stats` 里写死的 2 / 6 / 31 / 18）改为用引擎的 `longestRun`、`countSwitches` 从 `seqA`、`seqB` 算出来（把每串两行拼成 40 局；`seqA`/`seqB` 里 1 = 红）。显示不变。""",
        "files": [
            ("src/views/Part3Psych.astro", "要修改：第三部分页面"),
            ("src/engine/sequence.ts", "引擎，Claude 已写好，只读"),
        ],
        "design": ("Part3-Psych", "设计稿"),
        "json": ["Part3-Psych"],
        "numbers": [],
    },
]


def bundle(task: dict) -> str:
    parts = [
        f"# {task['code']} 交互小部件：{task['title']}\n",
        "你在给开源公益项目「概率的游戏 / Long Run Lab」写网站（Astro 5 + Preact + TypeScript，中英双语，一个模板出两种语言）。"
        "这次的任务是把页面上一块静态占位做成能交互的组件。\n",
        "## 本任务说明\n",
        task["spec"] + "\n",
        "## 通用规则\n",
        RULES + "\n",
        "## 相关代码\n",
    ]
    for path, role in task["files"] + COMMON_FILES:
        lang = LANG[path.rsplit(".", 1)[1]]
        parts.append(f"### `{path}`（{role}）\n")
        parts.append(fence(lang, (ROOT / path).read_text(encoding="utf-8")))
    page, role = task["design"]
    parts += [f"## {role} `preview/{page}.dc.html`\n", fence("html", clean_design(ROOT / f"preview/{page}.dc.html"))]
    for j in task["json"]:
        parts.append(f"\n## 文案表 `i18n/source/{j}.json`\n")
        if j == "common":
            parts.append("用 `t('common.028')` 这样的写法。\n\n")
        else:
            parts.append(f"`t(n)` 的 n 就是编号后三位（`{j}.012` → `t(12)`）。\n\n")
        parts.append(copy_table(ROOT / f"i18n/source/{j}.json"))
    if task["numbers"]:
        parts += ["\n## `data/numbers.json` 相关部分（`import numbers from '../../data/numbers.json'`，路径按文件位置调整）\n",
                  fence("json", numbers_excerpt(task["numbers"]))]
    parts += ["\n## 交付\n", DELIVERY]
    text = "".join(parts)
    return re.sub(r"^(#{1,3} .*)\n(?!\n)", r"\1\n\n", text, flags=re.M)


def main(only: list[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for task in TASKS:
        if only and task["code"] not in only:
            continue
        path = OUT / f"{task['code']}-{task['name']}.md"
        text = bundle(task)
        path.write_text(text, encoding="utf-8")
        print(f"{path.relative_to(ROOT)}  {len(text):,} 字符")


if __name__ == "__main__":
    main(sys.argv[1:])
