import json
import sys

import trafilatura


def extract_one(item):
    try:
        text = trafilatura.extract(
            item["html"],
            url=item["url"],
            output_format="txt",
            include_comments=False,
            include_tables=False,
            favor_precision=True,
        )
        if not text:
            text = trafilatura.extract(
                item["html"],
                url=item["url"],
                output_format="txt",
                include_comments=False,
                include_tables=False,
                favor_recall=True,
            )
        metadata_json = trafilatura.extract(
            item["html"],
            url=item["url"],
            output_format="json",
            include_comments=False,
            include_tables=False,
            favor_precision=True,
        )
        if not metadata_json:
            metadata_json = trafilatura.extract(
                item["html"],
                url=item["url"],
                output_format="json",
                include_comments=False,
                include_tables=False,
                favor_recall=True,
            )
        metadata = json.loads(metadata_json) if metadata_json else {}
        return {
            "id": item["id"],
            "ok": bool(text),
            "title": metadata.get("title") or "",
            "text": text or "",
            "error": "",
        }
    except Exception as exc:
        return {
            "id": item["id"],
            "ok": False,
            "title": "",
            "text": "",
            "error": f"{type(exc).__name__}: {exc}",
        }


def main():
    if len(sys.argv) != 3:
        print("usage: extract-trafilatura.py <input-json> <output-json>", file=sys.stderr)
        raise SystemExit(2)

    with open(sys.argv[1], "r", encoding="utf-8") as handle:
        items = json.load(handle)

    results = [extract_one(item) for item in items]

    with open(sys.argv[2], "w", encoding="utf-8") as handle:
        json.dump(results, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    main()
