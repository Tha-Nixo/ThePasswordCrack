export type LogLevel = "info" | "warn" | "error";

export interface LogMessage {
  type: "LOG";
  msg: string;
  level: LogLevel;
}

export interface HumanInputRequest {
  type: "HUMAN_INPUT_REQUEST";
  ruleNumber: number;
  prompt: string;
}

export interface HumanInputResponse {
  type: "HUMAN_INPUT_RESPONSE";
  ruleNumber: number;
  input: string;
}
