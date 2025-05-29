// tests/client/multiplayer.test.js
import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";

// 1) Load the HTML into JSDOM
const html = fs.readFileSync(
  path.resolve(__dirname, "../../public/multiplayer.html"),
  "utf8",
);
const dom = new JSDOM(html, { runScripts: "dangerously" });

// 2) Make the JSDOM window & document global
global.window = dom.window;
global.document = dom.window.document;
// if you use createElement, events, etc.:
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.Event = dom.window.Event;

// 3) Mock socket.io & localStorage BEFORE loading your module
// Create one stub instance so module and tests share it:
const socketStub = { on: jest.fn(), emit: jest.fn(), off: jest.fn() };
global.io = jest.fn(() => socketStub);

global.localStorage = {
  getItem: jest.fn(() => "Player"),
  setItem: jest.fn(),
};

// 4) Now require your module *after* the mocks so `io()` really returns socketStub
beforeAll(() => {
  jest.isolateModules(() => {
    require("../../public/js/multiplayer.js");
  });
});

describe("C1–C6: multiplayer.js handlers", () => {
  beforeEach(() => {
    // clear only the emits – keep the handler registrations from module load
    socketStub.emit.mockClear();
  });

  test("C1: on game:start hides lobby & shows game", () => {
    const handler = socketStub.on.mock.calls.find(
      (c) => c[0] === "game:start",
    )[1];

    handler({ promptTimer: 5 });

    expect(document.getElementById("lobby").style.display).toBe("none");
    expect(document.getElementById("game").style.display).toBe("flex");
    expect(document.getElementById("answer-input").disabled).toBe(true);
  });

  test("C2: on player-update renders live scoreboard", () => {
    const players = [
      { name: "A", lives: 2, score: 3 },
      { name: "B", lives: 1, score: 0 },
    ];
    // note the colon in the real event name:
    const handler = socketStub.on.mock.calls.find(
      (call) => call[0] === "player:update",
    )[1];

    handler(players);

    const lis = Array.from(document.querySelectorAll("#gamePlayerList li"));
    expect(lis).toHaveLength(2);
    expect(lis[0].textContent).toMatch(/A.*3 pts.*2 ❤️/);
  });

  test("C3: on game:turn highlights & enables input", () => {
    const fakeId = "socket123";
    socketStub.id = fakeId;

    document.getElementById("gamePlayerList").innerHTML =
      `<li data-id="${fakeId}">Me</li><li data-id="other">Other</li>`;

    const handler = socketStub.on.mock.calls.find(
      (call) => call[0] === "game:turn",
    )[1];

    handler({ playerId: fakeId, playerName: "Me" });

    const meLi = document.querySelector(`li[data-id="${fakeId}"]`);
    expect(meLi.classList.contains("active-turn")).toBe(true);
    expect(document.getElementById("answer-input").disabled).toBe(false);
  });

  test("C4: on game:prompt displays word & starts countdown", () => {
    jest.useFakeTimers();

    const handler = socketStub.on.mock.calls.find(
      (call) => call[0] === "game:prompt",
    )[1];

    handler({ word: "chien", timer: 3 });

    // match the actual IDs in your HTML:
    expect(document.getElementById("prompt-text").textContent).toBe("chien");
    expect(document.getElementById("timer-text").textContent).toBe("3");

    jest.advanceTimersByTime(1000);
    expect(document.getElementById("timer-text").textContent).toBe("2s");

    jest.useRealTimers();
  });

  test("C5: on player:correct shows green feedback & plays sound", () => {
    const handler = socketStub.on.mock.calls.find(
      (call) => call[0] === "player:correct",
    )[1];

    window.HTMLAudioElement.prototype.play = jest.fn();
    handler({ playerName: "A" });

    const input = document.getElementById("answer-input");
    expect(input.style.backgroundColor).toBe("green");
    expect(window.HTMLAudioElement.prototype.play).toHaveBeenCalled();
  });

  test("C6: on player:wrong shows red feedback & does not advance", () => {
    const handler = socketStub.on.mock.calls.find(
      (call) => call[0] === "player:wrong",
    )[1];

    window.HTMLAudioElement.prototype.play = jest.fn();
    handler({ playerName: "A" });

    const input = document.getElementById("answer-input");
    expect(input.style.backgroundColor).toBe("red");
  });
});
