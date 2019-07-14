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
  READ_WRITE = "rw"
}

export enum MessageType {
  Hello,
  GetValue,
  GetDevices,
  Notification,
  DeviceConnected,
  DeviceDisconnected
}

export interface DeviceConfig {
  name: string;
  id: string;
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
