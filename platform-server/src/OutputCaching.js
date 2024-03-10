import { ConfigurationBase, TraceUtils } from '@themost/common';
import { DataCacheStrategy } from '@themost/cache';
import { MD5 } from 'crypto-js';
import { IndexedCacheStrategy } from './IndexedCacheStrategy';
import { CacheEntry } from './models';
import url from 'url';

function sortAscending(a, b) {
    if (a < b) {
        return 1;
    }
    if (a > b) {
        return -1;
    }
    return 0;
}

class OutputCachingMapper {
    /**
     * @type {import('./OutputCaching').PreOutputCacheConfiguration}
     */
    options;
    constructor(options) {
        this.options = options;
    }
    /**
     * 
     * @param {import('@types/express').Request} req
     */
    async map(req) {
        /**
         * @type {import('./OutputCaching').PreOutputCacheConfiguration}
         */
        const options = this.options;
        const duration = this.options.duration;
        const location = this.options.location;
        const originalUrl = url.parse(req.originalUrl.toLowerCase());
        const path = originalUrl.pathname.replace(/\/$/, ''); // remove trailing slash
        // get headers
        let headers = null;
        if (options.varyByHeader && options.varyByHeader.length) {
            headers = options.varyByHeader.sort((a, b) => {
                return sortAscending(a, b);
            }).map((header) => {
                if (Object.prototype.hasOwnProperty.call(req.headers, header)) {
                    return `${header}=${encodeURIComponent(req.headers[header])}`;
                }
                return `${header}=`;
            }).join('&');
        }
        // get params
        let params = null;
        if (options.varyByParam && options.varyByParam.length) {
            /**
             * @type {Array<string>}
             */
            let varyByParam;
            if (options.varyByParam.length === 1 && options.varyByParam[0] === '*') {
                // get any query param
                varyByParam = Object.keys(req.query);
            } else {
                varyByParam = options.varyByParam;
            }
            if (varyByParam.length > 0) {
                params = varyByParam.sort((a, b) => {
                    return sortAscending(a, b);
                }).map((queryParam) => {
                    if (Object.prototype.hasOwnProperty.call(req.query, queryParam)) {
                        return `${queryParam}=${encodeURIComponent(req.query[queryParam])}`;
                    }
                    return `${queryParam}=`;
                }).join('&');
            }
        }
        let customParams;
        if (options.varyByCallback) {
            customParams = await options.varyByCallback(req);
        }
        const result = {
            path,
            location,
            duration,
            headers,
            params,
            customParams
        };
        if (options.varyByContentEncoding) {
            Object.assign(result, {
                contentEncoding: options.varyByContentEncoding
            })
        }
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch && (location === 'client' || location === 'any' || location === 'serverAndClient')) {
            Object.assign(result, {
                entityTag: ifNoneMatch
            })
        }
        return result;
    }

}

class OutputCaching {
    /**
     * @param {import('./OutputCaching').OutputCacheConfiguration|import('@themost/cache').DataCacheStrategy} configurationOrService
     * @returns {import('@types/express').Handler}
     */
    static setup(configurationOrService) {
        let cacheStrategy;
        if (configurationOrService instanceof DataCacheStrategy) {
            cacheStrategy = configurationOrService;
        } else {
            const configuration = new ConfigurationBase();
            if (configurationOrService) {
                configuration.setSourceAt('settings/cache', configurationOrService);
            }
            cacheStrategy = new IndexedCacheStrategy(configuration);
        }
        return function (req, res, next) {
            Object.defineProperty(req, 'cache', {
                configurable: true,
                enumerable: false,
                get: () => cacheStrategy
            });
            return next();
        }
    }

    /**
     * @returns {import('@types/express').Handler}
     */
    static noCache() {
        return (req, res, next) => {
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', 0);
            return next();
        }
    }

    /**
     * @returns {import('@types/express').Handler}
     */
    static client() {
        return function (req, res, next) {
            if (req.outputCache == null) {
                return next();
            }
            // set entry attributes in order to perform query for finding entry in cache
            let item = {
                path: req.outputCache.path,
                location: req.outputCache.location,
                params: req.outputCache.params,
                headers: req.outputCache.headers,
                customParams: req.outputCache.customParams,
                doomed: false
            }
            // get cache location
            const location = req.outputCache.location;
            // validate that client is going to cache response
            if ((location === 'client' || location === 'any' || location === 'serverAndClient') === false) {
                return next();
            } 
            // try to find cache entry
            // todo: is there any option to omit this operation?
            return req.cache.has(item).then((entry) => {
                res.set('Cache-Control', 'private');
                if (location === 'any') {
                    // if location is any set cache control to public
                    res.set('Cache-Control', 'public');
                }
                // set entity tag (a temporary etag)
                res.set('ETag', entry ? entry.entityTag : req.outputCache.entityTag);
                // set date (a temporary date)
                res.set('Date', new Date().toUTCString());
                // if the given entityTag is the same with the cache entry
                if (entry != null) {
                    if  (req.outputCache.entityTag === entry.entityTag) {
                        // set not modified
                        res.status(304);
                    }
                    // assign cache entry
                    Object.assign(req.outputCache, entry);
                }
                if (location === 'any' || location === 'client') {
                    // if status is 304
                    if (res.statusCode === 304) {
                        return res.send();
                    }
                    // add cache entry
                    return req.cache.add(req.outputCache, null).then(() => {
                        // set entityTag again
                        res.set('ETag',  req.outputCache.entityTag);
                        res.set('Date', req.outputCache.createdAt.toUTCString());
                        return next();
                    }).catch((err) => {
                        return next(err);
                    });
                }
                // continue because response should be cached at server first
                return next();
            }).catch((err) => {
                return next(err);
            });
        }
    }

    /**
     * @returns {import('@types/express').Handler}
     */
     static server() {
        return function (req, res, next) {
            if (req.outputCache == null) {
                return OutputCaching.noCache()(req, res, (err) => {
                    return next(err);
                });
            }
            return req.cache.get(req.outputCache).then((buffer) => {
                /**
                 * @{import('@types/express').Handler}
                 */
                let cacheHandler;
                // location server, none
                if (req.outputCache.location === 'server' || req.outputCache.location === 'none') {
                    cacheHandler = OutputCaching.noCache();
                } else {
                    // location serverAndClient, client, any
                    cacheHandler = OutputCaching.client();
                }
                if (typeof cacheHandler !== 'function') {
                    return next(new Error('Invalid caching mechanism location'));
                }
                return cacheHandler(req, res, (err) => {
                    if (err) {
                        return next(err);
                    }
                    if (req.outputCache.location === 'serverAndClient') {
                        if (req.outputCache.entityTag == null) {
                            Object.assign(req.outputCache, {
                                createdAt: new Date(),
                                modifiedAt: new Date()
                            });
                            req.outputCache.entityTag = CacheEntry.inferEntityTag(req.outputCache);
                        }    
                        // send not modified
                        res.set('ETag',  req.outputCache.entityTag);
                    }
                    if (res.statusCode === 304) {
                        return res.send();
                    }
                    if (buffer != null) {
                        return res.send(buffer);
                    }
                    const superWrite = res.write;
                    const superEnd = res.end;
                    let chunks = [];
                    // override write
                    res.write = (...args) => {
                        chunks.push(Buffer.from(args[0]));
                        superWrite.apply(res, args);
                    };
                    // override end
                    res.end = (...args) => {
                        if (args[0]) {
                            chunks.push(Buffer.from(args[0]));
                        }
                        if (res.statusCode === 200 || res.statusCode === 204) {
                            req.outputCache.contentEncoding = res.getHeader('Content-Type');
                            return req.cache.add(req.outputCache, Buffer.concat(chunks)).then(() => {
                                return superEnd.apply(res, args);
                            }).catch((err) => {
                                TraceUtils.error('An error occurred while adding cache entry');
                                TraceUtils.error(err);
                                return superEnd.apply(res, args);
                            }).finally(() => {
                                chunks = [];
                            });
                        }
                        return superEnd.apply(res, args);
                    };
                    return next();
                });
            }).catch((err) => {
                return next(err);
            })
            
        }
    }

    /**
     * @param {import('./OutputCaching').PreOutputCacheConfiguration=} options
     * @returns {import('@types/express').Handler}
     */
    static cache(options) {
        // get caching options or defaults
        const cachingOptions = options || {
            location: 'server',
            duration: 20 * 60, // 20 minutes
            varyByHeader: [
                'accept',
                'accept-encoding',
                'accept-language',
                'accept-profile'
            ],
            varyByParam: [
                '*' // use any query param
            ],
            varyByCallback: async (req) => {
                if (req.headers.authorization) {
                    return `context=${MD5(req.headers.authorization).toString()}`
                }
                return null;
            } 
        }
        return function (req, res, next) {
            if ((req.method === 'GET' || req.method === 'HEAD') === false) {
                return next();
            }
            if (cachingOptions.duration <= 0) {
                // do nothing (no-cache)
                return next();
            }
            if (req.get('Cache-Control') === 'no-cache') {
                return next();
            }
            (async () => {
                return await new OutputCachingMapper(cachingOptions).map(req);
            })().then((value) => {
                if (value == null) {
                    return OutputCaching.noCache()(req, res, next);
                }
                // if locations is none
                if (value.location === 'none') {
                    // do not use caching at all
                    // The no-store response directive indicates that any caches of any kind (private or shared)
                    // should not store this response.
                    return OutputCaching.noCache()(req, res, next);
                }
                // reset caching location to protect request with authorization
                if (req.headers.authorization) {
                    // if location is any
                    if (value.location === 'any') {
                        // reset to serverAndClient to protect resource
                        // this will generate a Cache-Control header with private directive
                        // The private response directive indicates that the response can be stored only
                        // in a private cache
                        value.location = 'serverAndClient';
                    }
                }
                // set output cache attributes
                req.outputCache = value;
                
                // use client-side caching
                if (cachingOptions.location === 'client' || cachingOptions.location === 'any') {
                    return OutputCaching.client()(req, res, (err) => {
                        return next(err);
                    });
                    // use server-side caching
                } else if (cachingOptions.location === 'server' || cachingOptions.location === 'serverAndClient') {
                    return OutputCaching.server()(req, res, next);
                }
                return next();
            }).catch((err) => {
                return next(err);
            });
        }
    }

    /**
     * @param {Map|Array} paths
     * @returns {import('@types/express').Handler}
     */
    cacheMany(paths) {
        /**
         * @type {Map<string, import('./OutputCaching').PreOutputCacheConfiguration>|Map}
         */
        const cachePaths = Array.isArray(paths) ? new Map(paths) : paths;
        return (req, res, next) => {
            return cachePaths.has(req.path) ? OutputCaching.cache(cachePaths.get(req.path))(req, res, next) : next();
        }
    }



}

export {
    OutputCaching
}
