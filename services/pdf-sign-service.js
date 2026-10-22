const forge = require("node-forge");
const { PDFDocument } = require("pdf-lib");
const signpdf = require("@signpdf/signpdf").default;
const { Signer } = require("@signpdf/utils");
const { plainAddPlaceholder } = require("@signpdf/placeholder-plain");
const { openCardSession } = require("./card-sign-service.js");
const { getGlobalVar, setGlobalVar } = require("./global-var-service.js");

const SIGNATURE_LENGTH = 16384;
const SIGN_REASON = "Signed with the Costa Rican digital signature card";

/*
 * The signature placeholder can only be added to documents that use a classic
 * cross reference table. Rewriting the document with pdf-lib normalizes the
 * ones that use cross reference streams, which is what most modern PDF
 * generators produce.
 */
async function normalizePdf(pdfBuffer) {
  const document = await PDFDocument.load(pdfBuffer, {
    ignoreEncryption: true,
  });

  return Buffer.from(await document.save({ useObjectStreams: false }));
}

/*
 * Builds the PAdES signature container. The card only computes the RSA
 * signature over the authenticated attributes; everything else is assembled
 * here.
 */
class CardSigner extends Signer {
  constructor(cardSession) {
    super();
    this.cardSession = cardSession;
  }

  async sign(pdfBuffer, signingTime = new Date()) {
    const certificate = forge.pki.certificateFromAsn1(
      forge.asn1.fromDer(this.cardSession.certificateDer.toString("binary")),
    );

    const container = forge.pkcs7.createSignedData();
    container.content = forge.util.createBuffer(pdfBuffer.toString("binary"));
    container.addCertificate(certificate);
    container.addSigner({
      key: this.cardSession.key,
      certificate,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime, value: signingTime },
      ],
    });

    container.sign({ detached: true });

    return Buffer.from(
      forge.asn1.toDer(container.toAsn1()).getBytes(),
      "binary",
    );
  }
}

function readSignerName(certificateDer) {
  try {
    const certificate = forge.pki.certificateFromAsn1(
      forge.asn1.fromDer(certificateDer.toString("binary")),
    );

    return certificate.subject.getField("CN")?.value || null;
  } catch {
    return null;
  }
}

async function signCurrentPdfWithCard(pin) {
  const currentPDF = getGlobalVar("currentPDF");
  if (!currentPDF) {
    throw Object.assign(new Error("No document"), { code: "NO_DOCUMENT" });
  }

  if (!pin) {
    throw Object.assign(new Error("No PIN"), { code: "PIN_REQUIRED" });
  }

  const cardSession = openCardSession(pin);

  try {
    const normalizedPdf = await normalizePdf(Buffer.from(currentPDF));

    const pdfWithPlaceholder = plainAddPlaceholder({
      pdfBuffer: normalizedPdf,
      reason: SIGN_REASON,
      name: readSignerName(cardSession.certificateDer) || "",
      signatureLength: SIGNATURE_LENGTH,
    });

    const signedPdf = await signpdf.sign(
      pdfWithPlaceholder,
      new CardSigner(cardSession),
    );

    setGlobalVar("currentPDF", signedPdf);

    return {
      signerName: readSignerName(cardSession.certificateDer),
      signedAt: new Date().toISOString(),
    };
  } finally {
    cardSession.close();
  }
}

module.exports = { signCurrentPdfWithCard };
