const getTypeOf$1 = (thing) => typeof thing;
const TINYBASE$1 = "tinybase";
const EMPTY_STRING$1 = "";
const STRING$1 = getTypeOf$1(EMPTY_STRING$1);
const BOOLEAN$1 = getTypeOf$1(true);
const NUMBER$1 = getTypeOf$1(0);
const FUNCTION = getTypeOf$1(getTypeOf$1);
const OBJECT$1 = "object";
const ARRAY$1 = "array";
const TYPE = "type";
const ENUM = "enum";
const DEFAULT = "default";
const ALLOW_NULL = "allowNull";
const NULL$1 = "null";
const SUM = "sum";
const AVG = "avg";
const MIN = "min";
const MAX = "max";
const LISTENER = "Listener";
const SET = "set";
const ADD = "add";
const DEL = "del";
const HAS = "Has";
const IDS = "Ids";
const TABLE = "Table";
const TABLES$1 = TABLE + "s";
const TABLE_IDS = TABLE + IDS;
const ROW = "Row";
const ROW_COUNT = ROW + "Count";
const ROW_IDS = ROW + IDS;
const CELL = "Cell";
const CELL_IDS = CELL + IDS;
const VALUE = "Value";
const VALUES = VALUE + "s";
const VALUE_IDS = VALUE + IDS;
const TRANSACTION = "Transaction";
const REQUIRED = "required";
const UNDEFINED$1 = "￼";
const JSON_PREFIX = "�";
const id = (key) => EMPTY_STRING$1 + key;
const strStartsWith$1 = (str2, prefix) => str2.startsWith(prefix);
const strEndsWith = (str2, suffix) => str2.endsWith(suffix);
const strSplit$1 = (str2, separator = EMPTY_STRING$1, limit) => str2.split(separator, limit);
const math$1 = Math;
const getIfNotFunction$1 = (predicate) => (value, then, otherwise) => predicate(value) ? (
  /* istanbul ignore next */
  otherwise?.()
) : then(value);
const GLOBAL$1 = globalThis;
const mathMax$1 = math$1.max;
const mathMin = math$1.min;
const mathFloor$1 = math$1.floor;
const mathRandom$1 = math$1.random;
const infinity = Infinity;
const isFiniteNumber$1 = isFinite;
const isInstanceOf = (thing, cls) => thing instanceof cls;
const isNullish$1 = (thing) => thing == null;
const isUndefined$1 = (thing) => thing === void 0;
const isNull$1 = (thing) => thing === null;
const ifNotNullish$1 = getIfNotFunction$1(isNullish$1);
const ifNotUndefined$1 = getIfNotFunction$1(isUndefined$1);
const isTypeStringOrBoolean$1 = (type) => type == STRING$1 || type == BOOLEAN$1;
const isString$1 = (thing) => getTypeOf$1(thing) == STRING$1;
const isNumber$1 = (thing) => getTypeOf$1(thing) == NUMBER$1;
const isFunction = (thing) => getTypeOf$1(thing) == FUNCTION;
const isArray$1 = (thing) => Array.isArray(thing);
const slice$1 = (arrayOrString, start, end) => arrayOrString.slice(start, end);
const size$1 = (thing) => thing.length;
const test$1 = (regex, subject) => regex.test(subject);
const getArg = (value) => value;
const structuredClone = GLOBAL$1.structuredClone;
const arrayHas = (array, value) => array.includes(value);
const arrayEvery$1 = (array, cb) => array.every(cb);
const arrayIsEqual = (array1, array2) => size$1(array1) === size$1(array2) && arrayEvery$1(array1, (value1, index) => array2[index] === value1);
const arraySort = (array, sorter) => array.sort(sorter);
const arrayForEach$1 = (array, cb) => array.forEach(cb);
const arrayMap$1 = (array, cb) => array.map(cb);
const arraySum = (array) => arrayReduce$1(array, (i, j) => i + j, 0);
const arrayMax = (array) => arrayReduce$1(array, (maximum, value) => mathMax$1(maximum, value), -infinity);
const arrayMin = (array) => arrayReduce$1(array, (minimum, value) => mathMin(minimum, value), infinity);
const arrayReduce$1 = (array, cb, initial) => array.reduce(cb, initial);
const arrayClear$1 = (array, to = size$1(array)) => array.splice(0, to);
const arrayPush$1 = (array, ...values) => array.push(...values);
const arrayPop = (array) => array.pop();
const arrayShift$1 = (array) => array.shift();
const object$1 = Object;
const getPrototypeOf$1 = (obj) => object$1.getPrototypeOf(obj);
const objFrozen = object$1.isFrozen;
const isObject$1 = (obj) => !isNullish$1(obj) && ifNotNullish$1(
  getPrototypeOf$1(obj),
  (objPrototype) => objPrototype == object$1.prototype || isNullish$1(getPrototypeOf$1(objPrototype)),
  /* istanbul ignore next */
  () => true
);
const objIds$1 = object$1.keys;
const objFreeze$1 = object$1.freeze;
const objHas$1 = (obj, id2) => object$1.hasOwn(obj, id2);
const objGet = (obj, id2) => ifNotUndefined$1(
  obj,
  (obj2) => ifNotUndefined$1(object$1.getOwnPropertyDescriptor(obj2, id2), () => obj2[id2])
);
const objSet$1 = (obj, id2, value) => {
  object$1.defineProperty(obj, id2, {
    configurable: true,
    enumerable: true,
    value,
    writable: true
  });
  return value;
};
const objNew$1 = (entries = []) => {
  const obj = object$1.create(null);
  arrayForEach$1(entries, ([id2, value]) => objSet$1(obj, id2, value));
  return obj;
};
const objDel = (obj, id2) => {
  delete obj[id2];
  return obj;
};
const objForEach$1 = (obj, cb) => arrayForEach$1(objIds$1(obj), (id2) => cb(obj[id2], id2));
const objEvery$1 = (obj, cb) => {
  for (const id2 in obj) {
    if (objHas$1(obj, id2) && !cb(obj[id2], id2)) {
      return false;
    }
  }
  return true;
};
const objMap$1 = (obj, cb) => {
  const mapped = objNew$1();
  objForEach$1(obj, (value, id2) => objSet$1(mapped, id2, cb(value, id2)));
  return mapped;
};
const objSize$1 = (obj) => size$1(objIds$1(obj));
const objIsEmpty$1 = (obj) => isObject$1(obj) && objSize$1(obj) == 0;
const objIsEqual = (obj1, obj2, isEqual = (value1, value2) => value1 === value2) => objSize$1(obj1) === objSize$1(obj2) && objEvery$1(
  obj1,
  (value1, index) => objHas$1(obj2, index) ? isObject$1(value1) ? (
    /* istanbul ignore next */
    isObject$1(obj2[index]) ? objIsEqual(obj2[index], value1, isEqual) : false
  ) : isEqual(value1, obj2[index]) : false
);
const objEnsure$1 = (obj, id2, getDefaultValue) => {
  if (!objHas$1(obj, id2)) {
    objSet$1(obj, id2, getDefaultValue());
  }
  return obj[id2];
};
const objValidate = (obj, validateChild, onInvalidObj) => {
  if (isNullish$1(obj) || !isObject$1(obj) || objIsEmpty$1(obj) || objFrozen(obj)) {
    onInvalidObj?.();
    return false;
  }
  objForEach$1(obj, (child, id2) => {
    if (!validateChild(child, id2)) {
      objDel(obj, id2);
    }
  });
  return !objIsEmpty$1(obj);
};
const jsonString$1 = JSON.stringify;
const jsonParse$1 = JSON.parse;
const jsonStringWithMap = (obj) => jsonString$1(
  obj,
  (_key, value) => isInstanceOf(value, Map) ? objNew$1([...value]) : value
);
const getCellOrValueType$1 = (cellOrValue) => {
  if (isNull$1(cellOrValue)) {
    return NULL$1;
  }
  if (isArray$1(cellOrValue)) {
    return ARRAY$1;
  }
  if (isObject$1(cellOrValue)) {
    return OBJECT$1;
  }
  const type = getTypeOf$1(cellOrValue);
  return isTypeStringOrBoolean$1(type) || type == NUMBER$1 && isFiniteNumber$1(cellOrValue) ? type : void 0;
};
const isCellOrValueOrUndefined$1 = (cellOrValue) => isUndefined$1(cellOrValue) || !isUndefined$1(getCellOrValueType$1(cellOrValue));
const isJsonType = (type) => type == OBJECT$1 || type == ARRAY$1;
const isCellOrValueSchemaType = (type) => isTypeStringOrBoolean$1(type) || type == NUMBER$1 || isJsonType(type);
const isCellOrValueSchemaTypes = (types) => isArray$1(types) ? !isUndefined$1(types[0]) && arrayEvery$1(types, isCellOrValueSchemaType) : isCellOrValueSchemaType(types);
const cellOrValueSchemaTypeIncludes = (types, type) => isArray$1(types) ? arrayHas(types, type) : types == type;
const encodeIfJson = (value) => isObject$1(value) || isArray$1(value) ? JSON_PREFIX + jsonString$1(value) : value;
const isEncodedJson = (value) => isString$1(value) && value[0] == JSON_PREFIX;
const isReservedString = (value, encoded = 0) => value === UNDEFINED$1 || !encoded && isEncodedJson(value);
const decodeIfJson = (raw, _id, encoded) => !encoded && isEncodedJson(raw) ? jsonParse$1(slice$1(raw, 1)) : raw;
const collSizeN = (collSizer) => (coll) => {
  let total = 0;
  for (const child of coll.values()) {
    total += collSizer(child);
  }
  return total;
};
const collSize$1 = (coll) => coll?.size ?? 0;
const collSize2 = collSizeN(collSize$1);
const collSize3 = collSizeN(collSize2);
const collSize4 = collSizeN(collSize3);
const collHas$1 = (coll, keyOrValue) => coll?.has(keyOrValue) ?? false;
const collIsEmpty$1 = (coll) => isUndefined$1(coll) || collSize$1(coll) == 0;
const collEvery = (coll, cb) => {
  for (const [key, value] of coll?.entries() ?? []) {
    if (!cb(value, key)) {
      return false;
    }
  }
  return true;
};
const collClear$1 = (coll) => coll.clear();
const collForEach$1 = (coll, cb) => coll?.forEach(cb);
const collDel$1 = (coll, keyOrValue) => coll?.delete(keyOrValue);
const ERROR_HLC = 13;
const errorNew$1 = (code, details) => new Error(
  TINYBASE$1 + ":" + code + (isUndefined$1(details) ? EMPTY_STRING$1 : (
    /* istanbul ignore next */
    ":" + details
  ))
);
const errorThrow$1 = (code, details) => {
  throw errorNew$1(code, details);
};
const tryReturn$1 = (tryF, catchReturn) => {
  try {
    return tryF();
  } catch {
    return catchReturn;
  }
};
const tryCatchSync$1 = (action, onError) => {
  try {
    return action();
  } catch (error) {
    onError?.(error);
  }
};
const tryFinally$1 = (action, finallyAction) => {
  try {
    return action();
  } finally {
    finallyAction();
  }
};
const map$1 = Map;
const mapNew$1 = (entries) => new map$1(entries);
const mapKeys = (map2) => [...map2?.keys() ?? []];
const mapGet$1 = (map2, key) => map2?.get(key);
const mapForEach$1 = (map2, cb) => collForEach$1(map2, (value, key) => cb(key, value));
const mapMap = (coll, cb) => {
  const mapped = [];
  mapForEach$1(coll, (key, value) => arrayPush$1(mapped, cb(value, key)));
  return mapped;
};
const mapSet$1 = (map2, key, value) => isUndefined$1(value) ? (collDel$1(map2, key), map2) : map2?.set(key, value);
const mapEnsure$1 = (map2, key, getDefaultValue, hadExistingValue) => {
  let value = mapGet$1(map2, key);
  if (collHas$1(map2, key)) {
    hadExistingValue?.(value);
  } else {
    mapSet$1(map2, key, value = getDefaultValue());
  }
  return value;
};
const mapMatch = (map2, obj, set, del = mapSet$1) => {
  objForEach$1(obj, (value, id2) => set(map2, id2, value));
  mapForEach$1(map2, (id2) => objHas$1(obj, id2) ? 0 : del(map2, id2));
  return map2;
};
const mapToObj = (map2, valueMapper, excludeMapValue, excludeObjValue) => {
  const obj = objNew$1();
  collForEach$1(map2, (mapValue, id2) => {
    if (!excludeMapValue?.(mapValue, id2)) {
      const objValue = valueMapper ? valueMapper(mapValue, id2) : mapValue;
      if (!excludeObjValue?.(objValue)) {
        objSet$1(obj, id2, objValue);
      }
    }
  });
  return obj;
};
const mapToObj2 = (map2, valueMapper, excludeMapValue) => mapToObj(
  map2,
  (childMap) => mapToObj(childMap, valueMapper, excludeMapValue),
  collIsEmpty$1,
  objIsEmpty$1
);
const mapToObj3 = (map2, valueMapper, excludeMapValue) => mapToObj(
  map2,
  (childMap) => mapToObj2(childMap, valueMapper, excludeMapValue),
  collIsEmpty$1,
  objIsEmpty$1
);
const mapClone = (map2, mapValue) => {
  const map22 = mapNew$1();
  collForEach$1(map2, (value, key) => map22.set(key, mapValue?.(value) ?? value));
  return map22;
};
const mapClone2 = (map2) => mapClone(map2, mapClone);
const mapClone3 = (map2) => mapClone(map2, mapClone2);
const visitTree$1 = (node, path, ensureLeaf, pruneLeaf, p = 0) => ifNotUndefined$1(
  (ensureLeaf ? mapEnsure$1 : mapGet$1)(
    node,
    path[p],
    p > size$1(path) - 2 ? ensureLeaf : mapNew$1
  ),
  (nodeOrLeaf) => {
    if (p > size$1(path) - 2) {
      if (pruneLeaf?.(nodeOrLeaf)) {
        mapSet$1(node, path[p]);
      }
      return nodeOrLeaf;
    }
    const leaf = visitTree$1(nodeOrLeaf, path, ensureLeaf, pruneLeaf, p + 1);
    if (collIsEmpty$1(nodeOrLeaf)) {
      mapSet$1(node, path[p]);
    }
    return leaf;
  }
);
const setNew$1 = (entryOrEntries) => new Set(
  isArray$1(entryOrEntries) || isUndefined$1(entryOrEntries) ? entryOrEntries : [entryOrEntries]
);
const setAdd$1 = (set, value) => set?.add(value);
const INTEGER$1 = /^\d+$/;
const getPoolFunctions$1 = () => {
  const pool = [];
  let nextId = 0;
  return [
    (reuse) => (reuse ? arrayShift$1(pool) : null) ?? EMPTY_STRING$1 + nextId++,
    (id2) => {
      if (test$1(INTEGER$1, id2) && size$1(pool) < 1e3) {
        arrayPush$1(pool, id2);
      }
    }
  ];
};
const getWildcardedLeaves$1 = (deepIdSet, path = [EMPTY_STRING$1]) => {
  const leaves = [];
  const deep = (node, p) => p == size$1(path) ? arrayPush$1(leaves, node) : isNull$1(path[p]) ? collForEach$1(node, (node2) => deep(node2, p + 1)) : arrayForEach$1([path[p], null], (id2) => deep(mapGet$1(node, id2), p + 1));
  deep(deepIdSet, 0);
  return leaves;
};
const getListenerFunctions$1 = (getThing) => {
  let thing;
  const [getId, releaseId] = getPoolFunctions$1();
  const allListeners = mapNew$1();
  const addListener = (listener, idSetNode, path, pathGetters = [], extraArgsGetter = () => []) => {
    thing ??= getThing();
    const id2 = getId(1);
    mapSet$1(allListeners, id2, [
      listener,
      idSetNode,
      path,
      pathGetters,
      extraArgsGetter
    ]);
    setAdd$1(visitTree$1(idSetNode, path ?? [EMPTY_STRING$1], setNew$1), id2);
    return id2;
  };
  const callListenersImpl = (continueAfterError, idSetNode, ids, extraArgs) => {
    let errorToThrow;
    let failed = false;
    arrayForEach$1(
      getWildcardedLeaves$1(idSetNode, ids),
      (set) => collForEach$1(set, (id2) => {
        const callListener2 = () => mapGet$1(allListeners, id2)[0](thing, ...ids ?? [], ...extraArgs);
        if (continueAfterError) {
          tryCatchSync$1(callListener2, (error) => {
            if (!failed) {
              errorToThrow = error;
            }
            failed = true;
          });
        } else {
          callListener2();
        }
      })
    );
    if (failed) {
      throw errorToThrow;
    }
  };
  const callListeners = (idSetNode, ids, ...extraArgs) => callListenersImpl(false, idSetNode, ids, extraArgs);
  const callListenersThenThrow = (idSetNode, ids, ...extraArgs) => callListenersImpl(true, idSetNode, ids, extraArgs);
  const delListener = (id2) => ifNotUndefined$1(mapGet$1(allListeners, id2), ([, idSetNode, idOrNulls]) => {
    visitTree$1(idSetNode, idOrNulls ?? [EMPTY_STRING$1], void 0, (idSet) => {
      collDel$1(idSet, id2);
      return collIsEmpty$1(idSet) ? 1 : 0;
    });
    mapSet$1(allListeners, id2);
    releaseId(id2);
    return idOrNulls;
  });
  const callListener = (id2) => ifNotUndefined$1(
    mapGet$1(allListeners, id2),
    ([listener, , path = [], pathGetters, extraArgsGetter]) => {
      const callWithIds = (...ids) => {
        const index = size$1(ids);
        if (index == size$1(path)) {
          listener(thing, ...ids, ...extraArgsGetter(ids));
        } else if (isNull$1(path[index])) {
          arrayForEach$1(
            pathGetters[index]?.(...ids) ?? [],
            (id22) => callWithIds(...ids, id22)
          );
        } else {
          callWithIds(...ids, path[index]);
        }
      };
      callWithIds();
    }
  );
  return [
    addListener,
    callListeners,
    delListener,
    callListener,
    callListenersThenThrow
  ];
};
const MASK6$1 = 63;
const ENCODE$1 = strSplit$1(
  "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz"
);
const DECODE$1 = mapNew$1(arrayMap$1(ENCODE$1, (char, index) => [char, index]));
const encode$1 = (num2) => ENCODE$1[num2 & MASK6$1];
const decode$1 = (str2, pos) => mapGet$1(DECODE$1, str2[pos]) ?? 0;
const getRandomValues$1 = GLOBAL$1.crypto ? (array) => GLOBAL$1.crypto.getRandomValues(array) : (
  /* istanbul ignore next */
  (array) => arrayMap$1(array, () => mathFloor$1(mathRandom$1() * 256))
);
const getUniqueId$1 = (length = 16) => arrayReduce$1(
  getRandomValues$1(new Uint8Array(length)),
  (uniqueId, number2) => uniqueId + encode$1(number2),
  EMPTY_STRING$1
);
const textEncoder = new GLOBAL$1.TextEncoder();
const getHash = (string) => {
  let hash = 2166136261;
  arrayForEach$1(textEncoder.encode(string), (char) => {
    hash ^= char;
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  });
  return hash >>> 0;
};
const addOrRemoveHash = (hash1, hash2) => (hash1 ^ hash2) >>> 0;
const getValueInValuesHash = (valueId, valueHash) => getHash(valueId + ":" + valueHash);
const getValueHash = (value, valueHlc) => getHash(jsonStringWithMap(value ?? null) + ":" + valueHlc);
const HLC_MAX_FUTURE_OFFSET = 5 * 60 * 1e3;
const SHIFT36$1 = 2 ** 36;
const SHIFT30$1 = 2 ** 30;
const SHIFT24$1 = 2 ** 24;
const SHIFT18$1 = 2 ** 18;
const SHIFT12$1 = 2 ** 12;
const SHIFT6$1 = 2 ** 6;
const HLC$1 = /^[-0-9A-Z_a-z]{16}$/;
const getClientIdFromUniqueId = (uniqueId) => {
  const clientHash30 = getHash(uniqueId);
  return encode$1(clientHash30 / SHIFT24$1) + encode$1(clientHash30 / SHIFT18$1) + encode$1(clientHash30 / SHIFT12$1) + encode$1(clientHash30 / SHIFT6$1) + encode$1(clientHash30);
};
const decodeHlcTime$1 = (hlc) => decode$1(hlc, 0) * SHIFT36$1 + decode$1(hlc, 1) * SHIFT30$1 + decode$1(hlc, 2) * SHIFT24$1 + decode$1(hlc, 3) * SHIFT18$1 + decode$1(hlc, 4) * SHIFT12$1 + decode$1(hlc, 5) * SHIFT6$1 + decode$1(hlc, 6);
const isHlc$1 = (hlc, maxLogicalTime) => hlc == EMPTY_STRING$1 || isString$1(hlc) && test$1(HLC$1, hlc) && decodeHlcTime$1(hlc) <= maxLogicalTime;
const getHlcFunctions = (uniqueId, getNow = Date.now) => {
  let lastLogicalTime = 0;
  let lastCounter = -1;
  const thisClientId = ifNotUndefined$1(
    uniqueId,
    getClientIdFromUniqueId,
    () => getUniqueId$1(5)
  );
  const getNextHlc = () => {
    seenHlc();
    if (++lastCounter == SHIFT24$1) {
      lastLogicalTime++;
      lastCounter = 0;
    }
    return encodeHlc(lastLogicalTime, lastCounter);
  };
  const seenHlc = (hlc) => {
    const now = getNow();
    if (!isUndefined$1(hlc) && !isHlc$1(hlc, now + HLC_MAX_FUTURE_OFFSET)) {
      return;
    }
    const previousLogicalTime = lastLogicalTime;
    const [remoteLogicalTime, remoteCounter] = isUndefined$1(hlc) || hlc == EMPTY_STRING$1 ? [0, 0] : decodeHlc(hlc);
    lastLogicalTime = mathMax$1(previousLogicalTime, remoteLogicalTime, now);
    lastCounter = lastLogicalTime == previousLogicalTime ? lastLogicalTime == remoteLogicalTime ? mathMax$1(lastCounter, remoteCounter) : lastCounter : lastLogicalTime == remoteLogicalTime ? remoteCounter : -1;
  };
  const encodeHlc = (logicalTime42, counter24, clientId) => encode$1(logicalTime42 / SHIFT36$1) + encode$1(logicalTime42 / SHIFT30$1) + encode$1(logicalTime42 / SHIFT24$1) + encode$1(logicalTime42 / SHIFT18$1) + encode$1(logicalTime42 / SHIFT12$1) + encode$1(logicalTime42 / SHIFT6$1) + encode$1(logicalTime42) + encode$1(counter24 / SHIFT18$1) + encode$1(counter24 / SHIFT12$1) + encode$1(counter24 / SHIFT6$1) + encode$1(counter24) + (isUndefined$1(clientId) ? thisClientId : getClientIdFromUniqueId(clientId));
  const decodeHlc = (hlc16) => [
    decodeHlcTime$1(hlc16),
    decode$1(hlc16, 7) * SHIFT18$1 + decode$1(hlc16, 8) * SHIFT12$1 + decode$1(hlc16, 9) * SHIFT6$1 + decode$1(hlc16, 10),
    slice$1(hlc16, 11)
  ];
  const getLastLogicalTime = () => lastLogicalTime;
  const getLastCounter = () => lastCounter;
  const getClientId = () => thisClientId;
  return [
    getNextHlc,
    seenHlc,
    encodeHlc,
    decodeHlc,
    getLastLogicalTime,
    getLastCounter,
    getClientId
  ];
};
const defaultSorter = (sortKey1, sortKey2) => (sortKey1 ?? 0) < (sortKey2 ?? 0) ? -1 : 1;
const stampClone = ([value, hlc]) => stampNew$1(value, hlc);
const stampNew$1 = (value, hlc) => hlc ? [value, hlc] : [value];
const stampNewWithHash = (value, hlc, hash) => [value, hlc, hash];
const getStampHash = (stamp) => stamp[2];
const replaceHlcHash = (oldHlc, newHlc) => newHlc > oldHlc ? (oldHlc ? getHash(oldHlc) : 0) ^ getHash(newHlc) : 0;
const getLatestHlc$1 = (hlc1, hlc2) => (
  /* istanbul ignore next */
  ((hlc1 ?? EMPTY_STRING$1) > (hlc2 ?? EMPTY_STRING$1) ? hlc1 : hlc2) ?? EMPTY_STRING$1
);
const stampUpdate = (stamp, hlc, hash) => {
  if (hlc > stamp[1]) {
    stamp[1] = hlc;
  }
  stamp[2] = hash >>> 0;
};
const stampNewObj$1 = (hlc = EMPTY_STRING$1) => stampNew$1(objNew$1(), hlc);
const stampNewMap = (hlc = EMPTY_STRING$1) => [mapNew$1(), hlc, 0];
const stampMapToObjWithHash = ([map2, hlc, hash], mapper) => [
  mapToObj(map2, mapper),
  hlc,
  hash
];
const stampMapToObjWithoutHash = ([map2, hlc], mapper = stampClone) => stampNew$1(mapToObj(map2, mapper), hlc);
const stampValidate = (stamp, validateThing) => isArray$1(stamp) && size$1(stamp) == 3 && isString$1(stamp[1]) && isNumber$1(stamp[2]) && isFiniteNumber$1(stamp[2]) && validateThing(stamp[0]);
const pairNew = (value) => [value, value];
const pairCollSize2 = (pair, func = collSize2) => func(pair[0]) + func(pair[1]);
const pairNewMap = () => [mapNew$1(), mapNew$1()];
const pairClone = (array) => [...array];
const pairIsEqual = ([entry1, entry2]) => entry1 === entry2;
const cloneSchema = (schema) => isArray$1(schema) ? arrayMap$1(schema, cloneSchema) : isObject$1(schema) ? objMap$1(schema, cloneSchema) : schema;
const decodeSchema = (schema) => objMap$1(
  schema,
  (value, id2) => id2 == DEFAULT ? decodeIfJson(value) : value
);
const idsChanged = (changedIds, id2, addedOrRemoved) => mapSet$1(
  changedIds,
  id2,
  mapGet$1(changedIds, id2) == -addedOrRemoved ? void 0 : addedOrRemoved
);
const contentOrChangesIsEqual = ([tables1, values1], [tables2, values2]) => objIsEqual(tables1, tables2) && objIsEqual(values1, values2);
const createStore = () => {
  let hasTablesSchema;
  let hasValuesSchema;
  let hadTables = false;
  let hadValues = false;
  let oldTablesSchema;
  let oldValuesSchema;
  let rollbackRequested = 0;
  let transactions = 0;
  let middleware = [];
  let internalListeners = [];
  let acceptingEncodedData = 0;
  let mutating = 0;
  const changedTableIds = mapNew$1();
  const changedTableCellIds = mapNew$1();
  const changedRowCount = mapNew$1();
  const changedRowIds = mapNew$1();
  const changedCellIds = mapNew$1();
  const changedCells = mapNew$1();
  const defaultedCells = mapNew$1();
  const changedValueIds = mapNew$1();
  const changedValues = mapNew$1();
  const defaultedValues = setNew$1();
  const invalidCells = mapNew$1();
  const invalidValues = mapNew$1();
  const tablesSchemaMap = mapNew$1();
  const tablesSchemaRowCache = mapNew$1();
  const valuesSchemaMap = mapNew$1();
  const valuesDefaulted = mapNew$1();
  const valuesNonDefaulted = setNew$1();
  const valuesRequiredNonDefaulted = setNew$1();
  const tablePoolFunctions = mapNew$1();
  const tableCellIds = mapNew$1();
  const tablesMap = mapNew$1();
  const valuesMap = mapNew$1();
  const hasTablesListeners = pairNewMap();
  const tablesListeners = pairNewMap();
  const tableIdsListeners = pairNewMap();
  const hasTableListeners = pairNewMap();
  const tableListeners = pairNewMap();
  const tableCellIdsListeners = pairNewMap();
  const hasTableCellListeners = pairNewMap();
  const rowCountListeners = pairNewMap();
  const rowIdsListeners = pairNewMap();
  const sortedRowIdsListeners = pairNewMap();
  const hasRowListeners = pairNewMap();
  const rowListeners = pairNewMap();
  const cellIdsListeners = pairNewMap();
  const hasCellListeners = pairNewMap();
  const cellListeners = pairNewMap();
  const invalidCellListeners = pairNewMap();
  const invalidValueListeners = pairNewMap();
  const hasValuesListeners = pairNewMap();
  const valuesListeners = pairNewMap();
  const valueIdsListeners = pairNewMap();
  const hasValueListeners = pairNewMap();
  const valueListeners = pairNewMap();
  const startTransactionListeners = mapNew$1();
  const finishTransactionListeners = pairNewMap();
  const [
    addListener,
    callListeners,
    delListenerImpl,
    callListenerImpl,
    callListenersThenThrow
  ] = getListenerFunctions$1(() => store);
  const whileMutating = (action) => {
    const wasMutating = mutating;
    mutating = 1;
    return tryFinally$1(action, () => mutating = wasMutating);
  };
  const whileAcceptingEncodedData = (action) => {
    const wasAcceptingEncodedData = acceptingEncodedData;
    acceptingEncodedData = 1;
    return tryFinally$1(
      action,
      () => acceptingEncodedData = wasAcceptingEncodedData
    );
  };
  const ifTransformed = (snapshot, getResult, then, isEqual = Object.is) => ifNotUndefined$1(
    getResult(),
    (result) => snapshot === result || isEqual(snapshot, result) ? then(result) : whileMutating(() => then(result))
  );
  const validateTablesSchema = (tableSchema) => objValidate(
    tableSchema,
    (tableSchema2) => objValidate(tableSchema2, validateCellOrValueSchema)
  );
  const validateValuesSchema = (valuesSchema) => objValidate(valuesSchema, validateCellOrValueSchema);
  const validateCellOrValueSchema = (schema) => {
    if (!objValidate(
      schema,
      (_child, id2) => arrayHas([TYPE, ENUM, DEFAULT, ALLOW_NULL, REQUIRED], id2)
    )) {
      return false;
    }
    const type = schema[TYPE];
    const enumValues = schema[ENUM];
    if (isUndefined$1(enumValues) ? !isCellOrValueSchemaTypes(type) : !isUndefined$1(type) || !isArray$1(enumValues) || isUndefined$1(enumValues[0]) || !arrayEvery$1(enumValues, (enumValue) => {
      const enumType = getCellOrValueType$1(enumValue);
      return !isNull$1(enumValue) && !isUndefined$1(enumType) && !isJsonType(enumType) && !isReservedString(enumValue);
    })) {
      return false;
    }
    const defaultValue = schema[DEFAULT];
    if (isNull$1(defaultValue) && !schema[ALLOW_NULL]) {
      return false;
    }
    if (!isNull$1(defaultValue)) {
      if ((isUndefined$1(enumValues) ? !cellOrValueSchemaTypeIncludes(
        type,
        getCellOrValueType$1(defaultValue)
      ) : !arrayHas(enumValues, defaultValue)) || isReservedString(defaultValue)) {
        objDel(schema, DEFAULT);
      } else {
        ifNotUndefined$1(
          tryReturn$1(() => encodeIfJson(defaultValue)),
          (defaultValue2) => schema[DEFAULT] = defaultValue2,
          () => objDel(schema, DEFAULT)
        );
      }
    }
    return true;
  };
  const encodeValid = (cellOrValue, invalid) => ifNotUndefined$1(
    tryReturn$1(() => encodeIfJson(cellOrValue)),
    (cellOrValue2) => cellOrValue2,
    invalid
  );
  const cloneRow = (row) => isObject$1(row) ? objMap$1(row, getArg) : row;
  const cloneTable = (table) => isObject$1(table) ? objMap$1(table, cloneRow) : table;
  const cloneTables = (tables) => isObject$1(tables) ? objMap$1(tables, cloneTable) : tables;
  const cloneValues = (values) => isObject$1(values) ? objMap$1(values, getArg) : values;
  const isValidEncodedJson = (cellOrValue, types) => acceptingEncodedData == 1 && isEncodedJson(cellOrValue) && tryReturn$1(() => {
    const encodedType = getCellOrValueType$1(decodeIfJson(cellOrValue));
    return isJsonType(encodedType) && (isUndefined$1(types) || cellOrValueSchemaTypeIncludes(types, encodedType));
  }, false) == true;
  const validateContent = isArray$1;
  const validateTables = (tables) => objValidate(tables, validateTable, cellInvalid);
  const validateTable = (table, tableId) => (!hasTablesSchema || collHas$1(tablesSchemaMap, tableId) || /* istanbul ignore next */
  cellInvalid(tableId)) && objValidate(
    table,
    (row, rowId) => validateRow(tableId, rowId, row),
    () => cellInvalid(tableId)
  );
  const validateRow = (tableId, rowId, row, skipDefaults) => {
    const rowWithDefaults = skipDefaults ? row : addDefaultsToRow(row, tableId, rowId);
    return objValidate(
      rowWithDefaults,
      (cell, cellId) => ifNotUndefined$1(
        getValidatedCell(tableId, rowId, cellId, cell),
        (validCell) => {
          objSet$1(row, cellId, validCell);
          return true;
        },
        () => false
      ),
      () => cellInvalid(tableId, rowId)
    ) && (skipDefaults ? true : collEvery(
      mapGet$1(tablesSchemaRowCache, tableId)?.[2],
      (cellId) => objHas$1(rowWithDefaults, cellId)
    ));
  };
  const getValidatedCell = (tableId, rowId, cellId, cell) => hasTablesSchema ? ifNotUndefined$1(
    mapGet$1(mapGet$1(tablesSchemaMap, tableId), cellId),
    (cellSchema) => isNull$1(cell) ? cellSchema[ALLOW_NULL] ? cell : cellInvalid(tableId, rowId, cellId, cell, cellSchema[DEFAULT]) : isReservedString(cell, acceptingEncodedData) ? cellInvalid(tableId, rowId, cellId, cell, cellSchema[DEFAULT]) : isEncodedJson(cell) ? isUndefined$1(cellSchema[ENUM]) && isValidEncodedJson(cell, cellSchema[TYPE]) ? cell : cellInvalid(
      tableId,
      rowId,
      cellId,
      cell,
      cellSchema[DEFAULT]
    ) : isUndefined$1(cellSchema[ENUM]) ? cellOrValueSchemaTypeIncludes(
      cellSchema[TYPE],
      getCellOrValueType$1(cell)
    ) ? encodeValid(
      cell,
      () => cellInvalid(
        tableId,
        rowId,
        cellId,
        cell,
        cellSchema[DEFAULT]
      )
    ) : cellInvalid(
      tableId,
      rowId,
      cellId,
      cell,
      cellSchema[DEFAULT]
    ) : arrayHas(cellSchema[ENUM], cell) ? cell : cellInvalid(
      tableId,
      rowId,
      cellId,
      cell,
      cellSchema[DEFAULT]
    ),
    () => cellInvalid(tableId, rowId, cellId, cell)
  ) : isUndefined$1(getCellOrValueType$1(cell)) || isReservedString(cell, acceptingEncodedData) || isEncodedJson(cell) && !isValidEncodedJson(cell) ? cellInvalid(tableId, rowId, cellId, cell) : encodeValid(cell, () => cellInvalid(tableId, rowId, cellId, cell));
  const validateValues = (values, skipDefaults) => {
    const valuesWithDefaults = skipDefaults ? values : addDefaultsToValues(values);
    return objValidate(
      valuesWithDefaults,
      (value, valueId) => ifNotUndefined$1(
        getValidatedValue(valueId, value),
        (validValue) => {
          objSet$1(values, valueId, validValue);
          return true;
        },
        () => false
      ),
      () => valueInvalid()
    ) && (skipDefaults ? true : collEvery(
      valuesRequiredNonDefaulted,
      (valueId) => objHas$1(valuesWithDefaults, valueId)
    ));
  };
  const getValidatedValue = (valueId, value) => hasValuesSchema ? ifNotUndefined$1(
    mapGet$1(valuesSchemaMap, valueId),
    (valueSchema) => isNull$1(value) ? valueSchema[ALLOW_NULL] ? value : valueInvalid(valueId, value, valueSchema[DEFAULT]) : isReservedString(value, acceptingEncodedData) ? valueInvalid(valueId, value, valueSchema[DEFAULT]) : isEncodedJson(value) ? isUndefined$1(valueSchema[ENUM]) && isValidEncodedJson(value, valueSchema[TYPE]) ? value : valueInvalid(valueId, value, valueSchema[DEFAULT]) : isUndefined$1(valueSchema[ENUM]) ? cellOrValueSchemaTypeIncludes(
      valueSchema[TYPE],
      getCellOrValueType$1(value)
    ) ? encodeValid(
      value,
      () => valueInvalid(valueId, value, valueSchema[DEFAULT])
    ) : valueInvalid(valueId, value, valueSchema[DEFAULT]) : arrayHas(valueSchema[ENUM], value) ? value : valueInvalid(valueId, value, valueSchema[DEFAULT]),
    () => valueInvalid(valueId, value)
  ) : isUndefined$1(getCellOrValueType$1(value)) || isReservedString(value, acceptingEncodedData) || isEncodedJson(value) && !isValidEncodedJson(value) ? valueInvalid(valueId, value) : encodeValid(value, () => valueInvalid(valueId, value));
  const addDefaultsToRow = (row, tableId, rowId) => {
    ifNotUndefined$1(
      mapGet$1(tablesSchemaRowCache, tableId),
      ([rowDefaulted, rowNonDefaulted]) => {
        collForEach$1(rowDefaulted, (cell, cellId) => {
          if (!objHas$1(row, cellId)) {
            objSet$1(row, cellId, cell);
            ifNotUndefined$1(
              rowId,
              (rowId2) => setAdd$1(
                mapEnsure$1(
                  mapEnsure$1(defaultedCells, tableId, mapNew$1),
                  rowId2,
                  setNew$1
                ),
                cellId
              )
            );
          }
        });
        collForEach$1(rowNonDefaulted, (cellId) => {
          if (!objHas$1(row, cellId)) {
            cellInvalid(tableId, rowId, cellId);
          }
        });
      }
    );
    return row;
  };
  const addDefaultsToValues = (values) => {
    if (hasValuesSchema) {
      collForEach$1(valuesDefaulted, (value, valueId) => {
        if (!objHas$1(values, valueId)) {
          objSet$1(values, valueId, value);
          setAdd$1(defaultedValues, valueId);
        }
      });
      collForEach$1(valuesNonDefaulted, (valueId) => {
        if (!objHas$1(values, valueId)) {
          valueInvalid(valueId);
        }
      });
    }
    return values;
  };
  const setValidTablesSchema = (tablesSchema) => mapMatch(
    tablesSchemaMap,
    tablesSchema,
    (_tablesSchema, tableId, tableSchema) => {
      const rowDefaulted = mapNew$1();
      const rowNonDefaulted = setNew$1();
      const rowRequiredNonDefaulted = setNew$1();
      mapMatch(
        mapEnsure$1(tablesSchemaMap, tableId, mapNew$1),
        tableSchema,
        (tableSchemaMap, cellId, cellSchema) => {
          mapSet$1(tableSchemaMap, cellId, cellSchema);
          ifNotUndefined$1(
            cellSchema[DEFAULT],
            (defaultCell) => {
              mapSet$1(rowDefaulted, cellId, defaultCell);
            },
            () => {
              setAdd$1(rowNonDefaulted, cellId);
              if (cellSchema[REQUIRED] === true) {
                setAdd$1(rowRequiredNonDefaulted, cellId);
              }
            }
          );
        }
      );
      mapSet$1(tablesSchemaRowCache, tableId, [
        rowDefaulted,
        rowNonDefaulted,
        rowRequiredNonDefaulted
      ]);
    },
    (_tablesSchema, tableId) => {
      mapSet$1(tablesSchemaMap, tableId);
      mapSet$1(tablesSchemaRowCache, tableId);
    }
  );
  const setValidValuesSchema = (valuesSchema) => mapMatch(
    valuesSchemaMap,
    valuesSchema,
    (_valuesSchema, valueId, valueSchema) => {
      mapSet$1(valuesSchemaMap, valueId, valueSchema);
      ifNotUndefined$1(
        valueSchema[DEFAULT],
        (defaultValue) => {
          mapSet$1(valuesDefaulted, valueId, defaultValue);
          collDel$1(valuesNonDefaulted, valueId);
          collDel$1(valuesRequiredNonDefaulted, valueId);
        },
        () => {
          mapSet$1(valuesDefaulted, valueId);
          setAdd$1(valuesNonDefaulted, valueId);
          if (valueSchema[REQUIRED] === true) {
            setAdd$1(valuesRequiredNonDefaulted, valueId);
          } else {
            collDel$1(valuesRequiredNonDefaulted, valueId);
          }
        }
      );
    },
    (_valuesSchema, valueId) => {
      mapSet$1(valuesSchemaMap, valueId);
      mapSet$1(valuesDefaulted, valueId);
      collDel$1(valuesNonDefaulted, valueId);
      collDel$1(valuesRequiredNonDefaulted, valueId);
    }
  );
  const saveTablesSchema = () => {
    oldTablesSchema ??= [!!hasTablesSchema, mapToObj2(tablesSchemaMap)];
  };
  const saveValuesSchema = () => {
    oldValuesSchema ??= [!!hasValuesSchema, mapToObj(valuesSchemaMap)];
  };
  const setOrDelTables = (tables) => objIsEmpty$1(tables) ? delTables() : setTables(tables);
  const setOrDelCell = (tableId, rowId, cellId, cell, skipMiddleware, skipRowMiddleware) => isUndefined$1(cell) ? delCell(tableId, rowId, cellId, true, skipMiddleware) : setCell(
    tableId,
    rowId,
    cellId,
    cell,
    skipMiddleware,
    skipRowMiddleware
  );
  const setOrDelValues = (values) => objIsEmpty$1(values) ? delValues() : setValues(values);
  const setOrDelValue = (valueId, value, skipMiddleware) => isUndefined$1(value) ? delValue(valueId, skipMiddleware) : setValue(valueId, value, skipMiddleware);
  const setValidContent = (content) => ifTransformed(
    content,
    () => ifNotUndefined$1(
      middleware[0],
      (willSetContent) => whileMutating(
        () => willSetContent(structuredClone(content), acceptingEncodedData)
      ),
      () => content
    ),
    ([tables, values]) => {
      (objIsEmpty$1(tables) ? delTables : setTables)(tables);
      (objIsEmpty$1(values) ? delValues : setValues)(values);
    },
    contentOrChangesIsEqual
  );
  const setValidTables = (tables, forceDel) => ifTransformed(
    tables,
    () => forceDel ? tables : ifNotUndefined$1(
      middleware[1],
      (willSetTables) => whileMutating(() => willSetTables(structuredClone(tables))),
      () => tables
    ),
    (validTables) => mapMatch(
      tablesMap,
      validTables,
      (_tables, tableId, table) => setValidTable(tableId, table),
      (_tables, tableId) => delValidTable(tableId)
    ),
    objIsEqual
  );
  const setValidTable = (tableId, table, forceDel) => ifTransformed(
    table,
    () => forceDel ? table : ifNotUndefined$1(
      middleware[2],
      (willSetTable) => whileMutating(
        () => willSetTable(tableId, structuredClone(table))
      ),
      () => table
    ),
    (validTable) => mapMatch(
      mapEnsure$1(tablesMap, tableId, () => {
        tableIdsChanged(tableId, 1);
        mapSet$1(tablePoolFunctions, tableId, getPoolFunctions$1());
        mapSet$1(tableCellIds, tableId, mapNew$1());
        return mapNew$1();
      }),
      validTable,
      (tableMap, rowId, row) => setValidRow(tableId, tableMap, rowId, row),
      (tableMap, rowId) => delValidRow(tableId, tableMap, rowId)
    ),
    objIsEqual
  );
  const setValidRow = (tableId, tableMap, rowId, row, forceDel) => ifTransformed(
    row,
    () => forceDel ? row : ifNotUndefined$1(
      middleware[3],
      (willSetRow) => whileMutating(
        () => willSetRow(tableId, rowId, structuredClone(row))
      ),
      () => row
    ),
    (validRow) => mapMatch(
      mapEnsure$1(tableMap, rowId, () => {
        rowIdsChanged(tableId, rowId, 1);
        return mapNew$1();
      }),
      validRow,
      (rowMap, cellId, cell) => setValidCell(tableId, rowId, rowMap, cellId, cell),
      (rowMap, cellId) => delValidCell(tableId, tableMap, rowId, rowMap, cellId, forceDel)
    ),
    objIsEqual
  );
  const applyRowDirectly = (tableId, tableMap, rowId, row, skipMiddleware) => {
    mapMatch(
      mapEnsure$1(tableMap, rowId, () => {
        rowIdsChanged(tableId, rowId, 1);
        return mapNew$1();
      }),
      row,
      (rowMap, cellId, cell) => ifNotUndefined$1(
        getValidatedCell(tableId, rowId, cellId, decodeIfJson(cell)),
        (validCell) => setValidCell(
          tableId,
          rowId,
          rowMap,
          cellId,
          validCell,
          skipMiddleware
        )
      ),
      (rowMap, cellId) => delValidCell(tableId, tableMap, rowId, rowMap, cellId, true)
    );
  };
  const setValidCell = (tableId, rowId, rowMap, cellId, cell, skipMiddleware) => ifTransformed(
    cell,
    () => ifNotUndefined$1(
      skipMiddleware ? void 0 : middleware[4],
      (willSetCell) => whileMutating(() => willSetCell(tableId, rowId, cellId, cell)),
      () => cell
    ),
    (cell2) => ifNotUndefined$1(
      mutating ? getValidatedCell(tableId, rowId, cellId, decodeIfJson(cell2)) : cell2,
      (validCell) => {
        if (!collHas$1(rowMap, cellId)) {
          cellIdsChanged(tableId, rowId, cellId, 1);
        }
        const oldCell = mapGet$1(rowMap, cellId);
        if (validCell !== oldCell) {
          cellChanged(tableId, rowId, cellId, oldCell, validCell);
          mapSet$1(rowMap, cellId, validCell);
        }
      }
    )
  );
  const setCellIntoNewRow = (tableId, tableMap, rowId, cellId, validCell, skipMiddleware) => ifNotUndefined$1(
    mapGet$1(tableMap, rowId),
    (rowMap) => setValidCell(tableId, rowId, rowMap, cellId, validCell, skipMiddleware),
    () => {
      const rowMap = mapNew$1();
      mapSet$1(tableMap, rowId, rowMap);
      rowIdsChanged(tableId, rowId, 1);
      objForEach$1(
        addDefaultsToRow({ [cellId]: validCell }, tableId, rowId),
        (cell, cellId2) => setValidCell(tableId, rowId, rowMap, cellId2, cell, skipMiddleware)
      );
    }
  );
  const setValidValues = (values, forceDel) => ifTransformed(
    values,
    () => forceDel ? values : ifNotUndefined$1(
      middleware[5],
      (willSetValues) => whileMutating(() => willSetValues(structuredClone(values))),
      () => values
    ),
    (validValues) => mapMatch(
      valuesMap,
      validValues,
      (_valuesMap, valueId, value) => setValidValue(valueId, value),
      (_valuesMap, valueId) => delValidValue(valueId)
    ),
    objIsEqual
  );
  const setValidValue = (valueId, value, skipMiddleware) => ifTransformed(
    value,
    () => ifNotUndefined$1(
      skipMiddleware ? void 0 : middleware[6],
      (willSetValue) => whileMutating(() => willSetValue(valueId, value)),
      () => value
    ),
    (value2) => ifNotUndefined$1(
      mutating ? getValidatedValue(valueId, decodeIfJson(value2)) : value2,
      (validValue) => {
        if (!collHas$1(valuesMap, valueId)) {
          valueIdsChanged(valueId, 1);
        }
        const oldValue = mapGet$1(valuesMap, valueId);
        if (validValue !== oldValue) {
          valueChanged(valueId, oldValue, validValue);
          mapSet$1(valuesMap, valueId, validValue);
        }
      }
    )
  );
  const getNewRowId = (tableId, reuse) => {
    const [getId] = mapGet$1(tablePoolFunctions, tableId);
    let rowId;
    do {
      rowId = getId(reuse);
    } while (collHas$1(mapGet$1(tablesMap, tableId), rowId));
    return rowId;
  };
  const getOrCreateTable = (tableId) => mapEnsure$1(tablesMap, tableId, () => {
    tableIdsChanged(tableId, 1);
    mapSet$1(tablePoolFunctions, tableId, getPoolFunctions$1());
    mapSet$1(tableCellIds, tableId, mapNew$1());
    return mapNew$1();
  });
  const delValidTable = (tableId) => {
    if (whileMutating(() => middleware[8]?.(tableId)) ?? true) {
      return setValidTable(tableId, {}, true);
    }
    return mapGet$1(tablesMap, tableId);
  };
  const delValidRow = (tableId, tableMap, rowId) => {
    if (whileMutating(() => middleware[9]?.(tableId, rowId)) ?? true) {
      const [, releaseId] = mapGet$1(tablePoolFunctions, tableId);
      releaseId(rowId);
      setValidRow(tableId, tableMap, rowId, {}, true);
    }
  };
  const delValidCell = (tableId, table, rowId, row, cellId, forceDel, skipMiddleware) => {
    const defaultCell = mapGet$1(
      mapGet$1(tablesSchemaRowCache, tableId)?.[0],
      cellId
    );
    if (!isUndefined$1(defaultCell) && !forceDel) {
      return setValidCell(tableId, rowId, row, cellId, defaultCell);
    }
    if (skipMiddleware || (whileMutating(() => middleware[10]?.(tableId, rowId, cellId)) ?? true)) {
      const delCell2 = (cellId2) => {
        cellChanged(tableId, rowId, cellId2, mapGet$1(row, cellId2));
        cellIdsChanged(tableId, rowId, cellId2, -1);
        mapSet$1(row, cellId2);
      };
      if (isUndefined$1(defaultCell)) {
        delCell2(cellId);
      } else {
        mapForEach$1(row, delCell2);
      }
      if (collIsEmpty$1(row)) {
        rowIdsChanged(tableId, rowId, -1);
        if (collIsEmpty$1(mapSet$1(table, rowId))) {
          tableIdsChanged(tableId, -1);
          mapSet$1(tablesMap, tableId);
          mapSet$1(tablePoolFunctions, tableId);
          mapSet$1(tableCellIds, tableId);
        }
      }
    }
  };
  const delValidValue = (valueId, skipMiddleware) => {
    const defaultValue = mapGet$1(valuesDefaulted, valueId);
    if (!isUndefined$1(defaultValue)) {
      return setValidValue(valueId, defaultValue);
    }
    if (skipMiddleware || (whileMutating(() => middleware[12]?.(valueId)) ?? true)) {
      valueChanged(valueId, mapGet$1(valuesMap, valueId));
      valueIdsChanged(valueId, -1);
      mapSet$1(valuesMap, valueId);
    }
  };
  const tableIdsChanged = (tableId, addedOrRemoved) => idsChanged(changedTableIds, tableId, addedOrRemoved);
  const rowIdsChanged = (tableId, rowId, addedOrRemoved) => idsChanged(
    mapEnsure$1(changedRowIds, tableId, mapNew$1),
    rowId,
    addedOrRemoved
  ) && mapSet$1(
    changedRowCount,
    tableId,
    mapEnsure$1(changedRowCount, tableId, () => 0) + addedOrRemoved
  );
  const cellIdsChanged = (tableId, rowId, cellId, addedOrRemoved) => {
    const cellIds = mapGet$1(tableCellIds, tableId);
    const count = mapGet$1(cellIds, cellId) ?? 0;
    if (count == 0 && addedOrRemoved == 1 || count == 1 && addedOrRemoved == -1) {
      idsChanged(
        mapEnsure$1(changedTableCellIds, tableId, mapNew$1),
        cellId,
        addedOrRemoved
      );
    }
    mapSet$1(
      cellIds,
      cellId,
      count != -addedOrRemoved ? count + addedOrRemoved : void 0
    );
    idsChanged(
      mapEnsure$1(mapEnsure$1(changedCellIds, tableId, mapNew$1), rowId, mapNew$1),
      cellId,
      addedOrRemoved
    );
  };
  const cellChanged = (tableId, rowId, cellId, oldCell, newCell) => {
    const defaulted = collHas$1(mapGet$1(mapGet$1(defaultedCells, tableId), rowId), cellId) && isUndefined$1(oldCell) ? 1 : 0;
    mapEnsure$1(
      mapEnsure$1(mapEnsure$1(changedCells, tableId, mapNew$1), rowId, mapNew$1),
      cellId,
      () => [oldCell, 0]
    )[1] = newCell;
    internalListeners[3]?.(
      tableId,
      rowId,
      cellId,
      newCell,
      mutating,
      defaulted
    );
    collDel$1(mapGet$1(mapGet$1(defaultedCells, tableId), rowId), cellId);
  };
  const valueIdsChanged = (valueId, addedOrRemoved) => idsChanged(changedValueIds, valueId, addedOrRemoved);
  const valueChanged = (valueId, oldValue, newValue) => {
    const defaulted = collHas$1(defaultedValues, valueId) && isUndefined$1(oldValue) ? 1 : 0;
    mapEnsure$1(changedValues, valueId, () => [oldValue, 0])[1] = newValue;
    internalListeners[4]?.(valueId, newValue, mutating, defaulted);
    collDel$1(defaultedValues, valueId);
  };
  const cellInvalid = (tableId, rowId, cellId, invalidCell, defaultedCell) => {
    arrayPush$1(
      mapEnsure$1(
        mapEnsure$1(mapEnsure$1(invalidCells, tableId, mapNew$1), rowId, mapNew$1),
        cellId,
        () => []
      ),
      invalidCell
    );
    return defaultedCell;
  };
  const valueInvalid = (valueId, invalidValue, defaultedValue) => {
    arrayPush$1(
      mapEnsure$1(invalidValues, valueId, () => []),
      invalidValue
    );
    return defaultedValue;
  };
  const getCellChange = (tableId, rowId, cellId) => ifNotUndefined$1(
    mapGet$1(mapGet$1(mapGet$1(changedCells, tableId), rowId), cellId),
    ([oldCell, newCell]) => [
      true,
      decodeIfJson(oldCell),
      decodeIfJson(newCell)
    ],
    () => [false, ...pairNew(getCell(tableId, rowId, cellId))]
  );
  const getValueChange = (valueId) => ifNotUndefined$1(
    mapGet$1(changedValues, valueId),
    ([oldValue, newValue]) => [
      true,
      decodeIfJson(oldValue),
      decodeIfJson(newValue)
    ],
    () => [false, ...pairNew(getValue(valueId))]
  );
  const callInvalidCellListeners = (mutator) => !collIsEmpty$1(invalidCells) && !collIsEmpty$1(invalidCellListeners[mutator]) ? collForEach$1(
    mutator ? mapClone3(invalidCells) : invalidCells,
    (rows, tableId) => collForEach$1(
      rows,
      (cells, rowId) => collForEach$1(
        cells,
        (invalidCell, cellId) => callListeners(
          invalidCellListeners[mutator],
          [tableId, rowId, cellId],
          invalidCell
        )
      )
    )
  ) : 0;
  const callInvalidValueListeners = (mutator) => !collIsEmpty$1(invalidValues) && !collIsEmpty$1(invalidValueListeners[mutator]) ? collForEach$1(
    mutator ? mapClone(invalidValues) : invalidValues,
    (invalidValue, valueId) => callListeners(
      invalidValueListeners[mutator],
      [valueId],
      invalidValue
    )
  ) : 0;
  const callIdsAndHasListenersIfChanged = (changedIds, idListeners, hasListeners, ids) => {
    if (!collIsEmpty$1(changedIds)) {
      callListeners(idListeners, ids, () => mapToObj(changedIds));
      mapForEach$1(
        changedIds,
        (changedId, changed) => callListeners(hasListeners, [...ids ?? [], changedId], changed == 1)
      );
      return 1;
    }
  };
  const clonedChangedCells = (changedCells2) => mapClone(
    changedCells2,
    (map2) => mapClone(map2, (map22) => mapClone(map22, pairClone))
  );
  const callTabularListenersForChanges = (mutator) => {
    const hasHasTablesListeners = !collIsEmpty$1(hasTablesListeners[mutator]);
    const hasSortedRowIdListeners = !collIsEmpty$1(
      sortedRowIdsListeners[mutator]
    );
    const hasIdOrHasListeners = !(collIsEmpty$1(cellIdsListeners[mutator]) && collIsEmpty$1(hasCellListeners[mutator]) && collIsEmpty$1(rowIdsListeners[mutator]) && collIsEmpty$1(hasRowListeners[mutator]) && collIsEmpty$1(tableCellIdsListeners[mutator]) && collIsEmpty$1(hasTableCellListeners[mutator]) && collIsEmpty$1(rowCountListeners[mutator]) && !hasSortedRowIdListeners && collIsEmpty$1(tableIdsListeners[mutator]) && collIsEmpty$1(hasTableListeners[mutator]));
    const hasOtherListeners = !(collIsEmpty$1(cellListeners[mutator]) && collIsEmpty$1(rowListeners[mutator]) && collIsEmpty$1(tableListeners[mutator]) && collIsEmpty$1(tablesListeners[mutator]));
    if (hasHasTablesListeners || hasIdOrHasListeners || hasOtherListeners) {
      const changes = mutator ? [
        mapClone(changedTableIds),
        mapClone2(changedTableCellIds),
        mapClone(changedRowCount),
        mapClone2(changedRowIds),
        mapClone3(changedCellIds),
        clonedChangedCells(changedCells)
      ] : [
        changedTableIds,
        changedTableCellIds,
        changedRowCount,
        changedRowIds,
        changedCellIds,
        changedCells
      ];
      if (hasHasTablesListeners) {
        const hasTablesNow = hasTables();
        if (hasTablesNow != hadTables) {
          callListeners(hasTablesListeners[mutator], void 0, hasTablesNow);
        }
      }
      if (hasIdOrHasListeners) {
        callIdsAndHasListenersIfChanged(
          changes[0],
          tableIdsListeners[mutator],
          hasTableListeners[mutator]
        );
        collForEach$1(
          changes[1],
          (changedIds, tableId) => callIdsAndHasListenersIfChanged(
            changedIds,
            tableCellIdsListeners[mutator],
            hasTableCellListeners[mutator],
            [tableId]
          )
        );
        collForEach$1(changes[2], (changedCount, tableId) => {
          if (changedCount != 0) {
            callListeners(
              rowCountListeners[mutator],
              [tableId],
              getRowCount(tableId)
            );
          }
        });
        const calledSortableTableIds = setNew$1();
        collForEach$1(changes[3], (changedIds, tableId) => {
          if (callIdsAndHasListenersIfChanged(
            changedIds,
            rowIdsListeners[mutator],
            hasRowListeners[mutator],
            [tableId]
          ) && hasSortedRowIdListeners) {
            callListeners(sortedRowIdsListeners[mutator], [tableId, null]);
            setAdd$1(calledSortableTableIds, tableId);
          }
        });
        if (hasSortedRowIdListeners) {
          collForEach$1(changes[5], (rows, tableId) => {
            if (!collHas$1(calledSortableTableIds, tableId)) {
              const sortableCellIds = setNew$1();
              collForEach$1(
                rows,
                (cells) => collForEach$1(
                  cells,
                  ([oldCell, newCell], cellId) => newCell !== oldCell ? setAdd$1(sortableCellIds, cellId) : collDel$1(cells, cellId)
                )
              );
              collForEach$1(
                sortableCellIds,
                (cellId) => callListeners(sortedRowIdsListeners[mutator], [
                  tableId,
                  cellId
                ])
              );
            }
          });
        }
        collForEach$1(
          changes[4],
          (rowCellIds, tableId) => collForEach$1(
            rowCellIds,
            (changedIds, rowId) => callIdsAndHasListenersIfChanged(
              changedIds,
              cellIdsListeners[mutator],
              hasCellListeners[mutator],
              [tableId, rowId]
            )
          )
        );
      }
      if (hasOtherListeners) {
        let tablesChanged;
        collForEach$1(changes[5], (rows, tableId) => {
          let tableChanged;
          collForEach$1(rows, (cells, rowId) => {
            let rowChanged;
            collForEach$1(cells, ([oldCell, newCell], cellId) => {
              if (newCell !== oldCell) {
                callListeners(
                  cellListeners[mutator],
                  [tableId, rowId, cellId],
                  decodeIfJson(newCell),
                  decodeIfJson(oldCell),
                  getCellChange
                );
                tablesChanged = tableChanged = rowChanged = 1;
              }
            });
            if (rowChanged) {
              callListeners(
                rowListeners[mutator],
                [tableId, rowId],
                getCellChange
              );
            }
          });
          if (tableChanged) {
            callListeners(tableListeners[mutator], [tableId], getCellChange);
          }
        });
        if (tablesChanged) {
          callListeners(tablesListeners[mutator], void 0, getCellChange);
        }
      }
    }
  };
  const callValuesListenersForChanges = (mutator) => {
    const hasHasValuesListeners = !collIsEmpty$1(hasValuesListeners[mutator]);
    const hasIdOrHasListeners = !collIsEmpty$1(valueIdsListeners[mutator]) || !collIsEmpty$1(hasValueListeners[mutator]);
    const hasOtherListeners = !collIsEmpty$1(valueListeners[mutator]) || !collIsEmpty$1(valuesListeners[mutator]);
    if (hasHasValuesListeners || hasIdOrHasListeners || hasOtherListeners) {
      const changes = mutator ? [mapClone(changedValueIds), mapClone(changedValues, pairClone)] : [changedValueIds, changedValues];
      if (hasHasValuesListeners) {
        const hasValuesNow = hasValues();
        if (hasValuesNow != hadValues) {
          callListeners(hasValuesListeners[mutator], void 0, hasValuesNow);
        }
      }
      if (hasIdOrHasListeners) {
        callIdsAndHasListenersIfChanged(
          changes[0],
          valueIdsListeners[mutator],
          hasValueListeners[mutator]
        );
      }
      if (hasOtherListeners) {
        let valuesChanged;
        collForEach$1(changes[1], ([oldValue, newValue], valueId) => {
          if (newValue !== oldValue) {
            callListeners(
              valueListeners[mutator],
              [valueId],
              decodeIfJson(newValue),
              decodeIfJson(oldValue),
              getValueChange
            );
            valuesChanged = 1;
          }
        });
        if (valuesChanged) {
          callListeners(valuesListeners[mutator], void 0, getValueChange);
        }
      }
    }
  };
  const fluentTransaction = (actions, ...args) => {
    transaction(() => actions(...arrayMap$1(args, id)));
    return store;
  };
  const addSortedRowIdsListenerImpl = (tableId, cellId, otherArgs, listener, mutator) => {
    const [descending, offset, limit, sorter] = otherArgs;
    let sortedRowIds = getSortedRowIds(
      tableId,
      cellId,
      descending,
      offset,
      limit,
      sorter
    );
    return addListener(
      () => {
        const newSortedRowIds = getSortedRowIds(
          tableId,
          cellId,
          descending,
          offset,
          limit,
          sorter
        );
        if (!arrayIsEqual(newSortedRowIds, sortedRowIds)) {
          sortedRowIds = newSortedRowIds;
          listener(
            store,
            tableId,
            cellId,
            descending,
            offset,
            limit,
            sortedRowIds
          );
        }
      },
      sortedRowIdsListeners[mutator ? 1 : 0],
      [tableId, cellId],
      [getTableIds]
    );
  };
  const getTransactionChangesImpl = (encoded = false) => [
    mapToObj(
      changedCells,
      (table, tableId) => mapGet$1(changedTableIds, tableId) === -1 ? void 0 : mapToObj(
        table,
        (row, rowId) => mapGet$1(mapGet$1(changedRowIds, tableId), rowId) === -1 ? void 0 : mapToObj(
          row,
          ([, newCell]) => decodeIfJson(newCell, EMPTY_STRING$1, encoded),
          (changedCell) => pairIsEqual(changedCell)
        ),
        collIsEmpty$1,
        objIsEmpty$1
      ),
      collIsEmpty$1,
      objIsEmpty$1
    ),
    mapToObj(
      changedValues,
      ([, newValue]) => decodeIfJson(newValue, EMPTY_STRING$1, encoded),
      (changedValue) => pairIsEqual(changedValue)
    ),
    1
  ];
  const getContent = () => [getTables(), getValues()];
  const getEncodedContent = () => [mapToObj3(tablesMap), mapToObj(valuesMap)];
  const getTables = () => mapToObj3(tablesMap, decodeIfJson);
  const getTableIds = () => mapKeys(tablesMap);
  const getTable = (tableId) => mapToObj2(mapGet$1(tablesMap, id(tableId)), decodeIfJson);
  const getTableCellIds = (tableId) => mapKeys(mapGet$1(tableCellIds, id(tableId)));
  const getRowCount = (tableId) => collSize$1(mapGet$1(tablesMap, id(tableId)));
  const getRowIds = (tableId) => mapKeys(mapGet$1(tablesMap, id(tableId)));
  const getSortedRowIds = (tableIdOrArgs, cellId, descending, offset = 0, limit, sorter = defaultSorter) => isObject$1(tableIdOrArgs) ? getSortedRowIds(
    tableIdOrArgs.tableId,
    tableIdOrArgs.cellId,
    tableIdOrArgs.descending,
    tableIdOrArgs.offset,
    tableIdOrArgs.limit,
    tableIdOrArgs.sorter
  ) : arrayMap$1(
    slice$1(
      arraySort(
        mapMap(mapGet$1(tablesMap, id(tableIdOrArgs)), (row, rowId) => [
          isUndefined$1(cellId) ? rowId : decodeIfJson(mapGet$1(row, id(cellId))),
          rowId
        ]),
        ([cell1], [cell2]) => sorter(cell1, cell2) * (descending ? -1 : 1)
      ),
      offset,
      isUndefined$1(limit) ? limit : offset + limit
    ),
    ([, rowId]) => rowId
  );
  const getRow = (tableId, rowId) => mapToObj(mapGet$1(mapGet$1(tablesMap, id(tableId)), id(rowId)), decodeIfJson);
  const getCellIds = (tableId, rowId) => mapKeys(mapGet$1(mapGet$1(tablesMap, id(tableId)), id(rowId)));
  const getCell = (tableId, rowId, cellId) => decodeIfJson(
    mapGet$1(mapGet$1(mapGet$1(tablesMap, id(tableId)), id(rowId)), id(cellId))
  );
  const getValues = () => mapToObj(valuesMap, decodeIfJson);
  const getValueIds = () => mapKeys(valuesMap);
  const getValue = (valueId) => decodeIfJson(mapGet$1(valuesMap, id(valueId)));
  const hasTables = () => !collIsEmpty$1(tablesMap);
  const hasTable = (tableId) => collHas$1(tablesMap, id(tableId));
  const hasTableCell = (tableId, cellId) => collHas$1(mapGet$1(tableCellIds, id(tableId)), id(cellId));
  const hasRow = (tableId, rowId) => collHas$1(mapGet$1(tablesMap, id(tableId)), id(rowId));
  const hasCell = (tableId, rowId, cellId) => collHas$1(mapGet$1(mapGet$1(tablesMap, id(tableId)), id(rowId)), id(cellId));
  const hasValues = () => !collIsEmpty$1(valuesMap);
  const hasValue = (valueId) => collHas$1(valuesMap, id(valueId));
  const getTablesJson = () => jsonStringWithMap(tablesMap);
  const getValuesJson = () => jsonStringWithMap(valuesMap);
  const getJson = () => jsonStringWithMap([tablesMap, valuesMap]);
  const getTablesSchemaJson = () => jsonStringWithMap(mapToObj2(tablesSchemaMap, decodeSchema));
  const getValuesSchemaJson = () => jsonStringWithMap(mapToObj(valuesSchemaMap, decodeSchema));
  const getSchemaJson = () => jsonStringWithMap([
    mapToObj2(tablesSchemaMap, decodeSchema),
    mapToObj(valuesSchemaMap, decodeSchema)
  ]);
  const setContent = (content) => fluentTransaction(() => {
    const content2 = isFunction(content) ? content() : content;
    if (validateContent(content2)) {
      setValidContent(content2);
    }
  });
  const setTables = (tables) => fluentTransaction(() => {
    const tables2 = cloneTables(tables);
    return validateTables(tables2) ? setValidTables(tables2) : 0;
  });
  const setTable = (tableId, table) => fluentTransaction((tableId2) => {
    const table2 = cloneTable(table);
    return validateTable(table2, tableId2) ? setValidTable(tableId2, table2) : 0;
  }, tableId);
  const setRow = (tableId, rowId, row) => fluentTransaction(
    (tableId2, rowId2) => {
      const row2 = cloneRow(row);
      return validateRow(tableId2, rowId2, row2) ? setValidRow(tableId2, getOrCreateTable(tableId2), rowId2, row2) : 0;
    },
    tableId,
    rowId
  );
  const addRow = (tableId, row, reuseRowIds = true) => transaction(() => {
    let rowId = void 0;
    const row2 = cloneRow(row);
    if (validateRow(tableId, rowId, row2)) {
      tableId = id(tableId);
      setValidRow(
        tableId,
        getOrCreateTable(tableId),
        rowId = getNewRowId(tableId, reuseRowIds ? 1 : 0),
        row2
      );
    }
    return rowId;
  });
  const setPartialRow = (tableId, rowId, partialRow) => fluentTransaction(
    (tableId2, rowId2) => {
      const partialRow2 = cloneRow(partialRow);
      if (validateRow(tableId2, rowId2, partialRow2, 1)) {
        const table = getOrCreateTable(tableId2);
        objForEach$1(
          partialRow2,
          (cell, cellId) => setCellIntoNewRow(tableId2, table, rowId2, cellId, cell)
        );
      }
    },
    tableId,
    rowId
  );
  const setCell = (tableId, rowId, cellId, cell, skipMiddleware, skipRowMiddleware) => fluentTransaction(
    (tableId2, rowId2, cellId2) => ifNotUndefined$1(
      getValidatedCell(
        tableId2,
        rowId2,
        cellId2,
        isFunction(cell) ? cell(getCell(tableId2, rowId2, cellId2)) : cell
      ),
      (validCell) => {
        const tableMap = getOrCreateTable(tableId2);
        ifNotUndefined$1(
          skipMiddleware || skipRowMiddleware || !middleware[14]?.() ? void 0 : middleware[3],
          (willSetRow) => {
            const existingRowMap = mapGet$1(tableMap, rowId2);
            const prospectiveRow = {
              ...existingRowMap ? mapToObj(existingRowMap) : {},
              [cellId2]: validCell
            };
            ifNotUndefined$1(
              whileMutating(
                () => willSetRow(
                  tableId2,
                  rowId2,
                  structuredClone(prospectiveRow)
                )
              ),
              (row) => applyRowDirectly(
                tableId2,
                tableMap,
                rowId2,
                row,
                skipMiddleware
              )
            );
          },
          () => setCellIntoNewRow(
            tableId2,
            tableMap,
            rowId2,
            cellId2,
            validCell,
            skipMiddleware
          )
        );
      }
    ),
    tableId,
    rowId,
    cellId
  );
  const setValues = (values) => fluentTransaction(() => {
    const values2 = cloneValues(values);
    return validateValues(values2) ? setValidValues(values2) : 0;
  });
  const setPartialValues = (partialValues) => fluentTransaction(() => {
    const partialValues2 = cloneValues(partialValues);
    return validateValues(partialValues2, 1) ? objForEach$1(
      partialValues2,
      (value, valueId) => setValidValue(valueId, value)
    ) : 0;
  });
  const setValue = (valueId, value, skipMiddleware) => fluentTransaction(
    (valueId2) => ifNotUndefined$1(
      getValidatedValue(
        valueId2,
        isFunction(value) ? value(getValue(valueId2)) : value
      ),
      (validValue) => setValidValue(valueId2, validValue, skipMiddleware)
    ),
    valueId
  );
  const applyChanges = (changes) => fluentTransaction(
    () => ifTransformed(
      changes,
      () => ifNotUndefined$1(
        middleware[13],
        (willApplyChanges) => whileMutating(
          () => willApplyChanges(
            structuredClone(changes),
            acceptingEncodedData
          )
        ),
        () => changes
      ),
      (changes2) => {
        objForEach$1(
          changes2[0],
          (table, tableId) => isUndefined$1(table) ? delTable(tableId) : objForEach$1(
            table,
            (row, rowId) => isUndefined$1(row) ? delRow(tableId, rowId) : objForEach$1(
              row,
              (cell, cellId) => setOrDelCell(
                tableId,
                rowId,
                cellId,
                cell,
                void 0,
                true
              )
            )
          )
        );
        objForEach$1(
          changes2[1],
          (value, valueId) => setOrDelValue(valueId, value)
        );
      },
      contentOrChangesIsEqual
    )
  );
  const setTablesJson = (tablesJson) => {
    tryCatchSync$1(
      () => whileAcceptingEncodedData(() => setOrDelTables(jsonParse$1(tablesJson)))
    );
    return store;
  };
  const setValuesJson = (valuesJson) => {
    tryCatchSync$1(
      () => whileAcceptingEncodedData(() => setOrDelValues(jsonParse$1(valuesJson)))
    );
    return store;
  };
  const setJson = (tablesAndValuesJson) => fluentTransaction(
    () => tryCatchSync$1(
      () => whileAcceptingEncodedData(() => {
        const [tables, values] = jsonParse$1(tablesAndValuesJson);
        setOrDelTables(tables);
        setOrDelValues(values);
      }),
      () => setTablesJson(tablesAndValuesJson)
    )
  );
  const setEncodedContent = (content) => whileAcceptingEncodedData(() => setContent(content));
  const applyEncodedChanges = (changes) => whileAcceptingEncodedData(() => applyChanges(changes));
  const setTablesSchema = (tablesSchema) => fluentTransaction(() => {
    const tablesSchema2 = cloneSchema(tablesSchema);
    if (validateTablesSchema(tablesSchema2)) {
      saveTablesSchema();
      hasTablesSchema = true;
      setValidTablesSchema(tablesSchema2);
      if (!collIsEmpty$1(tablesMap)) {
        const tables = getTables();
        delTables();
        setTables(tables);
      }
    }
  });
  const setValuesSchema = (valuesSchema) => fluentTransaction(() => {
    const valuesSchema2 = cloneSchema(valuesSchema);
    if (validateValuesSchema(valuesSchema2)) {
      saveValuesSchema();
      const values = getValues();
      delValuesSchema();
      delValues();
      hasValuesSchema = true;
      setValidValuesSchema(valuesSchema2);
      setValues(values);
    }
  });
  const setSchema = (tablesSchema, valuesSchema) => fluentTransaction(() => {
    setTablesSchema(tablesSchema);
    setValuesSchema(valuesSchema);
  });
  const delTables = () => fluentTransaction(
    () => whileMutating(() => middleware[7]?.()) ?? true ? setValidTables({}, true) : 0
  );
  const delTable = (tableId) => fluentTransaction(
    (tableId2) => collHas$1(tablesMap, tableId2) ? delValidTable(tableId2) : 0,
    tableId
  );
  const delRow = (tableId, rowId) => fluentTransaction(
    (tableId2, rowId2) => ifNotUndefined$1(
      mapGet$1(tablesMap, tableId2),
      (tableMap) => collHas$1(tableMap, rowId2) ? delValidRow(tableId2, tableMap, rowId2) : 0
    ),
    tableId,
    rowId
  );
  const delCell = (tableId, rowId, cellId, forceDel, skipMiddleware) => fluentTransaction(
    (tableId2, rowId2, cellId2) => ifNotUndefined$1(
      mapGet$1(tablesMap, tableId2),
      (tableMap) => ifNotUndefined$1(
        mapGet$1(tableMap, rowId2),
        (rowMap) => collHas$1(rowMap, cellId2) ? delValidCell(
          tableId2,
          tableMap,
          rowId2,
          rowMap,
          cellId2,
          forceDel,
          skipMiddleware
        ) : 0
      )
    ),
    tableId,
    rowId,
    cellId
  );
  const delValues = () => fluentTransaction(
    () => whileMutating(() => middleware[11]?.()) ?? true ? setValidValues({}, true) : 0
  );
  const delValue = (valueId, skipMiddleware) => fluentTransaction(
    (valueId2) => collHas$1(valuesMap, valueId2) ? delValidValue(valueId2, skipMiddleware) : 0,
    valueId
  );
  const delTablesSchema = () => fluentTransaction(() => {
    saveTablesSchema();
    setValidTablesSchema({});
    hasTablesSchema = false;
  });
  const delValuesSchema = () => fluentTransaction(() => {
    saveValuesSchema();
    setValidValuesSchema({});
    hasValuesSchema = false;
  });
  const delSchema = () => fluentTransaction(() => {
    delTablesSchema();
    delValuesSchema();
  });
  const transaction = (actions, doRollback) => {
    if (transactions != -1) {
      startTransaction();
      try {
        const result = actions();
        finishTransaction(doRollback);
        return result;
      } catch (error) {
        if (transactions > 0) {
          rollbackRequested = 1;
          tryCatchSync$1(finishTransaction);
        }
        throw error;
      }
    }
  };
  const startTransaction = () => {
    if (transactions != -1) {
      transactions++;
    }
    if (transactions == 1) {
      try {
        internalListeners[0]?.();
        callListeners(startTransactionListeners);
      } catch (error) {
        rollbackRequested = 1;
        tryCatchSync$1(finishTransaction);
        throw error;
      }
    }
    return store;
  };
  const getTransactionChanges = () => getTransactionChangesImpl();
  const getEncodedTransactionChanges = () => getTransactionChangesImpl(true);
  const getTransactionLog = () => [
    !collIsEmpty$1(changedCells),
    !collIsEmpty$1(changedValues),
    mapToObj3(changedCells, pairClone, pairIsEqual),
    mapToObj3(invalidCells),
    mapToObj(changedValues, pairClone, pairIsEqual),
    mapToObj(invalidValues),
    mapToObj(changedTableIds),
    mapToObj2(changedRowIds),
    mapToObj3(changedCellIds),
    mapToObj(changedValueIds)
  ];
  const rollbackTransaction = () => {
    ifNotUndefined$1(oldTablesSchema, ([hasSchema, schema]) => {
      setValidTablesSchema(schema);
      hasTablesSchema = hasSchema;
    });
    ifNotUndefined$1(oldValuesSchema, ([hasSchema, schema]) => {
      setValidValuesSchema(schema);
      hasValuesSchema = hasSchema;
    });
    collForEach$1(
      changedCells,
      (table, tableId) => collForEach$1(
        table,
        (row, rowId) => collForEach$1(
          row,
          ([oldCell], cellId) => setOrDelCell(tableId, rowId, cellId, oldCell, true)
        )
      )
    );
    collClear$1(changedCells);
    collForEach$1(
      changedValues,
      ([oldValue], valueId) => setOrDelValue(valueId, oldValue, true)
    );
    collClear$1(changedValues);
  };
  const resetTransaction = () => {
    transactions = 0;
    rollbackRequested = 0;
    oldTablesSchema = oldValuesSchema = void 0;
    hadTables = hasTables();
    hadValues = hasValues();
    arrayForEach$1(
      [
        changedTableIds,
        changedTableCellIds,
        changedRowCount,
        changedRowIds,
        changedCellIds,
        changedCells,
        defaultedCells,
        invalidCells,
        changedValueIds,
        changedValues,
        defaultedValues,
        invalidValues
      ],
      collClear$1
    );
  };
  const finishTransaction = (doRollback) => {
    if (transactions > 0) {
      transactions--;
      if (transactions == 0) {
        transactions = 1;
        let committed = false;
        let rolledBack = false;
        const rollback = () => {
          rolledBack = true;
          rollbackTransaction();
        };
        let callDidFinish = false;
        let internalPostFinished = false;
        tryFinally$1(
          () => {
            let errorToThrow;
            let failed = false;
            const captureError = (error) => {
              if (!failed) {
                errorToThrow = error;
              }
              failed = true;
            };
            tryCatchSync$1(() => {
              try {
                if (rollbackRequested) {
                  rollback();
                } else {
                  whileMutating(() => {
                    callInvalidCellListeners(1);
                    if (!collIsEmpty$1(changedCells)) {
                      callTabularListenersForChanges(1);
                    }
                    callInvalidValueListeners(1);
                    if (!collIsEmpty$1(changedValues)) {
                      callValuesListenersForChanges(1);
                    }
                  });
                  if (doRollback?.(store)) {
                    rollback();
                  }
                  internalListeners[1]?.(rolledBack);
                  callDidFinish = true;
                  callListenersThenThrow(finishTransactionListeners[0], void 0);
                  transactions = -1;
                  committed = true;
                  callInvalidCellListeners(0);
                  if (!collIsEmpty$1(changedCells)) {
                    callTabularListenersForChanges(0);
                  }
                  callInvalidValueListeners(0);
                  if (!collIsEmpty$1(changedValues)) {
                    callValuesListenersForChanges(0);
                  }
                }
              } catch (error) {
                if (!committed) {
                  rollback();
                }
                throw error;
              }
            }, captureError);
            if (callDidFinish && rolledBack) {
              if (!committed) {
                tryCatchSync$1(() => internalListeners[1]?.(true), captureError);
              }
              tryCatchSync$1(() => {
                internalListeners[2]?.(true);
                internalPostFinished = true;
              }, captureError);
            }
            if (callDidFinish) {
              tryCatchSync$1(() => {
                transactions = -1;
                callListenersThenThrow(finishTransactionListeners[1], void 0);
              }, captureError);
            }
            if (failed) {
              throw errorToThrow;
            }
          },
          () => tryFinally$1(
            () => internalPostFinished ? 0 : internalListeners[2]?.(rolledBack),
            resetTransaction
          )
        );
      }
    }
    return store;
  };
  const forEachTable = (tableCallback) => collForEach$1(
    tablesMap,
    (tableMap, tableId) => tableCallback(
      tableId,
      (rowCallback) => collForEach$1(
        tableMap,
        (rowMap, rowId) => rowCallback(
          rowId,
          (cellCallback) => mapForEach$1(
            rowMap,
            (cellId, cell) => cellCallback(cellId, decodeIfJson(cell))
          )
        )
      )
    )
  );
  const forEachTableCell = (tableId, tableCellCallback) => mapForEach$1(mapGet$1(tableCellIds, id(tableId)), tableCellCallback);
  const forEachRow = (tableId, rowCallback) => collForEach$1(
    mapGet$1(tablesMap, id(tableId)),
    (rowMap, rowId) => rowCallback(
      rowId,
      (cellCallback) => mapForEach$1(
        rowMap,
        (cellId, cell) => cellCallback(cellId, decodeIfJson(cell))
      )
    )
  );
  const forEachCell = (tableId, rowId, cellCallback) => mapForEach$1(
    mapGet$1(mapGet$1(tablesMap, id(tableId)), id(rowId)),
    (cellId, cell) => cellCallback(cellId, decodeIfJson(cell))
  );
  const forEachValue = (valueCallback) => mapForEach$1(
    valuesMap,
    (valueId, value) => valueCallback(valueId, decodeIfJson(value))
  );
  const addSortedRowIdsListener = (tableIdOrArgs, cellIdOrListener, descendingOrMutator, offset, limit, listener, mutator) => isObject$1(tableIdOrArgs) ? addSortedRowIdsListenerImpl(
    tableIdOrArgs.tableId,
    tableIdOrArgs.cellId,
    [
      tableIdOrArgs.descending ?? false,
      tableIdOrArgs.offset ?? 0,
      tableIdOrArgs.limit,
      tableIdOrArgs.sorter
    ],
    cellIdOrListener,
    descendingOrMutator
  ) : addSortedRowIdsListenerImpl(
    tableIdOrArgs,
    cellIdOrListener,
    [descendingOrMutator, offset, limit, void 0],
    listener,
    mutator
  );
  const addStartTransactionListener = (listener) => addListener(listener, startTransactionListeners);
  const addWillFinishTransactionListener = (listener) => addListener(listener, finishTransactionListeners[0]);
  const addDidFinishTransactionListener = (listener) => addListener(listener, finishTransactionListeners[1]);
  const callListener = (listenerId) => {
    callListenerImpl(listenerId);
    return store;
  };
  const delListener = (listenerId) => {
    delListenerImpl(listenerId);
    return store;
  };
  const getListenerStats = () => ({
    hasTables: pairCollSize2(hasTablesListeners),
    tables: pairCollSize2(tablesListeners),
    tableIds: pairCollSize2(tableIdsListeners),
    hasTable: pairCollSize2(hasTableListeners),
    table: pairCollSize2(tableListeners),
    tableCellIds: pairCollSize2(tableCellIdsListeners),
    hasTableCell: pairCollSize2(hasTableCellListeners, collSize3),
    rowCount: pairCollSize2(rowCountListeners),
    rowIds: pairCollSize2(rowIdsListeners),
    sortedRowIds: pairCollSize2(sortedRowIdsListeners),
    hasRow: pairCollSize2(hasRowListeners, collSize3),
    row: pairCollSize2(rowListeners, collSize3),
    cellIds: pairCollSize2(cellIdsListeners, collSize3),
    hasCell: pairCollSize2(hasCellListeners, collSize4),
    cell: pairCollSize2(cellListeners, collSize4),
    invalidCell: pairCollSize2(invalidCellListeners, collSize4),
    hasValues: pairCollSize2(hasValuesListeners),
    values: pairCollSize2(valuesListeners),
    valueIds: pairCollSize2(valueIdsListeners),
    hasValue: pairCollSize2(hasValueListeners),
    value: pairCollSize2(valueListeners),
    invalidValue: pairCollSize2(invalidValueListeners),
    transaction: collSize2(startTransactionListeners) + pairCollSize2(finishTransactionListeners)
  });
  const setMiddleware = (willSetContent, willSetTables, willSetTable, willSetRow, willSetCell, willSetValues, willSetValue, willDelTables, willDelTable, willDelRow, willDelCell, willDelValues, willDelValue, willApplyChanges, hasWillSetRowCallbacks) => middleware = [
    willSetContent,
    willSetTables,
    willSetTable,
    willSetRow,
    willSetCell,
    willSetValues,
    willSetValue,
    willDelTables,
    willDelTable,
    willDelRow,
    willDelCell,
    willDelValues,
    willDelValue,
    willApplyChanges,
    hasWillSetRowCallbacks
  ];
  const setInternalListeners = (preStartTransaction, preFinishTransaction, postFinishTransaction, cellChanged2, valueChanged2) => internalListeners = [
    preStartTransaction,
    preFinishTransaction,
    postFinishTransaction,
    cellChanged2,
    valueChanged2
  ];
  const store = {
    getContent,
    getTables,
    getTableIds,
    getTable,
    getTableCellIds,
    getRowCount,
    getRowIds,
    getSortedRowIds,
    getRow,
    getCellIds,
    getCell,
    getValues,
    getValueIds,
    getValue,
    hasTables,
    hasTable,
    hasTableCell,
    hasRow,
    hasCell,
    hasValues,
    hasValue,
    getTablesJson,
    getValuesJson,
    getJson,
    getTablesSchemaJson,
    getValuesSchemaJson,
    getSchemaJson,
    hasTablesSchema: () => hasTablesSchema,
    hasValuesSchema: () => hasValuesSchema,
    setContent,
    setTables,
    setTable,
    setRow,
    addRow,
    setPartialRow,
    setCell,
    setValues,
    setPartialValues,
    setValue,
    applyChanges,
    setTablesJson,
    setValuesJson,
    setJson,
    setTablesSchema,
    setValuesSchema,
    setSchema,
    delTables,
    delTable,
    delRow,
    delCell,
    delValues,
    delValue,
    delTablesSchema,
    delValuesSchema,
    delSchema,
    transaction,
    startTransaction,
    getTransactionChanges,
    getTransactionLog,
    finishTransaction,
    forEachTable,
    forEachTableCell,
    forEachRow,
    forEachCell,
    forEachValue,
    addSortedRowIdsListener,
    addStartTransactionListener,
    addWillFinishTransactionListener,
    addDidFinishTransactionListener,
    callListener,
    delListener,
    getListenerStats,
    isMergeable: () => false,
    _: [
      createStore,
      addListener,
      callListeners,
      setInternalListeners,
      setMiddleware,
      setOrDelCell,
      setOrDelValue,
      getEncodedContent,
      getEncodedTransactionChanges,
      setEncodedContent,
      applyEncodedChanges
    ]
  };
  objForEach$1(
    {
      [HAS + TABLES$1]: [0, hasTablesListeners, [], () => [hasTables()]],
      [TABLES$1]: [0, tablesListeners],
      [TABLE_IDS]: [0, tableIdsListeners],
      [HAS + TABLE]: [
        1,
        hasTableListeners,
        [getTableIds],
        (ids) => [hasTable(...ids)]
      ],
      [TABLE]: [1, tableListeners, [getTableIds]],
      [TABLE + CELL_IDS]: [1, tableCellIdsListeners, [getTableIds]],
      [HAS + TABLE + CELL]: [
        2,
        hasTableCellListeners,
        [getTableIds, getTableCellIds],
        (ids) => [hasTableCell(...ids)]
      ],
      [ROW_COUNT]: [1, rowCountListeners, [getTableIds]],
      [ROW_IDS]: [1, rowIdsListeners, [getTableIds]],
      [HAS + ROW]: [
        2,
        hasRowListeners,
        [getTableIds, getRowIds],
        (ids) => [hasRow(...ids)]
      ],
      [ROW]: [2, rowListeners, [getTableIds, getRowIds]],
      [CELL_IDS]: [2, cellIdsListeners, [getTableIds, getRowIds]],
      [HAS + CELL]: [
        3,
        hasCellListeners,
        [getTableIds, getRowIds, getCellIds],
        (ids) => [hasCell(...ids)]
      ],
      [CELL]: [
        3,
        cellListeners,
        [getTableIds, getRowIds, getCellIds],
        (ids) => pairNew(getCell(...ids))
      ],
      InvalidCell: [3, invalidCellListeners],
      [HAS + VALUES]: [0, hasValuesListeners, [], () => [hasValues()]],
      [VALUES]: [0, valuesListeners],
      [VALUE_IDS]: [0, valueIdsListeners],
      [HAS + VALUE]: [
        1,
        hasValueListeners,
        [getValueIds],
        (ids) => [hasValue(...ids)]
      ],
      [VALUE]: [
        1,
        valueListeners,
        [getValueIds],
        (ids) => pairNew(getValue(ids[0]))
      ],
      InvalidValue: [1, invalidValueListeners]
    },
    ([argumentCount, idSetNode, pathGetters, extraArgsGetter], listenable) => {
      store[ADD + listenable + LISTENER] = (...args) => addListener(
        args[argumentCount],
        idSetNode[args[argumentCount + 1] ? 1 : 0],
        argumentCount > 0 ? slice$1(args, 0, argumentCount) : void 0,
        pathGetters,
        extraArgsGetter
      );
    }
  );
  return objFreeze$1(store);
};
const LISTENER_ARGS = {
  HasTable: 1,
  Table: 1,
  TableCellIds: 1,
  HasTableCell: 2,
  RowCount: 1,
  RowIds: 1,
  SortedRowIds: 5,
  HasRow: 2,
  Row: 2,
  CellIds: 2,
  HasCell: 3,
  Cell: 3,
  HasValue: 1,
  Value: 1,
  InvalidCell: 3,
  InvalidValue: 1
};
const newContentStampMap = (time = EMPTY_STRING$1) => [
  stampNewMap(time),
  stampNewMap(time)
];
const validateStamp = (stamp, validateThing, maxLogicalTime, hasHashes) => isArray$1(stamp) && (size$1(stamp) == 3 ? stampValidate(stamp, validateThing) && isHlc$1(stamp[1], maxLogicalTime) : !hasHashes && validateThing(stamp[0]) && (size$1(stamp) == 1 || size$1(stamp) == 2 && isHlc$1(stamp[1], maxLogicalTime)));
const validateObj = (obj, validateChild) => isObject$1(obj) && objEvery$1(obj, validateChild);
const validateMergeable = (mergeable, maxLogicalTime, hasHashes, encoded) => {
  if (!isArray$1(mergeable)) {
    return false;
  }
  if (hasHashes ? size$1(mergeable) != 2 : size$1(mergeable) != 2 && (size$1(mergeable) != 3 || mergeable[2] !== 1)) {
    return false;
  }
  const validate = (stamp, validateThing) => validateStamp(stamp, validateThing, maxLogicalTime, hasHashes);
  const validateCellOrValue = (cellOrValue) => isCellOrValueOrUndefined$1(cellOrValue) && !isReservedString(cellOrValue, encoded);
  return validate(
    mergeable[0],
    (tableStamps) => validateObj(
      tableStamps,
      (tableStamp) => validate(
        tableStamp,
        (rowStamps) => validateObj(
          rowStamps,
          (rowStamp) => validate(
            rowStamp,
            (cellStamps) => validateObj(
              cellStamps,
              (cellStamp) => validate(cellStamp, validateCellOrValue)
            )
          )
        )
      )
    )
  ) && validate(
    mergeable[1],
    (values) => validateObj(values, (value) => validate(value, validateCellOrValue))
  );
};
const createMergeableStore = (uniqueId, getNow = Date.now) => {
  let listeningToRawStoreChanges = 1;
  let contentStampMap = newContentStampMap();
  let oldContentStampMap = contentStampMap;
  let defaultingContent = 0;
  let mutated = 0;
  let oldMutated = mutated;
  const rollbackStampActions = [];
  const touchedCells = mapNew$1();
  const touchedValues = setNew$1();
  const [getNextHlc, seenHlc] = getHlcFunctions(uniqueId, getNow);
  const store = createStore();
  const disableListeningToRawStoreChanges = (actions) => {
    const wasListening = listeningToRawStoreChanges;
    listeningToRawStoreChanges = 0;
    tryFinally$1(actions, () => listeningToRawStoreChanges = wasListening);
    return mergeableStore;
  };
  const saveStamp = (stamp) => {
    const [thing, hlc, hash] = stamp;
    arrayPush$1(rollbackStampActions, () => {
      stamp[0] = thing;
      stamp[1] = hlc;
      stamp[2] = hash;
    });
  };
  const ensureStampMap = (stampMaps, id2, getDefaultValue) => {
    if (!collHas$1(stampMaps, id2)) {
      arrayPush$1(rollbackStampActions, () => mapSet$1(stampMaps, id2));
    }
    return mapEnsure$1(stampMaps, id2, getDefaultValue);
  };
  const mergeContentOrChanges = (contentOrChanges, isContent = 0) => {
    const tablesChanges = objNew$1();
    const valuesChanges = objNew$1();
    const [
      [tablesObj, incomingTablesHlc = EMPTY_STRING$1, incomingTablesHash = 0],
      values
    ] = contentOrChanges;
    const [tablesStampMap, valuesStampMap] = contentStampMap;
    const [tableStampMaps, oldTablesHlc, oldTablesHash] = tablesStampMap;
    let tablesHash = isContent ? incomingTablesHash : oldTablesHash;
    let tablesHlc = incomingTablesHlc;
    objForEach$1(
      tablesObj,
      ([rowsObj, incomingTableHlc = EMPTY_STRING$1, incomingTableHash = 0], tableId) => {
        const tableStampMap = ensureStampMap(
          tableStampMaps,
          tableId,
          stampNewMap
        );
        const [rowStampMaps, oldTableHlc, oldTableHash] = tableStampMap;
        let tableHash = isContent ? incomingTableHash : oldTableHash;
        let tableHlc = incomingTableHlc;
        objForEach$1(rowsObj, (row, rowId) => {
          const [rowHlc, oldRowHash, rowHash] = mergeCellsOrValues(
            row,
            ensureStampMap(rowStampMaps, rowId, stampNewMap),
            objEnsure$1(objEnsure$1(tablesChanges, tableId, objNew$1), rowId, objNew$1),
            isContent
          );
          tableHash ^= isContent ? 0 : addOrRemoveHash(
            oldRowHash ? getValueInValuesHash(rowId, oldRowHash) : 0,
            getValueInValuesHash(rowId, rowHash)
          );
          tableHlc = getLatestHlc$1(tableHlc, rowHlc);
        });
        tableHash ^= isContent ? 0 : replaceHlcHash(oldTableHlc, incomingTableHlc);
        saveStamp(tableStampMap);
        stampUpdate(tableStampMap, incomingTableHlc, tableHash);
        tablesHash ^= isContent ? 0 : addOrRemoveHash(
          oldTableHash ? getValueInValuesHash(tableId, oldTableHash) : 0,
          getValueInValuesHash(tableId, tableStampMap[2])
        );
        tablesHlc = getLatestHlc$1(tablesHlc, tableHlc);
      }
    );
    tablesHash ^= isContent ? 0 : replaceHlcHash(oldTablesHlc, incomingTablesHlc);
    saveStamp(tablesStampMap);
    stampUpdate(tablesStampMap, incomingTablesHlc, tablesHash);
    const [valuesHlc] = mergeCellsOrValues(
      values,
      valuesStampMap,
      valuesChanges,
      isContent
    );
    seenHlc(getLatestHlc$1(tablesHlc, valuesHlc));
    return [tablesChanges, valuesChanges, 1];
  };
  const mergeCellsOrValues = (things, thingsStampMap, thingsChanges, isContent) => {
    const [
      thingsObj,
      incomingThingsHlc = EMPTY_STRING$1,
      incomingThingsHash = 0
    ] = things;
    const [thingStampMaps, oldThingsHlc, oldThingsHash] = thingsStampMap;
    let thingsHlc = incomingThingsHlc;
    let thingsHash = isContent ? incomingThingsHash : oldThingsHash;
    objForEach$1(
      thingsObj,
      ([thing, thingHlc = EMPTY_STRING$1, incomingThingHash = 0], thingId) => {
        const thingStampMap = ensureStampMap(thingStampMaps, thingId, () => [
          void 0,
          EMPTY_STRING$1,
          0
        ]);
        const [, oldThingHlc, oldThingHash] = thingStampMap;
        if (!oldThingHlc || thingHlc > oldThingHlc) {
          saveStamp(thingStampMap);
          stampUpdate(
            thingStampMap,
            thingHlc,
            isContent ? incomingThingHash : getValueHash(thing, thingHlc)
          );
          thingStampMap[0] = thing;
          objSet$1(thingsChanges, thingId, thing);
          thingsHash ^= isContent ? 0 : addOrRemoveHash(
            getValueInValuesHash(thingId, oldThingHash),
            getValueInValuesHash(thingId, thingStampMap[2])
          );
          thingsHlc = getLatestHlc$1(thingsHlc, thingHlc);
        }
      }
    );
    thingsHash ^= isContent ? 0 : replaceHlcHash(oldThingsHlc, incomingThingsHlc);
    saveStamp(thingsStampMap);
    stampUpdate(thingsStampMap, incomingThingsHlc, thingsHash);
    return [thingsHlc, oldThingsHash, thingsStampMap[2]];
  };
  const preStartTransaction = () => {
    oldContentStampMap = contentStampMap;
    oldMutated = mutated;
  };
  const restoreStampMap = () => {
    while (size$1(rollbackStampActions)) {
      arrayPop(rollbackStampActions)?.();
    }
    contentStampMap = oldContentStampMap;
    mutated = oldMutated;
  };
  const preFinishTransaction = (rolledBack) => rolledBack ? restoreStampMap() : 0;
  const postFinishTransaction = (rolledBack) => {
    if (rolledBack) {
      restoreStampMap();
    } else {
      arrayClear$1(rollbackStampActions);
    }
    collClear$1(touchedCells);
    collClear$1(touchedValues);
  };
  const cellChanged = (tableId, rowId, cellId, newCell, mutating, defaulted) => {
    setAdd$1(
      mapEnsure$1(mapEnsure$1(touchedCells, tableId, mapNew$1), rowId, setNew$1),
      cellId
    );
    if (listeningToRawStoreChanges || mutating) {
      if (mutating) {
        mutated = 1;
      }
      const localHlc = defaultingContent || defaulted ? EMPTY_STRING$1 : getNextHlc();
      const [tablesChanges] = mergeContentOrChanges([
        [
          {
            [tableId]: [
              {
                [rowId]: [
                  {
                    [cellId]: [newCell, localHlc]
                  }
                ]
              }
            ]
          }
        ],
        [{}],
        1
      ]);
      const rowChanges = objGet(objGet(tablesChanges, tableId), rowId);
      if (localHlc && (!rowChanges || !objHas$1(rowChanges, cellId))) {
        errorThrow$1(ERROR_HLC);
      }
    }
  };
  const valueChanged = (valueId, newValue, mutating, defaulted) => {
    setAdd$1(touchedValues, valueId);
    if (listeningToRawStoreChanges || mutating) {
      if (mutating) {
        mutated = 1;
      }
      const localHlc = defaultingContent || defaulted ? EMPTY_STRING$1 : getNextHlc();
      const [, valuesChanges] = mergeContentOrChanges([
        [{}],
        [
          {
            [valueId]: [newValue, localHlc]
          }
        ],
        1
      ]);
      if (localHlc && !objHas$1(valuesChanges, valueId)) {
        errorThrow$1(ERROR_HLC);
      }
    }
  };
  const getMergeableContentImpl = (encoded = false) => [
    stampMapToObjWithHash(
      contentStampMap[0],
      (tableStampMap) => stampMapToObjWithHash(
        tableStampMap,
        (rowStampMap) => stampMapToObjWithHash(rowStampMap, ([cell, hlc, hash]) => [
          decodeIfJson(cell, EMPTY_STRING$1, encoded),
          hlc,
          hash
        ])
      )
    ),
    stampMapToObjWithHash(contentStampMap[1], ([value, hlc, hash]) => [
      decodeIfJson(value, EMPTY_STRING$1, encoded),
      hlc,
      hash
    ])
  ];
  const getTransactionMergeableChangesImpl = (withHashes, encoded = false) => {
    const [
      [tableStampMaps, tablesHlc, tablesHash],
      [valueStampMaps, valuesHlc, valuesHash]
    ] = contentStampMap;
    const newStamp = withHashes ? stampNewWithHash : stampNew$1;
    const tablesObj = objNew$1();
    collForEach$1(
      touchedCells,
      (touchedTable, tableId) => ifNotUndefined$1(
        mapGet$1(tableStampMaps, tableId),
        ([rowStampMaps, tableHlc, tableHash]) => {
          const tableObj = objNew$1();
          collForEach$1(
            touchedTable,
            (touchedRow, rowId) => ifNotUndefined$1(
              mapGet$1(rowStampMaps, rowId),
              ([cellStampMaps, rowHlc, rowHash]) => {
                const rowObj = objNew$1();
                collForEach$1(touchedRow, (cellId) => {
                  ifNotUndefined$1(
                    mapGet$1(cellStampMaps, cellId),
                    ([cell, time, hash]) => objSet$1(
                      rowObj,
                      cellId,
                      newStamp(
                        encoded ? cell : decodeIfJson(cell),
                        time,
                        hash
                      )
                    )
                  );
                });
                objSet$1(tableObj, rowId, newStamp(rowObj, rowHlc, rowHash));
              }
            )
          );
          objSet$1(tablesObj, tableId, newStamp(tableObj, tableHlc, tableHash));
        }
      )
    );
    const valuesObj = objNew$1();
    collForEach$1(
      touchedValues,
      (valueId) => ifNotUndefined$1(
        mapGet$1(valueStampMaps, valueId),
        ([value, time, hash]) => objSet$1(
          valuesObj,
          valueId,
          newStamp(encoded ? value : decodeIfJson(value), time, hash)
        )
      )
    );
    return [
      newStamp(tablesObj, tablesHlc, tablesHash),
      newStamp(valuesObj, valuesHlc, valuesHash),
      1
    ];
  };
  const getMergeableContent = () => getMergeableContentImpl();
  const getEncodedMergeableContent = () => getMergeableContentImpl(true);
  const getMergeableContentHashes = () => [
    contentStampMap[0][2],
    contentStampMap[1][2]
  ];
  const getMergeableTableHashes = () => mapToObj(contentStampMap[0][0], getStampHash);
  const getMergeableTableDiff = (otherTableHashes) => {
    const newTables = stampNewObj$1(contentStampMap[0][1]);
    const differingTableHashes = objNew$1();
    mapForEach$1(
      contentStampMap[0][0],
      (tableId, [tableStampMap, tableHlc, hash]) => objHas$1(otherTableHashes, tableId) ? hash != objGet(otherTableHashes, tableId) ? objSet$1(differingTableHashes, tableId, hash) : 0 : objSet$1(
        newTables[0],
        tableId,
        stampMapToObjWithoutHash(
          [tableStampMap, tableHlc],
          (rowStampMap) => stampMapToObjWithoutHash(rowStampMap)
        )
      )
    );
    return [newTables, differingTableHashes];
  };
  const getMergeableRowHashes = (otherTableHashes) => {
    const rowHashes = objNew$1();
    objForEach$1(
      otherTableHashes,
      (otherTableHash, tableId) => ifNotUndefined$1(
        mapGet$1(contentStampMap[0][0], tableId),
        ([rowStampMaps, , tableHash]) => tableHash != otherTableHash ? mapForEach$1(
          rowStampMaps,
          (rowId, [, , rowHash]) => objSet$1(objEnsure$1(rowHashes, tableId, objNew$1), rowId, rowHash)
        ) : 0
      )
    );
    return rowHashes;
  };
  const getMergeableRowDiff = (otherTableRowHashes) => {
    const newRows = stampNewObj$1(contentStampMap[0][1]);
    const differingRowHashes = objNew$1();
    objForEach$1(
      otherTableRowHashes,
      (otherRowHashes, tableId) => mapForEach$1(
        mapGet$1(contentStampMap[0][0], tableId)?.[0],
        (rowId, [rowStampMap, rowHlc, hash]) => objHas$1(otherRowHashes, rowId) ? hash !== objGet(otherRowHashes, rowId) ? objSet$1(
          objEnsure$1(differingRowHashes, tableId, objNew$1),
          rowId,
          hash
        ) : 0 : objSet$1(
          objEnsure$1(newRows[0], tableId, stampNewObj$1)[0],
          rowId,
          stampMapToObjWithoutHash([rowStampMap, rowHlc])
        )
      )
    );
    return [newRows, differingRowHashes];
  };
  const getMergeableCellHashes = (otherTableRowHashes) => {
    const cellHashes = objNew$1();
    objForEach$1(
      otherTableRowHashes,
      (otherRowHashes, tableId) => ifNotUndefined$1(
        mapGet$1(contentStampMap[0][0], tableId),
        ([rowStampMaps]) => objForEach$1(
          otherRowHashes,
          (otherRowHash, rowId) => ifNotUndefined$1(
            mapGet$1(rowStampMaps, rowId),
            ([cellStampMaps, , rowHash]) => rowHash !== otherRowHash ? mapForEach$1(
              cellStampMaps,
              (cellId, [, , cellHash]) => objSet$1(
                objEnsure$1(
                  objEnsure$1(cellHashes, tableId, objNew$1),
                  rowId,
                  objNew$1
                ),
                cellId,
                cellHash
              )
            ) : 0
          )
        )
      )
    );
    return cellHashes;
  };
  const getMergeableCellDiff = (otherTableRowCellHashes) => {
    const [[tableStampMaps, tablesHlc]] = contentStampMap;
    const tablesObj = objNew$1();
    objForEach$1(
      otherTableRowCellHashes,
      (otherRowCellHashes, tableId) => objForEach$1(
        otherRowCellHashes,
        (otherCellHashes, rowId) => ifNotUndefined$1(
          mapGet$1(tableStampMaps, tableId),
          ([rowStampMaps, tableHlc]) => ifNotUndefined$1(
            mapGet$1(rowStampMaps, rowId),
            ([cellStampMaps, rowHlc]) => mapForEach$1(
              cellStampMaps,
              (cellId, [cell, cellHlc, hash]) => hash !== objGet(otherCellHashes, cellId) ? objSet$1(
                objEnsure$1(
                  objEnsure$1(
                    tablesObj,
                    tableId,
                    () => stampNewObj$1(tableHlc)
                  )[0],
                  rowId,
                  () => stampNewObj$1(rowHlc)
                )[0],
                cellId,
                [cell, cellHlc]
              ) : 0
            )
          )
        )
      )
    );
    return stampNew$1(tablesObj, tablesHlc);
  };
  const getMergeableValueHashes = () => mapToObj(contentStampMap[1][0], getStampHash);
  const getMergeableValueDiff = (otherValueHashes) => {
    const [, [valueStampMaps, valuesHlc]] = contentStampMap;
    const values = mapToObj(
      valueStampMaps,
      stampClone,
      ([, , hash], valueId) => hash == objGet(otherValueHashes, valueId)
    );
    return stampNew$1(values, valuesHlc);
  };
  const setMergeableContentImpl = (mergeableContent, encoded) => validateMergeable(
    mergeableContent,
    getNow() + HLC_MAX_FUTURE_OFFSET,
    1,
    encoded ? 1 : 0
  ) ? disableListeningToRawStoreChanges(
    () => store.transaction(() => {
      store.delTables().delValues();
      contentStampMap = newContentStampMap();
      const changes = mergeContentOrChanges(mergeableContent, 1);
      (encoded ? store._[10] : store.applyChanges)(changes);
    })
  ) : mergeableStore;
  const setMergeableContent = (mergeableContent) => setMergeableContentImpl(mergeableContent);
  const setEncodedMergeableContent = (mergeableContent) => setMergeableContentImpl(mergeableContent, true);
  const setDefaultContent = (content) => {
    store.transaction(() => {
      defaultingContent = 1;
      tryFinally$1(
        () => store.setContent(content),
        () => defaultingContent = 0
      );
    });
    return mergeableStore;
  };
  const getTransactionMergeableChanges = (withHashes = false) => getTransactionMergeableChangesImpl(withHashes);
  const getEncodedTransactionMergeableChanges = (withHashes) => getTransactionMergeableChangesImpl(withHashes, true);
  const applyMergeableChangesImpl = (mergeableChanges, encoded) => validateMergeable(
    mergeableChanges,
    getNow() + HLC_MAX_FUTURE_OFFSET,
    0,
    encoded ? 1 : 0
  ) ? disableListeningToRawStoreChanges(
    () => store.transaction(
      () => (encoded ? store._[10] : store.applyChanges)(
        mergeContentOrChanges(mergeableChanges)
      )
    )
  ) : mergeableStore;
  const applyMergeableChanges = (mergeableChanges) => applyMergeableChangesImpl(mergeableChanges);
  const applyEncodedMergeableChanges = (mergeableChanges) => applyMergeableChangesImpl(mergeableChanges, true);
  const merge = (mergeableStore2) => {
    const mergeableChanges = getMergeableContent();
    const mergeableChanges2 = mergeableStore2.getMergeableContent();
    mergeableStore2.applyMergeableChanges(mergeableChanges);
    return applyMergeableChanges(mergeableChanges2);
  };
  const hadMutated = () => {
    const result = mutated;
    mutated = 0;
    return result;
  };
  const mergeableStore = {
    getMergeableContent,
    getMergeableContentHashes,
    getMergeableTableHashes,
    getMergeableTableDiff,
    getMergeableRowHashes,
    getMergeableRowDiff,
    getMergeableCellHashes,
    getMergeableCellDiff,
    getMergeableValueHashes,
    getMergeableValueDiff,
    setMergeableContent,
    setDefaultContent,
    getTransactionMergeableChanges,
    applyMergeableChanges,
    merge,
    __: [
      hadMutated,
      getEncodedMergeableContent,
      getEncodedTransactionMergeableChanges,
      setEncodedMergeableContent,
      applyEncodedMergeableChanges
    ]
  };
  store._[3](
    preStartTransaction,
    preFinishTransaction,
    postFinishTransaction,
    cellChanged,
    valueChanged
  );
  objForEach$1(
    store,
    (method, name) => objSet$1(
      mergeableStore,
      name,
      // fluent methods
      strStartsWith$1(name, SET) || strStartsWith$1(name, DEL) || strStartsWith$1(name, "apply") || strEndsWith(name, TRANSACTION) || name == "call" + LISTENER || name == "use" ? (...args) => {
        method(...args);
        return mergeableStore;
      } : strStartsWith$1(name, ADD) && strEndsWith(name, LISTENER) ? (...args) => {
        const listenerArg = LISTENER_ARGS[slice$1(name, 3, -8)] ?? 0;
        const listener = args[listenerArg];
        args[listenerArg] = (_store, ...args2) => listener(mergeableStore, ...args2);
        return method(...args);
      } : name == "isMergeable" ? () => true : method
    )
  );
  return objFreeze$1(mergeableStore);
};
mapNew$1([
  [
    AVG,
    [
      (numbers, length) => arraySum(numbers) / length,
      (metric, add, length) => metric + (add - metric) / (length + 1),
      (metric, remove, length) => metric + (metric - remove) / (length - 1),
      (metric, add, remove, length) => metric + (add - remove) / length
    ]
  ],
  [
    MAX,
    [
      arrayMax,
      (metric, add) => mathMax$1(add, metric),
      (metric, remove) => remove == metric ? void 0 : metric,
      (metric, add, remove) => remove == metric ? void 0 : mathMax$1(add, metric)
    ]
  ],
  [
    MIN,
    [
      arrayMin,
      (metric, add) => mathMin(add, metric),
      (metric, remove) => remove == metric ? void 0 : metric,
      (metric, add, remove) => remove == metric ? void 0 : mathMin(add, metric)
    ]
  ],
  [
    SUM,
    [
      (numbers) => arraySum(numbers),
      (metric, add) => metric + add,
      (metric, remove) => metric - remove,
      (metric, add, remove) => metric - remove + add
    ]
  ]
]);
const STATUSES = [
  "inbox",
  "todo",
  "doing",
  "blocked",
  "fixed",
  "done",
  "cancelled"
];
const SEVERITIES = ["blocker", "major", "minor", "cosmetic"];
const NOTE_KINDS = ["login", "wifi", "code", "other"];
function emptyVault() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    version: 1,
    tasks: [],
    notes: [],
    projects: [],
    digests: [],
    meta: { createdAt: now, updatedAt: now, lastSeq: 0 }
  };
}
const TABLES = {
  tasks: "tasks",
  notes: "notes",
  projects: "projects",
  digests: "digests"
};
function packList(value) {
  return value.length ? JSON.stringify(value) : "";
}
function unpackList(cell) {
  if (typeof cell !== "string" || !cell) return [];
  try {
    const parsed = JSON.parse(cell);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function defined(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== void 0 && v !== null) out[k] = v;
  }
  return out;
}
const str = (v) => typeof v === "string" && v !== "" ? v : void 0;
const num = (v) => typeof v === "number" ? v : void 0;
function taskToRow(t) {
  return defined({
    title: t.title,
    notes: t.notes,
    status: t.status,
    priority: t.priority,
    tags: packList(t.tags),
    project: t.project,
    due: t.due,
    scheduled: t.scheduled,
    estimateMin: t.estimateMin,
    subtasks: packList(t.subtasks),
    recurrence: t.recurrence,
    blockedReason: t.blockedReason,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    startedAt: t.startedAt,
    completedAt: t.completedAt,
    order: t.order,
    source: t.source,
    originalInput: t.originalInput,
    severity: t.severity,
    menu: t.menu,
    steps: t.steps,
    expected: t.expected,
    environment: t.environment,
    evidenceUrl: t.evidenceUrl,
    reportedBy: t.reportedBy,
    fixedBy: t.fixedBy,
    verifiedBy: t.verifiedBy,
    fixedIn: t.fixedIn,
    reopenCount: t.reopenCount,
    needsNormalise: t.needsNormalise,
    claimedBy: t.claimedBy,
    claimedAt: t.claimedAt
  });
}
function noteToRow(n) {
  return defined({
    kind: n.kind,
    title: n.title,
    username: n.username,
    secret: n.secret,
    url: n.url,
    body: n.body,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    order: n.order
  });
}
function writeVaultToStore(store, vault) {
  store.transaction(() => {
    store.setTable(TABLES.tasks, Object.fromEntries(
      vault.tasks.map((t) => [t.id, taskToRow(t)])
    ));
    store.setTable(TABLES.notes, Object.fromEntries(
      vault.notes.map((n) => [n.id, noteToRow(n)])
    ));
    store.setTable(TABLES.projects, Object.fromEntries(
      vault.projects.map((p) => [p.id, defined({
        name: p.name,
        color: p.color,
        createdAt: p.createdAt
      })])
    ));
    store.setTable(TABLES.digests, Object.fromEntries(
      vault.digests.map((d) => [d.date, defined({
        markdown: d.markdown,
        stats: JSON.stringify(d.stats),
        createdAt: d.createdAt,
        author: d.author
      })])
    ));
    store.setValues(defined({
      version: vault.version,
      createdAt: vault.meta.createdAt,
      updatedAt: vault.meta.updatedAt,
      lastSeq: vault.meta.lastSeq
    }));
  });
  return store;
}
function rowToTask(id2, row) {
  const status = STATUSES.includes(row.status) ? row.status : "todo";
  const priority = [0, 1, 2, 3].includes(row.priority) ? row.priority : 2;
  const source = ["claude", "app", "cli"].includes(row.source) ? row.source : "app";
  return {
    id: id2,
    title: str(row.title) ?? "",
    notes: str(row.notes),
    status,
    priority,
    tags: unpackList(row.tags),
    project: str(row.project),
    due: str(row.due),
    scheduled: str(row.scheduled),
    estimateMin: num(row.estimateMin),
    subtasks: unpackList(row.subtasks),
    recurrence: str(row.recurrence),
    blockedReason: str(row.blockedReason),
    createdAt: str(row.createdAt) ?? (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: str(row.updatedAt) ?? (/* @__PURE__ */ new Date()).toISOString(),
    startedAt: str(row.startedAt),
    completedAt: str(row.completedAt),
    order: num(row.order) ?? 0,
    source,
    originalInput: str(row.originalInput),
    severity: SEVERITIES.includes(row.severity) ? row.severity : void 0,
    menu: str(row.menu),
    steps: str(row.steps),
    expected: str(row.expected),
    environment: str(row.environment),
    evidenceUrl: str(row.evidenceUrl),
    reportedBy: str(row.reportedBy),
    fixedBy: str(row.fixedBy),
    verifiedBy: str(row.verifiedBy),
    fixedIn: str(row.fixedIn),
    reopenCount: num(row.reopenCount),
    needsNormalise: row.needsNormalise === true ? true : void 0,
    claimedBy: str(row.claimedBy),
    claimedAt: str(row.claimedAt)
  };
}
function rowToNote(id2, row) {
  const kind = NOTE_KINDS.includes(row.kind) ? row.kind : "other";
  return {
    id: id2,
    kind,
    title: str(row.title) ?? "",
    username: str(row.username),
    secret: str(row.secret),
    url: str(row.url),
    body: str(row.body) ?? "",
    createdAt: str(row.createdAt) ?? (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: str(row.updatedAt) ?? (/* @__PURE__ */ new Date()).toISOString(),
    order: num(row.order) ?? 0
  };
}
function storeToVault(store) {
  const base = emptyVault();
  const values = store.getValues();
  const tasks = Object.entries(store.getTable(TABLES.tasks)).map(([id2, row]) => rowToTask(id2, row));
  const notes = Object.entries(store.getTable(TABLES.notes)).map(([id2, row]) => rowToNote(id2, row));
  const projects = Object.entries(store.getTable(TABLES.projects)).map(([id2, row]) => {
    const r = row;
    return {
      id: id2,
      name: str(r.name) ?? "",
      color: str(r.color) ?? "",
      createdAt: str(r.createdAt)
    };
  });
  const digests = Object.entries(store.getTable(TABLES.digests)).map(([date, row]) => {
    const r = row;
    let stats = base.digests[0]?.stats;
    try {
      stats = JSON.parse(str(r.stats) ?? "null") ?? stats;
    } catch {
    }
    return {
      date,
      markdown: str(r.markdown) ?? "",
      stats,
      createdAt: str(r.createdAt) ?? "",
      author: str(r.author) ?? "auto"
    };
  });
  return {
    version: num(values.version) ?? base.version,
    // Row order is not meaningful in a store; the app sorts by `order` anyway,
    // but sorting here keeps a round trip byte-identical to what went in.
    tasks: tasks.sort((a, b) => a.order - b.order),
    notes: notes.sort((a, b) => a.order - b.order),
    projects,
    digests: digests.sort((a, b) => a.date.localeCompare(b.date)),
    meta: {
      createdAt: str(values.createdAt) ?? base.meta.createdAt,
      updatedAt: str(values.updatedAt) ?? base.meta.updatedAt,
      lastSeq: num(values.lastSeq) ?? 0
    }
  };
}
function sameRow(a, b) {
  if (!a) return false;
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return bk.every((k) => a[k] === b[k]);
}
function syncTable(store, table, rows) {
  const existing = store.getTable(table);
  for (const [id2, row] of Object.entries(rows)) {
    if (!sameRow(existing[id2], row)) store.setRow(table, id2, row);
  }
  for (const id2 of Object.keys(existing)) {
    if (!(id2 in rows)) store.delRow(table, id2);
  }
}
function applyVaultToStore(store, vault) {
  store.transaction(() => {
    syncTable(store, TABLES.tasks, Object.fromEntries(
      vault.tasks.map((t) => [t.id, taskToRow(t)])
    ));
    syncTable(store, TABLES.notes, Object.fromEntries(
      vault.notes.map((n) => [n.id, noteToRow(n)])
    ));
    syncTable(store, TABLES.projects, Object.fromEntries(
      vault.projects.map((p) => [p.id, defined({
        name: p.name,
        color: p.color,
        createdAt: p.createdAt
      })])
    ));
    syncTable(store, TABLES.digests, Object.fromEntries(
      vault.digests.map((d) => [d.date, defined({
        markdown: d.markdown,
        stats: JSON.stringify(d.stats),
        createdAt: d.createdAt,
        author: d.author
      })])
    ));
    store.setValues(defined({
      version: vault.version,
      createdAt: vault.meta.createdAt,
      updatedAt: vault.meta.updatedAt,
      lastSeq: vault.meta.lastSeq
    }));
  });
}
const isBug = (t) => t.tags.includes("bug");
function checkReport(t) {
  const out = [];
  if (!isBug(t)) return out;
  if (!t.steps?.trim()) {
    out.push({ field: "steps", message: "No steps to reproduce — nobody can act on this." });
  }
  if (!t.expected?.trim()) {
    out.push({ field: "expected", message: "Says what happens, not what should happen instead." });
  }
  if (!t.severity) {
    out.push({ field: "severity", message: "No severity, so it cannot be ranked against the others." });
  }
  if (!t.project) {
    out.push({ field: "project", message: "No project." });
  }
  return out;
}
const ALLOWED = {
  inbox: ["todo", "doing", "done", "cancelled"],
  todo: ["doing", "blocked", "fixed", "done", "cancelled"],
  doing: ["fixed", "blocked", "todo", "done", "cancelled"],
  blocked: ["todo", "doing", "done", "cancelled"],
  // The only way out of `fixed` is verified, or back for another go.
  fixed: ["done", "todo", "doing"],
  done: ["todo"],
  cancelled: ["todo"]
};
function moveBug(task, move, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const from = task.status;
  const { to } = move;
  if (from === to) return { ok: true, task };
  if (!ALLOWED[from]?.includes(to)) {
    return { ok: false, reason: `Cannot go from ${from} to ${to}.` };
  }
  if (isBug(task) && to === "done" && from !== "fixed") {
    return {
      ok: false,
      reason: 'A bug goes to "fixed" first, with the build it was fixed in, and is only closed once someone has checked it.'
    };
  }
  const next = { ...task, status: to, updatedAt: now };
  if (to === "fixed") {
    const build = move.fixedIn?.trim();
    if (isBug(task) && !build) {
      return {
        ok: false,
        reason: "Say which build the fix went into, or nobody can tell whether the build they are testing has it."
      };
    }
    next.fixedIn = build;
    next.fixedBy = move.by?.trim() || task.fixedBy;
    next.verifiedBy = void 0;
  }
  if (to === "done") {
    const who = move.by?.trim();
    if (isBug(task)) {
      if (!who) {
        return { ok: false, reason: "Say who checked it." };
      }
      if (task.fixedBy && who.toLowerCase() === task.fixedBy.toLowerCase()) {
        return {
          ok: false,
          reason: `${who} fixed this, so ${who} cannot be the one who verifies it. Someone else has to look.`
        };
      }
    }
    next.verifiedBy = who;
    next.completedAt = now;
  }
  if ((from === "fixed" || from === "done") && (to === "todo" || to === "doing")) {
    next.reopenCount = (task.reopenCount ?? 0) + 1;
    next.fixedIn = void 0;
    next.verifiedBy = void 0;
    next.completedAt = void 0;
  }
  return { ok: true, task: next };
}
const SEVERITY_RANK = {
  blocker: 0,
  major: 1,
  minor: 2,
  cosmetic: 3
};
function sortBugs(bugs) {
  return [...bugs].sort((a, b) => {
    const sa = a.severity ? SEVERITY_RANK[a.severity] : SEVERITIES.length;
    const sb = b.severity ? SEVERITY_RANK[b.severity] : SEVERITIES.length;
    return sa - sb || a.priority - b.priority || (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  });
}
const awaitingCheck = (tasks) => tasks.filter((t) => isBug(t) && t.status === "fixed");
const incomplete = (tasks) => tasks.filter((t) => isBug(t) && checkReport(t).length > 0);
const getTypeOf = (thing) => typeof thing;
const TINYBASE = "tinybase";
const EMPTY_STRING = "";
const DOT = ".";
const STRING = getTypeOf(EMPTY_STRING);
const BOOLEAN = getTypeOf(true);
const NUMBER = getTypeOf(0);
const OBJECT = "object";
const ARRAY = "array";
const NULL = "null";
const UTF8 = "utf8";
const OPEN = "open";
const CLOSE = "close";
const MESSAGE = "message";
const ERROR = "error";
const UNDEFINED = "￼";
const strStartsWith = (str2, prefix) => str2.startsWith(prefix);
const strMatch = (str2, regex) => str2?.match(regex);
const strSplit = (str2, separator = EMPTY_STRING, limit) => str2.split(separator, limit);
const promise = Promise;
const math = Math;
const getIfNotFunction = (predicate) => (value, then, otherwise) => predicate(value) ? (
  /* istanbul ignore next */
  otherwise?.()
) : then(value);
const GLOBAL = globalThis;
const THOUSAND = 1e3;
const number = Number;
const startTimeout = (callback, sec = 0) => setTimeout(callback, sec * THOUSAND);
const stopTimeout = (timeout) => clearTimeout(timeout);
const addEventListener = (target, event, listener) => {
  target.addEventListener(event, listener);
  return () => target.removeEventListener(event, listener);
};
const mathMax = math.max;
const mathCeil = math.ceil;
const mathFloor = math.floor;
const mathRandom = math.random;
const isFiniteNumber = isFinite;
const isInteger = number.isInteger;
const isNullish = (thing) => thing == null;
const isUndefined = (thing) => thing === void 0;
const isNull = (thing) => thing === null;
const ifNotNullish = getIfNotFunction(isNullish);
const ifNotUndefined = getIfNotFunction(isUndefined);
const isTypeStringOrBoolean = (type) => type == STRING || type == BOOLEAN;
const isString = (thing) => getTypeOf(thing) == STRING;
const isNumber = (thing) => getTypeOf(thing) == NUMBER;
const isArray = (thing) => Array.isArray(thing);
const slice = (arrayOrString, start, end) => arrayOrString.slice(start, end);
const size = (thing) => thing.length;
const isEmpty = (thing) => size(thing) == 0;
const test = (regex, subject) => regex.test(subject);
const noop = () => {
};
const promiseNew = (resolver) => new promise(resolver);
const arrayIndexOf = (array, value) => array.indexOf(value);
const arrayEvery = (array, cb) => array.every(cb);
const arrayForEach = (array, cb) => array.forEach(cb);
const arrayJoin = (array, sep = EMPTY_STRING) => array.join(sep);
const arrayMap = (array, cb) => array.map(cb);
const arrayReduce = (array, cb, initial) => array.reduce(cb, initial);
const arrayFilter = (array, cb) => array.filter(cb);
const arrayClear = (array, to = size(array)) => array.splice(0, to);
const arrayPush = (array, ...values) => array.push(...values);
const arrayShift = (array) => array.shift();
const collSize = (coll) => coll?.size ?? 0;
const collHas = (coll, keyOrValue) => coll?.has(keyOrValue) ?? false;
const collIsEmpty = (coll) => isUndefined(coll) || collSize(coll) == 0;
const collClear = (coll) => coll.clear();
const collForEach = (coll, cb) => coll?.forEach(cb);
const collDel = (coll, keyOrValue) => coll?.delete(keyOrValue);
const object = Object;
const getPrototypeOf = (obj) => object.getPrototypeOf(obj);
const isObject = (obj) => !isNullish(obj) && ifNotNullish(
  getPrototypeOf(obj),
  (objPrototype) => objPrototype == object.prototype || isNullish(getPrototypeOf(objPrototype)),
  /* istanbul ignore next */
  () => true
);
const objIds = object.keys;
const objFreeze = object.freeze;
const objHas = (obj, id2) => object.hasOwn(obj, id2);
const objSet = (obj, id2, value) => {
  object.defineProperty(obj, id2, {
    configurable: true,
    enumerable: true,
    value,
    writable: true
  });
  return value;
};
const objNew = (entries = []) => {
  const obj = object.create(null);
  arrayForEach(entries, ([id2, value]) => objSet(obj, id2, value));
  return obj;
};
const objForEach = (obj, cb) => arrayForEach(objIds(obj), (id2) => cb(obj[id2], id2));
const objEvery = (obj, cb) => {
  for (const id2 in obj) {
    if (objHas(obj, id2) && !cb(obj[id2], id2)) {
      return false;
    }
  }
  return true;
};
const objMap = (obj, cb) => {
  const mapped = objNew();
  objForEach(obj, (value, id2) => objSet(mapped, id2, cb(value, id2)));
  return mapped;
};
const objSize = (obj) => size(objIds(obj));
const objIsEmpty = (obj) => isObject(obj) && objSize(obj) == 0;
const objEnsure = (obj, id2, getDefaultValue) => {
  if (!objHas(obj, id2)) {
    objSet(obj, id2, getDefaultValue());
  }
  return obj[id2];
};
const map = Map;
const mapNew = (entries) => new map(entries);
const weakMapNew = () => /* @__PURE__ */ new WeakMap();
const mapGet = (map2, key) => map2?.get(key);
const mapForEach = (map2, cb) => collForEach(map2, (value, key) => cb(key, value));
const mapSet = (map2, key, value) => isUndefined(value) ? (collDel(map2, key), map2) : map2?.set(key, value);
const mapEnsure = (map2, key, getDefaultValue, hadExistingValue) => {
  let value = mapGet(map2, key);
  if (collHas(map2, key)) {
    hadExistingValue?.(value);
  } else {
    mapSet(map2, key, value = getDefaultValue());
  }
  return value;
};
const visitTree = (node, path, ensureLeaf, pruneLeaf, p = 0) => ifNotUndefined(
  (ensureLeaf ? mapEnsure : mapGet)(
    node,
    path[p],
    p > size(path) - 2 ? ensureLeaf : mapNew
  ),
  (nodeOrLeaf) => {
    if (p > size(path) - 2) {
      if (pruneLeaf?.(nodeOrLeaf)) {
        mapSet(node, path[p]);
      }
      return nodeOrLeaf;
    }
    const leaf = visitTree(nodeOrLeaf, path, ensureLeaf, pruneLeaf, p + 1);
    if (collIsEmpty(nodeOrLeaf)) {
      mapSet(node, path[p]);
    }
    return leaf;
  }
);
const MASK6 = 63;
const ENCODE = strSplit(
  "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz"
);
const DECODE = mapNew(arrayMap(ENCODE, (char, index) => [char, index]));
const encode = (num2) => ENCODE[num2 & MASK6];
const decode = (str2, pos) => mapGet(DECODE, str2[pos]) ?? 0;
const getRandomValues = GLOBAL.crypto ? (array) => GLOBAL.crypto.getRandomValues(array) : (
  /* istanbul ignore next */
  (array) => arrayMap(array, () => mathFloor(mathRandom() * 256))
);
const getUniqueId = (length = 16) => arrayReduce(
  getRandomValues(new Uint8Array(length)),
  (uniqueId, number2) => uniqueId + encode(number2),
  EMPTY_STRING
);
const ERROR_STORE_TYPE = 0;
const ERROR_CONTENT = 1;
const ERROR_SYNC_RESPONSE = 3;
const ERROR_MULTIPLEX_RESPONSE = 4;
const ERROR_MULTIPLEX_SOCKET = 5;
const ERROR_MULTIPLEX_CHANNEL = 6;
const ERROR_MULTIPLEX_CHANNEL_DUPLICATE = 7;
const ERROR_MULTIPLEX_DESTROYED = 8;
const ERROR_MULTIPLEX_LEGACY = 9;
const ERROR_LEGACY_MULTIPLEX = 10;
const ERROR_SYNC_MESSAGE = 14;
const ERROR_SYNC_OVERFLOW = 15;
const errorNew = (code, details) => new Error(
  TINYBASE + ":" + code + (isUndefined(details) ? EMPTY_STRING : (
    /* istanbul ignore next */
    ":" + details
  ))
);
const errorThrow = (code, details) => {
  throw errorNew(code, details);
};
const tryReturn = (tryF, catchReturn) => {
  try {
    return tryF();
  } catch {
    return catchReturn;
  }
};
const tryCatch = async (action, onError) => {
  try {
    return await action();
  } catch (error) {
    onError?.(error);
  }
};
const tryCatchIgnore = (action, onIgnoredError) => tryCatch(action, (error) => void tryCatch(() => onIgnoredError?.(error)));
const tryCatchSync = (action, onError) => {
  try {
    return action();
  } catch (error) {
    onError?.(error);
  }
};
const tryFinally = (action, finallyAction) => {
  try {
    return action();
  } finally {
    finallyAction();
  }
};
const tryFinallyAsync = async (action, finallyAction) => {
  try {
    return await action();
  } finally {
    await finallyAction();
  }
};
const setNew = (entryOrEntries) => new Set(
  isArray(entryOrEntries) || isUndefined(entryOrEntries) ? entryOrEntries : [entryOrEntries]
);
const weakSetNew = () => /* @__PURE__ */ new WeakSet();
const setAdd = (set, value) => set?.add(value);
const jsonString = JSON.stringify;
const jsonParse = JSON.parse;
const jsonStringWithUndefined = (obj) => jsonString(obj, (_key, value) => isUndefined(value) ? UNDEFINED : value);
const jsonParseWithUndefined = (str2) => (
  // JSON.parse reviver removes properties with undefined values
  replaceUndefinedString(jsonParse(str2))
);
const replaceUndefinedString = (obj) => obj === UNDEFINED ? void 0 : isArray(obj) ? arrayMap(obj, replaceUndefinedString) : isObject(obj) ? objMap(obj, replaceUndefinedString) : obj;
const getCellOrValueType = (cellOrValue) => {
  if (isNull(cellOrValue)) {
    return NULL;
  }
  if (isArray(cellOrValue)) {
    return ARRAY;
  }
  if (isObject(cellOrValue)) {
    return OBJECT;
  }
  const type = getTypeOf(cellOrValue);
  return isTypeStringOrBoolean(type) || type == NUMBER && isFiniteNumber(cellOrValue) ? type : void 0;
};
const isCellOrValueOrUndefined = (cellOrValue) => isUndefined(cellOrValue) || !isUndefined(getCellOrValueType(cellOrValue));
new GLOBAL.TextEncoder();
const SHIFT36 = 2 ** 36;
const SHIFT30 = 2 ** 30;
const SHIFT24 = 2 ** 24;
const SHIFT18 = 2 ** 18;
const SHIFT12 = 2 ** 12;
const SHIFT6 = 2 ** 6;
const HLC = /^[-0-9A-Z_a-z]{16}$/;
const decodeHlcTime = (hlc) => decode(hlc, 0) * SHIFT36 + decode(hlc, 1) * SHIFT30 + decode(hlc, 2) * SHIFT24 + decode(hlc, 3) * SHIFT18 + decode(hlc, 4) * SHIFT12 + decode(hlc, 5) * SHIFT6 + decode(hlc, 6);
const isHlc = (hlc, maxLogicalTime) => hlc == EMPTY_STRING || isString(hlc) && test(HLC, hlc) && decodeHlcTime(hlc) <= maxLogicalTime;
const MESSAGE_SEPARATOR = "\n";
const FRAGMENT = /^([-0-9A-Z_a-z]{16})\n(\d+)\n(\d+)\n([\s\S]*)$/;
const FRAGMENT_PAYLOAD = /^[^\n]*\n[-0-9A-Z_a-z]{16}\n\d+\n\d+\n/;
const INVALID_CHANNEL_ID_CHARACTERS = /[\n\r?#]/;
const MAX_FRAGMENT_BUFFERS = 100;
const MAX_FRAGMENT_COUNT = 1e3;
const MAX_MULTIPLE_CHANNELS = 100;
const MAX_MULTIPLE_CHANNEL_ID_SIZE = 1024;
const MAX_PENDING_REQUESTS = 100;
const MAX_WEBSOCKET_BUFFER_SIZE = 16777216;
const MAX_WEBSOCKET_QUEUE_SIZE = 1e3;
const getWebSocketPayloadSize = (value) => {
  let byteSize = 0;
  for (let index = 0; index < size(value); index++) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit < 128) {
      byteSize++;
    } else if (codeUnit < 2048) {
      byteSize += 2;
    } else if (codeUnit >= 55296 && codeUnit <= 56319 && value.charCodeAt(index + 1) >= 56320 && value.charCodeAt(index + 1) <= 57343) {
      byteSize += 4;
      index++;
    } else {
      byteSize += 3;
    }
  }
  return byteSize;
};
const isWebSocketPayloadTooLarge = (payloadSize) => payloadSize > MAX_WEBSOCKET_BUFFER_SIZE;
const SERVER_CLIENT_ID = "S";
const MULTIPLE_CLIENT_ID = "M";
const MULTIPLE_MESSAGE = -1;
var MultipleControl = /* @__PURE__ */ ((MultipleControl2) => {
  MultipleControl2[MultipleControl2["Hello"] = 0] = "Hello";
  MultipleControl2[MultipleControl2["Subscribe"] = 1] = "Subscribe";
  MultipleControl2[MultipleControl2["Unsubscribe"] = 2] = "Unsubscribe";
  return MultipleControl2;
})(MultipleControl || {});
const MULTIPLE_VERSION = 1;
const createInvalidPayloadHandler = (webSocket, onIgnoredError) => {
  let valid = true;
  return (error) => {
    if (valid) {
      valid = false;
      tryFinally(
        () => onIgnoredError?.(error),
        () => webSocket.close(
          strStartsWith(error.message, TINYBASE + ":" + ERROR_SYNC_OVERFLOW) ? 1013 : 1007,
          error.message
        )
      );
    }
  };
};
const isHash = (hash) => isNumber(hash) && isFiniteNumber(hash) && isInteger(hash) && hash >= 0 && hash <= 4294967295;
const isHashTree = (tree, depth) => isObject(tree) && objEvery(
  tree,
  (child) => depth ? isHashTree(child, depth - 1) : isHash(child)
);
const isStamp = (stamp, depth) => isArray(stamp) && (size(stamp) == 1 || size(stamp) == 2 && isString(stamp[1]) && isHlc(stamp[1], Infinity)) && (depth ? isObject(stamp[0]) && objEvery(stamp[0], (child) => isStamp(child, depth - 1)) : isCellOrValueOrUndefined(stamp[0]));
const isContentHashes = (body) => isArray(body) && size(body) == 2 && isHash(body[0]) && isHash(body[1]);
const isMergeableContentOrChanges = (body) => isArray(body) && (size(body) == 2 || size(body) == 3 && body[2] === 1) && isStamp(body[0], 3) && isStamp(body[1], 1);
const isResponse = (body) => isContentHashes(body) || isStamp(body, 3) || isStamp(body, 1) || isArray(body) && size(body) == 2 && isStamp(body[0], 3) && (isHashTree(body[1], 0) || isHashTree(body[1], 1));
const isBodyValid = (message, body) => message == 0 ? isResponse(body) : message == 1 ? body === EMPTY_STRING : message == 2 ? isContentHashes(body) : message == 3 ? isMergeableContentOrChanges(body) : message == 4 ? isHashTree(body, 0) : message == 5 ? isHashTree(body, 1) : message == 6 ? isHashTree(body, 2) : message == 7 ? isHashTree(body, 0) : false;
const isProtocolMessageValid = (requestId, message, body) => (isNull(requestId) || isString(requestId)) && isNumber(message) && isFiniteNumber(message) && isInteger(message) && isBodyValid(message, body);
const decodeProtocolMessage = (remainder, multipleControl = false) => tryReturn(() => {
  const message = jsonParseWithUndefined(remainder);
  return isArray(message) && size(message) == 3 && (isProtocolMessageValid(message[0], message[1], message[2]) || multipleControl && (isNull(message[0]) || isString(message[0])) && message[1] == MULTIPLE_MESSAGE) ? message : void 0;
});
const ifPayloadValid = (payload, then) => {
  const splitAt = payload.indexOf(MESSAGE_SEPARATOR);
  if (splitAt !== -1) {
    then(slice(payload, 0, splitAt), slice(payload, splitAt + 1));
    return true;
  }
  return false;
};
const createPayloadDecoder = (receive, fragmentTimeoutSeconds = 1, onInvalid, sharedBuffer) => {
  const buffer = mapNew();
  const payloadBuffer = sharedBuffer ?? [0, 0];
  let bufferedSize = 0;
  let valid = true;
  const delPending = (bufferKey, pending) => {
    stopTimeout(pending[4]);
    bufferedSize -= pending[5];
    payloadBuffer[0]--;
    payloadBuffer[1] -= pending[5];
    collDel(buffer, bufferKey);
  };
  const clear = () => {
    mapForEach(buffer, (_bufferKey, pending) => stopTimeout(pending[4]));
    payloadBuffer[0] -= collSize(buffer);
    payloadBuffer[1] -= bufferedSize;
    collClear(buffer);
    bufferedSize = 0;
  };
  const invalid = (error = errorNew(ERROR_SYNC_MESSAGE)) => {
    if (valid) {
      valid = false;
      clear();
      onInvalid?.(error);
    }
  };
  const receiveRemainder = (clientId, remainders, remainder) => {
    const message = decodeProtocolMessage(remainder);
    if (message) {
      receive(clientId, remainders, ...message);
    } else {
      invalid();
    }
  };
  const decode2 = (payload) => {
    if (!valid) {
      return;
    }
    if (isWebSocketPayloadTooLarge(getWebSocketPayloadSize(payload))) {
      invalid(
        errorNew(
          ERROR_SYNC_OVERFLOW,
          strMatch(payload, FRAGMENT_PAYLOAD) ? "fragments" : "socket"
        )
      );
      return;
    }
    if (!ifPayloadValid(payload, (clientId, remainder) => {
      const message = decodeProtocolMessage(remainder);
      if (message) {
        receive(clientId, [remainder], ...message);
        return;
      }
      const [, messageId, indexStr, totalStr, fragment] = strMatch(remainder, FRAGMENT) ?? [];
      if (messageId) {
        const index = parseInt(indexStr);
        const total = parseInt(totalStr);
        if (total > MAX_FRAGMENT_COUNT) {
          invalid(errorNew(ERROR_SYNC_OVERFLOW, "fragments"));
          return;
        }
        if (total > 0 && index >= 0 && index < total) {
          const bufferKey = clientId + MESSAGE_SEPARATOR + messageId;
          let pending = mapGet(buffer, bufferKey);
          if (!pending) {
            if (payloadBuffer[0] >= MAX_FRAGMENT_BUFFERS) {
              invalid(errorNew(ERROR_SYNC_OVERFLOW, "fragments"));
              return;
            }
          }
          if ((isUndefined(pending) || total == pending[3]) && isUndefined(pending?.[0][index])) {
            const retainedSize = getWebSocketPayloadSize(remainder) + (pending ? 0 : getWebSocketPayloadSize(bufferKey));
            if (payloadBuffer[1] + retainedSize > MAX_WEBSOCKET_BUFFER_SIZE) {
              invalid(errorNew(ERROR_SYNC_OVERFLOW, "fragments"));
              return;
            }
            if (!pending) {
              pending = [
                [],
                [],
                total,
                total,
                startTimeout(() => {
                  const timedOut = mapGet(buffer, bufferKey);
                  if (timedOut) {
                    delPending(bufferKey, timedOut);
                  }
                }, fragmentTimeoutSeconds),
                0
              ];
              mapSet(buffer, bufferKey, pending);
              payloadBuffer[0]++;
            }
            const [fragments, remainders] = pending;
            fragments[index] = fragment;
            remainders[index] = remainder;
            pending[2]--;
            pending[5] += retainedSize;
            bufferedSize += retainedSize;
            payloadBuffer[1] += retainedSize;
          } else {
            invalid();
            return;
          }
          if (pending[2] == 0) {
            const [fragments, remainders] = pending;
            delPending(bufferKey, pending);
            receiveRemainder(clientId, remainders, arrayJoin(fragments));
          }
          return;
        }
      }
      invalid();
    })) {
      invalid();
    }
  };
  return [decode2, clear];
};
const isWebSocketBackpressured = (webSocket, payloadSize) => (webSocket.bufferedAmount ?? 0) + payloadSize > MAX_WEBSOCKET_BUFFER_SIZE;
const createPayloadReceiver = (receive, fragmentTimeoutSeconds = 1, onInvalid, sharedBuffer) => createPayloadDecoder(
  (fromClientId, _remainders, requestId, message, body) => receive(fromClientId, requestId, message, body),
  fragmentTimeoutSeconds,
  onInvalid,
  sharedBuffer
);
const createRawPayload = (clientId, remainder) => clientId + MESSAGE_SEPARATOR + remainder;
const getFragments = (remainder, maxFragmentSize) => {
  const fragments = [];
  let fragment = EMPTY_STRING;
  let fragmentSize = 0;
  for (let index = 0; index < size(remainder); index++) {
    const codeUnit = remainder.charCodeAt(index);
    let codePoint = slice(remainder, index, index + 1);
    if (codeUnit >= 55296 && codeUnit <= 56319 && remainder.charCodeAt(index + 1) >= 56320 && remainder.charCodeAt(index + 1) <= 57343) {
      codePoint += slice(remainder, ++index, index + 1);
    }
    const codePointSize = getWebSocketPayloadSize(codePoint);
    if (fragmentSize > 0 && fragmentSize + codePointSize > maxFragmentSize) {
      arrayPush(fragments, fragment);
      fragment = EMPTY_STRING;
      fragmentSize = 0;
    }
    fragment += codePoint;
    fragmentSize += codePointSize;
  }
  arrayPush(fragments, fragment);
  return fragments;
};
const createMultiplePayload = (channelId, payload) => createRawPayload(MULTIPLE_CLIENT_ID, createRawPayload(channelId, payload));
const ifMultiplePayloadValid = (payload, then, onOversized) => {
  let valid = false;
  ifPayloadValid(payload, (multipleClientId, remainder) => {
    if (multipleClientId == MULTIPLE_CLIENT_ID) {
      ifPayloadValid(remainder, (channelId, channelPayload) => {
        if (isMultipleChannelIdTooLarge(channelId)) {
          valid = true;
          onOversized?.();
        } else if (isMultipleChannelIdStructureValid(channelId)) {
          valid = true;
          then(channelId, channelPayload);
        }
      });
    }
  });
  return valid;
};
const createMultipleControlPayload = (requestId, control, body) => createRawPayload(
  SERVER_CLIENT_ID,
  jsonStringWithUndefined([requestId, MULTIPLE_MESSAGE, [control, body]])
);
const isMultipleChannelIdTooLarge = (channelId) => getWebSocketPayloadSize(channelId) > MAX_MULTIPLE_CHANNEL_ID_SIZE;
const isMultipleChannelIdStructureValid = (channelId) => !isEmpty(channelId) && !INVALID_CHANNEL_ID_CHARACTERS.test(channelId) && arrayEvery(
  strSplit(channelId, "/"),
  (part) => !isEmpty(part) && part != "." && part != ".."
);
const ifMultipleControlPayloadValid = (payload, then) => {
  let valid = false;
  ifPayloadValid(payload, (serverClientId, remainder) => {
    if (serverClientId == SERVER_CLIENT_ID) {
      const [requestId, message, controlAndBody] = decodeProtocolMessage(remainder, true) ?? [];
      const control = controlAndBody?.[0];
      const body = controlAndBody?.[1];
      if (message == MULTIPLE_MESSAGE && isArray(controlAndBody) && size(controlAndBody) == 2 && (control == 0 ? isString(requestId) && body == MULTIPLE_VERSION : control == 1 ? isString(requestId) && isString(body) && (isMultipleChannelIdTooLarge(body) || isMultipleChannelIdStructureValid(body)) : control == 2 && isNull(requestId) && isString(body) && (isMultipleChannelIdTooLarge(body) || isMultipleChannelIdStructureValid(body)))) {
        valid = true;
        then(requestId, control, body);
      }
    }
  });
  return valid;
};
const isMultipleChannelIdValid = (channelId) => !isMultipleChannelIdTooLarge(channelId) && isMultipleChannelIdStructureValid(channelId);
const createPayloads = (toClientId, requestId, message, body, fragmentSize) => {
  const clientId = toClientId ?? EMPTY_STRING;
  const remainder = jsonStringWithUndefined([requestId, message, body]);
  const maxFragmentSize = mathFloor(fragmentSize ?? 0);
  if (isUndefined(fragmentSize) || maxFragmentSize < 1) {
    return [createRawPayload(clientId, remainder)];
  }
  const fragments = getFragments(
    remainder,
    mathMax(
      maxFragmentSize,
      mathCeil(getWebSocketPayloadSize(remainder) / MAX_FRAGMENT_COUNT) + 3
    )
  );
  const total = size(fragments);
  if (total == 1) {
    return [createRawPayload(clientId, remainder)];
  }
  const messageId = getUniqueId();
  return arrayMap(
    fragments,
    (fragment, index) => createRawPayload(
      clientId,
      arrayJoin([messageId, index, total, fragment], MESSAGE_SEPARATOR)
    )
  );
};
const stampNew = (value, hlc) => hlc ? [value, hlc] : [value];
const getLatestHlc = (hlc1, hlc2) => (
  /* istanbul ignore next */
  ((hlc1 ?? EMPTY_STRING) > (hlc2 ?? EMPTY_STRING) ? hlc1 : hlc2) ?? EMPTY_STRING
);
const stampNewObj = (hlc = EMPTY_STRING) => stampNew(objNew(), hlc);
const INTEGER = /^\d+$/;
const getPoolFunctions = () => {
  const pool = [];
  let nextId = 0;
  return [
    (reuse) => (reuse ? arrayShift(pool) : null) ?? EMPTY_STRING + nextId++,
    (id2) => {
      if (test(INTEGER, id2) && size(pool) < 1e3) {
        arrayPush(pool, id2);
      }
    }
  ];
};
const getWildcardedLeaves = (deepIdSet, path = [EMPTY_STRING]) => {
  const leaves = [];
  const deep = (node, p) => p == size(path) ? arrayPush(leaves, node) : isNull(path[p]) ? collForEach(node, (node2) => deep(node2, p + 1)) : arrayForEach([path[p], null], (id2) => deep(mapGet(node, id2), p + 1));
  deep(deepIdSet, 0);
  return leaves;
};
const getListenerFunctions = (getThing) => {
  let thing;
  const [getId, releaseId] = getPoolFunctions();
  const allListeners = mapNew();
  const addListener = (listener, idSetNode, path, pathGetters = [], extraArgsGetter = () => []) => {
    thing ??= getThing();
    const id2 = getId(1);
    mapSet(allListeners, id2, [
      listener,
      idSetNode,
      path,
      pathGetters,
      extraArgsGetter
    ]);
    setAdd(visitTree(idSetNode, path ?? [EMPTY_STRING], setNew), id2);
    return id2;
  };
  const callListenersImpl = (continueAfterError, idSetNode, ids, extraArgs) => {
    let errorToThrow;
    let failed = false;
    arrayForEach(
      getWildcardedLeaves(idSetNode, ids),
      (set) => collForEach(set, (id2) => {
        const callListener2 = () => mapGet(allListeners, id2)[0](thing, ...ids ?? [], ...extraArgs);
        if (continueAfterError) {
          tryCatchSync(callListener2, (error) => {
            if (!failed) {
              errorToThrow = error;
            }
            failed = true;
          });
        } else {
          callListener2();
        }
      })
    );
    if (failed) {
      throw errorToThrow;
    }
  };
  const callListeners = (idSetNode, ids, ...extraArgs) => callListenersImpl(false, idSetNode, ids, extraArgs);
  const callListenersThenThrow = (idSetNode, ids, ...extraArgs) => callListenersImpl(true, idSetNode, ids, extraArgs);
  const delListener = (id2) => ifNotUndefined(mapGet(allListeners, id2), ([, idSetNode, idOrNulls]) => {
    visitTree(idSetNode, idOrNulls ?? [EMPTY_STRING], void 0, (idSet) => {
      collDel(idSet, id2);
      return collIsEmpty(idSet) ? 1 : 0;
    });
    mapSet(allListeners, id2);
    releaseId(id2);
    return idOrNulls;
  });
  const callListener = (id2) => ifNotUndefined(
    mapGet(allListeners, id2),
    ([listener, , path = [], pathGetters, extraArgsGetter]) => {
      const callWithIds = (...ids) => {
        const index = size(ids);
        if (index == size(path)) {
          listener(thing, ...ids, ...extraArgsGetter(ids));
        } else if (isNull(path[index])) {
          arrayForEach(
            pathGetters[index]?.(...ids) ?? [],
            (id22) => callWithIds(...ids, id22)
          );
        } else {
          callWithIds(...ids, path[index]);
        }
      };
      callWithIds();
    }
  );
  return [
    addListener,
    callListeners,
    delListener,
    callListener,
    callListenersThenThrow
  ];
};
const scheduleRunning = mapNew();
const scheduleActions = mapNew();
const scheduleReferences = mapNew();
const getStoreFunctions = (persist = 1, store, isSynchronizer) => persist != 1 && store.isMergeable() ? [
  1,
  store.__[1],
  () => store.__[2](!isSynchronizer),
  ([[changedTables], [changedValues]]) => !objIsEmpty(changedTables) || !objIsEmpty(changedValues),
  store.setDefaultContent
] : persist != 2 ? [
  0,
  store._[7],
  store._[8],
  ([changedTables, changedValues]) => !objIsEmpty(changedTables) || !objIsEmpty(changedValues),
  store.setContent
] : errorThrow(ERROR_STORE_TYPE);
const createCustomPersister = (store, getPersisted, setPersisted, addPersisterListener, delPersisterListener, onIgnoredError, persist, extra = {}, isSynchronizer = 0, scheduleId = []) => {
  let status = 0;
  let loads = 0;
  let saves = 0;
  let autoLoadHandle;
  let autoLoadPromise;
  let autoLoadGeneration = 0;
  let pendingAutoLoads = 0;
  let pendingScheduledAutoLoads = 0;
  let autoLoadAfterSaveGeneration = 0;
  let autoSaveListenerId;
  let autoSaveGeneration = 0;
  let destroyed = 0;
  let destroying;
  let activeAction;
  const scheduleOwner = {};
  const extraDestroy = extra.destroy;
  mapEnsure(scheduleRunning, scheduleId, () => 0);
  mapEnsure(scheduleActions, scheduleId, () => []);
  mapSet(
    scheduleReferences,
    scheduleId,
    (mapGet(scheduleReferences, scheduleId) ?? 0) + 1
  );
  const statusListeners = mapNew();
  const [
    isMergeableStore,
    getContent,
    getChanges,
    hasChanges,
    setDefaultContent
  ] = getStoreFunctions(persist, store, isSynchronizer);
  const [addListener, callListeners, delListenerImpl] = getListenerFunctions(
    () => persister
  );
  const setStatus = (newStatus) => {
    if (newStatus != status) {
      status = newStatus;
      callListeners(statusListeners, void 0, status);
    }
  };
  const run = async () => {
    if (!mapGet(scheduleRunning, scheduleId)) {
      mapSet(scheduleRunning, scheduleId, 1);
      const scheduledActions = mapGet(scheduleActions, scheduleId);
      let actionIndex = 0;
      await tryFinallyAsync(
        async () => {
          while (actionIndex < size(scheduledActions)) {
            const scheduledAction = scheduledActions[actionIndex++];
            scheduledAction[2] = void 0;
            await scheduledAction[0]();
          }
        },
        () => {
          arrayClear(scheduledActions, actionIndex);
          mapSet(scheduleRunning, scheduleId, 0);
          pruneSchedule();
        }
      );
    }
  };
  const pruneSchedule = () => {
    if (!mapGet(scheduleReferences, scheduleId) && !mapGet(scheduleRunning, scheduleId) && isEmpty(mapGet(scheduleActions, scheduleId) ?? [])) {
      mapSet(scheduleRunning, scheduleId);
      mapSet(scheduleActions, scheduleId);
      mapSet(scheduleReferences, scheduleId);
    }
  };
  const setContentOrChanges = (contentOrChanges) => {
    (isMergeableStore && isArray(contentOrChanges?.[0]) ? contentOrChanges?.[2] === 1 ? store.__[4] : store.__[3] : contentOrChanges?.[2] === 1 ? store._[10] : store._[9])(contentOrChanges);
  };
  const saveAfterMutated = async () => {
    if (isAutoSaving() && store.__?.[0]?.()) {
      await save();
    }
  };
  const trackAutoLoadPromise = (newAutoLoadPromise) => tryFinallyAsync(
    () => autoLoadPromise = newAutoLoadPromise,
    () => {
      if (autoLoadPromise == newAutoLoadPromise) {
        autoLoadPromise = void 0;
      }
    }
  );
  const load = async (initialContent) => {
    if (status != 2) {
      await tryFinallyAsync(
        async () => {
          setStatus(
            1
            /* Loading */
          );
          loads++;
          await schedule(
            () => tryCatch(
              async () => {
                const content = await getPersisted();
                if (isArray(content)) {
                  setContentOrChanges(content);
                } else if (isUndefined(content) && initialContent) {
                  setDefaultContent(initialContent);
                } else if (!isUndefined(content)) {
                  errorThrow(ERROR_CONTENT, content);
                }
              },
              (error) => {
                onIgnoredError?.(error);
                if (initialContent) {
                  setDefaultContent(initialContent);
                }
              }
            )
          );
        },
        () => setStatus(
          0
          /* Idle */
        )
      );
      await saveAfterMutated();
    }
    return persister;
  };
  const runAutoLoadAfterSave = async () => {
    const generation = autoLoadAfterSaveGeneration;
    autoLoadAfterSaveGeneration = 0;
    if (generation && generation == autoLoadGeneration && !destroyed) {
      if (status == 2) {
        autoLoadAfterSaveGeneration = generation;
      } else {
        await load();
      }
    }
  };
  const startAutoLoad = async (initialContent) => {
    const generation = ++autoLoadGeneration;
    let initialLoadPending = true;
    await stopAutoLoad(true);
    if (generation == autoLoadGeneration && !destroyed) {
      const listenerPromise = tryCatch(async () => {
        const handle = await addPersisterListener(async (content, changes) => {
          if (generation == autoLoadGeneration && !destroyed) {
            if (changes || content) {
              const shouldSchedule = initialLoadPending || status == 2 || !!pendingScheduledAutoLoads;
              pendingAutoLoads++;
              if (shouldSchedule) {
                pendingScheduledAutoLoads++;
              }
              await tryFinallyAsync(
                async () => {
                  setStatus(
                    1
                    /* Loading */
                  );
                  loads++;
                  await (shouldSchedule ? schedule(() => setContentOrChanges(changes ?? content)) : tryFinally(
                    () => setContentOrChanges(changes ?? content),
                    () => setStatus(
                      0
                      /* Idle */
                    )
                  ));
                },
                () => {
                  if (shouldSchedule) {
                    pendingScheduledAutoLoads--;
                  }
                  if (!--pendingAutoLoads) {
                    setStatus(
                      0
                      /* Idle */
                    );
                  }
                }
              );
              if (!pendingAutoLoads) {
                await saveAfterMutated();
              }
            } else if (status == 2) {
              autoLoadAfterSaveGeneration = generation;
            } else {
              await load();
            }
          }
        });
        if (generation == autoLoadGeneration && !destroyed) {
          autoLoadHandle = handle;
        } else if (!isUndefined(handle)) {
          await delPersisterListener(handle);
        }
      }, onIgnoredError);
      await trackAutoLoadPromise(listenerPromise);
      if (generation == autoLoadGeneration && !destroyed) {
        await tryFinallyAsync(
          () => load(initialContent),
          () => {
            initialLoadPending = false;
          }
        );
      }
    }
    return persister;
  };
  const stopAutoLoad = async (keepGeneration = false) => {
    autoLoadAfterSaveGeneration = 0;
    if (!keepGeneration) {
      autoLoadGeneration++;
    }
    const listenerPromise = autoLoadPromise;
    const handle = autoLoadHandle;
    autoLoadHandle = void 0;
    await trackAutoLoadPromise(
      tryFinallyAsync(
        async () => {
          await listenerPromise;
        },
        async () => {
          if (!isUndefined(handle)) {
            await tryCatch(() => delPersisterListener(handle), onIgnoredError);
          }
        }
      )
    );
    return persister;
  };
  const isAutoLoading = () => !isUndefined(autoLoadHandle);
  const save = async (changes) => {
    if (status != 1) {
      await tryFinallyAsync(
        () => tryFinallyAsync(
          async () => {
            setStatus(
              2
              /* Saving */
            );
            saves++;
            await schedule(
              () => tryCatch(
                () => setPersisted(getContent, changes),
                onIgnoredError
              )
            );
          },
          () => setStatus(
            0
            /* Idle */
          )
        ),
        runAutoLoadAfterSave
      );
    }
    return persister;
  };
  const startAutoSave = async () => {
    const generation = ++autoSaveGeneration;
    await stopAutoSave(true);
    if (generation == autoSaveGeneration && !destroyed) {
      await save();
      if (generation == autoSaveGeneration && !destroyed) {
        autoSaveListenerId = store.addDidFinishTransactionListener(() => {
          if (generation == autoSaveGeneration && !destroyed) {
            const changes = getChanges();
            if (hasChanges(changes)) {
              void tryCatch(() => save(changes));
            }
          }
        });
      }
    }
    return persister;
  };
  const stopAutoSave = async (keepGeneration = false) => {
    if (!keepGeneration) {
      autoSaveGeneration++;
    }
    const listenerId = autoSaveListenerId;
    autoSaveListenerId = void 0;
    if (!isUndefined(listenerId)) {
      store.delListener(listenerId);
    }
    return persister;
  };
  const isAutoSaving = () => !isUndefined(autoSaveListenerId);
  const startAutoPersisting = async (initialContent, startSaveFirst = false) => {
    const [call1, call2, stop1, stop2] = startSaveFirst ? [startAutoSave, startAutoLoad, stopAutoSave, stopAutoLoad] : [startAutoLoad, startAutoSave, stopAutoLoad, stopAutoSave];
    const start1 = call1(initialContent);
    const generation1 = startSaveFirst ? autoSaveGeneration : autoLoadGeneration;
    await start1;
    const start2 = call2(initialContent);
    const generation2 = startSaveFirst ? autoLoadGeneration : autoSaveGeneration;
    try {
      await start2;
    } catch (error) {
      if (generation2 == (startSaveFirst ? autoLoadGeneration : autoSaveGeneration)) {
        await tryCatchIgnore(stop2);
      }
      if (generation1 == (startSaveFirst ? autoSaveGeneration : autoLoadGeneration)) {
        await tryCatchIgnore(stop1);
      }
      throw error;
    }
    return persister;
  };
  const stopAutoPersisting = async (stopSaveFirst = false) => {
    const [call1, call2] = stopSaveFirst ? [stopAutoSave, stopAutoLoad] : [stopAutoLoad, stopAutoSave];
    await tryFinallyAsync(
      () => call1(),
      async () => {
        await call2();
      }
    );
    return persister;
  };
  const getStatus = () => status;
  const addStatusListener = (listener) => addListener(listener, statusListeners);
  const delListener = (listenerId) => {
    delListenerImpl(listenerId);
    return store;
  };
  const schedule = async (...actions) => {
    let failed = false;
    let firstError;
    const completion = promiseNew(
      (resolve) => !isEmpty(actions) ? arrayPush(
        mapGet(scheduleActions, scheduleId),
        ...arrayMap(actions, (action, index) => {
          const last = index == size(actions) - 1;
          return [
            async () => {
              let completeActiveAction;
              activeAction = promiseNew(
                (resolve2) => completeActiveAction = resolve2
              );
              await tryFinallyAsync(
                async () => {
                  try {
                    await tryCatch(action, onIgnoredError);
                  } catch (error) {
                    if (!failed) {
                      failed = true;
                      firstError = error;
                    }
                  }
                  if (last) {
                    resolve();
                  }
                },
                () => {
                  activeAction = void 0;
                  completeActiveAction();
                }
              );
            },
            last ? resolve : void 0,
            scheduleOwner
          ];
        })
      ) : resolve()
    );
    await run();
    await completion;
    if (failed) {
      throw firstError;
    }
    return persister;
  };
  const getStore = () => store;
  const destroy = async () => {
    if (isUndefined(destroying)) {
      destroyed = 1;
      destroying = (async () => {
        const scheduledActions = mapGet(scheduleActions, scheduleId);
        const remainingActions = arrayFilter(
          scheduledActions,
          ([, complete, owner]) => {
            if (owner == scheduleOwner) {
              complete?.();
              return false;
            }
            return true;
          }
        );
        const actionToAwait = activeAction;
        arrayClear(scheduledActions);
        arrayPush(scheduledActions, ...remainingActions);
        await tryFinallyAsync(
          () => tryFinallyAsync(
            () => tryFinallyAsync(stopAutoPersisting, () => actionToAwait),
            () => extraDestroy?.()
          ),
          () => {
            const references = (mapGet(scheduleReferences, scheduleId) ?? 1) - 1;
            mapSet(scheduleReferences, scheduleId, references || void 0);
            pruneSchedule();
          }
        );
      })();
    }
    await destroying;
    return persister;
  };
  const getStats = () => ({ loads, saves });
  const persister = {
    load,
    startAutoLoad,
    stopAutoLoad,
    isAutoLoading,
    save,
    startAutoSave,
    stopAutoSave,
    isAutoSaving,
    startAutoPersisting,
    stopAutoPersisting,
    getStatus,
    addStatusListener,
    delListener,
    schedule,
    getStore,
    getStats,
    ...extra,
    destroy
  };
  return objFreeze(persister);
};
mapNew();
const createCustomSynchronizer = (store, send, registerReceive, extraDestroy, requestTimeoutSeconds, onSend, onReceive, onIgnoredError, extra = {}, preDestroy = noop) => {
  let syncing = 0;
  let persisterListener;
  let sends = 0;
  let receives = 0;
  let destroyed = false;
  const pendingRequests = mapNew();
  const getTransactionId = () => getUniqueId(11);
  const rejectPendingRequests = (error) => mapForEach(pendingRequests, (requestId, [, , reject, timeout]) => {
    stopTimeout(timeout);
    collDel(pendingRequests, requestId);
    reject(error);
  });
  const sendImpl = (toClientId, requestId, message, body) => {
    sends++;
    onSend?.(toClientId, requestId, message, body);
    send(toClientId, requestId, message, body);
  };
  const request = async (toClientId, message, body, transactionId) => promiseNew((resolve, reject) => {
    if (collSize(pendingRequests) >= MAX_PENDING_REQUESTS) {
      reject(errorNew(ERROR_SYNC_OVERFLOW, "requests"));
      return;
    }
    const requestId = transactionId + DOT + getUniqueId(4);
    const timeout = startTimeout(() => {
      collDel(pendingRequests, requestId);
      reject(
        errorNew(
          ERROR_SYNC_RESPONSE,
          (toClientId ?? EMPTY_STRING) + DOT + requestId + DOT + message
        )
      );
    }, requestTimeoutSeconds);
    mapSet(pendingRequests, requestId, [
      toClientId,
      (response, fromClientId) => {
        stopTimeout(timeout);
        collDel(pendingRequests, requestId);
        resolve([response, fromClientId, transactionId]);
      },
      reject,
      timeout
    ]);
    try {
      sendImpl(toClientId, requestId, message, body);
    } catch (error) {
      stopTimeout(timeout);
      collDel(pendingRequests, requestId);
      reject(error);
    }
  });
  const mergeTablesStamps = (tablesStamp, [tableStamps2, tablesTime2]) => {
    objForEach(tableStamps2, ([rowStamps2, tableTime2], tableId) => {
      const tableStamp = objEnsure(tablesStamp[0], tableId, stampNewObj);
      objForEach(rowStamps2, ([cellStamps2, rowTime2], rowId) => {
        const rowStamp = objEnsure(tableStamp[0], rowId, stampNewObj);
        objForEach(
          cellStamps2,
          ([cell2, cellTime2], cellId) => objSet(rowStamp[0], cellId, stampNew(cell2, cellTime2))
        );
        rowStamp[1] = getLatestHlc(rowStamp[1], rowTime2);
      });
      tableStamp[1] = getLatestHlc(tableStamp[1], tableTime2);
    });
    tablesStamp[1] = getLatestHlc(tablesStamp[1], tablesTime2);
  };
  const getChangesFromOtherStore = (otherClientId = null, otherContentHashes, transactionId = getTransactionId()) => tryCatch(async () => {
    if (isUndefined(otherContentHashes)) {
      [otherContentHashes, otherClientId, transactionId] = await request(
        null,
        1,
        EMPTY_STRING,
        transactionId
      );
    }
    const [otherTablesHash, otherValuesHash] = otherContentHashes;
    const [tablesHash, valuesHash] = store.getMergeableContentHashes();
    let tablesChanges = stampNewObj();
    if (tablesHash != otherTablesHash) {
      const [newTables, differentTableHashes] = (await request(
        otherClientId,
        4,
        store.getMergeableTableHashes(),
        transactionId
      ))[0];
      tablesChanges = newTables;
      if (!objIsEmpty(differentTableHashes)) {
        const [newRows, differentRowHashes] = (await request(
          otherClientId,
          5,
          store.getMergeableRowHashes(differentTableHashes),
          transactionId
        ))[0];
        mergeTablesStamps(tablesChanges, newRows);
        if (!objIsEmpty(differentRowHashes)) {
          const newCells = (await request(
            otherClientId,
            6,
            store.getMergeableCellHashes(differentRowHashes),
            transactionId
          ))[0];
          mergeTablesStamps(tablesChanges, newCells);
        }
      }
    }
    return [
      tablesChanges,
      valuesHash == otherValuesHash ? stampNewObj() : (await request(
        otherClientId,
        7,
        store.getMergeableValueHashes(),
        transactionId
      ))[0],
      1
    ];
  }, onIgnoredError);
  const getPersisted = async () => {
    const changes = await getChangesFromOtherStore();
    return changes && (!objIsEmpty(changes[0][0]) || !objIsEmpty(changes[1][0])) ? changes : void 0;
  };
  const setPersisted = async (_getContent, changes) => changes ? sendImpl(null, getTransactionId(), 3, changes) : sendImpl(
    null,
    getTransactionId(),
    2,
    store.getMergeableContentHashes()
  );
  const addPersisterListener = (listener) => persisterListener = listener;
  const delPersisterListener = () => persisterListener = void 0;
  const startSync = async (initialContent) => {
    syncing = 1;
    return await persister.startAutoPersisting(initialContent);
  };
  const stopSync = async () => {
    syncing = 0;
    await persister.stopAutoPersisting();
    return persister;
  };
  const destroy = async () => {
    destroyed = true;
    rejectPendingRequests(errorNew(ERROR_SYNC_RESPONSE, "destroyed"));
    preDestroy();
    await persister.stopSync();
    extraDestroy();
    return persister;
  };
  const getSynchronizerStats = () => ({ sends, receives });
  const persister = createCustomPersister(
    store,
    getPersisted,
    setPersisted,
    addPersisterListener,
    delPersisterListener,
    onIgnoredError,
    2,
    // MergeableStoreOnly
    { startSync, stopSync, destroy, getSynchronizerStats, ...extra },
    1
  );
  registerReceive((fromClientId, transactionOrRequestId, message, body) => {
    if (destroyed) {
      return;
    }
    if (!isProtocolMessageValid(transactionOrRequestId, message, body)) {
      onIgnoredError?.(errorNew(ERROR_SYNC_MESSAGE));
      return;
    }
    const isAutoLoading = syncing || persister.isAutoLoading();
    receives++;
    onReceive?.(fromClientId, transactionOrRequestId, message, body);
    if (message == 0) {
      ifNotUndefined(
        mapGet(pendingRequests, transactionOrRequestId),
        ([toClientId, handleResponse]) => isNull(toClientId) || toClientId == fromClientId ? handleResponse(body, fromClientId) : (
          /* istanbul ignore next */
          0
        )
      );
    } else if (message == 2 && isAutoLoading) {
      getChangesFromOtherStore(
        fromClientId,
        body,
        transactionOrRequestId ?? void 0
      ).then((changes) => {
        persisterListener?.(void 0, changes);
      }).catch(onIgnoredError);
    } else if (message == 3 && isAutoLoading) {
      persisterListener?.(void 0, body);
    } else {
      ifNotUndefined(
        message == 1 && (syncing || persister.isAutoSaving()) ? store.getMergeableContentHashes() : message == 4 ? store.getMergeableTableDiff(body) : message == 5 ? store.getMergeableRowDiff(body) : message == 6 ? store.getMergeableCellDiff(body) : message == 7 ? store.getMergeableValueDiff(body) : void 0,
        (response) => {
          sendImpl(
            fromClientId,
            transactionOrRequestId,
            0,
            response
          );
        }
      );
    }
  }, rejectPendingRequests);
  return persister;
};
const CONTENT_HASHES = 2;
const CONTENT_DIFF = 3;
const multipleStates = weakMapNew();
const legacyWebSockets = weakSetNew();
const createConnection = () => {
  let resolve;
  let reject;
  const promise2 = promiseNew((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  promise2.catch(() => 0);
  return [promise2, resolve, reject];
};
const createMultipleState = (webSocket) => {
  const channels = mapNew();
  const pendingControls = mapNew();
  const payloadBuffer = [0, 0];
  const removeListeners = [];
  let connection = createConnection();
  let connected = false;
  let destroyed = false;
  let disconnected = false;
  let disconnect = () => {
  };
  let flushTimeout;
  let opening;
  let overflowing = false;
  let queuedCount = 0;
  let queuedSize = 0;
  let receiving = true;
  const notifyChannelIgnoredError = (channel, error) => tryReturn(() => channel[
    6
    /* OnIgnoredError */
  ]?.(error));
  const notifyIgnoredError = (error) => mapForEach(
    channels,
    (_channelId, channel) => notifyChannelIgnoredError(channel, error)
  );
  const handleSendError = (channel, error) => {
    notifyChannelIgnoredError(channel, error);
    disconnect();
    tryReturn(() => webSocket.close());
  };
  const addWebSocketListener = (event, handler) => arrayPush(removeListeners, addEventListener(webSocket, event, handler));
  const rejectPendingControls = (error) => mapForEach(pendingControls, (requestId, [, , , reject, timeout]) => {
    stopTimeout(timeout);
    collDel(pendingControls, requestId);
    reject(error);
  });
  const failChannels = (error) => mapForEach(
    channels,
    (_channelId, channel) => tryReturn(() => channel[
      11
      /* Fail */
    ]?.(error))
  );
  const clearIncoming = (channel) => {
    arrayForEach(
      channel[
        1
        /* Incoming */
      ],
      ([, timeout]) => stopTimeout(timeout)
    );
    queuedCount -= size(channel[
      1
      /* Incoming */
    ]);
    queuedSize -= channel[
      8
      /* IncomingSize */
    ];
    arrayClear(channel[
      1
      /* Incoming */
    ]);
    channel[
      8
      /* IncomingSize */
    ] = 0;
  };
  const clearOutgoing = (channel, clearDirty = false) => {
    arrayForEach(
      channel[
        2
        /* Outgoing */
      ],
      ([, timeout]) => stopTimeout(timeout)
    );
    queuedCount -= channel[
      10
      /* OutgoingCount */
    ];
    queuedSize -= channel[
      9
      /* OutgoingSize */
    ];
    arrayClear(channel[
      2
      /* Outgoing */
    ]);
    channel[
      9
      /* OutgoingSize */
    ] = 0;
    channel[
      10
      /* OutgoingCount */
    ] = 0;
    if (clearDirty) {
      channel[
        7
        /* Dirty */
      ] = void 0;
    }
  };
  const clearReceive = (channel) => channel[
    0
    /* Receive */
  ]?.[1]();
  const clearReceives = () => mapForEach(channels, (_channelId, channel) => clearReceive(channel));
  const handleInvalid = createInvalidPayloadHandler(
    webSocket,
    notifyIgnoredError
  );
  const invalid = (error) => {
    if (receiving) {
      receiving = false;
      disconnected = true;
      connected = false;
      clearReceives();
      connection[2](error);
      rejectPendingControls(error);
      failChannels(error);
      mapForEach(channels, (_channelId, channel) => {
        clearIncoming(channel);
        clearOutgoing(channel, true);
        channel[
          3
          /* Subscribed */
        ] = false;
        channel[
          4
          /* Subscribing */
        ] = void 0;
        channel[
          12
          /* SubscribeConnection */
        ] = void 0;
      });
      if (flushTimeout) {
        stopTimeout(flushTimeout);
        flushTimeout = void 0;
      }
      handleInvalid(error);
    }
  };
  const overflow = (details) => {
    const error = errorNew(ERROR_SYNC_OVERFLOW, details);
    if (!overflowing && !destroyed) {
      overflowing = true;
      receiving = false;
      connected = false;
      clearReceives();
      notifyIgnoredError(error);
      rejectPendingControls(error);
      failChannels(error);
      mapForEach(channels, (_channelId, channel) => {
        clearIncoming(channel);
        clearOutgoing(channel, true);
        channel[
          3
          /* Subscribed */
        ] = false;
        channel[
          4
          /* Subscribing */
        ] = void 0;
        channel[
          12
          /* SubscribeConnection */
        ] = void 0;
      });
      if (flushTimeout) {
        stopTimeout(flushTimeout);
        flushTimeout = void 0;
      }
      webSocket.close(1013, error.message);
    }
    return error;
  };
  const getConnectionTimeoutSeconds = () => {
    let first = true;
    let timeoutSeconds = 1;
    mapForEach(channels, (_channelId, channel) => {
      const channelTimeoutSeconds = channel[
        5
        /* TimeoutSeconds */
      ];
      if (first || channelTimeoutSeconds < timeoutSeconds) {
        first = false;
        timeoutSeconds = channelTimeoutSeconds;
      }
    });
    return timeoutSeconds;
  };
  const sendControl = (control, body, timeoutSeconds, onSent) => {
    const requestId = getUniqueId();
    return promiseNew((resolve, reject) => {
      if (collSize(pendingControls) >= MAX_PENDING_REQUESTS) {
        reject(overflow("controls"));
        return;
      }
      const payload = createMultipleControlPayload(requestId, control, body);
      const payloadSize = getWebSocketPayloadSize(payload);
      if (isWebSocketPayloadTooLarge(payloadSize) || isWebSocketBackpressured(webSocket, payloadSize)) {
        reject(overflow("socket"));
        return;
      }
      const timeout = startTimeout(() => {
        collDel(pendingControls, requestId);
        reject(errorNew(ERROR_MULTIPLEX_RESPONSE, control));
      }, timeoutSeconds);
      mapSet(pendingControls, requestId, [
        control,
        body,
        resolve,
        reject,
        timeout
      ]);
      try {
        webSocket.send(payload);
        onSent?.();
      } catch (error) {
        stopTimeout(timeout);
        collDel(pendingControls, requestId);
        reject(error);
      }
    });
  };
  const getPayloadsSize = (payloads) => arrayReduce(
    payloads,
    (total, payload) => total + getWebSocketPayloadSize(payload),
    0
  );
  const expireIncoming = (channel, incoming) => {
    const index = arrayIndexOf(channel[
      1
      /* Incoming */
    ], incoming);
    if (index > -1) {
      channel[
        1
        /* Incoming */
      ] = arrayFilter(
        channel[
          1
          /* Incoming */
        ],
        (_incoming, incomingIndex) => incomingIndex != index
      );
      const incomingSize = getWebSocketPayloadSize(incoming[0]);
      channel[
        8
        /* IncomingSize */
      ] -= incomingSize;
      queuedCount--;
      queuedSize -= incomingSize;
    }
  };
  const queueIncoming = (channel, payload) => {
    const payloadSize = getWebSocketPayloadSize(payload);
    if (queuedCount >= MAX_WEBSOCKET_QUEUE_SIZE || queuedSize + payloadSize > MAX_WEBSOCKET_BUFFER_SIZE) {
      overflow("client");
      return;
    }
    const incoming = [
      payload,
      startTimeout(
        () => expireIncoming(channel, incoming),
        channel[
          5
          /* TimeoutSeconds */
        ]
      )
    ];
    arrayPush(channel[
      1
      /* Incoming */
    ], incoming);
    channel[
      8
      /* IncomingSize */
    ] += payloadSize;
    queuedCount++;
    queuedSize += payloadSize;
  };
  const expireOutgoing = (channel, outgoing) => {
    const index = arrayIndexOf(channel[
      2
      /* Outgoing */
    ], outgoing);
    if (index > -1) {
      channel[
        2
        /* Outgoing */
      ] = arrayFilter(
        channel[
          2
          /* Outgoing */
        ],
        (_outgoing, outgoingIndex) => outgoingIndex != index
      );
      const remainingPayloads = slice(outgoing[0], outgoing[2]);
      const remainingSize = getPayloadsSize(remainingPayloads);
      channel[
        9
        /* OutgoingSize */
      ] -= remainingSize;
      channel[
        10
        /* OutgoingCount */
      ] -= size(remainingPayloads);
      queuedCount -= size(remainingPayloads);
      queuedSize -= remainingSize;
    }
  };
  const queueOutgoing = (channel, payloads) => {
    const payloadsSize = getPayloadsSize(payloads);
    if (queuedCount + size(payloads) > MAX_WEBSOCKET_QUEUE_SIZE || queuedSize + payloadsSize > MAX_WEBSOCKET_BUFFER_SIZE) {
      overflow("client");
      return false;
    }
    const outgoing = [
      payloads,
      startTimeout(
        () => expireOutgoing(channel, outgoing),
        channel[
          5
          /* TimeoutSeconds */
        ]
      ),
      0
    ];
    arrayPush(channel[
      2
      /* Outgoing */
    ], outgoing);
    channel[
      9
      /* OutgoingSize */
    ] += payloadsSize;
    channel[
      10
      /* OutgoingCount */
    ] += size(payloads);
    queuedCount += size(payloads);
    queuedSize += payloadsSize;
    return true;
  };
  const scheduleFlush = () => {
    flushTimeout ??= startTimeout(() => {
      flushTimeout = void 0;
      mapForEach(channels, flushOutgoing);
    }, 0.01);
  };
  const sendPayloads = (channelId, channel, payloads, coalesce) => {
    if (webSocket.readyState != webSocket.OPEN) {
      if (coalesce) {
        channel[
          7
          /* Dirty */
        ] = coalesce;
      } else {
        queueOutgoing(channel, payloads);
      }
      return false;
    }
    for (let index = 0; index < size(payloads); index++) {
      const payload = createMultiplePayload(channelId, payloads[index]);
      const payloadSize = getWebSocketPayloadSize(payload);
      if (isWebSocketPayloadTooLarge(payloadSize)) {
        overflow("client");
        return false;
      }
      if (isWebSocketBackpressured(webSocket, payloadSize)) {
        if (coalesce) {
          channel[
            7
            /* Dirty */
          ] = coalesce;
        } else if (!queueOutgoing(channel, slice(payloads, index))) {
          return false;
        }
        scheduleFlush();
        return false;
      }
      try {
        webSocket.send(payload);
      } catch (error) {
        if (coalesce) {
          channel[
            7
            /* Dirty */
          ] = coalesce;
        } else if (!queueOutgoing(channel, slice(payloads, index))) {
          return false;
        }
        handleSendError(channel, error);
        return false;
      }
    }
    return true;
  };
  const flushOutgoing = (channelId, channel) => {
    if (!connected || !channel[
      3
      /* Subscribed */
    ]) {
      return;
    }
    const outgoingQueue = channel[
      2
      /* Outgoing */
    ];
    let outgoingIndex = 0;
    while (outgoingIndex < size(outgoingQueue)) {
      const outgoing = outgoingQueue[outgoingIndex];
      const payloads = outgoing[0];
      let payloadIndex = outgoing[2];
      while (payloadIndex < size(payloads)) {
        const queuedPayload = payloads[payloadIndex];
        const payload = createMultiplePayload(channelId, queuedPayload);
        const payloadSize = getWebSocketPayloadSize(payload);
        if (isWebSocketPayloadTooLarge(payloadSize)) {
          arrayClear(outgoingQueue, outgoingIndex);
          overflow("client");
          return;
        }
        if (isWebSocketBackpressured(webSocket, payloadSize)) {
          arrayClear(outgoingQueue, outgoingIndex);
          scheduleFlush();
          return;
        }
        try {
          webSocket.send(payload);
        } catch (error) {
          handleSendError(channel, error);
          return;
        }
        payloads[payloadIndex] = EMPTY_STRING;
        outgoing[2] = ++payloadIndex;
        const sentPayloadSize = getWebSocketPayloadSize(queuedPayload);
        channel[
          9
          /* OutgoingSize */
        ] -= sentPayloadSize;
        channel[
          10
          /* OutgoingCount */
        ]--;
        queuedSize -= sentPayloadSize;
        queuedCount--;
      }
      stopTimeout(outgoing[1]);
      outgoingIndex++;
    }
    arrayClear(outgoingQueue, outgoingIndex);
    const coalesce = channel[
      7
      /* Dirty */
    ];
    if (coalesce) {
      channel[
        7
        /* Dirty */
      ] = void 0;
      sendPayloads(channelId, channel, coalesce(), coalesce);
    }
  };
  const subscribe = async (channelId, channel, timeoutSeconds) => {
    if (!channel[
      3
      /* Subscribed */
    ]) {
      let subscribing = channel[
        4
        /* Subscribing */
      ];
      const subscribingConnection = connection;
      if (subscribing?.[0] !== subscribingConnection) {
        const subscribingPromise = (async () => {
          await subscribingConnection[0];
          if (mapGet(channels, channelId) !== channel || connection !== subscribingConnection || !connected) {
            return;
          }
          await sendControl(
            MultipleControl.Subscribe,
            channelId,
            timeoutSeconds,
            () => {
              if (mapGet(channels, channelId) === channel && connection === subscribingConnection && connected) {
                channel[
                  12
                  /* SubscribeConnection */
                ] = subscribingConnection;
              }
            }
          );
          if (mapGet(channels, channelId) === channel && connection === subscribingConnection && connected) {
            channel[
              3
              /* Subscribed */
            ] = true;
            flushOutgoing(channelId, channel);
          }
        })();
        subscribing = [subscribingConnection, subscribingPromise];
        channel[
          4
          /* Subscribing */
        ] = subscribing;
      }
      try {
        await subscribing[1];
      } finally {
        if (channel[
          4
          /* Subscribing */
        ] === subscribing) {
          channel[
            4
            /* Subscribing */
          ] = void 0;
        }
      }
    }
  };
  const onOpen = () => {
    if (destroyed || !receiving || connected || opening?.[0] === connection) {
      return;
    }
    disconnected = false;
    overflowing = false;
    const openingConnection = connection;
    const openingPromise = (async () => {
      try {
        await sendControl(
          MultipleControl.Hello,
          MULTIPLE_VERSION,
          getConnectionTimeoutSeconds()
        );
        if (connection === openingConnection && receiving && !destroyed) {
          connected = true;
          openingConnection[1]();
          mapForEach(
            channels,
            (channelId, channel) => subscribe(
              channelId,
              channel,
              channel[
                5
                /* TimeoutSeconds */
              ]
            ).catch(
              (error) => error.message == errorNew(ERROR_MULTIPLEX_SOCKET).message ? 0 : notifyChannelIgnoredError(channel, error)
            )
          );
        }
      } catch (error) {
        openingConnection[2](error);
        if (error.message != errorNew(ERROR_MULTIPLEX_SOCKET).message) {
          notifyIgnoredError(error);
        }
      }
    })();
    opening = [openingConnection, openingPromise];
    openingPromise.finally(() => {
      if (opening?.[1] === openingPromise) {
        opening = void 0;
      }
    });
  };
  disconnect = () => {
    if (!destroyed && !disconnected) {
      disconnected = true;
      const wasOverflowing = overflowing;
      overflowing = false;
      connected = false;
      const error = errorNew(ERROR_MULTIPLEX_SOCKET);
      if (!wasOverflowing) {
        notifyIgnoredError(error);
      }
      connection[2](error);
      rejectPendingControls(error);
      failChannels(error);
      if (flushTimeout) {
        stopTimeout(flushTimeout);
        flushTimeout = void 0;
      }
      connection = createConnection();
      mapForEach(channels, (_channelId, channel) => {
        clearReceive(channel);
        channel[
          3
          /* Subscribed */
        ] = false;
        channel[
          4
          /* Subscribing */
        ] = void 0;
        channel[
          12
          /* SubscribeConnection */
        ] = void 0;
      });
    }
  };
  const onClose = disconnect;
  addWebSocketListener(MESSAGE, ({ data }) => {
    if (!receiving) {
      return;
    }
    const payload = data.toString(UTF8);
    if (isWebSocketPayloadTooLarge(getWebSocketPayloadSize(payload))) {
      invalid(errorNew(ERROR_SYNC_OVERFLOW, "socket"));
      return;
    }
    const control = ifMultipleControlPayloadValid(
      payload,
      (requestId, control2, body) => {
        if ((control2 == MultipleControl.Subscribe || control2 == MultipleControl.Unsubscribe) && isString(body) && !isMultipleChannelIdValid(body)) {
          overflow("channels");
          return;
        }
        const pendingControl = requestId ? mapGet(pendingControls, requestId) : void 0;
        if (pendingControl?.[0] == control2 && pendingControl[1] === body) {
          stopTimeout(pendingControl[4]);
          collDel(pendingControls, requestId);
          pendingControl[2]();
        }
      }
    );
    const channel = ifMultiplePayloadValid(
      payload,
      (channelId, channelPayload) => {
        const channel2 = mapGet(channels, channelId);
        if (channel2) {
          if (channel2[
            0
            /* Receive */
          ]) {
            channel2[
              0
              /* Receive */
            ][0](channelPayload);
          } else {
            queueIncoming(channel2, channelPayload);
          }
        } else {
          invalid(errorNew(ERROR_SYNC_MESSAGE));
        }
      },
      () => overflow("channels")
    );
    if (!control && !channel) {
      invalid(errorNew(ERROR_SYNC_MESSAGE));
    }
  });
  addWebSocketListener(OPEN, onOpen);
  addWebSocketListener(CLOSE, onClose);
  addWebSocketListener(ERROR, (error) => {
    notifyIgnoredError(error);
    failChannels(errorNew(ERROR_MULTIPLEX_SOCKET));
  });
  const addChannel = async (channelId, timeoutSeconds, onIgnoredError) => {
    if (!receiving || destroyed) {
      errorThrow(ERROR_MULTIPLEX_SOCKET);
    }
    if (!isMultipleChannelIdValid(channelId)) {
      errorThrow(ERROR_MULTIPLEX_CHANNEL, channelId);
    }
    if (collHas(channels, channelId)) {
      errorThrow(ERROR_MULTIPLEX_CHANNEL_DUPLICATE, channelId);
    }
    if (collSize(channels) >= MAX_MULTIPLE_CHANNELS) {
      errorThrow(ERROR_SYNC_OVERFLOW, "channels");
    }
    const channel = [
      void 0,
      [],
      [],
      false,
      void 0,
      timeoutSeconds,
      onIgnoredError,
      void 0,
      0,
      0,
      0,
      void 0,
      void 0
    ];
    mapSet(channels, channelId, channel);
    if (webSocket.readyState == webSocket.OPEN) {
      onOpen();
    } else if (webSocket.readyState > webSocket.OPEN) {
      const error = errorNew(ERROR_MULTIPLEX_SOCKET);
      notifyChannelIgnoredError(channel, error);
      connection[2](error);
    }
    try {
      await subscribe(channelId, channel, timeoutSeconds);
    } catch (error) {
      delChannel(channelId);
      throw error;
    }
  };
  const registerReceive = (channelId, receive, fail) => {
    const channel = mapGet(channels, channelId);
    if (channel) {
      channel[
        0
        /* Receive */
      ] = receive;
      channel[
        11
        /* Fail */
      ] = fail;
      const incoming = channel[
        1
        /* Incoming */
      ];
      let incomingIndex = 0;
      tryFinally(
        () => {
          while (incomingIndex < size(incoming)) {
            const [payload, timeout] = incoming[incomingIndex];
            stopTimeout(timeout);
            const payloadSize = getWebSocketPayloadSize(payload);
            channel[
              8
              /* IncomingSize */
            ] -= payloadSize;
            queuedCount--;
            queuedSize -= payloadSize;
            incomingIndex++;
            receive[0](payload);
          }
        },
        () => arrayClear(incoming, incomingIndex)
      );
    }
  };
  const send = (channelId, payloads, coalesce) => {
    if (!receiving) {
      return;
    }
    const channel = mapGet(channels, channelId);
    if (channel) {
      if (connected && webSocket.readyState == webSocket.OPEN && channel[
        3
        /* Subscribed */
      ] && !size(channel[
        2
        /* Outgoing */
      ]) && !channel[
        7
        /* Dirty */
      ]) {
        sendPayloads(channelId, channel, payloads, coalesce);
      } else if (coalesce) {
        channel[
          7
          /* Dirty */
        ] = coalesce;
      } else {
        queueOutgoing(channel, payloads);
      }
    }
  };
  const destroyIfEmpty = () => {
    if (collIsEmpty(channels) && !destroyed) {
      destroyed = true;
      const closeWebSocket = receiving && !overflowing;
      receiving = false;
      clearReceives();
      const error = errorNew(ERROR_MULTIPLEX_DESTROYED);
      rejectPendingControls(error);
      if (flushTimeout) {
        stopTimeout(flushTimeout);
        flushTimeout = void 0;
      }
      arrayForEach(
        removeListeners,
        (removeListener) => tryReturn(removeListener)
      );
      arrayClear(removeListeners);
      multipleStates.delete(webSocket);
      if (closeWebSocket) {
        tryReturn(() => webSocket.close());
      }
    }
  };
  const delChannel = (channelId) => {
    const channel = mapGet(channels, channelId);
    if (channel) {
      try {
        clearReceive(channel);
        clearIncoming(channel);
        clearOutgoing(channel, true);
        if (connected && channel[
          12
          /* SubscribeConnection */
        ] === connection) {
          const payload = createMultipleControlPayload(
            null,
            MultipleControl.Unsubscribe,
            channelId
          );
          const payloadSize = getWebSocketPayloadSize(payload);
          if (isWebSocketPayloadTooLarge(payloadSize) || isWebSocketBackpressured(webSocket, payloadSize)) {
            overflow("socket");
          } else {
            webSocket.send(payload);
          }
        }
      } catch (error) {
        notifyChannelIgnoredError(channel, error);
      } finally {
        collDel(channels, channelId);
        destroyIfEmpty();
      }
    }
  };
  return {
    addChannel,
    delChannel,
    destroyIfEmpty,
    invalid,
    payloadBuffer,
    registerReceive,
    send
  };
};
const createMultipleWsSynchronizer = async (store, webSocket, channelId, requestTimeoutSeconds, onSend, onReceive, onIgnoredError, fragmentSize) => {
  if (legacyWebSockets.has(webSocket)) {
    errorThrow(ERROR_MULTIPLEX_LEGACY);
  }
  const existingState = multipleStates.get(webSocket);
  const state = existingState ?? (() => {
    const newState = createMultipleState(webSocket);
    multipleStates.set(webSocket, newState);
    return newState;
  })();
  try {
    await state.addChannel(channelId, requestTimeoutSeconds, onIgnoredError);
  } catch (error) {
    if (!existingState) {
      state.destroyIfEmpty();
    }
    throw error;
  }
  try {
    return createCustomSynchronizer(
      store,
      (toClientId, requestId, message, body) => state.send(
        channelId,
        createPayloads(toClientId, requestId, message, body, fragmentSize),
        toClientId == null && (message == CONTENT_HASHES || message == CONTENT_DIFF) ? () => createPayloads(
          null,
          requestId,
          CONTENT_HASHES,
          store.getMergeableContentHashes(),
          fragmentSize
        ) : void 0
      ),
      (receive, fail) => state.registerReceive(
        channelId,
        createPayloadReceiver(
          receive,
          requestTimeoutSeconds,
          state.invalid,
          state.payloadBuffer
        ),
        fail
      ),
      () => state.delChannel(channelId),
      requestTimeoutSeconds,
      onSend,
      onReceive,
      onIgnoredError,
      { getWebSocket: () => webSocket }
    );
  } catch (error) {
    state.delChannel(channelId);
    throw error;
  }
};
const createLegacyWsSynchronizer = async (store, webSocket, requestTimeoutSeconds = 1, onSend, onReceive, onIgnoredError, fragmentSize) => {
  if (multipleStates.has(webSocket)) {
    errorThrow(ERROR_LEGACY_MULTIPLEX);
  }
  let creating = true;
  let overflowing = false;
  let removeTransportListeners = () => {
  };
  const notifyIgnoredError = (error) => tryReturn(() => onIgnoredError?.(error));
  const overflow = () => {
    if (!overflowing) {
      overflowing = true;
      const error = errorNew(ERROR_SYNC_OVERFLOW, "socket");
      notifyIgnoredError(error);
      webSocket.close(1013, error.message);
    }
  };
  const registerReceive = (receive, fail) => {
    const invalid = createInvalidPayloadHandler(webSocket, notifyIgnoredError);
    const [receivePayload, clearReceivePayload] = createPayloadReceiver(
      receive,
      requestTimeoutSeconds,
      invalid
    );
    let removeListeners = [];
    removeTransportListeners = () => {
      clearReceivePayload();
      arrayForEach(
        removeListeners,
        (removeListener) => tryReturn(removeListener)
      );
      arrayClear(removeListeners);
    };
    const failTransport = () => {
      tryReturn(() => fail(errorNew(ERROR_MULTIPLEX_SOCKET)));
      removeTransportListeners();
    };
    removeListeners = [
      addEventListener(
        webSocket,
        MESSAGE,
        ({ data }) => receivePayload(data.toString(UTF8))
      ),
      addEventListener(webSocket, CLOSE, () => {
        if (!creating) {
          failTransport();
        }
      }),
      addEventListener(webSocket, ERROR, (error) => {
        if (!creating) {
          notifyIgnoredError(error);
          failTransport();
        }
      })
    ];
  };
  const send = (toClientId, ...args) => {
    arrayForEach(
      createPayloads(toClientId, ...args, fragmentSize),
      (payload) => {
        if (overflowing) {
          return;
        }
        const payloadSize = getWebSocketPayloadSize(payload);
        if (isWebSocketPayloadTooLarge(payloadSize) || isWebSocketBackpressured(webSocket, payloadSize)) {
          overflow();
        } else {
          webSocket.send(payload);
        }
      }
    );
  };
  const destroy = () => {
    removeTransportListeners();
    webSocket.close();
  };
  const synchronizer = createCustomSynchronizer(
    store,
    send,
    registerReceive,
    destroy,
    requestTimeoutSeconds,
    onSend,
    onReceive,
    onIgnoredError,
    { getWebSocket: () => webSocket }
  );
  legacyWebSockets.add(webSocket);
  return promiseNew((resolve, reject) => {
    let removeAttemptListeners = () => {
    };
    const rejectCreation = (error, ignoredError = error) => {
      notifyIgnoredError(ignoredError);
      removeAttemptListeners();
      removeTransportListeners();
      legacyWebSockets.delete(webSocket);
      tryReturn(() => webSocket.close());
      reject(error);
    };
    if (webSocket.readyState != webSocket.OPEN) {
      if (webSocket.readyState > webSocket.OPEN) {
        rejectCreation(errorNew(ERROR_MULTIPLEX_SOCKET));
        return;
      }
      const removeAttemptListenersArray = [
        addEventListener(webSocket, OPEN, () => {
          creating = false;
          removeAttemptListeners();
          resolve(synchronizer);
        }),
        addEventListener(
          webSocket,
          ERROR,
          (error) => rejectCreation(errorNew(ERROR_MULTIPLEX_SOCKET), error)
        ),
        addEventListener(
          webSocket,
          CLOSE,
          () => rejectCreation(errorNew(ERROR_MULTIPLEX_SOCKET))
        )
      ];
      removeAttemptListeners = () => {
        arrayForEach(
          removeAttemptListenersArray,
          (removeListener) => tryReturn(removeListener)
        );
        arrayClear(removeAttemptListenersArray);
      };
    } else {
      creating = false;
      resolve(synchronizer);
    }
  });
};
const createWsSynchronizer = async (store, webSocket, channelIdOrRequestTimeout = 1, ...args) => isString(channelIdOrRequestTimeout) ? createMultipleWsSynchronizer(
  store,
  webSocket,
  channelIdOrRequestTimeout,
  args[0] ?? 1,
  args[1],
  args[2],
  args[3],
  args[4]
) : createLegacyWsSynchronizer(
  store,
  webSocket,
  channelIdOrRequestTimeout,
  args[0],
  args[1],
  args[2],
  args[3]
);
export {
  TABLES,
  applyVaultToStore,
  awaitingCheck,
  checkReport,
  createMergeableStore,
  createWsSynchronizer,
  incomplete,
  isBug,
  moveBug,
  sortBugs,
  storeToVault,
  writeVaultToStore
};
