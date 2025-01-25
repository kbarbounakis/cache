import { LocalCacheStrategy, LocalCacheContext } from '@themost/cache/platform-server';
import { ConfigurationBase } from '@themost/common';

describe('LocalCacheStrategy', () => {
    it('should try to create instance', async () => {
        const strategy = new LocalCacheStrategy(new ConfigurationBase('.'));
        expect(strategy).toBeInstanceOf(LocalCacheStrategy);
    });

    it('should try to create context', async () => {
        const strategy = new LocalCacheStrategy(new ConfigurationBase('.'));
        const context = new LocalCacheContext(strategy);
        expect(context).toBeInstanceOf(LocalCacheContext);
        const exists = await context.db.table('CacheEntry').existsAsync();
        expect(typeof exists === 'boolean').toBeTruthy();
        await context.finalizeAsync();
    });

    it('should get item', async () => {
        const cache = new LocalCacheStrategy(new ConfigurationBase('.'));
        await cache.add('cache-item-key', {
            id: 1001
        });
        const item = await cache.get('cache-item-key');
        expect(item).toEqual({
            id: 1001
        });
        await cache.finalizeAsync();
    });

    it('should remove item', async () => {
        const cache = new LocalCacheStrategy(new ConfigurationBase('.'));
        await cache.add('cache-item-key', {
            id: 1001
        });
        let item = await cache.get('cache-item-key');
        expect(item).toEqual({
            id: 1001
        });
        await cache.remove('cache-item-key');
        item = await cache.get('cache-item-key');
        expect(item).toBeUndefined();
        await cache.finalizeAsync();
    });

    it('should get item or add', async () => {
        const cache = new LocalCacheStrategy(new ConfigurationBase('.'));
        let item = await cache.get('cache-item-key');
        expect(item).toBeFalsy();
        await cache.getOrDefault('cache-item-key', async () => {
            return {
                id: 1001
            }
        });
        item = await cache.get('cache-item-key');
        expect(item).toEqual({
            id: 1001
        });
        await cache.finalizeAsync();
    });
});
