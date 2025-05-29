import { generateCode, rooms, getRoomsData } from "../../server/index.js";

describe("server helpers", () => {
  test("S1: generateCode returns 5-char alphanumeric code", () => {
    const code = generateCode();
    expect(code).toHaveLength(5);
    expect(/^[A-Z0-9]{5}$/.test(code)).toBe(true);
  });

  test("S2: getRoomsData extracts public room info", () => {
    rooms.clear();
    rooms.set("AAA11", {
      code: "AAA11",
      hostName: "Alice",
      players: [{}, {}],
      settings: { maxPlayers: 4 },
      private: false,
    });
    expect(getRoomsData()).toEqual([
      {
        code: "AAA11",
        hostName: "Alice",
        playerCount: 2,
        maxPlayers: 4,
        isPrivate: false,
      },
    ]);
  });
});
