const crypto = require("node:crypto");
const tls = require("node:tls");
const forge = require("node-forge");

const { asn1 } = forge;

/*
 * Builds the chain of authorities that issued a signing certificate, so it can
 * be embedded next to the signature and a validator can walk from the signer
 * up to the national root without looking anything up.
 *
 * No certificate is shipped with the application. Each issuer is looked up in
 * the places that already vouch for it:
 *
 *   1. the card itself, which may carry its authorities;
 *   2. the certificate store of the operating system, where the digital
 *      signature installer registers the national hierarchy;
 *   3. the address every certificate declares for its issuer (Authority
 *      Information Access), published by the authority itself.
 *
 * Whatever the source, a candidate is only accepted when its public key
 * verifies the signature of the certificate below it. A wrong or tampered
 * download can therefore never end up in the document.
 */

const MAX_CHAIN_LENGTH = 8;
const DOWNLOAD_TIMEOUT_MS = 8000;
const MAX_DOWNLOAD_BYTES = 256 * 1024;
const ISSUER_ADDRESS_PATTERN = /^CA Issuers - URI:(https?:\/\/\S+)$/gm;
const SIGNED_DATA_OID = "1.2.840.113549.1.7.2";

let systemCertificates = null;
const downloads = new Map();

function toCertificate(source) {
  try {
    return new crypto.X509Certificate(source);
  } catch {
    return null;
  }
}

function readSystemCertificates() {
  if (!systemCertificates) {
    // Older runtimes cannot read the system store; the other sources remain
    const entries =
      typeof tls.getCACertificates === "function"
        ? tls.getCACertificates("system")
        : [];

    systemCertificates = entries.map(toCertificate).filter(Boolean);
  }

  return systemCertificates;
}

function isIssuerOf(candidate, certificate) {
  try {
    return (
      certificate.checkIssued(candidate) &&
      certificate.verify(candidate.publicKey)
    );
  } catch {
    return false;
  }
}

// Authorities renew their certificates, so the one still in force goes first
function pickIssuer(candidates, certificate) {
  const issuers = candidates.filter((candidate) =>
    isIssuerOf(candidate, certificate),
  );
  const now = Date.now();

  return (
    issuers.find(
      (issuer) =>
        new Date(issuer.validFrom).getTime() <= now &&
        now <= new Date(issuer.validTo).getTime(),
    ) ||
    issuers[0] ||
    null
  );
}

function readIssuerAddresses(certificate) {
  return [...(certificate.infoAccess || "").matchAll(ISSUER_ADDRESS_PATTERN)].map(
    (match) => match[1],
  );
}

// Authorities publish either one certificate or a bundle of them (.p7b)
function parseDownload(data) {
  const single = toCertificate(data);
  if (single) {
    return [single];
  }

  try {
    const root = asn1.fromDer(data.toString("binary"));
    if (asn1.derToOid(root.value[0].value) !== SIGNED_DATA_OID) {
      return [];
    }

    const bundle = root.value[1].value[0].value.find(
      (field) =>
        field.tagClass === asn1.Class.CONTEXT_SPECIFIC && field.type === 0,
    );

    return (bundle?.value || [])
      .map((node) =>
        toCertificate(Buffer.from(asn1.toDer(node).getBytes(), "binary")),
      )
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function download(address) {
  if (downloads.has(address)) {
    return downloads.get(address);
  }

  let certificates = [];

  try {
    const response = await fetch(address, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });

    if (response.ok) {
      const data = Buffer.from(await response.arrayBuffer());
      if (data.length <= MAX_DOWNLOAD_BYTES) {
        certificates = parseDownload(data);
      }
    }
  } catch (error) {
    console.error("Could not download an issuer certificate:", error.message);
    return [];
  }

  // Failed attempts are not remembered, so the next signature tries again
  if (certificates.length) {
    downloads.set(address, certificates);
  }

  return certificates;
}

async function findIssuer(certificate, cardCertificates) {
  const local =
    pickIssuer(cardCertificates, certificate) ||
    pickIssuer(readSystemCertificates(), certificate);

  if (local) {
    return local;
  }

  for (const address of readIssuerAddresses(certificate)) {
    const issuer = pickIssuer(await download(address), certificate);
    if (issuer) {
      return issuer;
    }
  }

  return null;
}

/*
 * Returns the issuers of the signing certificate, ordered from the authority
 * that issued it up to the root, as DER buffers. isComplete tells whether the
 * chain reached a self-signed root.
 */
async function resolveCertificateChain(signerDer, cardCertificatesDer = []) {
  const cardCertificates = cardCertificatesDer.map(toCertificate).filter(Boolean);
  const chain = [];
  let current = toCertificate(signerDer);
  let isComplete = false;

  while (current && chain.length < MAX_CHAIN_LENGTH) {
    // A root signs itself: there is nothing above it
    if (isIssuerOf(current, current)) {
      isComplete = true;
      break;
    }

    const issuer = await findIssuer(current, cardCertificates);
    if (!issuer) {
      break;
    }

    chain.push(issuer);
    current = issuer;
  }

  return {
    certificates: chain.map((certificate) => certificate.raw),
    isComplete,
  };
}

module.exports = { resolveCertificateChain };
