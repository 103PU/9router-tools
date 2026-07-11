// ═══════════════════════════════════════════════════════════
//  9Router Tools — Backup & Restore Manager Module (Server)
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { BACKUPS_DIR, readState, writeState, readSettings, writeHistoryLog, generateId } = require('./state-manager');

// Shared locks reference (passed from main server or imported)
const writeLocks = {};

// Clean up backups that exceed retention policy
function cleanOldBackups(profileId) {
  const profileBackupDir = path.join(BACKUPS_DIR, profileId);
  if (!fs.existsSync(profileBackupDir)) return;

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
  } catch (err) {
    console.error('[Retention] Lỗi thực hiện dọn dẹp sao lưu:', err.message);
  }
}

// GET /api/profiles/{id}/backups
function handleGetBackups(req, res, profileId, jsonResponse) {
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
function handleRestoreBackup(req, res, profileId, backupName, jsonResponse) {
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
    const profileBackupDir = path.join(BACKUPS_DIR, profileId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const autoBackupPath = path.join(profileBackupDir, timestamp + '-pre-restore.json');

    if (fs.existsSync(profile.rootPath)) {
      fs.copyFileSync(profile.rootPath, autoBackupPath);
    }

    fs.copyFileSync(backupPath, tmpFile);
    fs.renameSync(tmpFile, profile.rootPath);

    const readBack = fs.readFileSync(profile.rootPath, 'utf-8');
    JSON.parse(readBack);

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
function handleDeleteBackup(req, res, profileId, backupName, jsonResponse) {
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
function handleExportBundle(req, res, profileId, jsonResponse) {
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
function handleImportBundle(req, res, parseBody, jsonResponse) {
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

module.exports = {
  writeLocks,
  cleanOldBackups,
  handleGetBackups,
  handleRestoreBackup,
  handleDeleteBackup,
  handleExportBundle,
  handleImportBundle
};
