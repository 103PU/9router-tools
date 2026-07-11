// ═══════════════════════════════════════════════════════════
//  9Router Tools — Path Manager Module
// ═══════════════════════════════════════════════════════════

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
