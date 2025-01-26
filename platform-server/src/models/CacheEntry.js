import { DataObject } from '@themost/data';
import { Args } from '@themost/common';
import { MD5 } from 'crypto-js';
import { DataCacheReaderWriter } from '@themost/cache';

class ContainerConfiguration {

}

class CacheEntry extends DataObject {
    id;
    path;
    headers;
    doomed;
    contentEncoding;
    location;
    params;
    customParams;
    duration;
    createdAt;
    expiredAt;
    modifiedAt;
    entityTag;
    /**
     * 
     * @param {CacheEntry|*} target 
     * @returns {string}
     */
    static inferEntityTag(target) {
        return `W/"${MD5(JSON.stringify({
            path: target.path,
            location: target.location,
            contentEncoding: target.contentEncoding,
            headers: target.headers,
            params: target.params,
            customParams: target.customParams,
            duration: target.duration,
            doomed: target.doomed
        })).toString()}"`
    }


    /**
     * Reads content from cache
     * @returns Promise<Buffer>
     */
    async read() {
        /**
         * @type {DataCacheReaderWriter}
         */
         const reader = this.context.getConfiguration().getStrategy(ContainerConfiguration).getStrategy(DataCacheReaderWriter);
         Args.check(reader != null, new Error('Application cache strategy does not support reading cache.'));
         return reader.read(this);
    }

    /**
     * Unlinks content from cache
     * @returns Promise<void>
     */
    async unlink() {
        /**
         * @type {DataCacheReaderWriter}
         */
         const reader = this.context.getConfiguration().getStrategy(ContainerConfiguration).getStrategy(DataCacheReaderWriter);
         Args.check(reader != null, new Error('Application cache strategy does not support writing cache.'));
         await reader.unlink(this);
    }

    /**
     * Writes content to cache
     * @param {*} content 
     * @returns Promise<void>
     */
    async write(content) {
       /**
         * @type {DataCacheReaderWriter}
         */
        const reader = this.context.getConfiguration().getStrategy(ContainerConfiguration).getStrategy(DataCacheReaderWriter);
        Args.check(reader != null, new Error('Application cache strategy does not support writing cache.'));
        await reader.write(this, content);
    }

}

export {
    CacheEntry
}
