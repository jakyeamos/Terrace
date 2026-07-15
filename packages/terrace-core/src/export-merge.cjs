'use strict';

function mergeModuleExports(modules) {
  const merged = {};
  const owners = new Map();
  for (const [owner, values] of modules) {
    if (values === null || values === undefined) {
      continue;
    }
    const source = Object(values);
    for (const key of Reflect.ownKeys(source)) {
      if (!Object.prototype.propertyIsEnumerable.call(source, key)) {
        continue;
      }
      const value = source[key];
      if (Object.prototype.hasOwnProperty.call(merged, key) && !Object.is(merged[key], value)) {
        throw new Error('Terrace core export collision for "' + String(key) + '": ' + owners.get(key) + ' and ' + owner + '.');
      }
      if (!Object.prototype.hasOwnProperty.call(merged, key)) {
        Object.defineProperty(merged, key, {
          configurable: true,
          enumerable: true,
          value,
          writable: true
        });
        owners.set(key, owner);
      }
    }
  }
  return merged;
}

module.exports = {
  mergeModuleExports
};
