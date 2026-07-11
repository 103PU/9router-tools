// ═══════════════════════════════════════════════════════════
//  9Router Tools — Backup System & History Logs Module
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
