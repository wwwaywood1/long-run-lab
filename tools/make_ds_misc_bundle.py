"""
为 DeepSeek 生成杂项任务包：D30（404 页）、D31a–c（全站英文通读）。

运行：python3 tools/make_ds_misc_bundle.py            # 生成全部
      python3 tools/make_ds_misc_bundle.py D31b       # 只生成一个
输出：handoff/deepseek/<编号>-<名字>.md（handoff/ 不进仓库）
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_ds_bundle import ROOT, OUT, fence  # noqa: E402


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def block(path: str, name: str) -> str:
    """取出文件里 `const NAME …` 那一整段（按花括号配对），用来只给出文案字典而不是整个组件"""
    s = read(path)
    m = re.search(rf"^(export )?const {re.escape(name)}\b", s, re.M)
    if not m:
        raise SystemExit(f"{path}: {name} not found")
    eq = re.compile(r"=\s*\{").search(s, m.end())  # 跳过类型注解里的花括号，从赋值的 { 开始配对
    i = eq.end() - 1
    depth = 0
    for j in range(i, len(s)):
        if s[j] == "{":
            depth += 1
        elif s[j] == "}":
            depth -= 1
            if depth == 0:
                end = s.index("\n", j) if "\n" in s[j:] else len(s)
                return s[m.start():end]
    raise SystemExit(f"{path}: unbalanced braces in {name}")


def copy_rows(page: str) -> str:
    data = json.loads(read(f"i18n/source/{page}.json"))
    rows = ["| 编号 | 中文 | 英文 |", "|---|---|---|"]
    for e in data["strings"]:
        cells = [e["id"], e["zh"], e["en"]]
        rows.append("| " + " | ".join(c.replace("|", "\\|").replace("\n", " ") for c in cells) + " |")
    return "\n".join(rows) + "\n"


# ---------------------------------------------------------------- D30 404 页
D30 = """\
# D30 404 页（找不到页面）

你在给开源公益项目「概率的游戏 / Long Run Lab」写网站（Astro 5 + Preact + TypeScript，中英双语）。网站部署在 GitHub Pages 的 `https://wwwaywood1.github.io/long-run-lab/` 下。读者打开一个不存在的地址时，GitHub Pages 会显示站点根目录的 `404.html`。现在这个页面不存在，读者看到的是 GitHub 自带的错误页。

你不能运行代码，请照下面给出的现成写法来写，宁可朴素。写完后 Claude 负责构建、截图和验收。

## 要做什么

新建 `src/pages/404.astro`（Astro 会生成 `dist/404.html`）：

1. **一页同时给中英文**。404 页只有一个，没法按地址分语言，所以页面上中文在前、英文在后，各自一小段。外层用 `Base` 布局，`locale="zh"`，`altHref` 指向英文首页。英文那一段的容器加 `lang="en"`，读屏软件才会用英文读。
2. **内容**（文字是新文案，请你起草，中英文都要，交付说明里列为 NEW COPY 由 Claude 审定）：
   - 一个醒目的大标题。可以借轮盘的意象：美式轮盘上 0 和 00 是“谁也押不中”的格子。但要一眼看懂这是“页面不存在”，不要为了俏皮牺牲清楚。
   - 一句说明：地址可能打错了，或者页面挪走了。
   - 两个链接：回到首页、去赌场大厅（中文段链中文页，英文段链英文页）。链接用 `pageHref(locale, 'Home')`、`pageHref(locale, 'Casino')`（`src/i18n/routes.ts`）。
3. **样式**：沿用全站的变量和类名（`hero`、`display`、`lede`、`eyebrow`、`btn btn-primary`、`btn btn-outline` 等，见 `global.css`）。页面内新加的类名用 `nf-` 前缀，写在页面的 `<style>` 里。390px 宽度下不能横向溢出。
4. **不做**：不放统计数字，不放任何概率或金额，不放图片。页面标题（`<title>`）用“页面不存在 / Page not found”。
5. `<head>` 里加 `<meta name="robots" content="noindex">`，不让搜索引擎收录。如果 `Base` 没有地方放，就在交付说明里写“疑问”，由 Claude 给 `Base` 加一个参数。

## 交付

1. 完整的 `src/pages/404.astro`，一个代码块，第一行注释写路径。
2. 交付说明表：类型（NEW COPY / 改动 / 疑问）| 位置 | 内容 | 说明。NEW COPY 写出中英文全文。
3. 自查：英文段没有中文；中文用简体；链接都用 `pageHref`；没有内联颜色值；可点区域不小于 44px。

## 相关代码
"""

D30_FILES = ["src/layouts/Base.astro", "src/i18n/routes.ts", "src/i18n/site.ts", "src/styles/global.css", "src/styles/tokens.css", "src/components/chapter/Hero.astro", "astro.config.mjs"]


# ---------------------------------------------------------------- D31 英文通读
D31_HEAD = """\
# {code} 全站英文通读（{part}）

你在审读开源公益项目「概率的游戏 / Long Run Lab」的英文版。网站用可玩的模拟讲“久赌必输”，面向普通读者。中文是原文，英文已经翻译、校对过一轮。

**这一轮只找一件事：英文母语读者读着别扭的地方。** 包括：
- 翻译腔、中式英语、不自然的搭配；
- 语气不对（说教、夸张、太口语或太书面）；
- 同一个概念前后用了不同的词，和术语表不一致；
- 语法、标点、大小写错误（标题用 sentence case；用美式英语）；
- 英文意思和中文不一致（漏译、错译、多译）。

**规则**
1. **不要改数字**，也不要改 `{{{{占位符}}}}`、`<br>`、`<strong>` 之类的标签和 `${{…}}` 模板变量。句子里的数字由程序核对，改了会报错。
2. 改动要克制：没问题的条目不用列。宁可少列，不要为了改而改。
3. 遵守下面的翻译规范和术语表。货币规则见规范第 5 条。
4. 每一条都要写理由。拿不准的放进“存疑”，不要硬改。

**交付格式**：一张表，按严重程度排序。

| 编号 | 现在的英文 | 建议改成 | 严重程度（必须改 / 建议改 / 存疑） | 理由 |

编号就是表里的“编号”列（例如 `Ch2-LLN.017`）；组件里的文案写“文件名 · 键名”（例如 `MartingaleLab · rules.double`）。

## 翻译规范（docs/TRANSLATION.md）

{translation}

## 术语表（i18n/glossary.csv）

{glossary}
"""

D31_GROUPS = {
    "D31a": ("章节、大厅与研究层", ["common", "Home", "Prologue", "Ch1-EV", "Ch2-LLN", "Ch3-Ruin", "Ch4-Martingale", "Part2-Roulette", "Part2-Scam", "Part3-Psych", "Part4-RealWorld", "Ending", "Casino", "Research-Ville", "Research-Detector"]),
    "D31b": ("十个赌场游戏", ["RouletteLab", "SicBo", "Baccarat", "Slots", "Crash", "Blackjack", "Lottery", "Scratch", "Gacha", "Sports"]),
}

# 不在 JSON 里、直接写在组件里的英文（新文案、模板）
D31C_BLOCKS = [
    ("src/i18n/site.ts", "SITE"),
    ("src/i18n/ui.ts", "UI"),
    ("src/components/widgets/RuinCalculator.tsx", "ENDS_AFTER"),
    ("src/components/widgets/HouseCalculator.tsx", "NEW_COPY"),
    ("src/components/widgets/HouseLedger.tsx", "LEDGER_COPY"),
    ("src/components/widgets/Ch2Sim.tsx", "NEW_COPY"),
    ("src/components/widgets/MartingaleLab.tsx", "AXIS"),
    ("src/components/widgets/MartingaleLab.tsx", "LAB_COPY"),
    ("src/components/widgets/PayoutBreakdown.tsx", "MULTIPLIER"),
    ("src/components/widgets/PayoutBreakdown.tsx", "SHORTFALL"),
    ("src/components/widgets/SequenceDetector.tsx", "COPY"),
    ("src/components/widgets/TurnoverLedger.tsx", "TIMES"),
    ("src/components/widgets/ShareActions.tsx", "SHARE_UI"),
    ("src/components/widgets/HelpTabs.tsx", "VERIFIED"),
    ("src/views/Part3Psych.astro", "screen"),
]


def helplines_en() -> str:
    data = json.loads(read("data/helplines.json"))
    rows = ["| 位置 | 中文 | 英文 |", "|---|---|---|"]
    for key, region in data["regions"].items():
        rows.append(f"| {key} · label | {region['label']['zh']} | {region['label']['en']} |")
        if region.get("note"):
            rows.append(f"| {key} · note | {region['note']['zh']} | {region['note']['en']} |")
        for group in ("help", "fraud"):
            for i, e in enumerate(region.get(group, [])):
                for field in ("name", "detail", "contact"):
                    v = e.get(field)
                    if isinstance(v, dict):
                        rows.append(f"| {key} · {group}[{i}] · {field} | {v['zh']} | {v['en']} |")
    return "\n".join(rows) + "\n"


def d31(code: str) -> str:
    head = D31_HEAD.format(code=code, part=D31_GROUPS[code][0] if code in D31_GROUPS else "组件里的新文案与求助渠道",
                           translation=re.sub(r"^#+ ", "### ", read("docs/TRANSLATION.md").split("\n", 1)[1], flags=re.M),
                           glossary=fence("csv", read("i18n/glossary.csv")))
    parts = [head]
    if code in D31_GROUPS:
        for page in D31_GROUPS[code][1]:
            parts += [f"\n## `{page}`\n\n", copy_rows(page)]
    else:
        parts.append("\n## 组件里的文案\n\n下面是直接写在组件里的中英文字典（新文案和带数字的模板）。只看英文，代码本身不用管。`${…}` 是程序填进去的数字或词。\n\n")
        for path, name in D31C_BLOCKS:
            lang = "ts" if path.endswith((".ts", ".tsx")) else "astro"
            parts += [f"### `{Path(path).name}` · `{name}`\n", fence(lang, block(path, name))]
        parts += ["\n## 求助渠道（data/helplines.json）\n\n", helplines_en()]
    return "".join(parts)


def d30() -> str:
    parts = [D30]
    for f in D30_FILES:
        lang = {"ts": "ts", "astro": "astro", "css": "css", "mjs": "js"}[f.rsplit(".", 1)[1]]
        parts += [f"### `{f}`\n", fence(lang, read(f))]
    return "".join(parts)


TASKS = {"D30": ("NotFound", d30), "D31a": ("EN-Chapters", lambda: d31("D31a")),
         "D31b": ("EN-Games", lambda: d31("D31b")), "D31c": ("EN-Components", lambda: d31("D31c"))}


def main(only: list[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for code, (name, make) in TASKS.items():
        if only and code not in only:
            continue
        text = re.sub(r"^(#{1,3} .*)\n(?!\n)", r"\1\n\n", make(), flags=re.M)
        path = OUT / f"{code}-{name}.md"
        path.write_text(text, encoding="utf-8")
        print(f"{path.relative_to(ROOT)}  {len(text):,} 字符")


if __name__ == "__main__":
    main(sys.argv[1:])
