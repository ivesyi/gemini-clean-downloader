const assert = require('assert');

const { resolveDownloadSubdir, buildPreviewPaths } = require('../path_utils');

const DEFAULT = 'Gemini-Originals';
const DEFAULT_OUT = 'Gemini-Clean';

assert.strictEqual(resolveDownloadSubdir('Originals', DEFAULT), 'Originals');
assert.strictEqual(resolveDownloadSubdir('  Originals  ', DEFAULT), 'Originals');
assert.strictEqual(resolveDownloadSubdir('/Originals/', DEFAULT), 'Originals');
assert.strictEqual(resolveDownloadSubdir('\\Originals\\', DEFAULT), 'Originals');
assert.strictEqual(resolveDownloadSubdir('', DEFAULT), DEFAULT);
assert.strictEqual(resolveDownloadSubdir(null, DEFAULT), DEFAULT);
assert.strictEqual(resolveDownloadSubdir(undefined, DEFAULT), DEFAULT);

const preview = buildPreviewPaths('Chrome Downloads', ' Originals ', '/Clean/', {
  input: DEFAULT,
  output: DEFAULT_OUT
});
assert.strictEqual(preview.inputPath, 'Chrome Downloads/Originals');
assert.strictEqual(preview.outputPath, 'Chrome Downloads/Clean');

const fallbackPreview = buildPreviewPaths('', '', '', {
  input: DEFAULT,
  output: DEFAULT_OUT
});
assert.strictEqual(fallbackPreview.inputPath, 'Chrome default download directory/Gemini-Originals');
assert.strictEqual(fallbackPreview.outputPath, 'Chrome default download directory/Gemini-Clean');

console.log('ok');
