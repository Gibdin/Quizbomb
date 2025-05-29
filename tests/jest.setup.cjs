const { TextEncoder, TextDecoder } = require("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// make io() → a fresh { on: fn, emit: fn } each time
global.io = jest.fn(() => ({
  on: jest.fn(),
  emit: jest.fn(),
}));

global.localStorage = {
  getItem: jest.fn(() => "Player"),
  setItem: jest.fn(),
};
