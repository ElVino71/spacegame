import { PortraitSeed } from '../entities/Character';
import { PORTRAIT_PALETTES } from '../data/characters';

// Reference grey levels from the portrait tile generator (generate-portrait-tiles.js)
// Skin tiles use skinBase [178,178,178], hair tiles use hairBase [108,108,108]
const SKIN_REF_GREY = 178;
const HAIR_REF_GREY = 108;

export class PortraitRenderer {
  private static filterCounter = 0;

  /**
   * Render a character portrait as an HTML string.
   * Uses a 3x3 grid of 32x32 tiles, displayed at the given size.
   * Tinting uses inline SVG feColorMatrix filters for precise grey-to-color mapping.
   */
  static renderPortrait(seed: PortraitSeed, size: number = 96): string {
    const skinColor = PORTRAIT_PALETTES.skin[seed.skinTone] || PORTRAIT_PALETTES.skin[0];
    const hairColor = PORTRAIT_PALETTES.hair[seed.hairColor] || PORTRAIT_PALETTES.hair[0];

    const id = PortraitRenderer.filterCounter++;
    const skinFilterId = `pt-s-${id}`;
    const hairFilterId = `pt-h-${id}`;

    const tiles = [
      { part: 'hair_left', index: seed.hair, filterId: hairFilterId },
      { part: 'hair_top', index: seed.hair, filterId: hairFilterId },
      { part: 'hair_right', index: seed.hair, filterId: hairFilterId },
      { part: 'ear_left', index: seed.ears, filterId: skinFilterId },
      { part: 'face', index: seed.faceShape, filterId: skinFilterId },
      { part: 'ear_right', index: seed.ears, filterId: skinFilterId },
      { part: 'chin_left', index: seed.chin, filterId: skinFilterId },
      { part: 'mouth', index: seed.mouth, filterId: skinFilterId },
      { part: 'chin_right', index: seed.chin, filterId: skinFilterId }
    ];

    // Inline SVG with filter definitions — zero-size, invisible, just hosts the filters
    const svgDefs = `<svg width="0" height="0" style="position:absolute;pointer-events:none"><defs>${this.buildColorMatrix(skinFilterId, skinColor, SKIN_REF_GREY)}${this.buildColorMatrix(hairFilterId, hairColor, HAIR_REF_GREY)}</defs></svg>`;

    const gridStyle = `
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      width: ${size}px;
      height: ${size}px;
      image-rendering: pixelated;
      background: rgba(0,0,0,0.2);
      border: 1px solid rgba(255,255,255,0.1);
      position: relative;
    `;

    const imgStyle = `
      width: 100%;
      height: 100%;
      display: block;
    `;

    const html = `
      <div class="portrait-container" style="${gridStyle}">
        ${svgDefs}
        ${tiles.map(t => `
          <img src="assets/tiles/portraits/${t.part}/${t.part}_${t.index}.png"
               style="${imgStyle} filter: url(#${t.filterId});" />
        `).join('')}
      </div>
    `;

    return html;
  }

  /**
   * Build an SVG feColorMatrix filter that maps neutral grey tiles to a target color.
   *
   * Grey pixels have R=G=B=v. The matrix multiplies each channel by (targetChannel / refGrey),
   * so when v equals refGrey, the output is exactly the target color. Darker/lighter greys
   * scale proportionally, preserving shading and highlights.
   */
  private static buildColorMatrix(id: string, hex: string, refGrey: number): string {
    const r = parseInt(hex.slice(1, 3), 16) / refGrey;
    const g = parseInt(hex.slice(3, 5), 16) / refGrey;
    const b = parseInt(hex.slice(5, 7), 16) / refGrey;

    // Matrix rows: [R_coeff 0 0 0 0] means out_R = R_coeff * in_R
    // Since input is grey (R=G=B), this gives out_R = R_coeff * greyLevel
    // Values >1 are fine; feColorMatrix clamps output to [0,1]
    return `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${r.toFixed(4)} 0 0 0 0 ${g.toFixed(4)} 0 0 0 0 ${b.toFixed(4)} 0 0 0 0 0 0 0 1 0"/></filter>`;
  }
}
