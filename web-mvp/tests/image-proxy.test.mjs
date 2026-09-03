import test from "node:test";
import assert from "node:assert/strict";

import { fetchPublicImage } from "../src/image-proxy.mjs";

test("fetchPublicImage validates every redirect before fetching it", async () => {
  let calls = 0;
  const requestImpl = async (_url, { address }) => {
    calls += 1;
    assert.equal(address, "93.184.216.34");
    return { status: 302, headers: { location: "http://127.0.0.1/private.png" }, bytes: Buffer.alloc(0) };
  };

  await assert.rejects(
    () => fetchPublicImage("https://example.com/cover.jpg", {
      requestImpl,
      lookupImpl: async () => [{ address: "93.184.216.34", family: 4 }]
    }),
    /private or local network/
  );
  assert.equal(calls, 1);
});

test("fetchPublicImage rejects non-image and oversized responses", async () => {
  const lookupImpl = async () => [{ address: "93.184.216.34", family: 4 }];
  await assert.rejects(
    () => fetchPublicImage("https://example.com/file", {
      lookupImpl,
      requestImpl: async () => ({ status: 200, headers: { "content-type": "text/plain" }, bytes: Buffer.from("text") })
    }),
    /type is not allowed/
  );
  await assert.rejects(
    () => fetchPublicImage("https://example.com/large.png", {
      lookupImpl,
      requestImpl: async () => ({
        status: 200,
        headers: { "content-type": "image/png", "content-length": String(6 * 1024 * 1024) },
        bytes: Buffer.from("x")
      })
    }),
    /5 MB/
  );
});
