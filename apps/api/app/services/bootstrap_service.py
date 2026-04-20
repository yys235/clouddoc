from sqlalchemy import delete, inspect, select, text
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
    inspector = inspect(db.bind)
    table_names = set(inspector.get_table_names())

    if "folders" not in table_names:
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
        db.commit()
        inspector = inspect(db.bind)

    document_columns = {column["name"] for column in inspector.get_columns("documents")}
    if "visibility" not in document_columns:
        db.execute(text("ALTER TABLE documents ADD COLUMN visibility VARCHAR(16) NOT NULL DEFAULT 'private'"))
        db.commit()
        inspector = inspect(db.bind)

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "is_super_admin" not in user_columns:
        db.execute(text("ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT FALSE"))
        db.commit()
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS user_preferences (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL UNIQUE REFERENCES users(id),
                document_tree_open_mode VARCHAR(32) NOT NULL DEFAULT 'same-page',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT chk_user_preference_document_tree_open_mode CHECK (document_tree_open_mode IN ('same-page', 'new-window'))
            )
            """
        )
    )
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id)"))
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS user_tree_pins (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id),
                space_id UUID NOT NULL REFERENCES spaces(id),
                parent_folder_id UUID REFERENCES folders(id),
                node_type VARCHAR(32) NOT NULL,
                node_id VARCHAR(128) NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_user_tree_pin_node UNIQUE (user_id, node_type, node_id),
                CONSTRAINT chk_user_tree_pin_node_type CHECK (node_type IN ('folder', 'document'))
            )
            """
        )
    )
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_user_tree_pins_user ON user_tree_pins(user_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_user_tree_pins_space ON user_tree_pins(space_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_user_tree_pins_parent ON user_tree_pins(parent_folder_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_user_tree_pins_node ON user_tree_pins(node_type, node_id)"))
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS folder_favorites (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id),
                folder_id UUID NOT NULL REFERENCES folders(id),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_folder_favorite UNIQUE (user_id, folder_id)
            )
            """
        )
    )
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_folder_favorites_user ON folder_favorites(user_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_folder_favorites_folder ON folder_favorites(folder_id)"))
    db.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0"))
    db.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_documents_visibility ON documents(visibility)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_documents_sort_order ON documents(sort_order)"))
    db.execute(text("ALTER TABLE document_permissions ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES users(id)"))
    db.execute(text("ALTER TABLE document_permissions ADD COLUMN IF NOT EXISTS notify BOOLEAN NOT NULL DEFAULT FALSE"))
    db.execute(text("ALTER TABLE document_permissions ALTER COLUMN subject_id TYPE VARCHAR(128)"))
    db.execute(text("ALTER TABLE document_permissions DROP CONSTRAINT IF EXISTS chk_permission_subject_type"))
    db.execute(text("ALTER TABLE document_permissions DROP CONSTRAINT IF EXISTS chk_permission_level"))
    db.execute(
        text(
            """
            ALTER TABLE document_permissions
            ADD CONSTRAINT chk_permission_subject_type
            CHECK (subject_type IN ('user', 'organization', 'department', 'group', 'space_role', 'link'))
            """
        )
    )
    db.execute(
        text(
            """
            ALTER TABLE document_permissions
            ADD CONSTRAINT chk_permission_level
            CHECK (permission_level IN ('view', 'comment', 'edit', 'manage', 'full_access'))
            """
        )
    )
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS document_permission_settings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                document_id UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
                link_share_scope VARCHAR(32) NOT NULL DEFAULT 'closed',
                external_access_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                comment_scope VARCHAR(32) NOT NULL DEFAULT 'can_edit',
                share_collaborator_scope VARCHAR(32) NOT NULL DEFAULT 'full_access',
                copy_scope VARCHAR(32) NOT NULL DEFAULT 'can_view',
                export_scope VARCHAR(32) NOT NULL DEFAULT 'full_access',
                print_scope VARCHAR(32) NOT NULL DEFAULT 'full_access',
                download_scope VARCHAR(32) NOT NULL DEFAULT 'full_access',
                allow_search_index BOOLEAN NOT NULL DEFAULT FALSE,
                watermark_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                updated_by UUID REFERENCES users(id),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS document_permission_audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                actor_id UUID REFERENCES users(id),
                actor_type VARCHAR(32) NOT NULL DEFAULT 'user',
                action VARCHAR(64) NOT NULL,
                target_type VARCHAR(32),
                target_id VARCHAR(128),
                before_json JSONB,
                after_json JSONB,
                reason TEXT,
                ip_address VARCHAR(64),
                user_agent VARCHAR(512),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    db.execute(text("ALTER TABLE document_permission_settings DROP CONSTRAINT IF EXISTS document_permission_settings_document_id_fkey"))
    db.execute(
        text(
            """
            ALTER TABLE document_permission_settings
            ADD CONSTRAINT document_permission_settings_document_id_fkey
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
            """
        )
    )
    db.execute(text("ALTER TABLE document_permission_audit_logs DROP CONSTRAINT IF EXISTS document_permission_audit_logs_document_id_fkey"))
    db.execute(
        text(
            """
            ALTER TABLE document_permission_audit_logs
            ADD CONSTRAINT document_permission_audit_logs_document_id_fkey
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
            """
        )
    )
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_document_permission_settings_document ON document_permission_settings(document_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_document_permission_audit_document ON document_permission_audit_logs(document_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_document_permission_audit_actor ON document_permission_audit_logs(actor_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_document_permission_audit_action ON document_permission_audit_logs(action)"))
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
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS event_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                event_type VARCHAR(64) NOT NULL,
                actor_id VARCHAR(128),
                space_id VARCHAR(128),
                document_id VARCHAR(128),
                folder_id VARCHAR(128),
                target_type VARCHAR(32) NOT NULL,
                target_id VARCHAR(128),
                payload JSONB NOT NULL,
                visible_user_ids JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    db.execute(text("ALTER TABLE event_logs DROP CONSTRAINT IF EXISTS event_logs_actor_id_fkey"))
    db.execute(text("ALTER TABLE event_logs DROP CONSTRAINT IF EXISTS event_logs_space_id_fkey"))
    db.execute(text("ALTER TABLE event_logs DROP CONSTRAINT IF EXISTS event_logs_document_id_fkey"))
    db.execute(text("ALTER TABLE event_logs DROP CONSTRAINT IF EXISTS event_logs_folder_id_fkey"))
    db.execute(text("ALTER TABLE event_logs ALTER COLUMN actor_id TYPE VARCHAR(128)"))
    db.execute(text("ALTER TABLE event_logs ALTER COLUMN space_id TYPE VARCHAR(128)"))
    db.execute(text("ALTER TABLE event_logs ALTER COLUMN document_id TYPE VARCHAR(128)"))
    db.execute(text("ALTER TABLE event_logs ALTER COLUMN folder_id TYPE VARCHAR(128)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_event_logs_type ON event_logs(event_type)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_event_logs_actor ON event_logs(actor_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_event_logs_space ON event_logs(space_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_event_logs_document ON event_logs(document_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_event_logs_folder ON event_logs(folder_id)"))
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS integrations (
                id UUID PRIMARY KEY,
                organization_id UUID REFERENCES organizations(id),
                created_by UUID NOT NULL REFERENCES users(id),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                icon_url VARCHAR(512),
                status VARCHAR(32) NOT NULL DEFAULT 'active',
                client_id VARCHAR(128) NOT NULL UNIQUE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
    )
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_integrations_created_by ON integrations(created_by)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_integrations_client_id ON integrations(client_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status)"))
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS integration_tokens (
                id UUID PRIMARY KEY,
                integration_id UUID REFERENCES integrations(id),
                user_id UUID NOT NULL REFERENCES users(id),
                token_type VARCHAR(32) NOT NULL DEFAULT 'personal',
                token_prefix VARCHAR(32) NOT NULL,
                token_hash VARCHAR(128) NOT NULL UNIQUE,
                name VARCHAR(255) NOT NULL,
                scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
                expires_at TIMESTAMPTZ,
                revoked_at TIMESTAMPTZ,
                last_used_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
    )
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_integration_tokens_integration ON integration_tokens(integration_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_integration_tokens_user ON integration_tokens(user_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_integration_tokens_prefix ON integration_tokens(token_prefix)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_integration_tokens_hash ON integration_tokens(token_hash)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_integration_tokens_revoked ON integration_tokens(revoked_at)"))
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS integration_resource_scopes (
                id UUID PRIMARY KEY,
                integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
                resource_type VARCHAR(32) NOT NULL,
                resource_id VARCHAR(128),
                include_children BOOLEAN NOT NULL DEFAULT FALSE,
                permission_level VARCHAR(32) NOT NULL DEFAULT 'view',
                created_by UUID NOT NULL REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
    )
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_integration_scopes_integration ON integration_resource_scopes(integration_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_integration_scopes_resource ON integration_resource_scopes(resource_type, resource_id)"))
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS integration_audit_logs (
                id UUID PRIMARY KEY,
                integration_id UUID REFERENCES integrations(id),
                token_id UUID REFERENCES integration_tokens(id),
                actor_id UUID REFERENCES users(id),
                actor_type VARCHAR(32) NOT NULL DEFAULT 'user',
                source VARCHAR(32) NOT NULL DEFAULT 'rest_open_api',
                operation VARCHAR(128) NOT NULL,
                target_type VARCHAR(64),
                target_id VARCHAR(128),
                request_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
                response_status VARCHAR(32) NOT NULL DEFAULT 'success',
                error_message TEXT,
                ip_address VARCHAR(64),
                user_agent VARCHAR(512),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
    )
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_integration_audit_integration ON integration_audit_logs(integration_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_integration_audit_token ON integration_audit_logs(token_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_integration_audit_actor ON integration_audit_logs(actor_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_integration_audit_operation ON integration_audit_logs(operation)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_integration_audit_target ON integration_audit_logs(target_id)"))
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS integration_webhooks (
                id UUID PRIMARY KEY,
                integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
                url VARCHAR(1024) NOT NULL,
                secret_hash VARCHAR(128) NOT NULL,
                secret_value TEXT,
                event_types JSONB NOT NULL DEFAULT '[]'::jsonb,
                status VARCHAR(32) NOT NULL DEFAULT 'active',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
    )
    db.execute(text("ALTER TABLE integration_webhooks ADD COLUMN IF NOT EXISTS secret_value TEXT"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_integration_webhooks_integration ON integration_webhooks(integration_id)"))
    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS integration_webhook_deliveries (
                id UUID PRIMARY KEY,
                webhook_id UUID NOT NULL REFERENCES integration_webhooks(id) ON DELETE CASCADE,
                event_type VARCHAR(64) NOT NULL,
                payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                response_status VARCHAR(32),
                attempt_count INTEGER NOT NULL DEFAULT 0,
                next_retry_at TIMESTAMPTZ,
                delivered_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
    )
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_integration_webhook_deliveries_webhook ON integration_webhook_deliveries(webhook_id)"))
    db.commit()
    ensure_mcp_guest_user(db)
