import { DiskCacheReader } from './DiskCacheReader';
import { LocalCacheStrategy } from './LocalCacheStrategy';
import path from 'path';

class IndexedCacheStrategy extends LocalCacheStrategy {
    /**
     * @param {import('@themost/common').ConfigurationBase} config 
     */
    constructor(config) {
        super(config);
        this.reader = new DiskCacheReader(config);
        this.connectOptions = {
            database: path.resolve(process.cwd(), '.cache', 'indexedCache.db')
        }
    }
}

export {
    IndexedCacheStrategy
}
