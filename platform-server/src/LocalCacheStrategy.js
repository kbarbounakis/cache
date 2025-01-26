import { Guid, TraceUtils } from '@themost/common';
import MD5 from 'crypto-js/md5';
import { DataCacheStrategy } from '@themost/cache';
import { QueryEntity, QueryExpression } from '@themost/query';
import genericPool from '@themost/pool';
import { createInstance } from '@themost/sqlite';
import path from 'path';
import fs from 'fs';
import { CacheEntrySchema } from './CacheEntrySchema';
// eslint-disable-next-line no-unused-vars
const CACHE_ABSOLUTE_EXPIRATION = 1200;

if (typeof Guid.from !== 'function') {
    Guid.from = function(value) {
        var str = MD5(value).toString();
        return new Guid([
            str.substring(0, 8),
            str.substring(8, 12),
            str.substring(12, 16),
            str.substring(16, 20),
            str.substring(20, 32)
        ].join('-'));
    }
}
/**
 * @implements {import('@themost/common').DataContextBase}
 */
class LocalCacheContext {
    /**
     * @param {LocalCacheStrategy} container
     */
    constructor(container) {
        this.container = container;
        // create generic pool
        /**
         * @type {import('@themost/pool').GenericPoolAdapter}
         */
        this.db = genericPool.createInstance({
            adapter: 'local+cache',
            max: 25
        });
        // get connection factory
        const factory = this.db.pool._factory;
        // use protected property "_adapter" to store adapter instance
        if (factory._adapter == null) {
            // assign adapter instance
            // todo: this operation may be configurable
            Object.assign(factory , {
                _adapter: {
                    createInstance
                }
            });
            // set factory adapter options
            // todo: this operation may be configurable
            factory.options.adapter = {
                options: {
                    database: path.resolve(process.cwd(), '.cache', 'localCache.db')
                }
            };
        }
    }

    /**
     * @returns {Promise<void>}
     */
    async finalizeAsync() {
        await this.db.closeAsync();
    }

    /**
     * @param {Promise<void>} func 
     * @returns {Promise<void>}
     */
    async executeInTransactionAsync(func) {
        await this.db.executeInTransactionAsync(func);
    }

    /**
     * @param {function(err:Error=)} callback 
     * @returns 
     */
    finalize(callback) {
        return this.db.finalize(callback);
    }

    getConfiguration() {
        return;
    }

    /**
     * @param {*} name 
     */
    // eslint-disable-next-line no-unused-vars
    model(name) {
        throw new Error('This operation is not supported by local data context which an ad-hoc query context.');
    }
    

}

class LocalCacheStrategy extends DataCacheStrategy {
    
    /**
     * 
     * @param {import('@themost/common').ConfigurationBase} config 
     */
    constructor(config) {
        super(config);
        // get execution context
        const executionPath = path.resolve(config.getExecutionPath(), '.cache');
        TraceUtils.debug('Validating local cache service path: ' + executionPath);
        void fs.stat(executionPath, (err) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    TraceUtils.debug('Creating local cache service path: ' + executionPath);
                    void fs.mkdir(executionPath, (err) => {
                        if (err) {
                            TraceUtils.error(err);
                            return;
                        }
                        TraceUtils.debug('Local cache service path created successfully.');
                    });
                } else {
                    TraceUtils.error(err);
                }
            }
        });
    }

    async tryInitializeAsync(context) {
        if (this.initialized) {
            return;
        }
        // create local cache context
        const { version, source: appliesTo, name, fields: add } = CacheEntrySchema;
        const migration = {
            version,
            name,
            appliesTo,
            add
        }
        await context.db.migrateAsync(migration);
        this.initialized = true;
    }

    /**
     * 
     * @param {string|import('@themost/cache').CompositeCacheKey} entryKeyOrCompositeKey 
     * @returns {import('@themost/cache').CacheItem}
     */
    fromKeyOrCompositeKey(entryKeyOrCompositeKey) {
        if (typeof entryKeyOrCompositeKey === 'string') {
            return {
                path: entryKeyOrCompositeKey,
                location: 'server',
                contentEncoding: 'application/json'
            }
        }
        return Object.assign({
            location: 'server',
            contentEncoding: 'application/json'
        }, entryKeyOrCompositeKey);
    }

    /**
     * Gets a key value pair from cache
     * @param {string|import('@themost/cache').CompositeCacheKey} key 
     * @returns Promise<*>
     */
    async get(key) {
        const context = new LocalCacheContext(this);
        const CacheEntry = new QueryEntity('CacheEntry');
        try {
            await this.tryInitializeAsync(context);
            const id = this.generateIdentifier(key);
            const query = new QueryExpression().select(({id, content, doomed, expiredAt}) => {
                return {
                    id,
                    content,
                    doomed,
                    expiredAt
                }
            }).from(CacheEntry).where((x, id) => {
                return x.id == id;
            }, id);
            let [entry] = await context.db.executeAsync(query);
            const expired = (entry && entry.doomed) || (entry && entry.expiredAt && entry.expiredAt < new Date());
            if (expired) {
                // remove doomed entry
                await context.db.executeAsync(
                    new QueryExpression().delete(CacheEntry).where((x, id) => {
                        return x.id === id;
                    }, id)
                );
                entry = null;
            }
            if (entry && entry.content) {
                return JSON.parse(entry.content);
            }
            return;
        } finally {
            await context.finalizeAsync();
        }
    }

    /**
     * Sets a key value pair in cache.
     * @param {string|import('@themost/cache').CompositeCacheKey} key - The key to be cached
     * @param {*} value - The value to be cached
     * @param {number=} absoluteExpiration - The expiration time in seconds
     * @returns {Promise<*>}
     */
    async add(key, value, absoluteExpiration) {
        const context = new LocalCacheContext(this);
        const {source: CacheEntry} = CacheEntrySchema;
        try {
            await this.tryInitializeAsync(context);
            const entry = this.fromKeyOrCompositeKey(key);
            // get id
            const id = Guid.from(entry).toString();
            // assign extra properties
            Object.assign(entry, {
                id: id,
                content: JSON.stringify(value), // serialize value
                createdAt: new Date(),
                modifiedAt: new Date(),
                duration: absoluteExpiration,
                expiredAt: absoluteExpiration ? new Date(Date.now() + ((absoluteExpiration || 0) * 1000)) : null,
                doomed: false
            });
            let [existing] = await context.db.executeAsync(
                new QueryExpression().select(({id, doomed, expiredAt}) => {
                    return {
                        id,
                        doomed,
                        expiredAt
                    }
                }).from(CacheEntry).where((x, id) => {
                    return x.id === id;
                }, id)
            );
            const expired = (existing && existing.doomed) || (existing && existing.expiredAt && existing.expiredAt < new Date());
            if (expired) {
                // remove doomed entry
                await context.db.executeAsync(
                    new QueryExpression().delete(CacheEntry).where((x, id) => {
                        return x.id === id;
                    }, id)
                );
                existing = null;
            }
            if (existing == null) {    
                // insert or update cache entry
                await context.db.executeAsync(
                    new QueryExpression().insert(entry).into(CacheEntry)
                );
            }
        } finally {
            await context.finalizeAsync();
        }
    }

    /**
     * Removes a key from cache
     * @param {string|import('@themost/cache').CompositeCacheKey} key 
     */
    async remove(key) {
        const context = new LocalCacheContext(this);
        const {source: CacheEntry} = CacheEntrySchema;
        try {
            await this.tryInitializeAsync(context);
            // remove using an ad-hoc query to support wildcard characters
            const searchPath = key.replace(/\*/g, '%');
            await context.db.executeAsync(
                new QueryExpression().delete(CacheEntry).where((x, search) => {
                    return x.path.includes(search) === true && x.location === 'server';
                }, searchPath)
            );
        } finally {
            await context.finalizeAsync();
        }
    }

    async clear() {
        const context = new LocalCacheContext(this);
        const {source: CacheEntry} = CacheEntrySchema;
        try {
            await this.tryInitializeAsync(context);
            await context.db.executeAsync(
                new QueryExpression().delete(CacheEntry).where((x) => {
                    return x.id != null;
                })
            );
        } finally {
            await context.finalizeAsync();
        }
    }

    finalize(callback) {
        if (typeof callback !== 'function') {
            return Promise.resolve();
        }
        // do nothing
        return callback();
    }

    async finalizeAsync() {
        // do nothing
        void new Promise((resolve) => {
            return this.finalize(resolve);
        });
    }

}

export { 
    LocalCacheContext,
    LocalCacheStrategy
};