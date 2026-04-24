import assert from "node:assert/strict";
import test from "node:test";

import { calculateOutputDimensions } from "../offscreen/image-converter.js";

test("keeps original dimensions when preserveDimensions is enabled", () => {
  assert.deepEqual(calculateOutputDimensions(2400, 1600, { preserveDimensions: true }), {
    width: 2400,
    height: 1600
  });
});

test("fits within both max width and max height while preserving aspect ratio", () => {
  assert.deepEqual(
    calculateOutputDimensions(2400, 1600, {
      preserveDimensions: false,
      resizeWidth: 1200,
      resizeHeight: 1200
    }),
    {
      width: 1200,
      height: 800
    }
  );
});

test("supports a single resize bound", () => {
  assert.deepEqual(
    calculateOutputDimensions(2400, 1600, {
      preserveDimensions: false,
      resizeWidth: 900,
      resizeHeight: null
    }),
    {
      width: 900,
      height: 600
    }
  );
});

test("does not upscale images that are already smaller than the resize bounds", () => {
  assert.deepEqual(
    calculateOutputDimensions(800, 600, {
      preserveDimensions: false,
      resizeWidth: 1600,
      resizeHeight: 1200
    }),
    {
      width: 800,
      height: 600
    }
  );
});
