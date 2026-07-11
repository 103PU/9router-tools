// ═══════════════════════════════════════════════════════════
//  9Router Tools — Accounts Table & Config list Module
// ═══════════════════════════════════════════════════════════

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

  // Sort list
  filteredList.sort(function (a, b) {
    var valA = a[currentSortField];
    var valB = b[currentSortField];
    
    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }
    
    if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Render sort icon direction indicators
  updateSortHeadersUI();

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
      statusBadgeHTML = '<span class="acc-badge new"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px; height:10px; margin-right:4px; vertical-align: middle;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Mới</span>';
    } else if (acc.status === 'update') {
      statusBadgeHTML = '<span class="acc-badge update"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px; height:10px; margin-right:4px; vertical-align: middle;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>Cập nhật</span>';
    } else {
      statusBadgeHTML = '<span class="acc-badge warning"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px; height:10px; margin-right:4px; vertical-align: middle;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Cảnh báo</span>';
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
      '<td style="padding: 8px 16px; text-align: right; position: relative; overflow: visible;">' +
        '<div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center;">' +
          pingHTML +
          '<div class="row-actions-wrapper" style="position: relative; display: inline-block;">' +
            '<button class="btn-more btn-row-more" style="width: 26px; height: 26px; font-size: 14px; display: flex; align-items: center; justify-content: center;" title="Thao tác">⋮</button>' +
            '<div class="row-actions-dropdown">' +
              '<div class="dropdown-item" data-row-action="diff">' +
                '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; margin-right: 6px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
                'Xem thay đổi' +
              '</div>' +
              (acc.status === 'warning' ? 
              '<div class="dropdown-item" data-row-action="edit-warning" style="color: var(--color-warning);">' +
                '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; margin-right: 6px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>' +
                'Sửa thông tin' +
              '</div>' : '') +
              '<div class="dropdown-item danger" data-row-action="delete">' +
                '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; margin-right: 6px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
                'Loại khỏi hàng đợi' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
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

    var btnRowMore = tr.querySelector('.btn-row-more');
    var rowDropdown = tr.querySelector('.row-actions-dropdown');
    btnRowMore.addEventListener('click', function (e) {
      e.stopPropagation();
      document.querySelectorAll('.row-actions-dropdown.active, .profile-card-dropdown.active').forEach(function (d) {
        if (d !== rowDropdown) d.classList.remove('active');
      });
      rowDropdown.classList.toggle('active');
    });

    rowDropdown.addEventListener('click', function (e) {
      e.stopPropagation();
      var actionItem = e.target.closest('[data-row-action]');
      if (!actionItem) return;

      var action = actionItem.dataset.rowAction;
      rowDropdown.classList.remove('active');

      if (action === 'diff') {
        showAccountDiffModal(acc);
      } else if (action === 'edit-warning') {
        showEditWarningModal(acc);
      } else if (action === 'delete') {
        removeAccountFromMerge(acc.id);
      }
    });

    document.addEventListener('click', function () {
      rowDropdown.classList.remove('active');
    });

    DOM.accountsTableBody.appendChild(tr);
  });

  updateHeaderCheckboxState();
}

function updateSortHeadersUI() {
  var fields = ['Name', 'Priority', 'Status'];
  fields.forEach(function (f) {
    var span = document.getElementById('sortIcon' + f);
    if (span) span.innerHTML = '';
  });

  var activeSpanId = 'sortIcon' + currentSortField.charAt(0).toUpperCase() + currentSortField.slice(1);
  var activeSpan = document.getElementById(activeSpanId);
  if (activeSpan) {
    var arrowIcon = currentSortDirection === 'asc'
      ? '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px; height:10px; margin-left:4px; vertical-align: middle;"><polyline points="18 15 12 9 6 15"/></svg>'
      : '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px; height:10px; margin-left:4px; vertical-align: middle;"><polyline points="6 9 12 15 18 9"/></svg>';
    activeSpan.innerHTML = arrowIcon;
  }
}

function handleHeaderSort(field) {
  if (currentSortField === field) {
    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortField = field;
    currentSortDirection = 'asc';
  }
  renderAccountCards();
}

function updateMergeSummaryText() {
  var activeAccounts = accountsList.filter(function (a) { return !a.excluded; });
  DOM.mergeSummary.textContent = 'Tổng: ' + accountsList.length + ' tài khoản hàng đợi (' + activeAccounts.length + ' sẽ được ghi đè, ' + (accountsList.length - activeAccounts.length) + ' loại trừ)';
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

// ─── PING & MANUAL ADD & RESET ───
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

// ─── IMPORT / EXPORT & MERGE SAVE ───
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

function triggerMerge() {
  if (!baseConfig || !importConfig) return;

  log('Đang tính toán gộp cấu hình với các luật mới...', 'system');

  mergedConfig = JSON.parse(JSON.stringify(baseConfig));

  var baseConns = mergedConfig.providerConnections || [];
  var importConns = importConfig.providerConnections || [];

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

    var warningFields = [];
    if (!name) warningFields.push('name');
    if (!newConn.provider) warningFields.push('provider');
    if (newConn.token === "") warningFields.push('token');

    var isWarning = warningFields.length > 0;

    var existingIndex = baseConns.findIndex(function (c) {
      return c.provider === provider && c.name === name;
    });

    var status = 'new';
    var changes = [];
    var originalData = null;

    if (existingIndex !== -1) {
      status = isWarning ? 'warning' : 'update';
      originalData = baseConns[existingIndex];
      
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

  DOM.updateCount.textContent = updateCount;
  DOM.newCount.textContent = newCount;
  
  var warnTabSpan = document.getElementById('warningCount');
  if (warnTabSpan) warnTabSpan.textContent = warningCount;

  updateMergeSummaryText();

  if (activeProfile) {
    localStorage.setItem('importConfig_' + activeProfile.id, JSON.stringify(importConfig));
  }

  renderAccountCards();
  DOM.workspace.classList.remove('hidden');
  DOM.emptyNoImport.classList.add('hidden');
  DOM.importSection.classList.add('hidden');

  log('Hoàn tất gộp. Phân tích: ' + newCount + ' thêm mới, ' + updateCount + ' cập nhật, ' + warningCount + ' cảnh báo.', 'success');
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
