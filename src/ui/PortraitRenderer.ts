import { PortraitSeed } from '../entities/Character';
import { PORTRAIT_PALETTES } from '../data/characters';

export class PortraitRenderer {
  /**
   * Render a character portrait as an HTML string.
   * Uses a 3x3 grid of 32x32 tiles, displayed at 3x scale (96x96).
   */
  static renderPortrait(seed: PortraitSeed, size: number = 96): string {
    const skinColor = PORTRAIT_PALETTES.skin[seed.skinTone] || PORTRAIT_PALETTES.skin[0];
    const hairColor = PORTRAIT_PALETTES.hair[seed.hairColor] || PORTRAIT_PALETTES.hair[0];

    // CSS filters to tint neutral grey tiles.
    // Note: This is a simplified approach. Ideally we'd use SVG filters or 
    // more precise CSS filter strings, but this works for basic tinting.
    const skinFilter = this.getTintFilter(skinColor);
    const hairFilter = this.getTintFilter(hairColor);

    const tiles = [
      { part: 'hair_left', index: seed.hair, filter: hairFilter },
      { part: 'hair_top', index: seed.hair, filter: hairFilter },
      { part: 'hair_right', index: seed.hair, filter: hairFilter },
      { part: 'ear_left', index: seed.ears, filter: skinFilter },
      { part: 'face', index: seed.faceShape, filter: skinFilter },
      { part: 'ear_right', index: seed.ears, filter: skinFilter },
      { part: 'chin_left', index: seed.chin, filter: skinFilter },
      { part: 'mouth', index: seed.mouth, filter: skinFilter },
      { part: 'chin_right', index: seed.chin, filter: skinFilter }
    ];

    const gridStyle = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      width: ${size}px;
      height: ${size}px;
      image-rendering: pixelated;
      background: rgba(0,0,0,0.2);
      border: 1px solid rgba(255,255,255,0.1);
    `;

    const imgStyle = `
      width: 100%;
      height: 100%;
      display: block;
    `;

    const html = `
      <div class="portrait-container" style="${gridStyle}">
        ${tiles.map(t => `
          <img src="assets/tiles/portraits/${t.part}/${t.part}_${t.index}.png" 
               style="${imgStyle} filter: ${t.filter};" />
        `).join('')}
      </div>
    `;

    return html;
  }

  /**
   * Helper to generate a CSS filter that tints a grey #888888 to a target color.
   * This is a heuristic. For high quality, a more complex library like 'css-filter-converter'
   * would be used, but since we have a fixed palette, we can approximate.
   */
  private static getTintFilter(hex: string): string {
    // We'll use a simple trick: sepia + saturate + hue-rotate
    // This isn't perfect but for a pixel art game it gives a nice stylized look.
    // Pure grey #B4B4B4 (180, 180, 180) is our base.
    
    // Convert hex to HSL for rotation
    const hsl = this.hexToHSL(hex);
    
    // We want to force the base grey into the target color's ballpark
    // 1. sepia(1) turns it into a yellowish tint.
    // 2. hue-rotate moves that tint to the target hue.
    // 3. saturate adjusts intensity.
    // 4. brightness/contrast adjusts value.
    
    // Base sepia hue is around 35-40 deg.
    const rotation = (hsl.h - 38 + 360) % 360;
    const saturation = hsl.s * 1.5; // boost saturation
    const brightness = 0.5 + (hsl.l / 100); 

    return `sepia(1) hue-rotate(${rotation}deg) saturate(${saturation}) brightness(${brightness})`;
  }

  private static hexToHSL(hex: string) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;

    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
}
