/**
 * Simple global collector manager to avoid multiple overlapping collectors.
 * Usage:
 * const manager = require('./collectorManager');
 * const collector = manager.create('key', message, options);
 * manager.stop('key', 'reason');
 */

function _ensureStore() {
  if (!globalThis.__collectorStore) globalThis.__collectorStore = {};
  return globalThis.__collectorStore;
}

function create(key, message, options = {}) {
  const store = _ensureStore();

  // stop previous collector with same key
  try {
    if (store[key]) {
      try { store[key].collector.stop('replaced'); } catch (e) { /* ignore */ }
      delete store[key];
    }
  } catch (e) { /* ignore */ }

  const collector = message.createMessageComponentCollector(options);
  store[key] = { collector, messageId: message.id };

  collector.on('end', () => {
    try {
      const cur = store[key];
      if (cur && cur.collector === collector) delete store[key];
    } catch (e) { /* ignore */ }
  });

  return collector;
}

function stop(key, reason = 'stopped') {
  const store = _ensureStore();
  if (!store[key]) return false;
  try {
    const { collector } = store[key];
    if (collector && typeof collector.stop === 'function') collector.stop(reason);
  } catch (e) { /* ignore */ }
  delete store[key];
  return true;
}

function getInfo(key) {
  const store = _ensureStore();
  return store[key];
}

module.exports = { create, stop, getInfo };