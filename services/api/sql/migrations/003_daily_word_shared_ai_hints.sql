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
