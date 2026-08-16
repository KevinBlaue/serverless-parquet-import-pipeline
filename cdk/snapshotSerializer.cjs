const ASSET_HASH = /[0-9a-f]{64}(?=\.(?:js|zip))/g;

module.exports = {
  test(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  },
  print(value) {
    return JSON.stringify(normalize(value), null, 2);
  },
};

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalize(entry)]));
  }
  return typeof value === 'string' ? value.replace(ASSET_HASH, '[ASSET_HASH]') : value;
}
