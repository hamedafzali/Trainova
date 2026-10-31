// Metro config: the app shares Trainova's domain logic and store with the web
// build by compiling ../src directly. Browser-only modules there (cookie auth,
// relative-URL fetches, the Vibration API) are swapped for native versions in
// src/platform, and every package resolves from this folder's node_modules so
// React and zustand are never loaded twice.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const root = __dirname;
const shared = path.resolve(root, "../src");

const config = getDefaultConfig(root);

config.watchFolders = [shared];
config.resolver.nodeModulesPaths = [path.join(root, "node_modules")];
config.resolver.disableHierarchicalLookup = true;

// Web modules → their native stand-ins.
const REDIRECTS = {
  "lib/auth.ts": "auth.ts",
  "lib/library.ts": "library.ts",
  "lib/haptics.ts": "haptics.ts",
};
const redirect = Object.fromEntries(
  Object.entries(REDIRECTS).map(([from, to]) => [path.join(shared, from), path.join(root, "src/platform", to)]),
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  let name = moduleName;
  if (name.startsWith("@/")) name = path.join(shared, name.slice(2));
  else if (name.startsWith("~/")) name = path.join(root, "src", name.slice(2));
  const result = context.resolveRequest(context, name, platform);
  if (result.type === "sourceFile" && redirect[result.filePath]) {
    return { type: "sourceFile", filePath: redirect[result.filePath] };
  }
  return result;
};

module.exports = config;
