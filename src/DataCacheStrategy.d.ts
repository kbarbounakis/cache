import {ConfigurationBase, ConfigurationStrategy} from "@themost/common";

export declare type GetItemFunction = () => Promise<any>;

export declare interface CompositeCacheKey {
    path?: string,
    location?: 'server' | 'client' | 'serverAndClient',
    contentEncoding?: string,
    headers?: any,
    params?: any,
    customParams?: any,
}

export declare interface DataCacheStrategyBase {
    add(key: string | CompositeCacheKey, value: any, absoluteExpiration?: number): Promise<any>;
    remove(key: string | CompositeCacheKey): Promise<any>;
    clear(): Promise<any>;
    get(key: string | CompositeCacheKey): Promise<any>;
    getOrDefault(key: string | CompositeCacheKey, getFunc: GetItemFunction, absoluteExpiration?: number): Promise<any>;
}

export declare interface DataCacheFinalize extends DataCacheStrategyBase {
    finalize(): Promise<void>;
}

export declare abstract class DataCacheStrategy extends ConfigurationStrategy implements DataCacheStrategyBase {
    protected constructor(configuration: ConfigurationBase);
    abstract add(key: string | CompositeCacheKey, value: any, absoluteExpiration?: number): Promise<any>;
    abstract remove(key: string | CompositeCacheKey): Promise<any>;
    abstract clear(): Promise<any>;
    abstract get(key: string | CompositeCacheKey): Promise<any>;
    abstract has(key: string | CompositeCacheKey): Promise<CompositeCacheKey>;
    getOrDefault(key: string | CompositeCacheKey, getFunc: GetItemFunction, absoluteExpiration?: number): Promise<any>;
    generateIdentifier(key: string|CompositeCacheKey): string;
    generateEntityTag(entry: CacheItem): string;

}

export declare interface CacheItem {
    id?: string;
    path?: string;
    location?: 'any' | 'none' | 'server' | 'client' | 'serverAndClient';
    contentEncoding?: string;
    headers?: string;
    params?: string;
    customParams?: string;
    duration?: number;
    doomed?: boolean;
    createdAt?: Date;
    expiredAt?: Date;
    modifiedAt?: Date;
    entityTag?: Date;
}

