import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

import { assertFetchablePublicHttpUrl } from "./extract-url.mjs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const IMAGE_TYPES = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);

function requestPinnedImage(url, { address, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.get(url, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif",
        "Accept-Encoding": "identity"
      },
      lookup(_hostname, _options, callback) {
        callback(null, address, isIP(address));
      },
      ...(url.protocol === "https:" ? { servername: url.hostname } : {})
    }, (response) => {
      const chunks = [];
      let byteLength = 0;
      response.on("data", (chunk) => {
        byteLength += chunk.length;
        if (byteLength > MAX_IMAGE_BYTES) {
          response.destroy(new Error("Image exceeds the 5 MB limit."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({
        status: response.statusCode || 0,
        headers: response.headers,
        bytes: Buffer.concat(chunks)
      }));
      response.on("error", reject);
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error("Image fetch timed out.")));
    request.on("error", reject);
  });
}

function headerValue(headers, name) {
  if (typeof headers?.get === "function") return headers.get(name);
  const value = headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export async function fetchPublicImage(rawUrl, options = {}) {
  const requestImpl = options.requestImpl || requestPinnedImage;
  let currentUrl = new URL(rawUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const addresses = await assertFetchablePublicHttpUrl(
      currentUrl,
      { lookupImpl: options.lookupImpl },
      Boolean(options.lookupImpl)
    );

    const response = await requestImpl(currentUrl, {
      address: addresses[0],
      timeoutMs: options.timeoutMs || 8000
    });

    if (response.status >= 300 && response.status < 400) {
      const location = headerValue(response.headers, "location");
      if (!location || redirectCount === MAX_REDIRECTS) throw new Error("Image redirect limit exceeded.");
      currentUrl = new URL(location, currentUrl);
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Image fetch failed with HTTP ${response.status}.`);
    }
    const contentType = String(headerValue(response.headers, "content-type") || "").split(";", 1)[0].toLowerCase();
    if (!IMAGE_TYPES.has(contentType)) throw new Error("Image response type is not allowed.");

    const declaredSize = Number(headerValue(response.headers, "content-length") || 0);
    if (declaredSize > MAX_IMAGE_BYTES) throw new Error("Image exceeds the 5 MB limit.");
    const bytes = Buffer.from(response.bytes);
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error("Image exceeds the 5 MB limit.");
    return { bytes, contentType };
  }

  throw new Error("Image redirect limit exceeded.");
}
