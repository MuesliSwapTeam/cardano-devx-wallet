import { METHOD as API_METHOD } from './api';

export enum APIError {
  Refused = 'Refused',
  // Add other error types as needed
}

export const METHOD = {
  ...API_METHOD,
  requestData: 'requestData',
  returnData: 'returnData',
  isWhitelisted: 'isWhitelisted',
} as const;

export enum SENDER {
  webpage = 'webpage',
  extension = 'extension',
}

export const TARGET = 'DevXCardanoWallet';
