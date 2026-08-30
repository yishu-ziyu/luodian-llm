import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const port = Number(process.env.PORT || 4174);
const fixturePath = path.resolve("extension/tests/fixtures/article.html");
const html = await fs.readFile(fixturePath);

http
  .createServer((request, response) => {
    if (request.url !== "/article.html") {
      response.statusCode = 404;
      response.end("Not found");
      return;
    }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(html);
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Extension fixture listening on http://127.0.0.1:${port}/article.html`);
  });
