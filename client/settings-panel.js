// ═══════════════════════════════════════════════════════════
//  9Router Tools — System Configuration & Settings Module
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
  var themeColor = settings.themeAccentColor || 'cyan';
  if (themeColor === 'purple') {
    document.documentElement.style.setProperty('--accent-cyan', '#9d4edd');
    document.documentElement.style.setProperty('--border-glow', 'rgba(157, 78, 221, 0.2)');
  } else if (themeColor === 'emerald') {
    document.documentElement.style.setProperty('--accent-cyan', '#10b981');
    document.documentElement.style.setProperty('--border-glow', 'rgba(16, 185, 129, 0.2)');
  } else {
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
