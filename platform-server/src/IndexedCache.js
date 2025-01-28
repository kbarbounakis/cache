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
        const rootDir = containerConfiguration.getSourceAt('settings/cache/rootDir') || IndexedCache.DefaultRootDir;
        const finalRootDir = path.resolve(process.cwd(), rootDir);
        mkdirp.sync(finalRootDir);
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
