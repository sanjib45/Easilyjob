const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    filelist = fs.statSync(path.join(dir, file)).isDirectory()
      ? walkSync(path.join(dir, file), filelist)
      : filelist.concat(path.join(dir, file));
  });
  return filelist;
};

const viewsDir = path.join(__dirname, '../views');
const ejsFiles = walkSync(viewsDir).filter(f => f.endsWith('.ejs'));

ejsFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  let original = content;

  // Replace colors
  content = content.replace(/color:\s*var\(--gray-400\)/g, 'color: var(--color-text-subtle)');
  content = content.replace(/color:\s*var\(--gray-500\)/g, 'color: var(--color-text-muted)');
  content = content.replace(/color:\s*var\(--gray-600\)/g, 'color: var(--color-text-muted)');
  content = content.replace(/color:\s*var\(--gray-700\)/g, 'color: var(--color-text)');
  content = content.replace(/color:\s*var\(--gray-800\)/g, 'color: var(--color-text)');
  content = content.replace(/color:\s*var\(--gray-900\)/g, 'color: var(--color-text)');
  
  // Replace backgrounds
  content = content.replace(/background:\s*#ffffff/gi, 'background: var(--color-surface)');
  content = content.replace(/background:\s*var\(--gray-50\)/g, 'background: var(--color-bg)');
  
  // Some specific ones found in the grep
  content = content.replace(/background:var\(--gray-100\);color:var\(--gray-600\)/g, 'background:var(--color-border);color:var(--color-text-muted)');

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
