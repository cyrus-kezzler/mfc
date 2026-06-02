#!/usr/bin/env python3
"""
One-shot markdown → PDF converter for the Speed Rail dogfood guide.

Not a general md→pdf tool — covers the markdown features actually used in
docs/erp-dogfood.md: H1/H2/H3, ordered lists (with nested sub-bullets),
unordered lists, fenced code blocks, inline `code`, **bold**, *italic*,
> blockquote, --- horizontal rules, and pipe-tables.

Usage:
    python3 scripts/erp/_md_to_pdf.py docs/erp-dogfood.md docs/erp-dogfood.pdf
"""

from __future__ import annotations

import re
import sys
from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Preformatted,
    HRFlowable,
    KeepTogether,
)


# ─── Styling ────────────────────────────────────────────────────────────────

INK = colors.HexColor("#1A1815")
INK_SOFT = colors.HexColor("#3B362E")
MUTED = colors.HexColor("#6B665D")
ACCENT = colors.HexColor("#7A5A2B")
RULE = colors.HexColor("#D9D2C5")
PAPER = colors.HexColor("#F5F1EA")
CODE_BG = colors.HexColor("#EDE7DA")
SERIF = "Times-Roman"
SERIF_B = "Times-Bold"
SERIF_I = "Times-Italic"
MONO = "Courier"

styles = getSampleStyleSheet()


def style(name: str, **kw) -> ParagraphStyle:
    if "parent" not in kw:
        kw["parent"] = styles["Normal"]
    return ParagraphStyle(name, **kw)


body = style("body", fontName=SERIF, fontSize=10.5, leading=15, textColor=INK,
             spaceBefore=0, spaceAfter=6)
h1 = style("h1", fontName=SERIF_B, fontSize=22, leading=26, textColor=INK,
           spaceBefore=0, spaceAfter=10)
h2 = style("h2", fontName=SERIF_B, fontSize=15, leading=19, textColor=INK,
           spaceBefore=14, spaceAfter=6)
h3 = style("h3", fontName=SERIF_B, fontSize=12, leading=16, textColor=INK,
           spaceBefore=10, spaceAfter=4)
li = style("li", fontName=SERIF, fontSize=10.5, leading=15, textColor=INK,
           leftIndent=14, spaceAfter=3)
sub_li = style("sub_li", parent=li, leftIndent=30, fontSize=10, leading=14,
               textColor=INK_SOFT)
quote = style("quote", fontName=SERIF_I, fontSize=10.5, leading=15,
              textColor=INK_SOFT, leftIndent=14, rightIndent=14,
              spaceBefore=4, spaceAfter=8)
code_style = style("code", fontName=MONO, fontSize=9, leading=12, textColor=INK,
                   leftIndent=10, rightIndent=10, backColor=CODE_BG,
                   borderPadding=(6, 8, 6, 8), spaceBefore=4, spaceAfter=8)
table_header = style("th", fontName=SERIF_B, fontSize=9.5, leading=13,
                     textColor=INK)
table_cell = style("td", fontName=SERIF, fontSize=9.5, leading=13,
                   textColor=INK)
caption = style("caption", fontName=SERIF_I, fontSize=9, leading=12,
                textColor=MUTED, spaceAfter=6)


# ─── Inline rendering ───────────────────────────────────────────────────────

# Order matters: code first (to protect inner content), then bold, then italic.
INLINE_CODE_RE = re.compile(r"`([^`]+)`")
BOLD_RE = re.compile(r"\*\*([^*]+)\*\*")
ITALIC_RE = re.compile(r"(?<![*\w])\*([^*\n]+)\*(?!\w)")
LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")


def render_inline(text: str) -> str:
    """Convert a markdown inline string to reportlab paragraph mini-XML."""
    # Protect inline code with placeholders so other regexes don't touch it.
    code_chunks: list[str] = []

    def stash_code(m: re.Match) -> str:
        code_chunks.append(m.group(1))
        return f"\x00{len(code_chunks)-1}\x00"

    text = INLINE_CODE_RE.sub(stash_code, text)
    # Now escape HTML entities so we can safely intermix with our tags.
    text = escape(text, quote=False)
    # Bold and italic — mini-XML.
    text = BOLD_RE.sub(r"<b>\1</b>", text)
    text = ITALIC_RE.sub(r"<i>\1</i>", text)
    # Links — show as "text (url)" plain, or use <a> tag.
    text = LINK_RE.sub(r'<a href="\2" color="#7A5A2B">\1</a>', text)
    # Restore code chunks with mono styling.
    def restore_code(m: re.Match) -> str:
        idx = int(m.group(1))
        return (
            f'<font name="{MONO}" size="9.5" backColor="#EDE7DA">'
            f"{escape(code_chunks[idx], quote=False)}"
            f"</font>"
        )

    text = re.sub(r"\x00(\d+)\x00", restore_code, text)
    return text


# ─── Block parser ───────────────────────────────────────────────────────────

ORDERED_RE = re.compile(r"^(\s*)(\d+)\.\s+(.*)$")
UNORDERED_RE = re.compile(r"^(\s*)[-*]\s+(.*)$")
HEADING_RE = re.compile(r"^(#{1,3})\s+(.*)$")
HR_RE = re.compile(r"^---+\s*$")
QUOTE_RE = re.compile(r"^>\s?(.*)$")
TABLE_ROW_RE = re.compile(r"^\|(.+)\|\s*$")
TABLE_DIVIDER_RE = re.compile(r"^\|[\s\-:|]+\|\s*$")


def parse(md: str) -> list:
    lines = md.splitlines()
    flowables: list = []
    i = 0
    while i < len(lines):
        line = lines[i]

        # Fenced code block.
        if line.lstrip().startswith("```"):
            i += 1
            buf: list[str] = []
            while i < len(lines) and not lines[i].lstrip().startswith("```"):
                buf.append(lines[i])
                i += 1
            i += 1  # skip closing ```
            flowables.append(Preformatted("\n".join(buf), code_style))
            continue

        # Horizontal rule.
        if HR_RE.match(line):
            flowables.append(Spacer(1, 6))
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=RULE,
                                        spaceBefore=2, spaceAfter=10))
            i += 1
            continue

        # Heading.
        m = HEADING_RE.match(line)
        if m:
            level = len(m.group(1))
            text = render_inline(m.group(2))
            target = {1: h1, 2: h2, 3: h3}[level]
            flowables.append(Paragraph(text, target))
            i += 1
            continue

        # Blockquote (single or multi-line).
        if QUOTE_RE.match(line):
            buf = []
            while i < len(lines) and QUOTE_RE.match(lines[i]):
                buf.append(QUOTE_RE.match(lines[i]).group(1))
                i += 1
            flowables.append(Paragraph(render_inline(" ".join(buf).strip()),
                                       quote))
            continue

        # Table.
        if TABLE_ROW_RE.match(line) and i + 1 < len(lines) \
                and TABLE_DIVIDER_RE.match(lines[i + 1]):
            header_cells = [c.strip() for c in line.strip().strip("|").split("|")]
            i += 2  # skip header + divider
            rows = []
            while i < len(lines) and TABLE_ROW_RE.match(lines[i]):
                rows.append([c.strip() for c in
                             lines[i].strip().strip("|").split("|")])
                i += 1
            flowables.append(_make_table(header_cells, rows))
            continue

        # Ordered or unordered list.
        m_ol = ORDERED_RE.match(line)
        m_ul = UNORDERED_RE.match(line)
        if m_ol or m_ul:
            buf_items: list[tuple[int, str, str]] = []  # (indent, marker, text)
            while i < len(lines):
                m_ol2 = ORDERED_RE.match(lines[i])
                m_ul2 = UNORDERED_RE.match(lines[i])
                if m_ol2:
                    indent = len(m_ol2.group(1))
                    buf_items.append((indent, m_ol2.group(2) + ".",
                                      m_ol2.group(3)))
                    i += 1
                elif m_ul2:
                    indent = len(m_ul2.group(1))
                    buf_items.append((indent, "•", m_ul2.group(2)))
                    i += 1
                elif lines[i].strip() == "":
                    # one blank line ends the list, two stay separated
                    if i + 1 < len(lines) and (ORDERED_RE.match(lines[i+1])
                                                or UNORDERED_RE.match(lines[i+1])):
                        i += 1
                        continue
                    break
                else:
                    # continuation line of previous list item — append to text
                    if buf_items:
                        ind, mk, prev = buf_items[-1]
                        buf_items[-1] = (ind, mk, prev + " " + lines[i].strip())
                        i += 1
                    else:
                        break
            for indent, marker, text in buf_items:
                target = sub_li if indent >= 3 else li
                flowables.append(
                    Paragraph(f"<b>{marker}</b>&nbsp; {render_inline(text)}",
                              target))
            flowables.append(Spacer(1, 4))
            continue

        # Blank line — small spacer.
        if line.strip() == "":
            flowables.append(Spacer(1, 4))
            i += 1
            continue

        # Paragraph: collect until blank line / structural marker.
        buf = [line]
        i += 1
        while i < len(lines) and lines[i].strip() != "" \
                and not HEADING_RE.match(lines[i]) \
                and not HR_RE.match(lines[i]) \
                and not ORDERED_RE.match(lines[i]) \
                and not UNORDERED_RE.match(lines[i]) \
                and not QUOTE_RE.match(lines[i]) \
                and not lines[i].lstrip().startswith("```") \
                and not TABLE_ROW_RE.match(lines[i]):
            buf.append(lines[i])
            i += 1
        text = " ".join(b.strip() for b in buf)
        flowables.append(Paragraph(render_inline(text), body))

    return flowables


def _make_table(header: list[str], rows: list[list[str]]):
    # Pad rows to header length defensively.
    width = len(header)
    rows = [r + [""] * (width - len(r)) for r in rows]
    data = [[Paragraph(render_inline(h), table_header) for h in header]]
    for r in rows:
        data.append([Paragraph(render_inline(c), table_cell) for c in r])

    # Auto column widths: give first column ~40% if there are 2 cols, else equal.
    page_w = A4[0] - 30 * mm * 2
    if width == 2:
        col_widths = [page_w * 0.4, page_w * 0.6]
    else:
        col_widths = [page_w / width] * width

    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 1.0, INK),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, INK),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, RULE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.transparent, PAPER]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return KeepTogether(t)


# ─── Page furniture ─────────────────────────────────────────────────────────

def _on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont(SERIF, 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(30 * mm, 12 * mm,
                      "Speed Rail · Back Bar ERP · dogfood")
    canvas.drawRightString(A4[0] - 30 * mm, 12 * mm, f"{doc.page}")
    canvas.restoreState()


def main(src: Path, dst: Path):
    md = src.read_text(encoding="utf-8")
    flowables = parse(md)

    doc = SimpleDocTemplate(
        str(dst), pagesize=A4,
        leftMargin=30 * mm, rightMargin=30 * mm,
        topMargin=22 * mm, bottomMargin=22 * mm,
        title="Speed Rail dogfood guide",
        author="Back Bar",
    )
    doc.build(flowables, onFirstPage=_on_page, onLaterPages=_on_page)
    print(f"✓ Wrote {dst}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(f"Usage: {sys.argv[0]} <input.md> <output.pdf>")
    main(Path(sys.argv[1]), Path(sys.argv[2]))
