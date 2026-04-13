from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
API_ROOT = ROOT / "apps" / "api"
MCP_ROOT = ROOT / "apps" / "mcp"
for path in (str(API_ROOT), str(MCP_ROOT)):
    if path not in sys.path:
        sys.path.insert(0, path)

from clouddoc_mcp.server import MCPServerConfig, build_server, load_config


def test_streamable_http_config_defaults() -> None:
    config = load_config([])

    assert config.transport == "streamable-http"
    assert config.host == "127.0.0.1"
    assert config.port == 8010
    assert config.path == "/mcp"
    assert config.stateless_http is True
    assert config.json_response is True


def test_streamable_http_server_settings() -> None:
    server = build_server(MCPServerConfig(host="0.0.0.0", port=8011, path="/cloud-mcp"))

    assert server.settings.host == "0.0.0.0"
    assert server.settings.port == 8011
    assert server.settings.streamable_http_path == "/cloud-mcp"
    assert server.settings.stateless_http is True
    assert server.settings.json_response is True
