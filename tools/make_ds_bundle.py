"""
为 DeepSeek 生成静态页面移植任务包：每页一个 .md，上传到一个新对话即可开工。

运行：python3 tools/make_ds_bundle.py            # 生成全部
      python3 tools/make_ds_bundle.py Ending     # 只生成一页
输出：handoff/deepseek/<编号>-<页面>.md（handoff/ 不进仓库）

任务包内容：任务说明 → 移植规范 → 框架代码 → 样板（第 3 章的设计稿和成品）→ 本页设计稿 → 本页文案表 → 附加数据 → 交付格式。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "handoff" / "deepseek"

# 编号、设计稿名、本页的特别说明
TASKS: list[tuple[str, str, str]] = [
    ("D9", "Home", """\
- 这是首页，视图名 `Home`。大标题用 `SITE[locale].name` 的写法拆成两行（中文“概率的<br>游戏”，英文“Long Run<br>Lab”），副标题用 `SITE[locale].subtitle`；它们在 `src/i18n/site.ts`，`import { SITE } from '../i18n/site'`。JSON 里对应的条目照样核对，但页面上以 SITE 为准。
- 100 个小人方阵和 10 个小轮盘是装饰图：可以把设计稿脚本 `renderVals()` 里生成数组的逻辑原样搬进 frontmatter（这不算概率计算），在交付说明里把 4.5 / 95.5 列为“数字”。
- 目录里每一项都用 `pageHref`。页脚由 Chapter 统一提供，设计稿页脚里的“[GitHub 地址待定]”改放到目录段末尾那句话后面，链接 https://github.com/wwwaywood1/long-run-lab （外部链接，不用 pageHref；链接文字没有现成编号，就先用仓库地址本身，并在交付说明里列为“疑问”）。
- `<Chapter page="Home" title={…}>` 的 title 用 JSON 里最合适的一条（例如眉标），在交付说明里写明。"""),
    ("D10", "Prologue", """\
- 序章“你来当庄家”。凡是要模拟下注、算庄家收入的部分都按规范第 5 条留 WIDGET 占位，并写清楚设计稿默认状态显示的数字。"""),
    ("D11", "Ch1-EV", """\
- 设计稿里的 `<dc-import name="RouletteLab" default-tables="10">` 换成现成组件：`import RouletteLab from '../components/RouletteLab';`，写 `<RouletteLab client:visible locale={locale} defaultTables={10} />`。
- 38 格示意（一排排小色块）是静态装饰，照设计稿画；颜色换成变量。“5.26”“+1,800”“−2,000”等列为“数字”。"""),
    ("D12", "Ch2-LLN", """\
- 第 2 章“运气会被平均掉”。会动的模拟（多条资金曲线、按钮切换局数）全部留 WIDGET 占位，默认状态的 SVG 照设计稿画出来。
- 仓库里还有一份英文排版草稿 `EN-Ch2-LLN.dc.html`，不用参考：英文一律以 JSON 的 en 为准。"""),
    ("D13", "Ch4-Martingale", """\
- 第 4 章“倍投法为什么不灵”。倍投模拟、连输概率之类的交互留 WIDGET 占位；静态的推演表和图照画。"""),
    ("D14", "Part2-Roulette", """\
- “换押法，不换税率”：各种押法的对比如果只是静态表格就照画；如果有按钮切换押法并重算，留 WIDGET 占位。"""),
    ("D15", "Part2-Scam", """\
- 网赌与杀猪盘。设计稿里“如果已经遇到了”这类求助、举报渠道，不要照抄设计稿里的号码：从附加数据 `data/helplines.json` 读取（`import helplines from '../../data/helplines.json'`），中文页用 `regions.cn.fraud`，英文页依次列 `regions.us.fraud` 和 `regions.uk.fraud`，每行显示名称（按语言取 zh / en）、联系方式、详情。
- 聊天截图式的示意（假客服对话）是静态排版，照画。"""),
    ("D16", "Part3-Psych", """\
- “明知会输，为什么停不下来”。实验类的小互动（例如抛硬币猜下一次）如果要算概率，留 WIDGET 占位。"""),
    ("D17", "Part4-RealWorld", """\
- “真实世界的账本”。“每个筹码平均被押几次”滑块会重算金额和百分比，留 WIDGET 占位（默认 10 次时的数字照设计稿画）。
- 内华达的金额、赢率、“55 个月”全部列为“数字”，Claude 会接到 `numbers.facts`。三张小图照设计稿画。"""),
    ("D18", "Ending", """\
- 结尾“如果停不下来”。“找专业的人聊聊”的地区标签页从附加数据 `data/helplines.json` 生成，不要照抄设计稿里的号码：
  - 可以写一个纯界面的小组件 `src/components/widgets/HelpTabs.tsx`：props 是 `locale` 和 `regions`（直接传 helplines.json 的 regions），用 `role="tablist"`/`role="tab"`/`role="tabpanel"`，键盘左右键切换。
  - 中文页默认选中“中国大陆”，英文页默认选中“美国”。每个地区先列 `help`，再列 `fraud`。`contact` 可能是字符串、`{zh,en}` 对象或 null（null 时显示 JSON 里对应的说明文字）。
  - “其他”标签：如果 JSON 文案里有对应说明就用它，没有就在交付说明里提“疑问”。
- “4.5”列为“数字”。“复制链接”可以做（`navigator.clipboard.writeText(location.href)`）；“生成分享图”留 WIDGET 占位。
- 页脚右侧链接是“回到首页”：写 `<Chapter … footerPage="Home" footerLabel={t(n)}>`，n 是 JSON 里“回到首页”那一条。"""),
    ("D19", "Casino", """\
- 赌场大厅。10 张桌子的列表照画，链接用 `pageHref`。每张桌子右侧的庄家优势（5.26%、2.78%、1.06%……）全部列为“数字”。
- “庄家视角计算器”要算钱，整块留 WIDGET 占位；JSON 里 `kind` 为 `script` 的条目属于这个计算器，不用放进模板，在交付说明里说明即可。"""),
    ("D20", "Research-Ville", """\
- 研究层第一页（Ville 不等式），面向专业读者。公式照抄，不要改写符号；图里的曲线照设计稿的坐标画，涉及的数值列为“数字”。
- 页面外壳同样用 `Chapter`。页脚默认链到研究层（就是本页），改成 `footerPage="Research-Detector"`，`footerLabel` 用 JSON 里提到“公平检测器”的那一条；没有合适的就在交付说明里提“疑问”。"""),
]

KIT_FILES = [
    "src/i18n/routes.ts",
    "src/i18n/page.ts",
    "src/i18n/site.ts",
    "src/components/chapter/Chapter.astro",
    "src/components/chapter/Hero.astro",
    "src/components/chapter/Step.astro",
    "src/components/chapter/Deeper.astro",
    "src/components/chapter/NextChapter.astro",
    "src/components/chapter/Pending.astro",
    "src/components/chapter/Predict.tsx",
    "src/components/chapter/chapter.css",
]

EXTRA_DATA = {"Ending": ["data/helplines.json"], "Part2-Scam": ["data/helplines.json"]}


def clean_design(path: Path) -> str:
    """去掉与排版无关的噪音：外部字体、运行时脚本"""
    s = path.read_text(encoding="utf-8")
    s = s.replace('<script src="./support.js"></script>\n', "")
    s = re.sub(r'<link href="https://fonts\.googleapis\.com[^>]*>\n?', "", s)
    return s


def fence(lang: str, body: str) -> str:
    ticks = "````" if "```" in body else "```"
    return f"{ticks}{lang}\n{body.rstrip()}\n{ticks}\n"


def copy_table(json_path: Path) -> str:
    data = json.loads(json_path.read_text(encoding="utf-8"))
    rows = ["| 编号 | 类型 | 标签 | zh | en | 备注 |", "|---|---|---|---|---|---|"]
    for e in data["strings"]:
        note = e.get("note") or ""
        note = note if "移植" in note else ""
        cells = [e["id"], e["kind"], e["context"], e["zh"], e["en"], note]
        rows.append("| " + " | ".join(c.replace("|", "\\|").replace("\n", " ") for c in cells) + " |")
    return "\n".join(rows) + "\n"


def view_name(page: str) -> str:
    return page.replace("-", "")


def bundle(code: str, page: str, notes: str) -> str:
    name = view_name(page)
    parts = [
        f"# {code} 静态页面移植：{page}\n",
        "你在给开源公益项目「概率的游戏 / Long Run Lab」写网站页面（Astro 5 + Preact + TypeScript）。"
        f"任务：把设计稿 `preview/{page}.dc.html` 移植成 `src/views/{name}.astro`，一个模板同时渲染中英文。\n",
        "你不能运行代码，所以请严格照着样板（第 3 章）的写法，宁可朴素，也不要发明新的写法。"
        "写完后 Claude 会负责构建、测试和对照截图。\n",
        "## 本页特别说明\n",
        notes + "\n",
        "## 移植规范（docs/STATIC_PORTING.md）\n",
        re.sub(r"^## ", "### ", (ROOT / "docs/STATIC_PORTING.md").read_text(encoding="utf-8").split("\n", 1)[1], flags=re.M) + "\n",
        "## 框架代码（只读，照着用）\n",
    ]
    for f in KIT_FILES:
        lang = {"ts": "ts", "tsx": "tsx", "astro": "astro", "css": "css"}[f.rsplit(".", 1)[1]]
        parts.append(f"### `{f}`\n")
        parts.append(fence(lang, (ROOT / f).read_text(encoding="utf-8")))
    parts += [
        "## 样板：第 3 章\n",
        "先看设计稿，再看成品，对照着理解每一段是怎么换成框架写法的。"
        "注意：样板里的“押大一点”折线图由 Claude 接到了引擎上（`chart`），你的页面里图照设计稿坐标画即可，数字列进交付说明。\n",
        "### 设计稿 `preview/Ch3-Ruin.dc.html`\n",
        fence("html", clean_design(ROOT / "preview/Ch3-Ruin.dc.html")),
        "### 成品 `src/views/Ch3Ruin.astro`\n",
        fence("astro", (ROOT / "src/views/Ch3Ruin.astro").read_text(encoding="utf-8")),
        f"## 本页设计稿 `preview/{page}.dc.html`\n",
        fence("html", clean_design(ROOT / f"preview/{page}.dc.html")),
        f"## 本页文案表 `i18n/source/{page}.json`\n",
        f"`t(n)` 的 n 就是编号后三位（`{page}.012` → `t(12)`）。备注栏只收录了和移植有关的 note。\n\n",
        copy_table(ROOT / f"i18n/source/{page}.json"),
        "\n## 公共文案 `i18n/source/common.json`（用 `t('common.029')` 这样的写法）\n\n",
        copy_table(ROOT / "i18n/source/common.json"),
    ]
    for extra in EXTRA_DATA.get(page, []):
        parts += [f"\n## 附加数据 `{extra}`\n", fence("json", (ROOT / extra).read_text(encoding="utf-8"))]
    parts += [
        "\n## 交付（再强调一次）\n",
        f"1. 一个代码块，内容是完整的 `src/views/{name}.astro`，frontmatter 第一行写 `// src/views/{name}.astro`。\n",
        "2. 如果写了纯界面小组件，每个一个代码块，第一行注释写路径。\n",
        "3. 交付说明表：类型（答案 / WIDGET / 数字 / 改动 / 疑问）| 位置 | 内容 | 说明。\n",
        "4. 规范第 6 条的自查清单，逐条打勾。\n",
    ]
    return "".join(parts)


def main(only: list[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for code, page, notes in TASKS:
        if only and page not in only:
            continue
        text = bundle(code, page, notes)
        path = OUT / f"{code}-{page}.md"
        # 标题后补一个空行，Markdown 渲染更稳（代码块里没有以“# ”开头的行）
        text = re.sub(r"^(#{1,3} .*)\n(?!\n)", r"\1\n\n", text, flags=re.M)
        path.write_text(text, encoding="utf-8")
        print(f"{path.relative_to(ROOT)}  {len(text):,} 字符")


if __name__ == "__main__":
    main(sys.argv[1:])
