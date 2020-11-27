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

  abstract async readAuthData();
  abstract async saveAuthData(data: AuthData);

  async start() {
    await this.readAuthData();
    try {
      await this.refreshToken();
      this.open();
    } catch (e) {
      console.error("error staring device", e);
      await this.login();
    }
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
      this.open();
    }, 1000);
  };

  stop() {
    this.socket.close();
    this.socket = null;
  }

  updateValue(variableUuid, value) {
    const deviceUuid = this.deviceConfig.deviceUuid;
    this.deviceConfig.vars[variableUuid].value = value;

    const request: Request = {
      type: MessageType.ValueUpdated,
      args: { deviceUuid, variableUuid, value },
    };
    this.socket.send(JSON.stringify(request));
  }

  getQueryString(data = {}) {
    return Object.entries(data)
      .map(([key, value]: [string, any]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");
  }

  async checkResponse(device_code, interval) {
    return new Promise(async (resolve, reject) => {
      const timer = setInterval(async () => {
        try {
          const response = await axios.request({
            method: "POST",
            url: "https://wiklosoft.eu.auth0.com/oauth/token",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            data: this.getQueryString({
              grant_type: "urn:ietf:params:oauth:grant-type:device_code",
              device_code: device_code,
              client_id: this.auth.client_id,
            }),
          });
          console.log(response.data);
          if (response.data.access_token) {
            clearInterval(timer);
            resolve(response);
          }
        } catch (e) {
          console.error(e.response.data);
        }
      }, interval * 1000);
    });
  }

  async login() {
    const response = await axios.request({
      method: "POST",
      url: "https://wiklosoft.eu.auth0.com/oauth/device/code",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      data: this.getQueryString({
        client_id: this.auth.client_id,
        scope: "profile openid offline_access",
        audience: "https://wiklosoft.eu.auth0.com/api/v2/",
      }),
    });
    console.log(response.data);
    const authResponse = await this.checkResponse(response.data.device_code, response.data.interval);
    this.handleAuthResponse(authResponse);
  }

  async refreshToken() {
    const response = await axios.request({
      method: "POST",
      url: "https://wiklosoft.eu.auth0.com/oauth/token",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      data: this.getQueryString({
        grant_type: "refresh_token",
        client_secret: this.auth.client_secret,
        client_id: this.auth.client_id,
        refresh_token: this.auth.refresh_token,
      }),
    });

    this.handleAuthResponse(response);
  }

  handleAuthResponse(response) {
    this.auth.access_token = response.data.access_token;

    if (response.data.refresh_token) {
      this.auth.refresh_token = response.data.refresh_token;
    }
    this.auth.expires_in = Math.floor(Date.now() / 1000) + response.data.expires_in;

    this.saveAuthData(this.auth);
  }
}
