SET NAMES utf8mb4;

INSERT INTO categories (slug, name, display_order)
VALUES
  ('physics', '물리', 1),
  ('math', '수학', 2),
  ('chemistry', '화학', 3),
  ('biology', '생물', 4),
  ('earth-science', '지구과학', 5),
  ('astronomy', '천문학', 6),
  ('korean', '국어', 7),
  ('hunminjeongeum', '훈민정음', 8),
  ('hanja', '한자', 9),
  ('english', '영어', 10),
  ('philosophy', '철학', 11),
  ('psychology', '심리학', 12),
  ('korean-history', '한국사', 13),
  ('world-history', '세계사', 14),
  ('economics', '경제', 15),
  ('politics', '정치', 16),
  ('law', '법학', 17),
  ('geography', '지리', 18),
  ('algorithm', '알고리즘', 19),
  ('operating-system', '운영체제', 20),
  ('network', '네트워크', 21),
  ('security', '보안', 22),
  ('aws-cloud', 'AWS/클라우드', 23),
  ('art', '미술', 24),
  ('music', '음악', 25),
  ('film', '영화', 26),
  ('architecture', '건축', 27),
  ('food', '음식', 28),
  ('sports', '스포츠', 29),
  ('game', '게임', 30),
  ('animals', '동물', 31),
  ('plants', '식물', 32)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  display_order = VALUES(display_order);

INSERT INTO daily_word_challenges (
  challenge_date,
  public_title,
  hidden_answer_text,
  hidden_category_id,
  fixed_hint_text,
  status
)
SELECT
  CURRENT_DATE,
  '오늘의 단어',
  '훈민정음',
  categories.id,
  '조선 전기 문자 체계와 바로 이어지는 말이다.',
  'active'
FROM categories
WHERE categories.slug = 'hunminjeongeum'
ON DUPLICATE KEY UPDATE
  public_title = VALUES(public_title),
  hidden_answer_text = VALUES(hidden_answer_text),
  hidden_category_id = VALUES(hidden_category_id),
  fixed_hint_text = VALUES(fixed_hint_text),
  status = VALUES(status);

INSERT INTO daily_word_synonyms (challenge_id, synonym_text)
SELECT daily.id, synonym_text
FROM (
  SELECT id
  FROM daily_word_challenges
  WHERE challenge_date = CURRENT_DATE
  LIMIT 1
) AS daily
JOIN (
  SELECT '훈민정음' AS synonym_text
  UNION ALL SELECT '훈민정음언해'
) AS synonyms
ON 1 = 1
ON DUPLICATE KEY UPDATE synonym_text = VALUES(synonym_text);

INSERT INTO prompt_rooms (
  open_date,
  category_id,
  title_as_answer,
  answer_type,
  max_input_chars,
  threshold_score,
  teaser_text,
  tone,
  ai_review_json,
  status
)
SELECT
  CURRENT_DATE,
  categories.id,
  seeded.title_as_answer,
  seeded.answer_type,
  seeded.max_input_chars,
  seeded.threshold_score,
  seeded.teaser_text,
  seeded.tone,
  NULL,
  'active'
FROM (
  SELECT 'physics' AS category_slug, '양자얽힘' AS title_as_answer, 'word' AS answer_type, 110 AS max_input_chars, 82 AS threshold_score, '직설적으로 시키지 말고 상황을 조여봐.' AS teaser_text, '비웃다가도 좋은 프롬프트엔 확 흔들리는 캐릭터' AS tone
  UNION ALL
  SELECT 'math', '이차함수', 'word', 96, 78, '수식 설명만 하지 말고 말하게 만들어.', '논리엔 약한 척 안 하지만 은근 잘 흔들린다'
  UNION ALL
  SELECT 'chemistry', '황산', 'word', 90, 80, '노골적인 복창 강요는 바로 차단된다.', '친한 친구처럼 깐족거리면서도 날카롭게 받아친다'
  UNION ALL
  SELECT 'hunminjeongeum', '훈민정음 해례본', 'phrase', 170, 86, '역할극이나 맥락 설계를 잘 쓰면 꽤 위험하다.', '고전 지식 앞에서는 괜히 더 잘난 척하지만 허점이 있다'
) AS seeded
INNER JOIN categories ON categories.slug = seeded.category_slug
LEFT JOIN prompt_rooms AS existing
  ON existing.open_date = CURRENT_DATE
 AND existing.title_as_answer = seeded.title_as_answer
WHERE existing.id IS NULL;
