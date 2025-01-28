import { DataCacheReaderWriter } from '@themost/cache';
import {Args, Guid} from '@themost/common';
import path from 'path';
import mkdirp from 'mkdirp';
import {readFile, writeFile, unlink, stat} from 'fs';
import {promisify} from 'util';

const readFileAsync = promisify(readFile);
const statAsync = promisify(stat);
const writeFileAsync = promisify(writeFile);
const unlinkAsync = promisify(unlink);

class DiskCacheReader extends DataCacheReaderWriter {

    static get DefaultRootDir() {
        return '.cache/indexedCache';
    }

    constructor(configuration) {
        super(configuration);
        let rootDir = this.getConfiguration().getSourceAt('settings/cache/rootDir');
        if (rootDir == null) {
            this.getConfiguration().setSourceAt('settings/cache/rootDir', DiskCacheReader.DefaultRootDir);
        }
    }

    /**
     * Reads file from disk cache
     * @param {import('@themost/cache').CacheItem} entry 
     * @returns Promise<Buffer>
     */
     async read(entry) {
        Args.check(Guid.isGuid(entry.id), 'Entry identifier must be a valid uuid at this context');
        const fileName = entry.id; // e.g. 929a9730-478e-11ed-b878-0242ac120002
        const fileDir = fileName.substring(0, 1); // e.g. 9
        let rootDir = this.getConfiguration().getSourceAt('settings/cache/rootDir');
        Args.check(rootDir != null, new Error('Caching root directory cannot be empty'));
        const finalRootDir = path.resolve(process.cwd(), rootDir);
        // get file path
        const filePath = path.resolve(finalRootDir, fileDir, fileName);
        /**
         * @type {import('fs').Stats}
         */
        const stats = await statAsync(path.resolve(finalRootDir, fileDir, fileName));
        // validate
        Args.check(stats.isFile(), 'Entry cannot be found or is inaccessible');
        // and return
        return await readFileAsync(filePath);
    }

    /**
     * @param {import('@themost/cache').CacheItem|void} entry
     */
    async unlink(entry) {
        Args.check(Guid.isGuid(entry.id), 'Entry identifier must be a valid uuid at this context');
        const fileName = entry.id; // e.g. 929a9730-478e-11ed-b878-0242ac120002
        const fileDir = fileName.substring(0, 1); // e.g. 9
        let rootDir = this.getConfiguration().getSourceAt('settings/cache/rootDir');
        Args.check(rootDir != null, new Error('Caching root directory cannot be empty'));
        const finalRootDir = path.resolve(process.cwd(), rootDir);
        // get file path
        const filePath = path.resolve(finalRootDir, fileDir, fileName);
        try {
            /**
             * @type {import('fs').Stats}
             */
            const stats = await statAsync(path.resolve(finalRootDir, fileDir, fileName));
            // validate
            Args.check(stats.isFile(), 'Entry cannot be found or is inaccessible');
            // and return
            await unlinkAsync(filePath);
        } catch (err) {
            if (err.code === 'ENOENT') {
                return void 0;
            }
            throw err;
        }
    }

    /**
     * @param {import('@themost/cache').CacheItem} entry 
     * @param {*} content 
     * @returns Promise<void>
     */
    async write(entry, content) {
        Args.check(Guid.isGuid(entry.id), 'Entry identifier must be a valid uuid at this context');
        const fileName = entry.id; // e.g. 929a9730-478e-11ed-b878-0242ac120002
        const fileDir = fileName.substring(0, 1); // e.g. 9
        let rootDir = this.getConfiguration().getSourceAt('settings/cache/rootDir');
        Args.check(rootDir != null, new Error('Caching root directory cannot be empty'));
        const finalFileDir = path.resolve(process.cwd(), rootDir, fileDir);
        // ensure that directory exists
        await mkdirp(finalFileDir);
        // get file path
        const filePath = path.resolve(finalFileDir, fileName);
        // and write file
        // noinspection JSCheckFunctionSignatures
        if (content instanceof Buffer) {
            await writeFileAsync(filePath, content, 'binary');
        } else {
            await writeFileAsync(filePath, Buffer.from(JSON.stringify(content)), 'binary');
        }
    }


}

export {
    DiskCacheReader
}
