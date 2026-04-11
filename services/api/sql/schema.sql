SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(60) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  auth_type VARCHAR(20) NOT NULL,
  supabase_user_id VARCHAR(255) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  nickname VARCHAR(40) NOT NULL,
  is_temporary TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uniq_users_supabase (supabase_user_id),
  INDEX idx_users_auth_type (auth_type, is_active),
  INDEX idx_users_email (email)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  session_token_hash CHAR(64) NOT NULL,
  session_kind VARCHAR(20) NOT NULL DEFAULT 'app',
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uniq_auth_sessions_token (session_token_hash),
  INDEX idx_auth_sessions_user (user_id, revoked_at, expires_at),
  CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_word_challenges (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  challenge_date DATE NOT NULL UNIQUE,
  public_title VARCHAR(120) NOT NULL DEFAULT '오늘의 단어',
  hidden_answer_text VARCHAR(160) NOT NULL,
  hidden_category_id INT NOT NULL,
  fixed_hint_text VARCHAR(255) DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_daily_word_category FOREIGN KEY (hidden_category_id)
    REFERENCES categories(id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS daily_word_synonyms (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  challenge_id BIGINT NOT NULL,
  synonym_text VARCHAR(160) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_daily_word_synonym (challenge_id, synonym_text),
  CONSTRAINT fk_daily_word_synonym_challenge FOREIGN KEY (challenge_id)
    REFERENCES daily_word_challenges(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_word_ai_hints (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  challenge_id BIGINT NOT NULL,
  hint_index INT NOT NULL,
  revealed_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_daily_word_ai_hint (challenge_id, hint_index),
  CONSTRAINT fk_daily_word_ai_hint_challenge FOREIGN KEY (challenge_id)
    REFERENCES daily_word_challenges(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prompt_rooms (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  open_date DATE NOT NULL,
  category_id INT NOT NULL,
  title_as_answer VARCHAR(160) NOT NULL,
  answer_type VARCHAR(20) NOT NULL DEFAULT 'word',
  max_input_chars INT NOT NULL,
  threshold_score INT NOT NULL,
  teaser_text VARCHAR(255) DEFAULT NULL,
  tone VARCHAR(255) DEFAULT NULL,
  ai_review_json JSON DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_prompt_room_open_title (open_date, title_as_answer),
  INDEX idx_prompt_rooms_listing (open_date, status, category_id, id),
  CONSTRAINT fk_prompt_room_category FOREIGN KEY (category_id)
    REFERENCES categories(id)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS prompt_room_proposals (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  proposer_user_id BIGINT DEFAULT NULL,
  proposer_session_id VARCHAR(80) NOT NULL,
  proposer_nickname VARCHAR(40) NOT NULL,
  category_id INT NOT NULL,
  proposed_answer VARCHAR(160) NOT NULL,
  answer_type VARCHAR(20) NOT NULL DEFAULT 'word',
  proposal_note TEXT DEFAULT NULL,
  ai_review_json JSON DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  review_note TEXT DEFAULT NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  reviewed_by_user_id BIGINT DEFAULT NULL,
  approved_room_id BIGINT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_prompt_proposal_user (proposer_user_id),
  INDEX idx_prompt_proposal_status (status, created_at),
  CONSTRAINT fk_prompt_proposal_category FOREIGN KEY (category_id)
    REFERENCES categories(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_prompt_proposal_user FOREIGN KEY (proposer_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_prompt_proposal_review_user FOREIGN KEY (reviewed_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_prompt_proposal_room FOREIGN KEY (approved_room_id)
    REFERENCES prompt_rooms(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS participants (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  mode VARCHAR(20) NOT NULL,
  target_id BIGINT NOT NULL,
  user_id BIGINT DEFAULT NULL,
  session_id VARCHAR(80) NOT NULL,
  nickname VARCHAR(40) NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_participant_session (mode, target_id, session_id),
  UNIQUE KEY uniq_participant_user (mode, target_id, user_id),
  INDEX idx_participant_lookup (mode, target_id),
  INDEX idx_participant_user_lookup (mode, target_id, user_id),
  CONSTRAINT fk_participant_user FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS attempts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  mode VARCHAR(20) NOT NULL,
  target_id BIGINT NOT NULL,
  participant_id BIGINT NOT NULL,
  attempt_index INT NOT NULL,
  input_text TEXT NOT NULL,
  normalized_input VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  primary_score INT NOT NULL DEFAULT 0,
  final_score INT NOT NULL DEFAULT 0,
  dimension_json JSON DEFAULT NULL,
  reaction_category VARCHAR(40) NOT NULL DEFAULT 'idle',
  character_state VARCHAR(40) NOT NULL DEFAULT 'idle',
  ai_message TEXT DEFAULT NULL,
  invalid_reason VARCHAR(80) DEFAULT NULL,
  is_success TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uniq_attempt_participant_index (participant_id, attempt_index),
  INDEX idx_attempt_lookup (mode, target_id, participant_id, created_at, id),
  INDEX idx_attempt_status (participant_id, status),
  INDEX idx_attempt_score (mode, target_id, final_score, id),
  CONSTRAINT fk_attempt_participant FOREIGN KEY (participant_id)
    REFERENCES participants(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hint_uses (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  participant_id BIGINT NOT NULL,
  hint_type VARCHAR(30) NOT NULL,
  revealed_text TEXT DEFAULT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_hint_use (participant_id, hint_type),
  CONSTRAINT fk_hint_use_participant FOREIGN KEY (participant_id)
    REFERENCES participants(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wins (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  mode VARCHAR(20) NOT NULL,
  target_id BIGINT NOT NULL,
  participant_id BIGINT NOT NULL,
  winning_attempt_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_win (mode, target_id, participant_id),
  INDEX idx_win_lookup (mode, target_id, created_at),
  CONSTRAINT fk_win_participant FOREIGN KEY (participant_id)
    REFERENCES participants(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_win_attempt FOREIGN KEY (winning_attempt_id)
    REFERENCES attempts(id)
    ON DELETE CASCADE
);
