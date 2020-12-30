import { Request, Response } from "./interfaces";
import WebSocket from "isomorphic-ws";

export abstract class Client {
  callbacks: Map<number, Function>;
  reqId = 0;
  ws: WebSocket;
  serverUrl: string;

  constructor() {
    this.callbacks = new Map();
  }

  protected onMessageHandler(message) {
    const msg = JSON.parse(message.data);
    if (msg.resId !== undefined) {
      this.handleResponse(msg);
    } else {
      this.handleRequest(msg);
    }
  }

  abstract handleRequest(message: Request);

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
}
