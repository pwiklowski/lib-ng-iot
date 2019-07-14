import { w3cwebsocket, client } from "websocket";

import {
  MessageType,
  MessageHandler,
  Permission,
  Request,
  Response,
  DeviceConfig
} from "./interfaces";

export class Controller {
  ws;
  callbacks: Map<number, Function>;
  messageHandler: MessageHandler = null;
  reqId = 0;
  private onOpenCallback: Function;
  private url: string;

  constructor() {
    this.callbacks = new Map();
  }

  connect(url: string, callback: Function) {
    if (window) {
      this.ws = new w3cwebsocket(url);
    } else {
      this.ws = new client(url);
    }
    this.ws.onclose = this.onClose.bind(this);
    this.ws.onmessage = this.onMessage.bind(this);
    this.ws.onopen = callback;
    this.onOpenCallback = callback;
    this.url = url;
  }

  reconnect() {
    if (window) {
      this.ws = new w3cwebsocket(this.url);
    } else {
      this.ws = new client(this.url);
    }
    this.ws.onclose = this.onClose.bind(this);
    this.ws.onmessage = this.onMessage.bind(this);
    this.ws.onopen = this.onOpenCallback;
  }

  private onClose() {
    console.log("disconnected");

    setTimeout(() => {
      this.reconnect();
    }, 1000);
  }

  onMessage(message) {
    const msg = JSON.parse(message.data);
    if (msg.resId !== undefined) {
      this.handleResponse(msg);
    } else {
      this.handleRequest(msg);
    }
  }

  private handleRequest(msg: Request) {
    if (this.messageHandler !== null) {
      this.messageHandler(msg);
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
}
