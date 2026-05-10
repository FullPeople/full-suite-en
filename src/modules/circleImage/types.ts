// Circle-image plugin — shared constants.
//
// User flow:
//   1. GM clicks the toolbar icon → cropper popover opens.
//   2. User drops / picks an image, switches between Circle Crop and
//      Background Remove tabs, configures the result, then clicks
//      "Add to Library".
//   3. Popover bakes the canvas to a PNG Blob and calls
//      OBR.assets.uploadImages — the asset lands in the user's
//      OBR library. From there the user drags it to the scene with
//      OBR's native library-drag gesture.
//
// History note: an earlier design tried to spawn the Image item
// directly from a `data:image/png;base64,...` URL with
// `OBR.scene.items.addItems`. OBR silently rejects data URLs in
// `image.url`; uploadImages is the only supported path for getting
// a locally-generated image into an OBR scene.

export const PLUGIN_ID = "com.full-suite-en/circleimage";
export const POPOVER_ID = `${PLUGIN_ID}/editor`;
