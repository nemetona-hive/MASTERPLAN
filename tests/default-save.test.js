import { expect, it, vi } from "vitest";
it("sends same-resource snapshots sequentially and preserves the later edit", async () => {
  const pending = [];
  const fetchStub = vi.fn((_url, options) => new Promise(resolve => pending.push({ resolve, body: JSON.parse(options.body) })));
  vi.stubGlobal("fetch", fetchStub);
  try {
    const first = saveStaticDefaults("shDefaults", { W: 100 });
    const second = saveStaticDefaults("shDefaults", { W: 200 });
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    expect(pending[0].body.value.W).toBe(100);
    pending[0].resolve({ ok: true, json: async () => ({ success: true }) });
    await first;
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[1].body.value.W).toBe(200);
    pending[1].resolve({ ok: true, json: async () => ({ success: true }) });
    await second;
  } finally { vi.unstubAllGlobals(); }
});
