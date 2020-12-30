import { Client } from "./client";

import { MessageType, MessageHandler, Request, DeviceConfig, ConnectionState, VariableObserver } from "./interfaces";
import { BehaviorSubject, Subject } from "rxjs";

export class Controller extends Client {
  observables: Array<VariableObserver> = [];
  devices: Subject<Array<DeviceConfig>> = new BehaviorSubject([]);

  deviceConnected: Subject<DeviceConfig> = new Subject();
  deviceDisconnected: Subject<string> = new Subject();
  logs: Subject<string> = new Subject();

  deviceList = Array<DeviceConfig>();

  connectionState: Subject<ConnectionState> = new BehaviorSubject(ConnectionState.DISCONNECTED);

  onOpen: Function;
  onClose: Function;
  onMessage: MessageHandler = null;

  pingInterval;

  constructor() {
    super();
  }

  connect(url: string, callback: Function) {
    this.ws = new WebSocket(url);

    this.ws.onclose = this.onCloseHandler.bind(this);
    this.ws.onmessage = this.onMessageHandler.bind(this);
    this.ws.onopen = this.onOpenHandler.bind(this);
    this.ws.onerror = (error) => console.log(error);
    this.serverUrl = url;
  }

  reconnect() {
    this.ws = new WebSocket(this.serverUrl);
    this.ws.onclose = this.onCloseHandler.bind(this);
    this.ws.onmessage = this.onMessageHandler.bind(this);
    this.ws.onopen = this.onOpenHandler.bind(this);
  }

  getConnectionState(): Subject<ConnectionState> {
    return this.connectionState;
  }

  private onOpenHandler() {
    if (this.onOpen !== null) {
      this.refreshDevices();
    }
    this.pingInterval = setInterval(() => {
      let isAlive = setTimeout(() => {
        console.warn("ping timout");
        this.ws.close();
        this.connectionState.next(ConnectionState.DISCONNECTED);
        clearInterval(this.pingInterval);
      }, 2000);

      this.sendRequest({ type: MessageType.Ping }, () => {
        clearTimeout(isAlive);
      });
    }, 5000);
  }

  private refreshDevices() {
    this.getDevices((devices) => {
      this.deviceList = devices;
      this.devices.next(this.deviceList);
      this.connectionState.next(ConnectionState.CONNECTED);
    });
  }

  private onCloseHandler(error) {
    clearInterval(this.pingInterval);
    if (this.onClose !== null) {
      if (error.code === 4403) {
        this.connectionState.next(ConnectionState.NOT_AUTHORIZED);
      } else {
        this.connectionState.next(ConnectionState.DISCONNECTED);
      }
    }
  }

  handleRequest(message: Request) {
    switch (message.type) {
      case MessageType.DeviceConnected:
        {
          const deviceConfig = message.args.device;
          const observables = this.observables.filter((observable) => observable.deviceUuid === deviceConfig.deviceUuid);

          if (observables.length > 0) {
            observables.map((observable) => {
              observable.observer.next(deviceConfig.vars[observable.variableUuid].value);
            });
          }
          this.deviceConnected.next(deviceConfig);
        }
        break;
      case MessageType.DeviceDisconnected:
        {
          const deviceUuid = message.args.id;
          const observables = this.observables.filter((observable) => observable.deviceUuid === deviceUuid);

          if (observables.length > 0) {
            observables.map((observable) => {
              observable.observer.next(undefined);
            });
          }

          this.deviceDisconnected.next(deviceUuid);
        }
        break;
      case MessageType.ValueUpdated:
        this.observables.forEach((observer) => {
          if (observer.deviceUuid === message.args.deviceUuid && observer.variableUuid === message.args.variableUuid) {
            observer.observer.next(message.args.value);
          }
        });
        break;

      case MessageType.DeviceListChanged:
        this.devices.next(message.args.devices);
        break;

      case MessageType.RuleLog:
        this.logs.next(message.args);
        break;
    }
  }

  getDevices(callback) {
    const request: Request = {
      type: MessageType.GetDevices,
    };
    this.sendRequest(request, callback);
  }

  getDevice(deviceUuid: string): Promise<DeviceConfig> {
    return new Promise((resolve, reject) => {
      const request: Request = {
        type: MessageType.GetDevice,
        args: {
          deviceUuid,
        },
      };
      this.sendRequest(request, resolve);
    });
  }

  setValue(deviceUuid, variableUuid, value) {
    return new Promise((resolve, reject) => {
      const request: Request = {
        type: MessageType.SetValue,
        reqId: 0,
        args: { deviceUuid, variableUuid, value },
      };

      this.sendRequest(request, (response) => {
        if (response.error !== undefined) {
          reject(response.error);
        } else {
          resolve(response.value);
        }
      });
    });
  }

  observe(deviceUuid: string, variableUuid: string) {
    const observable = new Subject();

    const observer: VariableObserver = {
      variableUuid,
      deviceUuid,
      observer: observable,
    };
    this.getDevice(deviceUuid).then((deviceConfig: DeviceConfig) => {
      if (deviceConfig) {
        observable.next(deviceConfig.vars[variableUuid].value);
      } else {
        observable.next(undefined);
      }
    });

    this.observables.push(observer);

    return observable;
  }

  unsubscribe(observable) {
    this.observables = this.observables.filter((variableObserver: VariableObserver) => {
      return variableObserver.observer !== observable;
    });
  }
}
