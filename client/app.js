// ═══════════════════════════════════════════════════════════
//  9Router Tools — Core App & State Module
// ═══════════════════════════════════════════════════════════

// Global state variables shared across modules
var profiles = [];
var activeProfile = null;
var baseConfig = null;     // Loaded from profile rootPath via API
var importConfig = null;   // From drag-and-drop/imported queue
var mergedConfig = null;
var accountsList = [];
var currentSortField = 'name';
var currentSortDirection = 'asc';
var settings = { retentionCount: 20, confirmBeforeWrite: true, serverPort: 3000, themeAccentColor: 'cyan' };
var DOM = {};
var _modalResolve = null;

document.addEventListener('DOMContentLoaded', async function () {
  cacheDOM();
  setupEventListeners();
  setupKeyboardShortcuts();
  setupHeaderCheckboxEvent();
  await checkServerStatus();
  await loadSettings();
  await loadProfiles();
});

// Cache essential DOM elements
function cacheDOM() {
  DOM.appLayout      = document.getElementById('appLayout');
  DOM.serverStatus   = document.getElementById('serverStatus');
  DOM.btnOpenSettings = document.getElementById('btnOpenSettings');
  DOM.profileList    = document.getElementById('profileList');
  DOM.sidebarEmpty   = document.getElementById('sidebarEmpty');
  DOM.btnCreate      = document.getElementById('btnCreateProfile');
  DOM.btnImportProfileBundle = document.getElementById('btnImportProfileBundle');
  DOM.importBundleFileInput = document.getElementById('importBundleFileInput');

  DOM.profileBar     = document.getElementById('profileBar');
  DOM.profileBarName = document.getElementById('profileBarName');
  DOM.profileBarPath = document.getElementById('profileBarPath');
  DOM.profileHealthDot  = document.getElementById('profileHealthDot');
  DOM.profileHealthText = document.getElementById('profileHealthText');
  DOM.btnCheckHealth = document.getElementById('btnCheckHealth');
  DOM.btnCopyProfilePath = document.getElementById('btnCopyProfilePath');
  DOM.btnOpenProfileFolder = document.getElementById('btnOpenProfileFolder');
  DOM.btnHeaderEditPath = document.getElementById('btnHeaderEditPath');
  DOM.btnExportProfileData = document.getElementById('btnExportProfileData');

  DOM.emptyNoProfile = document.getElementById('emptyStateNoProfile');
  DOM.emptyNoImport  = document.getElementById('emptyStateNoImport');

  DOM.importSection  = document.getElementById('importSection');
  DOM.importDropzone = document.getElementById('importDropzone');
  DOM.importFileInput= document.getElementById('importFileInput');
  DOM.importFileName = document.getElementById('importFileName');

  DOM.workspace      = document.getElementById('workspace');
  DOM.accountsTableBody = document.getElementById('accountsTableBody');
  DOM.exportProviderSelect = document.getElementById('exportProviderSelect');
  DOM.btnExportProvider = document.getElementById('btnExportProvider');
  DOM.updateCount    = document.getElementById('updateCount');
  DOM.newCount       = document.getElementById('newCount');
  DOM.mergeSummary   = document.getElementById('mergeSummary');

  DOM.downloadBtn    = document.getElementById('downloadBtn');
  DOM.saveDirectBtn  = document.getElementById('saveDirectBtn');

  DOM.btnManualAdd   = document.getElementById('btnManualAdd');
  DOM.btnAppendFile  = document.getElementById('btnAppendFile');
  DOM.btnPingTest    = document.getElementById('btnPingTest');
  DOM.btnResetQueue  = document.getElementById('btnResetQueue');

  DOM.consolePanel   = document.getElementById('consolePanel');
  DOM.consoleBody    = document.getElementById('consoleBody');
  DOM.clearLogsBtn   = document.getElementById('clearLogsBtn');
  DOM.toggleConsoleBtn = document.getElementById('toggleConsoleBtn');

  DOM.toastContainer = document.getElementById('toastContainer');
  DOM.modalOverlay   = document.getElementById('modalOverlay');
  DOM.modalHeader    = document.getElementById('modalHeader');
  DOM.modalBody      = document.getElementById('modalBody');
  DOM.modalFooter    = document.getElementById('modalFooter');
  DOM.modalCloseBtn  = document.getElementById('modalCloseBtn');

  DOM.filterBtns     = document.querySelectorAll('.filter-btn');

  // Side Panel Elements
  DOM.rightPanel     = document.getElementById('rightPanel');
  DOM.tabBtnBackups  = document.getElementById('tabBtnBackups');
  DOM.tabBtnHistory  = document.getElementById('tabBtnHistory');
  DOM.backupsTab     = document.getElementById('backupsTab');
  DOM.historyTab     = document.getElementById('historyTab');
  DOM.backupList     = document.getElementById('backupList');
  DOM.historyList     = document.getElementById('historyList');
}

// Bind core event listeners
function setupEventListeners() {
  DOM.btnCreate.addEventListener('click', showCreateProfileModal);

  DOM.btnImportProfileBundle.addEventListener('click', function () {
    DOM.importBundleFileInput.click();
  });
  DOM.importBundleFileInput.addEventListener('change', function (e) {
    if (e.target.files.length > 0) {
      handleImportBundleFile(e.target.files[0]);
    }
  });

  DOM.btnOpenSettings.addEventListener('click', showSettingsModal);

  setupDragAndDrop(DOM.importDropzone, DOM.importFileInput, handleImportFile);

  DOM.profileList.addEventListener('dragover', function (e) {
    e.preventDefault();
    DOM.profileList.classList.add('dragover');
  });
  DOM.profileList.addEventListener('dragleave', function () {
    DOM.profileList.classList.remove('dragover');
  });
  DOM.profileList.addEventListener('drop', function (e) {
    e.preventDefault();
    DOM.profileList.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      var file = e.dataTransfer.files[0];
      if (file.name.endsWith('.9rtbundle')) {
        handleImportBundleFile(file);
      } else {
        showToast('Khu vực này chỉ chấp nhận file .9rtbundle!', 'warning');
      }
    }
  });

  DOM.filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      DOM.filterBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      renderAccountCards();
    });
  });

  DOM.downloadBtn.addEventListener('click', downloadMergedConfig);
  DOM.saveDirectBtn.addEventListener('click', saveConfigDirectly);
  DOM.btnExportProvider.addEventListener('click', exportProviderConnections);
  DOM.clearLogsBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    DOM.consoleBody.innerHTML = '';
  });

  DOM.btnCheckHealth.addEventListener('click', function () {
    if (activeProfile) {
      checkProfileHealth(activeProfile.id);
      showToast('Đang quét lại file cấu hình...', 'info');
    }
  });

  DOM.btnCopyProfilePath.addEventListener('click', function () {
    if (activeProfile) {
      navigator.clipboard.writeText(activeProfile.rootPath).then(function () {
        showToast('Đã copy đường dẫn cấu hình!', 'success');
        log('Sao chép đường dẫn file cấu hình vào clipboard.', 'info');
      }).catch(function () {
        showToast('Sao chép thất bại!', 'error');
      });
    }
  });

  DOM.btnOpenProfileFolder.addEventListener('click', async function () {
    if (activeProfile) {
      try {
        var res = await fetch('/api/system/open-folder?path=' + encodeURIComponent(activeProfile.rootPath));
        if (res.ok) {
          showToast('Đã mở thư mục chứa file cấu hình!', 'success');
          log('Mở thư mục chứa file cấu hình của profile "' + activeProfile.name + '".', 'info');
        } else {
          var errData = await res.json();
          showToast('Lỗi mở thư mục: ' + errData.error, 'error');
        }
      } catch (e) {
        showToast('Lỗi kết nối server!', 'error');
      }
    }
  });

  DOM.btnHeaderEditPath.addEventListener('click', function () {
    if (activeProfile) {
      showEditProfileModal(activeProfile.id);
    }
  });

  DOM.btnExportProfileData.addEventListener('click', function () {
    if (baseConfig && activeProfile) {
      var blob = new Blob([JSON.stringify(baseConfig, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = activeProfile.name.replace(/\s+/g, '_') + '_data.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      log('Đã export dữ liệu file cấu hình của profile "' + activeProfile.name + '".', 'success');
      showToast('Đã export dữ liệu cấu hình!', 'success');
    }
  });

  DOM.btnManualAdd.addEventListener('click', showManualAddModal);
  DOM.btnAppendFile.addEventListener('click', function () {
    if (DOM.importFileInput) {
      DOM.importFileInput.click();
    }
  });
  DOM.btnPingTest.addEventListener('click', runPingTest);
  DOM.btnResetQueue.addEventListener('click', resetImportQueue);

  document.getElementById('consoleHeader').addEventListener('click', function () {
    DOM.consolePanel.classList.toggle('collapsed');
  });

  DOM.modalCloseBtn.addEventListener('click', hideModal);
  DOM.modalOverlay.addEventListener('click', function (e) {
    if (e.target === DOM.modalOverlay) hideModal();
  });

  DOM.tabBtnBackups.addEventListener('click', function () {
    switchTab('backups');
  });
  DOM.tabBtnHistory.addEventListener('click', function () {
    switchTab('history');
  });

  var thName = document.getElementById('thAccountName');
  if (thName) thName.addEventListener('click', function () { handleHeaderSort('name'); });

  var thPriority = document.getElementById('thPriority');
  if (thPriority) thPriority.addEventListener('click', function () { handleHeaderSort('priority'); });

  var thStatus = document.getElementById('thStatus');
  if (thStatus) thStatus.addEventListener('click', function () { handleHeaderSort('status'); });
}

// ─── LOGGING & STATUS ───
function log(msg, type) {
  type = type || 'info';
  var line = document.createElement('div');
  line.className = 'log-line ' + type;
  var time = new Date().toLocaleTimeString();
  line.textContent = '[' + time + '] ' + msg;
  DOM.consoleBody.appendChild(line);
  DOM.consoleBody.scrollTop = DOM.consoleBody.scrollHeight;
}

async function checkServerStatus() {
  try {
    var res = await fetch('/api/status');
    if (res.ok) {
      DOM.serverStatus.className = 'server-status online';
      DOM.serverStatus.querySelector('.status-text').textContent = 'Backend Active';
      log('Đã kết nối với Local Server Backend.', 'success');
      return true;
    }
  } catch (err) {
    // ignore
  }
  DOM.serverStatus.className = 'server-status offline';
  DOM.serverStatus.querySelector('.status-text').textContent = 'Backend Offline';
  log('Không tìm thấy Local Backend. Một số chức năng sẽ bị giới hạn.', 'warning');
  return false;
}

// ─── PROFILE CRUD & METADATA ───
async function loadProfiles() {
  try {
    var res = await fetch('/api/profiles');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    profiles = data.profiles || [];
    renderProfileList();

    if (profiles.length > 0) {
      var lastId = null;
      try {
        var stateRes = await fetch('/api/state/last-opened');
        if (stateRes.ok) {
          var stateData = await stateRes.json();
          lastId = stateData.profileId;
        }
      } catch (e) { /* ignore */ }

      var target = lastId ? profiles.find(function (p) { return p.id === lastId; }) : null;
      if (target) {
        await selectProfile(target.id);
      } else {
        await selectProfile(profiles[0].id);
      }
    }
    log('Đã tải ' + profiles.length + ' profile(s).', 'system');
  } catch (err) {
    log('Không thể tải danh sách profiles: ' + err.message, 'error');
  }
}

async function createProfile(name, rootPath, dataType) {
  try {
    var res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, rootPath: rootPath, dataType: dataType || 'account-config' })
    });
    if (!res.ok) {
      var errData = await res.json().catch(function () { return {}; });
      throw new Error(errData.error || 'HTTP ' + res.status);
    }
    var data = await res.json();
    showToast('Đã tạo profile "' + name + '" thành công!', 'success');
    log('Tạo profile mới: ' + name, 'success');
    await loadProfiles();
    if (data.profile && data.profile.id) {
      await selectProfile(data.profile.id);
    }
  } catch (err) {
    showToast('Lỗi tạo profile: ' + err.message, 'error');
    log('Lỗi tạo profile: ' + err.message, 'error');
  }
}

async function selectProfile(id) {
  var profile = profiles.find(function (p) { return p.id === id; });
  if (!profile) return;

  activeProfile = profile;

  try {
    await fetch('/api/state/last-opened', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: id })
    });
  } catch (e) { /* ignore */ }

  var savedImport = localStorage.getItem('importConfig_' + profile.id);
  if (savedImport) {
    try {
      importConfig = JSON.parse(savedImport);
      DOM.importFileName.textContent = 'Đã lưu (' + (importConfig.providerConnections || []).length + ' tài khoản)';
    } catch (e) {
      localStorage.removeItem('importConfig_' + profile.id);
      importConfig = null;
    }
  } else {
    importConfig = null;
    DOM.importFileName.textContent = 'Chưa chọn tệp';
  }
  mergedConfig = null;
  accountsList = [];

  renderProfileList();
  showProfileBar(profile);
  DOM.emptyNoProfile.classList.add('hidden');
  DOM.workspace.classList.add('hidden');

  DOM.rightPanel.classList.remove('hidden');
  DOM.appLayout.classList.remove('no-panel');

  await loadRootConfig(profile.id);
  checkProfileHealth(profile.id);

  if (importConfig && importConfig.providerConnections && importConfig.providerConnections.length > 0) {
    DOM.importSection.classList.add('hidden');
    DOM.emptyNoImport.classList.add('hidden');
    triggerMerge();
  } else {
    DOM.importSection.classList.remove('hidden');
    DOM.emptyNoImport.classList.remove('hidden');
  }

  loadBackups(profile.id);
  loadHistory();

  log('Đã chọn profile: ' + profile.name, 'system');
}

async function deleteProfile(id) {
  var profile = profiles.find(function (p) { return p.id === id; });
  if (!profile) return;

  var confirmed = await showConfirmModal(
    'Xóa Profile',
    'Bạn có chắc muốn xóa profile "' + profile.name + '"? Thao tác này không thể hoàn tác.'
  );
  if (!confirmed) return;

  try {
    var res = await fetch('/api/profiles/' + id, { method: 'DELETE' });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    showToast('Đã xóa profile "' + profile.name + '"', 'info');
    log('Đã xóa profile: ' + profile.name, 'warning');

    if (activeProfile && activeProfile.id === id) {
      activeProfile = null;
      baseConfig = null;
      importConfig = null;
      mergedConfig = null;
      resetMainArea();
    }

    await loadProfiles();
  } catch (err) {
    showToast('Lỗi xóa profile: ' + err.message, 'error');
    log('Lỗi xóa profile: ' + err.message, 'error');
  }
}

// ─── SIDEBAR RENDERING ───
function renderProfileList() {
  DOM.profileList.innerHTML = '';
  if (profiles.length === 0) {
    DOM.sidebarEmpty.classList.remove('hidden');
    return;
  }
  DOM.sidebarEmpty.classList.add('hidden');
  profiles.forEach(function (profile) {
    var card = renderProfileCard(profile);
    DOM.profileList.appendChild(card);
  });
}

function renderProfileCard(profile) {
  var card = document.createElement('div');
  card.className = 'profile-card';
  if (activeProfile && activeProfile.id === profile.id) {
    card.className += ' active';
  }
  card.dataset.id = profile.id;

  var isHealthy = profile.healthy !== false;
  var healthStatusClass = profile.healthy === true ? 'healthy' : (profile.healthy === false ? 'broken' : 'unknown');
  
  var statusIconSVG = '';
  if (profile.healthy === true) {
    statusIconSVG = '<svg class="icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  } else if (profile.healthy === false) {
    statusIconSVG = '<svg class="icon danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  } else {
    statusIconSVG = '<svg class="icon warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  }

  var displayPath = profile.rootPath || '—';
  if (displayPath.length > 30) {
    displayPath = displayPath.substr(0, 12) + '...' + displayPath.substr(displayPath.length - 15);
  }

  var lastWriteText = profile.lastWriteAt ? relativeTime(profile.lastWriteAt) : 'Chưa ghi';
  var backupCountText = profile.backupCount !== undefined ? profile.backupCount + ' backups' : '— backups';
  var lastWriteSummary = profile.lastWriteSummary || '';

  card.innerHTML =
    '<div class="profile-card-t1">' +
      '<div style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' +
        statusIconSVG +
        '<span class="profile-card-title-text" title="' + escapeHTML(profile.name) + '">' + escapeHTML(profile.name) + '</span>' +
      '</div>' +
      '<span class="data-type-badge">' + escapeHTML(profile.dataType) + '</span>' +
    '</div>' +
    '<div class="profile-card-t2" title="' + escapeHTML(profile.rootPath) + '">' +
      '<span>Ghi đè: ' + lastWriteText + '</span>' +
      '<span>' + escapeHTML(displayPath) + '</span>' +
    '</div>' +
    '<div class="profile-card-t3">' +
      '<span class="chip-item">' + backupCountText + '</span>' +
      '<span class="chip-item">' + (lastWriteSummary ? 'Đã ghi' : 'Sẵn sàng') + '</span>' +
      '<span class="pill-status ' + healthStatusClass + '">' +
        (profile.healthy === true
          ? '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:10px; height:10px; margin-right:4px; vertical-align: middle;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Healthy'
          : (profile.healthy === false
              ? '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:10px; height:10px; margin-right:4px; vertical-align: middle;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Broken'
              : '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:10px; height:10px; margin-right:4px; vertical-align: middle;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Unknown'
            )
        ) +
      '</span>' +
    '</div>' +
    '<div class="profile-card-hover-actions">' +
      '<button class="btn-more" title="Tác vụ khác">⋮</button>' +
      '<div class="profile-card-dropdown">' +
        '<div class="dropdown-item" data-action="detail"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> Chi tiết Profile</div>' +
        '<div class="dropdown-item" data-action="edit"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Chỉnh sửa</div>' +
        '<div class="dropdown-item" data-action="export"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Xuất gói (.9rtbundle)</div>' +
        '<div class="dropdown-item" data-action="backups"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> Xem bản sao lưu</div>' +
        '<div class="dropdown-item" data-action="history"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Xem lịch sử</div>' +
        '<div class="dropdown-item danger" data-action="delete"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Xoá Profile</div>' +
      '</div>' +
    '</div>';

  var btnMore = card.querySelector('.btn-more');
  var dropdown = card.querySelector('.profile-card-dropdown');
  btnMore.addEventListener('click', function (e) {
    e.stopPropagation();
    document.querySelectorAll('.profile-card-dropdown.active').forEach(function (d) {
      if (d !== dropdown) d.classList.remove('active');
    });
    dropdown.classList.toggle('active');
  });

  dropdown.addEventListener('click', function (e) {
    e.stopPropagation();
    var action = e.target.dataset.action;
    if (!action) return;

    dropdown.classList.remove('active');

    if (action === 'detail') {
      showProfileDetailModal(profile.id);
    } else if (action === 'edit') {
      showEditProfileModal(profile.id);
    } else if (action === 'export') {
      exportProfileBundle(profile.id);
    } else if (action === 'backups') {
      selectProfile(profile.id);
      switchTab('backups');
    } else if (action === 'history') {
      selectProfile(profile.id);
      switchTab('history');
    } else if (action === 'delete') {
      deleteProfile(profile.id);
    }
  });

  document.addEventListener('click', function () {
    dropdown.classList.remove('active');
  });

  var titleText = card.querySelector('.profile-card-title-text');
  titleText.addEventListener('click', function (e) {
    e.stopPropagation();
    showProfileDetailModal(profile.id);
  });

  card.addEventListener('click', function (e) {
    if (e.target.closest('.profile-card-hover-actions') || e.target === titleText) return;
    selectProfile(profile.id);
  });

  return card;
}

async function loadRootConfig(profileId) {
  try {
    log('Đang tải cấu hình gốc từ server...', 'system');
    var res = await fetch('/api/profiles/' + profileId + '/root-content');
    if (!res.ok) {
      var errData = await res.json().catch(function () { return {}; });
      throw new Error(errData.error || 'HTTP ' + res.status);
    }
    var data = await res.json();
    baseConfig = data.config;
    log('Đã tải cấu hình gốc thành công. (' + (data.config.providerConnections || []).length + ' connections)', 'success');
  } catch (err) {
    baseConfig = null;
    log('Lỗi tải cấu hình gốc: ' + err.message, 'error');
    showToast('Không thể tải cấu hình gốc: ' + err.message, 'error');
  }
}

function showProfileBar(profile) {
  DOM.profileBar.classList.remove('hidden');
  DOM.profileBarName.textContent = profile.name;
  DOM.profileBarPath.textContent = profile.rootPath || '—';
}

async function checkProfileHealth(profileId) {
  try {
    var res = await fetch('/api/profiles/' + profileId + '/health');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    var healthy = data.healthy;

    DOM.profileHealthDot.className = 'health-dot ' + (healthy ? 'healthy' : 'broken');
    DOM.profileHealthText.textContent = healthy ? 'File OK' : 'File không tìm thấy';

    var p = profiles.find(function (pp) { return pp.id === profileId; });
    if (p) p.healthy = healthy;

    renderProfileList();
  } catch (err) {
    DOM.profileHealthDot.className = 'health-dot broken';
    DOM.profileHealthText.textContent = 'Không thể kiểm tra';
  }
}

function resetMainArea() {
  DOM.profileBar.classList.add('hidden');
  DOM.importSection.classList.add('hidden');
  DOM.workspace.classList.add('hidden');
  DOM.emptyNoImport.classList.add('hidden');
  DOM.emptyNoProfile.classList.remove('hidden');
  DOM.rightPanel.classList.add('hidden');
  DOM.appLayout.classList.add('no-panel');
}

// ─── POPUP/MODAL TEMPLATES ───
function showProfileDetailModal(profileId) {
  var p = profiles.find(function (x) { return x.id === profileId; });
  if (!p) return;

  var displayNote = p.note ? escapeHTML(p.note) : '<span style="color: var(--text-secondary); font-style: italic">Không có ghi chú</span>';
  
  var bodyHTML =
    '<div style="display: flex; flex-direction: column; gap: 15px; font-size: 13px; text-align: left;">' +
      '<div>' +
        '<span style="font-weight: bold; color: var(--text-secondary);">Tên Profile:</span>' +
        '<div style="font-size: 15px; font-weight: 600; margin-top: 4px;">' + escapeHTML(p.name) + '</div>' +
      '</div>' +
      '<div>' +
        '<span style="font-weight: bold; color: var(--text-secondary);">Đường dẫn gốc:</span>' +
        '<div style="font-family: \'JetBrains Mono\', monospace; font-size: 11px; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); word-break: break-all; margin-top: 4px;">' + escapeHTML(p.rootPath) + '</div>' +
      '</div>' +
      '<div>' +
        '<span style="font-weight: bold; color: var(--text-secondary);">Ghi chú:</span>' +
        '<div style="margin-top: 4px; line-height: 1.5; white-space: pre-wrap;">' + displayNote + '</div>' +
      '</div>' +
      '<div>' +
        '<span style="font-weight: bold; color: var(--text-secondary);">Thông tin thêm:</span>' +
        '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px;">' +
          '<div>Ngày tạo: ' + new Date(p.createdAt).toLocaleDateString('vi-VN') + '</div>' +
          '<div>Trạng thái: ' + (p.healthy ? 'Tệp cấu hình hợp lệ' : 'Lỗi/Không tìm thấy') + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  showModal('Chi tiết Profile', bodyHTML, [
    { label: 'Chỉnh sửa', value: 'edit', className: 'btn btn-primary btn-sm' },
    { label: 'Xuất Gói (.9rtbundle)', value: 'export', className: 'btn btn-secondary btn-sm' },
    { label: 'Đóng', value: 'close', className: 'btn btn-secondary btn-sm' }
  ]).then(function (result) {
    if (result === 'edit') {
      showEditProfileModal(profileId);
    } else if (result === 'export') {
      exportProfileBundle(profileId);
    }
  });
}

function showModal(title, bodyHTML, buttons) {
  return new Promise(function (resolve) {
    _modalResolve = resolve;

    DOM.modalHeader.querySelector('h3').textContent = title;
    DOM.modalBody.innerHTML = bodyHTML;
    DOM.modalFooter.innerHTML = '';

    buttons.forEach(function (btn) {
      var el = document.createElement('button');
      el.className = btn.className || 'btn btn-secondary btn-sm';
      el.textContent = btn.label;
      el.addEventListener('click', function () {
        var val = btn.value;
        _modalResolve = null;
        hideModal();
        resolve(val);
      });
      DOM.modalFooter.appendChild(el);
    });

    DOM.modalOverlay.classList.remove('hidden');
  });
}

function showConfirmModal(title, message) {
  return showModal(
    title,
    '<p>' + escapeHTML(message) + '</p>',
    [
      { label: 'Hủy', value: false, className: 'btn btn-secondary btn-sm' },
      { label: 'Xác nhận', value: true, className: 'btn btn-danger btn-sm' }
    ]
  );
}

function showCreateProfileModal() {
  var bodyHTML =
    '<div class="form-group">' +
      '<label>Tên Profile</label>' +
      '<input type="text" id="modalInputName" placeholder="VD: VT Account Main">' +
    '</div>' +
    '<div class="form-group">' +
      '<label>Đường dẫn thư mục gốc (Root Path)</label>' +
      '<div style="display: flex; gap: 8px;">' +
        '<input type="text" id="modalInputPath" placeholder="VD: C:\\Users\\Admin\\Downloads\\dung-9Router.json" style="flex: 1; font-family: \'JetBrains Mono\', monospace; font-size: 12px;">' +
        '<button class="btn btn-secondary btn-sm" id="btnSelectNewPath" style="padding: 0 12px; font-size: 12px; white-space: nowrap;">Chọn tệp...</button>' +
      '</div>' +
    '</div>' +
    '<div class="form-group">' +
      '<label>Loại dữ liệu</label>' +
      '<select id="modalInputType">' +
        '<option value="account-config" selected>Account Config</option>' +
        '<option value="proxy-config">Proxy Config</option>' +
        '<option value="other">Khác</option>' +
      '</select>' +
    '</div>';

  var promise = showModal('Tạo Profile mới', bodyHTML, [
    { label: 'Hủy', value: 'cancel', className: 'btn btn-secondary btn-sm' },
    { label: 'Tạo Profile', value: 'create', className: 'btn btn-primary btn-sm' }
  ]);

  setupModalPathEvents('modalInputPath', 'btnSelectNewPath');

  promise.then(function (result) {
    if (result !== 'create') return;

    var name = document.getElementById('modalInputName').value.trim();
    var rootPath = document.getElementById('modalInputPath').value.trim();
    var dataType = document.getElementById('modalInputType').value;

    if (!name) {
      showToast('Vui lòng nhập tên profile!', 'warning');
      return;
    }
    if (!rootPath) {
      showToast('Vui lòng nhập đường dẫn root path!', 'warning');
      return;
    }

    createProfile(name, rootPath, dataType);
  });
}

function hideModal() {
  DOM.modalOverlay.classList.add('hidden');
  if (_modalResolve) {
    _modalResolve(null);
    _modalResolve = null;
  }
}

function showToast(message, type, duration) {
  type = type || 'info';
  duration = duration || 4000;

  var svgs = {
    success: '<svg class="icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg class="icon danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg class="icon warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg class="icon info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent-cyan);"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML =
    '<span class="toast-icon">' + (svgs[type] || svgs.info) + '</span>' +
    '<span>' + escapeHTML(message) + '</span>';

  DOM.toastContainer.appendChild(toast);

  setTimeout(function () {
    toast.classList.add('removing');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}

function escapeHTML(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function relativeTime(isoString) {
  if (!isoString) return '';
  var now = Date.now();
  var then = new Date(isoString).getTime();
  var diffMs = now - then;
  var diffSec = Math.floor(diffMs / 1000);
  var diffMin = Math.floor(diffSec / 60);
  var diffHr = Math.floor(diffMin / 60);
  var diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Vừa xong';
  if (diffMin < 60) return diffMin + ' phút trước';
  if (diffHr < 24) return diffHr + ' giờ trước';
  if (diffDay === 1) return 'Hôm qua';
  if (diffDay < 7) return diffDay + ' ngày trước';
  return new Date(isoString).toLocaleDateString('vi-VN');
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      if (DOM.importFileInput) {
        DOM.importFileInput.click();
      }
    }
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      if (!DOM.modalOverlay.classList.contains('hidden')) {
        var primaryBtn = DOM.modalFooter.querySelector('.btn-primary, .btn-danger');
        if (primaryBtn) {
          primaryBtn.click();
        }
      } else {
        saveConfigDirectly();
      }
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      var searchInput = document.getElementById('accountSearchInput');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
    if (e.key === 'Escape') {
      if (!DOM.modalOverlay.classList.contains('hidden')) {
        hideModal();
      }
      document.querySelectorAll('.profile-card-dropdown.active, .row-actions-dropdown.active').forEach(function (d) {
        d.classList.remove('active');
      });
    }
    if (!e.ctrlKey && !e.altKey && !e.metaKey && /^[1-9]$/.test(e.key)) {
      var activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.contentEditable === 'true')) {
        return;
      }
      var index = parseInt(e.key, 10) - 1;
      if (profiles && profiles[index]) {
        e.preventDefault();
        selectProfile(profiles[index].id);
      }
    }
  });
}
