/**
 * In-memory Mock Firebase Admin SDK for deterministic, fast E2E testing
 * Implements Firestore Admin with ACID transactions, Firebase Auth with token verification,
 * and FCM Messaging with delivery tracking.
 */

export class MockDocumentSnapshot {
  constructor(id, data, exists = true) {
    this.id = id;
    this._data = data ? JSON.parse(JSON.stringify(data)) : null;
    this.exists = exists;
  }

  data() {
    return this._data ? JSON.parse(JSON.stringify(this._data)) : undefined;
  }
}

export class MockQuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.empty = docs.length === 0;
    this.size = docs.length;
  }

  forEach(callback) {
    this.docs.forEach(callback);
  }
}

export class MockDocumentReference {
  constructor(db, collectionName, id) {
    this.db = db;
    this.collectionName = collectionName;
    this.id = id;
  }

  async get() {
    return this.db._getDoc(this.collectionName, this.id);
  }

  async set(data, options = {}) {
    return this.db._setDoc(this.collectionName, this.id, data, options);
  }

  async update(fields) {
    return this.db._updateDoc(this.collectionName, this.id, fields);
  }

  async delete() {
    return this.db._deleteDoc(this.collectionName, this.id);
  }
}

export class MockQuery {
  constructor(db, collectionName, filters = [], sorts = [], limitCount = null) {
    this.db = db;
    this.collectionName = collectionName;
    this.filters = filters;
    this.sorts = sorts;
    this.limitCount = limitCount;
  }

  where(field, op, val) {
    return new MockQuery(
      this.db,
      this.collectionName,
      [...this.filters, { field, op, val }],
      this.sorts,
      this.limitCount
    );
  }

  orderBy(field, direction = 'asc') {
    return new MockQuery(
      this.db,
      this.collectionName,
      this.filters,
      [...this.sorts, { field, direction }],
      this.limitCount
    );
  }

  limit(n) {
    return new MockQuery(
      this.db,
      this.collectionName,
      this.filters,
      this.sorts,
      n
    );
  }

  async get() {
    return this.db._executeQuery(this);
  }
}

export class MockCollectionReference extends MockQuery {
  constructor(db, collectionName) {
    super(db, collectionName);
  }

  doc(id) {
    const docId = id || this.db._generateId(this.collectionName);
    return new MockDocumentReference(this.db, this.collectionName, docId);
  }

  async add(data) {
    const docRef = this.doc();
    await docRef.set(data);
    return docRef;
  }
}

export class MockTransaction {
  constructor(db) {
    this.db = db;
    this.reads = new Map();
    this.writes = [];
  }

  async get(docRef) {
    const snap = await docRef.get();
    this.reads.set(`${docRef.collectionName}/${docRef.id}`, snap);
    return snap;
  }

  set(docRef, data, options = {}) {
    this.writes.push({ type: 'set', docRef, data, options });
    return this;
  }

  update(docRef, fields) {
    this.writes.push({ type: 'update', docRef, fields });
    return this;
  }

  delete(docRef) {
    this.writes.push({ type: 'delete', docRef });
    return this;
  }

  async _commit() {
    for (const write of this.writes) {
      if (write.type === 'set') {
        await write.docRef.set(write.data, write.options);
      } else if (write.type === 'update') {
        await write.docRef.update(write.fields);
      } else if (write.type === 'delete') {
        await write.docRef.delete();
      }
    }
  }
}

export class MockFirestore {
  constructor() {
    this.store = new Map(); // collection -> Map(docId -> data)
    this.idCounter = 1000;
  }

  _generateId(prefix = 'doc') {
    this.idCounter += 1;
    return `${prefix}_${Date.now().toString(36)}_${this.idCounter}`;
  }

  _getCollectionMap(collectionName) {
    if (!this.store.has(collectionName)) {
      this.store.set(collectionName, new Map());
    }
    return this.store.get(collectionName);
  }

  _getDoc(collectionName, id) {
    const coll = this._getCollectionMap(collectionName);
    if (!coll.has(id)) {
      return new MockDocumentSnapshot(id, null, false);
    }
    return new MockDocumentSnapshot(id, coll.get(id), true);
  }

  _setDoc(collectionName, id, data, options = {}) {
    const coll = this._getCollectionMap(collectionName);
    if (options.merge && coll.has(id)) {
      const existing = coll.get(id);
      coll.set(id, { ...existing, ...JSON.parse(JSON.stringify(data)), id });
    } else {
      coll.set(id, { ...JSON.parse(JSON.stringify(data)), id });
    }
    return true;
  }

  _updateDoc(collectionName, id, fields) {
    const coll = this._getCollectionMap(collectionName);
    if (!coll.has(id)) {
      throw new Error(`Document ${collectionName}/${id} does not exist to update`);
    }
    const current = coll.get(id);
    const updated = { ...current };

    for (const [key, value] of Object.entries(fields)) {
      // Support dot-notation nested update if needed
      if (key.includes('.')) {
        const parts = key.split('.');
        let target = updated;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!target[parts[i]]) target[parts[i]] = {};
          target = target[parts[i]];
        }
        target[parts[parts.length - 1]] = value;
      } else {
        updated[key] = value;
      }
    }
    coll.set(id, updated);
    return true;
  }

  _deleteDoc(collectionName, id) {
    const coll = this._getCollectionMap(collectionName);
    coll.delete(id);
    return true;
  }

  _executeQuery(query) {
    const coll = this._getCollectionMap(query.collectionName);
    let results = [];

    for (const [id, data] of coll.entries()) {
      let matches = true;
      for (const filter of query.filters) {
        const val = this._extractField(data, filter.field);
        if (filter.op === '==' && val !== filter.val) matches = false;
        if (filter.op === '!=' && val === filter.val) matches = false;
        if (filter.op === '>' && !(val > filter.val)) matches = false;
        if (filter.op === '>=' && !(val >= filter.val)) matches = false;
        if (filter.op === '<' && !(val < filter.val)) matches = false;
        if (filter.op === '<=' && !(val <= filter.val)) matches = false;
        if (filter.op === 'in' && (!Array.isArray(filter.val) || !filter.val.includes(val))) matches = false;
        if (filter.op === 'array-contains' && (!Array.isArray(val) || !val.includes(filter.val))) matches = false;
        if (!matches) break;
      }
      if (matches) {
        results.push(new MockDocumentSnapshot(id, data, true));
      }
    }

    // Sorts
    for (const sort of query.sorts) {
      results.sort((a, b) => {
        const valA = this._extractField(a.data(), sort.field);
        const valB = this._extractField(b.data(), sort.field);
        if (valA === valB) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
        if (sort.direction === 'desc') {
          return valA < valB ? 1 : -1;
        }
        return valA > valB ? 1 : -1;
      });
    }

    // Limit
    if (query.limitCount != null) {
      results = results.slice(0, query.limitCount);
    }

    return new MockQuerySnapshot(results);
  }

  _extractField(obj, fieldPath) {
    if (!obj) return undefined;
    const parts = fieldPath.split('.');
    let current = obj;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }

  collection(collectionName) {
    return new MockCollectionReference(this, collectionName);
  }

  async runTransaction(updateFunction) {
    const transaction = new MockTransaction(this);
    const result = await updateFunction(transaction);
    await transaction._commit();
    return result;
  }

  clear() {
    this.store.clear();
    this.idCounter = 1000;
  }
}

export class MockFirebaseAuth {
  constructor() {
    this.users = new Map(); // uid -> userRecord
    this.authorizedEmails = ['admin@nirvaha.org', 'superadmin@nirvaha.com', 'developer@nirvaha.internal'];
  }

  registerUser(userRecord) {
    this.users.set(userRecord.uid, userRecord);
  }

  async verifyIdToken(token) {
    if (!token) {
      throw new Error('Decoding Firebase ID token failed: Token is empty or null');
    }

    if (token === 'invalid_token' || token === 'expired_token') {
      throw new Error('Firebase ID token has expired or is invalid');
    }

    // Support encoded JSON token strings for test flexibility
    if (token.startsWith('{') && token.endsWith('}')) {
      try {
        const parsed = JSON.parse(token);
        return {
          uid: parsed.uid || 'usr_test_default',
          email: parsed.email || 'user@example.com',
          admin: parsed.admin === true,
          ...parsed
        };
      } catch (e) {
        throw new Error('Malformed token JSON');
      }
    }

    // Predefined token aliases
    if (token === 'admin_token') {
      return {
        uid: 'adm_master_99',
        email: 'admin@nirvaha.org',
        admin: true
      };
    }

    if (token === 'admin_whitelist_token') {
      return {
        uid: 'adm_whitelist_88',
        email: 'superadmin@nirvaha.com',
        admin: false // not claim, but whitelisted email
      };
    }

    if (token === 'regular_user_1_token') {
      return {
        uid: 'usr_seeker_101',
        email: 'priya.sharma@example.com',
        name: 'Priya Sharma',
        admin: false
      };
    }

    if (token === 'regular_user_2_token') {
      return {
        uid: 'usr_seeker_102',
        email: 'aarav.patel@example.com',
        name: 'Aarav Patel',
        admin: false
      };
    }

    if (token === 'unauthorized_token') {
      return {
        uid: 'usr_random_500',
        email: 'intruder@external.io',
        admin: false
      };
    }

    // Generic token parsing: uid:email:admin
    if (token.includes(':')) {
      const [uid, email, role] = token.split(':');
      return {
        uid: uid || 'usr_custom',
        email: email || 'custom@example.com',
        admin: role === 'admin'
      };
    }

    // Fallback: check registered users or return standard user
    if (this.users.has(token)) {
      return this.users.get(token);
    }

    return {
      uid: `usr_${token.slice(0, 8)}`,
      email: `${token}@test.user`,
      admin: false
    };
  }
}

export class MockFirebaseMessaging {
  constructor() {
    this.sentMessages = [];
  }

  async send(message) {
    if (!message || !message.topic) {
      throw new Error('Target Topic destination is required.');
    }
    const messageId = `projects/nirvaha-app/messages/msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.sentMessages.push({
      messageId,
      dispatchedAt: new Date().toISOString(),
      message: JSON.parse(JSON.stringify(message))
    });
    return messageId;
  }

  clear() {
    this.sentMessages = [];
  }

  getMessagesByTopic(topic) {
    return this.sentMessages.filter(m => m.message.topic === topic);
  }

  getLastMessage() {
    return this.sentMessages[this.sentMessages.length - 1] || null;
  }
}

// Global test instances
export const mockDb = new MockFirestore();
export const mockAuth = new MockFirebaseAuth();
export const mockMessaging = new MockFirebaseMessaging();

export function resetFirebaseMocks() {
  mockDb.clear();
  mockMessaging.clear();
}
