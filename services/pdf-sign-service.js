const forge = require("node-forge");
const { PDFDocument } = require("pdf-lib");
const signpdf = require("@signpdf/signpdf").default;
const { Signer, SUBFILTER_ETSI_CADES_DETACHED } = require("@signpdf/utils");
const { plainAddPlaceholder } = require("@signpdf/placeholder-plain");
const { openCardSession } = require("./card-sign-service.js");
const {
  resolveCertificateChain,
} = require("./certificate-chain-service.js");
const { collectRevocationInfo } = require("./revocation-service.js");
const { requestTimestamp } = require("./timestamp-service.js");
const {
  buildSignatureContainer,
  estimateContainerSize,
} = require("./signature-container-service.js");
const { stampAppearance } = require("./signature-stamp-service.js");
const {
  getAppearanceForStamping,
} = require("./signature-appearance-service.js");
const { getGlobalVar, setGlobalVar } = require("./global-var-service.js");

const SIGN_REASON = "Signed with the Costa Rican digital signature card";

/*
 * A document that was signed but could not be timestamped. It is kept aside,
 * not applied, until the person decides whether to keep it as it is. That way
 * the decision does not require entering the PIN a second time.
 */
let pendingSignature = null;

function createSignError(code) {
  return Object.assign(new Error(`Signature failed: ${code}`), { code });
}

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
 * Hands the bytes to sign to the container builder and remembers whether the
 * timestamp could be added.
 */
class CardSigner extends Signer {
  constructor({ key, certificatesDer, revocation }) {
    super();
    this.key = key;
    this.certificatesDer = certificatesDer;
    this.revocation = revocation;
    this.hasTimestamp = false;
  }

  async sign(pdfBuffer) {
    const { container, hasTimestamp, timestampError } =
      await buildSignatureContainer({
        content: pdfBuffer,
        certificatesDer: this.certificatesDer,
        revocation: this.revocation,
        key: this.key,
        requestTimestamp,
      });

    if (timestampError) {
      console.error("Could not get a timestamp:", timestampError.message);
    }

    this.hasTimestamp = hasTimestamp;
    return container;
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

async function signCurrentPdfWithCard(pin, options = {}) {
  pendingSignature = null;

  const currentPDF = getGlobalVar("currentPDF");
  if (!currentPDF) {
    throw createSignError("NO_DOCUMENT");
  }

  if (!pin) {
    throw createSignError("PIN_REQUIRED");
  }

  const cardSession = openCardSession(pin);

  try {
    const signerName = readSignerName(cardSession.certificateDer);
    const chain = await resolveCertificateChain(
      cardSession.certificateDer,
      cardSession.cardCertificatesDer,
    );

    /*
     * The revocation proof is gathered before signing because it is part of
     * what the card signs. A certificate known to be revoked is not used.
     */
    const revocation = await collectRevocationInfo(
      cardSession.certificateDer,
      chain.certificates,
    );

    if (revocation.isRevoked) {
      throw createSignError("CERTIFICATE_REVOKED");
    }

    let documentToSign = Buffer.from(currentPDF);

    /*
     * The graphic expression is stamped first and signed afterwards, so the
     * signature covers it. Stamping after signing would break the signature.
     */
    if (options.placement) {
      const appearance = await getAppearanceForStamping();

      if (!appearance) {
        throw createSignError("NO_APPEARANCE");
      }

      documentToSign = await stampAppearance({
        pdfBuffer: documentToSign,
        appearance,
        placement: options.placement,
        pageNumber: options.pageNumber,
        signerName,
      });
    }

    const normalizedPdf = await normalizePdf(documentToSign);
    const certificatesDer = [cardSession.certificateDer, ...chain.certificates];

    const pdfWithPlaceholder = plainAddPlaceholder({
      pdfBuffer: normalizedPdf,
      reason: SIGN_REASON,
      name: signerName || "",
      subFilter: SUBFILTER_ETSI_CADES_DETACHED,
      // The space is reserved before signing, so it is sized for everything
      // the container will carry
      signatureLength: estimateContainerSize({ certificatesDer, revocation }),
    });

    const signer = new CardSigner({
      key: cardSession.key,
      certificatesDer,
      revocation,
    });
    const signedPdf = await signpdf.sign(pdfWithPlaceholder, signer);

    const result = {
      signerName,
      signedAt: new Date().toISOString(),
      // Without these the signature is still valid, but a validator may warn
      // about the trust hierarchy or about the revocation status
      hasFullChain: chain.isComplete,
      hasRevocationInfo: revocation.isComplete,
      hasTimestamp: signer.hasTimestamp,
    };

    if (!signer.hasTimestamp) {
      pendingSignature = { signedPdf, result };
      throw createSignError("TIMESTAMP_UNAVAILABLE");
    }

    // The document is only replaced once everything succeeded, so a failed
    // signature never leaves a stamp behind
    setGlobalVar("currentPDF", signedPdf);

    return result;
  } finally {
    cardSession.close();
  }
}

// The person chose to keep the signature that could not be timestamped
function applyPendingSignature() {
  if (!pendingSignature) {
    throw createSignError("SIGN_ERROR");
  }

  const { signedPdf, result } = pendingSignature;
  pendingSignature = null;
  setGlobalVar("currentPDF", signedPdf);

  return result;
}

function discardPendingSignature() {
  pendingSignature = null;
}

module.exports = {
  signCurrentPdfWithCard,
  applyPendingSignature,
  discardPendingSignature,
};
