const { describe, it } = require("node:test");
const assert = require("node:assert");

const { createAuthService } = require("../src/auth");

function createMockPool() {
  return {
    getConnection: () =>
      Promise.resolve({
        query: () => Promise.resolve([[]]),
        beginTransaction: () => Promise.resolve(),
        commit: () => Promise.resolve(),
        rollback: () => Promise.resolve(),
        release: () => {},
      }),
  };
}

function createMockConfig() {
  return {
    supabaseUrl: "",
    auth: {
      guestSessionHours: 12,
      appSessionDays: 30,
    },
  };
}

describe("createAuthService", () => {
  it("returns an object with all expected methods", () => {
    const service = createAuthService({
      pool: createMockPool(),
      config: createMockConfig(),
    });

    const expectedMethods = [
      "sanitizeNickname",
      "resolveSession",
      "createGuestSession",
      "exchangeSocialSession",
      "exchangeGoogleSession",
      "logoutSession",
      "updateProfile",
      "deleteAccount",
    ];

    for (const method of expectedMethods) {
      assert.strictEqual(typeof service[method], "function", `missing method: ${method}`);
    }
  });

  it("does not expose internal helpers like hashToken or createSessionToken", () => {
    const service = createAuthService({
      pool: createMockPool(),
      config: createMockConfig(),
    });

    assert.strictEqual(service.hashToken, undefined);
    assert.strictEqual(service.createSessionToken, undefined);
    assert.strictEqual(service.findSessionByToken, undefined);
    assert.strictEqual(service.buildExpiryDate, undefined);
  });
});

describe("sanitizeNickname (via createAuthService)", () => {
  let service;

  it("trims whitespace", () => {
    service = createAuthService({ pool: createMockPool(), config: createMockConfig() });
    assert.strictEqual(service.sanitizeNickname("  hello  "), "hello");
  });

  it("collapses multiple spaces into one", () => {
    service = createAuthService({ pool: createMockPool(), config: createMockConfig() });
    assert.strictEqual(service.sanitizeNickname("hello   world"), "hello world");
  });

  it("truncates to max length of 40 characters", () => {
    service = createAuthService({ pool: createMockPool(), config: createMockConfig() });
    const longName = "가".repeat(50);
    assert.strictEqual(service.sanitizeNickname(longName).length, 40);
  });

  it("returns empty string for null/undefined", () => {
    service = createAuthService({ pool: createMockPool(), config: createMockConfig() });
    assert.strictEqual(service.sanitizeNickname(null), "");
    assert.strictEqual(service.sanitizeNickname(undefined), "");
  });

  it("converts non-string input to string", () => {
    service = createAuthService({ pool: createMockPool(), config: createMockConfig() });
    assert.strictEqual(service.sanitizeNickname(12345), "12345");
  });
});

describe("createGuestSession", () => {
  it("throws when nickname is empty after sanitization", async () => {
    const service = createAuthService({
      pool: createMockPool(),
      config: createMockConfig(),
    });

    await assert.rejects(
      () => service.createGuestSession("   "),
      { message: "게스트 닉네임이 필요합니다." },
    );
  });
});

describe("resolveSession", () => {
  it("returns null for empty session token", async () => {
    const service = createAuthService({
      pool: createMockPool(),
      config: createMockConfig(),
    });

    const result = await service.resolveSession(null);
    assert.strictEqual(result, null);
  });

  it("returns null for a token that does not exist in the database", async () => {
    const service = createAuthService({
      pool: createMockPool(),
      config: createMockConfig(),
    });

    const result = await service.resolveSession("nonexistent-token");
    assert.strictEqual(result, null);
  });
});
