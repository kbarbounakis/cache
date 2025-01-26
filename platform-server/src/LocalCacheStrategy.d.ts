import { DataCacheStrategy, CompositeCacheKey } from '@themost/cache';
import { DataAdapterBase, DataAdapterBaseHelper, DataContextBase } from '@themost/common';

export declare class LocalCacheStrategy extends DataCacheStrategy {
    constructor(configuration: ConfigurationBase);
    add(key: string | CompositeCacheKey, value: any, absoluteExpiration?: number): Promise<any>;
    remove(key: string | CompositeCacheKey): Promise<any>;
    clear(): Promise<any>;
    get(key: string | CompositeCacheKey): Promise<any>;
    has(key: string | CompositeCacheKey): Promise<CompositeCacheKey>;
    getOrDefault(key: string | CompositeCacheKey, getFunc: GetItemFunction, absoluteExpiration?: number): Promise<any>;
    finalize(): Promise<void>;
    finalizeAsync(): Promise<void>;
}

export declare interface LocalCacheAdapter extends DataAdapterBase, DataAdapterBaseHelper {
}

export declare class LocalCacheContext implements DataContextBase {
    db?: LocalCacheAdapter;
    constructor(container: LocalCacheStrategy);
    model(name:any): DataModelBase;
    getConfiguration(): ConfigurationBase;
    finalize(callback?:(err?:Error) => void): void;
    finalizeAsync(): Promise<void>;
    executeInTransactionAsync(func: () => Promise<void>): Promise<void>;
}