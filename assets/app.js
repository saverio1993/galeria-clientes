/* ============================================
   Galería de selección — lógica
   - Carga images/manifest.json
   - Renderiza grid, maneja selección (3-5)
   - Lightbox con teclado + táctil
   - Modal nombre → mailto: con selección
   ============================================ */

(() => {
  'use strict';

  // ---------- Config (viene de config.js) ----------
  const cfg = Object.assign(
    {
      brandName: 'Galería',
      introTitle: 'Elige tus favoritas',
      receiverEmail: 'tu-correo@ejemplo.com',
      minSelections: 3,
      maxSelections: 5,
      subjectPrefix: 'Selección de fotos',
      galleryNote: '',
    },
    window.GALLERY_CONFIG || {}
  );

  // ---------- Estado ----------
  const state = {
    images: [],          // ["IMG_001.jpg", ...]
    selected: new Set(), // nombres seleccionados
    lightboxIndex: -1,
  };

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);
  const els = {
    gallery: $('gallery'),
    empty: $('emptyState'),
    count: $('galleryCount'),
    selectedCount: $('selectedCount'),
    selectedMax: $('selectedMax'),
    sendBtn: $('sendBtn'),
    actionBar: $('actionBar'),
    statusIcon: document.querySelector('.status-icon'),
    brand: $('brandName'),
    introTitle: $('introTitle'),
    minCount: $('minCount'),
    maxCount: $('maxCount'),
    lightbox: $('lightbox'),
    lbImg: $('lbImg'),
    lbCounter: $('lbCounter'),
    lbLike: $('lbLike'),
    lbClose: $('lbClose'),
    lbPrev: $('lbPrev'),
    lbNext: $('lbNext'),
    lbFigure: document.querySelector('.lb-figure'),
    lbHint: document.querySelector('.lb-hint'),
    modal: $('modal'),
    modalSummary: $('modalSummary'),
    form: $('submitForm'),
    nameInput: $('clientName'),
    toast: $('toast'),
  };

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    // Texto dinámico
    els.brand.textContent = cfg.brandName;
    els.introTitle.textContent = cfg.introTitle;
    els.minCount.textContent = cfg.minSelections;
    els.maxCount.textContent = cfg.maxSelections;
    els.selectedMax.textContent = cfg.maxSelections;
    document.title = `${cfg.brandName} · Selección de fotos`;

    // Listeners
    els.sendBtn.addEventListener('click', openSendModal);
    els.lbClose.addEventListener('click', closeLightbox);
    els.lbPrev.addEventListener('click', () => navigateLightbox(-1));
    els.lbNext.addEventListener('click', () => navigateLightbox(1));
    els.lbLike.addEventListener('click', () => toggleLightboxLike());
    els.lbImg.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLightboxActual();
    });
    els.lightbox.addEventListener('click', (e) => {
      if (e.target === els.lightbox) closeLightbox();
    });
    els.form.addEventListener('submit', onSubmit);
    els.modal.addEventListener('click', (e) => {
      if (e.target.dataset.close !== undefined || e.target.closest('[data-close]')) {
        closeModal();
      }
    });

    document.addEventListener('keydown', onKeydown);
    window.addEventListener('resize', () => {
      // re-sincroniza el aspect-ratio visual si hace falta
    });

    // Cargar manifiesto
    try {
      const resp = await fetch('images/manifest.json', { cache: 'no-cache' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      state.images = Array.isArray(data.images) ? data.images : [];
    } catch (err) {
      console.warn('No se pudo cargar manifest.json:', err);
      state.images = [];
    }

    if (state.images.length === 0) {
      els.empty.hidden = false;
      els.gallery.hidden = true;
      els.count.textContent = '0 fotos';
      els.actionBar.classList.add('is-hidden');
      return;
    }

    els.empty.hidden = true;
    els.gallery.hidden = false;
    els.count.textContent = `${state.images.length} ${state.images.length === 1 ? 'foto' : 'fotos'}`;
    renderGallery();
    updateActionBar();
  }

  // ---------- Render grid ----------
  function renderGallery() {
    const frag = document.createDocumentFragment();
    state.images.forEach((name, idx) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'tile';
      tile.dataset.index = String(idx);
      tile.dataset.name = name;
      tile.setAttribute('aria-label', `Ver foto ${idx + 1} de ${state.images.length}: ${name}`);

      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = `images/${encodeURIComponent(name)}`;
      img.alt = `Foto ${idx + 1}`;
      img.draggable = false;
      img.oncontextmenu = (e) => e.preventDefault();

      const likeBtn = document.createElement('button');
      likeBtn.type = 'button';
      likeBtn.className = 'btn-like';
      likeBtn.setAttribute('aria-label', 'Marcar como favorita');
      likeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>
        </svg>`;
      likeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSelection(name, likeBtn);
      });

      const num = document.createElement('span');
      num.className = 'tile-num';
      num.textContent = '1';

      tile.appendChild(img);
      tile.appendChild(likeBtn);
      tile.appendChild(num);
      tile.addEventListener('click', () => openLightbox(idx));

      frag.appendChild(tile);
    });
    els.gallery.replaceChildren(frag);
  }

  // ---------- Selección ----------
  function toggleSelection(name, btn) {
    if (state.selected.has(name)) {
      state.selected.delete(name);
    } else {
      if (state.selected.size >= cfg.maxSelections) {
        showToast(`Máximo ${cfg.maxSelections} favoritas. Quita una para añadir otra.`);
        return;
      }
      state.selected.add(name);
    }
    syncSelectionUI(name, btn);
    updateActionBar();
  }

  function syncSelectionUI(name, sourceBtn) {
    const tiles = els.gallery.querySelectorAll('.tile');
    const ordered = [...state.selected];
    tiles.forEach((tile) => {
      const tName = tile.dataset.name;
      const isSel = state.selected.has(tName);
      tile.classList.toggle('is-selected', isSel);
      const btn = tile.querySelector('.btn-like');
      btn.classList.toggle('is-active', isSel);
      btn.setAttribute('aria-pressed', String(isSel));
      const num = tile.querySelector('.tile-num');
      const pos = ordered.indexOf(tName);
      if (pos >= 0) num.textContent = String(pos + 1);
    });

    // sincroniza lightbox si está abierto
    if (state.lightboxIndex >= 0) {
      const currentName = state.images[state.lightboxIndex];
      els.lbLike.classList.toggle('is-active', state.selected.has(currentName));
      els.lbLike.setAttribute('aria-pressed', String(state.selected.has(currentName)));
    }

    // evita warning de variable no usada
    void sourceBtn;
  }

  function updateActionBar() {
    const n = state.selected.size;
    els.selectedCount.textContent = String(n);
    const ready = n >= cfg.minSelections && n <= cfg.maxSelections;
    els.sendBtn.disabled = !ready;

    if (els.statusIcon) {
      els.statusIcon.classList.toggle('is-active', n > 0);
      // reemplazar el corazón textual por SVG cuando esté activo
      if (n > 0 && !els.statusIcon.querySelector('svg')) {
        els.statusIcon.innerHTML = `
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>
          </svg>`;
      } else if (n === 0 && !els.statusIcon.dataset.restored) {
        els.statusIcon.textContent = '♡';
        els.statusIcon.dataset.restored = '1';
      }
    }
  }

  // ---------- Lightbox ----------
  function openLightbox(idx) {
    if (idx < 0 || idx >= state.images.length) return;
    state.lightboxIndex = idx;
    setLightboxActual(false);
    const name = state.images[idx];
    els.lbImg.src = `images/${encodeURIComponent(name)}`;
    els.lbImg.alt = `Foto ${idx + 1}`;
    els.lbCounter.textContent = `${idx + 1} / ${state.images.length}`;
    els.lbLike.classList.toggle('is-active', state.selected.has(name));
    els.lbLike.setAttribute('aria-pressed', String(state.selected.has(name)));
    els.lightbox.hidden = false;
    els.lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    els.lbClose.focus();
  }

  function closeLightbox() {
    els.lightbox.hidden = true;
    els.lightbox.setAttribute('aria-hidden', 'true');
    els.lbImg.src = '';
    setLightboxActual(false);
    document.body.style.overflow = '';
    state.lightboxIndex = -1;
  }

  function setLightboxActual(on) {
    els.lbFigure.classList.toggle('is-actual', on);
    els.lbImg.title = on ? 'Click para ajustar a pantalla' : 'Click para ver al tamaño real';
  }

  function toggleLightboxActual() {
    if (state.lightboxIndex < 0) return;
    const isActual = els.lbFigure.classList.contains('is-actual');
    setLightboxActual(!isActual);
    // al pasar a 100%, scroll al inicio de la imagen
    if (!isActual) {
      els.lbFigure.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }

  function navigateLightbox(delta) {
    if (state.lightboxIndex < 0) return;
    const n = state.images.length;
    const next = (state.lightboxIndex + delta + n) % n;
    openLightbox(next);
  }

  function toggleLightboxLike() {
    if (state.lightboxIndex < 0) return;
    const name = state.images[state.lightboxIndex];
    if (state.selected.has(name)) {
      state.selected.delete(name);
    } else {
      if (state.selected.size >= cfg.maxSelections) {
        showToast(`Máximo ${cfg.maxSelections} favoritas. Quita una para añadir otra.`);
        return;
      }
      state.selected.add(name);
    }
    syncSelectionUI(name);
    updateActionBar();
  }

  // ---------- Modal + mailto ----------
  function openSendModal() {
    if (state.selected.size < cfg.minSelections) return;
    const list = [...state.selected].map((n, i) => `${i + 1}. ${n}`).join('\n');
    els.modalSummary.innerHTML = `
      <strong>${state.selected.size} favorita${state.selected.size === 1 ? '' : 's'}:</strong><br>
      <span style="white-space:pre-line;font-variant-numeric:tabular-nums;">${escapeHtml(list)}</span>
    `;
    els.modal.hidden = false;
    els.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => els.nameInput.focus(), 80);
  }

  function closeModal() {
    els.modal.hidden = true;
    els.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    els.form.reset();
  }

  function onSubmit(e) {
    e.preventDefault();
    const name = els.nameInput.value.trim();
    if (!name) {
      els.nameInput.focus();
      showToast('Escribe tu nombre para continuar.');
      return;
    }
    if (state.selected.size < cfg.minSelections || state.selected.size > cfg.maxSelections) {
      showToast(`Selecciona entre ${cfg.minSelections} y ${cfg.maxSelections} fotos.`);
      return;
    }
    sendViaMailto(name);
  }

  function sendViaMailto(clientName) {
    const selected = [...state.selected];
    const date = new Date().toLocaleString('es-PA', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });

    const subject = `${cfg.subjectPrefix} — ${clientName} (${selected.length})`;

    const bodyLines = [
      `Hola,`,
      ``,
      `Mi nombre es ${clientName} y estas son mis fotos favoritas de la galería.`,
      ``,
      `Fecha: ${date}`,
      `Total elegidas: ${selected.length} de ${state.images.length}`,
      ``,
      `--- MIS FAVORITAS ---`,
      ...selected.map((n, i) => `${i + 1}. ${n}`),
      ``,
      `Imagen en la galería:`,
      `${location.origin}${location.pathname}`,
      ``,
      cfg.galleryNote ? `Nota: ${cfg.galleryNote}` : ``,
      `Saludos,`,
      `${clientName}`,
    ].filter(Boolean);

    const mailto = `mailto:${encodeURIComponent(cfg.receiverEmail)}`
      + `?subject=${encodeURIComponent(subject)}`
      + `&body=${encodeURIComponent(bodyLines.join('\n'))}`;

    // Mostrar confirmación antes de abrir el cliente de correo
    showToast('Abriendo tu aplicación de correo… revisa que el mensaje esté listo y envíalo.');
    closeModal();

    // pequeño delay para que el toast se vea antes de que el SO cambie de foco
    setTimeout(() => {
      window.location.href = mailto;
    }, 350);
  }

  // ---------- Helpers ----------
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(msg, ms = 3200) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    requestAnimationFrame(() => els.toast.classList.add('is-visible'));
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      els.toast.classList.remove('is-visible');
      setTimeout(() => { els.toast.hidden = true; }, 260);
    }, ms);
  }

  function onKeydown(e) {
    if (els.modal.hidden === false) {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
      return;
    }
    if (els.lightbox.hidden === false) {
      if (e.key === 'Escape')      { e.preventDefault(); closeLightbox(); }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); navigateLightbox(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); navigateLightbox(1); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleLightboxLike(); }
    }
  }

  // ---------- Swipe táctil en lightbox ----------
  (() => {
    let startX = 0, startY = 0, dx = 0, dy = 0, active = false;
    const TH = 50; // umbral en px

    els.lightbox.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      active = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dx = 0; dy = 0;
    }, { passive: true });

    els.lightbox.addEventListener('touchmove', (e) => {
      if (!active) return;
      dx = e.touches[0].clientX - startX;
      dy = e.touches[0].clientY - startY;
    }, { passive: true });

    els.lightbox.addEventListener('touchend', () => {
      if (!active) return;
      active = false;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > TH) {
        navigateLightbox(dx > 0 ? -1 : 1);
      } else if (dy > TH * 2 && Math.abs(dx) < TH) {
        closeLightbox();
      }
    });
  })();
})();
