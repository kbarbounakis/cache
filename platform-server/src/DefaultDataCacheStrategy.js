const NodeCache = require('node-cache');
import { DataCacheStrategy } from '@themost/cache';

const CACHE_ABSOLUTE_EXPIRATION = 1200;

class DefaultDataCacheStrategy extends DataCacheStrategy {

    absoluteExpiration;
    constructor(configuration) {
        super(configuration);
        this.absoluteExpiration = CACHE_ABSOLUTE_EXPIRATION;
        const absoluteExpiration = configuration.getSourceAt('settings/cache/absoluteExpiration');
        if (typeof absoluteExpiration === 'number' && absoluteExpiration > 0) {
            this.absoluteExpiration = absoluteExpiration;
        }
        this.rawCache = new NodeCache({
            stdTTL: this.absoluteExpiration
        });
    }

    /**
     * Gets a cached value defined by the given key.
     * @param {string|CompositeCacheKey} key
     * @returns {Promise<any>}
     */
    get(key) {
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                void self.rawCache.get(key, function(err, res) {
                    if (err) {
                        return reject(err);
                    }
                    if (Object.prototype.hasOwnProperty.call(res, key)) {
                        return resolve(res[key]);
                    }
                    return resolve();
                });
            } catch (err) {
                return reject(err);
            }
        });
    }
    
    /**
     * Sets a key value pair in cache.
     * @abstract
     * @param {string|CompositeCacheKey} key - A string that represents the key of the cached value
     * @param {*} value - The value to be cached
     * @param {number=} absoluteExpiration - An absolute expiration time in seconds. This parameter is optional.
     * @returns {Promise<void>}
     */
    async add(key, value, absoluteExpiration) {
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                void self.rawCache.set(key, value, absoluteExpiration, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve();
                });
            } catch (err) {
                return reject(err);
            }
        });
    }
    /**
     * Removes a cached value.
     * @abstract
     * @param {string|CompositeCacheKey} key - A string that represents the key of the cached value to be removed
     * @returns {Promise<any>}
     */
    async remove(key) {
        // noinspection JSCheckFunctionSignatures
        if (/\*/.test(key)) {
            const reKey = new RegExp(key.replace(/\*/g, '.*'));
            const keys = this.rawCache.keys();
            const delKeys = keys.filter((k) => {
                return reKey.test(k);
            });
            const delCount = this.rawCache.del(delKeys);
            return !!delCount;
        }
        const count = this.rawCache.del(key);
        return !!count;
    }

    async has(key) {
        // noinspection JSCheckFunctionSignatures
        const exists = await this.rawCache.get(key);
        if (typeof exists === 'undefined') {
            return;
        }
        return {
            path: key
        }
    }

    /**
     * Flushes cached data.
     * @abstract
     * @returns {Promise<void>}
     */
    async clear() {
        this.rawCache.flushAll();
    }

    /**
     * @function
     * @name NodeCache#_killCheckPeriod
     */

    /**
     * @returns {Promise<void>}
     */
    finalize() {
        var self = this;
        return self.clear().then(function() {
            if (self.rawCache.checkTimeout != null) {
                clearTimeout(self.rawCache.checkTimeout);
                return Promise.resolve();
            }
        });
    }

}

export {
    DefaultDataCacheStrategy
}
