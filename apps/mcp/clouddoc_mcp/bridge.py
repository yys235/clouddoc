from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

API_ROOT = Path(__file__).resolve().parents[2] / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import SessionLocal, init_db
from app.models.comment import Comment, CommentThread
from app.models.share import ShareLink
from app.models.user import User
from app.services.auth_service import verify_password
from app.models.mcp import MCPAuditLog
from app.schemas.document import (
    CommentAnchorPayload,
    CommentCreateRequest,
    CommentReplyRequest,
    DocumentContentUpdateRequest,
    DocumentCreateRequest,
)
from app.schemas.folder import FolderCreateRequest
from app.schemas.integration import MarkdownDocumentCreateRequest, MarkdownDocumentUpdateRequest
from app.services.actor_context import ActorContext
from app.services.comment_service import create_comment_thread, list_comment_threads, reply_comment_thread
from app.services.comment_service import delete_comment as delete_comment_service
from app.services.bootstrap_service import MCP_GUEST_EMAIL, ensure_mcp_guest_user
from app.services.document_service import (
    build_document_detail_payload,
    create_document,
    favorite_document,
    get_document_detail_for_share,
    get_document_detail_for_mcp,
    list_documents_for_mcp,
    restore_document,
    search_documents_for_mcp,
    soft_delete_document,
    update_document_content,
)
from app.services.folder_service import create_folder, get_space_tree, list_folder_children, list_space_root_children
from app.services.integration_service import (
    authenticate_open_actor_by_token,
    create_audit_log,
    create_open_document_from_markdown,
    get_open_document,
    list_integration_scopes,
    list_open_documents,
    list_open_folder_tree,
    search_open_documents,
    update_open_document_from_markdown,
)
from app.services.markdown_service import markdown_to_content_json, markdown_to_plain_text
from app.services.permission_service import (
    actor_user_id,
    can_mcp_delete_comment,
    can_mcp_manage_deleted_document,
    can_mcp_read_document,
    can_mcp_update_comment,
    can_mcp_write_document,
)
from app.services.space_service import list_spaces


class MCPBridgeError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message

    def to_payload(self) -> dict[str, str]:
        return {"error": self.code, "message": self.message}


def initialize_database() -> None:
    init_db()


def _dump(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, list):
        return [_dump(item) for item in value]
    if isinstance(value, dict):
        return {key: _dump(item) for key, item in value.items()}
    return value


def _text_from_inline_nodes(nodes: list[Any]) -> str:
    parts: list[str] = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        text = node.get("text")
        if isinstance(text, str):
            parts.append(text)
        child_content = node.get("content")
        if isinstance(child_content, list):
            parts.append(_text_from_inline_nodes(child_content))
    return "".join(parts)


def _markdown_escape_table_cell(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ").strip()


BOARD_NODE_TYPE_LABELS = {
    "text": "文本",
    "rectangle": "矩形",
    "round_rectangle": "圆角矩形",
    "ellipse": "椭圆",
    "diamond": "菱形",
    "cylinder": "圆柱",
    "predefined_process": "预定义流程",
    "trapezoid": "梯形",
    "document": "文档",
    "comment_bubble": "气泡",
    "cloud": "云朵",
    "left_arrow": "左箭头",
    "triangle": "三角形",
    "star": "星形",
    "arrow": "箭头",
    "parallelogram": "平行四边形",
    "hexagon": "六边形",
    "plus": "加号",
    "table": "表格",
}


def _safe_float(value: Any, default: float = 0) -> float:
    return float(value) if isinstance(value, (int, float)) else default


def _compact_number(value: float) -> int | float:
    return int(value) if float(value).is_integer() else round(value, 3)


def _board_node_text(node: dict[str, Any]) -> str:
    node_type = str(node.get("type") or "")
    if node_type == "table" and isinstance(node.get("table"), dict):
        table_title = node["table"].get("title")
        if isinstance(table_title, str) and table_title.strip():
            return table_title.strip()
    text = node.get("text")
    return text.strip() if isinstance(text, str) else ""


def _board_node_label(node: dict[str, Any], ref_by_id: dict[str, str]) -> str:
    ref = ref_by_id.get(str(node.get("id") or ""), str(node.get("id") or "unknown"))
    text = _board_node_text(node)
    node_type = str(node.get("type") or "unknown")
    type_label = BOARD_NODE_TYPE_LABELS.get(node_type, node_type)
    return f"{ref} {type_label}" + (f"「{text}」" if text else "")


def _board_anchor_point_for_ai(node: dict[str, Any], anchor: str) -> dict[str, int | float]:
    x = _safe_float(node.get("x"))
    y = _safe_float(node.get("y"))
    width = _safe_float(node.get("width"))
    height = _safe_float(node.get("height"))
    if anchor == "top":
        point = {"x": x + width / 2, "y": y}
    elif anchor == "right":
        point = {"x": x + width, "y": y + height / 2}
    elif anchor == "bottom":
        point = {"x": x + width / 2, "y": y + height}
    else:
        point = {"x": x, "y": y + height / 2}
    return {key: _compact_number(value) for key, value in point.items()}


def _board_table_to_ai(table: Any) -> dict[str, Any] | None:
    if not isinstance(table, dict):
        return None
    columns = table.get("columns") if isinstance(table.get("columns"), list) else []
    rows = table.get("rows") if isinstance(table.get("rows"), list) else []
    normalized_rows: list[dict[str, Any]] = []
    for row_index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            continue
        cells = row.get("cells") if isinstance(row.get("cells"), list) else []
        normalized_rows.append(
            {
                "ref": f"r{row_index}",
                "id": row.get("id"),
                "height": row.get("height"),
                "cells": [
                    {
                        "ref": f"r{row_index}c{cell_index}",
                        "id": cell.get("id"),
                        "text": str(cell.get("text") or ""),
                        "align": cell.get("align")
                        or (cell.get("style") if isinstance(cell.get("style"), dict) else {}).get("textAlign")
                        or "left",
                    }
                    for cell_index, cell in enumerate(cells, start=1)
                    if isinstance(cell, dict)
                ],
            }
        )
    return {
        "title": str(table.get("title") or ""),
        "title_height": table.get("titleHeight", table.get("title_height")),
        "column_count": len(columns),
        "row_count": len(normalized_rows),
        "columns": [
            {"ref": f"c{index}", "id": column.get("id"), "width": column.get("width")}
            for index, column in enumerate(columns, start=1)
            if isinstance(column, dict)
        ],
        "rows": normalized_rows,
    }


def _board_node_to_ai(node: dict[str, Any], ref: str) -> dict[str, Any]:
    x = _safe_float(node.get("x"))
    y = _safe_float(node.get("y"))
    width = _safe_float(node.get("width"))
    height = _safe_float(node.get("height"))
    style = node.get("style") if isinstance(node.get("style"), dict) else {}
    payload: dict[str, Any] = {
        "ref": ref,
        "id": node.get("id"),
        "type": node.get("type"),
        "type_label": BOARD_NODE_TYPE_LABELS.get(str(node.get("type") or ""), str(node.get("type") or "unknown")),
        "text": _board_node_text(node),
        "position": {
            "x": _compact_number(x),
            "y": _compact_number(y),
            "width": _compact_number(width),
            "height": _compact_number(height),
            "center_x": _compact_number(x + width / 2),
            "center_y": _compact_number(y + height / 2),
        },
        "z_index": node.get("zIndex", node.get("z_index")),
        "manual_size": bool(node.get("manualSize", node.get("manual_size", False))),
        "style": {
            "fill": style.get("fill"),
            "stroke": style.get("stroke"),
            "stroke_width": style.get("strokeWidth", style.get("stroke_width")),
            "text_color": style.get("color"),
            "font_size": style.get("fontSize", style.get("font_size")),
            "font_weight": style.get("fontWeight", style.get("font_weight")),
            "text_align": style.get("textAlign", style.get("text_align")),
        },
    }
    table = _board_table_to_ai(node.get("table"))
    if table is not None:
        payload["table"] = table
    return payload


def _board_canvas_bounds(nodes: list[dict[str, Any]]) -> dict[str, int | float] | None:
    if not nodes:
        return None
    min_x = min(_safe_float(node.get("x")) for node in nodes)
    min_y = min(_safe_float(node.get("y")) for node in nodes)
    max_x = max(_safe_float(node.get("x")) + _safe_float(node.get("width")) for node in nodes)
    max_y = max(_safe_float(node.get("y")) + _safe_float(node.get("height")) for node in nodes)
    return {
        "min_x": _compact_number(min_x),
        "min_y": _compact_number(min_y),
        "max_x": _compact_number(max_x),
        "max_y": _compact_number(max_y),
        "width": _compact_number(max_x - min_x),
        "height": _compact_number(max_y - min_y),
    }


def _board_endpoint_to_ai(
    endpoint: Any,
    *,
    nodes_by_id: dict[str, dict[str, Any]],
    ref_by_id: dict[str, str],
) -> dict[str, Any]:
    if isinstance(endpoint, str):
        node_id = endpoint
        anchor = "center"
    elif isinstance(endpoint, dict):
        node_id = str(endpoint.get("nodeId") or endpoint.get("node_id") or "")
        anchor = str(endpoint.get("anchor") or "center")
    else:
        node_id = ""
        anchor = "center"
    node = nodes_by_id.get(node_id)
    payload: dict[str, Any] = {
        "node_ref": ref_by_id.get(node_id),
        "node_id": node_id or None,
        "anchor": anchor,
        "text": _board_node_text(node) if node else "",
        "type": node.get("type") if node else None,
    }
    if node and anchor in {"top", "right", "bottom", "left"}:
        payload["point"] = _board_anchor_point_for_ai(node, anchor)
    return payload


def _board_connector_to_ai(
    connector: dict[str, Any],
    *,
    ref: str,
    nodes_by_id: dict[str, dict[str, Any]],
    ref_by_id: dict[str, str],
) -> dict[str, Any]:
    from_endpoint = _board_endpoint_to_ai(connector.get("from"), nodes_by_id=nodes_by_id, ref_by_id=ref_by_id)
    to_endpoint = _board_endpoint_to_ai(connector.get("to"), nodes_by_id=nodes_by_id, ref_by_id=ref_by_id)
    style = connector.get("style") if isinstance(connector.get("style"), dict) else {}
    waypoints = [
        {"x": _compact_number(_safe_float(point.get("x"))), "y": _compact_number(_safe_float(point.get("y")))}
        for point in connector.get("waypoints", []) or []
        if isinstance(point, dict)
    ]
    path_points: list[dict[str, Any]] = []
    if isinstance(from_endpoint.get("point"), dict):
        path_points.append(from_endpoint["point"])
    path_points.extend(waypoints)
    if isinstance(to_endpoint.get("point"), dict):
        path_points.append(to_endpoint["point"])
    label = str(connector.get("label") or "").strip()
    return {
        "ref": ref,
        "id": connector.get("id"),
        "from": from_endpoint,
        "to": to_endpoint,
        "label": label,
        "relationship": f"{from_endpoint.get('node_ref') or '?'} -> {to_endpoint.get('node_ref') or '?'}"
        + (f"：{label}" if label else ""),
        "routing_mode": connector.get("routingMode", connector.get("routing", "rounded-orthogonal")),
        "waypoints": waypoints,
        "path_points": path_points,
        "label_position": connector.get("labelPosition"),
        "label_segment_index": connector.get("labelSegmentIndex"),
        "label_segment_t": connector.get("labelSegmentT"),
        "style": {
            "stroke": style.get("stroke"),
            "stroke_width": style.get("strokeWidth", style.get("stroke_width")),
            "start_arrow": style.get("startArrow", style.get("start_arrow")),
            "end_arrow": style.get("endArrow", style.get("end_arrow")),
            "corner_radius": style.get("cornerRadius", style.get("corner_radius")),
            "stroke_dasharray": style.get("strokeDasharray", style.get("stroke_dasharray")),
        },
    }


def board_content_to_ai_view(content_json: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(content_json, dict) or content_json.get("type") != "board":
        return None

    raw_nodes = content_json.get("nodes") if isinstance(content_json.get("nodes"), list) else []
    raw_connectors = content_json.get("connectors") if isinstance(content_json.get("connectors"), list) else []
    nodes = [node for node in raw_nodes if isinstance(node, dict) and isinstance(node.get("id"), str)]
    connectors = [connector for connector in raw_connectors if isinstance(connector, dict) and isinstance(connector.get("id"), str)]
    ref_by_id = {str(node["id"]): f"n{index}" for index, node in enumerate(nodes, start=1)}
    connector_ref_by_id = {
        str(connector["id"]): f"c{index}" for index, connector in enumerate(connectors, start=1)
    }
    nodes_by_id = {str(node["id"]): node for node in nodes}
    ai_nodes = [_board_node_to_ai(node, ref_by_id[str(node["id"])]) for node in nodes]
    ai_connectors = [
        _board_connector_to_ai(
            connector,
            ref=connector_ref_by_id[str(connector["id"])],
            nodes_by_id=nodes_by_id,
            ref_by_id=ref_by_id,
        )
        for connector in connectors
    ]

    outgoing: dict[str, list[dict[str, Any]]] = {node["ref"]: [] for node in ai_nodes}
    incoming: dict[str, list[dict[str, Any]]] = {node["ref"]: [] for node in ai_nodes}
    for connector in ai_connectors:
        source = connector["from"].get("node_ref")
        target = connector["to"].get("node_ref")
        edge = {
            "connector_ref": connector["ref"],
            "label": connector["label"],
            "routing_mode": connector["routing_mode"],
        }
        if source:
            outgoing.setdefault(source, []).append({**edge, "to": target})
        if target:
            incoming.setdefault(target, []).append({**edge, "from": source})

    reading_order = [
        item["ref"]
        for item in sorted(
            ai_nodes,
            key=lambda node: (
                float(node["position"]["y"]),
                float(node["position"]["x"]),
                int(node["z_index"] or 0),
            ),
        )
    ]
    node_type_counts: dict[str, int] = {}
    for node in ai_nodes:
        node_type = str(node["type"])
        node_type_counts[node_type] = node_type_counts.get(node_type, 0) + 1
    unconnected_nodes = [
        node["ref"]
        for node in ai_nodes
        if not outgoing.get(node["ref"]) and not incoming.get(node["ref"])
    ]
    warnings: list[str] = []
    for connector in ai_connectors:
        if not connector["from"].get("node_ref") or not connector["to"].get("node_ref"):
            warnings.append(f"{connector['ref']} references missing endpoint node")

    return {
        "schema": "clouddoc.board.ai_view.v1",
        "overview": {
            "node_count": len(ai_nodes),
            "connector_count": len(ai_connectors),
            "node_type_counts": node_type_counts,
            "viewport": content_json.get("viewport") if isinstance(content_json.get("viewport"), dict) else {},
            "canvas_bounds": _board_canvas_bounds(nodes),
        },
        "reading_order": reading_order,
        "nodes": ai_nodes,
        "connectors": ai_connectors,
        "relationships": {
            "outgoing": outgoing,
            "incoming": incoming,
            "unconnected_nodes": unconnected_nodes,
        },
        "warnings": warnings,
    }


def board_content_to_markdown(
    content_json: dict[str, Any] | None,
    *,
    title: str = "Board",
    fallback_plain_text: str = "",
) -> str:
    ai_view = board_content_to_ai_view(content_json)
    if ai_view is None:
        return fallback_plain_text.strip()

    lines = [f"# {title}", "", "## Board Overview"]
    overview = ai_view["overview"]
    lines.append(f"- Nodes: {overview['node_count']}")
    lines.append(f"- Connectors: {overview['connector_count']}")
    if overview.get("node_type_counts"):
        type_counts = ", ".join(f"{key}={value}" for key, value in overview["node_type_counts"].items())
        lines.append(f"- Node types: {type_counts}")

    lines.extend(["", "## Nodes"])
    nodes_by_ref = {node["ref"]: node for node in ai_view["nodes"]}
    for ref in ai_view["reading_order"]:
        node = nodes_by_ref[ref]
        position = node["position"]
        node_text = f"「{node['text']}」" if node["text"] else "无文本"
        lines.append(
            f"- [{node['ref']}] {node['type_label']} {node_text} "
            f"at ({position['x']}, {position['y']}) size {position['width']}x{position['height']}"
        )
        table = node.get("table")
        if isinstance(table, dict):
            rows = table.get("rows") if isinstance(table.get("rows"), list) else []
            if rows:
                width = max((len(row.get("cells", [])) for row in rows if isinstance(row, dict)), default=0)
                rendered_rows = []
                for row in rows:
                    cells = row.get("cells") if isinstance(row, dict) and isinstance(row.get("cells"), list) else []
                    rendered_rows.append([_markdown_escape_table_cell(str(cell.get("text") or "")) for cell in cells])
                if width:
                    header = rendered_rows[0] + [""] * (width - len(rendered_rows[0]))
                    lines.append("  | " + " | ".join(header) + " |")
                    lines.append("  | " + " | ".join(["---"] * width) + " |")
                    for row in rendered_rows[1:]:
                        normalized = row + [""] * (width - len(row))
                        lines.append("  | " + " | ".join(normalized) + " |")

    lines.extend(["", "## Relationships"])
    if ai_view["connectors"]:
        for connector in ai_view["connectors"]:
            source = connector["from"]
            target = connector["to"]
            label = f" label「{connector['label']}」" if connector["label"] else ""
            lines.append(
                f"- [{connector['ref']}] "
                f"{source.get('node_ref') or '?'}({source.get('text') or '无文本'}) "
                f"{source.get('anchor')} -> {target.get('node_ref') or '?'}({target.get('text') or '无文本'}) "
                f"{target.get('anchor')}; routing={connector['routing_mode']}{label}"
            )
    else:
        lines.append("- No connectors")

    if ai_view["relationships"]["unconnected_nodes"]:
        lines.extend(["", "## Unconnected Nodes"])
        lines.append("- " + ", ".join(ai_view["relationships"]["unconnected_nodes"]))
    if ai_view["warnings"]:
        lines.extend(["", "## Warnings"])
        for warning in ai_view["warnings"]:
            lines.append(f"- {warning}")
    return "\n".join(lines).strip()


def _content_node_to_markdown(node: Any, depth: int = 0) -> list[str]:
    if not isinstance(node, dict):
        return []

    node_type = str(node.get("type") or "paragraph")
    content = node.get("content")
    children = content if isinstance(content, list) else []
    attrs = node.get("attrs") if isinstance(node.get("attrs"), dict) else {}
    text = _text_from_inline_nodes(children).strip()

    if node_type == "heading":
        level = attrs.get("level", 1)
        try:
            normalized_level = max(1, min(int(level), 6))
        except (TypeError, ValueError):
            normalized_level = 1
        return [f"{'#' * normalized_level} {text}".rstrip()]

    if node_type == "paragraph":
        raw_text = attrs.get("raw_text")
        if isinstance(raw_text, str) and raw_text:
            return [raw_text]
        return [text] if text else []

    if node_type in {"bullet_list", "ordered_list", "task_list"}:
        lines: list[str] = []
        for index, child in enumerate(children, start=1):
            child_text = _text_from_inline_nodes(child.get("content", []) if isinstance(child, dict) else []).strip()
            nested_lines: list[str] = []
            if isinstance(child, dict):
                for nested in child.get("content", []):
                    if isinstance(nested, dict) and nested.get("type") in {"bullet_list", "ordered_list", "task_list"}:
                        nested_lines.extend(_content_node_to_markdown(nested, depth + 1))
            indent = "  " * depth
            if node_type == "ordered_list":
                marker = f"{index}."
            elif node_type == "task_list":
                checked = bool(child.get("attrs", {}).get("checked")) if isinstance(child, dict) else False
                marker = "[x]" if checked else "[ ]"
            else:
                marker = "-"
            if child_text:
                lines.append(f"{indent}{marker} {child_text}")
            lines.extend(nested_lines)
        return lines

    if node_type == "blockquote":
        quote_lines = []
        for child in children:
            quote_lines.extend(_content_node_to_markdown(child, depth))
        if not quote_lines and text:
            quote_lines = [text]
        return [f"> {line}" if line else ">" for line in quote_lines]

    if node_type == "code_block":
        language = str(attrs.get("language") or "").strip()
        return [f"```{language}", attrs.get("raw_text") or text, "```"]

    if node_type == "divider":
        return ["---"]

    if node_type == "link":
        url = str(attrs.get("url") or text or "").strip()
        title = str(attrs.get("title") or text or url).strip()
        return [f"[{title}]({url})" if url else title]

    if node_type == "image":
        url = str(attrs.get("url") or attrs.get("src") or "").strip()
        alt = str(attrs.get("alt") or attrs.get("name") or "image").strip()
        return [f"![{alt}]({url})" if url else f"![{alt}]"]

    if node_type == "table":
        rows = children
        rendered_rows: list[list[str]] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            cells = row.get("content") if isinstance(row.get("content"), list) else []
            rendered_rows.append([_markdown_escape_table_cell(_text_from_inline_nodes(cell.get("content", []))) for cell in cells if isinstance(cell, dict)])
        if not rendered_rows:
            return []
        width = max(len(row) for row in rendered_rows)
        normalized_rows = [row + [""] * (width - len(row)) for row in rendered_rows]
        header = normalized_rows[0]
        lines = [
            "| " + " | ".join(header) + " |",
            "| " + " | ".join(["---"] * width) + " |",
        ]
        for row in normalized_rows[1:]:
            lines.append("| " + " | ".join(row) + " |")
        return lines

    nested: list[str] = []
    for child in children:
        nested.extend(_content_node_to_markdown(child, depth))
    return nested or ([text] if text else [])


def content_json_to_markdown(
    content_json: dict[str, Any] | None,
    fallback_plain_text: str = "",
    *,
    title: str = "Document",
) -> str:
    if not isinstance(content_json, dict):
        return fallback_plain_text.strip()

    if content_json.get("type") == "board":
        return board_content_to_markdown(content_json, title=title, fallback_plain_text=fallback_plain_text)

    blocks = content_json.get("content")
    if not isinstance(blocks, list):
        return fallback_plain_text.strip()

    lines: list[str] = []
    for block in blocks:
        block_lines = _content_node_to_markdown(block)
        if not block_lines:
            continue
        if lines:
            lines.append("")
        lines.extend(block_lines)
    return "\n".join(lines).strip() or fallback_plain_text.strip()


def _format_document_payload(document: Any, output_format: str) -> dict[str, Any]:
    dumped = _dump(document)
    normalized_format = (
        output_format if output_format in {"markdown", "plain_text", "content_json", "full", "ai"} else "markdown"
    )
    content = dumped.get("content") if isinstance(dumped.get("content"), dict) else {}
    content_json = content.get("content_json") if isinstance(content, dict) else {}
    plain_text = str(content.get("plain_text") or "") if isinstance(content, dict) else ""
    title = str(dumped.get("title") or "Document")
    markdown = content_json_to_markdown(content_json, plain_text, title=title)
    ai_view = board_content_to_ai_view(content_json)

    metadata = {key: value for key, value in dumped.items() if key != "content"}
    metadata["format"] = normalized_format

    if normalized_format == "full":
        metadata["content"] = content
        metadata["markdown"] = markdown
        if ai_view is not None:
            metadata["ai_view"] = ai_view
        return metadata
    if normalized_format == "ai":
        metadata["markdown"] = markdown
        if ai_view is not None:
            metadata["ai_view"] = ai_view
        else:
            metadata["ai_view"] = {
                "schema": "clouddoc.document.ai_view.v1",
                "markdown": markdown,
                "plain_text": plain_text,
            }
        return metadata
    if normalized_format == "content_json":
        metadata["content_json"] = content_json
        return metadata
    if normalized_format == "plain_text":
        metadata["plain_text"] = plain_text
        return metadata

    metadata["markdown"] = markdown
    return metadata


def _audit_write(
    *,
    actor_id: str | None,
    tool_name: str,
    target_type: str | None,
    target_id: str | None,
    request_payload: dict[str, Any],
    response_status: str,
    error_message: str | None = None,
) -> None:
    with SessionLocal() as db:
        db.add(
            MCPAuditLog(
                actor_type="user",
                actor_id=actor_id,
                tool_name=tool_name,
                target_type=target_type,
                target_id=target_id,
                request_payload=_dump(request_payload),
                response_status=response_status,
                error_message=error_message,
            )
        )
        db.commit()


def _map_write_error(exc: Exception) -> MCPBridgeError:
    if isinstance(exc, MCPBridgeError):
        return exc
    if isinstance(exc, PermissionError):
        return MCPBridgeError("unauthorized", str(exc))
    if isinstance(exc, HTTPException):
        if exc.status_code == 403:
            return MCPBridgeError("unauthorized", str(exc.detail))
        if exc.status_code == 404:
            return MCPBridgeError("not_found", str(exc.detail))
        return MCPBridgeError("invalid_input", str(exc.detail))
    if isinstance(exc, ValueError):
        return MCPBridgeError("invalid_input", str(exc))
    return MCPBridgeError("internal_error", str(exc) or exc.__class__.__name__)


def _run_write_tool(
    *,
    tool_name: str,
    target_type: str | None,
    target_id: str | None,
    request_payload: dict[str, Any],
    user_email: str | None,
    action,
    mcp_token: str | None = None,
) -> dict[str, Any]:
    actor_id: str | None = None
    try:
        with SessionLocal() as db:
            actor_id = _get_actor_user_id(db, user_email, mcp_token)
            if actor_id is None:
                raise MCPBridgeError("unauthenticated", "No MCP actor user is available")
            result = action(db, actor_id)
        _audit_write(
            actor_id=actor_id,
            tool_name=tool_name,
            target_type=target_type,
            target_id=target_id,
            request_payload=request_payload,
            response_status="success",
        )
        return _dump(result)
    except Exception as exc:
        mapped = _map_write_error(exc)
        _audit_write(
            actor_id=actor_id,
            tool_name=tool_name,
            target_type=target_type,
            target_id=target_id,
            request_payload=request_payload,
            response_status="error",
            error_message=mapped.message,
        )
        raise mapped


def _resolve_mcp_token(mcp_token: str | None = None, user_email: str | None = None) -> str:
    if mcp_token:
        return mcp_token.strip()
    if user_email:
        return ""
    return (os.getenv("CLOUDDOC_MCP_TOKEN") or "").strip()


def _get_actor_context(db: Session, user_email: str | None = None, mcp_token: str | None = None) -> ActorContext:
    raw_token = _resolve_mcp_token(mcp_token, user_email)
    if raw_token:
        return authenticate_open_actor_by_token(db, raw_token).actor

    actor_email = (user_email or os.getenv("CLOUDDOC_MCP_ACTOR_EMAIL") or "").strip()
    if actor_email:
        user = db.scalar(
            select(User)
            .where(User.email == actor_email)
            .where(User.is_active.is_(True))
            .limit(1)
        )
        if user is None:
            raise MCPBridgeError("unauthenticated", "Configured MCP actor user was not found")
        actor_type = "guest" if user.email == MCP_GUEST_EMAIL else "user"
        return ActorContext.from_user(user, actor_type=actor_type)

    guest = db.scalar(select(User).where(User.email == MCP_GUEST_EMAIL).where(User.is_active.is_(True)).limit(1))
    if guest is None:
        guest = ensure_mcp_guest_user(db)
    return ActorContext.from_user(guest, actor_type="guest")


def _get_actor_user_id(db: Session, user_email: str | None = None, mcp_token: str | None = None) -> str | None:
    return actor_user_id(_get_actor_context(db, user_email, mcp_token))


def _comment_payload(db: Session, comment: Comment) -> dict[str, Any]:
    author = db.get(User, comment.author_id)
    return {
        "id": comment.id,
        "thread_id": comment.thread_id,
        "document_id": comment.document_id,
        "parent_comment_id": comment.parent_comment_id,
        "author_id": comment.author_id,
        "author_name": author.name if author is not None else "Unknown",
        "body": comment.body,
        "is_deleted": comment.is_deleted,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "updated_at": comment.updated_at.isoformat() if comment.updated_at else None,
    }


def _share_summary(share: ShareLink | None) -> dict[str, Any] | None:
    if share is None:
        return None
    is_expired = bool(share.expires_at and share.expires_at <= datetime.now(timezone.utc))
    return {
        "id": share.id,
        "token": share.token,
        "share_url": f"/share/{share.token}",
        "is_enabled": share.is_active,
        "is_active": share.is_active and not is_expired,
        "requires_password": bool(share.password_hash),
        "expires_at": share.expires_at.isoformat() if share.expires_at else None,
        "allow_copy": share.allow_copy,
        "allow_export": share.allow_export,
        "created_at": share.created_at.isoformat() if share.created_at else None,
        "updated_at": share.updated_at.isoformat() if share.updated_at else None,
        "access_count": share.access_count,
        "last_accessed_at": share.last_accessed_at.isoformat() if share.last_accessed_at else None,
    }


def list_documents_tool(
    state: str = "active",
    limit: int = 50,
    folder_id: str | None = None,
    user_email: str | None = None,
    mcp_token: str | None = None,
) -> dict[str, Any]:
    normalized_state = state if state in {"active", "trash", "all"} else "active"
    safe_limit = max(1, min(limit, 200))
    with SessionLocal() as db:
        raw_token = _resolve_mcp_token(mcp_token, user_email)
        if raw_token:
            context = authenticate_open_actor_by_token(db, raw_token)
            items = list_open_documents(db, context, normalized_state)[:safe_limit]
        else:
            user_id = _get_actor_user_id(db, user_email)
            items = list_documents_for_mcp(
                db,
                state=normalized_state,
                user_id=user_id,
                folder_id=folder_id,
                limit=safe_limit,
            )
        return {"documents": _dump(items), "state": normalized_state, "folder_id": folder_id, "count": len(items)}


def search_documents_tool(
    query: str,
    limit: int = 20,
    folder_id: str | None = None,
    user_email: str | None = None,
    mcp_token: str | None = None,
) -> dict[str, Any]:
    if not query.strip():
        return {"documents": [], "query": query, "folder_id": folder_id, "count": 0}
    safe_limit = max(1, min(limit, 100))
    with SessionLocal() as db:
        raw_token = _resolve_mcp_token(mcp_token, user_email)
        if raw_token:
            context = authenticate_open_actor_by_token(db, raw_token)
            items = search_open_documents(db, context, query)[:safe_limit]
        else:
            user_id = _get_actor_user_id(db, user_email)
            items = search_documents_for_mcp(
                db,
                query,
                user_id=user_id,
                folder_id=folder_id,
                limit=safe_limit,
            )
        return {"documents": _dump(items), "query": query, "folder_id": folder_id, "count": len(items)}


def list_folders_tool(
    *,
    space_id: str,
    folder_id: str | None = None,
    user_email: str | None = None,
    mcp_token: str | None = None,
) -> dict[str, Any]:
    with SessionLocal() as db:
        raw_token = _resolve_mcp_token(mcp_token, user_email)
        if raw_token:
            context = authenticate_open_actor_by_token(db, raw_token)
            tree = list_open_folder_tree(db, context, space_id)
            items = tree if not folder_id else next((node.children for node in tree if node.id == folder_id), [])
        else:
            user_id = _get_actor_user_id(db, user_email)
            items = list_space_root_children(db, space_id, user_id) if not folder_id else list_folder_children(db, folder_id, user_id)
        return {"folders": _dump(items), "space_id": space_id, "folder_id": folder_id, "count": len(items)}


def get_folder_tree_tool(
    *,
    space_id: str,
    user_email: str | None = None,
    mcp_token: str | None = None,
) -> dict[str, Any]:
    with SessionLocal() as db:
        raw_token = _resolve_mcp_token(mcp_token, user_email)
        if raw_token:
            context = authenticate_open_actor_by_token(db, raw_token)
            tree = list_open_folder_tree(db, context, space_id)
        else:
            user_id = _get_actor_user_id(db, user_email)
            tree = get_space_tree(db, space_id, user_id)
        return {"tree": _dump(tree), "space_id": space_id, "count": len(tree)}


def get_integration_context_tool(
    *,
    user_email: str | None = None,
    mcp_token: str | None = None,
) -> dict[str, Any]:
    with SessionLocal() as db:
        actor = _get_actor_context(db, user_email, mcp_token)
        payload: dict[str, Any] = {
            "actor": {
                "user_id": actor.user_id,
                "actor_type": actor.actor_type,
            }
        }
        raw_token = _resolve_mcp_token(mcp_token, user_email)
        if raw_token:
            open_context = authenticate_open_actor_by_token(db, raw_token)
            payload["token"] = {
                "id": open_context.token.id,
                "token_type": open_context.token.token_type,
                "token_prefix": open_context.token.token_prefix,
                "scopes": list(open_context.token.scopes or []),
                "expires_at": open_context.token.expires_at.isoformat() if open_context.token.expires_at else None,
            }
            if open_context.integration is not None:
                payload["integration"] = {
                    "id": open_context.integration.id,
                    "name": open_context.integration.name,
                    "client_id": open_context.integration.client_id,
                    "status": open_context.integration.status,
                }
        return payload


def list_authorized_scopes_tool(
    *,
    user_email: str | None = None,
    mcp_token: str | None = None,
) -> dict[str, Any]:
    with SessionLocal() as db:
        raw_token = _resolve_mcp_token(mcp_token, user_email)
        if not raw_token:
            actor = _get_actor_context(db, user_email, mcp_token)
            return {"actor": {"user_id": actor.user_id, "actor_type": actor.actor_type}, "scopes": [], "count": 0}
        open_context = authenticate_open_actor_by_token(db, raw_token)
        scopes = (
            list_integration_scopes(db, open_context.integration.id, open_context.integration.created_by)
            if open_context.integration is not None
            else []
        )
        return {
            "scopes": [
                {
                    "id": scope.id,
                    "integration_id": scope.integration_id,
                    "resource_type": scope.resource_type,
                    "resource_id": scope.resource_id,
                    "include_children": scope.include_children,
                    "permission_level": scope.permission_level,
                }
                for scope in scopes
            ],
            "count": len(scopes),
        }


def get_document_tool(
    document_id: str,
    user_email: str | None = None,
    format: str = "markdown",
    mcp_token: str | None = None,
) -> dict[str, Any]:
    with SessionLocal() as db:
        raw_token = _resolve_mcp_token(mcp_token, user_email)
        if raw_token:
            context = authenticate_open_actor_by_token(db, raw_token)
            document = get_open_document(db, context, document_id)
        else:
            user_id = _get_actor_user_id(db, user_email)
            document = get_document_detail_for_mcp(db, document_id, user_id=user_id)
        if document is None:
            raise MCPBridgeError("unauthorized", "MCP tools can only read actor-owned documents or public documents")
        return {"document": _format_document_payload(document, format)}


def get_comments_tool(document_id: str, user_email: str | None = None) -> dict[str, Any]:
    with SessionLocal() as db:
        user_id = _get_actor_user_id(db, user_email)
        threads = list_comment_threads(db, document_id, user_id=user_id)
        return {"threads": _dump(threads), "count": len(threads)}


def list_spaces_tool(user_email: str | None = None) -> dict[str, Any]:
    with SessionLocal() as db:
        user_id = _get_actor_user_id(db, user_email)
        spaces = list_spaces(db, user_id=user_id)
        return {"spaces": _dump(spaces), "count": len(spaces)}


def get_shared_document_tool(token: str, password: str | None = None) -> dict[str, Any]:
    with SessionLocal() as db:
        share = db.scalar(select(ShareLink).where(ShareLink.token == token).limit(1))
        if share is None:
            return {"status": "not_found", "share": None, "document": None}
        if not share.is_active:
            return {"status": "disabled", "share": _share_summary(share), "document": None}
        if share.expires_at and share.expires_at <= datetime.now(timezone.utc):
            return {"status": "expired", "share": _share_summary(share), "document": None}
        if share.password_hash:
            if not password:
                return {"status": "password_required", "share": _share_summary(share), "document": None}
            if not verify_password(password, share.password_hash):
                return {"status": "unauthorized", "share": _share_summary(share), "document": None}

        document = get_document_detail_for_share(db, share.document_id)
        if document is None:
            return {"status": "not_found", "share": _share_summary(share), "document": None}
        return {"status": "ok", "share": _share_summary(share), "document": _dump(document)}


def create_document_tool(
    *,
    space_id: str,
    title: str,
    document_type: str = "doc",
    visibility: str = "private",
    folder_id: str | None = None,
    user_email: str | None = None,
) -> dict[str, Any]:
    payload = {
        "space_id": space_id,
        "title": title,
        "document_type": document_type,
        "visibility": visibility,
        "folder_id": folder_id,
    }

    def action(db: Session, actor_id: str):
        document = create_document(db, DocumentCreateRequest(**payload), actor_id)
        return {"document": document}

    return _run_write_tool(
        tool_name="clouddoc.create_document",
        target_type="space",
        target_id=space_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )


def create_folder_tool(
    *,
    space_id: str,
    title: str,
    parent_folder_id: str | None = None,
    visibility: str = "private",
    user_email: str | None = None,
) -> dict[str, Any]:
    payload = {
        "space_id": space_id,
        "title": title,
        "parent_folder_id": parent_folder_id,
        "visibility": visibility,
    }

    def action(db: Session, actor_id: str):
        folder = create_folder(db, FolderCreateRequest(**payload), actor_id)
        return {"folder": folder}

    return _run_write_tool(
        tool_name="clouddoc.create_folder",
        target_type="space",
        target_id=space_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )


def update_document_content_tool(
    *,
    document_id: str,
    content_json: dict[str, Any],
    plain_text: str = "",
    schema_version: int = 1,
    base_version_no: int | None = None,
    user_email: str | None = None,
) -> dict[str, Any]:
    payload = {
        "document_id": document_id,
        "content_json": content_json,
        "plain_text": plain_text,
        "schema_version": schema_version,
        "base_version_no": base_version_no,
    }

    def action(db: Session, actor_id: str):
        document = update_document_content(
            db,
            document_id,
            DocumentContentUpdateRequest(
                content_json=content_json,
                plain_text=plain_text,
                schema_version=schema_version,
                base_version_no=base_version_no,
            ),
            actor_id,
        )
        if document is None:
            raise MCPBridgeError("not_found", "Document not found")
        return {"document": document}

    return _run_write_tool(
        tool_name="clouddoc.update_document_content",
        target_type="document",
        target_id=document_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )


def create_document_from_markdown_tool(
    *,
    space_id: str,
    title: str,
    markdown: str,
    folder_id: str | None = None,
    visibility: str = "private",
    user_email: str | None = None,
    mcp_token: str | None = None,
) -> dict[str, Any]:
    payload = {
        "space_id": space_id,
        "title": title,
        "markdown": markdown,
        "folder_id": folder_id,
        "visibility": visibility,
    }
    raw_token = _resolve_mcp_token(mcp_token, user_email)
    if raw_token:
        with SessionLocal() as db:
            context = authenticate_open_actor_by_token(db, raw_token)
            document = create_open_document_from_markdown(db, context, MarkdownDocumentCreateRequest(**payload))
            create_audit_log(
                db,
                context,
                operation="mcp.create_document_from_markdown",
                target_type="document",
                target_id=document.id,
                request_summary={"space_id": space_id, "folder_id": folder_id, "title": title},
                source="mcp",
            )
            return {"document": _dump(document)}

    def action(db: Session, actor_id: str):
        document = create_document(
            db,
            DocumentCreateRequest(
                title=title,
                space_id=space_id,
                folder_id=folder_id,
                document_type="doc",
                visibility=visibility,
            ),
            actor_id,
        )
        updated = update_document_content(
            db,
            document.id,
            DocumentContentUpdateRequest(
                schema_version=1,
                content_json=markdown_to_content_json(markdown),
                plain_text=markdown_to_plain_text(markdown),
            ),
            actor_id,
        )
        return {"document": updated or document}

    return _run_write_tool(
        tool_name="clouddoc.create_document_from_markdown",
        target_type="space",
        target_id=space_id,
        request_payload={**payload, "markdown": f"{len(markdown)} chars"},
        user_email=user_email,
        action=action,
    )


def update_document_from_markdown_tool(
    *,
    document_id: str,
    markdown: str,
    title: str | None = None,
    user_email: str | None = None,
    mcp_token: str | None = None,
) -> dict[str, Any]:
    payload = {"document_id": document_id, "markdown": markdown, "title": title}
    raw_token = _resolve_mcp_token(mcp_token, user_email)
    if raw_token:
        with SessionLocal() as db:
            context = authenticate_open_actor_by_token(db, raw_token)
            document = update_open_document_from_markdown(
                db,
                context,
                document_id,
                MarkdownDocumentUpdateRequest(markdown=markdown, title=title),
            )
            if document is None:
                raise MCPBridgeError("not_found", "Document not found")
            create_audit_log(
                db,
                context,
                operation="mcp.update_document_from_markdown",
                target_type="document",
                target_id=document_id,
                request_summary={"title": title},
                source="mcp",
            )
            return {"document": _dump(document)}

    def action(db: Session, actor_id: str):
        document = update_document_content(
            db,
            document_id,
            DocumentContentUpdateRequest(
                schema_version=1,
                content_json=markdown_to_content_json(markdown),
                plain_text=markdown_to_plain_text(markdown),
            ),
            actor_id,
        )
        if document is None:
            raise MCPBridgeError("not_found", "Document not found")
        return {"document": document}

    return _run_write_tool(
        tool_name="clouddoc.update_document_from_markdown",
        target_type="document",
        target_id=document_id,
        request_payload={**payload, "markdown": f"{len(markdown)} chars"},
        user_email=user_email,
        action=action,
    )


def append_document_markdown_tool(
    *,
    document_id: str,
    markdown: str,
    user_email: str | None = None,
    mcp_token: str | None = None,
) -> dict[str, Any]:
    raw_token = _resolve_mcp_token(mcp_token, user_email)
    if raw_token:
        with SessionLocal() as db:
            context = authenticate_open_actor_by_token(db, raw_token)
            current = get_open_document(db, context, document_id)
            if current is None:
                raise MCPBridgeError("not_found", "Document not found")
            existing_markdown = str(_format_document_payload(current, "markdown").get("markdown") or "").strip()
            combined_markdown = f"{existing_markdown}\n\n{markdown.strip()}".strip()
            updated = update_open_document_from_markdown(
                db,
                context,
                document_id,
                MarkdownDocumentUpdateRequest(markdown=combined_markdown),
            )
            if updated is None:
                raise MCPBridgeError("not_found", "Document not found")
            create_audit_log(
                db,
                context,
                operation="mcp.append_document_markdown",
                target_type="document",
                target_id=document_id,
                request_summary={"append_length": len(markdown)},
                source="mcp",
            )
            return {"document": _dump(updated)}

    detail = get_document_tool(document_id, user_email=user_email, format="markdown")
    existing_markdown = str(detail["document"].get("markdown") or "").strip()
    combined_markdown = f"{existing_markdown}\n\n{markdown.strip()}".strip()
    return update_document_from_markdown_tool(
        document_id=document_id,
        markdown=combined_markdown,
        user_email=user_email,
    )


def delete_document_tool(document_id: str, user_email: str | None = None) -> dict[str, Any]:
    payload = {"document_id": document_id}

    def action(db: Session, actor_id: str):
        document = soft_delete_document(db, document_id, actor_id)
        if document is None:
            raise MCPBridgeError("not_found", "Document not found")
        return {"document": document}

    return _run_write_tool(
        tool_name="clouddoc.delete_document",
        target_type="document",
        target_id=document_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )


def restore_document_tool(document_id: str, user_email: str | None = None) -> dict[str, Any]:
    payload = {"document_id": document_id}

    def action(db: Session, actor_id: str):
        document = restore_document(db, document_id, actor_id)
        if document is None:
            raise MCPBridgeError("not_found", "Document not found")
        return {"document": document}

    return _run_write_tool(
        tool_name="clouddoc.restore_document",
        target_type="document",
        target_id=document_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )


def create_comment_tool(
    *,
    document_id: str,
    block_id: str,
    start_offset: int,
    end_offset: int,
    quote_text: str,
    body: str,
    prefix_text: str | None = None,
    suffix_text: str | None = None,
    user_email: str | None = None,
) -> dict[str, Any]:
    payload = {
        "document_id": document_id,
        "block_id": block_id,
        "start_offset": start_offset,
        "end_offset": end_offset,
        "quote_text": quote_text,
        "prefix_text": prefix_text,
        "suffix_text": suffix_text,
        "body": body,
    }

    def action(db: Session, actor_id: str):
        thread = create_comment_thread(
            db,
            document_id,
            CommentCreateRequest(
                anchor=CommentAnchorPayload(
                    block_id=block_id,
                    start_offset=start_offset,
                    end_offset=end_offset,
                    quote_text=quote_text,
                    prefix_text=prefix_text,
                    suffix_text=suffix_text,
                ),
                body=body,
            ),
            actor_id,
        )
        return {"thread": thread}

    return _run_write_tool(
        tool_name="clouddoc.create_comment",
        target_type="document",
        target_id=document_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )


def reply_comment_tool(
    *,
    thread_id: str,
    body: str,
    parent_comment_id: str | None = None,
    user_email: str | None = None,
) -> dict[str, Any]:
    payload = {
        "thread_id": thread_id,
        "parent_comment_id": parent_comment_id,
        "body": body,
    }

    def action(db: Session, actor_id: str):
        thread_model = db.get(CommentThread, thread_id)
        if thread_model is None:
            raise MCPBridgeError("not_found", "Comment thread not found")
        thread = reply_comment_thread(
            db,
            thread_id,
            CommentReplyRequest(body=body, parent_comment_id=parent_comment_id),
            actor_id,
        )
        if thread is None:
            raise MCPBridgeError("not_found", "Comment thread not found")
        return {"thread": thread}

    return _run_write_tool(
        tool_name="clouddoc.reply_comment",
        target_type="comment_thread",
        target_id=thread_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )


def update_comment_tool(comment_id: str, body: str, user_email: str | None = None) -> dict[str, Any]:
    payload = {"comment_id": comment_id, "body": body}

    def action(db: Session, actor_id: str):
        comment = db.get(Comment, comment_id)
        if comment is None or comment.is_deleted:
            raise MCPBridgeError("not_found", "Comment not found")
        if not can_mcp_update_comment(db, comment, actor_id):
            raise MCPBridgeError("unauthorized", "MCP tools can only update comments created by the actor")
        normalized_body = body.strip()
        if not normalized_body:
            raise MCPBridgeError("invalid_input", "Comment body is required")
        comment.body = normalized_body
        db.commit()
        db.refresh(comment)
        return {"comment": _comment_payload(db, comment)}

    return _run_write_tool(
        tool_name="clouddoc.update_comment",
        target_type="comment",
        target_id=comment_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )


def delete_comment_tool(comment_id: str, user_email: str | None = None) -> dict[str, Any]:
    payload = {"comment_id": comment_id}

    def action(db: Session, actor_id: str):
        comment = db.get(Comment, comment_id)
        if comment is None:
            raise MCPBridgeError("not_found", "Comment not found")
        if not can_mcp_delete_comment(db, comment, actor_id):
            raise MCPBridgeError("unauthorized", "MCP tools can only delete comments created by the actor")
        result = delete_comment_service(db, comment_id=comment_id, current_user_id=actor_id)
        if result is None:
            raise MCPBridgeError("not_found", "Comment not found")
        return {"deleted": result}

    return _run_write_tool(
        tool_name="clouddoc.delete_comment",
        target_type="comment",
        target_id=comment_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )


def favorite_document_tool(document_id: str, user_email: str | None = None) -> dict[str, Any]:
    payload = {"document_id": document_id}

    def action(db: Session, actor_id: str):
        result = favorite_document(db, document_id, actor_id)
        if result is None:
            raise MCPBridgeError("not_found", "Document not found")
        return {"favorite": result}

    return _run_write_tool(
        tool_name="clouddoc.favorite_document",
        target_type="document",
        target_id=document_id,
        request_payload=payload,
        user_email=user_email,
        action=action,
    )
