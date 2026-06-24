import { describe, it, expect } from "vitest";
import { idempotencyKey, InMemoryIdempotencyStore } from "../src/idempotency";

describe("idempotencyKey", () => {
  it("is deterministic for the same source + event id", () => {
    expect(idempotencyKey("slack", "123.45")).toBe(idempotencyKey("slack", "123.45"));
  });

  it("differs for different events or sources", () => {
    expect(idempotencyKey("slack", "a")).not.toBe(idempotencyKey("slack", "b"));
    expect(idempotencyKey("slack", "a")).not.toBe(idempotencyKey("transcript", "a"));
  });
});

describe("InMemoryIdempotencyStore", () => {
  it("returns null before set and the external id after", async () => {
    const store = new InMemoryIdempotencyStore();
    const key = idempotencyKey("slack", "x");
    expect(await store.get(key)).toBeNull();
    await store.set(key, "TASK-1");
    expect(await store.get(key)).toBe("TASK-1");
  });

  it("returns the first-stored id when set is called again with a different id (winner semantics)", async () => {
    const store = new InMemoryIdempotencyStore();
    const key = idempotencyKey("slack", "race");
    expect(await store.set(key, "TASK-A")).toBe("TASK-A");
    expect(await store.set(key, "TASK-B")).toBe("TASK-A"); // first writer wins
    expect(await store.get(key)).toBe("TASK-A");
  });
});

describe("idempotencyKey collision-resistance", () => {
  it("does not collide under ambiguous delimiter placement", () => {
    expect(idempotencyKey("a", "b:c")).not.toBe(idempotencyKey("a:b", "c"));
    expect(idempotencyKey("slack", "1.2")).not.toBe(idempotencyKey("slack1", ".2"));
  });
});
