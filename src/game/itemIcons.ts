import { ItemCondition, PickupItemType } from '../data/levelData';

const iconCache = new Map<string, string>();

/**
 * Generates and caches a 64x64 procedural 2D canvas icon (data URL)
 * for an inventory item type and its condition ('dry' | 'wet' | 'damaged').
 */
export function getProceduralItemIcon(
  kind: PickupItemType,
  condition: ItemCondition
): string {
  const key = `${kind}:${condition}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  if (typeof document === 'undefined') return '';

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, size, size);

  switch (kind) {
    case 'matches': {
      // Matchbox body
      ctx.fillStyle = '#8c4a32';
      ctx.strokeStyle = '#d6b588';
      ctx.lineWidth = 2;
      ctx.fillRect(12, 26, 36, 24);
      ctx.strokeRect(12, 26, 36, 24);

      // Inner drawer label
      ctx.fillStyle = '#d6b588';
      ctx.fillRect(16, 31, 28, 14);

      // Matchstick diagonal
      ctx.strokeStyle = '#e5cfa3';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(24, 42);
      ctx.lineTo(44, 16);
      ctx.stroke();

      // Match head (warm orange if dry/damaged, dull blue-grey if wet)
      ctx.fillStyle = condition === 'wet' ? '#56758f' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(45, 15, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'candle': {
      // Saucer holder base
      ctx.fillStyle = '#64594a';
      ctx.beginPath();
      ctx.ellipse(32, 52, 16, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wax cylinder
      ctx.fillStyle = '#dfd5c0';
      ctx.strokeStyle = '#9c927e';
      ctx.lineWidth = 1.5;
      ctx.fillRect(24, 24, 16, 27);
      ctx.strokeRect(24, 24, 16, 27);

      // Wick
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(32, 24);
      ctx.lineTo(32, 19);
      ctx.stroke();

      // Teardrop flame (if dry/damaged)
      if (condition !== 'wet') {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(32, 8);
        ctx.quadraticCurveTo(39, 15, 32, 19);
        ctx.quadraticCurveTo(25, 15, 32, 8);
        ctx.fill();
      }
      break;
    }

    case 'food': {
      // Ration pack body
      ctx.fillStyle = '#6e7852';
      ctx.strokeStyle = '#474f33';
      ctx.lineWidth = 2;
      ctx.fillRect(12, 20, 40, 26);
      ctx.strokeRect(12, 20, 40, 26);

      // Center band strap
      ctx.fillStyle = '#b09e72';
      ctx.fillRect(27, 19, 10, 28);

      // Stencil cross / ration mark
      ctx.strokeStyle = '#333b24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(17, 28);
      ctx.lineTo(23, 28);
      ctx.moveTo(41, 28);
      ctx.lineTo(47, 28);
      ctx.stroke();
      break;
    }

    case 'water_bottle': {
      // Bottle body
      ctx.fillStyle = '#466d7d';
      ctx.strokeStyle = '#75a2b5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(19, 22, 26, 30, 6);
      ctx.fill();
      ctx.stroke();

      // Bottle neck & cap
      ctx.fillStyle = '#263842';
      ctx.fillRect(26, 12, 12, 9);

      // Water wave line inside
      ctx.strokeStyle = '#a5d8eb';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(23, 36);
      ctx.quadraticCurveTo(28, 33, 32, 36);
      ctx.quadraticCurveTo(36, 39, 41, 36);
      ctx.stroke();
      break;
    }

    case 'rope': {
      // Coiled climbing rope loops
      ctx.strokeStyle = '#b89a64';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(32, 32, 16, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#917648';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(32, 32, 11, 0, Math.PI * 2);
      ctx.stroke();

      // Binding wrap on right
      ctx.fillStyle = '#5c492b';
      ctx.fillRect(43, 27, 9, 10);
      break;
    }

    case 'artifact': {
      // Outer bronze ring
      ctx.strokeStyle = '#d4a74a';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(32, 32, 18, 0, Math.PI * 2);
      ctx.stroke();

      // Inner jade octahedron diamond
      ctx.fillStyle = '#4ca696';
      ctx.strokeStyle = '#99f6e4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(32, 16);
      ctx.lineTo(44, 32);
      ctx.lineTo(32, 48);
      ctx.lineTo(20, 32);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
  }

  // Condition overlays: blue water droplets for 'wet', jagged crack for 'damaged'
  if (condition === 'wet') {
    ctx.fillStyle = '#38bdf8';
    const drops = [
      { x: 14, y: 14 },
      { x: 50, y: 46 },
    ];
    for (const d of drops) {
      ctx.beginPath();
      ctx.moveTo(d.x, d.y - 5);
      ctx.quadraticCurveTo(d.x + 4, d.y + 1, d.x, d.y + 4);
      ctx.quadraticCurveTo(d.x - 4, d.y + 1, d.x, d.y - 5);
      ctx.fill();
    }
  } else if (condition === 'damaged') {
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, 16);
    ctx.lineTo(24, 25);
    ctx.lineTo(20, 31);
    ctx.lineTo(29, 40);
    ctx.stroke();
  }

  const url = canvas.toDataURL('image/png');
  iconCache.set(key, url);
  return url;
}
