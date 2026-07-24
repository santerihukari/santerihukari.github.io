#!/usr/bin/env python3
"""Static checks for the public Marski Challenge gallery output."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MRSKI_PAGE = ROOT / "_site" / "gallery" / "marski-challenge-2026" / "index.html"
LIGHTBOX_JS = ROOT / "assets" / "js" / "lightbox.js"
PHOTO_GALLERY_INCLUDE = ROOT / "_includes" / "photo-gallery.html"


class GalleryParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.html_lang = ""
        self.gallery_sections: list[dict[str, str]] = []
        self.lightbox_links: list[dict[str, object]] = []
        self._current_lightbox: dict[str, object] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {key: value or "" for key, value in attrs}
        if tag == "html":
            self.html_lang = attr.get("lang", "")
        if tag == "section" and "photo-gallery" in attr.get("class", ""):
            self.gallery_sections.append(attr)
        if tag == "a" and attr.get("data-lightbox-group") == "marski-challenge-2026":
            self._current_lightbox = {"attrs": attr, "img_alts": []}
            self.lightbox_links.append(self._current_lightbox)
        if tag == "img" and self._current_lightbox is not None:
            self._current_lightbox["img_alts"].append(attr.get("alt", ""))

    def handle_endtag(self, tag: str) -> None:
        if tag == "a":
            self._current_lightbox = None


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    html = MRSKI_PAGE.read_text(encoding="utf-8")
    parser = GalleryParser()
    parser.feed(html)

    assert_true(parser.html_lang == "fi", "Marski page should render with lang=fi by default.")

    section = next(
        (
            item
            for item in parser.gallery_sections
            if item.get("data-gallery-event-name") == "Marski Challenge 2026"
        ),
        None,
    )
    assert_true(section is not None, "Marski collection metadata section is missing.")
    assert_true(section.get("data-gallery-location") == "Kiipula, Janakkala, Finland", "Location metadata missing.")
    assert_true(section.get("data-gallery-photographer") == "Santeri Hukari", "Photographer metadata missing.")
    assert_true(section.get("data-gallery-organizer") == "Multievent Oy", "Organizer metadata missing.")
    assert_true(section.get("data-gallery-copyright-notice") == "© 2026 Santeri Hukari", "Copyright notice missing.")
    assert_true(section.get("data-gallery-timezone") == "Europe/Helsinki", "Event timezone missing.")

    links = parser.lightbox_links
    assert_true(len(links) == 257, f"Expected 257 Marski lightbox links, found {len(links)}.")

    aria_labels = [str(link["attrs"].get("aria-label", "")) for link in links]  # type: ignore[index]
    assert_true(len(set(aria_labels)) == len(aria_labels), "Thumbnail accessible names must be unique.")
    assert_true(all(label.startswith("Avaa Marski Challenge 2026 -kuva ") for label in aria_labels), "Default labels should be Finnish.")

    alt_fi = [str(link["attrs"].get("data-alt-fi", "")) for link in links]  # type: ignore[index]
    alt_en = [str(link["attrs"].get("data-alt-en", "")) for link in links]  # type: ignore[index]
    assert_true(len(set(alt_fi)) == len(alt_fi), "Finnish fallback alt text must be unique.")
    assert_true(len(set(alt_en)) == len(alt_en), "English fallback alt text must be unique.")
    assert_true(all("tiedosto" in text for text in alt_fi), "Finnish fallback alt text should include the file stem.")
    assert_true(all("file" in text for text in alt_en), "English fallback alt text should include the file stem.")

    img_alts = [alt for link in links for alt in link["img_alts"]]  # type: ignore[index]
    assert_true(img_alts and all(alt == "" for alt in img_alts), "Thumbnail img alt values should be empty.")

    sensitive_names = ("gps", "serial", "source", "sha256", "local", "path")
    for link in links:
      attrs = link["attrs"]  # type: ignore[assignment]
      for key, value in attrs.items():  # type: ignore[union-attr]
          key_l = str(key).lower()
          value_l = str(value).lower()
          assert_true(not any(token in key_l for token in sensitive_names), f"Sensitive attribute exposed: {key}")
          assert_true("c:\\users" not in value_l and "f:\\" not in value_l and "k:\\" not in value_l, "Local path leaked into HTML.")

    js = LIGHTBOX_JS.read_text(encoding="utf-8")
    include = PHOTO_GALLERY_INCLUDE.read_text(encoding="utf-8")
    for required in (
        "Tekniset tiedot",
        "Technical details",
        "Esikatselukuva",
        "Preview",
        "Täysikokoinen ladattava kuva",
        "Full-resolution download",
        "role', 'dialog'",
        "aria-modal",
        "handleKeyDown",
        "trapFocus",
        "photo-lightbox-status",
        "photo-technical-list",
    ):
        assert_true(required in js, f"Missing expected lightbox source marker: {required}")
    assert_true("Shown image" not in js, "Old 'Shown image' wording should be removed.")
    assert_true("Full quality" not in js, "Old 'Full quality' wording should be removed.")
    assert_true("p.altText.fi" in include and "p.altText.en" in include, "Template should support future per-locale altText overrides.")

    print("Gallery accessibility static checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
