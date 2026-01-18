const assert = require('assert');

const { resolveDownloadSubdir } = require('../path_utils');

const DEFAULT = 'Gemini-Originals';
assert.strictEqual(resolveDownloadSubdir('Originals', DEFAULT), 'Originals');
assert.strictEqual(resolveDownloadSubdir('  Originals  ', DEFAULT), 'Originals');
assert.strictEqual(resolveDownloadSubdir('/Originals/', DEFAULT), 'Originals');
assert.strictEqual(resolveDownloadSubdir('\\Originals\\', DEFAULT), 'Originals');
assert.strictEqual(resolveDownloadSubdir('', DEFAULT), DEFAULT);
assert.strictEqual(resolveDownloadSubdir(null, DEFAULT), DEFAULT);
assert.strictEqual(resolveDownloadSubdir(undefined, DEFAULT), DEFAULT);

console.log('ok');
