#!/usr/bin/env python3
"""Google Drive sync helper for gallery originals.

Uploads original-size local images to Google Drive and writes the resulting
Drive file IDs back into `_data/gallery.yml`. It can also download existing
Drive originals for gallery entries that already have `drive_id`.
"""

from __future__ import annotations

import argparse
import io
import json
import mimetypes
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".cr2", ".cr3", ".dng"}
SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
]


def require_yaml():
    try:
        import yaml  # type: ignore

        return yaml
    except ImportError as exc:
        raise SystemExit(
            "Missing dependency: PyYAML. Install _tools/gallery/requirements.txt first."
        ) from exc


def require_drive_deps():
    try:
        from google.auth.transport.requests import Request  # type: ignore
        from google.oauth2.credentials import Credentials  # type: ignore
        from google_auth_oauthlib.flow import InstalledAppFlow  # type: ignore
        from googleapiclient.discovery import build  # type: ignore
        from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload  # type: ignore

        return Request, Credentials, InstalledAppFlow, build, MediaFileUpload, MediaIoBaseDownload
    except ImportError as exc:
        raise SystemExit(
            "Missing Google Drive dependencies. Install _tools/gallery/requirements.txt first."
        ) from exc


def load_yaml(path: Path) -> dict[str, Any]:
    yaml = require_yaml()
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def write_yaml(path: Path, data: dict[str, Any]) -> None:
    yaml = require_yaml()
    with path.open("w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, sort_keys=False, allow_unicode=True, width=120)


def drive_service(credentials_path: Path, token_path: Path):
    Request, Credentials, InstalledAppFlow, build, _, _ = require_drive_deps()
    creds = None
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
        if not creds.has_scopes(SCOPES):
            creds = None
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not credentials_path.exists():
                raise SystemExit(
                    f"Missing Google OAuth client credentials: {credentials_path}\n"
                    "Create an OAuth desktop client in Google Cloud and save it there."
                )
            flow = InstalledAppFlow.from_client_secrets_file(str(credentials_path), SCOPES)
            creds = flow.run_local_server(port=0)
        token_path.parent.mkdir(parents=True, exist_ok=True)
        token_path.write_text(creds.to_json(), encoding="utf-8")
    return build("drive", "v3", credentials=creds)


def quote_drive_query(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


def find_local_original(source_dir: Path, filename: str) -> Path | None:
    stem = Path(filename).stem.lower()
    exact_matches: list[Path] = []
    stem_matches: list[Path] = []
    for path in source_dir.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTS:
            continue
        if path.name.lower() == filename.lower():
            exact_matches.append(path)
        elif path.stem.lower() == stem:
            stem_matches.append(path)
    matches = exact_matches or stem_matches
    if not matches:
        return None
    return sorted(matches, key=lambda p: (len(str(p)), str(p)))[0]


def search_drive_file(service, folder_id: str, name: str) -> str | None:
    q = (
        f"name = '{quote_drive_query(name)}' and "
        f"'{quote_drive_query(folder_id)}' in parents and trashed = false"
    )
    res = (
        service.files()
        .list(q=q, fields="files(id,name)", pageSize=10, supportsAllDrives=True)
        .execute()
    )
    files = res.get("files", [])
    if not files:
        return None
    return files[0]["id"]


def make_public_reader(service, file_id: str) -> None:
    service.permissions().create(
        fileId=file_id,
        body={"type": "anyone", "role": "reader"},
        fields="id",
        supportsAllDrives=True,
    ).execute()


def upload_file(service, folder_id: str, path: Path, make_public: bool) -> str:
    _, _, _, _, MediaFileUpload, _ = require_drive_deps()
    mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    media = MediaFileUpload(str(path), mimetype=mime_type, resumable=True)
    body = {"name": path.name, "parents": [folder_id]}
    created = (
        service.files()
        .create(body=body, media_body=media, fields="id,name", supportsAllDrives=True)
        .execute()
    )
    file_id = created["id"]
    if make_public:
        make_public_reader(service, file_id)
    return file_id


def download_file(service, file_id: str, dest: Path) -> None:
    _, _, _, _, _, MediaIoBaseDownload = require_drive_deps()
    request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("wb") as f:
        downloader = MediaIoBaseDownload(f, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()


def upload_originals(args: argparse.Namespace) -> int:
    gallery_path = Path(args.gallery)
    source_dir = Path(args.source_dir).expanduser()
    if not source_dir.exists():
        raise SystemExit(f"Source directory does not exist: {source_dir}")

    service = drive_service(Path(args.credentials), Path(args.token))
    gallery = load_yaml(gallery_path)
    photos = list(gallery.get("photos") or [])

    uploaded = 0
    matched = 0
    skipped = 0
    warnings: list[str] = []

    for item in photos:
        filename = str(item.get("original_file") or item.get("file") or "")
        if not filename:
            skipped += 1
            continue
        if item.get("drive_id") and args.skip_existing:
            skipped += 1
            continue

        original = find_local_original(source_dir, filename)
        if not original:
            warnings.append(f"No local original found for {filename}")
            skipped += 1
            continue

        existing_id = search_drive_file(service, args.folder_id, original.name)
        if existing_id:
            item["drive_id"] = existing_id
            matched += 1
            continue

        if args.dry_run:
            warnings.append(f"Dry run: would upload {original}")
            skipped += 1
            continue

        file_id = upload_file(service, args.folder_id, original, args.make_public)
        item["drive_id"] = file_id
        uploaded += 1

    gallery["photos"] = photos
    gallery["count"] = len(photos)
    gallery["drive_synced_at"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    if args.write and not args.dry_run:
        write_yaml(gallery_path, gallery)

    summary = {
        "write": bool(args.write and not args.dry_run),
        "uploaded": uploaded,
        "matched_existing": matched,
        "skipped": skipped,
        "warnings": warnings,
    }
    print(json.dumps(summary, indent=2))
    return 0 if not warnings else 2


def download_originals(args: argparse.Namespace) -> int:
    gallery_path = Path(args.gallery)
    dest_dir = Path(args.dest_dir).expanduser()
    service = drive_service(Path(args.credentials), Path(args.token))
    gallery = load_yaml(gallery_path)

    downloaded = 0
    skipped = 0
    warnings: list[str] = []

    for item in list(gallery.get("photos") or []):
        file_id = item.get("drive_id")
        filename = str(item.get("original_file") or item.get("file") or "")
        if not file_id or not filename:
            skipped += 1
            continue

        dest = dest_dir / filename
        if dest.exists() and args.skip_existing:
            skipped += 1
            continue

        if args.dry_run:
            warnings.append(f"Dry run: would download {filename} from {file_id}")
            skipped += 1
            continue

        try:
            download_file(service, str(file_id), dest)
            downloaded += 1
        except Exception as exc:
            warnings.append(f"Failed to download {filename}: {exc}")

    summary = {"downloaded": downloaded, "skipped": skipped, "warnings": warnings}
    print(json.dumps(summary, indent=2))
    return 0 if not warnings else 2


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sync gallery originals with Google Drive.")
    parser.add_argument("--gallery", default="_data/gallery.yml", help="Gallery YAML path.")
    parser.add_argument(
        "--credentials",
        default=".gallery-local/google_credentials.json",
        help="OAuth desktop client credentials JSON.",
    )
    parser.add_argument(
        "--token",
        default=".gallery-local/google_token.json",
        help="OAuth token cache path.",
    )

    sub = parser.add_subparsers(dest="cmd", required=True)

    upload = sub.add_parser("upload", help="Upload local originals and write Drive file IDs.")
    upload.add_argument("--source-dir", required=True, help="Folder containing original-size photos.")
    upload.add_argument("--folder-id", required=True, help="Google Drive folder ID for originals.")
    upload.add_argument("--write", action="store_true", help="Write updated drive_id values.")
    upload.add_argument("--dry-run", action="store_true", help="Show work without uploading/writing.")
    upload.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip entries that already have drive_id.",
    )
    upload.add_argument(
        "--make-public",
        action="store_true",
        help="Give uploaded originals anyone-with-link read access.",
    )

    download = sub.add_parser("download", help="Download originals using existing drive_id values.")
    download.add_argument("--dest-dir", required=True, help="Local destination folder.")
    download.add_argument("--dry-run", action="store_true", help="Show work without downloading.")
    download.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip files already present in the destination folder.",
    )

    args = parser.parse_args(argv)
    if args.cmd == "upload":
        return upload_originals(args)
    if args.cmd == "download":
        return download_originals(args)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
