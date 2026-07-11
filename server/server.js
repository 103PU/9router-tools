// ═══════════════════════════════════════════════════════════
//  9Router Tools — Core HTTP Server Entry Point (Server)
// ═══════════════════════════════════════════════════════════

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, execFile } = require('child_process');

const {
  ensureDataDirectories,
  readState,
  writeState,
  readSettings,
  writeSettings,
  writeHistoryLog,
  readHistoryLog,
  generateId,
  BACKUPS_DIR
} = require('./state-manager');

const {
  handleGetBackups,
  handleRestoreBackup,
  handleDeleteBackup,
  handleExportBundle,
  handleImportBundle
} = require('./backup-manager');

const { handleSave } = require('./write-engine');

const PORT = 3000;
const HOST = '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// ─── HELPER RESPONSES ───
function jsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseBody(req, callback) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
    if (body.length > 10 * 1024 * 1024) {
      req.destroy();
    }
  });
  req.on('end', () => {
    try {
      const parsed = body.length > 0 ? JSON.parse(body) : {};
      callback(null, parsed);
    } catch (err) {
      callback(new Error('Invalid JSON in request body'));
    }
  });
}

function urlParts(url) {
  const rawPath = url.split('?')[0];
  return rawPath.split('/');
}

// ─── API HANDLERS ───
function handleStatus(req, res) {
  jsonResponse(res, 200, { success: true, status: 'online' });
}

function handleGetProfiles(req, res) {
  const state = readState();
  const profiles = state.profiles.map(p => {
    let backupCount = 0;
    try {
      const profileBackupDir = path.join(BACKUPS_DIR, p.id);
      if (fs.existsSync(profileBackupDir)) {
        backupCount = fs.readdirSync(profileBackupDir).filter(f => f.endsWith('.json')).length;
      }
    } catch (_) {}
    return Object.assign({}, p, { backupCount });
  });
  jsonResponse(res, 200, { success: true, profiles });
}

function handleCreateProfile(req, res) {
  parseBody(req, (err, data) => {
    if (err) return jsonResponse(res, 400, { success: false, error: err.message });
    const { name, rootPath, dataType } = data;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return jsonResponse(res, 400, { success: false, error: 'Tên profile (name) là bắt buộc' });
    }
    if (!rootPath || typeof rootPath !== 'string' || rootPath.trim().length === 0) {
      return jsonResponse(res, 400, { success: false, error: 'Đường dẫn gốc (rootPath) là bắt buộc' });
    }
    if (!dataType || typeof dataType !== 'string' || dataType.trim().length === 0) {
      return jsonResponse(res, 400, { success: false, error: 'Loại dữ liệu (dataType) là bắt buộc' });
    }

    const profile = {
      id: generateId(),
      name: name.trim(),
      rootPath: rootPath.trim(),
      dataType: dataType.trim(),
      createdAt: new Date().toISOString(),
      lastWriteAt: null,
      lastWriteSummary: null,
      note: '',
    };

    const state = readState();
    state.profiles.push(profile);
    writeState(state);

    console.log(`[Profile] Đã tạo profile "${profile.name}" (${profile.id})`);
    writeHistoryLog('Tạo Profile', profile.id, profile.name, `Tạo mới profile với đường dẫn: ${profile.rootPath}`);
    jsonResponse(res, 201, { success: true, profile });
  });
}

function handleUpdateProfile(req, res, profileId) {
  parseBody(req, (err, data) => {
    if (err) return jsonResponse(res, 400, { success: false, error: err.message });

    const state = readState();
    const index = state.profiles.findIndex((p) => p.id === profileId);

    if (index === -1) {
      return jsonResponse(res, 404, { success: false, error: 'Không tìm thấy profile' });
    }

    const allowedFields = ['name', 'rootPath', 'dataType', 'note'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        state.profiles[index][field] = data[field];
      }
    }

    writeState(state);

    console.log(`[Profile] Đã cập nhật profile "${state.profiles[index].name}" (${profileId})`);
    writeHistoryLog('Cập nhật Profile', profileId, state.profiles[index].name, 'Cập nhật thông tin profile');
    jsonResponse(res, 200, { success: true, profile: state.profiles[index] });
  });
}

function handleDeleteProfile(req, res, profileId) {
  const state = readState();
  const index = state.profiles.findIndex((p) => p.id === profileId);

  if (index === -1) {
    return jsonResponse(res, 404, { success: false, error: 'Không tìm thấy profile' });
  }

  const removed = state.profiles.splice(index, 1)[0];

  if (state.lastOpenedProfileId === profileId) {
    state.lastOpenedProfileId = null;
  }

  writeState(state);

  const profileBackupDir = path.join(BACKUPS_DIR, profileId);
  try {
    if (fs.existsSync(profileBackupDir)) {
      const files = fs.readdirSync(profileBackupDir);
      for (const file of files) {
        fs.unlinkSync(path.join(profileBackupDir, file));
      }
      fs.rmdirSync(profileBackupDir);
      console.log(`[Cleanup] Đã dọn dẹp thư mục backups cho profile ${profileId}`);
    }
  } catch (err) {
    console.error(`[Cleanup] Lỗi dọn dẹp backups khi xoá profile: ${err.message}`);
  }

  console.log(`[Profile] Đã xoá profile "${removed.name}" (${profileId})`);
  writeHistoryLog('Xoá Profile', profileId, removed.name, 'Đã xoá profile và toàn bộ bản sao lưu liên quan');
  jsonResponse(res, 200, { success: true });
}

function handleProfileHealth(req, res, profileId) {
  const state = readState();
  const profile = state.profiles.find((p) => p.id === profileId);

  if (!profile) {
    return jsonResponse(res, 404, { success: false, error: 'Không tìm thấy profile' });
  }

  try {
    fs.accessSync(profile.rootPath, fs.constants.R_OK | fs.constants.W_OK);
    const raw = fs.readFileSync(profile.rootPath, 'utf-8');
    JSON.parse(raw);
    jsonResponse(res, 200, { success: true, healthy: true });
  } catch (err) {
    const errorMessage =
      err.code === 'ENOENT'
        ? `File không tồn tại: ${profile.rootPath}`
        : err instanceof SyntaxError
        ? `File không phải JSON hợp lệ: ${err.message}`
        : `Không truy cập được file: ${err.message}`;

    jsonResponse(res, 200, { success: true, healthy: false, error: errorMessage });
  }
}

function handleRootContent(req, res, profileId) {
  const state = readState();
  const profile = state.profiles.find((p) => p.id === profileId);

  if (!profile) {
    return jsonResponse(res, 404, { success: false, error: 'Không tìm thấy profile' });
  }

  try {
    const raw = fs.readFileSync(profile.rootPath, 'utf-8');
    const config = JSON.parse(raw);
    jsonResponse(res, 200, { success: true, config });
  } catch (err) {
    const errorMessage =
      err.code === 'ENOENT'
        ? `File không tồn tại: ${profile.rootPath}`
        : err instanceof SyntaxError
        ? `File không phải JSON hợp lệ: ${err.message}`
        : `Lỗi đọc file: ${err.message}`;

    console.log(`[Read] Lỗi đọc root-content cho profile ${profileId}: ${errorMessage}`);
    jsonResponse(res, 500, { success: false, error: errorMessage });
  }
}

function handleSetLastOpened(req, res) {
  parseBody(req, (err, data) => {
    if (err) return jsonResponse(res, 400, { success: false, error: err.message });
    const { profileId } = data;

    if (profileId !== null && typeof profileId !== 'string') {
      return jsonResponse(res, 400, { success: false, error: 'profileId phải là string hoặc null' });
    }

    const state = readState();
    if (profileId !== null) {
      const exists = state.profiles.some((p) => p.id === profileId);
      if (!exists) {
        return jsonResponse(res, 404, { success: false, error: 'Không tìm thấy profile' });
      }
    }

    state.lastOpenedProfileId = profileId;
    writeState(state);

    console.log(`[State] Đã cập nhật lastOpenedProfileId = ${profileId}`);
    jsonResponse(res, 200, { success: true });
  });
}

function handleGetSettings(req, res) {
  const settings = readSettings();
  jsonResponse(res, 200, { success: true, settings });
}

function handleUpdateSettings(req, res) {
  parseBody(req, (err, data) => {
    if (err) return jsonResponse(res, 400, { success: false, error: err.message });
    const settings = readSettings();
    const allowed = ['retentionCount', 'confirmBeforeWrite', 'themeAccentColor'];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        settings[key] = data[key];
      }
    }
    writeSettings(settings);
    writeHistoryLog('Cập nhật Settings', null, null, 'Cập nhật cấu hình hệ thống');
    jsonResponse(res, 200, { success: true, settings });
  });
}

function handleGetHistory(req, res) {
  const history = readHistoryLog();
  jsonResponse(res, 200, { success: true, history });
}

function handleSelectFile(req, res) {
  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms;
    $f = New-Object System.Windows.Forms.OpenFileDialog;
    $f.Filter = 'JSON Files (*.json)|*.json|All Files (*.*)|*.*';
    $f.Title = 'Chọn file cấu hình gốc (Root Path)';
    $f.ShowHelp = $false;
    $f.Multiselect = $false;
    if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        Write-Output $f.FileName
    }
  `.replace(/\n/g, ' ').trim();

  const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('[System] Lỗi mở File Dialog:', error);
      return jsonResponse(res, 500, { error: 'Không thể mở File Dialog: ' + error.message });
    }
    const selectedPath = stdout.trim();
    if (!selectedPath) {
      return jsonResponse(res, 200, { success: true, cancelled: true });
    }
    return jsonResponse(res, 200, { success: true, filePath: selectedPath });
  });
}

function handleOpenFolder(req, res) {
  const queryString = req.url.split('?')[1] || '';
  const params = {};
  queryString.split('&').forEach(pair => {
    const parts = pair.split('=');
    if (parts[0]) {
      params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
    }
  });

  const filePath = params.path;
  if (!filePath) {
    return jsonResponse(res, 400, { error: 'Thiếu tham số path' });
  }

  // 1. Security Check: Validate filePath must match rootPath of a registered profile
  const state = readState();
  const profileExists = state.profiles.some(p => p.rootPath === filePath);
  if (!profileExists) {
    console.warn(`[Security] Cảnh báo: Yêu cầu truy cập thư mục của file không hợp lệ: ${filePath}`);
    return jsonResponse(res, 403, { error: 'Quyền truy cập bị từ chối: Đường dẫn không thuộc Profile nào đã đăng ký.' });
  }

  // 2. Lấy thư mục cha chứa file theo đúng spec mới
  const parentDir = path.dirname(filePath);

  // 3. Security Check: Sử dụng execFile thay vì exec với string nội suy
  execFile('explorer.exe', [parentDir], (error) => {
    if (error && error.code !== 1) {
      console.error('[System] Lỗi mở thư mục:', error);
      return jsonResponse(res, 500, { error: 'Không thể mở thư mục: ' + error.message });
    }
    return jsonResponse(res, 200, { success: true });
  });
}

// ─── API ROUTER ───
function routeAPI(req, res) {
  const method = req.method;
  const parts = urlParts(req.url);

  // GET /api/system/open-folder
  if (method === 'GET' && parts.length === 4 && parts[1] === 'api' && parts[2] === 'system' && parts[3] === 'open-folder') {
    handleOpenFolder(req, res);
    return true;
  }

  // GET /api/system/select-file
  if (method === 'GET' && parts.length === 4 && parts[1] === 'api' && parts[2] === 'system' && parts[3] === 'select-file') {
    handleSelectFile(req, res);
    return true;
  }

  // GET /api/status
  if (method === 'GET' && parts.length === 3 && parts[1] === 'api' && parts[2] === 'status') {
    handleStatus(req, res);
    return true;
  }

  // GET /api/profiles
  if (method === 'GET' && parts.length === 3 && parts[1] === 'api' && parts[2] === 'profiles') {
    handleGetProfiles(req, res);
    return true;
  }

  // POST /api/profiles/import-bundle
  if (method === 'POST' && parts.length === 4 && parts[1] === 'api' && parts[2] === 'profiles' && parts[3] === 'import-bundle') {
    handleImportBundle(req, res, parseBody, jsonResponse);
    return true;
  }

  // POST /api/profiles
  if (method === 'POST' && parts.length === 3 && parts[1] === 'api' && parts[2] === 'profiles') {
    handleCreateProfile(req, res);
    return true;
  }

  // GET /api/state/last-opened
  if (method === 'GET' && parts.length === 4 && parts[1] === 'api' && parts[2] === 'state' && parts[3] === 'last-opened') {
    const state = readState();
    jsonResponse(res, 200, { success: true, profileId: state.lastOpenedProfileId });
    return true;
  }

  // PUT /api/state/last-opened
  if (method === 'PUT' && parts.length === 4 && parts[1] === 'api' && parts[2] === 'state' && parts[3] === 'last-opened') {
    handleSetLastOpened(req, res);
    return true;
  }

  // POST /api/save
  if (method === 'POST' && parts.length === 3 && parts[1] === 'api' && parts[2] === 'save') {
    handleSave(req, res, parseBody, jsonResponse);
    return true;
  }

  // GET /api/settings
  if (method === 'GET' && parts.length === 3 && parts[1] === 'api' && parts[2] === 'settings') {
    handleGetSettings(req, res);
    return true;
  }

  // PUT /api/settings
  if (method === 'PUT' && parts.length === 3 && parts[1] === 'api' && parts[2] === 'settings') {
    handleUpdateSettings(req, res);
    return true;
  }

  // GET /api/history
  if (method === 'GET' && parts.length === 3 && parts[1] === 'api' && parts[2] === 'history') {
    handleGetHistory(req, res);
    return true;
  }

  // Routes with profile ID
  if (parts.length >= 4 && parts[1] === 'api' && parts[2] === 'profiles') {
    const profileId = parts[3];

    // PUT /api/profiles/{id}
    if (method === 'PUT' && parts.length === 4) {
      handleUpdateProfile(req, res, profileId);
      return true;
    }

    // DELETE /api/profiles/{id}
    if (method === 'DELETE' && parts.length === 4) {
      handleDeleteProfile(req, res, profileId);
      return true;
    }

    // GET /api/profiles/{id}/health
    if (method === 'GET' && parts.length === 5 && parts[4] === 'health') {
      handleProfileHealth(req, res, profileId);
      return true;
    }

    // GET /api/profiles/{id}/root-content
    if (method === 'GET' && parts.length === 5 && parts[4] === 'root-content') {
      handleRootContent(req, res, profileId);
      return true;
    }

    // GET /api/profiles/{id}/backups
    if (method === 'GET' && parts.length === 5 && parts[4] === 'backups') {
      handleGetBackups(req, res, profileId, jsonResponse);
      return true;
    }

    // DELETE /api/profiles/{id}/backups/{backupName}
    if (method === 'DELETE' && parts.length === 6 && parts[4] === 'backups') {
      const backupName = parts[5];
      handleDeleteBackup(req, res, profileId, backupName, jsonResponse);
      return true;
    }

    // GET /api/profiles/{id}/export-bundle
    if (method === 'GET' && parts.length === 5 && parts[4] === 'export-bundle') {
      handleExportBundle(req, res, profileId, jsonResponse);
      return true;
    }

    // POST /api/profiles/{id}/backups/{backupName}/restore
    if (method === 'POST' && parts.length === 7 && parts[4] === 'backups' && parts[6] === 'restore') {
      const backupName = parts[5];
      handleRestoreBackup(req, res, profileId, backupName, jsonResponse);
      return true;
    }
  }

  return false;
}

// ─── STATIC FILE SERVER ───
function serveStaticFile(req, res) {
  let pathname = req.url.split('?')[0];
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File không tồn tại');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Lỗi server: ' + readErr.message);
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  });
}

// ─── MAIN SERVER ───
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    const handled = routeAPI(req, res);
    if (!handled) {
      jsonResponse(res, 404, { success: false, error: 'API endpoint không tồn tại' });
    }
  } else {
    serveStaticFile(req, res);
  }
});

ensureDataDirectories();

server.listen(PORT, HOST, () => {
  console.log(`[Server] 9Router Tools server đang chạy tại http://${HOST}:${PORT}`);
  console.log(`[Server] Data directory: ${BACKUPS_DIR.replace('backups', '')}`);
});
