import { DataCacheStrategy } from '@themost/cache';
import { Handler, Request, Response } from 'express';

export declare interface PreOutputCacheConfiguration {
    duration?: number;
    immutable?: boolean;
    location?: 'any' | 'none' | 'server' | 'client' | 'serverAndClient';
    varyByContentEncoding?: string;
    varyByHeader?: string[];
    varyByParam?: string[];
    varyByCallback?: (req: Request, res: Response) => Promise<string>;
}

export declare interface OutputCacheConfiguration {
    rootDir?: string,
    absoluteExpiration?: number,
    checkingPeriod?: number
}

export declare class OutputCaching {
    readonly cache: DataCacheStrategy;
    static setup(config: OutputCacheConfiguration): Handler;
    static setup(service: DataCacheStrategy): Handler;
    static cache(options?: any): Handler;
    static cacheMany(paths: [string, PreOutputCacheConfiguration][] ): Handler;
    static cacheMany(paths: Map<string, PreOutputCacheConfiguration> ): Handler;
} 

declare global {
    namespace Express {
        interface Request {
            cache: DataCacheStrategy;
            outputCache: {
                path?: string;
                location?: 'any' | 'none' | 'server' | 'client' | 'serverAndClient';
                duration?: number;
                contentEncoding?: string;
                headers?: string;
                params?: string;
                customParams?: string;
                entityTag?: string;
            }
        }
    }
}
