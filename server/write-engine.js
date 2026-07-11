// ═══════════════════════════════════════════════════════════
//  9Router Tools — Write Engine Module (Server)
// ═══════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { writeLocks, cleanOldBackups } = require('./backup-manager');
const { BACKUPS_DIR, readState, writeState, readSettings, writeHistoryLog } = require('./state-manager');
const { validateConfig } = require('./validator');

// POST /api/save — Atomic Save Engine
function handleSave(req, res, parseBody, jsonResponse) {
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
    try {
      validateConfig(config);
    } catch (valErr) {
      return jsonResponse(res, 400, { success: false, error: 'Cấu hình không hợp lệ: ' + valErr.message });
    }

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
          // ignore
        }
        console.log(`[Backup] Đã sao lưu file gốc → ${backupPath}`);
      } else {
        fs.writeFileSync(backupPath, '{}', 'utf-8');
        console.log(`[Backup] File gốc chưa tồn tại, tạo backup marker → ${backupPath}`);
      }

      // Apply backup retention policy
      cleanOldBackups(profileId);

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
      JSON.parse(readBack);

      // --- Step 8: Update profile metadata in state ---
      const freshState = readState();
      const freshIndex = freshState.profiles.findIndex((p) => p.id === profileId);
      let summaryText = '';
      if (freshIndex !== -1) {
        freshState.profiles[freshIndex].lastWriteAt = new Date().toISOString();
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
      try {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
          console.log(`[Cleanup] Đã xoá temp file ${tmpFile}`);
        }
      } catch (_) {}

      console.error(`[Save] Lỗi ghi cho profile ${profileId}: ${writeErr.message}`);
      jsonResponse(res, 500, { success: false, error: 'Lỗi ghi file: ' + writeErr.message });
    } finally {
      delete writeLocks[profileId];
    }
  });
}

module.exports = {
  handleSave
};
