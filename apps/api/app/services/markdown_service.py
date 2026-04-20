from __future__ import annotations

import re
import uuid
from typing import Any


def _text_node(text: str, marks: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    node: dict[str, Any] = {"type": "text", "text": text}
    if marks:
        node["marks"] = marks
    return node


def _paragraph(text: str) -> dict[str, Any]:
    return {
        "type": "paragraph",
        "attrs": {"block_id": str(uuid.uuid4()), "raw_text": text},
        "content": [_text_node(text)] if text else [],
    }


def _heading(level: int, text: str, raw_text: str) -> dict[str, Any]:
    return {
        "type": "heading",
        "attrs": {"level": max(1, min(level, 6)), "block_id": str(uuid.uuid4()), "raw_text": raw_text},
        "content": [_text_node(text)] if text else [],
    }


def _code_block(code: str, language: str = "") -> dict[str, Any]:
    return {
        "type": "code_block",
        "attrs": {"language": language, "block_id": str(uuid.uuid4()), "raw_text": code},
        "content": [_text_node(code)] if code else [],
    }


def _blockquote(text: str) -> dict[str, Any]:
    return {
        "type": "blockquote",
        "attrs": {"block_id": str(uuid.uuid4()), "raw_text": text},
        "content": [_text_node(text)] if text else [],
    }


def _image(alt: str, url: str, raw_text: str) -> dict[str, Any]:
    return {
        "type": "image",
        "attrs": {
            "block_id": str(uuid.uuid4()),
            "src": url,
            "url": url,
            "alt": alt,
            "file_name": alt or url.rsplit("/", 1)[-1] or "image",
            "align": "center",
            "raw_text": raw_text,
        },
        "content": [],
    }


def _link_block(text: str, url: str, raw_text: str) -> dict[str, Any]:
    return {
        "type": "link",
        "attrs": {
            "block_id": str(uuid.uuid4()),
            "url": url,
            "title": text or url,
            "view": "link",
            "raw_text": raw_text,
        },
        "content": [_text_node(text or url, [{"type": "link", "attrs": {"href": url}}])],
    }


def _list_node(node_type: str, items: list[tuple[str, bool | None]], ordered: bool = False) -> dict[str, Any]:
    children: list[dict[str, Any]] = []
    for text, checked in items:
        attrs: dict[str, Any] = {"block_id": str(uuid.uuid4()), "raw_text": text}
        if checked is not None:
            attrs["checked"] = checked
        children.append({"type": "list_item", "attrs": attrs, "content": [_text_node(text)] if text else []})
    attrs = {"block_id": str(uuid.uuid4()), "ordered": ordered}
    return {"type": node_type, "attrs": attrs, "content": children}


def markdown_to_content_json(markdown: str) -> dict[str, Any]:
    """Convert common Markdown into CloudDoc block JSON.

    This intentionally covers the stable AI-generated subset rather than every
    GitHub-Flavored Markdown edge case.
    """
    lines = markdown.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    blocks: list[dict[str, Any]] = []
    paragraph_lines: list[str] = []
    list_items: list[tuple[str, bool | None]] = []
    list_type: str | None = None
    list_ordered = False
    code_lines: list[str] = []
    code_language = ""
    in_code = False

    def flush_paragraph() -> None:
        nonlocal paragraph_lines
        if paragraph_lines:
            blocks.append(_paragraph(" ".join(item.strip() for item in paragraph_lines).strip()))
            paragraph_lines = []

    def flush_list() -> None:
        nonlocal list_items, list_type, list_ordered
        if list_items and list_type:
            blocks.append(_list_node(list_type, list_items, ordered=list_ordered))
        list_items = []
        list_type = None
        list_ordered = False

    for raw_line in lines:
        line = raw_line.rstrip()

        fence = re.match(r"^```(.*)$", line)
        if fence:
            if in_code:
                blocks.append(_code_block("\n".join(code_lines), code_language))
                code_lines = []
                code_language = ""
                in_code = False
            else:
                flush_paragraph()
                flush_list()
                in_code = True
                code_language = fence.group(1).strip()
            continue

        if in_code:
            code_lines.append(raw_line)
            continue

        if not line.strip():
            flush_paragraph()
            flush_list()
            continue

        heading = re.match(r"^(#{1,6})\s+(.+)$", line)
        if heading:
            flush_paragraph()
            flush_list()
            blocks.append(_heading(len(heading.group(1)), heading.group(2).strip(), line))
            continue

        image = re.match(r"^!\[([^\]]*)\]\(([^)]+)\)\s*$", line)
        if image:
            flush_paragraph()
            flush_list()
            blocks.append(_image(image.group(1).strip(), image.group(2).strip(), line))
            continue

        link = re.match(r"^\[([^\]]+)\]\((https?://[^)]+)\)\s*$", line)
        if link:
            flush_paragraph()
            flush_list()
            blocks.append(_link_block(link.group(1).strip(), link.group(2).strip(), line))
            continue

        quote = re.match(r"^>\s?(.*)$", line)
        if quote:
            flush_paragraph()
            flush_list()
            blocks.append(_blockquote(quote.group(1).strip()))
            continue

        task = re.match(r"^[-*]\s+\[([ xX])\]\s+(.+)$", line)
        if task:
            flush_paragraph()
            if list_type not in {None, "task_list"}:
                flush_list()
            list_type = "task_list"
            list_ordered = False
            list_items.append((task.group(2).strip(), task.group(1).lower() == "x"))
            continue

        bullet = re.match(r"^[-*]\s+(.+)$", line)
        if bullet:
            flush_paragraph()
            if list_type not in {None, "bullet_list"}:
                flush_list()
            list_type = "bullet_list"
            list_ordered = False
            list_items.append((bullet.group(1).strip(), None))
            continue

        ordered = re.match(r"^\d+[.)]\s+(.+)$", line)
        if ordered:
            flush_paragraph()
            if list_type not in {None, "ordered_list"}:
                flush_list()
            list_type = "ordered_list"
            list_ordered = True
            list_items.append((ordered.group(1).strip(), None))
            continue

        flush_list()
        paragraph_lines.append(line)

    if in_code:
        blocks.append(_code_block("\n".join(code_lines), code_language))
    flush_paragraph()
    flush_list()

    return {"type": "doc", "version": 1, "content": blocks}


def markdown_to_plain_text(markdown: str) -> str:
    content_json = markdown_to_content_json(markdown)
    parts: list[str] = []
    for block in content_json.get("content", []):
        attrs = block.get("attrs") if isinstance(block, dict) else {}
        if isinstance(attrs, dict) and isinstance(attrs.get("raw_text"), str):
            parts.append(attrs["raw_text"])
            continue
        content = block.get("content") if isinstance(block, dict) else []
        if isinstance(content, list):
            texts = [str(item.get("text", "")) for item in content if isinstance(item, dict)]
            if texts:
                parts.append("".join(texts))
    return "\n".join(parts)
