#!/usr/bin/env python3
"""Detect race bibs, read their numbers, and update gallery photo metadata."""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml


DEFAULT_MODEL = Path(".gallery-local/models/annas-bib/bib-best-v2.pt")
DEFAULT_YOLOV7_SOURCE = Path(".gallery-local/models/annas-bib/source")
DEFAULT_OCR_MODELS = Path(".gallery-local/models/easyocr")
DEFAULT_PERSON_MODEL = Path("yolo11n.pt")
DEFAULT_VLM_MODEL = "Qwen/Qwen2.5-VL-3B-Instruct"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}
OCR_DIGIT_SUBSTITUTIONS = str.maketrans(
    {
        "O": "0",
        "Q": "0",
        "D": "0",
        "I": "1",
        "L": "1",
        "|": "1",
        "Z": "2",
        "S": "5",
        "G": "6",
        "B": "8",
    }
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Detect race bibs with a bib-specific YOLO model and read their numbers."
    )
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--gallery", required=True, type=Path)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument(
        "--model-format",
        choices=("yolov7", "ultralytics"),
        default="yolov7",
        help="Checkpoint implementation used by the bib detector.",
    )
    parser.add_argument("--yolov7-source", type=Path, default=DEFAULT_YOLOV7_SOURCE)
    parser.add_argument("--ocr-model-dir", type=Path, default=DEFAULT_OCR_MODELS)
    parser.add_argument("--device", default="0", help="Ultralytics device, for example 0 or cpu.")
    parser.add_argument("--imgsz", type=int, default=1920)
    parser.add_argument("--detection-confidence", type=float, default=0.18)
    parser.add_argument("--ocr-confidence", type=float, default=0.25)
    parser.add_argument(
        "--person-model",
        type=Path,
        default=DEFAULT_PERSON_MODEL,
        help="COCO detector used to search runner torso regions for bibs missed by the bib detector.",
    )
    parser.add_argument("--person-confidence", type=float, default=0.16)
    parser.add_argument(
        "--max-person-regions",
        type=int,
        default=20,
        help="Maximum number of largest detected torso crops scanned per photo.",
    )
    parser.add_argument(
        "--no-person-fallback",
        action="store_true",
        help="Disable OCR within detected runner torso regions.",
    )
    parser.add_argument(
        "--bicycle-fallback",
        action="store_true",
        help="Also search the upper part of YOLO11 bicycle regions for handlebar plates.",
    )
    parser.add_argument(
        "--minimum-bib-digits",
        type=int,
        choices=(1, 2),
        default=1,
        help="Shortest bib number accepted as an OCR suggestion.",
    )
    parser.add_argument(
        "--maximum-bib-number",
        type=int,
        default=1999,
        help="Reject larger OCR results as likely years, logos, or other text.",
    )
    parser.add_argument(
        "--vlm-model",
        default=DEFAULT_VLM_MODEL,
        help="Vision-language model used to review all clearly legible bib numbers in a photo.",
    )
    parser.add_argument(
        "--no-vlm",
        action="store_true",
        help="Disable the vision-language review pass.",
    )
    parser.add_argument(
        "--allow-unseeded-vlm",
        action="store_true",
        help="Run VLM review on detected people/bicycles even when OCR found no number.",
    )
    parser.add_argument(
        "--unseeded-min-occurrences",
        type=int,
        default=2,
        help="Keep an unseeded VLM number only when it recurs this many times in the run.",
    )
    parser.add_argument("--limit", type=int)
    parser.add_argument("--file", action="append", dest="files", help="Only process this filename; repeatable.")
    parser.add_argument(
        "--review-dir",
        type=Path,
        default=Path(".gallery-local/bib-recognition"),
        help="Ignored local folder for JSON results and annotated previews.",
    )
    parser.add_argument("--write", action="store_true", help="Write bib_numbers to gallery YAML.")
    return parser.parse_args()


def load_dependencies() -> tuple[Any, Any, Any, Any, Any]:
    try:
        import cv2
        import easyocr
        import numpy as np
        import torch
        from ultralytics import YOLO
    except ImportError as exc:
        raise SystemExit(
            "Install the optional bib-recognition dependencies in the local CUDA environment."
        ) from exc
    return cv2, easyocr, np, torch, YOLO


class LegacyYoloV7Detector:
    """Small adapter for the bib-specific YOLOv7 checkpoint."""

    def __init__(self, weights: Path, source_root: Path, device: str, torch: Any, np: Any):
        self.torch = torch
        self.np = np
        self.device = torch.device("cpu" if device == "cpu" else f"cuda:{device}")

        source_root = source_root.resolve()
        detection_root = source_root / "detection"
        if not detection_root.is_dir():
            raise SystemExit(f"YOLOv7 source not found: {detection_root}")
        for module_root in (str(source_root), str(detection_root)):
            if module_root not in sys.path:
                sys.path.insert(0, module_root)

        original_torch_load = torch.load

        def legacy_torch_load(*args: Any, **kwargs: Any) -> Any:
            kwargs.setdefault("weights_only", False)
            return original_torch_load(*args, **kwargs)

        torch.load = legacy_torch_load
        try:
            from models.experimental import attempt_load

            self.model = attempt_load(str(weights), map_location=self.device)
        finally:
            torch.load = original_torch_load

        from utils.datasets import letterbox
        from utils.general import non_max_suppression, scale_coords

        self.letterbox = letterbox
        self.non_max_suppression = non_max_suppression
        self.scale_coords = scale_coords
        self.stride = int(self.model.stride.max())
        self.half = self.device.type == "cuda"
        if self.half:
            self.model.half()
        self.model.eval()

    def predict_boxes(
        self,
        image: Any,
        image_size: int,
        confidence: float,
    ) -> tuple[list[list[float]], list[float]]:
        prepared = self.letterbox(image, image_size, stride=self.stride)[0]
        prepared = prepared[:, :, ::-1].transpose(2, 0, 1)
        prepared = self.np.ascontiguousarray(prepared)
        tensor = self.torch.from_numpy(prepared).to(self.device)
        tensor = tensor.half() if self.half else tensor.float()
        tensor /= 255.0
        if tensor.ndimension() == 3:
            tensor = tensor.unsqueeze(0)

        with self.torch.inference_mode():
            predictions = self.model(tensor, augment=False)[0]
        detections = self.non_max_suppression(predictions, confidence, 0.5)[0]
        if detections is None or not len(detections):
            return [], []
        detections[:, :4] = self.scale_coords(
            tensor.shape[2:], detections[:, :4], image.shape
        ).round()
        return (
            detections[:, :4].detach().cpu().tolist(),
            detections[:, 4].detach().float().cpu().tolist(),
        )


class VisionBibReader:
    """Read visible bib numbers once per photo with a GPU vision-language model."""

    def __init__(self, model_name: str, device: str, torch: Any):
        try:
            from transformers import AutoProcessor, Qwen2_5_VLForConditionalGeneration
        except ImportError as exc:
            raise SystemExit(
                "Install transformers, accelerate, and qwen-vl-utils for VLM bib review."
            ) from exc

        self.torch = torch
        self.device = torch.device("cpu" if device == "cpu" else f"cuda:{device}")
        dtype = torch.float32 if self.device.type == "cpu" else torch.bfloat16
        self.processor = AutoProcessor.from_pretrained(
            model_name,
            min_pixels=256 * 28 * 28,
            max_pixels=3584 * 28 * 28,
        )
        self.model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
            model_name,
            dtype=dtype,
            attn_implementation="sdpa",
        ).to(self.device)
        self.model.eval()

    @staticmethod
    def _numbers_from_response(response: str, maximum_bib_number: int) -> set[str]:
        cleaned_response = re.sub(
            r"^```(?:json)?\s*|\s*```$",
            "",
            response.strip(),
            flags=re.IGNORECASE,
        )
        first_bracket = cleaned_response.find("[")
        last_bracket = cleaned_response.rfind("]")
        if first_bracket >= 0 and last_bracket > first_bracket:
            cleaned_response = cleaned_response[first_bracket:last_bracket + 1]

        parsed_as_json = True
        try:
            payload = json.loads(cleaned_response)
        except json.JSONDecodeError:
            parsed_as_json = False
            payload = []

        if not parsed_as_json and "bbox_2d" in cleaned_response:
            payload = re.findall(
                r'"(?:text_content|bib_number|number|text)"\s*:\s*"(\d{1,4})"',
                cleaned_response,
            )

        if not payload and "bbox_2d" not in cleaned_response:
            quoted_numbers = re.findall(r'"(\d{1,4})"', cleaned_response)
            occurrence_counts = {
                value: quoted_numbers.count(value) for value in set(quoted_numbers)
            }
            payload = [
                value for value in quoted_numbers if occurrence_counts[value] <= 2
            ]

        if isinstance(payload, dict):
            payload = payload.get("bib_numbers", [])
        if not isinstance(payload, list):
            payload = []

        numbers: set[str] = set()
        for item in payload:
            raw_number: Any = item
            if isinstance(item, dict):
                raw_number = next(
                    (
                        item[key]
                        for key in ("bib_number", "number", "text_content", "text")
                        if key in item
                    ),
                    None,
                )
            if not isinstance(raw_number, (str, int)):
                continue
            raw_number = str(raw_number).strip()
            if not re.fullmatch(r"\d{1,4}", raw_number):
                continue
            number = normalize_bib_number(raw_number, maximum_bib_number)
            if number:
                numbers.add(number)
        return numbers

    def read_numbers(
        self,
        image: Any,
        maximum_bib_number: int,
        candidate_boxes: list[list[int]],
        ocr_suggestions: list[str],
        allow_unseeded: bool,
    ) -> tuple[list[str], str]:
        import cv2
        from PIL import Image

        if not ocr_suggestions and not allow_unseeded:
            return [], "Skipped: no plausible detector/OCR bib candidates."

        height, width = image.shape[:2]
        valid_boxes: list[list[int]] = []
        for box in candidate_boxes:
            x1, y1, x2, y2 = [int(value) for value in box]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(width, x2), min(height, y2)
            if x2 - x1 >= 20 and y2 - y1 >= 20:
                valid_boxes.append([x1, y1, x2, y2])

        if not valid_boxes:
            valid_boxes = [[0, 0, width, height]]

        tile_size = 320
        columns = 4
        tiles_per_sheet = 16
        pil_images: list[Any] = []
        for sheet_start in range(0, len(valid_boxes), tiles_per_sheet):
            sheet_boxes = valid_boxes[sheet_start:sheet_start + tiles_per_sheet]
            rows = math.ceil(len(sheet_boxes) / columns)
            contact_sheet = Image.new(
                "RGB",
                (columns * tile_size, rows * tile_size),
                color=(26, 30, 34),
            )
            for index, (x1, y1, x2, y2) in enumerate(sheet_boxes):
                region = image[y1:y2, x1:x2]
                region_height, region_width = region.shape[:2]
                scale = min(
                    (tile_size - 12) / region_width,
                    (tile_size - 12) / region_height,
                )
                resized = cv2.resize(
                    region,
                    (
                        max(1, int(region_width * scale)),
                        max(1, int(region_height * scale)),
                    ),
                    interpolation=cv2.INTER_AREA if scale < 1.0 else cv2.INTER_CUBIC,
                )
                tile = Image.fromarray(cv2.cvtColor(resized, cv2.COLOR_BGR2RGB))
                column = index % columns
                row = index // columns
                left = column * tile_size + (tile_size - tile.width) // 2
                top = row * tile_size + (tile_size - tile.height) // 2
                contact_sheet.paste(tile, (left, top))
            pil_images.append(contact_sheet)
        suggestion_text = ", ".join(ocr_suggestions) if ocr_suggestions else "none"
        instruction = (
            "This contact sheet contains runner torso crops, candidate race-bib "
            "regions, bicycle/handlebar regions, or overlapping scene crops from "
            "one event photograph. Tiles can overlap or repeat the same runner. "
            "Read every clearly legible main participant bib number and deduplicate "
            "repeats. Return only a JSON array of digit strings. A separate OCR "
            f"system proposed these untrusted candidates: {suggestion_text}. Check "
            "them against the pixels, correct wrong digits, reject values that are "
            "not bib numbers, and include other clearly legible bibs the OCR missed. "
            "Digits printed side by side on one plate form one number; never split a "
            "multi-digit plate into separate one-digit numbers. Include zero to many "
            "bibs. Omit a number if any digit is hidden or uncertain. Do not return "
            "distances, years, signs, clothing text, logos, or names. Never infer "
            "neighboring numbers, complete a partly hidden number, or continue a "
            "sequence. Do not return bounding boxes, coordinates, explanations, or "
            "JSON objects. Your entire response must be the JSON array."
        )

        numbers: set[str] = set()
        responses: list[str] = []
        for page_index, pil_image in enumerate(pil_images, start=1):
            messages = [
                {
                    "role": "system",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "You verify race bib numbers. Respond only with a JSON array "
                                "of digit strings, for example [\"1\", \"15\"], or [] when "
                                "none are fully legible. Never return coordinates or JSON objects."
                            ),
                        }
                    ],
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "image": pil_image},
                        {"type": "text", "text": instruction},
                    ],
                },
            ]
            prompt = self.processor.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True
            )
            inputs = self.processor(
                text=[prompt],
                images=[pil_image],
                padding=True,
                return_tensors="pt",
            ).to(self.device)
            with self.torch.inference_mode():
                generated = self.model.generate(
                    **inputs,
                    max_new_tokens=160,
                    do_sample=False,
                    repetition_penalty=1.05,
                    use_cache=True,
                )
            trimmed = generated[:, inputs.input_ids.shape[1]:]
            response = self.processor.batch_decode(
                trimmed,
                skip_special_tokens=True,
                clean_up_tokenization_spaces=False,
            )[0].strip()
            responses.append(f"Sheet {page_index}: {response}")
            numbers.update(self._numbers_from_response(response, maximum_bib_number))
            del inputs, generated, trimmed
            if self.device.type == "cuda":
                self.torch.cuda.empty_cache()

        return (
            sorted(numbers, key=lambda value: (int(value), value)),
            "\n\n".join(responses),
        )


def detector_boxes(detector: Any, image: Any, args: argparse.Namespace) -> tuple[list[list[float]], list[float]]:
    if args.model_format == "yolov7":
        return detector.predict_boxes(image, args.imgsz, args.detection_confidence)

    result = detector.predict(
        source=image,
        device=args.device,
        imgsz=args.imgsz,
        conf=args.detection_confidence,
        iou=0.5,
        verbose=False,
    )[0]
    boxes = result.boxes.xyxy.detach().cpu().tolist() if result.boxes is not None else []
    confidences = result.boxes.conf.detach().cpu().tolist() if result.boxes is not None else []
    return boxes, confidences


def load_gallery(path: Path) -> dict[str, Any]:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data.get("photos"), list):
        raise SystemExit(f"Gallery data has no photos list: {path}")
    return data


def image_paths(source_dir: Path, requested: list[str] | None, limit: int | None) -> list[Path]:
    if requested:
        paths = [source_dir / name for name in requested]
    else:
        paths = sorted(
            path for path in source_dir.iterdir()
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
        )
    missing = [str(path) for path in paths if not path.is_file()]
    if missing:
        raise SystemExit("Missing source files:\n" + "\n".join(missing))
    return paths[:limit] if limit else paths


def padded_box(box: list[float], width: int, height: int, padding: float = 0.06) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = box
    pad_x = (x2 - x1) * padding
    pad_y = (y2 - y1) * padding
    return (
        max(0, int(math.floor(x1 - pad_x))),
        max(0, int(math.floor(y1 - pad_y))),
        min(width, int(math.ceil(x2 + pad_x))),
        min(height, int(math.ceil(y2 + pad_y))),
    )


def ocr_focus_boxes(
    regions: list[dict[str, Any]],
    width: int,
    height: int,
) -> list[list[int]]:
    """Turn crop-local OCR boxes into enlarged full-image crops for VLM review."""
    focused: list[list[int]] = []
    region_keys = ("bib_box", "torso_box", "bicycle_plate_box", "scene_scan_box")
    for region in regions:
        parent_box = next(
            (region[key] for key in region_keys if region.get(key) is not None),
            None,
        )
        if parent_box is None:
            continue
        parent_x1, parent_y1 = int(parent_box[0]), int(parent_box[1])
        for candidate in (region.get("ocr_candidates") or [])[:2]:
            points = candidate.get("box") or []
            if len(points) < 2:
                continue
            xs = [float(point[0]) + parent_x1 for point in points]
            ys = [float(point[1]) + parent_y1 for point in points]
            focus = padded_box(
                [min(xs), min(ys), max(xs), max(ys)],
                width,
                height,
                padding=1.15,
            )
            if focus[2] - focus[0] >= 20 and focus[3] - focus[1] >= 20:
                focused.append(list(focus))
    return focused


def overlapping_scan_boxes(
    width: int,
    height: int,
    columns: int = 4,
    rows: int = 4,
    overlap: float = 0.12,
) -> list[list[int]]:
    cell_width = width / columns
    cell_height = height / rows
    boxes: list[list[int]] = []
    for row in range(rows):
        for column in range(columns):
            x1 = max(0, int(column * cell_width - cell_width * overlap))
            y1 = max(0, int(row * cell_height - cell_height * overlap))
            x2 = min(width, int((column + 1) * cell_width + cell_width * overlap))
            y2 = min(height, int((row + 1) * cell_height + cell_height * overlap))
            boxes.append([x1, y1, x2, y2])
    return boxes


def normalize_bib_number(raw_text: str, maximum: int) -> str | None:
    compact = re.sub(r"[^A-Z0-9|]", "", raw_text.upper())
    if not compact or len(compact) > 4:
        return None

    translated = compact.translate(OCR_DIGIT_SUBSTITUTIONS)
    if not translated.isdigit():
        return None

    value = int(translated)
    if value > maximum:
        return None
    return str(value)


def ocr_candidates(
    reader: Any,
    crop: Any,
    minimum_confidence: float,
    maximum_bib_number: int,
) -> list[dict[str, Any]]:
    crop_height, crop_width = crop.shape[:2]
    if crop_height < 20 or crop_width < 20:
        return []

    results = reader.readtext(
        crop,
        detail=1,
        paragraph=False,
        min_size=8,
        text_threshold=0.45,
        low_text=0.25,
        link_threshold=0.25,
        canvas_size=1280,
        mag_ratio=1.5,
        contrast_ths=0.05,
        adjust_contrast=0.7,
    )
    candidates: list[dict[str, Any]] = []
    for points, raw_text, confidence in results:
        number = normalize_bib_number(str(raw_text), maximum_bib_number)
        if not number or float(confidence) < minimum_confidence:
            continue

        xs = [float(point[0]) for point in points]
        ys = [float(point[1]) for point in points]
        text_width = max(xs) - min(xs)
        text_height = max(ys) - min(ys)
        width_ratio = text_width / crop_width
        height_ratio = text_height / crop_height

        # Bib numbers are normally the dominant numeric line inside a detected bib.
        if height_ratio < 0.055 and width_ratio < 0.1:
            continue

        size_quality = min(1.0, height_ratio / 0.22) * 0.65 + min(1.0, width_ratio / 0.5) * 0.35
        score = float(confidence) * (0.55 + 0.45 * size_quality)
        candidates.append(
            {
                "number": number,
                "raw_text": str(raw_text),
                "ocr_confidence": round(float(confidence), 4),
                "score": round(score, 4),
                "box": [[round(float(x), 1), round(float(y), 1)] for x, y in points],
                "width_ratio": round(width_ratio, 4),
                "height_ratio": round(height_ratio, 4),
            }
        )
    return sorted(candidates, key=lambda item: item["score"], reverse=True)


def person_torso_boxes(
    detector: Any,
    image: Any,
    args: argparse.Namespace,
) -> tuple[list[list[int]], list[float]]:
    result = detector.predict(
        source=image,
        device=args.device,
        imgsz=args.imgsz,
        conf=args.person_confidence,
        iou=0.55,
        classes=[0],
        max_det=100,
        verbose=False,
    )[0]
    if result.boxes is None:
        return [], []

    height, width = image.shape[:2]
    torso_boxes: list[list[int]] = []
    confidences: list[float] = []
    for box, confidence in zip(
        result.boxes.xyxy.detach().cpu().tolist(),
        result.boxes.conf.detach().cpu().tolist(),
    ):
        x1, y1, x2, y2 = box
        person_width = x2 - x1
        person_height = y2 - y1
        torso_boxes.append(
            [
                max(0, int(x1 + person_width * 0.04)),
                max(0, int(y1 + person_height * 0.12)),
                min(width, int(x2 - person_width * 0.04)),
                min(height, int(y1 + person_height * 0.76)),
            ]
        )
        confidences.append(float(confidence))
    ranked = sorted(
        zip(torso_boxes, confidences),
        key=lambda item: (
            (item[0][2] - item[0][0]) * (item[0][3] - item[0][1]),
            item[1],
        ),
        reverse=True,
    )[:args.max_person_regions]
    if not ranked:
        return [], []
    ranked_boxes, ranked_confidences = zip(*ranked)
    return list(ranked_boxes), list(ranked_confidences)


def bicycle_plate_boxes(
    detector: Any,
    image: Any,
    args: argparse.Namespace,
) -> tuple[list[list[int]], list[float]]:
    result = detector.predict(
        source=image,
        device=args.device,
        imgsz=args.imgsz,
        conf=args.person_confidence,
        iou=0.55,
        classes=[1],
        max_det=50,
        verbose=False,
    )[0]
    if result.boxes is None:
        return [], []

    height, width = image.shape[:2]
    plate_boxes: list[list[int]] = []
    confidences: list[float] = []
    for box, confidence in zip(
        result.boxes.xyxy.detach().cpu().tolist(),
        result.boxes.conf.detach().cpu().tolist(),
    ):
        x1, y1, x2, y2 = box
        bike_width = x2 - x1
        bike_height = y2 - y1
        plate_boxes.append(
            [
                max(0, int(x1 - bike_width * 0.12)),
                max(0, int(y1 - bike_height * 0.12)),
                min(width, int(x2 + bike_width * 0.12)),
                min(height, int(y1 + bike_height * 0.7)),
            ]
        )
        confidences.append(float(confidence))
    return plate_boxes, confidences


def recognize_photo(
    path: Path,
    detector: Any,
    person_detector: Any | None,
    vision_reader: VisionBibReader | None,
    reader: Any,
    cv2: Any,
    args: argparse.Namespace,
) -> tuple[list[str], dict[str, Any], Any]:
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"Could not read image: {path}")

    height, width = image.shape[:2]
    annotated = image.copy()
    detections: list[dict[str, Any]] = []
    accepted: dict[str, float] = {}

    boxes, confidences = detector_boxes(detector, image, args)
    for raw_box, detection_confidence in zip(boxes, confidences):
        x1, y1, x2, y2 = padded_box(raw_box, width, height)
        crop = image[y1:y2, x1:x2]
        candidates = ocr_candidates(
            reader, crop, args.ocr_confidence, args.maximum_bib_number
        )
        best = candidates[0] if candidates else None
        number = best["number"] if best else ""
        combined_score = float(detection_confidence) * float(best["score"]) if best else 0.0
        if number:
            accepted[number] = max(accepted.get(number, 0.0), combined_score)

        detections.append(
            {
                "bib_box": [x1, y1, x2, y2],
                "detection_confidence": round(float(detection_confidence), 4),
                "number": number or None,
                "combined_score": round(combined_score, 4),
                "ocr_candidates": candidates[:5],
            }
        )

        color = (35, 190, 80) if number else (50, 150, 255)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, max(2, width // 1800))
        label = number or "bib?"
        cv2.putText(
            annotated,
            f"{label} {float(detection_confidence):.2f}",
            (x1, max(24, y1 - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            max(0.65, width / 6000),
            color,
            max(2, width // 2200),
            cv2.LINE_AA,
        )

    person_regions: list[dict[str, Any]] = []
    if person_detector is not None:
        torso_boxes, person_confidences = person_torso_boxes(person_detector, image, args)
        for torso_box, person_confidence in zip(torso_boxes, person_confidences):
            x1, y1, x2, y2 = torso_box
            crop = image[y1:y2, x1:x2]
            candidates = ocr_candidates(
                reader, crop, args.ocr_confidence, args.maximum_bib_number
            )
            best = candidates[0] if candidates else None
            number = best["number"] if best else ""
            combined_score = (
                float(person_confidence) * float(best["score"]) * 0.8 if best else 0.0
            )
            if number:
                accepted[number] = max(accepted.get(number, 0.0), combined_score)
                color = (220, 125, 35)
                cv2.rectangle(
                    annotated, (x1, y1), (x2, y2), color, max(2, width // 1800)
                )
                cv2.putText(
                    annotated,
                    f"{number} torso",
                    (x1, max(24, y1 - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    max(0.65, width / 6000),
                    color,
                    max(2, width // 2200),
                    cv2.LINE_AA,
                )

            person_regions.append(
                {
                    "torso_box": torso_box,
                    "person_confidence": round(person_confidence, 4),
                    "number": number or None,
                    "combined_score": round(combined_score, 4),
                    "ocr_candidates": candidates[:5],
                }
            )

    bicycle_regions: list[dict[str, Any]] = []
    if person_detector is not None and args.bicycle_fallback:
        plate_boxes, bicycle_confidences = bicycle_plate_boxes(
            person_detector, image, args
        )
        for plate_box, bicycle_confidence in zip(plate_boxes, bicycle_confidences):
            x1, y1, x2, y2 = plate_box
            crop = image[y1:y2, x1:x2]
            candidates = ocr_candidates(
                reader, crop, args.ocr_confidence, args.maximum_bib_number
            )
            best = candidates[0] if candidates else None
            number = best["number"] if best else ""
            combined_score = (
                float(bicycle_confidence) * float(best["score"]) * 0.8
                if best
                else 0.0
            )
            bicycle_regions.append(
                {
                    "bicycle_plate_box": plate_box,
                    "bicycle_confidence": round(bicycle_confidence, 4),
                    "number": number or None,
                    "combined_score": round(combined_score, 4),
                    "ocr_candidates": candidates[:5],
                }
            )

            color = (180, 95, 220)
            cv2.rectangle(
                annotated, (x1, y1), (x2, y2), color, max(2, width // 1800)
            )
            if number:
                cv2.putText(
                    annotated,
                    f"{number} bike",
                    (x1, max(24, y1 - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    max(0.65, width / 6000),
                    color,
                    max(2, width // 2200),
                    cv2.LINE_AA,
                )

    scene_scan_regions: list[dict[str, Any]] = []
    if args.allow_unseeded_vlm:
        for scan_box in overlapping_scan_boxes(width, height):
            x1, y1, x2, y2 = scan_box
            candidates = ocr_candidates(
                reader,
                image[y1:y2, x1:x2],
                args.ocr_confidence,
                args.maximum_bib_number,
            )
            scene_scan_regions.append(
                {
                    "scene_scan_box": scan_box,
                    "ocr_candidates": candidates[:5],
                }
            )

    ocr_numbers: set[str] = set()
    for region in (
        detections + person_regions + bicycle_regions + scene_scan_regions
    ):
        candidates = region.get("ocr_candidates") or []
        if not candidates:
            continue
        best = candidates[0]
        number = str(best["number"])
        minimum_confidence = 0.78 if len(number) == 1 else 0.5
        minimum_score = 0.45 if len(number) == 1 else 0.0
        if (
            len(number) >= args.minimum_bib_digits
            and float(best["ocr_confidence"]) >= minimum_confidence
            and float(best["score"]) >= minimum_score
        ):
            ocr_numbers.add(number)

    vlm_numbers: list[str] = []
    vlm_response = ""
    if vision_reader is not None:
        all_regions = detections + person_regions + bicycle_regions + scene_scan_regions
        focused_ocr_regions = ocr_focus_boxes(all_regions, width, height)[:20]
        bib_regions = [region["bib_box"] for region in detections[:8]]
        largest_torso_regions = sorted(
            (region["torso_box"] for region in person_regions),
            key=lambda box: (box[2] - box[0]) * (box[3] - box[1]),
            reverse=True,
        )[:20]
        largest_bicycle_regions = sorted(
            (region["bicycle_plate_box"] for region in bicycle_regions),
            key=lambda box: (box[2] - box[0]) * (box[3] - box[1]),
            reverse=True,
        )[:12]
        object_regions = largest_bicycle_regions + largest_torso_regions + bib_regions
        scan_regions = []
        if not object_regions:
            scan_regions = [
                region["scene_scan_box"] for region in scene_scan_regions
            ]
        vlm_candidate_boxes = (
            object_regions
            + focused_ocr_regions
            + scan_regions
        )
        vlm_numbers, vlm_response = vision_reader.read_numbers(
            image,
            args.maximum_bib_number,
            vlm_candidate_boxes,
            sorted(ocr_numbers, key=lambda value: (int(value), value)),
            args.allow_unseeded_vlm,
        )

    # OCR is useful for proposing regions, but distant digits can be confidently wrong.
    # Publish only the visual reader's verified values when it is enabled; keep the OCR
    # values in the private report for manual review and for non-VLM fallback runs.
    merged_numbers = set(vlm_numbers if vision_reader is not None else ocr_numbers)
    numbers = sorted(merged_numbers, key=lambda value: (int(value), value))
    report = {
        "file": path.name,
        "bib_numbers": numbers,
        "ocr_bib_numbers": sorted(ocr_numbers, key=lambda value: (int(value), value)),
        "vlm_bib_numbers": vlm_numbers,
        "vlm_response": vlm_response,
        "vlm_seeded_by_ocr": bool(ocr_numbers),
        "vlm_region_count": len(vlm_candidate_boxes) if vision_reader is not None else 0,
        "detections": detections,
        "person_torso_regions": person_regions,
        "bicycle_plate_regions": bicycle_regions,
        "scene_scan_regions": scene_scan_regions,
    }
    return numbers, report, annotated


def write_gallery(path: Path, data: dict[str, Any], results: dict[str, list[str]]) -> None:
    for photo in data["photos"]:
        filename = str(photo.get("file") or "")
        if filename not in results:
            continue
        detected = results[filename]
        manual = photo.get("bib_numbers_manual")
        photo["bib_numbers_detected"] = detected
        photo["bib_numbers"] = manual if isinstance(manual, list) else detected
    path.write_text(
        yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=1000),
        encoding="utf-8",
    )


def main() -> int:
    args = parse_args()
    cv2, easyocr, np, torch, YOLO = load_dependencies()
    if args.device != "cpu" and not torch.cuda.is_available():
        raise SystemExit("CUDA was requested but torch.cuda.is_available() is false.")
    if not args.model.is_file():
        raise SystemExit(f"Bib detector weights not found: {args.model}")

    gallery = load_gallery(args.gallery)
    paths = image_paths(args.source_dir, args.files, args.limit)
    args.review_dir.mkdir(parents=True, exist_ok=True)
    preview_dir = args.review_dir / "previews"
    preview_dir.mkdir(parents=True, exist_ok=True)
    args.ocr_model_dir.mkdir(parents=True, exist_ok=True)

    if args.model_format == "yolov7":
        detector = LegacyYoloV7Detector(
            args.model, args.yolov7_source, args.device, torch, np
        )
    else:
        detector = YOLO(str(args.model))
    person_detector = None
    if not args.no_person_fallback:
        if not args.person_model.is_file():
            raise SystemExit(f"Person detector weights not found: {args.person_model}")
        person_detector = YOLO(str(args.person_model))
    vision_reader = None
    if not args.no_vlm:
        vision_reader = VisionBibReader(args.vlm_model, args.device, torch)
    reader = easyocr.Reader(
        ["en"],
        gpu=args.device != "cpu",
        model_storage_directory=str(args.ocr_model_dir),
        download_enabled=True,
        verbose=False,
    )

    reports: list[dict[str, Any]] = []
    public_results: dict[str, list[str]] = {}
    for index, path in enumerate(paths, start=1):
        numbers, report, annotated = recognize_photo(
            path, detector, person_detector, vision_reader, reader, cv2, args
        )
        reports.append(report)
        public_results[path.name] = numbers
        cv2.imwrite(str(preview_dir / path.name), annotated)
        print(f"[{index:03d}/{len(paths):03d}] {path.name}: {', '.join(numbers) or '-'}", flush=True)

    if args.allow_unseeded_vlm and args.unseeded_min_occurrences > 1:
        occurrence_counts: dict[str, int] = defaultdict(int)
        for numbers in public_results.values():
            for number in numbers:
                occurrence_counts[number] += 1

        removed_count = 0
        for report in reports:
            if report["vlm_seeded_by_ocr"]:
                continue
            filename = report["file"]
            before_consensus = public_results[filename]
            after_consensus = [
                number
                for number in before_consensus
                if occurrence_counts[number] >= args.unseeded_min_occurrences
            ]
            if after_consensus != before_consensus:
                report["bib_numbers_before_consensus"] = before_consensus
                report["bib_numbers"] = after_consensus
                public_results[filename] = after_consensus
                removed_count += len(before_consensus) - len(after_consensus)
        print(
            f"Removed {removed_count} unseeded one-off labels with gallery consensus.",
            flush=True,
        )

    number_index: dict[str, list[str]] = defaultdict(list)
    for filename, numbers in public_results.items():
        for number in numbers:
            number_index[number].append(filename)

    report_path = args.review_dir / "results.json"
    report_path.write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "model": str(args.model),
                "device": args.device,
                "photos": reports,
                "number_index": dict(sorted(number_index.items(), key=lambda item: int(item[0]))),
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    if args.write:
        write_gallery(args.gallery, gallery, public_results)
        print(f"Updated {args.gallery}")
    else:
        print("Dry run: gallery YAML was not changed.")
    print(f"Review report: {report_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
