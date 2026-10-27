"""Eval tables stub (stdlib only): render Markdown tables from eval JSON."""
import json
import sys

REQUIRED_BINS = ("bright", "dark", "vague", "lower-res")


def fmt_row(cells):
    return "| " + " | ".join(str(c) for c in cells) + " |"


def main(path: str) -> None:
    with open(path) as f:
        data = json.load(f)
    overall = data.get("overall", {})
    by_bin = data.get("byBin", {})
    print("## Count metrics")
    print(fmt_row(["n", "MAE", "medianAE", "within±5%", "p50 ms", "p95 ms"]))
    print(fmt_row(["---"] * 6))
    print(
        fmt_row(
            [
                overall.get("n", 0),
                f"{overall.get('mae', 0):.2f}",
                f"{overall.get('medianAE', 0):.2f}",
                f"{overall.get('within5pct', 0):.1%}",
                overall.get("latencyP50"),
                overall.get("latencyP95"),
            ]
        )
    )
    print()
    print("## Robustness by bin")
    print(fmt_row(["bin", "n", "MAE", "medianAE", "within±5%"]))
    print(fmt_row(["---"] * 5))
    for b in REQUIRED_BINS:
        m = by_bin.get(b, {})
        print(
            fmt_row(
                [
                    b,
                    m.get("n", 0),
                    f"{m.get('mae', 0):.2f}",
                    f"{m.get('medianAE', 0):.2f}",
                    f"{m.get('within5pct', 0):.1%}",
                ]
            )
        )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: python3 tables.py out/results.json", file=sys.stderr)
        sys.exit(2)
    main(sys.argv[1])
