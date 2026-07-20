# TODO

## Website audit notes

- Add page-specific meta descriptions instead of reusing the site copyright text everywhere.
- Restore a real page-level `h1` for visible pages; the page layout currently comments out the generated title header.
- Improve mobile navigation accessibility: use a focusable, named button for the menu trigger instead of an unnamed label tied to a hidden checkbox.
- Revisit navigation ARIA. The site currently uses `menubar` / `menuitem` roles without implementing the full desktop-application menubar keyboard pattern.
- Add a skip-to-content link before the sticky header navigation.
- Give footer social links platform-specific accessible names, such as "GitHub: santerihukari" instead of several identical "santerihukari" links.
- Programmatically associate generated Parametric CAD controls with their visible labels.
- Add intrinsic image dimensions and responsive image candidates where practical to reduce layout shift and unnecessary downloads.
- Consider adding `sitemap.xml` once the visible page set stabilizes.

## Photography gallery

- Review the local gallery pipeline in `_tools/gallery/` with a real originals folder and decide the final metadata shape before using it on the whole archive.
- Add a small local review UI for choosing published photos, accepting/editing model-suggested labels, and writing descriptions.
- Add semantic photography search with build-time image indexing and in-browser query ranking.
- Add grouped gallery metadata/folders for tags, semantic keywords, events, locations, subjects, and styles.
- Add folder/category-style filtering for the photography gallery, similar to the Courses page but grouped by taxonomy.
- Design the gallery metadata schema so it supports both exact folder/tag filtering and future semantic-search reranking.
- Consider adding Grounding DINO or a YOLO-family detector for object-level labels if crop detection and CLIP/OpenCLIP label suggestions are not enough.

## Project pages

- Keep quick experiments, such as Face Detection and Hand Gesture Gallery, off the visible Projects/designs navigation.
- Keep Embedded Telemetry Platform cohesive and first-person enough to explain why the project exists, not just what hardware it uses.
