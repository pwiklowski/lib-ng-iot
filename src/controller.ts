import WebSocket from "isomorphic-ws";

import {
  MessageType,
  MessageHandler,
  Request,
  Response,
  DeviceConfig,
  ConnectionState,
  VariableObserver
} from "./interfaces";
import { BehaviorSubject, Subject } from "rxjs";

export class Controller {
  ws: WebSocket;
  callbacks: Map<number, Function>;
  reqId = 0;
  private url: string;

  observables: Array<VariableObserver> = [];

  connectionState: Subject<ConnectionState> = new BehaviorSubject(
    ConnectionState.DISCONNECTED
  );

  onOpen: Function;
  onClose: Function;
  onMessage: MessageHandler = null;

  constructor() {
    this.callbacks = new Map();
  }

  connect(url: string, callback: Function) {
    this.ws = new WebSocket(url);

    this.ws.onclose = this.onCloseHandler.bind(this);
    this.ws.onmessage = this.onMessageHandler.bind(this);
    this.ws.onopen = this.onOpenHandler.bind(this);
    this.ws.onerror = error => console.log(error);
    this.url = url;
  }

  reconnect() {
    this.ws = new WebSocket(this.url);
    this.ws.onclose = this.onCloseHandler.bind(this);
    this.ws.onmessage = this.onMessageHandler.bind(this);
    this.ws.onopen = this.onOpenHandler.bind(this);
  }

  getConnectionState(): Subject<ConnectionState> {
    return this.connectionState;
  }

  private onOpenHandler() {
    if (this.onOpen !== null) {
      this.getDevices(devices => {
        console.log("devices", devices);
        this.connectionState.next(ConnectionState.CONNECTED);
      });
    }
  }

  private onCloseHandler(error) {
    if (this.onClose !== null) {
      if (error.code === 4403) {
        this.connectionState.next(ConnectionState.NOT_AUTHORIZED);
      } else {
        this.connectionState.next(ConnectionState.DISCONNECTED);
      }
    }
  }

  private onMessageHandler(message) {
    const msg = JSON.parse(message.data);
    if (msg.resId !== undefined) {
      this.handleResponse(msg);
    } else {
      this.handleRequest(msg);
    }
  }

  private handleRequest(message: Request) {
    console.log("handle message", message);
    switch (message.type) {
      case MessageType.DeviceConnected:
        {
          const deviceConfig = message.args.device;
          const observables = this.observables.filter(
            observable => observable.deviceUuid === deviceConfig.deviceUuid
          );

          if (observables.length > 0) {
            observables.map(observable => {
              observable.observer.next(
                deviceConfig.vars[observable.variableUuid].value
              );
            });
          }
        }
        break;
      case MessageType.DeviceDisconnected:
        {
          const deviceUuid = message.args.id;
          const observables = this.observables.filter(
            observable => observable.deviceUuid === deviceUuid
          );

          if (observables.length > 0) {
            observables.map(observable => {
              observable.observer.next(undefined);
            });
          }
        }
        break;
      case MessageType.ValueUpdated:
        this.observables.forEach(observer => {
          if (
            observer.deviceUuid === message.args.deviceUuid &&
            observer.variableUuid === message.args.variableUuid
          ) {
            observer.observer.next(message.args.value);
          }
        });
        break;
    }
  }

  private handleResponse(msg: Response) {
    const callback = this.callbacks.get(msg.resId);
    if (callback) {
      callback(msg.res);
      this.callbacks.delete(msg.resId);
    }
  }

  sendRequest(req: Request, callback?: Function) {
    if (callback !== undefined) {
      req.reqId = this.reqId++;
      this.callbacks.set(req.reqId, callback);
    }
    this.ws.send(JSON.stringify(req));
  }

  sendResponse(req: Request, res: Response) {
    res.resId = req.reqId;
    this.ws.send(JSON.stringify(res));
  }

  getDevices(callback) {
    const request: Request = {
      type: MessageType.GetDevices
    };
    this.sendRequest(request, callback);
  }

  getDevice(deviceUuid: string): Promise<DeviceConfig> {
    return new Promise((resolve, reject) => {
      const request: Request = {
        type: MessageType.GetDevice,
        args: {
          deviceUuid
        }
      };
      this.sendRequest(request, resolve);
    });
  }

  setValue(deviceUuid, variableUuid, value) {
    const request: Request = {
      type: MessageType.SetValue,
      reqId: 0,
      args: { deviceUuid, variableUuid, value }
    };

    console.log("setValue", deviceUuid, variableUuid, value);
    this.sendRequest(request, response => {});
  }

  observe(deviceUuid: string, variableUuid: string) {
    const observable = new Subject();

    const observer: VariableObserver = {
      variableUuid,
      deviceUuid,
      observer: observable
    };
    this.getDevice(deviceUuid).then((response: any) => {
      if (response.deviceConfig) {
        observable.next(response.deviceConfig.vars[variableUuid].value);
      } else {
        observable.next(undefined);
      }
    });

    this.observables.push(observer);

    return observable;
  }

  unsubscribe(observable) {
    this.observables = this.observables.filter(
      (variableObserver: VariableObserver) => {
        return variableObserver.observer !== observable;
      }
    );
  }
}
