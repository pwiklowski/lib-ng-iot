import { Subject } from "rxjs";
export interface Request {
  reqId?: number;
  type: MessageType;
  args?: any;
}

export interface Response {
  resId?: number;
  res: any;
}
export enum Permission {
  READ = "r",
  WRITE = "w",
  READ_WRITE = "rw",
}

export enum MessageType {
  Hello,
  GetValue,
  GetDevices,
  Notification,
  DeviceConnected,
  DeviceDisconnected,
  ValueUpdated,
  SetValue,
  GetDevice,
  DeviceListChanged,
  Ping,
  RuleLog,
}

export interface DeviceConfig {
  isConnected?: boolean;
  name: string;
  deviceUuid: string;
  version: string;
  vars: Vars;
}

export interface Vars {
  [variable: string]: Var;
}

export interface Var {
  name: string;
  schema: any;
  access: Permission;
  value: any;
}

export interface MessageHandler {
  (message: Request): void;
}

export interface VariableObserver {
  variableUuid: string;
  deviceUuid: string;
  observer: Subject<Object>;
}

export enum ConnectionState {
  CONNECTED,
  DISCONNECTED,
  NOT_AUTHORIZED,
}

export interface AuthData {
  client_id: string;
  client_secret: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
}

export interface Rule {
  name: string;
  id?: string;
  deviceUuid: string;
  variableUuid: string;
  username?: string;
  script: string;
}

export interface Preset {
  username?: string;
  id?: string;
  name: string;
  uuid?: string;
  variables: Array<VariablePreset>;
}

export interface VariablePreset {
  deviceUuid: string;
  variableUuid: string;
  value: object;
}

export interface Alias {
  username?: string;
  id?: string;
  name: string;
  deviceUuid?: string;
}
