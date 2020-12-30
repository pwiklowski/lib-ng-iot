import axios from "axios";
import { Client } from "./client";
import WebSocket from "isomorphic-ws";

import { MessageType, Request, DeviceConfig, AuthData } from "./interfaces";

export abstract class IotDevice extends Client {
  deviceConfig: DeviceConfig;
  auth: AuthData;

  constructor(serverUrl: string, deviceConfig: DeviceConfig, auth: AuthData) {
    super();
    this.auth = auth;
    this.serverUrl = serverUrl;
    this.deviceConfig = deviceConfig;
  }

  abstract async readAuthData();
  abstract async saveAuthData(data: AuthData);

  getAuthConfigFilename() {
    return this.deviceConfig.deviceUuid + ".json";
  }

  async start() {
    try {
      await this.readAuthData();
      if (this.isRefeshTokenNeeded()) {
        await this.refreshToken();
      }
      await this.open();
    } catch (e) {
      console.error("error staring device", e.message);
      await this.login();
      await this.open();
    }
  }

  isRefeshTokenNeeded() {
    console.log("isRefeshTokenNeeded", this.auth.expires_in < Date.now() / 1000);
    return this.auth.expires_in < Date.now() / 1000;
  }

  async open() {
    this.ws = new WebSocket(`${this.serverUrl}?token=${this.auth.id_token}`);
    this.ws.onclose = this.onClose.bind(this);
    this.ws.onmessage = this.onMessageHandler.bind(this);

    this.ws.onopen = () => {
      console.log("connected");
      const request: Request = {
        type: MessageType.Hello,
        reqId: 0,
        args: { config: this.deviceConfig },
      };

      this.sendRequest(request, null);
    };
  }

  handleRequest(req: Request) {
    if (req.type === MessageType.SetValue) {
      this.deviceConfig.vars[req.args.variableUuid].value = req.args.value;

      console.log("set value ", req.args.value);
      const valueUpdatedRequest: Request = {
        type: MessageType.ValueUpdated,
        args: {
          variableUuid: req.args.variableUuid,
          value: this.deviceConfig.vars[req.args.variableUuid].value,
        },
      };
      this.sendRequest(valueUpdatedRequest);
    }
  }

  async onClose(closeCode) {
    console.log("on close", closeCode.code);
    if (closeCode.code === 4403) {
      try {
        await this.refreshToken();
        await this.open();
      } catch (e) {
        console.error(e.message, e.response.data, e.response.status);
        if (e.response.status === 403) {
          await this.login();
          await this.open();
        }
      }
    } else {
      setTimeout(() => {
        this.open();
      }, 10000);
    }
  }

  stop() {
    this.ws.close();
    this.ws = null;
  }

  updateValue(variableUuid, value) {
    const deviceUuid = this.deviceConfig.deviceUuid;
    this.deviceConfig.vars[variableUuid].value = value;

    const request: Request = {
      type: MessageType.ValueUpdated,
      args: { deviceUuid, variableUuid, value },
    };
    this.ws.send(JSON.stringify(request));
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
        scope: "name email profile openid offline_access",
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
    this.auth.id_token = response.data.id_token;

    this.saveAuthData(this.auth);
  }
}
