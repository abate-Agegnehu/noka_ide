import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getFileIcon(name: string, type: 'file' | 'folder', isOpen?: boolean) {
  if (type === 'folder') {
    return isOpen ? '📂' : '📁';
  }
  
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'html': return '🌐';
    case 'css': return '🎨';
    case 'js': return '📜';
    case 'ts':
    case 'tsx': return '🔷';
    case 'json': return '⚙️';
    case 'py': return '🐍';
    case 'md': return '📝';
    default: return '📄';
  }
}
