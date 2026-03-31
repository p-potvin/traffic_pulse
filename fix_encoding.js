const fs = require('fs');
const path = require('path');
function fixEncoding(file) {
  let content = fs.readFileSync(file);
  // remove UTF-16 BOM
  if (content[0] === 0xFF && content[1] === 0xFE) {
    let str = content.toString('utf16le');
    // Remove the ZERO WIDTH NO-BREAK SPACE if it translated to that
    if (str.charCodeAt(0) === 0xFEFF) {
        str = str.substring(1);
    }
    content = Buffer.from(str, 'utf8');
  }
  // remove UTF-8 BOM
  if (content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
    content = content.slice(3);
  }
  fs.writeFileSync(file, content);
}
const frontendSrc = path.join(__dirname, 'frontend', 'src');
fixEncoding(path.join(frontendSrc, 'index.css'));
fixEncoding(path.join(frontendSrc, 'App.tsx'));
fixEncoding(path.join(frontendSrc, 'main.tsx'));
fixEncoding(path.join(frontendSrc, 'components', 'GlobeMap.tsx'));
fixEncoding(path.join(frontendSrc, 'components', 'TrafficList.tsx'));
console.log('Fixed encodings!');