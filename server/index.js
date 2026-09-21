import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const db = new Database("valhalla.db");

const PORT = process.env.PORT || 3001;

const SECRET =
  process.env.JWT_SECRET || "TROQUE-ESTA-CHAVE-EM-PRODUCAO";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());


// ======================================================
// BANCO DE DADOS
// ======================================================

db.exec(`
CREATE TABLE IF NOT EXISTS clients(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL DEFAULT 0,
  duration INTEGER DEFAULT 30,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS barbers(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  specialty TEXT,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS bookings(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER,
  service_id INTEGER,
  barber_id INTEGER,
  date TEXT,
  time TEXT,
  status TEXT DEFAULT 'pendente',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(barber_id,date,time)
);

CREATE TABLE IF NOT EXISTS availability(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barber_id INTEGER,
  weekday INTEGER,
  start_time TEXT,
  end_time TEXT
);

CREATE TABLE IF NOT EXISTS blocks(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barber_id INTEGER,
  date TEXT,
  start_time TEXT,
  end_time TEXT,
  reason TEXT
);
`);


// ======================================================
// SERVIÇOS INICIAIS
// ======================================================

if (db.prepare("SELECT COUNT(*) c FROM services").get().c === 0) {

  const q = db.prepare(
    "INSERT INTO services(name,description,price,duration) VALUES(?,?,?,?)"
  );

  for (const service of [
    ["Corte de cabelo", "Acabamento preciso e personalizado.", 0, 30],
    ["Aparar a barba", "Modelagem e acabamento.", 0, 30],
    ["Barbear com toalha quente", "Experiência clássica.", 0, 40],
    ["Corte militar", "Prático e preciso.", 0, 30],
    ["Barbearia Vintage", "Tradição clássica.", 0, 45],
    ["Cortes infantis", "Para crianças.", 0, 30]
  ]) {
    q.run(...service);
  }
}


// ======================================================
// BARBEIROS INICIAIS
// ======================================================

if (db.prepare("SELECT COUNT(*) c FROM barbers").get().c === 0) {

  const q = db.prepare(
    "INSERT INTO barbers(name,specialty) VALUES(?,?)"
  );

  q.run(
    "Erik Valhalla",
    "Especialista em cortes masculinos"
  );

  q.run(
    "Ragnar",
    "Barbas e acabamento"
  );

  q.run(
    "Leif",
    "Cortes clássicos e infantis"
  );
}


// ======================================================
// AUTENTICAÇÃO
// ======================================================

const auth = (req, res, next) => {

  try {

    const token = (req.headers.authorization || "")
      .replace("Bearer ", "");

    jwt.verify(token, SECRET);

    next();

  } catch {

    res.status(401).send("Não autorizado");

  }
};


// ======================================================
// LOGIN ADMIN
// ======================================================

app.post("/api/login", (req, res) => {

  const { email, password } = req.body;

  if (
    email === "admin@valhalla.local" &&
    password === (process.env.ADMIN_PASSWORD || "admin123")
  ) {

    return res.json({
      token: jwt.sign(
        { admin: true },
        SECRET,
        { expiresIn: "8h" }
      )
    });

  }

  res.status(401).send("Login inválido");

});


// ======================================================
// SERVIÇOS
// ======================================================

app.get("/api/services", (req, res) => {

  res.json(
    db
      .prepare(
        "SELECT * FROM services WHERE active=1 ORDER BY id"
      )
      .all()
  );

});


// ======================================================
// BARBEIROS
// ======================================================

app.get("/api/barbers", (req, res) => {

  res.json(
    db
      .prepare(
        "SELECT * FROM barbers WHERE active=1 ORDER BY id"
      )
      .all()
  );

});


// ======================================================
// HORÁRIOS
// ======================================================

const defaultTimes = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30"
];

app.get("/api/availability", (req, res) => {

  const { date, barberId } = req.query;

  if (!date || !barberId) {

    return res.json({
      slots: []
    });

  }

  const used = db
    .prepare(
      `
      SELECT time
      FROM bookings
      WHERE barber_id=?
      AND date=?
      AND status!='cancelado'
      `
    )
    .all(barberId, date)
    .map(x => x.time);

  const blocked = db
    .prepare(
      `
      SELECT start_time,end_time
      FROM blocks
      WHERE barber_id=?
      AND date=?
      `
    )
    .all(barberId, date);

  const slots = defaultTimes.filter(
    time =>
      !used.includes(time) &&
      !blocked.some(
        block =>
          time >= block.start_time &&
          time < block.end_time
      )
  );

  res.json({
    slots
  });

});


// ======================================================
// CRIAR AGENDAMENTO
// ======================================================

app.post("/api/bookings", (req, res) => {

  const {
    service_id,
    barber_id,
    date,
    time,
    name,
    phone,
    email,
    notes
  } = req.body;

  if (
    !service_id ||
    !barber_id ||
    !date ||
    !time ||
    !name ||
    !phone ||
    !email
  ) {

    return res
      .status(400)
      .send("Dados obrigatórios ausentes");

  }

  if (
    date <
    new Date()
      .toISOString()
      .slice(0, 10)
  ) {

    return res
      .status(400)
      .send("Data inválida");

  }

  try {

    const client = db
      .prepare(
        `
        INSERT INTO clients
        (name,phone,email,notes)
        VALUES(?,?,?,?)
        `
      )
      .run(
        name,
        phone,
        email,
        notes || ""
      );

    const booking = db
      .prepare(
        `
        INSERT INTO bookings
        (client_id,service_id,barber_id,date,time,status,notes)
        VALUES(?,?,?,?,?,?,?)
        `
      )
      .run(
        client.lastInsertRowid,
        service_id,
        barber_id,
        date,
        time,
        "pendente",
        notes || ""
      );

    const result = db
      .prepare(
        `
        SELECT
          b.id,
          b.date,
          b.time,
          b.status,
          c.name client_name,
          c.phone,
          c.email,
          s.name service_name,
          r.name barber_name

        FROM bookings b

        JOIN clients c
          ON c.id=b.client_id

        JOIN services s
          ON s.id=b.service_id

        JOIN barbers r
          ON r.id=b.barber_id

        WHERE b.id=?
        `
      )
      .get(booking.lastInsertRowid);

    return res.json(result);

  } catch (error) {

    if (String(error).includes("UNIQUE")) {

      return res
        .status(409)
        .send(
          "Este horário acabou de ser ocupado."
        );

    }

    res
      .status(500)
      .send(
        "Erro ao criar agendamento"
      );

  }

});


// ======================================================
// LISTAR AGENDAMENTOS - ADMIN
// ======================================================

app.get("/api/bookings", auth, (req, res) => {

  res.json(
    db
      .prepare(
        `
        SELECT
          b.*,
          c.name client_name,
          c.phone,
          c.email,
          s.name service_name,
          r.name barber_name

        FROM bookings b

        JOIN clients c
          ON c.id=b.client_id

        JOIN services s
          ON s.id=b.service_id

        JOIN barbers r
          ON r.id=b.barber_id

        ORDER BY date,time
        `
      )
      .all()
  );

});


// ======================================================
// ALTERAR STATUS DO AGENDAMENTO
// ======================================================

app.patch("/api/bookings/:id", auth, (req, res) => {

  db
    .prepare(
      "UPDATE bookings SET status=? WHERE id=?"
    )
    .run(
      req.body.status,
      req.params.id
    );

  res.json({
    ok: true
  });

});


// ======================================================
// CRIAR SERVIÇO - ADMIN
// ======================================================

app.post("/api/services", auth, (req, res) => {

  const data = req.body;

  const result = db
    .prepare(
      `
      INSERT INTO services
      (name,description,price,duration)
      VALUES(?,?,?,?)
      `
    )
    .run(
      data.name,
      data.description || "",
      data.price || 0,
      data.duration || 30
    );

  res.json({
    id: result.lastInsertRowid
  });

});


// ======================================================
// SERVIR O SITE REACT
// ======================================================

app.use(
  express.static(
    path.join(
      __dirname,
      "../client/dist"
    )
  )
);


// ======================================================
// FALLBACK DO REACT
// ======================================================

app.use((req, res, next) => {

  if (
    req.method === "GET" &&
    !req.path.startsWith("/api/")
  ) {

    return res.sendFile(
      path.join(
        __dirname,
        "../client/dist/index.html"
      )
    );

  }

  next();

});


// ======================================================
// INICIAR SERVIDOR
// ======================================================

app.listen(
  PORT,
  () => {
    console.log(
      `Valhalla API em http://localhost:${PORT}`
    );
  }
);