export const defaultPaperDensity = 20 * 10 / 17;
export const paperDensityLimits = Object.freeze({ min: 0.1, max: 30 });
export const maximumPreviewSheets = 135;

export function checkedPaperDensity(density) {
  if (typeof density !== 'number' || !Number.isFinite(density) || density < paperDensityLimits.min || density > paperDensityLimits.max) {
    throw new Error('Filter-paper preview density must be between 0.1 and 30 per 10 mm.');
  }
  return density;
}

export function densityFromSheets(sheets, depth) {
  if (!Number.isInteger(sheets) || sheets < 1 || sheets > 30) throw new Error('Preview sheets must be between 1 and 30.');
  if (typeof depth !== 'number' || !Number.isFinite(depth) || depth < 10 || depth > 45) throw new Error('Invalid saved stack depth.');
  return checkedPaperDensity(sheets * 10 / depth);
}

export function paperStack(depth, rise, density = defaultPaperDensity) {
  checkedPaperDensity(density);
  if (!Number.isFinite(depth) || depth < 10 || depth > 45 || !Number.isFinite(rise)) throw new Error('Invalid paper-preview dimensions.');
  const spacing = 10 / density;
  const count = Math.max(1, Math.floor(depth / spacing + 1e-9));
  if (count > maximumPreviewSheets) throw new Error('Paper preview exceeds the rendering limit.');
  const margin = (depth - (count - 1) * spacing) / 2;
  const slope = rise / depth;
  return { count, spacing, slope, density, positions: Array.from({ length: count }, (_, i) => {
    const y = margin + i * spacing;
    return [y, y * slope];
  }) };
}
