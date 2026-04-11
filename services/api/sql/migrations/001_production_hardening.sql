SET NAMES utf8mb4;

ALTER TABLE daily_word_challenges
  MODIFY public_title VARCHAR(120) NOT NULL DEFAULT '오늘의 단어',
  MODIFY hidden_answer_text VARCHAR(160) NOT NULL,
  MODIFY fixed_hint_text VARCHAR(255) DEFAULT NULL;

ALTER TABLE daily_word_synonyms
  MODIFY synonym_text VARCHAR(160) NOT NULL;

ALTER TABLE prompt_rooms
  MODIFY title_as_answer VARCHAR(160) NOT NULL,
  MODIFY teaser_text VARCHAR(255) DEFAULT NULL,
  MODIFY tone VARCHAR(255) DEFAULT NULL;

ALTER TABLE prompt_room_proposals
  MODIFY proposed_answer VARCHAR(160) NOT NULL;

SET @add_review_note_column = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'prompt_room_proposals'
        AND column_name = 'review_note'
    ),
    'SELECT 1',
    'ALTER TABLE prompt_room_proposals ADD COLUMN review_note TEXT DEFAULT NULL'
  )
);
PREPARE stmt FROM @add_review_note_column;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_reviewed_at_column = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'prompt_room_proposals'
        AND column_name = 'reviewed_at'
    ),
    'SELECT 1',
    'ALTER TABLE prompt_room_proposals ADD COLUMN reviewed_at TIMESTAMP NULL DEFAULT NULL'
  )
);
PREPARE stmt FROM @add_reviewed_at_column;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_reviewed_by_user_id_column = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'prompt_room_proposals'
        AND column_name = 'reviewed_by_user_id'
    ),
    'SELECT 1',
    'ALTER TABLE prompt_room_proposals ADD COLUMN reviewed_by_user_id BIGINT DEFAULT NULL'
  )
);
PREPARE stmt FROM @add_reviewed_by_user_id_column;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_approved_room_id_column = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'prompt_room_proposals'
        AND column_name = 'approved_room_id'
    ),
    'SELECT 1',
    'ALTER TABLE prompt_room_proposals ADD COLUMN approved_room_id BIGINT DEFAULT NULL'
  )
);
PREPARE stmt FROM @add_approved_room_id_column;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE prompt_room_proposals
SET reviewed_at = COALESCE(reviewed_at, updated_at)
WHERE status IN ('approved', 'rejected');

SET @create_prompt_room_unique = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'prompt_rooms'
        AND index_name = 'uniq_prompt_room_open_title'
    ),
    'SELECT 1',
    'ALTER TABLE prompt_rooms ADD UNIQUE KEY uniq_prompt_room_open_title (open_date, title_as_answer)'
  )
);
PREPARE stmt FROM @create_prompt_room_unique;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @create_attempt_unique = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'attempts'
        AND index_name = 'uniq_attempt_participant_index'
    ),
    'SELECT 1',
    'ALTER TABLE attempts ADD UNIQUE KEY uniq_attempt_participant_index (participant_id, attempt_index)'
  )
);
PREPARE stmt FROM @create_attempt_unique;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @create_attempt_status_index = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'attempts'
        AND index_name = 'idx_attempt_status'
    ),
    'SELECT 1',
    'ALTER TABLE attempts ADD INDEX idx_attempt_status (participant_id, status)'
  )
);
PREPARE stmt FROM @create_attempt_status_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @create_prompt_proposal_status_index = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'prompt_room_proposals'
        AND index_name = 'idx_prompt_proposal_status'
    ),
    'SELECT 1',
    'ALTER TABLE prompt_room_proposals ADD INDEX idx_prompt_proposal_status (status, created_at)'
  )
);
PREPARE stmt FROM @create_prompt_proposal_status_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_review_user_fk = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_schema = DATABASE()
        AND table_name = 'prompt_room_proposals'
        AND constraint_name = 'fk_prompt_proposal_review_user'
        AND constraint_type = 'FOREIGN KEY'
    ),
    'SELECT 1',
    'ALTER TABLE prompt_room_proposals ADD CONSTRAINT fk_prompt_proposal_review_user FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL'
  )
);
PREPARE stmt FROM @add_review_user_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_approved_room_fk = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_schema = DATABASE()
        AND table_name = 'prompt_room_proposals'
        AND constraint_name = 'fk_prompt_proposal_room'
        AND constraint_type = 'FOREIGN KEY'
    ),
    'SELECT 1',
    'ALTER TABLE prompt_room_proposals ADD CONSTRAINT fk_prompt_proposal_room FOREIGN KEY (approved_room_id) REFERENCES prompt_rooms(id) ON DELETE SET NULL'
  )
);
PREPARE stmt FROM @add_approved_room_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
