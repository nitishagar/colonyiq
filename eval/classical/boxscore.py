"""Box-level P/R/F1 @ IoU 0.5 for classical predictions vs AGAR GT (G-EVAL-4).

Greedy matching mirrors packages/pipeline/src/match.ts boxPRF1.
Usage: uv run python eval/classical/count.py && uv run python eval/classical/boxscore.py
"""

import json
import os

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AGAR = "/media/hdd/nitish/Downloads/AGAR_demo/AGAR_representative"
BIN_DIRS = {"bright": "higher-resolution/bright", "dark": "higher-resolution/dark",
            "vague": "higher-resolution/vague", "lower-res": "lower-resolution"}


def iou(a, b):
    ix0, iy0 = max(a["x"], b["x"]), max(a["y"], b["y"])
    ix1, iy1 = min(a["x"] + a["width"], b["x"] + b["width"]), min(a["y"] + a["height"], b["y"] + b["height"])
    inter = max(0, ix1 - ix0) * max(0, iy1 - iy0)
    union = a["width"] * a["height"] + b["width"] * b["height"] - inter
    return inter / union if union else 0.0


def main():
    with open(os.path.join(REPO_ROOT, "eval", "out", "classical_dev.json")) as f:
        preds = json.load(f)["plates"]
    TP = FP = FN = 0
    for p in preds:
        b, name = p["plate"].split("/")
        with open(os.path.join(AGAR, BIN_DIRS[b], name + ".json")) as f:
            gt = [{"x": l["x"], "y": l["y"], "width": l["width"], "height": l["height"]}
                  for l in json.load(f).get("labels", [])]
        matched = [False] * len(gt)
        tp = 0
        for pr in p["boxes"]:
            best, best_iou = -1, 0.5
            for i, g in enumerate(gt):
                if matched[i]:
                    continue
                v = iou(pr, g)
                if v >= best_iou:
                    best, best_iou = i, v
            if best >= 0:
                matched[best] = True
                tp += 1
        fp, fn = len(p["boxes"]) - tp, len(gt) - tp
        TP, FP, FN = TP + tp, FP + fp, FN + fn
        print(f"{p['plate']}: tp={tp} fp={fp} fn={fn}")
    prec = TP / (TP + FP) if TP + FP else 1.0
    rec = TP / (TP + FN) if TP + FN else 1.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    print(f"micro P={prec:.3f} R={rec:.3f} F1={f1:.3f} (TP={TP} FP={FP} FN={FN})")


if __name__ == "__main__":
    main()
