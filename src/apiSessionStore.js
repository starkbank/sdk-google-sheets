// Keeps the session secrets out of the spreadsheet: anyone who can view the sheet (or its
// version history) must not be able to read them.
//
// - Session (private key, public key, access id): UserProperties, per user. It lives as long as
//   the session (days), so it cannot rely on the cache, whose entries expire in at most 6 hours.
// - Profile (who the user is: workspace, e-mail, environment, name and workspace id): UserProperties,
//   per user too. People who share a spreadsheet share its cells, so the cells cannot say who each one is.
// - Handshake (material that only exists while the QR code login is pending): UserCache with a
//   short TTL, the same way plugin-google-sheets handles its handshake secrets.

SessionStore = {}

SessionStore.handshakeTtlSeconds = 600

SessionStore.sessionFields = ["privateKey", "publicKey", "accessId"]

SessionStore.handshakeFields = ["requestBody", "memberKeyPem", "challengeId", "sessionPrivateKeyPem", "sessionPublicKeyPem"]

SessionStore.profileFields = ["workspace", "email", "environment", "name", "workspaceId"]

SessionStore.profileKey = function (field) {
  return "profile." + field
}

SessionStore.sessionKey = function (field) {
  return "session." + field
}

SessionStore.handshakeKey = function (field) {
  return "handshake." + field
}

SessionStore.checkValue = function (value, label, field) {
  if (typeof value !== "string" || !value) {
    throw new Error("Invalid " + label + ": missing " + field)
  }
}

SessionStore.saveSession = function (session) {
  let values = {}
  for (let field of SessionStore.sessionFields) {
    let value = (session || {})[field]
    SessionStore.checkValue(value, "session", field)
    values[SessionStore.sessionKey(field)] = value
  }

  PropertiesService.getUserProperties().setProperties(values)
}

SessionStore.sessionFrom = function (stored) {
  let session = {}
  for (let field of SessionStore.sessionFields) {
    session[field] = stored[SessionStore.sessionKey(field)] || ""
  }

  // A session is either complete or absent: if any field is missing (for instance while it is being
  // cleared) every field comes back empty, like empty cells did.
  if (SessionStore.sessionFields.some(field => !session[field])) {
    return {privateKey: "", publicKey: "", accessId: ""}
  }

  return session
}

SessionStore.loadSession = function () {
  return SessionStore.sessionFrom(PropertiesService.getUserProperties().getProperties())
}

SessionStore.clearSession = function () {
  let properties = PropertiesService.getUserProperties()
  for (let field of SessionStore.sessionFields) {
    properties.deleteProperty(SessionStore.sessionKey(field))
  }
}

// Everything is stored as text. A field that is not given (or is empty) is not stored at all: it
// reads back as empty, and empty values are not written to the properties.
SessionStore.saveProfile = function (profile) {
  let properties = PropertiesService.getUserProperties()
  let values = {}
  for (let field of SessionStore.profileFields) {
    let value = (profile || {})[field]
    value = value === null || value === undefined ? "" : String(value)
    if (value) {
      values[SessionStore.profileKey(field)] = value
    } else {
      properties.deleteProperty(SessionStore.profileKey(field))
    }
  }

  if (Object.keys(values).length > 0) {
    properties.setProperties(values)
  }
}

SessionStore.profileFrom = function (stored) {
  let profile = {}
  for (let field of SessionStore.profileFields) {
    profile[field] = stored[SessionStore.profileKey(field)] || ""
  }

  return profile
}

// Fields that are not stored come back as empty strings, like empty cells did.
SessionStore.loadProfile = function () {
  return SessionStore.profileFrom(PropertiesService.getUserProperties().getProperties())
}

// Session and profile with a single read of the properties.
SessionStore.loadSessionAndProfile = function () {
  let stored = PropertiesService.getUserProperties().getProperties()

  return {session: SessionStore.sessionFrom(stored), profile: SessionStore.profileFrom(stored)}
}

SessionStore.clearProfile = function () {
  let properties = PropertiesService.getUserProperties()
  for (let field of SessionStore.profileFields) {
    properties.deleteProperty(SessionStore.profileKey(field))
  }
}

// Starts a new handshake, discarding whatever a previous login left behind so that two logins
// never get mixed.
SessionStore.startHandshake = function (handshake) {
  SessionStore.clearHandshake()
  SessionStore.saveHandshake(handshake)
}

// Adds fields to the handshake in progress, keeping the ones already stored.
SessionStore.saveHandshake = function (handshake) {
  if (!handshake || Object.keys(handshake).length == 0) {
    throw new Error("Invalid handshake: nothing to store")
  }

  let values = {}
  for (let field of Object.keys(handshake)) {
    if (!SessionStore.handshakeFields.includes(field)) {
      throw new Error("Unknown handshake field: " + field)
    }
    SessionStore.checkValue(handshake[field], "handshake", field)
    values[SessionStore.handshakeKey(field)] = handshake[field]
  }

  CacheService.getUserCache().putAll(values, SessionStore.handshakeTtlSeconds)
}

// Returns the requested fields (all of them by default), or null when any is missing: the
// handshake expired, was evicted by the cache, or never existed. Callers must ask the user to
// log in again instead of working with partial material.
SessionStore.loadHandshake = function (...fields) {
  if (fields.length == 0) {
    fields = SessionStore.handshakeFields
  }
  let stored = CacheService.getUserCache().getAll(fields.map(SessionStore.handshakeKey))
  let handshake = {}
  for (let field of fields) {
    handshake[field] = stored[SessionStore.handshakeKey(field)]
    if (!handshake[field]) {
      return null
    }
  }

  return handshake
}

SessionStore.clearHandshake = function () {
  CacheService.getUserCache().removeAll(SessionStore.handshakeFields.map(SessionStore.handshakeKey))
}

SessionStore.clearAll = function () {
  SessionStore.clearSession()
  SessionStore.clearProfile()
  SessionStore.clearHandshake()
}
