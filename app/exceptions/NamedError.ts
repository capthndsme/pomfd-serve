import { ValidApiMessages } from "../../shared/types/ApiMessages.js";

 
export class NamedError extends Error {
  constructor(message: string, public name: ValidApiMessages, log?: () => void) {
    log && log();
    super(message);
  }
}