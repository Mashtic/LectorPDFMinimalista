const { existsSync } = require("node:fs");
const pkcs11js = require("pkcs11js");
const forge = require("node-forge");

/*
 * Talks to the Costa Rican digital signature card through its PKCS#11 module,
 * the same library Adobe Reader or Firefox load. The private key never leaves
 * the card: the card receives a digest and returns the signature.
 */

const MODULE_PATHS = {
  win32: ["C:\\Windows\\System32\\asepkcs.dll"],
  darwin: [
    "/Library/Application Support/Athena/libASEP11.dylib",
    "/usr/local/lib/libASEP11.dylib",
  ],
  linux: [
    "/usr/lib/x64-athena/libASEP11.so",
    "/usr/lib/x86_64-linux-gnu/libASEP11.so",
    "/usr/local/lib/libASEP11.so",
  ],
};

const SIGNING_KEY_USAGE = "nonRepudiation";
const SHA256_OID = "2.16.840.1.101.3.4.2.1";

function createCardError(code, cause) {
  const error = new Error(`Card signature failed: ${code}`);
  error.code = code;
  error.cause = cause;
  return error;
}

function resolveModulePath() {
  const configuredPath = process.env.PKCS11_MODULE_PATH;
  if (configuredPath) {
    if (!existsSync(configuredPath)) {
      throw createCardError("NO_MODULE");
    }

    return configuredPath;
  }

  const candidates = MODULE_PATHS[process.platform] || [];
  const modulePath = candidates.find((candidate) => existsSync(candidate));

  if (!modulePath) {
    throw createCardError("NO_MODULE");
  }

  return modulePath;
}

const MISSING_CARD_ERRORS = [
  pkcs11js.CKR_TOKEN_NOT_PRESENT,
  pkcs11js.CKR_TOKEN_NOT_RECOGNIZED,
  pkcs11js.CKR_DEVICE_REMOVED,
  pkcs11js.CKR_SLOT_ID_INVALID,
];

function toCardError(error) {
  if (MISSING_CARD_ERRORS.includes(error.code)) {
    return createCardError("NO_CARD", error);
  }

  return createCardError("CARD_ERROR", error);
}

function findSlotWithToken(pkcs11) {
  let slots;

  try {
    slots = pkcs11.C_GetSlotList(true);
  } catch (error) {
    throw toCardError(error);
  }

  if (!slots.length) {
    throw createCardError("NO_CARD");
  }

  return slots[0];
}

function openSession(pkcs11, slot) {
  try {
    return pkcs11.C_OpenSession(slot, pkcs11js.CKF_SERIAL_SESSION);
  } catch (error) {
    throw toCardError(error);
  }
}

function login(pkcs11, session, pin) {
  try {
    pkcs11.C_Login(session, pkcs11js.CKU_USER, pin);
  } catch (error) {
    if (error.code === pkcs11js.CKR_PIN_INCORRECT) {
      throw createCardError("PIN_INCORRECT", error);
    }

    if (
      error.code === pkcs11js.CKR_PIN_LOCKED ||
      error.code === pkcs11js.CKR_USER_PIN_NOT_INITIALIZED
    ) {
      throw createCardError("PIN_LOCKED", error);
    }

    throw createCardError("CARD_ERROR", error);
  }
}

function findObjects(pkcs11, session, template) {
  pkcs11.C_FindObjectsInit(session, template);

  const handles = [];
  let handle = pkcs11.C_FindObjects(session);

  while (handle) {
    handles.push(handle);
    handle = pkcs11.C_FindObjects(session);
  }

  pkcs11.C_FindObjectsFinal(session);
  return handles;
}

function isSigningCertificate(certificateDer) {
  try {
    const certificate = forge.pki.certificateFromAsn1(
      forge.asn1.fromDer(certificateDer.toString("binary")),
    );
    const keyUsage = certificate.getExtension("keyUsage");

    return Boolean(keyUsage && keyUsage[SIGNING_KEY_USAGE]);
  } catch {
    return false;
  }
}

function findSigningCertificate(pkcs11, session) {
  const handles = findObjects(pkcs11, session, [
    { type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_CERTIFICATE },
  ]);

  const certificates = handles.map((handle) => {
    const [value, id] = pkcs11.C_GetAttributeValue(session, handle, [
      { type: pkcs11js.CKA_VALUE },
      { type: pkcs11js.CKA_ID },
    ]);

    return { der: Buffer.from(value.value), id: Buffer.from(id.value) };
  });

  if (!certificates.length) {
    throw createCardError("NO_CERTIFICATE");
  }

  // The card holds an authentication certificate and a signing one. Only the
  // signing certificate carries the nonRepudiation key usage.
  return (
    certificates.find((certificate) => isSigningCertificate(certificate.der)) ||
    certificates[0]
  );
}

function findPrivateKey(pkcs11, session, certificateId) {
  const handles = findObjects(pkcs11, session, [
    { type: pkcs11js.CKA_CLASS, value: pkcs11js.CKO_PRIVATE_KEY },
    { type: pkcs11js.CKA_ID, value: certificateId },
  ]);

  if (!handles.length) {
    throw createCardError("NO_PRIVATE_KEY");
  }

  return handles[0];
}

function createDigestInfo(messageDigest) {
  const digestInfo = forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.SEQUENCE,
    true,
    [
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.SEQUENCE,
        true,
        [
          forge.asn1.create(
            forge.asn1.Class.UNIVERSAL,
            forge.asn1.Type.OID,
            false,
            forge.asn1.oidToDer(SHA256_OID).getBytes(),
          ),
          forge.asn1.create(
            forge.asn1.Class.UNIVERSAL,
            forge.asn1.Type.NULL,
            false,
            "",
          ),
        ],
      ),
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.OCTETSTRING,
        false,
        messageDigest.digest().getBytes(),
      ),
    ],
  );

  return Buffer.from(forge.asn1.toDer(digestInfo).getBytes(), "binary");
}

/*
 * node-forge signs by calling key.sign(md) synchronously, so this object
 * stands in for a private key and forwards the digest to the card.
 */
function createCardKey(pkcs11, session, keyHandle) {
  return {
    sign(messageDigest) {
      const digestInfo = createDigestInfo(messageDigest);

      pkcs11.C_SignInit(
        session,
        { mechanism: pkcs11js.CKM_RSA_PKCS },
        keyHandle,
      );

      const signature = pkcs11.C_Sign(
        session,
        digestInfo,
        Buffer.alloc(512),
      );

      return Buffer.from(signature).toString("binary");
    },
  };
}

function openCardSession(pin) {
  const pkcs11 = new pkcs11js.PKCS11();
  pkcs11.load(resolveModulePath());

  try {
    pkcs11.C_Initialize();
  } catch (error) {
    throw createCardError("CARD_ERROR", error);
  }

  let session;

  try {
    const slot = findSlotWithToken(pkcs11);
    session = openSession(pkcs11, slot);
    login(pkcs11, session, pin);

    const certificate = findSigningCertificate(pkcs11, session);
    const keyHandle = findPrivateKey(pkcs11, session, certificate.id);

    return {
      certificateDer: certificate.der,
      key: createCardKey(pkcs11, session, keyHandle),
      close: () => closeCardSession(pkcs11, session),
    };
  } catch (error) {
    closeCardSession(pkcs11, session);
    throw error;
  }
}

function closeCardSession(pkcs11, session) {
  try {
    if (session) {
      pkcs11.C_Logout(session);
      pkcs11.C_CloseSession(session);
    }

    pkcs11.C_Finalize();
  } catch (error) {
    console.error("Failed to close the card session:", error);
  }
}

module.exports = { openCardSession };
