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

Download current originals from existing `drive_id` values:

```powershell
python _tools/gallery/gallery_drive_sync.py download --dest-dir ".gallery-local/originals" --skip-existing
```

The download command is optional. The current gallery can still generate
uncropped thumbnails from the medium-size files already in the repository.

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
- EXIF-derived camera/date/settings fields
