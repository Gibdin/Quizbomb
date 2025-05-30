// Test for authentication endpoints
import fs from "fs";
import path from "path";
import request from "supertest";
import { app } from "../../server/index.js";

// Jest sets __dirname:
const dbPath = path.join(__dirname, "tmpUsers.json");

describe("S5–S9: /api/register & /api/login", () => {
  beforeEach(() => {
    fs.writeFileSync(dbPath, "[]");
    process.env.USERS_DB = dbPath;
  });
  afterAll(() => {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  test("S5: POST /api/register succeeds", async () => {
    const res = await request(app)
      .post("/api/register")
      .send({ username: "bob", password: "secret" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.username).toBe("bob");
    const users = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
    expect(users).toHaveLength(1);
  });

  test("S6: POST /api/register missing fields → 400", async () => {
    const res = await request(app)
      .post("/api/register")
      .send({ username: "bob" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Username & password required" });
  });

  test("S7: POST /api/register duplicate → 400", async () => {
    await request(app)
      .post("/api/register")
      .send({ username: "bob", password: "p1" });
    const res = await request(app)
      .post("/api/register")
      .send({ username: "bob", password: "p2" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Username already taken" });
  });

  test("S8: POST /api/login success → 200", async () => {
    await request(app)
      .post("/api/register")
      .send({ username: "bob", password: "p1" });
    const res = await request(app)
      .post("/api/login")
      .send({ username: "bob", password: "p1" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

  test("S9: POST /api/login bad/missing → 400 or 401", async () => {
    let res = await request(app).post("/api/login").send({ username: "bob" });
    expect(res.status).toBe(400);
    res = await request(app)
      .post("/api/login")
      .send({ username: "bob", password: "wrong" });
    expect(res.status).toBe(401);
  });
});
