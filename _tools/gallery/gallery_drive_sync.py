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
    "https://www.googleapis.com/auth/drive.readonly",
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
        token_data = json.loads(token_path.read_text(encoding="utf-8"))
        saved_scopes = set(token_data.get("scopes") or [])
        if set(SCOPES).issubset(saved_scopes):
            creds = Credentials.from_authorized_user_info(token_data, SCOPES)
    if creds and not creds.valid and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
        except Exception:
            creds = None

    if not creds or not creds.valid:
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


def list_drive_folder_files(service, folder_id: str) -> list[dict[str, Any]]:
    query = f"'{quote_drive_query(folder_id)}' in parents and trashed = false"
    files: list[dict[str, Any]] = []
    page_token = None
    while True:
        response = (
            service.files()
            .list(
                q=query,
                fields="nextPageToken,files(id,name,mimeType,size,modifiedTime,parents)",
                orderBy="name",
                pageSize=1000,
                pageToken=page_token,
                supportsAllDrives=True,
            )
            .execute()
        )
        files.extend(response.get("files", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            return files


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
    temp = dest.with_name(f"{dest.name}.part")
    try:
        with temp.open("wb") as f:
            downloader = MediaIoBaseDownload(f, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
        temp.replace(dest)
    except Exception:
        temp.unlink(missing_ok=True)
        raise


def download_folder(args: argparse.Namespace) -> int:
    dest_dir = Path(args.dest_dir).expanduser()
    service = drive_service(Path(args.credentials), Path(args.token))
    remote_files = [
        item
        for item in list_drive_folder_files(service, args.folder_id)
        if Path(str(item.get("name") or "")).suffix.lower() in IMAGE_EXTS
    ]
    if args.limit:
        remote_files = remote_files[: max(0, args.limit)]

    downloaded = 0
    skipped = 0
    planned = 0
    warnings: list[str] = []
    manifest_files: list[dict[str, Any]] = []

    for remote in remote_files:
        name = Path(str(remote.get("name") or "")).name
        file_id = str(remote.get("id") or "")
        if not name or not file_id:
            warnings.append(f"Drive item is missing a name or ID: {remote}")
            continue

        expected_size = int(remote.get("size") or 0)
        dest = dest_dir / name
        if dest.exists() and args.skip_existing and (
            not expected_size or dest.stat().st_size == expected_size
        ):
            skipped += 1
        elif args.dry_run:
            planned += 1
        else:
            try:
                download_file(service, file_id, dest)
                downloaded += 1
            except Exception as exc:
                warnings.append(f"Failed to download {name}: {exc}")

        manifest_files.append(
            {
                "id": file_id,
                "name": name,
                "size": expected_size,
                "mime_type": str(remote.get("mimeType") or ""),
                "modified_time": str(remote.get("modifiedTime") or ""),
            }
        )

    manifest_path = Path(args.manifest).expanduser() if args.manifest else dest_dir / ".drive-source.json"
    if not args.dry_run:
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(
            json.dumps(
                {
                    "folder_id": args.folder_id,
                    "indexed_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
                    "files": manifest_files,
                },
                indent=2,
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

    summary = {
        "folder_id": args.folder_id,
        "destination": str(dest_dir),
        "remote_images": len(remote_files),
        "downloaded": downloaded,
        "skipped": skipped,
        "planned": planned,
        "manifest": str(manifest_path),
        "warnings": warnings,
    }
    print(json.dumps(summary, indent=2))
    return 0 if not warnings else 2


def index_folder(args: argparse.Namespace) -> int:
    gallery_path = Path(args.gallery)
    service = drive_service(Path(args.credentials), Path(args.token))
    remote_files = [
        item
        for item in list_drive_folder_files(service, args.folder_id)
        if Path(str(item.get("name") or "")).suffix.lower() in IMAGE_EXTS
    ]
    by_name = {str(item.get("name") or "").casefold(): item for item in remote_files}

    gallery = load_yaml(gallery_path)
    photos = list(gallery.get("photos") or [])
    matched = 0
    unmatched: list[str] = []
    for photo in photos:
        filename = str(photo.get("original_file") or photo.get("file") or "")
        remote = by_name.get(Path(filename).name.casefold())
        if not remote:
            unmatched.append(filename)
            continue
        photo["drive_id"] = str(remote.get("id") or "")
        if remote.get("size"):
            photo.setdefault("original_file_size_bytes", int(remote["size"]))
        matched += 1

    gallery["photos"] = photos
    gallery["drive_source_folder_id"] = args.folder_id
    gallery["drive_indexed_at"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    if args.write:
        write_yaml(gallery_path, gallery)

    summary = {
        "gallery": str(gallery_path),
        "folder_id": args.folder_id,
        "remote_images": len(remote_files),
        "matched": matched,
        "unmatched": unmatched,
        "write": bool(args.write),
    }
    print(json.dumps(summary, indent=2))
    return 0 if not unmatched else 2


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

    folder_download = sub.add_parser(
        "download-folder",
        help="Download copies of all image files in a Drive folder without changing Drive.",
    )
    folder_download.add_argument("--folder-id", required=True, help="Google Drive source folder ID.")
    folder_download.add_argument("--dest-dir", required=True, help="Local destination folder.")
    folder_download.add_argument("--manifest", help="Optional local JSON manifest path.")
    folder_download.add_argument("--limit", type=int, help="Only process the first N images.")
    folder_download.add_argument("--dry-run", action="store_true", help="List work without downloading.")
    folder_download.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip local files whose size matches the Drive file.",
    )

    folder_index = sub.add_parser(
        "index-folder",
        help="Match gallery photos to existing Drive files without changing Drive.",
    )
    folder_index.add_argument("--folder-id", required=True, help="Google Drive source folder ID.")
    folder_index.add_argument("--write", action="store_true", help="Write Drive IDs to gallery YAML.")

    args = parser.parse_args(argv)
    if args.cmd == "upload":
        return upload_originals(args)
    if args.cmd == "download":
        return download_originals(args)
    if args.cmd == "download-folder":
        return download_folder(args)
    if args.cmd == "index-folder":
        return index_folder(args)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
