declare module 'mmdb-reader' {
  import {Response} from "maxmind/lib/reader/response"
  import {PathLike} from "fs"

  export interface Record<T> {
    value: T
    ptr: number
  }

  export class Reader {
    public constructor(buf: string | Buffer, filePath?: string)

    public open(path: PathLike, cb: (err: Error, reader?: Reader) => void): void
    public reload(file?: PathLike | undefined, cb?: (err: Error, reader?: Reader) => void): void
    public reloadSync(file?: PathLike | undefined): void
    public setup(): void
    public findMetaPosition(): number
    public readData(ptr: number): Record<any>
    public cachedRead(ptr: number): Record<any>
    public readPointer(ptr: number, size: number): Record<any>
    public readString(ptr: number, size: number): Record<string>
    public readDouble(ptr: number, size: number): Record<number>
    public readBytes(ptr: number, size: number): Record<Buffer>
    public readUInt16(ptr: number, size: number): Record<number>
    public readUInt32(ptr: number, size: number): Record<number>
    public readMap(ptr: number, mapLength: number): Record<any>
    public readInt32(ptr: number, size: number): Record<number>
    public readUInt64(ptr: number, size: number): Record<number>
    public readUInt128(ptr: number, size: number): Record<number>
    public readArray(ptr: number, size: number): Record<any[]>
    public readBoolean(ptr: number, size: number): Record<boolean>
    public readFloat(ptr: number, size: number): Record<number>
    public setRecordSize(size: number): void
    public readLeft24(idx: number): number
    public readRight24(idx: number): number
    public readLeft28(idx: number): number
    public readRight28(idx: number): number
    public readLeft32(idx: number): number
    public readRight32(idx: number): number
    public findIPv4StartPointer(): number
    public lookup(addr: string): Response

    public static open(path: PathLike, cb: (err: Error, reader?: Reader) => void): void
    public static openSync (buf: string | Buffer, filePath?: string): Reader // Same as Reader constructor
  }
}
