const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages from
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Force specific packages to resolve from monorepo root to avoid duplicates
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => {
      // Check monorepo root first
      const monorepoPath = path.join(monorepoRoot, 'node_modules', name);
      try {
        require.resolve(monorepoPath);
        return monorepoPath;
      } catch (e) {
        // Fall back to project node_modules
        return path.join(projectRoot, 'node_modules', name);
      }
    },
  }
);

// 4. Disable package exports to avoid resolution issues with React 19
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
