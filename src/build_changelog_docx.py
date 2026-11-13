"""Turn CHANGELOG.md into a Word file (data/changelog.docx): the summary table, then the details.

Usage: python src/build_changelog_docx.py
"""
import re
from datetime import datetime, timezone
from pathlib import Path

from docx import Document
from docx.shared import Pt

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "CHANGELOG.md"
OUT = ROOT / "data" / "changelog.docx"


def inline(par, text):
    """Add text to a paragraph, rendering **bold**, *italic* and `code` simply."""
    for tok in re.split(r"(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)", text):
        if not tok:
            continue
        if tok.startswith("**"):
            par.add_run(tok[2:-2]).bold = True
        elif tok.startswith("*"):
            par.add_run(tok[1:-1]).italic = True
        elif tok.startswith("`"):
            par.add_run(tok[1:-1]).font.name = "Consolas"
        else:
            par.add_run(tok)


def main():
    lines = SRC.read_text(encoding="utf-8").splitlines()
    doc = Document()
    doc.styles["Normal"].font.size = Pt(10)
    doc.add_heading("EU Energy Markets Dashboard — change log", 0)
    doc.add_paragraph(f"Generated from CHANGELOG.md on {datetime.now(timezone.utc):%d %B %Y}.")
    i, bullet = 0, None
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("# "):
            i += 1
            continue
        if ln.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip("|").split("|")]
                if not all(set(c) <= {"-", ":"} for c in cells):
                    rows.append(cells)
                i += 1
            t = doc.add_table(rows=0, cols=len(rows[0]))
            t.style = "Light Grid Accent 1"
            for r_i, r in enumerate(rows):
                cells = t.add_row().cells
                for c, v in zip(cells, r):
                    c.text = ""
                    inline(c.paragraphs[0], v)
                    if r_i == 0:
                        for run in c.paragraphs[0].runs:
                            run.bold = True
            continue
        if ln.startswith("### "):
            doc.add_heading(ln[4:], 2)
            bullet = None
        elif ln.startswith("## "):
            doc.add_heading(ln[3:], 1)
            bullet = None
        elif ln.startswith("- "):
            bullet = doc.add_paragraph(style="List Bullet")
            inline(bullet, ln[2:])
        elif ln.startswith("  ") and bullet is not None and ln.strip():
            inline(bullet, " " + ln.strip())
        elif ln.strip():
            inline(doc.add_paragraph(), ln)
            bullet = None
        else:
            bullet = None
        i += 1
    doc.save(OUT)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
