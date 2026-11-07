-- Таблицы сервера «Помощника старосты» для PostgreSQL.
-- Создано автоматически из server/app/models.py командой: python tools/export_contract.py

CREATE TABLE groups (
	id VARCHAR(32) NOT NULL, 
	title VARCHAR(60) NOT NULL, 
	university VARCHAR(120) NOT NULL,
	nntu_group VARCHAR(60) NOT NULL, 
	mail_code VARCHAR(40) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_groups_mail_code ON groups (mail_code);

CREATE TABLE users (
	id VARCHAR(32) NOT NULL, 
	login VARCHAR(32) NOT NULL, 
	email VARCHAR(254), 
	name VARCHAR(120) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	email_verified_at TIMESTAMP WITH TIME ZONE, 
	consent_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_users_email ON users (email);
CREATE UNIQUE INDEX ix_users_login ON users (login);

CREATE TABLE audit_log (
	id VARCHAR(32) NOT NULL, 
	user_id VARCHAR(32), 
	group_id VARCHAR(32), 
	action VARCHAR(40) NOT NULL, 
	meta JSON NOT NULL, 
	at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(group_id) REFERENCES groups (id) ON DELETE CASCADE
);

CREATE INDEX ix_audit_log_group_id ON audit_log (group_id);
CREATE INDEX ix_audit_log_user_id ON audit_log (user_id);

CREATE TABLE group_data (
	group_id VARCHAR(32) NOT NULL, 
	rev INTEGER NOT NULL, 
	data JSON NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_by VARCHAR(32), 
	PRIMARY KEY (group_id), 
	FOREIGN KEY(group_id) REFERENCES groups (id) ON DELETE CASCADE, 
	FOREIGN KEY(updated_by) REFERENCES users (id) ON DELETE SET NULL
);


CREATE TABLE invites (
	id VARCHAR(32) NOT NULL, 
	group_id VARCHAR(32) NOT NULL, 
	code_hash VARCHAR(64) NOT NULL, 
	role VARCHAR(10) NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	used_by VARCHAR(32), 
	PRIMARY KEY (id), 
	FOREIGN KEY(group_id) REFERENCES groups (id) ON DELETE CASCADE, 
	UNIQUE (code_hash), 
	FOREIGN KEY(used_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_invites_group_id ON invites (group_id);

CREATE TABLE mail_sources (
	id VARCHAR(32) NOT NULL, 
	group_id VARCHAR(32) NOT NULL, 
	kind VARCHAR(10) NOT NULL, 
	provider VARCHAR(20) NOT NULL, 
	imap_host VARCHAR(120) NOT NULL, 
	imap_login VARCHAR(254) NOT NULL, 
	secret_enc TEXT NOT NULL, 
	last_uid INTEGER NOT NULL, 
	last_checked_at TIMESTAMP WITH TIME ZONE, 
	status VARCHAR(20) NOT NULL, 
	error VARCHAR(300) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(group_id) REFERENCES groups (id) ON DELETE CASCADE
);

CREATE INDEX ix_mail_sources_group_id ON mail_sources (group_id);

CREATE TABLE memberships (
	user_id VARCHAR(32) NOT NULL, 
	group_id VARCHAR(32) NOT NULL, 
	role VARCHAR(10) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (user_id, group_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(group_id) REFERENCES groups (id) ON DELETE CASCADE
);


CREATE TABLE password_resets (
	id VARCHAR(32) NOT NULL, 
	user_id VARCHAR(32) NOT NULL, 
	token_hash VARCHAR(64) NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	used_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	UNIQUE (token_hash)
);

CREATE INDEX ix_password_resets_user_id ON password_resets (user_id);

CREATE TABLE sessions (
	id VARCHAR(32) NOT NULL, 
	user_id VARCHAR(32) NOT NULL, 
	token_hash VARCHAR(64) NOT NULL, 
	user_agent VARCHAR(300) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX ix_sessions_token_hash ON sessions (token_hash);
CREATE INDEX ix_sessions_user_id ON sessions (user_id);

CREATE TABLE mail_messages (
	id VARCHAR(32) NOT NULL, 
	group_id VARCHAR(32) NOT NULL, 
	source_id VARCHAR(32), 
	message_id VARCHAR(300) NOT NULL, 
	from_addr VARCHAR(254) NOT NULL, 
	from_name VARCHAR(200) NOT NULL, 
	teacher_id VARCHAR(32) NOT NULL, 
	subject VARCHAR(300) NOT NULL, 
	text TEXT NOT NULL, 
	attachments JSON NOT NULL, 
	sent_at VARCHAR(40) NOT NULL, 
	received_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (group_id, message_id), 
	FOREIGN KEY(group_id) REFERENCES groups (id) ON DELETE CASCADE, 
	FOREIGN KEY(source_id) REFERENCES mail_sources (id) ON DELETE SET NULL
);

CREATE INDEX ix_mail_messages_group_id ON mail_messages (group_id);

CREATE TABLE inbox_items (
	id VARCHAR(32) NOT NULL, 
	group_id VARCHAR(32) NOT NULL, 
	message_id VARCHAR(32) NOT NULL, 
	suggestion JSON NOT NULL, 
	status VARCHAR(10) NOT NULL, 
	result JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	decided_at TIMESTAMP WITH TIME ZONE, 
	decided_by VARCHAR(32), 
	PRIMARY KEY (id), 
	FOREIGN KEY(group_id) REFERENCES groups (id) ON DELETE CASCADE, 
	FOREIGN KEY(message_id) REFERENCES mail_messages (id) ON DELETE CASCADE, 
	FOREIGN KEY(decided_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_inbox_items_group_id ON inbox_items (group_id);
CREATE INDEX ix_inbox_items_message_id ON inbox_items (message_id);
