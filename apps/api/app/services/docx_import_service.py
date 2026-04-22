from __future__ import annotations

import re
import uuid
import zipfile
from dataclasses import dataclass
from io import BytesIO
from typing import Any
from xml.etree import ElementTree as ET


WORD_NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
}


@dataclass(frozen=True)
class ImportedDocx:
    title: str
    content_json: dict[str, Any]
    plain_text: str


@dataclass(frozen=True)
class ParsedParagraph:
    text: str
    block_type: str
    level: int = 1
    ordered: bool = False
    title_candidate: bool = False


def _text_node(text: str) -> dict[str, str]:
    return {"type": "text", "text": text}


def _block_attrs(raw_text: str, **extra: Any) -> dict[str, Any]:
    attrs: dict[str, Any] = {"block_id": str(uuid.uuid4()), "raw_text": raw_text}
    attrs.update(extra)
    return attrs


def _paragraph(text: str) -> dict[str, Any]:
    return {"type": "paragraph", "attrs": _block_attrs(text), "content": [_text_node(text)] if text else []}


def _heading(level: int, text: str) -> dict[str, Any]:
    return {
        "type": "heading",
        "attrs": _block_attrs(text, level=max(1, min(level, 6))),
        "content": [_text_node(text)] if text else [],
    }


def _title_blocks(text: str) -> list[dict[str, Any]]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return [_paragraph(text)]
    blocks = [_heading(1, lines[0])]
    blocks.extend(_paragraph(line) for line in lines[1:])
    return blocks


def _list_node(node_type: str, items: list[str], ordered: bool) -> dict[str, Any]:
    children = [
        {
            "type": "list_item",
            "attrs": _block_attrs(item),
            "content": [_text_node(item)] if item else [],
        }
        for item in items
    ]
    return {
        "type": node_type,
        "attrs": {"block_id": str(uuid.uuid4()), "ordered": ordered},
        "content": children,
    }


def _code_block(text: str, language: str = "") -> dict[str, Any]:
    return {
        "type": "code_block",
        "attrs": _block_attrs(text, language=language),
        "content": [_text_node(text)] if text else [],
    }


def _element_attr(element: ET.Element | None, name: str) -> str:
    if element is None:
        return ""
    return element.attrib.get(f"{{{WORD_NS['w']}}}{name}", "")


def _load_style_names(zip_file: zipfile.ZipFile) -> dict[str, str]:
    try:
        raw_styles = zip_file.read("word/styles.xml")
    except KeyError:
        return {}
    root = ET.fromstring(raw_styles)
    styles: dict[str, str] = {}
    for style in root.findall(".//w:style", WORD_NS):
        style_id = _element_attr(style, "styleId")
        name_node = style.find("w:name", WORD_NS)
        style_name = _element_attr(name_node, "val")
        if style_id:
            styles[style_id] = style_name or style_id
    return styles


def _load_number_formats(zip_file: zipfile.ZipFile) -> dict[str, str]:
    try:
        raw_numbering = zip_file.read("word/numbering.xml")
    except KeyError:
        return {}
    root = ET.fromstring(raw_numbering)
    abstract_formats: dict[tuple[str, str], str] = {}
    for abstract_num in root.findall(".//w:abstractNum", WORD_NS):
        abstract_id = _element_attr(abstract_num, "abstractNumId")
        for level in abstract_num.findall("w:lvl", WORD_NS):
            ilvl = _element_attr(level, "ilvl") or "0"
            num_fmt = level.find("w:numFmt", WORD_NS)
            fmt = _element_attr(num_fmt, "val") or "bullet"
            abstract_formats[(abstract_id, ilvl)] = fmt

    num_to_abstract: dict[str, str] = {}
    for num in root.findall(".//w:num", WORD_NS):
        num_id = _element_attr(num, "numId")
        abstract = num.find("w:abstractNumId", WORD_NS)
        abstract_id = _element_attr(abstract, "val")
        if num_id and abstract_id:
            num_to_abstract[num_id] = abstract_id

    formats: dict[str, str] = {}
    for num_id, abstract_id in num_to_abstract.items():
        fmt = abstract_formats.get((abstract_id, "0")) or "bullet"
        formats[num_id] = fmt
    return formats


def _paragraph_text(paragraph: ET.Element) -> str:
    parts: list[str] = []
    for node in paragraph.iter():
        tag = node.tag.rsplit("}", 1)[-1]
        if tag == "t" and node.text:
            parts.append(node.text)
        elif tag == "tab":
            parts.append("\t")
        elif tag in {"br", "cr"}:
            parts.append("\n")
    return "".join(parts).strip()


def _paragraph_text_preserve_space(paragraph: ET.Element) -> str:
    parts: list[str] = []
    for node in paragraph.iter():
        tag = node.tag.rsplit("}", 1)[-1]
        if tag == "t" and node.text:
            parts.append(node.text)
        elif tag == "tab":
            parts.append("\t")
        elif tag in {"br", "cr"}:
            parts.append("\n")
    return "".join(parts)


def _paragraph_style(paragraph: ET.Element, style_names: dict[str, str]) -> str:
    p_style = paragraph.find("./w:pPr/w:pStyle", WORD_NS)
    style_id = _element_attr(p_style, "val")
    return style_names.get(style_id, style_id)


def _heading_level(style_name: str) -> int | None:
    normalized = style_name.replace(" ", "").lower()
    match = re.search(r"heading([1-6])$", normalized)
    if match:
        return int(match.group(1))
    match = re.search(r"标题([1-6])$", style_name)
    if match:
        return int(match.group(1))
    return None


def _list_format(paragraph: ET.Element, number_formats: dict[str, str]) -> str | None:
    num_id_node = paragraph.find("./w:pPr/w:numPr/w:numId", WORD_NS)
    num_id = _element_attr(num_id_node, "val")
    if not num_id:
        return None
    return number_formats.get(num_id, "bullet")


def _detect_text_list(text: str) -> tuple[str, bool] | None:
    stripped = text.strip()
    if not stripped:
        return None

    bullet_match = re.match(r"^[•·●○▪▫\-*]\s+(.+)$", stripped)
    if bullet_match:
        return bullet_match.group(1).strip(), False

    ordered_match = re.match(r"^\d+[.)、]\s+(.+)$", stripped)
    if ordered_match:
        return ordered_match.group(1).strip(), True

    return None


def _parse_paragraph(
    paragraph: ET.Element,
    style_names: dict[str, str],
    number_formats: dict[str, str],
    *,
    title_candidate: bool = False,
) -> ParsedParagraph | None:
    text = _paragraph_text(paragraph)
    if not text:
        return None

    list_fmt = _list_format(paragraph, number_formats)
    if list_fmt:
        ordered = list_fmt not in {"bullet", "none"}
        return ParsedParagraph(text=text, block_type="list", ordered=ordered)

    level = _heading_level(_paragraph_style(paragraph, style_names))
    if level is not None:
        return ParsedParagraph(text=text, block_type="heading", level=level)

    text_list = _detect_text_list(text)
    if text_list is not None:
        item_text, ordered = text_list
        return ParsedParagraph(text=item_text, block_type="list", ordered=ordered)

    return ParsedParagraph(text=text, block_type="paragraph", title_candidate=title_candidate)


def _table_text(table: ET.Element) -> str:
    rows: list[list[str]] = []
    for row in table.findall("./w:tr", WORD_NS):
        cells: list[str] = []
        for cell in row.findall("./w:tc", WORD_NS):
            paragraphs: list[str] = []
            for paragraph in cell.findall("./w:p", WORD_NS):
                paragraph_text = re.sub(r"\s+", " ", _paragraph_text_preserve_space(paragraph)).strip()
                if paragraph_text:
                    paragraphs.append(paragraph_text)
            cells.append(" / ".join(paragraphs).strip())
        if any(cell.strip() for cell in cells):
            rows.append(cells)

    if not rows:
        return ""

    column_count = max(len(row) for row in rows)
    normalized_rows = [row + [""] * (column_count - len(row)) for row in rows]
    widths = [
        max(len(row[column_index]) for row in normalized_rows)
        for column_index in range(column_count)
    ]

    rendered_rows: list[str] = []
    for row in normalized_rows:
        rendered_rows.append(
            " | ".join(cell.ljust(widths[index]) for index, cell in enumerate(row)).rstrip()
        )
    return "\n".join(rendered_rows)


def _parse_body_blocks(zip_file: zipfile.ZipFile) -> list[ParsedParagraph]:
    try:
        raw_document = zip_file.read("word/document.xml")
    except KeyError as exc:
        raise ValueError("Invalid DOCX file") from exc

    style_names = _load_style_names(zip_file)
    number_formats = _load_number_formats(zip_file)
    root = ET.fromstring(raw_document)
    body = root.find(".//w:body", WORD_NS)
    if body is None:
        return []

    blocks: list[ParsedParagraph] = []
    seen_content = False
    for child in list(body):
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            parsed = _parse_paragraph(child, style_names, number_formats, title_candidate=not seen_content)
            if parsed is not None:
                blocks.append(parsed)
                seen_content = True
            continue
        if tag == "tbl":
            table_text = _table_text(child)
            if table_text:
                blocks.append(ParsedParagraph(text=table_text, block_type="code_block"))
                seen_content = True
    return blocks


def import_docx_content(file_bytes: bytes, fallback_title: str = "Imported DOCX") -> ImportedDocx:
    try:
        with zipfile.ZipFile(BytesIO(file_bytes)) as zip_file:
            paragraphs = _parse_body_blocks(zip_file)
    except zipfile.BadZipFile as exc:
        raise ValueError("Invalid DOCX file") from exc

    blocks: list[dict[str, Any]] = []
    plain_lines: list[str] = []
    list_items: list[str] = []
    list_ordered = False

    def flush_list() -> None:
        nonlocal list_items, list_ordered
        if list_items:
            blocks.append(_list_node("ordered_list" if list_ordered else "bullet_list", list_items, list_ordered))
        list_items = []
        list_ordered = False

    for paragraph in paragraphs:
        plain_lines.append(paragraph.text)
        if paragraph.block_type == "list":
            if list_items and list_ordered != paragraph.ordered:
                flush_list()
            list_ordered = paragraph.ordered
            list_items.append(paragraph.text)
            continue

        flush_list()
        if paragraph.block_type == "heading":
            blocks.append(_heading(paragraph.level, paragraph.text))
        elif paragraph.block_type == "code_block":
            blocks.append(_code_block(paragraph.text, language="table"))
        elif paragraph.title_candidate:
            blocks.extend(_title_blocks(paragraph.text))
        else:
            blocks.append(_paragraph(paragraph.text))
    flush_list()

    if not blocks:
        fallback = fallback_title.strip() or "Imported DOCX"
        blocks = [_heading(1, fallback), _paragraph("")]
        plain_lines = [fallback]

    title = next((item.text.splitlines()[0] for item in paragraphs if item.title_candidate and item.text.strip()), "")
    if not title:
        title = next((item.text.splitlines()[0] for item in paragraphs if item.block_type == "heading"), "")
    if not title:
        title = paragraphs[0].text if paragraphs else fallback_title
    title = (title.strip() or fallback_title or "Imported DOCX")[:255]
    plain_text = "\n".join(line for line in plain_lines if line.strip())
    return ImportedDocx(
        title=title,
        content_json={"type": "doc", "version": 1, "content": blocks},
        plain_text=plain_text,
    )
