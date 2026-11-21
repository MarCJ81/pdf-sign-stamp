/* ==========================================================================
   PDF Sign & Stamp Studio — engine
   Pure logic: geometry, formatting, text layout, seal layout, contract
   templates. No DOM, no pdf-lib. Runs in the browser (window.PSS) and in
   Node for the unit tests (module.exports).
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PSS = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------------------------------------------------------------- basics */

  const PT_PER_MM = 72 / 25.4;

  const PAGE_SIZES = {
    A4: { w: 595.28, h: 841.89 },
    LETTER: { w: 612, h: 792 },
    LEGAL: { w: 612, h: 1008 },
  };

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const round = (v, places) => {
    const f = Math.pow(10, places || 0);
    return Math.round(v * f) / f;
  };
  const sum = (arr) => arr.reduce((a, b) => a + b, 0);

  function makeId(prefix) {
    return (prefix || 'el') + '_' + Math.random().toString(36).slice(2, 9);
  }

  /** Scale a box so it fits inside maxW × maxH, keeping the aspect ratio. */
  function fitWithin(w, h, maxW, maxH) {
    if (!(w > 0) || !(h > 0)) return { w: 0, h: 0, scale: 0 };
    const s = Math.min(maxW / w, maxH / h);
    return { w: round(w * s, 2), h: round(h * s, 2), scale: s };
  }

  /** Keep a rectangle fully inside a page. */
  function clampRect(rect, page) {
    const w = Math.min(rect.w, page.w);
    const h = Math.min(rect.h, page.h);
    return {
      x: round(clamp(rect.x, 0, Math.max(0, page.w - w)), 2),
      y: round(clamp(rect.y, 0, Math.max(0, page.h - h)), 2),
      w: round(w, 2),
      h: round(h, 2),
    };
  }

  /* -------------------------------------------------------------- geometry */

  function rotatePoint(point, center, deg) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
  }

  /**
   * A PDF page can carry /Rotate (0, 90, 180, 270). Pages are shown the way
   * pdf.js shows them ("display" space: y down, origin top-left) and every
   * overlay is stored in that space. These helpers convert between display
   * space and the page's own coordinate system (y up, origin bottom-left),
   * which is what pdf-lib draws in.
   *
   *   /Rotate  0 : dx =  px        dy = H - py
   *   /Rotate 90 : dx =  py        dy = px
   *   /Rotate 180: dx = W - px     dy = H - py
   *   /Rotate 270: dx = H - py     dy = px
   */
  function pagePointFromDisplay(page, dx, dy) {
    const rot = (((page.rotate || 0) % 360) + 360) % 360;
    const W = page.w, H = page.h;
    if (rot === 90) return { x: dy, y: dx };
    if (rot === 180) return { x: W - dx, y: H - dy };
    if (rot === 270) return { x: dy, y: H - dx };
    return { x: dx, y: H - dy };
  }

  function displayPointFromPage(page, px, py) {
    const rot = (((page.rotate || 0) % 360) + 360) % 360;
    const W = page.w, H = page.h;
    if (rot === 90) return { x: py, y: px };
    if (rot === 180) return { x: W - px, y: H - py };
    if (rot === 270) return { x: H - py, y: px };
    return { x: px, y: H - py };
  }

  /** Display-space size of a page (after /Rotate). */
  function displaySize(page) {
    const rot = (((page.rotate || 0) % 360) + 360) % 360;
    return rot === 90 || rot === 270 ? { w: page.h, h: page.w } : { w: page.w, h: page.h };
  }

  /** Axis-aligned page-space rectangle for a display-space rectangle. */
  function pageRectFromDisplay(page, rect) {
    const pts = [
      pagePointFromDisplay(page, rect.x, rect.y),
      pagePointFromDisplay(page, rect.x + rect.w, rect.y),
      pagePointFromDisplay(page, rect.x, rect.y + rect.h),
      pagePointFromDisplay(page, rect.x + rect.w, rect.y + rect.h),
    ];
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    return {
      x: round(Math.min.apply(null, xs), 3),
      y: round(Math.min.apply(null, ys), 3),
      w: round(Math.max.apply(null, xs) - Math.min.apply(null, xs), 3),
      h: round(Math.max.apply(null, ys) - Math.min.apply(null, ys), 3),
    };
  }

  /**
   * Convert a CSS rotation (clockwise degrees, seen on screen) into the rotation
   * pdf-lib needs for a page with /Rotate = pageRot.
   * Both spaces are related by a linear map M (display = M · page); rotating in
   * display space conjugates to M⁻¹ R M in page space.
   */
  function elementPdfRotation(pageRot, cssDeg) {
    const rot = (((pageRot || 0) % 360) + 360) % 360;
    const rad = (cssDeg * Math.PI) / 180;
    const c = Math.cos(rad), s = Math.sin(rad);
    let M;
    if (rot === 90) M = [[0, 1], [1, 0]];
    else if (rot === 180) M = [[-1, 0], [0, -1]];
    else if (rot === 270) M = [[0, -1], [1, 0]];
    else M = [[1, 0], [0, -1]];
    const Mt = [[M[0][0], M[1][0]], [M[0][1], M[1][1]]];
    const R = [[c, -s], [s, c]];
    const mul = (A, B) => [
      [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
      [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]],
    ];
    const N = mul(mul(Mt, R), M);
    return round((Math.atan2(N[1][0], N[0][0]) * 180) / Math.PI, 3);
  }

  /** Total rotation pdf-lib needs for an element on a /Rotate page. */
  function elementTotalRotation(pageRot, cssDeg) {
    const rot = (((pageRot || 0) % 360) + 360) % 360;
    let deg = rot + elementPdfRotation(pageRot, cssDeg);
    deg = ((deg % 360) + 360) % 360;
    if (deg > 180) deg -= 360;
    return round(deg, 3);
  }

  /**
   * Where an element's own origin (image bottom-left, text baseline start) has
   * to sit in page space: rotate that point around the element centre the same
   * way CSS does on screen, then move it into page coordinates.
   */
  function displayAnchorToPage(page, point, center, cssDeg) {
    const rotated = cssDeg ? rotatePoint(point, center, cssDeg) : point;
    return pagePointFromDisplay(page, rotated.x, rotated.y);
  }

  /**
   * pdf-lib rotates a drawing around its own origin. To make an element spin
   * around its own centre, move the origin to where it belongs.
   * `anchor` and `center` are in the page's coordinate system.
   */
  function rotatedOrigin(anchor, center, deg) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const dx = anchor.x - center.x;
    const dy = anchor.y - center.y;
    return {
      x: round(center.x + dx * cos - dy * sin, 3),
      y: round(center.y + dx * sin + dy * cos, 3),
    };
  }

  /* ----------------------------------------------------------- formatting */

  const KOR_DIGITS = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const KOR_UNITS = ['', '십', '백', '천'];
  const KOR_BIG = ['', '만', '억', '조'];

  function groupToKorean(n) {
    if (n === 0) return '';
    let out = '';
    const s = String(n).padStart(4, '0');
    for (let i = 0; i < 4; i++) {
      const d = Number(s[i]);
      if (!d) continue;
      out += KOR_DIGITS[d] + KOR_UNITS[3 - i];
    }
    return out;
  }

  /** 12000000 → "일천이백만" */
  function numberToKorean(n) {
    n = Math.floor(Math.abs(Number(n) || 0));
    if (n === 0) return '영';
    if (n >= 1e16) return String(n);
    const parts = [];
    let rest = n;
    for (let i = 0; i < 4; i++) {
      const group = rest % 10000;
      rest = Math.floor(rest / 10000);
      if (group) parts.unshift(groupToKorean(group) + KOR_BIG[i]);
    }
    return parts.join(' ');
  }

  /** 12000000 → "일금 일천이백만 원정" */
  function amountInKorean(n) {
    const value = Math.floor(Math.abs(Number(n) || 0));
    if (value === 0) return '일금 영 원정';
    return '일금 ' + numberToKorean(value) + ' 원정';
  }

  function formatWon(n) {
    const v = Math.round(num(n));
    return v.toLocaleString('ko-KR');
  }

  /** "12,500,000원" → 12500000 (tolerates spaces, commas and a won sign). */
  function num(value) {
    if (typeof value === 'number') return isFinite(value) ? value : 0;
    const digits = String(value == null ? '' : value).replace(/[^\d.-]/g, '');
    const n = Number(digits);
    return isFinite(n) ? n : 0;
  }

  function formatMoney(n) {
    return '₩' + formatWon(n);
  }

  const pad2 = (v) => String(v).padStart(2, '0');

  function toDate(value) {
    if (value instanceof Date) return value;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parts = value.split('-').map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    if (typeof value === 'string') {
      const m = value.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
    const d = value ? new Date(value) : new Date();
    return isNaN(d.getTime()) ? new Date() : d;
  }

  /** date → "2026년 11월 21일" */
  function formatKoreanDate(value) {
    const d = toDate(value);
    return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }

  /** date → "2026-11-21" */
  function formatISODate(value) {
    const d = toDate(value);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /** "2026-12-01" → "2026. 12. 01." */
  function formatDotDate(value) {
    if (!value) return '';
    const d = toDate(value);
    return d.getFullYear() + '. ' + pad2(d.getMonth() + 1) + '. ' + pad2(d.getDate()) + '.';
  }

  /** ("2026-12-01", "2027-01-31") → "2026년 12월 1일 ~ 2027년 1월 31일" */
  function formatPeriod(start, end) {
    if (!start && !end) return '';
    if (!end) return formatKoreanDate(start) + '부터';
    return formatKoreanDate(start) + ' ~ ' + formatKoreanDate(end);
  }

  function sanitizeFilename(name) {
    let s = String(name || '').trim();
    s = s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ');
    s = s.replace(/\.pdf$/i, '');
    s = s.replace(/\s+/g, ' ').trim();
    if (!s) s = '서명문서';
    if (s.length > 80) s = s.slice(0, 80).trim();
    return s;
  }

  /* ------------------------------------------------------- text / charset */

  const SUPPORTED = [
    [0x0020, 0x007e], [0x00a0, 0x00ff], [0x2000, 0x206f], [0x20a0, 0x20bf],
    [0x2100, 0x214f], [0x2190, 0x21ff], [0x2460, 0x24ff], [0x25a0, 0x25ff],
    [0x3000, 0x303f], [0x3130, 0x318f], [0xac00, 0xd7a3], [0xff00, 0xffef],
  ];

  function isSupportedChar(ch) {
    const cp = ch.codePointAt(0);
    if (cp === 0x2713 || cp === 0x2714) return true;
    return SUPPORTED.some((r) => cp >= r[0] && cp <= r[1]);
  }

  /** Characters the bundled Korean font cannot draw (Hanja, emoji, …). */
  function unsupportedChars(text) {
    const out = [];
    for (const ch of String(text || '')) {
      if (ch === '\n' || ch === '\r' || ch === '\t') continue;
      if (!isSupportedChar(ch) && out.indexOf(ch) === -1) out.push(ch);
    }
    return out;
  }

  function approxCharWidth(ch, size) {
    const cp = ch.codePointAt(0);
    if (cp === 0x20) return size * 0.28;
    if (cp >= 0xac00 && cp <= 0xd7a3) return size * 1.0;
    if (cp >= 0x3130 && cp <= 0x318f) return size * 0.86;
    if (cp >= 0x3000 && cp <= 0x303f) return size * 1.0;
    if (cp >= 0xff00 && cp <= 0xffef) return size * 1.0;
    if (cp >= 0x2000 && cp <= 0x206f) return size * 0.45;
    if (cp >= 0x2190 && cp <= 0x21ff) return size * 0.9;
    if (cp >= 0x2460 && cp <= 0x24ff) return size * 1.0;
    if (cp >= 0x25a0 && cp <= 0x25ff) return size * 0.95;
    if (cp === 0x2713 || cp === 0x2714) return size * 0.9;
    if (cp >= 0x30 && cp <= 0x39) return size * 0.56;
    if (cp >= 0x41 && cp <= 0x5a) return size * 0.66;
    if (cp >= 0x61 && cp <= 0x7a) return size * 0.55;
    return size * 0.5;
  }

  function approxMeasure(text, size) {
    let total = 0;
    for (const ch of String(text)) total += approxCharWidth(ch, size);
    return total;
  }

  /**
   * Word wrapping that behaves for Korean: break at spaces, and break a token
   * by character only when the token alone is wider than the line.
   * Respects explicit newlines.
   */
  function wrapText(text, maxWidth, measure) {
    const m = measure || approxMeasure;
    const lines = [];
    const paragraphs = String(text == null ? '' : text).split(/\r?\n/);
    for (const para of paragraphs) {
      if (para === '') { lines.push(''); continue; }
      const tokens = para.split(/(\s+)/).filter((t) => t !== '');
      let line = '';
      const pushLine = () => { lines.push(line.replace(/\s+$/, '')); line = ''; };
      for (const token of tokens) {
        if (/^\s+$/.test(token)) {
          if (line !== '') line += ' ';
          continue;
        }
        const candidate = line + token;
        if (m(candidate, 1) <= maxWidth) { line = candidate; continue; }
        if (line !== '') pushLine();
        if (m(token, 1) <= maxWidth) { line = token; continue; }
        let chunk = '';
        for (const ch of token) {
          if (chunk && m(chunk + ch, 1) > maxWidth) { lines.push(chunk); chunk = ''; }
          chunk += ch;
        }
        line = chunk;
      }
      pushLine();
    }
    return lines.length ? lines : [''];
  }

  /* ------------------------------------------------------- stroke handling */

  function dist2(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  /** Drop points closer than `minDist` px so strokes stay light. */
  function thinPoints(points, minDist) {
    const out = [];
    const lim = (minDist || 1.2) * (minDist || 1.2);
    for (const p of points) {
      if (!out.length || dist2(out[out.length - 1], p) >= lim) out.push(p);
    }
    if (points.length && out[out.length - 1] !== points[points.length - 1]) {
      out.push(points[points.length - 1]);
    }
    return out;
  }

  /**
   * Smooth quadratic segments through the stroke points — the canvas renderer
   * draws these, so a stroke saved at 3× still looks like handwriting.
   */
  function smoothStroke(points) {
    const pts = points.length > 2 ? thinPoints(points, 1.4) : points.slice();
    const segs = [];
    const n = pts.length;
    if (n < 2) {
      if (n === 1) segs.push({ from: pts[0], ctrl: pts[0], to: pts[0] });
      return segs;
    }
    // Quadratic chain: every point becomes a control point and the curve runs
    // through the midpoints, which removes the corners of raw pointer input.
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    for (let i = 1; i < n; i++) {
      segs.push({
        from: i === 1 ? pts[0] : mid(pts[i - 2], pts[i - 1]),
        ctrl: pts[i - 1],
        to: i === n - 1 ? pts[n - 1] : mid(pts[i - 1], pts[i]),
      });
    }
    return segs;
  }

  function strokeBounds(points, width) {
    if (!points.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
    const pad = (width || 2) / 2 + 2;
    return {
      x: minX - pad, y: minY - pad,
      w: Math.max(1, maxX - minX + pad * 2), h: Math.max(1, maxY - minY + pad * 2),
    };
  }

  /* ------------------------------------------------------------------ seal */

  /**
   * Korean seal ("도장") layout in a normalised 1000 × 1000 box.
   * The canvas renderer only scales these numbers, so the layout is identical
   * at any output resolution.
   *
   * opts: { name, org, shape: 'circle'|'square', orient: 'vertical'|'horizontal',
   *         showIn, ink }
   */
  function sealLayout(opts) {
    const o = Object.assign(
      { name: '', org: '', shape: 'circle', orient: 'vertical', showIn: false },
      opts || {}
    );
    const name = Array.from(String(o.name || '').replace(/\s+/g, ''));
    const org = Array.from(String(o.org || '').replace(/\s+/g, ''));
    const marks = [];
    const glyphs = [];
    const ink = o.ink || '#c8322b';
    const placed = { name: null, in: null, org: null };

    const putName = (chars) => {
      if (!chars.length) return;
      if (o.shape === 'square') {
        if (o.orient === 'vertical') {
          const size = Math.min(200, 800 / chars.length);
          const step = size * 0.98;
          const top = 500 - ((chars.length - 1) * step) / 2;
          chars.forEach((ch, i) => glyphs.push({ ch, x: 500, y: top + i * step, size, rot: 0, layer: 'name' }));
          placed.name = { x: 500 - size / 2, y: top - size / 2, w: size, h: (chars.length - 1) * step + size };
        } else {
          const size = Math.min(200, (840 / chars.length) * 0.92);
          const step = size * 1.04;
          const left = 500 - ((chars.length - 1) * step) / 2;
          chars.forEach((ch, i) => glyphs.push({ ch, x: left + i * step, y: 500, size, rot: 0, layer: 'name' }));
          placed.name = { x: left - size / 2, y: 500 - size / 2, w: (chars.length - 1) * step + size, h: size };
        }
        return;
      }
      // circle
      if (o.orient === 'vertical') {
        const cols = chars.length > 4 ? 2 : 1;
        const rows = Math.ceil(chars.length / cols);
        const size = chars.length > 4 ? 150 : chars.length === 4 ? 176 : 200;
        const colW = size * 0.92;
        const rowH = size * 0.96;
        const cy = 500 + (org.length ? 66 : 0);
        chars.forEach((ch, i) => {
          const col = cols === 1 ? 0 : Math.floor(i / rows);
          const row = cols === 1 ? i : i % rows;
          const x = 500 + (cols === 1 ? 0 : (colW / 2 - col * colW));
          const y = cy - ((rows - 1) * rowH) / 2 + row * rowH;
          glyphs.push({ ch, x, y, size, rot: 0, layer: 'name' });
        });
        placed.name = {
          x: 500 - (cols * colW) / 2,
          y: cy - ((rows - 1) * rowH + size) / 2,
          w: cols * colW,
          h: (rows - 1) * rowH + size,
        };
        return;
      }
      const cols = Math.min(chars.length, 4);
      const rows = Math.ceil(chars.length / cols);
      const cell = 186;
      const size = 160;
      const cy = 500 + (org.length ? 70 : 0);
      chars.forEach((ch, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        glyphs.push({
          ch,
          x: 500 - ((cols - 1) * cell) / 2 + c * cell,
          y: cy - ((rows - 1) * cell) / 2 + r * cell,
          size,
          rot: 0,
          layer: 'name',
        });
      });
      placed.name = {
        x: 500 - ((cols - 1) * cell) / 2 - size / 2,
        y: cy - ((rows - 1) * cell) / 2 - size / 2,
        w: (cols - 1) * cell + size,
        h: (rows - 1) * cell + size,
      };
    };

    if (o.shape === 'circle') {
      marks.push({ kind: 'ring', cx: 500, cy: 500, r: 462, width: 36 });
      if (org.length) marks.push({ kind: 'ring', cx: 500, cy: 500, r: 402, width: 7 });
      if (org.length) {
        const n = org.length;
        // Keep the arc readable: past ~±70° the glyphs start to look upside down.
        const span = Math.min(138, 26 * n);
        const start = -90 - span / 2;
        const step = n > 1 ? span / (n - 1) : 0;
        const r = 316;
        org.forEach((ch, i) => {
          const ang = start + step * i;
          const a = (ang * Math.PI) / 180;
          glyphs.push({
            ch, x: 500 + r * Math.cos(a), y: 500 + r * Math.sin(a),
            size: Math.min(104, 600 / Math.max(2, n)), rot: ang + 90, layer: 'org',
          });
        });
        placed.org = { x: 500 - r, y: 500 - r, w: r * 2, h: r * 2 };
      }
      if (name.length) putName(name);
      if (o.showIn) {
        const size = name.length ? 104 : 230;
        const y = name.length && placed.name ? placed.name.y + placed.name.h + size * 0.62 : 500;
        glyphs.push({ ch: '인', x: 500, y: Math.min(y, 780), size, rot: 0, layer: 'in' });
        placed.in = { x: 500 - size / 2, y: Math.min(y, 780) - size / 2, w: size, h: size };
      }
    } else {
      marks.push({ kind: 'rect', x: 62, y: 62, w: 876, h: 876, width: 32 });
      putName(name.length ? name : org);
      if (o.showIn) {
        const size = 92;
        const anchor = placed.name || { x: 500, y: 500, w: 0, h: 0 };
        const x = Math.min(anchor.x + anchor.w + size * 0.2, 800);
        const y = Math.min(anchor.y + anchor.h + size * 0.1, 760);
        glyphs.push({ ch: '인', x, y, size, rot: 0, layer: 'in' });
        placed.in = { x: x - size / 2, y: y - size / 2, w: size, h: size };
      }
    }

    return { marks, glyphs, ink, placed, name: name.join(''), org: org.join('') };
  }

  /* --------------------------------------------------------- page numbers */

  /**
   * Append "1 / 2" footers to every page of a built document. Kept separate
   * from the builders because the page count is only known at the end.
   */
  function addPageFooters(doc, opts) {
    const o = opts || {};
    const total = doc.pages.length;
    if (total < (o.minPages || 2)) return doc;
    doc.pages.forEach((page, i) => {
      page.blocks.push({
        type: 'text',
        text: (i + 1) + ' / ' + total,
        x: o.x != null ? o.x : 0,
        y: o.y != null ? o.y : doc.pageH - 36,
        w: o.w != null ? o.w : doc.pageW,
        size: 8.5,
        align: 'center',
        color: '#8b8f96',
        lineHeight: 1.2,
      });
    });
    return doc;
  }

  /* -------------------------------------------------------------- templates */

  const MARGIN = 56;
  const BODY = 9.6;

  function makeDoc(ctx) {
    const c = ctx || {};
    const pageW = c.pageW || PAGE_SIZES.A4.w;
    const pageH = c.pageH || PAGE_SIZES.A4.h;
    const margin = c.margin || MARGIN;
    const measure = c.measure || approxMeasure;
    const state = { pages: [], page: null, y: margin };
    const limit = () => pageH - margin;

    const api = {
      doc() {
        return { pages: state.pages, pageW: pageW, pageH: pageH, margin: margin };
      },
      get page() { return state.page; },
      get y() { return state.y; },
      set y(v) { state.y = v; },
      remaining() { return limit() - state.y; },
      newPage() {
        state.page = { blocks: [] };
        state.pages.push(state.page);
        state.y = margin;
        return state.page;
      },
      push(block) {
        if (!state.page) api.newPage();
        state.page.blocks.push(block);
      },
      ensure(h) {
        if (!state.page) api.newPage();
        if (state.y + h > limit() && state.y > margin + 1) {
          api.newPage();
          return true;
        }
        return false;
      },
      gap(h) { state.y += h; },
      text(str, o) {
        const opt = o || {};
        const size = opt.size || BODY;
        const lh = opt.lineHeight || 1.62;
        const w = opt.w != null ? opt.w : pageW - margin * 2;
        const x = opt.x != null ? opt.x : margin;
        const lines = wrapText(str, w, (t, s) => measure(t, size * (s || 1)));
        const lineH = size * lh;
        const totalH = lines.length * lineH;
        if (opt.spaceBefore) state.y += opt.spaceBefore;
        api.ensure(totalH + (opt.spaceAfter || 0));
        api.push({
          type: 'text',
          text: lines.join('\n'),
          x: x, y: state.y, w: w, size: size,
          lineHeight: lh,
          align: opt.align || 'left',
          color: opt.color || '#1a1c20',
          tracking: opt.tracking || 0,
        });
        state.y += totalH + (opt.spaceAfter || 0);
        return lines;
      },
      /** Hair line at an explicit y (no layout side effects). */
      line(o) {
        const y1 = o.y1 != null ? o.y1 : state.y;
        api.push({
          type: 'rule',
          x1: o.x1, y1: y1,
          x2: o.x2, y2: o.y2 != null ? o.y2 : y1,
          color: o.color || '#c9ccd1',
          width: o.width || 0.8,
        });
      },
      rect(o) {
        api.push({
          type: 'rect',
          x: o.x, y: o.y != null ? o.y : state.y, w: o.w, h: o.h,
          fill: o.fill || null, stroke: o.stroke || null,
          strokeWidth: o.strokeWidth || 0.8,
        });
      },
      circle(o) {
        api.push({
          type: 'circle',
          x: o.x, y: o.y != null ? o.y : state.y, d: o.d,
          fill: o.fill || null, stroke: o.stroke || null,
          strokeWidth: o.strokeWidth || 0.8,
        });
      },
      /** "제1조 (목적)" heading followed by body text. */
      clause(num, title, body, o) {
        const opt = o || {};
        api.text(num + ' ' + title, {
          size: BODY, lineHeight: 1.62, color: '#14161a', spaceAfter: 1.5,
        });
        api.text(body, {
          size: BODY, lineHeight: 1.68, spaceAfter: opt.spaceAfter == null ? 8 : opt.spaceAfter,
          color: '#2a2e34',
        });
      },
    };
    return api;
  }

  function docTitle(api, title, subtitle) {
    const d = api.doc();
    api.text(title, {
      size: 22, align: 'center', lineHeight: 1.3, spaceAfter: 3,
      x: d.margin, w: d.pageW - d.margin * 2, tracking: 6, color: '#101216',
    });
    if (subtitle) {
      api.text(subtitle, { size: 8.6, align: 'center', color: '#7a7f88', spaceAfter: 16, tracking: 1.4 });
    } else {
      api.gap(14);
    }
  }

  /** Two-party signature table (갑 / 을) with a stamp column. */
  function signatureTable(api, opts) {
    const o = opts || {};
    const d = api.doc();
    const w = d.pageW - d.margin * 2;
    const margin = d.margin;
    const rowLabels = o.rowLabels || ['상호', '대표자', '서명 (인)'];
    const rows = rowLabels.length;
    const rowH = 34;
    const headH = 26;
    const h = headH + rowH * rows;
    api.ensure(h + 26);
    const y0 = api.y;
    const half = w / 2;
    api.rect({ x: margin, y: y0, w: w, h: h, stroke: '#9aa0a8', strokeWidth: 0.9, fill: '#ffffff' });
    api.rect({ x: margin, y: y0, w: half, h: headH, fill: '#f2f3f5' });
    api.rect({ x: margin + half, y: y0, w: half, h: headH, fill: '#f5f5f6' });
    api.line({ x1: margin, y1: y0 + headH, x2: margin + w, color: '#9aa0a8', width: 0.8 });
    api.rect({ x: margin + half - 0.4, y: y0, w: 0.8, h: h, fill: '#c9ccd1' });
    for (let r = 1; r < rows; r++) {
      api.line({ x1: margin, y1: y0 + headH + r * rowH, x2: margin + w, color: '#d6d9dd', width: 0.7 });
    }
    api.push({ type: 'text', text: o.leftLabel || '갑 (의뢰인)', x: margin, y: y0 + 8, w: half, size: 8.8, align: 'center', color: '#40444b', tracking: 1 });
    api.push({ type: 'text', text: o.rightLabel || '을 (수급인)', x: margin + half, y: y0 + 8, w: half, size: 8.8, align: 'center', color: '#40444b', tracking: 1 });
    rowLabels.forEach((label, i) => {
      const ry = y0 + headH + i * rowH;
      [margin, margin + half].forEach((x0, col) => {
        const values = col === 0 ? o.leftValues : o.rightValues;
        api.push({ type: 'text', text: label, x: x0 + 9, y: ry + 9.5, w: 54, size: 8.4, color: '#6b7078' });
        const value = values ? values[i] : '';
        if (value) api.push({ type: 'text', text: value, x: x0 + 62, y: ry + 8.5, w: half - 76, size: 9.4, color: '#1a1c20' });
      });
    });
    api.y = y0 + h + (o.spaceAfter == null ? 14 : o.spaceAfter);
  }

  /* -------- 1. 용역계약서 -------- */

  const SERVICE_FIELDS = [
    { key: 'clientName', label: '갑 · 상호(회사명)', value: '주식회사 한빛컴퍼니', placeholder: '주식회사 한빛컴퍼니' },
    { key: 'clientRep', label: '갑 · 대표자', value: '김서연', placeholder: '대표자 성명' },
    { key: 'clientBizNo', label: '갑 · 사업자등록번호', value: '123-45-67890', placeholder: '000-00-00000' },
    { key: 'clientAddr', label: '갑 · 주소', value: '서울특별시 마포구 월드컵북로 21', placeholder: '주소' },
    { key: 'vendorName', label: '을 · 상호(성명)', value: '김민수 (프리랜서)', placeholder: '상호 또는 성명' },
    { key: 'vendorBizNo', label: '을 · 사업자등록번호', value: '234-56-78901', placeholder: '000-00-00000' },
    { key: 'vendorAddr', label: '을 · 주소', value: '서울특별시 은평구 응암로 12', placeholder: '주소' },
    { key: 'workTitle', label: '용역명', value: '브랜드 콘텐츠 기획 및 제작', placeholder: '예: 브랜드 콘텐츠 기획' },
    { key: 'workDetail', label: '업무 범위', type: 'textarea', rows: 3, value: '블로그 원고 20편 기획·작성, 월간 운영 리포트 2회 제출, 채널별 콘텐츠 캘린더 수립', placeholder: '구체적인 업무 범위를 적어주세요' },
    { key: 'amount', label: '계약 금액 (원)', type: 'number', value: '12000000', placeholder: '12000000' },
    { key: 'payTerms', label: '지급 조건', type: 'select', value: 'completion', options: [
      { value: 'completion', label: '용역 완료 후 7일 이내 전액' },
      { value: 'split', label: '착수금 30% · 완료 후 70%' },
      { value: 'monthly', label: '매월 말일 1/2씩 분할' },
    ] },
    { key: 'startDate', label: '계약 시작일', type: 'date', value: '2026-12-01' },
    { key: 'endDate', label: '계약 종료일', type: 'date', value: '2027-01-31' },
    { key: 'contractDate', label: '계약 체결일', type: 'date', value: '' },
    { key: 'special', label: '특약사항 (선택)', type: 'textarea', rows: 2, value: '', placeholder: '없으면 비워두세요' },
  ];

  function buildServiceContract(values, ctx) {
    const v = Object.assign({}, values);
    const api = makeDoc(ctx);
    docTitle(api, '용 역 계 약 서', 'SERVICE AGREEMENT');
    api.text(
      '「' + v.clientName + '」(이하 "갑")과 「' + v.vendorName + '」(이하 "을")은 아래와 같이 용역계약을 체결하고, 이를 증명하기 위하여 계약서 2부를 작성하여 각 1부씩 보관한다.',
      { size: BODY, lineHeight: 1.72, spaceAfter: 10, color: '#33373d' }
    );
    api.clause('제1조', '(목적)', '본 계약은 갑이 을에게 위탁하는 용역의 내용, 대금, 기간 및 당사자의 권리·의무를 정함을 목적으로 한다.');
    api.clause('제2조', '(용역의 내용)', '을은 다음 각 호의 업무를 성실히 수행한다.\n· 용역명: ' + v.workTitle + '\n· 세부 업무: ' + (v.workDetail || '-'), { spaceAfter: 9 });
    api.clause('제3조', '(계약기간)', '본 계약의 기간은 ' + formatPeriod(v.startDate, v.endDate) + '까지로 한다. 다만 양 당사자의 서면 합의로 연장할 수 있다.');
    const amt = Number(String(v.amount).replace(/[^\d]/g, '')) || 0;
    let pay = '을은 용역 완료 후 갑에게 세금계산서를 발행하고, 갑은 청구일로부터 7일 이내에 계약금액을 지급한다.';
    if (v.payTerms === 'split') pay = '갑은 계약 체결 시 계약금액의 30%를 착수금으로 지급하고, 용역 완료 후 7일 이내에 나머지 70%를 지급한다.';
    if (v.payTerms === 'monthly') pay = '갑은 계약금액을 매월 말일을 기준으로 2회에 나누어 지급한다.';
    api.clause('제4조', '(대금 및 지급방법)',
      '① 본 계약의 총 용역대금은 ' + amountInKorean(amt) + '(' + formatMoney(amt) + ')으로 한다.\n② ' + pay + '\n③ 대금은 을이 지정한 계좌로 이체한다.');
    api.clause('제5조', '(결과물 및 검수)', '을은 용역 결과물을 기간 내에 갑에게 제출하고, 갑은 제출일로부터 5영업일 이내에 검수 결과를 통지한다. 그 기간 내에 이의가 없으면 검수에 합격한 것으로 본다. 갑의 요청에 따른 2회의 수정은 무상으로 한다.');
    api.clause('제6조', '(비밀유지)', '양 당사자는 본 계약과 관련하여 알게 된 상대방의 영업비밀, 고객정보, 내부자료를 제3자에게 누설하거나 본 계약의 목적 외로 사용하지 않는다. 본 조의 의무는 계약 종료 후 2년간 유효하다.');
    api.clause('제7조', '(지식재산권)', '갑이 대금을 전액 지급한 때에 을이 창작한 결과물에 대한 사용권은 갑에게 귀속된다. 다만 을이 기존에 보유한 도구·템플릿·노하우에 대한 권리는 을에게 유보된다.');
    api.clause('제8조', '(해지)', '어느 일방이 본 계약상 의무를 위반하고 상당한 기간을 정한 서면 최고에도 불구하고 이를 시정하지 않는 경우, 상대방은 계약을 해지할 수 있다. 해지 시 갑은 이미 수행된 부분에 대한 대금을 지급한다.');
    api.clause('제9조', '(손해배상)', '당사자는 고의 또는 중대한 과실로 상대방에게 손해를 입힌 경우 그 손해를 배상한다. 배상액은 본 계약 금액을 한도로 한다.');
    api.clause('제10조', '(분쟁의 해결)', '본 계약과 관련한 분쟁은 상호 협의로 해결하고, 협의가 이루어지지 않을 경우 갑의 사업장 소재지를 관할하는 법원을 전속 관할법원으로 한다.');
    if (v.special) api.clause('제11조', '(특약사항)', v.special);
    api.ensure(206);
    api.gap(8);
    api.text('서 명 및 날 인', { size: 10.5, align: 'center', tracking: 5, color: '#14161a', spaceAfter: 3 });
    api.text('본 계약의 성립을 증명하기 위하여 아래와 같이 서명·날인한다.', { size: 8.6, align: 'center', color: '#6b7078', spaceAfter: 12 });
    api.text(formatKoreanDate(v.contractDate || new Date()), { size: 10.5, align: 'center', spaceAfter: 12, color: '#33373d' });
    signatureTable(api, {
      leftValues: [v.clientName, v.clientRep, ''],
      rightValues: [v.vendorName, '', ''],
    });
    api.text('※ 본 서식은 일반적인 거래를 위한 예시이며 법률 자문이 아닙니다. 중요한 계약은 전문가의 검토를 받으세요.', {
      size: 7.6, color: '#8b8f96', lineHeight: 1.5, align: 'center',
    });
    return addPageFooters(api.doc(), { minPages: 2 });
  }

  /* -------- 2. 비밀유지서약서 (NDA) -------- */

  const NDA_FIELDS = [
    { key: 'discloserName', label: '공개자(갑) · 상호', value: '주식회사 한빛컴퍼니', placeholder: '회사명 또는 성명' },
    { key: 'discloserRep', label: '공개자(갑) · 대표자', value: '김서연', placeholder: '대표자 성명' },
    { key: 'receiverName', label: '수령자(을) · 상호', value: '김민수 (프리랜서)', placeholder: '회사명 또는 성명' },
    { key: 'receiverBizNo', label: '수령자(을) · 사업자등록번호', value: '234-56-78901', placeholder: '000-00-00000' },
    { key: 'purpose', label: '비밀정보 공개 목적', value: '브랜드 콘텐츠 제작 협업 검토', placeholder: '예: 신제품 협업 검토' },
    { key: 'years', label: '비밀유지 기간 (년)', type: 'number', value: '3', placeholder: '3' },
    { key: 'effectiveDate', label: '발효일', type: 'date', value: '2026-12-01' },
    { key: 'penalty', label: '위반 시 손해배상액 (원, 선택)', type: 'number', value: '10000000', placeholder: '10000000' },
  ];

  function buildNda(values, ctx) {
    const v = Object.assign({}, values);
    const api = makeDoc(ctx);
    docTitle(api, '비 밀 유 지 서 약 서', 'NON-DISCLOSURE AGREEMENT');
    api.text(
      '「' + v.discloserName + '」(이하 "갑")과 「' + v.receiverName + '」(이하 "을")은 ' + (v.purpose ? v.purpose + '과 관련하여' : '상호 협력과 관련하여') + ' 갑이 을에게 공개하는 비밀정보의 보호에 관하여 아래와 같이 약정한다.',
      { size: BODY, lineHeight: 1.72, spaceAfter: 10, color: '#33373d' }
    );
    api.clause('제1조', '(목적)', '본 약정은 갑이 을에게 제공하는 기술·영업·경영에 관한 비밀정보의 범위와 보호 의무를 정함을 목적으로 한다.');
    api.clause('제2조', '(비밀정보의 정의)', '비밀정보란 갑이 서면, 전자문서, 구두 또는 저장매체의 형태로 을에게 제공한 정보로서 제공 시 비밀로 표시되었거나 그 성질상 비밀임을 알 수 있는 정보를 말하며, 다음 각 호를 포함한다.\n· 제품 기획안, 디자인 시안, 원고, 촬영·제작물\n· 가격, 거래처, 계약 조건, 매출 자료\n· 고객 명단, 연락처, 개인정보\n· 그 밖에 갑이 비밀로 지정한 정보');
    api.clause('제3조', '(비밀정보의 예외)', '다음 각 호의 정보는 비밀정보에서 제외한다.\n① 이미 공개된 정보 또는 을의 귀책사유 없이 공개된 정보\n② 을이 갑으로부터 제공받기 전에 이미 정당하게 보유하고 있던 정보\n③ 제3자로부터 비밀유지 의무 없이 적법하게 취득한 정보\n④ 법령 또는 법원의 명령에 따라 공개가 요구되는 정보(사전 통지 의무)');
    api.clause('제4조', '(비밀유지 의무)', '① 을은 비밀정보를 본 약정의 목적 외로 사용하지 않는다.\n② 을은 갑의 사전 서면 동의 없이 비밀정보를 제3자에게 공개하거나 누설하지 않는다.\n③ 을은 비밀정보를 필요 최소한의 인원에게만 열람하게 하고, 해당 인원에게 동일한 의무를 부과한다.\n④ 을은 비밀정보를 안전하게 보관하고 유출·분실·훼손 방지를 위해 합리적인 조치를 한다.');
    api.clause('제5조', '(비밀유지 기간)', '본 약정에 따른 비밀유지 의무는 발효일로부터 ' + (v.years || '3') + '년간 유효하다. 다만 영업비밀에 해당하는 정보는 그 비밀이 공개될 때까지 효력이 존속한다.');
    api.clause('제6조', '(반환 및 파기)', '을은 갑의 요청이 있거나 본 약정의 목적이 달성된 때에는 비밀정보와 그 복제물을 즉시 반환하거나 파기하고 그 결과를 갑에게 서면으로 통지한다. 다만 법령상 보관이 필요한 사본은 별도로 분리하여 보관한다.');
    const penalty = Number(String(v.penalty || '').replace(/[^\d]/g, '')) || 0;
    api.clause('제7조', '(위반 시 책임)', '을이 본 약정을 위반하여 갑에게 손해를 입힌 경우 그 손해를 배상한다.' + (penalty ? ' 위반 시 손해배상액은 ' + amountInKorean(penalty) + '(' + formatMoney(penalty) + ')으로 정한다.' : ' 배상액은 실제 발생한 손해액으로 한다.'));
    api.clause('제8조', '(기타)', '본 약정에 정하지 않은 사항은 관계 법령과 일반 상관례에 따른다. 본 약정의 일부 조항이 무효가 되더라도 나머지 조항의 효력에는 영향을 미치지 않는다.');
    api.ensure(206);
    api.gap(8);
    api.text('서 명 및 날 인', { size: 10.5, align: 'center', tracking: 5, color: '#14161a', spaceAfter: 3 });
    api.text('본 약정의 성립을 증명하기 위하여 아래와 같이 서명·날인한다.', { size: 8.6, align: 'center', color: '#6b7078', spaceAfter: 12 });
    api.text(formatKoreanDate(v.effectiveDate || new Date()), { size: 10.5, align: 'center', spaceAfter: 12, color: '#33373d' });
    signatureTable(api, {
      leftLabel: '공개자 (갑)',
      rightLabel: '수령자 (을)',
      leftValues: [v.discloserName, v.discloserRep, ''],
      rightValues: [v.receiverName, '', ''],
    });
    api.text('※ 본 서식은 일반적인 예시이며 법률 자문이 아닙니다. 중요한 계약은 전문가의 검토를 받으세요.', {
      size: 7.6, color: '#8b8f96', lineHeight: 1.5, align: 'center',
    });
    return addPageFooters(api.doc(), { minPages: 2 });
  }

  /* -------- 3. 거래명세서 -------- */

  const STATEMENT_FIELDS = [
    { key: 'supplierName', label: '공급자 · 상호', value: '김민수 (프리랜서)', placeholder: '상호 또는 성명' },
    { key: 'supplierBizNo', label: '공급자 · 사업자등록번호', value: '234-56-78901', placeholder: '000-00-00000' },
    { key: 'supplierRep', label: '공급자 · 대표자', value: '김민수', placeholder: '성명' },
    { key: 'supplierAddr', label: '공급자 · 주소', value: '서울특별시 은평구 응암로 12', placeholder: '주소' },
    { key: 'buyerName', label: '공급받는자 · 상호', value: '주식회사 한빛컴퍼니', placeholder: '상호' },
    { key: 'buyerBizNo', label: '공급받는자 · 사업자등록번호', value: '123-45-67890', placeholder: '000-00-00000' },
    { key: 'buyerRep', label: '공급받는자 · 대표자', value: '김서연', placeholder: '성명' },
    { key: 'buyerAddr', label: '공급받는자 · 주소', value: '서울특별시 마포구 월드컵북로 21', placeholder: '주소' },
    { key: 'issueDate', label: '작성일', type: 'date', value: '' },
    { key: 'item1', label: '품목 1', value: '브랜드 콘텐츠 제작', placeholder: '품목명' },
    { key: 'qty1', label: '수량 1', type: 'number', value: '1', placeholder: '1' },
    { key: 'price1', label: '단가 1 (원)', type: 'number', value: '9000000', placeholder: '0' },
    { key: 'item2', label: '품목 2 (선택)', value: '운영 리포트', placeholder: '품목명' },
    { key: 'qty2', label: '수량 2', type: 'number', value: '2', placeholder: '0' },
    { key: 'price2', label: '단가 2 (원)', type: 'number', value: '1000000', placeholder: '0' },
    { key: 'vat', label: '부가세', type: 'select', value: 'excluded', options: [
      { value: 'excluded', label: '별도 (10% 추가)' },
      { value: 'included', label: '포함' },
      { value: 'none', label: '해당 없음 (면세)' },
    ] },
    { key: 'note', label: '비고', type: 'textarea', rows: 2, value: '계좌: 국민은행 000-0000-0000 (예금주 김민수)', placeholder: '입금 계좌 등' },
  ];

  function moneyRowsOf(v) {
    const rows = [];
    for (let i = 1; i <= 4; i++) {
      const name = v['item' + i];
      if (!name) continue;
      const qty = num(v['qty' + i]);
      const price = num(v['price' + i]);
      rows.push({ name: name, qty: qty, price: price, amount: Math.round(qty * price) });
    }
    return rows;
  }

  function statementTotals(v) {
    const rows = moneyRowsOf(v);
    const supply = rows.reduce((s, r) => s + r.amount, 0);
    const vat = v.vat === 'excluded' ? Math.round(supply * 0.1) : 0;
    return { rows: rows, supply: supply, vat: vat, total: supply + vat };
  }

  function buildStatement(values, ctx) {
    return buildStatementCore(values, ctx, 'statement');
  }

  const QUOTE_FIELDS = STATEMENT_FIELDS.concat([
    { key: 'validDays', label: '견적 유효기간 (일)', type: 'number', value: '30', placeholder: '30' },
    { key: 'receiver', label: '수신 담당자 (선택)', value: '', placeholder: '예: 김서연 팀장' },
  ]);

  function buildQuote(values, ctx) {
    return buildStatementCore(values, ctx, 'quote');
  }

  function buildStatementCore(values, ctx, kind) {
    const isQuote = kind === 'quote';
    const v = Object.assign({}, values);
    const t = statementTotals(v);
    const api = makeDoc(ctx);
    const d = api.doc();
    const pageW = d.pageW, margin = d.margin;
    const w = pageW - margin * 2;
    const inner = w - 44;

    docTitle(api, isQuote ? '견 적 서' : '거 래 명 세 서', isQuote ? 'QUOTATION' : 'STATEMENT OF TRANSACTION');

    const infoH = 118;
    const partH = infoH / 2;
    let y0 = api.y;
    api.rect({ x: margin, y: y0, w: w, h: infoH, stroke: '#9aa0a8', strokeWidth: 0.9, fill: '#ffffff' });
    api.rect({ x: margin, y: y0, w: 44, h: partH, fill: '#f2f3f5' });
    api.rect({ x: margin, y: y0 + partH, w: 44, h: partH, fill: '#f5f5f6' });
    api.line({ x1: margin, y1: y0 + partH, x2: margin + w, color: '#9aa0a8', width: 0.8 });
    api.line({ x1: margin + 44, y1: y0, x2: margin + 44, y2: y0 + infoH, color: '#c9ccd1', width: 0.8 });
    api.push({ type: 'text', text: isQuote ? '공급자' : '공급자', x: margin, y: y0 + partH / 2 - 6, w: 44, size: 9, align: 'center', color: '#40444b' });
    api.push({ type: 'text', text: isQuote ? '수요자' : '공급받는자', x: margin, y: y0 + partH + partH / 2 - 6, w: 44, size: isQuote ? 9 : 8, align: 'center', color: '#40444b' });

    const rowsOf = (top, no, name, rep, addr) => {
      api.push({ type: 'text', text: '등록번호  ' + (no || '-'), x: margin + 54, y: top + 8, w: 240, size: 8.8, color: '#33373d' });
      api.push({ type: 'text', text: '상    호  ' + (name || '-'), x: margin + 54, y: top + 25, w: 200, size: 8.8, color: '#33373d' });
      api.push({ type: 'text', text: '대 표 자  ' + (rep || '-'), x: margin + 54, y: top + 42, w: 200, size: 8.8, color: '#33373d' });
      api.push({ type: 'text', text: '주    소  ' + (addr || '-'), x: margin + 262, y: top + 25, w: inner - 220, size: 8.2, color: '#33373d' });
    };
    rowsOf(y0, v.supplierBizNo, v.supplierName, v.supplierRep, v.supplierAddr);
    rowsOf(y0 + partH, v.buyerBizNo, v.buyerName, v.buyerRep, v.buyerAddr);
    api.y = y0 + infoH + 22;

    // table
    const cols = [
      { w: 34, label: 'No', align: 'center' },
      { w: w - 34 - 56 - 86 - 104, label: '품목', align: 'left' },
      { w: 56, label: '수량', align: 'right' },
      { w: 86, label: '단가', align: 'right' },
      { w: 104, label: '금액', align: 'right' },
    ];
    const headH = 24;
    const rowH = 26;
    const bodyRows = Math.max(3, t.rows.length);
    const tableH = headH + rowH * bodyRows + rowH;
    api.ensure(tableH + 40);
    y0 = api.y;
    api.rect({ x: margin, y: y0, w: w, h: tableH, stroke: '#9aa0a8', strokeWidth: 0.9, fill: '#ffffff' });
    api.rect({ x: margin, y: y0, w: w, h: headH, fill: '#f2f3f5' });
    api.push({ type: 'text', text: '작성일  ' + formatKoreanDate(v.issueDate || new Date()), x: margin, y: y0 - 16, w: w, size: 8.6, align: 'right', color: '#6b7078' });
    let cx = margin;
    cols.forEach((c) => {
      api.push({
        type: 'text', text: c.label,
        x: c.align === 'right' ? cx : cx + (c.align === 'center' ? 0 : 8),
        y: y0 + 8, w: c.align === 'right' ? c.w - 8 : c.w,
        size: 9, align: c.align, color: '#40444b',
      });
      cx += c.w;
    });
    for (let r = 1; r <= bodyRows; r++) {
      api.line({ x1: margin, y1: y0 + headH + r * rowH, x2: margin + w, color: '#d6d9dd', width: 0.7 });
    }
    cx = margin + cols[0].w;
    cols.slice(1, 4).forEach((c) => {
      cx += c.w;
      api.line({ x1: cx, y1: y0, x2: cx, y2: y0 + tableH - rowH, color: '#e3e5e8', width: 0.8 });
    });
    for (let i = 0; i < bodyRows; i++) {
      const row = t.rows[i];
      const ry = y0 + headH + i * rowH;
      api.push({ type: 'text', text: String(i + 1), x: margin, y: ry + 9, w: cols[0].w, size: 9, align: 'center', color: '#1a1c20' });
      if (!row) continue;
      let x = margin + cols[0].w;
      api.push({ type: 'text', text: row.name, x: x + 8, y: ry + 8.5, w: cols[1].w - 12, size: 9, color: '#1a1c20' });
      x += cols[1].w;
      api.push({ type: 'text', text: formatWon(row.qty), x: x, y: ry + 8.5, w: cols[2].w - 8, size: 9, align: 'right', color: '#1a1c20' });
      x += cols[2].w;
      api.push({ type: 'text', text: formatWon(row.price), x: x, y: ry + 8.5, w: cols[3].w - 8, size: 9, align: 'right', color: '#1a1c20' });
      x += cols[3].w;
      api.push({ type: 'text', text: formatWon(row.amount), x: x, y: ry + 8.5, w: cols[4].w - 8, size: 9, align: 'right', color: '#1a1c20' });
    }
    const ty = y0 + headH + bodyRows * rowH;
    api.rect({ x: margin, y: ty, w: w, h: rowH, fill: '#fafafb' });
    api.push({ type: 'text', text: '합계', x: margin, y: ty + 9, w: w - cols[4].w - 8, size: 9, align: 'right', color: '#40444b' });
    api.push({ type: 'text', text: formatWon(t.total), x: margin + w - cols[4].w, y: ty + 9, w: cols[4].w - 8, size: 9.6, align: 'right', color: '#101216' });
    api.y = y0 + tableH + 16;

    const vatLabel = v.vat === 'excluded' ? '부가세 (10%)' : v.vat === 'included' ? '부가세 (포함)' : '부가세 (면세)';
    const summary = [
      ['공급가액', formatWon(t.supply) + ' 원'],
      [vatLabel, v.vat === 'excluded' ? formatWon(t.vat) + ' 원' : v.vat === 'included' ? '포함' : '-'],
      ['합계금액', formatWon(t.total) + ' 원'],
    ];
    const sumH = 22 * summary.length;
    api.ensure(sumH + 150);
    y0 = api.y;
    const sw = 236;
    const sx = margin + w - sw;
    api.rect({ x: sx, y: y0, w: sw, h: sumH, stroke: '#c9ccd1', strokeWidth: 0.8, fill: '#ffffff' });
    summary.forEach((s, i) => {
      const ry = y0 + i * 22;
      api.push({ type: 'text', text: s[0], x: sx + 10, y: ry + 6.5, w: 90, size: 8.8, color: '#5d626a' });
      api.push({ type: 'text', text: s[1], x: sx + 100, y: ry + 6, w: sw - 110, size: i === 2 ? 10.2 : 9, align: 'right', color: i === 2 ? '#101216' : '#1a1c20' });
      if (i < summary.length - 1) api.line({ x1: sx, y1: ry + 22, x2: sx + sw, color: '#e3e5e8', width: 0.7 });
    });
    api.push({ type: 'text', text: amountInKorean(t.total), x: margin, y: y0 + 6, w: w - sw - 16, size: 10.5, color: '#101216' });
    const bottomLine = isQuote
      ? '위와 같이 견적합니다.' + (v.validDays ? ' (견적 유효기간 ' + v.validDays + '일)' : '')
      : '위 금액을 정히 영수함.';
    api.push({ type: 'text', text: bottomLine, x: margin, y: y0 + 30, w: w - sw - 16, size: 9, color: '#5d626a' });
    api.y = y0 + sumH + 16;

    const sigY = api.y;
    api.text(formatKoreanDate(v.issueDate || new Date()), { size: 9.6, color: '#33373d', spaceAfter: 4 });
    api.text('공급자  ' + v.supplierName + (v.supplierRep ? '  (대표 ' + v.supplierRep + ')' : ''), { size: 9.6, color: '#33373d', spaceAfter: 4 });
    if (isQuote && v.receiver) api.text('수신  ' + v.receiver, { size: 9, color: '#5d626a', spaceAfter: 4 });
    api.circle({ x: margin + 320, y: sigY + 6, d: 62, stroke: '#d3bcb6', strokeWidth: 0.9 });
    api.push({ type: 'text', text: '인', x: margin + 320, y: sigY + 27, w: 62, size: 10, align: 'center', color: '#c8b2aa' });
    api.y = sigY + 74;
    if (v.note) api.text(v.note, { size: 8.6, color: '#6b7078', lineHeight: 1.5, spaceAfter: 8 });
    api.text(isQuote
      ? '※ 본 견적서는 예시 서식이며, 실제 거래 조건은 당사자 간 합의로 확정됩니다.'
      : '※ 본 명세서는 거래 사실을 확인하기 위한 서식이며, 세금계산서를 대체하지 않습니다.', {
      size: 7.4, color: '#9aa0a8', lineHeight: 1.5, align: 'center',
    });
    return api.doc();
  }

  /* -------- 4. 영수증 -------- */

  const RECEIPT_FIELDS = [
    { key: 'payer', label: '받은 사람(발행인)', value: '김민수', placeholder: '성명 또는 상호' },
    { key: 'payerBizNo', label: '사업자등록번호 (선택)', value: '234-56-78901', placeholder: '000-00-00000' },
    { key: 'payFor', label: '영수 내용', value: '브랜드 콘텐츠 제작 용역비', placeholder: '예: 웹사이트 제작비' },
    { key: 'amount', label: '금액 (원)', type: 'number', value: '9900000', placeholder: '0' },
    { key: 'method', label: '결제 수단', type: 'select', value: 'transfer', options: [
      { value: 'transfer', label: '계좌이체' },
      { value: 'card', label: '카드' },
      { value: 'cash', label: '현금' },
    ] },
    { key: 'date', label: '영수일', type: 'date', value: '' },
    { key: 'from', label: '지급인 (선택)', value: '주식회사 한빛컴퍼니', placeholder: '지급한 사람' },
  ];

  function buildReceipt(values, ctx) {
    const v = Object.assign({}, values);
    const amount = num(v.amount);
    const api = makeDoc(ctx);
    const d = api.doc();
    const margin = d.margin;
    const w = d.pageW - margin * 2;
    docTitle(api, '영 수 증', 'RECEIPT');
    const y0 = api.y + 8;
    const boxH = 214;
    api.rect({ x: margin, y: y0, w: w, h: boxH, stroke: '#9aa0a8', strokeWidth: 1, fill: '#ffffff' });
    const rowsData = [
      ['지급인', v.from || '-'],
      ['영수 내용', v.payFor || '-'],
      ['결제 수단', v.method === 'card' ? '카드' : v.method === 'cash' ? '현금' : '계좌이체'],
      ['영수일', formatKoreanDate(v.date || new Date())],
    ];
    const rH = 30;
    rowsData.forEach((r, i) => {
      const ry = y0 + 16 + i * rH;
      api.push({ type: 'text', text: r[0], x: margin + 18, y: ry + 8.5, w: 70, size: 8.8, color: '#6b7078' });
      api.push({ type: 'text', text: r[1], x: margin + 96, y: ry + 7.5, w: w - 120, size: 9.6, color: '#1a1c20' });
      if (i < rowsData.length - 1) api.line({ x1: margin + 14, y1: ry + rH - 2, x2: margin + w - 14, color: '#e6e8eb', width: 0.7 });
    });
    api.line({ x1: margin + 14, y1: y0 + 16 + rowsData.length * rH - 2, x2: margin + w - 14, color: '#c9ccd1', width: 0.8 });
    const amtY = y0 + 16 + rowsData.length * rH + 14;
    api.push({ type: 'text', text: '금     액', x: margin + 18, y: amtY + 9, w: 70, size: 8.8, color: '#6b7078' });
    api.push({ type: 'text', text: formatMoney(amount), x: margin + 96, y: amtY, w: w - 120, size: 19, color: '#101216' });
    api.push({ type: 'text', text: amountInKorean(amount), x: margin + 18, y: amtY + 38, w: w - 40, size: 9.6, color: '#33373d' });
    api.y = y0 + boxH + 24;
    api.text('위 금액을 정히 영수합니다.', { size: 11, align: 'center', spaceAfter: 14, color: '#33373d', tracking: 2 });
    api.text(formatKoreanDate(v.date || new Date()), { size: 10.5, align: 'center', spaceAfter: 14, color: '#33373d' });
    const sigY = api.y;
    const halfW = w / 2;
    api.push({ type: 'text', text: '발행인  ' + (v.payer || ''), x: margin, y: sigY, w: halfW - 40, size: 10, align: 'right', color: '#1a1c20' });
    if (v.payerBizNo) api.push({ type: 'text', text: '사업자등록번호 ' + v.payerBizNo, x: margin, y: sigY + 16, w: halfW - 40, size: 8.2, align: 'right', color: '#7a7f88' });
    api.circle({ x: margin + halfW + 12, y: sigY - 12, d: 74, stroke: '#d3bcb6', strokeWidth: 0.9 });
    api.push({ type: 'text', text: '인', x: margin + halfW + 12, y: sigY + 10, w: 74, size: 11, align: 'center', color: '#c8b2aa' });
    api.y = sigY + 84;
    api.text('※ 본 영수증은 거래 사실 확인용 간이 서식이며 세금계산서·현금영수증을 대체하지 않습니다.', {
      size: 7.6, color: '#9aa0a8', lineHeight: 1.5, align: 'center',
    });
    return api.doc();
  }

  /* ------------------------------------------------------------ template API */

  const TEMPLATES = [
    {
      id: 'service',
      title: '용역계약서',
      en: 'Service Agreement',
      desc: '프리랜서·1인 사업자 표준 용역계약 — 대금·기간·비밀유지·지재권 조항 포함',
      badge: '가장 많이 쓰는 서식',
      fields: SERVICE_FIELDS,
      build: buildServiceContract,
    },
    {
      id: 'nda',
      title: '비밀유지서약서 (NDA)',
      en: 'Non-disclosure Agreement',
      desc: '자료를 넘기기 전에 받아두는 비밀유지 약정서',
      badge: '',
      fields: NDA_FIELDS,
      build: buildNda,
    },
    {
      id: 'statement',
      title: '거래명세서',
      en: 'Statement of Transaction',
      desc: '품목·수량·단가·부가세 자동 계산, 영수 문구와 직인란까지',
      badge: '자동 계산',
      fields: STATEMENT_FIELDS,
      build: buildStatement,
    },
    {
      id: 'quote',
      title: '견적서',
      en: 'Quotation',
      desc: '품목별 금액·부가세 자동 계산, 유효기간까지 한 장에',
      badge: '',
      fields: QUOTE_FIELDS,
      build: buildQuote,
    },
    {
      id: 'receipt',
      title: '영수증',
      en: 'Receipt',
      desc: '계좌이체·현금 거래용 간이 영수증',
      badge: '',
      fields: RECEIPT_FIELDS,
      build: buildReceipt,
    },
  ];

  function getTemplate(id) {
    return TEMPLATES.filter((t) => t.id === id)[0] || null;
  }

  function templateDefaults(id) {
    const t = getTemplate(id);
    const out = {};
    if (!t) return out;
    t.fields.forEach((f) => { out[f.key] = f.value; });
    return out;
  }

  /** Build a template document; missing values fall back to the sample data. */
  function buildTemplate(id, values, ctx) {
    const t = getTemplate(id);
    if (!t) throw new Error('unknown template: ' + id);
    const merged = Object.assign(templateDefaults(id), values || {});
    return t.build(merged, ctx || {});
  }

  /* ------------------------------------------------------------------ misc */

  /** "서명 2 · 직인 1 · 텍스트 3" */
  function describeElements(elements) {
    const counts = { signature: 0, seal: 0, image: 0, text: 0, check: 0 };
    (elements || []).forEach((el) => {
      if (counts[el.kind] != null) counts[el.kind] += 1;
      else counts.image += 1;
    });
    const labels = { signature: '서명', seal: '직인', image: '이미지', text: '텍스트', check: '체크' };
    const parts = Object.keys(counts).filter((k) => counts[k]).map((k) => labels[k] + ' ' + counts[k]);
    return parts.length ? parts.join(' · ') : '없음';
  }

  return {
    PT_PER_MM: PT_PER_MM,
    PAGE_SIZES: PAGE_SIZES,
    clamp: clamp,
    round: round,
    makeId: makeId,
    fitWithin: fitWithin,
    clampRect: clampRect,
    rotatePoint: rotatePoint,
    pagePointFromDisplay: pagePointFromDisplay,
    displayPointFromPage: displayPointFromPage,
    displaySize: displaySize,
    pageRectFromDisplay: pageRectFromDisplay,
    elementPdfRotation: elementPdfRotation,
    elementTotalRotation: elementTotalRotation,
    displayAnchorToPage: displayAnchorToPage,
    rotatedOrigin: rotatedOrigin,
    numberToKorean: numberToKorean,
    amountInKorean: amountInKorean,
    formatWon: formatWon,
    formatMoney: formatMoney,
    formatKoreanDate: formatKoreanDate,
    formatISODate: formatISODate,
    formatDotDate: formatDotDate,
    formatPeriod: formatPeriod,
    toDate: toDate,
    sanitizeFilename: sanitizeFilename,
    isSupportedChar: isSupportedChar,
    unsupportedChars: unsupportedChars,
    approxMeasure: approxMeasure,
    approxCharWidth: approxCharWidth,
    wrapText: wrapText,
    thinPoints: thinPoints,
    smoothStroke: smoothStroke,
    strokeBounds: strokeBounds,
    sealLayout: sealLayout,
    addPageFooters: addPageFooters,
    TEMPLATES: TEMPLATES,
    getTemplate: getTemplate,
    templateDefaults: templateDefaults,
    buildTemplate: buildTemplate,
    moneyRowsOf: moneyRowsOf,
    QUOTE_FIELDS: QUOTE_FIELDS,
    statementTotals: statementTotals,
    describeElements: describeElements,
  };
});
