import {ConfigurationStrategy, AbstractMethodError, AbstractClassError} from '@themost/common';
import { Guid } from '@themost/common';
import MD5 from 'crypto-js/md5';
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
 * @interface CompositeCacheKey
 */

/**
 * Composite key properties
 */
const CompositeKeyProperties = [
    'path',
    'location',
    'contentEncoding',
    'headers',
    'params',
    'customParams'
]

class DataCacheStrategy extends ConfigurationStrategy {
    constructor(configuration) {
        super(configuration);
        if (this.constructor === DataCacheStrategy.prototype.constructor) {
            throw new AbstractClassError();
        }
    }
    /* istanbul ignore next */
    /**
     * Sets a key value pair in cache.
     * @abstract
     * @param {string|CompositeCacheKey} key - A string that represents the key of the cached value
     * @param {*} value - The value to be cached
     * @param {number=} absoluteExpiration - An absolute expiration time in seconds. This parameter is optional.
     * @returns {Promise<void>}
     */
    // eslint-disable-next-line no-unused-vars
    async add(key, value, absoluteExpiration) {
        throw new AbstractMethodError();
    }

    /* istanbul ignore next */
    /**
     * Removes a cached value.
     * @abstract
     * @param {string|CompositeCacheKey} key - A string that represents the key of the cached value to be removed
     * @returns {Promise<any>}
     */
    // eslint-disable-next-line no-unused-vars
    async remove(key) {
        throw new AbstractMethodError();
    }

    /* istanbul ignore next */
    /**
     * Flushes cached data.
     * @abstract
     * @returns {Promise<void>}
     */
    async clear() {
        throw new AbstractMethodError();
    }

    /* istanbul ignore next */
    // noinspection JSUnusedLocalSymbols
    /**
     * 
     * Gets a cached value defined by the given key.
     * @param {string|CompositeCacheKey} key
     * @returns {Promise<any>}
     */
    // eslint-disable-next-line no-unused-vars
    async get(key) {
        throw new AbstractMethodError();
    }

    // noinspection JSUnusedLocalSymbols
    /**
     * 
     * Gets a cached value defined by the given key.
     * @param {string|CompositeCacheKey} key
     * @returns {Promise<CompositeCacheKey>}
     */
    // eslint-disable-next-line no-unused-vars
    async has(key) {
        throw new AbstractMethodError();
    }

    /**
     * Returns an item which is going to be added to cache
     * @function
     * @name GetItemFunction
     * @returns {Promise<any>}
    */

    /**
     * Gets a key value pair from cache or invokes the given function and returns the value before caching it.
     * @param {string|import('./DataCacheStrategy').CompositeCacheKey} key 
     * @param {function():Promise<*>} getFunc The function to be invoked if the key is not found in cache
     * @param {number=} absoluteExpiration The expiration time in seconds
     * @returns 
     */
    async getOrDefault(keyOrCompositeKey, getFunc, absoluteExpiration) {
        let value = await this.get(keyOrCompositeKey);
        if (typeof value === 'undefined') {
            value = await getFunc();
            if (typeof value === 'undefined') {
                // set value to null
                value = null;
            }
            // add value to cache
            await this.add(keyOrCompositeKey, value, absoluteExpiration);
        }
        // return value
        return value;
    }

    /**
     * 
     * @param {string|import('./DataCacheStrategy').CompositeCacheKey} entryKeyOrCompositeKey 
     * @returns {string}
     */
    generateIdentifier(entryKeyOrCompositeKey) {
        let entry;
        if (typeof entryKeyOrCompositeKey === 'string') {
            entry = {
                path: entryKeyOrCompositeKey,
                location: 'server',
                contentEncoding: 'application/json'
            }
        } else {
            entry = Object.assign({
                location: 'server',
                contentEncoding: 'application/json'
            }, entryKeyOrCompositeKey);
        }
        const key = CompositeKeyProperties.reduce((result, field) => {
            if (Object.prototype.hasOwnProperty.call(entry, field)) {
                result[field] = entry[field];
            } else {
                result[field] = null;
            }
            return result;
        }, {});
        return Guid.from(key).toString();
    }

    /**
     * 
     * @param {import('./DataCacheStrategy').CacheItem} entry
     * @returns {string}
     */
    generateEntityTag(entry) {
        return `W/"${MD5(JSON.stringify({
                    path: entry.path,
                    location: entry.location,
                    contentEncoding: entry.contentEncoding,
                    headers: entry.headers,
                    params: entry.params,
                    customParams: entry.customParams,
                    duration: entry.duration,
                    doomed: entry.doomed
                })).toString()}"`
    }

}

export {
    DataCacheStrategy
}
