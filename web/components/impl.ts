import { Encoder } from '@msgpack/msgpack';
import { usbDiag } from './usbLogger';

export enum UsbError {
  NotFound = 'NotFound',
  Security = 'Security',
  Network = 'Network',
  Abort = 'Abort',
  InvalidState = 'InvalidState',
  InvalidAccess = 'InvalidAccess',
  Unknown = 'Unknown',
}

const exceptionMap: Record<string, string> = globalThis.DOMException
  ? {
      NotFoundError: UsbError.NotFound,
      SecurityError: UsbError.Security,
      NetworkError: UsbError.Network,
      AbortError: UsbError.Abort,
      InvalidStateError: UsbError.InvalidState,
      InvalidAccessError: UsbError.InvalidAccess,
    }
  : {};

export type Cmd =
  | ({ usbCmd: 'bulkTransferOut' } & BulkTransferOut)
  | ({ usbCmd: 'bulkTransferIn' } & BulkTransferIn)
  | ({ usbCmd: 'selectConfiguration' } & SelectConfiguration)
  | ({ usbCmd: 'claimInterface' } & ClaimInterface)
  | ({ usbCmd: 'releaseInterface' } & ReleaseInterface)
  | ({ usbCmd: 'resetDevice' } & ResetDevice)
  | ({ usbCmd: 'activeConfigDescriptor' } & ActiveConfigDescriptor);

export type NullReply = { Ok: null } | { Err: UsbError };

export type BulkTransferOut = {
  device: number;
  endpoint: number;
  data: Uint8Array;
};

export type BulkTransferOutReply = { Ok: number } | { Err: UsbError };

export type BulkTransferIn = {
  device: number;
  endpoint: number;
  length: number;
};

export type Data = Uint8Array;

export type BulkTransferInReply = { Ok: Data } | { Err: UsbError };

export type SelectConfiguration = { device: number; config: number };

export type ClaimInterface = { device: number; number: number };

export type ReleaseInterface = { device: number; number: number };

export type ResetDevice = { device: number };

export type ActiveConfigDescriptor = { device: number };

export type USBEndpoint = { address: number; packetSize: number };

export type USBAlternateInterface = {
  alternateSetting: number;
  interfaceClass: number;
  interfaceSubclass: number;
  interfaceProtocol: number;
  endpoints: USBEndpoint[];
};

export type USBConfiguration = {
  configurationValue: number;
  interfaces: USBAlternateInterface[][];
};

export type ActiveConfigDescriptorReply =
  | { Ok: USBConfiguration }
  | { Err: UsbError };

const encoder = new Encoder();

let count = 0;
export default class UsbCompat {
  devices: Record<number, USBDevice> = {};
  arr: SharedArrayBuffer;
  lastError?: DOMException;

  constructor(arr: SharedArrayBuffer) {
    this.arr = arr;
  }

  addDevice(dev: USBDevice) {
    const i = count++;
    this.devices[i] = dev;
    return i;
  }

  private async _processCmd(cmd: Cmd) {
    try {
      if (cmd.usbCmd === 'bulkTransferOut') {
        const res = await this.devices[cmd.device].transferOut(
          cmd.endpoint & ~0x80,
          cmd.data
        );
        if (res.status !== 'ok') {
          usbDiag.log('bulkTransferOut', { endpoint: cmd.endpoint, status: res.status }, 'ERROR');
        }
        const reply: BulkTransferOutReply = { Ok: res.bytesWritten };
        return reply;
      } else if (cmd.usbCmd === 'bulkTransferIn') {
        const res = await this.devices[cmd.device].transferIn(
          cmd.endpoint & ~0x80,
          cmd.length
        );
        let bytes: Uint8Array;
        if (res.data && res.data.byteLength > 0) {
          bytes = new Uint8Array(
            res.data.buffer,
            res.data.byteOffset,
            res.data.byteLength
          );
        } else {
          bytes = new Uint8Array(0);
        }

        // TI-Nspire CX II (OS 6.0.3+):
        // Handheld transmits 64-byte NNSE packets with 1 trailing padding byte (65 bytes total).
        // Trim bytes to completeLength so checksum equals 0xFFFF.
        if (
          bytes.length >= 12 &&
          ((bytes[1] & ~0x80) >= 0x01 && (bytes[1] & ~0x80) <= 0x04) &&
          (bytes[3] === 0xFE || bytes[3] === 0x01)
        ) {
          const completeLength = (bytes[6] << 8) | bytes[7];
          if (completeLength >= 12 && completeLength < bytes.length) {
            bytes = bytes.subarray(0, completeLength);
          }
        }

        if (res.status !== 'ok') {
          usbDiag.log('bulkTransferIn', { endpoint: cmd.endpoint, status: res.status }, 'ERROR');
        }
        const reply: BulkTransferInReply = {
          Ok: bytes,
        };
        return reply;
      } else if (cmd.usbCmd === 'selectConfiguration') {
        usbDiag.log('selectConfiguration', { config: cmd.config }, 'INFO');
        await this.devices[cmd.device].selectConfiguration(cmd.config);
        usbDiag.log('selectConfiguration', { config: cmd.config }, 'OK');
      } else if (cmd.usbCmd === 'claimInterface') {
        usbDiag.log('claimInterface', { interfaceNumber: cmd.number }, 'INFO');
        await this.devices[cmd.device].claimInterface(cmd.number);
        usbDiag.log('claimInterface', { interfaceNumber: cmd.number }, 'OK');
      } else if (cmd.usbCmd === 'releaseInterface') {
        usbDiag.log('releaseInterface', { interfaceNumber: cmd.number }, 'INFO');
        await this.devices[cmd.device].releaseInterface(cmd.number);
        usbDiag.log('releaseInterface', { interfaceNumber: cmd.number }, 'OK');
      } else if (cmd.usbCmd === 'resetDevice') {
        usbDiag.log('resetDevice', {}, 'INFO');
        try {
          await this.devices[cmd.device].reset();
          usbDiag.log('resetDevice', {}, 'OK');
        } catch (e) {
          usbDiag.log('resetDevice (ignorado en Windows)', {}, 'OK', e);
          console.warn('Ignoring resetDevice on Windows Chromium:', e);
        }
      } else if (cmd.usbCmd === 'activeConfigDescriptor') {
        usbDiag.log('activeConfigDescriptor', {}, 'INFO');
        const configuration = this.devices[cmd.device].configuration!;
        const reply: ActiveConfigDescriptorReply = {
          Ok: {
            configurationValue: configuration.configurationValue,
            interfaces: configuration.interfaces.map(({ alternates }) => {
              return alternates.map((alternate) => ({
                alternateSetting: alternate.alternateSetting,
                interfaceClass: alternate.interfaceClass,
                interfaceSubclass: alternate.interfaceSubclass,
                interfaceProtocol: alternate.interfaceProtocol,
                endpoints: alternate.endpoints.map((endpoint) => ({
                  address:
                    endpoint.endpointNumber |
                    (endpoint.direction === 'in' ? 0x80 : 0),
                  packetSize: endpoint.packetSize,
                })),
              }));
            }),
          },
        };
        usbDiag.log('activeConfigDescriptor', { configValue: configuration?.configurationValue }, 'OK');
        return reply;
      }
      const reply: NullReply = { Ok: null };
      return reply;
    } catch (e: any) {
      console.error(e);
      usbDiag.log(cmd.usbCmd, cmd, 'ERROR', e);
      this.lastError = e;
      return {
        Err: { [exceptionMap[e.name as string] || UsbError.Unknown]: null },
      };
    }
  }

  async processCmd(cmd: Cmd) {
    const msg = await this._processCmd(cmd);
    const encoded = encoder.encode(msg);

    if (encoded.length > this.arr.length - 4) {
      throw new Error('too long');
    }
    new Uint8Array(this.arr).set(encoded, 4);
    const notify = new Int32Array(this.arr);
    Atomics.store(notify, 0, encoded.length);
    Atomics.notify(notify, 0, Infinity);
  }
}
