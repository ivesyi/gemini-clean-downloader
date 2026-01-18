const assert = require('assert');
const fs = require('fs');

const content = fs.readFileSync('i18n.js', 'utf8');
const requiredKeys = [
  'status_clean_progress',
  'status_upload_progress',
  'status_upload_result'
];

requiredKeys.forEach((key) => {
  assert(
    content.includes(key),
    `Missing i18n key in i18n.js: ${key}`
  );
});

console.log('ok');
