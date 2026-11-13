const path = require("node:path");
const { readFile, writeFile, unlink } = require("node:fs/promises");
const { app, dialog } = require("electron");

/*
 * Stores the graphic expression of the signature: the image and the text that
 * accompanies it. It is configured once and reused every time the person
 * signs. It is only a visual mark; the digital signature lives in
 * pdf-sign-service.js.
 */

const FILE_NAME = "signature-appearance.json";
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPG_HEADER = Buffer.from([0xff, 0xd8, 0xff]);

const DEFAULT_APPEARANCE = {
  imageBase64: null,
  mediaType: null,
  text: "",
  showName: true,
  showDate: true,
};

function createAppearanceError(code) {
  const error = new Error(`Signature appearance failed: ${code}`);
  error.code = code;
  return error;
}

function getFilePath() {
  return path.join(app.getPath("userData"), FILE_NAME);
}

function getMediaType(imageBytes) {
  if (PNG_HEADER.equals(imageBytes.subarray(0, 4))) {
    return "image/png";
  }

  if (JPG_HEADER.equals(imageBytes.subarray(0, 3))) {
    return "image/jpeg";
  }

  throw createAppearanceError("INVALID_IMAGE");
}

async function readAppearance() {
  try {
    const stored = JSON.parse(await readFile(getFilePath(), "utf8"));
    return { ...DEFAULT_APPEARANCE, ...stored };
  } catch {
    // No configuration saved yet
    return { ...DEFAULT_APPEARANCE };
  }
}

/*
 * The renderer gets the image as a data URL so it can show the preview, and
 * never handles the raw bytes.
 */
async function getAppearance() {
  const appearance = await readAppearance();

  return {
    imageDataUrl: appearance.imageBase64
      ? `data:${appearance.mediaType};base64,${appearance.imageBase64}`
      : null,
    text: appearance.text,
    showName: appearance.showName,
    showDate: appearance.showDate,
    isConfigured: Boolean(appearance.imageBase64),
  };
}

async function saveAppearance({ text, showName, showDate } = {}) {
  const current = await readAppearance();

  const updated = {
    ...current,
    text: typeof text === "string" ? text : current.text,
    showName: showName ?? current.showName,
    showDate: showDate ?? current.showDate,
  };

  await writeFile(getFilePath(), JSON.stringify(updated, null, 2), "utf8");
  return getAppearance();
}

async function chooseAppearanceImage() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg"],
      },
    ],
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  let imageBytes;

  try {
    imageBytes = await readFile(filePaths[0]);
  } catch {
    throw createAppearanceError("UNREADABLE_FILE");
  }

  const mediaType = getMediaType(imageBytes);
  const current = await readAppearance();

  await writeFile(
    getFilePath(),
    JSON.stringify(
      {
        ...current,
        imageBase64: imageBytes.toString("base64"),
        mediaType,
      },
      null,
      2,
    ),
    "utf8",
  );

  return getAppearance();
}

async function clearAppearance() {
  try {
    await unlink(getFilePath());
  } catch {
    // Nothing saved, nothing to remove
  }

  return getAppearance();
}

/*
 * Used by the signing flow, which needs the raw bytes rather than a data URL
 */
async function getAppearanceForStamping() {
  const appearance = await readAppearance();

  if (!appearance.imageBase64) {
    return null;
  }

  return {
    imageBytes: Buffer.from(appearance.imageBase64, "base64"),
    mediaType: appearance.mediaType,
    text: appearance.text,
    showName: appearance.showName,
    showDate: appearance.showDate,
  };
}

module.exports = {
  getAppearance,
  saveAppearance,
  chooseAppearanceImage,
  clearAppearance,
  getAppearanceForStamping,
};
