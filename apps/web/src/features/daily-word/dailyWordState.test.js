import {
  buildConversation,
  buildWordVerdictCounts,
  getLatestWordTurn,
  mapWordAttempts,
} from "./dailyWordState";

test("buildConversation uses chatReply and verdict metadata from wordTurn", () => {
  const conversation = buildConversation([], {
    history: [
      {
        id: 1,
        inputText: "사람이 만들었어?",
        aiMessage: "legacy",
        wordTurn: {
          analysis: {
            inputType: "property_question",
            questionQuality: "good",
            mood: "impressed",
          },
          judge: {
            verdict: "O",
            confidence: 0.93,
            reasonType: "binary_judgment",
          },
          chatReply: "응, 사람이 만든 거야.",
          friendReply: "오, 그 질문은 꽤 괜찮았다.",
          emotion: {
            emojiKey: "impressed",
            label: "감탄",
            intensity: 0.58,
          },
          innerThought: "좋은 질문이다.",
        },
      },
    ],
  });

  expect(conversation).toHaveLength(2);
  expect(conversation[1].content).toBe("응, 사람이 만든 거야.");
  expect(conversation[1].meta).toBe("O");
});

test("buildWordVerdictCounts uses judge.verdict instead of score thresholds", () => {
  const counts = buildWordVerdictCounts([
    {
      finalScore: 45,
      wordTurn: {
        judge: {
          verdict: "O",
        },
      },
    },
    {
      finalScore: 70,
      wordTurn: {
        judge: {
          verdict: "?",
        },
      },
    },
  ]);

  expect(counts).toEqual({ O: 1, X: 0, "?": 1 });
});

test("mapWordAttempts uses verdict labels from wordTurn", () => {
  const items = mapWordAttempts([
    {
      id: 1,
      inputText: "생물이야?",
      wordTurn: {
        judge: {
          verdict: "X",
        },
      },
    },
  ]);

  expect(items[0].value).toBe("X");
});

test("getLatestWordTurn prefers transient turn over snapshot turn", () => {
  const latest = getLatestWordTurn(
    {
      latestTurn: {
        judge: {
          verdict: "X",
        },
      },
    },
    {
      judge: {
        verdict: "?",
      },
      emotion: {
        emojiKey: "confused",
      },
    },
  );

  expect(latest.judge.verdict).toBe("?");
});
