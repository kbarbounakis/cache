// eslint-disable-next-line no-unused-vars
import { ModuleLoaderStrategy } from '@themost/common';
import { DataApplication, SchemaLoaderStrategy, DefaultSchemaLoaderStrategy, DataConfigurationStrategy, DefaultDataContext } from '@themost/data';
import { DataCacheStrategy, NoCacheStrategy } from '@themost/cache';
import path from 'path';
import mkdirp from 'mkdirp';

class IndexedCacheContext extends DefaultDataContext {
    constructor() {
        super()
    }
}

class ContainerConfiguration {

}

class IndexedCache extends DataApplication {

    static get DefaultRootDir() {
        return '.cache/indexedCache';
    }

    /**
     * @param {import('@themost/common').ConfigurationBase=} containerConfiguration 
     */
    constructor(containerConfiguration) {
        super(IndexedCache.DefaultRootDir);
        // set jspa imports
        this.configuration.setSourceAt('settings/jspa/imports', [
            path.resolve(__dirname, './models/index')
        ]);
        // set jspa loader
        this.configuration.setSourceAt('settings/schema/loaders', [
            {
                loaderType: '@themost/jspa/platform-server#DefaultEntityLoaderStrategy'
            }
        ]);
        // add default adapter type
        this.configuration.setSourceAt('adapterTypes', [
            {
                name: 'Sqlite Data Adapter',
                invariantName: 'sqlite',
                type: '@themost/sqlite'
            },
            {
                name: 'Connection Pool',
                invariantName: 'pool',
                type: '@themost/pool'
            }
        ]);
        const rootDir = containerConfiguration.getSourceAt('settings/cache/rootDir') || IndexedCache.DefaultRootDir;
        const finalRootDir = path.resolve(process.cwd(), rootDir);
        mkdirp.sync(finalRootDir);
        this.configuration.setSourceAt('adapters', [
            {
                name: 'cache',
                default: false,
                invariantName: 'sqlite',
                options: {
                    database: path.resolve(finalRootDir, 'index.db')
                }
            },
            {
                name: 'cache+pool',
                default: true,
                invariantName: 'pool',
                options: {
                    adapter: 'cache',
                    max: 1,
                }
            }
        ]);
        // reload schema
        this.configuration.useStrategy(SchemaLoaderStrategy, DefaultSchemaLoaderStrategy);
        // reload configuration
        this.configuration.useStrategy(DataConfigurationStrategy, DataConfigurationStrategy);
        // reload configuration
        this.configuration.useStrategy(ModuleLoaderStrategy, function NodeModuleLoader() {
            this.require = (id) => require(id)
        });
        /**
         * @type {import('@themost/cache').DataCacheFinalize|*}
         */
        const cacheStrategy = this.configuration.getStrategy(DataCacheStrategy);
        if (cacheStrategy && typeof cacheStrategy.finalize === 'function') {
            cacheStrategy.finalize().then(() => {
                // do nothing
            });
        }
        // disable internal cache
        this.configuration.useStrategy(DataCacheStrategy, NoCacheStrategy);
        // get container cache
        this.configuration.useStrategy(ContainerConfiguration, function() {
            return containerConfiguration;
        });
    }

    createContext() {
        const context = new IndexedCacheContext();
        context.getConfiguration = () => {
            return this.configuration;
        };
        return context;
    }

}

export {
    IndexedCacheContext,
    IndexedCache
}
