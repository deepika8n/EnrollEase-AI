// Find a small colour portrait on a largely neutral sheet of paper.
// Full-frame photos and ambiguous/monochrome images retain their original crop.
export function findPortraitBounds({ data, width, height }) {
  let left = width, top = height, right = -1, bottom = -1, count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const r = data[offset], g = data[offset + 1], b = data[offset + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (data[offset + 3] < 128 || max < 65 || max - min < 35 || (max - min) / max < 0.22) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y); count += 1;
    }
  }
  const cropWidth = right - left + 1, cropHeight = bottom - top + 1;
  const area = cropWidth * cropHeight;
  if (count < width * height * 0.008 || cropWidth < 12 || cropHeight < 12
    || area > width * height * 0.65 || count / area < 0.2
    || cropWidth / cropHeight < 0.4 || cropWidth / cropHeight > 1.4) return null;
  const padding = Math.max(2, Math.round(Math.min(cropWidth, cropHeight) * 0.06));
  const x = Math.max(0, left - padding), y = Math.max(0, top - padding);
  return { x, y, width: Math.min(width, right + padding + 1) - x, height: Math.min(height, bottom + padding + 1) - y };
}

export function createAvatarCrop(image) {
  try {
    const sample = document.createElement("canvas");
    const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
    sample.width = Math.max(1, Math.round(image.naturalWidth * scale));
    sample.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = sample.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, sample.width, sample.height);
    const bounds = findPortraitBounds(context.getImageData(0, 0, sample.width, sample.height));
    if (!bounds) return image.src;
    const output = document.createElement("canvas");
    output.width = 256;
    output.height = Math.round(256 * bounds.height / bounds.width);
    output.getContext("2d").drawImage(image,
      bounds.x / scale, bounds.y / scale, bounds.width / scale, bounds.height / scale,
      0, 0, output.width, output.height);
    return output.toDataURL("image/jpeg", 0.9);
  } catch {
    // Cross-origin images may not allow canvas access; still show the photo.
    return image.src;
  }
}
