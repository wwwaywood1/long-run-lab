"""
从 preview/*.dc.html 设计稿中抽取中文文案，生成翻译用的 JSON。

运行：python3 tools/extract_copy.py
输出：i18n/source/<Page>.json 与 i18n/source/common.json

每条文案：
  id       页面内唯一编号，如 "SicBo.012"
  kind     text（可见文字）/ attr:aria-label 等（无障碍文字）/ script（交互时动态出现的文字）
  context  所在标签，帮助判断语气和长度
  zh       中文原文（保留 {{占位符}}、<br> 换行标记）
  en       英文译文，由翻译者填写
  note     译者备注（可选）

规则：在 5 个以上页面重复出现的文字（页眉、页脚等）放进 common.json，只翻译一次。

重新运行是安全的：已有译文和编号会保留，改过的中文会在 note 里标 ZH CHANGED（见 merge()）。
"""

from __future__ import annotations

import json
import re
from collections import Counter
from difflib import SequenceMatcher
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "preview"
OUT = ROOT / "i18n" / "source"
SKIP_PAGES = {"Main", "EN-Ch2-LLN"}  # 视觉规范页、已是英文的页面
CJK = re.compile(r"[㐀-鿿！-～“”‘’、。《》【】]")
ATTRS = ("aria-label", "alt", "title", "placeholder")
SCRIPT_STR = re.compile(r"'((?:[^'\\\n]|\\.)*)'")
INLINE = {"span", "em", "strong", "sub", "sup", "mark", "a"}
FLOW = {"p", "h1", "h2", "h3", "h4", "li", "summary", "label", "title"}


class CopyParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack: list[str] = []
        self.skip = 0
        self.items: list[dict] = []
        self.buf: list[str] = []
        self.buf_ctx = ""

    def flush(self):
        text = re.sub(r"\s+", " ", "".join(self.buf)).strip()
        if text and CJK.search(text):
            self.items.append({"kind": "text", "context": self.buf_ctx, "zh": text})
        self.buf = []

    def handle_starttag(self, tag, attrs):
        if tag in ("style", "script", "helmet"):
            self.skip += 1
        if tag == "br":
            self.buf.append("<br>")
            return
        # 段落、标题里的行内元素（span/em/sub…）并入当前句子；
        # 其余位置（弹性布局里的 span、按钮里的 span）各自成段
        inline = tag in INLINE and self.flow_parent() is not None
        if not inline:
            self.flush()
            self.buf_ctx = tag
        elif not self.buf:
            self.buf_ctx = self.flow_parent() or tag
        for k, v in attrs:
            if k in ATTRS and v and CJK.search(v) and not self.skip:
                self.items.append({"kind": f"attr:{k}", "context": tag, "zh": v.strip()})
        if tag not in ("meta", "link", "input", "img", "hr", "br", "path", "line", "circle", "rect"):
            self.stack.append(tag)

    def flow_parent(self):
        """最近的非行内祖先若是文字段落类标签，返回它；否则返回 None"""
        for t in reversed(self.stack):
            if t in INLINE:
                continue
            return t if t in FLOW else None
        return None

    def handle_endtag(self, tag):
        if tag in ("style", "script", "helmet"):
            self.skip = max(0, self.skip - 1)
        if self.stack and self.stack[-1] == tag:
            self.stack.pop()
        if not (tag in INLINE and self.flow_parent() is not None):
            self.flush()

    def handle_data(self, data):
        if not self.skip:
            self.buf.append(data)


def extract(path: Path) -> list[dict]:
    html = path.read_text(encoding="utf-8")
    markup, _, script = html.partition('<script type="text/x-dc"')
    p = CopyParser()
    p.feed(markup)
    p.flush()
    items = p.items
    for line in script.splitlines():
        frags = [m.group(1) for m in SCRIPT_STR.finditer(line) if CJK.search(m.group(1))]
        for s in frags:
            # 动态拼接的句子：把整行代码作为上下文，请译者整句翻译
            ctx = line.strip()[:220] if len(frags) > 1 or "+" in line else "js"
            items.append({"kind": "script", "context": ctx, "zh": s})
    # 页面内去重，保留首次出现的顺序
    seen, out = set(), []
    for it in items:
        key = (it["kind"], it["zh"])
        if key not in seen:
            seen.add(key)
            out.append(it)
    return out


CHANGED = "ZH CHANGED — update en. Old zh: "
FIELDS = ("id", "kind", "context", "zh", "en", "note")


def merge(name: str, items: list[dict]) -> tuple[list[dict], dict]:
    """与已有的 i18n/source/<name>.json 合并：
    - 中文没变的条目保留原 id、en、note（上下文变了也照样保留，只更新 context）；
    - 中文改过的条目（同 kind、相似度 ≥ 0.6）沿用原 id 和旧译文，note 开头标 ZH CHANGED，提醒译者更新；
    - 全新的条目接着最大编号往后排，en 留空；
    - 设计稿里已删掉的条目从 JSON 里移除。
    这样重新抽取不会打乱编号，也不会冲掉已有译文。"""
    path = OUT / f"{name}.json"
    existing = json.loads(path.read_text(encoding="utf-8"))["strings"] if path.exists() else []
    by_key = {(e["kind"], e["zh"]): e for e in existing}
    used: set[str] = set()
    out, pending = [], []
    for it in items:
        e = by_key.get((it["kind"], it["zh"]))
        if e and e["id"] not in used:
            used.add(e["id"])
            out.append({**it, "id": e["id"], "en": e["en"], "note": e["note"]})
        else:
            row = {**it, "id": None, "en": "", "note": ""}
            out.append(row)
            pending.append(row)
    removed = [e for e in existing if e["id"] not in used]
    changed = 0
    for row in pending:
        cands = [(SequenceMatcher(None, e["zh"], row["zh"]).ratio(), e) for e in removed if e["kind"] == row["kind"]]
        score, e = max(cands, default=(0.0, None), key=lambda c: c[0])
        if e is not None and score >= 0.6:
            removed.remove(e)
            changed += 1
            old_note = e["note"].removeprefix(CHANGED) if e["note"].startswith(CHANGED) else e["note"]
            row.update(id=e["id"], en=e["en"], note=(CHANGED + e["zh"] + (" | " + old_note if old_note else "")) if e["en"] else old_note)
    nums = [int(e["id"].rsplit(".", 1)[1]) for e in existing] or [0]
    nxt = max(nums) + 1
    new = 0
    for row in out:
        if row["id"] is None:
            row["id"] = f"{name}.{nxt:03d}"
            nxt += 1
            new += 1
    stats = {"kept": len(used), "changed": changed, "new": new, "removed": len(removed)}
    return [{k: r[k] for k in FIELDS} for r in out], stats


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    pages = {p.name.removesuffix(".dc.html"): extract(p) for p in sorted(SRC.glob("*.dc.html")) if p.name.removesuffix(".dc.html") not in SKIP_PAGES}
    freq = Counter(it["zh"] for items in pages.values() for it in {x["zh"]: x for x in items}.values())
    common_set = {s for s, c in freq.items() if c >= 5}
    common = []
    total = 0
    for name, items in pages.items():
        own = []
        for it in items:
            if it["zh"] in common_set:
                if it["zh"] not in [c["zh"] for c in common]:
                    common.append({**it})
                continue
            own.append(it)
        rows, st = merge(name, own)
        total += len(rows)
        if st["changed"] or st["new"] or st["removed"]:
            print(f"  {name}: {st}")
        doc = {"page": name, "source": f"preview/{name}.dc.html", "strings": rows}
        (OUT / f"{name}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    rows, st = merge("common", common)
    if st["changed"] or st["new"] or st["removed"]:
        print(f"  common: {st}")
    (OUT / "common.json").write_text(
        json.dumps({"page": "common", "source": "多个页面共用", "strings": rows}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    chars = sum(len(it["zh"]) for items in pages.values() for it in items)
    print(f"{len(pages)} pages, {total} page strings, {len(common)} common strings, ~{chars} CJK chars")


if __name__ == "__main__":
    main()
