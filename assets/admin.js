/* ============================================================
   Admin · lógica
   - Login con GitHub PAT (validado contra /user)
   - Listar / borrar / subir fotos vía GitHub Contents API
   - Regenera images/manifest.json tras cada cambio
   ============================================================ */

(() => {
  'use strict';

  // ---------- Config ----------
  const cfg = Object.assign(
    {
      brandName: 'Galería',
      repo: { owner: 'saverio1993', repo: 'galeria-clientes', branch: 'main' },
      adminPassword: '',         // opcional, NO recomendado en producción
      maxFileSizeMB: 25,
    },
    window.GALLERY_CONFIG || {}
  );

  const TOKEN_KEY = 'gc_admin_token';
  const USER_KEY = 'gc_admin_user';

  // ---------- State ----------
  const state = {
    token: localStorage.getItem(TOKEN_KEY) || '',
    user: null,
    images: [], // [{name, sha, size, url}]
    uploading: false,
  };

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);
  const els = {
    loginScreen: $('loginScreen'),
    adminPanel: $('adminPanel'),
    loginForm: $('loginForm'),
    tokenInput: $('tokenInput'),
    rememberToken: $('rememberToken'),
    loginError: $('loginError'),
    loginBtn: $('loginBtn'),
    brandName: $('brandName'),
    loginRepoName: $('loginRepoName'),
    adminUser: $('adminUser'),
    logoutBtn: $('logoutBtn'),
    refreshBtn: $('refreshBtn'),
    adminGallery: $('adminGallery'),
    photoCount: $('photoCount'),
    emptyHint: $('emptyHint'),
    dropZone: $('dropZone'),
    fileInput: $('fileInput'),
    uploadPreview: $('uploadPreview'),
    uploadList: $('uploadList'),
    uploadBtn: $('uploadBtn'),
    uploadCount: $('uploadCount'),
    clearBtn: $('clearBtn'),
    uploadProgress: $('uploadProgress'),
    uploadProgressBar: $('uploadProgressBar'),
    uploadProgressLabel: $('uploadProgressLabel'),
    publicLink: $('publicLink'),
    copyLinkBtn: $('copyLinkBtn'),
    confirmModal: $('confirmModal'),
    confirmOk: $('confirmOk'),
    toast: $('toast'),
  };

  const apiBase = `https://api.github.com/repos/${cfg.repo.owner}/${cfg.repo.repo}`;
  const publicUrl = `https://${cfg.repo.owner}.github.io/${cfg.repo.repo}/`;

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    els.brandName.textContent = cfg.brandName;
    els.loginRepoName.textContent = `${cfg.repo.owner}/${cfg.repo.repo}`;
    els.publicLink.value = publicUrl;
    document.title = `Admin · ${cfg.brandName}`;

    // Listeners
    els.loginForm.addEventListener('submit', onLogin);
    els.logoutBtn.addEventListener('click', logout);
    els.refreshBtn.addEventListener('click', loadGallery);
    els.uploadBtn.addEventListener('click', onUpload);
    els.clearBtn.addEventListener('click', clearQueue);
    els.copyLinkBtn.addEventListener('click', copyPublicLink);
    els.confirmOk.addEventListener('click', () => confirmAction && confirmAction());
    els.confirmModal.addEventListener('click', (e) => {
      if (e.target.dataset.close !== undefined) closeConfirm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.confirmModal.hidden) closeConfirm();
    });

    // Drag & drop
    ['dragenter', 'dragover'].forEach((ev) =>
      els.dropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        els.dropZone.classList.add('is-dragover');
      })
    );
    ['dragleave', 'drop'].forEach((ev) =>
      els.dropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        els.dropZone.classList.remove('is-dragover');
      })
    );
    els.dropZone.addEventListener('drop', (e) => {
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length) enqueueFiles(files);
    });
    els.dropZone.addEventListener('click', () => els.fileInput.click());
    els.fileInput.addEventListener('change', () => {
      enqueueFiles([...els.fileInput.files]);
      els.fileInput.value = '';
    });

    // Restore saved token (silently validate)
    const savedUser = localStorage.getItem(USER_KEY);
    if (state.token) {
      els.tokenInput.value = state.token;
      if (savedUser) {
        try { state.user = JSON.parse(savedUser); } catch (_) {}
      }
      showPanel();
      try {
        await validateToken();
        await loadGallery();
      } catch (e) {
        // token inválido/expirado
        logout();
        showError('Tu token expiró o fue revocado. Vuelve a ingresarlo.');
      }
    }
  }

  // ---------- Auth ----------
  async function onLogin(e) {
    e.preventDefault();
    hideError();
    const tok = els.tokenInput.value.trim();
    if (!tok) return showError('Pega tu token de GitHub.');
    state.token = tok;
    els.loginBtn.disabled = true;
    els.loginBtn.innerHTML = '<span>Validando…</span>';
    try {
      await validateToken();
      if (els.rememberToken.checked) {
        localStorage.setItem(TOKEN_KEY, state.token);
        localStorage.setItem(USER_KEY, JSON.stringify(state.user));
      } else {
        sessionStorage.setItem(TOKEN_KEY, state.token);
      }
      showPanel();
      await loadGallery();
    } catch (err) {
      state.token = '';
      showError(err.message || 'Token inválido.');
    } finally {
      els.loginBtn.disabled = false;
      els.loginBtn.innerHTML =
        '<span>Entrar</span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
    }
  }

  async function validateToken() {
    const r = await ghFetch('https://api.github.com/user');
    state.user = { login: r.login, avatar: r.avatar_url, name: r.name };
    if (els.adminUser) {
      els.adminUser.textContent = state.user.name || state.user.login;
      els.adminUser.title = `${state.user.login} · conectado a GitHub`;
    }
  }

  function logout() {
    state.token = '';
    state.user = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    els.tokenInput.value = '';
    els.adminPanel.hidden = true;
    els.loginScreen.hidden = false;
  }

  // ---------- Gallery ----------
  async function loadGallery() {
    try {
      const data = await ghFetch(`/contents/images?ref=${cfg.repo.branch}&per_page=100`);
      const images = data
        .filter((f) => f.type === 'file' && /\.(jpe?g|png|webp)$/i.test(f.name))
        .map((f) => ({
          name: f.name,
          sha: f.sha,
          size: f.size,
          url: f.download_url,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      state.images = images;
      renderGallery();
    } catch (err) {
      showToast('No pude cargar las fotos: ' + err.message);
    }
  }

  function renderGallery() {
    els.photoCount.textContent = state.images.length;
    els.emptyHint.hidden = state.images.length > 0;

    if (state.images.length === 0) {
      els.adminGallery.replaceChildren();
      return;
    }

    const frag = document.createDocumentFragment();
    for (const img of state.images) {
      const tile = document.createElement('div');
      tile.className = 'admin-tile';

      const image = document.createElement('img');
      image.loading = 'lazy';
      image.src = `images/${encodeURIComponent(img.name)}?v=${img.sha.slice(0, 7)}`;
      image.alt = img.name;
      image.draggable = false;

      const name = document.createElement('div');
      name.className = 'admin-tile-name';
      name.textContent = img.name;

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'admin-tile-del';
      del.setAttribute('aria-label', `Borrar ${img.name}`);
      del.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      del.addEventListener('click', () => askDelete(img));

      tile.append(image, name, del);
      frag.append(tile);
    }
    els.adminGallery.replaceChildren(frag);
  }

  // ---------- Delete ----------
  let confirmAction = null;

  function askDelete(img) {
    els.confirmModal.querySelector('#confirmText').textContent =
      `Vas a borrar "${img.name}". La galería pública se actualizará en ~30 segundos.`;
    els.confirmModal.hidden = false;
    confirmAction = async () => {
      closeConfirm();
      try {
        await deleteImage(img);
        showToast(`"${img.name}" borrada.`);
        await loadGallery();
      } catch (e) {
        showToast('Error al borrar: ' + e.message);
      }
    };
  }

  function closeConfirm() {
    els.confirmModal.hidden = true;
    confirmAction = null;
  }

  async function deleteImage(img) {
    const r = await ghFetch(`/contents/images/${encodeURIComponent(img.name)}?ref=${cfg.repo.branch}`, {
      method: 'DELETE',
      body: { message: `admin: borrar ${img.name}`, sha: img.sha, branch: cfg.repo.branch },
    });
    // regenerar manifest excluyendo el nombre recién borrado (GitHub puede aún
    // devolverlo en el listado por caching — confiamos en la intención local).
    await regenerateManifest({ removed: [img.name] });
    return r;
  }

  // ---------- Upload ----------
  const queue = []; // [{file, status, id}]

  function enqueueFiles(files) {
    const accepted = files.filter((f) => {
      if (!/^image\/(jpe?g|png|webp)$/i.test(f.type)) {
        showToast(`"${f.name}" no es JPG/PNG/WEBP. Usa subir.bat para ARW.`);
        return false;
      }
      const max = cfg.maxFileSizeMB * 1024 * 1024;
      if (f.size > max) {
        showToast(`"${f.name}" excede ${cfg.maxFileSizeMB}MB (tiene ${(f.size / 1024 / 1024).toFixed(1)}MB).`);
        return false;
      }
      return true;
    });
    if (accepted.length === 0) return;
    for (const f of accepted) {
      queue.push({ file: f, status: 'pending', id: crypto.randomUUID() });
    }
    renderQueue();
    els.uploadPreview.hidden = false;
  }

  function renderQueue() {
    const frag = document.createDocumentFragment();
    for (const item of queue) {
      const card = document.createElement('div');
      card.className = 'upload-item';
      card.dataset.id = item.id;

      const img = document.createElement('img');
      img.src = URL.createObjectURL(item.file);
      img.alt = item.file.name;
      img.onload = () => URL.revokeObjectURL(img.src);

      const name = document.createElement('div');
      name.className = 'upload-item-name';
      name.textContent = item.file.name;

      const status = document.createElement('div');
      status.className = 'upload-item-status';
      status.textContent = statusIcon(item.status);

      card.append(img, name, status);
      frag.append(card);
    }
    els.uploadList.replaceChildren(frag);

    const pending = queue.filter((q) => q.status === 'pending' || q.status === 'error').length;
    const total = queue.length;
    els.uploadCount.textContent = String(total);
    els.uploadBtn.disabled = state.uploading || pending === 0;
    els.uploadBtn.querySelector('span').firstChild.textContent = total > 0 ? 'Subir ' : '';
  }

  function statusIcon(s) {
    if (s === 'done') return '✓';
    if (s === 'error') return '!';
    if (s === 'uploading') return '…';
    return '+';
  }

  function clearQueue() {
    queue.length = 0;
    els.uploadPreview.hidden = true;
    els.uploadList.replaceChildren();
    els.uploadProgress.hidden = true;
    renderQueue();
  }

  async function onUpload() {
    if (state.uploading) return;
    const toUpload = queue.filter((q) => q.status === 'pending' || q.status === 'error');
    if (toUpload.length === 0) return;
    state.uploading = true;
    els.uploadProgress.hidden = false;
    els.uploadBtn.disabled = true;

    let done = 0;
    let failed = 0;
    const total = toUpload.length;

    updateProgress(done, total);
    for (const item of toUpload) {
      item.status = 'uploading';
      setItemStatus(item);
      try {
        await uploadOne(item.file);
        item.status = 'done';
        done++;
      } catch (e) {
        console.error(e);
        item.status = 'error';
        failed++;
      }
      setItemStatus(item);
      updateProgress(done, total);
    }

    state.uploading = false;
    els.uploadBtn.disabled = false;

    const successfulNames = queue
      .filter((q) => q.status === 'done')
      .map((q) => q.file.name);

    try {
      await regenerateManifest({ added: successfulNames });
    } catch (e) {
      console.warn('manifest no regenerado:', e);
    }
    await loadGallery();

    if (failed === 0) {
      showToast(`Listo: ${done} foto(s) subidas. Galería actualizada.`);
      clearQueue();
    } else {
      showToast(`Subidas ${done}, fallaron ${failed}. Las marcadas con ! puedes reintentar.`);
    }
  }

  async function uploadOne(file) {
    const path = `images/${file.name}`;
    const content = await fileToBase64(file);
    const r = await ghFetch(`/contents/${encodeURIComponent(path)}`, {
      method: 'PUT',
      body: {
        message: `admin: subir ${file.name}`,
        content,
        branch: cfg.repo.branch,
      },
    });
    return r;
  }

  async function regenerateManifest({ added = [], removed = [] } = {}) {
    const data = await ghFetch(`/contents/images?ref=${cfg.repo.branch}&per_page=100`);
    const fromApi = data
      .filter((f) => f.type === 'file' && /\.(jpe?g|png|webp)$/i.test(f.name))
      .map((f) => f.name);
    // GitHub a veces no refleja cambios inmediatamente — mergeamos con la
    // intención local (añadidos / quitados) para evitar drift.
    const names = Array.from(new Set([...fromApi, ...added]))
      .filter((n) => !removed.includes(n))
      .sort();
    const manifestSha = data.find((f) => f.type === 'file' && f.name === 'manifest.json')?.sha;
    const body = {
      message: `admin: regenerar manifest (${names.length} fotos)`,
      content: btoa(unescape(encodeURIComponent(JSON.stringify({ images: names }, null, 2)))),
      branch: cfg.repo.branch,
    };
    if (manifestSha) body.sha = manifestSha;
    await ghFetch('/contents/images/manifest.json', { method: 'PUT', body });
  }

  function setItemStatus(item) {
    const card = els.uploadList.querySelector(`[data-id="${item.id}"] .upload-item-status`);
    if (!card) return;
    card.textContent = statusIcon(item.status);
    card.className = `upload-item-status is-${item.status}`;
  }

  function updateProgress(done, total) {
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    els.uploadProgressBar.style.width = pct + '%';
    els.uploadProgressLabel.textContent = `${done} / ${total}`;
  }

  // ---------- GitHub fetch helper ----------
  async function ghFetch(path, opts = {}) {
    const url = path.startsWith('http') ? path : apiBase + path;
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${state.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    };
    const init = { method: opts.method || 'GET', headers };
    if (opts.body !== undefined) {
      if (opts.body instanceof Uint8Array) {
        init.body = opts.body;
      } else {
        init.body = JSON.stringify(opts.body);
        headers['Content-Type'] = 'application/json';
      }
    }

    const r = await fetch(url, init);
    if (r.status === 204) return null;
    const text = await r.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { message: text }; }

    if (!r.ok) {
      const msg = data?.message || `HTTP ${r.status}`;
      if (r.status === 401) throw new Error('Token inválido o sin permisos.');
      if (r.status === 403 && /rate limit/i.test(msg)) {
        throw new Error('Rate limit de GitHub alcanzado. Espera unos minutos.');
      }
      if (r.status === 404 && opts.method === 'DELETE') {
        throw new Error('Archivo ya no existe.');
      }
      throw new Error(msg);
    }
    return data;
  }

  // ---------- Utils ----------
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        // result = "data:image/jpeg;base64,/9j/4AAQ..."
        const b64 = String(result).split(',', 2)[1];
        resolve(b64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function showPanel() {
    els.loginScreen.hidden = true;
    els.adminPanel.hidden = false;
  }

  function showError(msg) {
    els.loginError.textContent = msg;
    els.loginError.hidden = false;
  }
  function hideError() { els.loginError.hidden = true; }

  function showToast(msg, ms = 3500) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    requestAnimationFrame(() => els.toast.classList.add('is-visible'));
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      els.toast.classList.remove('is-visible');
      setTimeout(() => { els.toast.hidden = true; }, 260);
    }, ms);
  }

  async function copyPublicLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      showToast('Link copiado al portapapeles');
    } catch (_) {
      els.publicLink.select();
      document.execCommand('copy');
      showToast('Link copiado');
    }
  }
})();
