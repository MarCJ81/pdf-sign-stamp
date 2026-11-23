/* ==========================================================================
   PDF 서명·직인 스튜디오 — app
   Everything here runs in the browser only. No document, signature or stamp
   ever leaves the page: pdf.js reads the file from memory, pdf-lib writes the
   result straight back to a download.
   ========================================================================== */
(function () {
  'use strict';

  var E = window.PSS;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* The bundled font is the only typeface used inside documents. Its metrics
     (1160/288 units per 1000 em) are constant, which keeps the on-screen
     preview and the exported PDF on the same baseline. */
  var ASCENT = 1.16;
  var DESCENT = 0.288;
  var LINE_H = 1.4;
  var FONT_PATH = 'assets/fonts/NotoSansKR-Regular.ttf';
  var STORE_KEY = 'pss.library.v1';
  var THEME_KEY = 'pss.theme.v1';

  var state = {
    pages: [],
    pdfDoc: null,
    baseBytes: null,
    docName: '서명문서',
    docSource: null,
    templateId: null,
    templateValues: {},
    pageIndex: 0,
    zoom: 1,
    scale: 1,
    elements: [],
    selectedId: null,
    tool: 'signature',
    undo: [],
    redo: [],
    fontBytes: null,
    fontReady: false,
    pad: { strokes: [], color: '#12141a', width: 2.6, drawing: null, dpr: 1 },
    seal: { name: '김민수', org: '', shape: 'circle', orient: 'vertical', showIn: false, ink: '#c2352b' },
    text: { size: 11, color: '#12141a' },
    saved: { signatures: [], seals: [] },
    renderToken: 0,
    busy: false,
    external: 0,
    dirty: false,
  };

  var libs = { pdfjs: null, pdfLib: null, fontkit: null };
  var scriptPromises = {};
  var measureCanvas = document.createElement('canvas');
  var measureCtx = measureCanvas.getContext('2d');
  var toastTimer = null;
  var resizeTimer = null;

  /* ------------------------------------------------------------------ utils */

  function toast(message, warn) {
    var node = $('#toast');
    node.textContent = message;
    node.classList.toggle('is-warn', !!warn);
    node.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove('is-on'); }, warn ? 4200 : 3000);
  }

  function setBusy(on) {
    state.busy = !!on;
    var mask = $('#loading-mask');
    if (mask) mask.hidden = !on;
    document.body.classList.toggle('is-busy', !!on);
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + 'KB';
    return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  }

  function hexToRgb(hex) {
    var h = String(hex || '#000000').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      a.remove();
    }, 4000);
  }

  function isMobile() {
    return window.matchMedia('(max-width: 960px)').matches;
  }

  function currentPageModel() {
    return state.pages[state.pageIndex] || null;
  }

  function measureText(text, size) {
    measureCtx.font = size + 'px PSSNoto, "Noto Sans KR", sans-serif';
    return measureCtx.measureText(text || '').width;
  }

  function textBoxSize(text, size) {
    var lines = String(text == null ? '' : text).split('\n');
    var w = 0;
    lines.forEach(function (line) { w = Math.max(w, measureText(line, size)); });
    return { w: Math.max(8, Math.ceil(w * 100) / 100), h: Math.round(lines.length * size * LINE_H * 100) / 100, lines: lines };
  }

  function sanitizeDrawText(text) {
    var bad = E.unsupportedChars(text);
    if (!bad.length) return { text: text, dropped: [] };
    var out = '';
    Array.from(String(text)).forEach(function (ch) {
      if (E.isSupportedChar(ch) || ch === '\n') out += ch;
    });
    return { text: out, dropped: bad };
  }

  /* ------------------------------------------------------------- lazy libs */

  function loadScript(src) {
    if (scriptPromises[src]) return scriptPromises[src];
    scriptPromises[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('스크립트를 불러오지 못했습니다: ' + src)); };
      document.head.appendChild(s);
    });
    return scriptPromises[src];
  }

  function ensurePdfjs() {
    if (libs.pdfjs) return Promise.resolve(libs.pdfjs);
    return loadScript('assets/vendor/pdf.min.js').then(function () {
      var lib = window.pdfjsLib;
      if (!lib) throw new Error('pdf.js 로드 실패');
      lib.GlobalWorkerOptions.workerSrc = 'assets/vendor/pdf.worker.min.js';
      libs.pdfjs = lib;
      return lib;
    });
  }

  function ensurePdfLib() {
    if (libs.pdfLib) return Promise.resolve(libs);
    return Promise.all([
      loadScript('assets/vendor/pdf-lib.min.js'),
      loadScript('assets/vendor/fontkit.umd.min.js'),
    ]).then(function () {
      if (!window.PDFLib) throw new Error('pdf-lib 로드 실패');
      libs.pdfLib = window.PDFLib;
      libs.fontkit = window.fontkit;
      return libs;
    });
  }

  function ensureFont() {
    if (state.fontBytes) return Promise.resolve(state.fontBytes);
    return fetch(FONT_PATH).then(function (res) {
      if (!res.ok) throw new Error('글꼴을 불러오지 못했습니다');
      return res.arrayBuffer();
    }).then(function (buf) {
      state.fontBytes = new Uint8Array(buf);
      var copy = buf.slice(0);
      if (window.FontFace) {
        try {
          var face = new FontFace('PSSNoto', copy);
          return face.load().then(function (loaded) {
            document.fonts.add(loaded);
            state.fontReady = true;
            state.elements.forEach(function (el) { if (el.kind === 'text') resizeTextElement(el); });
            renderElements();
          }).catch(function () { /* preview falls back to a system font */ });
        } catch (err) { /* ignore */ }
      }
      return null;
    });
  }

  /* ---------------------------------------------------------------- document */

  function openBytes(bytes, name, meta) {
    var data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    setBusy(true);
    return ensurePdfjs().then(function (pdfjs) {
      if (state.pdfDoc) {
        try { state.pdfDoc.destroy(); } catch (err) { /* ignore */ }
        state.pdfDoc = null;
      }
      return pdfjs.getDocument({
        data: data.slice(0),
        cMapUrl: 'assets/vendor/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'assets/vendor/standard_fonts/',
        isEvalSupported: false,
        useSystemFonts: true,
      }).promise;
    }).then(function (doc) {
      state.pdfDoc = doc;
      state.baseBytes = data;
      state.pages = [];
      var chain = Promise.resolve();
      for (var i = 1; i <= doc.numPages; i++) {
        chain = chain.then(function (idx) {
          return doc.getPage(idx).then(function (page) {
            var v = page.view; // [x0, y0, x1, y1] in page units, unrotated
            state.pages[idx - 1] = {
              w: v[2] - v[0],
              h: v[3] - v[1],
              rotate: ((page.rotate || 0) % 360 + 360) % 360,
            };
          });
        }.bind(null, i));
      }
      return chain;
    }).then(function () {
      state.pageIndex = 0;
      state.elements = [];
      state.selectedId = null;
      state.undo = [];
      state.redo = [];
      state.zoom = 1;
      state.docName = E.sanitizeFilename(name || '서명문서');
      state.docSource = (meta && meta.source) || 'file';
      state.templateId = (meta && meta.templateId) || null;
      $('#export-name').value = state.docName + '_서명';
      $('#empty-state').hidden = true;
      $('#page-shell').hidden = false;
      updateChrome();
      return renderPage(true);
    }).then(function () {
      setBusy(false);
      if (isMobile()) closeSheets();
      return true;
    }).catch(function (err) {
      setBusy(false);
      console.error(err);
      var msg = String(err && err.message || err);
      if (/password/i.test(msg)) toast('암호가 걸린 PDF입니다. 암호를 푼 뒤 다시 열어 주세요.', true);
      else toast('PDF를 열지 못했습니다. 다른 파일로 시도해 주세요.', true);
      throw err;
    });
  }

  function computeScale() {
    var page = currentPageModel();
    if (!page) return 1;
    var disp = E.displaySize(page);
    var stage = $('#stage');
    var padX = isMobile() ? 22 : 48;
    var availW = Math.max(160, stage.clientWidth - padX);
    var availH = Math.max(160, stage.clientHeight - 40);
    var fit = Math.min(availW / disp.w, availH / disp.h);
    fit = Math.max(0.12, Math.min(fit, 2));
    return fit * state.zoom;
  }

  function renderPage(resetScroll) {
    var page = currentPageModel();
    if (!state.pdfDoc || !page) return Promise.resolve();
    var token = ++state.renderToken;
    if (state.renderTask) {
      try { state.renderTask.cancel(); } catch (err) { /* ignore */ }
      state.renderTask = null;
    }
    state.scale = computeScale();
    var disp = E.displaySize(page);
    var shell = $('#page-shell');
    var canvas = $('#page-canvas');
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    shell.style.width = Math.round(disp.w * state.scale * 100) / 100 + 'px';
    shell.style.height = Math.round(disp.h * state.scale * 100) / 100 + 'px';

    return state.pdfDoc.getPage(state.pageIndex + 1).then(function (pdfPage) {
      if (token !== state.renderToken) return null;
      var viewport = pdfPage.getViewport({ scale: state.scale * dpr, rotation: page.rotate });
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      canvas.style.width = shell.style.width;
      canvas.style.height = shell.style.height;
      var ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // One render task at a time: overlapping renders share a canvas context and
      // leave stray paths behind on screen.
      var task = pdfPage.render({ canvasContext: ctx, viewport: viewport });
      state.renderTask = task;
      return task.promise.catch(function (err) {
        if (err && err.name === 'RenderingCancelledException') return null;
        throw err;
      });
    }).then(function () {
      if (token !== state.renderToken) return;
      state.renderTask = null;
      renderElements();
      if (resetScroll) $('#stage').scrollTop = 0;
    });
  }

  /* ---------------------------------------------------------------- elements */

  function getElement(id) {
    for (var i = 0; i < state.elements.length; i++) if (state.elements[i].id === id) return state.elements[i];
    return null;
  }

  function selectedElement() {
    return state.selectedId ? getElement(state.selectedId) : null;
  }

  function snapshot() {
    return state.elements.map(function (el) {
      var copy = {};
      for (var k in el) if (Object.prototype.hasOwnProperty.call(el, k)) copy[k] = el[k];
      return copy;
    });
  }

  function pushUndo() {
    state.undo.push({ elements: snapshot(), pageIndex: state.pageIndex });
    if (state.undo.length > 40) state.undo.shift();
    state.redo.length = 0;
    state.dirty = true;
    updateChrome();
  }

  function restore(entry) {
    state.elements = entry.elements;
    state.pageIndex = Math.min(entry.pageIndex, Math.max(0, state.pages.length - 1));
    state.selectedId = null;
    updateChrome();
    renderPage(false).then(updateInspector);
  }

  function undo() {
    if (!state.undo.length) { toast('되돌릴 작업이 없습니다'); return; }
    var entry = state.undo.pop();
    state.redo.push({ elements: snapshot(), pageIndex: state.pageIndex });
    restore(entry);
  }

  function redo() {
    if (!state.redo.length) { toast('다시 실행할 작업이 없습니다'); return; }
    var entry = state.redo.pop();
    state.undo.push({ elements: snapshot(), pageIndex: state.pageIndex });
    restore(entry);
  }

  function select(id) {
    state.selectedId = id;
    $$('.el').forEach(function (node) { node.classList.toggle('is-selected', node.dataset.id === id); });
    updateInspector();
    if (isMobile() && id) {
      var el = getElement(id);
      if (el && el.kind === 'text') openSheet('inspector');
    }
  }

  function addImageElement(src, opts) {
    var page = currentPageModel();
    if (!page) { toast('먼저 PDF를 열어 주세요', true); openTool('file'); return null; }
    var disp = E.displaySize(page);
    var o = opts || {};
    var width = Math.min(o.width || 150, disp.w * 0.7);
    var aspect = o.aspect && isFinite(o.aspect) ? o.aspect : 1;
    var height = width / aspect;
    if (height > disp.h * 0.5) { height = disp.h * 0.5; width = height * aspect; }
    var centerX = o.x != null ? o.x : disp.w / 2;
    var centerY = o.y != null ? o.y : disp.h * 0.62;
    var rect = E.clampRect({ x: centerX - width / 2, y: centerY - height / 2, w: width, h: height }, disp);
    var el = {
      id: E.makeId('el'),
      kind: o.kind || 'image',
      page: state.pageIndex,
      x: rect.x, y: rect.y, w: rect.w, h: rect.h,
      w0: rect.w, h0: rect.h, aspect: aspect,
      rot: 0, opacity: 1, src: src,
    };
    pushUndo();
    state.elements.push(el);
    renderElements();
    select(el.id);
    updateChrome();
    return el;
  }

  function addTextElement(text, opts) {
    var page = currentPageModel();
    if (!page) { toast('먼저 PDF를 열어 주세요', true); openTool('file'); return null; }
    var o = opts || {};
    var disp = E.displaySize(page);
    var clean = String(text == null ? '' : text);
    if (!clean) clean = '텍스트';
    var size = o.size || state.text.size;
    var box = textBoxSize(clean, size);
    var centerX = o.x != null ? o.x : disp.w / 2;
    var centerY = o.y != null ? o.y : disp.h * 0.4;
    var rect = E.clampRect({ x: centerX - box.w / 2, y: centerY - box.h / 2, w: box.w + 2, h: box.h }, disp);
    var el = {
      id: E.makeId('tx'),
      kind: 'text',
      page: state.pageIndex,
      x: rect.x, y: rect.y, w: rect.w, h: rect.h,
      text: clean,
      size: size,
      color: o.color || state.text.color,
      align: 'left',
      rot: 0,
      opacity: 1,
    };
    pushUndo();
    state.elements.push(el);
    renderElements();
    select(el.id);
    updateChrome();
    var missing = E.unsupportedChars(clean);
    if (missing.length) toast('이 글꼴에 없는 글자(' + missing.slice(0, 3).join(' ') + ')는 PDF에서 빠집니다', true);
    return el;
  }

  function resizeTextElement(el) {
    var box = textBoxSize(el.text, el.size);
    el.w = box.w + 2;
    el.h = box.h;
  }

  function deleteElement(id) {
    var el = getElement(id);
    if (!el) return;
    pushUndo();
    state.elements = state.elements.filter(function (e) { return e.id !== id; });
    if (state.selectedId === id) state.selectedId = null;
    renderElements();
    updateInspector();
    updateChrome();
    toast('요소를 삭제했습니다');
  }

  function duplicateElement() {
    var el = selectedElement();
    if (!el) return;
    pushUndo();
    var copy = {};
    for (var k in el) if (Object.prototype.hasOwnProperty.call(el, k)) copy[k] = el[k];
    copy.id = E.makeId(el.kind === 'text' ? 'tx' : 'el');
    var disp = E.displaySize(currentPageModel());
    var rect = E.clampRect({ x: el.x + 14, y: el.y + 14, w: el.w, h: el.h }, disp);
    copy.x = rect.x; copy.y = rect.y;
    state.elements.push(copy);
    renderElements();
    select(copy.id);
    updateChrome();
  }

  function renderElements() {
    var layer = $('#el-layer');
    if (!layer) return;
    var s = state.scale;
    layer.innerHTML = '';
    state.elements.forEach(function (el) {
      if (el.page !== state.pageIndex) return;
      layer.appendChild(buildElementNode(el, s));
    });
  }

  function buildElementNode(el, s) {
    var node = document.createElement('div');
    node.className = 'el' + (el.kind === 'text' ? ' el-text-wrap' : '');
    node.dataset.id = el.id;
    node.style.left = el.x * s + 'px';
    node.style.top = el.y * s + 'px';
    node.style.width = el.w * s + 'px';
    node.style.height = el.h * s + 'px';
    node.style.opacity = el.opacity == null ? 1 : el.opacity;
    if (el.rot) node.style.transform = 'rotate(' + el.rot + 'deg)';

    if (el.kind === 'text') {
      var text = document.createElement('div');
      text.className = 'el-text';
      text.style.fontSize = el.size * s + 'px';
      text.style.color = el.color;
      text.textContent = el.text;
      node.appendChild(text);
      node.classList.add('el-text-holder');
    } else {
      var img = document.createElement('img');
      img.src = el.src;
      img.alt = el.kind === 'signature' ? '서명' : el.kind === 'seal' ? '직인' : '이미지';
      img.draggable = false;
      node.appendChild(img);
    }

    var box = document.createElement('div');
    box.className = 'el-box';
    node.appendChild(box);

    ['nw', 'ne', 'sw', 'se'].forEach(function (h) {
      var hd = document.createElement('div');
      hd.className = 'hd';
      hd.dataset.h = h;
      node.appendChild(hd);
    });
    var rot = document.createElement('div');
    rot.className = 'hd-rot';
    rot.dataset.h = 'rot';
    node.appendChild(rot);
    var del = document.createElement('button');
    del.className = 'el-del';
    del.type = 'button';
    del.textContent = '✕';
    del.setAttribute('aria-label', '삭제');
    node.appendChild(del);

    if (el.id === state.selectedId) node.classList.add('is-selected');
    return node;
  }

  /* ------------------------------------------------------------- interaction */

  var drag = null;

  function pagePointFromEvent(ev) {
    var shell = $('#page-shell');
    var rect = shell.getBoundingClientRect();
    return { x: (ev.clientX - rect.left) / state.scale, y: (ev.clientY - rect.top) / state.scale };
  }

  function applyElementStyle(el) {
    var node = $('.el[data-id="' + el.id + '"]');
    if (!node) return;
    var s = state.scale;
    node.style.left = el.x * s + 'px';
    node.style.top = el.y * s + 'px';
    node.style.width = el.w * s + 'px';
    node.style.height = el.h * s + 'px';
    node.style.opacity = el.opacity == null ? 1 : el.opacity;
    node.style.transform = el.rot ? 'rotate(' + el.rot + 'deg)' : '';
    if (el.kind === 'text') {
      var inner = $('.el-text', node);
      if (inner) {
        inner.style.fontSize = el.size * s + 'px';
        inner.style.color = el.color;
        inner.textContent = el.text;
      }
    }
  }

  function startDrag(ev, el, mode, handle) {
    var start = pagePointFromEvent(ev);
    drag = {
      mode: mode,
      handle: handle,
      el: el,
      startPoint: start,
      start: { x: el.x, y: el.y, w: el.w, h: el.h, size: el.size, rot: el.rot || 0 },
      moved: false,
    };
    var center = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
    drag.center = center;
    if (mode === 'rotate') {
      drag.startAngle = Math.atan2(start.y - center.y, start.x - center.x) * 180 / Math.PI;
    }
    var node = $('.el[data-id="' + el.id + '"]');
    if (node) node.classList.add('is-dragging');
    ev.preventDefault();
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
  }

  function onDragMove(ev) {
    if (!drag) return;
    var pt = pagePointFromEvent(ev);
    var el = drag.el;
    var dx = pt.x - drag.startPoint.x;
    var dy = pt.y - drag.startPoint.y;
    var disp = E.displaySize(currentPageModel());
    if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) drag.moved = true;

    if (drag.mode === 'move') {
      var rect = E.clampRect({ x: drag.start.x + dx, y: drag.start.y + dy, w: el.w, h: el.h }, disp);
      el.x = rect.x; el.y = rect.y;
    } else if (drag.mode === 'resize') {
      var dirs = { nw: [-1, -1], ne: [1, -1], sw: [-1, 1], se: [1, 1] };
      var d = dirs[drag.handle] || dirs.se;
      var startW = Math.max(6, drag.start.w);
      var startH = Math.max(6, drag.start.h);
      var newW = Math.max(10, drag.start.w + d[0] * dx);
      if (el.kind === 'text') {
        var factor = Math.max(0.15, newW / startW);
        var size = Math.max(6, Math.min(96, drag.start.size * factor));
        el.size = Math.round(size * 10) / 10;
        resizeTextElement(el);
      } else {
        var f = Math.max(0.03, newW / startW);
        el.w = Math.max(8, startW * f);
        el.h = Math.max(8, startH * f);
      }
      el.x = d[0] < 0 ? drag.start.x + drag.start.w - el.w : drag.start.x;
      el.y = d[1] < 0 ? drag.start.y + drag.start.h - el.h : drag.start.y;
      var clamped = E.clampRect({ x: el.x, y: el.y, w: el.w, h: el.h }, disp);
      el.x = clamped.x; el.y = clamped.y;
    } else if (drag.mode === 'rotate') {
      var angle = Math.atan2(pt.y - drag.center.y, pt.x - drag.center.x) * 180 / Math.PI;
      var deg = drag.start.rot + (angle - drag.startAngle);
      deg = ((deg % 360) + 540) % 360 - 180;
      if (Math.abs(deg) < 2.5) deg = 0;
      if (Math.abs(Math.abs(deg) - 90) < 2.5) deg = deg < 0 ? -90 : 90;
      el.rot = Math.round(deg * 10) / 10;
    }
    applyElementStyle(el);
    if (drag.mode === 'resize') updateInspector();
  }

  function onDragEnd() {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
    if (!drag) return;
    var node = $('.el[data-id="' + drag.el.id + '"]');
    if (node) node.classList.remove('is-dragging');
    var moved = drag.moved;
    drag = null;
    if (moved) updateChrome();
    updateInspector();
  }

  function bindStage() {
    var layer = $('#el-layer');
    layer.addEventListener('pointerdown', function (ev) {
      var del = ev.target.closest('.el-del');
      var node = ev.target.closest('.el');
      if (del && node) { deleteElement(node.dataset.id); ev.preventDefault(); return; }
      if (!node) return;
      var el = getElement(node.dataset.id);
      if (!el) return;
      select(el.id);
      var handle = ev.target.closest('.hd, .hd-rot');
      if (handle) startDrag(ev, el, handle.dataset.h === 'rot' ? 'rotate' : 'resize', handle.dataset.h);
      else startDrag(ev, el, 'move');
    });

    $('#page-canvas').addEventListener('pointerdown', function (ev) {
      if (state.tool !== 'text') { select(null); return; }
      var pt = pagePointFromEvent(ev);
      var content = $('#text-content').value.trim();
      var el = addTextElement(content || '텍스트', { x: pt.x, y: pt.y });
      if (el) {
        closeSheets();
        setTimeout(function () { var ta = $('#insp-text'); if (ta) ta.focus(); }, 60);
      }
    });

    $('#stage').addEventListener('pointerdown', function (ev) {
      if (ev.target === $('#stage') || ev.target === $('#stage-inner')) select(null);
    });
  }

  /* ------------------------------------------------------------ signature pad */

  function padCanvas() { return $('#sig-canvas'); }

  /* signature_pad(MIT) — 곡선·필압 기반의 부드러운 손글씨. 없으면 기존 패드로 동작한다. */
  var sigPad = null;

  function signaturePadAvailable() {
    return typeof window.SignaturePad === 'function';
  }

  function strokesFromPad(data) {
    return (data || []).map(function (g) {
      var pts = (g.points || []).map(function (p) { return { x: p.x, y: p.y }; });
      var w = typeof g.maxWidth === 'number' ? (g.minWidth + g.maxWidth) / 2 : state.pad.width;
      return { points: pts, color: g.penColor || g.color || state.pad.color, width: Math.max(1, Math.min(6, w || 2.6)) };
    });
  }

  function updatePadHint() {
    var wrap = padCanvas() && padCanvas().closest('.pad-wrap');
    if (wrap) wrap.classList.toggle('has-ink', state.pad.strokes.length > 0);
    var ph = $('#sig-placeholder');
    if (ph) ph.hidden = state.pad.strokes.length > 0;
  }

  /** 화면 크기에 맞춰 signature_pad 를 새로 붙인다(색·굵기 변경, 시트 열기). */
  function mountSignaturePad() {
    var canvas = padCanvas();
    if (!canvas || !signaturePadAvailable()) return null;
    var rect = canvas.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return null; // 숨겨진 상태에서는 붙이지 않는다
    canvas.width = Math.max(1, Math.round(rect.width));
    canvas.height = Math.max(1, Math.round(rect.height));
    sigPad = new window.SignaturePad(canvas, {
      backgroundColor: 'rgba(0,0,0,0)',
      penColor: state.pad.color,
      minWidth: Math.max(0.6, state.pad.width * 0.55),
      maxWidth: Math.max(1, state.pad.width * 1.3),
      dotSize: function () { return Math.max(1, state.pad.width * 0.9); },
      throttle: 8,
      minDistance: 0.9,
      velocityFilterWeight: 0.7
    });
    sigPad.addEventListener('endStroke', function () {
      state.pad.strokes = strokesFromPad(sigPad.toData());
      updatePadHint();
    });
    window.__sigPad = sigPad; // 브라우저 검증용 핸들(키·문서 데이터 없음)
    return sigPad;
  }

  /** 색·굵기를 바꾸면 새 설정으로 다시 붙이고 기존 획은 그대로 살린다. */
  function rebuildSignaturePad() {
    if (!sigPad) return;
    var data = sigPad.toData();
    sigPad = null;
    var fresh = mountSignaturePad();
    if (fresh && data && data.length) {
      try { fresh.fromData(data, { clear: true }); } catch (e) { /* ignore */ }
      state.pad.strokes = strokesFromPad(data);
      updatePadHint();
    }
  }

  function resizePad() {
    var canvas = padCanvas();
    if (!canvas) return;
    if (signaturePadAvailable()) {
      if (sigPad) { rebuildSignaturePad(); return; }
      mountSignaturePad();
      updatePadHint();
      return;
    }
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.pad.dpr = dpr;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    drawPad();
  }

  function paintStrokes(ctx, strokes, widthScale) {
    strokes.forEach(function (stroke) {
      var pts = stroke.points;
      if (!pts.length) return;
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = Math.max(0.6, stroke.width * (widthScale || 1));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      var segs = E.smoothStroke(pts);
      ctx.beginPath();
      ctx.moveTo(segs[0].from.x, segs[0].from.y);
      segs.forEach(function (seg) { ctx.quadraticCurveTo(seg.ctrl.x, seg.ctrl.y, seg.to.x, seg.to.y); });
      ctx.stroke();
    });
  }

  function drawPad() {
    var canvas = padCanvas();
    if (!canvas) return;
    if (sigPad) { updatePadHint(); return; } // signature_pad 가 직접 그린다
    var ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(state.pad.dpr, 0, 0, state.pad.dpr, 0, 0);
    paintStrokes(ctx, state.pad.strokes);
    var wrap = canvas.closest('.pad-wrap');
    if (wrap) wrap.classList.toggle('has-ink', state.pad.strokes.length > 0);
    $('#sig-placeholder').hidden = state.pad.strokes.length > 0;
  }

  function padPoint(ev) {
    var canvas = padCanvas();
    var rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  function bindSignaturePad() {
    var canvas = padCanvas();
    if (signaturePadAvailable()) { mountSignaturePad(); return; } // 입력은 signature_pad 가 맡는다
    canvas.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      canvas.setPointerCapture(ev.pointerId);
      state.pad.drawing = { points: [padPoint(ev)], color: state.pad.color, width: state.pad.width };
      state.pad.strokes.push(state.pad.drawing);
      drawPad();
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (!state.pad.drawing) return;
      var pt = padPoint(ev);
      var pts = state.pad.drawing.points;
      var last = pts[pts.length - 1];
      if (Math.hypot(pt.x - last.x, pt.y - last.y) < 0.8) return;
      pts.push(pt);
      drawPad();
    });
    var finish = function () {
      if (!state.pad.drawing) return;
      if (state.pad.drawing.points.length < 2) state.pad.strokes = state.pad.strokes.filter(function (s) { return s !== state.pad.drawing; });
      state.pad.drawing = null;
      drawPad();
    };
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
  }

  function padHasInk() {
    return state.pad.strokes.some(function (s) { return s.points.length > 0; });
  }

  function padToImage() {
    var points = [];
    var maxWidth = 2;
    state.pad.strokes.forEach(function (s) {
      s.points.forEach(function (p) { points.push(p); });
      maxWidth = Math.max(maxWidth, s.width);
    });
    if (!points.length) return null;
    var b = E.strokeBounds(points, maxWidth);
    var scale = Math.max(2, Math.min(4, 1600 / Math.max(1, b.w)));
    var out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(b.w * scale));
    out.height = Math.max(1, Math.round(b.h * scale));
    var ctx = out.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, -b.x * scale, -b.y * scale);
    paintStrokes(ctx, state.pad.strokes);
    return { src: out.toDataURL('image/png'), aspect: b.w / Math.max(1, b.h) };
  }

  function insertSignature(src, aspect, at) {
    var el = addImageElement(src, { kind: 'signature', aspect: aspect, width: 150, x: at && at.x, y: at && at.y });
    if (el) toast('서명을 넣었습니다 · 드래그해서 위치를 옮기세요');
    return el;
  }

  function clearPad() {
    state.pad.strokes = [];
    state.pad.drawing = null;
    if (sigPad) { sigPad.clear(); updatePadHint(); return; }
    drawPad();
  }

  /* -------------------------------------------------------------------- seal */

  function renderSeal() {
    var canvas = $('#seal-canvas');
    if (!canvas) return;
    var res = 720;
    canvas.width = res;
    canvas.height = res;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, res, res);
    var layout = E.sealLayout(state.seal);
    var k = res / 1000;
    ctx.save();
    ctx.scale(k, k);
    ctx.strokeStyle = layout.ink;
    ctx.fillStyle = layout.ink;
    ctx.lineJoin = 'round';
    layout.marks.forEach(function (m) {
      if (m.kind === 'ring') {
        ctx.lineWidth = m.width;
        ctx.beginPath();
        ctx.arc(m.cx, m.cy, m.r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (m.kind === 'rect') {
        ctx.lineWidth = m.width;
        ctx.strokeRect(m.x, m.y, m.w, m.h);
      }
    });
    layout.glyphs.forEach(function (g) {
      ctx.save();
      ctx.translate(g.x, g.y);
      if (g.rot) ctx.rotate(g.rot * Math.PI / 180);
      ctx.font = g.size + 'px PSSNoto, "Noto Sans KR", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(g.ch, 0, g.size * 0.03);
      ctx.restore();
    });
    ctx.restore();
  }

  function sealToImage() {
    var canvas = $('#seal-canvas');
    return { src: canvas.toDataURL('image/png'), aspect: 1 };
  }

  function insertSeal(at) {
    var img = sealToImage();
    var el = addImageElement(img.src, { kind: 'seal', aspect: 1, width: 58, x: at && at.x, y: at && at.y });
    if (el) toast('도장을 넣었습니다');
    return el;
  }

  /* --------------------------------------------------------- saved library */

  function loadLibrary() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (data && data.signatures && data.seals) state.saved = data;
      }
    } catch (err) { /* private mode or corrupt data */ }
    renderSaved();
  }

  function persistLibrary() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.saved));
      return true;
    } catch (err) {
      toast('브라우저 저장 공간이 부족해 보관함에 저장하지 못했습니다', true);
      return false;
    }
  }

  function saveToLibrary(kind, src, aspect, label) {
    var list = kind === 'seal' ? state.saved.seals : state.saved.signatures;
    if (list.length >= 12) list.shift();
    list.push({ id: E.makeId('sv'), src: src, aspect: aspect, label: label || '', at: Date.now() });
    if (persistLibrary()) {
      renderSaved();
      toast(kind === 'seal' ? '도장을 보관함에 저장했습니다' : '서명을 보관함에 저장했습니다');
    }
  }

  function renderSaved() {
    var targets = [
      { node: $('#saved-signatures'), list: state.saved.signatures, kind: 'signature' },
      { node: $('#saved-seals'), list: state.saved.seals, kind: 'seal' },
      { node: $('#saved-all'), list: state.saved.signatures.concat(state.saved.seals), kind: 'mixed' },
    ];
    targets.forEach(function (t) {
      if (!t.node) return;
      t.node.innerHTML = '';
      if (!t.list.length) return;
      t.list.forEach(function (item) {
        var wrap = document.createElement('div');
        wrap.className = 'saved-item';
        var img = document.createElement('img');
        img.src = item.src;
        img.alt = item.label || '보관한 서명';
        wrap.appendChild(img);
        var use = document.createElement('button');
        use.className = 'use';
        use.type = 'button';
        use.title = '문서에 넣기';
        use.addEventListener('click', function () {
          var isSeal = item.id.indexOf('sv') === 0 && state.saved.seals.indexOf(item) >= 0;
          addImageElement(item.src, { kind: isSeal ? 'seal' : 'signature', aspect: item.aspect, width: isSeal ? 58 : 150 });
        });
        wrap.appendChild(use);
        var del = document.createElement('button');
        del.className = 'del';
        del.type = 'button';
        del.textContent = '✕';
        del.setAttribute('aria-label', '보관함에서 삭제');
        del.addEventListener('click', function (ev) {
          ev.stopPropagation();
          state.saved.signatures = state.saved.signatures.filter(function (s) { return s.id !== item.id; });
          state.saved.seals = state.saved.seals.filter(function (s) { return s.id !== item.id; });
          persistLibrary();
          renderSaved();
        });
        wrap.appendChild(del);
        t.node.appendChild(wrap);
      });
    });
  }

  /* ----------------------------------------------------------------- templates */

  function renderTemplateList() {
    var list = $('#template-list');
    list.innerHTML = '';
    E.TEMPLATES.forEach(function (tpl) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'tpl-card';
      card.dataset.template = tpl.id;
      var badge = tpl.badge ? '<em>' + tpl.badge + '</em>' : '';
      card.innerHTML = '<b>' + tpl.title + '</b>' + badge + '<span>' + tpl.desc + '</span>';
      card.addEventListener('click', function () { openTemplate(tpl.id); });
      list.appendChild(card);
    });
  }

  function openTemplate(id) {
    var tpl = E.getTemplate(id);
    if (!tpl) return;
    state.templateId = id;
    if (!state.templateValues[id]) state.templateValues[id] = E.templateDefaults(id);
    $$('.tpl-card').forEach(function (c) { c.classList.toggle('is-active', c.dataset.template === id); });
    $('#tpl-form').hidden = false;
    $('#tpl-form-title').textContent = tpl.title;
    buildTemplateFields(tpl);
    updateTodayLabel();
  }

  function buildTemplateFields(tpl) {
    var wrap = $('#tpl-fields');
    wrap.innerHTML = '';
    var values = state.templateValues[tpl.id];
    tpl.fields.forEach(function (f) {
      var label = document.createElement('label');
      label.className = 'field';
      var span = document.createElement('span');
      span.textContent = f.label;
      label.appendChild(span);
      var input;
      if (f.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = f.rows || 2;
        input.value = values[f.key] == null ? '' : values[f.key];
        input.placeholder = f.placeholder || '';
      } else if (f.type === 'select') {
        input = document.createElement('select');
        (f.options || []).forEach(function (opt) {
          var o = document.createElement('option');
          o.value = opt.value;
          o.textContent = opt.label;
          input.appendChild(o);
        });
        input.value = values[f.key] == null ? '' : values[f.key];
      } else {
        input = document.createElement('input');
        input.type = f.type === 'date' ? 'date' : f.type === 'number' ? 'text' : 'text';
        input.inputMode = f.type === 'number' ? 'numeric' : ' text';
        input.value = values[f.key] == null ? '' : values[f.key];
        input.placeholder = f.placeholder || '';
        if (f.type === 'date') input.placeholder = 'YYYY-MM-DD';
      }
      input.dataset.key = f.key;
      input.addEventListener('input', function () {
        values[f.key] = input.value;
        state.templateValues[tpl.id] = values;
        updateTemplateSummary(tpl);
      });
      input.addEventListener('change', function () {
        values[f.key] = input.value;
        updateTemplateSummary(tpl);
      });
      label.appendChild(input);
      wrap.appendChild(label);
    });
    updateTemplateSummary(tpl);
  }

  function updateTemplateSummary(tpl) {
    var node = $('#tpl-summary');
    if (!node) return;
    if (tpl.id !== 'statement') { node.textContent = ''; return; }
    var t = E.statementTotals(state.templateValues[tpl.id]);
    node.textContent = '공급가액 ' + E.formatMoney(t.supply) + ' · 부가세 ' + E.formatMoney(t.vat) + ' · 합계 ' + E.formatMoney(t.total);
  }

  function generateTemplate() {
    var tpl = E.getTemplate(state.templateId);
    if (!tpl) return;
    setBusy(true);
    var measure = null;
    ensurePdfLib().then(function () {
      return ensureFont();
    }).then(function () {
      return libs.pdfLib.PDFDocument.create();
    }).then(function (doc) {
      doc.registerFontkit(libs.fontkit);
      return doc.embedFont(state.fontBytes, { subset: false }).then(function (font) {
        measure = function (text, size) { return font.widthOfTextAtSize(text, size); };
        var model = E.buildTemplate(tpl.id, state.templateValues[tpl.id], { measure: measure });
        model.pages.forEach(function (pm) {
          var page = doc.addPage([model.pageW, model.pageH]);
          drawBlocks(page, pm.blocks, font, model.pageH, libs.pdfLib);
        });
        return doc.save();
      });
    }).then(function (bytes) {
      var title = tpl.title.replace(/\s*\(.*\)\s*/, '') + '_' + E.formatISODate(new Date());
      return openBytes(new Uint8Array(bytes), title, { source: 'template', templateId: tpl.id });
    }).then(function () {
      toast('PDF를 만들었습니다 · 서명·도장을 찍어 완성하세요');
    }).catch(function (err) {
      console.error(err);
      setBusy(false);
      toast('양식을 만들지 못했습니다: ' + (err && err.message ? err.message : '오류'), true);
    });
  }

  function drawBlocks(page, blocks, font, pageH, PDFLib) {
    var rgb = PDFLib.rgb;
    blocks.forEach(function (b) {
      if (b.type === 'text') {
        var size = b.size;
        var lh = size * (b.lineHeight || LINE_H);
        var lines = String(b.text).split('\n');
        lines.forEach(function (line, i) {
          if (!line) return;
          var width = font.widthOfTextAtSize(line, size);
          var x = b.x;
          if (b.align === 'center') x = b.x + (b.w - width) / 2;
          else if (b.align === 'right') x = b.x + b.w - width;
          var y = pageH - (b.y + ASCENT * size + i * lh);
          var color = hexToRgb(b.color || '#1a1c20');
          if (b.tracking) {
            var cx = x;
            Array.from(line).forEach(function (ch) {
              page.drawText(ch, { x: cx, y: y, size: size, font: font, color: rgb(color.r, color.g, color.b) });
              cx += font.widthOfTextAtSize(ch, size) + b.tracking;
            });
          } else {
            page.drawText(line, { x: x, y: y, size: size, font: font, color: rgb(color.r, color.g, color.b) });
          }
        });
      } else if (b.type === 'rule') {
        var c = hexToRgb(b.color || '#c9ccd1');
        page.drawLine({
          start: { x: b.x1, y: pageH - b.y1 },
          end: { x: b.x2, y: pageH - b.y2 },
          thickness: b.width || 0.8,
          color: rgb(c.r, c.g, c.b),
        });
      } else if (b.type === 'rect') {
        var y0 = pageH - (b.y + b.h);
        if (b.fill) {
          var f = hexToRgb(b.fill);
          page.drawRectangle({ x: b.x, y: y0, width: b.w, height: b.h, color: rgb(f.r, f.g, f.b) });
        }
        if (b.stroke) {
          var s = hexToRgb(b.stroke);
          page.drawRectangle({
            x: b.x, y: y0, width: b.w, height: b.h,
            borderColor: rgb(s.r, s.g, s.b), borderWidth: b.strokeWidth || 0.8,
          });
        }
      } else if (b.type === 'circle') {
        var cc = hexToRgb(b.stroke || '#c9ccd1');
        page.drawCircle({
          x: b.x + b.d / 2,
          y: pageH - (b.y + b.d / 2),
          size: b.d / 2,
          borderColor: rgb(cc.r, cc.g, cc.b),
          borderWidth: b.strokeWidth || 0.8,
        });
      }
    });
  }

  /* ------------------------------------------------------------------ export */

  function exportPdf() {
    if (!state.baseBytes) {
      toast('먼저 PDF를 열거나 양식을 만들어 주세요', true);
      openTool('file');
      return Promise.resolve(false);
    }
    var name = E.sanitizeFilename($('#export-name').value || state.docName || '서명문서');
    setBusy(true);
    var dropped = [];
    return ensurePdfLib().then(function () {
      return ensureFont().catch(function () { return null; });
    }).then(function () {
      var PDFLib = libs.pdfLib;
      var PDFDocument = PDFLib.PDFDocument;
      var degrees = PDFLib.degrees;
      var rgb = PDFLib.rgb;
      return PDFDocument.load(state.baseBytes.slice(0), { ignoreEncryption: true, updateMetadata: false }).then(function (doc) {
        var pages = doc.getPages();
        var textEls = state.elements.filter(function (e) { return e.kind === 'text' && String(e.text).trim(); });
        var fontPromise = Promise.resolve(null);
        var needsKorean = textEls.some(function (e) { return /[^\x20-\x7e\n]/.test(e.text); });
        if (needsKorean && !state.fontBytes) {
          throw new Error('한글 글꼴을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
        }
        if (textEls.length) {
          if (needsKorean && state.fontBytes) {
            doc.registerFontkit(libs.fontkit);
            fontPromise = doc.embedFont(state.fontBytes, { subset: false });
          } else {
            fontPromise = doc.embedFont(PDFLib.StandardFonts.Helvetica);
          }
        }
        return fontPromise.then(function (font) {
          var cache = new Map();
          var chain = Promise.resolve();
          state.elements.forEach(function (el) {
            chain = chain.then(function () {
              var pageModel = state.pages[el.page];
              var page = pages[el.page];
              if (!pageModel || !page) return null;
              if (el.kind === 'text') {
                if (!font) return null;
                var clean = sanitizeDrawText(el.text);
                if (clean.dropped.length) dropped = dropped.concat(clean.dropped);
                var lines = clean.text.split('\n');
                var lh = el.size * LINE_H;
                var boxH = lines.length * lh;
                var center = { x: el.x + el.w / 2, y: el.y + boxH / 2 };
                var total = E.elementTotalRotation(pageModel.rotate, el.rot || 0);
                var color = hexToRgb(el.color);
                lines.forEach(function (line, i) {
                  if (!line) return;
                  var lineWidth = font.widthOfTextAtSize(line, el.size);
                  var x = el.x;
                  if (el.align === 'center') x = el.x + (el.w - lineWidth) / 2;
                  else if (el.align === 'right') x = el.x + el.w - lineWidth;
                  var baselineY = el.y + i * lh + lh / 2 + ((ASCENT - DESCENT) / 2) * el.size;
                  var anchor = E.displayAnchorToPage(pageModel, { x: x, y: baselineY }, center, el.rot || 0);
                  page.drawText(line, {
                    x: anchor.x, y: anchor.y, size: el.size, font: font,
                    color: rgb(color.r, color.g, color.b),
                    rotate: degrees(total),
                    opacity: el.opacity == null ? 1 : el.opacity,
                  });
                });
                return null;
              }
              var key = el.src;
              var embedded = cache.get(key);
              var embed = embedded ? Promise.resolve(embedded) : (/^data:image\/jpe?g/i.test(el.src) ? doc.embedJpg(el.src) : doc.embedPng(el.src));
              return embed.then(function (image) {
                cache.set(key, image);
                var center2 = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
                var total2 = E.elementTotalRotation(pageModel.rotate, el.rot || 0);
                var anchor2 = E.displayAnchorToPage(pageModel, { x: el.x, y: el.y + el.h }, center2, el.rot || 0);
                page.drawImage(image, {
                  x: anchor2.x, y: anchor2.y, width: el.w, height: el.h,
                  rotate: degrees(total2),
                  opacity: el.opacity == null ? 1 : el.opacity,
                });
                return null;
              });
            });
          });
          return chain.then(function () { return doc.save(); });
        });
      });
    }).then(function (bytes) {
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), name + '.pdf');
      setBusy(false);
      if (dropped.length) toast('글꼴에 없는 글자(' + dropped.slice(0, 3).join(' ') + ')는 제외하고 저장했습니다', true);
      else toast(name + '.pdf 저장 완료 · ' + formatSize(bytes.byteLength));
      return { ok: true, size: bytes.byteLength, name: name + '.pdf' };
    }).catch(function (err) {
      console.error(err);
      setBusy(false);
      toast('PDF를 만들지 못했습니다: ' + (err && err.message ? err.message : '알 수 없는 오류'), true);
      return { ok: false, error: String(err && err.message || err) };
    });
  }

  /* ------------------------------------------------------------------ chrome */

  function updateChrome() {
    var docName = $('#doc-name');
    var docSub = $('#doc-sub');
    var pageIndicator = $('#page-indicator');
    if (state.pdfDoc) {
      docName.textContent = state.docName || '문서';
      var page = currentPageModel();
      var disp = page ? E.displaySize(page) : null;
      var sizeLabel = '';
      if (disp) {
        var mmW = Math.round(disp.w / E.PT_PER_MM);
        var mmH = Math.round(disp.h / E.PT_PER_MM);
        sizeLabel = (Math.abs(mmW - 210) < 3 && Math.abs(mmH - 297) < 3 ? 'A4' : mmW + '×' + mmH + 'mm');
      }
      docSub.textContent = sizeLabel + ' · ' + state.pages.length + '쪽 · ' +
        (state.docSource === 'template' ? '양식으로 생성' : state.docSource === 'sample' ? '샘플 문서' : '내 파일');
      pageIndicator.textContent = (state.pageIndex + 1) + ' / ' + state.pages.length;
    } else {
      docName.textContent = '문서 없음';
      docSub.textContent = 'PDF를 열거나 양식을 만들어 보세요';
      pageIndicator.textContent = '– / –';
    }
    $('#btn-prev').disabled = !state.pdfDoc || state.pageIndex === 0;
    $('#btn-next').disabled = !state.pdfDoc || state.pageIndex >= state.pages.length - 1;
    $('#btn-undo').disabled = !state.undo.length;
    $('#btn-redo').disabled = !state.redo.length;
    var summary = E.describeElements(state.elements);
    $('#foot-summary').textContent = state.elements.length ? summary : '';
    $('#foot-status').textContent = state.pdfDoc
      ? (state.elements.length ? '요소를 끌어 옮기고, 모서리로 크기를 조절하세요.' : '원하는 위치를 눌러 서명·도장·텍스트를 넣으세요.')
      : 'PDF를 열면 서명·도장을 바로 찍을 수 있어요.';
    if (state.pdfDoc) {
      var tip = state.tool === 'text' ? '문서를 클릭하면 그 자리에 텍스트가 들어갑니다.'
        : state.tool === 'signature' ? '서명을 그린 뒤 ‘서명 넣기’를 누르면 문서에 들어갑니다.'
        : state.tool === 'seal' ? '이름을 확인하고 ‘도장 넣기’를 누르면 문서에 들어갑니다.'
        : state.tool === 'form' ? '양식을 고르고 내용을 채우면 PDF가 바로 만들어집니다.'
        : 'PDF를 끌어다 놓거나 ‘파일 열기’로 바꿀 수 있습니다.';
      if (!state.elements.length || state.tool === 'text') $('#foot-status').textContent = tip;
    }
    $('#stage').classList.toggle('tool-text', state.tool === 'text' && !!state.pdfDoc);
    $('#page-shell').hidden = !state.pdfDoc;
    $('#empty-state').hidden = !!state.pdfDoc;
    updateInspector();
  }

  function updateInspector() {
    var el = selectedElement();
    $('#insp-empty').hidden = !!el;
    $('#insp-el').hidden = !el;
    if (!el) return;
    var kindLabel = { signature: '서명', seal: '직인', image: '이미지', text: '텍스트' }[el.kind] || '요소';
    $('#insp-kind').textContent = kindLabel;
    var isText = el.kind === 'text';
    $('#insp-text-row').hidden = !isText;
    if (isText && document.activeElement !== $('#insp-text')) $('#insp-text').value = el.text;
    var sizeInput = $('#insp-size');
    if (isText) {
      $('#insp-size-label').innerHTML = '크기 <b id="insp-size-val">' + Math.round(el.size * 10) / 10 + '</b>pt';
      sizeInput.min = '7';
      sizeInput.max = '48';
      sizeInput.step = '0.5';
      sizeInput.value = String(el.size);
    } else {
      var pct = Math.round((el.w / (el.w0 || el.w)) * 100);
      $('#insp-size-label').innerHTML = '크기 <b id="insp-size-val">' + pct + '</b>%';
      sizeInput.min = '20';
      sizeInput.max = '400';
      sizeInput.step = '1';
      sizeInput.value = String(pct);
    }
    $('#insp-opacity').value = String(Math.round((el.opacity == null ? 1 : el.opacity) * 100));
    $('#insp-opacity-val').textContent = $('#insp-opacity').value;
    $('#insp-rotate').value = String(Math.round(el.rot || 0));
    $('#insp-rotate-val').textContent = $('#insp-rotate').value;
    var colorSeg = $('#insp-color');
    colorSeg.style.display = isText ? '' : 'none';
    if (isText) {
      $$('.seg-btn', colorSeg).forEach(function (b) { b.classList.toggle('is-active', b.dataset.color === el.color); });
    }
  }

  function updateTodayLabel() {
    var node = $('#today-label');
    if (node) node.textContent = E.formatKoreanDate(new Date());
  }

  function openTool(tool) {
    state.tool = tool;
    $$('.tool-tab').forEach(function (tab) {
      var on = tab.dataset.tool === tool;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.tool-pane').forEach(function (pane) {
      var on = pane.id === 'pane-' + tool;
      pane.classList.toggle('is-active', on);
      pane.hidden = !on;
    });
    $$('.mob-btn[data-tool]').forEach(function (b) { b.classList.toggle('is-active', b.dataset.tool === tool); });
    if (tool === 'signature') setTimeout(resizePad, 30);
    updateChrome();
    if (isMobile()) openSheet('tools');
  }

  function openSheet(name) {
    if (!isMobile()) return;
    closeSheets();
    var panel = name === 'inspector' ? $('#inspector') : $('#tools-panel');
    if (!panel) return;
    panel.classList.add('is-open');
    $('#sheet-backdrop').hidden = false;
    $('#sheet-backdrop').classList.add('is-on');
    $$('.mob-btn').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.sheet === name || (name === 'tools' && b.dataset.tool === state.tool));
    });
    if (name === 'tools' && state.tool === 'signature') setTimeout(resizePad, 260);
  }

  function closeSheets() {
    $('#tools-panel').classList.remove('is-open');
    $('#inspector').classList.remove('is-open');
    var backdrop = $('#sheet-backdrop');
    backdrop.classList.remove('is-on');
    backdrop.hidden = true;
  }

  /* -------------------------------------------------------------------- bind */

  function bindTopbar() {
    $('#btn-download').addEventListener('click', exportPdf);
    $('#btn-export').addEventListener('click', exportPdf);
    $('#btn-theme').addEventListener('click', function () {
      var root = document.documentElement;
      var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem(THEME_KEY, next); } catch (err) { /* ignore */ }
    });
  }

  function bindTools() {
    $$('.tool-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { openTool(tab.dataset.tool); });
    });
    $$('.mob-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.sheet) {
          var panel = btn.dataset.sheet === 'inspector' ? $('#inspector') : $('#tools-panel');
          if (panel.classList.contains('is-open')) closeSheets();
          else openSheet(btn.dataset.sheet);
        } else if (btn.dataset.tool) {
          if (state.tool === btn.dataset.tool && $('#tools-panel').classList.contains('is-open')) closeSheets();
          else openTool(btn.dataset.tool);
        }
      });
    });
    $('#sheet-backdrop').addEventListener('click', closeSheets);
    $$('[data-sheet-close]').forEach(function (h) { h.addEventListener('click', closeSheets); });
  }

  function bindSignature() {
    bindSignaturePad();
    $$('#sig-color .seg-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.pad.color = btn.dataset.color;
        $$('#sig-color .seg-btn').forEach(function (b) { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        rebuildSignaturePad();
      });
    });
    $('#sig-width').addEventListener('input', function (ev) {
      state.pad.width = parseFloat(ev.target.value);
      rebuildSignaturePad();
    });
    $('#btn-sig-undo').addEventListener('click', function () {
      if (sigPad) {
        var data = sigPad.toData();
        if (!data.length) return;
        data.pop();
        try { sigPad.fromData(data, { clear: true }); } catch (e) { sigPad.clear(); }
        state.pad.strokes = strokesFromPad(data);
        updatePadHint();
        return;
      }
      if (!state.pad.strokes.length) return;
      state.pad.strokes.pop();
      drawPad();
    });
    $('#btn-sig-clear').addEventListener('click', clearPad);
    $('#btn-sig-insert').addEventListener('click', function () {
      var img = padToImage();
      if (!img) { toast('먼저 서명을 그려 주세요', true); return; }
      if (!state.pdfDoc) { openTool('file'); toast('먼저 PDF를 열어 주세요', true); return; }
      insertSignature(img.src, img.aspect);
      if (isMobile()) closeSheets();
    });
    $('#btn-sig-save').addEventListener('click', function () {
      var img = padToImage();
      if (!img) { toast('저장할 서명을 먼저 그려 주세요', true); return; }
      saveToLibrary('signature', img.src, img.aspect, '내 서명');
    });
    $('#sig-upload').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      readImageFile(file).then(function (img) {
        addImageElement(img.src, { kind: 'signature', aspect: img.aspect, width: 150 });
        toast('서명 이미지를 넣었습니다');
      }).catch(function () { toast('이미지를 읽지 못했습니다', true); });
    });
  }

  function readImageFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var image = new Image();
        image.onload = function () {
          var max = 1400;
          var ratio = Math.min(1, max / Math.max(image.width, image.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * ratio));
          canvas.height = Math.max(1, Math.round(image.height * ratio));
          var ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve({ src: canvas.toDataURL('image/png'), aspect: canvas.width / Math.max(1, canvas.height) });
        };
        image.onerror = reject;
        image.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function bindSeal() {
    var update = function () {
      state.seal.name = $('#seal-name').value;
      state.seal.org = $('#seal-org').value;
      state.seal.shape = $('#seal-shape').value;
      state.seal.orient = $('#seal-orient').value;
      state.seal.showIn = $('#seal-show-in').checked;
      renderSeal();
    };
    ['#seal-name', '#seal-org', '#seal-shape', '#seal-orient', '#seal-show-in'].forEach(function (sel) {
      $(sel).addEventListener('input', update);
      $(sel).addEventListener('change', update);
    });
    $$('#seal-color .seg-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.seal.ink = btn.dataset.color;
        $$('#seal-color .seg-btn').forEach(function (b) { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        renderSeal();
      });
    });
    $('#btn-seal-insert').addEventListener('click', function () {
      if (!state.pdfDoc) { openTool('file'); toast('먼저 PDF를 열어 주세요', true); return; }
      insertSeal();
      if (isMobile()) closeSheets();
    });
    $('#btn-seal-save').addEventListener('click', function () {
      var img = sealToImage();
      saveToLibrary('seal', img.src, 1, state.seal.name || '도장');
    });
    $('#seal-upload').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      readImageFile(file).then(function (img) {
        addImageElement(img.src, { kind: 'seal', aspect: img.aspect, width: 58 });
        toast('도장 이미지를 넣었습니다');
      }).catch(function () { toast('이미지를 읽지 못했습니다', true); });
    });
  }

  function bindText() {
    $('#text-size').addEventListener('input', function (ev) {
      state.text.size = parseFloat(ev.target.value);
      $('#text-size-val').textContent = String(Math.round(state.text.size * 10) / 10);
    });
    $$('#text-color .seg-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.text.color = btn.dataset.color;
        $$('#text-color .seg-btn').forEach(function (b) { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      });
    });
    $$('.quick').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var kind = btn.dataset.quick;
        if (!state.pdfDoc) { openTool('file'); toast('먼저 PDF를 열어 주세요', true); return; }
        if (kind === 'date') addTextElement(E.formatKoreanDate(new Date()), { size: 11 });
        else if (kind === 'check') addTextElement('✓', { size: 18 });
        else if (kind === 'name') addTextElement('성명: ', { size: 11 });
        else if (kind === 'in') addTextElement('(인)', { size: 11 });
        if (isMobile()) closeSheets();
      });
    });
    $('#btn-text-add').addEventListener('click', function () {
      var content = $('#text-content').value.trim();
      if (!state.pdfDoc) { openTool('file'); toast('먼저 PDF를 열어 주세요', true); return; }
      addTextElement(content || '텍스트', { size: state.text.size, color: state.text.color });
      if (isMobile()) closeSheets();
    });
  }

  function bindInspector() {
    $('#btn-el-delete').addEventListener('click', function () { if (state.selectedId) deleteElement(state.selectedId); });
    $('#btn-el-dup').addEventListener('click', duplicateElement);
    $('#insp-text').addEventListener('input', function (ev) {
      var el = selectedElement();
      if (!el || el.kind !== 'text') return;
      el.text = ev.target.value;
      resizeTextElement(el);
      applyElementStyle(el);
      updateChrome();
    });
    var sizeInput = $('#insp-size');
    sizeInput.addEventListener('input', function (ev) {
      var el = selectedElement();
      if (!el) return;
      var v = parseFloat(ev.target.value);
      if (el.kind === 'text') {
        el.size = v;
        resizeTextElement(el);
      } else {
        var f = v / 100;
        var aspect = (el.w0 / el.h0) || 1;
        el.w = Math.max(8, el.w0 * f);
        el.h = Math.max(8, el.w / aspect);
      }
      applyElementStyle(el);
      $('#insp-size-val').textContent = el.kind === 'text' ? String(v) : String(Math.round(v));
      updateChrome();
    });
    $('#insp-opacity').addEventListener('input', function (ev) {
      var el = selectedElement();
      if (!el) return;
      el.opacity = Math.max(0.1, parseFloat(ev.target.value) / 100);
      $('#insp-opacity-val').textContent = ev.target.value;
      applyElementStyle(el);
    });
    $('#insp-rotate').addEventListener('input', function (ev) {
      var el = selectedElement();
      if (!el) return;
      el.rot = parseFloat(ev.target.value);
      $('#insp-rotate-val').textContent = ev.target.value;
      applyElementStyle(el);
    });
    $$('#insp-color .seg-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var el = selectedElement();
        if (!el || el.kind !== 'text') return;
        el.color = btn.dataset.color;
        applyElementStyle(el);
        updateInspector();
      });
    });
    $('#btn-undo').addEventListener('click', undo);
    $('#btn-redo').addEventListener('click', redo);
  }

  function bindFiles() {
    var NOT_PDF = 'PDF 파일(.pdf)만 업로드할 수 있습니다.';
    var isPdf = function (file) {
      return !!file && (/pdf$/i.test(file.name) || file.type === 'application/pdf');
    };
    var hasFiles = function (ev) {
      var dt = ev.dataTransfer;
      if (!dt) return false;
      if (dt.types && Array.prototype.indexOf.call(dt.types, 'Files') !== -1) return true;
      return !!(dt.files && dt.files.length);
    };
    var handleFile = function (file) {
      if (!file) return;
      if (!isPdf(file)) {
        toast(NOT_PDF, true);
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        openBytes(new Uint8Array(reader.result), file.name.replace(/\.pdf$/i, ''), { source: 'file' })
          .then(function () { toast('PDF를 열었습니다 · 이 파일은 어디로도 전송되지 않았습니다'); })
          .catch(function () { /* handled in openBytes */ });
      };
      reader.readAsArrayBuffer(file);
    };
    ['#file-input', '#hero-file'].forEach(function (sel) {
      $(sel).addEventListener('change', function (ev) {
        var file = ev.target.files && ev.target.files[0];
        ev.target.value = '';
        handleFile(file);
      });
    });
    var dropHandled = false;
    $$('.dropzone, [data-drop], #stage').forEach(function (zone) {
      zone.addEventListener('dragover', function (ev) {
        if (!hasFiles(ev)) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'copy';
        zone.classList.add('is-over');
      });
      zone.addEventListener('dragleave', function () { zone.classList.remove('is-over'); });
      zone.addEventListener('drop', function (ev) {
        if (!hasFiles(ev)) return;
        ev.preventDefault();
        ev.stopPropagation();
        dropHandled = true;
        zone.classList.remove('is-over');
        var file = ev.dataTransfer.files && ev.dataTransfer.files[0];
        handleFile(file);
      });
    });
    /* 드롭존 바깥에 떨어뜨려도 브라우저가 파일을 열어 버리지 않게 막고, 같은 안내를 준다. */
    document.addEventListener('dragover', function (ev) {
      if (hasFiles(ev)) ev.preventDefault();
    });
    document.addEventListener('drop', function (ev) {
      if (!hasFiles(ev)) return;
      ev.preventDefault();
      if (dropHandled) { dropHandled = false; return; }
      var file = ev.dataTransfer.files && ev.dataTransfer.files[0];
      handleFile(file);
    });
    document.addEventListener('dragend', function () {
      $$('.dropzone').forEach(function (z) { z.classList.remove('is-over'); });
    });
    var openSample = function (kind) {
      setBusy(true);
      ensurePdfLib().then(ensureFont).then(function () {
        return libs.pdfLib.PDFDocument.create();
      }).then(function (doc) {
        doc.registerFontkit(libs.fontkit);
        return doc.embedFont(state.fontBytes, { subset: false }).then(function (font) {
          var tplId = kind === 'statement' ? 'statement' : kind === 'quote' ? 'quote' : 'service';
          var model = E.buildTemplate(tplId, {}, { measure: function (t, s) { return font.widthOfTextAtSize(t, s); } });
          model.pages.forEach(function (pm) {
            var page = doc.addPage([model.pageW, model.pageH]);
            drawBlocks(page, pm.blocks, font, model.pageH, libs.pdfLib);
          });
          return doc.save();
        });
      }).then(function (bytes) {
        var title = kind === 'statement' ? '샘플_거래명세서' : kind === 'quote' ? '샘플_견적서' : '샘플_용역계약서';
        return openBytes(new Uint8Array(bytes), title, { source: 'sample' });
      }).then(function () { toast('샘플 문서를 열었습니다'); })
        .catch(function (err) { console.error(err); setBusy(false); toast('샘플을 만들지 못했습니다', true); });
    };
    $('#btn-sample-contract').addEventListener('click', function () { openSample('contract'); if (isMobile()) closeSheets(); });
    $('#btn-sample-statement').addEventListener('click', function () { openSample('statement'); if (isMobile()) closeSheets(); });
    $('#btn-hero-contract').addEventListener('click', function () { openSample('contract'); });
    $('#btn-hero-statement').addEventListener('click', function () { openSample('statement'); });
    $('#btn-hero-quote').addEventListener('click', function () { openSample('quote'); });
    $('#btn-sample-quote').addEventListener('click', function () { openSample('quote'); if (isMobile()) closeSheets(); });
  }

  function bindTemplates() {
    renderTemplateList();
    $('#btn-tpl-close').addEventListener('click', function () {
      $('#tpl-form').hidden = true;
      state.templateId = null;
      $$('.tpl-card').forEach(function (c) { c.classList.remove('is-active'); });
    });
    $('#btn-tpl-reset').addEventListener('click', function () {
      if (!state.templateId) return;
      state.templateValues[state.templateId] = E.templateDefaults(state.templateId);
      buildTemplateFields(E.getTemplate(state.templateId));
      toast('샘플 값을 채웠습니다');
    });
    $('#btn-tpl-generate').addEventListener('click', generateTemplate);
  }

  function bindStageNav() {
    $('#btn-prev').addEventListener('click', function () {
      if (state.pageIndex > 0) { state.pageIndex--; state.selectedId = null; renderPage(true); updateChrome(); }
    });
    $('#btn-next').addEventListener('click', function () {
      if (state.pageIndex < state.pages.length - 1) { state.pageIndex++; state.selectedId = null; renderPage(true); updateChrome(); }
    });
    $('#btn-zoom-in').addEventListener('click', function () {
      state.zoom = Math.min(3, state.zoom * 1.2);
      renderPage(false);
    });
    $('#btn-zoom-out').addEventListener('click', function () {
      state.zoom = Math.max(0.35, state.zoom / 1.2);
      renderPage(false);
    });
    $('#btn-fit').addEventListener('click', function () {
      state.zoom = 1;
      renderPage(false);
    });
    var lastBox = '';
    var onResize = function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var stage = $('#stage');
        var key = stage.clientWidth + 'x' + stage.clientHeight;
        if (key === lastBox) return;
        lastBox = key;
        resizePad();
        if (state.pdfDoc) renderPage(false);
      }, 180);
    };
    window.addEventListener('resize', onResize);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(onResize);
      ro.observe($('#stage'));
    }
  }

  function bindKeyboard() {
    document.addEventListener('keydown', function (ev) {
      var tag = (ev.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || tag === 'select' || ev.target.isContentEditable;
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
        if (typing) return;
        ev.preventDefault();
        if (ev.shiftKey) redo(); else undo();
        return;
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') {
        if (typing) return;
        ev.preventDefault();
        redo();
        return;
      }
      if (typing) return;
      var el = selectedElement();
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && el) {
        ev.preventDefault();
        deleteElement(el.id);
        return;
      }
      if (ev.key === 'Escape') {
        select(null);
        closeSheets();
        return;
      }
      if (el && ev.key.indexOf('Arrow') === 0) {
        var step = ev.shiftKey ? 10 : 1;
        var disp = E.displaySize(currentPageModel());
        var dx = ev.key === 'ArrowLeft' ? -step : ev.key === 'ArrowRight' ? step : 0;
        var dy = ev.key === 'ArrowUp' ? -step : ev.key === 'ArrowDown' ? step : 0;
        if (dx === 0 && dy === 0) return;
        ev.preventDefault();
        var rect = E.clampRect({ x: el.x + dx, y: el.y + dy, w: el.w, h: el.h }, disp);
        el.x = rect.x; el.y = rect.y;
        applyElementStyle(el);
        updateChrome();
      }
    });
  }

  function bindTheme() {
    var stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch (err) { /* ignore */ }
    if (stored === 'dark' || stored === 'light') document.documentElement.dataset.theme = stored;
  }

  function monitorNetwork() {
    var badge = $('#net-badge');
    var update = function () {
      if (!badge) return;
      badge.textContent = state.external === 0 ? '외부 요청 0건' : '외부 요청 ' + state.external + '건';
      badge.style.color = state.external === 0 ? '' : 'var(--accent)';
    };
    update();
    if (!window.PerformanceObserver) return;
    try {
      var obs = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          try {
            var url = new URL(entry.name, location.href);
            if (url.origin !== location.origin) { state.external += 1; }
          } catch (err) { /* ignore */ }
        });
        update();
      });
      obs.observe({ type: 'resource', buffered: true });
    } catch (err) { /* older browsers */ }
  }

  /* -------------------------------------------------------------------- boot */

  function init() {
    bindTheme();
    bindTopbar();
    bindTools();
    bindSignature();
    bindSeal();
    bindText();
    bindInspector();
    bindFiles();
    bindTemplates();
    bindStage();
    bindStageNav();
    bindKeyboard();
    loadLibrary();
    updateTodayLabel();
    renderSeal();
    resizePad();
    updateChrome();
    monitorNetwork();
    if (isMobile()) closeSheets();
    if (location.protocol === 'file:') {
      setTimeout(function () {
        toast('파일을 직접 열면 브라우저 보안 때문에 글꼴·PDF 엔진을 읽지 못합니다. GitHub Pages 주소나 로컬 서버(http://)로 열어 주세요.', true);
      }, 900);
    }
    // Warm the renderer early so the first file opens instantly. The heavy
    // libraries and the Korean font are only fetched when a document needs them.
    setTimeout(function () { ensurePdfjs().catch(function () { /* ignore */ }); }, 400);
  }

  /* Test hooks: read-only views plus the entry points the UI itself uses. */
  window.__pss = {
    state: state,
    E: E,
    openBytes: openBytes,
    exportPdf: exportPdf,
    addTextElement: addTextElement,
    insertSignature: insertSignature,
    insertSeal: insertSeal,
    select: select,
    deleteElement: deleteElement,
    openTool: openTool,
    openSheet: openSheet,
    closeSheets: closeSheets,
    renderPage: renderPage,
    renderElements: renderElements,
    libs: libs,
    measureText: measureText,
    padToImage: padToImage,
    sealToImage: sealToImage,
    generateTemplate: generateTemplate,
    openTemplate: openTemplate,
    setTemplateValue: function (id, key, value) {
      state.templateValues[id] = state.templateValues[id] || E.templateDefaults(id);
      state.templateValues[id][key] = value;
    },
    ready: function () { return !state.busy; },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
