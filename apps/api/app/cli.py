from __future__ import annotations

import argparse
import json
import sys

from fastapi import HTTPException

from app.core.db import SessionLocal, init_db
from app.schemas.system import BootstrapInitializeRequest
from app.services.system_service import initialize_system_from_cli


def _str_to_bool(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "y", "on"}:
        return True
    if normalized in {"0", "false", "no", "n", "off"}:
        return False
    raise argparse.ArgumentTypeError(f"invalid boolean value: {value}")


def _add_bool_option(parser: argparse.ArgumentParser, name: str, *, default: bool, help_text: str) -> None:
    parser.add_argument(
        f"--{name.replace('_', '-')}",
        dest=name,
        type=_str_to_bool,
        default=default,
        metavar="true|false",
        help=f"{help_text} 默认：{str(default).lower()}",
    )


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="CloudDoc 管理命令")
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser(
        "init-system",
        help="无人值守初始化 CloudDoc 系统、超级管理员、组织、空间和默认目录。",
    )
    init_parser.add_argument("--admin-email", required=True, help="超级管理员邮箱")
    init_parser.add_argument("--admin-name", required=True, help="超级管理员显示名")
    init_parser.add_argument("--admin-password", required=True, help="超级管理员初始密码，至少 8 位")
    init_parser.add_argument("--organization-name", required=True, help="默认组织名称")
    init_parser.add_argument("--space-name", required=True, help="默认空间名称")
    init_parser.add_argument(
        "--space-visibility",
        choices=["private", "organization"],
        default="organization",
        help="默认空间可见性",
    )
    _add_bool_option(init_parser, "allow_public_documents", default=True, help_text="允许公开文档")
    _add_bool_option(init_parser, "allow_share_links", default=True, help_text="允许分享链接")
    _add_bool_option(
        init_parser,
        "share_password_required_by_default",
        default=False,
        help_text="分享默认要求密码",
    )
    _add_bool_option(init_parser, "allow_guest_public_read", default=True, help_text="允许访客读取公开文档")
    _add_bool_option(init_parser, "allow_user_pat", default=True, help_text="允许个人 AI Token")
    _add_bool_option(init_parser, "allow_open_api", default=True, help_text="允许开放 API / MCP 接入")
    _add_bool_option(init_parser, "import_demo_data", default=False, help_text="初始化示例文档")
    return parser


def init_system(args: argparse.Namespace) -> int:
    init_db()
    payload = BootstrapInitializeRequest(
        admin_email=args.admin_email,
        admin_name=args.admin_name,
        admin_password=args.admin_password,
        organization_name=args.organization_name,
        space_name=args.space_name,
        space_visibility=args.space_visibility,
        allow_public_documents=args.allow_public_documents,
        allow_share_links=args.allow_share_links,
        share_password_required_by_default=args.share_password_required_by_default,
        allow_guest_public_read=args.allow_guest_public_read,
        allow_user_pat=args.allow_user_pat,
        allow_open_api=args.allow_open_api,
        import_demo_data=args.import_demo_data,
    )
    db = SessionLocal()
    try:
        result = initialize_system_from_cli(db, payload)
    finally:
        db.close()
    print(json.dumps(result.model_dump(mode="json"), ensure_ascii=False, indent=2))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "init-system":
            return init_system(args)
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else json.dumps(exc.detail, ensure_ascii=False)
        print(f"error: {detail}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    parser.error(f"unknown command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
