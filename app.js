// ═══════════════════════════════════════════════════════════
//  9Router Tools — Phase 0+1 Frontend
//  Vanilla JS, no frameworks, no bundlers
// ═══════════════════════════════════════════════════════════

// ═══ STATE ═══
var profiles = [];
var activeProfile = null;
var baseConfig = null;     // Tải từ profile rootPath qua API
var importConfig = null;   // Từ file kéo thả
var mergedConfig = null;
var accountsList = [];
var settings = { retentionCount: 20, confirmBeforeWrite: true, serverPort: 3000, themeAccentColor: 'cyan' };

// ═══ DOM CACHE ═══
var DOM = {};

document.addEventListener('DOMContentLoaded', async function () {
  cacheDOM();
  setupEventListeners();
  setupKeyboardShortcuts();
  setupHeaderCheckboxEvent();
  await checkServerStatus();
  await loadSettings();
  await loadProfiles();
});

// ─── Cache tất cả element quan trọng ───
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

// ─── Gắn event listeners ───
function setupEventListeners() {
  // Tạo profile
  DOM.btnCreate.addEventListener('click', showCreateProfileModal);

  // Import profile bundle button
  DOM.btnImportProfileBundle.addEventListener('click', function () {
    DOM.importBundleFileInput.click();
  });
  DOM.importBundleFileInput.addEventListener('change', function (e) {
    if (e.target.files.length > 0) {
      handleImportBundleFile(e.target.files[0]);
    }
  });

  // Settings
  DOM.btnOpenSettings.addEventListener('click', showSettingsModal);

  // Import dropzone
  setupDragAndDrop(DOM.importDropzone, DOM.importFileInput, handleImportFile);

  // Drag and drop bundle file in sidebar
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

  // Filter buttons
  DOM.filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      DOM.filterBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      renderAccountCards();
    });
  });

  // Action buttons
  DOM.downloadBtn.addEventListener('click', downloadMergedConfig);
  DOM.saveDirectBtn.addEventListener('click', saveConfigDirectly);
  DOM.btnExportProvider.addEventListener('click', exportProviderConnections);
  DOM.clearLogsBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    DOM.consoleBody.innerHTML = '';
  });

  // Additional action toolbar buttons
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

  // Collapsible logs console header click or button click
  document.getElementById('consoleHeader').addEventListener('click', function () {
    DOM.consolePanel.classList.toggle('collapsed');
  });

  // Modal close
  DOM.modalCloseBtn.addEventListener('click', hideModal);
  DOM.modalOverlay.addEventListener('click', function (e) {
    if (e.target === DOM.modalOverlay) hideModal();
  });

  // Right sidebar tab switching
  DOM.tabBtnBackups.addEventListener('click', function () {
    switchTab('backups');
  });
  DOM.tabBtnHistory.addEventListener('click', function () {
    switchTab('history');
  });
}


// ═══════════════════════════════════════════════════════════
//  LOGGING
// ═══════════════════════════════════════════════════════════

function log(msg, type) {
  type = type || 'info';
  var line = document.createElement('div');
  line.className = 'log-line ' + type;
  var time = new Date().toLocaleTimeString();
  line.textContent = '[' + time + '] ' + msg;
  DOM.consoleBody.appendChild(line);
  DOM.consoleBody.scrollTop = DOM.consoleBody.scrollHeight;
}


// ═══════════════════════════════════════════════════════════
//  SERVER STATUS
// ═══════════════════════════════════════════════════════════

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


// ═══════════════════════════════════════════════════════════
//  PROFILE MANAGEMENT
// ═══════════════════════════════════════════════════════════

async function loadProfiles() {
  try {
    var res = await fetch('/api/profiles');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    profiles = data.profiles || [];
    renderProfileList();

    // Tự động chọn profile cuối cùng đã mở
    if (profiles.length > 0) {
      var lastId = null;
      try {
        var stateRes = await fetch('/api/state/last-opened');
        if (stateRes.ok) {
          var stateData = await stateRes.json();
          lastId = stateData.profileId;
        }
      } catch (e) { /* ignore */ }

      // Nếu có lastOpened và profile đó tồn tại -> chọn, nếu không chọn cái đầu
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
    // Chọn profile mới tạo
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

  // Lưu last opened
  try {
    await fetch('/api/state/last-opened', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: id })
    });
  } catch (e) { /* ignore */ }

  // Khôi phục import state từ localStorage khi chuyển profile
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

  // Cập nhật sidebar active
  renderProfileList();

  // Hiện profile bar, ẩn empty state
  showProfileBar(profile);
  DOM.emptyNoProfile.classList.add('hidden');
  DOM.workspace.classList.add('hidden');

  // Hiện panel phụ bên phải
  DOM.rightPanel.classList.remove('hidden');
  DOM.appLayout.classList.remove('no-panel');

  // Tải root config từ server
  await loadRootConfig(profile.id);

  // Kiểm tra health
  checkProfileHealth(profile.id);

  // Khôi phục hoặc hiện Dropzone tùy thuộc vào việc có hàng đợi đã lưu hay không
  if (importConfig && importConfig.providerConnections && importConfig.providerConnections.length > 0) {
    DOM.importSection.classList.add('hidden');
    DOM.emptyNoImport.classList.add('hidden');
    triggerMerge();
  } else {
    DOM.importSection.classList.remove('hidden');
    DOM.emptyNoImport.classList.remove('hidden');
  }

  // Tải backups & history
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

    // Nếu đang chọn profile bị xóa -> reset
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


// ═══════════════════════════════════════════════════════════
//  SIDEBAR RENDERING
// ═══════════════════════════════════════════════════════════

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
  
  // Icon SVG cho trạng thái health
  var statusIconSVG = '';
  if (profile.healthy === true) {
    statusIconSVG = '<svg class="icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  } else if (profile.healthy === false) {
    statusIconSVG = '<svg class="icon danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  } else {
    statusIconSVG = '<svg class="icon warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  }

  // Tầng 2: Truncate đường dẫn
  var displayPath = profile.rootPath || '—';
  if (displayPath.length > 30) {
    displayPath = displayPath.substr(0, 12) + '...' + displayPath.substr(displayPath.length - 15);
  }

  var lastWriteText = profile.lastWriteAt ? relativeTime(profile.lastWriteAt) : 'Chưa ghi';
  var backupCountText = profile.backupCount !== undefined ? profile.backupCount + ' backups' : '— backups';
  var lastWriteSummary = profile.lastWriteSummary || '';

  // Stats row & badge (Không dùng emoji theo PATCH 1)
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
      '<span class="pill-status ' + healthStatusClass + '">' + (profile.healthy === true ? 'Healthy' : 'Broken') + '</span>' +
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

  // Toggle Dropdown menu
  var btnMore = card.querySelector('.btn-more');
  var dropdown = card.querySelector('.profile-card-dropdown');
  btnMore.addEventListener('click', function (e) {
    e.stopPropagation();
    // Đóng các dropdown khác trước
    document.querySelectorAll('.profile-card-dropdown.active').forEach(function (d) {
      if (d !== dropdown) d.classList.remove('active');
    });
    dropdown.classList.toggle('active');
  });

  // Ngăn click dropdown lan ra card click
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

  // Ẩn dropdown khi click ra ngoài
  document.addEventListener('click', function () {
    dropdown.classList.remove('active');
  });

  // Click chọn card (click vào phần chữ tên profile sẽ mở modal chi tiết)
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


// ═══════════════════════════════════════════════════════════
//  PROFILE WORKSPACE
// ═══════════════════════════════════════════════════════════

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

    // Cập nhật profile bar
    DOM.profileHealthDot.className = 'health-dot ' + (healthy ? 'healthy' : 'broken');
    DOM.profileHealthText.textContent = healthy ? 'File OK' : 'File không tìm thấy';

    // Cập nhật profile trong danh sách
    var p = profiles.find(function (pp) { return pp.id === profileId; });
    if (p) p.healthy = healthy;

    // Cập nhật card trong sidebar
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


// ═══════════════════════════════════════════════════════════
//  DRAG & DROP + IMPORT
// ═══════════════════════════════════════════════════════════

function setupDragAndDrop(dropzone, fileInput, fileHandler) {
  dropzone.addEventListener('click', function () { fileInput.click(); });

  fileInput.addEventListener('click', function (e) {
    e.stopPropagation();
  });

  fileInput.addEventListener('change', function (e) {
    if (e.target.files.length > 0) {
      fileHandler(e.target.files[0]);
    }
  });

  dropzone.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', function () {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      fileInput.files = e.dataTransfer.files;
      fileHandler(e.dataTransfer.files[0]);
    }
  });
}

function handleImportFile(file) {
  if (!activeProfile) {
    showToast('Vui lòng chọn một Profile trước khi import file.', 'warning');
    return;
  }
  if (!baseConfig) {
    showToast('Cấu hình gốc chưa được tải. Không thể gộp.', 'error');
    return;
  }

  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var newImport = JSON.parse(e.target.result);
      
      if (!importConfig || !importConfig.providerConnections) {
        importConfig = { settings: {}, providerConnections: [] };
      }

      var addedCount = 0;
      var updatedCount = 0;
      (newImport.providerConnections || []).forEach(function (newConn) {
        var existingIdx = importConfig.providerConnections.findIndex(function (c) {
          return c.name === newConn.name && (c.provider || 'codex') === (newConn.provider || 'codex');
        });
        if (existingIdx !== -1) {
          importConfig.providerConnections[existingIdx] = Object.assign({}, importConfig.providerConnections[existingIdx], newConn);
          updatedCount++;
        } else {
          importConfig.providerConnections.push(newConn);
          addedCount++;
        }
      });

      DOM.importFileName.textContent = file.name + ' (Đã nạp ' + importConfig.providerConnections.length + ' accounts)';
      log('Đã nạp file tài khoản: ' + file.name + ' (Hợp nhất thêm ' + addedCount + ' mới, ' + updatedCount + ' cập nhật)', 'success');
      showToast('Đã nạp thêm ' + (addedCount + updatedCount) + ' tài khoản vào hàng đợi!', 'success');
      
      triggerMerge();
    } catch (err) {
      log('Lỗi parse file tài khoản mới: ' + err.message, 'error');
      showToast('File JSON không hợp lệ: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}


// ═══════════════════════════════════════════════════════════
//  MERGE LOGIC (giữ nguyên logic gốc)
// ═══════════════════════════════════════════════════════════

function triggerMerge() {
  if (!baseConfig || !importConfig) return;

  log('Đang tính toán gộp cấu hình với các luật mới...', 'system');

  // Clone base config để không mutate bản gốc
  mergedConfig = JSON.parse(JSON.stringify(baseConfig));

  var baseConns = mergedConfig.providerConnections || [];
  var importConns = importConfig.providerConnections || [];

  // Giữ lại trạng thái excluded/ping cũ nếu trùng ID
  var oldAccountsMap = {};
  accountsList.forEach(function (a) {
    oldAccountsMap[a.id] = a;
  });

  accountsList = [];
  var updateCount = 0;
  var newCount = 0;
  var warningCount = 0;

  importConns.forEach(function (newConn) {
    var name = newConn.name;
    var provider = newConn.provider || 'codex';
    var connId = newConn.id || ('id-' + Math.random().toString(36).substr(2, 9));

    // Kiểm tra xem có thiếu fields thiết yếu không
    var warningFields = [];
    if (!name) warningFields.push('name');
    if (!newConn.provider) warningFields.push('provider');
    if (newConn.token === "") warningFields.push('token');

    var isWarning = warningFields.length > 0;

    // Tìm connection cũ cùng provider và name
    var existingIndex = baseConns.findIndex(function (c) {
      return c.provider === provider && c.name === name;
    });

    var status = 'new';
    var changes = [];
    var originalData = null;

    if (existingIndex !== -1) {
      status = isWarning ? 'warning' : 'update';
      originalData = baseConns[existingIndex];
      
      // So sánh các field thay đổi
      for (var k in newConn) {
        if (k !== 'id' && JSON.stringify(newConn[k]) !== JSON.stringify(originalData[k])) {
          changes.push(k);
        }
      }
      
      if (!isWarning) {
        updateCount++;
      } else {
        warningCount++;
      }
    } else {
      status = isWarning ? 'warning' : 'new';
      if (!isWarning) {
        newCount++;
      } else {
        warningCount++;
      }
    }

    var oldAcc = oldAccountsMap[connId] || {};
    accountsList.push({
      id: connId,
      name: name || 'Tài khoản không tên',
      provider: provider,
      status: status,
      priority: newConn.priority || 5,
      changes: changes,
      warningFields: warningFields,
      originalData: originalData,
      newData: newConn,
      excluded: oldAcc.excluded !== undefined ? oldAcc.excluded : false,
      ping: oldAcc.ping || null
    });
  });

  // Cập nhật DOM đếm số lượng
  DOM.updateCount.textContent = updateCount;
  DOM.newCount.textContent = newCount;
  
  var warnTabSpan = document.getElementById('warningCount');
  if (warnTabSpan) warnTabSpan.textContent = warningCount;

  updateMergeSummaryText();

  // Lưu vào localStorage để tránh bị mất khi refresh/chuyển profile
  if (activeProfile) {
    localStorage.setItem('importConfig_' + activeProfile.id, JSON.stringify(importConfig));
  }

  // Render preview table
  renderAccountCards();
  DOM.workspace.classList.remove('hidden');
  DOM.emptyNoImport.classList.add('hidden');
  DOM.importSection.classList.add('hidden');

  log('Hoàn tất gộp. Phân tích: ' + newCount + ' thêm mới, ' + updateCount + ' cập nhật, ' + warningCount + ' cảnh báo.', 'success');
}

function updateMergeSummaryText() {
  var activeAccounts = accountsList.filter(function (a) { return !a.excluded; });
  DOM.mergeSummary.textContent = 'Tổng: ' + accountsList.length + ' tài khoản hàng đợi (' + activeAccounts.length + ' sẽ được ghi đè, ' + (accountsList.length - activeAccounts.length) + ' loại trừ)';
}

function renderAccountCards() {
  DOM.accountsTableBody.innerHTML = '';

  var filterBtnActive = document.querySelector('.filter-btn.active');
  var currentFilter = filterBtnActive ? filterBtnActive.dataset.filter : 'all';
  
  var searchInput = document.getElementById('accountSearchInput');
  var searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';

  var filteredList = accountsList.filter(function (acc) {
    if (searchQuery && acc.name.toLowerCase().indexOf(searchQuery) === -1) {
      return false;
    }
    if (currentFilter === 'all') return true;
    return acc.status === currentFilter;
  });

  if (filteredList.length === 0) {
    DOM.accountsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 20px;">Không có tài khoản nào khớp bộ lọc</td></tr>';
    return;
  }

  filteredList.forEach(function (acc) {
    var tr = document.createElement('tr');
    tr.dataset.status = acc.status;
    tr.dataset.id = acc.id;
    if (acc.excluded) tr.classList.add('excluded-row');

    var providers = ['codex', 'gemini-cli', 'openai', 'deepseek', 'kiro', 'gemini', 'other'];
    var selectHTML = '<select class="table-select" data-id="' + acc.id + '">';
    providers.forEach(function (p) {
      var selected = acc.provider === p ? 'selected' : '';
      selectHTML += '<option value="' + p + '" ' + selected + '>' + p + '</option>';
    });
    selectHTML += '</select>';

    var changesLabel = acc.changes.length > 0 ? acc.changes.join(', ') : '—';
    if (acc.status === 'new') changesLabel = '—';
    if (acc.status === 'warning') changesLabel = 'Thiếu: ' + acc.warningFields.join(', ');

    var statusBadgeHTML = '';
    if (acc.status === 'new') {
      statusBadgeHTML = '<span class="acc-badge new">Mới</span>';
    } else if (acc.status === 'update') {
      statusBadgeHTML = '<span class="acc-badge update">Cập nhật</span>';
    } else {
      statusBadgeHTML = '<span class="acc-badge warning">Cảnh báo</span>';
    }

    var pingHTML = acc.ping ? '<span class="ping-status">' + acc.ping + '</span>' : '<span class="ping-status" style="color: var(--text-secondary);">—</span>';

    tr.innerHTML =
      '<td style="padding: 12px 16px; width: 40px; text-align: center;">' +
        '<input type="checkbox" class="row-checkbox" data-id="' + acc.id + '" ' + (acc.excluded ? '' : 'checked') + '>' +
      '</td>' +
      '<td style="padding: 12px 16px; font-weight: 500;">' + escapeHTML(acc.name) + '</td>' +
      '<td style="padding: 8px 16px;">' + selectHTML + '</td>' +
      '<td style="padding: 8px 16px;">' +
        '<input type="number" value="' + acc.priority + '" min="1" max="100" style="width: 70px; padding: 6px 10px; border-radius: 4px; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: var(--text-primary); outline: none; font-size: 12px;" data-id="' + acc.id + '" class="priority-input">' +
      '</td>' +
      '<td style="padding: 12px 16px;">' +
        '<div style="display: flex; flex-direction: column; gap: 4px;">' +
          statusBadgeHTML +
          '<div style="font-size: 10px; color: var(--text-secondary);">' + changesLabel + '</div>' +
        '</div>' +
      '</td>' +
      '<td style="padding: 8px 16px; text-align: right; display: flex; gap: 8px; justify-content: flex-end; align-items: center; height: 100%;">' +
        pingHTML +
        '<button class="btn-icon" data-action="diff" title="Xem chi tiết thay đổi" style="padding: 4px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; color: var(--text-primary); display: flex; align-items: center; justify-content: center;">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px; height:12px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
        '</button>' +
        (acc.status === 'warning' ? 
        '<button class="btn-icon" data-action="edit-warning" title="Sửa thông tin thiếu" style="padding: 4px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 4px; cursor: pointer; color: var(--color-warning); display: flex; align-items: center; justify-content: center;">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px; height:12px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>' +
        '</button>' : '') +
        '<button class="btn-icon" data-action="delete" title="Xoá khỏi hàng đợi" style="padding: 4px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 4px; cursor: pointer; color: var(--color-danger); display: flex; align-items: center; justify-content: center;">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px; height:12px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
        '</button>' +
      '</td>';

    var cb = tr.querySelector('.row-checkbox');
    cb.addEventListener('change', function (e) {
      acc.excluded = !e.target.checked;
      if (acc.excluded) {
        tr.classList.add('excluded-row');
      } else {
        tr.classList.remove('excluded-row');
      }
      updateMergeSummaryText();
      updateHeaderCheckboxState();
    });

    var selectEl = tr.querySelector('select');
    selectEl.addEventListener('change', function (e) {
      updateAccountProvider(acc.id, e.target.value);
    });

    var priorityEl = tr.querySelector('.priority-input');
    priorityEl.addEventListener('change', function (e) {
      updateAccountPriority(acc.id, parseInt(e.target.value, 10) || 5);
    });

    tr.querySelector('[data-action="diff"]').addEventListener('click', function () {
      showAccountDiffModal(acc);
    });

    if (acc.status === 'warning') {
      tr.querySelector('[data-action="edit-warning"]').addEventListener('click', function () {
        showEditWarningModal(acc);
      });
    }

    tr.querySelector('[data-action="delete"]').addEventListener('click', function () {
      removeAccountFromMerge(acc.id);
    });

    DOM.accountsTableBody.appendChild(tr);
  });

  updateHeaderCheckboxState();
}

function updateHeaderCheckboxState() {
  var headerCb = document.getElementById('selectAllAccountsCheckbox');
  if (!headerCb) return;

  var activeRows = accountsList.filter(function (a) { return !a.excluded; });
  if (activeRows.length === accountsList.length && accountsList.length > 0) {
    headerCb.checked = true;
    headerCb.indeterminate = false;
  } else if (activeRows.length === 0) {
    headerCb.checked = false;
    headerCb.indeterminate = false;
  } else {
    headerCb.indeterminate = true;
  }
}

function setupHeaderCheckboxEvent() {
  var headerCb = document.getElementById('selectAllAccountsCheckbox');
  if (headerCb) {
    headerCb.addEventListener('change', function (e) {
      var checkState = e.target.checked;
      accountsList.forEach(function (acc) {
        acc.excluded = !checkState;
      });
      renderAccountCards();
      updateMergeSummaryText();
    });
  }
}

function showAccountDiffModal(acc) {
  var bodyHTML = '<div class="diff-viewer-modal" style="font-family: \'JetBrains Mono\', monospace; font-size: 11px; max-height: 400px; overflow-y: auto;">';
  
  if (acc.status === 'new') {
    bodyHTML += '<div style="color: var(--color-success); margin-bottom: 10px; font-weight: bold;">Tài khoản mới:</div>';
    bodyHTML += '<pre style="background: rgba(16, 185, 129, 0.05); padding: 10px; border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 6px;">' + escapeHTML(JSON.stringify(acc.newData, null, 2)) + '</pre>';
  } else {
    bodyHTML += '<div style="margin-bottom: 10px; font-weight: bold;">So sánh thay đổi (Cũ vs Mới):</div>';
    bodyHTML += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
    bodyHTML += '<div>';
    bodyHTML += '<div style="color: var(--color-danger); margin-bottom: 5px; font-weight: bold;">Cũ (Base):</div>';
    bodyHTML += '<pre style="background: rgba(239, 68, 68, 0.05); padding: 10px; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px; overflow-x: auto;">' + escapeHTML(JSON.stringify(acc.originalData || {}, null, 2)) + '</pre>';
    bodyHTML += '</div>';
    bodyHTML += '<div>';
    bodyHTML += '<div style="color: var(--color-warning); margin-bottom: 5px; font-weight: bold;">Mới (Imported):</div>';
    bodyHTML += '<pre style="background: rgba(245, 158, 11, 0.05); padding: 10px; border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 6px; overflow-x: auto;">' + escapeHTML(JSON.stringify(acc.newData, null, 2)) + '</pre>';
    bodyHTML += '</div>';
    bodyHTML += '</div>';
    
    if (acc.changes.length > 0) {
      bodyHTML += '<div style="margin-top: 15px; font-weight: bold; color: var(--accent-cyan);">Các trường thay đổi: ' + acc.changes.join(', ') + '</div>';
    }
  }
  
  bodyHTML += '</div>';

  showModal('Chi tiết thay đổi - ' + acc.name, bodyHTML, [
    { label: 'Đóng', value: 'close', className: 'btn btn-secondary btn-sm' }
  ]);
}

function showEditWarningModal(acc) {
  var bodyHTML = '<div style="display: flex; flex-direction: column; gap: 12px;">';
  bodyHTML += '<p style="color: var(--color-warning); font-size: 12px;">Tài khoản này thiếu một số thông tin bắt buộc. Vui lòng bổ sung bên dưới:</p>';
  
  acc.warningFields.forEach(function (f) {
    bodyHTML += '<div class="form-group">';
    bodyHTML += '<label style="text-transform: capitalize;">' + f + ' (Thiếu)</label>';
    bodyHTML += '<input type="text" id="warningInput_' + f + '" placeholder="Nhập giá trị cho ' + f + '...">';
    bodyHTML += '</div>';
  });
  
  bodyHTML += '</div>';

  showModal('Sửa tài khoản cảnh báo - ' + acc.name, bodyHTML, [
    { label: 'Hủy', value: 'cancel', className: 'btn btn-secondary btn-sm' },
    { label: 'Lưu lại', value: 'save', className: 'btn btn-primary btn-sm' }
  ]).then(function (result) {
    if (result !== 'save') return;

    var updatedData = Object.assign({}, acc.newData);
    acc.warningFields.forEach(function (f) {
      var val = document.getElementById('warningInput_' + f).value.trim();
      if (val) updatedData[f] = val;
    });

    if (importConfig && importConfig.providerConnections) {
      var idx = importConfig.providerConnections.findIndex(function (c) { return c.name === acc.name; });
      if (idx !== -1) {
        importConfig.providerConnections[idx] = updatedData;
      }
    }

    showToast('Đã bổ sung thông tin tài khoản!', 'success');
    triggerMerge();
  });
}

async function exportProfileBundle(profileId) {
  var p = profiles.find(function (x) { return x.id === profileId; });
  if (!p) return;
  
  log('Đang xuất gói dữ liệu Profile bundle cho: ' + p.name, 'system');
  showToast('Đang xuất Profile bundle...', 'info');

  try {
    var res = await fetch('/api/profiles/' + profileId + '/export-bundle');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    
    var blob = new Blob([JSON.stringify(data.bundle, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = p.name.replace(/\s+/g, '_') + '.9rtbundle';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    log('Đã xuất thành công Profile bundle: ' + p.name, 'success');
    showToast('Tải gói Profile thành công!', 'success');
  } catch (err) {
    log('Lỗi xuất bundle: ' + err.message, 'error');
    showToast('Xuất gói Profile thất bại: ' + err.message, 'error');
  }
}

function handleImportBundleFile(file) {
  var reader = new FileReader();
  reader.onload = async function (e) {
    try {
      var bundle = JSON.parse(e.target.result);
      if (!bundle || !bundle.profile) {
        showToast('File bundle không hợp lệ!', 'error');
        return;
      }
      
      var confirmed = await showConfirmModal(
        'Nhập Profile Bundle',
        'Bạn có chắc chắn muốn nhập Profile "' + bundle.profile.name + '" kèm ' + (bundle.backups || []).length + ' bản sao lưu liên quan từ gói này?'
      );
      if (!confirmed) return;

      log('Đang nhập Profile bundle...', 'system');
      var res = await fetch('/api/profiles/import-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle: bundle })
      });
      
      if (!res.ok) {
        var errData = await res.json().catch(function () { return {}; });
        throw new Error(errData.error || 'HTTP ' + res.status);
      }
      
      var result = await res.json();
      showToast('Đã nhập Profile Bundle thành công!', 'success');
      log('Đã nhập thành công profile: ' + result.profile.name, 'success');
      
      await loadProfiles();
      if (result.profile && result.profile.id) {
        await selectProfile(result.profile.id);
        
        var healthRes = await fetch('/api/profiles/' + result.profile.id + '/health');
        if (healthRes.ok) {
          var healthData = await healthRes.json();
          if (!healthData.healthy) {
            log('Đường dẫn file của profile vừa nhập không tồn tại trên máy này. Tự động mở chỉnh sửa...', 'warning');
            showToast('Vui lòng cập nhật đường dẫn file gốc!', 'warning');
            showEditProfileModal(result.profile.id);
          }
        }
      }
    } catch (err) {
      log('Lỗi nhập bundle: ' + err.message, 'error');
      showToast('Lỗi nhập bundle: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

function showEditProfileModal(profileId) {
  var p = profiles.find(function (x) { return x.id === profileId; });
  if (!p) return;

  var bodyHTML =
    '<div class="form-group">' +
      '<label>Tên Profile</label>' +
      '<input type="text" id="editModalInputName" value="' + escapeHTML(p.name) + '">' +
    '</div>' +
    '<div class="form-group" style="margin-top: 10px;">' +
      '<label>Đường dẫn file cấu hình gốc (Root Path)</label>' +
      '<div style="display: flex; gap: 8px;">' +
        '<input type="text" id="editModalInputPath" value="' + escapeHTML(p.rootPath) + '" style="flex: 1; font-family: \'JetBrains Mono\', monospace; font-size: 12px;" placeholder="Kéo thả file vào đây hoặc bấm Chọn tệp...">' +
        '<button class="btn btn-secondary btn-sm" id="btnSelectEditPath" style="padding: 0 12px; font-size: 12px; white-space: nowrap;">Chọn tệp...</button>' +
      '</div>' +
    '</div>' +
    '<div class="form-group" style="margin-top: 10px;">' +
      '<label>Ghi chú (Note)</label>' +
      '<textarea id="editModalInputNote" placeholder="Nhập ghi chú cho profile này..." style="width:100%; min-height:80px; padding: 10px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; outline:none; font-family: inherit; font-size: 13px;">' + escapeHTML(p.note || '') + '</textarea>' +
    '</div>';

  var promise = showModal('Chỉnh sửa Profile - ' + p.name, bodyHTML, [
    { label: 'Hủy', value: 'cancel', className: 'btn btn-secondary btn-sm' },
    { label: 'Lưu thay đổi', value: 'save', className: 'btn btn-primary btn-sm' }
  ]);

  setupModalPathEvents('editModalInputPath', 'btnSelectEditPath');

  promise.then(async function (result) {
    if (result !== 'save') return;

    var name = document.getElementById('editModalInputName').value.trim();
    var rootPath = document.getElementById('editModalInputPath').value.trim();
    var note = document.getElementById('editModalInputNote').value.trim();

    if (!name || !rootPath) {
      showToast('Tên profile và đường dẫn không được để trống!', 'warning');
      return;
    }

    try {
      var res = await fetch('/api/profiles/' + profileId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, rootPath: rootPath, note: note })
      });
      if (res.ok) {
        showToast('Đã lưu thay đổi profile!', 'success');
        await loadProfiles();
        if (activeProfile && activeProfile.id === profileId) {
          selectProfile(profileId);
        }
      } else {
        showToast('Lỗi lưu thông tin profile', 'error');
      }
    } catch (e) {
      showToast('Lỗi kết nối: ' + e.message, 'error');
    }
  });
}

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


function updateAccountProvider(id, provider) {
  if (mergedConfig && mergedConfig.providerConnections) {
    var conn = mergedConfig.providerConnections.find(function (c) { return c.id === id; });
    if (conn) {
      var oldProv = conn.provider;
      conn.provider = provider;
      log('Đã đổi provider của tài khoản "' + conn.name + '" từ [' + oldProv + '] sang [' + provider + ']', 'info');
      showToast('Đã đổi sang provider: ' + provider, 'success');
    }
  }
  var acc = accountsList.find(function (a) { return a.id === id; });
  if (acc) {
    acc.provider = provider;
  }
}

function updateAccountPriority(id, priority) {
  if (mergedConfig && mergedConfig.providerConnections) {
    var conn = mergedConfig.providerConnections.find(function (c) { return c.id === id; });
    if (conn) {
      conn.priority = priority;
      log('Đã cập nhật độ ưu tiên của tài khoản "' + conn.name + '" thành: ' + priority, 'info');
    }
  }
  var acc = accountsList.find(function (a) { return a.id === id; });
  if (acc) {
    acc.priority = priority;
  }
}

function exportSingleAccount(id) {
  if (!mergedConfig || !mergedConfig.providerConnections) return;
  var conn = mergedConfig.providerConnections.find(function (c) { return c.id === id; });
  if (!conn) return;

  var singleData = {
    settings: mergedConfig.settings,
    providerConnections: [conn]
  };

  var blob = new Blob([JSON.stringify(singleData, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '9router-account-' + conn.provider + '-' + conn.name + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  log('Đã export riêng tài khoản "' + conn.name + '" (' + conn.provider + ')', 'success');
  showToast('Đã export tài khoản thành công!', 'success');
}

function removeAccountFromMerge(id) {
  if (!mergedConfig || !mergedConfig.providerConnections) return;

  var conn = mergedConfig.providerConnections.find(function (c) { return c.id === id; });
  var name = conn ? conn.name : '';

  mergedConfig.providerConnections = mergedConfig.providerConnections.filter(function (c) {
    return c.id !== id;
  });

  accountsList = accountsList.filter(function (a) {
    return a.id !== id;
  });

  log('Đã xoá tài khoản "' + name + '" khỏi bản gộp', 'warning');
  showToast('Đã loại bỏ tài khoản: ' + name, 'info');

  var updateCount = accountsList.filter(function (a) { return a.status === 'update'; }).length;
  var newCount = accountsList.filter(function (a) { return a.status === 'new'; }).length;
  DOM.updateCount.textContent = updateCount;
  DOM.newCount.textContent = newCount;
  DOM.mergeSummary.textContent = 'Tổng: ' + (updateCount + newCount) + ' thay đổi (' + updateCount + ' cập nhật, ' + newCount + ' thêm mới)';

  renderAccountCards();
}

function exportProviderConnections() {
  var selectedProvider = DOM.exportProviderSelect.value;
  if (!mergedConfig) {
    showToast('Không có dữ liệu gộp để export!', 'error');
    return;
  }
  var conns = mergedConfig.providerConnections || [];
  var filtered = selectedProvider === 'all'
    ? conns
    : conns.filter(function (c) { return c.provider === selectedProvider; });

  if (filtered.length === 0) {
    showToast('Không có tài khoản nào thuộc provider: ' + selectedProvider, 'warning');
    return;
  }

  var exportData = {
    settings: mergedConfig.settings,
    providerConnections: filtered
  };

  var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '9router-export-' + selectedProvider + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  log('Đã export riêng ' + filtered.length + ' tài khoản cho provider: ' + selectedProvider, 'success');
  showToast('Đã export ' + filtered.length + ' tài khoản!', 'success');
}


// ═══════════════════════════════════════════════════════════
//  SAVE & DOWNLOAD
// ═══════════════════════════════════════════════════════════

function downloadMergedConfig() {
  if (!mergedConfig) {
    showToast('Không có dữ liệu gộp để tải xuống!', 'error');
    return;
  }

  var blob = new Blob([JSON.stringify(mergedConfig, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'dung-9Router.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  log('Đã tải xuống file cấu hình đã gộp.', 'success');
  showToast('File đã được tải xuống!', 'success');
}

async function saveConfigDirectly() {
  if (!mergedConfig) {
    showToast('Không có dữ liệu để ghi đè!', 'error');
    return;
  }

  if (!activeProfile) {
    showToast('Chưa chọn profile!', 'error');
    return;
  }

  // Lọc lấy các connection không bị loại trừ
  var finalConnections = [];
  var baseConns = baseConfig.providerConnections || [];
  
  var excludedIds = {};
  accountsList.forEach(function (acc) {
    if (acc.excluded) excludedIds[acc.id] = true;
  });

  var finalMerged = JSON.parse(JSON.stringify(baseConfig));
  var finalConns = [];

  var mergeMap = {};
  var importConns = importConfig.providerConnections || [];
  
  importConns.forEach(function (newConn) {
    var accInfo = accountsList.find(function (a) { return a.name === newConn.name && a.provider === (newConn.provider || 'codex'); });
    if (accInfo && !accInfo.excluded) {
      mergeMap[newConn.provider + '::' + newConn.name] = newConn;
    }
  });

  baseConns.forEach(function (baseConn) {
    var key = baseConn.provider + '::' + baseConn.name;
    if (mergeMap[key]) {
      var updated = Object.assign({}, baseConn, mergeMap[key], { id: baseConn.id });
      finalConns.push(updated);
      delete mergeMap[key];
    } else {
      finalConns.push(baseConn);
    }
  });

  for (var key in mergeMap) {
    var newConn = mergeMap[key];
    var connId = newConn.id || ('id-' + Math.random().toString(36).substr(2, 9));
    var fresh = Object.assign({}, newConn, { id: connId });
    finalConns.push(fresh);
  }

  finalMerged.providerConnections = finalConns;

  var activeAccounts = accountsList.filter(function (a) { return !a.excluded; });
  var newCount = activeAccounts.filter(function (a) { return a.status === 'new'; }).length;
  var updateCount = activeAccounts.filter(function (a) { return a.status === 'update'; }).length;
  var warningCount = activeAccounts.filter(function (a) { return a.status === 'warning'; }).length;

  var summaryMessage = 'Chuẩn bị ghi đè trực tiếp cho profile "' + activeProfile.name + '":\n' +
                       '- Thêm mới: ' + newCount + ' tài khoản\n' +
                       '- Cập nhật: ' + updateCount + ' tài khoản\n' +
                       '- Cảnh báo (vẫn ghi): ' + warningCount + ' tài khoản\n\n' +
                       'Thao tác này sẽ tự động sao lưu cấu hình cũ và thay thế tệp tin gốc.';

  if (settings.confirmBeforeWrite) {
    var confirmed = await showConfirmModal('Ghi đè cấu hình', summaryMessage);
    if (!confirmed) return;
  }

  log('Đang gửi yêu cầu ghi file atomic... Profile: ' + activeProfile.name, 'system');

  try {
    var res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId: activeProfile.id,
        config: finalMerged
      })
    });

    var result = await res.json();
    if (res.ok && result.success) {
      log('Ghi đè file thành công! Profile: ' + activeProfile.name, 'success');
      showToast('Đã ghi đè file cấu hình thành công!', 'success');
      
      await loadRootConfig(activeProfile.id);
      resetImportQueue();
      
      checkProfileHealth(activeProfile.id);
      loadBackups(activeProfile.id);
      loadHistory();
    } else {
      log('Lỗi server: ' + (result.error || 'Unknown'), 'error');
      showToast('Lỗi ghi file: ' + (result.error || 'Unknown'), 'error');
    }
  } catch (err) {
    log('Lỗi kết nối khi ghi file: ' + err.message, 'error');
    showToast('Lỗi kết nối: ' + err.message, 'error');
  }
}


// ═══════════════════════════════════════════════════════════
//  TOAST SYSTEM
// ═══════════════════════════════════════════════════════════

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


// ═══════════════════════════════════════════════════════════
//  MODAL SYSTEM
// ═══════════════════════════════════════════════════════════

// Promise-based resolve cho modal hiện tại
var _modalResolve = null;

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
        _modalResolve = null; // Ngăn hideModal resolve null
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


// ═══════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════

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

function escapeHTML(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ═══════════════════════════════════════════════════════════
//  SETTINGS & SYSTEM CONFIG
// ═══════════════════════════════════════════════════════════

async function loadSettings() {
  try {
    var res = await fetch('/api/settings');
    if (res.ok) {
      var data = await res.json();
      settings = data.settings || settings;
      applySettings();
    }
  } catch (err) {
    console.error('Lỗi tải cài đặt:', err);
  }
}

function applySettings() {
  // Áp dụng màu nhấn (accent color) nếu có thay đổi
  var themeColor = settings.themeAccentColor || 'cyan';
  if (themeColor === 'purple') {
    document.documentElement.style.setProperty('--accent-cyan', '#9d4edd');
    document.documentElement.style.setProperty('--border-glow', 'rgba(157, 78, 221, 0.2)');
  } else if (themeColor === 'emerald') {
    document.documentElement.style.setProperty('--accent-cyan', '#10b981');
    document.documentElement.style.setProperty('--border-glow', 'rgba(16, 185, 129, 0.2)');
  } else {
    // Reset to defaults
    document.documentElement.style.setProperty('--accent-cyan', '#00f2fe');
    document.documentElement.style.setProperty('--border-glow', 'rgba(0, 242, 254, 0.2)');
  }
  log('Đã áp dụng cấu hình hệ thống: tối đa ' + settings.retentionCount + ' bản sao lưu.', 'system');
}

async function saveSettings(retentionCount, confirmBeforeWrite, themeAccentColor) {
  try {
    var res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        retentionCount: parseInt(retentionCount, 10) || 20,
        confirmBeforeWrite: !!confirmBeforeWrite,
        themeAccentColor: themeAccentColor || 'cyan'
      })
    });
    if (res.ok) {
      var data = await res.json();
      settings = data.settings;
      applySettings();
      showToast('Đã lưu cấu hình hệ thống!', 'success');
    } else {
      showToast('Lỗi lưu cài đặt từ server', 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối lưu cài đặt: ' + err.message, 'error');
  }
}

function showSettingsModal() {
  var bodyHTML =
    '<div class="form-group">' +
      '<label>Số bản sao lưu giữ lại tối đa (Retention Limit)</label>' +
      '<input type="number" id="settingsRetention" value="' + settings.retentionCount + '" min="3" max="100">' +
    '</div>' +
    '<div class="form-group" style="display: flex; align-items: center; gap: 10px; margin-top: 15px;">' +
      '<input type="checkbox" id="settingsConfirm" ' + (settings.confirmBeforeWrite ? 'checked' : '') + ' style="width: auto; margin: 0;">' +
      '<label for="settingsConfirm" style="margin: 0; cursor: pointer;">Luôn hiển thị xác nhận trước khi ghi đè</label>' +
    '</div>' +
    '<div class="form-group" style="margin-top: 15px;">' +
      '<label>Màu sắc nhấn (Accent Color)</label>' +
      '<select id="settingsAccent">' +
        '<option value="cyan" ' + (settings.themeAccentColor === 'cyan' ? 'selected' : '') + '>Cyan (Mặc định)</option>' +
        '<option value="purple" ' + (settings.themeAccentColor === 'purple' ? 'selected' : '') + '>Purple (Tím Neon)</option>' +
        '<option value="emerald" ' + (settings.themeAccentColor === 'emerald' ? 'selected' : '') + '>Emerald (Xanh Lá)</option>' +
      '</select>' +
    '</div>';

  showModal('Cấu hình hệ thống', bodyHTML, [
    { label: 'Hủy', value: 'cancel', className: 'btn btn-secondary btn-sm' },
    { label: 'Lưu cài đặt', value: 'save', className: 'btn btn-primary btn-sm' }
  ]).then(function (result) {
    if (result !== 'save') return;

    var retention = document.getElementById('settingsRetention').value;
    var confirmVal = document.getElementById('settingsConfirm').checked;
    var accent = document.getElementById('settingsAccent').value;

    saveSettings(retention, confirmVal, accent);
  });
}

// ═══════════════════════════════════════════════════════════
//  BACKUP & RESTORE SYSTEM
// ═══════════════════════════════════════════════════════════

async function loadBackups(profileId) {
  if (!profileId) return;
  try {
    var res = await fetch('/api/profiles/' + profileId + '/backups');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    renderBackupList(data.backups || []);
  } catch (err) {
    console.error('Lỗi tải danh sách sao lưu:', err);
  }
}

function renderBackupList(backups) {
  DOM.backupList.innerHTML = '';
  if (backups.length === 0) {
    DOM.backupList.innerHTML = '<div class="backup-empty">Chưa có bản sao lưu nào</div>';
    return;
  }

  backups.forEach(function (backup) {
    var item = document.createElement('div');
    item.className = 'backup-item';

    var sizeKB = (backup.size / 1024).toFixed(1);
    var displayTime = relativeTime(backup.timestamp);

    item.innerHTML =
      '<div class="backup-name" title="' + escapeHTML(backup.filename) + '">' + escapeHTML(backup.filename) + '</div>' +
      '<div class="backup-meta">' +
        '<span>Dung lượng: ' + sizeKB + ' KB</span>' +
        '<span>' + displayTime + '</span>' +
      '</div>' +
      '<div class="backup-actions">' +
        '<button class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 11px;" data-restore="' + escapeHTML(backup.filename) + '">Khôi phục</button>' +
        '<button class="btn btn-danger btn-sm" style="padding: 4px 8px; font-size: 11px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #f3f4f6;" data-delbackup="' + escapeHTML(backup.filename) + '">Xoá</button>' +
      '</div>';

    // Bind events
    item.querySelector('[data-restore]').addEventListener('click', function () {
      restoreBackup(backup.filename);
    });
    item.querySelector('[data-delbackup]').addEventListener('click', function () {
      deleteBackup(backup.filename);
    });

    DOM.backupList.appendChild(item);
  });
}

async function restoreBackup(filename) {
  if (!activeProfile) return;
  var confirmed = await showConfirmModal(
    'Khôi phục sao lưu',
    'Bạn có chắc chắn muốn ghi đè cấu hình hiện tại bằng bản sao lưu "' + filename + '"? Một bản sao lưu của cấu hình hiện tại sẽ được tự động tạo trước khi khôi phục.'
  );
  if (!confirmed) return;

  try {
    log('Đang gửi yêu cầu khôi phục sao lưu: ' + filename, 'system');
    var res = await fetch('/api/profiles/' + activeProfile.id + '/backups/' + encodeURIComponent(filename) + '/restore', {
      method: 'POST'
    });
    if (!res.ok) {
      var errData = await res.json().catch(function () { return {}; });
      throw new Error(errData.error || 'HTTP ' + res.status);
    }
    showToast('Khôi phục sao lưu thành công!', 'success');
    log('Đã khôi phục thành công bản sao lưu: ' + filename, 'success');
    
    // Reload state after restore
    await loadRootConfig(activeProfile.id);
    checkProfileHealth(activeProfile.id);
    loadBackups(activeProfile.id);
    loadHistory();
  } catch (err) {
    showToast('Lỗi khôi phục: ' + err.message, 'error');
    log('Lỗi khôi phục: ' + err.message, 'error');
  }
}

async function deleteBackup(filename) {
  if (!activeProfile) return;
  var confirmed = await showConfirmModal(
    'Xoá bản sao lưu',
    'Bạn có chắc chắn muốn xoá vĩnh viễn bản sao lưu "' + filename + '"?'
  );
  if (!confirmed) return;

  try {
    var res = await fetch('/api/profiles/' + activeProfile.id + '/backups/' + encodeURIComponent(filename), {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    showToast('Đã xoá bản sao lưu thành công', 'info');
    log('Đã xoá bản sao lưu: ' + filename, 'warning');
    loadBackups(activeProfile.id);
    loadHistory();
  } catch (err) {
    showToast('Lỗi xoá bản sao lưu: ' + err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════
//  AUDIT LOG & HISTORY SYSTEM
// ═══════════════════════════════════════════════════════════

async function loadHistory() {
  try {
    var res = await fetch('/api/history');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    renderHistoryList(data.history || []);
  } catch (err) {
    console.error('Lỗi tải lịch sử:', err);
  }
}

function renderHistoryList(history) {
  DOM.historyList.innerHTML = '';
  if (history.length === 0) {
    DOM.historyList.innerHTML = '<div class="history-empty">Chưa có lịch sử hoạt động</div>';
    return;
  }

  history.forEach(function (logItem) {
    var item = document.createElement('div');
    item.className = 'history-item ' + (logItem.action || '');
    var displayTime = relativeTime(logItem.timestamp);

    item.innerHTML =
      '<div class="history-header">' +
        '<span class="history-action">' + escapeHTML(logItem.action) + '</span>' +
        '<span class="history-time">' + displayTime + '</span>' +
      '</div>' +
      (logItem.profileName ? '<div style="font-size: 11px; color: var(--accent-cyan); font-weight: 500;">Profile: ' + escapeHTML(logItem.profileName) + '</div>' : '') +
      '<div class="history-summary">' + escapeHTML(logItem.summary) + '</div>';

    DOM.historyList.appendChild(item);
  });
}

// ═══════════════════════════════════════════════════════════
//  TAB SWITCHING CONTROL
// ═══════════════════════════════════════════════════════════

function switchTab(tab) {
  if (tab === 'backups') {
    DOM.tabBtnBackups.classList.add('active');
    DOM.tabBtnHistory.classList.remove('active');
    DOM.backupsTab.classList.remove('hidden');
    DOM.historyTab.classList.add('hidden');
    if (activeProfile) loadBackups(activeProfile.id);
  } else if (tab === 'history') {
    DOM.tabBtnBackups.classList.remove('active');
    DOM.tabBtnHistory.classList.add('active');
    DOM.backupsTab.classList.add('hidden');
    DOM.historyTab.classList.remove('hidden');
    loadHistory();
  }
}

// ═══════════════════════════════════════════════════════════
//  OVERHAUL EXTRA UTILITIES & SHORTCUTS
// ═══════════════════════════════════════════════════════════

function resetImportQueue() {
  if (activeProfile) {
    localStorage.removeItem('importConfig_' + activeProfile.id);
  }
  importConfig = null;
  mergedConfig = null;
  accountsList = [];
  DOM.importFileName.textContent = 'Chưa chọn tệp';
  DOM.workspace.classList.add('hidden');
  DOM.emptyNoImport.classList.remove('hidden');
  DOM.importSection.classList.remove('hidden');
  log('Đã reset hàng đợi gộp.', 'info');
  showToast('Đã dọn dẹp hàng đợi!', 'info');
}

async function runPingTest() {
  if (accountsList.length === 0) {
    showToast('Không có tài khoản để ping test!', 'warning');
    return;
  }
  log('Bắt đầu Ping Test giả lập...', 'system');
  showToast('Đang chạy ping test...', 'info');
  
  var rows = DOM.accountsTableBody.querySelectorAll('tr');
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var pingEl = row.querySelector('.ping-status');
    if (pingEl) {
      pingEl.textContent = 'Pinging...';
      pingEl.className = 'ping-status warning';
    }
  }

  for (var i = 0; i < accountsList.length; i++) {
    var acc = accountsList[i];
    await new Promise(function (r) { setTimeout(r, 100 + Math.random() * 200); });
    var latency = Math.floor(20 + Math.random() * 180);
    acc.ping = latency + 'ms';
    
    var row = DOM.accountsTableBody.querySelector('tr[data-id="' + acc.id + '"]');
    if (row) {
      var pingEl = row.querySelector('.ping-status');
      if (pingEl) {
        pingEl.textContent = acc.ping;
        if (latency < 80) pingEl.className = 'ping-status success';
        else if (latency < 150) pingEl.className = 'ping-status warning';
        else pingEl.className = 'ping-status danger';
      }
    }
  }
  log('Hoàn thành Ping Test.', 'success');
  showToast('Ping Test hoàn tất!', 'success');
}

function showManualAddModal() {
  if (!activeProfile) {
    showToast('Vui lòng chọn Profile trước!', 'warning');
    return;
  }
  if (!baseConfig) {
    showToast('Cấu hình gốc chưa được tải!', 'warning');
    return;
  }

  var bodyHTML =
    '<div class="form-group">' +
      '<label>Tên tài khoản (Name)</label>' +
      '<input type="text" id="manualInputName" placeholder="VD: user_new">' +
    '</div>' +
    '<div class="form-group" style="margin-top: 10px;">' +
      '<label>Provider</label>' +
      '<select id="manualInputProvider">' +
        '<option value="codex">codex</option>' +
        '<option value="gemini-cli">gemini-cli</option>' +
        '<option value="openai">openai</option>' +
        '<option value="deepseek">deepseek</option>' +
        '<option value="gemini">gemini</option>' +
        '<option value="other">other</option>' +
      '</select>' +
    '</div>' +
    '<div class="form-group" style="margin-top: 10px;">' +
      '<label>Độ ưu tiên (Priority)</label>' +
      '<input type="number" id="manualInputPriority" value="5" min="1" max="100">' +
    '</div>' +
    '<div class="form-group" style="margin-top: 10px;">' +
      '<label>Token / API Key</label>' +
      '<input type="text" id="manualInputToken" placeholder="Nhập API Key hoặc token...">' +
    '</div>';

  showModal('Thêm tài khoản thủ công', bodyHTML, [
    { label: 'Hủy', value: 'cancel', className: 'btn btn-secondary btn-sm' },
    { label: 'Thêm mới', value: 'add', className: 'btn btn-primary btn-sm' }
  ]).then(function (result) {
    if (result !== 'add') return;

    var name = document.getElementById('manualInputName').value.trim();
    var provider = document.getElementById('manualInputProvider').value;
    var priority = parseInt(document.getElementById('manualInputPriority').value, 10) || 5;
    var token = document.getElementById('manualInputToken').value.trim();

    if (!name) {
      showToast('Tên tài khoản không được để trống!', 'warning');
      return;
    }

    if (!importConfig) {
      importConfig = { settings: {}, providerConnections: [] };
    }
    if (!importConfig.providerConnections) {
      importConfig.providerConnections = [];
    }

    var newConn = {
      id: 'manual-' + Math.random().toString(36).substr(2, 9),
      name: name,
      provider: provider,
      priority: priority,
      token: token
    };

    importConfig.providerConnections.push(newConn);
    DOM.importFileName.textContent = 'Nhập thủ công (' + importConfig.providerConnections.length + ' accounts)';
    
    triggerMerge();
  });
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
      document.querySelectorAll('.profile-card-dropdown.active').forEach(function (d) {
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

function setupModalPathEvents(inputId, buttonId) {
  var inputEl = document.getElementById(inputId);
  var btnEl = document.getElementById(buttonId);

  if (inputEl) {
    // 1. Drag & drop support
    inputEl.addEventListener('dragover', function (e) {
      e.preventDefault();
      inputEl.style.borderColor = 'var(--accent-cyan)';
      inputEl.style.background = 'rgba(0, 242, 254, 0.02)';
    });

    inputEl.addEventListener('dragleave', function () {
      inputEl.style.borderColor = '';
      inputEl.style.background = '';
    });

    inputEl.addEventListener('drop', function (e) {
      e.preventDefault();
      inputEl.style.borderColor = '';
      inputEl.style.background = '';

      if (e.dataTransfer.files.length > 0) {
        var file = e.dataTransfer.files[0];
        // file.path contains absolute path in local context (Chrome/Electron)
        var path = file.path || file.name;
        inputEl.value = path;
        showToast('Đã nhận đường dẫn file kéo thả!', 'success');
      }
    });
  }

  if (btnEl && inputEl) {
    // 2. Click select file through powershell dialog API
    btnEl.addEventListener('click', async function (e) {
      e.preventDefault();
      btnEl.disabled = true;
      btnEl.textContent = 'Đang chọn...';

      try {
        var res = await fetch('/api/system/select-file');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var data = await res.json();
        
        if (data.success && data.filePath) {
          inputEl.value = data.filePath;
          showToast('Đã chọn file thành công!', 'success');
        } else if (data.cancelled) {
          showToast('Đã hủy chọn file', 'info');
        }
      } catch (err) {
        showToast('Không thể mở file explorer: ' + err.message, 'error');
      } finally {
        btnEl.disabled = false;
        btnEl.textContent = 'Chọn tệp...';
      }
    });
  }
}

