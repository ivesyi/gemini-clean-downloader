const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'options.html'), 'utf8');

assert.strictEqual(html.includes('path-preview'), false, 'options.html should not include path preview blocks');
assert.strictEqual(html.includes('downloadRoot'), false, 'options.html should not include download root preview');
assert.strictEqual(html.includes('inputPathPreview'), false, 'options.html should not include input path preview');
assert.strictEqual(html.includes('outputPathPreview'), false, 'options.html should not include output path preview');

console.log('ok');
