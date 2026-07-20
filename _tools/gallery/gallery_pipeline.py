#!/usr/bin/env python3
"""Local gallery asset pipeline.

This script is intentionally local tooling. It reads original or medium-size
photos, generates site assets, suggests smart thumbnail crops, and updates
`_data/gallery.yml` when run with `--write`.
"""

from __future__ import annotations

import argparse
import html
import hashlib
import json
import math
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}


DEFAULT_CONFIG: dict[str, Any] = {
    "gallery_yml": "_data/gallery.yml",
    "medium_dir": "assets/photos/full",
    "thumb_dir": "assets/photos/thumbs",
    "medium_long_edge": 2560,
    "thumb_width": 640,
    "thumb_height": 480,
    "jpeg_quality": 88,
    "smart_crop": {
        "enabled": True,
        "method": "yolo",
        "yolo_model": "yolo11n.pt",
        "yolo_confidence": 0.25,
        "crop_margin": 0.24,
        "important_classes": {
            "person": 1.0,
            "sports ball": 0.8,
            "bicycle": 0.5,
            "skateboard": 0.5,
            "skis": 0.5,
            "snowboard": 0.5,
        },
    },
    "semantic_labels": {
        "enabled": False,
        "model": "ViT-B-32",
        "pretrained": "laion2b_s34b_b79k",
        "device": "auto",
        "prompt_template": "a documentary sports and event photo of {label}",
        "top_k": 8,
        "candidates": [
            "Sports",
            "Sports/Volleyball",
            "Sports/Weightlifting",
            "Sports/Powerlifting",
            "Sports/Running",
            "Sports/Climbing",
            "Events/Student Championships",
            "Events/Competition",
            "People/Athlete",
            "People/Portrait",
            "Location/Tamppi Areena",
            "Location/Outdoors",
            "Style/Action",
            "Style/Candid",
        ],
    },
    "vlm": {
        "enabled": False,
        "backend": "qwen_vl",
        "model": "Qwen/Qwen2-VL-2B-Instruct",
        "device": "auto",
        "max_pixels": 1600000,
        "max_new_tokens": 420,
        "include_raw_response": True,
        "prompt": (
            "Analyze this photo using only visible visual evidence. Do not use "
            "the file name, EXIF metadata, existing captions, existing labels, "
            "or prior descriptions. Do not identify private people. If the "
            "location is not clear from visible signs, landmarks, uniforms, or "
            "other image evidence, set location.value to null and "
            'location.confidence to "unknown". Return compact valid JSON only, '
            "on one line, with no markdown fence. Fill in actual observations "
            "from the image; do not copy the instructions or schema wording "
            "into any value. The JSON object must contain labels, location, "
            "event_or_setting, short_caption, and uncertainty_notes. Labels "
            "must be exactly 8 unique short lowercase visual labels. Location "
            "and event_or_setting must each contain value, confidence, and "
            "evidence. For event_or_setting.value, give the best visible event "
            "or setting type when an activity or scene is clear; use null only "
            "when the activity and setting are unclear. Do not include unknown, "
            "personal names, or random OCR text as labels. Use confidence "
            "values high, medium, low, or unknown."
        ),
    },
    "preview": {
        "output_dir": "gallery-ai-preview",
        "title": "AI Gallery Preview",
    },
}


def require_yaml():
    try:
        import yaml  # type: ignore

        return yaml
    except ImportError as exc:
        raise SystemExit(
            "Missing dependency: PyYAML. Install _tools/gallery/requirements.txt first."
        ) from exc


def require_pillow():
    try:
        from PIL import ExifTags, Image, ImageOps  # type: ignore

        return ExifTags, Image, ImageOps
    except ImportError as exc:
        raise SystemExit(
            "Missing dependency: Pillow. Install _tools/gallery/requirements.txt first."
        ) from exc


def prepare_optional_ai_runtime() -> None:
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")


def deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def load_config(path: Path | None) -> dict[str, Any]:
    config = DEFAULT_CONFIG
    if path and path.exists():
        yaml = require_yaml()
        with path.open("r", encoding="utf-8") as f:
            loaded = yaml.safe_load(f) or {}
        config = deep_merge(config, loaded)
    return config


def load_gallery(path: Path) -> dict[str, Any]:
    yaml = require_yaml()
    if not path.exists():
        return {"generated_at": "", "count": 0, "photos": []}
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {"generated_at": "", "count": 0, "photos": []}


def write_gallery(path: Path, data: dict[str, Any]) -> None:
    yaml = require_yaml()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, sort_keys=False, allow_unicode=True, width=120)


def repo_path(path: Path) -> str:
    return path.as_posix()


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def discover_images(source_dir: Path) -> list[Path]:
    return sorted(
        p for p in source_dir.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTS
    )


def rational_to_float(value: Any) -> float | None:
    try:
        if hasattr(value, "numerator") and hasattr(value, "denominator"):
            if value.denominator == 0:
                return None
            return float(value.numerator) / float(value.denominator)
        if isinstance(value, tuple) and len(value) == 2 and value[1] != 0:
            return float(value[0]) / float(value[1])
        return float(value)
    except Exception:
        return None


def format_exposure(value: Any) -> str | None:
    f = rational_to_float(value)
    if not f or f <= 0:
        return None
    if f < 1:
        denom = round(1 / f)
        return f"1/{denom}s"
    return f"{f:g}s"


def format_aperture(value: Any) -> str | None:
    f = rational_to_float(value)
    if not f:
        return None
    return f"f/{f:.1f}".rstrip("0").rstrip(".")


def format_focal_length(value: Any) -> str | None:
    f = rational_to_float(value)
    if not f:
        return None
    return f"{f:.0f} mm" if abs(f - round(f)) < 0.05 else f"{f:.1f} mm"


def parse_exif_datetime(value: str | None, subsec: Any = None) -> str | None:
    if not value:
        return None
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            dt = datetime.strptime(str(value), fmt)
            subsec_text = "" if subsec is None else str(subsec).strip()
            if subsec_text.isdigit() and int(subsec_text) > 0:
                microsecond = int((subsec_text + "000000")[:6])
                dt = dt.replace(microsecond=microsecond)
                return dt.isoformat(timespec="microseconds")
            return dt.isoformat(timespec="seconds")
        except ValueError:
            continue
    return str(value)


def extract_exif(path: Path) -> dict[str, Any]:
    ExifTags, Image, ImageOps = require_pillow()
    try:
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im)
            width, height = im.size
            raw = im.getexif()
    except Exception:
        return {}

    tag_names = getattr(ExifTags, "TAGS", {})
    exif = {tag_names.get(k, k): v for k, v in raw.items()}
    if hasattr(raw, "get_ifd") and hasattr(ExifTags, "IFD"):
        for ifd_name in ("Exif", "GPSInfo"):
            ifd = getattr(ExifTags.IFD, ifd_name, None)
            if ifd is None:
                continue
            try:
                nested = raw.get_ifd(ifd)
            except Exception:
                nested = {}
            for key, value in nested.items():
                exif[tag_names.get(key, key)] = value

    meta: dict[str, Any] = {
        "original_width": width,
        "original_height": height,
        "aspect_ratio": round(width / height, 6) if height else None,
    }

    captured_at = parse_exif_datetime(
        exif.get("DateTimeOriginal") or exif.get("DateTimeDigitized") or exif.get("DateTime"),
        exif.get("SubsecTimeOriginal") or exif.get("SubsecTimeDigitized") or exif.get("SubsecTime"),
    )
    if captured_at:
        meta["captured_at"] = captured_at

    camera = exif.get("Model")
    if camera:
        meta["camera_model"] = str(camera).strip()

    lens = exif.get("LensModel")
    if lens:
        meta["lens_model"] = str(lens).strip()

    focal = format_focal_length(exif.get("FocalLength"))
    if focal:
        meta["focal_length"] = focal

    aperture = format_aperture(exif.get("FNumber"))
    if aperture:
        meta["aperture"] = aperture

    exposure = format_exposure(exif.get("ExposureTime"))
    if exposure:
        meta["exposure_time"] = exposure

    iso = exif.get("ISOSpeedRatings") or exif.get("PhotographicSensitivity")
    if iso:
        if isinstance(iso, (list, tuple)):
            iso = iso[0]
        meta["iso"] = int(iso) if str(iso).isdigit() else str(iso)

    return {k: v for k, v in meta.items() if v is not None}


@dataclass
class CropDecision:
    box: tuple[int, int, int, int]
    method: str
    detail: str = ""


@dataclass
class BuildResult:
    exit_code: int
    summary: dict[str, Any]
    gallery: dict[str, Any]
    gallery_path: Path


class YoloDetector:
    def __init__(self, model_name: str, confidence: float, class_weights: dict[str, float]) -> None:
        self.model_name = model_name
        self.confidence = confidence
        self.class_weights = class_weights
        self.model = None
        self.error = ""

    def load(self) -> bool:
        if self.model is not None:
            return True
        try:
            prepare_optional_ai_runtime()
            from ultralytics import YOLO  # type: ignore

            self.model = YOLO(self.model_name)
            return True
        except Exception as exc:
            self.error = str(exc)
            return False

    def detect_focus_box(self, image_path: Path) -> tuple[float, float, float, float] | None:
        if not self.load() or self.model is None:
            return None

        try:
            results = self.model(str(image_path), verbose=False, conf=self.confidence)
        except Exception as exc:
            self.error = str(exc)
            return None

        if not results:
            return None

        names = getattr(self.model, "names", {}) or {}
        chosen: list[tuple[float, tuple[float, float, float, float]]] = []
        for box in getattr(results[0], "boxes", []) or []:
            try:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                label = names.get(cls_id, str(cls_id))
                weight = float(self.class_weights.get(label, 0.25))
                x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
                area = max(1.0, (x2 - x1) * (y2 - y1))
                score = conf * weight * math.sqrt(area)
            except Exception:
                continue
            if score > 0:
                chosen.append((score, (x1, y1, x2, y2)))

        if not chosen:
            return None

        chosen.sort(reverse=True, key=lambda item: item[0])
        selected = [box for _, box in chosen[:4]]
        x1 = min(b[0] for b in selected)
        y1 = min(b[1] for b in selected)
        x2 = max(b[2] for b in selected)
        y2 = max(b[3] for b in selected)
        return (x1, y1, x2, y2)


class OpenClipLabeler:
    def __init__(
        self,
        model_name: str,
        pretrained: str,
        candidates: list[str],
        top_k: int,
        device: str = "auto",
        prompt_template: str = "a photo of {label}",
    ) -> None:
        self.model_name = model_name
        self.pretrained = pretrained
        self.candidates = candidates
        self.top_k = top_k
        self.device = device
        self.prompt_template = prompt_template
        self.ready = False
        self.error = ""
        self.model = None
        self.preprocess = None
        self.tokenizer = None
        self.text_features = None
        self.torch = None

    def load(self) -> bool:
        if self.ready:
            return True
        try:
            prepare_optional_ai_runtime()
            import open_clip  # type: ignore
            import torch  # type: ignore

            if not self.candidates:
                self.error = "No semantic label candidates configured."
                return False

            device = self.device
            if device == "auto":
                device = "cuda" if torch.cuda.is_available() else "cpu"

            model, _, preprocess = open_clip.create_model_and_transforms(
                self.model_name, pretrained=self.pretrained
            )
            tokenizer = open_clip.get_tokenizer(self.model_name)
            model.eval().to(device)
            prompts = [
                self.prompt_template.format(label=label.replace("/", ", "))
                for label in self.candidates
            ]
            with torch.no_grad():
                text = tokenizer(prompts).to(device)
                text_features = model.encode_text(text)
                text_features = text_features / text_features.norm(dim=-1, keepdim=True)

            self.model = model
            self.preprocess = preprocess
            self.tokenizer = tokenizer
            self.text_features = text_features
            self.torch = torch
            self.device = device
            self.ready = True
            return True
        except Exception as exc:
            self.error = str(exc)
            return False

    def suggest(self, image_path: Path) -> list[dict[str, Any]]:
        if not self.load():
            return []
        _, Image, ImageOps = require_pillow()
        assert self.model is not None
        assert self.preprocess is not None
        assert self.text_features is not None
        assert self.torch is not None

        with Image.open(image_path) as im:
            image = ImageOps.exif_transpose(im).convert("RGB")
            image_tensor = self.preprocess(image).unsqueeze(0).to(self.device)

        with self.torch.no_grad():
            image_features = self.model.encode_image(image_tensor)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            probs = (100.0 * image_features @ self.text_features.T).softmax(dim=-1)[0]
            values, indices = probs.topk(min(self.top_k, len(self.candidates)))

        return [
            {"label": self.candidates[int(idx)], "score": round(float(score), 4)}
            for score, idx in zip(values, indices)
        ]


def parse_json_object(text: str) -> dict[str, Any] | None:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`").strip()
        if stripped.lower().startswith("json"):
            stripped = stripped[4:].strip()

    candidates = [stripped]
    first = stripped.find("{")
    last = stripped.rfind("}")
    if first >= 0 and last > first:
        candidates.append(stripped[first : last + 1])

    for candidate in candidates:
        repaired = re.sub(r"//.*?(?=\r?\n|$)", "", candidate)
        repaired = re.sub(r",(\s*[}\]])", r"\1", repaired)
        for variant in (candidate, repaired):
            try:
                parsed = json.loads(variant)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict):
                return parsed
    return None


def normalize_text_list(value: Any, limit: int = 12) -> list[str]:
    if isinstance(value, str):
        values = [value]
    elif isinstance(value, list):
        values = value
    else:
        values = []

    out: list[str] = []
    seen: set[str] = set()
    placeholder_values = {
        "5 to 12 short lowercase labels",
        "labels",
        "actual short lowercase visual labels",
        "unknown",
    }
    for entry in values:
        text = str(entry).strip().lower()
        text = " ".join(text.split())
        if not text or text in seen or text in placeholder_values:
            continue
        seen.add(text)
        out.append(text[:80])
        if len(out) >= limit:
            break
    return out


def normalize_evidence(value: Any) -> list[str]:
    if isinstance(value, list):
        values = value
    elif value:
        values = [value]
    else:
        values = []
    placeholder_values = {"visible clues", "visible evidence", "image evidence"}
    return [
        str(v).strip()[:160]
        for v in values
        if str(v).strip() and str(v).strip().lower() not in placeholder_values
    ][:5]


def normalize_confidence(value: Any) -> str:
    if isinstance(value, (int, float)):
        if value >= 0.75:
            return "high"
        if value >= 0.4:
            return "medium"
        if value > 0:
            return "low"
        return "unknown"
    confidence = str(value or "unknown").strip().lower()
    return confidence if confidence in {"high", "medium", "low", "unknown"} else "unknown"


def normalize_vlm_claim(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        raw_value = value.get("value")
        if raw_value is None:
            alternate_parts = [
                str(part).strip()
                for part in (value.get("_activity"), value.get("_setting"))
                if str(part or "").strip()
                and str(part).strip().lower() not in {"unknown", "unclear", "none", "null"}
            ]
            raw_value = ", ".join(alternate_parts) if alternate_parts else None
        confidence = value.get("confidence")
        if confidence is None and raw_value:
            confidence = "medium"
        evidence = value.get("evidence")
    else:
        raw_value = value
        confidence = None
        evidence = None

    text_value = None if raw_value is None else str(raw_value).strip()
    if text_value and text_value.lower() in {
        "unknown",
        "unclear",
        "not clear",
        "none",
        "null",
        "short event or setting type",
        "place name",
    }:
        text_value = None

    normalized_confidence = normalize_confidence(confidence)
    if not text_value:
        normalized_confidence = "unknown"

    return {
        "value": text_value or None,
        "confidence": normalized_confidence,
        "evidence": normalize_evidence(evidence),
    }


def normalize_vlm_result(
    parsed: dict[str, Any] | None,
    raw_response: str,
    model_name: str,
    include_raw: bool,
) -> dict[str, Any]:
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    if not parsed:
        result: dict[str, Any] = {
            "model": model_name,
            "generated_at": generated_at,
            "error": "Could not parse model response as JSON.",
        }
        if include_raw:
            result["raw_response"] = raw_response[:4000]
        return result

    result = {
        "model": model_name,
        "generated_at": generated_at,
        "labels": normalize_text_list(parsed.get("labels")),
        "location": normalize_vlm_claim(parsed.get("location")),
        "event_or_setting": normalize_vlm_claim(parsed.get("event_or_setting")),
        "short_caption": str(parsed.get("short_caption") or "").strip()[:300],
        "uncertainty_notes": normalize_evidence(parsed.get("uncertainty_notes")),
    }
    if not result["short_caption"]:
        event_value = result["event_or_setting"].get("value")
        if event_value:
            result["short_caption"] = f"Photo showing {event_value}."
        elif result["labels"]:
            result["short_caption"] = f"Photo showing {', '.join(result['labels'][:3])}."
    if include_raw:
        result["raw_response"] = raw_response[:4000]
    return result


class VlmAnalyzer:
    def __init__(
        self,
        model_name: str,
        device: str = "auto",
        max_pixels: int = 1600000,
        max_new_tokens: int = 420,
        prompt: str = "",
        include_raw_response: bool = True,
    ) -> None:
        self.model_name = model_name
        self.device = device
        self.max_pixels = max_pixels
        self.max_new_tokens = max_new_tokens
        self.prompt = prompt
        self.include_raw_response = include_raw_response
        self.ready = False
        self.error = ""
        self.model = None
        self.processor = None
        self.process_vision_info = None
        self.torch = None

    def load(self) -> bool:
        if self.ready:
            return True
        try:
            prepare_optional_ai_runtime()
            import torch  # type: ignore
            from qwen_vl_utils import process_vision_info  # type: ignore
            from transformers import AutoProcessor  # type: ignore

            model_id = self.model_name.lower()
            if "qwen2-vl" in model_id:
                from transformers import Qwen2VLForConditionalGeneration as ModelClass  # type: ignore
            elif "qwen2.5-vl" in model_id or "qwen2_5_vl" in model_id:
                from transformers import Qwen2_5_VLForConditionalGeneration as ModelClass  # type: ignore
            else:
                from transformers import AutoModelForImageTextToText as ModelClass  # type: ignore

            device = self.device
            if device == "auto":
                device = "cuda" if torch.cuda.is_available() else "cpu"

            model_kwargs: dict[str, Any] = {}
            if device == "cuda":
                model_kwargs["torch_dtype"] = "auto"
                model_kwargs["device_map"] = "auto"
            else:
                model_kwargs["torch_dtype"] = torch.float32

            model = ModelClass.from_pretrained(self.model_name, **model_kwargs)
            if "device_map" not in model_kwargs:
                model.to(device)
            model.eval()

            self.model = model
            self.processor = AutoProcessor.from_pretrained(self.model_name)
            self.process_vision_info = process_vision_info
            self.torch = torch
            self.device = device
            self.ready = True
            return True
        except Exception as exc:
            self.error = (
                f"{exc}. Install transformers, accelerate, qwen-vl-utils, and a compatible torch build."
            )
            return False

    def analyze(self, image_path: Path) -> dict[str, Any]:
        if not self.load():
            return {
                "model": self.model_name,
                "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
                "error": self.error or "VLM model could not be loaded.",
            }

        assert self.model is not None
        assert self.processor is not None
        assert self.process_vision_info is not None
        assert self.torch is not None

        image_content: dict[str, Any] = {
            "type": "image",
            "image": str(image_path.resolve()),
        }
        if self.max_pixels:
            image_content["max_pixels"] = int(self.max_pixels)

        messages = [
            {
                "role": "system",
                "content": "You are a careful visual metadata assistant. Return compact valid JSON only.",
            },
            {
                "role": "user",
                "content": [
                    image_content,
                    {"type": "text", "text": self.prompt},
                ],
            }
        ]

        try:
            text = self.processor.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
            )
            image_inputs, video_inputs = self.process_vision_info(messages)
            inputs = self.processor(
                text=[text],
                images=image_inputs,
                videos=video_inputs,
                padding=True,
                return_tensors="pt",
            )
            inputs = inputs.to(self.device)

            with self.torch.no_grad():
                generated_ids = self.model.generate(
                    **inputs,
                    do_sample=False,
                    repetition_penalty=1.12,
                    no_repeat_ngram_size=4,
                    max_new_tokens=self.max_new_tokens,
                )
            generated_trimmed = [
                out_ids[len(in_ids) :] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
            ]
            raw_response = self.processor.batch_decode(
                generated_trimmed,
                skip_special_tokens=True,
                clean_up_tokenization_spaces=False,
            )[0].strip()
        except Exception as exc:
            return {
                "model": self.model_name,
                "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
                "error": str(exc),
            }

        parsed = parse_json_object(raw_response)
        return normalize_vlm_result(
            parsed,
            raw_response=raw_response,
            model_name=self.model_name,
            include_raw=self.include_raw_response,
        )


def crop_from_focus(
    image_w: int,
    image_h: int,
    target_aspect: float,
    focus: tuple[float, float, float, float] | None,
    margin: float,
) -> tuple[int, int, int, int]:
    if not focus:
        if image_w / image_h > target_aspect:
            h = image_h
            w = int(round(h * target_aspect))
        else:
            w = image_w
            h = int(round(w / target_aspect))
        x = (image_w - w) // 2
        y = (image_h - h) // 2
        return (x, y, x + w, y + h)

    fx1, fy1, fx2, fy2 = focus
    fw = max(1.0, fx2 - fx1)
    fh = max(1.0, fy2 - fy1)
    fx1 -= fw * margin
    fx2 += fw * margin
    fy1 -= fh * margin
    fy2 += fh * margin

    fw = max(1.0, fx2 - fx1)
    fh = max(1.0, fy2 - fy1)
    cx = (fx1 + fx2) / 2
    cy = (fy1 + fy2) / 2

    if fw / fh > target_aspect:
        crop_w = fw
        crop_h = fw / target_aspect
    else:
        crop_h = fh
        crop_w = fh * target_aspect

    crop_w = min(float(image_w), max(crop_w, image_w * 0.28))
    crop_h = min(float(image_h), max(crop_h, image_h * 0.28))

    if crop_w / crop_h > target_aspect:
        crop_w = crop_h * target_aspect
    else:
        crop_h = crop_w / target_aspect

    x1 = max(0.0, min(float(image_w) - crop_w, cx - crop_w / 2))
    y1 = max(0.0, min(float(image_h) - crop_h, cy - crop_h / 2))
    x2 = x1 + crop_w
    y2 = y1 + crop_h
    return (round(x1), round(y1), round(x2), round(y2))


def save_medium(source: Path, dest: Path, long_edge: int, quality: int, write: bool) -> tuple[int, int]:
    _, Image, ImageOps = require_pillow()
    with Image.open(source) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        w, h = im.size
        scale = min(1.0, long_edge / max(w, h))
        new_size = (max(1, round(w * scale)), max(1, round(h * scale)))
        if write:
            dest.parent.mkdir(parents=True, exist_ok=True)
            out = im.resize(new_size, Image.Resampling.LANCZOS) if new_size != im.size else im
            out.save(dest, "JPEG", quality=quality, optimize=True)
        return new_size


def save_thumbnail(
    source: Path,
    dest: Path,
    thumb_w: int,
    thumb_h: int,
    detector: YoloDetector | None,
    margin: float,
    quality: int,
    write: bool,
) -> tuple[tuple[int, int, int, int], str, str]:
    _, Image, ImageOps = require_pillow()
    with Image.open(source) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        image_w, image_h = im.size

        focus = detector.detect_focus_box(source) if detector else None
        method = "yolo" if focus else "center"
        detail = detector.model_name if focus and detector else ""
        if detector and not focus and detector.error:
            detail = f"YOLO unavailable: {detector.error}"

        box = crop_from_focus(image_w, image_h, thumb_w / thumb_h, focus, margin)
        if write:
            dest.parent.mkdir(parents=True, exist_ok=True)
            thumb = im.crop(box).resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
            thumb.save(dest, "JPEG", quality=quality, optimize=True)
        return box, method, detail


def item_for_file(existing: dict[str, Any] | None, filename: str) -> dict[str, Any]:
    item = dict(existing or {})
    item.setdefault("name", Path(filename).stem)
    item["file"] = filename
    return item


def rel_from_root(root: Path, path: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def source_for_existing_item(root: Path, item: dict[str, Any]) -> Path | None:
    full = item.get("full") or item.get("medium")
    if full:
        candidate = root / str(full)
        if candidate.exists():
            return candidate
    thumb = item.get("thumb")
    if thumb:
        candidate = root / str(thumb)
        if candidate.exists():
            return candidate
    return None


def make_asset_name(source: Path) -> str:
    return f"{source.stem}.jpg"


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "gallery"


def drive_folder_url(folder_id: str) -> str:
    folder_id = folder_id.strip()
    return f"https://drive.google.com/drive/folders/{folder_id}" if folder_id else ""


def html_escape(value: Any) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def drive_download_url(item: dict[str, Any]) -> str:
    drive_id = str(item.get("drive_id") or "").strip()
    if not drive_id:
        return ""
    return f"https://drive.google.com/uc?export=download&id={html_escape(drive_id)}"


def preview_relative_path(output_dir: Path, repo_relative: str) -> str:
    if not repo_relative:
        return ""
    if repo_relative.startswith(("http://", "https://")):
        return repo_relative
    path = Path(repo_relative)
    target = path if path.is_absolute() else Path.cwd() / path
    return Path(os.path.relpath(target.resolve(), output_dir.resolve())).as_posix()


def suggestion_summary(item: dict[str, Any], limit: int = 5) -> str:
    suggestions = item.get("suggested_labels") or []
    labels: list[str] = []
    for suggestion in suggestions[:limit]:
        if isinstance(suggestion, dict):
            label = str(suggestion.get("label") or "").strip()
            score = suggestion.get("score")
            if label and isinstance(score, (float, int)):
                labels.append(f"{label} ({score:.2f})")
            elif label:
                labels.append(label)
        elif suggestion:
            labels.append(str(suggestion))
    return ", ".join(labels)


def vlm_labels_summary(item: dict[str, Any], limit: int = 8) -> str:
    vlm = item.get("vlm") if isinstance(item.get("vlm"), dict) else {}
    labels = vlm.get("labels") if isinstance(vlm, dict) else []
    if not isinstance(labels, list):
        return ""
    return ", ".join(str(label) for label in labels[:limit] if str(label).strip())


def vlm_claim_summary(item: dict[str, Any], key: str) -> str:
    vlm = item.get("vlm") if isinstance(item.get("vlm"), dict) else {}
    claim = vlm.get(key) if isinstance(vlm, dict) else {}
    if not isinstance(claim, dict):
        return ""
    value = str(claim.get("value") or "").strip()
    confidence = str(claim.get("confidence") or "").strip()
    evidence = ", ".join(str(v) for v in claim.get("evidence") or [] if str(v).strip())
    if value and confidence:
        summary = f"{value} ({confidence})"
    elif value:
        summary = value
    elif confidence == "unknown":
        summary = "unknown"
    else:
        summary = ""
    return f"{summary}; evidence: {evidence}" if summary and evidence else summary


def vlm_notes_summary(item: dict[str, Any]) -> str:
    vlm = item.get("vlm") if isinstance(item.get("vlm"), dict) else {}
    notes = vlm.get("uncertainty_notes") if isinstance(vlm, dict) else []
    if not isinstance(notes, list):
        return ""
    return "; ".join(str(note) for note in notes if str(note).strip())


def render_preview_html(output_dir: Path, gallery: dict[str, Any], title: str) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    photos = list(gallery.get("photos") or [])
    generated_at = gallery.get("generated_at") or ""

    cards: list[str] = []
    for item in photos:
        name = str(item.get("name") or Path(str(item.get("file") or "photo")).stem)
        file_name = str(item.get("file") or "")
        desc = str(item.get("description") or "")
        alt = desc or file_name or name
        full = preview_relative_path(output_dir, str(item.get("full") or ""))
        thumb = preview_relative_path(output_dir, str(item.get("thumb") or ""))
        suggestions = suggestion_summary(item)
        vlm_labels = vlm_labels_summary(item)
        vlm_location = vlm_claim_summary(item, "location")
        vlm_event = vlm_claim_summary(item, "event_or_setting")
        vlm = item.get("vlm") if isinstance(item.get("vlm"), dict) else {}
        vlm_caption = str(vlm.get("short_caption") or "") if isinstance(vlm, dict) else ""
        vlm_notes = vlm_notes_summary(item)
        vlm_error = str(vlm.get("error") or "") if isinstance(vlm, dict) else ""
        crop = item.get("crop") if isinstance(item.get("crop"), dict) else {}
        crop_method = str(crop.get("method") or "")
        crop_box = ", ".join(str(v) for v in crop.get("box") or [])
        badges = []
        if vlm_labels:
            top_vlm_label = vlm_labels.split(", ", 1)[0]
            badges.append(f'<span class="preview-pill preview-pill--vlm">{html_escape(top_vlm_label)}</span>')
        if suggestions:
            top_label = suggestions.split(", ", 1)[0]
            badges.append(f'<span class="preview-pill">{html_escape(top_label)}</span>')
        if crop_method:
            badges.append(f'<span class="preview-pill preview-pill--crop">{html_escape(crop_method)}</span>')

        cards.append(
            f"""
      <figure class="photo-card preview-card">
        <button class="photo-thumb"
                type="button"
                data-lightbox
                data-lightbox-group="ai-preview"
                data-lightbox-meta="true"
                data-full="{html_escape(full)}"
                data-thumb="{html_escape(thumb)}"
                data-alt="{html_escape(alt)}"
                data-name="{html_escape(name)}"
                data-file="{html_escape(file_name)}"
                data-download="{drive_download_url(item)}"
                data-description="{html_escape(desc)}"
                data-captured-at="{html_escape(item.get("captured_at") or "")}"
                data-camera-model="{html_escape(item.get("camera_model") or "")}"
                data-lens-model="{html_escape(item.get("lens_model") or "")}"
                data-focal-length="{html_escape(item.get("focal_length") or "")}"
                data-aperture="{html_escape(item.get("aperture") or "")}"
                data-exposure-time="{html_escape(item.get("exposure_time") or "")}"
                data-iso="{html_escape(item.get("iso") or "")}"
                data-suggested-labels="{html_escape(suggestions)}"
                data-vlm-labels="{html_escape(vlm_labels)}"
                data-vlm-location="{html_escape(vlm_location)}"
                data-vlm-event-setting="{html_escape(vlm_event)}"
                data-vlm-caption="{html_escape(vlm_caption)}"
                data-vlm-notes="{html_escape(vlm_notes)}"
                data-vlm-error="{html_escape(vlm_error)}"
                data-crop-method="{html_escape(crop_method)}"
                data-crop-box="{html_escape(crop_box)}"
                aria-label="Open {html_escape(name)}">
          <img src="{html_escape(thumb)}" alt="{html_escape(alt)}" loading="lazy">
        </button>
        <figcaption class="preview-caption">
          <strong>{html_escape(name)}</strong>
          <span>{''.join(badges) if badges else 'No AI metadata yet'}</span>
          {f'<span class="preview-meta-line">{html_escape(vlm_event)}</span>' if vlm_event else ''}
        </figcaption>
      </figure>"""
        )

    html_text = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>{html_escape(title)}</title>
  <link rel="stylesheet" href="../assets/css/style.css">
  <link rel="stylesheet" href="../assets/css/custom.css">
  <style>
    body {{
      padding-bottom: 3rem;
    }}

    .preview-shell {{
      width: calc(100% - 32px);
      max-width: min(1800px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 2rem 0;
    }}

    .preview-intro {{
      max-width: 760px;
      margin-bottom: 1.4rem;
    }}

    .preview-note {{
      color: var(--muted);
    }}

    .preview-caption {{
      display: grid;
      gap: 0.45rem;
      padding: 0.55rem 0 0.2rem;
      color: var(--fg);
      font-size: 0.9rem;
      line-height: 1.25;
    }}

    .preview-pill {{
      display: inline-block;
      margin: 0 0.35rem 0.35rem 0;
      padding: 0.12rem 0.42rem;
      border: 1px solid var(--border);
      background: var(--card);
      color: var(--fg);
      font-size: 0.82rem;
    }}

    .preview-pill--crop {{
      color: var(--muted);
    }}

    .preview-pill--vlm {{
      border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
    }}

    .preview-meta-line {{
      color: var(--muted);
      font-size: 0.82rem;
    }}
  </style>
</head>
<body>
  <main class="preview-shell">
    <div class="preview-intro">
      <h1>{html_escape(title)}</h1>
      <p class="preview-note">
        Local-only preview generated from AI thumbnail crops, semantic label suggestions,
        and optional VLM visual Q&amp;A.
        This folder is ignored by git and is not part of the public site.
      </p>
      <p class="preview-note">Generated: {html_escape(generated_at)}. Photos: {len(photos)}.</p>
    </div>

    <details class="viewer-help" open>
      <summary>Viewer controls</summary>
      <ul>
        <li>Open a photo by selecting its thumbnail.</li>
        <li>Zoom with click, mouse wheel, or pinch. Drag to pan after zooming.</li>
        <li>Use <kbd>Ctrl</kbd> + drag to draw a zoom area on desktop.</li>
        <li>Move between photos with the side buttons, arrow keys, or swipe.</li>
        <li>Close with <kbd>Esc</kbd>, the close button, or the dark area outside the image.</li>
      </ul>
    </details>

    <section class="photo-gallery">
      <div class="photo-grid" id="photoGrid">
{''.join(cards)}
      </div>
    </section>
  </main>
  <script src="../assets/js/lightbox.js"></script>
</body>
</html>
"""

    index_path = output_dir / "index.html"
    index_path.write_text(html_text, encoding="utf-8")
    return index_path


def build_gallery(
    args: argparse.Namespace,
    config_override: dict[str, Any] | None = None,
    write_override: bool | None = None,
    emit_summary: bool = True,
) -> BuildResult:
    root = Path.cwd()
    config = load_config(Path(args.config) if args.config else None)
    if config_override:
        config = deep_merge(config, config_override)
    if args.gallery:
        config["gallery_yml"] = args.gallery
    write = bool(args.write if write_override is None else write_override)
    gallery_path = root / config["gallery_yml"]
    gallery = load_gallery(gallery_path)
    photos: list[dict[str, Any]] = list(gallery.get("photos") or [])
    by_file = {str(p.get("file")): p for p in photos if p.get("file")}

    source_dir = Path(args.source_dir).expanduser() if args.source_dir else None
    source_files = discover_images(source_dir) if source_dir else []
    if not source_files and args.existing:
        source_files = []

    smart_cfg = config.get("smart_crop", {})
    detector = None
    if smart_cfg.get("enabled", True) and not args.no_smart_crop:
        detector = YoloDetector(
            model_name=str(args.yolo_model or smart_cfg.get("yolo_model", "yolo11n.pt")),
            confidence=float(smart_cfg.get("yolo_confidence", 0.25)),
            class_weights=dict(smart_cfg.get("important_classes") or {}),
        )

    label_cfg = config.get("semantic_labels", {})
    labeler = None
    if args.suggest_labels or label_cfg.get("enabled", False):
        labeler = OpenClipLabeler(
            model_name=str(label_cfg.get("model", "ViT-B-32")),
            pretrained=str(label_cfg.get("pretrained", "laion2b_s34b_b79k")),
            candidates=list(label_cfg.get("candidates") or []),
            top_k=int(label_cfg.get("top_k", 8)),
            device=str(label_cfg.get("device", "auto")),
            prompt_template=str(label_cfg.get("prompt_template", "a photo of {label}")),
        )

    vlm_cfg = config.get("vlm", {})
    vlm_analyzer = None
    if getattr(args, "vlm", False) or vlm_cfg.get("enabled", False):
        vlm_analyzer = VlmAnalyzer(
            model_name=str(getattr(args, "vlm_model", None) or vlm_cfg.get("model")),
            device=str(getattr(args, "vlm_device", None) or vlm_cfg.get("device", "auto")),
            max_pixels=int(getattr(args, "vlm_max_pixels", None) or vlm_cfg.get("max_pixels", 1600000)),
            max_new_tokens=int(
                getattr(args, "vlm_max_new_tokens", None) or vlm_cfg.get("max_new_tokens", 420)
            ),
            prompt=str(vlm_cfg.get("prompt") or DEFAULT_CONFIG["vlm"]["prompt"]),
            include_raw_response=bool(vlm_cfg.get("include_raw_response", True)),
        )

    medium_dir = root / config["medium_dir"]
    thumb_dir = root / config["thumb_dir"]
    medium_long_edge = int(config.get("medium_long_edge", 2560))
    thumb_w = int(config.get("thumb_width", 640))
    thumb_h = int(config.get("thumb_height", 480))
    quality = int(config.get("jpeg_quality", 88))
    crop_margin = float(smart_cfg.get("crop_margin", 0.24))

    updated: list[dict[str, Any]] = []
    processed = 0
    warnings: list[str] = []

    if source_files:
        work_items: list[tuple[Path, dict[str, Any]]] = []
        for source in source_files:
            filename = make_asset_name(source)
            item = item_for_file(by_file.get(filename) or by_file.get(source.name), filename)
            work_items.append((source, item))
    elif args.existing:
        work_items = []
        for item in photos:
            source = source_for_existing_item(root, item)
            if source:
                work_items.append((source, item_for_file(item, str(item.get("file") or source.name))))
            else:
                warnings.append(f"Skipping {item.get('file') or item.get('name')}: no local image source")
    else:
        work_items = []
        warnings.append("No source images found. Pass --source-dir or --existing.")

    limit = getattr(args, "limit", None)
    if limit:
        work_items = work_items[: max(0, int(limit))]

    for source, item in work_items:
        filename = make_asset_name(source)
        medium_path = medium_dir / filename
        thumb_path = thumb_dir / filename

        try:
            exif = extract_exif(source)
            source_size = source.stat().st_size
            source_hash = sha256_file(source) if args.hash else None
            if source.resolve() == medium_path.resolve() or (
                not source_dir and source.resolve().is_relative_to(medium_dir.resolve())
            ):
                _, Image, ImageOps = require_pillow()
                with Image.open(source) as im:
                    im = ImageOps.exif_transpose(im)
                    medium_size = im.size
                medium_source = source
            else:
                medium_size = save_medium(
                    source, medium_path, medium_long_edge, quality=quality, write=write
                )
                medium_source = medium_path if write else source

            crop_box, crop_method, crop_detail = save_thumbnail(
                medium_source,
                thumb_path,
                thumb_w,
                thumb_h,
                detector=detector,
                margin=crop_margin,
                quality=quality,
                write=write,
            )

            item.update(
                {
                    "name": item.get("name") or Path(filename).stem,
                    "file": filename,
                    "full": repo_path(Path(config["medium_dir"]) / filename),
                    "thumb": repo_path(Path(config["thumb_dir"]) / filename),
                    "full_width": medium_size[0],
                    "full_height": medium_size[1],
                    "thumb_width": thumb_w,
                    "thumb_height": thumb_h,
                    "aspect_ratio": round(medium_size[0] / medium_size[1], 6)
                    if medium_size[1]
                    else None,
                    "crop": {
                        "method": crop_method,
                        "box": list(crop_box),
                        "source": "medium",
                    },
                }
            )
            if crop_detail:
                item["crop"]["detail"] = crop_detail
            if source_size:
                item["original_file_size_bytes"] = source_size
            if source_hash:
                item["source_sha256"] = source_hash

            for key, value in exif.items():
                item.setdefault(key, value)

            if labeler:
                suggestions = labeler.suggest(medium_source if medium_source.exists() else source)
                if suggestions:
                    item["suggested_labels"] = suggestions
                elif labeler.error:
                    warnings.append(f"Label suggestions unavailable for {filename}: {labeler.error}")

            if vlm_analyzer:
                vlm = vlm_analyzer.analyze(medium_source if medium_source.exists() else source)
                item["vlm"] = vlm
                if vlm.get("error"):
                    warnings.append(f"VLM analysis unavailable for {filename}: {vlm['error']}")

            updated.append(item)
            processed += 1
        except Exception as exc:
            warnings.append(f"Failed {source}: {exc}")

    if source_files:
        untouched = [p for p in photos if str(p.get("file")) not in {u["file"] for u in updated}]
        photos_out = untouched + updated
    else:
        updated_by_file = {u["file"]: u for u in updated}
        photos_out = [updated_by_file.get(str(p.get("file")), p) for p in photos]

    photos_out.sort(key=lambda p: (str(p.get("captured_at", "")), str(p.get("file", ""))))
    gallery["photos"] = photos_out
    gallery["count"] = len(photos_out)
    gallery["generated_at"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    summary = {
        "write": write,
        "processed": processed,
        "processed_files": [str(item.get("file")) for item in updated if item.get("file")],
        "photos_total": len(photos_out),
        "gallery": rel_from_root(root, gallery_path),
        "warnings": warnings,
    }

    if write:
        write_gallery(gallery_path, gallery)

    if emit_summary:
        print(json.dumps(summary, indent=2))

    return BuildResult(
        exit_code=0 if not warnings else 2,
        summary=summary,
        gallery=gallery,
        gallery_path=gallery_path,
    )


def posix_join(*parts: str | Path) -> str:
    return Path(*[str(part) for part in parts]).as_posix()


def build_preview(args: argparse.Namespace) -> int:
    root = Path.cwd()
    base_config = load_config(Path(args.config) if args.config else None)
    preview_cfg = base_config.get("preview", {}) or {}
    output_dir = Path(args.output_dir or preview_cfg.get("output_dir", "gallery-ai-preview"))
    if not output_dir.is_absolute():
        output_dir = root / output_dir

    try:
        output_rel = output_dir.resolve().relative_to(root.resolve()).as_posix()
    except ValueError as exc:
        raise SystemExit("Preview output directory must be inside this repository.") from exc

    semantic_enabled = not args.no_suggest_labels
    vlm_enabled = bool(getattr(args, "vlm", False))
    override = {
        "gallery_yml": posix_join(output_rel, "gallery.yml"),
        "medium_dir": posix_join(output_rel, "full"),
        "thumb_dir": posix_join(output_rel, "thumbs"),
        "semantic_labels": {
            "enabled": semantic_enabled,
        },
        "vlm": {
            "enabled": vlm_enabled,
        },
    }

    args.existing = bool(args.existing or not args.source_dir)
    args.write = True
    args.suggest_labels = semantic_enabled
    args.gallery = None

    source_gallery_path = root / str(base_config.get("gallery_yml", "_data/gallery.yml"))
    preview_gallery_path = root / override["gallery_yml"]
    if source_gallery_path.exists():
        write_gallery(preview_gallery_path, load_gallery(source_gallery_path))

    result = build_gallery(
        args,
        config_override=override,
        write_override=True,
        emit_summary=False,
    )
    if args.limit and result.summary.get("processed_files"):
        processed_files = set(result.summary["processed_files"])
        result.gallery["photos"] = [
            item for item in result.gallery.get("photos", []) if str(item.get("file")) in processed_files
        ]
        result.gallery["count"] = len(result.gallery["photos"])
        result.summary["photos_total"] = len(result.gallery["photos"])
        write_gallery(result.gallery_path, result.gallery)

    preview_index = render_preview_html(
        output_dir,
        result.gallery,
        str(preview_cfg.get("title", "AI Gallery Preview")),
    )

    summary = dict(result.summary)
    summary["preview_index"] = rel_from_root(root, preview_index)
    summary["preview_url"] = f"http://127.0.0.1:4000/{output_rel}/"
    summary["private"] = "Output folder is ignored by git and not linked from the public site."
    print(json.dumps(summary, indent=2))
    return result.exit_code


def load_album_index(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"root_title": "Gallery", "local_root_path": "Photos", "galleries": []}
    return load_gallery(path)


def update_album_index(path: Path, gallery_meta: dict[str, Any]) -> None:
    data = load_album_index(path)
    galleries = list(data.get("galleries") or [])
    updated = False
    for idx, gallery in enumerate(galleries):
        if str(gallery.get("id")) == str(gallery_meta.get("id")):
            merged = dict(gallery)
            merged.update(gallery_meta)
            galleries[idx] = merged
            updated = True
            break
    if not updated:
        galleries.append(gallery_meta)
    data["root_title"] = data.get("root_title") or "Gallery"
    data["local_root_path"] = data.get("local_root_path") or "Photos"
    data["galleries"] = galleries
    write_gallery(path, data)


def write_album_page(root: Path, album_id: str, title: str) -> Path:
    page_name = f"gallery_{album_id.replace('-', '_')}.markdown"
    page_path = root / page_name
    if page_path.exists():
        return page_path
    content = f"""---
layout: page
title: {title}
permalink: /gallery/{album_id}/
parent: gallery
nav_order: 100
nav_exclude: true
---

{{% include gallery-node.html gallery_id='{album_id}' %}}
"""
    page_path.write_text(content, encoding="utf-8")
    return page_path


def build_album(args: argparse.Namespace) -> int:
    root = Path.cwd()
    source_dir = Path(args.source_dir).expanduser()
    title = str(args.album_title or source_dir.name).strip()
    album_id = slugify(str(args.album_id or title))
    album_path = str(args.album_path or f"Photos/{title}")
    data_file = album_id
    data_rel = posix_join("_data", "gallery_albums", f"{data_file}.yml")
    asset_rel = posix_join("assets", "photos", album_id)

    override = {
        "gallery_yml": data_rel,
        "medium_dir": posix_join(asset_rel, "full"),
        "thumb_dir": posix_join(asset_rel, "thumbs"),
    }

    args.gallery = None
    args.existing = False

    result = build_gallery(
        args,
        config_override=override,
        write_override=bool(args.write),
        emit_summary=False,
    )

    page_path = root / f"gallery_{album_id.replace('-', '_')}.markdown"
    album_index_path = root / "_data" / "galleries.yml"
    if args.write:
        photos = list(result.gallery.get("photos") or [])
        first_photo = photos[0] if photos else {}
        folder_url = str(args.drive_folder_url or drive_folder_url(str(args.drive_folder_id or "")))
        album_meta = {
            "id": album_id,
            "title": title,
            "parent": str(args.parent or "") or None,
            "path": album_path,
            "url": f"/gallery/{album_id}/",
            "data_file": data_file,
            "description": str(args.description or f"{title} photo gallery."),
            "cover": str(first_photo.get("thumb") or ""),
            "status": "published" if photos else "draft",
            "photo_count": len(photos),
        }
        if args.drive_folder_id:
            album_meta["drive_folder_id"] = str(args.drive_folder_id)
        if folder_url:
            album_meta["drive_folder_url"] = folder_url
        update_album_index(album_index_path, album_meta)
        if not args.skip_page:
            page_path = write_album_page(root, album_id, title)

    summary = dict(result.summary)
    summary.update(
        {
            "gallery_id": album_id,
            "gallery_title": title,
            "gallery_path": album_path,
            "gallery_data": data_rel,
            "gallery_assets": asset_rel,
            "gallery_index": rel_from_root(root, album_index_path),
            "gallery_page": rel_from_root(root, page_path),
            "gallery_url": f"http://127.0.0.1:4000/gallery/{album_id}/",
        }
    )
    print(json.dumps(summary, indent=2))
    return result.exit_code


def add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--config", help="Optional gallery pipeline config YAML.")
    parser.add_argument("--gallery", help="Override gallery YAML path from config.")


def add_vlm_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--vlm",
        action="store_true",
        help="Use a local vision-language model to answer visual metadata questions.",
    )
    parser.add_argument("--vlm-model", help="Override the VLM model from config.")
    parser.add_argument(
        "--vlm-device",
        help='Override VLM device. Use "auto", "cpu", or "cuda".',
    )
    parser.add_argument(
        "--vlm-max-new-tokens",
        type=int,
        help="Maximum tokens the VLM can generate per image.",
    )
    parser.add_argument(
        "--vlm-max-pixels",
        type=int,
        help="Maximum image pixels to feed to the VLM per image.",
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build local gallery assets and metadata.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    build = sub.add_parser("build", help="Generate medium images, thumbnails, and gallery metadata.")
    add_common_args(build)
    build.add_argument("--source-dir", help="Folder containing original or export photos.")
    build.add_argument(
        "--existing",
        action="store_true",
        help="Use existing gallery medium images when no source directory is provided.",
    )
    build.add_argument("--write", action="store_true", help="Write images and _data/gallery.yml.")
    build.add_argument("--hash", action="store_true", help="Store source SHA-256 in gallery data.")
    build.add_argument("--limit", type=int, help="Only process the first N images.")
    build.add_argument("--no-smart-crop", action="store_true", help="Disable YOLO smart crops.")
    build.add_argument("--yolo-model", help="Override YOLO model path/name.")
    build.add_argument(
        "--suggest-labels",
        action="store_true",
        help="Use OpenCLIP to add suggested semantic labels when dependencies are installed.",
    )
    add_vlm_args(build)

    preview = sub.add_parser(
        "preview",
        help="Generate a local-only AI crop/label preview gallery ignored by git.",
    )
    add_common_args(preview)
    preview.add_argument("--source-dir", help="Folder containing original or export photos.")
    preview.add_argument(
        "--existing",
        action="store_true",
        help="Use existing gallery medium images. This is the default when --source-dir is omitted.",
    )
    preview.add_argument(
        "--output-dir",
        help="Local preview folder. Defaults to gallery-ai-preview/ and should stay ignored by git.",
    )
    preview.add_argument("--hash", action="store_true", help="Store source SHA-256 in preview data.")
    preview.add_argument("--limit", type=int, help="Only process the first N images.")
    preview.add_argument("--no-smart-crop", action="store_true", help="Disable YOLO smart crops.")
    preview.add_argument("--yolo-model", help="Override YOLO model path/name.")
    preview.add_argument(
        "--no-suggest-labels",
        action="store_true",
        help="Skip OpenCLIP semantic labels for a faster preview.",
    )
    add_vlm_args(preview)

    vlm_preview = sub.add_parser(
        "vlm-preview",
        help="Generate a local-only preview with VLM visual metadata enabled.",
    )
    add_common_args(vlm_preview)
    vlm_preview.add_argument("--source-dir", help="Folder containing original or export photos.")
    vlm_preview.add_argument(
        "--existing",
        action="store_true",
        help="Use existing gallery medium images. This is the default when --source-dir is omitted.",
    )
    vlm_preview.add_argument(
        "--output-dir",
        help="Local preview folder. Defaults to gallery-ai-preview/ and should stay ignored by git.",
    )
    vlm_preview.add_argument("--hash", action="store_true", help="Store source SHA-256 in preview data.")
    vlm_preview.add_argument("--limit", type=int, help="Only process the first N images.")
    vlm_preview.add_argument("--no-smart-crop", action="store_true", help="Disable YOLO smart crops.")
    vlm_preview.add_argument("--yolo-model", help="Override YOLO model path/name.")
    vlm_preview.add_argument(
        "--no-suggest-labels",
        action="store_true",
        help="Skip OpenCLIP semantic labels for a faster preview.",
    )
    add_vlm_args(vlm_preview)

    album = sub.add_parser(
        "gallery",
        aliases=["album"],
        help="Build a hierarchical Gallery node from a local source folder.",
    )
    album.add_argument("--config", help="Optional gallery pipeline config YAML.")
    album.add_argument("--source-dir", required=True, help="Folder such as Photos\\Marski Challenge 2026.")
    album.add_argument("--gallery-title", "--album-title", dest="album_title", help="Public gallery title. Defaults to the source folder name.")
    album.add_argument("--gallery-id", "--album-id", dest="album_id", help="Stable URL/data slug. Defaults to a slug of the title.")
    album.add_argument("--gallery-path", "--album-path", dest="album_path", help='Displayed hierarchy path, e.g. "Photos/Marski Challenge 2026".')
    album.add_argument("--parent", help="Optional parent gallery ID for nested gallery hierarchy.")
    album.add_argument("--description", help="Short gallery description for the Gallery index.")
    album.add_argument("--drive-folder-id", help="Google Drive folder ID for original-size photos.")
    album.add_argument("--drive-folder-url", help="Explicit Google Drive folder URL for the gallery.")
    album.add_argument("--write", action="store_true", help="Write gallery assets, data, index, and page.")
    album.add_argument("--hash", action="store_true", help="Store source SHA-256 in gallery data.")
    album.add_argument("--limit", type=int, help="Only process the first N images.")
    album.add_argument("--no-smart-crop", action="store_true", help="Disable YOLO smart crops.")
    album.add_argument("--yolo-model", help="Override YOLO model path/name.")
    album.add_argument(
        "--suggest-labels",
        action="store_true",
        help="Use OpenCLIP to add suggested semantic labels when dependencies are installed.",
    )
    album.add_argument(
        "--skip-page",
        action="store_true",
        help="Do not create the gallery_<gallery_id>.markdown page on write.",
    )
    add_vlm_args(album)

    args = parser.parse_args(argv)

    if args.cmd == "build":
        return build_gallery(args).exit_code
    if args.cmd == "preview":
        return build_preview(args)
    if args.cmd == "vlm-preview":
        args.vlm = True
        return build_preview(args)
    if args.cmd in {"gallery", "album"}:
        return build_album(args)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
