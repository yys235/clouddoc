CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(512),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(32) NOT NULL DEFAULT 'member',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_org_member UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    email VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'member',
    invited_by UUID NOT NULL REFERENCES users(id),
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id),
    document_tree_open_mode VARCHAR(32) NOT NULL DEFAULT 'same-page',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_user_preference_document_tree_open_mode CHECK (document_tree_open_mode IN ('same-page', 'new-window'))
);

CREATE TABLE IF NOT EXISTS spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    owner_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(120) NOT NULL,
    space_type VARCHAR(32) NOT NULL DEFAULT 'personal',
    visibility VARCHAR(32) NOT NULL DEFAULT 'private',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_space_type CHECK (space_type IN ('personal', 'team')),
    CONSTRAINT chk_space_visibility CHECK (visibility IN ('private', 'organization', 'public'))
);

CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES spaces(id),
    parent_folder_id UUID REFERENCES folders(id),
    creator_id UUID NOT NULL REFERENCES users(id),
    owner_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL DEFAULT '未命名文件夹',
    visibility VARCHAR(16) NOT NULL DEFAULT 'private',
    icon VARCHAR(32),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tree_shortcuts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES users(id),
    space_id UUID NOT NULL REFERENCES spaces(id),
    parent_folder_id UUID REFERENCES folders(id),
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(128) NOT NULL,
    title_override VARCHAR(255),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_tree_shortcut_target_type CHECK (target_type IN ('folder', 'document'))
);

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
    CONSTRAINT chk_user_tree_pin_node_type CHECK (node_type IN ('folder', 'document', 'shortcut'))
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES spaces(id),
    parent_id UUID REFERENCES documents(id),
    folder_id UUID REFERENCES folders(id),
    creator_id UUID NOT NULL REFERENCES users(id),
    owner_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL DEFAULT 'Untitled',
    document_type VARCHAR(32) NOT NULL DEFAULT 'doc',
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    visibility VARCHAR(16) NOT NULL DEFAULT 'private',
    icon VARCHAR(32),
    sort_order INTEGER NOT NULL DEFAULT 0,
    cover_url VARCHAR(512),
    summary TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    current_version_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_document_type CHECK (document_type IN ('doc', 'pdf', 'sheet', 'board', 'form', 'database'))
);

CREATE TABLE IF NOT EXISTS document_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    version_no INTEGER NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    content_json JSONB NOT NULL,
    plain_text TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_content_version UNIQUE (document_id, version_no)
);

CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    content_id UUID NOT NULL REFERENCES document_contents(id),
    version_no INTEGER NOT NULL,
    message VARCHAR(255),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_version UNIQUE (document_id, version_no)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_documents_current_version'
    ) THEN
        ALTER TABLE documents
            ADD CONSTRAINT fk_documents_current_version
            FOREIGN KEY (current_version_id)
            REFERENCES document_versions(id);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS document_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    subject_type VARCHAR(32) NOT NULL,
    subject_id VARCHAR(128) NOT NULL,
    permission_level VARCHAR(32) NOT NULL DEFAULT 'view',
    invited_by UUID REFERENCES users(id),
    notify BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_permission_subject UNIQUE (document_id, subject_type, subject_id),
    CONSTRAINT chk_permission_subject_type CHECK (subject_type IN ('user', 'organization', 'department', 'group', 'space_role', 'link')),
    CONSTRAINT chk_permission_level CHECK (permission_level IN ('view', 'comment', 'edit', 'manage', 'full_access'))
);

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
);

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
);

CREATE TABLE IF NOT EXISTS document_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    document_id UUID NOT NULL REFERENCES documents(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_favorite UNIQUE (user_id, document_id)
);

CREATE TABLE IF NOT EXISTS folder_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    folder_id UUID NOT NULL REFERENCES folders(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_folder_favorite UNIQUE (user_id, folder_id)
);

CREATE TABLE IF NOT EXISTS comment_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    anchor_block_id VARCHAR(128) NOT NULL,
    anchor_start_offset INTEGER NOT NULL,
    anchor_end_offset INTEGER NOT NULL,
    quote_text TEXT NOT NULL,
    prefix_text TEXT,
    suffix_text TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_comment_thread_status CHECK (status IN ('open', 'resolved'))
);

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES comment_threads(id),
    document_id UUID NOT NULL REFERENCES documents(id),
    parent_comment_id UUID REFERENCES comments(id),
    author_id UUID NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    user_agent VARCHAR(512),
    ip_address VARCHAR(64),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    actor_id UUID REFERENCES users(id),
    document_id UUID REFERENCES documents(id),
    thread_id UUID REFERENCES comment_threads(id),
    comment_id UUID REFERENCES comments(id),
    notification_type VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    token VARCHAR(128) NOT NULL UNIQUE,
    access_scope VARCHAR(32) NOT NULL DEFAULT 'private',
    permission_level VARCHAR(32) NOT NULL DEFAULT 'view',
    password_hash TEXT,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    allow_copy BOOLEAN NOT NULL DEFAULT FALSE,
    allow_export BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_share_access_scope CHECK (access_scope IN ('private', 'organization', 'public')),
    CONSTRAINT chk_share_permission_level CHECK (permission_level IN ('view', 'edit'))
);

CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    source_document_id UUID REFERENCES documents(id),
    name VARCHAR(120) NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'general',
    preview_image VARCHAR(512),
    content_json JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'published',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    created_by UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon_url VARCHAR(512),
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    client_id VARCHAR(128) NOT NULL UNIQUE,
    oauth_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    redirect_uris JSONB NOT NULL DEFAULT '[]'::jsonb,
    client_secret_prefix VARCHAR(32),
    client_secret_hash VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_resource_scopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    resource_type VARCHAR(32) NOT NULL,
    resource_id VARCHAR(128),
    include_children BOOLEAN NOT NULL DEFAULT FALSE,
    permission_level VARCHAR(32) NOT NULL DEFAULT 'view',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    url VARCHAR(1024) NOT NULL,
    secret_hash VARCHAR(128) NOT NULL,
    secret_value TEXT,
    event_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES integration_webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_status VARCHAR(32),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_prefix VARCHAR(32) NOT NULL,
    code_hash VARCHAR(128) NOT NULL UNIQUE,
    redirect_uri VARCHAR(1024) NOT NULL,
    scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_prefix VARCHAR(32) NOT NULL,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    initialized BOOLEAN NOT NULL DEFAULT FALSE,
    initialized_at TIMESTAMPTZ,
    initialized_by UUID REFERENCES users(id),
    product_name VARCHAR(120) NOT NULL DEFAULT 'CloudDoc',
    allow_public_documents BOOLEAN NOT NULL DEFAULT TRUE,
    allow_share_links BOOLEAN NOT NULL DEFAULT TRUE,
    share_password_required_by_default BOOLEAN NOT NULL DEFAULT FALSE,
    allow_guest_public_read BOOLEAN NOT NULL DEFAULT TRUE,
    allow_user_pat BOOLEAN NOT NULL DEFAULT TRUE,
    allow_open_api BOOLEAN NOT NULL DEFAULT TRUE,
    allow_demo_data BOOLEAN NOT NULL DEFAULT FALSE,
    schema_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type VARCHAR(32) NOT NULL DEFAULT 'system',
    actor_id UUID REFERENCES users(id),
    action VARCHAR(128) NOT NULL,
    target_type VARCHAR(64),
    target_id VARCHAR(128),
    payload JSONB,
    ip_address VARCHAR(64),
    user_agent VARCHAR(512),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mcp_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type VARCHAR(32) NOT NULL DEFAULT 'user',
    actor_id UUID REFERENCES users(id),
    tool_name VARCHAR(128) NOT NULL,
    target_type VARCHAR(64),
    target_id VARCHAR(128),
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_status VARCHAR(32) NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_invited_by ON organization_invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_org_invitations_expires ON organization_invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_spaces_owner ON spaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_space ON documents(space_id);
CREATE INDEX IF NOT EXISTS idx_documents_parent ON documents(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_creator ON documents(creator_id);
CREATE INDEX IF NOT EXISTS idx_documents_sort_order ON documents(sort_order);
CREATE INDEX IF NOT EXISTS idx_folders_space ON folders(space_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_folders_creator ON folders(creator_id);
CREATE INDEX IF NOT EXISTS idx_folders_owner ON folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_folders_visibility ON folders(visibility);
CREATE INDEX IF NOT EXISTS idx_folders_deleted ON folders(is_deleted);
CREATE INDEX IF NOT EXISTS idx_tree_shortcuts_owner ON tree_shortcuts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tree_shortcuts_space ON tree_shortcuts(space_id);
CREATE INDEX IF NOT EXISTS idx_tree_shortcuts_parent ON tree_shortcuts(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_tree_shortcuts_target ON tree_shortcuts(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_tree_shortcuts_deleted ON tree_shortcuts(is_deleted);
CREATE INDEX IF NOT EXISTS idx_user_tree_pins_user ON user_tree_pins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tree_pins_space ON user_tree_pins(space_id);
CREATE INDEX IF NOT EXISTS idx_user_tree_pins_parent ON user_tree_pins(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_user_tree_pins_node ON user_tree_pins(node_type, node_id);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_visibility ON documents(visibility);
CREATE INDEX IF NOT EXISTS idx_documents_deleted ON documents(is_deleted);
CREATE INDEX IF NOT EXISTS idx_document_contents_document ON document_contents(document_id);
CREATE INDEX IF NOT EXISTS idx_document_contents_created_by ON document_contents(created_by);
CREATE INDEX IF NOT EXISTS idx_document_versions_document ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_content ON document_versions(content_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_created_by ON document_versions(created_by);
CREATE INDEX IF NOT EXISTS idx_document_permissions_document ON document_permissions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_permissions_subject ON document_permissions(subject_id);
CREATE INDEX IF NOT EXISTS idx_document_permission_settings_document ON document_permission_settings(document_id);
CREATE INDEX IF NOT EXISTS idx_document_permission_audit_document ON document_permission_audit_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_document_permission_audit_actor ON document_permission_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_document_permission_audit_action ON document_permission_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_document_favorites_user ON document_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_document_favorites_document ON document_favorites(document_id);
CREATE INDEX IF NOT EXISTS idx_folder_favorites_user ON folder_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_folder_favorites_folder ON folder_favorites(folder_id);
CREATE INDEX IF NOT EXISTS idx_comment_threads_document ON comment_threads(document_id);
CREATE INDEX IF NOT EXISTS idx_comment_threads_block ON comment_threads(anchor_block_id);
CREATE INDEX IF NOT EXISTS idx_comment_threads_created_by ON comment_threads(created_by);
CREATE INDEX IF NOT EXISTS idx_comments_thread ON comments(thread_id);
CREATE INDEX IF NOT EXISTS idx_comments_document ON comments(document_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_revoked ON user_sessions(revoked_at);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_read ON user_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_thread ON user_notifications(thread_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_actor ON user_notifications(actor_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_document ON user_notifications(document_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_comment ON user_notifications(comment_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON user_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_share_links_document ON share_links(document_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_created_by ON share_links(created_by);
CREATE INDEX IF NOT EXISTS idx_templates_org ON templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON templates(created_by);
CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrations_created_by ON integrations(created_by);
CREATE INDEX IF NOT EXISTS idx_integrations_client_id ON integrations(client_id);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);
CREATE INDEX IF NOT EXISTS idx_integrations_client_secret_prefix ON integrations(client_secret_prefix);
CREATE INDEX IF NOT EXISTS idx_integrations_client_secret_hash ON integrations(client_secret_hash);
CREATE INDEX IF NOT EXISTS idx_integration_tokens_integration ON integration_tokens(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_tokens_user ON integration_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_tokens_type ON integration_tokens(token_type);
CREATE INDEX IF NOT EXISTS idx_integration_tokens_prefix ON integration_tokens(token_prefix);
CREATE INDEX IF NOT EXISTS idx_integration_tokens_hash ON integration_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_integration_tokens_expires ON integration_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_integration_tokens_revoked ON integration_tokens(revoked_at);
CREATE INDEX IF NOT EXISTS idx_integration_scopes_integration ON integration_resource_scopes(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_scopes_resource ON integration_resource_scopes(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_integration_scopes_created_by ON integration_resource_scopes(created_by);
CREATE INDEX IF NOT EXISTS idx_integration_audit_integration ON integration_audit_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_audit_token ON integration_audit_logs(token_id);
CREATE INDEX IF NOT EXISTS idx_integration_audit_actor ON integration_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_integration_audit_source ON integration_audit_logs(source);
CREATE INDEX IF NOT EXISTS idx_integration_audit_operation ON integration_audit_logs(operation);
CREATE INDEX IF NOT EXISTS idx_integration_audit_target ON integration_audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_integration_audit_response_status ON integration_audit_logs(response_status);
CREATE INDEX IF NOT EXISTS idx_integration_webhooks_integration ON integration_webhooks(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_webhooks_status ON integration_webhooks(status);
CREATE INDEX IF NOT EXISTS idx_integration_webhook_deliveries_webhook ON integration_webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_integration_webhook_deliveries_type ON integration_webhook_deliveries(event_type);
CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_integration ON oauth_authorization_codes(integration_id);
CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_user ON oauth_authorization_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_prefix ON oauth_authorization_codes(code_prefix);
CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_hash ON oauth_authorization_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_expires ON oauth_authorization_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_consumed ON oauth_authorization_codes(consumed_at);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_integration ON oauth_refresh_tokens(integration_id);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_user ON oauth_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_prefix ON oauth_refresh_tokens(token_prefix);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_hash ON oauth_refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_expires ON oauth_refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_revoked ON oauth_refresh_tokens(revoked_at);
CREATE INDEX IF NOT EXISTS idx_system_settings_initialized ON system_settings(initialized);
CREATE INDEX IF NOT EXISTS idx_system_settings_initialized_by ON system_settings(initialized_by);
CREATE INDEX IF NOT EXISTS idx_system_audit_actor_type ON system_audit_logs(actor_type);
CREATE INDEX IF NOT EXISTS idx_system_audit_actor ON system_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_action ON system_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_audit_target ON system_audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_actor ON mcp_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_tool ON mcp_audit_logs(tool_name);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_target ON mcp_audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_type ON event_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_event_logs_actor ON event_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_space ON event_logs(space_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_document ON event_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_folder ON event_logs(folder_id);
CREATE INDEX IF NOT EXISTS idx_document_contents_search ON document_contents USING GIN (to_tsvector('simple', plain_text));
