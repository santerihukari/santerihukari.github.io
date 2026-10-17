import {getModel as legacyModel} from './legacy_library/catalogue.mjs';
import {definition as crimp} from './climbing_hold/definition.mjs';
export {defaults} from './legacy_library/catalogue.mjs';

// New native mesh builders need not join the historical Open CASCADE allowlist.
export function getModel(key) {
  return key==='crimp_hold'?crimp:legacyModel(key);
}
