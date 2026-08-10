# Gallery Pipeline

Local tooling for preparing the photography gallery. These scripts are excluded
from the generated Jekyll site.

## What It Does

1. Reads original-size photos from a local folder, or falls back to the current
   medium-size files already in `assets/photos/full`.
2. Extracts EXIF metadata.
3. Generates medium-size images for the site.
4. Generates uncropped thumbnail-size images for the grid.
5. Optionally uses OpenCLIP to suggest semantic labels.
6. Optionally uses a local vision-language model to answer visual metadata
   questions from the pixels only.
7. Uploads original-size files to Google Drive and writes `drive_id` values back
   into `_data/gallery.yml`.

Semantic labels and VLM output can also be rendered to a separate local preview
gallery before changing the public gallery. The default preview folder is
`gallery-ai-preview/`, which is ignored by git and not linked from the site.

## Install

Use a local Python environment:

```powershell
python -m pip install -r _tools/gallery/requirements.txt
```

The neural parts are optional:

- Install `open_clip_torch` and `torch` to enable semantic label suggestions.
- Install `transformers`, `accelerate`, and `qwen-vl-utils` to enable local
  Qwen visual analysis.
- Install the Google packages to upload/download originals with Drive.

The first OpenCLIP/VLM run may download model weights. Qwen-VL is much larger
than the label model, so start with `--limit 1`. The default VLM is
`Qwen/Qwen2-VL-2B-Instruct`; you can try `Qwen/Qwen2.5-VL-3B-Instruct` with
`--vlm-model` on a machine that has enough memory. For a quick structural test
without neural models, use `--no-suggest-labels`.

## Config

Copy the example if you want custom settings:

```powershell
Copy-Item _tools/gallery/config.example.yml .gallery-local/gallery_config.yml
```

`.gallery-local/` is ignored by git and is the right place for credentials,
tokens, and machine-specific settings.

## Generate Assets From Originals

Dry run:

```powershell
python _tools/gallery/gallery_pipeline.py build --source-dir "F:\path\to\originals"
```

Write outputs:

```powershell
python _tools/gallery/gallery_pipeline.py build --source-dir "F:\path\to\originals" --write
```

With semantic label suggestions:

```powershell
python _tools/gallery/gallery_pipeline.py build --source-dir "F:\path\to\originals" --suggest-labels --write
```

Limit the first run:

```powershell
python _tools/gallery/gallery_pipeline.py build --source-dir "F:\path\to\originals" --suggest-labels --limit 10 --write
```

## Hierarchical Gallery

Local source folders can mirror the public Gallery hierarchy. The source folder
root is named `Photos/` locally, but the public website section is called
`Gallery`. Local original/export folders are intentionally ignored by git and
excluded from Jekyll builds:

```text
Photos/
  Marski Challenge 2026/
    IMG_0001.jpg
    IMG_0002.jpg
```

Build a public gallery from that folder:

```powershell
python _tools/gallery/gallery_pipeline.py gallery --source-dir "Photos\Marski Challenge 2026" --gallery-title "Marski Challenge 2026" --write
```

This writes:

- `_data/gallery_albums/marski-challenge-2026.yml`
- `assets/photos/marski-challenge-2026/full/`
- `assets/photos/marski-challenge-2026/thumbs/`
- `gallery_marski_challenge_2026.markdown`
- a gallery entry in `_data/galleries.yml`

Add OpenCLIP/VLM passes later only if you want AI-assisted labels or visual
metadata suggestions.

Gallery nodes can have photos and child galleries at the same time. To create a
child gallery, pass the parent gallery ID:

```powershell
python _tools/gallery/gallery_pipeline.py gallery --source-dir "Photos\Marski Challenge 2026\Awards" --gallery-title "Awards" --parent marski-challenge-2026 --write
```

After the gallery data exists, upload originals to Google Drive and write per-photo
`drive_id` values:

```powershell
python _tools/gallery/gallery_drive_sync.py --gallery "_data/gallery_albums/marski-challenge-2026.yml" upload --source-dir "Photos\Marski Challenge 2026" --folder-id "GOOGLE_DRIVE_FOLDER_ID" --make-public --skip-existing --write
```

The gallery page uses those `drive_id` values for the lightbox Download original
button. You can also pass `--drive-folder-id` to the gallery build command to
show an Open Drive folder link on the gallery page.

## Private AI Preview Gallery

Generate a separate local preview from the current medium-size gallery images:

```powershell
python _tools/gallery/gallery_pipeline.py preview --existing
```

Generate a preview from original/export photos:

```powershell
python _tools/gallery/gallery_pipeline.py preview --source-dir "F:\path\to\originals"
```

Generate the same private preview with local VLM visual Q&A:

```powershell
python _tools/gallery/gallery_pipeline.py vlm-preview --existing --limit 1 --vlm-max-pixels 360000
```

The VLM prompt asks the model:

- What labels describe this photo?
- Where was this photo taken, if that is clear from visible evidence?
- What type of event or setting is this photo from?

The model is instructed not to use the filename, EXIF data, manual captions, or
previous labels. It should return `unknown` for location when there is no clear
visual evidence.

The command writes:

- `gallery-ai-preview/index.html`
- `gallery-ai-preview/gallery.yml`
- `gallery-ai-preview/full/`
- `gallery-ai-preview/thumbs/`

Open the preview through the local Jekyll server:

```text
http://127.0.0.1:4000/gallery-ai-preview/
```

The preview page shows top OpenCLIP semantic labels and VLM visual read next to
each thumbnail. The same information appears in the lightbox metadata sidebar.
This keeps the AI output reviewable without touching `_data/gallery.yml` or the
public `assets/photos/` images.

For a smoke test that only checks the preview page structure:

```powershell
python _tools/gallery/gallery_pipeline.py preview --existing --limit 3 --no-suggest-labels
```

## Regenerate Thumbnails From Current Medium Images

This is useful for the current gallery, where original-size files may not be
available locally yet:

```powershell
python _tools/gallery/gallery_pipeline.py build --existing --write
```

This writes uncropped resized thumbnails and keeps the full photo composition in
the grid.

## Google Drive Originals

Create an OAuth desktop client in Google Cloud and save it as:

```text
.gallery-local/google_credentials.json
```

Upload originals and write `drive_id` values:

```powershell
python _tools/gallery/gallery_drive_sync.py upload --source-dir "F:\path\to\originals" --folder-id "GOOGLE_DRIVE_FOLDER_ID" --make-public --write
```

To import an existing Drive folder without changing anything in Drive, first
download local copies and save a source manifest:

```powershell
python _tools/gallery/gallery_drive_sync.py download-folder --folder-id "GOOGLE_DRIVE_FOLDER_ID" --dest-dir "Photos\Event name" --skip-existing --manifest "Photos\Event name\.drive-source.json"
```

Generate the public thumbnail and medium-size files with full-resolution access
disabled:

```powershell
python _tools/gallery/gallery_pipeline.py gallery --source-dir "Photos\Event name" --gallery-title "Event name" --gallery-id "event-name" --drive-folder-id "GOOGLE_DRIVE_FOLDER_ID" --disable-full-resolution --write
```

Match the generated entries to the existing Drive files by filename. This only
updates the local gallery YAML:

```powershell
python _tools/gallery/gallery_drive_sync.py --gallery "_data/gallery_albums/event-name.yml" index-folder --folder-id "GOOGLE_DRIVE_FOLDER_ID" --write
```

When original downloads should become visible later, set
`full_resolution_enabled: true` for that gallery in `_data/galleries.yml`.
The stored folder URL and per-photo `drive_id` values will then activate the
folder and individual full-resolution actions without moving or re-uploading
the originals.

Download current originals from existing `drive_id` values:

```powershell
python _tools/gallery/gallery_drive_sync.py download --dest-dir ".gallery-local/originals" --skip-existing
```

The download command is optional. The current gallery can still generate
uncropped thumbnails from the medium-size files already in the repository.

## Race Bib Recognition

Event galleries can store zero or more race bib numbers per photo and expose an
exact-number search in the public grid. The local recognition tool uses the GPU
for a bib-specific YOLOv7 detector, a YOLO11 person/torso fallback, EasyOCR, and
Qwen2.5-VL review. The VLM receives bounded, sequential contact sheets of
detector-selected bib, runner, and optional bicycle regions plus untrusted OCR
suggestions. Public labels use only its pixel-verified readings. Single-digit
bibs are enabled by default, with a stricter EasyOCR confidence threshold than
multi-digit numbers. If the detector/OCR stages find no plausible candidate,
VLM generation is skipped unless `--allow-unseeded-vlm` is explicitly enabled.

Install a CUDA PyTorch build before the optional packages in
`_tools/gallery/requirements.txt`. Model weights and review output belong under
`.gallery-local/`, which is ignored by git.

Validate a few known photos without changing gallery metadata:

```powershell
.\.gallery-local\bib-env\Scripts\python.exe _tools\gallery\gallery_bib_recognition.py --source-dir "Photos\Tampere Maraton 2025" --gallery "_data\gallery_albums\tampere-maraton-2025.yml" --file 332A6200.jpg --file 332A6832.jpg
```

Process the full gallery and write labels:

```powershell
.\.gallery-local\bib-env\Scripts\python.exe _tools\gallery\gallery_bib_recognition.py --source-dir "Photos\Tampere Maraton 2025" --gallery "_data\gallery_albums\tampere-maraton-2025.yml" --review-dir ".gallery-local\bib-recognition-tampere-2025" --write
```

For an event such as Marski Challenge, where numbers also appear on bicycle
handlebar plates and the local source is the medium-size gallery export, run:

```powershell
.\.gallery-local\bib-env\Scripts\python.exe _tools\gallery\gallery_bib_recognition.py --source-dir "assets\photos\marski-challenge-2026\full" --gallery "_data\gallery_albums\marski-challenge-2026.yml" --bicycle-fallback --maximum-bib-number 200 --allow-unseeded-vlm --unseeded-min-occurrences 2 --review-dir ".gallery-local\bib-recognition-marski-2026" --write
```

Unseeded labels must recur in at least two photos in that command. Review the
private `results.json` and annotated previews before publishing: the models can
still miss obscured numbers or return a partial number from a distant plate.

The tool writes `bib_numbers_detected` and `bib_numbers` to each photo. To
correct a result without losing it on a later run, add `bib_numbers_manual`; a
manual list takes precedence. Set `bib_search_enabled: true` on the gallery in
`_data/galleries.yml` to show the bilingual search control.

### Rights Metadata Follow-Up

The current upload flow does not rewrite downloaded or uploaded original-size
files to embed IPTC/XMP rights fields. For event galleries such as Marski
Challenge 2026, add a separate local export step before Drive upload if you want
the downloadable files themselves to contain event name, creator, copyright
notice, location, and a rights/usage URL.

## Data Fields

The pipeline keeps the existing site fields:

- `full`: medium-size site image path
- `thumb`: thumbnail path
- `drive_id`: Google Drive ID for original-size download

It can also add:

- `suggested_labels`
- `vlm.labels`
- `vlm.location`
- `vlm.event_or_setting`
- `vlm.short_caption`
- `vlm.uncertainty_notes`
- `bib_numbers_detected`
- `bib_numbers`
- `bib_numbers_manual`
- EXIF-derived camera/date/settings fields
