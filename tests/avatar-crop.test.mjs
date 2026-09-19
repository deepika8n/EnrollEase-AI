import test from "node:test";
import assert from "node:assert/strict";
import { findPortraitBounds } from "../src/utils/avatarCrop.js";

function sample(rect) {
  const width = 120, height = 240;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const inside = rect && x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
    data.set(inside ? [30, 130, 200, 255] : [190, 188, 185, 255], (y * width + x) * 4);
  }
  return { width, height, data };
}

test("a small passport portrait on neutral paper is cropped with padding", () => {
  const portrait = { x: 35, y: 65, width: 45, height: 60 };
  const crop = findPortraitBounds(sample(portrait));
  assert.ok(crop.x < portrait.x && crop.y < portrait.y);
  assert.ok(crop.width > portrait.width && crop.width < 60);
  assert.ok(crop.height > portrait.height && crop.height < 75);
});

test("normal full-frame portraits and blank/ambiguous images keep their original framing", () => {
  assert.equal(findPortraitBounds(sample({ x: 0, y: 0, width: 120, height: 240 })), null);
  assert.equal(findPortraitBounds(sample(null)), null);
  assert.equal(findPortraitBounds(sample({ x: 30, y: 50, width: 3, height: 4 })), null);
});
