import { afterEach, beforeAll, expect, vi } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

beforeAll(() => {
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Object.defineProperty(window, "scrollTo", {
      writable: true,
      value: vi.fn(),
    });
  }

  if (typeof HTMLElement !== "undefined") {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      writable: true,
      value: vi.fn(),
    });
  }

  if (typeof window !== "undefined") {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});
