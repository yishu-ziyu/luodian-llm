import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const reportName = process.env.HIGHLIGHT_AB_REPORT || "report.html";
const report = await fs.readFile(path.join(moduleDir, reportName));
const port = Number(process.env.PORT || 4175);

http.createServer((request, response) => {
  if (request.url !== "/" && request.url !== `/${reportName}`) {
    response.statusCode = 404;
    response.end("Not found");
    return;
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(report);
}).listen(port, "127.0.0.1", () => {
  console.log(`Highlight A/B report: http://127.0.0.1:${port}/`);
});
