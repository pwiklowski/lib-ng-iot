import websocket from "isomorphic-ws";
import axios from "axios";

import { MessageType, Request, DeviceConfig, AuthData } from "./interfaces";

export abstract class IotDevice {
  socket = null;
  deviceConfig: DeviceConfig;
  serverUrl: string;
  auth: AuthData;

  constructor(serverUrl: string, deviceConfig: DeviceConfig) {
    this.serverUrl = serverUrl;
    this.deviceConfig = deviceConfig;
  }

  abstract async readAuthData(): Promise<AuthData>;
  abstract async saveAuthData(data: AuthData);

  async start() {
    this.auth = await this.readAuthData();
    await this.refreshToken();
    this.open();
  }

  open() {
    this.socket = new websocket(`${this.serverUrl}?token=${this.auth.access_token}`);
    this.socket.on("open", this.onOpen.bind(this));
    this.socket.on("close", this.onClose.bind(this));
    this.socket.on("message", this.onMessage.bind(this));
    this.socket.on("error", this.onError.bind(this));
  }

  onOpen() {
    console.log("connected");
    const request: Request = {
      type: MessageType.Hello,
      reqId: 0,
      args: { config: this.deviceConfig },
    };

    this.socket.send(JSON.stringify(request));
  }

  onMessage(data: string) {
    const req: Request = JSON.parse(data);
    console.log(`message ${req} ms`, req.type);

    if (req.type === MessageType.SetValue) {
      this.deviceConfig.vars[req.args.variableUuid].value = req.args.value;

      const valueUpdatedRequest: Request = {
        type: MessageType.ValueUpdated,
        args: {
          variableUuid: req.args.variableUuid,
          value: this.deviceConfig.vars[req.args.variableUuid].value,
        },
      };
      this.socket.send(JSON.stringify(valueUpdatedRequest));
    }
  }

  onError(error) {
    console.log(error);
    if (error.code === "ECONNRESET") {
      this.refreshToken();
    }
  }

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
      args: { variable, value },
    };
    this.socket.send(JSON.stringify(request));
  }

  async refreshToken() {
    const params = new URLSearchParams({ refresh_token: this.auth.refresh_token, grant_type: "refresh_token" });

    try {
      const response = await axios.post("https://auth.wiklosoft.com/v1/oauth/tokens", params, {
        auth: { username: this.auth.client_id, password: this.auth.secret },
      });
      this.auth.access_token = response.data.access_token;
      this.auth.refresh_token = response.data.refresh_token;

      this.saveAuthData(this.auth);
    } catch (error) {
      console.error(error);
    }
  }
}
