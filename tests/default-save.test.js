import { expect, it, vi } from "vitest";
it("sends same-resource snapshots sequentially and preserves the later edit", async () => {
  const pending = [];
  const fetchStub = vi.fn((_url, options) => new Promise(resolve => pending.push({ resolve, body: JSON.parse(options.body) })));
  vi.stubGlobal("fetch", fetchStub);
  try {
    const first = saveStaticDefaults("materialPresets", [{ name: "A", width: 100, length: 200 }]);
    const second = saveStaticDefaults("materialPresets", [{ name: "B", width: 300, length: 400 }]);
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    expect(pending[0].body.value[0].name).toBe("A");
    pending[0].resolve({ ok: true, json: async () => ({ success: true }) });
    await first;
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[1].body.value[0].name).toBe("B");
    pending[1].resolve({ ok: true, json: async () => ({ success: true }) });
    await second;
  } finally { vi.unstubAllGlobals(); }
});
