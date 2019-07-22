import websocket from "isomorphic-ws";

import { MessageType, Request, DeviceConfig } from "./interfaces";

export class IotDevice {
  socket = null;
  deviceConfig: DeviceConfig;
  serverUrl: string;

  constructor(serverUrl: string, deviceConfig: DeviceConfig) {
    this.serverUrl = serverUrl;
    this.deviceConfig = deviceConfig;
  }

  start() {
    this.socket = new websocket(this.serverUrl);
    this.socket.onopen = this.onOpen;
    this.socket.onclose = this.onClose;
    this.socket.onmessage = this.onMessage;
    this.socket.onerror = this.onError;
  }
  onOpen = () => {
    const request: Request = {
      type: MessageType.Hello,
      reqId: 0,
      args: { config: this.deviceConfig }
    };

    this.socket.send(JSON.stringify(request));
  };

  onMessage = data => {
    console.log(`msg time: ${Date.now()} ${data} ms`);
  };

  onError(error) {}

  onClose = () => {
    setTimeout(() => {
      this.start();
    }, 1000);
  };

  stop() {
    this.socket.close();
    this.socket = null;
  }

  updateValue(variable, value) {
    this.deviceConfig.vars[variable].value = value;

    const request: Request = {
      type: MessageType.ValueUpdated,
      args: { variable, value }
    };
    this.socket.send(JSON.stringify(request));
  }
}
