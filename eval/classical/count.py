"""Classical-CV colony counter (spec fallback ladder: watershed+contours).

Runs the dev split locally with OpenCV: background-flatten -> Otsu threshold ->
distance-transform watershed split -> area filter -> count. Produces the first
real dev-set count-MAE while the SAM-3.1 API path is unresolved, and doubles as
the "classical-only" ablation row later.

Usage (from repo root):
    uv run python eval/classical/count.py [--agar PATH] [--longest 1200]

GT rules (G-EVAL-8): GT = len(labels); bright/734 uses 78 (label count, not the
stated 54); bright/1399 (colonies_number=-1, no labels) is excluded as
pending-docs; splits keyed by filename.
"""

import argparse
import json
import os
import sys

import cv2
import numpy as np

# splits.json short bins -> on-disk AGAR_demo subdirs
BIN_DIRS = {
    "bright": "higher-resolution/bright",
    "dark": "higher-resolution/dark",
    "vague": "higher-resolution/vague",
    "lower-res": "lower-resolution",
}

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def count_plate(path, longest=1200):
    """Return (count, boxes) for one plate image. Boxes are x,y,w,h in orig px."""
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(path)
    h0, w0 = img.shape[:2]
    scale = longest / max(h0, w0)
    small = cv2.resize(img, (int(w0 * scale), int(h0 * scale)), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)

    # Flatten slow background (dish gradient / vignette) with large opening.
    bg = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (51, 51)))
    flat = cv2.subtract(bg, gray)  # colonies darker than agar (GT-verified)
    flat = cv2.GaussianBlur(flat, (3, 3), 0)

    _, th = cv2.threshold(flat, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    th = cv2.morphologyEx(th, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))

    # Split touching colonies via distance-transform watershed.
    dist = cv2.distanceTransform(th, cv2.DIST_L2, 5)
    if dist.max() <= 0:
        return 0, []
    _, peaks = cv2.threshold(dist, 0.35 * dist.max(), 255, cv2.THRESH_BINARY)
    peaks = np.uint8(peaks)
    n, markers_in = cv2.connectedComponents(peaks)
    markers = markers_in + 1
    markers[th == 0] = 0
    markers = cv2.watershed(small, markers.astype(np.int32))

    # One box per watershed region, area-filtered (relative bounds).
    area = small.shape[0] * small.shape[1]
    min_a, max_a = area * 2e-6, area * 0.02
    boxes = []
    for label in range(2, n + 1):
        ys, xs = np.where(markers == label)
        if len(xs) == 0:
            continue
        a = len(xs)
        if not (min_a <= a <= max_a):
            continue
        x0, y0 = xs.min(), ys.min()
        boxes.append({
            "x": int(x0 / scale), "y": int(y0 / scale),
            "width": int((xs.max() - x0 + 1) / scale),
            "height": int((ys.max() - y0 + 1) / scale),
        })
    return len(boxes), boxes


def gt_count(labels_path):
    with open(labels_path) as f:
        j = json.load(f)
    if j.get("colonies_number") == -1:
        return None  # pending-docs exclusion (bright/1399)
    return len(j.get("labels", []))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--agar", default="/media/hdd/nitish/Downloads/AGAR_demo/AGAR_representative")
    ap.add_argument("--longest", type=int, default=1600)
    args = ap.parse_args()

    with open(os.path.join(REPO_ROOT, "eval", "splits.json")) as f:
        splits = json.load(f)

    rows, abs_errs = [], []
    for key in splits["dev"]:
        b, name = key.split("/")
        jpg = os.path.join(args.agar, BIN_DIRS[b], name + ".jpg")
        gt = gt_count(os.path.join(args.agar, BIN_DIRS[b], name + ".json"))
        if gt is None:
            print(f"{key}: SKIP (pending-docs -1)")
            continue
        pred, boxes = count_plate(jpg, args.longest)
        err = abs(pred - gt)
        abs_errs.append(err)
        rows.append({"plate": key, "gt": gt, "pred": pred, "boxes": boxes})
        print(f"{key}: gt={gt} pred={pred} abserr={err}")
    abs_errs.sort()
    n = len(abs_errs)
    mae = sum(abs_errs) / n
    med = abs_errs[n // 2] if n % 2 else (abs_errs[n // 2 - 1] + abs_errs[n // 2]) / 2
    print(f"n={n} MAE={mae:.2f} medianAE={med:.1f}")
    out = {"backend": "classical-watershed", "split": "dev", "n": n, "mae": mae,
           "medianAE": med, "plates": rows}
    os.makedirs(os.path.join(REPO_ROOT, "eval", "out"), exist_ok=True)
    with open(os.path.join(REPO_ROOT, "eval", "out", "classical_dev.json"), "w") as f:
        json.dump(out, f, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
