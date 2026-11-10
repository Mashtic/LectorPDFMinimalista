const { execFile } = require("node:child_process");
const { existsSync, readdirSync } = require("node:fs");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

/*
 * DVI files only name their fonts, they do not embed them, so turning one into
 * a PDF needs the TeX fonts and the dvipdfmx program. Both come with TeX Live
 * and MiKTeX, which anyone producing DVI files already has installed.
 */

const CONVERTER_NAME = process.platform === "win32" ? "dvipdfmx.exe" : "dvipdfmx";
const CONVERSION_TIMEOUT_MS = 60000;

function createDviError(code, cause) {
  const error = new Error(`DVI conversion failed: ${code}`);
  error.code = code;
  error.cause = cause;
  return error;
}

// TeX Live installs one folder per year, so the newest one is tried first
function listTexLiveBinFolders(root, binNames) {
  try {
    return readdirSync(root)
      .filter((entry) => /^\d{4}$/.test(entry))
      .sort()
      .reverse()
      .flatMap((year) =>
        binNames.map((binName) => path.join(root, year, "bin", binName)),
      );
  } catch {
    return [];
  }
}

function getDefaultFolders() {
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || "";
    const programFiles = process.env.ProgramFiles || "C:\\Program Files";
    return [
      path.join(localAppData, "Programs", "MiKTeX", "miktex", "bin", "x64"),
      path.join(programFiles, "MiKTeX", "miktex", "bin", "x64"),
      ...listTexLiveBinFolders("C:\\texlive", ["windows", "win64", "win32"]),
    ];
  }

  if (process.platform === "darwin") {
    return ["/Library/TeX/texbin", "/usr/local/bin", "/opt/homebrew/bin"];
  }

  return [
    "/usr/bin",
    "/usr/local/bin",
    ...listTexLiveBinFolders("/usr/local/texlive", ["x86_64-linux", "aarch64-linux"]),
  ];
}

function resolveConverterPath() {
  const configuredPath = process.env.DVIPDFMX_PATH;
  if (configuredPath) {
    if (!existsSync(configuredPath)) {
      throw createDviError("NO_CONVERTER");
    }

    return configuredPath;
  }

  const pathFolders = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const converterPath = [...pathFolders, ...getDefaultFolders()]
    .map((folder) => path.join(folder, CONVERTER_NAME))
    .find((candidate) => existsSync(candidate));

  if (!converterPath) {
    throw createDviError("NO_CONVERTER");
  }

  return converterPath;
}

async function convertDviToPdf(dviPath) {
  const converterPath = resolveConverterPath();
  const outputFolder = await mkdtemp(path.join(os.tmpdir(), "folio-dvi-"));
  const outputPath = path.join(outputFolder, "document.pdf");

  try {
    // DVI files reference images relative to their own folder
    await execFileAsync(converterPath, ["-q", "-o", outputPath, dviPath], {
      cwd: path.dirname(dviPath),
      timeout: CONVERSION_TIMEOUT_MS,
      windowsHide: true,
    });

    return await readFile(outputPath);
  } catch (error) {
    throw createDviError("CONVERSION_FAILED", error);
  } finally {
    await rm(outputFolder, { recursive: true, force: true });
  }
}

module.exports = { convertDviToPdf };
