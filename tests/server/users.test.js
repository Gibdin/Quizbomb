// Tests for user login and registration functionality
import fs from "fs";
import tmp from "tmp";
import { readUsers, writeUsers } from "../../server/index.js";

describe("S3/S4: readUsers & writeUsers", () => {
  let tmpFile;
  beforeAll(() => {
    tmpFile = tmp.fileSync().name;
    process.env.USERS_DB = tmpFile;
  });
  afterAll(() => {
    // only unlink if the temp file still exists
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  });

  test("S3: readUsers returns [] if file missing or invalid", () => {
    // ensure file does not exist
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    expect(readUsers()).toEqual([]);
  });

  test("S4: writeUsers + readUsers round-trip correctly", () => {
    const users = [{ user_id: 1, username: "u1", password: "p1" }];
    writeUsers(users);
    expect(readUsers()).toEqual(users);
  });
});
