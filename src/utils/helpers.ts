import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type IconRender = 
  | { kind: 'emoji', text: string }
  | { kind: 'img', src: string };

export function getFileIcon(
  name: string,
  type: 'file' | 'folder',
  isOpen?: boolean,
  theme: 'emoji' | 'material' = 'emoji'
) : IconRender {
  if (theme === 'emoji') {
    if (type === 'folder') {
      return { kind: 'emoji', text: isOpen ? '📂' : '📁' };
    }
    
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'html': return { kind: 'emoji', text: '🌐' };
      case 'css': return { kind: 'emoji', text: '🎨' };
      case 'js': return { kind: 'emoji', text: '📜' };
      case 'ts':
      case 'tsx': return { kind: 'emoji', text: '🔷' };
      case 'json': return { kind: 'emoji', text: '⚙️' };
      case 'py': return { kind: 'emoji', text: '🐍' };
      case 'md': return { kind: 'emoji', text: '📝' };
      default: return { kind: 'emoji', text: '📄' };
    }
  }

  const base = 'https://raw.githubusercontent.com/PKief/vscode-material-icon-theme/main/icons';
  const img = (file: string): IconRender => ({ kind: 'img', src: `${base}/${file}` });

  if (type === 'folder') {
    return img(isOpen ? 'folder-open.svg' : 'folder.svg');
  }

  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'html': return img('html.svg');
    case 'css': return img('css.svg');
    case 'js': return img('javascript.svg');
    case 'jsx': return img('react.svg');
    case 'ts': return img('typescript.svg');
    case 'tsx': return img('react_ts.svg');
    case 'json': return img('json.svg');
    case 'py': return img('python.svg');
    case 'md': return img('markdown.svg');
    case 'svg': return img('svg.svg');
    default: return img('file.svg');
  }
}
