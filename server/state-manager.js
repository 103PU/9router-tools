// ═══════════════════════════════════════════════════════════
//  9Router Tools — State & Profiles Manager Module (Server)
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Data paths
const DATA_DIR = path.join(__dirname, '..', '.9router-data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.log');

// Setup data environment
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

// State Helper Functions
function createDefaultState() {
  return {
    version: 1,
    lastOpenedProfileId: null,
    profiles: [],
  };
}

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

function writeState(state) {
  const tmpFile = STATE_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpFile, STATE_FILE);
}

// Settings Helper Functions
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

// History Helper Functions
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

function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

module.exports = {
  DATA_DIR,
  STATE_FILE,
  BACKUPS_DIR,
  SETTINGS_FILE,
  HISTORY_FILE,
  ensureDataDirectories,
  readState,
  writeState,
  readSettings,
  writeSettings,
  writeHistoryLog,
  readHistoryLog,
  generateId
};
