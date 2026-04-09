from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models.document import Document, DocumentContent, DocumentPermission, DocumentVersion
from app.models.organization import Organization, OrganizationMember
from app.models.space import Space
from app.models.template import Template
from app.models.user import User
from app.services.auth_service import hash_password, is_password_hash_supported
from app.services.document_service import build_default_content, extract_plain_text

DEMO_DOCUMENT_ID = "11111111-1111-1111-1111-111111111111"


def seed_demo_data(db: Session) -> None:
    existing_user = db.scalar(select(User).limit(1))
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
        icon="doc",
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
    db.execute(text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES comments(id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id)"))
    db.commit()
