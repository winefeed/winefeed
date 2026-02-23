'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Download, Upload, X, Image as ImageIcon } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Format = 'post' | 'story' | 'wide';
type LayoutKey = 'classic' | 'centered' | 'bottom' | 'split';
type TextMode = 'light' | 'dark';

interface BackgroundPreset {
  key: string;
  label: string;
  textMode: TextMode;
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

interface FormData {
  type: string;
  overline: string;
  title: string;
  grapes: string;
  price: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FORMATS: Record<Format, { label: string; w: number; h: number }> = {
  post: { label: 'Post', w: 1080, h: 1080 },
  story: { label: 'Story', w: 1080, h: 1920 },
  wide: { label: 'Wide', w: 1200, h: 630 },
};

const PREVIEW_MAX_W = 480;

// Deterministic pseudo-random (seeded)
function seededRandom(seed: number): number {
  return ((Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
}

// ─── Background Presets ──────────────────────────────────────────────────────

const BACKGROUNDS: BackgroundPreset[] = [
  {
    key: 'wine-gradient',
    label: 'Vinröd',
    textMode: 'light',
    paint: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
      g.addColorStop(0, '#5a1a22');
      g.addColorStop(1, '#93092b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    key: 'bokeh',
    label: 'Bokeh',
    textMode: 'light',
    paint: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w * 0.2, h);
      g.addColorStop(0, '#2a0a10');
      g.addColorStop(1, '#4a1520');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const count = 20;
      for (let i = 0; i < count; i++) {
        const x = seededRandom(i * 3 + 1) * w;
        const y = seededRandom(i * 3 + 2) * h;
        const r = seededRandom(i * 3 + 3) * Math.min(w, h) * 0.08 + 10;
        const alpha = seededRandom(i * 5 + 7) * 0.15 + 0.05;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(200, 120, 140, ${alpha + 0.1})`);
        grad.addColorStop(1, `rgba(200, 120, 140, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    key: 'vignette',
    label: 'Vinjett',
    textMode: 'light',
    paint: (ctx, w, h) => {
      ctx.fillStyle = '#6b1a28';
      ctx.fillRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    key: 'abstract',
    label: 'Abstrakt',
    textMode: 'light',
    paint: (ctx, w, h) => {
      ctx.fillStyle = '#1a0a10';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(seededRandom(i * 10 + 1) * w, seededRandom(i * 10 + 2) * h);
        ctx.bezierCurveTo(
          seededRandom(i * 10 + 3) * w, seededRandom(i * 10 + 4) * h,
          seededRandom(i * 10 + 5) * w, seededRandom(i * 10 + 6) * h,
          seededRandom(i * 10 + 7) * w, seededRandom(i * 10 + 8) * h
        );
        ctx.lineWidth = seededRandom(i * 10 + 9) * 40 + 10;
        const colors = ['#93092b', '#722F37', '#f1b4b0', '#c44d5e', '#5a1a22'];
        ctx.strokeStyle = colors[i % colors.length] + '40';
        ctx.stroke();
      }
    },
  },
  {
    key: 'textured',
    label: 'Textur',
    textMode: 'light',
    paint: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#4a1520');
      g.addColorStop(1, '#722F37');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // Noise overlay
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const noise = (seededRandom(i / 4) - 0.5) * 30;
        d[i] = Math.max(0, Math.min(255, d[i] + noise));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + noise));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + noise));
      }
      ctx.putImageData(imgData, 0, 0);
    },
  },
  {
    key: 'moody',
    label: 'Moody',
    textMode: 'light',
    paint: (ctx, w, h) => {
      ctx.fillStyle = '#0a0608';
      ctx.fillRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * 0.5, h * 1.1, 0, w * 0.5, h * 1.1, h * 0.9);
      g.addColorStop(0, 'rgba(100, 30, 60, 0.4)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    key: 'gold',
    label: 'Guld',
    textMode: 'dark',
    paint: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#c49a3c');
      g.addColorStop(0.5, '#e8c46a');
      g.addColorStop(1, '#a07828');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    key: 'rose',
    label: 'Rosé',
    textMode: 'dark',
    paint: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
      g.addColorStop(0, '#f1b4b0');
      g.addColorStop(1, '#e89090');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    key: 'midnight',
    label: 'Midnatt',
    textMode: 'light',
    paint: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
      g.addColorStop(0, '#0a0a1a');
      g.addColorStop(0.5, '#1a1040');
      g.addColorStop(1, '#2a1050');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    key: 'earth',
    label: 'Jord',
    textMode: 'light',
    paint: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#5c3223');
      g.addColorStop(0.5, '#7a4030');
      g.addColorStop(1, '#4a2818');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  },
];

// ─── Draw helpers ────────────────────────────────────────────────────────────

function textColor(mode: TextMode) {
  return mode === 'light' ? '#ffffff' : '#161412';
}

function textColorSub(mode: TextMode) {
  return mode === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(22,20,18,0.6)';
}

function pillBg(mode: TextMode) {
  return mode === 'light' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
}

function pillText(mode: TextMode) {
  return mode === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(22,20,18,0.8)';
}

function scaleFactor(h: number) {
  return Math.max(h / 1080, 0.65);
}

function drawWordmark(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  s: number, mode: TextMode
) {
  ctx.font = `bold ${Math.round(14 * s)}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = textColorSub(mode);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.letterSpacing = `${Math.round(3 * s)}px`;
  ctx.fillText('VINKOLL', x, y);
  ctx.letterSpacing = '0px';
}

function drawTypeBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  s: number, mode: TextMode, align: CanvasTextAlign = 'left'
) {
  if (!text) return y;
  ctx.font = `600 ${Math.round(12 * s)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.letterSpacing = `${Math.round(2 * s)}px`;
  const label = text.toUpperCase();
  const tw = ctx.measureText(label).width;
  const px = 12 * s;
  const py = 6 * s;
  const bx = align === 'center' ? x - tw / 2 - px : x;
  ctx.fillStyle = pillBg(mode);
  roundRect(ctx, bx, y, tw + px * 2, py * 2 + 12 * s, 6 * s);
  ctx.fill();
  ctx.fillStyle = pillText(mode);
  ctx.fillText(label, align === 'center' ? x : x + px, y + py);
  ctx.letterSpacing = '0px';
  return y + py * 2 + 12 * s + 12 * s;
}

function drawTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  maxW: number, s: number, mode: TextMode, align: CanvasTextAlign = 'left'
) {
  if (!text) return y;
  ctx.font = `800 ${Math.round(42 * s)}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = textColor(mode);
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  const words = text.split(' ');
  let line = '';
  let lineY = y;
  const lineHeight = 50 * s;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, lineY);
      lineY += lineHeight;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, lineY);
    lineY += lineHeight;
  }
  return lineY + 8 * s;
}

function drawOverline(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  s: number, mode: TextMode, align: CanvasTextAlign = 'left'
) {
  if (!text) return y;
  ctx.font = `500 ${Math.round(16 * s)}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = textColorSub(mode);
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
  return y + 24 * s;
}

function drawGrapePills(
  ctx: CanvasRenderingContext2D,
  grapes: string[],
  x: number, y: number,
  s: number, mode: TextMode, align: CanvasTextAlign = 'left'
) {
  if (!grapes.length) return y;
  ctx.font = `500 ${Math.round(13 * s)}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = 'top';
  const pillPx = 10 * s;
  const pillPy = 5 * s;
  const pillH = 13 * s + pillPy * 2;
  const gap = 6 * s;

  // Measure total width for centering
  let totalW = 0;
  const pillWidths = grapes.map((g) => {
    const tw = ctx.measureText(g).width + pillPx * 2;
    totalW += tw;
    return tw;
  });
  totalW += (grapes.length - 1) * gap;

  let cx = align === 'center' ? x - totalW / 2 : x;
  for (let i = 0; i < grapes.length; i++) {
    ctx.fillStyle = pillBg(mode);
    roundRect(ctx, cx, y, pillWidths[i], pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = pillText(mode);
    ctx.textAlign = 'left';
    ctx.fillText(grapes[i], cx + pillPx, y + pillPy);
    cx += pillWidths[i] + gap;
  }
  return y + pillH + 12 * s;
}

function drawPriceBadge(
  ctx: CanvasRenderingContext2D,
  price: string,
  x: number, y: number,
  s: number, mode: TextMode, align: CanvasTextAlign = 'left'
) {
  if (!price) return y;
  const label = `${price} kr`;
  ctx.font = `bold ${Math.round(28 * s)}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = textColor(mode);
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(label, x, y);
  ctx.font = `400 ${Math.round(13 * s)}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = textColorSub(mode);
  const priceW = ctx.measureText(label).width;
  const suffixX = align === 'center' ? x + priceW / 2 + 6 * s : x + priceW + 6 * s;
  ctx.textAlign = 'left';
  ctx.fillText('per flaska', suffixX, y + 8 * s);
  return y + 40 * s;
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  s: number, mode: TextMode
) {
  ctx.font = `400 ${Math.round(11 * s)}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = textColorSub(mode);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('vinkoll.se', w / 2, h - 20 * s);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Layout drawers ──────────────────────────────────────────────────────────

function drawLayoutClassic(
  ctx: CanvasRenderingContext2D, form: FormData,
  w: number, h: number, s: number, mode: TextMode
) {
  const pad = 48 * s;
  drawWordmark(ctx, pad, pad, s, mode);
  let y = pad + 30 * s;
  y = drawTypeBadge(ctx, form.type, pad, y, s, mode);
  y = drawOverline(ctx, form.overline, pad, y, s, mode);
  y = drawTitle(ctx, form.title, pad, y, w - pad * 2, s, mode);
  const grapes = form.grapes.split(',').map((g) => g.trim()).filter(Boolean);
  y = drawGrapePills(ctx, grapes, pad, y, s, mode);
  y = drawPriceBadge(ctx, form.price, pad, y, s, mode);
  drawFooter(ctx, w, h, s, mode);
}

function drawLayoutCentered(
  ctx: CanvasRenderingContext2D, form: FormData,
  w: number, h: number, s: number, mode: TextMode
) {
  const cx = w / 2;
  drawWordmark(ctx, cx - ctx.measureText('VINKOLL').width / 2, 40 * s, s, mode);
  // Vertically center content
  let totalH = 0;
  if (form.type) totalH += 40 * s;
  if (form.overline) totalH += 24 * s;
  if (form.title) totalH += form.title.split(' ').length > 4 ? 120 * s : 60 * s;
  if (form.grapes) totalH += 30 * s;
  if (form.price) totalH += 40 * s;
  let y = (h - totalH) / 2;
  y = drawTypeBadge(ctx, form.type, cx, y, s, mode, 'center');
  y = drawOverline(ctx, form.overline, cx, y, s, mode, 'center');
  y = drawTitle(ctx, form.title, cx, y, w * 0.75, s, mode, 'center');
  const grapes = form.grapes.split(',').map((g) => g.trim()).filter(Boolean);
  y = drawGrapePills(ctx, grapes, cx, y, s, mode, 'center');
  drawPriceBadge(ctx, form.price, cx, y, s, mode, 'center');
  drawFooter(ctx, w, h, s, mode);
}

function drawLayoutBottom(
  ctx: CanvasRenderingContext2D, form: FormData,
  w: number, h: number, s: number, mode: TextMode
) {
  // Gradient overlay from bottom
  const gH = h * 0.6;
  const g = ctx.createLinearGradient(0, h - gH, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.4, 'rgba(0,0,0,0.5)');
  g.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, h - gH, w, gH);

  const effectiveMode: TextMode = 'light'; // Always light on dark gradient
  const pad = 48 * s;
  drawWordmark(ctx, pad, pad, s, mode);

  // Build from bottom
  const bottomPad = 56 * s;
  let y = h - bottomPad;

  // Footer
  ctx.font = `400 ${Math.round(11 * s)}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = textColorSub(effectiveMode);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('vinkoll.se', pad, y);
  y -= 36 * s;

  // Price
  if (form.price) {
    ctx.font = `bold ${Math.round(28 * s)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = textColor(effectiveMode);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${form.price} kr`, pad, y);
    y -= 40 * s;
  }

  // Grapes
  const grapes = form.grapes.split(',').map((g) => g.trim()).filter(Boolean);
  if (grapes.length) {
    y -= 10 * s;
    drawGrapePills(ctx, grapes, pad, y, s, effectiveMode);
    y -= 16 * s;
  }

  // Title (draw upward)
  if (form.title) {
    ctx.font = `800 ${Math.round(42 * s)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = textColor(effectiveMode);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    const words = form.title.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > w - pad * 2 && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    for (let i = lines.length - 1; i >= 0; i--) {
      ctx.fillText(lines[i], pad, y);
      y -= 50 * s;
    }
    y -= 4 * s;
  }

  // Overline
  if (form.overline) {
    ctx.font = `500 ${Math.round(16 * s)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = textColorSub(effectiveMode);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(form.overline, pad, y);
    y -= 28 * s;
  }

  // Type badge
  if (form.type) {
    drawTypeBadge(ctx, form.type, pad, y - 30 * s, s, effectiveMode);
  }
}

function drawLayoutSplit(
  ctx: CanvasRenderingContext2D, form: FormData,
  w: number, h: number, s: number, mode: TextMode
) {
  // Left panel (45%)
  const panelW = Math.round(w * 0.45);
  ctx.fillStyle = mode === 'light' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, 0, panelW, h);

  const effectiveMode: TextMode = mode === 'light' ? 'light' : 'dark';
  const pad = 36 * s;
  const innerW = panelW - pad * 2;

  drawWordmark(ctx, pad, pad, s, effectiveMode);
  let y = pad + 30 * s;
  y = drawTypeBadge(ctx, form.type, pad, y, s, effectiveMode);
  y = drawOverline(ctx, form.overline, pad, y, s, effectiveMode);
  y = drawTitle(ctx, form.title, pad, y, innerW, s, effectiveMode);
  const grapes = form.grapes.split(',').map((g) => g.trim()).filter(Boolean);
  y = drawGrapePills(ctx, grapes, pad, y, s, effectiveMode);
  drawPriceBadge(ctx, form.price, pad, y, s, effectiveMode);

  // Footer on left panel
  ctx.font = `400 ${Math.round(11 * s)}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = textColorSub(effectiveMode);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('vinkoll.se', pad, h - 20 * s);
}

// ─── Main draw function ──────────────────────────────────────────────────────

function drawImage(
  ctx: CanvasRenderingContext2D,
  form: FormData,
  bg: BackgroundPreset,
  layout: LayoutKey,
  format: Format,
  uploadedImg: HTMLImageElement | null,
  overlayOpacity: number
) {
  const { w, h } = FORMATS[format];
  ctx.canvas.width = w;
  ctx.canvas.height = h;
  ctx.clearRect(0, 0, w, h);

  // 1. Background
  bg.paint(ctx, w, h);

  // 2. Uploaded image overlay
  if (uploadedImg) {
    const imgRatio = uploadedImg.width / uploadedImg.height;
    const canvasRatio = w / h;
    let dw: number, dh: number, dx: number, dy: number;
    if (imgRatio > canvasRatio) {
      dh = h;
      dw = h * imgRatio;
      dx = (w - dw) / 2;
      dy = 0;
    } else {
      dw = w;
      dh = w / imgRatio;
      dx = 0;
      dy = (h - dh) / 2;
    }
    ctx.drawImage(uploadedImg, dx, dy, dw, dh);
    ctx.fillStyle = `rgba(0,0,0,${overlayOpacity})`;
    ctx.fillRect(0, 0, w, h);
  }

  // 3. Layout
  const s = scaleFactor(h);
  const mode = uploadedImg ? 'light' : bg.textMode;
  switch (layout) {
    case 'classic':
      drawLayoutClassic(ctx, form, w, h, s, mode);
      break;
    case 'centered':
      drawLayoutCentered(ctx, form, w, h, s, mode);
      break;
    case 'bottom':
      drawLayoutBottom(ctx, form, w, h, s, mode);
      break;
    case 'split':
      drawLayoutSplit(ctx, form, w, h, s, mode);
      break;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function InstagramGeneratorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<Format>('post');
  const [bgIndex, setBgIndex] = useState(0);
  const [layout, setLayout] = useState<LayoutKey>('classic');
  const [uploadedImg, setUploadedImg] = useState<HTMLImageElement | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0.45);
  const [isDragging, setIsDragging] = useState(false);
  const [swatches, setSwatches] = useState<string[]>([]);
  const [form, setForm] = useState<FormData>({
    type: 'Rött vin',
    overline: 'Från Piemonte, Italien',
    title: 'Barolo Riserva 2018',
    grapes: 'Nebbiolo',
    price: '389',
  });

  // Generate swatch thumbnails
  useEffect(() => {
    const thumbs: string[] = [];
    for (const bg of BACKGROUNDS) {
      const c = document.createElement('canvas');
      c.width = 120;
      c.height = 120;
      const ctx = c.getContext('2d');
      if (ctx) {
        bg.paint(ctx, 120, 120);
        thumbs.push(c.toDataURL());
      }
    }
    setSwatches(thumbs);
  }, []);

  // Redraw canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawImage(ctx, form, BACKGROUNDS[bgIndex], layout, format, uploadedImg, overlayOpacity);
  }, [form, bgIndex, layout, format, uploadedImg, overlayOpacity]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // File upload handler
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => setUploadedImg(img);
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = FORMATS[format];
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.download = `vinkoll-${form.type.toLowerCase().replace(/\s+/g, '-')}-${format}-${date}.png`;
    // Draw at full resolution for download
    const dlCanvas = document.createElement('canvas');
    dlCanvas.width = w;
    dlCanvas.height = h;
    const dlCtx = dlCanvas.getContext('2d');
    if (dlCtx) {
      drawImage(dlCtx, form, BACKGROUNDS[bgIndex], layout, format, uploadedImg, overlayOpacity);
      link.href = dlCanvas.toDataURL('image/png');
      link.click();
    }
  };

  const updateField = (key: keyof FormData, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const { w: fmtW, h: fmtH } = FORMATS[format];
  const previewW = Math.min(PREVIEW_MAX_W, fmtW);
  const previewH = (previewW / fmtW) * fmtH;

  const LAYOUTS: { key: LayoutKey; label: string; desc: string }[] = [
    { key: 'classic', label: 'Klassisk', desc: 'Text vänster' },
    { key: 'centered', label: 'Centrerad', desc: 'Allt i mitten' },
    { key: 'bottom', label: 'Nedre', desc: 'Text nere' },
    { key: 'split', label: 'Delad', desc: 'Panel + bild' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Bildgenerator</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Skapa bilder for Instagram, stories och delning
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left column — Controls */}
        <div className="w-full lg:w-[380px] flex-shrink-0 space-y-6">
          {/* Format */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 block">
              Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(FORMATS) as [Format, typeof FORMATS.post][]).map(
                ([key, { label, w, h }]) => (
                  <button
                    key={key}
                    onClick={() => setFormat(key)}
                    className={`p-3 rounded-lg border text-center transition-colors ${
                      format === key
                        ? 'border-[#722F37] bg-[#722F37]/5 text-[#722F37]'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">
                      {w}x{h}
                    </div>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Background */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 block">
              Bakgrund
            </label>
            <div className="grid grid-cols-5 gap-2">
              {swatches.map((src, i) => (
                <button
                  key={BACKGROUNDS[i].key}
                  onClick={() => setBgIndex(i)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    bgIndex === i && !uploadedImg
                      ? 'border-[#722F37] ring-2 ring-[#722F37]/20'
                      : 'border-transparent hover:border-border'
                  }`}
                  title={BACKGROUNDS[i].label}
                >
                  <img
                    src={src}
                    alt={BACKGROUNDS[i].label}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
              {/* Upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`aspect-square rounded-lg border-2 border-dashed flex items-center justify-center transition-all ${
                  uploadedImg
                    ? 'border-[#722F37] bg-[#722F37]/5'
                    : 'border-border hover:border-muted-foreground'
                }`}
                title="Ladda upp bild"
              >
                <Upload className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {uploadedImg && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Overlay-opacitet
                  </span>
                  <button
                    onClick={() => {
                      setUploadedImg(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Ta bort bild
                  </button>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                  className="w-full accent-[#722F37]"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Ljus</span>
                  <span>Mork</span>
                </div>
              </div>
            )}
          </div>

          {/* Layout */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 block">
              Layout
            </label>
            <div className="grid grid-cols-4 gap-2">
              {LAYOUTS.map(({ key, label, desc }) => (
                <button
                  key={key}
                  onClick={() => setLayout(key)}
                  className={`p-2 rounded-lg border text-center transition-colors ${
                    layout === key
                      ? 'border-[#722F37] bg-[#722F37]/5 text-[#722F37]'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="text-xs font-medium">{label}</div>
                  <div className="text-[10px] text-muted-foreground">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Content fields */}
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground block">
              Innehall
            </label>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Vintyp</label>
              <select
                value={form.type}
                onChange={(e) => updateField('type', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
              >
                <option value="Rött vin">Rott vin</option>
                <option value="Vitt vin">Vitt vin</option>
                <option value="Rosévin">Rosevin</option>
                <option value="Mousserande">Mousserande</option>
                <option value="Orange vin">Orange vin</option>
                <option value="Naturvin">Naturvin</option>
                <option value="">Ingen</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Overrubrik</label>
              <input
                type="text"
                value={form.overline}
                onChange={(e) => updateField('overline', e.target.value)}
                placeholder="T.ex. Fran Piemonte, Italien"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Titel</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Vinets namn"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Druvor (kommaseparerade)
              </label>
              <input
                type="text"
                value={form.grapes}
                onChange={(e) => updateField('grapes', e.target.value)}
                placeholder="Nebbiolo, Sangiovese"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Pris (kr)</label>
              <input
                type="text"
                value={form.price}
                onChange={(e) => updateField('price', e.target.value)}
                placeholder="389"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background"
              />
            </div>
          </div>

          {/* Download */}
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#722F37] text-white rounded-lg hover:bg-[#5a252c] transition-colors text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            Ladda ner ({fmtW}x{fmtH})
          </button>
        </div>

        {/* Right column — Preview */}
        <div className="flex-1 flex justify-center lg:sticky lg:top-6 lg:self-start">
          <div
            className="relative"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                width: previewW,
                height: previewH,
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              }}
            />
            {isDragging && (
              <div className="absolute inset-0 rounded-xl border-2 border-dashed border-[#722F37] bg-[#722F37]/10 flex items-center justify-center">
                <div className="text-center">
                  <ImageIcon className="h-8 w-8 text-[#722F37] mx-auto mb-2" />
                  <p className="text-sm font-medium text-[#722F37]">
                    Slapp bilden har
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
