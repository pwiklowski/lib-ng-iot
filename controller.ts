import * as WebSocket from "ws";

import { MessageType, Permission, Request, DeviceConfig } from "./interfaces";

class Controller {
  ws: WebSocket;

  constructor() {
    this.ws = new WebSocket("ws://127.0.0.1:8000/controller", {});
    this.ws.on("open", this.onOpen.bind(this));
    this.ws.on("close", this.onClose.bind(this));
    this.ws.on("message", this.onMessage.bind(this));
  }

  onOpen() {
    const request: Request = {
      type: MessageType.GetDevices,
      reqId: 0,
      args: {}
    };

    this.ws.send(JSON.stringify(request));
  }

  onClose() {
    console.log("disconnected");

    setTimeout(() => {
      this.ws.on("open", this.onOpen);
    }, 1000);
  }

  onMessage(data) {
    console.log(`${Date.now()} ${data} ms`);
  }
}
