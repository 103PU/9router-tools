// ============================================================================
// 9Router Tools — Local Config Management Server (Phase 0+1)
// Zero-dependency HTTP server using only Node.js core modules.
// Binds to 127.0.0.1 ONLY for security.
// ============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PORT = 3000;
const HOST = '127.0.0.1';
const PUBLIC_DIR = __dirname;

// Data directory lives alongside the project
const DATA_DIR = path.join(__dirname, '.9router-data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.log');

// MIME types for the static file server
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

// In-memory write locks keyed by profileId → prevents concurrent writes
const writeLocks = {};

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

function createDefaultSettings() {
  return {
    retentionCount: 20,
    confirmBeforeWrite: true,
    serverPort: 3000,
    themeAccentColor: 'cyan',
  };
}

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.log('[Settings] Không đọc được settings.json, dùng mặc định');
  }
  const settings = createDefaultSettings();
  writeSettings(settings);
  return settings;
}

function writeSettings(settings) {
  const tmpFile = SETTINGS_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(settings, null, 2), 'utf-8');
  fs.renameSync(tmpFile, SETTINGS_FILE);
}

// ---------------------------------------------------------------------------
// History helpers
// ---------------------------------------------------------------------------

function writeHistoryLog(action, profileId, profileName, summary) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      profileId: profileId || null,
      profileName: profileName || null,
      summary: summary || ''
    };
    fs.appendFileSync(HISTORY_FILE, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (err) {
    console.error('[History] Lỗi ghi log:', err.message);
  }
}

function readHistoryLog() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    return lines.map(line => JSON.parse(line)).reverse().slice(0, 50);
  } catch (err) {
    console.error('[History] Lỗi đọc log:', err.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// State helpers — read / write state.json with atomic writes
// ---------------------------------------------------------------------------

/** Default empty state following schema v1 */
function createDefaultState() {
  return {
    version: 1,
    lastOpenedProfileId: null,
    profiles: [],
  };
}

/** Read state.json from disk. Returns parsed object. */
function readState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.log('[State] Không đọc được state.json, tạo mới mặc định');
    const state = createDefaultState();
    writeState(state);
    return state;
  }
}

/** Atomic write: temp file → rename */
function writeState(state) {
  const tmpFile = STATE_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpFile, STATE_FILE);
}

// ---------------------------------------------------------------------------
// Startup — ensure data directories and state file exist
// ---------------------------------------------------------------------------

function ensureDataDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('[Init] Đã tạo thư mục .9router-data/');
  }
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    console.log('[Init] Đã tạo thư mục backups/');
  }
  if (!fs.existsSync(STATE_FILE)) {
    writeState(createDefaultState());
    console.log('[Init] Đã tạo state.json mặc định');
  }
  if (!fs.existsSync(SETTINGS_FILE)) {
    writeSettings(createDefaultSettings());
    console.log('[Init] Đã tạo settings.json mặc định');
  }
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, '', 'utf-8');
    console.log('[Init] Đã tạo history.log mặc định');
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/** Send a JSON response */
function jsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/** Collect request body then invoke callback with parsed JSON */
function parseBody(req, callback) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
    // Limit body size to 10 MB to prevent abuse
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

/**
 * Extract a segment from the URL path.
 * E.g. /api/profiles/abc123/health → parts = ['', 'api', 'profiles', 'abc123', 'health']
 */
function urlParts(url) {
  // Strip query string if any
  const rawPath = url.split('?')[0];
  return rawPath.split('/');
}

/** Generate an 8-character hex ID */
function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

// ---------------------------------------------------------------------------
// API Route Handlers
// ---------------------------------------------------------------------------

// GET /api/status
function handleStatus(req, res) {
  jsonResponse(res, 200, { success: true, status: 'online' });
}

// GET /api/profiles
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

// POST /api/profiles — create a new profile
function handleCreateProfile(req, res) {
  parseBody(req, (err, data) => {
    if (err) return jsonResponse(res, 400, { success: false, error: err.message });

    const { name, rootPath, dataType } = data;

    // Validate required fields
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

// PUT /api/profiles/{id} — update an existing profile
function handleUpdateProfile(req, res, profileId) {
  parseBody(req, (err, data) => {
    if (err) return jsonResponse(res, 400, { success: false, error: err.message });

    const state = readState();
    const index = state.profiles.findIndex((p) => p.id === profileId);

    if (index === -1) {
      return jsonResponse(res, 404, { success: false, error: 'Không tìm thấy profile' });
    }

    // Only allow updating specific fields
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

// DELETE /api/profiles/{id} — delete a profile
function handleDeleteProfile(req, res, profileId) {
  const state = readState();
  const index = state.profiles.findIndex((p) => p.id === profileId);

  if (index === -1) {
    return jsonResponse(res, 404, { success: false, error: 'Không tìm thấy profile' });
  }

  const removed = state.profiles.splice(index, 1)[0];

  // If the deleted profile was the last opened, clear it
  if (state.lastOpenedProfileId === profileId) {
    state.lastOpenedProfileId = null;
  }

  writeState(state);

  // Cleanup backups folder for deleted profile
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

// GET /api/profiles/{id}/health — check if the rootPath file is accessible & valid JSON
function handleProfileHealth(req, res, profileId) {
  const state = readState();
  const profile = state.profiles.find((p) => p.id === profileId);

  if (!profile) {
    return jsonResponse(res, 404, { success: false, error: 'Không tìm thấy profile' });
  }

  try {
    // Check file exists and is readable
    fs.accessSync(profile.rootPath, fs.constants.R_OK | fs.constants.W_OK);

    // Check it is valid JSON
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

// GET /api/profiles/{id}/root-content — read and return parsed JSON from rootPath
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

// PUT /api/state/last-opened — set the last opened profile ID
function handleSetLastOpened(req, res) {
  parseBody(req, (err, data) => {
    if (err) return jsonResponse(res, 400, { success: false, error: err.message });

    const { profileId } = data;

    if (profileId !== null && typeof profileId !== 'string') {
      return jsonResponse(res, 400, { success: false, error: 'profileId phải là string hoặc null' });
    }

    const state = readState();

    // If profileId is provided (not null), verify profile exists
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

// POST /api/save — Write Engine with backup, atomic write, verification
function handleSave(req, res) {
  parseBody(req, (err, data) => {
    if (err) return jsonResponse(res, 400, { success: false, error: err.message });

    const { profileId, config } = data;

    // --- Step 1: Find profile ---
    if (!profileId || typeof profileId !== 'string') {
      return jsonResponse(res, 400, { success: false, error: 'profileId là bắt buộc' });
    }

    const state = readState();
    const profileIndex = state.profiles.findIndex((p) => p.id === profileId);

    if (profileIndex === -1) {
      return jsonResponse(res, 404, { success: false, error: 'Không tìm thấy profile' });
    }

    const profile = state.profiles[profileIndex];

    // --- Step 2: Validate config ---
    if (config === null || config === undefined) {
      return jsonResponse(res, 400, { success: false, error: 'Config data là bắt buộc (không được null)' });
    }

    // Ensure config is serializable (it came from JSON.parse so it should be, but double-check)
    let configString;
    try {
      configString = JSON.stringify(config, null, 2);
    } catch (serErr) {
      return jsonResponse(res, 400, { success: false, error: 'Config không thể serialize: ' + serErr.message });
    }

    // --- Concurrency lock ---
    if (writeLocks[profileId]) {
      console.log(`[Save] Conflict — profile ${profileId} đang được ghi bởi request khác`);
      return jsonResponse(res, 409, { success: false, error: 'Profile đang được ghi bởi request khác. Vui lòng thử lại.' });
    }
    writeLocks[profileId] = true;

    const tmpFile = profile.rootPath + '.tmp';
    let backupPath = null;

    try {
      // --- Step 3: Create backup of current file ---
      const profileBackupDir = path.join(BACKUPS_DIR, profileId);
      if (!fs.existsSync(profileBackupDir)) {
        fs.mkdirSync(profileBackupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      backupPath = path.join(profileBackupDir, timestamp + '.json');

      if (fs.existsSync(profile.rootPath)) {
        fs.copyFileSync(profile.rootPath, backupPath);
        try {
          const nowTime = new Date();
          fs.utimesSync(backupPath, nowTime, nowTime);
        } catch (utimeErr) {
          // ignore if utimes fails
        }
        console.log(`[Backup] Đã sao lưu file gốc → ${backupPath}`);
      } else {
        // If original file doesn't exist yet, create an empty backup marker
        fs.writeFileSync(backupPath, '{}', 'utf-8');
        console.log(`[Backup] File gốc chưa tồn tại, tạo backup marker → ${backupPath}`);
      }

      // Apply backup retention policy
      const settings = readSettings();
      const maxBackups = settings.retentionCount || 20;
      try {
        const files = fs.readdirSync(profileBackupDir)
          .filter(f => f.endsWith('.json'))
          .map(f => {
            const fp = path.join(profileBackupDir, f);
            return { name: f, path: fp, time: fs.statSync(fp).mtime.getTime() };
          })
          .sort((a, b) => a.time - b.time); // Oldest first

        if (files.length > maxBackups) {
          const toDelete = files.slice(0, files.length - maxBackups);
          for (const f of toDelete) {
            fs.unlinkSync(f.path);
            console.log(`[Retention] Đã dọn dẹp bản sao lưu cũ: ${f.name}`);
          }
        }
      } catch (retentionErr) {
        console.error('[Retention] Lỗi thực hiện dọn dẹp sao lưu:', retentionErr.message);
      }

      // --- Step 4: Verify backup ---
      const backupStat = fs.statSync(backupPath);
      if (backupStat.size === 0) {
        throw new Error('Backup file có kích thước 0 byte — hủy ghi');
      }

      // --- Step 5: Write to temp file ---
      fs.writeFileSync(tmpFile, configString, 'utf-8');

      // --- Step 6: Atomic rename temp → target ---
      fs.renameSync(tmpFile, profile.rootPath);
      console.log(`[Save] Đã ghi atomic vào ${profile.rootPath}`);

      // --- Step 7: Read back and verify ---
      const readBack = fs.readFileSync(profile.rootPath, 'utf-8');
      JSON.parse(readBack); // Will throw if not valid JSON

      // --- Step 8: Update profile metadata in state ---
      const freshState = readState();
      const freshIndex = freshState.profiles.findIndex((p) => p.id === profileId);
      let summaryText = '';
      if (freshIndex !== -1) {
        freshState.profiles[freshIndex].lastWriteAt = new Date().toISOString();

        // Generate a brief write summary
        const configKeys = typeof config === 'object' && config !== null ? Object.keys(config) : [];
        summaryText = `Ghi ${configString.length} bytes, ${configKeys.length} keys cấp cao nhất`;
        freshState.profiles[freshIndex].lastWriteSummary = summaryText;

        writeState(freshState);
      }

      // --- Step 9: Return success ---
      console.log(`[Save] Hoàn tất ghi cho profile "${profile.name}" (${profileId})`);
      writeHistoryLog('Ghi đè cấu hình', profileId, profile.name, summaryText || 'Ghi đè cấu hình thành công');
      jsonResponse(res, 200, { success: true, backupPath });
    } catch (writeErr) {
      // Clean up temp file if it exists
      try {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
          console.log(`[Cleanup] Đã xoá temp file ${tmpFile}`);
        }
      } catch (_) {
        // Ignore cleanup errors
      }

      console.error(`[Save] Lỗi ghi cho profile ${profileId}: ${writeErr.message}`);
      jsonResponse(res, 500, { success: false, error: 'Lỗi ghi file: ' + writeErr.message });
    } finally {
      // Always release the lock
      delete writeLocks[profileId];
    }
  });
}

// ---------------------------------------------------------------------------
// Settings API Handlers
// ---------------------------------------------------------------------------

// GET /api/settings
function handleGetSettings(req, res) {
  const settings = readSettings();
  jsonResponse(res, 200, { success: true, settings });
}

// PUT /api/settings
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

// ---------------------------------------------------------------------------
// History API Handlers
// ---------------------------------------------------------------------------

// GET /api/history
function handleGetHistory(req, res) {
  const history = readHistoryLog();
  jsonResponse(res, 200, { success: true, history });
}

// ---------------------------------------------------------------------------
// Backup API Handlers
// ---------------------------------------------------------------------------

// GET /api/profiles/{id}/backups
function handleGetBackups(req, res, profileId) {
  const state = readState();
  const profile = state.profiles.find(p => p.id === profileId);
  if (!profile) return jsonResponse(res, 404, { success: false, error: 'Không tìm thấy profile' });

  const profileBackupDir = path.join(BACKUPS_DIR, profileId);
  if (!fs.existsSync(profileBackupDir)) {
    return jsonResponse(res, 200, { success: true, backups: [] });
  }

  try {
    const files = fs.readdirSync(profileBackupDir);
    const backups = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(profileBackupDir, file);
        const stat = fs.statSync(filePath);
        return {
          filename: file,
          size: stat.size,
          timestamp: stat.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Newest first

    jsonResponse(res, 200, { success: true, backups });
  } catch (err) {
    jsonResponse(res, 500, { success: false, error: 'Lỗi đọc danh sách backup: ' + err.message });
  }
}

// POST /api/profiles/{id}/backups/{backupName}/restore
function handleRestoreBackup(req, res, profileId, backupName) {
  const state = readState();
  const profile = state.profiles.find(p => p.id === profileId);
  if (!profile) return jsonResponse(res, 404, { success: false, error: 'Không tìm thấy profile' });

  const backupPath = path.join(BACKUPS_DIR, profileId, backupName);
  if (!fs.existsSync(backupPath)) {
    return jsonResponse(res, 404, { success: false, error: 'Không tìm thấy tệp tin backup' });
  }

  if (writeLocks[profileId]) {
    return jsonResponse(res, 409, { success: false, error: 'Profile đang được ghi bởi request khác' });
  }
  writeLocks[profileId] = true;

  const tmpFile = profile.rootPath + '.tmp';
  try {
    // Write verification backup of current file before restoring
    const profileBackupDir = path.join(BACKUPS_DIR, profileId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const autoBackupPath = path.join(profileBackupDir, timestamp + '-pre-restore.json');

    if (fs.existsSync(profile.rootPath)) {
      fs.copyFileSync(profile.rootPath, autoBackupPath);
    }

    // Atomic write from backup to target
    fs.copyFileSync(backupPath, tmpFile);
    fs.renameSync(tmpFile, profile.rootPath);

    // Read back verification
    const readBack = fs.readFileSync(profile.rootPath, 'utf-8');
    JSON.parse(readBack);

    // Update state metadata
    const freshState = readState();
    const idx = freshState.profiles.findIndex(p => p.id === profileId);
    if (idx !== -1) {
      freshState.profiles[idx].lastWriteAt = new Date().toISOString();
      freshState.profiles[idx].lastWriteSummary = `Khôi phục từ bản sao lưu: ${backupName}`;
      writeState(freshState);
    }

    writeHistoryLog('Khôi phục sao lưu', profileId, profile.name, `Khôi phục từ bản sao lưu: ${backupName}`);
    jsonResponse(res, 200, { success: true });
  } catch (err) {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch(_) {}
    jsonResponse(res, 500, { success: false, error: 'Lỗi khôi phục sao lưu: ' + err.message });
  } finally {
    delete writeLocks[profileId];
  }
}

// DELETE /api/profiles/{id}/backups/{backupName}
function handleDeleteBackup(req, res, profileId, backupName) {
  const state = readState();
  const profile = state.profiles.find(p => p.id === profileId);
  if (!profile) return jsonResponse(res, 404, { success: false, error: 'Không tìm thấy profile' });

  const backupPath = path.join(BACKUPS_DIR, profileId, backupName);
  if (!fs.existsSync(backupPath)) {
    return jsonResponse(res, 404, { success: false, error: 'Không tìm thấy bản sao lưu' });
  }

  try {
    fs.unlinkSync(backupPath);
    writeHistoryLog('Xoá sao lưu', profileId, profile.name, `Xoá bản sao lưu: ${backupName}`);
    jsonResponse(res, 200, { success: true });
  } catch (err) {
    jsonResponse(res, 500, { success: false, error: 'Lỗi xoá bản sao lưu: ' + err.message });
  }
}

// GET /api/profiles/{id}/export-bundle
function handleExportBundle(req, res, profileId) {
  const state = readState();
  const profile = state.profiles.find(p => p.id === profileId);
  if (!profile) return jsonResponse(res, 404, { success: false, error: 'Không tìm thấy profile' });

  const profileBackupDir = path.join(BACKUPS_DIR, profileId);
  const backups = [];
  try {
    if (fs.existsSync(profileBackupDir)) {
      const files = fs.readdirSync(profileBackupDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(profileBackupDir, file);
          const stat = fs.statSync(filePath);
          const content = fs.readFileSync(filePath, 'utf-8');
          backups.push({
            filename: file,
            size: stat.size,
            timestamp: stat.mtime.toISOString(),
            content: content
          });
        }
      }
    }
  } catch (err) {
    console.error('[Export Bundle] Lỗi đọc backups:', err.message);
  }

  const bundle = {
    version: 1,
    profile: {
      name: profile.name,
      dataType: profile.dataType,
      note: profile.note,
      rootPath: profile.rootPath
    },
    backups: backups
  };

  jsonResponse(res, 200, { success: true, bundle });
}

// POST /api/profiles/import-bundle
function handleImportBundle(req, res) {
  parseBody(req, (err, data) => {
    if (err) return jsonResponse(res, 400, { success: false, error: err.message });

    const { bundle } = data;
    if (!bundle || !bundle.profile) {
      return jsonResponse(res, 400, { success: false, error: 'Bundle không hợp lệ' });
    }

    const newProfileId = generateId();
    const importedProfile = {
      id: newProfileId,
      name: bundle.profile.name + ' (Imported)',
      rootPath: bundle.profile.rootPath,
      dataType: bundle.profile.dataType || 'account-config',
      createdAt: new Date().toISOString(),
      lastWriteAt: null,
      lastWriteSummary: null,
      note: bundle.profile.note || ''
    };

    const state = readState();
    state.profiles.push(importedProfile);
    writeState(state);

    // Ghi lại các file backup
    if (Array.isArray(bundle.backups)) {
      const profileBackupDir = path.join(BACKUPS_DIR, newProfileId);
      if (!fs.existsSync(profileBackupDir)) {
        fs.mkdirSync(profileBackupDir, { recursive: true });
      }
      for (const backup of bundle.backups) {
        if (backup.filename && backup.content) {
          const safeName = path.basename(backup.filename);
          const backupPath = path.join(profileBackupDir, safeName);
          fs.writeFileSync(backupPath, backup.content, 'utf-8');
          if (backup.timestamp) {
            try {
              const mtime = new Date(backup.timestamp);
              fs.utimesSync(backupPath, mtime, mtime);
            } catch (e) {}
          }
        }
      }
    }

    console.log(`[Profile] Đã import profile bundle "${importedProfile.name}" (${newProfileId})`);
    writeHistoryLog('Import Profile Bundle', newProfileId, importedProfile.name, 'Đã nhập profile và các bản sao lưu từ bundle');
    jsonResponse(res, 201, { success: true, profile: importedProfile });
  });
}

function handleSelectFile(req, res) {
  // PowerShell script to launch a File Open Dialog on Windows
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


// ---------------------------------------------------------------------------
// Router — match request to handler
// ---------------------------------------------------------------------------

function routeAPI(req, res) {
  const method = req.method;
  const parts = urlParts(req.url);
  // parts: ['', 'api', ...]

  // GET /api/system/select-file
  if (method === 'GET' && parts.length === 4 && parts[1] === 'api' && parts[2] === 'system' && parts[3] === 'select-file') {
    return handleSelectFile(req, res);
  }

  // GET /api/status
  if (method === 'GET' && parts.length === 3 && parts[1] === 'api' && parts[2] === 'status') {
    return handleStatus(req, res);
  }

  // GET /api/profiles
  if (method === 'GET' && parts.length === 3 && parts[1] === 'api' && parts[2] === 'profiles') {
    return handleGetProfiles(req, res);
  }

  // POST /api/profiles/import-bundle
  if (method === 'POST' && parts.length === 4 && parts[1] === 'api' && parts[2] === 'profiles' && parts[3] === 'import-bundle') {
    return handleImportBundle(req, res);
  }

  // POST /api/profiles
  if (method === 'POST' && parts.length === 3 && parts[1] === 'api' && parts[2] === 'profiles') {
    return handleCreateProfile(req, res);
  }

  // GET /api/state/last-opened
  if (method === 'GET' && parts.length === 4 && parts[1] === 'api' && parts[2] === 'state' && parts[3] === 'last-opened') {
    const state = readState();
    return jsonResponse(res, 200, { success: true, profileId: state.lastOpenedProfileId });
  }

  // PUT /api/state/last-opened
  if (method === 'PUT' && parts.length === 4 && parts[1] === 'api' && parts[2] === 'state' && parts[3] === 'last-opened') {
    return handleSetLastOpened(req, res);
  }

  // POST /api/save
  if (method === 'POST' && parts.length === 3 && parts[1] === 'api' && parts[2] === 'save') {
    return handleSave(req, res);
  }

  // GET /api/settings
  if (method === 'GET' && parts.length === 3 && parts[1] === 'api' && parts[2] === 'settings') {
    return handleGetSettings(req, res);
  }

  // PUT /api/settings
  if (method === 'PUT' && parts.length === 3 && parts[1] === 'api' && parts[2] === 'settings') {
    return handleUpdateSettings(req, res);
  }

  // GET /api/history
  if (method === 'GET' && parts.length === 3 && parts[1] === 'api' && parts[2] === 'history') {
    return handleGetHistory(req, res);
  }

  // Routes with profile ID: /api/profiles/{id}[/sub-resource]
  if (parts.length >= 4 && parts[1] === 'api' && parts[2] === 'profiles') {
    const profileId = parts[3];

    // PUT /api/profiles/{id}
    if (method === 'PUT' && parts.length === 4) {
      return handleUpdateProfile(req, res, profileId);
    }

    // DELETE /api/profiles/{id}
    if (method === 'DELETE' && parts.length === 4) {
      return handleDeleteProfile(req, res, profileId);
    }

    // GET /api/profiles/{id}/health
    if (method === 'GET' && parts.length === 5 && parts[4] === 'health') {
      return handleProfileHealth(req, res, profileId);
    }

    // GET /api/profiles/{id}/root-content
    if (method === 'GET' && parts.length === 5 && parts[4] === 'root-content') {
      return handleRootContent(req, res, profileId);
    }

    // GET /api/profiles/{id}/backups
    if (method === 'GET' && parts.length === 5 && parts[4] === 'backups') {
      return handleGetBackups(req, res, profileId);
    }

    // DELETE /api/profiles/{id}/backups/{backupName}
    if (method === 'DELETE' && parts.length === 6 && parts[4] === 'backups') {
      const backupName = parts[5];
      return handleDeleteBackup(req, res, profileId, backupName);
    }

    // GET /api/profiles/{id}/export-bundle
    if (method === 'GET' && parts.length === 5 && parts[4] === 'export-bundle') {
      return handleExportBundle(req, res, profileId);
    }

    // POST /api/profiles/{id}/backups/{backupName}/restore
    if (method === 'POST' && parts.length === 7 && parts[4] === 'backups' && parts[6] === 'restore') {
      const backupName = parts[5];
      return handleRestoreBackup(req, res, profileId, backupName);
    }
  }

  // No matching API route
  return false;
}

// ---------------------------------------------------------------------------
// Static file server
// ---------------------------------------------------------------------------

function serveStaticFile(req, res) {
  const urlPath = req.url.split('?')[0]; // strip query string
  let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);

  // Resolve to prevent directory traversal, then verify it's within PUBLIC_DIR
  filePath = path.resolve(filePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const extname = path.extname(filePath);
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}

// ---------------------------------------------------------------------------
// Main server
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  // Try API routes first; if none matched, serve static file
  if (req.url.startsWith('/api/')) {
    const handled = routeAPI(req, res);
    if (handled === false) {
      jsonResponse(res, 404, { success: false, error: 'API endpoint không tồn tại' });
    }
  } else {
    serveStaticFile(req, res);
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

ensureDataDirectories();

server.listen(PORT, HOST, () => {
  console.log(`🚀 9Router Tools server đang chạy tại http://${HOST}:${PORT}`);
  console.log(`📂 Data directory: ${DATA_DIR}`);
  console.log(`📄 State file: ${STATE_FILE}`);
});
