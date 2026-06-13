import {Filename, ppath, xfs} from '@yarnpkg/fslib';
import {tests, yarn}          from 'pkg-tests-core';

describe(`Commands`, () => {
  describe(`npm info`, () => {
    test(
      `it should return information about the latest version of a package if no range is specified`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`npm`, `info`, `no-deps`, `--json`);
        expect(stdout).toMatchJSON(expect.objectContaining({
          version: `2.0.0`,
        }));
      }),
    );

    test(
      `it should return information about a specific version if requested`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`npm`, `info`, `no-deps@1.0.0`, `--json`);
        expect(stdout).toMatchJSON(expect.objectContaining({
          version: `1.0.0`,
        }));
      }),
    );

    test(
      `it should return information about the highest version that satisfies a range`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`npm`, `info`, `no-deps@^1.0.0`, `--json`);
        expect(stdout).toMatchJSON(expect.objectContaining({
          version: `1.1.0`,
        }));
      }),
    );

    test(
      `it should return information about a tagged version if requested`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`npm`, `info`, `no-deps-tags@rc`, `--json`);
        expect(stdout).toMatchJSON(expect.objectContaining({
          version: `1.0.0-rc.1`,
        }));
      }),
    );

    test(
      `it should use the configured fetch registry rather than publishConfig.registry for workspace packages by default`,
      makeTemporaryEnv({
        name: `@first/pkg`,
        version: `1.0.0`,
        publishConfig: {
          registry: `https://registry.example.org/registry/publish`,
        },
      }, async ({path, run, source}) => {
        const registryUrl = await tests.startPackageServer();

        await yarn.writeConfiguration(path, {
          npmScopes: {
            first: {
              npmRegistryServer: `${registryUrl}/registry/config`,
            },
          },
          npmRegistries: {
            [`${registryUrl}/registry/publish`]: {
              npmAuthToken: `publish-token`,
            },
          },
        });

        const requests = await tests.startRegistryRecording(async () => {
          await expect(run(`npm`, `info`, `.`, `--json`)).rejects.toThrow(/Package not found/);
        });

        expect(tests.sortJson(requests)).toEqual([{
          registry: `config`,
          scope: `@first`,
          localName: `pkg`,
          type: `packageInfo`,
        }]);
      }),
    );

    test(
      `it should use publishConfig.registry rather than the configured fetch registry when --publish is set for workspace packages`,
      makeTemporaryEnv({
        name: `@first/pkg`,
        version: `1.0.0`,
      }, async ({path, run, source}) => {
        const registryUrl = await tests.startPackageServer();
        const manifestPath = ppath.join(path, Filename.manifest);
        const manifest = await xfs.readJsonPromise(manifestPath);

        manifest.publishConfig = {
          registry: `${registryUrl}/registry/publish`,
        };

        await xfs.writeJsonPromise(manifestPath, manifest);

        await yarn.writeConfiguration(path, {
          npmScopes: {
            first: {
              npmRegistryServer: `${registryUrl}/registry/config`,
            },
          },
        });

        const requests = await tests.startRegistryRecording(async () => {
          await expect(run(`npm`, `info`, `--publish`, `.`, `--json`)).rejects.toThrow(/Package not found/);
        });

        expect(tests.sortJson(requests)).toEqual([{
          registry: `publish`,
          scope: `@first`,
          localName: `pkg`,
          type: `packageInfo`,
        }]);
      }),
    );

    test(
      `it should use the current workspace publishConfig.registry rather than the top-level workspace one when --publish is set for .`,
      makeTemporaryMonorepoEnv({
        private: true,
        workspaces: [`packages/*`],
        name: `root-workspace`,
      }, {
        [`packages/child`]: {
          name: `@first/pkg`,
          version: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        const registryUrl = await tests.startPackageServer();
        const childManifestPath = ppath.join(path, `packages/child` as const, Filename.manifest);
        const childManifest = await xfs.readJsonPromise(childManifestPath);

        childManifest.publishConfig = {
          registry: `${registryUrl}/registry/publish`,
        };

        await xfs.writeJsonPromise(childManifestPath, childManifest);

        await yarn.writeConfiguration(path, {
          npmScopes: {
            first: {
              npmRegistryServer: `${registryUrl}/registry/config`,
            },
          },
        });

        const requests = await tests.startRegistryRecording(async () => {
          await expect(run(`npm`, `info`, `--publish`, `.`, `--json`, {
            cwd: ppath.join(path, `packages/child` as const),
          })).rejects.toThrow(/Package not found/);
        });

        expect(tests.sortJson(requests)).toEqual([{
          registry: `publish`,
          scope: `@first`,
          localName: `pkg`,
          type: `packageInfo`,
        }]);
      }),
    );

    test(
      `it should use the targeted workspace publishConfig.registry when --publish is set for an explicit workspace package`,
      makeTemporaryMonorepoEnv({
        private: true,
        workspaces: [`packages/*`],
        name: `root-workspace`,
      }, {
        [`packages/child`]: {
          name: `@first/pkg`,
          version: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        const registryUrl = await tests.startPackageServer();
        const childManifestPath = ppath.join(path, `packages/child` as const, Filename.manifest);
        const childManifest = await xfs.readJsonPromise(childManifestPath);

        childManifest.publishConfig = {
          registry: `${registryUrl}/registry/publish`,
        };

        await xfs.writeJsonPromise(childManifestPath, childManifest);

        await yarn.writeConfiguration(path, {
          npmScopes: {
            first: {
              npmRegistryServer: `${registryUrl}/registry/config`,
            },
          },
        });

        const requests = await tests.startRegistryRecording(async () => {
          await expect(run(`npm`, `info`, `--publish`, `@first/pkg`, `--json`)).rejects.toThrow(/Package not found/);
        });

        expect(tests.sortJson(requests)).toEqual([{
          registry: `publish`,
          scope: `@first`,
          localName: `pkg`,
          type: `packageInfo`,
        }]);
      }),
    );

    test(
      `it should throw when --publish is set for a package that is not a local workspace`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await expect(run(`npm`, `info`, `--publish`, `no-deps`, `--json`)).rejects.toThrow(/can only be used with local workspace packages/);
      }),
    );
  });
});
