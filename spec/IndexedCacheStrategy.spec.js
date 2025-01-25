import { IndexedCacheStrategy } from '@themost/cache/platform-server';
import { getApplication } from '@themost/test';
import {DataCacheStrategy, DataModel, SchemaLoaderStrategy} from '@themost/data';


describe('IndexedCachedStrategy', () => {
    /**
     * @type {import('@themost/express').ExpressDataContext}
     */
    let context;
    beforeAll(async () => {
        const container = getApplication();
        /**
         * @type {import('@themost/express').ExpressDataApplication}
         */
        const app = container.get('ExpressDataApplication');
        /**
         * @type {import('@themost/cache').DataCacheFinalize|*}
         */
        let caching = app.getConfiguration().getStrategy(DataCacheStrategy);
        if (caching && typeof caching.finalize === 'function') {
            await caching.finalize();
        }
        app.getConfiguration().useStrategy(DataCacheStrategy, IndexedCacheStrategy);
        /**
         * @type {IndexedCacheStrategy|*}
         */
        caching = app.getConfiguration().getStrategy(DataCacheStrategy);
        //const cacheEntry = caching.rawCache.configuration.getStrategy(SchemaLoaderStrategy).getModelDefinition('CacheEntry');
        context = app.createContext();

        function onAfterSaveOrRemove(event, callback) {
            const context = event.model.context;
            if (event.model.caching === 'none') {
                return callback();
            }
            const caching = context.getConfiguration().getStrategy(DataCacheStrategy);
            if (caching == null) {
                return callback();
            }
            caching.remove(`/${event.model.name}/*`).then(() => {
                return callback();
            }).catch((err) => {
                return callback(err);
            });
        }
        DataModel.load.subscribe((event) => {
            event.target.on('after.save', onAfterSaveOrRemove);
            event.target.on('after.remove', onAfterSaveOrRemove);
        });

    });
    afterAll(async () => {
        /**
         * @type {import('@themost/cache').DataCacheFinalize|*}
         */
        const caching = context.application.getConfiguration().getStrategy(DataCacheStrategy);
        if (caching && typeof caching.finalize === 'function') {
            await caching.finalize();
        }
        await context.finalizeAsync();
    });
    it('should try to use cache', async () => {
        const schema = context.application.getConfiguration().getStrategy(SchemaLoaderStrategy);
        const definition = schema.getModelDefinition('ActionStatusType');
        definition.caching = 'always';
        schema.setModelDefinition(definition);
        const ActionStatusTypes = context.model('ActionStatusType');
        const items = await ActionStatusTypes.asQueryable().getItems();
        expect(items).toBeTruthy();
    });

    it('should try to remove item', async () => {
        /**
         * @type {IndexedCacheStrategy|*}
         */
        const caching = context.getConfiguration().getStrategy(DataCacheStrategy);
        await caching.remove('/ActionStatusType/*');
    });
});
