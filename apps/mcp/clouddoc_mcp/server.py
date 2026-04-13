from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from typing import Any, Callable

from .bridge import (
    MCPBridgeError,
    create_comment_tool,
    create_document_tool,
    delete_comment_tool,
    delete_document_tool,
    favorite_document_tool,
    get_comments_tool,
    get_document_tool,
    get_shared_document_tool,
    initialize_database,
    list_documents_tool,
    list_spaces_tool,
    reply_comment_tool,
    restore_document_tool,
    search_documents_tool,
    update_comment_tool,
    update_document_content_tool,
)


@dataclass(frozen=True)
class MCPServerConfig:
    transport: str = "streamable-http"
    host: str = "127.0.0.1"
    port: int = 8010
    path: str = "/mcp"
    stateless_http: bool = True
    json_response: bool = True


def _wrap_tool(fn: Callable[..., dict[str, Any]], **kwargs: Any) -> dict[str, Any]:
    try:
        return fn(**kwargs)
    except MCPBridgeError as exc:
        return exc.to_payload()


def _parse_bool(value: str | None, *, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_port(value: str | None, *, default: int) -> int:
    if value is None or not value.strip():
        return default
    try:
        port = int(value)
    except ValueError:
        return default
    return port if 0 < port < 65536 else default


def _normalize_path(value: str | None, *, default: str) -> str:
    if value is None or not value.strip():
        return default
    path = value.strip()
    return path if path.startswith("/") else f"/{path}"


def load_config(argv: list[str] | None = None) -> MCPServerConfig:
    parser = argparse.ArgumentParser(description="Run the CloudDoc MCP server.")
    parser.add_argument(
        "--transport",
        choices=["streamable-http", "stdio", "sse"],
        default=os.getenv("CLOUDDOC_MCP_TRANSPORT", "streamable-http"),
        help="MCP transport. Defaults to streamable-http.",
    )
    parser.add_argument("--host", default=os.getenv("CLOUDDOC_MCP_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=_parse_port(os.getenv("CLOUDDOC_MCP_PORT"), default=8010))
    parser.add_argument("--path", default=_normalize_path(os.getenv("CLOUDDOC_MCP_PATH"), default="/mcp"))
    parser.add_argument(
        "--stateful",
        action="store_true",
        help="Use stateful Streamable HTTP sessions. The default is stateless.",
    )
    parser.add_argument(
        "--text-response",
        action="store_true",
        help="Disable JSON responses for Streamable HTTP.",
    )
    args = parser.parse_args(argv)

    return MCPServerConfig(
        transport=args.transport,
        host=args.host,
        port=args.port,
        path=_normalize_path(args.path, default="/mcp"),
        stateless_http=not args.stateful and _parse_bool(os.getenv("CLOUDDOC_MCP_STATELESS_HTTP"), default=True),
        json_response=not args.text_response and _parse_bool(os.getenv("CLOUDDOC_MCP_JSON_RESPONSE"), default=True),
    )


def build_server(config: MCPServerConfig | None = None):
    from mcp.server.fastmcp import FastMCP

    resolved_config = config or MCPServerConfig()
    mcp = FastMCP(
        "CloudDoc",
        host=resolved_config.host,
        port=resolved_config.port,
        streamable_http_path=resolved_config.path,
        stateless_http=resolved_config.stateless_http,
        json_response=resolved_config.json_response,
    )

    @mcp.tool(name="clouddoc.list_documents")
    def list_documents(
        state: str = "active",
        limit: int = 50,
        folder_id: str | None = None,
        user_email: str | None = None,
    ) -> dict[str, Any]:
        return _wrap_tool(list_documents_tool, state=state, limit=limit, folder_id=folder_id, user_email=user_email)

    @mcp.tool(name="clouddoc.search_documents")
    def search_documents(
        query: str,
        limit: int = 20,
        folder_id: str | None = None,
        user_email: str | None = None,
    ) -> dict[str, Any]:
        return _wrap_tool(search_documents_tool, query=query, limit=limit, folder_id=folder_id, user_email=user_email)

    @mcp.tool(name="clouddoc.get_document")
    def get_document(document_id: str, user_email: str | None = None) -> dict[str, Any]:
        return _wrap_tool(get_document_tool, document_id=document_id, user_email=user_email)

    @mcp.tool(name="clouddoc.get_comments")
    def get_comments(document_id: str, user_email: str | None = None) -> dict[str, Any]:
        return _wrap_tool(get_comments_tool, document_id=document_id, user_email=user_email)

    @mcp.tool(name="clouddoc.list_spaces")
    def list_spaces(user_email: str | None = None) -> dict[str, Any]:
        return _wrap_tool(list_spaces_tool, user_email=user_email)

    @mcp.tool(name="clouddoc.get_shared_document")
    def get_shared_document(token: str, password: str | None = None) -> dict[str, Any]:
        return _wrap_tool(get_shared_document_tool, token=token, password=password)

    @mcp.tool(name="clouddoc.create_document")
    def create_document(
        space_id: str,
        title: str,
        document_type: str = "doc",
        visibility: str = "private",
        folder_id: str | None = None,
        user_email: str | None = None,
    ) -> dict[str, Any]:
        return _wrap_tool(
            create_document_tool,
            space_id=space_id,
            title=title,
            document_type=document_type,
            visibility=visibility,
            folder_id=folder_id,
            user_email=user_email,
        )

    @mcp.tool(name="clouddoc.update_document_content")
    def update_document_content(
        document_id: str,
        content_json: dict[str, Any],
        plain_text: str = "",
        schema_version: int = 1,
        base_version_no: int | None = None,
        user_email: str | None = None,
    ) -> dict[str, Any]:
        return _wrap_tool(
            update_document_content_tool,
            document_id=document_id,
            content_json=content_json,
            plain_text=plain_text,
            schema_version=schema_version,
            base_version_no=base_version_no,
            user_email=user_email,
        )

    @mcp.tool(name="clouddoc.delete_document")
    def delete_document(document_id: str, user_email: str | None = None) -> dict[str, Any]:
        return _wrap_tool(delete_document_tool, document_id=document_id, user_email=user_email)

    @mcp.tool(name="clouddoc.restore_document")
    def restore_document(document_id: str, user_email: str | None = None) -> dict[str, Any]:
        return _wrap_tool(restore_document_tool, document_id=document_id, user_email=user_email)

    @mcp.tool(name="clouddoc.create_comment")
    def create_comment(
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
        return _wrap_tool(
            create_comment_tool,
            document_id=document_id,
            block_id=block_id,
            start_offset=start_offset,
            end_offset=end_offset,
            quote_text=quote_text,
            body=body,
            prefix_text=prefix_text,
            suffix_text=suffix_text,
            user_email=user_email,
        )

    @mcp.tool(name="clouddoc.reply_comment")
    def reply_comment(
        thread_id: str,
        body: str,
        parent_comment_id: str | None = None,
        user_email: str | None = None,
    ) -> dict[str, Any]:
        return _wrap_tool(
            reply_comment_tool,
            thread_id=thread_id,
            body=body,
            parent_comment_id=parent_comment_id,
            user_email=user_email,
        )

    @mcp.tool(name="clouddoc.update_comment")
    def update_comment(comment_id: str, body: str, user_email: str | None = None) -> dict[str, Any]:
        return _wrap_tool(update_comment_tool, comment_id=comment_id, body=body, user_email=user_email)

    @mcp.tool(name="clouddoc.delete_comment")
    def delete_comment(comment_id: str, user_email: str | None = None) -> dict[str, Any]:
        return _wrap_tool(delete_comment_tool, comment_id=comment_id, user_email=user_email)

    @mcp.tool(name="clouddoc.favorite_document")
    def favorite_document(document_id: str, user_email: str | None = None) -> dict[str, Any]:
        return _wrap_tool(favorite_document_tool, document_id=document_id, user_email=user_email)

    return mcp


def main(argv: list[str] | None = None) -> None:
    config = load_config(argv)
    initialize_database()
    try:
        build_server(config).run(transport=config.transport)
    except KeyboardInterrupt:
        return


if __name__ == "__main__":
    main()
