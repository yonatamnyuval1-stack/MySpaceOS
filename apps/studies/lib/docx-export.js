(function (root) {
  /** Minimal ZIP (STORE) + OOXML builder for Studies formal documents. */

  function crcTable() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  }

  const CRC_TABLE = crcTable();

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function u16(n) {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return b;
  }

  function u32(n) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, true);
    return b;
  }

  function concat(parts) {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  }

  function encodeUtf8(str) {
    return new TextEncoder().encode(str);
  }

  function zipStore(files) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const file of files) {
      const nameBytes = encodeUtf8(file.name);
      const data = file.data instanceof Uint8Array ? file.data : encodeUtf8(String(file.data || ""));
      const crc = crc32(data);
      const local = concat([
        u32(0x04034b50),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(nameBytes.length),
        u16(0),
        nameBytes,
        data,
      ]);
      const central = concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(nameBytes.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBytes,
      ]);
      localParts.push(local);
      centralParts.push(central);
      offset += local.length;
    }

    const centralDir = concat(centralParts);
    const end = concat([
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(files.length),
      u16(files.length),
      u32(centralDir.length),
      u32(offset),
      u16(0),
    ]);
    return concat([...localParts, centralDir, end]);
  }

  function escXml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function textRuns(node, inherited) {
    const runs = [];
    const walk = (n, style) => {
      if (!n) return;
      if (n.nodeType === Node.TEXT_NODE) {
        const t = n.nodeValue;
        if (t) runs.push({ text: t, ...style });
        return;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const tag = n.tagName.toLowerCase();
      const next = { ...style };
      if (tag === "b" || tag === "strong") next.bold = true;
      if (tag === "i" || tag === "em") next.italic = true;
      if (tag === "u") next.underline = true;
      if (tag === "br") {
        runs.push({ text: "\n", ...style, break: true });
        return;
      }
      if (tag === "a") {
        Array.from(n.childNodes).forEach((c) => walk(c, next));
        return;
      }
      Array.from(n.childNodes).forEach((c) => walk(c, next));
    };
    walk(node, inherited || {});
    return runs;
  }

  function runsToXml(runs) {
    if (!runs.length) return `<w:r><w:t xml:space="preserve"></w:t></w:r>`;
    return runs
      .map((r) => {
        if (r.break) return `<w:r><w:br/></w:r>`;
        const parts = String(r.text || "").split("\n");
        return parts
          .map((part, i) => {
            const rPr = [];
            if (r.bold) rPr.push("<w:b/>");
            if (r.italic) rPr.push("<w:i/>");
            if (r.underline) rPr.push('<w:u w:val="single"/>');
            const pr = rPr.length ? `<w:rPr>${rPr.join("")}</w:rPr>` : "";
            const t = `<w:r>${pr}<w:t xml:space="preserve">${escXml(part)}</w:t></w:r>`;
            return i < parts.length - 1 ? `${t}<w:r><w:br/></w:r>` : t;
          })
          .join("");
      })
      .join("");
  }

  function paraXml(runs, opts) {
    const pPr = [];
    if (opts?.style) pPr.push(`<w:pStyle w:val="${opts.style}"/>`);
    if (opts?.align) pPr.push(`<w:jc w:val="${opts.align}"/>`);
    if (opts?.numId != null) {
      pPr.push(
        `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${opts.numId}"/></w:numPr>`
      );
    }
    const pr = pPr.length ? `<w:pPr>${pPr.join("")}</w:pPr>` : "";
    return `<w:p>${pr}${runsToXml(runs)}</w:p>`;
  }

  function blockToParas(el) {
    const tag = el.tagName.toLowerCase();
    const align =
      (el.style && el.style.textAlign) ||
      el.getAttribute("align") ||
      "";
    const alignMap = { left: "left", right: "right", center: "center", justify: "both" };
    const jc = alignMap[String(align).toLowerCase()] || null;

    if (tag === "h1") return [paraXml(textRuns(el), { style: "Heading1", align: jc || "center" })];
    if (tag === "h2") return [paraXml(textRuns(el), { style: "Heading2", align: jc })];
    if (tag === "h3") return [paraXml(textRuns(el), { style: "Heading3", align: jc })];
    if (tag === "blockquote") return [paraXml(textRuns(el), { style: "Quote", align: jc })];
    if (tag === "hr") return [`<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr></w:pPr></w:p>`];
    if (tag === "ul" || tag === "ol") {
      const numId = tag === "ol" ? 2 : 1;
      return Array.from(el.children)
        .filter((c) => c.tagName && c.tagName.toLowerCase() === "li")
        .map((li) => paraXml(textRuns(li), { numId, align: jc }));
    }
    if (tag === "li") return [paraXml(textRuns(el), { numId: 1, align: jc })];
    if (tag === "div" || tag === "section" || tag === "article") {
      const out = [];
      Array.from(el.childNodes).forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) out.push(...blockToParas(child));
        else if (child.nodeType === Node.TEXT_NODE && child.nodeValue.trim()) {
          out.push(paraXml([{ text: child.nodeValue }]));
        }
      });
      return out.length ? out : [paraXml(textRuns(el), { align: jc })];
    }
    // p and fallback
    return [paraXml(textRuns(el), { align: jc })];
  }

  function htmlToDocumentXml(html, title) {
    const wrap = document.createElement("div");
    wrap.innerHTML = typeof html === "string" ? html : "";
    // Prefer page sections if present
    const pages = wrap.querySelectorAll(":scope > section.doc-page");
    const roots = pages.length ? Array.from(pages) : [wrap];
    const paras = [];
    roots.forEach((rootEl, i) => {
      if (i > 0) paras.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
      const kids = Array.from(rootEl.childNodes);
      if (!kids.length) {
        paras.push(paraXml([]));
        return;
      }
      kids.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) paras.push(...blockToParas(child));
        else if (child.nodeType === Node.TEXT_NODE && child.nodeValue.trim()) {
          paras.push(paraXml([{ text: child.nodeValue }]));
        }
      });
    });
    if (!paras.length) paras.push(paraXml([]));

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paras.join("\n")}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/>
    </w:sectPr>
  </w:body>
</w:document>`;
  }

  function stylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="200" w:after="100"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Quote">
    <w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:ind w:left="720"/><w:spacing w:before="120" w:after="120"/></w:pPr>
    <w:rPr><w:i/></w:rPr>
  </w:style>
</w:styles>`;
  }

  function numberingXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;
  }

  function buildDocxBytes(title, html) {
    const safeTitle = String(title || "Document").slice(0, 200);
    const now = new Date().toISOString();
    const files = [
      {
        name: "[Content_Types].xml",
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
      },
      {
        name: "_rels/.rels",
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
      },
      {
        name: "word/_rels/document.xml.rels",
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`,
      },
      { name: "word/document.xml", data: htmlToDocumentXml(html, safeTitle) },
      { name: "word/styles.xml", data: stylesXml() },
      { name: "word/numbering.xml", data: numberingXml() },
      {
        name: "docProps/core.xml",
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:dcmitype="http://purl.org/dc/dcmitype/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escXml(safeTitle)}</dc:title>
  <dc:creator>My Space Studies</dc:creator>
  <cp:lastModifiedBy>My Space Studies</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`,
      },
      {
        name: "docProps/app.xml",
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
  xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>My Space Studies</Application>
</Properties>`,
      },
    ];
    return zipStore(files.map((f) => ({ name: f.name, data: encodeUtf8(f.data) })));
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  root.StudiesDocx = {
    buildDocxBytes,
    bytesToBase64,
  };
})(window);
