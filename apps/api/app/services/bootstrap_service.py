from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentContent, DocumentPermission, DocumentVersion
from app.models.organization import Organization, OrganizationMember
from app.models.space import Space
from app.models.template import Template
from app.models.user import User
from app.services.auth_service import hash_password, is_password_hash_supported
from app.services.document_service import build_default_content, extract_plain_text

DEMO_DOCUMENT_ID = "11111111-1111-1111-1111-111111111111"
MCP_GUEST_EMAIL = "guest@clouddoc.local"


def seed_demo_data(db: Session) -> None:
    ensure_mcp_guest_user(db)
    existing_user = db.scalar(select(User).where(User.email != MCP_GUEST_EMAIL).limit(1))
    if existing_user:
        if existing_user.email == "demo@clouddoc.local" and not is_password_hash_supported(existing_user.password_hash):
            existing_user.password_hash = hash_password("demo123456")
            db.commit()
        seed_templates_if_missing(db)
        return

    user = User(
        name="Demo Owner",
        email="demo@clouddoc.local",
        password_hash=hash_password("demo123456"),
    )
    db.add(user)
    db.flush()

    organization = Organization(name="CloudDoc Demo Org", owner_id=user.id)
    db.add(organization)
    db.flush()

    member = OrganizationMember(
        organization_id=organization.id,
        user_id=user.id,
        role="owner",
        status="active",
    )
    db.add(member)

    space = Space(
        organization_id=organization.id,
        owner_id=user.id,
        name="产品空间",
        space_type="team",
        visibility="organization",
    )
    db.add(space)
    db.flush()

    content_json = build_default_content("CloudDoc V1 产品简介")
    content = DocumentContent(
        document_id="00000000-0000-0000-0000-000000000000",  # placeholder until document exists
        version_no=1,
        schema_version=1,
        content_json=content_json,
        plain_text=extract_plain_text(content_json),
        created_by=user.id,
    )

    document = Document(
        id=DEMO_DOCUMENT_ID,
        space_id=space.id,
        creator_id=user.id,
        owner_id=user.id,
        title="CloudDoc V1 产品简介",
        document_type="doc",
        status="draft",
        visibility="private",
        icon="doc",
        sort_order=1,
        summary="Structured cloud document with continuous document presentation.",
    )
    db.add(document)
    db.flush()

    content.document_id = document.id
    db.add(content)
    db.flush()

    version = DocumentVersion(
        document_id=document.id,
        content_id=content.id,
        version_no=1,
        message="Initial draft",
        created_by=user.id,
    )
    db.add(version)
    db.flush()

    document.current_version_id = version.id
    permission = DocumentPermission(
        document_id=document.id,
        subject_type="organization",
        subject_id=organization.id,
        permission_level="edit",
    )
    db.add(permission)

    templates = build_demo_templates(
        organization_id=organization.id,
        source_document_id=document.id,
        created_by=user.id,
    )
    db.add_all(templates)
    db.commit()


def ensure_mcp_guest_user(db: Session) -> User:
    guest = db.scalar(select(User).where(User.email == MCP_GUEST_EMAIL).limit(1))
    if guest is not None:
        changed = False
        if guest.name != "CloudDoc Guest":
            guest.name = "CloudDoc Guest"
            changed = True
        if not guest.is_active:
            guest.is_active = True
            changed = True
        if not is_password_hash_supported(guest.password_hash):
            guest.password_hash = hash_password("guest-disabled-login")
            changed = True
        membership_delete = db.execute(delete(OrganizationMember).where(OrganizationMember.user_id == guest.id))
        permission_delete = db.execute(
            delete(DocumentPermission)
            .where(DocumentPermission.subject_type == "user")
            .where(DocumentPermission.subject_id == guest.id)
        )
        if changed or membership_delete.rowcount or permission_delete.rowcount:
            db.commit()
        return guest

    guest = User(
        name="CloudDoc Guest",
        email=MCP_GUEST_EMAIL,
        password_hash=hash_password("guest-disabled-login"),
        is_active=True,
    )
    db.add(guest)
    db.flush()
    db.execute(delete(OrganizationMember).where(OrganizationMember.user_id == guest.id))
    db.execute(
        delete(DocumentPermission)
        .where(DocumentPermission.subject_type == "user")
        .where(DocumentPermission.subject_id == guest.id)
    )
    db.commit()
    db.refresh(guest)
    return guest


def build_demo_templates(organization_id: str, source_document_id: str, created_by: str) -> list[Template]:
    return [
        Template(
            organization_id=organization_id,
            source_document_id=source_document_id,
            name="需求文档",
            category="product",
            preview_image=None,
            content_json={
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "heading",
                        "attrs": {"level": 1, "anchor": "overview"},
                        "content": [{"type": "text", "text": "需求文档"}],
                    },
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": "填写背景、目标和范围。"}],
                    },
                    {
                        "type": "heading",
                        "attrs": {"level": 2, "anchor": "requirements"},
                        "content": [{"type": "text", "text": "核心需求"}],
                    },
                    {
                        "type": "bullet_list",
                        "content": [
                            {"type": "list_item", "content": [{"type": "text", "text": "用户场景"}]},
                            {"type": "list_item", "content": [{"type": "text", "text": "功能点"}]},
                            {"type": "list_item", "content": [{"type": "text", "text": "验收标准"}]},
                        ],
                    },
                ],
            },
            status="published",
            created_by=created_by,
        ),
        Template(
            organization_id=organization_id,
            source_document_id=source_document_id,
            name="会议纪要",
            category="team",
            preview_image=None,
            content_json={
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "heading",
                        "attrs": {"level": 1, "anchor": "summary"},
                        "content": [{"type": "text", "text": "会议纪要"}],
                    },
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": "记录会议背景、决策和待办。"}],
                    },
                    {
                        "type": "heading",
                        "attrs": {"level": 2, "anchor": "todo"},
                        "content": [{"type": "text", "text": "待办事项"}],
                    },
                    {
                        "type": "bullet_list",
                        "content": [
                            {"type": "list_item", "content": [{"type": "text", "text": "负责人"}]},
                            {"type": "list_item", "content": [{"type": "text", "text": "截止时间"}]},
                        ],
                    },
                ],
            },
            status="published",
            created_by=created_by,
        ),
    ]


def seed_templates_if_missing(db: Session) -> None:
    existing_template = db.scalar(select(Template.id).limit(1))
    if existing_template:
        return

    user = db.scalar(select(User).order_by(User.created_at.asc()).limit(1))
    organization = db.scalar(select(Organization).order_by(Organization.created_at.asc()).limit(1))
    document = db.scalar(select(Document).order_by(Document.created_at.asc()).limit(1))
    if user is None or organization is None or document is None:
        return

    db.add_all(
        build_demo_templates(
            organization_id=organization.id,
            source_document_id=document.id,
            created_by=user.id,
        )
    )
    db.commit()


def ensure_runtime_schema(db: Session) -> None:
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS folders (
                id UUID PRIMARY KEY,
                space_id UUID NOT NULL REFERENCES spaces(id),
                parent_folder_id UUID REFERENCES folders(id),
                creator_id UUID NOT NULL REFERENCES users(id),
                owner_id UUID NOT NULL REFERENCES users(id),
                title VARCHAR(255) NOT NULL DEFAULT '未命名文件夹',
                visibility VARCHAR(16) NOT NULL DEFAULT 'private',
                icon VARCHAR(32),
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
    )
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_folders_space ON folders(space_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_folder_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_folders_deleted ON folders(is_deleted)"))
    db.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS visibility VARCHAR(16) NOT NULL DEFAULT 'private'"))
    db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE"))
    db.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0"))
    db.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_documents_visibility ON documents(visibility)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_documents_sort_order ON documents(sort_order)"))
    db.execute(text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES comments(id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id)"))
    db.execute(text("ALTER TABLE share_links ADD COLUMN IF NOT EXISTS password_hash TEXT"))
    db.execute(text("ALTER TABLE share_links ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"))
    db.execute(text("ALTER TABLE share_links ADD COLUMN IF NOT EXISTS access_count INTEGER NOT NULL DEFAULT 0"))
    db.execute(text("ALTER TABLE share_links ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ"))
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS mcp_audit_logs (
                id UUID PRIMARY KEY,
                actor_type VARCHAR(32) NOT NULL DEFAULT 'user',
                actor_id UUID REFERENCES users(id),
                tool_name VARCHAR(128) NOT NULL,
                target_type VARCHAR(64),
                target_id VARCHAR(128),
                request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                response_status VARCHAR(32) NOT NULL DEFAULT 'success',
                error_message TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
    )
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_mcp_audit_actor ON mcp_audit_logs(actor_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_mcp_audit_tool ON mcp_audit_logs(tool_name)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_mcp_audit_target ON mcp_audit_logs(target_id)"))
    db.commit()
    ensure_mcp_guest_user(db)
