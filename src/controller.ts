import WebSocket from "isomorphic-ws";

import { MessageType, MessageHandler, Request, Response } from "./interfaces";

export class Controller {
  ws;
  callbacks: Map<number, Function>;
  reqId = 0;
  private url: string;

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
    this.url = url;
  }

  reconnect() {
    this.ws = new WebSocket(this.url);
    this.ws.onclose = this.onCloseHandler.bind(this);
    this.ws.onmessage = this.onMessageHandler.bind(this);
    this.ws.onopen = this.onOpenHandler.bind(this);
  }

  private onOpenHandler() {
    if (this.onOpen !== null) {
      this.onOpen();
    }
  }

  private onCloseHandler() {
    if (this.onClose !== null) {
      this.onClose();
    }

    setTimeout(() => {
      this.reconnect();
    }, 1000);
  }

  private onMessageHandler(message) {
    const msg = JSON.parse(message.data);
    if (msg.resId !== undefined) {
      this.handleResponse(msg);
    } else {
      this.handleRequest(msg);
    }
  }

  private handleRequest(msg: Request) {
    if (this.onMessage !== null) {
      this.onMessage(msg);
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
