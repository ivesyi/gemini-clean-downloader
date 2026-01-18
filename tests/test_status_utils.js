const assert = require('assert');

const { getStageFromStatus } = require('../status_utils');

assert.strictEqual(getStageFromStatus({ total: 3, success: 1, failed: 0, upload_total: 0, done: false }), 'clean');
assert.strictEqual(getStageFromStatus({ total: 3, success: 3, failed: 0, upload_total: 2, done: false }), 'upload');
assert.strictEqual(getStageFromStatus({ total: 3, success: 3, failed: 0, upload_total: 0, done: true }), 'clean');
assert.strictEqual(getStageFromStatus({ total: 3, success: 3, failed: 0, upload_total: 2, done: true }), 'upload');

console.log('ok');
