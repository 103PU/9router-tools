// ═══════════════════════════════════════════════════════════
//  9Router Tools — Diff View & Account Edit Modals Module
// ═══════════════════════════════════════════════════════════

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
