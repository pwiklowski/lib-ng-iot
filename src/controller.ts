import { w3cwebsocket } from "websocket";

import {
  MessageType,
  MessageHandler,
  Permission,
  Request,
  Response,
  DeviceConfig
} from "./interfaces";

export class Controller {
  ws: w3cwebsocket;
  callbacks: Map<number, Function>;
  messageHandler: MessageHandler = null;

  constructor() {
    this.callbacks = new Map();
    this.ws = new w3cwebsocket("ws://127.0.0.1:8000/controller");
    this.ws.onopen = this.onOpen;
    this.ws.close = this.onClose;
    this.ws.onmessage = this.onMessage;
  }

  private onOpen() {
    const request: Request = {
      type: MessageType.GetDevices,
      reqId: 0,
      args: {}
    };

    this.ws.send(JSON.stringify(request));
  }

  private onClose() {
    console.log("disconnected");

    setTimeout(() => {
      this.ws.onopen = this.onOpen;
    }, 1000);
  }

  onMessage(message) {
    const msg = JSON.parse(message);
    if (msg.resId !== undefined) {
      this.handleResponse(msg);
    } else {
      this.handleRequest(msg);
    }
  }

  private handleRequest(msg: Request) {}

  private handleResponse(msg: Response) {
    const callback = this.callbacks.get(msg.resId);
    if (callback) {
      callback(msg);
      this.callbacks.delete(msg.resId);
    }
  }

  sendRequest(req: Request, callback?: Function) {
    if (callback !== undefined && req.reqId) {
      this.callbacks.set(req.reqId, callback);
    }
    this.ws.send(JSON.stringify(req));
  }

  sendResponse(req: Request, res: Response) {
    res.resId = req.reqId;
    this.ws.send(JSON.stringify(res));
  }
}
