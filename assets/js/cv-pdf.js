(function () {
  "use strict";

  const tool = document.querySelector("[data-cv-pdf-tool]");
  const dataElement = document.getElementById("cvPdfData");
  const generateButton = document.getElementById("cvPdfGenerate");
  const downloadLink = document.getElementById("cvPdfDownload");
  const openLink = document.getElementById("cvPdfOpen");
  const status = document.getElementById("cvPdfStatus");

  if (!tool || !dataElement || !generateButton || !downloadLink || !openLink || !status) {
    return;
  }

  let cvData;
  let objectUrl = null;

  try {
    cvData = JSON.parse(dataElement.textContent);
  } catch (error) {
    setStatus("The CV data could not be loaded.", "error");
    generateButton.disabled = true;
    return;
  }

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = Object.freeze({ top: 44, right: 46, bottom: 48, left: 46 });
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN.left - MARGIN.right;
  const ENTRY_LOGO_COLUMN = 46;

  function setStatus(message, state) {
    status.textContent = message;
    status.dataset.state = state || "idle";
  }

  function normalizeText(value) {
    return String(value == null ? "" : value)
      .normalize("NFC")
      .replace(/[\u00a0\u202f]/g, " ")
      .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, "\"")
      .replace(/\u2026/g, "...");
  }

  function hexColor(rgb, value) {
    const clean = value.replace("#", "");
    return rgb(
      parseInt(clean.slice(0, 2), 16) / 255,
      parseInt(clean.slice(2, 4), 16) / 255,
      parseInt(clean.slice(4, 6), 16) / 255
    );
  }

  function formatBytes(size) {
    if (size < 1024) return size + " B";
    if (size < 1024 * 1024) return (size / 1024).toFixed(0) + " KB";
    return (size / (1024 * 1024)).toFixed(1) + " MB";
  }

  async function svgToPngBytes(svgText) {
    const sourceUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));

    try {
      const image = new Image();
      image.decoding = "async";
      image.src = sourceUrl;
      await image.decode();

      const sourceWidth = image.naturalWidth || 512;
      const sourceHeight = image.naturalHeight || 512;
      const rasterScale = Math.min(1, 1024 / Math.max(sourceWidth, sourceHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sourceWidth * rasterScale));
      canvas.height = Math.max(1, Math.round(sourceHeight * rasterScale));

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas rendering is unavailable.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const pngBlob = await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("The SVG logo could not be rasterized."));
        }, "image/png");
      });

      return pngBlob.arrayBuffer();
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  async function embedLogos(pdfDoc, logoDefinitions) {
    const embedded = {};

    await Promise.all(Object.entries(logoDefinitions || {}).map(async ([key, definition]) => {
      try {
        const source = typeof definition === "string" ? { src: definition } : definition;
        const response = await fetch(new URL(source.src, window.location.origin));
        if (!response.ok) throw new Error("Logo request failed with status " + response.status + ".");

        const contentType = response.headers.get("content-type") || "";
        const isSvg = contentType.includes("image/svg+xml") || /\.svg(?:$|[?#])/i.test(source.src);
        const isJpeg = contentType.includes("image/jpeg") || /\.jpe?g(?:$|[?#])/i.test(source.src);
        const bytes = isSvg
          ? await svgToPngBytes(await response.text())
          : await response.arrayBuffer();
        const image = isJpeg ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);

        embedded[key] = {
          image,
          maxWidth: Number(source.max_width) || 38,
          maxHeight: Number(source.max_height) || 30
        };
      } catch (error) {
        console.warn("CV logo could not be embedded:", key, error);
      }
    }));

    return embedded;
  }

  class CvPdfBuilder {
    constructor(pdfDoc, fonts, logos, data, PDFLib) {
      this.pdfDoc = pdfDoc;
      this.fonts = fonts;
      this.logos = logos;
      this.data = data;
      this.PDFLib = PDFLib;
      this.pages = [];
      this.page = null;
      this.pageAnnotations = null;
      this.y = 0;
      this.colors = {
        text: hexColor(PDFLib.rgb, "#1b1e24"),
        muted: hexColor(PDFLib.rgb, "#5b6470"),
        accent: hexColor(PDFLib.rgb, "#4e008e"),
        link: hexColor(PDFLib.rgb, "#155da5"),
        rule: hexColor(PDFLib.rgb, "#d5d9df"),
        white: PDFLib.rgb(1, 1, 1)
      };
    }

    addPage() {
      this.page = this.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.pages.push(this.page);
      this.pageAnnotations = this.pdfDoc.context.obj([]);
      this.page.node.set(this.PDFLib.PDFName.of("Annots"), this.pageAnnotations);
      this.y = PAGE_HEIGHT - MARGIN.top;

      if (this.pages.length > 1) {
        this.page.drawText(normalizeText(this.data.profile.name), {
          x: MARGIN.left,
          y: this.y,
          size: 8.4,
          font: this.fonts.bold,
          color: this.colors.muted
        });
        this.page.drawText(normalizeText(this.data.profile.document_title), {
          x: PAGE_WIDTH - MARGIN.right - this.fonts.regular.widthOfTextAtSize(this.data.profile.document_title, 8.4),
          y: this.y,
          size: 8.4,
          font: this.fonts.regular,
          color: this.colors.muted
        });
        this.y -= 11;
        this.page.drawLine({
          start: { x: MARGIN.left, y: this.y },
          end: { x: PAGE_WIDTH - MARGIN.right, y: this.y },
          thickness: 0.65,
          color: this.colors.rule
        });
        this.y -= 18;
      }
    }

    ensureSpace(height) {
      const lowerLimit = MARGIN.bottom + 12;
      if (this.y - height < lowerLimit) {
        this.addPage();
      }
    }

    splitLongToken(token, font, size, maxWidth) {
      const pieces = [];
      let current = "";

      Array.from(token).forEach((character) => {
        const candidate = current + character;
        if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
          pieces.push(current);
          current = character;
        } else {
          current = candidate;
        }
      });

      if (current) pieces.push(current);
      return pieces;
    }

    wrapText(value, font, size, maxWidth) {
      const paragraphs = normalizeText(value).split(/\r?\n/);
      const lines = [];

      paragraphs.forEach((paragraph, paragraphIndex) => {
        const sourceWords = paragraph.trim() ? paragraph.trim().split(/\s+/) : [];
        const words = [];

        sourceWords.forEach((word) => {
          if (font.widthOfTextAtSize(word, size) > maxWidth) {
            words.push(...this.splitLongToken(word, font, size, maxWidth));
          } else {
            words.push(word);
          }
        });

        let line = "";
        words.forEach((word) => {
          const candidate = line ? line + " " + word : word;
          if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
            lines.push(line);
            line = word;
          } else {
            line = candidate;
          }
        });

        if (line) lines.push(line);
        if (!words.length) lines.push("");
        if (paragraphIndex < paragraphs.length - 1) lines.push("");
      });

      return lines;
    }

    measure(value, font, size, width, lineHeight) {
      return this.wrapText(value, font, size, width).length * lineHeight;
    }

    addLink(page, x, y, width, height, url) {
      if (!url || width <= 0 || height <= 0) return;

      const annotation = this.pdfDoc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [x, y, x + width, y + height],
        Border: [0, 0, 0],
        A: {
          Type: "Action",
          S: "URI",
          URI: this.PDFLib.PDFString.of(normalizeText(url))
        }
      });

      this.pageAnnotations.push(this.pdfDoc.context.register(annotation));
    }

    drawWrapped(value, options) {
      const font = options.font || this.fonts.regular;
      const size = options.size || 9;
      const lineHeight = options.lineHeight || size * 1.3;
      const x = options.x == null ? MARGIN.left : options.x;
      const width = options.width == null ? CONTENT_WIDTH : options.width;
      const color = options.color || this.colors.text;
      const lines = this.wrapText(value, font, size, width);

      lines.forEach((line) => {
        this.ensureSpace(lineHeight);
        if (line) {
          this.page.drawText(line, { x, y: this.y, size, font, color });
          if (options.url) {
            this.addLink(
              this.page,
              x,
              this.y - 1.5,
              font.widthOfTextAtSize(line, size),
              lineHeight,
              options.url
            );
          }
        }
        this.y -= lineHeight;
      });

      return lines.length * lineHeight;
    }

    drawBullet(value, options) {
      const x = options.x == null ? MARGIN.left + 5 : options.x;
      const textX = x + 11;
      const width = options.width == null ? CONTENT_WIDTH - (textX - MARGIN.left) : options.width;
      const font = options.font || this.fonts.regular;
      const size = options.size || 8.7;
      const lineHeight = options.lineHeight || 10.9;
      const lines = this.wrapText(value, font, size, width);

      lines.forEach((line, index) => {
        this.ensureSpace(lineHeight);
        if (index === 0) {
          this.page.drawCircle({
            x: x + 2,
            y: this.y + size * 0.38,
            size: 1.45,
            color: options.bulletColor || this.colors.accent
          });
        }
        this.page.drawText(line, {
          x: textX,
          y: this.y,
          size,
          font,
          color: options.color || this.colors.text
        });
        this.y -= lineHeight;
      });

      return lines.length * lineHeight;
    }

    drawLinkedLead(reference, remainder, options) {
      const font = options.font || this.fonts.regular;
      const size = options.size || 9;
      const lineHeight = options.lineHeight || size * 1.3;
      const x = options.x == null ? MARGIN.left : options.x;
      const width = options.width == null ? CONTENT_WIDTH : options.width;
      const label = normalizeText(reference.label);
      const tailWords = normalizeText(remainder).trim().split(/\s+/).filter(Boolean);
      const labelWidth = font.widthOfTextAtSize(label, size);
      const spaceWidth = tailWords.length ? font.widthOfTextAtSize(" ", size) : 0;
      const firstLineWidth = Math.max(0, width - labelWidth - spaceWidth);
      let firstLine = "";

      while (tailWords.length) {
        const candidate = firstLine ? firstLine + " " + tailWords[0] : tailWords[0];
        if (firstLine && font.widthOfTextAtSize(candidate, size) > firstLineWidth) break;
        if (!firstLine && font.widthOfTextAtSize(candidate, size) > firstLineWidth) break;
        firstLine = candidate;
        tailWords.shift();
      }

      this.ensureSpace(lineHeight);
      this.page.drawText(label, {
        x,
        y: this.y,
        size,
        font,
        color: this.colors.link
      });
      this.addLink(this.page, x, this.y - 1.5, labelWidth, lineHeight, reference.url);

      if (firstLine) {
        this.page.drawText(firstLine, {
          x: x + labelWidth + spaceWidth,
          y: this.y,
          size,
          font,
          color: options.color || this.colors.text
        });
      }
      this.y -= lineHeight;

      if (tailWords.length) {
        this.drawWrapped(tailWords.join(" "), {
          x,
          width,
          font,
          size,
          lineHeight,
          color: options.color || this.colors.text
        });
      }
    }

    drawHeader() {
      this.addPage();
      const name = normalizeText(this.data.profile.name);
      const documentTitle = normalizeText(this.data.profile.document_title);
      const updated = normalizeText(this.data.profile.updated);

      this.page.drawText(name, {
        x: MARGIN.left,
        y: this.y,
        size: 23,
        font: this.fonts.bold,
        color: this.colors.text
      });
      this.y -= 18;
      this.page.drawText(documentTitle + " | Updated " + updated, {
        x: MARGIN.left,
        y: this.y,
        size: 9.2,
        font: this.fonts.regular,
        color: this.colors.muted
      });
      this.y -= 22;

      const gutter = 16;
      const columnWidth = (CONTENT_WIDTH - gutter) / 2;
      for (let index = 0; index < this.data.contacts.length; index += 2) {
        const left = this.data.contacts[index];
        const right = this.data.contacts[index + 1];
        const leftHeight = this.drawContact(left, MARGIN.left, this.y, columnWidth);
        const rightHeight = right
          ? this.drawContact(right, MARGIN.left + columnWidth + gutter, this.y, columnWidth)
          : 0;
        this.y -= Math.max(leftHeight, rightHeight, 12);
      }

      this.y -= 5;
      this.page.drawLine({
        start: { x: MARGIN.left, y: this.y },
        end: { x: PAGE_WIDTH - MARGIN.right, y: this.y },
        thickness: 1.2,
        color: this.colors.accent
      });
      this.y -= 20;
    }

    drawContact(contact, x, baseline, width) {
      const label = normalizeText(contact.label) + ": ";
      const value = normalizeText(contact.value);
      const size = 8.4;
      const labelWidth = this.fonts.bold.widthOfTextAtSize(label, size);
      const valueWidth = this.fonts.regular.widthOfTextAtSize(value, size);

      this.page.drawText(label, {
        x,
        y: baseline,
        size,
        font: this.fonts.bold,
        color: this.colors.text
      });

      if (labelWidth + valueWidth <= width) {
        this.page.drawText(value, {
          x: x + labelWidth,
          y: baseline,
          size,
          font: this.fonts.regular,
          color: contact.url ? this.colors.link : this.colors.text
        });
        if (contact.url) {
          this.addLink(this.page, x + labelWidth, baseline - 1.5, valueWidth, 10.5, contact.url);
        }
        return 12;
      }

      const lines = this.wrapText(value, this.fonts.regular, size, width);
      lines.forEach((line, index) => {
        const y = baseline - 10.5 * (index + 1);
        this.page.drawText(line, {
          x,
          y,
          size,
          font: this.fonts.regular,
          color: contact.url ? this.colors.link : this.colors.text
        });
        if (contact.url) {
          this.addLink(this.page, x, y - 1.5, this.fonts.regular.widthOfTextAtSize(line, size), 10.5, contact.url);
        }
      });
      return 12 + lines.length * 10.5;
    }

    drawSectionTitle(title) {
      this.ensureSpace(32);
      this.y -= 5;
      this.page.drawRectangle({
        x: MARGIN.left,
        y: this.y - 1,
        width: 2.8,
        height: 14,
        color: this.colors.accent
      });
      this.page.drawText(normalizeText(title), {
        x: MARGIN.left + 9,
        y: this.y,
        size: 12.2,
        font: this.fonts.bold,
        color: this.colors.text
      });
      this.y -= 21;
    }

    entryMetrics(entry) {
      const logo = entry.logo ? this.logos[entry.logo] : null;
      const textX = MARGIN.left + (logo ? ENTRY_LOGO_COLUMN : 0);
      const textWidth = CONTENT_WIDTH - (logo ? ENTRY_LOGO_COLUMN : 0);
      let height = this.measure(entry.title, this.fonts.bold, 10.1, textWidth, 12.4);
      if (entry.organization) height += this.measure(entry.organization, this.fonts.regular, 8.9, textWidth, 10.8);
      if (entry.period) height += 10.2;
      (entry.details || []).forEach((detail) => {
        height += this.measure(detail, this.fonts.regular, 8.65, textWidth - 16, 10.7);
      });
      (entry.links || []).forEach((link) => {
        height += this.measure(link.label + ": " + link.value, this.fonts.regular, 8.4, textWidth - 11, 10.5);
      });
      return {
        logo,
        textX,
        textWidth,
        contentHeight: Math.max(height, logo ? logo.maxHeight : 0),
        totalHeight: Math.max(height, logo ? logo.maxHeight : 0) + 9
      };
    }

    entryHeight(entry) {
      return this.entryMetrics(entry).totalHeight;
    }

    drawEntry(entry) {
      const metrics = this.entryMetrics(entry);
      this.ensureSpace(metrics.totalHeight);
      const entryTop = this.y;

      if (metrics.logo) {
        const scale = Math.min(
          metrics.logo.maxWidth / metrics.logo.image.width,
          metrics.logo.maxHeight / metrics.logo.image.height
        );
        const width = metrics.logo.image.width * scale;
        const height = metrics.logo.image.height * scale;
        this.page.drawImage(metrics.logo.image, {
          x: MARGIN.left + (ENTRY_LOGO_COLUMN - width) / 2 - 2,
          y: entryTop + 3 - height,
          width,
          height
        });
      }

      this.drawWrapped(entry.title, {
        x: metrics.textX,
        width: metrics.textWidth,
        font: this.fonts.bold,
        size: 10.1,
        lineHeight: 12.4
      });

      if (entry.organization) {
        this.drawWrapped(entry.organization, {
          x: metrics.textX,
          width: metrics.textWidth,
          size: 8.9,
          lineHeight: 10.8,
          color: this.colors.text
        });
      }

      if (entry.period) {
        this.drawWrapped(entry.period, {
          x: metrics.textX,
          width: metrics.textWidth,
          font: this.fonts.oblique,
          size: 8.35,
          lineHeight: 10.2,
          color: this.colors.muted
        });
      }

      (entry.details || []).forEach((detail) => {
        this.drawBullet(detail, {
          x: metrics.textX + 5,
          width: metrics.textWidth - 16,
          size: 8.65,
          lineHeight: 10.7
        });
      });

      (entry.links || []).forEach((link) => {
        this.drawWrapped(link.label + ": " + link.value, {
          x: metrics.textX + 11,
          width: metrics.textWidth - 11,
          size: 8.4,
          lineHeight: 10.5,
          color: this.colors.link,
          url: link.url
        });
      });

      this.y = Math.min(this.y, entryTop - metrics.contentHeight);
      this.y -= 7;
    }

    skillGroupHeight(group) {
      let height = this.measure(group.title, this.fonts.bold, 9.5, CONTENT_WIDTH, 11.7);
      group.items.forEach((item) => {
        height += this.measure(item, this.fonts.regular, 8.35, CONTENT_WIDTH - 18, 10.3);
      });
      return height + 8;
    }

    drawSkillGroup(group) {
      this.ensureSpace(this.skillGroupHeight(group));
      this.drawWrapped(group.title, {
        font: this.fonts.bold,
        size: 9.5,
        lineHeight: 11.7,
        color: this.colors.accent
      });
      group.items.forEach((item) => {
        this.drawBullet(item, {
          size: 8.35,
          lineHeight: 10.3,
          bulletColor: this.colors.muted
        });
      });
      this.y -= 6;
    }

    projectHeight(item) {
      const description = item.reference
        ? item.reference.label + " " + item.description
        : item.description;
      return this.measure(item.title, this.fonts.bold, 9.5, CONTENT_WIDTH - 16, 11.5) +
        this.measure(description, this.fonts.regular, 8.55, CONTENT_WIDTH - 16, 10.6) + 8;
    }

    drawProject(item) {
      this.ensureSpace(this.projectHeight(item));
      const titleX = MARGIN.left + 16;
      const titleColor = item.url ? this.colors.link : this.colors.text;

      this.page.drawCircle({
        x: MARGIN.left + 7,
        y: this.y + 3.5,
        size: 1.6,
        color: this.colors.accent
      });
      this.drawWrapped(item.title, {
        x: titleX,
        width: CONTENT_WIDTH - 16,
        font: this.fonts.bold,
        size: 9.5,
        lineHeight: 11.5,
        color: titleColor,
        url: item.url
      });
      if (item.reference) {
        this.drawLinkedLead(item.reference, item.description, {
          x: titleX,
          width: CONTENT_WIDTH - 16,
          size: 8.55,
          lineHeight: 10.6
        });
      } else {
        this.drawWrapped(item.description, {
          x: titleX,
          width: CONTENT_WIDTH - 16,
          size: 8.55,
          lineHeight: 10.6
        });
      }
      this.y -= 7;
    }

    drawLanguages(items) {
      const gutter = 20;
      const columnWidth = (CONTENT_WIDTH - gutter) / 2;
      const rowHeight = 13;
      this.ensureSpace(Math.ceil(items.length / 2) * rowHeight + 4);

      items.forEach((item, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = MARGIN.left + column * (columnWidth + gutter);
        const y = this.y - row * rowHeight;
        const label = normalizeText(item.language) + ": ";
        const labelWidth = this.fonts.bold.widthOfTextAtSize(label, 8.8);

        this.page.drawText(label, {
          x,
          y,
          size: 8.8,
          font: this.fonts.bold,
          color: this.colors.text
        });
        this.page.drawText(normalizeText(item.level), {
          x: x + labelWidth,
          y,
          size: 8.8,
          font: this.fonts.regular,
          color: this.colors.text
        });
      });

      this.y -= Math.ceil(items.length / 2) * rowHeight + 5;
    }

    drawSection(section) {
      this.drawSectionTitle(section.title);

      if (section.type === "entries") {
        section.entries.forEach((entry) => this.drawEntry(entry));
      } else if (section.type === "skill_groups") {
        section.groups.forEach((group) => this.drawSkillGroup(group));
      } else if (section.type === "projects") {
        section.items.forEach((item) => this.drawProject(item));
      } else if (section.type === "languages") {
        this.drawLanguages(section.items);
      }
    }

    drawFooters() {
      const pageCount = this.pages.length;
      this.pages.forEach((page, index) => {
        const footerY = 25;
        const leftText = normalizeText(this.data.profile.name + " | " + this.data.profile.document_title);
        const rightText = String(index + 1) + " / " + String(pageCount);

        page.drawLine({
          start: { x: MARGIN.left, y: footerY + 11 },
          end: { x: PAGE_WIDTH - MARGIN.right, y: footerY + 11 },
          thickness: 0.5,
          color: this.colors.rule
        });
        page.drawText(leftText, {
          x: MARGIN.left,
          y: footerY,
          size: 7.6,
          font: this.fonts.regular,
          color: this.colors.muted
        });
        page.drawText(rightText, {
          x: PAGE_WIDTH - MARGIN.right - this.fonts.regular.widthOfTextAtSize(rightText, 7.6),
          y: footerY,
          size: 7.6,
          font: this.fonts.regular,
          color: this.colors.muted
        });
      });
    }

    build() {
      this.drawHeader();
      this.data.sections.forEach((section) => this.drawSection(section));
      this.drawFooters();
      return this.pages.length;
    }
  }

  async function createPdf(data) {
    if (!window.PDFLib) {
      throw new Error("The PDF library did not load.");
    }

    const { PDFDocument, StandardFonts } = window.PDFLib;
    const pdfDoc = await PDFDocument.create();
    const fonts = {
      regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
      bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
      oblique: await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
    };
    const logos = await embedLogos(pdfDoc, data.logos);

    pdfDoc.setTitle(normalizeText(data.metadata.title));
    pdfDoc.setAuthor(normalizeText(data.metadata.author));
    pdfDoc.setSubject(normalizeText(data.metadata.subject));
    pdfDoc.setKeywords((data.metadata.keywords || []).map(normalizeText));
    pdfDoc.setCreator("Santeri Hukari CV PDF prototype");
    pdfDoc.setProducer("pdf-lib 1.17.1");
    pdfDoc.setCreationDate(new Date());
    pdfDoc.setModificationDate(new Date());

    const builder = new CvPdfBuilder(pdfDoc, fonts, logos, data, window.PDFLib);
    const pageCount = builder.build();
    const bytes = await pdfDoc.save();
    return { bytes, pageCount };
  }

  function publishPdf(result) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);

    const blob = new Blob([result.bytes], { type: "application/pdf" });
    objectUrl = URL.createObjectURL(blob);

    downloadLink.href = objectUrl;
    downloadLink.download = cvData.filename || "santeri-hukari-cv.pdf";
    downloadLink.hidden = false;

    openLink.href = objectUrl;
    openLink.hidden = false;

    generateButton.textContent = "Regenerate PDF";
    setStatus("PDF ready: " + result.pageCount + " pages, " + formatBytes(blob.size) + ".", "ready");
  }

  async function generate() {
    generateButton.disabled = true;
    tool.setAttribute("aria-busy", "true");
    setStatus("Generating PDF...", "working");

    try {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      publishPdf(await createPdf(cvData));
    } catch (error) {
      console.error(error);
      setStatus("PDF generation failed. Check the browser console for details.", "error");
    } finally {
      generateButton.disabled = false;
      tool.removeAttribute("aria-busy");
    }
  }

  generateButton.addEventListener("click", generate);
  window.addEventListener("beforeunload", () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });

  window.cvPdfPrototype = Object.freeze({ generate });
  generate();
})();
