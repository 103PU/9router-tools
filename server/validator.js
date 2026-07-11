// ═══════════════════════════════════════════════════════════
//  9Router Tools — Configuration Validator Module (Server)
// ═══════════════════════════════════════════════════════════

/**
 * Validates the schema of a 9Router configuration object.
 * Returns true if valid, throws an Error if invalid.
 */
function validateConfig(config) {
  if (config === null || config === undefined) {
    throw new Error('Cấu hình không được rỗng (null/undefined)');
  }

  if (typeof config !== 'object') {
    throw new Error('Cấu hình phải là một JSON Object hợp lệ');
  }

  // Ensure providerConnections is an array when present
  if (config.providerConnections !== undefined && !Array.isArray(config.providerConnections)) {
    throw new Error('Trường providerConnections phải là một danh sách (Array)');
  }

  // Basic validate inside providerConnections
  if (Array.isArray(config.providerConnections)) {
    for (let i = 0; i < config.providerConnections.length; i++) {
      const conn = config.providerConnections[i];
      if (!conn || typeof conn !== 'object') {
        throw new Error(`Phần tử thứ ${i + 1} trong danh sách kết nối không hợp lệ`);
      }
      if (!conn.name) {
        throw new Error(`Phần tử thứ ${i + 1} thiếu trường bắt buộc "name"`);
      }
    }
  }

  return true;
}

module.exports = {
  validateConfig
};
